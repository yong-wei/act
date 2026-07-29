/**
 * Real PostgreSQL integration for aggregate CourseCoverage + ACT Crosswalk
 * governance (#1126).
 *
 * Uses:
 * - real #1132 computeAndPersistReleaseSetDelta (no synthetic delta rows)
 * - real #1124 persisted inventory snapshot (import then loadVerified)
 * - membership equality without fixed production count
 * - three capture identities (governance/import/delta may differ)
 *
 * Does NOT claim production authoring review completion when the controlled
 * active file is absent. In that case coverage baseline import is deferred.
 */
import 'dotenv/config';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';

import { Client } from 'pg';

import {
  AggregateGovernanceRepository,
  V03_R2_FIXTURE_OBJECT_COUNT,
  buildDispositionFromReview,
  buildStructuralUnitIndexFromInventory,
  computeCoverageSourceHash,
  runAggregateGovernance,
  selectCanonicalObjectMembership,
  type CaptureIdentity,
  type CourseCoverageDisposition,
} from '../../src/lib/aggregate-governance';
import {
  buildCurrentInventory,
  CanonicalResourceBindingRepository,
  loadVerifiedPersistedCurrentInventory,
  selectResourceKnowledgeAuthority,
} from '../../src/lib/canonical-resource-binding';
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  importValidatedAggregateRelease,
  loadAndValidateAggregateRelease,
} from '../actkg-release/ctkg-0-2-aggregate-release';
import { loadAndValidatePublicBundleV1 } from '../actkg-release/public-bundle-v1';
import { computeAndPersistReleaseSetDelta } from '../actkg-release/release-set-delta';
import {
  importValidatedActKGBundle,
} from '../actkg-release/standard-bundle-import';
import {
  AGGREGATE_COVERAGE_ACTIVE_PATH,
} from '../course-coverage/aggregate-coverage';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') throw new Error('DATABASE_URL is required');
  console.log(JSON.stringify({
    ok: false,
    deferred: true,
    reason: 'DATABASE_URL unavailable',
  }));
  process.exit(0);
}

const schemaName = `actkg_agg_gov_${process.pid}_${Date.now()}`;
const root = process.cwd();
const LOCK_V3 = 'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.3-r2.json';

const checkoutRevision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout.trim();
assert.match(checkoutRevision, /^[a-f0-9]{40}$/u);

let admin: Client | null = null;
let db: ReturnType<typeof createPrismaClient> | null = null;
let isolationMode: 'database' | 'schema' = 'schema';

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schema);
  parsed.searchParams.set('options', `-csearch_path=${schema},public`);
  return parsed.toString();
}

async function ensureIsolatedDatabaseUrl(): Promise<string> {
  admin = new Client({ connectionString: sourceUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${schemaName}"`);
    const url = new URL(sourceUrl!);
    url.pathname = `/${schemaName}`;
    url.searchParams.delete('schema');
    isolationMode = 'database';
    return url.toString();
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
  }
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  isolationMode = 'schema';
  return withSchema(sourceUrl!, schemaName);
}

function migrate(url: string): void {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function observedOf(capture: CaptureIdentity) {
  return { ...capture };
}

function provisionalDisposition(canonicalId: string): CourseCoverageDisposition {
  return buildDispositionFromReview({
    canonicalId,
    role: 'excluded_with_rationale',
    rationale: 'postgres harness provisional disposition — not production reviewed authoring',
    evidenceRefs: [
      `canonical:${canonicalId}`,
      'harness:test-aggregate-governance-postgres',
    ],
    reviewIdentity: 'test-harness:aggregate-gov-provisional-not-production',
  });
}

async function main(): Promise<void> {
  const testUrl = await ensureIsolatedDatabaseUrl();
  migrate(testUrl);
  process.env.DATABASE_URL = testUrl;
  db = createPrismaClient({ log: ['warn', 'error'] });
  if (isolationMode === 'schema') {
    await db.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
  }

  try {
    assert.equal(await db.actkgImportReceipt.count(), 0);

    const validatedExact = await loadAndValidateAggregateRelease({
      captureRevision: checkoutRevision,
    });
    await importValidatedAggregateRelease(db, validatedExact);

    const validatedV03 = await loadAndValidatePublicBundleV1({
      lockPath: LOCK_V3,
      captureRevision: checkoutRevision,
      gitRoot: root,
    });
    await importValidatedActKGBundle(db, validatedV03);

    // Real #1132 delta for accepted v0.3 candidate (no synthetic receipt rows).
    // Dirty protected capture paths fail closed — no bypass.
    let deltaResult: Awaited<ReturnType<typeof computeAndPersistReleaseSetDelta>>;
    try {
      deltaResult = await computeAndPersistReleaseSetDelta(db, {
        candidateReleaseId: validatedV03.releaseIdentity.releaseId,
        expectedCaptureRevision: checkoutRevision,
        gitRoot: root,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify({
        ok: false,
        deferred: true,
        reason: 'real #1132 computeAndPersistReleaseSetDelta failed (likely dirty protected paths)',
        detail: message,
        note: 'No synthetic Delta. Fail closed until clean checkpoint.',
      }, null, 2));
      process.exitCode = 1;
      return;
    }
    assert.equal(deltaResult.computed.authorizationState, 'ACCEPTED');
    assert.ok(deltaResult.persisted.receiptId);
    assert.match(deltaResult.persisted.outputDigest, /^[a-f0-9]{64}$/u);

    const releaseSet = await db.actkgReleaseSet.findFirstOrThrow({
      where: { id: { contains: 'v3' } },
      include: {
        receipt: true,
        releases: {
          include: {
            entries: { orderBy: { ordinal: 'asc' } },
            projectionNodes: { orderBy: { ordinal: 'asc' } },
            upstreamRagReferences: { orderBy: { ordinal: 'asc' } },
            projectionIdentities: true,
          },
        },
      },
    });
    const release = releaseSet.releases[0]!;
    const receipt = releaseSet.receipt!;
    const delta = await db.actkgReleaseSetDeltaReceipt.findUniqueOrThrow({
      where: { id: deltaResult.persisted.receiptId },
      include: { signals: true },
    });

    const membership = selectCanonicalObjectMembership({
      projectionNodes: release.projectionNodes.map((row) => ({ entityId: row.entityId })),
      releaseEntries: release.entries.map((row) => ({
        entityId: row.entityId,
        entityRole: row.entityRole,
      })),
    });
    // Fixture assertion only — not a production gate.
    assert.equal(membership.canonicalIds.length, V03_R2_FIXTURE_OBJECT_COUNT);

    // Real #1124 inventory: operator import snapshot, then governance load with
    // pinned watermark (never mint a fresh LSN inside governance).
    let inventory;
    try {
      const imported = await buildCurrentInventory(db, {
        capturedAt: '2026-07-30T00:00:00.000Z',
        dbWatermark: 'test-watermark-persisted',
      });
      const bindingRepo = new CanonicalResourceBindingRepository(db as never);
      await bindingRepo.persistInventory(imported);
      inventory = await loadVerifiedPersistedCurrentInventory(db);
      assert.equal(inventory.dbWatermark, 'test-watermark-persisted');
      assert.equal(inventory.runId, imported.runId);
      // Live rebuild may observe a different WAL LSN; verified load must stay pinned.
      const liveRebuild = await buildCurrentInventory(db);
      assert.equal(liveRebuild.runId, imported.runId);
      assert.notEqual(liveRebuild.dbWatermark, inventory.dbWatermark);
      const reloaded = await loadVerifiedPersistedCurrentInventory(db);
      assert.equal(reloaded.dbWatermark, inventory.dbWatermark);
      assert.equal(reloaded.runId, inventory.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify({
        ok: false,
        deferred: true,
        reason: 'real #1124 inventory capture/import/verify failed (likely dirty protected paths)',
        detail: message,
        membershipCount: membership.canonicalIds.length,
        deltaReceiptId: delta.id,
        note: 'Fail closed until clean checkpoint and operator inventory import.',
      }, null, 2));
      process.exitCode = 1;
      return;
    }

    assert.equal(inventory.captureRevision, checkoutRevision);
    const structural = buildStructuralUnitIndexFromInventory({ inventory });
    assert.ok(structural.entries.length > 0, 'structural index must not be empty');

    // Capture identity model: governance may differ from historical import/delta
    // in production. Here import/delta use the same harness revision, but fields
    // are still distinct and independently observed.
    const importCaptureRevision = receipt.captureRevision;
    const deltaCaptureRevision = delta.captureRevision;
    // Simulate distinct historical identities while keeping observations coherent.
    const governanceCaptureRevision = inventory.captureRevision;

    const runtime = release.projectionIdentities.find((row) => row.isRuntime)
      ?? release.projectionIdentities[0]
      ?? null;

    // Active reviewed authoring is not present in this worktree by design.
    let activeAuthoringPresent = false;
    try {
      await access(`${root}/${AGGREGATE_COVERAGE_ACTIVE_PATH}`);
      activeAuthoringPresent = true;
    } catch {
      activeAuthoringPresent = false;
    }

    // Provisional in-memory authoring for pipeline mechanics only (not production).
    const provisionalEntries = membership.canonicalIds.map(provisionalDisposition);
    const provisionalWithoutHash = {
      schemaVersion: 'act-course-coverage-overlay/v2' as const,
      overlayId: 'automatic-control-aggregate-coverage-v1' as const,
      overlayVersion: '1',
      courseId: 'automatic-control' as const,
      releaseSetId: releaseSet.id,
      releaseId: release.id,
      releaseHash: release.releaseHash,
      sourceDatasetHash: receipt.sourceDatasetHash ?? null,
      deltaReceiptId: delta.id,
      mode: 'baseline' as const,
      authoringRevision: governanceCaptureRevision,
      entries: provisionalEntries,
    };
    const provisionalAuthoring = {
      ...provisionalWithoutHash,
      sourceHash: computeCoverageSourceHash(provisionalWithoutHash),
    };

    const capture: CaptureIdentity = {
      captureRevision: governanceCaptureRevision,
      importCaptureRevision,
      deltaCaptureRevision,
      dbWatermark: inventory.dbWatermark,
      releaseSetId: releaseSet.id,
      releaseId: release.id,
      releaseHash: release.releaseHash,
      sourceDatasetHash: receipt.sourceDatasetHash ?? null,
      deltaReceiptId: delta.id,
      deltaOutputDigest: delta.outputDigest,
      deltaClassification: delta.classification,
      runtimeProjectionId: runtime?.projectionId ?? receipt.projectionId ?? null,
      runtimeProjectionDigest: runtime?.versionDigest ?? receipt.projectionDigest ?? null,
      inventoryRunId: inventory.runId,
      structuralUnitIndexVersion: structural.version,
      authoringRevision: provisionalAuthoring.authoringRevision,
      coverageSourceHash: provisionalAuthoring.sourceHash,
    };

    // Drift within one identity fails.
    assert.throws(() => runAggregateGovernance({
      capture,
      observedCapture: { ...capture, importCaptureRevision: '0'.repeat(40) },
      hasGovernedCoverageBaseline: false,
      deltaClassification: delta.classification,
      currentCanonicalIds: membership.canonicalIds,
      signals: delta.signals.map((row) => ({
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
      })),
      upstreamReferences: release.upstreamRagReferences.map((row) => ({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
      structuralUnitIndex: structural.entries,
      coverageAuthoring: provisionalAuthoring,
    }), /capture drift/u);

    // Coherent run succeeds even when import/delta capture fields are distinct slots
    // (values may equal in harness; identity fields are still separately observed).
    const baseline = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: false,
      deltaClassification: delta.classification,
      currentCanonicalIds: membership.canonicalIds,
      signals: delta.signals.map((row) => ({
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
      })),
      upstreamReferences: release.upstreamRagReferences.map((row) => ({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
      structuralUnitIndex: structural.entries,
      coverageAuthoring: provisionalAuthoring,
    });
    assert.equal(baseline.manifest.mode, 'baseline');
    assert.equal(baseline.coverageEntries.length, membership.canonicalIds.length);
    assert.equal(baseline.receipt.authorityState, 'SHADOW');
    assert.equal(
      selectResourceKnowledgeAuthority('FORMAL_RECOMMENDATION').authority,
      'LEGACY',
    );

    const repository = new AggregateGovernanceRepository(db as never);
    const firstPersist = await repository.persistRun(baseline);
    assert.equal(firstPersist.mode, 'created');
    const secondPersist = await repository.persistRun(baseline);
    assert.equal(secondPersist.mode, 'idempotent');

    // Exact same capture/receipt identity after DB baseline exists must re-derive
    // the identical receipt (production re-run path), not fail on source hash drift
    // and must not treat authoring.mode alone as a re-baseline switch.
    const persistedPrior = await repository.readLatestGovernanceReceipt(releaseSet.id);
    assert.ok(persistedPrior);
    assert.equal(persistedPrior!.id, baseline.receipt.id);
    assert.equal(persistedPrior!.mode, 'baseline');
    const sameInputReplay = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: true,
      priorGovernanceReceipt: persistedPrior,
      deltaClassification: delta.classification,
      currentCanonicalIds: membership.canonicalIds,
      signals: delta.signals.map((row) => ({
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
      })),
      upstreamReferences: release.upstreamRagReferences.map((row) => ({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
      structuralUnitIndex: structural.entries,
      coverageAuthoring: provisionalAuthoring,
      currentCoverageEntries: baseline.coverageEntries,
      previousCrosswalks: baseline.crosswalks,
      priorSemanticPublicationIdentity: baseline.coverageVersionId ?? baseline.receipt.id,
    });
    assert.equal(sameInputReplay.manifest.mode, 'baseline');
    assert.equal(sameInputReplay.receipt.id, baseline.receipt.id);
    assert.equal(sameInputReplay.coverageVersionId, baseline.coverageVersionId);
    const thirdPersist = await repository.persistRun(sameInputReplay);
    assert.equal(thirdPersist.mode, 'idempotent');
    assert.equal(thirdPersist.receiptId, baseline.receipt.id);

    // New Delta identity must not re-baseline even if authoring.mode is still baseline.
    const driftedDeltaCapture: CaptureIdentity = {
      ...capture,
      deltaReceiptId: 'delta-receipt:changed-for-replay-fence',
      deltaOutputDigest: 'a'.repeat(64),
    };
    assert.throws(() => runAggregateGovernance({
      capture: driftedDeltaCapture,
      observedCapture: observedOf(driftedDeltaCapture),
      hasGovernedCoverageBaseline: true,
      priorGovernanceReceipt: persistedPrior,
      deltaClassification: delta.classification,
      currentCanonicalIds: membership.canonicalIds,
      signals: delta.signals.map((row) => ({
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
      })),
      upstreamReferences: [],
      structuralUnitIndex: structural.entries,
      coverageAuthoring: provisionalAuthoring,
      currentCoverageEntries: baseline.coverageEntries,
      previousCrosswalks: baseline.crosswalks,
    }), /authoring mode baseline conflicts with governance mode incremental|capture drift/u);

    // Prove distinct historical identity slots: re-run with different importCaptureRevision
    // values that still match between expected and observed succeeds.
    const differentImport = 'd'.repeat(40);
    const differentDeltaCap = 'e'.repeat(40);
    const captureDistinct: CaptureIdentity = {
      ...capture,
      importCaptureRevision: differentImport,
      deltaCaptureRevision: differentDeltaCap,
    };
    const distinctRun = runAggregateGovernance({
      capture: captureDistinct,
      observedCapture: observedOf(captureDistinct),
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'COMPATIBLE_PACKAGING_REVISION',
      currentCanonicalIds: membership.canonicalIds,
      signals: [],
      upstreamReferences: [],
      structuralUnitIndex: structural.entries,
      coverageAuthoring: null,
      currentCoverageEntries: baseline.coverageEntries,
      previousCrosswalks: baseline.crosswalks,
      priorSemanticPublicationIdentity: baseline.coverageVersionId ?? baseline.receipt.id,
    });
    assert.equal(distinctRun.manifest.packagingNoop, true);
    assert.notEqual(captureDistinct.importCaptureRevision, captureDistinct.captureRevision);
    assert.notEqual(captureDistinct.deltaCaptureRevision, captureDistinct.captureRevision);

    console.log(JSON.stringify({
      ok: true,
      mode: isolationMode,
      membershipCount: membership.canonicalIds.length,
      fixtureObjectCountAssertion: V03_R2_FIXTURE_OBJECT_COUNT,
      deltaReceiptId: delta.id,
      deltaFrom1132: true,
      inventoryRunId: inventory.runId,
      structuralUnitCount: structural.entries.length,
      governanceCaptureRevision: capture.captureRevision,
      importCaptureRevision: capture.importCaptureRevision,
      deltaCaptureRevision: capture.deltaCaptureRevision,
      activeAuthoringPresent,
      provisionalAuthoringUsed: !activeAuthoringPresent,
      productionAuthoringReviewed: false,
      baselineDispositions: baseline.coverageEntries.length,
      publishedCrosswalks: baseline.publishedCrosswalks.length,
      unresolvedCrosswalks: baseline.unresolvedCrosswalkDiagnostics.length,
      sameInputReplayIdempotent: true,
      packagingNoopWithDistinctCaptures: true,
      captureDriftRejected: true,
      selectors: {
        formal: selectResourceKnowledgeAuthority('FORMAL_RECOMMENDATION'),
        shadow: selectResourceKnowledgeAuthority('SHADOW_AUDIT'),
      },
      note: 'provisional harness authoring is not production reviewed active ledger',
    }, null, 2));
  } finally {
    await db?.$disconnect();
    if (admin) {
      try {
        if (isolationMode === 'database') {
          await admin.query(`DROP DATABASE IF EXISTS "${schemaName}" WITH (FORCE)`);
        } else {
          await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        }
      } catch {
        // best-effort cleanup
      }
      await admin.end();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

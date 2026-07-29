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
  // Admin client is opened during isolation setup; keep all subsequent work
  // (including migrate failures) inside finally so the process always exits.
  const testUrl = await ensureIsolatedDatabaseUrl();
  try {
    migrate(testUrl);
    process.env.DATABASE_URL = testUrl;
    db = createPrismaClient({ log: ['warn', 'error'] });
    if (isolationMode === 'schema') {
      await db.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
    }

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

    // --- P1 regressions: binding SUPERSEDE + tx rollback + partial-delta rebind ---
    const sampleCanonicalIds = membership.canonicalIds.slice(0, 2);
    assert.ok(sampleCanonicalIds.length >= 1, 'membership must expose at least one canonical id');
    // Standard public Bundle path: public membership is ActkgProjectionNode only.
    // Do not fabricate private ActkgAuthoritativeObject rows or disable seal triggers.
    const authoritativeObjectCount = await db.actkgAuthoritativeObject.count({
      where: { releaseId: release.id },
    });
    assert.equal(
      authoritativeObjectCount,
      0,
      'standard public Bundle candidate must have zero ActkgAuthoritativeObject rows',
    );
    for (const canonicalId of sampleCanonicalIds) {
      const projection = await db.actkgProjectionNode.findFirst({
        where: { releaseId: release.id, entityId: canonicalId },
      });
      assert.ok(projection, `projection membership missing for ${canonicalId}`);
    }

    const objectBindingId = 'harness-binding-object-1';
    const resourceBindingId = 'harness-binding-resource-1';
    const objectCanonicalId = sampleCanonicalIds[0]!;
    const resourceCanonicalId = sampleCanonicalIds[1] ?? sampleCanonicalIds[0]!;
    const hex = (ch: string) => ch.repeat(64);
    // Use non-published CURRENT rows so SUPERSEDE only needs a CURRENT tombstone
    // replacement (not a legacy EvidenceStructuralUnitCrosswalk SHADOW path).
    await db.canonicalResourceBindingDecision.create({
      data: {
        id: objectBindingId,
        pairId: 'harness-pair-object-1',
        releaseSetId: releaseSet.id,
        releaseId: release.id,
        canonicalId: objectCanonicalId,
        objectRevision: 'rev-object-1',
        resourceId: 'resource-harness-1',
        structuralUnitId: 'unit-harness-1',
        segmentId: 'seg-harness-1',
        resourceSegmentHash: hex('2'),
        role: 'EXPLAINS',
        evidenceId: null,
        evidenceDigest: hex('e'),
        generatorPromptVersion: 'aggregate-binding/v1',
        reviewerPromptVersion: 'aggregate-binding-review/v1',
        generatorCacheKey: hex('1'),
        reviewerCacheKey: hex('2'),
        reviewerRole: 'INDEPENDENT_REVIEWER',
        reviewerInputDigest: hex('3'),
        candidateDigest: hex('4'),
        reviewProvider: 'FIXTURE',
        reviewState: 'HUMAN_REQUIRED',
        publicationState: 'HUMAN_REQUIRED',
        lifecycleState: 'CURRENT',
        attemptSequence: 1,
        highImpactPolicyVersion: 'binding-impact/v1',
        highImpactReasons: [],
        // Keep legacy crosswalk identity fully null (all-or-nothing CHECK).
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
        crosswalkId: null,
      },
    });
    await db.canonicalResourceBindingDecision.create({
      data: {
        id: resourceBindingId,
        pairId: 'harness-pair-resource-1',
        releaseSetId: releaseSet.id,
        releaseId: release.id,
        canonicalId: resourceCanonicalId,
        objectRevision: 'rev-resource-1',
        resourceId: 'resource-harness-2',
        structuralUnitId: 'unit-harness-2',
        segmentId: 'seg-harness-2',
        resourceSegmentHash: hex('3'),
        role: 'PRACTICES',
        evidenceId: null,
        evidenceDigest: hex('f'),
        generatorPromptVersion: 'aggregate-binding/v1',
        reviewerPromptVersion: 'aggregate-binding-review/v1',
        generatorCacheKey: hex('5'),
        reviewerCacheKey: hex('6'),
        reviewerRole: 'INDEPENDENT_REVIEWER',
        reviewerInputDigest: hex('7'),
        candidateDigest: hex('8'),
        reviewProvider: 'FIXTURE',
        reviewState: 'HUMAN_REQUIRED',
        publicationState: 'HUMAN_REQUIRED',
        lifecycleState: 'CURRENT',
        attemptSequence: 1,
        highImpactPolicyVersion: 'binding-impact/v1',
        highImpactReasons: [],
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
        crosswalkId: null,
      },
    });

    const supersedePersist = await repository.persistRun({
      ...baseline,
      receipt: {
        ...baseline.receipt,
        id: 'agg-gov:harness-binding-supersede',
        outputDigest: 'b1'.repeat(32),
        inputDigest: 'b2'.repeat(32),
      },
      binding: {
        candidates: [],
        candidatesGenerated: 0,
        decisions: [],
        pendingReviewCandidates: [],
        reusedDecisionIds: [],
        invalidated: [
          {
            id: objectBindingId,
            pairId: 'harness-pair-object-1',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: objectCanonicalId,
            objectRevision: 'rev-object-1',
            resourceId: 'resource-harness-1',
            structuralUnitId: 'unit-harness-1',
            segmentId: 'seg-harness-1',
            resourceSegmentHash: hex('2'),
            role: 'EXPLAINS',
            evidenceId: null,
            evidenceDigest: hex('e'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('1'),
            reviewerCacheKey: hex('2'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('3'),
            candidateDigest: hex('4'),
            reviewProvider: 'FIXTURE',
            reviewState: 'HUMAN_REQUIRED',
            publicationState: 'HUMAN_REQUIRED',
            lifecycleState: 'SUPERSEDED',
            attemptSequence: 1,
            supersedesDecisionId: null,
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            trigger: 'CANONICAL_CHANGE',
            proposedRole: 'EXPLAINS',
            evidenceIds: [],
          },
          {
            id: resourceBindingId,
            pairId: 'harness-pair-resource-1',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: resourceCanonicalId,
            objectRevision: 'rev-resource-1',
            resourceId: 'resource-harness-2',
            structuralUnitId: 'unit-harness-2',
            segmentId: 'seg-harness-2',
            resourceSegmentHash: hex('3'),
            role: 'PRACTICES',
            evidenceId: null,
            evidenceDigest: hex('f'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('5'),
            reviewerCacheKey: hex('6'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('7'),
            candidateDigest: hex('8'),
            reviewProvider: 'FIXTURE',
            reviewState: 'HUMAN_REQUIRED',
            publicationState: 'HUMAN_REQUIRED',
            lifecycleState: 'SUPERSEDED',
            attemptSequence: 1,
            supersedesDecisionId: null,
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            trigger: 'RESOURCE_CHANGE',
            proposedRole: 'PRACTICES',
            evidenceIds: [],
          },
        ],
        reusable: [],
        revalidationReceipts: [],
        shadowPublishedCount: 0,
      },
    } as never);
    assert.equal(supersedePersist.mode, 'created');
    const supersededRows = await db.canonicalResourceBindingDecision.findMany({
      where: { id: { in: [objectBindingId, resourceBindingId] } },
    });
    assert.equal(supersededRows.length, 2);
    assert.ok(supersededRows.every((row) => row.lifecycleState === 'SUPERSEDED'));
    const tombstones = await db.canonicalResourceBindingDecision.findMany({
      where: {
        supersedesDecisionId: { in: [objectBindingId, resourceBindingId] },
        lifecycleState: 'CURRENT',
      },
    });
    assert.equal(tombstones.length, 2);
    assert.ok(tombstones.every((row) => (
      row.publicationState === 'CANDIDATE'
      && row.reviewState === 'REJECTED'
      && row.reviewIdentity === 'issue-1126-aggregate-invalidation-tombstone'
    )));
    assert.equal(await db.canonicalResourceBindingDecision.count({
      where: {
        pairId: { in: ['harness-pair-object-1', 'harness-pair-resource-1'] },
        lifecycleState: 'CURRENT',
        publicationState: 'SHADOW_PUBLISHED',
      },
    }), 0);

    // Published invalidation: seed SHADOW_PUBLISHED (publication validate temporarily
    // relaxed) then tombstone supersession must leave zero CURRENT SHADOW_PUBLISHED.
    const publishedBindingId = 'harness-binding-published-1';
    await db.$executeRawUnsafe(
      'ALTER TABLE "CanonicalResourceBindingDecision" DISABLE TRIGGER "CanonicalResourceBindingDecision_validate_publication"',
    );
    try {
      await db.canonicalResourceBindingDecision.create({
        data: {
          id: publishedBindingId,
          pairId: 'harness-pair-published-1',
          releaseSetId: releaseSet.id,
          releaseId: release.id,
          canonicalId: objectCanonicalId,
          objectRevision: 'rev-published-1',
          resourceId: 'resource-harness-published',
          structuralUnitId: 'unit-harness-published',
          segmentId: 'seg-harness-published',
          resourceSegmentHash: hex('c'),
          role: 'EXPLAINS',
          evidenceId: null,
          evidenceDigest: hex('d'),
          generatorPromptVersion: 'aggregate-binding/v1',
          reviewerPromptVersion: 'aggregate-binding-review/v1',
          generatorCacheKey: hex('e'),
          reviewerCacheKey: hex('f'),
          reviewerRole: 'INDEPENDENT_REVIEWER',
          reviewerInputDigest: hex('0'),
          candidateDigest: hex('1'),
          reviewProvider: 'GPT',
          reviewState: 'ACCEPTED',
          publicationState: 'SHADOW_PUBLISHED',
          lifecycleState: 'CURRENT',
          attemptSequence: 1,
          highImpactPolicyVersion: 'binding-impact/v1',
          highImpactReasons: [],
          inventoryRunId: null,
          captureRevision: null,
          structuralUnitVersion: null,
          validationDigest: null,
          crosswalkId: null,
        },
      });
    } finally {
      await db.$executeRawUnsafe(
        'ALTER TABLE "CanonicalResourceBindingDecision" ENABLE TRIGGER "CanonicalResourceBindingDecision_validate_publication"',
      );
    }
    const publishedSupersede = await repository.persistRun({
      ...baseline,
      receipt: {
        ...baseline.receipt,
        id: 'agg-gov:harness-binding-published-supersede',
        outputDigest: 'b3'.repeat(32),
        inputDigest: 'b4'.repeat(32),
      },
      binding: {
        candidates: [],
        candidatesGenerated: 0,
        decisions: [],
        pendingReviewCandidates: [],
        reusedDecisionIds: [],
        invalidated: [{
          id: publishedBindingId,
          pairId: 'harness-pair-published-1',
          releaseSetId: releaseSet.id,
          releaseId: release.id,
          canonicalId: objectCanonicalId,
          objectRevision: 'rev-published-1',
          resourceId: 'resource-harness-published',
          structuralUnitId: 'unit-harness-published',
          segmentId: 'seg-harness-published',
          resourceSegmentHash: hex('c'),
          role: 'EXPLAINS',
          evidenceId: null,
          evidenceDigest: hex('d'),
          generatorPromptVersion: 'aggregate-binding/v1',
          reviewerPromptVersion: 'aggregate-binding-review/v1',
          generatorCacheKey: hex('e'),
          reviewerCacheKey: hex('f'),
          reviewerRole: 'INDEPENDENT_REVIEWER',
          reviewerInputDigest: hex('0'),
          candidateDigest: hex('1'),
          reviewProvider: 'GPT',
          reviewState: 'ACCEPTED',
          publicationState: 'SHADOW_PUBLISHED',
          lifecycleState: 'SUPERSEDED',
          attemptSequence: 1,
          supersedesDecisionId: null,
          crosswalkId: null,
          inventoryRunId: null,
          captureRevision: null,
          structuralUnitVersion: null,
          validationDigest: null,
          highImpactPolicyVersion: 'binding-impact/v1',
          highImpactReasons: [],
          trigger: 'CANONICAL_CHANGE',
          proposedRole: 'EXPLAINS',
          evidenceIds: [],
        }],
        reusable: [],
        revalidationReceipts: [],
        shadowPublishedCount: 0,
      },
    } as never);
    assert.equal(publishedSupersede.mode, 'created');
    const publishedRow = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: publishedBindingId },
    });
    assert.equal(publishedRow.lifecycleState, 'SUPERSEDED');
    const publishedTombstone = await db.canonicalResourceBindingDecision.findFirstOrThrow({
      where: { supersedesDecisionId: publishedBindingId, lifecycleState: 'CURRENT' },
    });
    assert.equal(publishedTombstone.publicationState, 'CANDIDATE');
    assert.equal(publishedTombstone.reviewState, 'REJECTED');
    assert.notEqual(publishedTombstone.publicationState, 'SHADOW_PUBLISHED');
    assert.equal(await db.canonicalResourceBindingDecision.count({
      where: {
        pairId: 'harness-pair-published-1',
        lifecycleState: 'CURRENT',
        publicationState: 'SHADOW_PUBLISHED',
      },
    }), 0);

    // Same ReleaseSet / later Release invalidation:
    // prior CURRENT under earlier release A is SUPERSEDED by a non-publishable
    // tombstone under candidate release B (existing accepted candidate).
    // Cross-ReleaseSet history remains untouched. No seal-trigger bypass.
    let bindingSameReleaseSetLaterReleaseOk = false;
    const earlierReleaseId = `${release.id}:earlier-same-set`;
    const earlierReleaseHash = '11'.repeat(32);
    const sourceEntry = await db.actkgReleaseEntry.findFirstOrThrow({
      where: { releaseId: release.id, entityId: objectCanonicalId },
    });
    const sourceProjection = await db.actkgProjectionNode.findFirstOrThrow({
      where: { releaseId: release.id, entityId: objectCanonicalId },
    });
    await db.actkgRelease.create({
      data: {
        id: earlierReleaseId,
        releaseSetId: releaseSet.id,
        releaseVersion: `${release.releaseVersion}-earlier-same-set`,
        releaseStatus: release.releaseStatus,
        protocol: release.protocol,
        authority: release.authority,
        scope: release.scope,
        contractHash: release.contractHash,
        releaseHash: earlierReleaseHash,
        schemaRawHash: release.schemaRawHash,
        releaseRawHash: earlierReleaseHash,
        notesRawHash: release.notesRawHash,
        captureRevision: release.captureRevision,
        lockRawHash: release.lockRawHash,
        schemaVersion: release.schemaVersion,
        upstreamReleaseId: release.upstreamReleaseId,
        projectionId: release.projectionId,
        projectionDigest: release.projectionDigest,
        sourceDatasetHash: release.sourceDatasetHash,
        upstreamPublicationCommit: release.upstreamPublicationCommit,
        upstreamClosedCommit: release.upstreamClosedCommit,
      },
    });
    await db.actkgReleaseEntry.create({
      data: {
        releaseId: earlierReleaseId,
        entityId: sourceEntry.entityId,
        ordinal: sourceEntry.ordinal,
        releaseTier: sourceEntry.releaseTier,
        entityRole: sourceEntry.entityRole,
        inclusionReason: sourceEntry.inclusionReason,
        payload: sourceEntry.payload as object,
      },
    });
    await db.actkgProjectionNode.create({
      data: {
        releaseId: earlierReleaseId,
        nodeId: `${sourceProjection.nodeId}:earlier`,
        ordinal: sourceProjection.ordinal,
        entityId: sourceProjection.entityId,
        entityType: sourceProjection.entityType,
        displayName: sourceProjection.displayName,
        releaseTier: sourceProjection.releaseTier,
        reviewStatus: sourceProjection.reviewStatus,
        publicationStatus: sourceProjection.publicationStatus,
        semanticName: sourceProjection.semanticName,
        sourceCoverageCount: sourceProjection.sourceCoverageCount,
        candidate: sourceProjection.candidate,
        payload: sourceProjection.payload as object,
      },
    });

    const earlierReleaseBindingId = 'harness-binding-earlier-release-1';
    await db.canonicalResourceBindingDecision.create({
      data: {
        id: earlierReleaseBindingId,
        pairId: 'harness-pair-earlier-release-1',
        releaseSetId: releaseSet.id,
        releaseId: earlierReleaseId,
        canonicalId: objectCanonicalId,
        objectRevision: 'rev-earlier-release-1',
        resourceId: 'resource-harness-earlier-release',
        structuralUnitId: 'unit-harness-earlier-release',
        segmentId: 'seg-harness-earlier-release',
        resourceSegmentHash: hex('8'),
        role: 'EXPLAINS',
        evidenceId: null,
        evidenceDigest: hex('9'),
        generatorPromptVersion: 'aggregate-binding/v1',
        reviewerPromptVersion: 'aggregate-binding-review/v1',
        generatorCacheKey: hex('a'),
        reviewerCacheKey: hex('b'),
        reviewerRole: 'INDEPENDENT_REVIEWER',
        reviewerInputDigest: hex('c'),
        candidateDigest: hex('d'),
        reviewProvider: 'FIXTURE',
        reviewState: 'HUMAN_REQUIRED',
        publicationState: 'HUMAN_REQUIRED',
        lifecycleState: 'CURRENT',
        attemptSequence: 1,
        highImpactPolicyVersion: 'binding-impact/v1',
        highImpactReasons: [],
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
        crosswalkId: null,
      },
    });

    // Cross-ReleaseSet prior (different set) must remain CURRENT after candidate run.
    const crossSet = await db.actkgReleaseSet.findFirst({
      where: { id: { not: releaseSet.id } },
      include: {
        releases: {
          include: {
            projectionNodes: { take: 1, orderBy: { ordinal: 'asc' } },
          },
          take: 1,
        },
      },
    });
    let crossSetBindingId: string | null = null;
    if (crossSet?.releases[0]?.projectionNodes[0]) {
      const crossRelease = crossSet.releases[0]!;
      const crossCanonical = crossRelease.projectionNodes[0]!.entityId;
      crossSetBindingId = 'harness-binding-cross-set-1';
      await db.canonicalResourceBindingDecision.create({
        data: {
          id: crossSetBindingId,
          pairId: 'harness-pair-cross-set-1',
          releaseSetId: crossSet.id,
          releaseId: crossRelease.id,
          canonicalId: crossCanonical,
          objectRevision: 'rev-cross-set-1',
          resourceId: 'resource-harness-cross-set',
          structuralUnitId: 'unit-harness-cross-set',
          segmentId: 'seg-harness-cross-set',
          resourceSegmentHash: hex('7'),
          role: 'EXPLAINS',
          evidenceId: null,
          evidenceDigest: hex('6'),
          generatorPromptVersion: 'aggregate-binding/v1',
          reviewerPromptVersion: 'aggregate-binding-review/v1',
          generatorCacheKey: hex('5'),
          reviewerCacheKey: hex('4'),
          reviewerRole: 'INDEPENDENT_REVIEWER',
          reviewerInputDigest: hex('3'),
          candidateDigest: hex('2'),
          reviewProvider: 'FIXTURE',
          reviewState: 'HUMAN_REQUIRED',
          publicationState: 'HUMAN_REQUIRED',
          lifecycleState: 'CURRENT',
          attemptSequence: 1,
          highImpactPolicyVersion: 'binding-impact/v1',
          highImpactReasons: [],
          inventoryRunId: null,
          captureRevision: null,
          structuralUnitVersion: null,
          validationDigest: null,
          crosswalkId: null,
        },
      });
    }

    // Candidate remains the accepted later Release (original import) so the
    // governance receipt can keep the existing Delta FK endpoints.
    const laterReleasePersist = await repository.persistRun({
      ...baseline,
      receipt: {
        ...baseline.receipt,
        id: 'agg-gov:harness-same-set-later-release',
        outputDigest: 'b5'.repeat(32),
        inputDigest: 'b6'.repeat(32),
      },
      binding: {
        candidates: [],
        candidatesGenerated: 0,
        decisions: [],
        pendingReviewCandidates: [],
        reusedDecisionIds: [],
        invalidated: [
          {
            id: earlierReleaseBindingId,
            pairId: 'harness-pair-earlier-release-1',
            releaseSetId: releaseSet.id,
            releaseId: earlierReleaseId,
            canonicalId: objectCanonicalId,
            objectRevision: 'rev-earlier-release-1',
            resourceId: 'resource-harness-earlier-release',
            structuralUnitId: 'unit-harness-earlier-release',
            segmentId: 'seg-harness-earlier-release',
            resourceSegmentHash: hex('8'),
            role: 'EXPLAINS',
            evidenceId: null,
            evidenceDigest: hex('9'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('a'),
            reviewerCacheKey: hex('b'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('c'),
            candidateDigest: hex('d'),
            reviewProvider: 'FIXTURE',
            reviewState: 'HUMAN_REQUIRED',
            publicationState: 'HUMAN_REQUIRED',
            lifecycleState: 'SUPERSEDED',
            attemptSequence: 1,
            supersedesDecisionId: null,
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            trigger: 'CANONICAL_CHANGE',
            proposedRole: 'EXPLAINS',
            evidenceIds: [],
          },
          ...(crossSetBindingId
            ? [{
                id: crossSetBindingId,
                pairId: 'harness-pair-cross-set-1',
                releaseSetId: crossSet!.id,
                releaseId: crossSet!.releases[0]!.id,
                canonicalId: crossSet!.releases[0]!.projectionNodes[0]!.entityId,
                objectRevision: 'rev-cross-set-1',
                resourceId: 'resource-harness-cross-set',
                structuralUnitId: 'unit-harness-cross-set',
                segmentId: 'seg-harness-cross-set',
                resourceSegmentHash: hex('7'),
                role: 'EXPLAINS',
                evidenceId: null,
                evidenceDigest: hex('6'),
                generatorPromptVersion: 'aggregate-binding/v1',
                reviewerPromptVersion: 'aggregate-binding-review/v1',
                generatorCacheKey: hex('5'),
                reviewerCacheKey: hex('4'),
                reviewerRole: 'INDEPENDENT_REVIEWER',
                reviewerInputDigest: hex('3'),
                candidateDigest: hex('2'),
                reviewProvider: 'FIXTURE',
                reviewState: 'HUMAN_REQUIRED',
                publicationState: 'HUMAN_REQUIRED',
                lifecycleState: 'SUPERSEDED',
                attemptSequence: 1,
                supersedesDecisionId: null,
                crosswalkId: null,
                inventoryRunId: null,
                captureRevision: null,
                structuralUnitVersion: null,
                validationDigest: null,
                highImpactPolicyVersion: 'binding-impact/v1',
                highImpactReasons: [],
                trigger: 'CANONICAL_CHANGE',
                proposedRole: 'EXPLAINS',
                evidenceIds: [],
              }]
            : []),
        ],
        reusable: [],
        revalidationReceipts: [],
        shadowPublishedCount: 0,
      },
    } as never);
    assert.equal(laterReleasePersist.mode, 'created');
    const earlierAfter = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: earlierReleaseBindingId },
    });
    assert.equal(earlierAfter.lifecycleState, 'SUPERSEDED');
    const laterTombstone = await db.canonicalResourceBindingDecision.findFirstOrThrow({
      where: {
        supersedesDecisionId: earlierReleaseBindingId,
        lifecycleState: 'CURRENT',
      },
    });
    assert.equal(laterTombstone.releaseSetId, releaseSet.id);
    assert.equal(laterTombstone.releaseId, release.id);
    assert.equal(laterTombstone.publicationState, 'CANDIDATE');
    assert.equal(laterTombstone.reviewState, 'REJECTED');
    assert.equal(
      laterTombstone.reviewIdentity,
      'issue-1126-aggregate-invalidation-tombstone',
    );
    assert.notEqual(laterTombstone.publicationState, 'SHADOW_PUBLISHED');
    if (crossSetBindingId) {
      const crossAfter = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
        where: { id: crossSetBindingId },
      });
      assert.equal(crossAfter.lifecycleState, 'CURRENT');
      assert.equal(await db.canonicalResourceBindingDecision.count({
        where: { supersedesDecisionId: crossSetBindingId },
      }), 0);
    }
    bindingSameReleaseSetLaterReleaseOk = true;

    // Dual-path publication + staged published replacement via repository.
    const inventoryItem = inventory.items.find((row) => (
      row.disposition === 'INCLUDED'
      && row.atomicResourceId
      && row.resourceId
      && row.structuralUnitId
      && row.segmentId
      && row.resourceSegmentHash
    ));
    assert.ok(inventoryItem, 'inventory must expose an INCLUDED segment for governed publication');
    const seedCurrent = await db.actGovernedStructuralUnitCrosswalk.findFirst({
      where: {
        releaseSetId: releaseSet.id,
        releaseId: release.id,
        lifecycleState: 'CURRENT',
        canonicalId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    const governedXwalk = seedCurrent
      ? await db.actGovernedStructuralUnitCrosswalk.update({
          where: { id: seedCurrent.id },
          data: {
            sourceEditionId: 'edition-harness',
            sourceVersion: '1',
            structuralUnitId: inventoryItem.structuralUnitId,
            structuralUnitVersion: capture.captureRevision,
            structuralUnitHash: 'a1'.repeat(32),
            evidenceContentHash: 'a1'.repeat(32),
            inventoryRunId: inventory.runId,
            atomicResourceId: inventoryItem.atomicResourceId,
            resourceId: inventoryItem.resourceId,
            segmentId: inventoryItem.segmentId,
            resourceSegmentHash: inventoryItem.resourceSegmentHash,
            resolutionState: 'DETERMINISTIC',
            validationState: 'VALIDATED',
            validationDigest: 'b1'.repeat(32),
            evidenceDigest: 'b1'.repeat(32),
            lifecycleState: 'CURRENT',
          },
        })
      : null;
    let bindingGovernedShadowPublication = false;
    let bindingPublishedReplacementOk = false;
    let bindingXorFailClosed = false;
    if (governedXwalk) {
      // Production-shaped revision from the public Projection payload (not
      // private ActkgAuthoritativeObject, not releaseHash). Trigger stays enabled.
      assert.equal(
        await db.actkgAuthoritativeObject.count({
          where: {
            releaseId: release.id,
            canonicalId: governedXwalk.canonicalId!,
          },
        }),
        0,
        'governed shadow path must not require fabricated ActkgAuthoritativeObject rows',
      );
      const projectionRevisionRows = await db.$queryRaw<Array<{ objectRevision: string }>>`
        SELECT actkg_authoritative_object_revision("payload") AS "objectRevision"
        FROM "ActkgProjectionNode"
        WHERE "releaseId" = ${release.id}
          AND "entityId" = ${governedXwalk.canonicalId!}
      `;
      assert.equal(projectionRevisionRows.length, 1);
      const authObjectRevision = projectionRevisionRows[0]?.objectRevision;
      assert.ok(authObjectRevision && /^[a-f0-9]{64}$/u.test(authObjectRevision));
      assert.notEqual(authObjectRevision, release.releaseHash);

      const governedDecisionId = 'harness-governed-shadow-1';
      const governedDecisionBase = {
        id: governedDecisionId,
        pairId: 'harness-pair-governed-1',
        releaseSetId: releaseSet.id,
        releaseId: release.id,
        canonicalId: governedXwalk.canonicalId!,
        objectRevision: authObjectRevision,
        resourceId: governedXwalk.resourceId!,
        structuralUnitId: governedXwalk.structuralUnitId!,
        segmentId: governedXwalk.segmentId!,
        resourceSegmentHash: governedXwalk.resourceSegmentHash!,
        role: 'EXPLAINS' as const,
        evidenceId: null as string | null,
        evidenceDigest: hex('a'),
        generatorPromptVersion: 'aggregate-binding/v1',
        reviewerPromptVersion: 'aggregate-binding-review/v1',
        generatorCacheKey: hex('b'),
        reviewerCacheKey: hex('c'),
        reviewerRole: 'INDEPENDENT_REVIEWER' as const,
        reviewerInputDigest: hex('d'),
        candidateDigest: hex('e'),
        reviewProvider: 'GPT' as const,
        reviewState: 'ACCEPTED' as const,
        publicationState: 'SHADOW_PUBLISHED' as const,
        lifecycleState: 'CURRENT' as const,
        attemptSequence: 1,
        supersedesDecisionId: null as string | null,
        crosswalkId: null as string | null,
        inventoryRunId: null as string | null,
        captureRevision: null as string | null,
        structuralUnitVersion: null as string | null,
        validationDigest: null as string | null,
        highImpactPolicyVersion: 'binding-impact/v1' as const,
        highImpactReasons: [] as [],
        trigger: 'CANONICAL_CHANGE' as const,
        proposedRole: 'EXPLAINS' as const,
        evidenceIds: [] as string[],
        reviewIdentity: null as string | null,
        reviewRationale: null as string | null,
        governedCrosswalkId: governedXwalk.id,
        governedInventoryRunId: governedXwalk.inventoryRunId,
        governedCaptureRevision: governedXwalk.captureRevision,
        governedStructuralUnitVersion: governedXwalk.structuralUnitVersion,
        governedValidationDigest: governedXwalk.validationDigest,
      };

      // Positive governed publication via repository (not raw insert).
      const governedPersist = await repository.persistRun({
        ...baseline,
        crosswalks: [],
        publishedCrosswalks: [],
        unresolvedCrosswalkDiagnostics: [],
        invalidatedCrosswalks: [],
        coverageVersionId: null,
        coverageEntries: [],
        revalidationReceipts: [],
        receipt: {
          ...baseline.receipt,
          id: 'agg-gov:harness-governed-shadow',
          outputDigest: 'c1'.repeat(32),
          inputDigest: 'c2'.repeat(32),
          coverageVersionId: null,
        },
        binding: {
          candidates: [],
          candidatesGenerated: 0,
          decisions: [governedDecisionBase],
          pendingReviewCandidates: [],
          reusedDecisionIds: [],
          invalidated: [],
          reusable: [],
          revalidationReceipts: [],
          shadowPublishedCount: 1,
        },
      } as never);
      assert.equal(governedPersist.mode, 'created');
      const governedRow = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
        where: { id: governedDecisionId },
      });
      assert.equal(governedRow.publicationState, 'SHADOW_PUBLISHED');
      assert.equal(governedRow.lifecycleState, 'CURRENT');
      assert.equal(governedRow.objectRevision, authObjectRevision);
      assert.equal(governedRow.governedCrosswalkId, governedXwalk.id);
      assert.equal(governedRow.crosswalkId, null);
      bindingGovernedShadowPublication = true;

      // objectRevision drift (releaseHash instead of auth revision) fails closed.
      await assert.rejects(async () => {
        await db.canonicalResourceBindingDecision.create({
          data: {
            id: 'harness-governed-shadow-rev-drift',
            pairId: 'harness-pair-governed-rev-drift',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: governedXwalk.canonicalId!,
            objectRevision: release.releaseHash,
            resourceId: governedXwalk.resourceId!,
            structuralUnitId: governedXwalk.structuralUnitId!,
            segmentId: governedXwalk.segmentId!,
            resourceSegmentHash: governedXwalk.resourceSegmentHash!,
            role: 'PRACTICES',
            evidenceId: null,
            evidenceDigest: hex('1'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('2'),
            reviewerCacheKey: hex('3'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('4'),
            candidateDigest: hex('5'),
            reviewProvider: 'GPT',
            reviewState: 'ACCEPTED',
            publicationState: 'SHADOW_PUBLISHED',
            lifecycleState: 'CURRENT',
            attemptSequence: 1,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            governedCrosswalkId: governedXwalk.id,
            governedInventoryRunId: governedXwalk.inventoryRunId,
            governedCaptureRevision: governedXwalk.captureRevision,
            governedStructuralUnitVersion: governedXwalk.structuralUnitVersion,
            governedValidationDigest: governedXwalk.validationDigest,
          },
        });
      }, /governed crosswalk|validated crosswalk|shadow publication/iu);

      // Digest drift fails closed.
      await assert.rejects(async () => {
        await db.canonicalResourceBindingDecision.create({
          data: {
            id: 'harness-governed-shadow-drift',
            pairId: 'harness-pair-governed-drift',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: governedXwalk.canonicalId!,
            objectRevision: authObjectRevision,
            resourceId: governedXwalk.resourceId!,
            structuralUnitId: governedXwalk.structuralUnitId!,
            segmentId: governedXwalk.segmentId!,
            resourceSegmentHash: governedXwalk.resourceSegmentHash!,
            role: 'PRACTICES',
            evidenceId: null,
            evidenceDigest: hex('1'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('6'),
            reviewerCacheKey: hex('7'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('8'),
            candidateDigest: hex('9'),
            reviewProvider: 'GPT',
            reviewState: 'ACCEPTED',
            publicationState: 'SHADOW_PUBLISHED',
            lifecycleState: 'CURRENT',
            attemptSequence: 1,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            governedCrosswalkId: governedXwalk.id,
            governedInventoryRunId: governedXwalk.inventoryRunId,
            governedCaptureRevision: governedXwalk.captureRevision,
            governedStructuralUnitVersion: governedXwalk.structuralUnitVersion,
            governedValidationDigest: 'ff'.repeat(32),
          },
        });
      }, /governed crosswalk|validated crosswalk|shadow publication/iu);

      // Strict XOR negatives: mixed / partial tuples.
      await assert.rejects(async () => {
        await db.canonicalResourceBindingDecision.create({
          data: {
            id: 'harness-xor-mixed',
            pairId: 'harness-pair-xor-mixed',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: governedXwalk.canonicalId!,
            objectRevision: authObjectRevision,
            resourceId: governedXwalk.resourceId!,
            structuralUnitId: governedXwalk.structuralUnitId!,
            segmentId: governedXwalk.segmentId!,
            resourceSegmentHash: governedXwalk.resourceSegmentHash!,
            role: 'REFERENCES',
            evidenceId: 'legacy-evidence',
            evidenceDigest: hex('a'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('a'),
            reviewerCacheKey: hex('b'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('c'),
            candidateDigest: hex('d'),
            reviewProvider: 'GPT',
            reviewState: 'ACCEPTED',
            publicationState: 'SHADOW_PUBLISHED',
            lifecycleState: 'CURRENT',
            attemptSequence: 1,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            // Complete governed + one legacy field.
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            governedCrosswalkId: governedXwalk.id,
            governedInventoryRunId: governedXwalk.inventoryRunId,
            governedCaptureRevision: governedXwalk.captureRevision,
            governedStructuralUnitVersion: governedXwalk.structuralUnitVersion,
            governedValidationDigest: governedXwalk.validationDigest,
          },
        });
      }, /mix legacy and governed|validated crosswalk|shadow publication/iu);

      await assert.rejects(async () => {
        await db.canonicalResourceBindingDecision.create({
          data: {
            id: 'harness-xor-partial-governed',
            pairId: 'harness-pair-xor-partial',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: governedXwalk.canonicalId!,
            objectRevision: authObjectRevision,
            resourceId: governedXwalk.resourceId!,
            structuralUnitId: governedXwalk.structuralUnitId!,
            segmentId: governedXwalk.segmentId!,
            resourceSegmentHash: governedXwalk.resourceSegmentHash!,
            role: 'REFERENCES',
            evidenceId: null,
            evidenceDigest: hex('a'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('e'),
            reviewerCacheKey: hex('f'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('0'),
            candidateDigest: hex('1'),
            reviewProvider: 'GPT',
            reviewState: 'ACCEPTED',
            publicationState: 'SHADOW_PUBLISHED',
            lifecycleState: 'CURRENT',
            attemptSequence: 1,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            // Incomplete governed path (missing validation digest).
            governedCrosswalkId: governedXwalk.id,
            governedInventoryRunId: governedXwalk.inventoryRunId,
            governedCaptureRevision: governedXwalk.captureRevision,
            governedStructuralUnitVersion: governedXwalk.structuralUnitVersion,
            governedValidationDigest: null,
          },
        });
      }, /validated crosswalk|shadow publication/iu);
      bindingXorFailClosed = true;

      // Staged published replacement via repository (CANDIDATE → SUPERSEDE → SHADOW).
      const replacementId = 'harness-governed-shadow-replacement';
      const replacementPersist = await repository.persistRun({
        ...baseline,
        crosswalks: [],
        publishedCrosswalks: [],
        unresolvedCrosswalkDiagnostics: [],
        invalidatedCrosswalks: [],
        coverageVersionId: null,
        coverageEntries: [],
        revalidationReceipts: [],
        receipt: {
          ...baseline.receipt,
          id: 'agg-gov:harness-governed-replacement',
          outputDigest: 'c3'.repeat(32),
          inputDigest: 'c4'.repeat(32),
          coverageVersionId: null,
        },
        binding: {
          candidates: [],
          candidatesGenerated: 0,
          decisions: [{
            ...governedDecisionBase,
            id: replacementId,
            attemptSequence: 2,
            supersedesDecisionId: governedDecisionId,
            // hex() repeats a single char to 64; multi-char inputs break hashes_check.
            generatorCacheKey: hex('1'),
            reviewerCacheKey: hex('2'),
            reviewerInputDigest: hex('3'),
            candidateDigest: hex('4'),
            evidenceDigest: hex('5'),
          }],
          pendingReviewCandidates: [],
          reusedDecisionIds: [],
          invalidated: [],
          reusable: [],
          revalidationReceipts: [],
          shadowPublishedCount: 1,
        },
      } as never);
      assert.equal(replacementPersist.mode, 'created');
      const predAfter = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
        where: { id: governedDecisionId },
      });
      const replAfter = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
        where: { id: replacementId },
      });
      assert.equal(predAfter.lifecycleState, 'SUPERSEDED');
      assert.equal(replAfter.lifecycleState, 'CURRENT');
      assert.equal(replAfter.publicationState, 'SHADOW_PUBLISHED');
      assert.equal(replAfter.supersedesDecisionId, governedDecisionId);
      bindingPublishedReplacementOk = true;

      // Incomplete staged replacement rolls back (predecessor stays CURRENT SHADOW).
      const incompleteReplacementId = 'harness-governed-shadow-incomplete-repl';
      await assert.rejects(async () => {
        await repository.persistRun({
          ...baseline,
          crosswalks: [],
          publishedCrosswalks: [],
          unresolvedCrosswalkDiagnostics: [],
          invalidatedCrosswalks: [],
          coverageVersionId: null,
          coverageEntries: [],
          revalidationReceipts: [],
          receipt: {
            ...baseline.receipt,
            id: 'agg-gov:harness-governed-incomplete-repl',
            outputDigest: 'c5'.repeat(32),
            inputDigest: 'c6'.repeat(32),
            coverageVersionId: null,
          },
          binding: {
            candidates: [],
            candidatesGenerated: 0,
            decisions: [{
              ...governedDecisionBase,
              id: incompleteReplacementId,
              pairId: 'harness-pair-governed-1',
              role: 'EXPLAINS',
              attemptSequence: 3,
              supersedesDecisionId: replacementId,
              // Complete field presence (CHECK allows CANDIDATE insert + SUPERSEDE)
              // but digest drift fails elevation to SHADOW_PUBLISHED so the whole
              // Serializable transaction rolls back.
              governedValidationDigest: 'ff'.repeat(32),
              generatorCacheKey: hex('6'),
              reviewerCacheKey: hex('7'),
              reviewerInputDigest: hex('8'),
              candidateDigest: hex('9'),
              evidenceDigest: hex('a'),
            }],
            pendingReviewCandidates: [],
            reusedDecisionIds: [],
            invalidated: [],
            reusable: [],
            revalidationReceipts: [],
            shadowPublishedCount: 1,
          },
        } as never);
      }, /validated crosswalk|shadow publication|governed|constraint|mix/iu);
      const replStillCurrent = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
        where: { id: replacementId },
      });
      assert.equal(replStillCurrent.lifecycleState, 'CURRENT');
      assert.equal(replStillCurrent.publicationState, 'SHADOW_PUBLISHED');
      assert.equal(
        await db.canonicalResourceBindingDecision.count({
          where: { id: incompleteReplacementId },
        }),
        0,
      );
    }

    // Transaction failure after SUPERSEDE must roll back entirely.
    const rollbackBindingId = 'harness-binding-rollback-1';
    await db.canonicalResourceBindingDecision.create({
      data: {
        id: rollbackBindingId,
        pairId: 'harness-pair-rollback-1',
        releaseSetId: releaseSet.id,
        releaseId: release.id,
        canonicalId: objectCanonicalId,
        objectRevision: 'rev-rollback-1',
        resourceId: 'resource-harness-rollback',
        structuralUnitId: 'unit-harness-rollback',
        segmentId: 'seg-harness-rollback',
        resourceSegmentHash: hex('4'),
        role: 'EXPLAINS',
        evidenceId: null,
        evidenceDigest: hex('a'),
        generatorPromptVersion: 'aggregate-binding/v1',
        reviewerPromptVersion: 'aggregate-binding-review/v1',
        generatorCacheKey: hex('9'),
        reviewerCacheKey: hex('a'),
        reviewerRole: 'INDEPENDENT_REVIEWER',
        reviewerInputDigest: hex('b'),
        candidateDigest: hex('c'),
        reviewProvider: 'FIXTURE',
        reviewState: 'HUMAN_REQUIRED',
        publicationState: 'HUMAN_REQUIRED',
        lifecycleState: 'CURRENT',
        attemptSequence: 1,
        highImpactPolicyVersion: 'binding-impact/v1',
        highImpactReasons: [],
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
        crosswalkId: null,
      },
    });
    await assert.rejects(async () => {
      await repository.persistRun({
        ...baseline,
        // Avoid re-asserting baseline crosswalks that may have been mutated by
        // governed-publication seeding above.
        crosswalks: [],
        publishedCrosswalks: [],
        unresolvedCrosswalkDiagnostics: [],
        invalidatedCrosswalks: [],
        coverageVersionId: null,
        coverageEntries: [],
        revalidationReceipts: [],
        receipt: {
          ...baseline.receipt,
          id: 'agg-gov:harness-binding-rollback',
          outputDigest: 'deadbeef'.repeat(8),
          inputDigest: 'cafebabe'.repeat(8),
          coverageVersionId: null,
        },
        binding: {
          candidates: [],
          candidatesGenerated: 0,
          // Invalid Release FK after tombstone/SUPERSEDE forces Serializable rollback.
          decisions: [{
            id: 'harness-binding-decision-fk-fail',
            pairId: 'harness-pair-fk-fail',
            releaseSetId: 'missing-release-set',
            releaseId: 'missing-release',
            canonicalId: objectCanonicalId,
            objectRevision: 'rev-fk-fail',
            resourceId: 'resource-fk-fail',
            structuralUnitId: 'unit-fk-fail',
            segmentId: 'seg-fk-fail',
            resourceSegmentHash: hex('5'),
            role: 'EXPLAINS',
            evidenceId: null,
            evidenceDigest: hex('b'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('d'),
            reviewerCacheKey: hex('e'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('0'),
            candidateDigest: hex('1'),
            reviewProvider: 'FIXTURE',
            reviewState: 'HUMAN_REQUIRED',
            publicationState: 'HUMAN_REQUIRED',
            lifecycleState: 'CURRENT',
            attemptSequence: 1,
            supersedesDecisionId: null,
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            trigger: 'CANONICAL_CHANGE',
            proposedRole: 'EXPLAINS',
            evidenceIds: [],
          }],
          pendingReviewCandidates: [],
          reusedDecisionIds: [],
          invalidated: [{
            id: rollbackBindingId,
            pairId: 'harness-pair-rollback-1',
            releaseSetId: releaseSet.id,
            releaseId: release.id,
            canonicalId: objectCanonicalId,
            objectRevision: 'rev-rollback-1',
            resourceId: 'resource-harness-rollback',
            structuralUnitId: 'unit-harness-rollback',
            segmentId: 'seg-harness-rollback',
            resourceSegmentHash: hex('4'),
            role: 'EXPLAINS',
            evidenceId: null,
            evidenceDigest: hex('a'),
            generatorPromptVersion: 'aggregate-binding/v1',
            reviewerPromptVersion: 'aggregate-binding-review/v1',
            generatorCacheKey: hex('9'),
            reviewerCacheKey: hex('a'),
            reviewerRole: 'INDEPENDENT_REVIEWER',
            reviewerInputDigest: hex('b'),
            candidateDigest: hex('c'),
            reviewProvider: 'FIXTURE',
            reviewState: 'HUMAN_REQUIRED',
            publicationState: 'HUMAN_REQUIRED',
            lifecycleState: 'SUPERSEDED',
            attemptSequence: 1,
            supersedesDecisionId: null,
            crosswalkId: null,
            inventoryRunId: null,
            captureRevision: null,
            structuralUnitVersion: null,
            validationDigest: null,
            highImpactPolicyVersion: 'binding-impact/v1',
            highImpactReasons: [],
            trigger: 'CANONICAL_CHANGE',
            proposedRole: 'EXPLAINS',
            evidenceIds: [],
          }],
          reusable: [],
          revalidationReceipts: [],
          shadowPublishedCount: 0,
        },
      } as never);
    }, /Foreign key|foreign key|constraint|Release/iu);
    const rollbackRow = await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: rollbackBindingId },
    });
    assert.equal(rollbackRow.lifecycleState, 'CURRENT');
    assert.equal(
      await db.aggregateGovernanceReceipt.count({
        where: { id: 'agg-gov:harness-binding-rollback' },
      }),
      0,
    );

    // Partial later Delta: prior Crosswalk must not remain CURRENT VALIDATED under
    // old release/delta/capture identity. Cross-ReleaseSet prior is read from base.
    const priorValidated = baseline.publishedCrosswalks
      .filter((row) => row.validationState === 'VALIDATED' && row.lifecycleState === 'CURRENT');
    const priorAnyCurrent = baseline.crosswalks
      .filter((row) => row.lifecycleState === 'CURRENT');
    assert.ok(priorAnyCurrent.length > 0, 'baseline must publish at least one CURRENT crosswalk');

    const laterCapture: CaptureIdentity = {
      ...capture,
      releaseSetId: `${releaseSet.id}:candidate-b`,
      releaseId: `${release.id}:candidate-b`,
      deltaReceiptId: `${delta.id}:candidate-b`,
      deltaOutputDigest: 'ab'.repeat(32),
      captureRevision: 'f'.repeat(40),
      authoringRevision: 'f'.repeat(40),
      inventoryRunId: inventory.runId,
    };
    // Pure pipeline A→B: prior state is A's coverage/crosswalks; mode is incremental.
    const priorCoverage = await repository.readCurrentCoverage(releaseSet.id);
    assert.ok(priorCoverage, 'base ReleaseSet A must expose CURRENT coverage');
    const priorCrosswalks = await repository.readCurrentCrosswalks(releaseSet.id);
    assert.ok(priorCrosswalks.length > 0, 'base ReleaseSet A must expose CURRENT crosswalks');
    const priorReceipt = await repository.readLatestGovernanceReceipt(releaseSet.id);
    assert.ok(priorReceipt, 'base ReleaseSet A must expose a governance receipt');
    // Simulate CLI prior resolution: candidate B has no own state → baseReleaseSetId.
    const hasCandidateBGovernedState = false;
    const baseReleaseSetId = releaseSet.id;
    const priorReleaseSetId = hasCandidateBGovernedState
      ? laterCapture.releaseSetId
      : (baseReleaseSetId ?? laterCapture.releaseSetId);
    assert.equal(priorReleaseSetId, releaseSet.id);

    const oneChanged = membership.canonicalIds[0]!;
    const incrementalEntries = [
      buildDispositionFromReview({
        canonicalId: oneChanged,
        role: 'formal_objective',
        rationale: null,
        evidenceRefs: [`canonical:${oneChanged}`, 'harness:partial-delta'],
        reviewIdentity: 'test-harness:aggregate-gov-partial-delta',
      }),
    ];
    const incrementalWithoutHash = {
      schemaVersion: 'act-course-coverage-overlay/v2' as const,
      overlayId: 'automatic-control-aggregate-coverage-v1' as const,
      overlayVersion: '2',
      courseId: 'automatic-control' as const,
      releaseSetId: laterCapture.releaseSetId,
      releaseId: laterCapture.releaseId,
      releaseHash: laterCapture.releaseHash,
      sourceDatasetHash: laterCapture.sourceDatasetHash,
      deltaReceiptId: laterCapture.deltaReceiptId,
      mode: 'incremental' as const,
      authoringRevision: laterCapture.authoringRevision!,
      entries: incrementalEntries,
    };
    const incrementalAuthoring = {
      ...incrementalWithoutHash,
      sourceHash: computeCoverageSourceHash(incrementalWithoutHash),
    };
    const laterCaptureWithHash: CaptureIdentity = {
      ...laterCapture,
      coverageSourceHash: incrementalAuthoring.sourceHash,
      authoringRevision: incrementalAuthoring.authoringRevision,
    };
    const partialDeltaRun = runAggregateGovernance({
      capture: laterCaptureWithHash,
      observedCapture: observedOf(laterCaptureWithHash),
      hasGovernedCoverageBaseline: true,
      priorGovernanceReceipt: priorReceipt,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: membership.canonicalIds,
      signals: [
        {
          scope: 'object',
          identity: oneChanged,
          action: 'candidate',
          reason: 'payload_changed',
        },
      ],
      upstreamReferences: release.upstreamRagReferences.map((row) => ({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
      structuralUnitIndex: structural.entries,
      coverageAuthoring: incrementalAuthoring,
      currentCoverageEntries: priorCoverage!.entries,
      previousCrosswalks: priorCrosswalks,
      priorSemanticPublicationIdentity: priorCoverage!.publicationIdentity,
    });
    assert.equal(partialDeltaRun.manifest.mode, 'incremental');
    // Old A publication identity must not remain CURRENT VALIDATED under B result.
    for (const prior of priorValidated) {
      assert.equal(
        partialDeltaRun.crosswalks.some((row) => (
          row.id === prior.id && row.lifecycleState === 'CURRENT'
        )),
        false,
      );
      assert.equal(
        partialDeltaRun.publishedCrosswalks.some((row) => row.id === prior.id),
        false,
      );
    }
    for (const published of partialDeltaRun.publishedCrosswalks) {
      assert.equal(published.releaseSetId, laterCaptureWithHash.releaseSetId);
      assert.equal(published.releaseId, laterCaptureWithHash.releaseId);
      assert.equal(published.deltaReceiptId, laterCaptureWithHash.deltaReceiptId);
      assert.equal(published.captureRevision, laterCaptureWithHash.captureRevision);
    }
    // Base A historical CURRENT rows remain readable under A's releaseSetId.
    const baseStillCurrent = await repository.readCurrentCrosswalks(releaseSet.id);
    assert.ok(baseStillCurrent.length > 0);
    assert.ok(baseStillCurrent.every((row) => row.releaseSetId === releaseSet.id));

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
      bindingObjectAndResourceSuperseded: true,
      bindingPublishedSupersededNoCurrentShadow: true,
      bindingTombstoneNonPublishable: true,
      bindingSameReleaseSetLaterReleaseOk,
      bindingGovernedShadowPublication,
      bindingPublishedReplacementOk,
      bindingXorFailClosed,
      bindingSupersedeRollback: true,
      standardBundleZeroAuthoritativeObjects: authoritativeObjectCount === 0,
      partialDeltaOldCrosswalkNotCurrentValidated: true,
      priorReleaseSetFromBase: priorReleaseSetId,
      candidateBPublishedCrosswalks: partialDeltaRun.publishedCrosswalks.length,
      candidateBCrosswalkRevalidations: partialDeltaRun.revalidationReceipts
        .filter((row) => row.kind === 'crosswalk').length,
      baseHistoricalCurrentPreserved: baseStillCurrent.length,
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

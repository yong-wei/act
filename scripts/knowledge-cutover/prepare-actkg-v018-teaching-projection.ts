#!/usr/bin/env tsx

/**
 * Prepare an inactive, content-addressed ACT Teaching Projection candidate
 * against the admitted v0.18 Authority snapshot (#1409).
 *
 * This command never writes a current pointer and never consumes the upstream
 * impact report as an accepted delta.  By default it creates one disposable
 * local candidate-admission schema, imports the pinned Bundle, and performs a
 * read-only observation.  --database-observation remains available for a
 * separately captured observation; an unsafe or unavailable local database
 * fails closed instead of being represented as a fabricated result.
 */

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildActiveCourseInventory,
  resolveIdentityDenominatorPaths,
} from '../../src/lib/teaching-projection/active-inventory';
import {
  buildV018CaptureManifest,
  buildV018CaptureReceipt,
  buildV018DatabaseObservation,
  buildV018ReferenceDenominator,
  assertV018DisposableDatabaseUrl,
  assertV018CaptureBound,
  expectedV018AdmissionSchemaIdentity,
  validateV018DatabaseObservation,
  V018CaptureError,
  V018_DATABASE_QUERY_CONTRACT_HASH,
} from '../../src/lib/teaching-projection/rebase/v018-capture';
import {
  buildV018IdentityRebase,
} from '../../src/lib/teaching-projection/rebase/v018-rebuild';
import {
  assertV018CandidateSelectorSafety,
  buildV018DualBuildIdentity,
  buildV018RebaseReceipt,
  readV018PointerSnapshots,
} from '../../src/lib/teaching-projection/rebase/v018-receipt';
import type {
  V018AuthorityBinding,
  V018AuthorityNodeRecord,
  V018CaptureManifest,
  V018DatabaseObservation,
} from '../../src/lib/teaching-projection/rebase/v018-contracts';
import { V018_CURRENT_POINTER_PATHS, V018_REFERENCE_KINDS } from '../../src/lib/teaching-projection/rebase/v018-contracts';
import {
  loadStagedTeachingProjection,
  readCurrentTeachingProjectionPointer,
  resolveTeachingProjectionStorePaths,
  stageTeachingProjectionArtifacts,
} from '../../src/lib/teaching-projection/store';
import {
  loadPrerequisitePublication,
  readCurrentPrerequisitePointer,
  resolvePrerequisiteStorePaths,
  stagePrerequisitePublication,
} from '../../src/lib/teaching-projection/prerequisites/store';
import type {
  CoreNodeAuthoringRow,
  PrerequisiteAuthorDecision,
  PrerequisiteEdgeAuthoring,
} from '../../src/lib/teaching-projection/prerequisites/contracts';
import { authorityDigest, type AuthorityEngineeringBody } from '../../src/lib/authoritative-knowledge/authority-snapshot';
import { projectionCanonicalJson, projectionDigest, projectionSha256 } from '../../src/lib/teaching-projection/hash';
import { assertCandidateOutputRoot } from './prepare-actkg-cutover-teaching-projection';
import { importValidatedActKGBundleV2 } from '../actkg-release/public-bundle-v2-import';
import { loadAndValidatePublicBundleV2 } from '../actkg-release/public-bundle-v2';
import { PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS } from '../actkg-release/capture-revision';
import { canonicalJson, sha256 } from '../actkg-release/authoritative-release';
import { createIsolatedAdmissionDatabase } from './admit-latest-actkg-aggregate';

const SHA = /^[a-f0-9]{40}$/u;
const SNAPSHOT = /^snap-[a-f0-9]{64}$/u;
const DEFAULT_OUTPUT = 'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18';
const CAPTURE_MANIFEST = 'course-content/authoring/knowledge/teaching-projection/capture-bound-input-manifest-v018.json';
export const V018_TEACHING_PROJECTION_POINTER_PATHS = V018_CURRENT_POINTER_PATHS;

type JsonObject = Record<string, unknown>;

function readJson(filePath: string): JsonObject {
  return JSON.parse(readFileSync(filePath, 'utf8')) as JsonObject;
}

function writeCanonical(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${projectionCanonicalJson(value)}\n`, 'utf8');
}

function relative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function fail(message: string): never {
  throw new Error(message);
}

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function asRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function targetAuthorityNodes(engineering: AuthorityEngineeringBody): V018AuthorityNodeRecord[] {
  return engineering.objects.map((object) => ({
    canonicalId: object.canonicalId,
    canonicalType: object.canonicalType,
    lifecycleStatus: object.lifecycleStatus ?? 'active',
    semanticName: object.semanticName,
    publicationStatus: object.publicationStatus,
  }));
}

function sourceAuthorityNodes(engineering: AuthorityEngineeringBody, referencedIds: ReadonlySet<string>): V018AuthorityNodeRecord[] {
  return engineering.objects
    .filter((object) => referencedIds.has(object.canonicalId))
    .map((object) => ({
      canonicalId: object.canonicalId,
      canonicalType: object.canonicalType,
      lifecycleStatus: object.lifecycleStatus ?? 'active',
      semanticName: object.semanticName,
      publicationStatus: object.publicationStatus,
    }));
}

function readEngineering(repoRoot: string, manifest: JsonObject): AuthorityEngineeringBody {
  const snapshotId = String(manifest.snapshotId ?? '');
  if (!SNAPSHOT.test(snapshotId)) fail(`invalid Authority snapshotId ${snapshotId}`);
  const pathForEngineering = path.join(
    repoRoot,
    'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases',
    snapshotId,
    'engineering.json',
  );
  return readJson(pathForEngineering) as unknown as AuthorityEngineeringBody;
}

export function assertV018AdmittedAuthorityCandidate(input: {
  repoRoot: string;
  receipt: JsonObject;
  receiptPath: string;
}): void {
  const outputs = Array.isArray(input.receipt.outputs) ? input.receipt.outputs : [];
  if (outputs.length === 0) fail('v0.18 Authority candidate receipt is missing sealed outputs');
  for (const raw of outputs) {
    const output = asRecord(raw);
    const relativePath = String(output.path ?? '');
    const expected = String(output.sha256 ?? '');
    const scope = String(output.digestScope ?? 'bytes');
    if (!relativePath || !/^[a-f0-9]{64}$/u.test(expected)) {
      fail(`v0.18 Authority sealed output is malformed: ${relativePath || '<missing>'}`);
    }
    const abs = path.join(input.repoRoot, relativePath);
    if (!existsSync(abs)) fail(`v0.18 Authority sealed output is missing: ${relativePath}`);
    const bytes = readFileSync(abs);
    const actual = scope === 'receipt-body-without-outputs'
      ? sha256(canonicalJson({ ...JSON.parse(bytes.toString('utf8')) as JsonObject, outputs: [] }))
      : sha256(bytes);
    if (actual !== expected) fail(`v0.18 Authority sealed output drifted: ${relativePath}`);
  }
}

function loadCandidateAuthority(repoRoot: string): {
  receipt: JsonObject;
  manifest: JsonObject;
  engineering: AuthorityEngineeringBody;
  receiptDigest: string;
  stageReceiptDigest: string;
} {
  const root = path.join(repoRoot, 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18');
  const receiptPath = path.join(root, 'candidate-receipt.json');
  const receipt = readJson(receiptPath);
  if (receipt.status !== 'staged' || receipt.nonActivation !== true || receipt.mode !== 'local-disposable-non-activation') {
    fail('v0.18 Authority candidate receipt is not staged/nonActivation');
  }
  assertV018AdmittedAuthorityCandidate({ repoRoot, receipt, receiptPath });
  const replays = Array.isArray(receipt.replays) ? receipt.replays : [];
  if (replays.length !== 2) fail('v0.18 Authority candidate requires exactly two replay receipts');
  const first = asRecord(replays[0]);
  const second = asRecord(replays[1]);
  for (const replay of [first, second]) {
    const imported = [asRecord(replay.import), asRecord(replay.idempotentImport)];
    if (imported.some((value) => value.candidateState !== 'ACCEPTED_CANDIDATE')) fail('v0.18 replay is not ACCEPTED_CANDIDATE');
    if (String(replay.snapshotId) !== String(first.snapshotId) || String(replay.snapshotHash) !== String(first.snapshotHash)) fail('v0.18 replay snapshot identity drift');
    if (String(replay.manifestPath).includes('replay-')) {
      const manifest = readJson(path.join(repoRoot, String(replay.manifestPath)));
      if (manifest.lifecycle !== 'staged') fail('v0.18 Authority candidate manifest is not staged');
    }
  }
  const manifestPath = path.join(repoRoot, String(first.manifestPath));
  const manifest = readJson(manifestPath);
  const engineering = readEngineering(repoRoot, manifest);
  if (authorityDigest(engineering) !== String(manifest.engineeringDigest ?? '')) {
    fail('v0.18 Authority engineeringDigest does not match engineering body');
  }
  if (String(manifest.snapshotId) !== String(first.snapshotId) || String(manifest.snapshotHash) !== String(first.snapshotHash)) {
    fail('v0.18 Authority manifest snapshot identity drifted from sealed replay');
  }
  if (String(manifest.snapshotId) !== `snap-${String(manifest.snapshotHash)}`) {
    fail('v0.18 Authority snapshotId does not match snapshotHash');
  }
  const stageReceiptPath = path.join(
    repoRoot,
    String(first.stageReceiptPath ?? path.join(path.dirname(String(first.manifestPath)), 'stage-receipt.json')),
  );
  if (!existsSync(stageReceiptPath)) fail('v0.18 Authority stage receipt is missing');
  return {
    receipt,
    manifest,
    engineering,
    receiptDigest: projectionSha256(readFileSync(receiptPath)),
    stageReceiptDigest: projectionSha256(readFileSync(stageReceiptPath)),
  };
}

function loadPriorAuthority(repoRoot: string): { pointer: JsonObject; manifest: JsonObject; engineering: AuthorityEngineeringBody } {
  const pointerPath = path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json');
  const pointer = readJson(pointerPath);
  const snapshotId = String(pointer.snapshotId ?? '');
  const manifestPath = path.join(repoRoot, 'course-content/authoring/knowledge/authority/releases', snapshotId, 'manifest.json');
  const manifest = readJson(manifestPath);
  const engineering = readJson(path.join(path.dirname(manifestPath), 'engineering.json')) as unknown as AuthorityEngineeringBody;
  return { pointer, manifest, engineering };
}

function prerequisiteInput(repoRoot: string, priorPublication: ReturnType<typeof loadPrerequisitePublication>): {
  coreNodes: CoreNodeAuthoringRow[];
  edges: PrerequisiteEdgeAuthoring[];
  decisions: PrerequisiteAuthorDecision[];
  candidates: ReturnType<typeof loadPrerequisitePublication>['candidates'];
} {
  const coreNodes: CoreNodeAuthoringRow[] = priorPublication.coreNodes.map((row) => ({
    canonicalId: row.canonicalId,
    scopeId: row.scopeId,
    pathEligible: row.pathEligible,
    cardPolicy: row.cardPolicy,
    moduleId: row.moduleId,
    rationale: row.rationale,
    sourceKind: row.sourceKind,
    sourceEvidence: [...row.sourceEvidence],
  }));
  const edges: PrerequisiteEdgeAuthoring[] = priorPublication.edges.map((row) => ({
    edgeId: row.edgeId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    strength: row.strength,
    scopeId: row.scopeId,
    evidenceRefs: [...row.evidenceRefs],
    curatorId: row.curatorId,
    curatorRationale: row.curatorRationale,
    status: row.status,
    authorDecisionId: row.authorDecisionId,
    candidateOrigin: row.candidateOrigin,
  }));
  const decisionsPath = path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/actkg-cutover-decisions.json');
  const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8')) as PrerequisiteAuthorDecision[];
  return { coreNodes, edges, decisions, candidates: priorPublication.candidates };
}

function captureFiles(repoRoot: string, inventory: ReturnType<typeof buildActiveCourseInventory>): string[] {
  const files = new Set<string>([
    'course-content/authoring/knowledge/authority/current.json',
    'course-content/runtime/knowledge/projection/current.json',
    'course-content/runtime/knowledge/prerequisites/current.json',
    'course-content/runtime/knowledge/authority-domain-shards/current.json',
    'course-content/runtime/knowledge/consumer-activation/current.json',
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/core-nodes.yaml',
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/edges.yaml',
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/actkg-cutover-decisions.json',
  ]);
  const genericManifestPath = path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/capture-bound-input-manifest.json');
  if (existsSync(genericManifestPath)) {
    const generic = readJson(genericManifestPath);
    if (Array.isArray(generic.files)) {
      for (const row of generic.files) {
        if (asRecord(row).path && typeof asRecord(row).path === 'string') files.add(String(asRecord(row).path));
      }
    }
  }
  for (const file of resolveIdentityDenominatorPaths(repoRoot)) files.add(file);
  for (const pkg of inventory.packages) {
    for (const sourcePath of pkg.sourcePaths) files.add(sourcePath);
    for (const resource of pkg.resources) {
      files.add(resource.sourcePath);
      if (resource.blueprintPath) files.add(resource.blueprintPath);
    }
  }
  return [...files].filter((file) => existsSync(path.join(repoRoot, file))).sort();
}

function loadOrBuildCaptureManifest(repoRoot: string, inventory: ReturnType<typeof buildActiveCourseInventory>, captureRevision: string): V018CaptureManifest {
  const manifestPath = path.join(repoRoot, CAPTURE_MANIFEST);
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath) as unknown as V018CaptureManifest;
    const requiredFiles = new Set(captureFiles(repoRoot, inventory));
    const capturedFiles = new Set(manifest.files.map((file) => file.path));
    const hasAuthoringCollection = manifest.collections.some((collection) => collection.collectionId === 'authoring:lessons');
    if (manifest.policy === 'file-membership-execution-bound/v2'
      && [...requiredFiles].every((file) => capturedFiles.has(file))
      && hasAuthoringCollection) {
      assertV018CaptureBound(repoRoot, manifest);
      return manifest;
    }
  }
  const collections = inventory.packages.map((pkg) => ({
    collectionId: `runtime:${pkg.packageId}`,
    root: 'course-content/runtime/lessons',
    prefixes: [`course-content/runtime/lessons/${pkg.runtimeLessonDir}/`],
  })).concat([{
    collectionId: 'authoring:lessons',
    root: 'course-content/authoring/lessons',
    prefixes: inventory.packages.map((pkg) => `course-content/authoring/lessons/${pkg.lessonKey}/`),
  }]);
  const manifest = buildV018CaptureManifest({
    repoRoot,
    captureRevision,
    files: captureFiles(repoRoot, inventory),
    collections,
  });
  writeCanonical(manifestPath, manifest);
  assertV018CaptureBound(repoRoot, manifest);
  return manifest;
}

function makeAuthorityBinding(candidate: ReturnType<typeof loadCandidateAuthority>): V018AuthorityBinding {
  const manifest = candidate.manifest;
  const receipt = candidate.receipt;
  const firstReplay = asRecord((Array.isArray(receipt.replays) ? receipt.replays : [])[0]);
  return {
    releaseId: String(manifest.releaseId),
    releaseSetId: String(manifest.releaseSetId),
    releaseHash: String(manifest.releaseHash),
    snapshotId: String(manifest.snapshotId),
    snapshotHash: String(manifest.snapshotHash),
    captureRevision: String(manifest.captureRevision),
    bundleDigest: String(manifest.bundleDigest),
    admissionReceiptId: String(manifest.importReceiptId),
    admissionReceiptDigest: candidate.stageReceiptDigest,
    candidateReceiptDigest: candidate.receiptDigest,
  };
}

function localEnvironmentIdentity(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `local-loopback:${projectionSha256(JSON.stringify({
    protocol: url.protocol,
    hostname: url.hostname.toLowerCase(),
    port: url.port || null,
    databaseName: url.pathname.replace(/^\//u, '') || null,
  }))}`;
}

type PrerequisiteObservationInput = {
  sourceNodeId: string;
  targetNodeId: string;
};

async function generateDatabaseObservation(input: {
  repoRoot: string;
  authority: V018AuthorityBinding;
  prerequisiteEdges: readonly PrerequisiteObservationInput[];
}): Promise<V018DatabaseObservation> {
  const sourceUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl) {
    throw new V018CaptureError('database-observation-source-rejected', 'DATABASE_URL is not configured');
  }
  const safety = assertV018DisposableDatabaseUrl(sourceUrl);
  const loadedBundle = await loadAndValidatePublicBundleV2({
    root: input.repoRoot,
    bundlePath: 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18',
    gitRoot: input.repoRoot,
  });
  let bundle = loadedBundle;
  if (loadedBundle.captureRevision !== input.authority.captureRevision) {
    // The Authority candidate was admitted at a frozen ancestor capture. The
    // public loader intentionally accepts only the current HEAD, so rebind
    // that validated Bundle only after proving every adapter and controlled
    // Bundle byte is unchanged between the two revisions.
    const protectedPaths = [
      ...PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18',
    ];
    try {
      execFileSync('git', [
        'diff', '--quiet', `${input.authority.captureRevision}..${loadedBundle.captureRevision}`,
        '--', ...protectedPaths,
      ], { cwd: input.repoRoot, stdio: 'ignore' });
    } catch {
      throw new V018CaptureError(
        'database-observation-binding-drift',
        'candidate Bundle or adapter inputs drifted after Authority admission',
      );
    }
    bundle = { ...loadedBundle, captureRevision: input.authority.captureRevision };
  }
  if (bundle.releaseIdentity.releaseId !== input.authority.releaseId
    || bundle.bundleIdentity.bundleDigest !== input.authority.bundleDigest) {
    throw new V018CaptureError(
      'database-observation-binding-drift',
      'candidate Bundle identity does not match the bound Authority receipt',
    );
  }

  const isolated = await createIsolatedAdmissionDatabase(input.repoRoot, { schemaOnly: true });
  try {
    await importValidatedActKGBundleV2(isolated.db, bundle);
    const rows = await isolated.db.$transaction(async (tx) => {
      // The import itself is the disposable candidate-admission setup.  The
      // observation transaction is explicitly read-only and repeatable.
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const objectRows = await tx.$queryRaw<Array<{ canonicalId: string; canonicalType: string }>>`
        SELECT "entityId" AS "canonicalId", "entityType" AS "canonicalType"
        FROM "ActkgProjectionNode"
        WHERE "releaseId" = ${bundle.releaseIdentity.releaseId}
        ORDER BY "entityId", "entityType"
      `;
      const prerequisitePayload = JSON.stringify(input.prerequisiteEdges.map((edge) => ({
        sourceCanonicalId: edge.sourceNodeId,
        targetCanonicalId: edge.targetNodeId,
        relationType: 'PREREQUISITE',
      })));
      const prerequisiteRows = await tx.$queryRaw<Array<{
        sourceCanonicalId: string;
        targetCanonicalId: string;
        relationType: string;
      }>>`
        SELECT
          links."sourceCanonicalId",
          links."targetCanonicalId",
          links."relationType"
        FROM jsonb_to_recordset(${prerequisitePayload}::jsonb)
          AS links("sourceCanonicalId" text, "targetCanonicalId" text, "relationType" text)
        ORDER BY links."sourceCanonicalId", links."targetCanonicalId", links."relationType"
      `;
      return { objectRows, prerequisiteRows };
    }, { isolationLevel: 'RepeatableRead' });

    return buildV018DatabaseObservation({
      // The helper's physical schema name contains PID/time and is deleted
      // after the read.  Persist a logical identity derived only from bound
      // inputs so replayed candidate receipts remain byte deterministic while
      // still proving schema-only disposable isolation.
      schemaIdentity: expectedV018AdmissionSchemaIdentity({
        snapshotId: input.authority.snapshotId,
        releaseId: input.authority.releaseId,
        bundleDigest: input.authority.bundleDigest,
        prerequisiteInputDigest: projectionDigest(input.prerequisiteEdges),
      }),
      environmentIdentity: localEnvironmentIdentity(sourceUrl),
      authoritySnapshotId: input.authority.snapshotId,
      parameters: {
        releaseId: bundle.releaseIdentity.releaseId,
        objectSource: 'ActkgProjectionNode',
        prerequisiteSource: 'capture-bound-prerequisite-jsonb',
        prerequisiteInputDigest: projectionDigest(input.prerequisiteEdges),
        databaseProtocol: safety.protocol,
        databaseHost: safety.hostname,
        databasePort: safety.port,
        isolation: safety.isolation,
      },
      objectRows: rows.objectRows.map((row) => ({
        canonicalId: row.canonicalId,
        canonicalType: row.canonicalType,
        snapshotId: input.authority.snapshotId,
      })),
      prerequisiteRows: rows.prerequisiteRows.map((row) => ({
        sourceCanonicalId: row.sourceCanonicalId,
        targetCanonicalId: row.targetCanonicalId,
        relationType: row.relationType,
        snapshotId: input.authority.snapshotId,
      })),
    });
  } finally {
    await isolated.cleanup();
  }
}

function blockedDatabaseObservation(error: unknown): JsonObject {
  if (error instanceof V018CaptureError) {
    return {
      status: 'BLOCKED',
      queryContractHash: V018_DATABASE_QUERY_CONTRACT_HASH,
      reason: error.code,
      detail: error.message,
    };
  }
  // Do not serialize driver errors: they may echo a connection string.
  const driverCode = error && typeof error === 'object' && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;
  const errorName = error && typeof error === 'object' && 'name' in error
    && typeof (error as { name?: unknown }).name === 'string'
    ? (error as { name: string }).name
    : null;
  return {
    status: 'BLOCKED',
    queryContractHash: V018_DATABASE_QUERY_CONTRACT_HASH,
    reason: 'database-observation-query-failed',
    detail: driverCode
      ? `disposable candidate-admission observation failed (${driverCode})`
      : errorName
        ? `disposable candidate-admission observation failed (${errorName})`
        : 'disposable candidate-admission observation failed',
  };
}

export async function prepareActKgV018TeachingProjection(
  argv: readonly string[] = process.argv.slice(2),
): Promise<{
  status: 'READY' | 'BLOCKED';
  outputRoot: string;
  receiptDigest: string;
  blockers: string[];
}> {
  const repoRoot = path.resolve(option(argv, '--repo-root') ?? process.cwd());
  const outputRoot = path.resolve(repoRoot, option(argv, '--output-root') ?? DEFAULT_OUTPUT);
  assertCandidateOutputRoot(repoRoot, outputRoot);
  const observationPath = option(argv, '--database-observation');
  const candidate = loadCandidateAuthority(repoRoot);
  const authority = makeAuthorityBinding(candidate);
  if (authority.releaseId !== 'ctr:release:control-theory-engineering-v0.18' || authority.snapshotId !== 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed') {
    fail('v0.18 rebase requires the admitted snap-1b64a853 candidate Authority root');
  }
  const priorAuthority = loadPriorAuthority(repoRoot);
  const projectionPointer = readCurrentTeachingProjectionPointer(resolveTeachingProjectionStorePaths(path.join(repoRoot, 'course-content/runtime/knowledge/projection')));
  if (!projectionPointer) fail('current Teaching Projection pointer is missing');
  const priorProjection = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(path.join(repoRoot, 'course-content/runtime/knowledge/projection')), projectionPointer.projectionId).artifacts;
  const pointersBefore = readV018PointerSnapshots(repoRoot, V018_TEACHING_PROJECTION_POINTER_PATHS);
  const prerequisitePaths = resolvePrerequisiteStorePaths(path.join(repoRoot, 'course-content/runtime/knowledge/prerequisites'));
  const prerequisitePointer = readCurrentPrerequisitePointer(prerequisitePaths);
  if (!prerequisitePointer) fail('current prerequisite pointer is missing');
  const priorPrerequisite = loadPrerequisitePublication(prerequisitePaths, prerequisitePointer.publicationId);
  const inventory = buildActiveCourseInventory({ repoRoot, authoringRevision: authority.captureRevision });
  if (inventory.packageCount !== 32 || inventory.resourceCount !== 551) fail(`active inventory drift: expected 32/551, got ${inventory.packageCount}/${inventory.resourceCount}`);
  const captureManifest = loadOrBuildCaptureManifest(repoRoot, inventory, authority.captureRevision);
  const references = buildV018ReferenceDenominator({
    inventory,
    priorArtifacts: priorProjection,
    captureRevision: authority.captureRevision,
    repoRoot,
  });
  const capture = buildV018CaptureReceipt({ manifest: captureManifest, inventory, references, excludedHistoricalCount: 4880 });
  const referencedIds = new Set<string>();
  for (const binding of priorProjection.bindings) referencedIds.add(binding.canonicalId);
  for (const edge of priorProjection.prerequisites) { referencedIds.add(edge.sourceCanonicalId); referencedIds.add(edge.targetCanonicalId); }
  for (const node of priorProjection.coreNodes) referencedIds.add(node.canonicalId);
  for (const card of priorProjection.cardsIndex.cards) referencedIds.add(card.canonicalId);
  const sourceNodes = sourceAuthorityNodes(priorAuthority.engineering, referencedIds);
  const targetNodes = targetAuthorityNodes(candidate.engineering);
  const priorPrerequisiteInput = prerequisiteInput(repoRoot, priorPrerequisite);
  const upstreamImpact = asRecord(candidate.receipt.impact);
  const upstreamImpactEvidence = {
    status: 'REJECTED_UPSTREAM' as const,
    path: String(upstreamImpact.path ?? 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/impact-report.json'),
    digest: String(upstreamImpact.digest ?? ''),
  };
  const first = buildV018IdentityRebase({ authority, sourceNodes, targetNodes, priorArtifacts: priorProjection, prerequisiteInput: priorPrerequisiteInput, references, upstreamImpactEvidence });
  const second = buildV018IdentityRebase({ authority, sourceNodes, targetNodes, priorArtifacts: priorProjection, prerequisiteInput: priorPrerequisiteInput, references, upstreamImpactEvidence });
  const projectionPaths = resolveTeachingProjectionStorePaths(path.join(outputRoot, 'projection'));
  const prerequisiteOutputPaths = resolvePrerequisiteStorePaths(path.join(outputRoot, 'prerequisites'));
  assertV018CandidateSelectorSafety({ mode: 'local-disposable-non-activation', unqualified: true, nonActivation: true, selectorConsumption: false, outputRoot: relative(repoRoot, outputRoot), currentPointerPaths: V018_TEACHING_PROJECTION_POINTER_PATHS });
  const firstProjection = stageTeachingProjectionArtifacts(projectionPaths, first.projection);
  const secondProjection = stageTeachingProjectionArtifacts(projectionPaths, second.projection);
  const firstPrereq = (() => {
    return stagePrerequisitePublication(prerequisiteOutputPaths, {
      scopeId: first.prerequisite.manifest.scopeId,
      authoringRevision: authority.captureRevision,
      authorityReleaseId: authority.releaseId,
      projectionCaptureId: authority.snapshotId,
      authorityNodes: targetNodes,
      coreNodes: first.prerequisiteInput?.coreNodes ?? [],
      edges: first.prerequisiteInput?.edges ?? [],
      decisions: first.prerequisiteInput?.decisions ?? [],
      candidates: first.prerequisiteInput?.candidates ?? [],
    });
  })();
  const secondPrereq = (() => {
    return stagePrerequisitePublication(prerequisiteOutputPaths, {
      scopeId: second.prerequisite.manifest.scopeId,
      authoringRevision: authority.captureRevision,
      authorityReleaseId: authority.releaseId,
      projectionCaptureId: authority.snapshotId,
      authorityNodes: targetNodes,
      coreNodes: second.prerequisiteInput?.coreNodes ?? [],
      edges: second.prerequisiteInput?.edges ?? [],
      decisions: second.prerequisiteInput?.decisions ?? [],
      candidates: second.prerequisiteInput?.candidates ?? [],
    });
  })();
  const pointersAfter = readV018PointerSnapshots(repoRoot, V018_TEACHING_PROJECTION_POINTER_PATHS);
  const dualBuild = buildV018DualBuildIdentity({
    firstProjectionId: firstProjection.projectionId,
    firstProjectionHash: firstProjection.projectionHash,
    secondProjectionId: secondProjection.projectionId,
    secondProjectionHash: secondProjection.projectionHash,
    firstPrerequisitePublicationId: firstPrereq.publicationId,
    firstPrerequisitePublicationHash: firstPrereq.publicationHash,
    secondPrerequisitePublicationId: secondPrereq.publicationId,
    secondPrerequisitePublicationHash: secondPrereq.publicationHash,
  });
  let observation: V018DatabaseObservation | null = null;
  let blockedObservation: JsonObject | null = null;
  if (observationPath) {
    observation = JSON.parse(readFileSync(path.resolve(repoRoot, observationPath), 'utf8')) as V018DatabaseObservation;
  } else {
    try {
      observation = await generateDatabaseObservation({
        repoRoot,
        authority,
        prerequisiteEdges: (first.prerequisiteInput?.edges ?? []).map((edge) => ({
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
        })),
      });
    } catch (error) {
      blockedObservation = blockedDatabaseObservation(error);
    }
  }
  const expectedCanonicalIds = new Set(targetNodes.map((node) => `${node.canonicalId}\u001f${node.canonicalType}`));
  const candidatePrerequisiteEdges = first.prerequisiteInput?.edges ?? [];
  const expectedPrerequisiteKeys = new Set(candidatePrerequisiteEdges.map((edge) => `${edge.sourceNodeId}\u001f${edge.targetNodeId}\u001fPREREQUISITE`));
  const prerequisiteInputDigest = projectionDigest(candidatePrerequisiteEdges.map((edge) => ({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
  })));
  const databaseObservation = validateV018DatabaseObservation({
    observation,
    authoritySnapshotId: authority.snapshotId,
    expectedCanonicalIds,
    expectedPrerequisiteKeys,
    expectedObjectRowCount: targetNodes.length,
    expectedPrerequisiteRowCount: candidatePrerequisiteEdges.length,
    expectedParameters: {
      releaseId: authority.releaseId,
      snapshotId: authority.snapshotId,
      objectSource: 'ActkgProjectionNode',
      prerequisiteSource: 'capture-bound-prerequisite-jsonb',
      prerequisiteInputDigest,
      isolation: 'schema-only-disposable',
    },
    expectedSchemaIdentity: expectedV018AdmissionSchemaIdentity({
      snapshotId: authority.snapshotId,
      releaseId: authority.releaseId,
      bundleDigest: authority.bundleDigest,
      prerequisiteInputDigest,
    }),
    requireLoopbackEnvironment: true,
  });
  const referenceKindCounts = Object.fromEntries(V018_REFERENCE_KINDS.map((kind) => [kind, references.filter((reference) => reference.kind === kind).length])) as Record<(typeof V018_REFERENCE_KINDS)[number], number>;
  const receipt = buildV018RebaseReceipt({
    authority,
    capture,
    databaseObservation,
    mapping: first.mapping,
    denominator: {
      referenceCount: references.length,
      resourceCount: first.authoring.resources?.length ?? 0,
      bindingCount: first.authoring.bindings?.length ?? 0,
      prerequisiteCount: first.authoring.prerequisites?.length ?? 0,
      coreNodeCount: first.authoring.coreNodes?.length ?? 0,
      cardCount: first.authoring.cards?.length ?? 0,
      digest: projectionDigest(references),
      referenceKindCounts,
    },
    projection: { projectionId: firstProjection.projectionId, projectionHash: firstProjection.projectionHash, gateStatus: first.projection.gate.status, gatePassed: first.projection.gate.passed },
    prerequisite: { publicationId: firstPrereq.publicationId, publicationHash: firstPrereq.publicationHash, gateStatus: firstPrereq.artifacts.gate.status, gatePassed: firstPrereq.artifacts.gate.passed },
    pointersBefore,
    pointersAfter,
    dualBuild,
  });
  writeCanonical(path.join(outputRoot, 'capture-receipt.json'), capture);
  writeCanonical(path.join(outputRoot, 'denominator.json'), references);
  writeCanonical(path.join(outputRoot, 'impact-evidence.json'), first.mapping);
  writeCanonical(
    path.join(outputRoot, 'database-observation.json'),
    observation ?? blockedObservation ?? {
      status: 'BLOCKED',
      queryContractHash: V018_DATABASE_QUERY_CONTRACT_HASH,
      reason: 'database-observation-unavailable',
    },
  );
  writeCanonical(path.join(outputRoot, 'candidate-receipt.json'), receipt);
  writeCanonical(path.join(outputRoot, 'candidate-manifest.json'), {
    contract: 'act-teaching-projection-v018-candidate/v1',
    mode: 'local-disposable-non-activation',
    unqualified: true,
    nonActivation: true,
    selectorConsumption: false,
    authority: receipt.authority,
    projection: receipt.projection,
    prerequisite: receipt.prerequisite,
    receiptDigest: receipt.receiptDigest,
  });
  const summary = {
    status: receipt.status,
    outputRoot: relative(repoRoot, outputRoot),
    receiptDigest: receipt.receiptDigest,
    blockers: receipt.blockers,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  prepareActKgV018TeachingProjection().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

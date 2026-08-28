/** Capture-bound denominator and database-observation helpers for #1409. */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { ActiveCourseInventory } from '../../../src/lib/teaching-projection/migration-contracts';
import type {
  TeachingProjectionArtifacts,
  TeachingResourceType,
} from '../../../src/lib/teaching-projection/contracts';
import { projectionDigest, projectionSha256 } from '../../../src/lib/teaching-projection/hash';
import type {
  V018CaptureCollection,
  V018CaptureFile,
  V018CaptureManifest,
  V018CaptureReceipt,
  V018DatabaseObservation,
  V018DatabaseObservationCheck,
  V018ReferenceKind,
  V018ReferenceRecord,
} from './v018-contracts';

const SHA = /^[a-f0-9]{40}$/u;

export class V018CaptureError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018CaptureError';
    this.code = code;
  }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    }).trimEnd();
  } catch (error) {
    throw new V018CaptureError(
      'git-boundary-failed',
      `capture-bound Git command failed (${args.join(' ')}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeRelative(repoRoot: string, filePath: string): string {
  const value = relative(resolve(repoRoot), resolve(repoRoot, filePath)).split('\\').join('/');
  if (!value || value === '.' || value.startsWith('../') || value.includes('/../')) {
    throw new V018CaptureError('path-outside-repository', `capture path escapes repository: ${filePath}`);
  }
  return value;
}

function gitBlobAtRevision(repoRoot: string, revision: string, path: string): Buffer {
  try {
    return execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: repoRoot,
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (error) {
    throw new V018CaptureError(
      'capture-file-missing',
      `capture revision ${revision} does not contain ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function gitModeAtRevision(repoRoot: string, revision: string, path: string): string {
  const output = git(repoRoot, ['ls-tree', revision, '--', path]);
  const mode = output.split(/\s+/u)[0];
  if (!mode) throw new V018CaptureError('capture-file-missing', `capture revision has no mode for ${path}`);
  return mode;
}

function membershipDigest(repoRoot: string, revision: string, collection: V018CaptureCollection): string {
  const rows = git(repoRoot, ['ls-tree', '-r', '--full-tree', '--name-only', revision, '--', collection.root]);
  const paths = rows
    .split('\n')
    .filter(Boolean)
    .filter((path) => collection.prefixes.some((prefix) => path.startsWith(prefix)))
    .sort();
  if (paths.length === 0) {
    throw new V018CaptureError(
      'capture-membership-empty',
      `capture collection ${collection.collectionId} has no members under ${collection.root}`,
    );
  }
  return projectionDigest(paths);
}

function executionDigest(repoRoot: string, revision: string, collection: V018CaptureCollection): string {
  const paths = git(repoRoot, ['ls-tree', '-r', '--full-tree', '--name-only', revision, '--', collection.root])
    .split('\n')
    .filter(Boolean)
    .filter((path) => collection.prefixes.some((prefix) => path.startsWith(prefix)))
    .sort();
  const rows = paths.map((path) => `${path}\u001f${gitModeAtRevision(repoRoot, revision, path)}\u001f${sha256(gitBlobAtRevision(repoRoot, revision, path))}`);
  return projectionDigest(rows);
}

function currentCollectionEntries(repoRoot: string, collection: V018CaptureCollection): {
  paths: string[];
  execution: string[];
} {
  const tracked = git(repoRoot, ['ls-files', '--full-name'])
    .split('\n')
    .filter(Boolean);
  const untracked = git(repoRoot, ['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean);
  const paths = [...new Set([...tracked, ...untracked])]
    .filter((path) => collection.root === '.' || path.startsWith(`${collection.root}/`) || path === collection.root)
    .filter((path) => collection.prefixes.some((prefix) => path.startsWith(prefix)))
    .sort();
  const execution = paths.map((path) => {
    const abs = resolve(repoRoot, path);
    const mode = statSync(abs).mode & 0o111 ? '100755' : '100644';
    return `${path}\u001f${mode}\u001f${sha256(readFileSync(abs))}`;
  });
  return { paths, execution };
}

/**
 * Construct a scoped manifest from the exact files and collections that the
 * rebase consumes.  It is safe to add the resulting manifest after capture E;
 * the input files themselves remain bound to E.
 */
export function buildV018CaptureManifest(input: {
  repoRoot: string;
  captureRevision: string;
  files: readonly string[];
  collections?: readonly Omit<V018CaptureCollection, 'membershipDigest' | 'executionDigest'>[];
}): V018CaptureManifest {
  if (!SHA.test(input.captureRevision)) {
    throw new V018CaptureError('invalid-capture-revision', 'captureRevision must be a full Git SHA');
  }
  const files: V018CaptureFile[] = [...new Set(input.files.map((file) => normalizeRelative(input.repoRoot, file)))]
    .sort()
    .map((path) => {
      const blob = gitBlobAtRevision(input.repoRoot, input.captureRevision, path);
      return {
        path,
        blobSha256: sha256(blob),
        mode: gitModeAtRevision(input.repoRoot, input.captureRevision, path),
        required: true as const,
      };
    });
  const collections: V018CaptureCollection[] = [...(input.collections ?? [])]
    .map((collection) => ({
      ...collection,
      membershipDigest: membershipDigest(input.repoRoot, input.captureRevision, collection as V018CaptureCollection),
      executionDigest: executionDigest(input.repoRoot, input.captureRevision, collection as V018CaptureCollection),
    }))
    .sort((a, b) => a.collectionId < b.collectionId ? -1 : a.collectionId > b.collectionId ? 1 : 0);
  const body = {
    contract: 'act-teaching-projection-capture-bound-inputs/v2' as const,
    captureRevision: input.captureRevision,
    policy: 'file-membership-execution-bound/v2' as const,
    files,
    collections,
  };
  return { ...body, inputDigest: projectionDigest(body) };
}

/**
 * Verify both bytes and Git membership/execution identity.  A clean working
 * tree is not required: unrelated edits are allowed, while any captured file
 * or denominator-defining collection drift is rejected.
 */
export function assertV018CaptureBound(
  repoRoot: string,
  manifest: V018CaptureManifest,
): void {
  if (manifest.contract !== 'act-teaching-projection-capture-bound-inputs/v2') {
    throw new V018CaptureError('manifest-contract-invalid', 'unsupported v0.18 capture manifest contract');
  }
  if (!SHA.test(manifest.captureRevision)) {
    throw new V018CaptureError('invalid-capture-revision', 'captureRevision must be a full Git SHA');
  }
  const body = {
    contract: manifest.contract,
    captureRevision: manifest.captureRevision,
    policy: manifest.policy,
    files: manifest.files,
    collections: manifest.collections,
  };
  if (manifest.inputDigest !== projectionDigest(body)) {
    throw new V018CaptureError('manifest-digest-drift', 'v0.18 capture manifest inputDigest drift');
  }
  for (const file of manifest.files) {
    const path = normalizeRelative(repoRoot, file.path);
    const abs = resolve(repoRoot, path);
    if (!existsSync(abs)) throw new V018CaptureError('file-drift', `captured file is missing: ${path}`);
    const workingBytes = readFileSync(abs);
    if (sha256(workingBytes) !== file.blobSha256) {
      throw new V018CaptureError('file-drift', `captured file bytes drifted: ${path}`);
    }
    if (gitModeAtRevision(repoRoot, manifest.captureRevision, path) !== file.mode) {
      throw new V018CaptureError('file-mode-drift', `captured file mode drifted: ${path}`);
    }
  }
  for (const collection of manifest.collections) {
    const current = currentCollectionEntries(repoRoot, collection);
    if (projectionDigest(current.paths) !== collection.membershipDigest) {
      throw new V018CaptureError('membership-drift', `capture membership drifted: ${collection.collectionId}`);
    }
    if (projectionDigest(current.execution) !== collection.executionDigest) {
      throw new V018CaptureError('execution-drift', `capture execution set drifted: ${collection.collectionId}`);
    }
  }
}

function resourceKind(resourceType: TeachingResourceType, sourcePath: string): V018ReferenceKind {
  const lower = sourcePath.toLowerCase();
  if (lower.includes('infograph')) return 'infograph';
  if (lower.includes('konling')) return 'konling';
  if (lower.includes('/rag') || lower.includes('rag/')) return 'rag';
  if (lower.includes('path')) return 'path';
  if (resourceType === 'textbook' || resourceType === 'textbook-chapter' || resourceType === 'textbook-section') {
    return resourceType;
  }
  return 'resource';
}

function resourceTypeFromId(resourceId: string): TeachingResourceType {
  const value = resourceId.replace(/^act:/u, '').split(':')[0];
  if (value === 'step') return 'step';
  if (value === 'lesson') return 'lesson';
  if (value === 'handout') return 'handout';
  if (value === 'textbook') return 'textbook';
  if (value === 'textbook-chapter') return 'textbook-chapter';
  if (value === 'textbook-section') return 'textbook-section';
  if (value === 'card') return 'card';
  return 'lesson';
}

function sourceDigest(sourcePath: string): string {
  return projectionSha256(sourcePath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function collectOverlayInfographReferences(input: {
  repoRoot: string;
  inventory: ActiveCourseInventory;
  captureRevision: string;
}): V018ReferenceRecord[] {
  const records: V018ReferenceRecord[] = [];
  for (const pkg of input.inventory.packages) {
    const overlayPath = pkg.sourcePaths.find((sourcePath) => sourcePath.endsWith('/graph-overlay.json') || sourcePath === 'graph-overlay.json');
    if (!overlayPath) continue;
    const abs = resolve(input.repoRoot, overlayPath);
    if (!existsSync(abs)) {
      throw new V018CaptureError('infograph-overlay-missing', `captured graph overlay is missing: ${overlayPath}`);
    }
    const overlay = JSON.parse(readFileSync(abs, 'utf8')) as unknown;
    const seen = new Set<string>();
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const rec = asRecord(value);
      if (rec.type === 'infograph') {
        const mediaPath = typeof rec.path === 'string' ? rec.path : overlayPath;
        const nodeId = typeof rec.sourceNodeId === 'string'
          ? rec.sourceNodeId
          : typeof rec.nodeId === 'string' ? rec.nodeId : mediaPath;
        const key = `${mediaPath}\u001f${nodeId}`;
        if (!seen.has(key)) {
          seen.add(key);
          records.push({
            referenceId: `infograph:${nodeId}:${mediaPath}`,
            kind: 'infograph',
            sourcePath: mediaPath,
            sourceDigest: existsSync(resolve(input.repoRoot, mediaPath))
              ? projectionSha256(readFileSync(resolve(input.repoRoot, mediaPath)))
              : projectionSha256(readFileSync(abs)),
            scopeId: pkg.scopeId,
            canonicalIds: [],
            active: true,
            captureRevision: input.captureRevision,
            captureEvidence: [overlayPath, mediaPath, 'reviewed-non-semantic:overlay-infograph-media'],
            reviewedNonSemanticDisposition: 'overlay-infograph-media',
          });
        }
      }
      for (const child of Object.values(rec)) visit(child);
    };
    visit(overlay);
  }
  return records;
}

/**
 * Build the denominator from active inventory plus all resources already
 * referenced by the current published projection.  This includes explicit
 * textbook/prerequisite/path/Konling/RAG/infograph references while excluding
 * Authority additions and historical records.
 */
export function buildV018ReferenceDenominator(input: {
  inventory: ActiveCourseInventory;
  priorArtifacts: TeachingProjectionArtifacts;
  captureRevision: string;
  repoRoot?: string;
}): V018ReferenceRecord[] {
  const records = new Map<string, V018ReferenceRecord>();
  const add = (record: V018ReferenceRecord) => {
    const key = `${record.kind}\u001f${record.referenceId}`;
    const existing = records.get(key);
    if (!existing) records.set(key, record);
    else {
      existing.canonicalIds = [...new Set([...existing.canonicalIds, ...record.canonicalIds])].sort();
      existing.captureEvidence = [...new Set([...existing.captureEvidence, ...record.captureEvidence])].sort();
    }
  };
  for (const pkg of input.inventory.packages) {
    add({
      referenceId: pkg.packageId,
      kind: 'package',
      sourcePath: pkg.runtimeLessonDir,
      sourceDigest: sourceDigest(pkg.runtimeLessonDir),
      scopeId: pkg.scopeId,
      canonicalIds: [],
      active: true,
      captureRevision: input.captureRevision,
      captureEvidence: pkg.sourcePaths,
    });
    add({
      referenceId: pkg.lessonKey,
      kind: 'course',
      sourcePath: pkg.runtimeLessonDir,
      sourceDigest: sourceDigest(pkg.runtimeLessonDir),
      scopeId: pkg.scopeId,
      canonicalIds: [],
      active: true,
      captureRevision: input.captureRevision,
      captureEvidence: pkg.sourcePaths,
    });
    for (const resource of pkg.resources) {
      add({
        referenceId: resource.resourceId,
        kind: resourceKind(resource.resourceType, resource.sourcePath),
        sourcePath: resource.sourcePath,
        sourceDigest: resource.sourceDigest,
        scopeId: resource.scopeId,
        resourceId: resource.resourceId,
        canonicalIds: resource.knowledgeRefs.map((ref) => ref.canonicalId).sort(),
        active: true,
        captureRevision: input.captureRevision,
        captureEvidence: [resource.sourcePath, ...(resource.blueprintPath ? [resource.blueprintPath] : [])],
      });
    }
  }
  for (const resource of input.priorArtifacts.resources) {
    add({
      referenceId: resource.resourceId,
      kind: resourceKind(resource.resourceType, resource.sourcePath ?? resource.resourceId),
      sourcePath: resource.sourcePath ?? resource.resourceId,
      sourceDigest: sourceDigest(resource.sourcePath ?? resource.resourceId),
      scopeId: resource.scopeId,
      resourceId: resource.resourceId,
      canonicalIds: input.priorArtifacts.bindings
        .filter((binding) => binding.resourceId === resource.resourceId)
        .map((binding) => binding.canonicalId)
        .sort(),
      active: true,
      captureRevision: input.captureRevision,
      captureEvidence: [resource.sourcePath ?? resource.resourceId],
    });
  }
  for (const card of input.priorArtifacts.cardsIndex.cards) {
    if (!card.active) continue;
    add({
      referenceId: card.cardId,
      kind: 'card',
      sourcePath: card.sourcePath ?? card.cardId,
      sourceDigest: sourceDigest(card.sourcePath ?? card.cardId),
      scopeId: input.priorArtifacts.manifest.scopeId,
      resourceId: card.resourceId,
      canonicalIds: [card.canonicalId],
      active: true,
      captureRevision: input.captureRevision,
      captureEvidence: [card.sourcePath ?? card.cardId],
    });
  }
  for (const edge of input.priorArtifacts.prerequisites) {
    add({
      referenceId: edge.prerequisiteId,
      kind: 'prerequisite',
      sourcePath: edge.evidenceRef ?? edge.prerequisiteId,
      sourceDigest: sourceDigest(edge.evidenceRef ?? edge.prerequisiteId),
      scopeId: edge.scopeId ?? input.priorArtifacts.manifest.scopeId,
      canonicalIds: [edge.sourceCanonicalId, edge.targetCanonicalId].sort(),
      active: true,
      captureRevision: input.captureRevision,
      captureEvidence: [edge.evidenceRef ?? edge.prerequisiteId],
    });
  }
  if (input.repoRoot) {
    for (const infograph of collectOverlayInfographReferences({
      repoRoot: input.repoRoot,
      inventory: input.inventory,
      captureRevision: input.captureRevision,
    })) {
      add(infograph);
    }
  }
  return [...records.values()].sort((a, b) => {
    const ak = `${a.kind}\u001f${a.referenceId}`;
    const bk = `${b.kind}\u001f${b.referenceId}`;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
}

export function buildV018CaptureReceipt(input: {
  manifest: V018CaptureManifest;
  inventory: ActiveCourseInventory;
  references: readonly V018ReferenceRecord[];
  excludedHistoricalCount?: number;
  excludedUnreferencedCount?: number;
}): V018CaptureReceipt {
  const denominatorDigest = projectionDigest(input.references);
  return {
    contract: 'act-teaching-projection-capture-receipt/v1',
    captureRevision: input.manifest.captureRevision,
    manifestDigest: input.manifest.inputDigest,
    inventoryDigest: input.inventory.inventoryDigest,
    denominatorDigest,
    referenceCount: input.references.length,
    excludedHistoricalCount: input.excludedHistoricalCount ?? 4880,
    excludedUnreferencedCount: input.excludedUnreferencedCount ?? 0,
    fileMembershipExecutionBound: true,
  };
}

export const V018_DATABASE_QUERY_CONTRACT = {
  contract: 'actkg-v018-candidate-admission-db-query/v1',
  objectQuery: 'SELECT "entityId" AS canonical_id, "entityType" AS canonical_type, :snapshotId AS snapshot_id FROM "ActkgProjectionNode" WHERE "releaseId" = :releaseId ORDER BY canonical_id, canonical_type',
  prerequisiteQuery: 'SELECT source_canonical_id, target_canonical_id, relation_type, :snapshotId AS snapshot_id FROM jsonb_to_recordset(:prerequisiteRowsJson::jsonb) AS links(source_canonical_id text, target_canonical_id text, relation_type text) ORDER BY source_canonical_id, target_canonical_id, relation_type',
  readOnly: true,
  disposable: true,
} as const;

export const V018_DATABASE_QUERY_CONTRACT_HASH = projectionDigest(V018_DATABASE_QUERY_CONTRACT);

export function expectedV018AdmissionSchemaIdentity(input: {
  snapshotId: string;
  releaseId: string;
  bundleDigest: string;
  prerequisiteInputDigest: string;
}): string {
  return `actkg_admission_v018_${projectionDigest({
    snapshotId: input.snapshotId,
    releaseId: input.releaseId,
    bundleDigest: input.bundleDigest,
    prerequisiteInputDigest: input.prerequisiteInputDigest,
  }).slice(0, 32)}`;
}

export function environmentIdentityFromObservationParameters(
  parameters: Record<string, string | number | boolean | null>,
): string {
  return `local-loopback:${projectionSha256(JSON.stringify({
    protocol: String(parameters.databaseProtocol ?? ''),
    hostname: String(parameters.databaseHost ?? '').toLowerCase(),
    port: parameters.databasePort == null || parameters.databasePort === ''
      ? null
      : String(parameters.databasePort),
    databaseName: parameters.databaseName == null || parameters.databaseName === ''
      ? null
      : String(parameters.databaseName),
  }))}`;
}

export interface V018DatabaseUrlSafety {
  accepted: true;
  protocol: 'postgres:' | 'postgresql:';
  hostname: string;
  port: string | null;
  databaseName: string | null;
  isolation: 'schema-only-disposable';
}

/**
 * The observation runner may create a disposable schema, but it must never
 * connect to a remote database.  Keep this check independent of the
 * candidate-admission helper so callers can fail closed before constructing a
 * client or opening a socket.
 */
export function assertV018DisposableDatabaseUrl(databaseUrl: string): V018DatabaseUrlSafety {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new V018CaptureError('database-observation-source-rejected', 'DATABASE_URL is not a valid PostgreSQL URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new V018CaptureError('database-observation-source-rejected', 'DATABASE_URL must use a PostgreSQL URL scheme');
  }
  const hostname = url.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    throw new V018CaptureError(
      'database-observation-source-rejected',
      'DATABASE_URL must target a local loopback PostgreSQL host',
    );
  }
  return {
    accepted: true,
    protocol: url.protocol,
    hostname,
    port: url.port || null,
    databaseName: url.pathname.replace(/^\//u, '') || null,
    isolation: 'schema-only-disposable',
  };
}

export function buildV018DatabaseObservation(input: {
  schemaIdentity: string;
  environmentIdentity: string;
  authoritySnapshotId: string;
  parameters: Record<string, string | number | boolean | null>;
  objectRows: readonly V018DatabaseObservation['objectRows'][number][];
  prerequisiteRows: readonly V018DatabaseObservation['prerequisiteRows'][number][];
}): V018DatabaseObservation {
  const objectRows = [...input.objectRows].sort((left, right) => (
    left.canonicalId.localeCompare(right.canonicalId)
      || left.canonicalType.localeCompare(right.canonicalType)
      || left.snapshotId.localeCompare(right.snapshotId)
  ));
  const prerequisiteRows = [...input.prerequisiteRows].sort((left, right) => (
    left.sourceCanonicalId.localeCompare(right.sourceCanonicalId)
      || left.targetCanonicalId.localeCompare(right.targetCanonicalId)
      || left.relationType.localeCompare(right.relationType)
      || left.snapshotId.localeCompare(right.snapshotId)
  ));
  const resultDigest = projectionDigest({ objectRows, prerequisiteRows });
  return {
    contract: 'actkg-v018-candidate-admission-db-observation/v1',
    mode: 'disposable-read-only-candidate-admission',
    schemaIdentity: input.schemaIdentity,
    environmentIdentity: input.environmentIdentity,
    queryContractHash: V018_DATABASE_QUERY_CONTRACT_HASH,
    parameters: { ...input.parameters, snapshotId: input.authoritySnapshotId },
    objectRows,
    prerequisiteRows,
    resultDigest,
    objectRowCount: objectRows.length,
    prerequisiteRowCount: prerequisiteRows.length,
    readOnly: true,
    disposable: true,
  };
}

export function validateV018DatabaseObservation(input: {
  observation: V018DatabaseObservation | null | undefined;
  authoritySnapshotId: string;
  expectedCanonicalIds: ReadonlySet<string>;
  expectedPrerequisiteKeys: ReadonlySet<string>;
  expectedObjectRowCount?: number;
  expectedPrerequisiteRowCount?: number;
  expectedParameters?: Record<string, string | number | boolean | null>;
  expectedSchemaIdentity?: string;
  expectedEnvironmentIdentity?: string;
  requireLoopbackEnvironment?: boolean;
}): V018DatabaseObservationCheck {
  if (!input.observation) {
    return {
      available: false,
      accepted: false,
      findingCodes: ['database-observation-unavailable'],
      observationDigest: null,
    };
  }
  const observation = input.observation;
  const findings: string[] = [];
  if (observation.contract !== 'actkg-v018-candidate-admission-db-observation/v1') findings.push('database-contract-invalid');
  if (observation.mode !== 'disposable-read-only-candidate-admission' || !observation.readOnly || !observation.disposable) findings.push('database-scope-invalid');
  if (!observation.schemaIdentity || !observation.environmentIdentity) findings.push('database-environment-identity-missing');
  if (observation.queryContractHash !== V018_DATABASE_QUERY_CONTRACT_HASH) findings.push('database-query-contract-drift');
  if (observation.parameters.snapshotId !== input.authoritySnapshotId) findings.push('database-parameters-drift');
  if (input.expectedSchemaIdentity && observation.schemaIdentity !== input.expectedSchemaIdentity) {
    findings.push('database-schema-identity-drift');
  }
  if (input.expectedEnvironmentIdentity && observation.environmentIdentity !== input.expectedEnvironmentIdentity) {
    findings.push('database-environment-identity-drift');
  }
  if (input.expectedParameters) {
    for (const [key, expected] of Object.entries(input.expectedParameters)) {
      if (observation.parameters[key] !== expected) findings.push('database-parameters-drift');
    }
  }
  if (input.requireLoopbackEnvironment) {
    const host = String(observation.parameters.databaseHost ?? '');
    const protocol = String(observation.parameters.databaseProtocol ?? '');
    const port = observation.parameters.databasePort;
    const databaseName = observation.parameters.databaseName;
    if (!host || !protocol || port == null || port === '' || databaseName == null || databaseName === '') {
      findings.push('database-environment-parameters-missing');
    }
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
      findings.push('database-environment-identity-drift');
    }
    if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
      findings.push('database-environment-identity-drift');
    }
    if (observation.environmentIdentity !== environmentIdentityFromObservationParameters(observation.parameters)) {
      findings.push('database-environment-identity-drift');
    }
  }
  if (observation.objectRows.some((row) => row.snapshotId !== input.authoritySnapshotId)) findings.push('database-object-snapshot-drift');
  if (observation.prerequisiteRows.some((row) => row.snapshotId !== input.authoritySnapshotId)) findings.push('database-prerequisite-snapshot-drift');
  if (observation.objectRowCount !== observation.objectRows.length || observation.prerequisiteRowCount !== observation.prerequisiteRows.length) findings.push('database-result-count-drift');
  if (input.expectedObjectRowCount !== undefined && observation.objectRowCount !== input.expectedObjectRowCount) findings.push('database-object-count-drift');
  if (input.expectedPrerequisiteRowCount !== undefined && observation.prerequisiteRowCount !== input.expectedPrerequisiteRowCount) findings.push('database-prerequisite-count-drift');
  const objectRows = observation.objectRows.map((row) => `${row.canonicalId}\u001f${row.canonicalType}`).sort();
  const observedObjectOrder = observation.objectRows.map((row) => `${row.canonicalId}\u001f${row.canonicalType}`);
  if (observedObjectOrder.some((row, index) => row !== objectRows[index])) findings.push('database-object-order-drift');
  if (objectRows.some((key) => !input.expectedCanonicalIds.has(key))) findings.push('database-object-result-drift');
  const observedObjectKeys = new Set(objectRows);
  if (observedObjectKeys.size !== objectRows.length) findings.push('database-object-duplicate');
  const prerequisiteRows = observation.prerequisiteRows.map((row) => `${row.sourceCanonicalId}\u001f${row.targetCanonicalId}\u001f${row.relationType}`).sort();
  const observedPrerequisiteOrder = observation.prerequisiteRows.map((row) => `${row.sourceCanonicalId}\u001f${row.targetCanonicalId}\u001f${row.relationType}`);
  if (observedPrerequisiteOrder.some((row, index) => row !== prerequisiteRows[index])) findings.push('database-prerequisite-order-drift');
  if (prerequisiteRows.some((key) => !input.expectedPrerequisiteKeys.has(key))) findings.push('database-prerequisite-result-drift');
  const observedPrerequisiteKeys = new Set(prerequisiteRows);
  if (observedPrerequisiteKeys.size !== prerequisiteRows.length) findings.push('database-prerequisite-duplicate');
  if (input.expectedCanonicalIds.size !== observedObjectKeys.size
    || [...input.expectedCanonicalIds].some((key) => !observedObjectKeys.has(key))) {
    findings.push('database-object-completeness-drift');
  }
  if (input.expectedPrerequisiteKeys.size !== observedPrerequisiteKeys.size
    || [...input.expectedPrerequisiteKeys].some((key) => !observedPrerequisiteKeys.has(key))) {
    findings.push('database-prerequisite-completeness-drift');
  }
  const expectedDigest = projectionDigest({
    objectRows: observation.objectRows,
    prerequisiteRows: observation.prerequisiteRows,
  });
  if (observation.resultDigest !== expectedDigest) findings.push('database-result-digest-drift');
  const digest = projectionDigest(observation);
  return {
    available: true,
    accepted: findings.length === 0,
    findingCodes: [...new Set(findings)].sort(),
    observationDigest: digest,
  };
}

export function resourceTypeFromV018Id(resourceId: string): TeachingResourceType {
  return resourceTypeFromId(resourceId);
}

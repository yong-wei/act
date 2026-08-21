/**
 * Deterministic Engineering Authority Snapshot materialization (#1266).
 *
 * Snapshots are immutable, staged-first, and never mutate teaching selectors.
 * Activation is a separate digest-checked pointer transaction.
 */

import { createHash } from 'node:crypto';

import { multilingualLabelCountForRelease } from '../actkg-envelope/composite-envelope-registry';
import { STANDARD_PUBLIC_BUNDLE_V2_PROTOCOL } from './contracts';

import type {
  AuthoritativeKnowledgeSnapshot,
  AuthoritativeObjectRecord,
  AuthoritativeRelationRecord,
  AuthoritativeSourceMappingRecord,
  AuthoritativeSourceObjectRecord,
  AuthoritativeEvidenceRecord,
  AuthoritativeV2Evidence,
} from './contracts';

export const AUTHORITY_SNAPSHOT_CONTRACT =
  'actkg-engineering-authority-snapshot/v1' as const;
export const AUTHORITY_CURRENT_POINTER_CONTRACT =
  'actkg-engineering-authority-current/v1' as const;
export const AUTHORITY_STAGE_RECEIPT_CONTRACT =
  'actkg-engineering-authority-stage-receipt/v1' as const;
export const AUTHORITY_ACTIVATION_RECEIPT_CONTRACT =
  'actkg-engineering-authority-activation-receipt/v1' as const;
export const AUTHORITY_ROLLBACK_RECEIPT_CONTRACT =
  'actkg-engineering-authority-rollback-receipt/v1' as const;

export const DEFAULT_AUTHORITY_ROOT_RELATIVE =
  'course-content/authoring/knowledge/authority' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT_SHA = /^[a-f0-9]{40}$/u;

export type AuthoritySnapshotLifecycle =
  | 'staged'
  | 'active'
  | 'superseded'
  | 'rejected';

export interface AuthorityEngineeringObject {
  canonicalId: string;
  ordinal: number;
  canonicalType: string;
  semanticName: string | null;
  reviewStatus: string | null;
  publicationStatus: string | null;
  lifecycleStatus: string | null;
  payload: unknown;
}

export interface AuthorityEngineeringRelation {
  relationId: string;
  ordinal: number;
  qualityTier: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  reviewStatus: string | null;
  publicationStatus: string | null;
  direct: boolean | null;
  payload: unknown;
}

export interface AuthorityProvenanceSummary {
  sourceMappingCount: number;
  sourceObjectCount: number;
  evidenceSegmentCount: number;
  releaseEntryCount: number;
  upstreamRagReferenceCount: number;
  releaseComponentCount: number;
  projectionIdentityCount: number;
  linkMetadataCount: number;
  importReceiptId: string | null;
  bundleReceiptId: string | null;
  bundleId: string | null;
  captureRevision: string | null;
  lockRawHash: string | null;
  v2ProfileCount?: number;
  v2MultilingualLabelCount?: number;
  v2AdmissionBindingDigest?: string | null;
}

/** Engineering body that is hash-bound into the snapshot (byte-stable). */
export interface AuthorityEngineeringBody {
  objects: AuthorityEngineeringObject[];
  relations: AuthorityEngineeringRelation[];
  sourceMappings: Array<{
    mappingId: string;
    ordinal: number;
    canonicalId: string;
    sourceObjectId: string;
    payload: unknown;
  }>;
  sourceObjects: Array<{
    sourceObjectId: string;
    ordinal: number;
    sourceKind: string;
    payload: unknown;
  }>;
  evidence: Array<{
    evidenceId: string;
    ordinal: number;
    payload: unknown;
  }>;
  /** Full engineering semantic sets retained for RAG/citation and relation evidence. */
  releaseEntries: Array<{
    entityId: string;
    ordinal: number;
    releaseTier: string;
    entityRole: string;
    inclusionReason: string;
    payload: unknown;
  }>;
  upstreamRagReferences: Array<{
    ordinal: number;
    publishedEntityId: string;
    retrievalChunkId: string;
    citationTargetId: string;
  }>;
  releaseComponents: Array<{
    ordinal: number;
    componentReleaseId: string;
    releaseVersion: string;
    protocol: string;
    controlledPath: string;
    releaseHash: string;
    releaseRawSha256: string | null;
    sha256sumsSha256: string | null;
    referenceKind: string | null;
    componentRole: string | null;
    componentBundleId: string | null;
    componentBundleDigest: string | null;
    componentManifestSha256: string | null;
    payload: unknown;
  }>;
  projectionIdentities: Array<{
    projectionId: string;
    ordinal: number;
    profile: string;
    projectionProfile: string;
    versionDigest: string;
    sourceRelease: string;
    sourceReleaseHash: string;
    sourceDatasetHash: string;
    nodeCount: number;
    linkCount: number;
    artifactPath: string;
    artifactSha256: string;
    isRuntime: boolean;
    bundleReceiptId: string | null;
  }>;
  linkMetadata: Array<{
    relationId: string;
    ordinal: number;
    releaseTier: string;
    sourceRelease: string;
    sourceReleaseHash: string;
    evidenceRefs: unknown;
    sourceComponentRelease: string | null;
    targetComponentRelease: string | null;
    relationComponentRelease: string | null;
    profiles: unknown;
    payload: unknown;
    bundleReceiptId: string | null;
  }>;
  /** Complete typed V2 evidence; absent for V1 and historical snapshots. */
  v2Evidence?: AuthoritativeV2Evidence;
}

/**
 * Manifest body without snapshotHash. Hashing this body yields snapshotHash.
 * Fields follow design.md: contract, release identity, counts, provenance,
 * lineage, and engineeringDigest of the serialized engineering body.
 */
export interface AuthoritySnapshotManifestBody {
  contract: typeof AUTHORITY_SNAPSHOT_CONTRACT;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  releaseVersion: string;
  protocol: string;
  schemaVersion: string | null;
  bundleDigest: string | null;
  sourceDatasetHash: string | null;
  projectionDigest: string | null;
  projectionId: string | null;
  predecessorReleaseId: string | null;
  importReceiptId: string | null;
  bundleReceiptId: string | null;
  deltaReceiptIds: string[];
  captureRevision: string | null;
  objectCount: number;
  relationCount: number;
  provenance: AuthorityProvenanceSummary;
  engineeringDigest: string;
}

export interface AuthoritySnapshotManifest extends AuthoritySnapshotManifestBody {
  snapshotId: string;
  snapshotHash: string;
  lifecycle: AuthoritySnapshotLifecycle;
}

export interface AuthorityCurrentPointer {
  contract: typeof AUTHORITY_CURRENT_POINTER_CONTRACT;
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId: string;
  activationReceiptId: string;
  activatedAt: string;
}

export interface AuthorityStageReceipt {
  contract: typeof AUTHORITY_STAGE_RECEIPT_CONTRACT;
  receiptId: string;
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId: string;
  stagedAt: string;
  status: 'staged' | 'rejected';
  /** Import/stage never mutates selectors. */
  selectorsChanged: 0;
  teachingSelectorsAdvanced: false;
  engineeringAuthorityAdvanced: false;
  reasons: string[];
}

export interface TeachingSelectorFingerprint {
  courseSelector: string | null;
  kaqSelector: string | null;
  pathSelector: string | null;
  teachingResourceRagSelector: string | null;
  legacySelector: string | null;
}

export interface AuthorityActivationReceipt {
  contract: typeof AUTHORITY_ACTIVATION_RECEIPT_CONTRACT;
  receiptId: string;
  snapshotId: string;
  snapshotHash: string;
  previousSnapshotId: string | null;
  previousSnapshotHash: string | null;
  activatedAt: string;
  status: 'activated' | 'failed';
  engineeringConsumersAdvanced: readonly ['engineering-graph', 'engineering-rag'] | [];
  teachingSelectorsAdvanced: false;
  teachingSelectorFingerprintBefore: TeachingSelectorFingerprint;
  teachingSelectorFingerprintAfter: TeachingSelectorFingerprint;
  teachingProjectionRequired: false;
  courseCoverageRequired: false;
  reasons: string[];
}

export interface AuthorityRollbackReceipt {
  contract: typeof AUTHORITY_ROLLBACK_RECEIPT_CONTRACT;
  receiptId: string;
  fromSnapshotId: string;
  fromSnapshotHash: string;
  toSnapshotId: string;
  toSnapshotHash: string;
  rolledBackAt: string;
  status: 'rolled-back' | 'failed';
  /** Prior snapshot directories remain immutable. */
  priorSnapshotPreserved: true;
  reasons: string[];
}

export interface MaterializedAuthoritySnapshot {
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  stageReceipt: AuthorityStageReceipt;
}

export class AuthoritySnapshotError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthoritySnapshotError';
    this.code = code;
  }
}

export function isSha256Hex(value: string | null | undefined): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

/** Canonical JSON for Authority Snapshot digests (sorted object keys, no spaces). */
export function authorityCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AuthoritySnapshotError(
        'non-deterministic-serialization',
        'canonical JSON cannot contain a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new AuthoritySnapshotError(
      'non-deterministic-serialization',
      'canonical JSON cannot contain bigint',
    );
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => authorityCanonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${authorityCanonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new AuthoritySnapshotError(
    'non-deterministic-serialization',
    'canonical JSON contains an unsupported value',
  );
}

export function authoritySha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function authorityDigest(value: unknown): string {
  return authoritySha256(authorityCanonicalJson(value));
}

export function snapshotIdFromHash(snapshotHash: string): string {
  if (!isSha256Hex(snapshotHash)) {
    throw new AuthoritySnapshotError(
      'hash-invalid',
      'snapshotHash must be 64 lowercase hexadecimal characters',
    );
  }
  return `snap-${snapshotHash}`;
}

function normalizePayload(payload: unknown): unknown {
  if (payload === undefined) return null;
  if (payload instanceof Date) return payload.toISOString();
  if (Array.isArray(payload)) return payload.map((item) => normalizePayload(item));
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = normalizePayload(record[key]);
    }
    return out;
  }
  return payload;
}

function assertV2EvidenceCounts(
  profileCount: number,
  labelCount: number,
  releaseId?: string,
): void {
  if (profileCount !== 3) {
    throw new AuthoritySnapshotError(
      'count-mismatch',
      `V2 evidence counts must be profiles=3, got ${profileCount}`,
    );
  }
  const expectedLabelCount = releaseId ? multilingualLabelCountForRelease(releaseId) : null;
  if (expectedLabelCount !== null) {
    if (labelCount !== expectedLabelCount) {
      throw new AuthoritySnapshotError(
        'count-mismatch',
        `V2 evidence counts must be profiles=3 and multilingualLabels=${expectedLabelCount}, got ${profileCount}/${labelCount}`,
      );
    }
    return;
  }
  if (labelCount <= 0) {
    throw new AuthoritySnapshotError(
      'count-mismatch',
      `V2 evidence counts must be profiles=3 and a recorded multilingual label set, got ${profileCount}/${labelCount}`,
    );
  }
}

function normalizeV2Evidence(
  value: AuthoritativeV2Evidence | null | undefined,
  expectedReleaseId?: string,
): AuthoritativeV2Evidence | undefined {
  if (!value) return undefined;
  if (value.protocol !== 'actkg-public-bundle/2') {
    throw new AuthoritySnapshotError('schema-invalid', 'V2 evidence protocol mismatch');
  }
  const profiles = [...value.profiles]
    .map((row) => ({
      ...row,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => left.profileKey.localeCompare(right.profileKey));
  const multilingualLabels = [...value.multilingualLabels]
    .map((row) => ({
      ...row,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => left.ordinal - right.ordinal || left.terminologyAssertionId.localeCompare(right.terminologyAssertionId));
  assertV2EvidenceCounts(
    profiles.length,
    multilingualLabels.length,
    expectedReleaseId ?? profiles[0]?.releaseId,
  );
  assertUniqueIds(profiles.map((row) => row.profileKey), 'V2 profiles');
  assertUniqueIds(profiles.map((row) => row.profileId), 'V2 profile IDs');
  assertUniqueIds(
    multilingualLabels.map((row) => row.terminologyAssertionId),
    'V2 terminology assertions',
  );
  for (const profile of profiles) {
    if (expectedReleaseId && profile.releaseId !== expectedReleaseId) {
      throw new AuthoritySnapshotError('identity-mismatch', `V2 profile ${profile.profileKey} release identity mismatch`);
    }
  }
  const labelOrdinals = new Set<number>();
  for (const label of multilingualLabels) {
    if (!Number.isInteger(label.ordinal) || label.ordinal < 0 || labelOrdinals.has(label.ordinal)) {
      throw new AuthoritySnapshotError('identity-mismatch', `V2 multilingual label ordinal ${label.ordinal} is invalid`);
    }
    if (expectedReleaseId && label.releaseId !== expectedReleaseId) {
      throw new AuthoritySnapshotError('identity-mismatch', `V2 multilingual label ${label.terminologyAssertionId} release identity mismatch`);
    }
    labelOrdinals.add(label.ordinal);
  }
  const binding = {
    ...value.admissionBinding,
    registryIdentity: normalizePayload(value.admissionBinding.registryIdentity),
    upstreamRepository: normalizePayload(value.admissionBinding.upstreamRepository),
    publicationRevision: normalizePayload(value.admissionBinding.publicationRevision),
    sourceRevision: normalizePayload(value.admissionBinding.sourceRevision),
    bundleIdentity: normalizePayload(value.admissionBinding.bundleIdentity),
  };
  const bindingPayload = {
    provenance: binding.provenance,
    verificationScope: binding.verificationScope,
    verifiedDuringLoad: binding.verifiedDuringLoad,
    registryIdentity: binding.registryIdentity,
    upstreamRepository: binding.upstreamRepository,
    publicationRevision: binding.publicationRevision,
    sourceRevision: binding.sourceRevision,
    bundleIdentity: binding.bundleIdentity,
  };
  if (binding.protocol !== 'actkg-public-bundle/2'
    || binding.provenance !== 'registry'
    || binding.verificationScope !== 'admission-time'
    || binding.verifiedDuringLoad !== false
    || !binding.releaseId
    || !binding.bundleReceiptId
    || (expectedReleaseId !== undefined && binding.releaseId !== expectedReleaseId)
    || authorityDigest(bindingPayload) !== binding.bindingDigest) {
    throw new AuthoritySnapshotError('hash-invalid', 'V2 admission binding is not digest-bound');
  }
  return {
    protocol: value.protocol,
    profiles,
    multilingualLabels,
    admissionBinding: binding,
  };
}

function assertUniqueIds(ids: string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || id.trim().length === 0) {
      throw new AuthoritySnapshotError('schema-invalid', `${label} contains an empty identity`);
    }
    if (seen.has(id)) {
      throw new AuthoritySnapshotError('duplicate-id', `${label} duplicates identity ${id}`);
    }
    seen.add(id);
  }
}

function assertRelationEndpoints(
  relations: AuthorityEngineeringRelation[],
  objectIds: Set<string>,
): void {
  for (const relation of relations) {
    if (!objectIds.has(relation.sourceId)) {
      throw new AuthoritySnapshotError(
        'missing-endpoint',
        `relation ${relation.relationId} source endpoint missing: ${relation.sourceId}`,
      );
    }
    if (!objectIds.has(relation.targetId)) {
      throw new AuthoritySnapshotError(
        'missing-endpoint',
        `relation ${relation.relationId} target endpoint missing: ${relation.targetId}`,
      );
    }
    if (!relation.relationType || relation.relationType.trim().length === 0) {
      throw new AuthoritySnapshotError(
        'schema-invalid',
        `relation ${relation.relationId} missing exact predicate`,
      );
    }
  }
}

export function buildAuthorityEngineeringBody(
  snapshot: AuthoritativeKnowledgeSnapshot,
): AuthorityEngineeringBody {
  // Prefer projection nodes/links for aggregate/standard Bundle candidates when
  // present; otherwise use authoritative object/relation tables.
  const projectionNodes = snapshot.projectionNodes ?? [];
  const projectionLinks = snapshot.projectionLinks ?? [];

  let objects: AuthorityEngineeringObject[];
  let relations: AuthorityEngineeringRelation[];

  if (projectionNodes.length > 0 || projectionLinks.length > 0) {
    objects = projectionNodes
      .map((node) => ({
        canonicalId: node.entityId,
        ordinal: node.ordinal,
        canonicalType: node.entityType,
        semanticName: node.semanticName ?? node.displayName ?? null,
        reviewStatus: node.reviewStatus ?? null,
        publicationStatus: node.publicationStatus ?? null,
        lifecycleStatus: null,
        payload: normalizePayload({
          nodeId: node.nodeId,
          entityId: node.entityId,
          entityType: node.entityType,
          displayName: node.displayName,
          releaseTier: node.releaseTier,
          candidate: node.candidate,
          sourceCoverageCount: node.sourceCoverageCount,
          payload: node.payload,
        }),
      }))
      .sort((left, right) => (
        left.ordinal - right.ordinal || left.canonicalId.localeCompare(right.canonicalId)
      ));
    relations = projectionLinks
      .map((link) => ({
        relationId: link.relationId,
        ordinal: link.ordinal,
        qualityTier: 'GOLD',
        sourceId: link.sourceId,
        targetId: link.targetId,
        relationType: link.relationType,
        reviewStatus: null,
        publicationStatus: null,
        direct: true,
        payload: normalizePayload({
          linkId: link.linkId,
          predicate: link.relationType,
          direction: link.direction,
          relationFamily: link.relationFamily,
          evidenceState: link.evidenceState,
          payload: link.payload,
        }),
      }))
      .sort((left, right) => (
        left.ordinal - right.ordinal || left.relationId.localeCompare(right.relationId)
      ));
  } else {
    objects = mapObjects(snapshot.objects);
    relations = mapRelations(snapshot.relations);
  }

  const sourceMappings = (snapshot.sourceMappings ?? [])
    .map((row: AuthoritativeSourceMappingRecord) => ({
      mappingId: row.mappingId,
      ordinal: row.ordinal,
      canonicalId: row.canonicalId,
      sourceObjectId: row.sourceObjectId,
      payload: normalizePayload({
        mappingType: row.mappingType,
        reviewStatus: row.reviewStatus,
        payload: row.payload,
      }),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.mappingId.localeCompare(right.mappingId)
    ));

  const sourceObjects = (snapshot.sourceObjects ?? [])
    .map((row: AuthoritativeSourceObjectRecord) => ({
      sourceObjectId: row.sourceObjectId,
      ordinal: row.ordinal,
      sourceKind: row.nodeType ?? row.sourceId ?? 'source',
      payload: normalizePayload({
        sourceId: row.sourceId,
        sectionId: row.sectionId,
        nodeType: row.nodeType,
        reviewStatus: row.reviewStatus,
        payload: row.payload,
      }),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal
      || left.sourceObjectId.localeCompare(right.sourceObjectId)
    ));

  const evidence = (snapshot.evidence ?? [])
    .map((row: AuthoritativeEvidenceRecord) => ({
      evidenceId: row.evidenceId,
      ordinal: row.ordinal,
      payload: normalizePayload({
        sourceEditionId: row.sourceEditionId,
        sectionId: row.sectionId,
        segmentOrdinal: row.segmentOrdinal,
        segmentType: row.segmentType,
        contentHash: row.contentHash,
        payload: row.payload,
      }),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.evidenceId.localeCompare(right.evidenceId)
    ));

  const releaseEntries = (snapshot.releaseEntries ?? [])
    .map((row) => ({
      entityId: row.entityId,
      ordinal: row.ordinal,
      releaseTier: row.releaseTier,
      entityRole: row.entityRole,
      inclusionReason: row.inclusionReason,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.entityId.localeCompare(right.entityId)
    ));

  const upstreamRagReferences = (snapshot.upstreamRagReferences ?? [])
    .map((row) => ({
      ordinal: row.ordinal,
      publishedEntityId: row.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal
      || left.publishedEntityId.localeCompare(right.publishedEntityId)
      || left.retrievalChunkId.localeCompare(right.retrievalChunkId)
      || left.citationTargetId.localeCompare(right.citationTargetId)
    ));

  const releaseComponents = (snapshot.releaseComponents ?? [])
    .map((row) => ({
      ordinal: row.ordinal,
      componentReleaseId: row.componentReleaseId,
      releaseVersion: row.releaseVersion,
      protocol: row.protocol,
      controlledPath: row.controlledPath,
      releaseHash: row.releaseHash,
      releaseRawSha256: row.releaseRawSha256,
      sha256sumsSha256: row.sha256sumsSha256,
      referenceKind: row.referenceKind ?? null,
      componentRole: row.componentRole ?? null,
      componentBundleId: row.componentBundleId ?? null,
      componentBundleDigest: row.componentBundleDigest ?? null,
      componentManifestSha256: row.componentManifestSha256 ?? null,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal
      || left.componentReleaseId.localeCompare(right.componentReleaseId)
    ));

  const projectionIdentities = (snapshot.projectionIdentities ?? [])
    .map((row) => ({
      projectionId: row.projectionId,
      ordinal: row.ordinal,
      profile: row.profile,
      projectionProfile: row.projectionProfile,
      versionDigest: row.versionDigest,
      sourceRelease: row.sourceRelease,
      sourceReleaseHash: row.sourceReleaseHash,
      sourceDatasetHash: row.sourceDatasetHash,
      nodeCount: row.nodeCount,
      linkCount: row.linkCount,
      artifactPath: row.artifactPath,
      artifactSha256: row.artifactSha256,
      isRuntime: row.isRuntime,
      bundleReceiptId: row.bundleReceiptId,
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.projectionId.localeCompare(right.projectionId)
    ));

  const linkMetadata = (snapshot.linkMetadata ?? [])
    .map((row) => ({
      relationId: row.relationId,
      ordinal: row.ordinal,
      releaseTier: row.releaseTier,
      sourceRelease: row.sourceRelease,
      sourceReleaseHash: row.sourceReleaseHash,
      evidenceRefs: normalizePayload(row.evidenceRefs),
      sourceComponentRelease: row.sourceComponentRelease,
      targetComponentRelease: row.targetComponentRelease,
      relationComponentRelease: row.relationComponentRelease,
      profiles: normalizePayload(row.profiles),
      payload: normalizePayload(row.payload),
      bundleReceiptId: row.bundleReceiptId,
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.relationId.localeCompare(right.relationId)
    ));

  const v2Evidence = normalizeV2Evidence(snapshot.v2Evidence, snapshot.release.id);

  return {
    objects,
    relations,
    sourceMappings,
    sourceObjects,
    evidence,
    releaseEntries,
    upstreamRagReferences,
    releaseComponents,
    projectionIdentities,
    linkMetadata,
    ...(v2Evidence ? { v2Evidence } : {}),
  };
}

/**
 * All non-empty capture revisions among caller override, bundle/import/release
 * receipts must agree. Silent override is forbidden; mismatch fails closed.
 */
export function resolveConsistentCaptureRevision(input: {
  captureRevision?: string | null;
  snapshot: AuthoritativeKnowledgeSnapshot;
}): string | null {
  const candidates: Array<{ source: string; value: string }> = [];
  const push = (source: string, value: string | null | undefined): void => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    candidates.push({ source, value: trimmed });
  };

  push('caller', input.captureRevision);
  push('bundleReceipt', input.snapshot.bundleReceipt?.captureRevision);
  push('importReceipt', input.snapshot.receipt?.captureRevision);
  push('release', input.snapshot.release?.captureRevision);

  if (candidates.length === 0) return null;

  const expected = candidates[0]!.value;
  for (const candidate of candidates) {
    if (candidate.value !== expected) {
      const detail = candidates
        .map((row) => `${row.source}=${row.value}`)
        .join(', ');
      throw new AuthoritySnapshotError(
        'capture-revision-mismatch',
        `capture revisions disagree among inputs: ${detail}`,
      );
    }
  }

  if (!GIT_COMMIT_SHA.test(expected)) {
    throw new AuthoritySnapshotError(
      'capture-revision-invalid',
      'captureRevision must be a 40-character lowercase Git SHA',
    );
  }
  return expected;
}

function mapObjects(rows: AuthoritativeObjectRecord[]): AuthorityEngineeringObject[] {
  return [...rows]
    .map((row) => ({
      canonicalId: row.canonicalId,
      ordinal: row.ordinal,
      canonicalType: row.canonicalType,
      semanticName: row.semanticName,
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      lifecycleStatus: row.lifecycleStatus,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.canonicalId.localeCompare(right.canonicalId)
    ));
}

function mapRelations(rows: AuthoritativeRelationRecord[]): AuthorityEngineeringRelation[] {
  return [...rows]
    .map((row) => ({
      relationId: row.relationId,
      ordinal: row.ordinal,
      qualityTier: row.qualityTier,
      sourceId: row.sourceId,
      targetId: row.targetId,
      relationType: row.relationType,
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      direct: row.direct,
      payload: normalizePayload(row.payload),
    }))
    .sort((left, right) => (
      left.ordinal - right.ordinal || left.relationId.localeCompare(right.relationId)
    ));
}

export interface MaterializeAuthoritySnapshotInput {
  snapshot: AuthoritativeKnowledgeSnapshot;
  deltaReceiptIds?: readonly string[];
  predecessorReleaseId?: string | null;
  stagedAt?: string;
  /** Optional capture override when receipt capture is absent. */
  captureRevision?: string | null;
}

export interface MaterializeAuthoritySnapshotResult {
  manifestBody: AuthoritySnapshotManifestBody;
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  engineeringBytes: string;
  manifestBytes: string;
  snapshotHash: string;
  snapshotId: string;
}

/**
 * Pure materialization: validates engineering integrity and produces a
 * deterministic manifest + engineering body without writing storage.
 */
export function materializeAuthoritySnapshot(
  input: MaterializeAuthoritySnapshotInput,
): MaterializeAuthoritySnapshotResult {
  const { snapshot } = input;
  if (!snapshot.release?.id || !snapshot.releaseSet?.id) {
    throw new AuthoritySnapshotError('schema-invalid', 'snapshot missing release identity');
  }
  if (!isSha256Hex(snapshot.release.releaseHash)) {
    throw new AuthoritySnapshotError('hash-invalid', 'release.releaseHash is not a SHA-256 hex digest');
  }

  const engineering = buildAuthorityEngineeringBody(snapshot);
  assertUniqueIds(engineering.objects.map((row) => row.canonicalId), 'objects');
  assertUniqueIds(engineering.relations.map((row) => row.relationId), 'relations');
  const objectIds = new Set(engineering.objects.map((row) => row.canonicalId));
  assertRelationEndpoints(engineering.relations, objectIds);

  // Fail closed if materialization would drop typed engineering data that the
  // repository snapshot claimed via receipt counts (when present).
  if (snapshot.receipt) {
    const objectCount = engineering.objects.length;
    if (
      typeof snapshot.receipt.objectCount === 'number'
      && snapshot.receipt.objectCount > 0
      && objectCount === 0
      && (snapshot.objects?.length ?? 0) > 0
    ) {
      throw new AuthoritySnapshotError(
        'lossy-snapshot',
        'snapshot normalization omitted authoritative objects',
      );
    }
  }

  assertUniqueIds(engineering.releaseEntries.map((row) => row.entityId), 'releaseEntries');
  assertUniqueIds(
    engineering.projectionIdentities.map((row) => row.projectionId),
    'projectionIdentities',
  );
  assertUniqueIds(
    engineering.releaseComponents.map((row) => row.componentReleaseId),
    'releaseComponents',
  );
  assertUniqueIds(engineering.linkMetadata.map((row) => row.relationId), 'linkMetadata');
  assertUniqueIds(
    engineering.upstreamRagReferences.map(
      (row) => `${row.publishedEntityId}\0${row.retrievalChunkId}\0${row.citationTargetId}`,
    ),
    'upstreamRagReferences',
  );
  const engineeringDigest = authorityDigest(engineering);
  const captureRevision = resolveConsistentCaptureRevision({
    captureRevision: input.captureRevision,
    snapshot,
  });
  const provenance: AuthorityProvenanceSummary = {
    sourceMappingCount: engineering.sourceMappings.length,
    sourceObjectCount: engineering.sourceObjects.length,
    evidenceSegmentCount: engineering.evidence.length,
    releaseEntryCount: engineering.releaseEntries.length,
    upstreamRagReferenceCount: engineering.upstreamRagReferences.length,
    releaseComponentCount: engineering.releaseComponents.length,
    projectionIdentityCount: engineering.projectionIdentities.length,
    linkMetadataCount: engineering.linkMetadata.length,
    importReceiptId: snapshot.receipt?.id ?? null,
    bundleReceiptId: snapshot.bundleReceipt?.id ?? null,
    bundleId: snapshot.bundleReceipt?.bundleId ?? null,
    captureRevision,
    lockRawHash:
      snapshot.bundleReceipt?.lockRawSha256
      ?? snapshot.receipt?.lockRawHash
      ?? snapshot.release.lockRawHash
      ?? null,
    ...(engineering.v2Evidence
      ? {
          v2ProfileCount: engineering.v2Evidence.profiles.length,
          v2MultilingualLabelCount: engineering.v2Evidence.multilingualLabels.length,
          v2AdmissionBindingDigest: engineering.v2Evidence.admissionBinding.bindingDigest,
        }
      : {}),
  };

  const deltaReceiptIds = [...new Set(input.deltaReceiptIds ?? [])].sort();
  const manifestBody: AuthoritySnapshotManifestBody = {
    contract: AUTHORITY_SNAPSHOT_CONTRACT,
    releaseSetId: snapshot.releaseSet.id,
    releaseId: snapshot.release.id,
    releaseHash: snapshot.release.releaseHash,
    releaseVersion: snapshot.release.releaseVersion,
    protocol: snapshot.release.protocol,
    schemaVersion: snapshot.release.schemaVersion ?? null,
    bundleDigest: snapshot.bundleReceipt?.bundleDigest ?? null,
    sourceDatasetHash: snapshot.release.sourceDatasetHash ?? null,
    projectionDigest: snapshot.release.projectionDigest ?? null,
    projectionId: snapshot.release.projectionId ?? null,
    predecessorReleaseId: input.predecessorReleaseId ?? null,
    importReceiptId: snapshot.receipt?.id ?? null,
    bundleReceiptId: snapshot.bundleReceipt?.id ?? null,
    deltaReceiptIds,
    captureRevision: provenance.captureRevision,
    objectCount: engineering.objects.length,
    relationCount: engineering.relations.length,
    provenance,
    engineeringDigest,
  };

  const snapshotHash = authorityDigest(manifestBody);
  const snapshotId = snapshotIdFromHash(snapshotHash);
  const manifest: AuthoritySnapshotManifest = {
    ...manifestBody,
    snapshotId,
    snapshotHash,
    lifecycle: 'staged',
  };

  return {
    manifestBody,
    manifest,
    engineering,
    engineeringBytes: `${authorityCanonicalJson(engineering)}\n`,
    manifestBytes: `${authorityCanonicalJson(manifest)}\n`,
    snapshotHash,
    snapshotId,
  };
}

export function verifyMaterializedSnapshot(input: {
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
}): void {
  const { manifest, engineering } = input;
  if (manifest.contract !== AUTHORITY_SNAPSHOT_CONTRACT) {
    throw new AuthoritySnapshotError('schema-invalid', 'manifest contract mismatch');
  }
  if (!isSha256Hex(manifest.snapshotHash)) {
    throw new AuthoritySnapshotError('hash-invalid', 'manifest snapshotHash invalid');
  }
  if (manifest.snapshotId !== snapshotIdFromHash(manifest.snapshotHash)) {
    throw new AuthoritySnapshotError('hash-invalid', 'snapshotId does not match snapshotHash');
  }

  assertUniqueIds(engineering.objects.map((row) => row.canonicalId), 'objects');
  assertUniqueIds(engineering.relations.map((row) => row.relationId), 'relations');
  assertRelationEndpoints(
    engineering.relations,
    new Set(engineering.objects.map((row) => row.canonicalId)),
  );
  assertUniqueIds(engineering.releaseEntries.map((row) => row.entityId), 'releaseEntries');
  assertUniqueIds(
    engineering.projectionIdentities.map((row) => row.projectionId),
    'projectionIdentities',
  );
  assertUniqueIds(
    engineering.releaseComponents.map((row) => row.componentReleaseId),
    'releaseComponents',
  );
  assertUniqueIds(engineering.linkMetadata.map((row) => row.relationId), 'linkMetadata');
  assertUniqueIds(
    engineering.upstreamRagReferences.map(
      (row) => `${row.publishedEntityId}\0${row.retrievalChunkId}\0${row.citationTargetId}`,
    ),
    'upstreamRagReferences',
  );

  const normalizedV2Evidence = normalizeV2Evidence(engineering.v2Evidence, manifest.releaseId);
  if (normalizedV2Evidence) {
    if (authorityCanonicalJson(normalizedV2Evidence) !== authorityCanonicalJson(engineering.v2Evidence)) {
      throw new AuthoritySnapshotError('hash-invalid', 'V2 evidence is not canonically normalized');
    }
    if (manifest.provenance.v2ProfileCount !== normalizedV2Evidence.profiles.length
      || manifest.provenance.v2MultilingualLabelCount !== normalizedV2Evidence.multilingualLabels.length
      || manifest.provenance.v2AdmissionBindingDigest !== normalizedV2Evidence.admissionBinding.bindingDigest) {
      throw new AuthoritySnapshotError('count-mismatch', 'manifest V2 evidence summary does not match engineering body');
    }
  } else if (manifest.provenance.v2ProfileCount !== undefined
    || manifest.provenance.v2MultilingualLabelCount !== undefined
    || manifest.provenance.v2AdmissionBindingDigest !== undefined) {
    throw new AuthoritySnapshotError('count-mismatch', 'manifest declares V2 evidence without an engineering body');
  }

  const engineeringDigest = authorityDigest(engineering);
  if (engineeringDigest !== manifest.engineeringDigest) {
    throw new AuthoritySnapshotError(
      'hash-invalid',
      'engineeringDigest does not match engineering body',
    );
  }
  if (
    engineering.objects.length !== manifest.objectCount
    || engineering.relations.length !== manifest.relationCount
  ) {
    throw new AuthoritySnapshotError(
      'count-mismatch',
      'manifest object/relation counts do not match engineering body',
    );
  }
  const provenance = manifest.provenance;
  if (
    engineering.releaseEntries.length !== provenance.releaseEntryCount
    || engineering.upstreamRagReferences.length !== provenance.upstreamRagReferenceCount
    || engineering.releaseComponents.length !== provenance.releaseComponentCount
    || engineering.projectionIdentities.length !== provenance.projectionIdentityCount
    || engineering.linkMetadata.length !== provenance.linkMetadataCount
  ) {
    throw new AuthoritySnapshotError(
      'count-mismatch',
      'manifest provenance semantic-set counts do not match engineering body',
    );
  }

  const body: AuthoritySnapshotManifestBody = {
    contract: manifest.contract,
    releaseSetId: manifest.releaseSetId,
    releaseId: manifest.releaseId,
    releaseHash: manifest.releaseHash,
    releaseVersion: manifest.releaseVersion,
    protocol: manifest.protocol,
    schemaVersion: manifest.schemaVersion,
    bundleDigest: manifest.bundleDigest,
    sourceDatasetHash: manifest.sourceDatasetHash,
    projectionDigest: manifest.projectionDigest,
    projectionId: manifest.projectionId,
    predecessorReleaseId: manifest.predecessorReleaseId,
    importReceiptId: manifest.importReceiptId,
    bundleReceiptId: manifest.bundleReceiptId,
    deltaReceiptIds: [...manifest.deltaReceiptIds].sort(),
    captureRevision: manifest.captureRevision,
    objectCount: manifest.objectCount,
    relationCount: manifest.relationCount,
    provenance: manifest.provenance,
    engineeringDigest: manifest.engineeringDigest,
  };
  const recomputed = authorityDigest(body);
  if (recomputed !== manifest.snapshotHash) {
    throw new AuthoritySnapshotError(
      'hash-invalid',
      'snapshotHash does not match recomputed manifest body digest',
    );
  }
}

export function emptyTeachingSelectorFingerprint(): TeachingSelectorFingerprint {
  return {
    courseSelector: null,
    kaqSelector: null,
    pathSelector: null,
    teachingResourceRagSelector: null,
    legacySelector: null,
  };
}

export function teachingSelectorsEqual(
  left: TeachingSelectorFingerprint,
  right: TeachingSelectorFingerprint,
): boolean {
  return authorityCanonicalJson(left) === authorityCanonicalJson(right);
}

/** Convert a materialized engineering snapshot into a Repository-shaped view. */
export function authoritySnapshotToRepositoryView(input: {
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  authorityState: 'candidate' | 'active';
}): AuthoritativeKnowledgeSnapshot {
  const { manifest, engineering, authorityState } = input;
  return {
    authorityState,
    productionAuthoritative: false,
    historical: false,
    releaseSet: {
      id: manifest.releaseSetId,
      controlledPath: `authority/releases/${manifest.snapshotId}`,
      lockVersion: AUTHORITY_SNAPSHOT_CONTRACT,
      candidateState: authorityState === 'active' ? 'ACTIVE_AUTHORITY' : 'STAGED',
    },
    release: {
      id: manifest.releaseId,
      releaseSetId: manifest.releaseSetId,
      releaseVersion: manifest.releaseVersion,
      releaseStatus: 'RELEASED',
      protocol: manifest.protocol,
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: manifest.releaseHash,
      releaseHash: manifest.releaseHash,
      schemaRawHash: manifest.releaseHash,
      releaseRawHash: manifest.releaseHash,
      notesRawHash: manifest.releaseHash,
      captureRevision: manifest.captureRevision ?? '0'.repeat(40),
      lockRawHash: manifest.provenance.lockRawHash ?? manifest.releaseHash,
      schemaVersion: manifest.schemaVersion,
      projectionId: manifest.projectionId,
      projectionDigest: manifest.projectionDigest,
      sourceDatasetHash: manifest.sourceDatasetHash,
    },
    receipt: manifest.importReceiptId
      ? {
          id: manifest.importReceiptId,
          releaseSetId: manifest.releaseSetId,
          releaseId: manifest.releaseId,
          sourceRun: 'authority-snapshot',
          sourceImplementationCommit: manifest.captureRevision ?? '0'.repeat(40),
          captureRevision: manifest.captureRevision ?? '0'.repeat(40),
          lockRawHash: manifest.provenance.lockRawHash ?? manifest.releaseHash,
          ctkgDatasetAvailability: 'UNAVAILABLE',
          ctkgDatasetHash: null,
          ctkgDatasetPublicationIdentity: null,
          ctkgDatasetResolvableLocation: null,
          revisionRegistryAvailability: 'UNAVAILABLE',
          revisionRegistryVersion: null,
          revisionRegistryHash: null,
          objectCount: manifest.objectCount,
          sourceMappingCount: engineering.sourceMappings.length,
          goldRelationCount: engineering.relations.filter((row) => row.qualityTier === 'GOLD').length,
          silverRelationCount: engineering.relations.filter((row) => row.qualityTier === 'SILVER').length,
          sourceObjectCount: engineering.sourceObjects.length,
          evidenceSegmentCount: engineering.evidence.length,
          candidateState: authorityState === 'active' ? 'ACTIVE_AUTHORITY' : 'STAGED',
          importedAt: new Date(0),
        }
      : null,
    objects: engineering.objects.map((row) => ({
      releaseId: manifest.releaseId,
      canonicalId: row.canonicalId,
      ordinal: row.ordinal,
      canonicalType: row.canonicalType,
      semanticName: row.semanticName,
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      lifecycleStatus: row.lifecycleStatus,
      payload: row.payload,
    })),
    relations: engineering.relations.map((row) => ({
      releaseId: manifest.releaseId,
      relationId: row.relationId,
      ordinal: row.ordinal,
      qualityTier: row.qualityTier,
      sourceId: row.sourceId,
      targetId: row.targetId,
      relationType: row.relationType,
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      direct: row.direct,
      payload: row.payload,
    })),
    sourceMappings: engineering.sourceMappings.map((row) => ({
      releaseId: manifest.releaseId,
      mappingId: row.mappingId,
      ordinal: row.ordinal,
      canonicalId: row.canonicalId,
      sourceObjectId: row.sourceObjectId,
      mappingType: 'authority-snapshot',
      reviewStatus: null,
      payload: row.payload,
    })),
    sourceObjects: engineering.sourceObjects.map((row) => ({
      releaseId: manifest.releaseId,
      sourceObjectId: row.sourceObjectId,
      ordinal: row.ordinal,
      sourceId: null,
      sectionId: null,
      nodeType: row.sourceKind,
      reviewStatus: null,
      payload: row.payload,
    })),
    evidence: engineering.evidence.map((row) => ({
      releaseId: manifest.releaseId,
      evidenceId: row.evidenceId,
      ordinal: row.ordinal,
      sourceEditionId: 'authority-snapshot',
      sectionId: 'authority-snapshot',
      segmentOrdinal: row.ordinal,
      segmentType: 'authority-snapshot',
      contentHash: manifest.snapshotHash,
      payload: row.payload,
    })),
    releaseEntries: engineering.releaseEntries.map((row) => ({
      releaseId: manifest.releaseId,
      entityId: row.entityId,
      ordinal: row.ordinal,
      releaseTier: row.releaseTier,
      entityRole: row.entityRole,
      inclusionReason: row.inclusionReason,
      payload: row.payload,
    })),
    upstreamRagReferences: engineering.upstreamRagReferences.map((row) => ({
      releaseId: manifest.releaseId,
      ordinal: row.ordinal,
      publishedEntityId: row.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
    })),
    releaseComponents: engineering.releaseComponents.map((row) => ({
      releaseId: manifest.releaseId,
      ordinal: row.ordinal,
      componentReleaseId: row.componentReleaseId,
      releaseVersion: row.releaseVersion,
      protocol: row.protocol,
      controlledPath: row.controlledPath,
      releaseHash: row.releaseHash,
      releaseRawSha256: row.releaseRawSha256,
      sha256sumsSha256: row.sha256sumsSha256,
      referenceKind: row.referenceKind,
      componentRole: row.componentRole,
      componentBundleId: row.componentBundleId,
      componentBundleDigest: row.componentBundleDigest,
      componentManifestSha256: row.componentManifestSha256,
      payload: row.payload,
    })),
    projectionIdentities: engineering.projectionIdentities.map((row) => ({
      releaseId: manifest.releaseId,
      projectionId: row.projectionId,
      ordinal: row.ordinal,
      profile: row.profile,
      projectionProfile: row.projectionProfile,
      versionDigest: row.versionDigest,
      sourceRelease: row.sourceRelease,
      sourceReleaseHash: row.sourceReleaseHash,
      sourceDatasetHash: row.sourceDatasetHash,
      nodeCount: row.nodeCount,
      linkCount: row.linkCount,
      artifactPath: row.artifactPath,
      artifactSha256: row.artifactSha256,
      isRuntime: row.isRuntime,
      bundleReceiptId: row.bundleReceiptId,
    })),
    linkMetadata: engineering.linkMetadata.map((row) => ({
      releaseId: manifest.releaseId,
      relationId: row.relationId,
      ordinal: row.ordinal,
      releaseTier: row.releaseTier,
      sourceRelease: row.sourceRelease,
      sourceReleaseHash: row.sourceReleaseHash,
      evidenceRefs: row.evidenceRefs,
      sourceComponentRelease: row.sourceComponentRelease,
      targetComponentRelease: row.targetComponentRelease,
      relationComponentRelease: row.relationComponentRelease,
      profiles: row.profiles,
      payload: row.payload,
      bundleReceiptId: row.bundleReceiptId,
    })),
    ...(engineering.v2Evidence ? { v2Evidence: engineering.v2Evidence } : {}),
    bundleReceipt: manifest.bundleDigest && manifest.bundleReceiptId
      ? {
          id: manifest.bundleReceiptId,
          bundleId: manifest.provenance.bundleId ?? manifest.bundleReceiptId,
          bundleRevision: 1,
          bundleDigest: manifest.bundleDigest,
          bundleKind: 'public',
          releaseStage: 'stable',
          bundleContractVersion: manifest.protocol === STANDARD_PUBLIC_BUNDLE_V2_PROTOCOL
            ? STANDARD_PUBLIC_BUNDLE_V2_PROTOCOL
            : 'actkg-public-bundle/1',
          controlledPath: `authority/releases/${manifest.snapshotId}`,
          manifestRawSha256: manifest.snapshotHash,
          normalization: 'authority-snapshot/v1',
          publicationTag: manifest.releaseVersion,
          sourceCommit: manifest.captureRevision ?? '0'.repeat(40),
          sourceTag: manifest.releaseVersion,
          releaseSetId: manifest.releaseSetId,
          releaseId: manifest.releaseId,
          releaseHash: manifest.releaseHash,
          sourceDatasetHash: manifest.sourceDatasetHash ?? manifest.releaseHash,
          schemaVersion: manifest.schemaVersion ?? '0.0.0',
          schemaRawSha256: manifest.releaseHash,
          lockVersion: AUTHORITY_SNAPSHOT_CONTRACT,
          lockPath: `authority/releases/${manifest.snapshotId}/manifest.json`,
          lockRawSha256: manifest.provenance.lockRawHash ?? manifest.releaseHash,
          captureRevision: manifest.captureRevision ?? '0'.repeat(40),
          candidateState: 'ACCEPTED_CANDIDATE',
          compatibilityCode: 'compatible',
          runtimeProjectionId: manifest.projectionId ?? 'runtime',
          runtimeProjectionProfile: 'runtime',
          runtimeProjectionDigest: manifest.projectionDigest ?? manifest.releaseHash,
          artifactCount: 0,
          statistics: {},
          importedAt: new Date(0),
        }
      : null,
  };
}

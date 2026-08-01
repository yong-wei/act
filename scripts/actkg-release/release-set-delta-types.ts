/**
 * ACT-owned ReleaseSet Delta contracts (#1132).
 *
 * Calculation authority is always the pair of verified database snapshots.
 * Upstream actkg-release-diff/1 is cross-check evidence only.
 */

export const RELEASE_SET_DELTA_ALGORITHM_VERSION = 'actkg-release-set-delta/1' as const;
export const UPSTREAM_RELEASE_DIFF_CONTRACT = 'actkg-release-diff/1' as const;

export type DeltaClassification =
  | 'BASELINE'
  | 'SEMANTIC_CONTENT_UPDATE'
  | 'COMPATIBLE_PACKAGING_REVISION';

export type DeltaAuthorizationState =
  | 'ACCEPTED'
  | 'REJECTED_IDENTITY'
  | 'REJECTED_UPSTREAM';

export type DeltaEvidenceKind = 'none' | 'exact_import' | 'standard_bundle';

export type UpstreamCrosscheckStatus =
  | 'NOT_REQUIRED'
  | 'AGREED'
  | 'DISAGREED'
  | 'PARSE_FAILED';

export type DeltaSignalScope =
  | 'object'
  | 'relation'
  | 'crosswalk'
  | 'component'
  | 'projection'
  | 'vocabulary';

export type DeltaSignalAction = 'candidate' | 'invalidation';

export type DeltaSignalReason =
  | 'added'
  | 'removed'
  | 'payload_changed'
  | 'type_changed'
  | 'tier_changed'
  | 'superseded'
  | 'predicate_changed'
  | 'direction_changed'
  | 'endpoint_changed'
  | 'digest_changed'
  | 'profile_added'
  | 'profile_removed'
  | 'changed';

export type JsonObject = Record<string, unknown>;

/** Stable object identity used for delta comparison (Canonical ID). */
export interface DeltaObjectRecord {
  canonicalId: string;
  canonicalType: string;
  releaseTier: string;
  semanticName: string | null;
  displayName: string | null;
  /** Material identity fingerprint over hard identity fields (type + semanticName). */
  materialIdentityDigest: string;
  /** Full payload digest for payload_changed detection. */
  payloadDigest: string;
  /** Declared supersession target Canonical ID, when present. */
  supersedes: string | null;
}

/** Stable relation identity used for delta comparison. */
export interface DeltaRelationRecord {
  relationId: string;
  predicate: string;
  direction: string;
  releaseTier: string;
  sourceId: string;
  targetId: string;
  /** Full payload digest for non-identity field changes. */
  payloadDigest: string;
}

export interface DeltaCrosswalkRecord {
  tripleKey: string;
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}

export interface DeltaComponentRecord {
  componentReleaseId: string;
  releaseHash: string;
  protocol: string;
  referenceKind: string | null;
  payloadDigest: string;
}

export interface DeltaProjectionRecord {
  profile: string;
  projectionId: string;
  versionDigest: string;
  isRuntime: boolean;
}

export interface DeltaVocabulary {
  objectTypes: string[];
  predicates: string[];
}

export interface DeltaSemanticSnapshot {
  releaseSetId: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  protocol: string;
  runtimeProjectionId: string | null;
  runtimeProjectionDigest: string | null;
  /** Deterministic digest over all semantic collections used for packaging short-circuit. */
  semanticCollectionDigest: string;
  objects: DeltaObjectRecord[];
  relations: DeltaRelationRecord[];
  crosswalk: DeltaCrosswalkRecord[];
  components: DeltaComponentRecord[];
  projections: DeltaProjectionRecord[];
  vocabulary: DeltaVocabulary;
}

/**
 * Fully stable evidence identity for naturalKey / inputDigest / receipt binding.
 */
export interface DeltaEvidenceRef {
  kind: DeltaEvidenceKind;
  releaseSetId: string | null;
  releaseId: string | null;
  releaseVersion: string | null;
  releaseHash: string | null;
  sourceDatasetHash: string | null;
  importReceiptId: string | null;
  bundleReceiptId: string | null;
  bundleId: string | null;
  bundleRevision: number | null;
  bundleDigest: string | null;
  runtimeProjectionId: string | null;
  runtimeProjectionDigest: string | null;
  /** Capture revision of the base/candidate evidence itself (import/bundle). */
  evidenceCaptureRevision: string | null;
  protocol: string | null;
  acceptedAt: string | null;
  /** Semantic collection digest of the bound snapshot when available. */
  semanticSnapshotDigest: string | null;
}

export interface ObjectDeltaChanges {
  added: string[];
  removed: string[];
  payloadChanged: string[];
  typeChanged: string[];
  tierChanged: string[];
  superseded: Array<{ from: string; to: string }>;
}

export interface RelationDeltaChanges {
  added: string[];
  removed: string[];
  predicateChanged: string[];
  directionChanged: string[];
  tierChanged: string[];
  endpointChanged: string[];
}

export interface CrosswalkDeltaChanges {
  added: string[];
  removed: string[];
}

export interface ComponentDeltaChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface ProjectionDeltaChanges {
  addedProfiles: string[];
  removedProfiles: string[];
  digestChanged: Array<{ profile: string; baseDigest: string; candidateDigest: string }>;
}

export interface VocabularyDeltaChanges {
  addedTypes: string[];
  addedPredicates: string[];
  removedTypes: string[];
  removedPredicates: string[];
}

export interface ReleaseSetDeltaDetails {
  objects: ObjectDeltaChanges;
  relations: RelationDeltaChanges;
  crosswalk: CrosswalkDeltaChanges;
  components: ComponentDeltaChanges;
  projections: ProjectionDeltaChanges;
  vocabulary: VocabularyDeltaChanges;
}

export interface ReleaseSetDeltaSummary {
  objectAdded: number;
  objectRemoved: number;
  objectPayloadChanged: number;
  objectTypeChanged: number;
  objectTierChanged: number;
  objectSuperseded: number;
  relationAdded: number;
  relationRemoved: number;
  relationPredicateChanged: number;
  relationDirectionChanged: number;
  relationTierChanged: number;
  relationEndpointChanged: number;
  crosswalkAdded: number;
  crosswalkRemoved: number;
  componentAdded: number;
  componentRemoved: number;
  componentChanged: number;
  projectionProfileAdded: number;
  projectionProfileRemoved: number;
  projectionDigestChanged: number;
  vocabularyTypeAdded: number;
  vocabularyPredicateAdded: number;
  vocabularyTypeRemoved: number;
  vocabularyPredicateRemoved: number;
  signalCount: number;
}

/** Allowed digests keys on generic signals (structural whitelist). */
export type DeltaSignalDigestKey =
  | 'replacement'
  | 'predecessor'
  | 'baseDigest'
  | 'candidateDigest';

export interface DeltaSignalRecord {
  scope: DeltaSignalScope;
  identity: string;
  action: DeltaSignalAction;
  reason: DeltaSignalReason;
  digests?: Partial<Record<DeltaSignalDigestKey, string>>;
  signalDigest: string;
}

export interface UpstreamReleaseDiffV1 {
  contractVersion: typeof UPSTREAM_RELEASE_DIFF_CONTRACT;
  baseRelease: { releaseId: string; releaseVersion: string; releaseHash: string };
  targetRelease: { releaseId: string; releaseVersion: string; releaseHash: string };
  objects: { added: string[]; removed: string[]; changed: string[] };
  relations: { added: string[]; removed: string[]; changed: string[] };
  crosswalk: { addedCount: number; removedCount: number };
  components: { added: string[]; removed: string[] };
}

export interface UpstreamCrosscheckResult {
  status: UpstreamCrosscheckStatus;
  details: JsonObject;
}

export interface IdentityIntegrityViolation {
  code:
    | 'canonical_type_replacement'
    | 'material_identity_replacement'
    | 'relation_endpoint_replacement'
    | 'relation_direction_replacement';
  identity: string;
  message: string;
}

export interface ComputedReleaseSetDelta {
  classification: DeltaClassification;
  authorizationState: DeltaAuthorizationState;
  algorithmVersion: typeof RELEASE_SET_DELTA_ALGORITHM_VERSION;
  baseEvidence: DeltaEvidenceRef;
  candidateEvidence: DeltaEvidenceRef;
  baseSemanticSnapshotDigest: string | null;
  candidateSemanticSnapshotDigest: string;
  details: ReleaseSetDeltaDetails;
  summary: ReleaseSetDeltaSummary;
  signals: DeltaSignalRecord[];
  inputDigest: string;
  outputDigest: string;
  naturalKey: string;
  upstream: UpstreamCrosscheckResult;
  identityViolations: IdentityIntegrityViolation[];
  /** Trusted ACT delta implementation capture revision (Git HEAD). */
  captureRevision: string;
}

export interface PersistedDeltaReceiptResult {
  mode: 'created' | 'idempotent' | 'verify-only';
  receiptId: string;
  classification: DeltaClassification;
  authorizationState: DeltaAuthorizationState;
  inputDigest: string;
  outputDigest: string;
  naturalKey: string;
  signalCount: number;
  upstreamCrosscheckStatus: UpstreamCrosscheckStatus;
  selectorsUnchanged: true;
}

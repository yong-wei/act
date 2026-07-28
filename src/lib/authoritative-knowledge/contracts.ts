export type AuthorityState = 'candidate' | 'active' | 'legacy';

// Pinned CTKG 0.2 aggregate identity. The aggregate ReleaseSet is the sole
// current candidate; every prior ReleaseSet is returned as historical only.
// Values mirror the ingestion adapter in
// scripts/actkg-release/ctkg-0-2-aggregate-release.ts and are drift-guarded by
// the Repository test suite.
export const CURRENT_AGGREGATE_RELEASE_SET_ID = 'actkg-authoritative-candidate-v2';
export const CURRENT_AGGREGATE_RELEASE_ID = 'control-theory-engineering-v0.2';
export const CTKG_0_2_AGGREGATE_PROTOCOL = 'ctkg-0.2-aggregate-engineering-release-v1';
export const CTKG_0_2_SCHEMA_VERSION = '0.2.0';
export const HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID = 'actkg-authoritative-candidate-v1';

// Pinned GraphProjection V2 consumer contract vocabularies, vendored from the
// locked CTKG 0.2.0 Schema (SHA-256
// 3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de).
export const CTKG_0_2_PROJECTED_ENTITY_TYPES = [
  'DomainConcept',
  'Formula',
  'KnowledgeStatement',
  'SystemModel',
  'ModelRepresentation',
] as const;
export const CTKG_0_2_RELATION_TYPES = [
  'contains',
  'prerequisite',
  'association',
  'part_of',
  'refers_to',
  'mentions',
  'has_representation',
  'has_component',
  'has_formula',
  'derived_from',
  'applies_to',
  'used_to_analyze',
  'is_a',
] as const;
export const CTKG_0_2_PROJECTION_DIRECTIONS = [
  'parent_to_child',
  'earlier_to_later',
  'source_to_target',
  'unordered',
] as const;
export const CTKG_0_2_RELATION_FAMILIES = [
  'domain_semantic',
  'source_organization',
  'course_sequence',
  'resource_alignment',
] as const;

// Pinned CTKG 0.2 predicate → direction → relation_family contract for the
// aggregate domain projection. Closed table over the nine predicates carried
// by the locked bundle: association is unordered, every other predicate is
// source_to_target, and every link is domain_semantic. A link whose fields are
// individually legal enum values but whose combination is absent from this
// table (including Schema-legal predicates outside the nine) violates the
// contract and must fail closed at both import admission and runtime
// projection loading.
export const CTKG_0_2_RELATION_SEMANTIC_CONTRACT = {
  applies_to: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  association: { direction: 'unordered', relationFamily: 'domain_semantic' },
  derived_from: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  has_component: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  has_formula: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  has_representation: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  is_a: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  part_of: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
  used_to_analyze: { direction: 'source_to_target', relationFamily: 'domain_semantic' },
} as const;
export const CTKG_0_2_EVIDENCE_STATES = [
  'available',
  'unavailable',
] as const;
export const CTKG_0_2_RELEASE_TIERS = [
  'gold',
  'silver',
  'support',
] as const;

export function isAggregateReleaseProtocol(protocol: string): boolean {
  return protocol === CTKG_0_2_AGGREGATE_PROTOCOL;
}

export type AuthoritySelector =
  | {
      authorityState: 'candidate';
      releaseSetId: string;
      releaseId: string;
    }
  | {
      authorityState: 'active';
    }
  | {
      authorityState: 'legacy';
    };

export type KnowledgeRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type RepositoryUnavailableReason =
  | 'candidate-not-found'
  | 'active-pointer-unavailable'
  | 'legacy-outside-repository'
  | 'role-forbidden'
  | 'node-not-found';

export interface RepositoryDiagnostic {
  code:
    | 'candidate-state-mismatch'
    | 'release-set-identity-mismatch'
    | 'release-identity-mismatch'
    | 'receipt-missing'
    | 'receipt-identity-mismatch'
    | 'receipt-count-mismatch'
    | 'capture-revision-mismatch'
    | 'capture-revision-invalid'
    | 'lock-hash-mismatch'
    | 'hash-invalid';
  field: string;
  expected: string | number;
  actual: string | number | null;
}

export interface AuthoritativeReleaseSetRecord {
  id: string;
  controlledPath: string;
  lockVersion: string;
  candidateState: string;
}

export interface AuthoritativeReleaseRecord {
  id: string;
  releaseSetId: string;
  releaseVersion: string;
  releaseStatus: string;
  protocol: string;
  authority: string;
  scope: string;
  contractHash: string;
  releaseHash: string;
  schemaRawHash: string;
  releaseRawHash: string;
  notesRawHash: string;
  captureRevision: string;
  lockRawHash: string;
  // CTKG 0.2 aggregate identity. Absent for historical CTKG 0.1 releases.
  schemaVersion?: string | null;
  upstreamReleaseId?: string | null;
  projectionId?: string | null;
  projectionDigest?: string | null;
  sourceDatasetHash?: string | null;
  upstreamPublicationCommit?: string | null;
  upstreamClosedCommit?: string | null;
}

export interface AuthoritativeObjectRecord {
  releaseId: string;
  canonicalId: string;
  ordinal: number;
  canonicalType: string;
  semanticName: string | null;
  reviewStatus: string | null;
  publicationStatus: string | null;
  lifecycleStatus: string | null;
  payload: unknown;
}

export interface AuthoritativeRelationRecord {
  releaseId: string;
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

export interface AuthoritativeSourceObjectRecord {
  releaseId: string;
  sourceObjectId: string;
  ordinal: number;
  sourceId: string | null;
  sectionId: string | null;
  nodeType: string | null;
  reviewStatus: string | null;
  payload: unknown;
}

export interface AuthoritativeSourceMappingRecord {
  releaseId: string;
  mappingId: string;
  ordinal: number;
  sourceObjectId: string;
  canonicalId: string;
  mappingType: string;
  reviewStatus: string | null;
  payload: unknown;
}

export interface AuthoritativeEvidenceRecord {
  releaseId: string;
  evidenceId: string;
  ordinal: number;
  sourceEditionId: string;
  sectionId: string;
  segmentOrdinal: number;
  segmentType: string;
  contentHash: string;
  payload: unknown;
}

// CTKG 0.2 aggregate rows. These mirror public release/projection artifacts;
// they never reconstruct private CTKGDataset content.
export interface AuthoritativeReleaseEntryRecord {
  releaseId: string;
  entityId: string;
  ordinal: number;
  releaseTier: string;
  entityRole: string;
  inclusionReason: string;
  payload: unknown;
}

export interface AuthoritativeProjectionNodeRecord {
  releaseId: string;
  nodeId: string;
  ordinal: number;
  entityId: string;
  entityType: string;
  displayName: string;
  releaseTier: string;
  reviewStatus: string;
  publicationStatus: string;
  semanticName: string | null;
  sourceCoverageCount: number;
  candidate: boolean;
  payload: unknown;
}

export interface AuthoritativeProjectionLinkRecord {
  releaseId: string;
  linkId: string;
  ordinal: number;
  relationId: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  relationFamily: string;
  direction: string;
  evidenceState: string;
  payload: unknown;
}

export interface AuthoritativeUpstreamRagReferenceRecord {
  releaseId: string;
  ordinal: number;
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}

export interface AuthoritativeReleaseArtifactRecord {
  releaseId: string;
  relativePath: string;
  ordinal: number;
  mediaType: string;
  sha256: string;
  byteLength: number;
}

export interface AuthoritativeReleaseComponentRecord {
  releaseId: string;
  ordinal: number;
  componentReleaseId: string;
  releaseVersion: string;
  protocol: string;
  controlledPath: string;
  releaseHash: string;
  releaseRawSha256: string;
  sha256sumsSha256: string;
  payload: unknown;
}

export interface AuthoritativeImportReceiptRecord {
  id: string;
  releaseSetId: string;
  releaseId: string;
  // NULL on aggregate receipts: the public bundle carries no upstream run
  // identity.
  sourceRun: string | null;
  sourceImplementationCommit: string | null;
  captureRevision: string;
  lockRawHash: string;
  ctkgDatasetAvailability: string;
  ctkgDatasetHash: string | null;
  ctkgDatasetPublicationIdentity: string | null;
  ctkgDatasetResolvableLocation: string | null;
  revisionRegistryAvailability: string;
  revisionRegistryVersion: string | null;
  revisionRegistryHash: string | null;
  objectCount: number;
  sourceMappingCount: number;
  goldRelationCount: number;
  silverRelationCount: number;
  sourceObjectCount: number;
  evidenceSegmentCount: number;
  candidateState: string;
  importedAt: Date;
  // CTKG 0.2 aggregate receipt identity and counts. Absent for historical
  // CTKG 0.1 receipts. Aggregate receipts carry no upstream run identity, so
  // the persisted sourceRun/sourceImplementationCommit columns are NULL there.
  schemaVersion?: string | null;
  upstreamReleaseId?: string | null;
  projectionId?: string | null;
  projectionDigest?: string | null;
  sourceDatasetHash?: string | null;
  upstreamPublicationCommit?: string | null;
  upstreamClosedCommit?: string | null;
  releaseEntryCount?: number | null;
  projectionNodeCount?: number | null;
  projectionLinkCount?: number | null;
  upstreamRagReferenceCount?: number | null;
  artifactCount?: number | null;
  componentCount?: number | null;
}

export interface AuthoritativeKnowledgeSnapshot {
  authorityState: 'candidate';
  productionAuthoritative: false;
  /** True for every ReleaseSet other than the pinned aggregate ReleaseSet. */
  historical: boolean;
  releaseSet: AuthoritativeReleaseSetRecord;
  release: AuthoritativeReleaseRecord;
  receipt: AuthoritativeImportReceiptRecord | null;
  objects: AuthoritativeObjectRecord[];
  relations: AuthoritativeRelationRecord[];
  sourceMappings: AuthoritativeSourceMappingRecord[];
  sourceObjects: AuthoritativeSourceObjectRecord[];
  evidence: AuthoritativeEvidenceRecord[];
  // CTKG 0.2 aggregate rows; populated only for pinned aggregate releases,
  // never mixed with the historical CTKG 0.1 rows above.
  releaseEntries?: AuthoritativeReleaseEntryRecord[];
  projectionNodes?: AuthoritativeProjectionNodeRecord[];
  projectionLinks?: AuthoritativeProjectionLinkRecord[];
  upstreamRagReferences?: AuthoritativeUpstreamRagReferenceRecord[];
  releaseArtifacts?: AuthoritativeReleaseArtifactRecord[];
  releaseComponents?: AuthoritativeReleaseComponentRecord[];
}

export type RepositoryResult =
  | {
      status: 'available';
      selector: Extract<AuthoritySelector, { authorityState: 'candidate' }>;
      snapshot: AuthoritativeKnowledgeSnapshot;
      diagnostics: [];
    }
  | {
      status: 'drift';
      selector: Extract<AuthoritySelector, { authorityState: 'candidate' }>;
      snapshot: AuthoritativeKnowledgeSnapshot;
      diagnostics: RepositoryDiagnostic[];
    }
  | {
      status: 'unavailable';
      selector: AuthoritySelector;
      reason: RepositoryUnavailableReason;
      diagnostics: [];
    };

export interface ConsumerSemanticSupport {
  consumerId: string;
  supportedObjectTypes: readonly string[];
  supportedPredicates: readonly string[];
}

export interface ProjectionIdentity {
  authorityState: AuthorityState;
  releaseSetId: string;
  releaseId: string;
  productionAuthoritative: false;
  /** True when the source ReleaseSet is not the pinned aggregate ReleaseSet. */
  historical: boolean;
  /** Source release hash (SHA-256) of the imported public release. */
  releaseHash?: string | null;
  /** CTKG Schema version of the source release; null for CTKG 0.1 history. */
  schemaVersion?: string | null;
  /** GraphProjection V2 version_digest; null for CTKG 0.1 history. */
  projectionDigest?: string | null;
  /** Upstream source dataset hash; null for CTKG 0.1 history. */
  sourceDatasetHash?: string | null;
}

export interface SemanticSupportMark {
  supported: boolean;
  readOnly: true;
}

export type CourseCoverageRole =
  | 'formal_objective'
  | 'necessary_prerequisite'
  | 'explicit_extension';

export interface CourseCoverageSelector {
  courseId: string;
  overlayId: string;
  overlayVersion: string;
  releaseSetId: string;
  releaseId: string;
}

export interface CourseCoverageAuditIdentity {
  courseId: string;
  overlayId: string;
  overlayVersion: string;
  overlayVersionId: string;
  authoringRevision: string;
  captureRevision: string;
  sourceHash: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  lockRawHash: string;
  productionAuthoritative: false;
}

export interface CourseCoverageRecord {
  canonicalId: string;
  role: CourseCoverageRole;
  ordinal: number;
}

export interface CourseCoverageDiagnostic {
  code:
    | 'selector-mismatch'
    | 'receipt-missing'
    | 'receipt-identity-mismatch'
    | 'receipt-count-mismatch'
    | 'release-drift'
    | 'covered-object-missing'
    | 'unsupported-role';
  field: string;
  expected: string | number;
  actual: string | number | null;
}

export type CourseCoverageResult =
  | {
      status: 'available';
      selector: CourseCoverageSelector;
      audit: CourseCoverageAuditIdentity;
      entries: CourseCoverageRecord[];
      diagnostics: [];
      productionAuthoritative: false;
    }
  | {
      status: 'drift';
      selector: CourseCoverageSelector;
      audit: CourseCoverageAuditIdentity;
      entries: CourseCoverageRecord[];
      diagnostics: CourseCoverageDiagnostic[];
      productionAuthoritative: false;
    }
  | {
      status: 'unavailable';
      selector: CourseCoverageSelector | null;
      reason: 'missing-selector' | 'coverage-not-found';
      diagnostics: [];
      productionAuthoritative: false;
    };

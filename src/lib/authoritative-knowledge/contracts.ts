export type AuthorityState = 'candidate' | 'active' | 'legacy';

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

export interface AuthoritativeImportReceiptRecord {
  id: string;
  releaseSetId: string;
  releaseId: string;
  sourceRun: string;
  sourceImplementationCommit: string;
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
}

export interface AuthoritativeKnowledgeSnapshot {
  authorityState: 'candidate';
  productionAuthoritative: false;
  releaseSet: AuthoritativeReleaseSetRecord;
  release: AuthoritativeReleaseRecord;
  receipt: AuthoritativeImportReceiptRecord | null;
  objects: AuthoritativeObjectRecord[];
  relations: AuthoritativeRelationRecord[];
  sourceMappings: AuthoritativeSourceMappingRecord[];
  sourceObjects: AuthoritativeSourceObjectRecord[];
  evidence: AuthoritativeEvidenceRecord[];
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

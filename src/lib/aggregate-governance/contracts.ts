/**
 * Aggregate CourseCoverage + ACT Crosswalk + resource-binding governance (#1126).
 *
 * Inputs: accepted standard candidate, immutable ReleaseSet Delta Receipt,
 * runtime projection digest, clean capture revision, DB watermark, inventory.
 * Outputs: shadow-only coverage, ACT structural-unit Crosswalks, revalidated
 * or invalidated resource bindings. Does not move production selectors.
 */

export const AGGREGATE_GOVERNANCE_SCHEMA_VERSION =
  'act-aggregate-course-resource-governance/v1' as const;
export const AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION =
  'act-course-coverage-overlay/v2' as const;
export const AGGREGATE_COURSE_COVERAGE_OVERLAY_ID =
  'automatic-control-aggregate-coverage-v1' as const;
export const AGGREGATE_COURSE_ID = 'automatic-control' as const;
export const AGGREGATE_GOVERNANCE_REVIEW_IDENTITY =
  'issue-1126-aggregate-governance-baseline-v1' as const;

export const COURSE_COVERAGE_ROLES = [
  'formal_objective',
  'necessary_prerequisite',
  'explicit_extension',
  'excluded_with_rationale',
] as const;

export type CourseCoverageRole = (typeof COURSE_COVERAGE_ROLES)[number];

export const ACTIVE_COURSE_COVERAGE_ROLES = [
  'formal_objective',
  'necessary_prerequisite',
  'explicit_extension',
] as const;

export type ActiveCourseCoverageRole = (typeof ACTIVE_COURSE_COVERAGE_ROLES)[number];

export type GovernanceMode = 'baseline' | 'incremental' | 'packaging_noop';

export type GovernanceLifecycleState = 'CURRENT' | 'STALE' | 'SUPERSEDED';

export type CrosswalkResolutionState =
  | 'DETERMINISTIC'
  | 'SEMANTIC'
  | 'UNRESOLVED'
  | 'STALE';

export type CrosswalkValidationState =
  | 'VALIDATED'
  | 'UNRESOLVED'
  | 'REJECTED'
  | 'STALE';

export type RevalidationOutcome =
  | 'REVALIDATED'
  | 'REQUIRES_REVIEW'
  | 'INVALIDATED'
  | 'NO_OP_PACKAGING';

/** Opaque upstream RAG triple — never rewritten by ACT governance. */
export interface OpaqueUpstreamRagReference {
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}

/**
 * Independent capture identities:
 * - captureRevision: current clean governance capture (loader HEAD / inventory /
 *   implementation). Does NOT need to equal overlay authoringRevision.
 * - importCaptureRevision: historical Release import capture (ancestor of governance or equal)
 * - deltaCaptureRevision: Delta implementation capture / receipt.captureRevision
 *   (ancestor of governance or equal). Distinct from Delta.candidateEvidenceCaptureRevision,
 *   which binds the candidate import capture.
 * - authoringRevision: reviewed overlay source revision (ancestor of governance or equal);
 *   may predate the commit that last updated the active file on the current clean HEAD.
 *
 * Coherence requires each identity to match its independently observed counterpart,
 * not that the commits are equal. Git ancestry is enforced by
 * assertAggregateCaptureRevisionLineage on the production runner path.
 */
export interface CaptureIdentity {
  /** Current clean governance capture revision (authoring/inventory/index). */
  captureRevision: string;
  /** Historical import receipt capture revision. */
  importCaptureRevision: string;
  /** Historical Delta computation capture revision. */
  deltaCaptureRevision: string;
  dbWatermark: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  deltaReceiptId: string;
  deltaOutputDigest: string;
  deltaClassification: string;
  runtimeProjectionId: string | null;
  runtimeProjectionDigest: string | null;
  inventoryRunId: string | null;
  structuralUnitIndexVersion: string | null;
  authoringRevision: string | null;
  coverageSourceHash: string | null;
}

export interface CoherentCaptureGateResult {
  coherent: boolean;
  failures: Array<{ field: string; expected: string; actual: string | null }>;
}

export interface CourseCoverageDisposition {
  canonicalId: string;
  role: CourseCoverageRole;
  rationale: string | null;
  evidenceRefs: string[];
  reviewIdentity: string;
  sourceEvidenceDigest: string;
}

export interface CourseCoverageAuthoringOverlay {
  schemaVersion: typeof AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION;
  overlayId: typeof AGGREGATE_COURSE_COVERAGE_OVERLAY_ID;
  overlayVersion: string;
  courseId: typeof AGGREGATE_COURSE_ID;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  /** Must bind one accepted Delta Receipt; never null for active reviewed authoring. */
  deltaReceiptId: string;
  mode: 'baseline' | 'incremental';
  authoringRevision: string;
  sourceHash: string;
  entries: CourseCoverageDisposition[];
}

export interface ObjectWorkItem {
  canonicalId: string;
  action: 'review' | 'invalidate' | 'revalidate';
  reasons: string[];
}

export interface CrosswalkWorkItem {
  tripleKey: string;
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
  action: 'resolve' | 'invalidate' | 'revalidate';
  reasons: string[];
}

export interface ResourceBindingWorkItem {
  pairKey: string;
  canonicalId: string | null;
  resourceId: string | null;
  structuralUnitId: string | null;
  segmentId: string | null;
  action: 'review' | 'invalidate' | 'revalidate';
  reasons: string[];
}

export interface GovernanceWorkManifest {
  schemaVersion: typeof AGGREGATE_GOVERNANCE_SCHEMA_VERSION;
  mode: GovernanceMode;
  capture: CaptureIdentity;
  objects: ObjectWorkItem[];
  crosswalks: CrosswalkWorkItem[];
  resourceBindings: ResourceBindingWorkItem[];
  packagingNoop: boolean;
  inputDigest: string;
}

export type InventoryDisposition = 'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED';

export interface StructuralUnitIndexEntry {
  sourceEditionId: string;
  sourceVersion: string;
  structuralUnitId: string;
  structuralUnitVersion: string;
  structuralUnitHash: string;
  stableIds: string[];
  contentHashes: string[];
  atomicResourceId: string | null;
  resourceId: string | null;
  segmentId: string | null;
  resourceSegmentHash: string | null;
  textPreviewDigest: string | null;
  /**
   * Current inventory disposition for this structural unit. Semantic Crosswalk
   * recall may include EXCLUDED/UNRESOLVED content-bearing units; binding
   * eligibility still requires INCLUDED.
   */
  inventoryDisposition: InventoryDisposition;
  /** Sorted inventory reason codes (auditable; not a semantic review outcome). */
  reasonCodes: string[];
}

export interface DeterministicAlignmentInput {
  upstream: OpaqueUpstreamRagReference;
  /** Null for relation-type upstream — alignment stays unresolved. */
  canonicalId: string | null;
  capture: CaptureIdentity;
  index: readonly StructuralUnitIndexEntry[];
  /** Optional stable ID/hash hints attached outside the opaque triple. */
  stableIds?: string[];
  contentHashes?: string[];
}

export interface ActStructuralUnitCrosswalkRecord {
  id: string;
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
  /**
   * Null when the upstream published_entity_id is not a Canonical Object
   * (e.g. relation-type RAG records). Must be non-null for VALIDATED current.
   */
  canonicalId: string | null;
  sourceEditionId: string | null;
  sourceVersion: string | null;
  structuralUnitId: string | null;
  structuralUnitVersion: string | null;
  structuralUnitHash: string | null;
  evidenceContentHash: string | null;
  inventoryRunId: string | null;
  atomicResourceId: string | null;
  resourceId: string | null;
  segmentId: string | null;
  resourceSegmentHash: string | null;
  captureRevision: string;
  resolutionState: CrosswalkResolutionState;
  validationState: CrosswalkValidationState;
  validationDigest: string | null;
  reviewIdentity: string | null;
  evidenceDigest: string | null;
  lifecycleState: GovernanceLifecycleState;
}

/** Upstream RAG triple classification relative to Canonical membership. */
export type UpstreamReferenceKind = 'canonical_object' | 'relation_or_other';


export interface SemanticAlignmentCandidate {
  candidateId: string;
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string;
  structuralUnitId: string;
  structuralUnitVersion: string;
  structuralUnitHash: string;
  sourceEditionId: string;
  sourceVersion: string;
  rationale: string;
  generatorPromptVersion: string;
}

export interface SemanticAlignmentReview {
  outcome: 'ACCEPT' | 'REJECT' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'HIGH_IMPACT';
  reviewIdentity: string;
  reviewerPromptVersion: string;
  evidenceDigest: string;
  rationale: string;
}

export interface PriorSemanticDecision {
  kind: 'coverage' | 'crosswalk' | 'binding';
  identityKey: string;
  releaseSetId: string;
  releaseId: string;
  canonicalDigest: string | null;
  resourceSegmentHash: string | null;
  role: string | null;
  promptReviewerVersion: string | null;
  evidenceDigest: string | null;
  structuralGateDigest: string | null;
  publicationIdentity: string;
  lifecycleState: GovernanceLifecycleState;
}

export interface RevalidationReceipt {
  id: string;
  kind: 'coverage' | 'crosswalk' | 'binding' | 'packaging';
  priorPublicationIdentity: string;
  newReleaseSetId: string;
  newReleaseId: string;
  newDeltaReceiptId: string;
  outcome: RevalidationOutcome;
  identityDigest: string;
  captureRevision: string;
  copiesPriorPublication: false;
}

export interface DownstreamReadinessDiagnostics {
  schemaVersion: 'aggregate-downstream-readiness/v1';
  captureRevision: string;
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  rag: {
    ready: boolean;
    requires: 'valid-act-structural-unit-crosswalk';
    validCrosswalkCount: number;
    unresolvedUpstreamCount: number;
  };
  kaq: {
    ready: boolean;
    requires: 'course-coverage';
    coveredObjectCount: number;
    excludedObjectCount: number;
  };
  sar: {
    ready: boolean;
    requires: 'reviewed-bindings-and-kaq';
    shadowPublishedBindingCount: number;
  };
  teachingProjection: {
    ready: false;
    blocked: true;
    reason: 'formal-teaching-projection-not-available';
  };
  path: {
    ready: false;
    blocked: true;
    reason: 'awaits-formal-teaching-projection';
  };
  facts: {
    ready: false;
    blocked: true;
    reason: 'awaits-formal-teaching-projection';
  };
  cutover: {
    ready: false;
    blocked: true;
    reason: 'production-selectors-remain-legacy';
  };
  productionSelectors: {
    candidateUnchanged: true;
    activeUnchanged: true;
    legacyUnchanged: true;
  };
}

export interface AggregateGovernanceSummary {
  schemaVersion: typeof AGGREGATE_GOVERNANCE_SCHEMA_VERSION;
  mode: GovernanceMode;
  captureRevision: string;
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  coverage: {
    dispositionCount: number;
    formalObjectiveCount: number;
    necessaryPrerequisiteCount: number;
    explicitExtensionCount: number;
    excludedCount: number;
  };
  exclusions: number;
  unresolvedCrosswalks: number;
  validatedCrosswalks: number;
  bindings: {
    revalidated: number;
    invalidated: number;
    reviewed: number;
    shadowPublished: number;
    /** Same-run candidates retained for #1124 (not count-only). */
    candidatesGenerated: number;
    /** Decisions staged through #1124 contracts this run. */
    decisionsStaged: number;
    /** Candidates still awaiting controlled review (not discarded). */
    pendingReviewCount: number;
  };
  invalidations: number;
  packagingNoop: boolean;
  readiness: DownstreamReadinessDiagnostics;
  protectedContentIncluded: false;
  localPathsIncluded: false;
}

export interface AggregateGovernanceReceipt {
  id: string;
  schemaVersion: typeof AGGREGATE_GOVERNANCE_SCHEMA_VERSION;
  mode: GovernanceMode;
  capture: CaptureIdentity;
  coverageVersionId: string | null;
  inputDigest: string;
  outputDigest: string;
  summary: AggregateGovernanceSummary;
  authorityState: 'SHADOW';
  productionAuthoritative: false;
}

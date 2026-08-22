/**
 * ACT-owned Canonical teaching-relation governance (#1502).
 *
 * ActKG remains authoritative for Canonical identities and Engineering facts.
 * This module never relabels Engineering predicates as teaching relations.
 */

export const ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT =
  'act-canonical-teaching-relation-governance/v1' as const;
export const ACT_TEACHING_SCOPE_CONTRACT =
  'act-canonical-teaching-scope/v1' as const;
export const ACT_TEACHING_CANDIDATE_CONTRACT =
  'act-canonical-teaching-relation-candidate/v1' as const;
export const ACT_TEACHING_DECISION_CONTRACT =
  'act-canonical-teaching-relation-decision/v1' as const;
export const ACT_TEACHING_REVIEW_PACK_CONTRACT =
  'act-canonical-teaching-review-pack/v1' as const;
export const ACT_TEACHING_QUALIFICATION_CONTRACT =
  'act-canonical-teaching-pipeline-qualification/v1' as const;
export const ACT_TEACHING_PROJECTION_RECEIPT_CONTRACT =
  'act-canonical-teaching-relation-projection-receipt/v1' as const;
export const ACT_TEACHING_RELATION_GOVERNANCE_BUILDER_VERSION =
  'act-canonical-teaching-relation-governance-builder/v1' as const;

export const ACT_TEACHING_COURSE_ID = 'act-control-theory' as const;

export const ACT_TEACHING_FAMILIES = [
  'containment',
  'prerequisite',
  'association',
] as const;
export type ActTeachingFamily = (typeof ACT_TEACHING_FAMILIES)[number];

export const ACT_TEACHING_RELATION_TYPES = [
  'CONTAINMENT',
  'PREREQUISITE',
  'PEDAGOGICAL_ASSOCIATION',
] as const;
export type ActTeachingRelationType = (typeof ACT_TEACHING_RELATION_TYPES)[number];

export const FAMILY_TO_RELATION_TYPE = {
  containment: 'CONTAINMENT',
  prerequisite: 'PREREQUISITE',
  association: 'PEDAGOGICAL_ASSOCIATION',
} as const satisfies Record<ActTeachingFamily, ActTeachingRelationType>;

export const COURSE_ROOT_DISPOSITION = 'COURSE_ROOT' as const;
export const NO_RELATION_DISPOSITION = 'NO_RELATION' as const;
export const PENDING_REVIEW_DISPOSITION = 'PENDING_REVIEW' as const;
export const PUBLISHED_EDGE_DISPOSITION = 'PUBLISHED_EDGE' as const;

export const ACT_TEACHING_DISPOSITIONS = [
  COURSE_ROOT_DISPOSITION,
  NO_RELATION_DISPOSITION,
  PENDING_REVIEW_DISPOSITION,
  PUBLISHED_EDGE_DISPOSITION,
] as const;
export type ActTeachingDispositionKind = (typeof ACT_TEACHING_DISPOSITIONS)[number];

export const ACT_TEACHING_CANDIDATE_ORIGINS = [
  'QUALIFIED_PIPELINE',
  'ENGINEERING_EVIDENCE',
  'AUTHOR_PROPOSAL',
  'KAQ_FALLBACK',
] as const;
export type ActTeachingCandidateOrigin =
  (typeof ACT_TEACHING_CANDIDATE_ORIGINS)[number];

export const ACT_TEACHING_DECISION_KINDS = [
  'approve',
  'reject',
  'modify',
  'defer',
] as const;
export type ActTeachingDecisionKind = (typeof ACT_TEACHING_DECISION_KINDS)[number];

export const ACT_TEACHING_PUBLICATION_STATES = [
  'PARTIAL',
  'EMPTY',
] as const;
export type ActTeachingPublicationState =
  (typeof ACT_TEACHING_PUBLICATION_STATES)[number];

export const ACT_TEACHING_DIRECTIONS = [
  'source_to_target',
  'symmetric',
] as const;
export type ActTeachingDirection = (typeof ACT_TEACHING_DIRECTIONS)[number];

export interface ActTeachingAuthorityIdentity {
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly releaseSetId: string;
}

export interface ActTeachingCatalogSelection {
  readonly catalogId: string;
  readonly catalogHash: string;
  readonly catalogVersion: string;
}

export interface ActTeachingMember {
  readonly canonicalId: string;
  readonly domainIds: readonly string[];
  readonly preferredDomainId: string;
}

export interface ActTeachingScope {
  readonly contract: typeof ACT_TEACHING_SCOPE_CONTRACT;
  readonly courseId: string;
  readonly authority: ActTeachingAuthorityIdentity;
  readonly catalog: ActTeachingCatalogSelection;
  readonly contractVersion: typeof ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT;
  readonly members: readonly ActTeachingMember[];
  readonly memberIds: readonly string[];
  readonly scopeHash: string;
}

export interface ActTeachingFamilyDisposition {
  readonly scopeHash: string;
  readonly canonicalId: string;
  readonly family: ActTeachingFamily;
  readonly kind: ActTeachingDispositionKind;
  readonly edgeId: string | null;
  readonly evidenceRefs: readonly string[];
  readonly rationale: string;
}

export interface ActTeachingCandidate {
  readonly contract: typeof ACT_TEACHING_CANDIDATE_CONTRACT;
  readonly candidateId: string;
  readonly scopeHash: string;
  readonly family: ActTeachingFamily;
  readonly relationType: ActTeachingRelationType;
  readonly sourceCanonicalId: string;
  readonly targetCanonicalId: string | null;
  readonly direction: ActTeachingDirection;
  readonly origin: ActTeachingCandidateOrigin;
  readonly pipelineVersion: string;
  readonly pipelineConfigDigest: string;
  readonly confidence: number;
  readonly strength: 'REQUIRED' | 'RECOMMENDED' | null;
  readonly evidenceRefs: readonly string[];
  readonly evidenceDigest: string;
  readonly authority: ActTeachingAuthorityIdentity;
  readonly conflicts: readonly string[];
  readonly exceptionReasons: readonly string[];
}

export interface ActTeachingDecision {
  readonly contract: typeof ACT_TEACHING_DECISION_CONTRACT;
  readonly decisionId: string;
  readonly candidateId: string;
  readonly scopeHash: string;
  readonly kind: ActTeachingDecisionKind;
  readonly reviewerId: string;
  readonly decidedAt: string;
  readonly rationale: string;
  readonly originalCandidateDigest: string;
  readonly modifiedCandidate: ActTeachingCandidate | null;
}

export interface ActTeachingReviewPackManifest {
  readonly contract: typeof ACT_TEACHING_REVIEW_PACK_CONTRACT;
  readonly packId: string;
  readonly packHash: string;
  readonly scopeHash: string;
  readonly authority: ActTeachingAuthorityIdentity;
  readonly candidateCount: number;
  readonly decisionCount: number;
  readonly pendingCount: number;
  readonly candidateDigest: string;
  readonly decisionDigest: string;
}

export interface ActTeachingQualificationMetrics {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly balancedScore: number;
}

export interface ActTeachingQualificationReceipt {
  readonly contract: typeof ACT_TEACHING_QUALIFICATION_CONTRACT;
  readonly receiptId: string;
  readonly pipelineVersion: string;
  readonly pipelineConfigDigest: string;
  readonly goldDigest: string;
  readonly holdoutDigest: string;
  readonly gold: ActTeachingQualificationMetrics;
  readonly holdout: ActTeachingQualificationMetrics;
  readonly threshold: number;
  readonly passed: boolean;
}

export interface ActTeachingPublishedEdge {
  readonly edgeId: string;
  readonly family: ActTeachingFamily;
  readonly relationType: ActTeachingRelationType;
  readonly sourceCanonicalId: string;
  readonly targetCanonicalId: string;
  readonly direction: ActTeachingDirection;
  readonly domainKeys: readonly string[];
  readonly layer: 'ACT_TEACHING';
}

export interface ActTeachingFamilyCounts {
  readonly family: ActTeachingFamily;
  readonly memberCount: number;
  readonly closedCount: number;
  readonly publishedEdgeCount: number;
  readonly pendingCount: number;
  readonly noRelationCount: number;
  readonly courseRootCount: number;
}

export interface ActTeachingProjectionReceipt {
  readonly contract: typeof ACT_TEACHING_PROJECTION_RECEIPT_CONTRACT;
  readonly builderVersion: typeof ACT_TEACHING_RELATION_GOVERNANCE_BUILDER_VERSION;
  readonly projectionId: string;
  readonly projectionHash: string;
  readonly publicationState: ActTeachingPublicationState;
  readonly scopeHash: string;
  readonly courseId: string;
  readonly authority: ActTeachingAuthorityIdentity;
  readonly catalog: ActTeachingCatalogSelection;
  readonly memberCount: number;
  readonly familyCounts: readonly ActTeachingFamilyCounts[];
  readonly publishedEdgeCount: number;
  readonly pendingCount: number;
  readonly reviewPackHash: string;
  readonly qualificationReceiptId: string;
  readonly pipelineVersion: string;
}

export interface ActTeachingProjectionArtifacts {
  readonly receipt: ActTeachingProjectionReceipt;
  readonly scope: ActTeachingScope;
  readonly edges: readonly ActTeachingPublishedEdge[];
  readonly dispositions: readonly ActTeachingFamilyDisposition[];
  readonly reviewPack: ActTeachingReviewPackManifest;
  readonly candidates: readonly ActTeachingCandidate[];
  readonly decisions: readonly ActTeachingDecision[];
  readonly qualification: ActTeachingQualificationReceipt;
}

export const LEGACY_FOUR_PREREQUISITE_PUBLICATION_ID =
  'proj-1adcc27f4e0e1b35e7b288da1920242fd4552e60e16a4b0aa7742c32891f9421' as const;
export const LEGACY_FOUR_PREREQUISITE_PROJECTION_ID =
  'proj-1ab3029ae058d5b2cbef11106639623782ffa06f9b9edb043e791c480922a457' as const;

export const DEFAULT_ACT_TEACHING_RELATION_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/act-relations' as const;

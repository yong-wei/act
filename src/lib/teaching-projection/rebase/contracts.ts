/**
 * ACT Teaching Projection incremental rebase contracts (#1272).
 *
 * Delta → impact set → decisions → complete deterministic rebuild.
 * Never patches runtime JSONL in place; never re-reviews unbound engineering nodes.
 */

import type {
  TeachingProjectionArtifacts,
  TeachingProjectionAuthoringInput,
  TeachingProjectionManifest,
} from '../contracts';

export const ACT_TEACHING_PROJECTION_IMPACT_SET_CONTRACT =
  'act-teaching-projection-impact-set/v1' as const;
export const ACT_TEACHING_PROJECTION_REBASE_DECISION_CONTRACT =
  'act-teaching-projection-rebase-decision/v1' as const;
export const ACT_TEACHING_PROJECTION_REBASE_REPORT_CONTRACT =
  'act-teaching-projection-rebase-report/v1' as const;
export const ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION =
  'act-teaching-projection-rebase-compat/v1' as const;
export const ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION =
  'act-teaching-projection-rebase-engine/v1' as const;

/**
 * Stable impact categories bound to exact Delta/Authority identities.
 * Downstream of ReleaseSet Delta; owned by ACT projection rebase.
 */
export const ACT_DELTA_IMPACT_CATEGORIES = [
  'ADDED',
  'METADATA_CHANGED',
  'TYPE_CHANGED',
  'DEPRECATED',
  'REPLACED_BY',
  'SPLIT',
  'MERGED',
  'REMOVED_WITHOUT_SUCCESSOR',
  'RELATION_ADDED',
  'RELATION_CHANGED',
  'RELATION_RETIRED',
  'SOURCE_ANCHOR_CHANGED',
  'SOURCE_DOCUMENT_CHANGED',
  'LABEL_ALIAS_CHANGED',
] as const;

export type ActDeltaImpactCategory = (typeof ACT_DELTA_IMPACT_CATEGORIES)[number];

export const ACT_IMPACT_SUBJECT_KINDS = [
  'binding',
  'card',
  'prerequisite',
  'resource',
  'core-node',
  'textbook-locator',
  'authority-node',
  'relation',
] as const;

export type ActImpactSubjectKind = (typeof ACT_IMPACT_SUBJECT_KINDS)[number];

export const ACT_IMPACT_DISPOSITIONS = [
  /** Unbound engineering addition — zero ACT teaching review. */
  'NO_REVIEW',
  /** Label/alias-only: rebuild indexes, keep binding identity. */
  'INDEX_REBUILD',
  /** Ordinary binding eligible for one-to-one successor auto-rebase. */
  'AUTO_REBASE_CANDIDATE',
  /** Card/prerequisite local inspection after a successor move. */
  'LOCAL_CHECK',
  /** Split/merge/ambiguous/no-successor or type-incompatible — bounded review. */
  'REVIEW_REQUIRED',
  /** Engineering relation accepted for Authority; not an ACT teaching review item. */
  'ENGINEERING_ONLY',
  /** Unaffected record retained byte-stable across rebuild. */
  'CARRY_FORWARD',
] as const;

export type ActImpactDisposition = (typeof ACT_IMPACT_DISPOSITIONS)[number];

export const REBASE_DECISION_KINDS = [
  'AUTO_REBASE',
  'AUTHOR_DECISION',
  'REVIEW_REQUIRED',
  'CARRY_FORWARD',
  'INDEX_REBUILD',
  'NO_REVIEW',
  'LOCAL_CHECK',
] as const;

export type RebaseDecisionKind = (typeof REBASE_DECISION_KINDS)[number];

/**
 * Generic downstream change event derived from ReleaseSet Delta (or fixtures).
 * Identity-stable; does not decide teaching activation.
 */
export interface ActDeltaChangeEvent {
  category: ActDeltaImpactCategory;
  /** Primary identity (Canonical ID, relation ID, or source/document ID). */
  identity: string;
  /** Exact Delta signal / change identity for audit binding. */
  deltaIdentity: string;
  predecessors: string[];
  successors: string[];
  baseType?: string | null;
  candidateType?: string | null;
  /** True when payload change is display label/alias only. */
  labelAliasOnly?: boolean;
  sourceDocumentId?: string | null;
  sectionId?: string | null;
  relationSourceId?: string | null;
  relationTargetId?: string | null;
}

/**
 * One affected ACT teaching subject (or explicit zero-review authority node).
 * Expansion is direct dependency only — never transitive prerequisite walks.
 */
export interface ActImpactItem {
  packageId: string;
  subjectKind: ActImpactSubjectKind;
  subjectId: string;
  canonicalId: string | null;
  category: ActDeltaImpactCategory;
  disposition: ActImpactDisposition;
  deltaIdentity: string;
  relatedResourceIds: string[];
  relatedBindingIds: string[];
  relatedCardIds: string[];
  relatedPrerequisiteIds: string[];
  successors: string[];
  predecessors: string[];
  detail: string;
}

export interface ActTeachingProjectionImpactSet {
  contract: typeof ACT_TEACHING_PROJECTION_IMPACT_SET_CONTRACT;
  engineVersion: typeof ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION;
  /** Delta output digest when computed from a receipt; fixture digests for tests. */
  deltaOutputDigest: string;
  authorityReleaseId: string;
  baseAuthorityReleaseId: string | null;
  projectionId: string | null;
  packageId: string;
  changes: ActDeltaChangeEvent[];
  items: ActImpactItem[];
  summary: {
    teachingReviewItemCount: number;
    unboundAdditionCount: number;
    autoRebaseCandidateCount: number;
    reviewRequiredCount: number;
    localCheckCount: number;
    indexRebuildCount: number;
    engineeringOnlyCount: number;
    changeEventCount: number;
  };
}

export interface RebaseDecisionRecord {
  contract: typeof ACT_TEACHING_PROJECTION_REBASE_DECISION_CONTRACT;
  decisionId: string;
  kind: RebaseDecisionKind;
  subjectKind: ActImpactSubjectKind;
  subjectId: string;
  packageId: string;
  sourceCanonicalId: string | null;
  successorCanonicalId: string | null;
  category: ActDeltaImpactCategory;
  compatibilityRule: string | null;
  compatibilityRuleVersion: typeof ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION;
  deltaIdentity: string;
  deltaOutputDigest: string;
  authorityReleaseId: string;
  reason: string;
  /** Canonical digest of the decision body (excluding decisionId itself). */
  decisionBodyDigest: string;
}

/** Digest of a prior projection record carried into the rebuilt snapshot. */
export interface CarriedForwardDigestEntry {
  kind: 'resource' | 'binding' | 'prerequisite' | 'core-node' | 'card';
  id: string;
  priorDigest: string;
  rebuiltDigest: string;
  unchanged: boolean;
}

export interface TeachingProjectionRebaseReport {
  contract: typeof ACT_TEACHING_PROJECTION_REBASE_REPORT_CONTRACT;
  engineVersion: typeof ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION;
  packageId: string;
  priorProjectionId: string;
  priorProjectionHash: string;
  newProjectionId: string | null;
  newProjectionHash: string | null;
  deltaOutputDigest: string;
  authorityReleaseId: string;
  baseAuthorityReleaseId: string | null;
  impact: ActTeachingProjectionImpactSet;
  decisions: RebaseDecisionRecord[];
  unresolvedReviewRequired: ActImpactItem[];
  carriedForward: CarriedForwardDigestEntry[];
  /** True when rebuild completed and may be staged; false when fail-closed. */
  rebuildCompleted: boolean;
  /** Gate status of rebuilt artifacts when rebuildCompleted. */
  gatePassed: boolean | null;
  reasons: string[];
  /** Rollback target is the prior immutable projection identity. */
  rollback: {
    projectionId: string;
    projectionHash: string;
    authorityReleaseId: string;
    ready: true;
  };
}

export interface TeachingProjectionRebaseResult {
  report: TeachingProjectionRebaseReport;
  /** Rebuilt authoring used as decision source for the new snapshot. */
  authoring: TeachingProjectionAuthoringInput | null;
  artifacts: TeachingProjectionArtifacts | null;
  /** Prior manifest remains the consumer pin until activation. */
  priorManifest: TeachingProjectionManifest;
}

export class TeachingProjectionRebaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeachingProjectionRebaseError';
    this.code = code;
  }
}

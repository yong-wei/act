/**
 * Issue #1126 — generator / isolated-reviewer / assembler separation.
 *
 * Production scripts may only:
 *  1. generate deterministic worklists with bounded evidence (no final roles/outcomes)
 *  2. assemble previously authored review decision artifacts into controlled active files
 *
 * No production code path may manufacture ACCEPT/role decisions and label them as
 * isolated model review. Review decision files are authored only by a separate
 * semantic-review session that reads the worklist.
 */
import { createHash } from 'node:crypto';

import {
  AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
  AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
  AGGREGATE_COURSE_ID,
  COURSE_COVERAGE_ROLES,
  type CourseCoverageAuthoringOverlay,
  type CourseCoverageDisposition,
  type CourseCoverageRole,
  type OpaqueUpstreamRagReference,
} from './contracts';
import {
  AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
  semanticAlignmentCandidateId,
} from './act-crosswalk';
import {
  assertProductionDeltaReceiptId,
  assertProductionReviewIdentity,
  computeCoverageSourceHash,
  dispositionEvidenceDigest,
  isCourseCoverageRole,
  normalizeDisposition,
  validateCourseCoverageAuthoring,
} from './course-coverage';
import { sha256Canonical, tripleKey } from './hash';

// ---------------------------------------------------------------------------
// Constants / schema versions
// ---------------------------------------------------------------------------

export const COVERAGE_WORKLIST_SCHEMA_VERSION = 'course-coverage-worklist/v1' as const;
export const COVERAGE_REVIEW_DECISIONS_SCHEMA_VERSION =
  'course-coverage-review-decisions/v1' as const;
export const CROSSWALK_WORKLIST_SCHEMA_VERSION =
  'act-crosswalk-semantic-worklist/v2' as const;
export const CROSSWALK_REVIEW_DECISIONS_SCHEMA_VERSION =
  'act-crosswalk-review-decisions/v1' as const;
export const BINDING_WORKLIST_SCHEMA_VERSION =
  'act-resource-binding-worklist/v2' as const;
export const BINDING_REVIEW_DECISIONS_SCHEMA_VERSION =
  'act-resource-binding-review-decisions/v1' as const;

export const COVERAGE_WORKLIST_GENERATOR_VERSION =
  'course-coverage-worklist-generator/v1' as const;
/** Bumped with semantic candidate identity contract (v3 content-hash keys). */
export const CROSSWALK_WORKLIST_GENERATOR_VERSION =
  'act-crosswalk-worklist-generator/v3' as const;
export const BINDING_WORKLIST_GENERATOR_VERSION =
  'act-resource-binding-worklist-generator/v1' as const;

export const COVERAGE_REVIEWER_PROMPT_VERSION =
  'aggregate-coverage-isolated-review/v1' as const;
export const CROSSWALK_REVIEWER_PROMPT_VERSION =
  'aggregate-semantic-align-review/v1' as const;
export const BINDING_REVIEWER_PROMPT_VERSION =
  'aggregate-binding-review/v1' as const;

export const ACTIVE_CROSSWALK_REVIEWS_SCHEMA_VERSION =
  'act-crosswalk-semantic-reviews/v1' as const;
export const ACTIVE_BINDING_REVIEWS_SCHEMA_VERSION =
  'act-resource-binding-reviews/v1' as const;

export const ALLOWED_BINDING_ROLES = [
  'EXPLAINS',
  'PRACTICES',
  'ASSESSES',
  'REFERENCES',
] as const;
export type AllowedBindingRole = (typeof ALLOWED_BINDING_ROLES)[number];

export const ALLOWED_CROSSWALK_OUTCOMES = [
  'ACCEPT',
  'REJECT',
  'AMBIGUOUS',
  'UNSUPPORTED',
  'HIGH_IMPACT',
] as const;
export type CrosswalkReviewOutcome = (typeof ALLOWED_CROSSWALK_OUTCOMES)[number];

export const ALLOWED_BINDING_OUTCOMES = [
  'ACCEPT',
  'REJECT',
  'DISPUTE',
  'HUMAN_REQUIRED',
] as const;
export type BindingReviewOutcome = (typeof ALLOWED_BINDING_OUTCOMES)[number];

export const ALLOWED_REVIEW_PROVIDERS = [
  'GROK',
  'GPT',
  'FIXTURE',
  'HUMAN',
  'NONE',
] as const;
export type ReviewProvider = (typeof ALLOWED_REVIEW_PROVIDERS)[number];

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

/** Markers that prove a decision was manufactured by a generator, not a reviewer. */
const GENERATOR_AS_REVIEWER = /candidate-generator|unreviewed|unbound|heuristic|threshold|auto-accept|worklist-generator/iu;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function contentSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function boundExcerpt(text: string, maxChars = 480): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export function assertNotGeneratorAsReviewer(
  identity: string,
  context: string,
): void {
  assertProductionReviewIdentity(identity, context);
  if (GENERATOR_AS_REVIEWER.test(identity)) {
    throw new Error(
      `Review workflow rejected: ${context} reviewIdentity looks like a generator (${identity})`,
    );
  }
}

export function isAllowedReviewProvider(value: string): value is ReviewProvider {
  return (ALLOWED_REVIEW_PROVIDERS as readonly string[]).includes(value);
}

export function isAllowedBindingRole(value: string): value is AllowedBindingRole {
  return (ALLOWED_BINDING_ROLES as readonly string[]).includes(value);
}

export function isCrosswalkOutcome(value: string): value is CrosswalkReviewOutcome {
  return (ALLOWED_CROSSWALK_OUTCOMES as readonly string[]).includes(value);
}

export function isBindingOutcome(value: string): value is BindingReviewOutcome {
  return (ALLOWED_BINDING_OUTCOMES as readonly string[]).includes(value);
}

/** Reject payloads that already contain final semantic outcomes (generator invariant). */
export function assertNoFinalSemanticOutcomes(
  value: unknown,
  context: string,
): void {
  const text = JSON.stringify(value);
  // Look for outcome field assignments, not incidental words in paths.
  if (/"outcome"\s*:/u.test(text)) {
    throw new Error(
      `Review workflow rejected: ${context} must not embed final semantic outcomes`,
    );
  }
  if (/"role"\s*:\s*"(formal_objective|necessary_prerequisite|explicit_extension|excluded_with_rationale)"/u.test(text)) {
    throw new Error(
      `Review workflow rejected: ${context} must not embed final course roles`,
    );
  }
  if (/"proposedRole"\s*:/u.test(text)) {
    throw new Error(
      `Review workflow rejected: ${context} must not embed proposed binding roles`,
    );
  }
  if (/"suggestedRoles"\s*:/u.test(text)) {
    throw new Error(
      `Review workflow rejected: ${context} must not embed suggested binding roles`,
    );
  }
}

// ---------------------------------------------------------------------------
// CourseCoverage worklist + assembly
// ---------------------------------------------------------------------------

export interface CoverageEvidenceCandidate {
  evidenceId: string;
  path: string;
  selector: string;
  sourceHash: string;
  kind: 'canonical_node' | 'syllabus' | 'lesson' | 'card' | 'topic_retrieval' | 'profile';
  /** Retrieval rank only — never a role decision. */
  rank: number;
  weight: number;
  excerpt: string;
  excerptHash: string;
}

export interface CoverageWorklistItem {
  canonicalId: string;
  profile: {
    entityType: string | null;
    conceptKind: string | null;
    semanticName: string | null;
    displayName: string | null;
    description: string | null;
  };
  evidenceCandidates: CoverageEvidenceCandidate[];
  /** Ordered retrieval terms — may not choose a role. */
  retrievalHints: Array<{ term: string; rank: number }>;
  itemInputDigest: string;
}

export interface CoverageWorklistDocument {
  schemaVersion: typeof COVERAGE_WORKLIST_SCHEMA_VERSION;
  generatorVersion: typeof COVERAGE_WORKLIST_GENERATOR_VERSION;
  deltaReceiptId: string;
  authoringRevision: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  membershipCount: number;
  inputDigest: string;
  items: CoverageWorklistItem[];
}

export interface CoverageReviewDecision {
  canonicalId: string;
  role: CourseCoverageRole;
  rationale: string | null;
  /** Must reference evidenceId values present on the worklist item. */
  evidenceIds: string[];
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
  /** Digest over exact reviewer input + decision payload. */
  decisionDigest: string;
}

export interface CoverageReviewDecisionsDocument {
  schemaVersion: typeof COVERAGE_REVIEW_DECISIONS_SCHEMA_VERSION;
  worklistInputDigest: string;
  deltaReceiptId: string;
  authoringRevision: string;
  reviewProvider: ReviewProvider;
  reviewerIdentity: string;
  reviewerPromptVersion: string;
  decisions: CoverageReviewDecision[];
}

export function coverageItemInputDigest(item: Omit<CoverageWorklistItem, 'itemInputDigest'>): string {
  return sha256Canonical({
    canonicalId: item.canonicalId,
    profile: item.profile,
    evidenceCandidates: item.evidenceCandidates,
    retrievalHints: item.retrievalHints,
  });
}

export function coverageWorklistInputDigest(
  doc: Omit<CoverageWorklistDocument, 'inputDigest'>,
): string {
  return sha256Canonical({
    schemaVersion: doc.schemaVersion,
    generatorVersion: doc.generatorVersion,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    releaseSetId: doc.releaseSetId,
    releaseId: doc.releaseId,
    releaseHash: doc.releaseHash,
    sourceDatasetHash: doc.sourceDatasetHash,
    membershipCount: doc.membershipCount,
    items: doc.items.map((item) => ({
      canonicalId: item.canonicalId,
      itemInputDigest: item.itemInputDigest,
    })),
  });
}

export function finalizeCoverageWorklist(
  doc: Omit<CoverageWorklistDocument, 'inputDigest'>,
): CoverageWorklistDocument {
  const items = [...doc.items]
    .map((item) => {
      const base = {
        canonicalId: item.canonicalId,
        profile: item.profile,
        evidenceCandidates: [...item.evidenceCandidates].sort((a, b) => (
          a.rank - b.rank
          || a.evidenceId.localeCompare(b.evidenceId, 'en')
        )),
        retrievalHints: [...item.retrievalHints].sort((a, b) => (
          a.rank - b.rank
          || a.term.localeCompare(b.term, 'en')
        )),
      };
      return {
        ...base,
        itemInputDigest: coverageItemInputDigest(base),
      };
    })
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId, 'en'));

  const withoutDigest: Omit<CoverageWorklistDocument, 'inputDigest'> = {
    schemaVersion: COVERAGE_WORKLIST_SCHEMA_VERSION,
    generatorVersion: COVERAGE_WORKLIST_GENERATOR_VERSION,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    releaseSetId: doc.releaseSetId,
    releaseId: doc.releaseId,
    releaseHash: doc.releaseHash,
    sourceDatasetHash: doc.sourceDatasetHash,
    membershipCount: items.length,
    items,
  };
  assertNoFinalSemanticOutcomes(withoutDigest, 'coverage worklist');
  return {
    ...withoutDigest,
    inputDigest: coverageWorklistInputDigest(withoutDigest),
  };
}

export function coverageDecisionDigest(input: {
  itemInputDigest: string;
  canonicalId: string;
  role: CourseCoverageRole;
  rationale: string | null;
  evidenceIds: readonly string[];
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
}): string {
  return sha256Canonical({
    itemInputDigest: input.itemInputDigest,
    canonicalId: input.canonicalId,
    role: input.role,
    rationale: input.rationale,
    evidenceIds: [...input.evidenceIds].sort(),
    reviewIdentity: input.reviewIdentity,
    reviewProvider: input.reviewProvider,
    reviewerPromptVersion: input.reviewerPromptVersion,
  });
}

export function assembleCoverageFromReview(input: {
  worklist: CoverageWorklistDocument;
  review: CoverageReviewDecisionsDocument;
  overlayVersion?: string;
  mode?: 'baseline' | 'incremental';
}): CourseCoverageAuthoringOverlay {
  const worklist = input.worklist;
  const review = input.review;

  if (worklist.schemaVersion !== COVERAGE_WORKLIST_SCHEMA_VERSION) {
    throw new Error('Coverage assemble rejected: worklist schemaVersion invalid');
  }
  if (review.schemaVersion !== COVERAGE_REVIEW_DECISIONS_SCHEMA_VERSION) {
    throw new Error('Coverage assemble rejected: review schemaVersion invalid');
  }
  if (review.worklistInputDigest !== worklist.inputDigest) {
    throw new Error(
      'Coverage assemble rejected: review worklistInputDigest does not match worklist inputDigest',
    );
  }
  if (review.deltaReceiptId !== worklist.deltaReceiptId) {
    throw new Error('Coverage assemble rejected: deltaReceiptId drift between worklist and review');
  }
  if (review.authoringRevision !== worklist.authoringRevision) {
    throw new Error('Coverage assemble rejected: authoringRevision drift between worklist and review');
  }
  assertProductionDeltaReceiptId(worklist.deltaReceiptId);
  if (!COMMIT.test(worklist.authoringRevision)) {
    throw new Error('Coverage assemble rejected: authoringRevision invalid');
  }
  if (!isAllowedReviewProvider(review.reviewProvider) || review.reviewProvider === 'NONE') {
    throw new Error('Coverage assemble rejected: reviewProvider invalid');
  }
  assertNotGeneratorAsReviewer(review.reviewerIdentity, 'coverage review document');

  const byId = new Map(worklist.items.map((item) => [item.canonicalId, item]));
  if (byId.size !== worklist.items.length) {
    throw new Error('Coverage assemble rejected: worklist has duplicate canonicalIds');
  }
  if (review.decisions.length !== worklist.items.length) {
    throw new Error(
      `Coverage assemble rejected: expected ${worklist.items.length} decisions, got ${review.decisions.length}`,
    );
  }

  const seen = new Set<string>();
  const entries: CourseCoverageDisposition[] = [];
  for (const decision of review.decisions) {
    if (seen.has(decision.canonicalId)) {
      throw new Error(`Coverage assemble rejected: duplicate decision for ${decision.canonicalId}`);
    }
    seen.add(decision.canonicalId);
    const item = byId.get(decision.canonicalId);
    if (!item) {
      throw new Error(
        `Coverage assemble rejected: decision for unknown canonicalId ${decision.canonicalId}`,
      );
    }
    if (!isCourseCoverageRole(decision.role)) {
      throw new Error(
        `Coverage assemble rejected: invalid role ${decision.role} for ${decision.canonicalId}`,
      );
    }
    if (!isAllowedReviewProvider(decision.reviewProvider) || decision.reviewProvider === 'NONE') {
      throw new Error(
        `Coverage assemble rejected: invalid reviewProvider for ${decision.canonicalId}`,
      );
    }
    if (decision.reviewProvider !== review.reviewProvider) {
      throw new Error(
        `Coverage assemble rejected: decision provider drift for ${decision.canonicalId}`,
      );
    }
    assertNotGeneratorAsReviewer(decision.reviewIdentity, decision.canonicalId);
    if (decision.reviewIdentity !== review.reviewerIdentity) {
      throw new Error(
        `Coverage assemble rejected: decision reviewIdentity drift for ${decision.canonicalId}`,
      );
    }
    if (decision.reviewerPromptVersion !== review.reviewerPromptVersion) {
      throw new Error(
        `Coverage assemble rejected: reviewerPromptVersion drift for ${decision.canonicalId}`,
      );
    }

    const allowedEvidence = new Set(item.evidenceCandidates.map((row) => row.evidenceId));
    const evidenceIds = [...new Set(decision.evidenceIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (evidenceIds.length === 0) {
      throw new Error(
        `Coverage assemble rejected: ${decision.canonicalId} requires at least one evidenceId`,
      );
    }
    for (const evidenceId of evidenceIds) {
      if (!allowedEvidence.has(evidenceId)) {
        throw new Error(
          `Coverage assemble rejected: evidenceId ${evidenceId} not present in worklist for ${decision.canonicalId}`,
        );
      }
    }

    if (
      (decision.role === 'excluded_with_rationale' || decision.role === 'explicit_extension')
      && !decision.rationale?.trim()
    ) {
      throw new Error(
        `Coverage assemble rejected: ${decision.role} for ${decision.canonicalId} requires concrete rationale`,
      );
    }

    const expectedDigest = coverageDecisionDigest({
      itemInputDigest: item.itemInputDigest,
      canonicalId: decision.canonicalId,
      role: decision.role,
      rationale: decision.rationale,
      evidenceIds,
      reviewIdentity: decision.reviewIdentity,
      reviewProvider: decision.reviewProvider,
      reviewerPromptVersion: decision.reviewerPromptVersion,
    });
    if (decision.decisionDigest !== expectedDigest) {
      throw new Error(
        `Coverage assemble rejected: decisionDigest mismatch for ${decision.canonicalId}`,
      );
    }

    const evidenceRefs = evidenceIds.map((evidenceId) => {
      const row = item.evidenceCandidates.find((candidate) => candidate.evidenceId === evidenceId)!;
      return `worklist-evidence:${row.evidenceId}|${row.path}#${row.selector}|hash:${row.sourceHash}`;
    });

    entries.push(normalizeDisposition({
      canonicalId: decision.canonicalId,
      role: decision.role,
      rationale: decision.rationale,
      evidenceRefs,
      reviewIdentity: decision.reviewIdentity,
    }));
  }

  for (const canonicalId of byId.keys()) {
    if (!seen.has(canonicalId)) {
      throw new Error(
        `Coverage assemble rejected: missing decision for worklist item ${canonicalId}`,
      );
    }
  }

  const withoutHash = {
    schemaVersion: AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
    overlayId: AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
    overlayVersion: input.overlayVersion ?? '1',
    courseId: AGGREGATE_COURSE_ID,
    releaseSetId: worklist.releaseSetId,
    releaseId: worklist.releaseId,
    releaseHash: worklist.releaseHash,
    sourceDatasetHash: worklist.sourceDatasetHash,
    deltaReceiptId: worklist.deltaReceiptId,
    mode: (input.mode ?? 'baseline') as 'baseline',
    authoringRevision: worklist.authoringRevision,
    entries: [...entries].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId, 'en')),
  };
  const overlay: CourseCoverageAuthoringOverlay = {
    ...withoutHash,
    sourceHash: computeCoverageSourceHash(withoutHash),
  };

  validateCourseCoverageAuthoring(overlay, {
    currentCanonicalIds: worklist.items.map((item) => item.canonicalId),
    releaseSetId: worklist.releaseSetId,
    releaseId: worklist.releaseId,
    releaseHash: worklist.releaseHash,
    sourceDatasetHash: worklist.sourceDatasetHash,
    mode: 'baseline',
    requireExhaustive: true,
  });

  return overlay;
}

// ---------------------------------------------------------------------------
// Crosswalk worklist + assembly
// ---------------------------------------------------------------------------

export type CrosswalkInventoryDisposition = 'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED';

export interface CrosswalkCandidateEvidence {
  candidateId: string;
  structuralUnitId: string;
  structuralUnitVersion: string;
  structuralUnitHash: string;
  resourceId: string | null;
  segmentId: string | null;
  atomicResourceId: string | null;
  resourceSegmentHash: string | null;
  /**
   * Inventory disposition at capture. Semantic Crosswalk review may still
   * ACCEPT EXCLUDED/UNRESOLVED evidence locations; binding generation must
   * only promote INCLUDED effective resources.
   */
  inventoryDisposition: CrosswalkInventoryDisposition;
  /** Sorted inventory reason codes for audit (not a semantic outcome). */
  reasonCodes: string[];
  title: string | null;
  family: string | null;
  sourcePath: string | null;
  sourceHash: string | null;
  sourceSelector: string | null;
  /** JSON pointer resolved value, when selector targets JSON. */
  selectedJsonValue: unknown | null;
  sourceExcerpt: string | null;
  sourceExcerptHash: string | null;
  reviewAuditLocator: {
    status: string | null;
    reviewerId: string | null;
    reviewBatchId: string | null;
    reviewedSourceHash: string | null;
    reviewedVersionRef: string | null;
  } | null;
  graphNodeRefs: unknown | null;
  generatorRank: number;
}

/**
 * #1124 binding/cutover consumes effective (INCLUDED) resources only.
 * EXCLUDED/audit-only and UNRESOLVED inventory rows may appear in Crosswalk
 * evidence but must not silently become teaching-role binding candidates.
 */
export function isBindingEligibleCrosswalkCandidate(
  candidate: Pick<
    CrosswalkCandidateEvidence,
    | 'inventoryDisposition'
    | 'resourceId'
    | 'segmentId'
    | 'atomicResourceId'
    | 'resourceSegmentHash'
    | 'structuralUnitId'
  >,
): { eligible: true } | { eligible: false; reason: string } {
  if (candidate.inventoryDisposition !== 'INCLUDED') {
    return {
      eligible: false,
      reason: `inventory-disposition:${candidate.inventoryDisposition ?? 'missing'}`,
    };
  }
  if (
    !candidate.resourceId
    || !candidate.segmentId
    || !candidate.atomicResourceId
    || !candidate.resourceSegmentHash
    || !candidate.structuralUnitId
  ) {
    return { eligible: false, reason: 'incomplete-inventory-tuple' };
  }
  return { eligible: true };
}

function structuralCandidateKey(
  candidate: Pick<
    CrosswalkCandidateEvidence,
    'structuralUnitId' | 'structuralUnitVersion' | 'structuralUnitHash'
  >,
): string {
  return [
    candidate.structuralUnitId,
    candidate.structuralUnitVersion,
    candidate.structuralUnitHash,
  ].join('\u001f');
}

/**
 * Build a deterministic lookup from every production candidateId that an
 * assembled active Crosswalk ACCEPT may carry to the worklist candidate
 * evidence it was derived from.
 *
 * Worklist stores candidateIds under the representative upstream; active
 * reviews store per-triple derived IDs. Both must resolve to the same
 * structural evidence without first-candidate or fuzzy fallback.
 */
export function buildCrosswalkDerivedCandidateLookup(
  groups: readonly Pick<
    CrosswalkWorklistGroup,
    'canonicalId' | 'upstreams' | 'candidates'
  >[],
  options?: {
    generatorPromptVersion?: string;
  },
): Map<string, CrosswalkCandidateEvidence> {
  const generatorPromptVersion = options?.generatorPromptVersion
    ?? AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION;
  const byDerivedId = new Map<string, CrosswalkCandidateEvidence>();

  for (const group of groups) {
    if (!group.canonicalId || group.candidates.length === 0) continue;
    const upstreams = group.upstreams ?? [];
    if (upstreams.length === 0) {
      // No upstream projection: still index representative worklist IDs.
      for (const candidate of group.candidates) {
        const existing = byDerivedId.get(candidate.candidateId);
        if (existing && structuralCandidateKey(existing) !== structuralCandidateKey(candidate)) {
          throw new Error(
            `Crosswalk derived-candidate lookup rejected: candidateId ${candidate.candidateId} `
            + `maps to conflicting structural units `
            + `(${structuralCandidateKey(existing)} vs ${structuralCandidateKey(candidate)})`,
          );
        }
        byDerivedId.set(candidate.candidateId, candidate);
      }
      continue;
    }

    for (const candidate of group.candidates) {
      for (const upstream of upstreams) {
        const derivedId = semanticAlignmentCandidateId({
          upstream,
          canonicalId: group.canonicalId,
          structuralUnitId: candidate.structuralUnitId,
          structuralUnitHash: candidate.structuralUnitHash,
          generatorPromptVersion,
        });
        const existing = byDerivedId.get(derivedId);
        if (existing && structuralCandidateKey(existing) !== structuralCandidateKey(candidate)) {
          throw new Error(
            `Crosswalk derived-candidate lookup rejected: derived candidateId ${derivedId} `
            + `maps to conflicting structural units `
            + `(${structuralCandidateKey(existing)} vs ${structuralCandidateKey(candidate)})`,
          );
        }
        byDerivedId.set(derivedId, candidate);
      }
      // Also keep the worklist-native representative id (may equal one derived id).
      const existingNative = byDerivedId.get(candidate.candidateId);
      if (
        existingNative
        && structuralCandidateKey(existingNative) !== structuralCandidateKey(candidate)
      ) {
        throw new Error(
          `Crosswalk derived-candidate lookup rejected: worklist candidateId ${candidate.candidateId} `
          + `maps to conflicting structural units `
          + `(${structuralCandidateKey(existingNative)} vs ${structuralCandidateKey(candidate)})`,
        );
      }
      byDerivedId.set(candidate.candidateId, candidate);
    }
  }

  return byDerivedId;
}

export interface CrosswalkWorklistGroup {
  /** Stable group key (= canonicalId for profile-grouped reviews). */
  groupId: string;
  canonicalId: string;
  profile: {
    entityType: string | null;
    conceptKind: string | null;
    semanticName: string | null;
    displayName: string | null;
    description: string | null;
  };
  profileDigest: string;
  /** All upstream triples that will receive this group's decision. */
  tripleKeys: string[];
  upstreams: OpaqueUpstreamRagReference[];
  /**
   * When CourseCoverage active ledger is present, excluded objects are offered
   * as explicit unsupported *candidates* — never auto-decided by the generator.
   */
  coverageRoleHint: CourseCoverageRole | null;
  coverageExcluded: boolean;
  candidates: CrosswalkCandidateEvidence[];
  groupInputDigest: string;
}

export interface CrosswalkWorklistDocument {
  schemaVersion: typeof CROSSWALK_WORKLIST_SCHEMA_VERSION;
  generatorVersion: typeof CROSSWALK_WORKLIST_GENERATOR_VERSION;
  deltaReceiptId: string;
  authoringRevision: string;
  inventoryRunId: string;
  releaseSetId: string;
  releaseId: string;
  runtimeProjectionArtifactPath: string;
  runtimeProjectionArtifactHash: string;
  structuralIndexVersion: string | null;
  objectTripleCount: number;
  relationTripleCount: number;
  groupCount: number;
  inputDigest: string;
  groups: CrosswalkWorklistGroup[];
}

export interface CrosswalkReviewDecision {
  /** Matches groupId (= canonicalId). Applies to all tripleKeys in the group. */
  groupId: string;
  outcome: CrosswalkReviewOutcome;
  /** Required when outcome === ACCEPT; must exist in the group's worklist candidates. */
  candidateId?: string;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
  rationale: string;
  decisionDigest: string;
}

export interface CrosswalkReviewDecisionsDocument {
  schemaVersion: typeof CROSSWALK_REVIEW_DECISIONS_SCHEMA_VERSION;
  worklistInputDigest: string;
  deltaReceiptId: string;
  authoringRevision: string;
  reviewProvider: ReviewProvider;
  reviewerIdentity: string;
  reviewerPromptVersion: string;
  decisions: CrosswalkReviewDecision[];
}

export interface ActiveCrosswalkReviewsDocument {
  schemaVersion: typeof ACTIVE_CROSSWALK_REVIEWS_SCHEMA_VERSION;
  deltaReceiptId: string;
  authoringRevision: string;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  worklistInputDigest: string;
  reviews: Record<string, {
    outcome: CrosswalkReviewOutcome;
    reviewIdentity: string;
    reviewerPromptVersion: string;
    evidenceDigest: string;
    rationale: string;
    candidateId?: string;
    groupId: string;
  }>;
  summary: {
    objectTriples: number;
    relationTriples: number;
    groupCount: number;
    reviewCount: number;
    outcomeCounts: Record<string, number>;
  };
}

export function crosswalkGroupInputDigest(
  group: Omit<CrosswalkWorklistGroup, 'groupInputDigest'>,
): string {
  return sha256Canonical({
    groupId: group.groupId,
    canonicalId: group.canonicalId,
    profile: group.profile,
    profileDigest: group.profileDigest,
    tripleKeys: [...group.tripleKeys].sort(),
    upstreams: group.upstreams,
    coverageRoleHint: group.coverageRoleHint,
    coverageExcluded: group.coverageExcluded,
    candidates: group.candidates,
  });
}

export function crosswalkWorklistInputDigest(
  doc: Omit<CrosswalkWorklistDocument, 'inputDigest'>,
): string {
  return sha256Canonical({
    schemaVersion: doc.schemaVersion,
    generatorVersion: doc.generatorVersion,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    inventoryRunId: doc.inventoryRunId,
    releaseSetId: doc.releaseSetId,
    releaseId: doc.releaseId,
    runtimeProjectionArtifactPath: doc.runtimeProjectionArtifactPath,
    runtimeProjectionArtifactHash: doc.runtimeProjectionArtifactHash,
    structuralIndexVersion: doc.structuralIndexVersion,
    objectTripleCount: doc.objectTripleCount,
    relationTripleCount: doc.relationTripleCount,
    groupCount: doc.groupCount,
    groups: doc.groups.map((group) => ({
      groupId: group.groupId,
      groupInputDigest: group.groupInputDigest,
    })),
  });
}

export function finalizeCrosswalkWorklist(
  doc: Omit<CrosswalkWorklistDocument, 'inputDigest'>,
): CrosswalkWorklistDocument {
  const groups = [...doc.groups]
    .map((group) => {
      const base: Omit<CrosswalkWorklistGroup, 'groupInputDigest'> = {
        groupId: group.groupId,
        canonicalId: group.canonicalId,
        profile: group.profile,
        profileDigest: group.profileDigest,
        tripleKeys: [...group.tripleKeys].sort(),
        upstreams: [...group.upstreams].sort((a, b) => (
          tripleKey(a).localeCompare(tripleKey(b), 'en')
        )),
        coverageRoleHint: group.coverageRoleHint,
        coverageExcluded: group.coverageExcluded,
        candidates: [...group.candidates]
          .map((candidate) => ({
            ...candidate,
            reasonCodes: [...(candidate.reasonCodes ?? [])].sort((a, b) => (
              a.localeCompare(b, 'en')
            )),
          }))
          .sort((a, b) => (
            a.generatorRank - b.generatorRank
            || a.candidateId.localeCompare(b.candidateId, 'en')
          )),
      };
      return {
        ...base,
        groupInputDigest: crosswalkGroupInputDigest(base),
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId, 'en'));

  const withoutDigest: Omit<CrosswalkWorklistDocument, 'inputDigest'> = {
    schemaVersion: CROSSWALK_WORKLIST_SCHEMA_VERSION,
    generatorVersion: CROSSWALK_WORKLIST_GENERATOR_VERSION,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    inventoryRunId: doc.inventoryRunId,
    releaseSetId: doc.releaseSetId,
    releaseId: doc.releaseId,
    runtimeProjectionArtifactPath: doc.runtimeProjectionArtifactPath,
    runtimeProjectionArtifactHash: doc.runtimeProjectionArtifactHash,
    structuralIndexVersion: doc.structuralIndexVersion,
    objectTripleCount: doc.objectTripleCount,
    relationTripleCount: doc.relationTripleCount,
    groupCount: groups.length,
    groups,
  };
  assertNoFinalSemanticOutcomes(withoutDigest, 'crosswalk worklist');
  return {
    ...withoutDigest,
    inputDigest: crosswalkWorklistInputDigest(withoutDigest),
  };
}

export function crosswalkDecisionDigest(input: {
  groupInputDigest: string;
  groupId: string;
  outcome: CrosswalkReviewOutcome;
  candidateId?: string;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
  rationale: string;
}): string {
  return sha256Canonical({
    groupInputDigest: input.groupInputDigest,
    groupId: input.groupId,
    outcome: input.outcome,
    candidateId: input.candidateId ?? null,
    reviewIdentity: input.reviewIdentity,
    reviewProvider: input.reviewProvider,
    reviewerPromptVersion: input.reviewerPromptVersion,
    rationale: input.rationale,
  });
}

export function assembleCrosswalkFromReview(input: {
  worklist: CrosswalkWorklistDocument;
  review: CrosswalkReviewDecisionsDocument;
}): ActiveCrosswalkReviewsDocument {
  const { worklist, review } = input;
  if (worklist.schemaVersion !== CROSSWALK_WORKLIST_SCHEMA_VERSION) {
    throw new Error('Crosswalk assemble rejected: worklist schemaVersion invalid');
  }
  if (review.schemaVersion !== CROSSWALK_REVIEW_DECISIONS_SCHEMA_VERSION) {
    throw new Error('Crosswalk assemble rejected: review schemaVersion invalid');
  }
  if (review.worklistInputDigest !== worklist.inputDigest) {
    throw new Error('Crosswalk assemble rejected: worklistInputDigest mismatch');
  }
  if (review.deltaReceiptId !== worklist.deltaReceiptId) {
    throw new Error('Crosswalk assemble rejected: deltaReceiptId drift');
  }
  if (review.authoringRevision !== worklist.authoringRevision) {
    throw new Error('Crosswalk assemble rejected: authoringRevision drift');
  }
  assertProductionDeltaReceiptId(worklist.deltaReceiptId);
  if (!isAllowedReviewProvider(review.reviewProvider) || review.reviewProvider === 'NONE') {
    throw new Error('Crosswalk assemble rejected: reviewProvider invalid');
  }
  assertNotGeneratorAsReviewer(review.reviewerIdentity, 'crosswalk review document');

  const byGroup = new Map(worklist.groups.map((group) => [group.groupId, group]));
  if (byGroup.size !== worklist.groups.length) {
    throw new Error('Crosswalk assemble rejected: worklist has duplicate groupIds');
  }
  if (review.decisions.length !== worklist.groups.length) {
    throw new Error(
      `Crosswalk assemble rejected: expected ${worklist.groups.length} group decisions, got ${review.decisions.length}`,
    );
  }

  const seen = new Set<string>();
  const reviews: ActiveCrosswalkReviewsDocument['reviews'] = {};
  const outcomeCounts: Record<string, number> = {};

  for (const decision of review.decisions) {
    if (seen.has(decision.groupId)) {
      throw new Error(`Crosswalk assemble rejected: duplicate decision for group ${decision.groupId}`);
    }
    seen.add(decision.groupId);
    const group = byGroup.get(decision.groupId);
    if (!group) {
      throw new Error(`Crosswalk assemble rejected: unknown groupId ${decision.groupId}`);
    }
    if (!isCrosswalkOutcome(decision.outcome)) {
      throw new Error(`Crosswalk assemble rejected: invalid outcome for ${decision.groupId}`);
    }
    if (!decision.rationale?.trim()) {
      throw new Error(`Crosswalk assemble rejected: rationale required for ${decision.groupId}`);
    }
    if (!isAllowedReviewProvider(decision.reviewProvider) || decision.reviewProvider === 'NONE') {
      throw new Error(`Crosswalk assemble rejected: invalid provider for ${decision.groupId}`);
    }
    if (decision.reviewProvider !== review.reviewProvider) {
      throw new Error(`Crosswalk assemble rejected: provider drift for ${decision.groupId}`);
    }
    assertNotGeneratorAsReviewer(decision.reviewIdentity, decision.groupId);
    if (decision.reviewIdentity !== review.reviewerIdentity) {
      throw new Error(`Crosswalk assemble rejected: identity drift for ${decision.groupId}`);
    }
    if (decision.reviewerPromptVersion !== review.reviewerPromptVersion) {
      throw new Error(`Crosswalk assemble rejected: prompt version drift for ${decision.groupId}`);
    }

    // Group-level decision candidateId is the worklist representative (generated
    // with upstreams[0]). It validates the reviewed structural unit, not every
    // triple's production candidateId.
    const decisionCandidateId = decision.candidateId?.trim() || undefined;
    let acceptedUnit: Pick<
      CrosswalkCandidateEvidence,
      'structuralUnitId' | 'structuralUnitVersion' | 'structuralUnitHash'
    > | null = null;
    if (decision.outcome === 'ACCEPT') {
      if (!decisionCandidateId) {
        throw new Error(`Crosswalk assemble rejected: ACCEPT requires candidateId for ${decision.groupId}`);
      }
      const worklistCandidate = group.candidates.find(
        (row) => row.candidateId === decisionCandidateId,
      );
      if (!worklistCandidate) {
        throw new Error(
          `Crosswalk assemble rejected: candidateId ${decisionCandidateId} not in worklist for ${decision.groupId}`,
        );
      }
      acceptedUnit = worklistCandidate;
    } else if (decisionCandidateId) {
      if (!group.candidates.some((row) => row.candidateId === decisionCandidateId)) {
        throw new Error(
          `Crosswalk assemble rejected: non-ACCEPT candidateId not in worklist for ${decision.groupId}`,
        );
      }
    }

    const expectedDigest = crosswalkDecisionDigest({
      groupInputDigest: group.groupInputDigest,
      groupId: decision.groupId,
      outcome: decision.outcome,
      candidateId: decisionCandidateId,
      reviewIdentity: decision.reviewIdentity,
      reviewProvider: decision.reviewProvider,
      reviewerPromptVersion: decision.reviewerPromptVersion,
      rationale: decision.rationale,
    });
    if (decision.decisionDigest !== expectedDigest) {
      throw new Error(`Crosswalk assemble rejected: decisionDigest mismatch for ${decision.groupId}`);
    }

    // Map tripleKey → upstream by identity (not array index) so finalize sorting
    // cannot desynchronize keys from upstream triples.
    const upstreamByKey = new Map(
      group.upstreams.map((upstream) => [tripleKey(upstream), upstream] as const),
    );
    if (upstreamByKey.size !== group.upstreams.length) {
      throw new Error(
        `Crosswalk assemble rejected: duplicate upstream triples in group ${decision.groupId}`,
      );
    }
    for (const key of group.tripleKeys) {
      if (!upstreamByKey.has(key)) {
        throw new Error(
          `Crosswalk assemble rejected: triple key ${key} missing matching upstream in group ${decision.groupId}`,
        );
      }
    }

    outcomeCounts[decision.outcome] = (outcomeCounts[decision.outcome] ?? 0) + group.tripleKeys.length;

    for (const key of group.tripleKeys) {
      if (reviews[key]) {
        throw new Error(`Crosswalk assemble rejected: duplicate triple key ${key}`);
      }
      const upstream = upstreamByKey.get(key)!;

      // ACCEPT: derive per-triple candidateId with the triple's real upstream
      // and the group-reviewed structural unit. Non-ACCEPT: do not manufacture
      // candidateIds (production leaves those triples unresolved).
      let tripleCandidateId: string | undefined;
      if (decision.outcome === 'ACCEPT' && acceptedUnit) {
        tripleCandidateId = semanticAlignmentCandidateId({
          upstream,
          canonicalId: group.canonicalId,
          structuralUnitId: acceptedUnit.structuralUnitId,
          structuralUnitHash: acceptedUnit.structuralUnitHash,
          generatorPromptVersion: AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
        });
      }

      // Per-triple evidence digest binds exact triple identity + derived id.
      const evidenceDigest = sha256Canonical({
        groupInputDigest: group.groupInputDigest,
        tripleKey: key,
        upstream,
        outcome: decision.outcome,
        candidateId: tripleCandidateId ?? null,
        structuralUnitId: acceptedUnit?.structuralUnitId ?? null,
        structuralUnitVersion: acceptedUnit?.structuralUnitVersion ?? null,
        structuralUnitHash: acceptedUnit?.structuralUnitHash ?? null,
        reviewIdentity: decision.reviewIdentity,
        rationale: decision.rationale,
      });
      if (!SHA256.test(evidenceDigest)) {
        throw new Error(`Crosswalk assemble rejected: evidenceDigest invalid for ${key}`);
      }

      reviews[key] = {
        outcome: decision.outcome,
        reviewIdentity: decision.reviewIdentity,
        reviewerPromptVersion: decision.reviewerPromptVersion,
        evidenceDigest,
        rationale: decision.rationale,
        candidateId: tripleCandidateId,
        groupId: decision.groupId,
      };
    }
  }

  for (const groupId of byGroup.keys()) {
    if (!seen.has(groupId)) {
      throw new Error(`Crosswalk assemble rejected: missing decision for group ${groupId}`);
    }
  }

  const expectedTripleCount = worklist.groups.reduce((sum, group) => sum + group.tripleKeys.length, 0);
  if (Object.keys(reviews).length !== expectedTripleCount) {
    throw new Error(
      `Crosswalk assemble rejected: review triple count ${Object.keys(reviews).length} != expected ${expectedTripleCount}`,
    );
  }

  return {
    schemaVersion: ACTIVE_CROSSWALK_REVIEWS_SCHEMA_VERSION,
    deltaReceiptId: worklist.deltaReceiptId,
    authoringRevision: worklist.authoringRevision,
    reviewIdentity: review.reviewerIdentity,
    reviewProvider: review.reviewProvider,
    worklistInputDigest: worklist.inputDigest,
    reviews,
    summary: {
      objectTriples: worklist.objectTripleCount,
      relationTriples: worklist.relationTripleCount,
      groupCount: worklist.groupCount,
      reviewCount: Object.keys(reviews).length,
      outcomeCounts,
    },
  };
}

// ---------------------------------------------------------------------------
// Binding worklist + assembly
// ---------------------------------------------------------------------------

export interface BindingWorklistItem {
  pairId: string;
  canonicalId: string;
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  atomicResourceId: string | null;
  profile: {
    entityType: string | null;
    conceptKind: string | null;
    semanticName: string | null;
    displayName: string | null;
    description: string | null;
  };
  resourceEvidence: {
    title: string | null;
    family: string | null;
    sourcePath: string | null;
    sourceHash: string | null;
    sourceSelector: string | null;
    sourceExcerpt: string | null;
    sourceExcerptHash: string | null;
    graphNodeRefs: unknown | null;
    reviewAuditLocator: {
      status: string | null;
      reviewerId: string | null;
      reviewBatchId: string | null;
      reviewedSourceHash: string | null;
    } | null;
  };
  /** Allowed roles only — no suggested/chosen role. */
  allowedRoles: readonly AllowedBindingRole[];
  itemInputDigest: string;
}

export interface BindingWorklistDocument {
  schemaVersion: typeof BINDING_WORKLIST_SCHEMA_VERSION;
  generatorVersion: typeof BINDING_WORKLIST_GENERATOR_VERSION;
  deltaReceiptId: string;
  authoringRevision: string;
  inventoryRunId: string;
  crosswalkWorklistInputDigest: string;
  crosswalkActiveReviewsDigest: string;
  inputDigest: string;
  items: BindingWorklistItem[];
}

export interface BindingReviewDecision {
  pairId: string;
  outcome: BindingReviewOutcome;
  /** Required when outcome === ACCEPT. */
  proposedRole?: AllowedBindingRole;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
  evidenceIds: string[];
  rationale: string;
  decisionDigest: string;
}

export interface BindingReviewDecisionsDocument {
  schemaVersion: typeof BINDING_REVIEW_DECISIONS_SCHEMA_VERSION;
  worklistInputDigest: string;
  deltaReceiptId: string;
  authoringRevision: string;
  reviewProvider: ReviewProvider;
  reviewerIdentity: string;
  reviewerPromptVersion: string;
  decisions: BindingReviewDecision[];
}

export interface ActiveBindingReviewsDocument {
  schemaVersion: typeof ACTIVE_BINDING_REVIEWS_SCHEMA_VERSION;
  deltaReceiptId: string;
  authoringRevision: string;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  worklistInputDigest: string;
  reviews: Record<string, {
    outcome: BindingReviewOutcome;
    proposedRole: AllowedBindingRole;
    reviewIdentity: string;
    reviewerPromptVersion: string;
    evidenceDigest: string;
    evidenceIds?: string[];
    rationale: string;
    reviewProvider: ReviewProvider;
  }>;
  summary: {
    candidates: number;
    outcomeCounts: Record<string, number>;
    roleDistribution: Record<string, number>;
  };
}

export function bindingItemInputDigest(
  item: Omit<BindingWorklistItem, 'itemInputDigest'>,
): string {
  return sha256Canonical({
    pairId: item.pairId,
    canonicalId: item.canonicalId,
    resourceId: item.resourceId,
    structuralUnitId: item.structuralUnitId,
    segmentId: item.segmentId,
    resourceSegmentHash: item.resourceSegmentHash,
    atomicResourceId: item.atomicResourceId,
    profile: item.profile,
    resourceEvidence: item.resourceEvidence,
    allowedRoles: item.allowedRoles,
  });
}

export function bindingWorklistInputDigest(
  doc: Omit<BindingWorklistDocument, 'inputDigest'>,
): string {
  return sha256Canonical({
    schemaVersion: doc.schemaVersion,
    generatorVersion: doc.generatorVersion,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    inventoryRunId: doc.inventoryRunId,
    crosswalkWorklistInputDigest: doc.crosswalkWorklistInputDigest,
    crosswalkActiveReviewsDigest: doc.crosswalkActiveReviewsDigest,
    items: doc.items.map((item) => ({
      pairId: item.pairId,
      itemInputDigest: item.itemInputDigest,
    })),
  });
}

export function finalizeBindingWorklist(
  doc: Omit<BindingWorklistDocument, 'inputDigest'>,
): BindingWorklistDocument {
  const items = [...doc.items]
    .map((item) => {
      const base: Omit<BindingWorklistItem, 'itemInputDigest'> = {
        pairId: item.pairId,
        canonicalId: item.canonicalId,
        resourceId: item.resourceId,
        structuralUnitId: item.structuralUnitId,
        segmentId: item.segmentId,
        resourceSegmentHash: item.resourceSegmentHash,
        atomicResourceId: item.atomicResourceId,
        profile: item.profile,
        resourceEvidence: item.resourceEvidence,
        allowedRoles: [...ALLOWED_BINDING_ROLES],
      };
      return {
        ...base,
        itemInputDigest: bindingItemInputDigest(base),
      };
    })
    .sort((a, b) => a.pairId.localeCompare(b.pairId, 'en'));

  const withoutDigest: Omit<BindingWorklistDocument, 'inputDigest'> = {
    schemaVersion: BINDING_WORKLIST_SCHEMA_VERSION,
    generatorVersion: BINDING_WORKLIST_GENERATOR_VERSION,
    deltaReceiptId: doc.deltaReceiptId,
    authoringRevision: doc.authoringRevision,
    inventoryRunId: doc.inventoryRunId,
    crosswalkWorklistInputDigest: doc.crosswalkWorklistInputDigest,
    crosswalkActiveReviewsDigest: doc.crosswalkActiveReviewsDigest,
    items,
  };
  assertNoFinalSemanticOutcomes(withoutDigest, 'binding worklist');
  return {
    ...withoutDigest,
    inputDigest: bindingWorklistInputDigest(withoutDigest),
  };
}

export function bindingDecisionDigest(input: {
  itemInputDigest: string;
  pairId: string;
  outcome: BindingReviewOutcome;
  proposedRole?: AllowedBindingRole;
  reviewIdentity: string;
  reviewProvider: ReviewProvider;
  reviewerPromptVersion: string;
  evidenceIds: readonly string[];
  rationale: string;
}): string {
  return sha256Canonical({
    itemInputDigest: input.itemInputDigest,
    pairId: input.pairId,
    outcome: input.outcome,
    proposedRole: input.proposedRole ?? null,
    reviewIdentity: input.reviewIdentity,
    reviewProvider: input.reviewProvider,
    reviewerPromptVersion: input.reviewerPromptVersion,
    evidenceIds: [...input.evidenceIds].sort(),
    rationale: input.rationale,
  });
}

export function assembleBindingFromReview(input: {
  worklist: BindingWorklistDocument;
  review: BindingReviewDecisionsDocument;
}): ActiveBindingReviewsDocument {
  const { worklist, review } = input;
  if (worklist.schemaVersion !== BINDING_WORKLIST_SCHEMA_VERSION) {
    throw new Error('Binding assemble rejected: worklist schemaVersion invalid');
  }
  if (review.schemaVersion !== BINDING_REVIEW_DECISIONS_SCHEMA_VERSION) {
    throw new Error('Binding assemble rejected: review schemaVersion invalid');
  }
  if (review.worklistInputDigest !== worklist.inputDigest) {
    throw new Error('Binding assemble rejected: worklistInputDigest mismatch');
  }
  if (review.deltaReceiptId !== worklist.deltaReceiptId) {
    throw new Error('Binding assemble rejected: deltaReceiptId drift');
  }
  if (review.authoringRevision !== worklist.authoringRevision) {
    throw new Error('Binding assemble rejected: authoringRevision drift');
  }
  assertProductionDeltaReceiptId(worklist.deltaReceiptId);
  if (!isAllowedReviewProvider(review.reviewProvider) || review.reviewProvider === 'NONE') {
    throw new Error('Binding assemble rejected: reviewProvider invalid');
  }
  assertNotGeneratorAsReviewer(review.reviewerIdentity, 'binding review document');

  const byPair = new Map(worklist.items.map((item) => [item.pairId, item]));
  if (byPair.size !== worklist.items.length) {
    throw new Error('Binding assemble rejected: worklist has duplicate pairIds');
  }
  if (review.decisions.length !== worklist.items.length) {
    throw new Error(
      `Binding assemble rejected: expected ${worklist.items.length} decisions, got ${review.decisions.length}`,
    );
  }

  const seen = new Set<string>();
  const reviews: ActiveBindingReviewsDocument['reviews'] = {};
  const outcomeCounts: Record<string, number> = {};
  const roleDistribution: Record<string, number> = {};

  for (const decision of review.decisions) {
    if (seen.has(decision.pairId)) {
      throw new Error(`Binding assemble rejected: duplicate decision for ${decision.pairId}`);
    }
    seen.add(decision.pairId);
    const item = byPair.get(decision.pairId);
    if (!item) {
      throw new Error(`Binding assemble rejected: unknown pairId ${decision.pairId}`);
    }
    if (!isBindingOutcome(decision.outcome)) {
      throw new Error(`Binding assemble rejected: invalid outcome for ${decision.pairId}`);
    }
    if (!decision.rationale?.trim()) {
      throw new Error(`Binding assemble rejected: rationale required for ${decision.pairId}`);
    }
    if (!isAllowedReviewProvider(decision.reviewProvider) || decision.reviewProvider === 'NONE') {
      throw new Error(`Binding assemble rejected: invalid provider for ${decision.pairId}`);
    }
    if (decision.reviewProvider !== review.reviewProvider) {
      throw new Error(`Binding assemble rejected: provider drift for ${decision.pairId}`);
    }
    assertNotGeneratorAsReviewer(decision.reviewIdentity, decision.pairId);
    if (decision.reviewIdentity !== review.reviewerIdentity) {
      throw new Error(`Binding assemble rejected: identity drift for ${decision.pairId}`);
    }
    if (decision.reviewerPromptVersion !== review.reviewerPromptVersion) {
      throw new Error(`Binding assemble rejected: prompt version drift for ${decision.pairId}`);
    }

    let proposedRole: AllowedBindingRole = 'REFERENCES';
    if (decision.outcome === 'ACCEPT') {
      if (!decision.proposedRole || !isAllowedBindingRole(decision.proposedRole)) {
        throw new Error(
          `Binding assemble rejected: ACCEPT requires allowed proposedRole for ${decision.pairId}`,
        );
      }
      if (!item.allowedRoles.includes(decision.proposedRole)) {
        throw new Error(
          `Binding assemble rejected: proposedRole not allowed for ${decision.pairId}`,
        );
      }
      proposedRole = decision.proposedRole;
      roleDistribution[proposedRole] = (roleDistribution[proposedRole] ?? 0) + 1;
    } else if (decision.proposedRole != null) {
      if (!isAllowedBindingRole(decision.proposedRole)) {
        throw new Error(
          `Binding assemble rejected: invalid proposedRole for non-ACCEPT ${decision.pairId}`,
        );
      }
      proposedRole = decision.proposedRole;
    }

    const evidenceIds = [...new Set(decision.evidenceIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (evidenceIds.length === 0) {
      throw new Error(`Binding assemble rejected: evidenceIds required for ${decision.pairId}`);
    }
    // Allowed evidence is the pair's own resource identity anchors.
    const allowedEvidence = new Set([
      item.pairId,
      item.resourceId,
      item.structuralUnitId,
      item.segmentId,
      item.resourceSegmentHash,
      item.atomicResourceId ?? '',
      item.resourceEvidence.sourceExcerptHash ?? '',
      item.resourceEvidence.sourceHash ?? '',
    ].filter(Boolean));
    for (const evidenceId of evidenceIds) {
      if (!allowedEvidence.has(evidenceId)) {
        throw new Error(
          `Binding assemble rejected: evidenceId ${evidenceId} not present in worklist for ${decision.pairId}`,
        );
      }
    }

    const expectedDigest = bindingDecisionDigest({
      itemInputDigest: item.itemInputDigest,
      pairId: decision.pairId,
      outcome: decision.outcome,
      proposedRole: decision.outcome === 'ACCEPT' ? proposedRole : decision.proposedRole,
      reviewIdentity: decision.reviewIdentity,
      reviewProvider: decision.reviewProvider,
      reviewerPromptVersion: decision.reviewerPromptVersion,
      evidenceIds,
      rationale: decision.rationale,
    });
    if (decision.decisionDigest !== expectedDigest) {
      throw new Error(`Binding assemble rejected: decisionDigest mismatch for ${decision.pairId}`);
    }

    const evidenceDigest = sha256Canonical({
      itemInputDigest: item.itemInputDigest,
      outcome: decision.outcome,
      proposedRole,
      evidenceIds,
      reviewIdentity: decision.reviewIdentity,
      rationale: decision.rationale,
    });

    outcomeCounts[decision.outcome] = (outcomeCounts[decision.outcome] ?? 0) + 1;
    reviews[decision.pairId] = {
      outcome: decision.outcome,
      proposedRole,
      reviewIdentity: decision.reviewIdentity,
      reviewerPromptVersion: decision.reviewerPromptVersion,
      evidenceDigest,
      evidenceIds,
      rationale: decision.rationale,
      reviewProvider: decision.reviewProvider,
    };
  }

  for (const pairId of byPair.keys()) {
    if (!seen.has(pairId)) {
      throw new Error(`Binding assemble rejected: missing decision for ${pairId}`);
    }
  }

  return {
    schemaVersion: ACTIVE_BINDING_REVIEWS_SCHEMA_VERSION,
    deltaReceiptId: worklist.deltaReceiptId,
    authoringRevision: worklist.authoringRevision,
    reviewIdentity: review.reviewerIdentity,
    reviewProvider: review.reviewProvider,
    worklistInputDigest: worklist.inputDigest,
    reviews,
    summary: {
      candidates: worklist.items.length,
      outcomeCounts,
      roleDistribution,
    },
  };
}

/** Re-export role list for worklist generators that need allowed-role constants. */
export { COURSE_COVERAGE_ROLES, dispositionEvidenceDigest };

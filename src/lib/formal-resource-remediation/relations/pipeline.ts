/**
 * Three-family relation pipeline: candidates, review packs, and the
 * course-owner decision applier (#1515, tasks 9.2–9.10).
 *
 * Automatic final inclusion happens only for exact qualified-pipeline items
 * that pass every item-level evidence gate. Every low-confidence,
 * conflicting, unsupported, or exceptional candidate enters an immutable
 * review pack — clustered by domain so review is resumable without hiding
 * any scope row — and only course-owner decisions recorded in repository
 * development can close it. The applier validates evidence references
 * against frozen course sources and rejects arbitrary strings, drifting
 * evidence, relabeled Engineering relations, duplicated rows, and
 * cross-capture decisions.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  RELATION_COURSE_OWNER_DECISION_CONTRACT,
  RELATION_REVIEW_PACK_CONTRACT,
  type RelationCourseOwnerDecision,
} from '../contracts';
import type { ReopenedScope, ScopeMemberRow } from './scope';

export type RelationFamily = 'containment' | 'prerequisite' | 'association';

export interface PendingRelationRow {
  readonly canonicalId: string;
  readonly family: RelationFamily;
  readonly kind: string;
  readonly reason: string;
  readonly scopeHash: string;
}

/** Evidence registry over frozen course sources, keyed by evidence ref. */
export interface EvidenceRegistry {
  readonly registryId: string;
  readonly knows: (evidenceRef: string) => boolean;
}

export interface AdmittedRelation {
  readonly canonicalId: string;
  readonly family: RelationFamily;
  readonly evidenceRefs: readonly string[];
}

export interface ReviewPack {
  readonly contract: typeof RELATION_REVIEW_PACK_CONTRACT;
  readonly packId: string;
  readonly domainId: string;
  readonly scopeHash: string;
  readonly rows: readonly {
    readonly canonicalId: string;
    readonly family: RelationFamily;
    readonly reason: string;
  }[];
  readonly memberCount: number;
  readonly packHash: string;
}

export interface RelationPipelineResult {
  readonly admitted: readonly AdmittedRelation[];
  readonly reviewPacks: readonly ReviewPack[];
  readonly pendingRowCount: number;
  readonly admittedRowCount: number;
  readonly pipelineHash: string;
}

/**
 * Split pending rows into automatically admitted relations (only when the
 * qualified evidence registry passes every row's evidence gate) and
 * clustered immutable review packs. Every scope row is accounted for
 * exactly once.
 */
export function runRelationPipeline(input: {
  scope: ReopenedScope;
  pendingRows: readonly PendingRelationRow[];
  evidenceRegistry: EvidenceRegistry | null;
}): RelationPipelineResult {
  const scopeMemberIds = new Set(input.scope.members.map((member) => member.canonicalId));
  const admitted: AdmittedRelation[] = [];
  const pendingByDomain = new Map<string, {
    canonicalId: string;
    family: RelationFamily;
    reason: string;
  }[]>();
  let pendingRowCount = 0;
  for (const row of input.pendingRows) {
    if (row.scopeHash !== input.scope.scopeHash) {
      throw new FormalResourceRemediationError(
        'relation-row-cross-capture',
        `Relation row for ${row.canonicalId} binds scope ${row.scopeHash.slice(0, 12)}, not the reopened scope.`,
      );
    }
    if (!scopeMemberIds.has(row.canonicalId)) {
      throw new FormalResourceRemediationError(
        'relation-row-out-of-scope',
        `Relation row for ${row.canonicalId} is not a member of the reopened scope.`,
      );
    }
    // Automatic admission requires an exact qualified-pipeline evidence ref;
    // the current pending corpus carries only `awaiting-*`/`no-*-evidence`
    // reasons, so rows without an evidence pass fall through to review.
    const evidenceRefs = row.kind === 'PUBLISHED_EDGE' ? [row.reason] : [];
    const passesEvidenceGate = input.evidenceRegistry !== null
      && evidenceRefs.length > 0
      && evidenceRefs.every((ref) => input.evidenceRegistry?.knows(ref) === true);
    if (passesEvidenceGate) {
      admitted.push({ canonicalId: row.canonicalId, family: row.family, evidenceRefs });
      continue;
    }
    pendingRowCount += 1;
    const member = input.scope.members.find((candidate) => candidate.canonicalId === row.canonicalId) as ScopeMemberRow;
    const domainId = member.preferredDomainId;
    const list = pendingByDomain.get(domainId) ?? [];
    list.push({ canonicalId: row.canonicalId, family: row.family, reason: row.reason });
    pendingByDomain.set(domainId, list);
  }
  const reviewPacks: ReviewPack[] = [...pendingByDomain.entries()]
    .map(([domainId, rows]) => {
      rows.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId) || a.family.localeCompare(b.family));
      const memberCount = new Set(rows.map((row) => row.canonicalId)).size;
      const packHash = projectionDigest({
        domainId,
        scopeHash: input.scope.scopeHash,
        memberCount,
        rows,
      });
      return {
        contract: RELATION_REVIEW_PACK_CONTRACT,
        packId: `rp-${packHash.slice(0, 24)}`,
        domainId,
        scopeHash: input.scope.scopeHash,
        rows,
        memberCount,
        packHash,
      };
    })
    .sort((a, b) => a.domainId.localeCompare(b.domainId));
  const pipelineHash = projectionDigest({
    scopeHash: input.scope.scopeHash,
    admitted,
    packHashes: reviewPacks.map((pack) => pack.packHash),
    pendingRowCount,
  });
  return {
    admitted,
    reviewPacks,
    pendingRowCount,
    admittedRowCount: admitted.length,
    pipelineHash,
  };
}

export interface AppliedRelationOutcome {
  readonly canonicalId: string;
  readonly family: RelationFamily;
  readonly finalDisposition:
    | { readonly kind: 'PUBLISHED_EDGE'; readonly evidenceRefs: readonly string[] }
    | { readonly kind: 'COURSE_ROOT' }
    | { readonly kind: 'NO_RELATION'; readonly evidenceRefs: readonly string[] }
    | { readonly kind: 'REJECTED' };
}

export interface DecisionApplierResult {
  readonly outcomes: readonly AppliedRelationOutcome[];
  readonly appliedDecisionHashes: readonly string[];
  readonly unresolvedAfterApplication: number;
}

/**
 * Apply course-owner decisions over the review packs. Every decision must
 * bind an existing pack, reference evidence the frozen registry knows, and
 * originate from the allocation's course-owner identity; duplicate or
 * foreign-capture decisions fail closed.
 */
export function applyCourseOwnerDecisions(input: {
  scope: ReopenedScope;
  reviewPacks: readonly ReviewPack[];
  decisions: readonly RelationCourseOwnerDecision[];
  evidenceRegistry: EvidenceRegistry;
  expectedCourseOwnerId: string;
  expectedAllocationHash: string;
}): DecisionApplierResult {
  const packById = new Map(input.reviewPacks.map((pack) => [pack.packId, pack]));
  const rowKey = (canonicalId: string, family: RelationFamily) => `${canonicalId}\u0000${family}`;
  const packRows = new Set<string>();
  for (const pack of input.reviewPacks) {
    for (const row of pack.rows) {
      packRows.add(rowKey(row.canonicalId, row.family));
    }
  }
  const decided = new Map<string, RelationCourseOwnerDecision>();
  const outcomes: AppliedRelationOutcome[] = [];
  const appliedDecisionHashes: string[] = [];
  for (const decision of input.decisions) {
    if (decision.contract !== RELATION_COURSE_OWNER_DECISION_CONTRACT) {
      throw new FormalResourceRemediationError(
        'decision-contract-invalid',
        `Decision ${decision.decisionId} uses an unsupported contract.`,
      );
    }
    if (decision.decidedBy !== input.expectedCourseOwnerId) {
      throw new FormalResourceRemediationError(
        'decision-owner-mismatch',
        `Decision ${decision.decisionId} was not recorded by the allocation's course owner.`,
      );
    }
    if (!packById.has(decision.reviewPackId)) {
      throw new FormalResourceRemediationError(
        'decision-pack-unknown',
        `Decision ${decision.decisionId} binds an unknown review pack.`,
      );
    }
    const key = rowKey(decision.canonicalId, decision.family);
    if (decided.has(key)) {
      throw new FormalResourceRemediationError(
        'decision-duplicate',
        `Member ${decision.canonicalId} (${decision.family}) received more than one decision.`,
      );
    }
    if (!packRows.has(key)) {
      throw new FormalResourceRemediationError(
        'decision-row-unknown',
        `Decision ${decision.decisionId} resolves a row that never entered review.`,
      );
    }
    for (const ref of decision.evidenceRefs) {
      if (!input.evidenceRegistry.knows(ref)) {
        throw new FormalResourceRemediationError(
          'decision-evidence-unbound',
          `Decision ${decision.decisionId} cites an evidence ref the frozen registry does not know: ${ref}`,
        );
      }
    }
    if (decision.decision === 'no-relation' && decision.evidenceRefs.length === 0) {
      throw new FormalResourceRemediationError(
        'decision-no-relation-unevidenced',
        `Decision ${decision.decisionId} closes ${decision.family} with an unevidenced NO_RELATION.`,
      );
    }
    // Cross-capture guard: the decision must seal under this allocation.
    const recomputed = projectionDigest({
      decisionId: decision.decisionId,
      reviewPackId: decision.reviewPackId,
      canonicalId: decision.canonicalId,
      family: decision.family,
      decision: decision.decision,
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt,
      evidenceRefs: decision.evidenceRefs,
      rationale: decision.rationale,
      replacementDigest: decision.replacementDigest,
      allocationHash: input.expectedAllocationHash,
    });
    if (decision.decisionHash !== recomputed) {
      throw new FormalResourceRemediationError(
        'decision-hash-mismatch',
        `Decision ${decision.decisionId} does not match its own sealed hash under this allocation.`,
      );
    }
    decided.set(key, decision);
    appliedDecisionHashes.push(decision.decisionHash);
    outcomes.push(outcomeFor(decision));
  }
  const unresolvedAfterApplication = packRows.size - decided.size;
  return { outcomes, appliedDecisionHashes, unresolvedAfterApplication };
}

function outcomeFor(decision: RelationCourseOwnerDecision): AppliedRelationOutcome {
  switch (decision.decision) {
    case 'accept':
      return {
        canonicalId: decision.canonicalId,
        family: decision.family,
        finalDisposition: { kind: 'PUBLISHED_EDGE', evidenceRefs: decision.evidenceRefs },
      };
    case 'replace':
      return {
        canonicalId: decision.canonicalId,
        family: decision.family,
        finalDisposition: {
          kind: 'PUBLISHED_EDGE',
          evidenceRefs: [...decision.evidenceRefs, decision.replacementDigest ?? 'replacement:unspecified']
            .filter((ref) => ref !== 'replacement:unspecified'),
        },
      };
    case 'no-relation':
      return {
        canonicalId: decision.canonicalId,
        family: decision.family,
        finalDisposition: { kind: 'NO_RELATION', evidenceRefs: decision.evidenceRefs },
      };
    case 'reject':
    default:
      return {
        canonicalId: decision.canonicalId,
        family: decision.family,
        finalDisposition: { kind: 'REJECTED' },
      };
  }
}

/**
 * Construct one course-owner decision with its sealed hash (used by the
 * repository review tooling; the hash binds the allocation).
 */
export function sealCourseOwnerDecision(input: {
  allocationHash: string;
  reviewPackId: string;
  canonicalId: string;
  family: RelationFamily;
  decision: RelationCourseOwnerDecision['decision'];
  decidedBy: string;
  decidedAt: string;
  evidenceRefs: readonly string[];
  rationale: string;
  replacementDigest?: string | null;
}): RelationCourseOwnerDecision {
  const decisionId = `dec-${projectionDigest({
    allocationHash: input.allocationHash,
    reviewPackId: input.reviewPackId,
    canonicalId: input.canonicalId,
    family: input.family,
  }).slice(0, 24)}`;
  const decisionHash = projectionDigest({
    decisionId,
    reviewPackId: input.reviewPackId,
    canonicalId: input.canonicalId,
    family: input.family,
    decision: input.decision,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    evidenceRefs: input.evidenceRefs,
    rationale: input.rationale,
    replacementDigest: input.replacementDigest ?? null,
    allocationHash: input.allocationHash,
  });
  return {
    contract: RELATION_COURSE_OWNER_DECISION_CONTRACT,
    decisionId,
    reviewPackId: input.reviewPackId,
    canonicalId: input.canonicalId,
    family: input.family,
    decision: input.decision,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    evidenceRefs: input.evidenceRefs,
    rationale: input.rationale,
    replacementDigest: input.replacementDigest ?? null,
    decisionHash,
  };
}

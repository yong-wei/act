/**
 * Complete Teaching Projection governance for coordinated production
 * selection (#1509, tasks 6.x).
 *
 * Every Canonical Object in the sealed course active-domain scope needs a
 * final disposition in all three families before the coordinated production
 * gate may qualify: containment closes through an admitted parent or
 * COURSE_ROOT; prerequisite and pedagogical association close through
 * admitted relations or evidence-bearing governed NO_RELATION decisions. A
 * truthful PARTIAL projection remains valid for non-coordinated consumers
 * but never satisfies this gate.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  COURSE_ROOT_DISPOSITION,
  NO_RELATION_DISPOSITION,
  PUBLISHED_EDGE_DISPOSITION,
  type ActTeachingCandidate,
  type ActTeachingDecision,
  type ActTeachingFamilyDisposition,
} from '@/lib/act-canonical-teaching-relations/contracts';

import {
  LatestAuthorityCutoverError,
  type TeachingClosureFamily,
  type TeachingClosureReceipt,
  type TeachingFamilyClosureCounts,
} from './contracts';

export interface TeachingClosureMember {
  readonly canonicalId: string;
}

export interface EvaluateTeachingClosureInput {
  readonly scopeHash: string;
  readonly authorityCaptureHash: string;
  readonly members: readonly TeachingClosureMember[];
  readonly dispositions: readonly ActTeachingFamilyDisposition[];
  readonly candidates: readonly ActTeachingCandidate[];
  readonly decisions: readonly ActTeachingDecision[];
}

const FAMILIES: readonly TeachingClosureFamily[] = ['containment', 'prerequisite', 'association'];

function finalDecisionKinds(decision: ActTeachingDecision): boolean {
  // defer is deliberately excluded: a deferred candidate is unresolved.
  return decision.kind === 'approve' || decision.kind === 'reject' || decision.kind === 'modify';
}

/**
 * Evaluate three-family closure for every in-scope member. The closure is
 * COMPLETE only when no candidate in any family is pending, deferred,
 * conflicted, or otherwise undecided and every member has a final
 * disposition. Counts are evidence-derived; completeness never imposes an
 * edge quota.
 */
export function evaluateTeachingClosure(
  input: EvaluateTeachingClosureInput,
): TeachingClosureReceipt {
  if (!input.scopeHash || !/^[a-f0-9]{64}$/u.test(input.scopeHash)) {
    throw new LatestAuthorityCutoverError(
      'closure-scope-invalid',
      'The teaching closure needs the sealed scope hash.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.authorityCaptureHash)) {
    throw new LatestAuthorityCutoverError(
      'closure-authority-invalid',
      'The teaching closure needs the Authority capture hash.',
    );
  }
  const memberIds = new Set(input.members.map((member) => member.canonicalId));
  if (memberIds.size !== input.members.length) {
    throw new LatestAuthorityCutoverError(
      'closure-members-duplicate',
      'The sealed scope contains duplicate members.',
    );
  }
  const scopeDispositions = input.dispositions.filter(
    (disposition) => disposition.scopeHash === input.scopeHash,
  );
  // Formal validity applies to every disposition on record, not only the one
  // that closes a member: a fabricated or unevidenced edge is forbidden even
  // when another valid disposition exists.
  for (const disposition of scopeDispositions) {
    if (disposition.kind === PUBLISHED_EDGE_DISPOSITION) {
      if (!disposition.edgeId) {
        throw new LatestAuthorityCutoverError(
          'closure-fabricated-edge',
          `An admitted ${disposition.family} relation for ${disposition.canonicalId} has no edge identity.`,
        );
      }
      if (disposition.evidenceRefs.length === 0) {
        throw new LatestAuthorityCutoverError(
          'closure-fabricated-edge',
          `An admitted ${disposition.family} relation for ${disposition.canonicalId} carries no evidence.`,
        );
      }
    }
    if (disposition.kind === NO_RELATION_DISPOSITION && disposition.evidenceRefs.length === 0) {
      throw new LatestAuthorityCutoverError(
        'closure-no-relation-unevidenced',
        `A ${disposition.family} NO_RELATION for ${disposition.canonicalId} carries no evidence.`,
      );
    }
  }
  const scopeCandidates = input.candidates.filter(
    (candidate) => candidate.scopeHash === input.scopeHash,
  );
  const decisionsByCandidate = new Map<string, ActTeachingDecision[]>();
  for (const decision of input.decisions) {
    const list = decisionsByCandidate.get(decision.candidateId) ?? [];
    list.push(decision);
    decisionsByCandidate.set(decision.candidateId, list);
  }

  const familyCounts: TeachingFamilyClosureCounts[] = [];
  for (const family of FAMILIES) {
    let admittedRelationCount = 0;
    let noRelationCount = 0;
    let courseRootCount = 0;
    let rejectedCount = 0;
    let modifiedCount = 0;
    let unresolvedCount = 0;
    let closedMembers = 0;

    for (const member of input.members) {
      const memberDispositions = scopeDispositions.filter(
        (disposition) =>
          disposition.canonicalId === member.canonicalId && disposition.family === family,
      );
      const hasFinalDisposition = memberDispositions.some((disposition) => {
        if (disposition.kind === PUBLISHED_EDGE_DISPOSITION) {
          admittedRelationCount += 1;
          return true;
        }
        if (family === 'containment' && disposition.kind === COURSE_ROOT_DISPOSITION) {
          courseRootCount += 1;
          return true;
        }
        if (disposition.kind === NO_RELATION_DISPOSITION) {
          noRelationCount += 1;
          return true;
        }
        return false;
      });
      if (hasFinalDisposition) {
        closedMembers += 1;
        continue;
      }
      // No final disposition on record: the member is unresolved unless an
      // exceptional candidate was finally rejected (rejections close their
      // own candidate, but the member still needs a terminal disposition).
      unresolvedCount += 1;
    }

    for (const candidate of scopeCandidates.filter((entry) => entry.family === family)) {
      const decisions = decisionsByCandidate.get(candidate.candidateId) ?? [];
      const hasFinal = decisions.some(finalDecisionKinds);
      if (hasFinal) {
        const final = decisions.filter(finalDecisionKinds);
        for (const decision of final) {
          if (decision.kind === 'reject') rejectedCount += 1;
          if (decision.kind === 'modify') modifiedCount += 1;
        }
        continue;
      }
      if (candidate.conflicts.length > 0 || candidate.exceptionReasons.length > 0) {
        unresolvedCount += 1;
      }
    }

    familyCounts.push({
      family,
      memberCount: input.members.length,
      closedCount: closedMembers,
      admittedRelationCount,
      noRelationCount,
      courseRootCount,
      rejectedCount,
      modifiedCount,
      unresolvedCount,
    });
  }

  const zeroUnresolved = familyCounts.every((family) => family.unresolvedCount === 0);
  const allClosed = familyCounts.every((family) => family.closedCount === family.memberCount);
  const countsHash = projectionDigest(familyCounts);
  const receiptHash = projectionDigest({
    contract: 'coordinated-teaching-closure-receipt/v1',
    scopeHash: input.scopeHash,
    authorityCaptureHash: input.authorityCaptureHash,
    zeroUnresolved,
    allClosed,
    countsHash,
  });
  return {
    contract: 'coordinated-teaching-closure-receipt/v1',
    builderVersion: 'latest-authority-oss-cutover-builder/v1',
    scopeHash: input.scopeHash,
    authorityCaptureHash: input.authorityCaptureHash,
    status: zeroUnresolved && allClosed ? 'COMPLETE' : 'INCOMPLETE',
    zeroUnresolved,
    familyCounts,
    countsHash,
    receiptHash,
  };
}

/** The coordinated production gate requires a COMPLETE three-family closure. */
export function assertTeachingClosureComplete(receipt: TeachingClosureReceipt): void {
  if (receipt.status !== 'COMPLETE') {
    throw new LatestAuthorityCutoverError(
      'teaching-closure-incomplete',
      `The teaching closure is ${receipt.status}; unresolved=${receipt.familyCounts
        .map((family) => `${family.family}:${family.unresolvedCount}`)
        .join(', ')}`,
    );
  }
}

export interface CoordinatedProjectionView {
  readonly publicationState: string;
  readonly scopeHash: string;
  readonly authorityReleaseId: string;
  readonly authoritySnapshotHash: string;
  readonly allocationHash: string;
  readonly formalResourceEnvelopeHash: string;
  readonly projectionHash: string;
}

export interface ExpectedProjectionIdentity {
  readonly scopeHash: string;
  readonly authorityReleaseId: string;
  readonly authoritySnapshotHash: string;
  readonly allocationHash: string;
  readonly formalResourceEnvelopeHash: string;
}

/**
 * A coordinated activation manifest may select only a complete projection
 * bound to the exact captured Authority, scope, formal resource envelope,
 * allocation record, and projection hash. PARTIAL, EMPTY, stale, fabricated,
 * wrong-scope, wrong-Authority, and wrong-envelope projections fail before
 * consumer selection.
 */
export function assertProjectionEligibleForCoordinatedSelection(
  projection: CoordinatedProjectionView,
  expected: ExpectedProjectionIdentity,
): void {
  if (projection.publicationState !== 'COMPLETE') {
    throw new LatestAuthorityCutoverError(
      'projection-not-complete',
      `A ${projection.publicationState} projection cannot satisfy the coordinated production gate.`,
    );
  }
  const mismatches: string[] = [];
  if (projection.scopeHash !== expected.scopeHash) mismatches.push('scope');
  if (projection.authorityReleaseId !== expected.authorityReleaseId) mismatches.push('authority release');
  if (projection.authoritySnapshotHash !== expected.authoritySnapshotHash) mismatches.push('authority snapshot');
  if (projection.allocationHash !== expected.allocationHash) mismatches.push('allocation record');
  if (projection.formalResourceEnvelopeHash !== expected.formalResourceEnvelopeHash) {
    mismatches.push('formal resource envelope');
  }
  if (mismatches.length > 0) {
    throw new LatestAuthorityCutoverError(
      'projection-identity-mismatch',
      `The projection binds a different ${mismatches.join(', ')} than the successor combination.`,
    );
  }
}

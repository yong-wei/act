import {
  ACT_TEACHING_DECISION_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingDecision,
} from './contracts';
import { ActTeachingRelationError, projectionDigest } from './hash';

export interface KaqFallbackRelation {
  readonly id: string;
  readonly sourceCanonicalId: string;
  readonly targetCanonicalId: string;
  readonly scopeId: string;
}

export interface KaqFallbackRetirement {
  readonly retirementId: string;
  readonly kaqRelationId: string;
  readonly actCandidateId: string;
  readonly scopeHash: string;
  readonly retiredAt: string;
}

export function detectKaqConflicts(input: {
  candidates: readonly ActTeachingCandidate[];
  kaqFallbacks: readonly KaqFallbackRelation[];
}): ActTeachingCandidate[] {
  return input.candidates.map((candidate) => {
    if (!candidate.targetCanonicalId) return candidate;
    const conflict = input.kaqFallbacks.find((fallback) => (
      (
        fallback.sourceCanonicalId === candidate.sourceCanonicalId
        && fallback.targetCanonicalId === candidate.targetCanonicalId
      )
      || (
        fallback.sourceCanonicalId === candidate.targetCanonicalId
        && fallback.targetCanonicalId === candidate.sourceCanonicalId
      )
    ));
    if (!conflict) return candidate;
    return {
      ...candidate,
      conflicts: [...new Set([...candidate.conflicts, `kaq:${conflict.id}`])],
      exceptionReasons: [...new Set([...candidate.exceptionReasons, 'kaq-fallback-conflict'])],
    };
  });
}

export function resolveKaqConflict(input: {
  candidate: ActTeachingCandidate;
  fallback: KaqFallbackRelation;
  decision: ActTeachingDecision;
  retiredAt: string;
}): KaqFallbackRetirement {
  if (input.decision.candidateId !== input.candidate.candidateId) {
    throw new ActTeachingRelationError(
      'kaq-conflict-unresolved',
      'decision does not bind the conflicting ACT candidate',
    );
  }
  if (input.decision.kind !== 'approve') {
    throw new ActTeachingRelationError(
      'kaq-conflict-unresolved',
      'ACT candidate remains excluded until the conflict is approved',
    );
  }
  if (input.decision.contract !== ACT_TEACHING_DECISION_CONTRACT) {
    throw new ActTeachingRelationError('kaq-conflict-unresolved', 'invalid decision contract');
  }
  return {
    retirementId: `retire-${projectionDigest({
      kaqRelationId: input.fallback.id,
      actCandidateId: input.candidate.candidateId,
      scopeHash: input.candidate.scopeHash,
    }).slice(0, 24)}`,
    kaqRelationId: input.fallback.id,
    actCandidateId: input.candidate.candidateId,
    scopeHash: input.candidate.scopeHash,
    retiredAt: input.retiredAt,
  };
}

export function planningRelationAllowed(input: {
  candidate: ActTeachingCandidate;
  retirement: KaqFallbackRetirement | null;
}): boolean {
  if (input.candidate.conflicts.length === 0) return true;
  return Boolean(
    input.retirement
    && input.retirement.actCandidateId === input.candidate.candidateId
    && input.retirement.scopeHash === input.candidate.scopeHash,
  );
}

/**
 * Prerequisite publication decisions and capture binding (#1270).
 *
 * Every PUBLISHED edge must bind one author decision + evidence/rationale to
 * the current Authority / Projection capture.
 */

import { projectionDigest } from '../hash';
import type { PrerequisiteAuthorDecision } from './contracts';
import { edgeIdentityKey } from './edges';
import type { PrerequisiteStrength } from '../contracts';

export class PrerequisitePublicationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrerequisitePublicationError';
    this.code = code;
  }
}

export function deriveAuthorDecisionId(input: {
  edgeKey: string;
  scopeId: string;
  inputDigest: string;
}): string {
  return `prereq-decision-${projectionDigest({
    edgeKey: input.edgeKey,
    scopeId: input.scopeId,
    inputDigest: input.inputDigest,
  }).slice(0, 24)}`;
}

export function computeDecisionInputDigest(input: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
  evidenceRefs: readonly string[];
  curatorRationale: string | null;
}): string {
  return projectionDigest({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    strength: input.strength,
    scopeId: input.scopeId,
    evidenceRefs: [...input.evidenceRefs].sort(),
    curatorRationale: input.curatorRationale,
  });
}

/**
 * Record one author decision for a prerequisite edge.
 * Required for every published edge.
 */
export function createPrerequisiteAuthorDecision(input: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
  evidenceRefs?: readonly string[];
  curatorRationale?: string | null;
  curatorId: string;
  rationale: string;
  authorityReleaseId: string;
  projectionCaptureId?: string | null;
  authoringRevision: string;
  decisionId?: string;
  decidedAt?: string | null;
}): PrerequisiteAuthorDecision {
  if (!input.curatorId || input.curatorId.trim().length === 0) {
    throw new PrerequisitePublicationError(
      'schema-invalid',
      'curatorId is required',
    );
  }
  if (!input.rationale || input.rationale.trim().length === 0) {
    throw new PrerequisitePublicationError(
      'schema-invalid',
      'rationale is required',
    );
  }
  if (!input.authorityReleaseId || !input.authoringRevision) {
    throw new PrerequisitePublicationError(
      'schema-invalid',
      'authorityReleaseId and authoringRevision are required',
    );
  }

  const evidenceRefs = [...(input.evidenceRefs ?? [])].map(String);
  const curatorRationale =
    typeof input.curatorRationale === 'string' && input.curatorRationale.trim()
      ? input.curatorRationale.trim()
      : null;
  if (evidenceRefs.length === 0 && !curatorRationale) {
    throw new PrerequisitePublicationError(
      'missing-evidence',
      'decision requires evidenceRefs or curatorRationale',
    );
  }

  const edgeKey = edgeIdentityKey({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    strength: input.strength,
    scopeId: input.scopeId,
  });
  const inputDigest = computeDecisionInputDigest({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    strength: input.strength,
    scopeId: input.scopeId,
    evidenceRefs,
    curatorRationale,
  });
  const decisionId =
    input.decisionId
    ?? deriveAuthorDecisionId({
      edgeKey,
      scopeId: input.scopeId,
      inputDigest,
    });

  return {
    decisionId,
    edgeKey,
    scopeId: input.scopeId,
    inputDigest,
    rationale: input.rationale.trim(),
    curatorId: input.curatorId.trim(),
    decidedAt: input.decidedAt ?? null,
    authorityReleaseId: input.authorityReleaseId,
    projectionCaptureId: input.projectionCaptureId ?? null,
    authoringRevision: input.authoringRevision,
  };
}

export function indexPrerequisiteDecisions(
  decisions: readonly PrerequisiteAuthorDecision[],
): Map<string, PrerequisiteAuthorDecision> {
  const map = new Map<string, PrerequisiteAuthorDecision>();
  for (const d of decisions) {
    if (map.has(d.decisionId)) {
      throw new PrerequisitePublicationError(
        'duplicate-decision',
        `duplicate decision ${d.decisionId}`,
      );
    }
    map.set(d.decisionId, d);
  }
  return map;
}

/**
 * When evidence path / Canonical identity / Authority release changes, the
 * affected edge becomes STALE / REVIEW_REQUIRED while unrelated edge digests
 * remain stable. Returns ids that must be re-reviewed.
 */
export function detectStalePublishedEdges(input: {
  priorEdges: readonly {
    edgeId: string;
    edgeDigest: string;
    authorityReleaseId: string;
    evidenceRefs: readonly string[];
    sourceNodeId: string;
    targetNodeId: string;
  }[];
  nextEdges: readonly {
    edgeId: string;
    edgeDigest: string;
    authorityReleaseId: string;
    evidenceRefs: readonly string[];
    sourceNodeId: string;
    targetNodeId: string;
  }[];
  authorityReleaseId: string;
}): {
  staleEdgeIds: string[];
  retainedDigests: Record<string, string>;
} {
  const nextById = new Map(input.nextEdges.map((e) => [e.edgeId, e]));
  const staleEdgeIds: string[] = [];
  const retainedDigests: Record<string, string> = {};

  for (const prior of input.priorEdges) {
    const next = nextById.get(prior.edgeId);
    if (!next) {
      // Removed edges are not mutated in place; prior digest retained in history.
      retainedDigests[prior.edgeId] = prior.edgeDigest;
      continue;
    }
    const evidenceChanged =
      projectionDigest([...prior.evidenceRefs].sort())
      !== projectionDigest([...next.evidenceRefs].sort());
    const identityChanged =
      prior.sourceNodeId !== next.sourceNodeId
      || prior.targetNodeId !== next.targetNodeId;
    const authorityChanged =
      next.authorityReleaseId !== input.authorityReleaseId
      || prior.authorityReleaseId !== input.authorityReleaseId;

    if (evidenceChanged || identityChanged || authorityChanged) {
      staleEdgeIds.push(prior.edgeId);
    } else if (prior.edgeDigest === next.edgeDigest) {
      retainedDigests[prior.edgeId] = prior.edgeDigest;
    } else {
      // Digest change without evidence/identity/authority change is unexpected;
      // treat as stale for re-review rather than silent mutation.
      staleEdgeIds.push(prior.edgeId);
    }
  }

  return {
    staleEdgeIds: staleEdgeIds.sort(),
    retainedDigests,
  };
}

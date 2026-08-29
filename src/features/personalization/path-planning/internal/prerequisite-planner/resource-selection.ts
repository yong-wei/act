/**
 * Accessible projected resource selection for ACT path nodes (#1275).
 *
 * Priority: lesson → handout → step (interactive) → active card →
 * textbook-section → textbook-chapter → textbook → other.
 */

import {
  ACT_PATH_RESOURCE_PRIORITY,
  type ActPathBlocker,
  type ActPathProjectedResourceCandidate,
  type ActPathProjectionIdentity,
  type ActPathSelectedResource,
} from './contracts';

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function priorityRank(resourceType: string): number {
  const index = (ACT_PATH_RESOURCE_PRIORITY as readonly string[]).indexOf(
    resourceType,
  );
  return index >= 0 ? index : ACT_PATH_RESOURCE_PRIORITY.length;
}

function isAccessibleCandidate(
  candidate: ActPathProjectedResourceCandidate,
): boolean {
  if (!candidate.accessible) return false;
  if (candidate.bindingStatus === 'UNBOUND') return false;
  if (candidate.projectionStatus === 'UNBOUND') return false;
  if (candidate.resourceType === 'card' && candidate.cardActive === false) {
    return false;
  }
  return true;
}

function toSelectedResource(
  candidate: ActPathProjectedResourceCandidate,
  projection: ActPathProjectionIdentity,
  selectionRank: number,
  selectionReason: string,
): ActPathSelectedResource {
  const resourceNodeId =
    (candidate.resourceNodeId && candidate.resourceNodeId.trim())
    || (candidate.registryId && candidate.registryId.trim())
    || candidate.resourceId;
  return {
    resourceId: candidate.resourceId,
    resourceNodeId,
    resourceType: candidate.resourceType,
    role: candidate.role ? String(candidate.role) : null,
    launchTarget: candidate.launchTarget ?? null,
    registryId: candidate.registryId ?? null,
    scopeId: candidate.scopeId ?? projection.scopeId,
    sourcePath: candidate.sourcePath ?? null,
    primary: candidate.primary === true,
    selectionRank,
    selectionReason,
    provenance: {
      authorityReleaseId: projection.authorityReleaseId,
      projectionId: projection.projectionId,
      bindingId: candidate.provenance?.bindingId ?? null,
      evidenceRef: candidate.provenance?.evidenceRef ?? null,
      rationale: candidate.provenance?.rationale ?? null,
    },
  };
}

export interface SelectAccessibleResourcesResult {
  selected: ActPathSelectedResource | null;
  alternates: ActPathSelectedResource[];
  missingOptionalCard: boolean;
  blockers: ActPathBlocker[];
}

/**
 * Choose the highest-priority accessible projected resource for a node.
 * Never returns an empty executable selection without an explicit blocker.
 */
export function selectAccessibleProjectedResources(input: {
  canonicalId: string;
  candidates: readonly ActPathProjectedResourceCandidate[];
  projection: ActPathProjectionIdentity;
  cardPolicy?: string | null;
}): SelectAccessibleResourcesResult {
  const accessible = input.candidates
    .filter(isAccessibleCandidate)
    .slice()
    .sort((a, b) => {
      const rankDiff = priorityRank(a.resourceType) - priorityRank(b.resourceType);
      if (rankDiff !== 0) return rankDiff;
      // Prefer primary bindings, then stable resourceId.
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      return compareCodePoint(a.resourceId, b.resourceId);
    });

  const hasAnyCard = input.candidates.some(
    (c) => c.resourceType === 'card',
  );
  const hasAccessibleCard = accessible.some(
    (c) => c.resourceType === 'card',
  );
  const cardPolicy = (input.cardPolicy ?? 'optional').toLowerCase();
  const missingOptionalCard =
    cardPolicy !== 'required' && (!hasAnyCard || !hasAccessibleCard);

  if (accessible.length === 0) {
    const unresolvedRequired = input.candidates.some(
      (c) =>
        c.bindingStatus === 'UNBOUND'
        || c.projectionStatus === 'UNBOUND'
        || c.projectionStatus === 'REVIEW_REQUIRED',
    );
    return {
      selected: null,
      alternates: [],
      missingOptionalCard,
      blockers: [
        {
          code: unresolvedRequired
            ? 'required-binding-unresolved'
            : 'no-accessible-resource',
          message: unresolvedRequired
            ? `Node ${input.canonicalId} has projected resources but no resolved accessible binding`
            : `Node ${input.canonicalId} has no accessible lesson, handout, step, card, textbook, or other projected resource`,
          canonicalId: input.canonicalId,
        },
      ],
    };
  }

  const selected = toSelectedResource(
    accessible[0]!,
    input.projection,
    0,
    `priority:${accessible[0]!.resourceType}`,
  );
  const alternates = accessible.slice(1).map((candidate, index) =>
    toSelectedResource(
      candidate,
      input.projection,
      index + 1,
      `alternate:${candidate.resourceType}`,
    ),
  );

  return {
    selected,
    alternates,
    missingOptionalCard,
    blockers: [],
  };
}

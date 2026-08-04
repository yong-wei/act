/**
 * ResourceNode + RAG projection views for Canonical-keyed cards (#1271).
 *
 * Optional card absence is an explicit state — never a missing Canonical node.
 * Legacy fallback status is exposed without writing a new authority selector.
 */

import type {
  CanonicalCardActiveIndex,
  CanonicalCardIndexEntry,
  CanonicalCardRagRetrievalRecord,
  CanonicalCardResourceProjection,
  CardProjectionCardState,
  CardReviewStatus,
  CardStepResolution,
} from './contracts';
import { getActiveCardForCanonical } from './migrate';

export interface ProjectCardResourceInput {
  canonicalId: string;
  index: CanonicalCardActiveIndex;
  projectionId?: string | null;
  reviewState?: CardReviewStatus | null;
  cardPolicy?: 'required' | 'optional' | 'none';
  /** When true, index publication failed closed for this Canonical. */
  duplicateBlocked?: boolean;
  /** Optional resolution already performed for this step. */
  resolution?: CardStepResolution | null;
}

function stateFromEntry(
  entry: CanonicalCardIndexEntry | null,
  policy: 'required' | 'optional' | 'none',
  duplicateBlocked: boolean,
): CardProjectionCardState {
  if (duplicateBlocked) return 'duplicate-blocked';
  if (!entry) {
    return policy === 'required' ? 'required-missing' : 'optional-missing';
  }
  if (entry.legacyFallback) return 'legacy-fallback';
  if (entry.active) return 'active';
  return 'inactive';
}

/**
 * Planner-consumable ResourceNode-style projection for one Canonical card.
 * Does not expose raw hidden card content.
 */
export function projectCanonicalCardResource(
  input: ProjectCardResourceInput,
): CanonicalCardResourceProjection {
  const policy = input.cardPolicy ?? 'optional';
  const active = getActiveCardForCanonical(input.index, input.canonicalId);
  const any =
    active
    ?? input.index.entries.find((e) => e.canonicalId === input.canonicalId)
    ?? null;

  const resolution = input.resolution;
  let cardState: CardProjectionCardState;
  if (resolution) {
    switch (resolution.outcome) {
      case 'active-card':
        cardState = 'active';
        break;
      case 'inactive-card':
        cardState = 'inactive';
        break;
      case 'legacy-fallback':
        cardState = 'legacy-fallback';
        break;
      case 'required-card-missing':
        cardState = 'required-missing';
        break;
      case 'optional-card-absent':
      case 'unmapped-legacy':
      case 'node-summary-only':
      default:
        cardState = policy === 'required' ? 'required-missing' : 'optional-missing';
        break;
    }
  } else {
    cardState = stateFromEntry(any, policy, input.duplicateBlocked === true);
  }

  const card = resolution?.card ?? any;
  const legacyFallback =
    cardState === 'legacy-fallback' || card?.legacyFallback === true;

  return {
    resourceId: card?.resourceId ?? `act:card:missing:${input.canonicalId}`,
    cardId: card?.cardId ?? null,
    canonicalId: input.canonicalId,
    cardState,
    projectionId: input.projectionId ?? null,
    sourceHash: card?.sourceHash ?? null,
    reviewState: input.reviewState ?? null,
    legacyFallback,
    launchPolicy: card && card.active ? 'registry-or-route' : 'disabled',
    evidencePolicy: legacyFallback
      ? 'legacy-compat'
      : card && card.active
        ? 'citation-safe'
        : 'summary-only',
  };
}

export interface BuildCardRagRecordInput {
  canonicalId: string;
  index: CanonicalCardActiveIndex;
  projectionId?: string | null;
  reviewState?: CardReviewStatus | null;
  consumer: string;
  cardPolicy?: 'required' | 'optional' | 'none';
  /** Citation-safe route/target when reviewed. */
  citationTarget?: string | null;
  legacyFallback?: boolean;
  crosswalkOutcome?: CanonicalCardRagRetrievalRecord['migrationProvenance']['crosswalkOutcome'];
  /** Engineering/teaching node is known even if card is absent. */
  nodePresent?: boolean;
}

/**
 * RAG retrieval record for a Canonical card query.
 * Missing optional card continues with Canonical summary / other resources.
 */
export function buildCanonicalCardRagRecord(
  input: BuildCardRagRecordInput,
): CanonicalCardRagRetrievalRecord {
  const policy = input.cardPolicy ?? 'optional';
  const active = getActiveCardForCanonical(input.index, input.canonicalId);
  const present = Boolean(active);
  const optionalCardStatus: CanonicalCardRagRetrievalRecord['optionalCardStatus'] =
    policy === 'none'
      ? 'not-applicable'
      : present
        ? 'present'
        : 'absent';

  return {
    canonicalId: input.canonicalId,
    cardId: active?.cardId ?? null,
    resourceId: active?.resourceId ?? null,
    projectionId: input.projectionId ?? null,
    sourceHash: active?.sourceHash ?? null,
    reviewState: input.reviewState ?? null,
    citationTarget: present ? (input.citationTarget ?? active?.sourcePath ?? null) : null,
    optionalCardStatus,
    legacyFallback: input.legacyFallback === true || active?.legacyFallback === true,
    migrationProvenance: {
      crosswalkOutcome: input.crosswalkOutcome
        ?? (input.legacyFallback ? 'mapped' : 'canonical-direct'),
      consumer: input.consumer,
    },
    // Absence of an optional card must never be reported as a missing node.
    nodePresentWithoutCard:
      !present && input.nodePresent !== false && policy !== 'required',
  };
}

/**
 * Project all active cards in the index into ResourceNode-style rows.
 */
export function projectAllActiveCards(input: {
  index: CanonicalCardActiveIndex;
  projectionId?: string | null;
}): CanonicalCardResourceProjection[] {
  return input.index.activeByCanonical.map((row) =>
    projectCanonicalCardResource({
      canonicalId: row.canonicalId,
      index: input.index,
      projectionId: input.projectionId,
      cardPolicy: 'optional',
    }),
  );
}

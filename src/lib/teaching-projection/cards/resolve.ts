/**
 * Step → canonicalId → optional card resolution + legacy fallback telemetry (#1271).
 *
 * Old IDs remain read-only compatibility inputs. Every legacy fallback hit is
 * recorded with card identity, crosswalk outcome, consumer, and projection.
 */

import { isLegacyCardDirectReaderPermitted } from '@/lib/legacy-knowledge-runtime-retirement';

import { projectionDigest } from '../hash';
import { isLegacyLocalGraphNodeId } from '../legacy-id-policy';
import {
  CARD_FALLBACK_TELEMETRY_CONTRACT,
  type CanonicalCardActiveIndex,
  type CanonicalCardIndexEntry,
  type CardCrosswalkEntry,
  type CardResolutionOutcome,
  type CardStepResolution,
  type LegacyCardFallbackHit,
  type LegacyCardFallbackTelemetry,
} from './contracts';
import { getActiveCardForCanonical } from './migrate';

export class CardResolveError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CardResolveError';
    this.code = code;
  }
}

export interface ResolveCardForStepInput {
  stepId?: string | null;
  /** Preferred: Canonical IDs from step.knowledgeRefs. */
  canonicalIds: readonly string[];
  selectedCanonicalId?: string | null;
  /** Card policy for the selected core/step binding. */
  cardPolicy?: 'required' | 'optional' | 'none';
  index: CanonicalCardActiveIndex;
  /**
   * Optional legacy ids still present on historical content.
   * Used only as read-only compatibility inputs.
   */
  legacyIds?: readonly string[];
  crosswalk?: readonly CardCrosswalkEntry[];
  consumer: string;
  projectionId?: string | null;
  projectionHash?: string | null;
  scopeId?: string | null;
  /** Clock override for tests. */
  now?: string;
  /**
   * Sink for legacy fallback hits. When omitted, hits are still returned on
   * the resolution object via `legacyHit` but not persisted.
   */
  telemetrySink?: LegacyCardFallbackHit[];
}

export interface ResolveCardForStepResult extends CardStepResolution {
  legacyHit: LegacyCardFallbackHit | null;
}

function studentMessage(outcome: CardResolutionOutcome): string {
  switch (outcome) {
    case 'active-card':
      return '已加载本步骤关联知识卡片。';
    case 'inactive-card':
      return '知识卡片当前未激活，已展示节点摘要与相关资源。';
    case 'optional-card-absent':
      return '本知识点暂无独立知识卡片，已展示节点摘要与相关资源。';
    case 'required-card-missing':
      return '核心知识点缺少必需知识卡片，当前投影保持先前有效状态。';
    case 'legacy-fallback':
      return '正在通过兼容路径加载历史知识卡片。';
    case 'unmapped-legacy':
      return '历史知识卡尚未映射到当前知识节点，已展示节点摘要。';
    case 'node-summary-only':
    default:
      return '已展示知识点摘要。';
  }
}

function findLegacyCard(
  index: CanonicalCardActiveIndex,
  legacyId: string,
): CanonicalCardIndexEntry | null {
  return (
    index.entries.find(
      (e) =>
        e.legacyAliases.includes(legacyId)
        || e.cardId === legacyId
        || e.legacyFallback,
    ) ?? null
  );
}

function crosswalkOutcomeFor(
  legacyId: string,
  crosswalk: readonly CardCrosswalkEntry[] | undefined,
): LegacyCardFallbackHit['crosswalkOutcome'] {
  const rows = (crosswalk ?? []).filter((r) => r.legacyNodeId === legacyId);
  if (rows.length === 0) return 'unmapped';
  if (rows.every((r) => r.stale)) return 'stale';
  if (rows.every((r) => r.courseSpecific)) return 'course-specific';
  const unique = [...new Set(rows.filter((r) => !r.stale).map((r) => r.canonicalId))];
  if (unique.length > 1) return 'split';
  // Multiple cards sharing mapping is detected at migration; at lookup time
  // a single legacy id with one canonical is "mapped".
  return 'mapped';
}

function recordHit(input: {
  cardId: string | null;
  legacyId: string | null;
  canonicalId: string | null;
  crosswalkOutcome: LegacyCardFallbackHit['crosswalkOutcome'];
  consumer: string;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  now: string;
  sink?: LegacyCardFallbackHit[];
}): LegacyCardFallbackHit {
  const body = {
    contract: CARD_FALLBACK_TELEMETRY_CONTRACT,
    cardId: input.cardId,
    legacyId: input.legacyId,
    canonicalId: input.canonicalId,
    crosswalkOutcome: input.crosswalkOutcome,
    consumer: input.consumer,
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    scopeId: input.scopeId,
    recordedAt: input.now,
  };
  const hit: LegacyCardFallbackHit = {
    ...body,
    hitId: `card-fallback:${projectionDigest(body).slice(0, 24)}`,
  };
  input.sink?.push(hit);
  return hit;
}

/**
 * Resolve step knowledge ref → optional active card.
 *
 * Path: step → canonicalId → optional card.
 * Legacy IDs are compatibility-only and emit telemetry when used.
 */
export function resolveCardForStep(
  input: ResolveCardForStepInput,
): ResolveCardForStepResult | null {
  const refs = input.canonicalIds.filter((id) => id.trim().length > 0);
  const legacyIds = (input.legacyIds ?? []).filter((id) => id.trim().length > 0);

  // Reject treating bare legacy IDs as Canonical knowledgeRefs for new paths.
  // Callers may still pass them via legacyIds for fallback telemetry.
  const canonicalRefs = refs.filter((id) => !isLegacyLocalGraphNodeId(id));
  const misfiledLegacy = refs.filter((id) => isLegacyLocalGraphNodeId(id));

  if (canonicalRefs.length === 0 && legacyIds.length === 0 && misfiledLegacy.length === 0) {
    return null;
  }

  const now = input.now ?? new Date().toISOString();
  const policy = input.cardPolicy ?? 'optional';

  let canonicalId =
    (input.selectedCanonicalId
      && canonicalRefs.includes(input.selectedCanonicalId)
      ? input.selectedCanonicalId
      : canonicalRefs[0])
    ?? null;

  let legacyHit: LegacyCardFallbackHit | null = null;

  // Compatibility: misfiled legacy in knowledgeRefs or explicit legacyIds.
  // #1277: production legacy card direct reader is retired after the gate;
  // historical LearningFact reads use the retained crosswalk adapter instead.
  const productionLegacyCardReaderAllowed = isLegacyCardDirectReaderPermitted();
  const legacyCandidates = productionLegacyCardReaderAllowed
    ? [...misfiledLegacy, ...legacyIds]
    : [];

  if (!canonicalId && legacyCandidates.length > 0) {
    const legacyId = legacyCandidates[0]!;
    const outcome = crosswalkOutcomeFor(legacyId, input.crosswalk);
    const crosswalkRows = (input.crosswalk ?? []).filter(
      (r) => r.legacyNodeId === legacyId && !r.stale,
    );
    const mappedCanonical = crosswalkRows[0]?.canonicalId ?? null;
    const legacyCard = findLegacyCard(input.index, legacyId);

    legacyHit = recordHit({
      cardId: legacyCard?.cardId ?? null,
      legacyId,
      canonicalId: mappedCanonical ?? legacyCard?.canonicalId ?? null,
      crosswalkOutcome: outcome,
      consumer: input.consumer,
      projectionId: input.projectionId ?? null,
      projectionHash: input.projectionHash ?? null,
      scopeId: input.scopeId ?? null,
      now,
      sink: input.telemetrySink,
    });

    if (mappedCanonical) {
      canonicalId = mappedCanonical;
    } else if (legacyCard?.canonicalId) {
      canonicalId = legacyCard.canonicalId;
    } else {
      return {
        stepId: input.stepId ?? null,
        canonicalId: legacyId,
        outcome: 'unmapped-legacy',
        card: legacyCard,
        optionalCardMissing: true,
        requiredCardMissing: policy === 'required',
        blocksConsumer: policy === 'required',
        legacyFallback: true,
        studentMessage: studentMessage('unmapped-legacy'),
        legacyHit,
      };
    }
  }

  if (!canonicalId) return null;

  // When canonical path is known but a legacy id was also supplied, still
  // record fallback if the card itself is on legacy status.
  const active = getActiveCardForCanonical(input.index, canonicalId);
  const inactive =
    !active
      ? input.index.entries.find(
        (e) => e.canonicalId === canonicalId && !e.active,
      ) ?? null
      : null;
  const legacyCard =
    !active && !inactive
      ? input.index.entries.find(
        (e) => e.canonicalId === canonicalId && e.legacyFallback,
      ) ?? null
      : null;

  if (active) {
    return {
      stepId: input.stepId ?? null,
      canonicalId,
      outcome: 'active-card',
      card: active,
      optionalCardMissing: false,
      requiredCardMissing: false,
      blocksConsumer: false,
      legacyFallback: false,
      studentMessage: studentMessage('active-card'),
      legacyHit,
    };
  }

  if (legacyCard || (inactive && inactive.legacyFallback)) {
    const card = legacyCard ?? inactive;
    if (!legacyHit) {
      legacyHit = recordHit({
        cardId: card?.cardId ?? null,
        legacyId: card?.legacyAliases[0] ?? null,
        canonicalId,
        crosswalkOutcome: 'mapped',
        consumer: input.consumer,
        projectionId: input.projectionId ?? null,
        projectionHash: input.projectionHash ?? null,
        scopeId: input.scopeId ?? null,
        now,
        sink: input.telemetrySink,
      });
    }
    return {
      stepId: input.stepId ?? null,
      canonicalId,
      outcome: 'legacy-fallback',
      card,
      optionalCardMissing: false,
      requiredCardMissing: false,
      blocksConsumer: false,
      legacyFallback: true,
      studentMessage: studentMessage('legacy-fallback'),
      legacyHit,
    };
  }

  if (inactive) {
    return {
      stepId: input.stepId ?? null,
      canonicalId,
      outcome: 'inactive-card',
      card: inactive,
      optionalCardMissing: policy !== 'required',
      requiredCardMissing: policy === 'required',
      blocksConsumer: policy === 'required',
      legacyFallback: false,
      studentMessage: studentMessage('inactive-card'),
      legacyHit,
    };
  }

  // No card at all for this Canonical.
  if (policy === 'required') {
    return {
      stepId: input.stepId ?? null,
      canonicalId,
      outcome: 'required-card-missing',
      card: null,
      optionalCardMissing: false,
      requiredCardMissing: true,
      blocksConsumer: true,
      legacyFallback: false,
      studentMessage: studentMessage('required-card-missing'),
      legacyHit,
    };
  }

  if (policy === 'none') {
    return {
      stepId: input.stepId ?? null,
      canonicalId,
      outcome: 'node-summary-only',
      card: null,
      optionalCardMissing: false,
      requiredCardMissing: false,
      blocksConsumer: false,
      legacyFallback: false,
      studentMessage: studentMessage('node-summary-only'),
      legacyHit,
    };
  }

  return {
    stepId: input.stepId ?? null,
    canonicalId,
    outcome: 'optional-card-absent',
    card: null,
    optionalCardMissing: true,
    requiredCardMissing: false,
    blocksConsumer: false,
    legacyFallback: false,
    studentMessage: studentMessage('optional-card-absent'),
    legacyHit,
  };
}

/**
 * Seal telemetry hits into a deterministic digest document.
 */
export function sealLegacyCardFallbackTelemetry(
  hits: readonly LegacyCardFallbackHit[],
): LegacyCardFallbackTelemetry {
  const sorted = [...hits].sort((a, b) => {
    if (a.recordedAt < b.recordedAt) return -1;
    if (a.recordedAt > b.recordedAt) return 1;
    return a.hitId < b.hitId ? -1 : a.hitId > b.hitId ? 1 : 0;
  });
  const body = {
    contract: CARD_FALLBACK_TELEMETRY_CONTRACT,
    hits: sorted,
    hitCount: sorted.length,
  };
  return {
    ...body,
    telemetryDigest: projectionDigest(body),
  };
}

/**
 * Old IDs are read-only compatibility inputs — never write them as Canonical.
 */
export function assertLegacyIdsReadOnly(
  knowledgeRefs: readonly string[],
): void {
  const legacy = knowledgeRefs.filter((id) => isLegacyLocalGraphNodeId(id));
  if (legacy.length > 0) {
    throw new CardResolveError(
      'legacy-id-write-rejected',
      `legacy graph IDs are read-only compatibility inputs: ${legacy.join(', ')}`,
    );
  }
}

/**
 * Interactive-manifest exercise discovery and atomization (#1515, tasks
 * 6.1–6.3, 6.6).
 *
 * The course runtime manifests are the truth for step activities: every
 * `interaction_spec.activity_cards` entry is one logical exercise card with
 * a stable unit/step/card identity. One atom is materialized per card over
 * the complete stem/options/answer/explanation payload; reference answers
 * are hashed into the atom identity and stay out of public projections.
 * Cards without a reference answer (open-ended responses) resolve to an
 * explicit per-card exclusion instead of a failure.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { FormalResourceRemediationError } from '../contracts';
import { processExerciseResource, type ExerciseAtom, type ExerciseQuestionInput } from './exercise';

/** One discovered activity card from a runtime manifest. */
export interface DiscoveredExerciseCard {
  readonly unit: string;
  readonly stepId: string;
  readonly cardId: string;
  readonly responseKind: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly referenceAnswer: string | null;
  readonly explanation: string;
  readonly originLocator: string;
}

export interface InteractiveManifestShape {
  readonly lesson_id: string;
  readonly steps: Readonly<Record<string, {
    readonly modules?: readonly { readonly kind?: string }[];
    readonly interaction_spec?: {
      readonly activity_cards?: readonly Record<string, unknown>[];
    };
  }>>;
}

function serializeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object' && 'key' in option && 'text' in option) {
      const record = option as { key: unknown; text: unknown };
      return `${String(record.key)}:${String(record.text)}`;
    }
    return JSON.stringify(option);
  });
}

function serializeAnswer(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') return raw.length > 0 ? raw : null;
  const serialized = JSON.stringify(raw);
  return serialized && serialized.length > 0 ? serialized : null;
}

/**
 * Discover every logical exercise card across the course runtime manifests.
 * A card without a prompt fails closed (ambiguous identity); a card without
 * a reference answer is kept for the explicit-exclusion path.
 */
export function discoverExerciseCards(manifest: InteractiveManifestShape, manifestPath: string): readonly DiscoveredExerciseCard[] {
  const cards: DiscoveredExerciseCard[] = [];
  const stepIds = Object.keys(manifest.steps).sort();
  for (const stepId of stepIds) {
    const step = manifest.steps[stepId];
    if (!step) continue;
    const stepCards = step.interaction_spec?.activity_cards ?? [];
    stepCards.forEach((card, index) => {
      const cardId = typeof card.id === 'string' && card.id.length > 0
        ? card.id
        : `card-${index + 1}`;
      const prompt = typeof card.prompt === 'string' ? card.prompt : '';
      if (prompt.length === 0) {
        throw new FormalResourceRemediationError(
          'ambiguous-mapping',
          `Exercise card ${manifest.lesson_id}/${stepId}/${cardId} has no prompt; a prompt is the minimum stable identity.`,
        );
      }
      cards.push({
        unit: manifest.lesson_id,
        stepId,
        cardId,
        responseKind: typeof card.response_kind === 'string' ? card.response_kind : 'unknown',
        prompt,
        options: serializeOptions(card.options),
        referenceAnswer: serializeAnswer(card.reference_answer),
        explanation: typeof card.explanation === 'string' ? card.explanation : '',
        originLocator: `${manifestPath}#steps.${stepId}.interaction_spec.activity_cards.${cardId}`,
      });
    });
  }
  return cards;
}

export interface ExerciseProcessingResult {
  readonly resourceId: string;
  readonly atoms: readonly ExerciseAtom[];
  /** Cards resolved to an explicit exclusion (e.g. no reference answer). */
  readonly excludedCards: readonly { readonly cardId: string; readonly reason: string }[];
  /** Private answer digests keyed by atom id — proof without exposure. */
  readonly answerDigests: readonly { readonly atomId: string; readonly answerDigest: string }[];
}

/**
 * Materialize one atom per exercised card. Cards without a reference answer
 * become explicit exclusions; duplicate card ids are rejected so logical
 * exercise identity stays stable.
 */
export function processInteractiveManifestExercises(input: {
  resourceId: string;
  manifestPath: string;
  cards: readonly DiscoveredExerciseCard[];
}): ExerciseProcessingResult {
  const exercised: ExerciseQuestionInput[] = [];
  const excludedCards: { cardId: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const card of input.cards) {
    const questionId = `${card.unit}/${card.stepId}/${card.cardId}`;
    if (seen.has(questionId)) {
      throw new FormalResourceRemediationError(
        'ambiguous-mapping',
        `Exercise card ${questionId} appears twice in ${input.resourceId}.`,
      );
    }
    seen.add(questionId);
    if (card.referenceAnswer === null) {
      excludedCards.push({ cardId: questionId, reason: 'no-reference-answer: open-ended response card stays outside the formal exercise denominator' });
      continue;
    }
    exercised.push({
      questionId,
      stem: card.prompt,
      options: card.options,
      answer: card.referenceAnswer,
      explanation: card.explanation,
      originLocator: card.originLocator,
    });
  }
  if (exercised.length === 0) {
    return { resourceId: input.resourceId, atoms: [], excludedCards, answerDigests: [] };
  }
  const { atoms } = processExerciseResource({ resourceId: input.resourceId, questions: exercised });
  return {
    resourceId: input.resourceId,
    atoms,
    excludedCards,
    answerDigests: atoms.map((atom) => ({ atomId: atom.atomId, answerDigest: atom.answerDigest })),
  };
}

/** Deterministic record digest over the exercise outputs of one manifest. */
export function exerciseOutputManifestHash(result: ExerciseProcessingResult): string {
  return projectionDigest({
    resourceId: result.resourceId,
    atomIds: result.atoms.map((atom) => atom.atomId),
    excluded: result.excludedCards.map((card) => [card.cardId, card.reason]),
  });
}

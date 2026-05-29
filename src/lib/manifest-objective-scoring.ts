import type {
  InteractiveRuntimeChoiceOptionManifest,
  InteractiveRuntimeReferenceMatchManifest,
} from './interactive-lesson-manifest';
import {
  isObjectiveInteractiveResponseKind,
  normalizeInteractiveResponseKind,
} from './interactive-response-contracts';

export const MANIFEST_OBJECTIVE_SCORING_VERSION = 'manifest-objective-scoring/v1';

export type ManifestObjectiveScoringUnsupportedReason =
  | 'missing_reference'
  | 'unsupported_response_kind';

export interface ManifestObjectiveCardLike {
  id: string;
  title?: string;
  responseKind: string;
  referenceAnswer?: string;
  options: InteractiveRuntimeChoiceOptionManifest[];
  matchItems?: InteractiveRuntimeChoiceOptionManifest[];
  matchOptions?: InteractiveRuntimeChoiceOptionManifest[];
  referenceMatches?: InteractiveRuntimeReferenceMatchManifest[];
}

export interface ManifestObjectiveScoringResult {
  scoringVersion: typeof MANIFEST_OBJECTIVE_SCORING_VERSION;
  kind: string;
  answered: boolean;
  score: number | null;
  isCorrect: boolean | undefined;
  normalizedSubmitted: unknown;
  normalizedReference: unknown;
  referenceValue?: string | string[];
  detail: Record<string, unknown>;
  unsupportedReason?: ManifestObjectiveScoringUnsupportedReason;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function splitAnswerTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitAnswerTokens);
  return String(value ?? '')
    .split(/\s*(?:\|+|[,，、;；/])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitAnswerSlotTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim());
  const raw = String(value ?? '');
  if (raw.includes('|')) {
    return raw.split('|').map((item) => item.trim());
  }
  return raw
    .split(/\s*(?:[,，、;；/])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = normalizeToken(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = normalizeToken(value);
    if (seen.has(key)) {
      duplicates.push(value);
      continue;
    }
    seen.add(key);
  }
  return duplicates;
}

function effectiveSlotLength(tokens: string[], minimumLength: number): number {
  let lastNonEmptyIndex = -1;
  tokens.forEach((token, index) => {
    if (token) lastNonEmptyIndex = index;
  });
  return Math.max(minimumLength, lastNonEmptyIndex + 1);
}

function findOptionValue(options: readonly InteractiveRuntimeChoiceOptionManifest[], token: string): string | undefined {
  const normalizedToken = normalizeToken(token);
  const option = options.find((item) => (
    normalizeToken(item.value) === normalizedToken
    || normalizeToken(item.label) === normalizedToken
  ));
  return option?.value;
}

function normalizeSubmittedOptions(
  answer: unknown,
  options: readonly InteractiveRuntimeChoiceOptionManifest[],
): string[] {
  return splitAnswerTokens(answer).map((token) => findOptionValue(options, token) ?? token);
}

function extractReferenceChoiceTokens(referenceAnswer: string): string[] {
  const prefixed = referenceAnswer.match(/(?:^|[。．.，,；;\s])(?:选|答案|正确答案)\s*[:：]?\s*([A-Za-z](?:\s*[、,，/]\s*[A-Za-z])*)/);
  if (prefixed?.[1]) return splitAnswerTokens(prefixed[1]);

  const leading = referenceAnswer.match(/^\s*([A-Za-z](?:\s*[、,，/]\s*[A-Za-z])*)(?=[。．.，,、；;\s]|$)/);
  if (leading?.[1]) return splitAnswerTokens(leading[1]);

  return [];
}

function resolveReferenceOptions(card: ManifestObjectiveCardLike): string[] {
  const referenceAnswer = card.referenceAnswer?.trim();
  if (!referenceAnswer) return [];

  const exactOptionValue = findOptionValue(card.options, referenceAnswer);
  if (exactOptionValue) return [exactOptionValue];

  const choiceTokens = extractReferenceChoiceTokens(referenceAnswer);
  if (choiceTokens.length > 0) {
    return choiceTokens.map((token) => findOptionValue(card.options, token) ?? token);
  }

  const textTokens = splitAnswerTokens(referenceAnswer)
    .map((token) => findOptionValue(card.options, token) ?? token)
    .filter(Boolean);
  return textTokens.length > 0 ? textTokens : [referenceAnswer];
}

function unsupported(
  kind: string,
  answered: boolean,
  normalizedSubmitted: unknown,
  reason: ManifestObjectiveScoringUnsupportedReason,
): ManifestObjectiveScoringResult {
  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind,
    answered,
    score: null,
    isCorrect: undefined,
    normalizedSubmitted,
    normalizedReference: null,
    detail: {},
    unsupportedReason: reason,
  };
}

function scoreChoice(card: ManifestObjectiveCardLike, submittedAnswer: unknown): ManifestObjectiveScoringResult {
  const submittedOptions = normalizeSubmittedOptions(submittedAnswer, card.options);
  const submitted = submittedOptions.length === 1 ? submittedOptions[0] : submittedOptions;
  const answered = submittedOptions.length > 0;
  const reference = resolveReferenceOptions(card)[0];
  if (!reference) return unsupported(card.responseKind, answered, submitted, 'missing_reference');
  const isCorrect = submittedOptions.length === 1 && normalizeToken(submittedOptions[0]) === normalizeToken(reference);
  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind: card.responseKind,
    answered,
    score: isCorrect ? 1 : 0,
    isCorrect,
    normalizedSubmitted: submitted,
    normalizedReference: reference,
    referenceValue: reference,
    detail: submittedOptions.length > 1 ? { extraSubmittedOptions: submittedOptions.slice(1) } : {},
  };
}

function scoreMultiSelect(card: ManifestObjectiveCardLike, submittedAnswer: unknown): ManifestObjectiveScoringResult {
  const submitted = normalizeSubmittedOptions(submittedAnswer, card.options);
  const answered = submitted.length > 0;
  const reference = unique(resolveReferenceOptions(card));
  if (reference.length === 0) return unsupported(card.responseKind, answered, submitted, 'missing_reference');

  const submittedSet = new Set(submitted.map(normalizeToken));
  const referenceSet = new Set(reference.map(normalizeToken));
  const correctHits = reference.filter((value) => submittedSet.has(normalizeToken(value)));
  const missedCorrectOptions = reference.filter((value) => !submittedSet.has(normalizeToken(value)));
  const extraWrongOptions = submitted.filter((value) => !referenceSet.has(normalizeToken(value)));
  const duplicateSubmittedOptions = duplicateValues(submitted);
  const duplicateCorrectOptions = duplicateSubmittedOptions.filter((value) => referenceSet.has(normalizeToken(value)));
  const denominator = reference.length + extraWrongOptions.length + duplicateCorrectOptions.length;
  const score = denominator > 0 ? correctHits.length / denominator : 0;

  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind: card.responseKind,
    answered,
    score,
    isCorrect: score === 1,
    normalizedSubmitted: submitted,
    normalizedReference: reference,
    referenceValue: reference,
    detail: {
      correctHits,
      missedCorrectOptions,
      extraWrongOptions,
      duplicateSubmittedOptions,
    },
  };
}

function resolveOrderReference(card: ManifestObjectiveCardLike): string[] {
  return card.options.map((option) => option.value);
}

function scoreOrdering(card: ManifestObjectiveCardLike, submittedAnswer: unknown): ManifestObjectiveScoringResult {
  const submitted = normalizeSubmittedOptions(submittedAnswer, card.options);
  const answered = submitted.length > 0;
  const reference = resolveOrderReference(card);
  if (reference.length === 0) return unsupported(card.responseKind, answered, submitted, 'missing_reference');

  const correctPositions = reference.filter((value, index) => normalizeToken(submitted[index]) === normalizeToken(value));
  const misplacedItems = submitted
    .slice(0, reference.length)
    .filter((value, index) => normalizeToken(reference[index]) !== normalizeToken(value));
  const extraItems = submitted.slice(reference.length);
  const denominator = Math.max(reference.length, submitted.length);
  const score = correctPositions.length / denominator;

  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind: card.responseKind,
    answered,
    score,
    isCorrect: score === 1,
    normalizedSubmitted: submitted,
    normalizedReference: reference,
    referenceValue: reference,
    detail: {
      correctPositions,
      misplacedItems,
      extraItems,
    },
  };
}

function resolveReferenceMatchEntries(card: ManifestObjectiveCardLike): Array<[string, string]> {
  return (card.referenceMatches ?? [])
    .map((match) => [match.item, match.option] as [string, string])
    .filter(([item, option]) => Boolean(item) && Boolean(option));
}

function parsePairToken(token: string): [string, string] | null {
  const explicitSeparator = token.match(/^\s*(.+?)\s*(?:->|=>|:|=|→)\s*(.+?)\s*$/);
  if (explicitSeparator?.[1] && explicitSeparator[2]) {
    return [explicitSeparator[1].trim(), explicitSeparator[2].trim()];
  }

  const hyphenSeparator = token.match(/^\s*([^-:=→>]+?)\s*-\s*([^-:=→>]+?)\s*$/);
  if (!hyphenSeparator?.[1] || !hyphenSeparator[2]) return null;
  return [hyphenSeparator[1].trim(), hyphenSeparator[2].trim()];
}

function isRecognizedMatchPair(card: ManifestObjectiveCardLike, pair: [string, string]): boolean {
  const [item, option] = pair;
  const itemOptions = card.matchItems?.length ? card.matchItems : card.options;
  const optionOptions = card.matchOptions ?? card.options;
  const referenceEntries = resolveReferenceMatchEntries(card);
  const itemRecognized = Boolean(findOptionValue(itemOptions, item))
    || referenceEntries.some(([referenceItem]) => normalizeToken(referenceItem) === normalizeToken(item));
  const optionRecognized = Boolean(findOptionValue(optionOptions, option))
    || referenceEntries.some(([, referenceOption]) => normalizeToken(referenceOption) === normalizeToken(option));
  return itemRecognized && optionRecognized;
}

function shouldUsePairSyntax(card: ManifestObjectiveCardLike, parsedPairs: Array<[string, string] | null>): parsedPairs is Array<[string, string]> {
  return parsedPairs.length > 0
    && parsedPairs.every((pair): pair is [string, string] => Boolean(pair))
    && parsedPairs.some((pair) => isRecognizedMatchPair(card, pair));
}

function normalizeMatchPairsFromAnswer(
  card: ManifestObjectiveCardLike,
  submittedAnswer: unknown,
): Record<string, string> {
  const tokens = splitAnswerSlotTokens(submittedAnswer);
  const pairTokens = splitAnswerTokens(submittedAnswer);
  const itemOptions = card.matchItems?.length ? card.matchItems : card.options;
  const itemOrder = itemOptions.map((item) => item.value);
  const parsedPairs = pairTokens.map(parsePairToken);

  if (shouldUsePairSyntax(card, parsedPairs)) {
    return Object.fromEntries(parsedPairs.map(([item, option]) => [
      findOptionValue(itemOptions, item) ?? item,
      findOptionValue(card.matchOptions ?? card.options, option) ?? option,
    ]));
  }

  return Object.fromEntries(tokens.map((token, index) => [
    itemOrder[index],
    findOptionValue(card.matchOptions ?? card.options, token) ?? token,
  ]).filter(([item, option]) => Boolean(item) && Boolean(option)));
}

function scoreLegacyMatchingBySlotOrder(
  card: ManifestObjectiveCardLike,
  submittedAnswer: unknown,
): ManifestObjectiveScoringResult {
  const reference = resolveOrderReference(card);
  const allSubmittedSlots = splitAnswerSlotTokens(submittedAnswer)
    .map((token) => token ? findOptionValue(card.options, token) ?? token : '');
  const submittedLength = effectiveSlotLength(allSubmittedSlots, reference.length);
  const submitted = allSubmittedSlots.slice(0, submittedLength);
  const answered = submitted.some(Boolean);
  if (reference.length === 0) return unsupported(card.responseKind, answered, submitted, 'missing_reference');

  const correctPositions = reference.filter((value, index) => normalizeToken(submitted[index]) === normalizeToken(value));
  const missedPositions = reference
    .map((value, index) => ({ index, expected: value, submitted: submitted[index] ?? '' }))
    .filter((item) => !item.submitted);
  const misplacedItems = submitted
    .slice(0, reference.length)
    .filter((value, index) => value && normalizeToken(reference[index]) !== normalizeToken(value));
  const extraItems = submitted.slice(reference.length).filter(Boolean);
  const score = correctPositions.length / submittedLength;

  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind: card.responseKind,
    answered,
    score,
    isCorrect: score === 1,
    normalizedSubmitted: submitted,
    normalizedReference: reference,
    referenceValue: reference,
    detail: {
      correctPositions,
      misplacedItems,
      missedPositions,
      extraItems,
      fallback: 'legacy_slot_order',
    },
  };
}

function scoreMatching(card: ManifestObjectiveCardLike, submittedAnswer: unknown): ManifestObjectiveScoringResult {
  const referenceEntries = resolveReferenceMatchEntries(card);
  if (referenceEntries.length === 0 && card.options.length > 0) {
    return scoreLegacyMatchingBySlotOrder(card, submittedAnswer);
  }

  const reference = Object.fromEntries(referenceEntries);
  const submitted = normalizeMatchPairsFromAnswer(card, submittedAnswer);
  const answered = Object.keys(submitted).length > 0;
  if (referenceEntries.length === 0) return unsupported(card.responseKind, answered, submitted, 'missing_reference');

  const submittedSlots = splitAnswerSlotTokens(submittedAnswer);
  const pairTokens = splitAnswerTokens(submittedAnswer);
  const parsedPairs = pairTokens.map(parsePairToken);
  const usesPairSyntax = shouldUsePairSyntax(card, parsedPairs);
  const itemOptions = card.matchItems?.length ? card.matchItems : card.options;
  const normalizedPairEntries = usesPairSyntax
    ? parsedPairs
      .filter((pair): pair is [string, string] => Boolean(pair))
      .map(([item, option]) => ({
        item: findOptionValue(itemOptions, item) ?? item,
        option: findOptionValue(card.matchOptions ?? card.options, option) ?? option,
      }))
    : [];
  const referenceItemSet = new Set(referenceEntries.map(([item]) => normalizeToken(item)));
  const duplicateItemKeys = new Set<string>();
  const seenPairItems = new Set<string>();
  const extraItems = usesPairSyntax
    ? normalizedPairEntries.filter(({ item }) => {
        const itemKey = normalizeToken(item);
        const isDuplicate = seenPairItems.has(itemKey);
        if (isDuplicate) duplicateItemKeys.add(itemKey);
        const isExtra = !referenceItemSet.has(itemKey) || isDuplicate;
        seenPairItems.add(itemKey);
        return isExtra;
      })
    : submittedSlots.slice(referenceEntries.length).filter(Boolean);
  const duplicateItems = referenceEntries
    .map(([item]) => item)
    .filter((item) => duplicateItemKeys.has(normalizeToken(item)));
  const correctPairs = referenceEntries
    .filter(([item, option]) => (
      !duplicateItemKeys.has(normalizeToken(item))
      && normalizeToken(submitted[item]) === normalizeToken(option)
    ))
    .map(([item, option]) => ({ item, option }));
  const incorrectPairs = referenceEntries
    .filter(([item, option]) => (
      submitted[item] !== undefined
      && (
        duplicateItemKeys.has(normalizeToken(item))
        || normalizeToken(submitted[item]) !== normalizeToken(option)
      )
    ))
    .map(([item, option]) => ({ item, expected: option, submitted: submitted[item] }));
  const missedItems = referenceEntries
    .filter(([item]) => submitted[item] === undefined)
    .map(([item]) => item);
  const score = correctPairs.length / (referenceEntries.length + extraItems.length);

  return {
    scoringVersion: MANIFEST_OBJECTIVE_SCORING_VERSION,
    kind: card.responseKind,
    answered,
    score,
    isCorrect: score === 1,
    normalizedSubmitted: submitted,
    normalizedReference: reference,
    referenceValue: referenceEntries.map(([, option]) => option),
    detail: {
      correctPairs,
      incorrectPairs,
      missedItems,
      duplicateItems,
      extraItems,
    },
  };
}

export function isManifestObjectiveResponseKind(responseKind: string): boolean {
  return isObjectiveInteractiveResponseKind(responseKind);
}

export function scoreManifestObjectiveCard(
  card: ManifestObjectiveCardLike,
  submittedAnswer: unknown,
): ManifestObjectiveScoringResult {
  const normalizedCard = {
    ...card,
    responseKind: normalizeInteractiveResponseKind(card.responseKind),
  };
  switch (normalizedCard.responseKind) {
    case 'choice.single':
    case 'choice.binary':
      return scoreChoice(normalizedCard, submittedAnswer);
    case 'choice.multi':
      return scoreMultiSelect(normalizedCard, submittedAnswer);
    case 'ordering.sequence':
      return scoreOrdering(normalizedCard, submittedAnswer);
    case 'matching.pairs':
      return scoreMatching(normalizedCard, submittedAnswer);
    default:
      return unsupported(normalizedCard.responseKind, Boolean(String(submittedAnswer ?? '').trim()), submittedAnswer ?? null, 'unsupported_response_kind');
  }
}

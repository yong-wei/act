import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

interface ManifestResponseLike {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

interface ManifestSubmissionTelemetryOptions {
  extraEvidence?: Record<string, unknown>;
}

const OBJECTIVE_RESPONSE_KINDS = new Set([
  'single_choice',
  'binary_choice',
  'multi_choice',
  'multi_select',
  'drag_match',
  'triple_match',
  'drag_sort',
  'card_sort',
]);

function isObjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return OBJECTIVE_RESPONSE_KINDS.has(card.responseKind);
}

function isSubjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return !isObjectiveCard(card);
}

function splitAnswerTokens(value: string): string[] {
  return value
    .split(/\s*(?:\|+|[,，、;；/])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnswerToken(value: string): string {
  return value.trim().toLowerCase();
}

function findOptionValue(card: InteractiveRuntimeActivityCardManifest, token: string): string | undefined {
  const normalizedToken = normalizeAnswerToken(token);
  const option = card.options.find((item) => (
    normalizeAnswerToken(item.value) === normalizedToken
    || normalizeAnswerToken(item.label) === normalizedToken
  ));
  return option?.value;
}

function extractReferenceChoiceTokens(referenceAnswer: string): string[] {
  const prefixed = referenceAnswer.match(/(?:^|[。．.，,；;\s])(?:选|答案|正确答案)\s*[:：]?\s*([A-Za-z](?:\s*[、,，/]\s*[A-Za-z])*)/);
  if (prefixed?.[1]) return splitAnswerTokens(prefixed[1]);

  const leading = referenceAnswer.match(/^\s*([A-Za-z](?:\s*[、,，/]\s*[A-Za-z])*)(?=[。．.，,、；;\s]|$)/);
  if (leading?.[1]) return splitAnswerTokens(leading[1]);

  return [];
}

function resolveReferenceValue(card: InteractiveRuntimeActivityCardManifest): string | string[] | undefined {
  if ((card.responseKind === 'drag_match' || card.responseKind === 'triple_match') && card.referenceMatches?.length) {
    const itemOrder = (card.matchItems?.length ? card.matchItems : card.options).map((item) => item.value);
    const optionByItem = new Map(card.referenceMatches.map((item) => [item.item, item.option]));
    const orderedOptions = itemOrder.map((item) => optionByItem.get(item));
    if (orderedOptions.every((value): value is string => Boolean(value))) {
      return orderedOptions;
    }
  }

  const referenceAnswer = card.referenceAnswer?.trim();
  if (!referenceAnswer) return undefined;

  const exactOptionValue = findOptionValue(card, referenceAnswer);
  if (exactOptionValue) return exactOptionValue;

  const choiceTokens = extractReferenceChoiceTokens(referenceAnswer);
  if (choiceTokens.length > 0) {
    const optionValues = choiceTokens.map((token) => findOptionValue(card, token));
    if (optionValues.every((value): value is string => Boolean(value))) {
      return optionValues.length === 1 ? optionValues[0] : optionValues;
    }
  }

  return referenceAnswer;
}

function answersMatch(studentAnswer: string, referenceValue: string | string[]): boolean {
  const studentTokens = splitAnswerTokens(studentAnswer).map(normalizeAnswerToken).sort();
  const referenceTokens = (Array.isArray(referenceValue) ? referenceValue : splitAnswerTokens(referenceValue))
    .map(normalizeAnswerToken)
    .sort();

  return studentTokens.length > 0
    && studentTokens.length === referenceTokens.length
    && studentTokens.every((value, index) => value === referenceTokens[index]);
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasAnswerValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildSubjectiveCompleteness(
  cards: InteractiveRuntimeActivityCardManifest[],
  answers: Record<string, string>,
) {
  const subjectiveCards = cards.filter(isSubjectiveCard);
  if (subjectiveCards.length === 0) return undefined;
  const answeredCount = subjectiveCards.filter((card) => hasAnswerValue(answers[card.id])).length;
  return {
    answeredCount,
    totalCount: subjectiveCards.length,
    complete: answeredCount === subjectiveCards.length,
  };
}

export function buildManifestSubmissionTelemetry(
  response: ManifestResponseLike,
  stepManifest: InteractiveRuntimeStepManifest | null | undefined,
  options: ManifestSubmissionTelemetryOptions = {},
): Record<string, unknown> {
  const cards = stepManifest?.interactionSpec.activityCards ?? [];
  const answerDigest = Object.fromEntries(
    Object.entries(response.answers).filter(([, value]) => value.trim().length > 0),
  );
  const questionSummaries = cards
    .filter(isObjectiveCard)
    .map((card) => {
      const studentAnswer = response.answers[card.id];
      const answered = Boolean(studentAnswer?.trim());
      const referenceValue = resolveReferenceValue(card);
      return {
        questionId: card.id,
        title: card.title,
        responseKind: card.responseKind,
        studentAnswer: answered ? studentAnswer : null,
        referenceAnswer: card.referenceAnswer,
        referenceValue,
        answered,
        isCorrect: referenceValue ? (answered ? answersMatch(studentAnswer ?? '', referenceValue) : false) : undefined,
      };
    })
    .filter((item) => item.referenceValue !== undefined || item.answered);
  const scoreableQuestionSummaries = questionSummaries.filter((item) => typeof item.isCorrect === 'boolean');
  const scoringSupported = scoreableQuestionSummaries.length > 0;
  const correctCount = scoreableQuestionSummaries.filter((item) => item.isCorrect === true).length;
  const objectiveTotal = scoreableQuestionSummaries.length;
  const score = scoringSupported ? roundScore((correctCount / objectiveTotal) * 100) : undefined;
  const subjectiveCompleteness = buildSubjectiveCompleteness(cards, answerDigest);
  const extraEvidence = options.extraEvidence ?? {};
  const { parameterSnapshots, ...nestedExtraEvidence } = extraEvidence;
  const hasExtraEvidence = Object.keys(extraEvidence).length > 0;
  const evidenceQuality = scoringSupported
    ? 'rich'
    : Object.keys(answerDigest).length > 0 || hasExtraEvidence
      ? 'partial'
      : 'missing';

  return {
    schemaVersion: 'manifest-submission-v2',
    stepId: response.stepId,
    submittedAt: response.submittedAt,
    evidenceQuality,
    responseKind: 'manifest_step_response',
    interactionKind: stepManifest?.interactionSpec.interactionKind,
    answers: answerDigest,
    answerDigest,
    questionSummaries,
    scoringSupported,
    ...(scoringSupported ? { correctCount, objectiveTotal, score } : {}),
    ...(subjectiveCompleteness ? { subjectiveCompleteness } : {}),
    ...(parameterSnapshots !== undefined ? { parameterSnapshots } : {}),
    ...(Object.keys(nestedExtraEvidence).length > 0 ? { extraEvidence: nestedExtraEvidence } : {}),
  };
}

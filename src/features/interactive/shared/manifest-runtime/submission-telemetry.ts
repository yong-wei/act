import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

interface ManifestResponseLike {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

const OBJECTIVE_RESPONSE_KINDS = new Set([
  'single_choice',
  'binary_choice',
  'multi_select',
]);

function isObjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return OBJECTIVE_RESPONSE_KINDS.has(card.responseKind);
}

function splitAnswerTokens(value: string): string[] {
  return value
    .split(/\s*(?:\|\||[,，、;；/])\s*/)
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

export function buildManifestSubmissionTelemetry(
  response: ManifestResponseLike,
  stepManifest: InteractiveRuntimeStepManifest | null | undefined,
): Record<string, unknown> {
  const cards = stepManifest?.interactionSpec.activityCards ?? [];
  const answerDigest = Object.fromEntries(
    Object.entries(response.answers).filter(([, value]) => value.trim().length > 0),
  );
  const questionSummaries = cards
    .filter(isObjectiveCard)
    .map((card) => {
      const studentAnswer = response.answers[card.id];
      if (!studentAnswer?.trim()) return null;
      const referenceValue = resolveReferenceValue(card);
      return {
        questionId: card.id,
        title: card.title,
        responseKind: card.responseKind,
        studentAnswer,
        referenceAnswer: card.referenceAnswer,
        referenceValue,
        isCorrect: referenceValue ? answersMatch(studentAnswer, referenceValue) : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    stepId: response.stepId,
    submittedAt: response.submittedAt,
    responseKind: 'manifest_step_response',
    interactionKind: stepManifest?.interactionSpec.interactionKind,
    answers: answerDigest,
    answerDigest,
    questionSummaries,
    scoringSupported: questionSummaries.some((item) => item.referenceValue !== undefined),
  };
}

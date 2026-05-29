import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  isManifestObjectiveResponseKind,
  scoreManifestObjectiveCard,
} from '@/lib/manifest-objective-scoring';
import {
  getInteractiveResponseKindMetadata,
  isSubjectiveInteractiveResponseKind,
} from '@/lib/interactive-response-contracts';

interface ManifestResponseLike {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

interface ManifestSubmissionTelemetryOptions {
  extraEvidence?: Record<string, unknown>;
}

function isObjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return isManifestObjectiveResponseKind(card.responseKind);
}

function isSubjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return isSubjectiveInteractiveResponseKind(card.responseKind);
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

function unsupportedReasonForCard(card: InteractiveRuntimeActivityCardManifest): string | undefined {
  if (isObjectiveCard(card)) return undefined;
  const metadata = getInteractiveResponseKindMetadata(card.responseKind);
  if (metadata.scoring === 'subjective') return 'subjective_response_kind';
  return `${metadata.category}_response_kind`;
}

function buildResponseSummary(
  card: InteractiveRuntimeActivityCardManifest,
  answers: Record<string, string>,
) {
  const submittedAnswer = answers[card.id];
  const answered = hasAnswerValue(submittedAnswer);
  const metadata = getInteractiveResponseKindMetadata(card.responseKind);
  if (isObjectiveCard(card)) {
    const scoring = scoreManifestObjectiveCard(card, submittedAnswer);
    return {
      cardId: card.id,
      title: card.title,
      responseKind: scoring.kind,
      legacyResponseKind: card.legacyResponseKind,
      responseCategory: metadata.category,
      answered: scoring.answered,
      submittedAnswer: scoring.answered ? submittedAnswer : null,
      scoringSupported: typeof scoring.score === 'number',
      unsupportedReason: scoring.unsupportedReason,
    };
  }

  return {
    cardId: card.id,
    title: card.title,
    responseKind: card.responseKind,
    legacyResponseKind: card.legacyResponseKind,
    responseCategory: metadata.category,
    answered,
    submittedAnswer: answered ? submittedAnswer : null,
    scoringSupported: false,
    unsupportedReason: unsupportedReasonForCard(card),
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
      const scoring = scoreManifestObjectiveCard(card, studentAnswer);
      const metadata = getInteractiveResponseKindMetadata(card.responseKind);
      return {
        questionId: card.id,
        title: card.title,
        responseKind: scoring.kind,
        legacyResponseKind: card.legacyResponseKind,
        responseCategory: metadata.category,
        studentAnswer: scoring.answered ? studentAnswer : null,
        referenceAnswer: card.referenceAnswer,
        referenceValue: scoring.referenceValue,
        answered: scoring.answered,
        isCorrect: scoring.isCorrect,
        score: scoring.score,
        scoringVersion: scoring.scoringVersion,
        normalizedSubmitted: scoring.normalizedSubmitted,
        normalizedReference: scoring.normalizedReference,
        scoringDetail: scoring.detail,
        unsupportedReason: scoring.unsupportedReason,
      };
    })
    .filter((item) => item.referenceValue !== undefined || item.answered || item.unsupportedReason);
  const responseSummaries = cards.map((card) => buildResponseSummary(card, response.answers));
  const scoreableQuestionSummaries = questionSummaries.filter((item) => typeof item.score === 'number');
  const scoringSupported = scoreableQuestionSummaries.length > 0;
  const correctCount = scoreableQuestionSummaries.filter((item) => item.isCorrect === true).length;
  const objectiveTotal = scoreableQuestionSummaries.length;
  const score = scoringSupported
    ? roundScore((scoreableQuestionSummaries.reduce((sum, item) => sum + (item.score ?? 0), 0) / objectiveTotal) * 100)
    : undefined;
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
    responseSummaries,
    questionSummaries,
    scoringSupported,
    ...(scoringSupported ? { correctCount, objectiveTotal, score } : {}),
    ...(subjectiveCompleteness ? { subjectiveCompleteness } : {}),
    ...(parameterSnapshots !== undefined ? { parameterSnapshots } : {}),
    ...(Object.keys(nestedExtraEvidence).length > 0 ? { extraEvidence: nestedExtraEvidence } : {}),
  };
}

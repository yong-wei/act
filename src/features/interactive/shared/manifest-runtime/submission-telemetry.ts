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
      return {
        questionId: card.id,
        title: card.title,
        responseKind: card.responseKind,
        studentAnswer,
        referenceAnswer: card.referenceAnswer,
        isCorrect: card.referenceAnswer ? studentAnswer.trim() === card.referenceAnswer.trim() : undefined,
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
    scoringSupported: questionSummaries.some((item) => typeof item.referenceAnswer === 'string' && item.referenceAnswer.trim().length > 0),
  };
}

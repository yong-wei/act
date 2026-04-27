import type { UNIT_3_6StepResponse } from '@/lib/unit-3-6-course';

const PRETEST_CORRECT_ANSWERS: Record<string, string> = {
  q1: 'root-region',
  q2: 'bode',
  q3: 'review-goal',
};

const POSTTEST_CORRECT_ANSWERS: Record<string, string> = {
  q1: 'same-goal',
  q2: 'equivalent-pole',
  q3: 'nmp-boundary',
};

function getAssessmentKey(stepId: string) {
  if (stepId === 'step-04') return 'pretest';
  if (stepId === 'step-15') return 'posttest';
  return 'activity';
}

function getCorrectAnswers(stepId: string) {
  if (stepId === 'step-04') return PRETEST_CORRECT_ANSWERS;
  if (stepId === 'step-15') return POSTTEST_CORRECT_ANSWERS;
  return {};
}

function summarizeAnswerKeys(answers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => key !== 'reason' && key !== 'reflectionSubmitted' && value),
  );
}

function countCorrect(answerKeys: Record<string, string>, correctAnswers: Record<string, string>) {
  const entries = Object.entries(correctAnswers);
  return entries.filter(([key, value]) => answerKeys[key] === value).length;
}

export function buildUNIT36SubmissionTelemetry(response: UNIT_3_6StepResponse) {
  const assessmentKind = getAssessmentKey(response.stepId);
  const correctAnswers = getCorrectAnswers(response.stepId);
  const answerKeys = summarizeAnswerKeys(response.answers);
  const totalCount = Object.keys(correctAnswers).length;
  const correctCount = totalCount > 0 ? countCorrect(answerKeys, correctAnswers) : undefined;
  const score =
    typeof correctCount === 'number' && totalCount > 0
      ? Math.round((correctCount / totalCount) * 100)
      : undefined;
  const reason = response.answers.reason ?? '';
  const reflection = response.answers.reflectionSubmitted ?? '';

  return {
    stepId: response.stepId,
    submittedAt: response.submittedAt,
    assessmentKind,
    answerKeys,
    correctCount,
    totalCount: totalCount || undefined,
    score,
    answerCompleteness: {
      answerKeyCount: Object.keys(answerKeys).length,
      reasonLength: reason.length,
      reflectionLength: reflection.length,
    },
  };
}

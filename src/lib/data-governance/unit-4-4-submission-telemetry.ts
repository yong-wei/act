import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';

export interface Unit44StepResponseLike {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface Unit44QuestionSummary {
  questionId: string;
  prompt: string;
  studentAnswer: string | null;
  referenceAnswer: string;
  isCorrect: boolean;
}

export interface Unit44SubmissionTelemetry {
  moduleId: string;
  score: number;
  outcome: 'success' | 'partial' | 'failure';
  competencyContribution: Record<string, number>;
  evidenceTitle: string;
  questionSummaries: Unit44QuestionSummary[];
  answerDigest: Record<string, string | null>;
}

const STEP_COMPETENCY_SPECS: Record<string, {
  evidenceTitle: string;
  competencyContribution: Record<string, number>;
}> = {
  'step-08': {
    evidenceTitle: '4-4 step-08：目标函数与权重表达',
    competencyContribution: {
      parameterDesign: 0.7,
      controlModeling: 0.4,
    },
  },
  'step-10': {
    evidenceTitle: '4-4 step-10：候选解与 Pareto 解释',
    competencyContribution: {
      engineeringDecision: 0.7,
      parameterDesign: 0.5,
    },
  },
  'step-13': {
    evidenceTitle: '4-4 step-13：后测与总结判断',
    competencyContribution: {
      inquiryReflection: 0.6,
      selfDirectedLearning: 0.4,
      crossDomainTransfer: 0.4,
    },
  },
};

const CARD_REFERENCE_ANSWERS: Record<string, string> = {
  'weight-preference': 'C',
  'pareto-meaning': '因为它保留的是一组非支配候选',
  'post-quiz-1': '因为还没有经过 4-5 的工程复核',
  'post-quiz-2': '因为它保留的是一组非支配候选',
  'post-quiz-3': '因为任务通道变了，收益项和代价项必须跟着改写',
};

function toOutcome(score: number): Unit44SubmissionTelemetry['outcome'] {
  if (score >= 80) return 'success';
  if (score >= 50) return 'partial';
  return 'failure';
}

function referenceAnswerFor(card: NonNullable<InteractiveRuntimeStepManifest['interactionSpec']['activityCards']>[number]) {
  return card.referenceAnswer?.trim()
    || CARD_REFERENCE_ANSWERS[card.id]
    || '';
}

export function buildUNIT44SubmissionTelemetry(
  response: Unit44StepResponseLike,
  stepManifest: InteractiveRuntimeStepManifest,
): Unit44SubmissionTelemetry | null {
  const spec = STEP_COMPETENCY_SPECS[response.stepId];
  if (!spec) {
    return null;
  }

  const cards = stepManifest.interactionSpec.activityCards ?? [];
  if (!cards.length) {
    return null;
  }
  const hasMissingRequiredAnswer = cards.some((card) => {
    const answer = response.answers[card.id];
    return typeof answer !== 'string' || answer.trim().length === 0;
  });
  if (hasMissingRequiredAnswer) {
    return null;
  }

  const questionSummaries = cards.map((card) => {
    const studentAnswer = response.answers[card.id];
    const referenceAnswer = referenceAnswerFor(card);
    return {
      questionId: card.id,
      prompt: card.prompt,
      studentAnswer,
      referenceAnswer,
      isCorrect: Boolean(studentAnswer) && studentAnswer === referenceAnswer,
    };
  });

  if (questionSummaries.some((item) => !item.referenceAnswer)) {
    return null;
  }

  const score = questionSummaries.length
    ? Math.round((questionSummaries.filter((item) => item.isCorrect).length / questionSummaries.length) * 100)
    : 0;

  return {
    moduleId: response.stepId,
    score,
    outcome: toOutcome(score),
    competencyContribution: spec.competencyContribution,
    evidenceTitle: spec.evidenceTitle,
    questionSummaries,
    answerDigest: Object.fromEntries(
      questionSummaries.map((item) => [item.questionId, item.studentAnswer]),
    ),
  };
}

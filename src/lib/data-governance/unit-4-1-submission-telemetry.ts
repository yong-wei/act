export interface Unit41StepResponseLike {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

interface Unit41QuestionSpec {
  questionId: string;
  prompt: string;
  referenceAnswer: string;
}

export interface Unit41QuestionSummary {
  questionId: string;
  prompt: string;
  studentAnswer: string | null;
  referenceAnswer: string;
  isCorrect: boolean;
}

export interface Unit41SubmissionTelemetry {
  moduleId: string;
  score: number;
  outcome: 'success' | 'partial' | 'failure';
  timeSpent?: number;
  competencyContribution: Record<string, number>;
  evidenceTitle: string;
  questionSummaries: Unit41QuestionSummary[];
}

const STEP_SPECS: Record<string, {
  evidenceTitle: string;
  questions: Unit41QuestionSpec[];
  competencyContribution: Record<string, number>;
}> = {
  'step-03': {
    evidenceTitle: '4-1 前测：同图异读预判',
    competencyContribution: {
      controlModeling: 0.5,
      engineeringDecision: 0.5,
      crossDomainTransfer: 0.4,
      selfDirectedLearning: 0.2,
    },
    questions: [
      {
        questionId: 'pretest-q1',
        prompt: '系统已经稳定，下列哪项判断最准确？',
        referenceAnswer: 'B',
      },
      {
        questionId: 'pretest-q2',
        prompt: '关于带宽，下列说法哪项更准确？',
        referenceAnswer: 'B',
      },
      {
        questionId: 'pretest-q3',
        prompt: '关于“所有指标都重要”，下列说法最准确的是：',
        referenceAnswer: 'B',
      },
    ],
  },
  'step-10': {
    evidenceTitle: '4-1 可行域分层判断',
    competencyContribution: {
      engineeringDecision: 0.8,
      parameterDesign: 0.6,
      crossDomainTransfer: 0.3,
    },
    questions: [
      {
        questionId: 'layer-judgement',
        prompt: '“当前指标都满足，所以这已经是最优解。”这句话最准确的判断是：',
        referenceAnswer: 'acceptable_equals_optimal',
      },
    ],
  },
  'step-12': {
    evidenceTitle: '4-1 后测：任务表达出口判断',
    competencyContribution: {
      engineeringDecision: 0.9,
      parameterDesign: 0.7,
      crossDomainTransfer: 0.6,
      controlModeling: 0.2,
    },
    questions: [
      {
        questionId: 'post-q1',
        prompt: '4-1 最先要做的动作是什么？',
        referenceAnswer: 'B',
      },
      {
        questionId: 'post-q2',
        prompt: '关于可行域、满意域和最优域，下列哪项最准确？',
        referenceAnswer: 'B',
      },
      {
        questionId: 'post-q3',
        prompt: '同一套分析图会在两个案例里读出不同排序，最主要原因是什么？',
        referenceAnswer: 'B',
      },
    ],
  },
};

function toOutcome(score: number): Unit41SubmissionTelemetry['outcome'] {
  if (score >= 80) return 'success';
  if (score >= 50) return 'partial';
  return 'failure';
}

export function buildUNIT41SubmissionTelemetry(
  response: Unit41StepResponseLike,
): Unit41SubmissionTelemetry {
  const spec = STEP_SPECS[response.stepId];
  if (!spec) {
    return {
      moduleId: response.stepId,
      score: 0,
      outcome: 'failure',
      competencyContribution: {
        selfDirectedLearning: 0.1,
      },
      evidenceTitle: `4-1 ${response.stepId} 提交`,
      questionSummaries: [],
    };
  }

  const questionSummaries = spec.questions.map((question) => {
    const studentAnswer = response.answers[question.questionId] ?? null;
    return {
      ...question,
      studentAnswer,
      isCorrect: studentAnswer === question.referenceAnswer,
    };
  });
  const correctCount = questionSummaries.filter((question) => question.isCorrect).length;
  const score = Math.round((correctCount / questionSummaries.length) * 100);

  return {
    moduleId: response.stepId,
    score,
    outcome: toOutcome(score),
    competencyContribution: spec.competencyContribution,
    evidenceTitle: spec.evidenceTitle,
    questionSummaries,
  };
}

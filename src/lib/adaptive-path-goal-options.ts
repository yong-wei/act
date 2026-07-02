import {
  getLearningGoal,
  listLearningGoals,
  type LearningGoalDefinition,
  type LearningGoalIntentType,
  type LearningGoalRecommendedPhase,
} from '@/lib/adaptive-learning-path-planner';

export type AdaptivePracticeGoalId = string;

export interface AdaptivePathAdvisorQuickPrompt {
  label: string;
  question: string;
}

export interface AdaptivePathAdvisorGraphGrounding {
  goalId: string;
  targetGraphNodeIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
}

export interface AdaptivePathAdvisorGoalContext {
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
  quickPrompts: AdaptivePathAdvisorQuickPrompt[];
  graphNodeIds: string[];
  graphGrounding: AdaptivePathAdvisorGraphGrounding;
}

export interface AdaptivePracticeGoalOption {
  id: AdaptivePracticeGoalId;
  title: string;
  label: string;
  detail: string;
  description: string;
  completionMeaning: string;
  intentType: LearningGoalIntentType;
  recommendedPhase: LearningGoalRecommendedPhase;
  terminalValidationSummary: string;
  limitations: string[];
  hrefs: {
    generation: string;
    context: string;
  };
  konlingContext: AdaptivePathAdvisorGoalContext;
}

export function getAdaptivePracticeGoalOptions(): AdaptivePracticeGoalOption[] {
  return listLearningGoals()
    .filter((goal) => goal.status === 'path-ready')
    .map(projectLearningGoalToPracticeOption);
}

export function getAdaptivePracticeGoalOption(goalId: string | null | undefined): AdaptivePracticeGoalOption | null {
  if (!goalId) return null;
  const learningGoal = getLearningGoal(goalId);
  if (!learningGoal || learningGoal.status !== 'path-ready') return null;
  return projectLearningGoalToPracticeOption(learningGoal);
}

export function isAdaptivePracticeGoalId(value: string | null | undefined): value is AdaptivePracticeGoalId {
  return getAdaptivePracticeGoalOption(value) !== null;
}

export function adaptivePracticeGoalLabel(goalId: string): string {
  return getAdaptivePracticeGoalOption(goalId)?.title ?? '自适应学习';
}

export function getAdaptivePathAdvisorGoalContext(goalId: string): AdaptivePathAdvisorGoalContext | null {
  return getAdaptivePracticeGoalOption(goalId)?.konlingContext ?? null;
}

function projectLearningGoalToPracticeOption(goal: LearningGoalDefinition): AdaptivePracticeGoalOption {
  return {
    id: goal.id,
    title: goal.title,
    label: goal.title,
    detail: goal.description,
    description: goal.description,
    completionMeaning: goal.completionMeaning,
    intentType: goal.intentType,
    recommendedPhase: goal.recommendedPhase,
    terminalValidationSummary: goal.terminalValidationPolicy.summary,
    limitations: [...goal.limitations],
    hrefs: {
      generation: `/assessment/adaptive-practice?goal=${encodeURIComponent(goal.id)}&intent=contextual-recommendation`,
      context: `/api/adaptive/path-advisor-context?goal=${encodeURIComponent(goal.id)}`,
    },
    konlingContext: buildKonlingGoalContext(goal),
  };
}

function buildKonlingGoalContext(goal: LearningGoalDefinition): AdaptivePathAdvisorGoalContext {
  return {
    courseTitle: goal.title,
    topic: `${goal.title}学习路径`,
    learningObjectives: [
      goal.description,
      goal.completionMeaning,
      goal.terminalValidationPolicy.summary,
    ],
    quickPrompts: [
      {
        label: '生成路径',
        question: `请围绕${goal.title}生成一条可执行学习路径。`,
      },
      {
        label: '比较方案',
        question: `请比较${goal.title}当前可选路径的证据覆盖和执行风险。`,
      },
      {
        label: '调整路径',
        question: `请根据我的最新证据调整${goal.title}学习路径。`,
      },
    ],
    graphNodeIds: [...goal.targetGraphNodeIds],
    graphGrounding: {
      goalId: goal.id,
      targetGraphNodeIds: [...goal.targetGraphNodeIds],
      knowledgeObjectiveIds: [...goal.knowledgeObjectiveIds],
      capabilityObjectiveIds: [...goal.capabilityObjectiveIds],
      qualityObjectiveIds: [...goal.qualityObjectiveIds],
    },
  };
}

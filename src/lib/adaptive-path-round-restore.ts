import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import {
  getAdaptivePracticeGoalOption,
  isAdaptivePracticeGoalId,
} from '@/lib/adaptive-path-goal-options';

export interface LearningPathRoundForRestore {
  id: string;
  userId: string;
  title: string;
  goalId: string;
  pathStatus?: string | null;
  currentNodeId?: string | null;
  pathPayload?: Record<string, unknown> | null;
  explanationPayload?: Record<string, unknown> | null;
  alternativePayload?: unknown[] | null;
}

export function restoreAdaptiveLearningPathPlanFromRound(
  round: LearningPathRoundForRestore | null | undefined,
): AdaptiveLearningPathPlan | null {
  if (!round || !isAdaptivePracticeGoalId(round.goalId)) return null;
  const goalOption = getAdaptivePracticeGoalOption(round.goalId);
  const payload = round.pathPayload ?? {};
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  const alternatives = Array.isArray(payload.alternatives)
    ? payload.alternatives
    : Array.isArray(round.alternativePayload)
      ? round.alternativePayload
      : [];
  const explanations = restoreExplanations(
    round.explanationPayload,
    payload.explanations,
    planNodes.length === 0,
  );

  return {
    id: round.id,
    userId: round.userId,
    goal: {
      id: round.goalId,
      title: goalOption?.title ?? round.title,
      knowledgeTargets: [],
    },
    stage: 'stage-1-rules-graph',
    policyFamily: typeof payload.policyFamily === 'string'
      ? payload.policyFamily as AdaptiveLearningPathPlan['policyFamily']
      : 'rules-plus-graph-search',
    policyMetadata: payload.policyMetadata as AdaptiveLearningPathPlan['policyMetadata'],
    policyBundle: payload.policyBundle as AdaptiveLearningPathPlan['policyBundle'],
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: round.pathStatus === 'active' || round.pathStatus === 'completed' ? 'ready' : 'fallback',
    currentNodeId: round.currentNodeId ?? null,
    mainPath: planNodes as AdaptiveLearningPathPlan['mainPath'],
    alternatives: alternatives as AdaptiveLearningPathPlan['alternatives'],
    score: restoreScore(payload.score),
    confidence: payload.confidence as AdaptiveLearningPathPlan['confidence'] ?? {
      level: 'low',
      score: 0,
      sourceCoverage: 0,
    },
    explanations,
    executionStatus: restoreExecutionStatus(payload.executionStatus, round.currentNodeId),
    deviations: payload.deviations as AdaptiveLearningPathPlan['deviations'] ?? [],
    corrections: payload.corrections as AdaptiveLearningPathPlan['corrections'] ?? [],
    feedbackEvents: restoreFeedbackEvents(payload),
    visualization: payload.visualization as AdaptiveLearningPathPlan['visualization'],
  };
}

function restoreExplanations(
  explanationPayload: Record<string, unknown> | null | undefined,
  payloadExplanations: unknown,
  missingPlanNodes: boolean,
): AdaptiveLearningPathPlan['explanations'] {
  const wrapper = getRecord(explanationPayload);
  const nested = getRecord(wrapper.explanations);
  const candidate = Object.keys(nested).length > 0
    ? nested
    : Object.keys(wrapper).length > 0
      ? wrapper
      : getRecord(payloadExplanations);
  const fallbackReasons = getStringArray(candidate.fallbackReasons);
  return {
    ...candidate,
    selectedReasons: getStringArray(candidate.selectedReasons),
    rejectedAlternatives: Array.isArray(candidate.rejectedAlternatives)
      ? candidate.rejectedAlternatives as AdaptiveLearningPathPlan['explanations']['rejectedAlternatives']
      : [],
    fallbackReasons: fallbackReasons.length > 0
      ? fallbackReasons
      : missingPlanNodes ? ['missing-rules-graph-path-payload'] : [],
  } as AdaptiveLearningPathPlan['explanations'];
}

function restoreScore(score: unknown): AdaptiveLearningPathPlan['score'] {
  const candidate = getRecord(score);
  const objectives = getRecord(candidate.objectives);
  return {
    total: typeof candidate.total === 'number' ? candidate.total : 0,
    objectives: {
      learningGain: typeof objectives.learningGain === 'number' ? objectives.learningGain : 0,
      engagement: typeof objectives.engagement === 'number' ? objectives.engagement : 0,
      constraintSatisfaction: typeof objectives.constraintSatisfaction === 'number' ? objectives.constraintSatisfaction : 0,
      diversity: typeof objectives.diversity === 'number' ? objectives.diversity : 0,
      fatigue: typeof objectives.fatigue === 'number' ? objectives.fatigue : 0,
      dropoutRisk: typeof objectives.dropoutRisk === 'number' ? objectives.dropoutRisk : 0,
    },
  };
}

function restoreExecutionStatus(
  executionStatus: unknown,
  currentNodeId?: string | null,
): AdaptiveLearningPathPlan['executionStatus'] {
  const candidate = getRecord(executionStatus);
  return {
    adopted: typeof candidate.adopted === 'boolean' ? candidate.adopted : false,
    completedNodeIds: getStringArray(candidate.completedNodeIds),
    activeNodeId: typeof candidate.activeNodeId === 'string' ? candidate.activeNodeId : currentNodeId ?? null,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date(0).toISOString(),
  };
}

function restoreFeedbackEvents(payload: Record<string, unknown>): AdaptiveLearningPathPlan['feedbackEvents'] {
  if (Array.isArray(payload.feedbackEvents)) {
    return payload.feedbackEvents as AdaptiveLearningPathPlan['feedbackEvents'];
  }
  if (!Array.isArray(payload.selectionHistory)) return [];
  return payload.selectionHistory.map((item) => {
    const history = getRecord(item);
    return {
      id: typeof history.id === 'string' ? history.id : `selection-history:${Math.random().toString(36).slice(2)}`,
      type: typeof history.type === 'string'
        ? history.type as AdaptiveLearningPathPlan['feedbackEvents'][number]['type']
        : 'selection',
      nodeId: null,
      createdAt: typeof history.createdAt === 'string' ? history.createdAt : new Date().toISOString(),
      helpful: typeof history.helpful === 'boolean' ? history.helpful : undefined,
      context: {
        selectedStyleId: typeof history.selectedStyleId === 'string' ? history.selectedStyleId : undefined,
        previousStyleId: typeof history.previousStyleId === 'string' ? history.previousStyleId : undefined,
        rejectedStyleIds: getStringArray(history.rejectedStyleIds),
        helpful: typeof history.helpful === 'boolean' ? history.helpful : undefined,
      },
    };
  }) as AdaptiveLearningPathPlan['feedbackEvents'];
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

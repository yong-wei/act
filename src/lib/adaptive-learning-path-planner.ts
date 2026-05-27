import type {
  ResourceNode,
  ResourceNodePrivacyLevel,
  ResourceNodeRegistry,
} from './resource-node-registry';

export type AdaptiveLearningPathStatus = 'ready' | 'fallback';
export type AdaptiveLearningPathPolicyFamily = 'rules-plus-graph-search';
export type AdaptiveLearningPathFeedbackType =
  | 'adoption'
  | 'completion'
  | 'deviation'
  | 'correction-success'
  | 'explanation-click'
  | 'helpfulness';

export interface AdaptiveLearningPathGoal {
  id: string;
  title: string;
  knowledgeTargets: string[];
  competencyTargets?: string[];
}

export interface AdaptiveLearningPathLearnerState {
  knowledgeMastery?: {
    tags?: Record<string, {
      posteriorMastery?: number;
      confidence?: number;
      evidenceCount?: number;
    }>;
  };
  primaryCompetencies?: {
    vector?: Record<string, {
      score?: number;
      confidence?: number;
      evidenceCount?: number;
    }>;
  };
  resourcePreference?: {
    preferredModalities?: string[];
  };
  evidence?: {
    confidence?: {
      level?: 'none' | 'low' | 'medium' | 'high';
      score?: number;
      evidenceCount?: number;
      sourceCompleteness?: number;
    };
    sourceCoverage?: Record<string, string>;
  };
  risks?: {
    riskLevel?: string;
    activeFlags?: Array<{
      type: string;
      severity: string;
    }>;
  };
}

export interface AdaptiveLearningPathConstraints {
  timeBudgetMinutes: number;
  privacyScopes: ResourceNodePrivacyLevel[];
  device?: 'desktop' | 'tablet' | 'mobile';
  timelineWindowDays?: 3 | 7 | 14;
  completedNodeIds?: string[];
  teacherAssignedNodeIds?: string[];
  requireRiskIntervention?: boolean;
}

export interface AdaptiveLearningPathPlannerInput {
  studentId: string;
  goal: AdaptiveLearningPathGoal;
  learnerState: AdaptiveLearningPathLearnerState | null;
  registry: ResourceNodeRegistry;
  constraints: AdaptiveLearningPathConstraints;
  now?: Date;
}

export interface AdaptiveLearningPathPlanNode {
  nodeId: string;
  title: string;
  type: ResourceNode['type'];
  sourceKind: ResourceNode['sourceKind'];
  sourceRef: string;
  target: string;
  estimatedTimeMinutes: number;
  prerequisiteNodeIds: string[];
  knowledgeCoverage: string[];
  teacherPolicy: ResourceNode['planningMetadata']['teacherPolicy'];
  privacyLevel: ResourceNodePrivacyLevel;
  terminalConstraints: string[];
  score: number;
  reasonCodes: string[];
  status: 'current' | 'next' | 'completed' | 'blocked' | 'alternative';
}

export interface AdaptiveLearningPathAlternative {
  nodeId: string;
  nodeIds: string[];
  title: string;
  reasonCodes: string[];
  score: number;
  blocked: boolean;
}

export interface AdaptiveLearningPathExplanation {
  selectedReasons: string[];
  rejectedAlternatives: AdaptiveLearningPathAlternative[];
  fallbackReasons: string[];
}

export interface AdaptiveLearningPathScore {
  total: number;
  objectives: {
    learningGain: number;
    engagement: number;
    constraintSatisfaction: number;
    diversity: number;
    fatigue: number;
    dropoutRisk: number;
  };
}

export interface AdaptiveLearningPathMapPayload {
  mainPathNodeIds: string[];
  branchPaths: Array<{ fromNodeId: string; nodeIds: string[] }>;
  currentNodeId: string | null;
  completedNodeIds: string[];
  riskNodeIds: string[];
  blockedNodes: AdaptiveLearningPathAlternative[];
  alternatives: AdaptiveLearningPathAlternative[];
}

export interface AdaptiveLearningPathTimelinePayload {
  generatedAt: string;
  windows: Array<{
    days: 3 | 7 | 14;
    nodeIds: string[];
    estimatedMinutes: number;
  }>;
}

export interface AdaptiveLearningPathEvidencePayload {
  evidenceBasis: 'adaptive-learner-state' | 'fallback';
  confidence: AdaptiveLearningPathPlan['confidence'];
  sourceCoverage: Record<string, string>;
  learnerStateDeficits: AdaptiveLearningPathDeficit[];
  prerequisiteReasons: Array<{ nodeId: string; prerequisiteNodeIds: string[] }>;
  teacherPolicy: Array<{ nodeId: string; policy: ResourceNode['planningMetadata']['teacherPolicy'] }>;
  alternatives: AdaptiveLearningPathAlternative[];
}

export interface AdaptiveLearningPathVisualization {
  map: AdaptiveLearningPathMapPayload;
  timeline: AdaptiveLearningPathTimelinePayload;
  evidence: AdaptiveLearningPathEvidencePayload;
}

export interface AdaptiveLearningPathDeficit {
  targetId: string;
  kind: 'knowledge' | 'competency';
  value: number;
  confidence: number;
  evidenceCount: number;
  reasonCode: string;
}

export interface AdaptiveLearningPathFeedbackEvent {
  id: string;
  type: AdaptiveLearningPathFeedbackType;
  nodeId: string | null;
  createdAt: string;
  helpful?: boolean;
  context?: Record<string, unknown>;
}

export interface AdaptiveLearningPathDeviation {
  id: string;
  nodeId: string | null;
  createdAt: string;
  context: Record<string, unknown>;
  correctionPathId: string;
}

export interface AdaptiveLearningPathCorrection {
  id: string;
  priorEvidencePlanId: string;
  nodeIds: string[];
  reasonCodes: string[];
}

export interface AdaptiveLearningPathPlan {
  id: string;
  userId: string;
  goal: AdaptiveLearningPathGoal;
  stage: 'stage-1-rules-graph';
  policyFamily: AdaptiveLearningPathPolicyFamily;
  excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'];
  status: AdaptiveLearningPathStatus;
  currentNodeId: string | null;
  mainPath: AdaptiveLearningPathPlanNode[];
  alternatives: AdaptiveLearningPathAlternative[];
  score: AdaptiveLearningPathScore;
  confidence: {
    level: 'low' | 'medium' | 'high';
    score: number;
    sourceCoverage: number;
  };
  explanations: AdaptiveLearningPathExplanation;
  executionStatus: {
    adopted: boolean;
    completedNodeIds: string[];
    activeNodeId: string | null;
    updatedAt: string;
  };
  deviations: AdaptiveLearningPathDeviation[];
  corrections: AdaptiveLearningPathCorrection[];
  feedbackEvents: AdaptiveLearningPathFeedbackEvent[];
  visualization: AdaptiveLearningPathVisualization;
}

export interface AdaptiveLearningPathPersistenceRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  estimatedTime: number;
  nodeIds: string[];
  isAiGenerated: boolean;
  payload: {
    status: AdaptiveLearningPathStatus;
    currentNodeId: string | null;
    score: AdaptiveLearningPathScore;
    confidence: AdaptiveLearningPathPlan['confidence'];
    planNodes: AdaptiveLearningPathPlanNode[];
    alternatives: AdaptiveLearningPathAlternative[];
    explanations: AdaptiveLearningPathExplanation;
    executionStatus: AdaptiveLearningPathPlan['executionStatus'];
    deviations: AdaptiveLearningPathDeviation[];
    corrections: AdaptiveLearningPathCorrection[];
    feedbackEvents: AdaptiveLearningPathFeedbackEvent[];
    visualization: AdaptiveLearningPathVisualization;
  };
}

interface ScoredNode {
  node: ResourceNode;
  score: number;
  reasonCodes: string[];
}

interface CandidateChain {
  entries: ScoredNode[];
  estimatedMinutes: number;
  coversGoalTarget: boolean;
}

interface CandidateOption {
  entry: ScoredNode;
  chain: CandidateChain;
  goalTargets: string[];
  includesRiskIntervention: boolean;
}

interface SelectionState {
  selected: Map<string, ScoredNode>;
  coveredGoalTargets: Set<string>;
  includesRiskIntervention: boolean;
  remainingMinutes: number;
}

const EXCLUDED_POLICY_FAMILIES: AdaptiveLearningPathPlan['excludedPolicyFamilies'] = [
  'contextual-bandit',
  'reinforcement-learning',
  'long-horizon-hybrid',
];

export function buildAdaptiveLearningPathPlan(input: AdaptiveLearningPathPlannerInput): AdaptiveLearningPathPlan {
  const now = (input.now ?? new Date()).toISOString();
  const deficits = inferDeficits(input.goal, input.learnerState);
  const confidence = resolvePlanConfidence(input.learnerState);
  const sourceCoverage = input.learnerState?.evidence?.sourceCoverage ?? {};
  const requestedCompletedNodeIds = input.constraints.completedNodeIds ?? [];
  const { eligible, blocked } = partitionResourceNodes(input.registry.nodes, input.constraints);
  const eligibleIds = new Set(eligible.map((node) => node.id));
  const scored = eligible
    .filter((node) => nodeMatchesGoal(node, input.goal, deficits))
    .map((node) => scoreNode(node, deficits, input.learnerState, input.constraints))
    .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id));
  const mainPathNodes = buildFeasiblePath(
    scored,
    input.registry,
    input.constraints,
    input.goal,
    eligibleIds,
    requestedCompletedNodeIds,
  );
  const fallbackReasons = buildFallbackReasons({
    learnerState: input.learnerState,
    deficits,
    eligible,
    mainPathNodes,
    constraints: input.constraints,
    goal: input.goal,
    attemptedCandidates: scored.length,
  });
  const status: AdaptiveLearningPathStatus = fallbackReasons.length > 0 ? 'fallback' : 'ready';
  const plannedEntries = status === 'ready' ? mainPathNodes : [];
  const mainPathNodeIds = new Set(plannedEntries.map((entry) => entry.node.id));
  const completedNodeIds = requestedCompletedNodeIds.filter((nodeId) => mainPathNodeIds.has(nodeId));
  const planningCompletedNodeIds = requestedCompletedNodeIds.filter((nodeId) => eligibleIds.has(nodeId));
  const currentNodeId = status === 'ready'
    ? resolveCurrentNodeId(plannedEntries, completedNodeIds)
    : null;
  const mainPath = status === 'ready'
    ? plannedEntries.map((entry) => toPlanNode(entry, currentNodeId, completedNodeIds))
    : [];
  const alternatives = buildAlternatives(
    scored,
    mainPath,
    blocked,
    input.registry,
    eligibleIds,
    input.goal,
    input.constraints,
    planningCompletedNodeIds,
  );
  const score = buildPlanScore(mainPath, alternatives, input.learnerState, input.constraints);
  const explanations: AdaptiveLearningPathExplanation = {
    selectedReasons: mainPath.flatMap((node) => node.reasonCodes),
    rejectedAlternatives: alternatives.filter((item) => item.blocked || !mainPath.some((node) => node.nodeId === item.nodeId)),
    fallbackReasons,
  };

  return {
    id: `adaptive-path:${input.studentId}:${input.goal.id}`,
    userId: input.studentId,
    goal: input.goal,
    stage: 'stage-1-rules-graph',
    policyFamily: 'rules-plus-graph-search',
    excludedPolicyFamilies: EXCLUDED_POLICY_FAMILIES,
    status,
    currentNodeId,
    mainPath,
    alternatives,
    score,
    confidence,
    explanations,
    executionStatus: {
      adopted: false,
      completedNodeIds,
      activeNodeId: currentNodeId,
      updatedAt: now,
    },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: buildVisualization({
      mainPath,
      alternatives,
      blocked,
      currentNodeId,
      completedNodeIds,
      deficits,
      sourceCoverage,
      confidence,
      status,
      generatedAt: now,
    }),
  };
}

export function recordLearningPathFeedback(
  plan: AdaptiveLearningPathPlan,
  event: AdaptiveLearningPathFeedbackEvent,
): AdaptiveLearningPathPlan {
  const visibleNodeIds = new Set([
    ...plan.mainPath.map((node) => node.nodeId),
    ...plan.alternatives.map((node) => node.nodeId),
  ]);
  const safeEvent = event.nodeId && !visibleNodeIds.has(event.nodeId)
    ? { ...event, nodeId: null }
    : event;
  const feedbackEvents = [...plan.feedbackEvents, safeEvent];
  const deviations = [...plan.deviations];
  const corrections = [...plan.corrections];
  let executionStatus = plan.executionStatus;
  let currentNodeId = plan.currentNodeId;
  let mainPath = plan.mainPath;
  let visualization = plan.visualization;

  if (safeEvent.type === 'adoption') {
    executionStatus = { ...executionStatus, adopted: true, updatedAt: safeEvent.createdAt };
  }
  if (safeEvent.type === 'completion' && safeEvent.nodeId && plan.mainPath.some((node) => node.nodeId === safeEvent.nodeId)) {
    const completedNodeIds = unique([...executionStatus.completedNodeIds, safeEvent.nodeId]);
    currentNodeId = resolveCurrentPlanNodeId(mainPath, completedNodeIds);
    mainPath = mainPath.map((node) => ({
      ...node,
      status: completedNodeIds.includes(node.nodeId)
        ? 'completed'
        : node.nodeId === currentNodeId ? 'current' : 'next',
    }));
    const riskNodeIds = visualization.map.riskNodeIds.length > 0 && currentNodeId ? [currentNodeId] : [];
    visualization = {
      ...visualization,
      map: {
        ...visualization.map,
        currentNodeId,
        completedNodeIds,
        riskNodeIds,
        branchPaths: visualization.map.branchPaths.map((branch) => ({
          ...branch,
          fromNodeId: currentNodeId ?? 'start',
        })),
      },
      timeline: buildTimelinePayload(mainPath, visualization.timeline.generatedAt),
      evidence: {
        ...visualization.evidence,
        prerequisiteReasons: mainPath
          .filter((node) => node.prerequisiteNodeIds.length > 0)
          .map((node) => ({ nodeId: node.nodeId, prerequisiteNodeIds: node.prerequisiteNodeIds })),
        teacherPolicy: mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
      },
    };
    executionStatus = {
      ...executionStatus,
      completedNodeIds,
      activeNodeId: currentNodeId,
      updatedAt: safeEvent.createdAt,
    };
  }
  if (safeEvent.type === 'deviation') {
    const correctionId = `${plan.id}:correction:${corrections.length + 1}`;
    deviations.push({
      id: `${plan.id}:deviation:${deviations.length + 1}`,
      nodeId: safeEvent.nodeId,
      createdAt: safeEvent.createdAt,
      context: safeEvent.context ?? {},
      correctionPathId: correctionId,
    });
    corrections.push({
      id: correctionId,
      priorEvidencePlanId: plan.id,
      nodeIds: plan.alternatives.find((item) => !item.blocked && item.nodeIds.length > 0)?.nodeIds ?? [],
      reasonCodes: ['student-deviation', 'preserve-evidence-chain'],
    });
  }

  return {
    ...plan,
    currentNodeId,
    mainPath,
    executionStatus,
    deviations,
    corrections,
    feedbackEvents,
    visualization,
  };
}

export function serializeLearningPathPlan(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathPersistenceRecord {
  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.goal.title,
    description: plan.explanations.selectedReasons.join('; ') || plan.explanations.fallbackReasons.join('; '),
    estimatedTime: remainingEstimatedMinutes(plan.mainPath),
    nodeIds: plan.mainPath.map((node) => node.nodeId),
    isAiGenerated: false,
    payload: {
      status: plan.status,
      currentNodeId: plan.currentNodeId,
      score: plan.score,
      confidence: plan.confidence,
      planNodes: plan.mainPath,
      alternatives: plan.alternatives,
      explanations: plan.explanations,
      executionStatus: plan.executionStatus,
      deviations: plan.deviations,
      corrections: plan.corrections,
      feedbackEvents: plan.feedbackEvents,
      visualization: plan.visualization,
    },
  };
}

function inferDeficits(
  goal: AdaptiveLearningPathGoal,
  learnerState: AdaptiveLearningPathLearnerState | null,
): AdaptiveLearningPathDeficit[] {
  const knowledgeTags = learnerState?.knowledgeMastery?.tags ?? {};
  const competencies = learnerState?.primaryCompetencies?.vector ?? {};
  return [
    ...goal.knowledgeTargets
      .map((targetId) => {
        const mastery = knowledgeTags[targetId];
        const value = mastery?.posteriorMastery ?? 0;
        return {
          targetId,
          kind: 'knowledge' as const,
          value,
          confidence: mastery?.confidence ?? 0,
          evidenceCount: mastery?.evidenceCount ?? 0,
          reasonCode: value < 0.75 ? 'knowledge-deficit' : 'knowledge-maintenance',
        };
      })
      .filter((item) => item.value < 0.85),
    ...(goal.competencyTargets ?? [])
      .map((targetId) => {
        const competency = competencies[targetId];
        const value = competency?.score ?? 0;
        return {
          targetId,
          kind: 'competency' as const,
          value,
          confidence: competency?.confidence ?? 0,
          evidenceCount: competency?.evidenceCount ?? 0,
          reasonCode: value < 0.7 ? 'competency-deficit' : 'competency-maintenance',
        };
      })
      .filter((item) => item.value < 0.85),
  ];
}

function partitionResourceNodes(
  nodes: ResourceNode[],
  constraints: AdaptiveLearningPathConstraints,
): { eligible: ResourceNode[]; blocked: AdaptiveLearningPathAlternative[] } {
  const eligible: ResourceNode[] = [];
  const blocked: AdaptiveLearningPathAlternative[] = [];
  for (const node of nodes) {
    const reasonCodes = blockingReasonCodes(node, constraints);
    if (reasonCodes.length > 0) {
      blocked.push({
        nodeId: shouldRedactBlockedNode(node, reasonCodes) ? `restricted:${blocked.length + 1}` : node.id,
        nodeIds: [shouldRedactBlockedNode(node, reasonCodes) ? `restricted:${blocked.length + 1}` : node.id],
        title: shouldRedactBlockedNode(node, reasonCodes) ? '受限资源' : node.title,
        reasonCodes,
        score: 0,
        blocked: true,
      });
      continue;
    }
    eligible.push(node);
  }
  return { eligible, blocked };
}

function blockingReasonCodes(node: ResourceNode, constraints: AdaptiveLearningPathConstraints): string[] {
  const reasons: string[] = [];
  if (!node.eligibility.pathEligible) reasons.push(...node.eligibility.reasons);
  if (!constraints.privacyScopes.includes(node.planningMetadata.privacyLevel)) reasons.push('privacy-scope-blocked');
  if (node.planningMetadata.teacherPolicy === 'blocked') reasons.push('teacher-policy-blocked');
  if (node.planningMetadata.teacherPolicy === 'teacher-only') reasons.push('teacher-policy-teacher-only');
  if (
    node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
    !(constraints.teacherAssignedNodeIds ?? []).includes(node.id)
  ) {
    reasons.push('teacher-assignment-required');
  }
  if ((constraints.device === 'mobile' || constraints.device === 'tablet') && node.type === 'simulation') {
    reasons.push('device-constraint-blocked');
  }
  return unique(reasons);
}

function nodeMatchesGoal(
  node: ResourceNode,
  goal: AdaptiveLearningPathGoal,
  deficits: AdaptiveLearningPathDeficit[],
): boolean {
  const targets = new Set([
    ...goal.knowledgeTargets,
    ...deficits.map((deficit) => deficit.targetId),
  ]);
  return node.planningMetadata.knowledgeCoverage.some((tag) => targets.has(tag)) ||
    Object.keys(node.planningMetadata.abilityImpact).some((key) => (goal.competencyTargets ?? []).includes(key));
}

function scoreNode(
  node: ResourceNode,
  deficits: AdaptiveLearningPathDeficit[],
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
): ScoredNode {
  const coverageGain = node.planningMetadata.knowledgeCoverage.reduce((sum, tag) => {
    const deficit = deficits.find((item) => item.targetId === tag);
    return sum + (deficit ? 1 - deficit.value : 0.1);
  }, 0);
  const competencyTargets = new Set(
    deficits
      .filter((item) => item.kind === 'competency')
      .map((item) => item.targetId),
  );
  const abilityGain = Object.entries(node.planningMetadata.abilityImpact).reduce((sum, [dimension, impact]) => {
    const deficit = deficits.find((item) => item.kind === 'competency' && item.targetId === dimension);
    if (!deficit || !competencyTargets.has(dimension)) return sum;
    return sum + impact * (1 - deficit.value);
  }, 0);
  const modalityBoost = learnerState?.resourcePreference?.preferredModalities?.includes(node.type) ? 0.2 : 0;
  const fatiguePenalty = Math.max(0, (node.planningMetadata.estimatedTimeMinutes ?? 0) - constraints.timeBudgetMinutes / 2) / 100;
  const riskBoost = constraints.requireRiskIntervention && (node.type === 'ai_intervention' || node.type === 'reflection') ? 0.25 : 0;
  const score = round(coverageGain + abilityGain + modalityBoost + riskBoost - fatiguePenalty, 3);
  const reasonCodes = [
    coverageGain > 0 ? 'matches-knowledge-deficit' : null,
    abilityGain > 0 ? 'matches-competency-deficit' : null,
    modalityBoost > 0 ? 'matches-resource-preference' : null,
    riskBoost > 0 ? 'risk-intervention-fit' : null,
  ].filter((item): item is string => Boolean(item));
  return { node, score, reasonCodes };
}

function buildFeasiblePath(
  scoredNodes: ScoredNode[],
  registry: ResourceNodeRegistry,
  constraints: AdaptiveLearningPathConstraints,
  goal: AdaptiveLearningPathGoal,
  eligibleIds: Set<string>,
  completedNodeIds: string[],
): ScoredNode[] {
  const nodesById = new Map(registry.nodes.filter((node) => eligibleIds.has(node.id)).map((node) => [node.id, node]));
  const scoredById = new Map(scoredNodes.map((entry) => [entry.node.id, entry]));
  const completed = new Set(completedNodeIds);
  const allGoalTargets = new Set([
    ...goal.knowledgeTargets,
    ...(goal.competencyTargets ?? []),
  ]);
  const candidateOptions = scoredNodes.flatMap((entry): CandidateOption[] => {
    const chain = buildCandidateChain(entry, nodesById, scoredById, goal);
    if (!chain || !chain.coversGoalTarget) {
      return [];
    }
    if (chainHasTerminalViolation(chain.entries)) {
      return [];
    }
    return [{
      entry,
      chain,
      goalTargets: goalTargetsCoveredByNodes(chain.entries.map((candidate) => candidate.node), goal),
      includesRiskIntervention: chain.entries.some((candidate) => isRiskInterventionNode(candidate.node)),
    }];
  });
  let state: SelectionState = {
    selected: new Map(),
    coveredGoalTargets: new Set(),
    includesRiskIntervention: false,
    remainingMinutes: constraints.timeBudgetMinutes,
  };

  const tryAddOption = (option: CandidateOption, requireNewGoalTarget: boolean): boolean => {
    const addsGoalTarget = option.goalTargets.some((target) => !state.coveredGoalTargets.has(target));
    const addsRequiredRiskIntervention = constraints.requireRiskIntervention &&
      !state.includesRiskIntervention &&
      option.includesRiskIntervention;
    if (requireNewGoalTarget && !addsGoalTarget && !addsRequiredRiskIntervention) {
      return false;
    }
    const nextState = addCandidateOptionToState(option, state, completed);
    if (!nextState) {
      return false;
    }
    if (
      requireNewGoalTarget &&
      !allPlanningRequirementsSatisfied(nextState, allGoalTargets, constraints) &&
      !canCompletePlanningRequirements(candidateOptions, nextState, completed, allGoalTargets, constraints)
    ) {
      return false;
    }
    state = nextState;
    return true;
  };

  for (const option of candidateOptions) {
    tryAddOption(option, true);
  }

  if (allPlanningRequirementsSatisfied(state, allGoalTargets, constraints)) {
    for (const option of candidateOptions) {
      tryAddOption(option, false);
    }
  }

  return Array.from(state.selected.values()).sort((left, right) => {
    const leftTerminal = left.node.planningMetadata.terminalConstraints.includes('terminal-node');
    const rightTerminal = right.node.planningMetadata.terminalConstraints.includes('terminal-node');
    if (leftTerminal !== rightTerminal) {
      return leftTerminal ? 1 : -1;
    }
    return prerequisiteDepth(left.node, nodesById) - prerequisiteDepth(right.node, nodesById) ||
      right.score - left.score ||
      left.node.id.localeCompare(right.node.id);
  });
}

function addCandidateOptionToState(
  option: CandidateOption,
  state: SelectionState,
  completed: Set<string>,
): SelectionState | null {
  const newEntries = option.chain.entries.filter((candidate) => !state.selected.has(candidate.node.id));
  if (newEntries.length === 0) {
    return null;
  }
  if (Array.from(state.selected.values()).some((candidate) => isTerminalNode(candidate.node)) &&
    newEntries.some((candidate) => isTerminalNode(candidate.node))) {
    return null;
  }
  const newEstimatedMinutes = newEntries.reduce(
    (sum, candidate) => sum + (completed.has(candidate.node.id)
      ? 0
      : (candidate.node.planningMetadata.estimatedTimeMinutes ?? 0)),
    0,
  );
  if (newEstimatedMinutes > state.remainingMinutes) {
    return null;
  }
  const selected = new Map(state.selected);
  for (const candidate of option.chain.entries) {
    if (selected.has(candidate.node.id)) continue;
    selected.set(candidate.node.id, candidate);
  }
  const coveredGoalTargets = new Set(state.coveredGoalTargets);
  for (const target of option.goalTargets) {
    coveredGoalTargets.add(target);
  }
  return {
    selected,
    coveredGoalTargets,
    includesRiskIntervention: state.includesRiskIntervention || option.includesRiskIntervention,
    remainingMinutes: state.remainingMinutes - newEstimatedMinutes,
  };
}

function canCompletePlanningRequirements(
  options: CandidateOption[],
  state: SelectionState,
  completed: Set<string>,
  allGoalTargets: Set<string>,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  if (allPlanningRequirementsSatisfied(state, allGoalTargets, constraints)) {
    return true;
  }
  for (const option of options) {
    const addsGoalTarget = option.goalTargets.some((target) => !state.coveredGoalTargets.has(target));
    const addsRequiredRiskIntervention = constraints.requireRiskIntervention &&
      !state.includesRiskIntervention &&
      option.includesRiskIntervention;
    if (!addsGoalTarget && !addsRequiredRiskIntervention) {
      continue;
    }
    const nextState = addCandidateOptionToState(option, state, completed);
    if (nextState && canCompletePlanningRequirements(options, nextState, completed, allGoalTargets, constraints)) {
      return true;
    }
  }
  return false;
}

function allPlanningRequirementsSatisfied(
  state: SelectionState,
  allGoalTargets: Set<string>,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  return allGoalTargetsCovered(state.coveredGoalTargets, allGoalTargets) &&
    (!constraints.requireRiskIntervention || state.includesRiskIntervention);
}

function allGoalTargetsCovered(coveredGoalTargets: Set<string>, allGoalTargets: Set<string>): boolean {
  return Array.from(allGoalTargets).every((target) => coveredGoalTargets.has(target));
}

function buildCandidateChain(
  entry: ScoredNode,
  nodesById: Map<string, ResourceNode>,
  scoredById: Map<string, ScoredNode>,
  goal: AdaptiveLearningPathGoal,
): CandidateChain | null {
  if (hasCyclicPrerequisites(entry.node, nodesById)) return null;
  const entries = expandPrerequisites(entry, nodesById, scoredById);
  const uniqueEntries = uniqueScoredEntries(entries);
  const missingPrerequisite = uniqueEntries.some((candidate) =>
    candidate.node.planningMetadata.prerequisites.some((id) => !nodesById.has(id))
  );
  if (missingPrerequisite) return null;
  return {
    entries: uniqueEntries,
    estimatedMinutes: uniqueEntries.reduce((sum, candidate) =>
      sum + (candidate.node.planningMetadata.estimatedTimeMinutes ?? 0), 0),
    coversGoalTarget: uniqueEntries.some((candidate) => nodeCoversGoalTarget(candidate.node, goal)),
  };
}

function uniqueScoredEntries(entries: ScoredNode[]): ScoredNode[] {
  const result = new Map<string, ScoredNode>();
  for (const entry of entries) {
    if (!result.has(entry.node.id)) {
      result.set(entry.node.id, entry);
    }
  }
  return Array.from(result.values());
}

function nodeCoversGoalTarget(node: ResourceNode, goal: AdaptiveLearningPathGoal): boolean {
  return node.planningMetadata.knowledgeCoverage.some((tag) => goal.knowledgeTargets.includes(tag)) ||
    Object.keys(node.planningMetadata.abilityImpact).some((dimension) =>
      (goal.competencyTargets ?? []).includes(dimension)
    );
}

function goalTargetsCoveredByNodes(nodes: ResourceNode[], goal: AdaptiveLearningPathGoal): string[] {
  const covered = new Set<string>();
  for (const node of nodes) {
    for (const target of goal.knowledgeTargets) {
      if (node.planningMetadata.knowledgeCoverage.includes(target)) {
        covered.add(target);
      }
    }
    for (const target of goal.competencyTargets ?? []) {
      if (Object.prototype.hasOwnProperty.call(node.planningMetadata.abilityImpact, target)) {
        covered.add(target);
      }
    }
  }
  return Array.from(covered);
}

function hasCyclicPrerequisites(
  node: ResourceNode,
  nodesById: Map<string, ResourceNode>,
  visiting = new Set<string>(),
  visited = new Set<string>(),
): boolean {
  if (visiting.has(node.id)) return true;
  if (visited.has(node.id)) return false;
  visiting.add(node.id);
  for (const prerequisiteId of node.planningMetadata.prerequisites) {
    const prerequisite = nodesById.get(prerequisiteId);
    if (prerequisite && hasCyclicPrerequisites(prerequisite, nodesById, visiting, visited)) {
      return true;
    }
  }
  visiting.delete(node.id);
  visited.add(node.id);
  return false;
}

function isTerminalNode(node: ResourceNode): boolean {
  return node.planningMetadata.terminalConstraints.includes('terminal-node');
}

function isRiskInterventionNode(node: ResourceNode): boolean {
  return node.type === 'reflection' || node.type === 'ai_intervention';
}

function chainHasTerminalViolation(entries: ScoredNode[]): boolean {
  const terminalIndexes = entries
    .map((entry, index) => isTerminalNode(entry.node) ? index : -1)
    .filter((index) => index >= 0);
  return terminalIndexes.length > 1 ||
    (terminalIndexes.length === 1 && terminalIndexes[0] !== entries.length - 1);
}

function uncoveredGoalTargets(nodes: ResourceNode[], goal: AdaptiveLearningPathGoal): string[] {
  const coveredKnowledge = new Set(nodes.flatMap((node) => node.planningMetadata.knowledgeCoverage));
  const coveredCompetencies = new Set(nodes.flatMap((node) => Object.keys(node.planningMetadata.abilityImpact)));
  return [
    ...goal.knowledgeTargets.filter((target) => !coveredKnowledge.has(target)),
    ...(goal.competencyTargets ?? []).filter((target) => !coveredCompetencies.has(target)),
  ];
}

function shouldRedactBlockedNode(node: ResourceNode, reasonCodes: string[]): boolean {
  return node.planningMetadata.privacyLevel !== 'student-visible' ||
    reasonCodes.includes('privacy-scope-blocked') ||
    reasonCodes.includes('teacher-policy-blocked') ||
    reasonCodes.includes('teacher-policy-teacher-only') ||
    reasonCodes.includes('teacher-assignment-required');
}

function expandPrerequisites(
  entry: ScoredNode,
  nodesById: Map<string, ResourceNode>,
  scoredById: Map<string, ScoredNode>,
  seen = new Set<string>(),
): ScoredNode[] {
  if (seen.has(entry.node.id)) return [];
  seen.add(entry.node.id);
  const prerequisites = entry.node.planningMetadata.prerequisites
    .map((id) => nodesById.get(id))
    .filter((node): node is ResourceNode => Boolean(node))
    .flatMap((node) => expandPrerequisites(scoredById.get(node.id) ?? {
      node,
      score: 0.5,
      reasonCodes: ['required-prerequisite'],
    }, nodesById, scoredById, seen));
  return [...prerequisites, entry];
}

function prerequisiteDepth(node: ResourceNode, nodesById: Map<string, ResourceNode>, seen = new Set<string>()): number {
  if (seen.has(node.id)) return 0;
  seen.add(node.id);
  if (node.planningMetadata.prerequisites.length === 0) return 0;
  return 1 + Math.max(
    ...node.planningMetadata.prerequisites
      .map((id) => nodesById.get(id))
      .filter((item): item is ResourceNode => Boolean(item))
      .map((item) => prerequisiteDepth(item, nodesById, seen)),
    0,
  );
}

function resolveCurrentNodeId(entries: ScoredNode[], completedNodeIds: string[]): string | null {
  const completed = new Set(completedNodeIds);
  return entries.find((entry) => !completed.has(entry.node.id))?.node.id ?? null;
}

function resolveCurrentPlanNodeId(
  nodes: AdaptiveLearningPathPlanNode[],
  completedNodeIds: string[],
): string | null {
  const completed = new Set(completedNodeIds);
  return nodes.find((node) => !completed.has(node.nodeId))?.nodeId ?? null;
}

function toPlanNode(
  entry: ScoredNode,
  currentNodeId: string | null,
  completedNodeIds: string[],
): AdaptiveLearningPathPlanNode {
  const target = entry.node.launchTarget ?? entry.node.renderTarget ?? '';
  const isCompleted = completedNodeIds.includes(entry.node.id);
  return {
    nodeId: entry.node.id,
    title: entry.node.title,
    type: entry.node.type,
    sourceKind: entry.node.sourceKind,
    sourceRef: entry.node.sourceRef,
    target,
    estimatedTimeMinutes: entry.node.planningMetadata.estimatedTimeMinutes ?? 0,
    prerequisiteNodeIds: entry.node.planningMetadata.prerequisites,
    knowledgeCoverage: entry.node.planningMetadata.knowledgeCoverage,
    teacherPolicy: entry.node.planningMetadata.teacherPolicy,
    privacyLevel: entry.node.planningMetadata.privacyLevel,
    terminalConstraints: entry.node.planningMetadata.terminalConstraints,
    score: entry.score,
    reasonCodes: entry.reasonCodes,
    status: isCompleted ? 'completed' : entry.node.id === currentNodeId ? 'current' : 'next',
  };
}

function buildAlternatives(
  scored: ScoredNode[],
  mainPath: AdaptiveLearningPathPlanNode[],
  blocked: AdaptiveLearningPathAlternative[],
  registry: ResourceNodeRegistry,
  eligibleIds: Set<string>,
  goal: AdaptiveLearningPathGoal,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): AdaptiveLearningPathAlternative[] {
  const selected = new Set(mainPath.map((node) => node.nodeId));
  const nodesById = new Map(registry.nodes.filter((node) => eligibleIds.has(node.id)).map((node) => [node.id, node]));
  const scoredById = new Map(scored.map((entry) => [entry.node.id, entry]));
  const completed = new Set(completedNodeIds);
  const nonSelected = scored
    .filter((entry) => !selected.has(entry.node.id))
    .slice(0, 8)
    .map((entry) => {
      const chain = buildCandidateChain(entry, nodesById, scoredById, goal);
      const blockedByPrerequisite = !chain || !chain.coversGoalTarget;
      const blockedByTerminal = Boolean(chain && chainHasTerminalViolation(chain.entries));
      const remainingMinutes = chain?.entries.reduce(
        (sum, candidate) => sum + (completed.has(candidate.node.id)
          ? 0
          : (candidate.node.planningMetadata.estimatedTimeMinutes ?? 0)),
        0,
      ) ?? 0;
      const blockedByBudget = !blockedByPrerequisite && !blockedByTerminal && remainingMinutes > constraints.timeBudgetMinutes;
      return {
        nodeId: entry.node.id,
        nodeIds: chain?.entries
          .filter((candidate) => !completed.has(candidate.node.id))
          .map((candidate) => candidate.node.id) ?? [entry.node.id],
        title: entry.node.title,
        reasonCodes: blockedByPrerequisite
          ? ['infeasible-prerequisite-chain']
          : blockedByTerminal
            ? ['terminal-constraint-blocked']
          : blockedByBudget
            ? ['time-budget-insufficient']
          : entry.reasonCodes.length > 0 ? entry.reasonCodes : ['lower-objective-score'],
        score: blockedByPrerequisite || blockedByTerminal || blockedByBudget ? 0 : entry.score,
        blocked: blockedByPrerequisite || blockedByTerminal || blockedByBudget,
      };
    })
    .filter((item) => item.blocked || item.nodeIds.length > 0);
  return [...nonSelected, ...blocked.slice(0, 8)];
}

function buildFallbackReasons(input: {
  learnerState: AdaptiveLearningPathLearnerState | null;
  deficits: AdaptiveLearningPathDeficit[];
  eligible: ResourceNode[];
  mainPathNodes: ScoredNode[];
  constraints: AdaptiveLearningPathConstraints;
  goal: AdaptiveLearningPathGoal;
  attemptedCandidates: number;
}): string[] {
  const reasons: string[] = [];
  const confidence = input.learnerState?.evidence?.confidence;
  const uncoveredTargets = uncoveredGoalTargets(input.mainPathNodes.map((entry) => entry.node), input.goal);
  if (!input.learnerState) reasons.push('learner-state-missing');
  if ((confidence?.score ?? 0) < 0.35 || (confidence?.evidenceCount ?? 0) === 0) reasons.push('learner-evidence-low-confidence');
  if (input.deficits.length === 0) reasons.push('learner-deficit-not-detected');
  if (input.eligible.length === 0 || input.attemptedCandidates === 0 || uncoveredTargets.length > 0) {
    reasons.push('resource-mapping-insufficient');
  }
  if (
    input.attemptedCandidates > 0 &&
    !input.mainPathNodes.some((entry) => nodeCoversGoalTarget(entry.node, input.goal))
  ) {
    reasons.push('feasible-goal-path-missing');
  }
  if (input.attemptedCandidates > 0 && input.mainPathNodes.length === 0) {
    reasons.push('time-budget-insufficient');
  }
  if (
    input.constraints.requireRiskIntervention &&
    !input.mainPathNodes.some((entry) => entry.node.type === 'reflection' || entry.node.type === 'ai_intervention')
  ) {
    reasons.push('risk-intervention-resource-missing');
  }
  return unique(reasons);
}

function buildPlanScore(
  mainPath: AdaptiveLearningPathPlanNode[],
  alternatives: AdaptiveLearningPathAlternative[],
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
): AdaptiveLearningPathScore {
  const learningGain = round(mainPath.reduce((sum, node) => sum + node.score, 0), 3);
  const engagement = round(mainPath.filter((node) =>
    learnerState?.resourcePreference?.preferredModalities?.includes(node.type)
  ).length / Math.max(mainPath.length, 1), 3);
  const estimatedTime = remainingEstimatedMinutes(mainPath);
  const constraintSatisfaction = estimatedTime <= constraints.timeBudgetMinutes && mainPath.length > 0 ? 1 : 0;
  const diversity = round(new Set(mainPath.map((node) => node.type)).size / Math.max(mainPath.length, 1), 3);
  const fatigue = round(Math.max(0, 1 - estimatedTime / Math.max(constraints.timeBudgetMinutes, 1)), 3);
  const dropoutRisk = alternatives.some((item) => item.reasonCodes.includes('risk-intervention-fit')) ? 0.6 : 0.8;
  const total = round(
    learningGain * 0.34 +
    engagement * 0.14 +
    constraintSatisfaction * 0.22 +
    diversity * 0.12 +
    fatigue * 0.1 +
    dropoutRisk * 0.08,
    3,
  );
  return {
    total,
    objectives: {
      learningGain,
      engagement,
      constraintSatisfaction,
      diversity,
      fatigue,
      dropoutRisk,
    },
  };
}

function buildVisualization(input: {
  mainPath: AdaptiveLearningPathPlanNode[];
  alternatives: AdaptiveLearningPathAlternative[];
  blocked: AdaptiveLearningPathAlternative[];
  currentNodeId: string | null;
  completedNodeIds: string[];
  deficits: AdaptiveLearningPathDeficit[];
  sourceCoverage: Record<string, string>;
  confidence: AdaptiveLearningPathPlan['confidence'];
  status: AdaptiveLearningPathStatus;
  generatedAt: string;
}): AdaptiveLearningPathVisualization {
  const mainPathNodeIds = input.mainPath.map((node) => node.nodeId);
  const riskNodeIds = input.currentNodeId && input.deficits.some((deficit) => deficit.evidenceCount < 3)
    ? [input.currentNodeId]
    : [];
  return {
    map: {
      mainPathNodeIds,
      branchPaths: input.alternatives
        .filter((item) => !item.blocked)
        .slice(0, 3)
        .map((item) => ({ fromNodeId: input.currentNodeId ?? 'start', nodeIds: item.nodeIds })),
      currentNodeId: input.currentNodeId,
      completedNodeIds: input.completedNodeIds,
      riskNodeIds,
      blockedNodes: input.blocked,
      alternatives: input.alternatives,
    },
    timeline: buildTimelinePayload(input.mainPath, input.generatedAt),
    evidence: {
      evidenceBasis: input.status === 'fallback' ? 'fallback' : 'adaptive-learner-state',
      confidence: input.confidence,
      sourceCoverage: input.sourceCoverage,
      learnerStateDeficits: input.deficits,
      prerequisiteReasons: input.mainPath
        .filter((node) => node.prerequisiteNodeIds.length > 0)
        .map((node) => ({ nodeId: node.nodeId, prerequisiteNodeIds: node.prerequisiteNodeIds })),
      teacherPolicy: input.mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
      alternatives: input.alternatives,
    },
  };
}

function buildTimelinePayload(
  mainPath: AdaptiveLearningPathPlanNode[],
  generatedAt: string,
): AdaptiveLearningPathTimelinePayload {
  const mainPathNodeIds = mainPath.map((node) => node.nodeId);
  return {
    generatedAt,
    windows: ([3, 7, 14] as const).map((days) => {
      const nodeIds = mainPathNodeIds.slice(0, Math.min(days, mainPathNodeIds.length));
      return {
        days,
        nodeIds,
        estimatedMinutes: mainPath
          .filter((node) => nodeIds.includes(node.nodeId) && node.status !== 'completed')
          .reduce((sum, node) => sum + node.estimatedTimeMinutes, 0),
      };
    }),
  };
}

function resolvePlanConfidence(learnerState: AdaptiveLearningPathLearnerState | null): AdaptiveLearningPathPlan['confidence'] {
  const confidence = learnerState?.evidence?.confidence;
  const score = confidence?.score ?? 0;
  const sourceCoverage = confidence?.sourceCompleteness ?? 0;
  return {
    level: score >= 0.75 && sourceCoverage >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low',
    score: round(score, 3),
    sourceCoverage: round(sourceCoverage, 3),
  };
}

function remainingEstimatedMinutes(nodes: AdaptiveLearningPathPlanNode[]): number {
  return nodes
    .filter((node) => node.status !== 'completed')
    .reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

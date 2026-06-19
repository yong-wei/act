import type {
  ResourceNode,
  ResourceNodeCheckpointMetadata,
  ResourceNodeExternalResourceMetadata,
  ResourceNodePathSemantics,
  ResourceNodePrivacyLevel,
  ResourceNodeRegistry,
  ResourceNodeReadinessMetadata,
} from './resource-node-registry';

export type AdaptiveLearningPathStatus = 'ready' | 'fallback';
export type AdaptiveLearningPathPolicyFamily =
  | 'rules-plus-graph-search'
  | 'foundation-remediation'
  | 'simulation-driven'
  | 'preference-matched'
  | 'sprint-correction'
  | 'teacher-assigned';
export type AdaptiveLearningPathPolicyBundleStatus = 'ready' | 'low-resource-fallback';
export type AdaptiveLearningPathStyleId =
  | 'foundation-remediation'
  | 'arena-simulation-sprint'
  | 'preference-matched-route'
  | 'rules-graph-search-route'
  | 'sprint-correction-route'
  | 'teacher-assigned-route';
export type AdaptiveLearningPathFeedbackType =
  | 'adoption'
  | 'selection'
  | 'rejection'
  | 'switch'
  | 'completion'
  | 'deviation'
  | 'correction-success'
  | 'explanation-click'
  | 'helpfulness';
export type AdaptiveLearningPathEvidenceType =
  | 'question'
  | 'simulation-run'
  | 'arena-official-evaluation'
  | 'reflection'
  | 'agent-interaction';

export interface AdaptiveLearningPathGoal {
  id: string;
  title: string;
  knowledgeTargets: string[];
  competencyTargets?: string[];
  capabilityTargets?: AdaptiveLearningCapabilityTarget[];
}

export type AdaptiveLearningCapabilityLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface AdaptiveLearningCapabilityTarget {
  id: string;
  knowledgeNodeRef: string;
  capabilityLevel: AdaptiveLearningCapabilityLevel;
  behaviorVerb: string;
  successCriteria: string[];
  observableEvidenceType: AdaptiveLearningPathEvidenceType;
  evaluationMethod: string;
  goalSliceId: string;
  competencyDimensions: string[];
  learnerStateFeatureGroups: string[];
  prerequisiteKnowledgeRefs?: string[];
}

export interface AdaptiveLearningPathRegisteredGoalDefinition {
  goal: AdaptiveLearningPathGoal;
  displayName: string;
  allowedResourceMix: ResourceNode['type'][];
  starterPathPolicy: {
    policyFamilies: AdaptiveLearningPathPolicyFamily[];
    minOptions: number;
    difficultyRhythm: 'gentle' | 'steady' | 'challenge';
    allowExternalResources: boolean;
    preferredResourceTypes: ResourceNode['type'][];
  };
  checkpointPolicy: {
    minCheckpoints: number;
    checkpointResourceTypes: ResourceNode['type'][];
    requiresTerminalValidation: boolean;
  };
  explanationTemplates: {
    ready: string;
    coldStart: string;
    lowConfidence: string;
    fallback: string;
  };
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
  goalSlices?: Record<string, {
    capabilityTargets?: AdaptiveLearningPathCapabilityEvidence[];
  } | undefined>;
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
  currentNodeId?: string | null;
  availableOutcomeRefs?: string[];
  teacherAssignedNodeIds?: string[];
  requireRiskIntervention?: boolean;
}

export type AdaptiveLearningPathReadinessState = 'ready' | 'needs-preparation' | 'locked' | 'evidence-needed';

export interface AdaptiveLearningPathNodeReadiness {
  state: AdaptiveLearningPathReadinessState;
  message: string;
  unlockMessage: string | null;
  reasonCodes: string[];
  fallbackNodeIds: string[];
  missingCompetencies: string[];
  missingEvidenceCount: number;
  missingCompletedNodeIds: string[];
  missingOutcomeRefs: string[];
}

export interface AdaptiveLearningPathPlannerInput {
  studentId: string;
  goal: AdaptiveLearningPathGoal;
  learnerState: AdaptiveLearningPathLearnerState | null;
  registry: ResourceNodeRegistry;
  constraints: AdaptiveLearningPathConstraints;
  policyFamily?: AdaptiveLearningPathPolicyFamily;
  policyBundle?: {
    families: AdaptiveLearningPathPolicyFamily[];
    overlapThreshold?: number;
  };
  difficultyRhythm?: 'gentle' | 'steady' | 'challenge';
  resourcePreferences?: ResourceNode['type'][];
  checkpointPreference?: 'light' | 'standard' | 'dense';
  allowExternalResources?: boolean;
  excludedNodeIds?: string[];
  preferredStyleId?: string;
  requestedAt?: string;
  now?: Date;
}

export interface AdaptiveLearningPathPlanNode {
  nodeId: string;
  title: string;
  type: ResourceNode['type'];
  pathNodeType: ResourceNodePathSemantics['type'];
  displayName: string;
  iconKey: string;
  shapeHint: ResourceNodePathSemantics['shapeHint'];
  evidenceBehavior: ResourceNodePathSemantics['evidenceBehavior'];
  evidenceStatus: 'instrumented' | 'explicit-access-required' | 'reference-only' | 'missing';
  externalResource: ResourceNodeExternalResourceMetadata | null;
  checkpoint: ResourceNodeCheckpointMetadata | null;
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
  status: 'current' | 'next' | 'completed' | 'blocked' | 'alternative' | 'locked';
  readiness?: AdaptiveLearningPathNodeReadiness;
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
  capabilityEvidence: AdaptiveLearningPathCapabilityEvidence[];
  prerequisiteReasons: Array<{ nodeId: string; prerequisiteNodeIds: string[] }>;
  teacherPolicy: Array<{ nodeId: string; policy: ResourceNode['planningMetadata']['teacherPolicy'] }>;
  alternatives: AdaptiveLearningPathAlternative[];
}

export interface AdaptiveLearningPathVisualization {
  map: AdaptiveLearningPathMapPayload;
  timeline: AdaptiveLearningPathTimelinePayload;
  evidence: AdaptiveLearningPathEvidencePayload;
}

export interface AdaptiveLearningPathPolicyDefinition {
  id: AdaptiveLearningPathPolicyFamily;
  label: string;
  scoringIntent: string;
  constraints: string[];
  fallbackSemantics: string;
}

export interface AdaptiveLearningPathPolicyBundle {
  families: AdaptiveLearningPathPolicyFamily[];
  overlapThreshold: number;
  status: AdaptiveLearningPathPolicyBundleStatus;
  paths: Array<{
    styleId: AdaptiveLearningPathStyleId;
    policyFamily: AdaptiveLearningPathPolicyFamily;
    label: string;
    nodeIds: string[];
    activeNodeIds: string[];
    lockedNodeIds: string[];
    readinessSummary: Array<{
      nodeId: string;
      state: AdaptiveLearningPathReadinessState;
      message: string;
    }>;
    unlockMessages: Array<{
      nodeId: string;
      message: string;
    }>;
    planNodes?: AdaptiveLearningPathPlanNode[];
    nodeSummaries: AdaptiveLearningPathOptionNodeSummary[];
    targetDeficits: AdaptiveLearningPathDeficit[];
    evidenceBasis: string[];
    estimatedMinutes: number;
    modalityMix: Record<string, number>;
    resourceMix: Record<string, number>;
    overlap: {
      maxWithOtherOptions: number;
    };
    effort: {
      estimatedMinutes: number;
      relative: 'short' | 'medium' | 'long';
    };
    expectedTargetLift: number;
    terminalValidationNodeIds: string[];
    terminalValidationStrategy: {
      nodeIds: string[];
      summary: string;
    };
    checkpointNodeIds: string[];
    limitations: string[];
  }>;
  diversity: {
    maxResourceOverlap: number;
    minModalityDistance: number;
    minEstimatedEffortDifference: number;
    minTerminalValidationDifference: number;
    pairwiseResourceOverlap: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      overlap: number;
    }>;
    pairwiseModalityDistance: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      distance: number;
    }>;
    pairwiseEstimatedEffortDifference: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      difference: number;
    }>;
    pairwiseTerminalValidationDifference: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      difference: number;
    }>;
    modalityMixByPolicy: Record<string, Record<string, number>>;
    estimatedEffortByPolicy: Record<string, number>;
    terminalValidationDifference: number;
  };
  fallbackReasons: string[];
}

export interface AdaptiveLearningPathOptionNodeSummary {
  nodeId: string;
  title: string;
  pathNodeType: AdaptiveLearningPathPlanNode['pathNodeType'];
  displayName: string;
  iconKey: string;
  shapeHint: AdaptiveLearningPathPlanNode['shapeHint'];
  evidenceBehavior: AdaptiveLearningPathPlanNode['evidenceBehavior'];
  evidenceStatus: AdaptiveLearningPathPlanNode['evidenceStatus'];
  estimatedTimeMinutes: number;
  status: AdaptiveLearningPathPlanNode['status'];
}

export interface AdaptiveLearningPathDeficit {
  targetId: string;
  kind: 'knowledge' | 'competency';
  value: number;
  confidence: number;
  evidenceCount: number;
  reasonCode: string;
}

export interface AdaptiveLearningPathCapabilityEvidence {
  target: AdaptiveLearningCapabilityTarget;
  observedEvidence: {
    state: 'missing' | 'low-confidence' | 'observed';
    knowledgeMastery: number | null;
    competencyScore: number | null;
    confidence: number;
    directEvidenceCount: number;
    supportingEvidenceCount: number;
    source: 'adaptive-learner-state';
    recommendationBias: 'starter-or-evidence-gathering' | 'targeted-practice';
  };
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
  policyMetadata: AdaptiveLearningPathPolicyDefinition;
  policyBundle?: AdaptiveLearningPathPolicyBundle;
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
    policyFamily: AdaptiveLearningPathPolicyFamily;
    policyMetadata: AdaptiveLearningPathPolicyDefinition;
    policyBundle?: AdaptiveLearningPathPolicyBundle;
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
    studentFacing: {
      summary: string;
      nextAction: string;
      confidenceLabel: string;
    };
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

export const ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES: Record<
  AdaptiveLearningPathPolicyFamily,
  AdaptiveLearningPathPolicyDefinition
> = {
  'rules-plus-graph-search': {
    id: 'rules-plus-graph-search',
    label: '规则与图搜索兼容策略',
    scoringIntent: 'preserve current rules-plus-graph-search scoring compatibility',
    constraints: ['stage-1-compatible', 'no-bandit-or-rl'],
    fallbackSemantics: 'use existing low-confidence and resource-mapping fallback reasons',
  },
  'foundation-remediation': {
    id: 'foundation-remediation',
    label: '基础补救策略',
    scoringIntent: 'prioritize prerequisite repair, concept cards, short exercises, and low cognitive-load resources before terminal validation',
    constraints: ['prerequisite-first', 'low-cognitive-load-first', 'terminal-validation-last'],
    fallbackSemantics: 'report low-resource fallback when prerequisite repair resources are insufficient',
  },
  'simulation-driven': {
    id: 'simulation-driven',
    label: '仿真驱动策略',
    scoringIntent: 'prioritize simulation, Arena, experiment, and reflection resources while preserving prerequisites and evidence confidence',
    constraints: ['simulation-first', 'preserve-prerequisites', 'evidence-confidence-required'],
    fallbackSemantics: 'fall back to available graph resources when simulation or Arena resources cannot cover the goal',
  },
  'sprint-correction': {
    id: 'sprint-correction',
    label: '冲刺纠偏策略',
    scoringIntent: 'prioritize highest-impact weak indicators within the time budget and expose the tradeoff against breadth',
    constraints: ['time-budget-first', 'highest-impact-first', 'breadth-tradeoff-visible'],
  fallbackSemantics: 'return low-confidence or low-resource fallback when a short corrective path cannot cover the goal',
  },
  'preference-matched': {
    id: 'preference-matched',
    label: '偏好匹配策略',
    scoringIntent: 'prioritize resource modalities and pacing patterns that match governed learner preference evidence without treating preference as mastery',
    constraints: ['preference-evidence-first', 'no-mastery-inflation', 'terminal-validation-last'],
    fallbackSemantics: 'fall back to ordinary graph-search resources when preference evidence is absent or too sparse',
  },
  'teacher-assigned': {
    id: 'teacher-assigned',
    label: '教师指定策略',
    scoringIntent: 'prioritize teacher-assigned resources while enforcing the same privacy, prerequisite, and terminal-validation constraints',
    constraints: ['teacher-assignment-required', 'preserve-privacy', 'preserve-prerequisites'],
    fallbackSemantics: 'fall back only to eligible assigned resources and surface insufficient teacher assignment coverage',
  },
};

export const CONTROL_CORRECTION_CAPABILITY_TARGETS: AdaptiveLearningCapabilityTarget[] = [
  {
    id: 'control-correction:time-domain-targets:apply',
    knowledgeNodeRef: 'control-correction:time-domain-targets',
    capabilityLevel: 'apply',
    behaviorVerb: 'translate',
    successCriteria: [
      'Translate overshoot, settling-time, and steady-state requirements into a target pole-region constraint.',
      'Explain which time-domain target drives the dominant pole placement decision.',
    ],
    observableEvidenceType: 'simulation-run',
    evaluationMethod: 'governed step-response simulation with target-region justification',
    goalSliceId: 'control-correction',
    competencyDimensions: ['controlModeling', 'parameterDesign'],
    learnerStateFeatureGroups: ['knowledgeMastery', 'primaryCompetencies', 'simulationArena'],
  },
  {
    id: 'control-correction:root-locus-design:analyze',
    knowledgeNodeRef: 'control-correction:root-locus-design',
    capabilityLevel: 'analyze',
    behaviorVerb: 'compare',
    successCriteria: [
      'Compare feasible compensator choices against root-locus movement and design constraints.',
      'Identify why a candidate correction improves or violates the target dynamic behavior.',
    ],
    observableEvidenceType: 'question',
    evaluationMethod: 'assessment-backed root-locus reasoning item plus governed simulation evidence',
    goalSliceId: 'control-correction',
    competencyDimensions: ['parameterDesign', 'engineeringDecision'],
    learnerStateFeatureGroups: ['knowledgeMastery', 'primaryCompetencies', 'simulationArena'],
    prerequisiteKnowledgeRefs: ['control-correction:time-domain-targets'],
  },
  {
    id: 'control-correction:simulation-validation:evaluate',
    knowledgeNodeRef: 'control-correction:simulation-validation',
    capabilityLevel: 'evaluate',
    behaviorVerb: 'validate',
    successCriteria: [
      'Validate the corrected response against declared constraints using governed replay evidence.',
      'State whether failures are caused by model, parameter, or constraint assumptions.',
    ],
    observableEvidenceType: 'simulation-run',
    evaluationMethod: 'course-launched simulation replay with confidence and constraint coverage',
    goalSliceId: 'control-correction',
    competencyDimensions: ['parameterDesign', 'engineeringDecision'],
    learnerStateFeatureGroups: ['simulationArena', 'pathExecution', 'primaryCompetencies'],
    prerequisiteKnowledgeRefs: ['control-correction:root-locus-design'],
  },
  {
    id: 'control-correction:arena-transfer:create',
    knowledgeNodeRef: 'control-correction:arena-transfer',
    capabilityLevel: 'create',
    behaviorVerb: 'transfer',
    successCriteria: [
      'Transfer a correction strategy to the official Arena task without relying on preview-only evidence.',
      'Justify controller changes with traceable design and validation evidence.',
    ],
    observableEvidenceType: 'arena-official-evaluation',
    evaluationMethod: 'official Arena evaluation protocol with governed controller artifact evidence',
    goalSliceId: 'control-correction',
    competencyDimensions: ['crossDomainTransfer', 'engineeringDecision'],
    learnerStateFeatureGroups: ['simulationArena', 'pathExecution', 'primaryCompetencies'],
    prerequisiteKnowledgeRefs: ['control-correction:simulation-validation'],
  },
];

export const ADAPTIVE_LEARNING_GOAL_DEFINITIONS: Record<string, AdaptiveLearningPathRegisteredGoalDefinition> = {
  'control-correction': {
    goal: {
      id: 'control-correction',
      title: '控制系统校正设计',
      knowledgeTargets: [
        'control-correction:time-domain-targets',
        'control-correction:root-locus-design',
        'control-correction:simulation-validation',
        'control-correction:arena-transfer',
      ],
      competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      capabilityTargets: CONTROL_CORRECTION_CAPABILITY_TARGETS,
    },
    displayName: '控制系统校正设计',
    allowedResourceMix: [
      'knowledge_card',
      'quiz',
      'adaptive_quiz',
      'control_workbench',
      'simulation',
      'arena_task',
      'external_resource',
      'reflection',
      'checkpoint',
      'ai_intervention',
      'konling',
    ],
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      minOptions: 2,
      difficultyRhythm: 'steady',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'control_workbench', 'simulation', 'arena_task'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation', 'arena_task'],
      requiresTerminalValidation: true,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成校正设计学习路径。',
      coldStart: '证据还少，先从入门路径开始，系统会随学习过程调整。',
      lowConfidence: '当前证据不足，先沿可执行路径学习，后续会根据新证据调整。',
      fallback: '当前只能给出保守路径建议，请先完成可用资源并补充学习证据。',
    },
  },
  'frequency-response-foundations': {
    goal: {
      id: 'frequency-response-foundations',
      title: '频率响应基础',
      knowledgeTargets: ['kn-bode'],
      competencyTargets: [],
    },
    displayName: '频率响应基础',
    allowedResourceMix: [
      'knowledge_card',
      'simulation',
      'quiz',
      'adaptive_quiz',
      'external_resource',
      'reflection',
      'checkpoint',
      'handout',
      'lesson_step',
      'konling',
    ],
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      minOptions: 2,
      difficultyRhythm: 'gentle',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'simulation', 'quiz', 'adaptive_quiz'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'quiz', 'adaptive_quiz', 'simulation', 'reflection', 'knowledge_card'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成频率响应学习路径。',
      coldStart: '证据还少，先从入门路径开始，系统会随学习过程调整。',
      lowConfidence: '当前证据不足，先完成基础路径，系统会根据后续表现调整顺序。',
      fallback: '当前可用资源不足，请先完成基础材料并补充学习证据。',
    },
  },
};

export function getRegisteredAdaptiveLearningPathGoal(
  goalId: string,
): AdaptiveLearningPathRegisteredGoalDefinition | null {
  return ADAPTIVE_LEARNING_GOAL_DEFINITIONS[goalId] ?? null;
}

export function isRegisteredAdaptiveLearningPathGoal(goalId: string): boolean {
  return Boolean(getRegisteredAdaptiveLearningPathGoal(goalId));
}

export function buildAdaptiveLearningPathPlan(input: AdaptiveLearningPathPlannerInput): AdaptiveLearningPathPlan {
  return buildAdaptiveLearningPathPlanInternal(input, true);
}

export function buildControlCorrectionThreeStylePathBundle(
  input: Omit<AdaptiveLearningPathPlannerInput, 'policyFamily' | 'policyBundle'>,
): AdaptiveLearningPathPolicyBundle {
  const plan = buildAdaptiveLearningPathPlan({
    ...input,
    policyFamily: 'foundation-remediation',
    policyBundle: {
      families: ['simulation-driven', 'preference-matched'],
      overlapThreshold: 0.6,
    },
  });
  return plan.policyBundle as AdaptiveLearningPathPolicyBundle;
}

function buildAdaptiveLearningPathPlanInternal(
  input: AdaptiveLearningPathPlannerInput,
  includePolicyBundle: boolean,
): AdaptiveLearningPathPlan {
  const now = (input.now ?? new Date()).toISOString();
  const policyFamily = input.policyFamily ?? 'rules-plus-graph-search';
  const policyMetadata = ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES[policyFamily];
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const deficits = inferDeficits(input.goal, input.learnerState);
  const confidence = resolvePlanConfidence(input.learnerState);
  const sourceCoverage = input.learnerState?.evidence?.sourceCoverage ?? {};
  const requestedCompletedNodeIds = input.constraints.completedNodeIds ?? [];
  const preferenceContext = buildPlannerPreferenceContext(input);
  const excludedNodeIds = new Set(input.excludedNodeIds ?? []);
  const { eligible, blocked } = partitionResourceNodes(input.registry.nodes, input.constraints);
  const pathEligible = eligible
    .filter((node) => !excludedNodeIds.has(node.id))
    .filter((node) => policyAllowsNode(node, policyFamily, input.constraints))
    .filter((node) => externalResourceAllowed(node, input, registeredGoal));
  const eligibleIds = new Set(pathEligible.map((node) => node.id));
  const scored = pathEligible
    .filter((node) => goalAllowsResourceNode(node, registeredGoal))
    .filter((node) =>
      nodeMatchesGoal(node, input.goal, deficits) ||
      (input.constraints.requireRiskIntervention && isRiskInterventionNode(node))
    )
    .map((node) => scoreNode(node, deficits, input.learnerState, input.constraints, policyFamily, preferenceContext))
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
    policyFamily,
  });
  const status: AdaptiveLearningPathStatus = fallbackReasons.length > 0 ? 'fallback' : 'ready';
  const hasBlockingFallback = fallbackReasons.some(isPathBlockingFallbackReason);
  const plannedEntries = hasBlockingFallback ? [] : mainPathNodes;
  const mainPathNodeIds = new Set(plannedEntries.map((entry) => entry.node.id));
  const completedNodeIds = requestedCompletedNodeIds.filter((nodeId) => mainPathNodeIds.has(nodeId));
  const planningCompletedNodeIds = requestedCompletedNodeIds.filter((nodeId) => eligibleIds.has(nodeId));
  const readinessByNodeId = new Map(plannedEntries.map((entry) => [
    entry.node.id,
    evaluateNodeReadiness(entry.node, input.learnerState, input.constraints, completedNodeIds),
  ]));
  const currentNodeId = plannedEntries.length > 0
    ? resolveCurrentNodeId(plannedEntries, completedNodeIds, readinessByNodeId, input.constraints.currentNodeId)
    : null;
  const mainPath = plannedEntries.length > 0
    ? plannedEntries.map((entry) => toPlanNode(entry, currentNodeId, completedNodeIds, readinessByNodeId.get(entry.node.id)!))
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
  const policyBundleRequest = resolvePolicyBundleRequest(input, confidence, registeredGoal);
  const capabilityTargets = resolveCapabilityTargets(input.goal, registeredGoal);

  return {
    id: `adaptive-path:${input.studentId}:${input.goal.id}`,
    userId: input.studentId,
    goal: input.goal,
    stage: 'stage-1-rules-graph',
    policyFamily,
    policyMetadata,
    policyBundle: includePolicyBundle ? buildPolicyBundle({
      ...input,
      policyBundle: policyBundleRequest,
    }, policyFamily) : undefined,
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
      capabilityTargets,
      learnerState: input.learnerState,
      sourceCoverage,
      confidence,
      status,
      hasUsablePath: mainPath.length > 0,
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
    ...plan.alternatives.flatMap((node) => node.nodeIds),
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
  let policyBundle = plan.policyBundle;

  if (safeEvent.type === 'adoption') {
    executionStatus = { ...executionStatus, adopted: true, updatedAt: safeEvent.createdAt };
  }
  if (safeEvent.type === 'completion' && safeEvent.nodeId && plan.mainPath.some((node) => node.nodeId === safeEvent.nodeId)) {
    const completedNodeIds = unique([...executionStatus.completedNodeIds, safeEvent.nodeId]);
    const refreshedPath = refreshPathReadinessAfterFeedback(mainPath, completedNodeIds, safeEvent.context);
    currentNodeId = resolveCurrentPlanNodeId(refreshedPath, completedNodeIds);
    mainPath = refreshedPath.map((node) => ({
      ...node,
      status: completedNodeIds.includes(node.nodeId)
        ? 'completed'
        : node.nodeId === currentNodeId
          ? 'current'
          : node.readiness && node.readiness.state !== 'ready' ? 'locked' : 'next',
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
    policyBundle = refreshPolicyBundlePathStates(policyBundle, mainPath);
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
    policyBundle,
  };
}

export function serializeLearningPathPlan(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathPersistenceRecord {
  const studentFacing = buildStudentFacingPathExplanation(plan);
  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.goal.title,
    description: studentFacing.summary,
    estimatedTime: remainingEstimatedMinutes(plan.mainPath),
    nodeIds: plan.mainPath.map((node) => node.nodeId),
    isAiGenerated: false,
    payload: {
      status: plan.status,
      policyFamily: plan.policyFamily,
      policyMetadata: plan.policyMetadata,
      policyBundle: plan.policyBundle,
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
      studentFacing,
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

function resolveCapabilityTargets(
  goal: AdaptiveLearningPathGoal,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningCapabilityTarget[] {
  return goal.capabilityTargets ?? registeredGoal?.goal.capabilityTargets ?? [];
}

function buildCapabilityEvidence(
  targets: AdaptiveLearningCapabilityTarget[],
  learnerState: AdaptiveLearningPathLearnerState | null,
): AdaptiveLearningPathCapabilityEvidence[] {
  const goalSliceEvidence = collectGoalSliceCapabilityEvidence(learnerState);
  return targets.map((target) => {
    const existingEvidence = goalSliceEvidence.get(target.id);
    if (existingEvidence) {
      return {
        target,
        observedEvidence: existingEvidence.observedEvidence,
      };
    }
    const knowledge = learnerState?.knowledgeMastery?.tags?.[target.knowledgeNodeRef];
    const competencies = target.competencyDimensions
      .map((dimension) => learnerState?.primaryCompetencies?.vector?.[dimension])
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const competencyScore = competencies.length > 0
      ? round(competencies.reduce((sum, competency) => sum + (competency.score ?? 0), 0) / competencies.length, 2)
      : null;
    const directConfidence = knowledge?.confidence ?? 0;
    const knowledgeEvidenceCount = knowledge?.evidenceCount ?? 0;
    const supportingEvidenceCount = Math.max(0, ...competencies.map((competency) => competency.evidenceCount ?? 0));
    const state = knowledgeEvidenceCount === 0
      ? 'missing'
      : directConfidence < 0.5
        ? 'low-confidence'
        : 'observed';
    return {
      target,
      observedEvidence: {
        state,
        knowledgeMastery: knowledge?.posteriorMastery ?? null,
        competencyScore,
        confidence: round(directConfidence, 2),
        directEvidenceCount: knowledgeEvidenceCount,
        supportingEvidenceCount,
        source: 'adaptive-learner-state',
        recommendationBias: state === 'observed' ? 'targeted-practice' : 'starter-or-evidence-gathering',
      },
    };
  });
}

function collectGoalSliceCapabilityEvidence(
  learnerState: AdaptiveLearningPathLearnerState | null,
): Map<string, AdaptiveLearningPathCapabilityEvidence> {
  const entries = Object.values(learnerState?.goalSlices ?? {})
    .flatMap((slice) => Array.isArray(slice?.capabilityTargets) ? slice.capabilityTargets : [])
    .filter((item) => typeof item.target.id === 'string');
  return new Map(entries.map((item) => [item.target.id, item]));
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
  if (Object.keys(node.planningMetadata.abilityImpact).length === 0) reasons.push('missing-capability-mapping');
  if (node.planningMetadata.evidenceInstrumentation.length === 0) reasons.push('missing-evidence-instrumentation');
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
  policyFamily: AdaptiveLearningPathPolicyFamily,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
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
  const modalityBoost = preferenceContext.resourceTypes.has(node.type) ? 0.45 : 0;
  const learnerModalityBoost = learnerState?.resourcePreference?.preferredModalities?.includes(node.type) ? 0.2 : 0;
  const fatiguePenalty = Math.max(0, (node.planningMetadata.estimatedTimeMinutes ?? 0) - constraints.timeBudgetMinutes / 2) / 100;
  const riskBoost = constraints.requireRiskIntervention && (node.type === 'ai_intervention' || node.type === 'reflection') ? 0.25 : 0;
  const difficultyBoost = difficultyRhythmScoreBoost(node, preferenceContext.difficultyRhythm, constraints);
  const checkpointBoost = checkpointPreferenceScoreBoost(node, preferenceContext.checkpointPreference);
  const policyBoost = policyScoreBoost(node, policyFamily, constraints, learnerState, preferenceContext);
  const score = round(coverageGain + abilityGain + modalityBoost + learnerModalityBoost + riskBoost + difficultyBoost + checkpointBoost + policyBoost - fatiguePenalty, 3);
  const reasonCodes = [
    coverageGain > 0 ? 'matches-knowledge-deficit' : null,
    abilityGain > 0 ? 'matches-competency-deficit' : null,
    modalityBoost + learnerModalityBoost > 0 ? 'matches-resource-preference' : null,
    riskBoost > 0 ? 'risk-intervention-fit' : null,
    difficultyBoost > 0 ? `matches-${preferenceContext.difficultyRhythm}-rhythm` : null,
    checkpointBoost > 0 ? `matches-${preferenceContext.checkpointPreference}-checkpoint-preference` : null,
    policyBoost > 0 ? policyReasonCode(policyFamily) : null,
  ].filter((item): item is string => Boolean(item));
  return { node, score, reasonCodes };
}

interface AdaptiveLearningPathPreferenceContext {
  resourceTypes: Set<ResourceNode['type']>;
  difficultyRhythm: NonNullable<AdaptiveLearningPathPlannerInput['difficultyRhythm']>;
  checkpointPreference: NonNullable<AdaptiveLearningPathPlannerInput['checkpointPreference']>;
}

function buildPlannerPreferenceContext(input: AdaptiveLearningPathPlannerInput): AdaptiveLearningPathPreferenceContext {
  const resourceTypes = unique([
    ...(input.learnerState?.resourcePreference?.preferredModalities ?? []),
    ...(input.resourcePreferences ?? []),
  ]).filter((type): type is ResourceNode['type'] =>
    input.registry.supportedTypes.includes(type as ResourceNode['type'])
  );
  return {
    resourceTypes: new Set(resourceTypes),
    difficultyRhythm: input.difficultyRhythm ?? 'steady',
    checkpointPreference: input.checkpointPreference ?? 'standard',
  };
}

function difficultyRhythmScoreBoost(
  node: ResourceNode,
  rhythm: AdaptiveLearningPathPreferenceContext['difficultyRhythm'],
  constraints: AdaptiveLearningPathConstraints,
): number {
  const estimatedMinutes = node.planningMetadata.estimatedTimeMinutes ?? 0;
  const highImpact = Math.max(...Object.values(node.planningMetadata.abilityImpact), 0);
  if (rhythm === 'gentle') {
    const lowLoadBoost = node.planningMetadata.cognitiveLoad === 'low' ? 0.3 : 0;
    const shortResourceBoost = estimatedMinutes <= Math.max(12, constraints.timeBudgetMinutes / 5) ? 0.18 : 0;
    return lowLoadBoost + shortResourceBoost;
  }
  if (rhythm === 'challenge') {
    const highLoadBoost = node.planningMetadata.cognitiveLoad === 'high' ? 0.25 : 0;
    const highImpactBoost = highImpact >= 0.3 ? 0.25 : 0;
    const authenticTaskBoost = node.type === 'simulation' || node.type === 'arena_task' ? 0.2 : 0;
    return highLoadBoost + highImpactBoost + authenticTaskBoost;
  }
  return node.planningMetadata.cognitiveLoad === 'medium' ? 0.12 : 0;
}

function checkpointPreferenceScoreBoost(
  node: ResourceNode,
  preference: AdaptiveLearningPathPreferenceContext['checkpointPreference'],
): number {
  const isCheckpoint = Boolean(node.checkpoint) || node.type === 'checkpoint';
  const isTerminalValidation = node.planningMetadata.terminalConstraints.includes('terminal-validation');
  if (preference === 'dense') {
    return (isCheckpoint ? 0.45 : 0) + (isTerminalValidation ? 0.25 : 0);
  }
  if (preference === 'light') {
    return isTerminalValidation ? 0.08 : isCheckpoint ? -0.25 : 0.08;
  }
  return isCheckpoint ? 0.16 : 0;
}

function policyScoreBoost(
  node: ResourceNode,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  constraints: AdaptiveLearningPathConstraints,
  learnerState: AdaptiveLearningPathLearnerState | null,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
): number {
  const estimatedMinutes = node.planningMetadata.estimatedTimeMinutes ?? 0;
  if (policyFamily === 'foundation-remediation') {
    const conceptBoost = node.type === 'knowledge_card' ||
      node.type === 'lesson_step' ||
      node.type === 'quiz' ||
      node.type === 'handout'
      ? 1.1
      : 0;
    const lowLoadBoost = node.planningMetadata.cognitiveLoad === 'low' ? 0.25 : 0;
    const prerequisiteBoost = node.planningMetadata.prerequisites.length === 0 ? 0.12 : 0;
    return conceptBoost + lowLoadBoost + prerequisiteBoost;
  }
  if (policyFamily === 'simulation-driven') {
    if (node.type === 'simulation') return 0.65;
    if (node.type === 'arena_task') return 0.55;
    if (node.type === 'reflection') return 0.35;
    return 0;
  }
  if (policyFamily === 'sprint-correction') {
    const budgetRatio = estimatedMinutes / Math.max(constraints.timeBudgetMinutes, 1);
    const shortPathBoost = budgetRatio <= 0.3 ? 0.45 : budgetRatio <= 0.5 ? 0.25 : 0;
    const highImpactBoost = Math.max(...Object.values(node.planningMetadata.abilityImpact), 0) >= 0.3 ? 0.2 : 0;
    return shortPathBoost + highImpactBoost;
  }
  if (policyFamily === 'preference-matched') {
    const preferenceBoost = preferenceContext.resourceTypes.has(node.type) ||
      learnerState?.resourcePreference?.preferredModalities?.includes(node.type)
      ? 0.75
      : 0;
    const pacingBoost = estimatedMinutes <= Math.max(15, constraints.timeBudgetMinutes / 3) ? 0.18 : 0;
    return preferenceBoost + pacingBoost;
  }
  if (policyFamily === 'teacher-assigned') {
    return node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
      (constraints.teacherAssignedNodeIds ?? []).includes(node.id)
      ? 0.8
      : 0;
  }
  return 0;
}

function policyAllowsNode(
  node: ResourceNode,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  if (policyFamily !== 'teacher-assigned') {
    return true;
  }
  return node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
    (constraints.teacherAssignedNodeIds ?? []).includes(node.id);
}

function policyReasonCode(policyFamily: AdaptiveLearningPathPolicyFamily): string | null {
  if (policyFamily === 'rules-plus-graph-search') return null;
  return `policy-${policyFamily}`;
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
    if (!chain) {
      return [];
    }
    const includesRiskIntervention = chain.entries.some((candidate) => isRiskInterventionNode(candidate.node));
    if (!chain.coversGoalTarget && !(constraints.requireRiskIntervention && includesRiskIntervention)) {
      return [];
    }
    if (chainHasTerminalViolation(chain.entries)) {
      return [];
    }
    return [{
      entry,
      chain,
      goalTargets: goalTargetsCoveredByNodes(chain.entries.map((candidate) => candidate.node), goal),
      includesRiskIntervention,
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
    const leftTerminal = isTerminalNode(left.node);
    const rightTerminal = isTerminalNode(right.node);
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
  if (Array.from(state.selected.values()).some((candidate) => isTerminalNode(candidate.node))) {
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
  return node.planningMetadata.terminalConstraints.includes('terminal-node') ||
    node.planningMetadata.terminalConstraints.includes('terminal-validation');
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

function resolveCurrentNodeId(
  entries: ScoredNode[],
  completedNodeIds: string[],
  readinessByNodeId: Map<string, AdaptiveLearningPathNodeReadiness>,
  preferredCurrentNodeId?: string | null,
): string | null {
  const completed = new Set(completedNodeIds);
  if (
    preferredCurrentNodeId &&
    !completed.has(preferredCurrentNodeId) &&
    entries.some((entry) => entry.node.id === preferredCurrentNodeId) &&
    (readinessByNodeId.get(preferredCurrentNodeId)?.state ?? 'ready') === 'ready'
  ) {
    return preferredCurrentNodeId;
  }
  for (const entry of entries) {
    if (completed.has(entry.node.id)) continue;
    return (readinessByNodeId.get(entry.node.id)?.state ?? 'ready') === 'ready'
      ? entry.node.id
      : null;
  }
  return null;
}

function resolveCurrentPlanNodeId(
  nodes: AdaptiveLearningPathPlanNode[],
  completedNodeIds: string[],
): string | null {
  const completed = new Set(completedNodeIds);
  for (const node of nodes) {
    if (completed.has(node.nodeId)) continue;
    return (node.readiness?.state ?? 'ready') === 'ready' ? node.nodeId : null;
  }
  return null;
}

function toPlanNode(
  entry: ScoredNode,
  currentNodeId: string | null,
  completedNodeIds: string[],
  readiness: AdaptiveLearningPathNodeReadiness,
): AdaptiveLearningPathPlanNode {
  const target = entry.node.launchTarget ?? entry.node.renderTarget ?? '';
  const isCompleted = completedNodeIds.includes(entry.node.id);
  const locked = !isCompleted && readiness.state !== 'ready';
  return {
    nodeId: entry.node.id,
    title: entry.node.title,
    type: entry.node.type,
    pathNodeType: entry.node.pathSemantics.type,
    displayName: entry.node.pathSemantics.displayName,
    iconKey: entry.node.pathSemantics.iconKey,
    shapeHint: entry.node.pathSemantics.shapeHint,
    evidenceBehavior: entry.node.pathSemantics.evidenceBehavior,
    evidenceStatus: pathNodeEvidenceStatus(entry.node),
    externalResource: entry.node.externalResource,
    checkpoint: entry.node.checkpoint,
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
    status: isCompleted ? 'completed' : locked ? 'locked' : entry.node.id === currentNodeId ? 'current' : 'next',
    readiness,
  };
}

function pathNodeEvidenceStatus(node: ResourceNode): AdaptiveLearningPathPlanNode['evidenceStatus'] {
  if (node.type === 'external_resource') {
    if (node.externalResource?.evidenceUseStatus === 'explicit-access-required') return 'explicit-access-required';
    if (node.externalResource?.evidenceUseStatus === 'reference-only') return 'reference-only';
  }
  return node.planningMetadata.evidenceInstrumentation.length > 0 ? 'instrumented' : 'missing';
}

function readyNodeReadiness(): AdaptiveLearningPathNodeReadiness {
  return {
    state: 'ready',
    message: '可以开始。',
    unlockMessage: null,
    reasonCodes: [],
    fallbackNodeIds: [],
    missingCompetencies: [],
    missingEvidenceCount: 0,
    missingCompletedNodeIds: [],
    missingOutcomeRefs: [],
  };
}

function refreshPathReadinessAfterFeedback(
  nodes: AdaptiveLearningPathPlanNode[],
  completedNodeIds: string[],
  context: Record<string, unknown> | undefined,
): AdaptiveLearningPathPlanNode[] {
  const completed = new Set(completedNodeIds);
  const availableOutcomeRefs = new Set(readStringArray(context?.availableOutcomeRefs));
  const evidenceReadinessDelta = readNonNegativeNumber(context?.evidenceReadinessDelta);
  return nodes.map((node) => {
    if (!node.readiness || node.readiness.state === 'ready') return node;
    if (node.readiness.reasonCodes.includes('readiness-metadata-missing')) return node;
    const missingCompletedNodeIds = node.readiness.missingCompletedNodeIds.filter((id) => !completed.has(id));
    const missingOutcomeRefs = node.readiness.missingOutcomeRefs.filter((ref) => !availableOutcomeRefs.has(ref));
    const missingEvidenceCount = Math.max(0, node.readiness.missingEvidenceCount - evidenceReadinessDelta);
    const readiness = {
      ...node.readiness,
      missingEvidenceCount,
      missingCompletedNodeIds,
      missingOutcomeRefs,
    };
    const ready = readiness.missingCompetencies.length === 0 &&
      readiness.missingEvidenceCount === 0 &&
      readiness.missingCompletedNodeIds.length === 0 &&
      readiness.missingOutcomeRefs.length === 0;
    return {
      ...node,
      readiness: ready ? readyNodeReadiness() : readiness,
    };
  });
}

function evaluateNodeReadiness(
  node: ResourceNode,
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): AdaptiveLearningPathNodeReadiness {
  const readiness = node.planningMetadata.readiness;
  if (!readiness) {
    if (requiresReadinessMetadataForImmediateExecution(node)) {
      return {
        state: 'locked',
        message: '该节点需要完成准备条件后才能解锁。',
        unlockMessage: '该节点需要完成准备条件后才能解锁。',
        reasonCodes: ['readiness-metadata-missing'],
        fallbackNodeIds: node.planningMetadata.prerequisites,
        missingCompetencies: [],
        missingEvidenceCount: 0,
        missingCompletedNodeIds: [],
        missingOutcomeRefs: [],
      };
    }
    return readyNodeReadiness();
  }

  const completed = new Set([...completedNodeIds, ...(constraints.completedNodeIds ?? [])]);
  const availableOutcomeRefs = new Set(constraints.availableOutcomeRefs ?? []);
  const missingCompetencies = Object.entries(readiness.minimumCompetency)
    .filter(([dimension, minimum]) => learnerCompetencyScore(learnerState, dimension) < minimum)
    .map(([dimension]) => dimension);
  const missingEvidenceCount = Math.max(0, readiness.minimumEvidenceCount - learnerEvidenceCount(learnerState, readiness));
  const missingCompletedNodeIds = readiness.requiredCompletedNodeIds.filter((nodeId) => !completed.has(nodeId));
  const missingOutcomeRefs = readiness.requiredOutcomeRefs.filter((ref) => !availableOutcomeRefs.has(ref));
  const reasonCodes = [
    missingCompetencies.length > 0 ? 'readiness-minimum-competency' : null,
    missingEvidenceCount > 0 ? 'readiness-minimum-evidence' : null,
    missingCompletedNodeIds.length > 0 ? 'readiness-required-completion' : null,
    missingOutcomeRefs.length > 0 ? 'readiness-required-outcome' : null,
  ].filter((code): code is string => Boolean(code));

  if (reasonCodes.length === 0) return readyNodeReadiness();

  return {
    state: missingCompletedNodeIds.length > 0 || missingOutcomeRefs.length > 0 || missingCompetencies.length > 0
      ? 'locked'
      : 'evidence-needed',
    message: readiness.unlockMessage,
    unlockMessage: readiness.unlockMessage,
    reasonCodes,
    fallbackNodeIds: readiness.fallbackNodeIds,
    missingCompetencies,
    missingEvidenceCount,
    missingCompletedNodeIds,
    missingOutcomeRefs,
  };
}

function requiresReadinessMetadataForImmediateExecution(node: ResourceNode): boolean {
  if (node.planningMetadata.cognitiveLoad !== 'high') return false;
  return node.type === 'simulation' ||
    node.type === 'arena_task' ||
    node.type === 'control_workbench' ||
    node.type === 'checkpoint' ||
    node.planningMetadata.terminalConstraints.length > 0;
}

function learnerCompetencyScore(
  learnerState: AdaptiveLearningPathLearnerState | null,
  dimension: string,
): number {
  return learnerState?.primaryCompetencies?.vector?.[dimension]?.score ?? 0;
}

function learnerEvidenceCount(
  learnerState: AdaptiveLearningPathLearnerState | null,
  readiness: ResourceNodeReadinessMetadata,
): number {
  const competencyEvidence = Object.keys(readiness.minimumCompetency)
    .map((dimension) => learnerState?.primaryCompetencies?.vector?.[dimension]?.evidenceCount ?? 0);
  return Math.max(
    learnerState?.evidence?.confidence?.evidenceCount ?? 0,
    ...competencyEvidence,
    0,
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
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
  policyFamily: AdaptiveLearningPathPolicyFamily;
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
  if (input.policyFamily === 'teacher-assigned' && input.mainPathNodes.length === 0) {
    reasons.push('teacher-assignment-resource-missing');
  }
  if (
    requiresTerminalValidation(input.goal) &&
    !endsWithTerminalValidationNode(input.mainPathNodes)
  ) {
    reasons.push('terminal-validation-resource-missing');
  }
  return unique(reasons);
}

function isPathBlockingFallbackReason(reason: string): boolean {
  return [
    'resource-mapping-insufficient',
    'feasible-goal-path-missing',
    'time-budget-insufficient',
    'risk-intervention-resource-missing',
    'teacher-assignment-resource-missing',
    'terminal-validation-resource-missing',
  ].includes(reason);
}

function goalAllowsResourceNode(
  node: ResourceNode,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): boolean {
  return !registeredGoal || registeredGoal.allowedResourceMix.includes(node.type);
}

function externalResourceAllowed(
  node: ResourceNode,
  input: AdaptiveLearningPathPlannerInput,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): boolean {
  if (node.type !== 'external_resource') return true;
  const allowed = input.allowExternalResources ?? registeredGoal?.starterPathPolicy.allowExternalResources ?? false;
  return allowed && (
    !node.externalResource?.applicableGoalId ||
    node.externalResource.applicableGoalId === input.goal.id
  );
}

function resolvePolicyBundleRequest(
  input: AdaptiveLearningPathPlannerInput,
  confidence: AdaptiveLearningPathPlan['confidence'],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningPathPlannerInput['policyBundle'] {
  if (input.policyBundle) return input.policyBundle;
  if (!registeredGoal) return undefined;
  const evidenceCount = input.learnerState?.evidence?.confidence?.evidenceCount ?? 0;
  const needsStarterOptions = !input.learnerState || confidence.level === 'low' || evidenceCount <= 1;
  if (!needsStarterOptions) return undefined;
  return {
    families: registeredGoal.starterPathPolicy.policyFamilies,
    overlapThreshold: 0.95,
  };
}

function buildStudentFacingPathExplanation(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathPersistenceRecord['payload']['studentFacing'] {
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(plan.goal.id);
  const templates = registeredGoal?.explanationTemplates;
  const fallbackReasons = plan.explanations.fallbackReasons;
  const summary = fallbackReasons.includes('learner-state-missing')
    ? templates?.coldStart ?? '证据还少，先从入门路径开始，系统会随学习过程调整。'
    : fallbackReasons.includes('learner-evidence-low-confidence')
      ? templates?.lowConfidence ?? '当前证据不足，先沿可执行路径学习，后续会根据新证据调整。'
      : plan.status === 'ready'
        ? templates?.ready ?? '已根据当前学习证据生成可执行路径。'
        : templates?.fallback ?? '当前只能给出保守路径建议，请先完成可用资源并补充学习证据。';
  const nextAction = plan.currentNodeId
    ? `从“${plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.title ?? '当前节点'}”开始。`
    : '先完成可用的基础资源，系统会继续更新路径。';
  const confidenceLabel = plan.confidence.level === 'high'
    ? '证据充分'
    : plan.confidence.level === 'medium'
      ? '证据基本可用'
      : '证据较少';
  return {
    summary,
    nextAction,
    confidenceLabel,
  };
}

function requiresTerminalValidation(goal: AdaptiveLearningPathGoal): boolean {
  return getRegisteredAdaptiveLearningPathGoal(goal.id)?.checkpointPolicy.requiresTerminalValidation ?? false;
}

function isTerminalValidationNode(node: ResourceNode): boolean {
  return (node.type === 'simulation' || node.type === 'arena_task') &&
    node.planningMetadata.terminalConstraints.includes('terminal-validation');
}

function endsWithTerminalValidationNode(entries: ScoredNode[]): boolean {
  const last = entries.at(-1);
  return last ? isTerminalValidationNode(last.node) : false;
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

function buildPolicyBundle(
  input: AdaptiveLearningPathPlannerInput,
  primaryPolicyFamily: AdaptiveLearningPathPolicyFamily,
): AdaptiveLearningPathPolicyBundle | undefined {
  const requestedFamilies = input.policyBundle?.families;
  if (!requestedFamilies || requestedFamilies.length === 0) {
    return undefined;
  }
  const families = unique([primaryPolicyFamily, ...requestedFamilies]);
  const overlapThreshold = input.policyBundle?.overlapThreshold ?? 0.6;
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const terminalValidationRequired = registeredGoal?.checkpointPolicy.requiresTerminalValidation ?? false;
  const deficits = inferDeficits(input.goal, input.learnerState);
  const sourceCoverage = input.learnerState?.evidence?.sourceCoverage ?? {};
  const basePaths = families.map((policyFamily) => {
    const plan = buildAdaptiveLearningPathPlanInternal(
      {
        ...input,
        policyFamily,
        policyBundle: undefined,
      },
      false,
    );
    const mainPath = shapePolicyBundlePath(plan.mainPath, policyFamily, input);
    const modalityMix = buildModalityMix(mainPath);
    const terminalValidationNodeIds = mainPath
      .filter((node) => node.terminalConstraints.includes('terminal-validation'))
      .map((node) => node.nodeId);
    const checkpointNodeIds = selectCheckpointNodeIds(mainPath, registeredGoal);
    return {
      styleId: styleIdForPolicyFamily(policyFamily),
      policyFamily,
      label: styleLabelForPolicyFamily(policyFamily),
      nodeIds: mainPath.map((node) => node.nodeId),
      activeNodeIds: activePolicyNodeIds(mainPath),
      lockedNodeIds: lockedPolicyNodeIds(mainPath),
      readinessSummary: policyReadinessSummary(mainPath),
      unlockMessages: policyUnlockMessages(mainPath),
      planNodes: mainPath,
      nodeSummaries: mainPath.map(toPathOptionNodeSummary),
      targetDeficits: deficitsForPath(mainPath, deficits),
      evidenceBasis: buildPathEvidenceBasis(plan, sourceCoverage),
      estimatedMinutes: remainingEstimatedMinutes(mainPath),
      modalityMix,
      resourceMix: modalityMix,
      overlap: {
        maxWithOtherOptions: 0,
      },
      effort: {
        estimatedMinutes: remainingEstimatedMinutes(mainPath),
        relative: effortLabel(remainingEstimatedMinutes(mainPath), input.constraints.timeBudgetMinutes),
      },
      expectedTargetLift: round(plan.score.objectives.learningGain, 3),
      terminalValidationNodeIds,
      terminalValidationStrategy: {
        nodeIds: terminalValidationNodeIds,
        summary: terminalValidationRequired
          ? terminalValidationNodeIds.length > 0
            ? `terminal validation through ${terminalValidationNodeIds.join(', ')}`
            : 'terminal validation unavailable'
          : '阶段检查点用于学习反馈',
      },
      checkpointNodeIds,
      limitations: buildPathOptionLimitations(plan, terminalValidationNodeIds, deficits, terminalValidationRequired),
    };
  });
  const pairwiseResourceOverlap = buildPairwiseResourceOverlap(basePaths);
  const paths = basePaths.map((path) => ({
    ...path,
    overlap: {
      maxWithOtherOptions: round(pairwiseResourceOverlap
        .filter((item) => item.left === path.policyFamily || item.right === path.policyFamily)
        .reduce((max, item) => Math.max(max, item.overlap), 0), 3),
    },
  }));
  const pairwiseModalityDistance = buildPairwiseModalityDistance(paths);
  const pairwiseEstimatedEffortDifference = buildPairwiseEstimatedEffortDifference(paths);
  const pairwiseTerminalValidationDifference = buildPairwiseTerminalValidationDifference(paths);
  const maxResourceOverlap = round(
    pairwiseResourceOverlap.reduce((max, item) => Math.max(max, item.overlap), 0),
    3,
  );
  const minModalityDistance = minPairwiseValue(pairwiseModalityDistance, 'distance');
  const minEstimatedEffortDifference = minPairwiseValue(pairwiseEstimatedEffortDifference, 'difference');
  const minTerminalValidationDifference = minPairwiseValue(pairwiseTerminalValidationDifference, 'difference');
  const modalityMixByPolicy = Object.fromEntries(
    paths.map((path) => [path.policyFamily, path.modalityMix]),
  );
  const estimatedEffortByPolicy = Object.fromEntries(
    paths.map((path) => [path.policyFamily, path.estimatedMinutes]),
  );
  const terminalValidationDifference = minTerminalValidationDifference;
  const emptyPathCount = paths.filter((path) => path.nodeIds.length === 0).length;
  const terminalValidationMissing = terminalValidationRequired &&
    paths.some((path) => path.terminalValidationNodeIds.length === 0);
  const fallbackReasons = unique([
    emptyPathCount > 0 ? 'policy-path-resource-missing' : null,
    maxResourceOverlap > overlapThreshold ? 'path-diversity-insufficient' : null,
    minModalityDistance === 0 ? 'path-modality-diversity-insufficient' : null,
    minEstimatedEffortDifference === 0 ? 'path-effort-diversity-insufficient' : null,
    terminalValidationMissing ? 'terminal-validation-diversity-insufficient' : null,
    new Set(paths.map((path) => path.nodeIds.join('|'))).size < Math.min(paths.length, 2)
      ? 'policy-paths-identical'
      : null,
  ].filter((item): item is string => Boolean(item)));

  return {
    families,
    overlapThreshold,
    status: fallbackReasons.length > 0 ? 'low-resource-fallback' : 'ready',
    paths,
    diversity: {
      maxResourceOverlap,
      minModalityDistance,
      minEstimatedEffortDifference,
      minTerminalValidationDifference,
      pairwiseResourceOverlap,
      pairwiseModalityDistance,
      pairwiseEstimatedEffortDifference,
      pairwiseTerminalValidationDifference,
      modalityMixByPolicy,
      estimatedEffortByPolicy,
      terminalValidationDifference,
    },
    fallbackReasons,
  };
}

function refreshPolicyBundlePathStates(
  policyBundle: AdaptiveLearningPathPolicyBundle | undefined,
  mainPath: AdaptiveLearningPathPlanNode[],
): AdaptiveLearningPathPolicyBundle | undefined {
  if (!policyBundle) return undefined;
  const pathByNodeId = new Map(mainPath.map((node) => [node.nodeId, node]));
  return {
    ...policyBundle,
    paths: policyBundle.paths.map((path) => {
      const optionNodes = path.nodeIds
        .map((nodeId) => pathByNodeId.get(nodeId))
        .filter((node): node is AdaptiveLearningPathPlanNode => Boolean(node));
      if (optionNodes.length === 0) return path;
      const refreshedNodeIds = new Set(optionNodes.map((node) => node.nodeId));
      return {
        ...path,
        activeNodeIds: [
          ...path.activeNodeIds.filter((nodeId) => !refreshedNodeIds.has(nodeId)),
          ...activePolicyNodeIds(optionNodes),
        ],
        lockedNodeIds: [
          ...path.lockedNodeIds.filter((nodeId) => !refreshedNodeIds.has(nodeId)),
          ...lockedPolicyNodeIds(optionNodes),
        ],
        readinessSummary: [
          ...path.readinessSummary.filter((item) => !refreshedNodeIds.has(item.nodeId)),
          ...policyReadinessSummary(optionNodes),
        ],
        unlockMessages: [
          ...path.unlockMessages.filter((item) => !refreshedNodeIds.has(item.nodeId)),
          ...policyUnlockMessages(optionNodes),
        ],
        planNodes: (Array.isArray(path.planNodes) ? path.planNodes : optionNodes)
          .map((node) => pathByNodeId.get(node.nodeId) ?? node),
        nodeSummaries: path.nodeSummaries.map((summary) => {
          const node = pathByNodeId.get(summary.nodeId);
          return node ? toPathOptionNodeSummary(node) : summary;
        }),
      };
    }),
  };
}

function activePolicyNodeIds(path: AdaptiveLearningPathPlanNode[]): string[] {
  const activeNodeIds: string[] = [];
  for (const node of path) {
    if (node.status === 'completed') continue;
    if (node.status === 'locked' || node.status === 'blocked') break;
    activeNodeIds.push(node.nodeId);
  }
  return activeNodeIds;
}

function lockedPolicyNodeIds(path: AdaptiveLearningPathPlanNode[]): string[] {
  return path
    .filter((node) => node.status === 'locked')
    .map((node) => node.nodeId);
}

function policyReadinessSummary(path: AdaptiveLearningPathPlanNode[]): Array<{
  nodeId: string;
  state: AdaptiveLearningPathReadinessState;
  message: string;
}> {
  return path
    .filter((node) => (node.readiness?.state ?? 'ready') !== 'ready')
    .map((node) => ({
      nodeId: node.nodeId,
      state: node.readiness?.state ?? 'locked',
      message: node.readiness?.message ?? '完成准备节点后会自动解锁。',
    }));
}

function policyUnlockMessages(path: AdaptiveLearningPathPlanNode[]): Array<{
  nodeId: string;
  message: string;
}> {
  return path
    .filter((node) => Boolean(node.readiness?.unlockMessage))
    .map((node) => ({
      nodeId: node.nodeId,
      message: node.readiness?.unlockMessage ?? '完成准备节点后会自动解锁。',
    }));
}

function shapePolicyBundlePath(
  mainPath: AdaptiveLearningPathPlanNode[],
  policyFamily: AdaptiveLearningPathPolicyFamily,
  input: AdaptiveLearningPathPlannerInput,
): AdaptiveLearningPathPlanNode[] {
  if (input.goal.id !== 'control-correction') {
    return mainPath;
  }
  if (policyFamily !== 'foundation-remediation' && policyFamily !== 'preference-matched') {
    return mainPath;
  }
  const selectedIds = new Set(mainPath.map((node) => node.nodeId));
  const remainingBudget = input.constraints.timeBudgetMinutes - remainingEstimatedMinutes(mainPath);
  const supportNodes = selectPolicySupportNodes(policyFamily, input, selectedIds, remainingBudget);
  if (supportNodes.length === 0) {
    return mainPath;
  }
  const completedNodeIds = unique([
    ...(input.constraints.completedNodeIds ?? []),
    ...mainPath.filter((node) => node.status === 'completed').map((node) => node.nodeId),
  ]);
  const supportPlanNodes = supportNodes.map((node) => toPlanNode({
    node,
    score: 0.35,
    reasonCodes: [`policy-${policyFamily}-support`],
  }, null, completedNodeIds, evaluateNodeReadiness(node, input.learnerState, input.constraints, completedNodeIds)));
  const validationIndex = mainPath.findIndex((node) => node.terminalConstraints.length > 0);
  if (validationIndex < 0) {
    return [...supportPlanNodes, ...mainPath];
  }
  return [
    ...mainPath.slice(0, validationIndex),
    ...supportPlanNodes,
    ...mainPath.slice(validationIndex),
  ];
}

function selectPolicySupportNodes(
  policyFamily: AdaptiveLearningPathPolicyFamily,
  input: AdaptiveLearningPathPlannerInput,
  selectedIds: Set<string>,
  remainingBudget: number,
): ResourceNode[] {
  let remaining = Math.max(0, remainingBudget);
  const deficits = inferDeficits(input.goal, input.learnerState);
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const excludedNodeIds = new Set(input.excludedNodeIds ?? []);
  const eligibleIds = new Set(partitionResourceNodes(input.registry.nodes, input.constraints).eligible
    .filter((node) => !excludedNodeIds.has(node.id))
    .filter((node) => externalResourceAllowed(node, input, registeredGoal))
    .map((node) => node.id));
  const picked: ResourceNode[] = [];
  const addCandidates = (candidates: ResourceNode[], limit: number) => {
    for (const node of candidates) {
      if (picked.length >= limit) break;
      if (selectedIds.has(node.id) || picked.some((item) => item.id === node.id)) continue;
      if (excludedNodeIds.has(node.id)) continue;
      if (!eligibleIds.has(node.id)) continue;
      if (node.planningMetadata.terminalConstraints.length > 0) continue;
      if (node.planningMetadata.prerequisites.length > 0) continue;
      if (!policyAllowsNode(node, policyFamily, input.constraints)) continue;
      if (!nodeMatchesGoal(node, input.goal, deficits)) continue;
      const estimatedMinutes = node.planningMetadata.estimatedTimeMinutes ?? 0;
      if (estimatedMinutes > remaining) continue;
      picked.push(node);
      remaining -= estimatedMinutes;
    }
  };

  if (policyFamily === 'foundation-remediation') {
    const typeRank = new Map<ResourceNode['type'], number>([
      ['knowledge_card', 0],
      ['handout', 1],
      ['lesson_step', 2],
      ['quiz', 3],
    ]);
    addCandidates(input.registry.nodes
      .filter((node) => typeRank.has(node.type))
      .sort((left, right) =>
        (typeRank.get(left.type) ?? 99) - (typeRank.get(right.type) ?? 99) ||
        (left.planningMetadata.estimatedTimeMinutes ?? 0) - (right.planningMetadata.estimatedTimeMinutes ?? 0) ||
        left.id.localeCompare(right.id)
      ), 2);
    return picked;
  }

  const preferredTypes = input.learnerState?.resourcePreference?.preferredModalities ?? [];
  const preferenceRank = new Map(preferredTypes.map((type, index) => [type, index]));
  addCandidates(input.registry.nodes
    .filter((node) => preferenceRank.has(node.type))
    .sort((left, right) =>
      (preferenceRank.get(left.type) ?? 99) - (preferenceRank.get(right.type) ?? 99) ||
      (left.planningMetadata.estimatedTimeMinutes ?? 0) - (right.planningMetadata.estimatedTimeMinutes ?? 0) ||
      left.id.localeCompare(right.id)
    ), 2);
  addCandidates(input.registry.nodes
    .filter((node) => node.type === 'ai_intervention' || node.type === 'reflection')
    .sort((left, right) =>
      (left.planningMetadata.estimatedTimeMinutes ?? 0) - (right.planningMetadata.estimatedTimeMinutes ?? 0) ||
      left.id.localeCompare(right.id)
    ), 2);
  return picked;
}

function toPathOptionNodeSummary(node: AdaptiveLearningPathPlanNode): AdaptiveLearningPathOptionNodeSummary {
  return {
    nodeId: node.nodeId,
    title: node.title,
    pathNodeType: node.pathNodeType,
    displayName: node.displayName,
    iconKey: node.iconKey,
    shapeHint: node.shapeHint,
    evidenceBehavior: node.evidenceBehavior,
    evidenceStatus: node.evidenceStatus,
    estimatedTimeMinutes: node.estimatedTimeMinutes,
    status: node.status,
  };
}

function selectCheckpointNodeIds(
  mainPath: AdaptiveLearningPathPlanNode[],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): string[] {
  if (mainPath.length === 0) return [];
  const terminalValidationNodeIds = mainPath
    .filter((node) => node.terminalConstraints.includes('terminal-validation'))
    .map((node) => node.nodeId);
  if (terminalValidationNodeIds.length > 0) return terminalValidationNodeIds;
  const policy = registeredGoal?.checkpointPolicy;
  const preferred = policy
    ? mainPath
        .filter((node) => policy.checkpointResourceTypes.includes(node.type))
        .map((node) => node.nodeId)
    : [];
  const minimum = Math.max(1, policy?.minCheckpoints ?? 1);
  return unique([
    ...preferred,
    mainPath.at(-1)?.nodeId,
  ]).slice(0, minimum);
}

function buildModalityMix(mainPath: AdaptiveLearningPathPlanNode[]): Record<string, number> {
  return mainPath.reduce<Record<string, number>>((mix, node) => {
    mix[node.type] = (mix[node.type] ?? 0) + 1;
    return mix;
  }, {});
}

function styleIdForPolicyFamily(policyFamily: AdaptiveLearningPathPolicyFamily): AdaptiveLearningPathStyleId {
  if (policyFamily === 'foundation-remediation') return 'foundation-remediation';
  if (policyFamily === 'simulation-driven') return 'arena-simulation-sprint';
  if (policyFamily === 'preference-matched') return 'preference-matched-route';
  if (policyFamily === 'sprint-correction') return 'sprint-correction-route';
  if (policyFamily === 'teacher-assigned') return 'teacher-assigned-route';
  return 'rules-graph-search-route';
}

function styleLabelForPolicyFamily(policyFamily: AdaptiveLearningPathPolicyFamily): string {
  if (policyFamily === 'foundation-remediation') return '基础补救';
  if (policyFamily === 'simulation-driven') return '仿真与 Arena 冲刺';
  if (policyFamily === 'preference-matched') return '偏好匹配路线';
  if (policyFamily === 'sprint-correction') return '短程纠偏';
  if (policyFamily === 'teacher-assigned') return '教师指定路线';
  return '推荐路线';
}

function deficitsForPath(
  mainPath: AdaptiveLearningPathPlanNode[],
  deficits: AdaptiveLearningPathDeficit[],
): AdaptiveLearningPathDeficit[] {
  const coveredTargets = new Set([
    ...mainPath.flatMap((node) => node.knowledgeCoverage),
  ]);
  for (const node of mainPath) {
    for (const reason of node.reasonCodes) {
      if (reason.includes('competency')) {
        for (const deficit of deficits.filter((item) => item.kind === 'competency')) {
          coveredTargets.add(deficit.targetId);
        }
      }
    }
  }
  const selected = deficits.filter((deficit) => coveredTargets.has(deficit.targetId));
  return selected.length > 0 ? selected : deficits.slice(0, 3);
}

function buildPathEvidenceBasis(
  plan: AdaptiveLearningPathPlan,
  sourceCoverage: Record<string, string>,
): string[] {
  return unique([
    plan.confidence.sourceCoverage > 0 ? 'adaptive-learner-state' : 'low-confidence-learner-state',
    ...Object.entries(sourceCoverage)
      .filter(([, state]) => state === 'available' || state === 'partial')
      .map(([source]) => source),
    plan.visualization.evidence.evidenceBasis,
  ]);
}

function effortLabel(estimatedMinutes: number, timeBudgetMinutes: number): 'short' | 'medium' | 'long' {
  if (estimatedMinutes <= Math.max(20, timeBudgetMinutes * 0.35)) return 'short';
  if (estimatedMinutes <= Math.max(45, timeBudgetMinutes * 0.7)) return 'medium';
  return 'long';
}

function buildPathOptionLimitations(
  plan: AdaptiveLearningPathPlan,
  terminalValidationNodeIds: string[],
  deficits: AdaptiveLearningPathDeficit[],
  terminalValidationRequired = true,
): string[] {
  return unique([
    terminalValidationRequired && terminalValidationNodeIds.length === 0 ? '需要完成终点检验' : null,
    deficits.some((deficit) => deficit.evidenceCount === 0) ? '部分目标还缺少直接证据' : null,
    plan.confidence.level === 'low' ? '当前证据较少' : null,
  ]);
}

function buildPairwiseResourceOverlap(paths: AdaptiveLearningPathPolicyBundle['paths']): AdaptiveLearningPathPolicyBundle['diversity']['pairwiseResourceOverlap'] {
  const overlaps: AdaptiveLearningPathPolicyBundle['diversity']['pairwiseResourceOverlap'] = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex];
      const right = paths[rightIndex];
      overlaps.push({
        left: left.policyFamily,
        right: right.policyFamily,
        overlap: resourceOverlap(left.nodeIds, right.nodeIds),
      });
    }
  }
  return overlaps;
}

function buildPairwiseModalityDistance(paths: AdaptiveLearningPathPolicyBundle['paths']): AdaptiveLearningPathPolicyBundle['diversity']['pairwiseModalityDistance'] {
  const distances: AdaptiveLearningPathPolicyBundle['diversity']['pairwiseModalityDistance'] = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex];
      const right = paths[rightIndex];
      distances.push({
        left: left.policyFamily,
        right: right.policyFamily,
        distance: setDistance(Object.keys(left.modalityMix), Object.keys(right.modalityMix)),
      });
    }
  }
  return distances;
}

function buildPairwiseEstimatedEffortDifference(paths: AdaptiveLearningPathPolicyBundle['paths']): AdaptiveLearningPathPolicyBundle['diversity']['pairwiseEstimatedEffortDifference'] {
  const differences: AdaptiveLearningPathPolicyBundle['diversity']['pairwiseEstimatedEffortDifference'] = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex];
      const right = paths[rightIndex];
      const denominator = Math.max(left.estimatedMinutes, right.estimatedMinutes, 1);
      differences.push({
        left: left.policyFamily,
        right: right.policyFamily,
        difference: round(Math.abs(left.estimatedMinutes - right.estimatedMinutes) / denominator, 3),
      });
    }
  }
  return differences;
}

function buildPairwiseTerminalValidationDifference(paths: AdaptiveLearningPathPolicyBundle['paths']): AdaptiveLearningPathPolicyBundle['diversity']['pairwiseTerminalValidationDifference'] {
  const differences: AdaptiveLearningPathPolicyBundle['diversity']['pairwiseTerminalValidationDifference'] = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex];
      const right = paths[rightIndex];
      differences.push({
        left: left.policyFamily,
        right: right.policyFamily,
        difference: setDistance(left.terminalValidationNodeIds, right.terminalValidationNodeIds),
      });
    }
  }
  return differences;
}

function minPairwiseValue<T extends Record<K, number>, K extends string>(items: T[], key: K): number {
  if (items.length === 0) {
    return 0;
  }
  return round(items.reduce((min, item) => Math.min(min, item[key]), 1), 3);
}

function resourceOverlap(leftNodeIds: string[], rightNodeIds: string[]): number {
  const left = new Set(leftNodeIds);
  const right = new Set(rightNodeIds);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 1;
  }
  const intersection = Array.from(left).filter((nodeId) => right.has(nodeId));
  return round(intersection.length / union.size, 3);
}

function setDistance(leftValues: string[], rightValues: string[]): number {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 0;
  }
  const intersection = Array.from(left).filter((value) => right.has(value));
  return round(1 - intersection.length / union.size, 3);
}

function buildVisualization(input: {
  mainPath: AdaptiveLearningPathPlanNode[];
  alternatives: AdaptiveLearningPathAlternative[];
  blocked: AdaptiveLearningPathAlternative[];
  currentNodeId: string | null;
  completedNodeIds: string[];
  deficits: AdaptiveLearningPathDeficit[];
  capabilityTargets: AdaptiveLearningCapabilityTarget[];
  learnerState: AdaptiveLearningPathLearnerState | null;
  sourceCoverage: Record<string, string>;
  confidence: AdaptiveLearningPathPlan['confidence'];
  status: AdaptiveLearningPathStatus;
  hasUsablePath: boolean;
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
      evidenceBasis: input.status === 'fallback' && !input.hasUsablePath ? 'fallback' : 'adaptive-learner-state',
      confidence: input.confidence,
      sourceCoverage: input.sourceCoverage,
      learnerStateDeficits: input.deficits,
      capabilityEvidence: buildCapabilityEvidence(input.capabilityTargets, input.learnerState),
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

function unique<T extends string>(values: Array<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => Boolean(value))));
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Compass,
  ExternalLink,
  Flag,
  GitBranch,
  History,
  ListChecks,
  MessageSquare,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { AppShell } from '@/components/platform/app-shell';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  buildControlCorrectionLearningCenterView,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  type ControlCorrectionLearningCenterView,
  type ControlCorrectionCenterRouteIntent,
  type PracticeEntryRouteNode,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import {
  buildAdaptivePathOptionDisplays,
  type AdaptivePathOptionDisplay,
  type AdaptivePathOptionWriteOption,
  type AdaptivePathResourceKind,
} from '@/lib/adaptive-path-option-display';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

type PostLearningPathNodeAction = {
  href: string;
  method: 'POST';
  body?: Record<string, unknown>;
  redirectHref?: string;
};

type LearningPathNodeCompletionAction = {
  href: string;
  label: string;
  method: 'POST';
  body: Record<string, unknown>;
};

function isPostLearningPathNodeAction(action: {
  method: 'GET' | 'POST';
  href: string;
  body?: Record<string, unknown>;
  redirectHref?: string;
}): action is PostLearningPathNodeAction {
  return action.method === 'POST';
}

interface DiagnosticResponse {
  knowledgeDimensions: {
    computational: number;
    crossDomain: number;
    design: number;
  };
  weakAreas: string[];
  recommendedFocus: string[];
}

interface PracticeQuestion {
  id: string;
  stem: string;
  domains: string[];
  type: string;
  difficulty: number;
  knowledgeTags: string[];
  options: Array<{
    label: string;
    text: string;
    explanation: string;
  }>;
}

interface NextQuestionResponse {
  question: PracticeQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
}

interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOption: string;
  explanation: string;
  estimatedAbility: number;
  recommendedFocus: string[];
}

interface PathAdvisorContextResponse {
  goalId: AdaptivePracticeGoalId;
  classId: string;
  modeContextToken: string;
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
}

interface LearningPathRoundResponse {
  path?: {
    id: string;
    userId: string;
    title: string;
    goalId: string;
    plannerVersion?: string | null;
    pathStatus?: string | null;
    currentNodeId?: string | null;
    pathPayload?: Record<string, unknown> | null;
    explanationPayload?: Record<string, unknown> | null;
    alternativePayload?: unknown[] | null;
    terminalValidation?: Record<string, unknown> | null;
    lastExecutionMetadata?: Record<string, unknown> | null;
    executions?: Array<Record<string, unknown>>;
    deviations?: Array<Record<string, unknown>>;
    interventions?: Array<Record<string, unknown>>;
  } | null;
}

type LearningPathRoundView = NonNullable<LearningPathRoundResponse['path']>;

type PathOptionView = AdaptivePathOptionWriteOption;
type PathGenerationOperation = 'generate' | 'revise' | 'explain';
type GenerationDifficultyRhythm = 'gentle' | 'steady' | 'challenge';
type GenerationCheckpointPreference = 'light' | 'standard' | 'dense';

interface PathGenerationPanelState {
  goalId: AdaptivePracticeGoalId;
  timeBudgetMinutes: number;
  difficultyRhythm: GenerationDifficultyRhythm;
  resourcePreference: AdaptivePathResourceKind[];
  checkpointPreference: GenerationCheckpointPreference;
  allowExternalResources: boolean;
  naturalLanguageIntent: string;
}

interface PathSelectionHistoryView {
  type: string;
  createdAt?: string;
  selectedStyleId?: string | null;
  selectedOptionLabel?: string | null;
  previousStyleId?: string | null;
  previousOptionLabel?: string | null;
  rejectedStyleIds?: string[];
  rejectedOptionLabels?: string[];
  helpful?: boolean | null;
}

interface PathExecutionNodeView {
  nodeId: string;
  title: string;
  type: string;
  resourceLabel: string;
  status: 'current' | 'completed' | 'skipped' | 'blocked' | 'locked' | 'next' | 'optional';
  target: string;
  estimatedMinutes: number;
  reason: string;
  evidence: string;
  checkpoint: string;
  unlockMessage?: string;
}

interface PathActivityTimelineItem {
  id: string;
  nodeId: string;
  type: string;
  title: string;
  detail: string;
  nodeTitle: string;
  sourceLabel: string;
  stateLabel: '已记录' | '待复核' | '可用于推荐' | '仅作参考';
  createdAt: string;
  sortTime: number;
}

type DemoScene = 'stable' | 'generate';

const DEMO_SCENES: Record<DemoScene, {
  diagnostic: DiagnosticResponse;
  questionState: NextQuestionResponse;
  feedback: SubmitAnswerResponse | null;
  defaultSelectedOption: string;
}> = {
  stable: {
    diagnostic: {
      knowledgeDimensions: {
        computational: 76,
        crossDomain: 63,
        design: 58,
      },
      weakAreas: ['phase-margin', 'disturbance-rejection', 'controller-tuning'],
      recommendedFocus: [
        '优先练习“相位裕度-超调量”映射题',
        '补强扰动抑制与鲁棒性分析',
        '加强 PID 参数因果调节训练',
      ],
    },
    questionState: {
      estimatedAbility: 0.54,
      confidenceInterval: [0.31, 0.77],
      question: {
        id: 'demo-classic-stable',
        stem: '某系统相位裕度从 45° 降至 20°，且交叉频率上升。以下哪项最符合“频域→时域”映射规律？',
        domains: ['frequency', 'time'],
        type: 'bode-to-stability',
        difficulty: 0.58,
        knowledgeTags: ['phase-margin', 'overshoot'],
        options: [
          { label: 'A', text: '超调风险升高且鲁棒性下降', explanation: '相位裕度下降通常对应阻尼降低，超调增加且鲁棒性变差。' },
          { label: 'B', text: '超调下降且抗扰增强', explanation: '该选项与相位裕度下降的典型结果相反。' },
          { label: 'C', text: '动态几乎不变，仅稳态误差变化', explanation: '动态指标会明显变化，不仅是稳态误差。' },
          { label: 'D', text: '系统一定变为无振荡响应', explanation: '该结论与裕度降低趋势不一致。' },
        ],
      },
    },
    feedback: null,
    defaultSelectedOption: '',
  },
  generate: {
    diagnostic: {
      knowledgeDimensions: {
        computational: 68,
        crossDomain: 71,
        design: 64,
      },
      weakAreas: ['comfort-constraint', 'robustness', 'controller-tuning'],
      recommendedFocus: [
        '关注舒适度约束与控制带宽权衡',
        '增加参数摄动场景下的决策练习',
        '加强 PID 参数因果调节训练',
      ],
    },
    questionState: {
      estimatedAbility: 0.89,
      confidenceInterval: [0.65, 1.12],
      question: {
        id: 'demo-generated-live',
        stem: '【AI现场生成】邮轮横摇舒适度未达标（MSI 偏高），请在保持稳定裕度 > 30° 约束下，给出可执行调参策略。',
        domains: ['time', 'frequency', 'complex'],
        type: 'multi-criteria',
        difficulty: 0.72,
        knowledgeTags: ['comfort-constraint', 'robustness', 'controller-tuning'],
        options: [
          {
            label: 'A',
            text: '先识别主导约束，再按跨域因果逐步调参',
            explanation: '跨域问题应先明确约束，再基于“极点-频域-时域”因果做迭代优化。',
          },
          { label: 'B', text: '直接大幅提高 Kp 并忽略约束', explanation: '忽略约束会导致舒适度与鲁棒性风险。' },
          { label: 'C', text: '仅根据单一指标一次性定参', explanation: '单指标决策难以应对跨域耦合。' },
          { label: 'D', text: '只追求最快响应，不评估稳定裕度', explanation: '稳定裕度是硬约束，不能跳过。' },
        ],
      },
    },
    feedback: {
      isCorrect: true,
      correctOption: 'A',
      explanation: '本题强调“约束优先 + 跨域因果”的设计流程，先保稳定再优化舒适度。',
      estimatedAbility: 0.96,
      recommendedFocus: ['围绕 comfort-constraint 继续练习跨域题目', '增加参数摄动场景下的决策练习'],
    },
    defaultSelectedOption: 'A',
  },
};

const DEMO_CONTROL_CORRECTION_PATH_NODES = [
  {
    nodeId: 'demo-foundation-card',
    title: '复习根轨迹与超调关系',
    type: 'knowledge_card',
    pathNodeType: 'resource',
    displayName: '知识卡',
    iconKey: 'knowledge-card',
    shapeHint: 'rounded',
    evidenceBehavior: 'explicit-access',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'knowledge_card',
    sourceRef: 'demo-foundation-card',
    target: '/knowledge?node=control-root-locus',
    estimatedTimeMinutes: 25,
    prerequisiteNodeIds: [],
    knowledgeCoverage: ['根轨迹', '超调量'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: [],
    score: 0.88,
    reasonCodes: ['matches-knowledge-deficit', 'low-mastery-target'],
    status: 'completed',
  },
  {
    nodeId: 'demo-current-quiz',
    title: '完成频域到时域检查题',
    type: 'adaptive_quiz',
    pathNodeType: 'checkpoint',
    displayName: '自适应练习',
    iconKey: 'adaptive-quiz',
    shapeHint: 'diamond',
    evidenceBehavior: 'instrumented',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: { required: true, label: '检查点', criteria: ['解释裕度变化', '选择校正方向'] },
    sourceKind: 'adaptive_quiz',
    sourceRef: 'demo-current-quiz',
    target: '/assessment/adaptive-practice',
    estimatedTimeMinutes: 35,
    prerequisiteNodeIds: ['demo-foundation-card'],
    knowledgeCoverage: ['相位裕度', '频域稳定性'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: ['checkpoint-pass'],
    score: 0.91,
    reasonCodes: ['checkpoint-required', 'matches-competency-deficit'],
    status: 'current',
  },
  {
    nodeId: 'demo-simulation',
    title: '进入仿真验证校正效果',
    type: 'simulation',
    pathNodeType: 'resource',
    displayName: '虚拟仿真',
    iconKey: 'simulation',
    shapeHint: 'rounded',
    evidenceBehavior: 'instrumented',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'simulation',
    sourceRef: 'demo-simulation',
    target: '/simulations/control-workbench',
    estimatedTimeMinutes: 45,
    prerequisiteNodeIds: ['demo-current-quiz'],
    knowledgeCoverage: ['校正验证', '参数实验'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: [],
    score: 0.8,
    reasonCodes: ['policy-simulation-driven'],
    status: 'locked',
    readiness: {
      state: 'locked',
      message: '完成检查题后会自动解锁仿真验证。',
      unlockMessage: '完成检查题后会自动解锁仿真验证。',
      reasonCodes: ['readiness-required-completion'],
      fallbackNodeIds: ['demo-current-quiz'],
      missingCompetencies: [],
      missingEvidenceCount: 0,
      missingCompletedNodeIds: ['demo-current-quiz'],
      missingOutcomeRefs: [],
    },
  },
] as unknown as AdaptiveLearningPathPlan['mainPath'];

const DEMO_CONTROL_CORRECTION_PATH_PLAN = {
  id: 'demo-control-correction-path',
  userId: 'demo-student',
  goal: {
    id: 'control-correction',
    title: '控制系统校正设计',
    knowledgeTargets: ['root-locus', 'frequency-response', 'simulation-validation'],
    competencyTargets: ['parameterDesign', 'engineeringDecision'],
  },
  stage: 'stage-1-rules-graph',
  policyFamily: 'foundation-remediation',
  policyMetadata: {
    id: 'foundation-remediation',
    label: '基础补救策略',
    scoringIntent: 'prioritize prerequisite repair before validation',
    constraints: ['terminal-validation-last'],
    fallbackSemantics: 'use available starter path',
  },
  excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
  status: 'ready',
  currentNodeId: 'demo-current-quiz',
  mainPath: DEMO_CONTROL_CORRECTION_PATH_NODES,
  alternatives: [],
  score: {
    total: 0.84,
    objectives: {
      learningGain: 0.88,
      engagement: 0.72,
      constraintSatisfaction: 1,
      diversity: 0.8,
      fatigue: 0.12,
    },
  },
  confidence: {
    level: 'medium',
    score: 0.76,
    sourceCoverage: 0.68,
  },
  explanations: {
    selectedReasons: ['matches-knowledge-deficit', 'checkpoint-required'],
    rejectedAlternatives: [],
    fallbackReasons: [],
  },
  executionStatus: {
    adopted: true,
    completedNodeIds: ['demo-foundation-card'],
    activeNodeId: 'demo-current-quiz',
    updatedAt: '2026-06-16T09:00:00+08:00',
  },
  deviations: [],
  corrections: [],
  feedbackEvents: [],
  visualization: {
    graph: { nodes: [], edges: [] },
    timeline: { generatedAt: '2026-06-16T09:00:00+08:00', items: [] },
    badges: [],
  },
} as unknown as AdaptiveLearningPathPlan;

const DEMO_CONTROL_CORRECTION_PATH_ROUND = {
  id: 'demo-control-correction-round',
  userId: 'demo-student',
  title: '控制系统校正设计学习路径',
  goalId: 'control-correction',
  pathStatus: 'active',
  currentNodeId: 'demo-current-quiz',
  lastExecutionMetadata: {
    completedNodeIds: ['demo-foundation-card'],
    failedNodeIds: [],
  },
  terminalValidation: { state: 'pending' },
  executions: [
    {
      id: 'demo-exec-foundation',
      nodeId: 'demo-foundation-card',
      activityKind: 'completion',
      status: 'completed',
      resourceType: 'knowledge_card',
      createdAt: '2026-06-16T09:10:00+08:00',
    },
    {
      id: 'demo-exec-review',
      nodeId: 'demo-foundation-card',
      activityKind: 'continued-interaction',
      status: 'completed',
      resourceType: 'knowledge_card',
      createdAt: '2026-06-16T09:24:00+08:00',
    },
    {
      id: 'demo-exec-external',
      nodeId: 'demo-simulation',
      activityKind: 'external-resource-reference',
      status: 'referenced',
      resourceType: 'external_resource',
      createdAt: '2026-06-16T09:32:00+08:00',
    },
  ],
  deviations: [
    {
      id: 'demo-deviation-skip',
      deviationType: 'skip',
      targetNodeId: 'demo-simulation',
      createdAt: '2026-06-16T09:36:00+08:00',
    },
  ],
  interventions: [
    {
      id: 'demo-konling-adjustment',
      targetNodeId: 'demo-current-quiz',
      createdAt: '2026-06-16T09:40:00+08:00',
    },
  ],
} satisfies LearningPathRoundView;

const learnerDataShell = buildLearnerDataRouteShell('/assessment/adaptive-practice');

const adaptivePathResourceIcons: Record<AdaptivePathResourceKind, LucideIcon> = {
  interactive_lesson: BookOpenCheck,
  knowledge_card: BrainCircuit,
  adaptive_quiz: ListChecks,
  control_workbench: Compass,
  simulation: GitBranch,
  arena_task: Trophy,
  external_resource: ExternalLink,
  reflection: History,
  checkpoint: Flag,
  konling: MessageSquare,
};

const generationGoalOptions: Array<{ id: AdaptivePracticeGoalId; label: string; detail: string }> = [
  {
    id: 'control-correction',
    label: '控制系统校正设计',
    detail: '面向时域指标、根轨迹设计、仿真验证和 Arena 迁移。',
  },
  {
    id: 'frequency-response-foundations',
    label: '频率响应基础',
    detail: '面向 Bode 图、频域稳定性和基础练习。',
  },
];

const generationResourceOptions: Array<{ id: AdaptivePathResourceKind; label: string }> = [
  { id: 'knowledge_card', label: '知识卡' },
  { id: 'adaptive_quiz', label: '练习' },
  { id: 'control_workbench', label: '控制工作台' },
  { id: 'simulation', label: '仿真' },
  { id: 'arena_task', label: 'Arena' },
  { id: 'external_resource', label: '外部资源' },
  { id: 'konling', label: '控灵辅导' },
];

const defaultPathGenerationPanel: PathGenerationPanelState = {
  goalId: 'control-correction',
  timeBudgetMinutes: 90,
  difficultyRhythm: 'steady',
  resourcePreference: ['knowledge_card', 'adaptive_quiz', 'simulation'],
  checkpointPreference: 'standard',
  allowExternalResources: false,
  naturalLanguageIntent: '',
};

function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

function formatConfidence(value: string): string {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return '未知';
}

function formatEvidenceLimitation(value: string): string {
  if (value === 'complete') return '完整';
  if (value === 'partial') return '部分';
  if (value === 'missing') return '缺失';
  return '未知';
}

function formatLearningMinutes(minutes: number): string {
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `约 ${hours} 小时 ${remainder} 分钟` : `约 ${hours} 小时`;
}

function formatCompletedPathLearningTime(pathPlan: AdaptiveLearningPathPlan | null, hasDiagnostic: boolean): string {
  if (!pathPlan) return hasDiagnostic ? '待同步' : '尚未开始';
  const completedNodeIds = new Set(pathPlan.executionStatus?.completedNodeIds ?? []);
  if (completedNodeIds.size === 0) return '尚未开始';
  const completedMinutes = pathPlan.mainPath.reduce((total, node) => {
    if (!completedNodeIds.has(node.nodeId)) return total;
    return total + Math.max(0, node.estimatedTimeMinutes ?? 0);
  }, 0);
  if (completedMinutes <= 0) return `已完成 ${completedNodeIds.size} 个节点`;
  return formatLearningMinutes(completedMinutes);
}

function resolveDemoScene(sceneParam: string | null): DemoScene {
  return sceneParam === 'generate' ? 'generate' : 'stable';
}

function resolveControlCorrectionIntent(intentParam: string | null): ControlCorrectionCenterRouteIntent {
  if (
    intentParam === 'learner-state-review' ||
    intentParam === 'path-execution' ||
    intentParam === 'evidence-review' ||
    intentParam === 'contextual-recommendation'
  ) {
    return intentParam;
  }
  return 'practice';
}

type AdaptivePracticeGoalId = 'control-correction' | 'frequency-response-foundations';

function isAdaptivePracticeGoalId(value: string | null): value is AdaptivePracticeGoalId {
  return value === 'control-correction' || value === 'frequency-response-foundations';
}

function adaptivePracticeGoalLabel(goalId: AdaptivePracticeGoalId): string {
  if (goalId === 'frequency-response-foundations') return '频率响应基础';
  return '控制校正';
}

function resolveAdaptivePracticeGoalId(
  value: string | null | undefined,
  fallback: AdaptivePracticeGoalId = 'control-correction',
): AdaptivePracticeGoalId {
  const candidate = value ?? null;
  return isAdaptivePracticeGoalId(candidate) ? candidate : fallback;
}

function uniquePathIds(pathIds: Array<string | null | undefined>): string[] {
  return Array.from(new Set(pathIds.filter((pathId): pathId is string => Boolean(pathId))));
}

function compactPathNodeTitle(title?: string): string {
  if (!title) return '入门诊断';
  return title.length > 12 ? '入门诊断' : title;
}

function restoreLearningPathPlan(round: LearningPathRoundResponse['path']): AdaptiveLearningPathPlan | null {
  if (!round || !isAdaptivePracticeGoalId(round.goalId)) return null;
  const payload = round.pathPayload ?? {};
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  const alternatives = Array.isArray(payload.alternatives)
    ? payload.alternatives
    : Array.isArray(round.alternativePayload)
      ? round.alternativePayload
      : [];
  const explanations = typeof round.explanationPayload === 'object' && round.explanationPayload
    ? round.explanationPayload
    : payload.explanations;

  return {
    id: round.id,
    userId: round.userId,
    goal: {
      id: round.goalId,
      title: round.title,
      knowledgeTargets: [],
    },
    stage: 'stage-1-rules-graph',
    policyFamily: typeof payload.policyFamily === 'string' ? payload.policyFamily as AdaptiveLearningPathPlan['policyFamily'] : 'rules-plus-graph-search',
    policyMetadata: payload.policyMetadata as AdaptiveLearningPathPlan['policyMetadata'],
    policyBundle: payload.policyBundle as AdaptiveLearningPathPlan['policyBundle'],
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: round.pathStatus === 'active' || round.pathStatus === 'completed' ? 'ready' : 'fallback',
    currentNodeId: round.currentNodeId ?? null,
    mainPath: planNodes as AdaptiveLearningPathPlan['mainPath'],
    alternatives: alternatives as AdaptiveLearningPathPlan['alternatives'],
    score: payload.score as AdaptiveLearningPathPlan['score'],
    confidence: payload.confidence as AdaptiveLearningPathPlan['confidence'] ?? {
      level: 'unknown',
      score: 0,
      sourceCoverage: 0,
    },
    explanations: (explanations as AdaptiveLearningPathPlan['explanations']) ?? {
      selectedReasons: [],
      rejectedAlternatives: [],
      fallbackReasons: [],
    },
    executionStatus: payload.executionStatus as AdaptiveLearningPathPlan['executionStatus'],
    deviations: payload.deviations as AdaptiveLearningPathPlan['deviations'] ?? [],
    corrections: payload.corrections as AdaptiveLearningPathPlan['corrections'] ?? [],
    feedbackEvents: Array.isArray(payload.feedbackEvents)
      ? payload.feedbackEvents as AdaptiveLearningPathPlan['feedbackEvents']
      : Array.isArray(payload.selectionHistory)
        ? payload.selectionHistory.map((item) => {
            const history = getRecord(item);
            return {
              id: typeof history.id === 'string' ? history.id : `selection-history:${Math.random().toString(36).slice(2)}`,
              type: typeof history.type === 'string' ? history.type as AdaptiveLearningPathPlan['feedbackEvents'][number]['type'] : 'selection',
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
          }) as AdaptiveLearningPathPlan['feedbackEvents']
        : [],
    visualization: payload.visualization as AdaptiveLearningPathPlan['visualization'],
  };
}

async function fetchLearningPathRound(
  pathId: string,
  goalId: AdaptivePracticeGoalId,
): Promise<{ round: LearningPathRoundView; plan: AdaptiveLearningPathPlan } | null> {
  const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}`);
  if (!pathResponse.ok) return null;
  const payload = (await pathResponse.json()) as LearningPathRoundResponse;
  const restoredPlan = restoreLearningPathPlan(payload.path ?? null);
  if (payload.path?.goalId !== goalId || !restoredPlan) return null;
  return { round: payload.path, plan: restoredPlan };
}

async function fetchLatestLearningPathRound(
  goalId: AdaptivePracticeGoalId,
): Promise<{ round: LearningPathRoundView; plan: AdaptiveLearningPathPlan } | null> {
  const pathResponse = await fetch(`/api/learning-paths/latest?goal=${encodeURIComponent(goalId)}`);
  if (!pathResponse.ok) return null;
  const payload = (await pathResponse.json()) as LearningPathRoundResponse;
  const restoredPlan = restoreLearningPathPlan(payload.path ?? null);
  if (payload.path?.goalId !== goalId || !restoredPlan) return null;
  return { round: payload.path, plan: restoredPlan };
}

function controlCorrectionAlternativeCount(view: ControlCorrectionLearningCenterView): number {
  const currentPath = view.panels.find((panel) => panel.region === 'current-path');
  const payload = currentPath?.payload;
  if (!payload || typeof payload !== 'object' || !('alternatives' in payload)) return 0;
  return Array.isArray(payload.alternatives) ? payload.alternatives.length : 0;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getNumberRecord(value: unknown): Record<string, number> {
  const record = getRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function getPathOptions(view: ControlCorrectionLearningCenterView | null): PathOptionView[] {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const pathOptions = Array.isArray(payload.pathOptions) ? payload.pathOptions : [];
  return pathOptions.map((item) => {
    const option = getRecord(item);
    const effort = getRecord(option.effort);
    const terminalValidationStrategy = getRecord(option.terminalValidationStrategy);
    return {
      optionId: typeof option.optionId === 'string' ? option.optionId : 'unknown-option',
      label: typeof option.label === 'string' ? option.label : '未命名路径',
      targetDeficits: Array.isArray(option.targetDeficits)
        ? option.targetDeficits.map(getRecord)
        : [],
      evidenceBasis: getStringArray(option.evidenceBasis),
      resourceMix: getNumberRecord(option.resourceMix),
      effort: {
        estimatedMinutes: typeof effort.estimatedMinutes === 'number' ? effort.estimatedMinutes : undefined,
        relative: typeof effort.relative === 'string' ? effort.relative : undefined,
      },
      terminalValidationNodeIds: getStringArray(option.terminalValidationNodeIds),
      terminalValidationStrategy: {
        summary: typeof terminalValidationStrategy.summary === 'string' ? terminalValidationStrategy.summary : undefined,
      },
      limitations: getStringArray(option.limitations),
    };
  });
}

function getPathSelectionHistory(view: ControlCorrectionLearningCenterView | null): PathSelectionHistoryView[] {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const selectionHistory = Array.isArray(payload.selectionHistory) ? payload.selectionHistory : [];
  return selectionHistory.map((item) => {
    const history = getRecord(item);
    return {
      type: typeof history.type === 'string' ? history.type : 'unknown',
      createdAt: typeof history.createdAt === 'string' ? history.createdAt : undefined,
      selectedStyleId: typeof history.selectedStyleId === 'string' ? history.selectedStyleId : null,
      selectedOptionLabel: typeof history.selectedOptionLabel === 'string' ? history.selectedOptionLabel : null,
      previousStyleId: typeof history.previousStyleId === 'string' ? history.previousStyleId : null,
      previousOptionLabel: typeof history.previousOptionLabel === 'string' ? history.previousOptionLabel : null,
      rejectedStyleIds: getStringArray(history.rejectedStyleIds),
      rejectedOptionLabels: getStringArray(history.rejectedOptionLabels),
      helpful: typeof history.helpful === 'boolean' ? history.helpful : null,
    };
  });
}

function getPathOptionFallback(view: ControlCorrectionLearningCenterView | null): Record<string, unknown> | null {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const fallback = getRecord(payload.pathOptionFallback);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

const SKIP_WARNING_TEXT = '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。';

function formatResourceType(type: string): string {
  if (type === 'interactive_lesson' || type === 'interactive-lesson') return '互动课程';
  if (type === 'knowledge_card' || type === 'knowledge-node') return '知识卡';
  if (type === 'adaptive_quiz' || type === 'quiz') return '自适应练习';
  if (type === 'control_workbench') return '控制工作台';
  if (type === 'simulation') return '虚拟仿真';
  if (type === 'arena_task') return 'Arena';
  if (type === 'external_resource') return '外部资源';
  if (type === 'konling' || type === 'ai_intervention' || type === 'intervention') return '控灵建议';
  if (type === 'checkpoint') return '检查点';
  return '学习资源';
}

function resourceGlyph(type: string): string {
  if (type === 'interactive_lesson' || type === 'interactive-lesson') return '互';
  if (type === 'knowledge_card' || type === 'knowledge-node') return '知';
  if (type === 'adaptive_quiz' || type === 'quiz') return '练';
  if (type === 'control_workbench') return '控';
  if (type === 'simulation') return '仿';
  if (type === 'arena_task') return '赛';
  if (type === 'external_resource') return '外';
  if (type === 'konling' || type === 'ai_intervention' || type === 'intervention') return '灵';
  if (type === 'checkpoint') return '检';
  return '学';
}

function formatPathNodeReason(reasonCodes: string[]): string {
  const labels: Record<string, string> = {
    'matches-knowledge-deficit': '针对当前薄弱知识点安排。',
    'matches-competency-deficit': '针对当前能力短板安排。',
    'matches-resource-preference': '符合当前资源偏好。',
    'low-mastery-target': '用于补强掌握度较低的知识点。',
    'preference-matched': '符合当前学习偏好和资源选择。',
    'checkpoint-required': '用于形成下一段路径所需的检查证据。',
    'terminal-validation-required': '用于完成路径终端验证。',
    'risk-intervention-fit': '适合用于处理当前学习风险。',
    'policy-simulation-driven': '优先通过仿真验证理解。',
  };
  const studentReasons = reasonCodes
    .map((reason) => labels[reason] ?? (/[^\x00-\x7F]/.test(reason) ? reason : null))
    .filter((reason): reason is string => Boolean(reason));
  return studentReasons.length > 0
    ? studentReasons.join('、')
    : '这一步用于衔接当前目标和后续检查节点。';
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '待估算';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function getEstimatedMinutes(node: Record<string, unknown>): number {
  const value = node.estimatedTimeMinutes ?? node.estimatedMinutes ?? node.durationMinutes;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getPathExecutionNodes(plan: AdaptiveLearningPathPlan | null, round: LearningPathRoundView | null): PathExecutionNodeView[] {
  if (!plan) return [];
  const metadata = getRecord(round?.lastExecutionMetadata);
  const completedNodeIds = new Set(getStringArray(metadata.completedNodeIds));
  const failedNodeIds = new Set(getStringArray(metadata.failedNodeIds));
  const skippedNodeIds = new Set((round?.deviations ?? [])
    .filter((item) => getRecord(item).deviationType === 'skip')
    .map((item) => getRecord(item).targetNodeId)
    .filter((value): value is string => typeof value === 'string'));
  const currentNodeId = plan.currentNodeId ?? round?.currentNodeId ?? null;

  const nodes = plan.mainPath.map((item, index) => {
    const node = getRecord(item);
    const nodeId = typeof node.nodeId === 'string' ? node.nodeId : `path-node-${index + 1}`;
    const type = typeof node.type === 'string' ? node.type : typeof node.sourceKind === 'string' ? node.sourceKind : 'resource';
    const rawStatus = typeof node.status === 'string' ? node.status : 'optional';
    const readiness = getRecord(node.readiness);
    const readinessState = typeof readiness.state === 'string' ? readiness.state : 'ready';
    const unlockMessage = typeof readiness.unlockMessage === 'string'
      ? readiness.unlockMessage
      : typeof readiness.message === 'string' && readinessState !== 'ready'
        ? readiness.message
        : undefined;
    const status: PathExecutionNodeView['status'] = completedNodeIds.has(nodeId) || rawStatus === 'completed'
      ? 'completed'
      : failedNodeIds.has(nodeId) || rawStatus === 'blocked'
        ? 'blocked'
        : rawStatus === 'locked' || readinessState === 'locked' || readinessState === 'evidence-needed' || readinessState === 'needs-preparation'
          ? 'locked'
          : currentNodeId === nodeId || rawStatus === 'current'
            ? 'current'
            : skippedNodeIds.has(nodeId)
              ? 'skipped'
              : rawStatus === 'next'
                ? 'next'
                : 'optional';
    const knowledgeCoverage = getStringArray(node.knowledgeCoverage);
    const reasonCodes = getStringArray(node.reasonCodes);
    const viewNode: PathExecutionNodeView = {
      nodeId,
      title: typeof node.title === 'string' ? node.title : `学习节点 ${index + 1}`,
      type,
      resourceLabel: formatResourceType(type),
      status,
      target: typeof node.target === 'string' ? node.target : '/assessment/adaptive-practice',
      estimatedMinutes: getEstimatedMinutes(node),
      reason: formatPathNodeReason(reasonCodes),
      evidence: knowledgeCoverage.length > 0 ? knowledgeCoverage.join('、') : `${formatResourceType(type)}完成记录`,
      checkpoint: type === 'checkpoint' || type === 'arena_task' || type === 'simulation'
        ? '完成后用于判断是否进入下一段路径。'
        : '完成学习动作并留下可复核记录。',
      unlockMessage,
    };
    return status === 'locked' && unlockMessage
      ? { ...viewNode, reason: unlockMessage, checkpoint: unlockMessage }
      : viewNode;
  });
  if (nodes.some((node) => node.status === 'current')) return nodes;
  const currentIndex = currentNodeId ? nodes.findIndex((node) => node.nodeId === currentNodeId) : -1;
  const promotedCurrentNode = findNextPromotableExecutionNode(nodes, currentIndex);
  return promotedCurrentNode
    ? nodes.map((node) => node.nodeId === promotedCurrentNode.nodeId ? { ...node, status: 'current' } : node)
    : nodes;
}

function findNextPromotableExecutionNode(
  nodes: PathExecutionNodeView[],
  currentIndex: number,
): PathExecutionNodeView | null {
  for (const node of nodes.slice(currentIndex + 1)) {
    if (node.status === 'completed' || node.status === 'skipped') continue;
    if (node.status === 'locked' || node.status === 'blocked') return null;
    if (node.status === 'next' || node.status === 'optional') return node;
  }
  return null;
}

function getPathExecutionSummary(nodes: PathExecutionNodeView[], round: LearningPathRoundView | null) {
  const completed = nodes.filter((node) => node.status === 'completed').length;
  const totalMinutes = nodes.reduce((sum, node) => sum + node.estimatedMinutes, 0);
  const elapsedMinutes = nodes.filter((node) => node.status === 'completed').reduce((sum, node) => sum + node.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
  const terminalState = getRecord(round?.terminalValidation).state;
  return {
    elapsed: formatMinutes(elapsedMinutes),
    remaining: formatMinutes(remainingMinutes),
    total: formatMinutes(totalMinutes),
    completed: `${completed}/${nodes.length}`,
    checkpointPass: terminalState === 'completed' ? '100%' : terminalState === 'failed' || terminalState === 'low-confidence' ? '0%' : '待产生',
    weekly: `${completed} 个节点`,
  };
}

function readTimelineTime(value: unknown): { label: string; sortTime: number } {
  if (typeof value !== 'string' && !(value instanceof Date)) return { label: '时间待记录', sortTime: Number.POSITIVE_INFINITY };
  const date = value instanceof Date ? value : new Date(value);
  const sortTime = date.getTime();
  if (Number.isNaN(sortTime)) return { label: '时间待记录', sortTime: Number.POSITIVE_INFINITY };
  return { label: date.toLocaleString('zh-CN', { hour12: false }), sortTime };
}

function getPathActivityStateLabel(
  activityKind: string,
  status: string,
  resourceType: string,
): PathActivityTimelineItem['stateLabel'] {
  if (activityKind === 'checkpoint-fail' || status === 'failed' || status === 'low-confidence') {
    return '待复核';
  }
  if (resourceType === 'external_resource' || activityKind === 'external-resource-reference') {
    return '仅作参考';
  }
  if (activityKind === 'continued-interaction' || activityKind === 'return-to-skipped' || status === 'completed') {
    return '可用于推荐';
  }
  return '已记录';
}

function getPathActivityTitle(activityKind: string): string {
  if (activityKind === 'review') return '回顾内容';
  if (activityKind === 'continued-interaction') return '已完成节点继续互动';
  if (activityKind === 'return-to-skipped') return '返回跳过资源';
  if (activityKind === 'external-resource-reference') return '外部资源引用';
  if (activityKind === 'checkpoint-fail') return '检查点未通过';
  if (activityKind === 'konling-support') return '控灵干预';
  return '完成节点';
}

function getPathActivityTimeline(nodes: PathExecutionNodeView[], round: LearningPathRoundView | null): PathActivityTimelineItem[] {
  const nodeTitle = new Map(nodes.map((node) => [node.nodeId, node.title]));
  const items: PathActivityTimelineItem[] = [];
  for (const execution of round?.executions ?? []) {
    const record = getRecord(execution);
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : '';
    const activityKind = typeof record.activityKind === 'string' ? record.activityKind : typeof record.status === 'string' ? record.status : 'started';
    const status = typeof record.status === 'string' ? record.status : 'started';
    const resourceType = typeof record.resourceType === 'string' ? record.resourceType : 'resource';
    const timelineTime = readTimelineTime(record.createdAt ?? record.completedAt ?? record.startedAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `execution:${items.length}`,
      nodeId,
      type: activityKind,
      title: getPathActivityTitle(activityKind),
      detail: activityKind === 'review' ? '回顾不会重复计算完成进度。' : '节点活动已进入学习路径记录。',
      nodeTitle: nodeTitle.get(nodeId) ?? nodeId,
      sourceLabel: formatResourceType(resourceType),
      stateLabel: getPathActivityStateLabel(activityKind, status, resourceType),
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  for (const deviation of round?.deviations ?? []) {
    const record = getRecord(deviation);
    const targetNodeId = typeof record.targetNodeId === 'string' ? record.targetNodeId : '';
    const timelineTime = readTimelineTime(record.createdAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `deviation:${items.length}`,
      nodeId: targetNodeId,
      type: 'skip',
      title: '跳过未完成资源',
      detail: '该资源不会计入完成进度，已记录为路径偏离。',
      nodeTitle: nodeTitle.get(targetNodeId) ?? targetNodeId,
      sourceLabel: '学习路径',
      stateLabel: '待复核',
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  for (const intervention of round?.interventions ?? []) {
    const record = getRecord(intervention);
    const targetNodeId = typeof record.targetNodeId === 'string' ? record.targetNodeId : typeof record.nodeId === 'string' ? record.nodeId : '';
    const timelineTime = readTimelineTime(record.createdAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `intervention:${items.length}`,
      nodeId: targetNodeId,
      type: 'konling-support',
      title: '控灵干预',
      detail: '控灵建议已作为路径调整参考记录。',
      nodeTitle: nodeTitle.get(targetNodeId) ?? targetNodeId,
      sourceLabel: '控灵建议',
      stateLabel: '可用于推荐',
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  return items.sort((left, right) => left.sortTime - right.sortTime);
}

function buildEvidenceSourceSummary(nodes: PathExecutionNodeView[]): Array<{ label: string; count: number }> {
  const labels = ['互动课程', '知识卡', '自适应练习', '控制工作台', '虚拟仿真', 'Arena', '外部资源', '控灵建议'];
  const counts = new Map(labels.map((label) => [label, 0]));
  for (const node of nodes) if (counts.has(node.resourceLabel)) counts.set(node.resourceLabel, (counts.get(node.resourceLabel) ?? 0) + 1);
  return labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

function pathNodeContextHref(node: PathExecutionNodeView, options: {
  goalId: AdaptivePracticeGoalId;
  pathId?: string | null;
}): string {
  const href = node.target || '/assessment/adaptive-practice';
  if (/^https?:\/\//.test(href)) return href;
  const separator = href.includes('?') ? '&' : '?';
  const { goalId, pathId } = options;
  const params = new URLSearchParams({ goal: goalId, intent: 'path-execution', nodeId: node.nodeId });
  if (pathId) params.set('pathId', pathId);
  return `${href}${separator}${params.toString()}`;
}

function formatPathHistoryType(type: string): string {
  if (type === 'selection') return '选择';
  if (type === 'rejection') return '拒绝';
  if (type === 'switch') return '切换';
  if (type === 'helpfulness') return '有用性反馈';
  return type;
}

function buildChoiceBody(
  action: 'selection' | 'rejection' | 'switch' | 'helpfulness',
  option: PathOptionView,
  allOptions: PathOptionView[],
  selectedHistory: PathSelectionHistoryView[],
  helpful?: boolean,
) {
  const latestSelection = [...selectedHistory].reverse().find((item) => item.selectedStyleId);
  const rejectedOptionIds = action === 'helpfulness'
    ? []
    : action === 'selection' || action === 'switch'
      ? allOptions.filter((item) => item.optionId !== option.optionId).map((item) => item.optionId)
      : [option.optionId];
  return {
    action,
    selectedOptionId: action === 'rejection' ? null : option.optionId,
    previousStyleId: action === 'switch' ? latestSelection?.selectedStyleId ?? null : null,
    rejectedOptionIds,
    resourceMix: option.resourceMix,
    helpful: action === 'helpfulness' ? helpful ?? true : null,
    rationaleMetadata: {
      targetDeficits: option.targetDeficits,
      evidenceBasis: option.evidenceBasis,
      terminalValidationStrategy: option.terminalValidationStrategy,
      limitations: option.limitations,
    },
    idempotencyKey: `path-choice:${action}:${option.optionId}:${Date.now()}`,
  };
}

export default function AdaptivePracticePage() {
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();
  const isDemoMode = searchParams.get('demo') === '1';
  const demoScene = resolveDemoScene(searchParams.get('scene'));
  const activePracticeFocus = searchParams.get('focus');
  const requestedGoal = searchParams.get('goal');
  const activeGoal = isAdaptivePracticeGoalId(requestedGoal) ? requestedGoal : null;
  const activeGoalLabel = activeGoal ? adaptivePracticeGoalLabel(activeGoal) : '自适应学习';
  const activePathAdvisorGoal = activeGoal;
  const routeIntent = resolveControlCorrectionIntent(searchParams.get('intent'));
  const activePathId = searchParams.get('pathId');
  const activeNodeId = searchParams.get('nodeId');
  const activeGoalQuery = activeGoal ? new URLSearchParams({ goal: activeGoal, intent: routeIntent }) : null;
  if (activeGoalQuery && activePathId) activeGoalQuery.set('pathId', activePathId);
  if (activeGoalQuery && activeNodeId) activeGoalQuery.set('nodeId', activeNodeId);
  const activeGoalContextHref = activeGoal
    ? `/assessment/adaptive-practice?${activeGoalQuery?.toString() ?? ''}`
    : '/assessment/adaptive-practice';
  const controlCorrectionQuery = new URLSearchParams({ goal: 'control-correction', intent: routeIntent });
  if (activePathId) controlCorrectionQuery.set('pathId', activePathId);
  if (activeNodeId) controlCorrectionQuery.set('nodeId', activeNodeId);
  const controlCorrectionContextHref = `/assessment/adaptive-practice?${controlCorrectionQuery.toString()}`;
  const controlCorrectionGenerationHref = '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation';
  const frequencyResponseGenerationHref = '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=contextual-recommendation';
  const genericPathGenerationHref = '#adaptive-path-generation-goals';
  const loginHref = `/login?callbackUrl=${encodeURIComponent(activeGoalContextHref)}`;
  const entryIntents = getCommercialStudentEntryIntentGroups();
  const { assistantEntryPoint, openAssistantEntryPoint, updatePageContext } = useGlobalAI();

  const sessionId = useMemo(() => `practice-${Math.random().toString(36).slice(2, 10)}`, []);

  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [questionState, setQuestionState] = useState<NextQuestionResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionStartAt, setQuestionStartAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [controlCorrectionLearnerState, setControlCorrectionLearnerState] = useState<AdaptiveLearnerState | null>(null);
  const [controlCorrectionPathPlan, setControlCorrectionPathPlan] = useState<AdaptiveLearningPathPlan | null>(null);
  const [controlCorrectionPathRound, setControlCorrectionPathRound] = useState<LearningPathRoundView | null>(null);
  const [pathChoicePending, setPathChoicePending] = useState<string | null>(null);
  const [pathChoiceMessage, setPathChoiceMessage] = useState<string | null>(null);
  const [pathGenerationPanel, setPathGenerationPanel] = useState<PathGenerationPanelState>({
    ...defaultPathGenerationPanel,
    goalId: activeGoal ?? defaultPathGenerationPanel.goalId,
  });
  const [pathGenerationPending, setPathGenerationPending] = useState<PathGenerationOperation | null>(null);
  const [pathAdvisorAgentSessionId, setPathAdvisorAgentSessionId] = useState<string | null>(null);
  const [pathNodeCompletionPending, setPathNodeCompletionPending] = useState<string | null>(null);
  const [skipCandidateNode, setSkipCandidateNode] = useState<PathExecutionNodeView | null>(null);
  const [pathActivityPending, setPathActivityPending] = useState<string | null>(null);
  const [selectedPathNodeId, setSelectedPathNodeId] = useState<string | null>(activeNodeId);
  const [practiceQuestionExpanded, setPracticeQuestionExpanded] = useState(activePracticeFocus === 'question');
  const practiceRouteNodes = useMemo(() => buildPracticeEntryRouteNodes({
    recommendedFocus: diagnostic?.recommendedFocus ?? [],
    weakAreas: diagnostic?.weakAreas ?? [],
    estimatedAbility: questionState?.estimatedAbility,
    confidenceInterval: questionState?.confidenceInterval,
    actionHref: activeGoalContextHref,
  }), [activeGoalContextHref, diagnostic, questionState]);
  const controlCorrectionCenter = useMemo(() => activeGoal
    ? buildControlCorrectionLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        goalId: activeGoal,
        goalLabel: activeGoalLabel,
        learnerState: controlCorrectionLearnerState,
        pathPlan: controlCorrectionPathPlan,
        routeIntent,
        entrySource: routeIntent === 'contextual-recommendation' ? 'contextual-recommendation' : 'adaptive-practice',
        networkError: Boolean(error) && !controlCorrectionLearnerState && !controlCorrectionPathPlan,
        questionAvailable: Boolean(questionState),
      })
    : null, [activeGoal, activeGoalLabel, controlCorrectionLearnerState, controlCorrectionPathPlan, error, questionState, routeIntent]);
  const pathOptions = useMemo(() => getPathOptions(controlCorrectionCenter), [controlCorrectionCenter]);
  const visiblePathOptions = useMemo(() => buildAdaptivePathOptionDisplays(pathOptions), [pathOptions]);
  const pathSelectionHistory = useMemo(() => getPathSelectionHistory(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathOptionFallback = useMemo(() => getPathOptionFallback(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathExecutionNodes = useMemo(
    () => getPathExecutionNodes(controlCorrectionPathPlan, controlCorrectionPathRound),
    [controlCorrectionPathPlan, controlCorrectionPathRound],
  );
  useEffect(() => {
    if (activeNodeId) setSelectedPathNodeId(activeNodeId);
  }, [activeNodeId]);
  useEffect(() => {
    if (pathExecutionNodes.length === 0) {
      setSelectedPathNodeId(null);
      return;
    }
    setSelectedPathNodeId((current) => (
      current && pathExecutionNodes.some((node) => node.nodeId === current)
        ? current
        : pathExecutionNodes.find((node) => node.status === 'current')?.nodeId ?? pathExecutionNodes[0]?.nodeId ?? null
    ));
  }, [pathExecutionNodes]);
  const currentPathNode = useMemo(() => (
    pathExecutionNodes.find((node) => node.status === 'current') ?? null
  ), [pathExecutionNodes]);
  const focusedPathNode = useMemo(() => (
    pathExecutionNodes.find((node) => node.nodeId === selectedPathNodeId) ??
    pathExecutionNodes.find((node) => node.status === 'current') ??
    pathExecutionNodes[0] ??
    null
  ), [pathExecutionNodes, selectedPathNodeId]);
  const pathExecutionSummary = useMemo(
    () => getPathExecutionSummary(pathExecutionNodes, controlCorrectionPathRound),
    [controlCorrectionPathRound, pathExecutionNodes],
  );
  const pathActivityTimeline = useMemo(
    () => getPathActivityTimeline(pathExecutionNodes, controlCorrectionPathRound),
    [controlCorrectionPathRound, pathExecutionNodes],
  );
  const evidenceSourceSummary = useMemo(
    () => buildEvidenceSourceSummary(pathExecutionNodes),
    [pathExecutionNodes],
  );
  useEffect(() => {
    if (!activeGoal) return;
    setPathGenerationPanel((current) => ({ ...current, goalId: activeGoal }));
  }, [activeGoal]);

  const setPathChoiceUnavailable = useCallback(() => {
    setPathChoiceMessage('请先登录并生成路径后再记录选择。');
  }, []);

  const openPathGenerationAdvisor = useCallback(() => {
    if (!assistantEntryPoint || assistantEntryPoint.mode !== 'path-advisor') return;
    openAssistantEntryPoint(assistantEntryPoint);
  }, [assistantEntryPoint, openAssistantEntryPoint]);

  useEffect(() => {
    if (!activeGoal || isDemoMode) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }

    if (authStatus === 'loading') return;

    if (authStatus !== 'authenticated') {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }

    const pathAdvisorGoal = activeGoal;
    let cancelled = false;
    async function registerPathAdvisorEntryPoint() {
      try {
        const response = await fetch(`/api/adaptive/path-advisor-context?goal=${encodeURIComponent(pathAdvisorGoal)}`);
        if (!response.ok) {
          if (!cancelled) updatePageContext({ assistantEntryPoint: null });
          return;
        }
        const payload = (await response.json()) as PathAdvisorContextResponse;
        if (cancelled) return;
        updatePageContext({
          pageType: 'practice',
          stepId: 'adaptive-path-center',
          knowledgeType: 'C',
          url: '/assessment/adaptive-practice',
          courseId: payload.goalId,
          courseTitle: payload.courseTitle,
          topic: payload.topic,
          learningObjectives: payload.learningObjectives,
          quickQuestions: [
            {
              label: '生成路径',
              question: `请为我生成一组${payload.courseTitle}学习路径，优先给出 2 到 3 条可比较方案。`,
            },
            {
              label: '按时间调整',
              question: `我希望在 90 分钟内完成${payload.courseTitle}的关键补强，请调整学习路径。`,
            },
          ],
          assistantEntryPoint: {
            mode: 'path-advisor',
            promptContext: `student-path-center:${payload.goalId}:adaptive-path-center`,
            serverContext: {
              classId: payload.classId,
              courseId: payload.goalId,
              goalId: payload.goalId,
              pageId: 'adaptive-path-center',
              modeContextToken: payload.modeContextToken,
            },
          },
        });
      } catch {
        if (!cancelled) updatePageContext({ assistantEntryPoint: null });
      }
    }

    void registerPathAdvisorEntryPoint();
    return () => {
      cancelled = true;
      updatePageContext({ assistantEntryPoint: null });
    };
  }, [activeGoal, authStatus, isDemoMode, updatePageContext]);

  const applyDemoScene = useCallback((scene: DemoScene) => {
    const demoData = DEMO_SCENES[scene];
    setDiagnostic(demoData.diagnostic);
    setQuestionState(demoData.questionState);
    setSelectedOption(demoData.defaultSelectedOption);
    setFeedback(demoData.feedback);
    setControlCorrectionPathPlan(activeGoal === 'control-correction' ? DEMO_CONTROL_CORRECTION_PATH_PLAN : null);
    setControlCorrectionPathRound(activeGoal === 'control-correction' ? DEMO_CONTROL_CORRECTION_PATH_ROUND : null);
    setQuestionStartAt(Date.now());
    setLoading(false);
    setError(null);
  }, [activeGoal]);

  const loadDiagnostic = useCallback(async () => {
    const response = await fetch('/api/assessment/diagnostic');
    if (!response.ok) {
      throw new Error('诊断加载失败');
    }
    const data = (await response.json()) as DiagnosticResponse;
    setDiagnostic(data);
  }, []);

  const loadNextQuestion = useCallback(async () => {
    if (isDemoMode) {
      const nextScene: DemoScene = demoScene === 'stable' ? 'generate' : 'stable';
      applyDemoScene(nextScene);
      return;
    }

    const response = await fetch('/api/assessment/next-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        goalId: activeGoal,
        routeIntent: activeGoal ? routeIntent : null,
        pathId: activePathId,
        nodeId: activeNodeId,
      }),
    });

    if (!response.ok) {
      throw new Error('下一题加载失败');
    }

    const data = (await response.json()) as NextQuestionResponse;
    setQuestionState(data);
    setSelectedOption('');
    setFeedback(null);
    setQuestionStartAt(Date.now());
  }, [activeGoal, activeNodeId, activePathId, applyDemoScene, demoScene, isDemoMode, routeIntent, sessionId]);

  const bootstrapPractice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadDiagnostic(), loadNextQuestion()]);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  }, [loadDiagnostic, loadNextQuestion]);

  useEffect(() => {
    if (!activeGoal || isDemoMode) {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathPlan(null);
      setControlCorrectionPathRound(null);
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathPlan(null);
      setControlCorrectionPathRound(null);
      return;
    }

    const goalToLoad = activeGoal;
    let cancelled = false;
    async function loadControlCorrectionCenterData() {
      let learnerState: AdaptiveLearnerState | null = null;
      try {
        const learnerResponse = await fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(goalToLoad)}`);
        if (!cancelled && learnerResponse.ok) {
          learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
          setControlCorrectionLearnerState(learnerState);
        } else if (!cancelled) {
          setControlCorrectionLearnerState(null);
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionLearnerState(null);
        }
      }

      const fallbackPathIds = goalToLoad === 'control-correction'
        ? [learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null]
        : learnerState?.pathContext.recentPathIds ?? [];
      const pathIdsToTry = uniquePathIds([activePathId, ...fallbackPathIds]);
      let loadedMatchingPath = false;
      for (const pathIdToLoad of pathIdsToTry) {
        if (cancelled) return;
        try {
          const loaded = await fetchLearningPathRound(pathIdToLoad, goalToLoad);
          if (!cancelled && loaded) {
            setControlCorrectionPathRound(loaded.round);
            setControlCorrectionPathPlan(loaded.plan);
            loadedMatchingPath = true;
            break;
          }
        } catch {
          // Try the next recent path before falling back to an empty center.
        }
      }
      if (!loadedMatchingPath && !activePathId && !cancelled) {
        try {
          const latest = await fetchLatestLearningPathRound(goalToLoad);
          if (!cancelled && latest) {
            setControlCorrectionPathRound(latest.round);
            setControlCorrectionPathPlan(latest.plan);
            loadedMatchingPath = true;
          }
        } catch {
          // Keep the center in cold-start mode when no latest path is available.
        }
      }
      if (!loadedMatchingPath && !cancelled) {
        setControlCorrectionPathPlan(null);
        setControlCorrectionPathRound(null);
      }
    }

    void loadControlCorrectionCenterData();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, activeGoalLabel, activePathId, authStatus, isDemoMode]);

  const reloadControlCorrectionPath = useCallback(async () => {
    const pathIdToLoad = controlCorrectionPathRound?.id ?? activePathId ?? controlCorrectionLearnerState?.pathContext.activeControlCorrectionPath.pathId;
    if (!pathIdToLoad) return;
    const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
    if (!pathResponse.ok) {
      throw new Error('路径状态刷新失败');
    }
    const payload = (await pathResponse.json()) as LearningPathRoundResponse;
    setControlCorrectionPathRound(payload.path ?? null);
    setControlCorrectionPathPlan(restoreLearningPathPlan(payload.path ?? null));
  }, [activePathId, controlCorrectionLearnerState, controlCorrectionPathRound]);

  const refreshLatestLearningPathAfterKonling = useCallback(async () => {
    if (!activeGoal || isDemoMode || authStatus !== 'authenticated') return;

    let learnerState: AdaptiveLearnerState | null = null;
    try {
      const learnerResponse = await fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(activeGoal)}`);
      if (learnerResponse.ok) {
        learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
        setControlCorrectionLearnerState(learnerState);
      }
    } catch {
      learnerState = null;
    }

    if (activePathId) {
      try {
        const loaded = await fetchLearningPathRound(activePathId, activeGoal);
        if (loaded) {
          setControlCorrectionPathRound(loaded.round);
          setControlCorrectionPathPlan(loaded.plan);
        }
      } catch {
        // Keep the explicit URL path stable instead of switching to latest.
      }
      return;
    }

    try {
      const latest = await fetchLatestLearningPathRound(activeGoal);
      if (latest) {
        setControlCorrectionPathRound(latest.round);
        setControlCorrectionPathPlan(latest.plan);
        setPathChoiceMessage('学习路径已生成，请选择一个方案开始执行。');
        return;
      }
    } catch {
      // Fall back to learner-state hints when the latest path is not readable yet.
    }

    const fallbackPathIds = activeGoal === 'control-correction'
      ? [learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null]
      : learnerState?.pathContext.recentPathIds ?? [];
    const pathIdsToTry = uniquePathIds(fallbackPathIds);
    for (const pathIdToLoad of pathIdsToTry) {
      try {
        const loaded = await fetchLearningPathRound(pathIdToLoad, activeGoal);
        if (loaded) {
          setControlCorrectionPathRound(loaded.round);
          setControlCorrectionPathPlan(loaded.plan);
          setPathChoiceMessage('学习路径已生成，请选择一个方案开始执行。');
          return;
        }
      } catch {
        // Try the next path id.
      }
    }
  }, [activeGoal, activePathId, authStatus, isDemoMode]);

  useEffect(() => {
    const handleAdaptivePathUpdated = () => {
      void refreshLatestLearningPathAfterKonling();
    };
    window.addEventListener('konling:adaptive-path-updated', handleAdaptivePathUpdated);
    return () => window.removeEventListener('konling:adaptive-path-updated', handleAdaptivePathUpdated);
  }, [refreshLatestLearningPathAfterKonling]);

  const toggleGenerationResource = useCallback((resource: AdaptivePathResourceKind) => {
    setPathGenerationPanel((current) => {
      const selected = current.resourcePreference.includes(resource);
      return {
        ...current,
        resourcePreference: selected
          ? current.resourcePreference.filter((item) => item !== resource)
          : [...current.resourcePreference, resource],
      };
    });
  }, []);

  const submitPathGeneration = useCallback(async (
    operation: PathGenerationOperation,
    option?: PathOptionView,
  ) => {
    if (authStatus !== 'authenticated') {
      setPathChoiceMessage('请先登录后再生成学习路径。');
      return;
    }
    if (!activeGoal || pathGenerationPanel.goalId !== activeGoal) {
      setPathChoiceMessage('请先进入选定目标，再生成路径。');
      window.location.assign(`/assessment/adaptive-practice?goal=${pathGenerationPanel.goalId}&intent=contextual-recommendation`);
      return;
    }
    const modeContextToken = assistantEntryPoint?.mode === 'path-advisor'
      ? assistantEntryPoint.serverContext.modeContextToken
      : null;
    if (!modeContextToken) {
      setPathChoiceMessage('路径生成上下文还在准备，请稍后重试。');
      return;
    }
    const currentPathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id ?? activePathId;
    if (operation !== 'generate' && !currentPathId) {
      setPathChoiceMessage('请先生成路径后再请求调整或解释。');
      return;
    }
    setPathGenerationPending(operation);
    setPathChoiceMessage(null);
    try {
      const response = await fetch('/api/adaptive/path-advisor-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          goalId: pathGenerationPanel.goalId,
          pathId: operation !== 'generate' ? currentPathId : undefined,
          routeIntent,
          timeBudgetMinutes: pathGenerationPanel.timeBudgetMinutes,
          difficultyRhythm: pathGenerationPanel.difficultyRhythm,
          resourcePreference: pathGenerationPanel.resourcePreference,
          checkpointPreference: pathGenerationPanel.checkpointPreference,
          allowExternalResources: pathGenerationPanel.allowExternalResources,
          naturalLanguageIntent: pathGenerationPanel.naturalLanguageIntent,
          excludedNodeIds: operation === 'revise'
            ? pathExecutionNodes
                .filter((node) => node.status === 'skipped' || node.status === 'blocked')
                .map((node) => node.nodeId)
            : [],
          preferredOptionId: operation !== 'generate' ? option?.optionId : undefined,
          requestedAt: new Date().toISOString(),
          modeContextToken,
          agentSessionId: pathAdvisorAgentSessionId ?? undefined,
          priorRequestId: operation === 'revise' ? currentPathId ?? undefined : undefined,
          selectedOptionId: operation !== 'generate' ? option?.optionId : undefined,
          compareWithOptionId: operation === 'explain'
            ? pathOptions.find((item) => item.optionId !== option?.optionId)?.optionId
            : undefined,
          rejectedOptionIds: operation === 'revise'
            ? pathOptions
                .filter((item) => item.optionId !== option?.optionId)
                .map((item) => item.optionId)
            : undefined,
          idempotencyKey: `path-generation-panel:${operation}:${pathGenerationPanel.goalId}:${Date.now()}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '学习路径生成失败');
      }
      if (typeof payload.agentSessionId === 'string') {
        setPathAdvisorAgentSessionId(payload.agentSessionId);
      }
      if (operation !== 'explain') {
        await refreshLatestLearningPathAfterKonling();
        window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated', {
          detail: {
            mode: 'path-advisor',
            courseId: pathGenerationPanel.goalId,
            pageId: 'adaptive-path-center',
            source: 'generation-panel',
          },
        }));
      }
      const rationale = Array.isArray(payload.result?.studentSafeRationale)
        ? payload.result.studentSafeRationale.filter((item: unknown): item is string => typeof item === 'string').join(' ')
        : null;
      setPathChoiceMessage(
        operation === 'explain'
          ? rationale ?? '已生成路径差异说明。'
          : operation === 'revise' ? '路径方案已按新参数调整。' : '学习路径已生成，请比较后选择方案。',
      );
    } catch (generationError) {
      setPathChoiceMessage(generationError instanceof Error ? generationError.message : '学习路径生成失败');
    } finally {
      setPathGenerationPending(null);
    }
  }, [
    activeGoal,
    activePathId,
    assistantEntryPoint,
    authStatus,
    controlCorrectionPathPlan,
    controlCorrectionPathRound,
    pathAdvisorAgentSessionId,
    pathExecutionNodes,
    pathGenerationPanel,
    pathOptions,
    refreshLatestLearningPathAfterKonling,
    routeIntent,
  ]);

  const submitPathChoice = useCallback(async (
    action: 'selection' | 'rejection' | 'switch' | 'helpfulness',
    option: PathOptionView,
    helpful?: boolean,
  ) => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (!pathId) {
      setPathChoiceMessage('当前没有可写入的学习路径。');
      return;
    }
    setPathChoicePending(`${action}:${option.optionId}`);
    setPathChoiceMessage(null);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/choices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChoiceBody(action, option, pathOptions, pathSelectionHistory, helpful)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径选择写入失败');
      }
      await reloadControlCorrectionPath();
      setPathChoiceMessage('路径选择证据已记录。');
    } catch (choiceError) {
      setPathChoiceMessage(choiceError instanceof Error ? choiceError.message : '路径选择写入失败');
    } finally {
      setPathChoicePending(null);
    }
  }, [
    controlCorrectionPathPlan,
    controlCorrectionPathRound,
    pathOptions,
    pathSelectionHistory,
    reloadControlCorrectionPath,
  ]);

  const launchPathNodeAction = useCallback(async (action: PostLearningPathNodeAction) => {
    if (!action.body || !action.redirectHref) return;
    try {
      const response = await fetch(action.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点启动失败');
      }
      window.location.assign(action.redirectHref);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : '路径节点启动失败');
    }
  }, []);

  const launchPathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    if (!isPostLearningPathNodeAction(node.action)) return;
    await launchPathNodeAction(node.action);
  }, [launchPathNodeAction]);

  const launchNextAction = useCallback(async () => {
    const nextAction = controlCorrectionCenter?.nextAction;
    if (!nextAction || !isPostLearningPathNodeAction(nextAction)) return;
    await launchPathNodeAction(nextAction);
  }, [controlCorrectionCenter, launchPathNodeAction]);

  const completePathNodeAction = useCallback(async (
    nodeId: string,
    completionAction?: LearningPathNodeCompletionAction,
  ) => {
    if (!completionAction) return;
    setPathNodeCompletionPending(nodeId);
    try {
      const response = await fetch(completionAction.href, {
        method: completionAction.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionAction.body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点完成确认失败');
      }
      await reloadControlCorrectionPath();
      setError(null);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : '路径节点完成确认失败');
    } finally {
      setPathNodeCompletionPending(null);
    }
  }, [reloadControlCorrectionPath]);

  const completePathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    await completePathNodeAction(node.nodeId, node.action.completionAction);
  }, [completePathNodeAction]);

  const completeNextAction = useCallback(async () => {
    const nextAction = controlCorrectionCenter?.nextAction;
    if (!nextAction?.nodeId) return;
    await completePathNodeAction(nextAction.nodeId, nextAction.completionAction);
  }, [completePathNodeAction, controlCorrectionCenter]);

  const writePathNodeActivity = useCallback(async (
    node: PathExecutionNodeView,
    activityKind: string,
    status: 'started' | 'completed' | 'failed' = 'started',
  ): Promise<boolean> => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (!pathId) return false;
    setPathActivityPending(`${activityKind}:${node.nodeId}`);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.nodeId,
          resourceType: node.type,
          status,
          startedAt: new Date().toISOString(),
          completedAt: status === 'completed' ? new Date().toISOString() : null,
          failedAt: status === 'failed' ? new Date().toISOString() : null,
          idempotencyKey: `${activityKind}:${pathId}:${node.nodeId}:${Date.now()}`,
          liftMetadata: { pathActivityKind: activityKind },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径活动写入失败');
      }
      await reloadControlCorrectionPath();
      setError(null);
      return true;
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : '路径活动写入失败');
      return false;
    } finally {
      setPathActivityPending(null);
    }
  }, [controlCorrectionPathPlan, controlCorrectionPathRound, reloadControlCorrectionPath]);

  const skipPathNode = useCallback(async (node: PathExecutionNodeView) => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (!pathId) return;
    setPathActivityPending(`skip:${node.nodeId}`);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/deviations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviationType: 'skip',
          priorNodeId: controlCorrectionPathPlan?.currentNodeId ?? controlCorrectionPathRound?.currentNodeId ?? null,
          targetNodeId: node.nodeId,
          evidenceConfidence: 'medium',
          idempotencyKey: `skip:${pathId}:${node.nodeId}:${Date.now()}`,
          context: {
            consequence: SKIP_WARNING_TEXT,
            returnEligible: true,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径偏离写入失败');
      }
      await reloadControlCorrectionPath();
      setSkipCandidateNode(null);
      setError(null);
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : '路径偏离写入失败');
    } finally {
      setPathActivityPending(null);
    }
  }, [controlCorrectionPathPlan, controlCorrectionPathRound, reloadControlCorrectionPath]);

  const launchExecutionNode = useCallback(async (node: PathExecutionNodeView) => {
    const activityWritten = await writePathNodeActivity(
      node,
      node.status === 'skipped' ? 'return-to-skipped' : 'initial-completion',
      'started',
    );
    if (!activityWritten) return;
    window.location.assign(pathNodeContextHref(node, {
      goalId: resolveAdaptivePracticeGoalId(
        controlCorrectionPathPlan?.goal.id ?? controlCorrectionPathRound?.goalId ?? activeGoal,
        activeGoal ?? 'control-correction',
      ),
      pathId: controlCorrectionPathPlan?.id ?? controlCorrectionPathRound?.id,
    }));
  }, [activeGoal, controlCorrectionPathPlan, controlCorrectionPathRound, writePathNodeActivity]);

  const retryNextQuestion = useCallback(async () => {
    setPracticeQuestionExpanded(true);
    setLoading(true);
    setError(null);
    try {
      await loadNextQuestion();
    } catch (nextQuestionError) {
      setError(nextQuestionError instanceof Error ? nextQuestionError.message : '下一题加载失败');
    } finally {
      setLoading(false);
    }
  }, [loadNextQuestion]);

  useEffect(() => {
    if (isDemoMode) {
      applyDemoScene(demoScene);
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      setDiagnostic(null);
      setQuestionState(null);
      setFeedback(null);
      setLoading(false);
      setError('请先登录后再进入自适应练习');
      return;
    }

    void bootstrapPractice();
  }, [applyDemoScene, authStatus, bootstrapPractice, demoScene, isDemoMode]);

  const submitCurrentAnswer = async () => {
    if (!questionState || !selectedOption) {
      return;
    }

    if (isDemoMode) {
      const correctOption = questionState.question.options[0]?.label ?? '';
      const isCorrect = selectedOption === correctOption;
      setFeedback({
        isCorrect,
        correctOption,
        explanation: isCorrect
          ? '回答正确：已建立“约束优先 + 跨域映射”的解题顺序。'
          : '回答错误：请优先识别约束，再进行域间因果映射。',
        estimatedAbility: Number((questionState.estimatedAbility + (isCorrect ? 0.06 : -0.03)).toFixed(2)),
        recommendedFocus: diagnostic?.recommendedFocus ?? ['围绕关键薄弱点继续练习跨域题目'],
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: questionState.question.id,
          selectedOption,
          timeSpent: Math.max(1, Math.round((Date.now() - questionStartAt) / 1000)),
          goalId: activeGoal,
          routeIntent: activeGoal ? routeIntent : null,
          pathId: activePathId,
          nodeId: activeNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const data = (await response.json()) as SubmitAnswerResponse;
      setFeedback(data);
      await loadDiagnostic();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async () => {
    setPracticeQuestionExpanded(true);
    if (!diagnostic) {
      return;
    }

    if (isDemoMode) {
      applyDemoScene('generate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKnowledgeTags: diagnostic.weakAreas,
          difficultyTarget: 0.6,
          domains: ['time', 'frequency', 'complex'],
          goalId: activeGoal,
          routeIntent: activeGoal ? routeIntent : null,
          pathId: activePathId,
          nodeId: activeNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error('生成题目失败');
      }

      await loadNextQuestion();
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

    const completedPathLearningTime = formatCompletedPathLearningTime(controlCorrectionPathPlan, Boolean(diagnostic));
    const currentNode = practiceRouteNodes.find((node) => node.state === 'current') ?? practiceRouteNodes[0];
    const compactCurrentNodeTitle = compactPathNodeTitle(currentNode?.title);
    const nextPathAction = controlCorrectionCenter?.nextAction ?? null;
    const canLaunchNextPathAction = nextPathAction
      ? isPostLearningPathNodeAction(nextPathAction) && Boolean(nextPathAction.body && nextPathAction.redirectHref)
      : false;
    const canOpenNextPathAction = nextPathAction?.method === 'GET';
    const canCompleteNextPathAction = Boolean(nextPathAction?.nodeId && nextPathAction.completionAction);
    const nextPathActionLabel = nextPathAction?.title ?? '生成并比较学习路径';
    const weeklyProgress = diagnostic
      ? Math.max(24, Math.min(86, Math.round((
          diagnostic.knowledgeDimensions.computational +
          diagnostic.knowledgeDimensions.crossDomain +
          diagnostic.knowledgeDimensions.design
        ) / 3)))
      : 18;

    return (
      <AppShell
        viewerRole="student"
        title="自适应学习路径中心"
        subtitle="生成、比较并继续执行个人学习路径"
        activeHref="/assessment/adaptive-practice"
        sidebarMode="collapsible"
        breadcrumbs={[
          { label: '学习工作台', href: '/dashboard' },
          { label: '自适应学习路径中心' },
        ]}
        dockControls={[
          {
            id: 'adaptive-path-konling',
            label: '控灵助手',
            control: 'konling',
            href: activePathAdvisorGoal ? `/assessment/adaptive-practice?goal=${activePathAdvisorGoal}&intent=contextual-recommendation` : genericPathGenerationHref,
            icon: <BrainCircuit className="h-4 w-4 text-primary" />,
          },
          {
            id: 'adaptive-path-management',
            label: '路径管理',
            control: 'management',
            href: '/profile/growth',
            icon: <Settings className="h-4 w-4 text-muted-foreground" />,
          },
        ]}
        className="surface-page"
      >
        <section
          className="space-y-5"
          data-commercial-workspace="adaptive-path-center"
          data-adaptive-path-center="generation-selection"
          data-commercial-student-entry-route="/assessment/adaptive-practice"
          data-commercial-entry-intent="practice"
          data-student-entry-evidence-return="/profile/evidence"
          data-adaptive-path-generation-state="generation-main"
          data-adaptive-path-comparison-state="information-grid"
          data-konling-dock-placement="shared-right-bottom"
          data-route-family={learnerDataShell.routeFamily}
          data-route-identity={learnerDataShell.routeIdentity}
          data-learner-record-surface={learnerDataShell.archetype}
          data-learner-record-priority="current-path"
          data-learner-record-next-action="generate-and-compare-path"
          data-learner-record-evidence-confidence={controlCorrectionCenter?.nextAction.confidence ?? 'unknown'}
          data-learner-record-missing-source={controlCorrectionCenter?.readinessGate.missing.length ? 'learning-task-evidence-needed' : 'generic-path-center'}
        >
          {controlCorrectionCenter ? (
            <span
              className="sr-only"
              data-control-correction-center="adaptive-practice"
              data-control-correction-goal={controlCorrectionCenter.goalId}
              data-control-correction-intent={controlCorrectionCenter.entry.routeIntent}
              data-control-correction-ready={String(controlCorrectionCenter.readinessGate.ready)}
              data-control-correction-alternative-count={controlCorrectionAlternativeCount(controlCorrectionCenter)}
            />
          ) : null}
          <header className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <div className="surface-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                <span className="rounded-md border border-border bg-muted px-2.5 py-1">学习路径</span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1">控灵生成</span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1">可比较方案</span>
              </div>
              <div className="mt-5 max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-normal text-foreground">自适应学习路径中心</h1>
                <p className="mt-3 text-sm leading-6 text-subtle">
                  证据还少，先从入门路径开始，系统会随学习过程调整。你可以让控灵按目标、时间和资源偏好生成路径，再比较后选择执行。
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activePathAdvisorGoal ? (
                  <button
                    type="button"
                    onClick={openPathGenerationAdvisor}
                    disabled={assistantEntryPoint?.mode !== 'path-advisor'}
                    data-adaptive-path-generation-action="open-in-page-path-advisor"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    {assistantEntryPoint?.mode === 'path-advisor' ? '请控灵生成路径' : '路径顾问准备中'}
                  </button>
                ) : (
                  <Link
                    href={genericPathGenerationHref}
                    data-adaptive-path-generation-action="choose-generation-goal"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    生成学习路径
                  </Link>
                )}
                <Link
                  href="/profile/evidence"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
                >
                  <History className="size-4" aria-hidden="true" />
                  查看学习证据
                </Link>
              </div>
            </div>

            <aside className="surface-card p-5" data-adaptive-path-cold-start="product-language">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                  <Target className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs text-subtle">当前建议</p>
                  <h2 className="text-base font-semibold text-foreground">先建立入门路径</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-subtle">
                这条路径更适合先补概念，再进入练习。完成检查点后，系统会把互动、练习和仿真记录纳入后续推荐。
              </p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-subtle">当前节点</p>
                  <p className="mt-1 font-medium text-foreground">{compactCurrentNodeTitle}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-subtle">本周完成</p>
                  <p className="mt-1 font-medium text-foreground">{percentLabel(weeklyProgress)}</p>
                </div>
              </div>
            </aside>
          </header>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="surface-card p-5" data-adaptive-path-overview="learning-overview">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">Learning overview</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">学习概况</h2>
                </div>
                <Clock3 className="size-5 text-primary" aria-hidden="true" />
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['当前目标', '自动控制原理核心能力'],
                  ['当前节点', compactCurrentNodeTitle],
                  ['已完成节点时长', completedPathLearningTime],
                  ['预计总时长', '3 小时 10 分'],
                  ['本周完成情况', percentLabel(weeklyProgress)],
                  ['证据覆盖', controlCorrectionCenter ? formatConfidence(controlCorrectionCenter.nextAction.confidence) : '待积累'],
                  ['缺失证据', controlCorrectionCenter?.readinessGate.missing.length ? '需要继续完成学习任务' : '暂无完整路径证据'],
                  ['下一步', nextPathActionLabel],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/35 p-3">
                    <dt className="text-xs text-subtle">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {nextPathAction ? (
                <div
                  className="mt-4 rounded-lg border border-border bg-background/55 p-3"
                  data-adaptive-path-current-node-actions="launch-complete"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-subtle">当前路径动作</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{nextPathAction.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canLaunchNextPathAction ? (
                        <button
                          type="button"
                          onClick={launchNextAction}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          继续当前节点
                        </button>
                      ) : canOpenNextPathAction ? (
                        <Link
                          href={nextPathAction.href}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          打开下一步
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          当前节点暂不可启动
                        </button>
                      )}
                      {canCompleteNextPathAction ? (
                        <button
                          type="button"
                          onClick={completeNextAction}
                          disabled={pathNodeCompletionPending === nextPathAction.nodeId}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60"
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {nextPathAction.completionAction?.label ?? '确认完成'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className="surface-card p-5"
              data-konling-generation-parameters="adaptive-path"
              data-adaptive-path-generation-panel="editable"
              data-adaptive-path-generation-mobile-sheet="bottom-sheet"
              data-konling-citation-slot="cited-explanation"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">生成设置</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">调整路径生成方案</h2>
                  <p className="mt-2 text-sm text-subtle">选择目标和可用时间，系统会生成可比较的学习路径。</p>
                </div>
                <MessageSquare className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-3" data-adaptive-path-generation-request="structured-panel">
                <label className="block rounded-lg border border-border bg-background/45 p-3">
                  <span className="text-xs text-subtle">学习目标</span>
                  <select
                    value={pathGenerationPanel.goalId}
                    onChange={(event) => setPathGenerationPanel((current) => ({
                      ...current,
                      goalId: resolveAdaptivePracticeGoalId(event.target.value),
                    }))}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {generationGoalOptions.map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.label}</option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs leading-5 text-subtle">
                    {generationGoalOptions.find((goal) => goal.id === pathGenerationPanel.goalId)?.detail}
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block rounded-lg border border-border bg-background/45 p-3">
                    <span className="text-xs text-subtle">可用时间</span>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min={30}
                        max={180}
                        step={15}
                        value={pathGenerationPanel.timeBudgetMinutes}
                        onChange={(event) => setPathGenerationPanel((current) => ({
                          ...current,
                          timeBudgetMinutes: Number(event.target.value),
                        }))}
                        className="w-full"
                        aria-label="可用时间"
                      />
                      <span className="w-16 text-right text-sm font-medium text-foreground">
                        {pathGenerationPanel.timeBudgetMinutes} 分钟
                      </span>
                    </div>
                  </label>

                  <label className="block rounded-lg border border-border bg-background/45 p-3">
                    <span className="text-xs text-subtle">难度节奏</span>
                    <select
                      value={pathGenerationPanel.difficultyRhythm}
                      onChange={(event) => setPathGenerationPanel((current) => ({
                        ...current,
                        difficultyRhythm: event.target.value as GenerationDifficultyRhythm,
                      }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="gentle">先稳固基础</option>
                      <option value="steady">稳步推进</option>
                      <option value="challenge">提高挑战密度</option>
                    </select>
                  </label>
                </div>

                <fieldset className="rounded-lg border border-border bg-background/45 p-3">
                  <legend className="px-1 text-xs text-subtle">资源偏好</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {generationResourceOptions.map((resource) => {
                      const selected = pathGenerationPanel.resourcePreference.includes(resource.id);
                      return (
                        <button
                          key={resource.id}
                          type="button"
                          onClick={() => toggleGenerationResource(resource.id)}
                          aria-pressed={selected}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/40 text-subtle'
                          }`}
                        >
                          {resource.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block rounded-lg border border-border bg-background/45 p-3">
                    <span className="text-xs text-subtle">检查点密度</span>
                    <select
                      value={pathGenerationPanel.checkpointPreference}
                      onChange={(event) => setPathGenerationPanel((current) => ({
                        ...current,
                        checkpointPreference: event.target.value as GenerationCheckpointPreference,
                      }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="light">减少检查点</option>
                      <option value="standard">标准检查点</option>
                      <option value="dense">增加检查点</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/45 p-3">
                    <span>
                      <span className="block text-xs text-subtle">站外资源</span>
                      <span className="mt-1 block text-sm text-foreground">允许受治理的外部材料</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={pathGenerationPanel.allowExternalResources}
                      onChange={(event) => setPathGenerationPanel((current) => ({
                        ...current,
                        allowExternalResources: event.target.checked,
                      }))}
                      className="size-4"
                    />
                  </label>
                </div>
              </div>
              <label className="mt-3 block rounded-lg border border-border bg-background/45 p-3">
                <span className="text-xs text-subtle">告诉控灵你想达成什么</span>
                <textarea
                  value={pathGenerationPanel.naturalLanguageIntent}
                  onChange={(event) => setPathGenerationPanel((current) => ({
                    ...current,
                    naturalLanguageIntent: event.target.value,
                  }))}
                  maxLength={500}
                  rows={3}
                  placeholder="告诉控灵你想达成什么"
                  data-adaptive-path-generation-intent="editable"
                  className="mt-2 min-h-20 w-full resize-y rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submitPathGeneration('generate')}
                  disabled={pathGenerationPending !== null || !activeGoal}
                  data-adaptive-path-generation-action="submit-panel-request"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {pathGenerationPending === 'generate' ? '正在生成' : '生成路径'}
                </button>
                <button
                  type="button"
                  onClick={openPathGenerationAdvisor}
                  disabled={assistantEntryPoint?.mode !== 'path-advisor'}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary disabled:opacity-60"
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                  打开控灵
                </button>
              </div>
            </div>
          </section>

          <section
            id="adaptive-path-generation-goals"
            className="surface-card scroll-mt-24 p-5"
            data-adaptive-path-generation-goal-list="generic"
            data-adaptive-path-generation-default-scope="goal-selection"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-normal text-primary">Goal selection</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">选择路径目标</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
                  先选定目标，再让控灵结合学习证据生成路径。目标不同，推荐资源、检查点和练习节奏也会不同。
                </p>
              </div>
              <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                2 个目标
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div
                className="rounded-lg border border-border bg-background/55 p-4"
                data-adaptive-path-generation-goal="control-correction"
                data-adaptive-path-generation-ready="true"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                    <GitBranch className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs text-subtle">目标一</p>
                    <h3 className="text-base font-semibold text-foreground">控制系统校正设计</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-subtle">
                  面向时域指标、根轨迹设计、仿真验证和 Arena 迁移，适合生成可执行的校正学习路径。
                </p>
                <Link
                  href={controlCorrectionGenerationHref}
                  data-adaptive-path-generation-action="enter-registered-goal-context"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  生成该目标路径
                </Link>
              </div>

              <div
                className="rounded-lg border border-border bg-background/55 p-4"
                data-adaptive-path-generation-goal="frequency-response-foundations"
                data-adaptive-path-generation-ready="evidence-first"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                    <Compass className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs text-subtle">目标二</p>
                    <h3 className="text-base font-semibold text-foreground">频率响应基础</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-subtle">
                  面向 Bode 图、频域稳定性和基础练习，适合先补齐学习证据，再进入可比较路径。
                </p>
                <Link
                  href={frequencyResponseGenerationHref}
                  data-adaptive-path-generation-action="enter-registered-goal-context"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  生成该目标路径
                </Link>
              </div>
            </div>
          </section>

          <section
            className="surface-card p-5"
            data-learning-path-product-surface="path-options-selection-history-terminal-validation"
            data-learning-path-options-slot="three-style"
            data-learning-path-options-layout="comparable-information-grid"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-normal text-primary">Path comparison</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">选择你的学习路径</h2>
                <p className="mt-2 text-sm text-subtle">不同路径按同一组字段比较，便于直接判断取舍。</p>
              </div>
              <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                {visiblePathOptions.length} 条可比较路径
              </span>
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <div
                className="grid min-w-max gap-3"
                style={{
                  gridTemplateColumns: `minmax(180px,0.55fr) repeat(${Math.max(visiblePathOptions.length, 1)}, minmax(220px,1fr))`,
                }}
              >
                <div className="rounded-lg border border-border bg-muted/35 p-3 text-xs font-medium text-subtle">比较字段</div>
                {visiblePathOptions.map((option) => (
                  <div key={option.id} className="rounded-lg border border-border bg-muted/35 p-3" data-learning-path-option={option.id}>
                    <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
                    <p className="mt-1 text-sm text-subtle">{option.scenario}</p>
                  </div>
                ))}

                {[
                  ['预计时长', (option: AdaptivePathOptionDisplay) => option.estimatedTime],
                  ['已匹配资源', (option: AdaptivePathOptionDisplay) => option.resources.map((resource) => resource.label).join('、')],
                  ['准备度', (option: AdaptivePathOptionDisplay) => option.readiness],
                  ['检查节点', (option: AdaptivePathOptionDisplay) => option.checkpoints],
                  ['适合场景', (option: AdaptivePathOptionDisplay) => option.scenario],
                  ['当前建议理由', (option: AdaptivePathOptionDisplay) => option.reason],
                  ['预期结果', (option: AdaptivePathOptionDisplay) => option.outcome],
                  ['风险提示', (option: AdaptivePathOptionDisplay) => option.riskNote],
                ].map(([label, resolve]) => (
                  <div key={label as string} className="contents">
                    <div className="rounded-lg border border-border bg-background/45 p-3 text-sm font-medium text-foreground">
                      {label as string}
                    </div>
                    {visiblePathOptions.map((option) => (
                      <div key={`${option.id}:${label}`} className="rounded-lg border border-border bg-background/45 p-3 text-sm leading-6 text-subtle">
                        {(resolve as (option: AdaptivePathOptionDisplay) => string)(option)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2 lg:hidden">
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 text-xs" data-learning-path-mobile-summary="horizontal-scan">
                {visiblePathOptions.map((option) => (
                  <div key={`${option.id}:mobile-summary`} className="min-w-[9.5rem] snap-start rounded-lg border border-border bg-background/60 p-2">
                    <p className="font-semibold text-foreground">{option.title.replace('路径', '')}</p>
                    <p className="mt-1 text-subtle">{option.estimatedTime}</p>
                    <p className="mt-1 text-subtle">{option.checkpoints}</p>
                  </div>
                ))}
              </div>
              {visiblePathOptions.map((option) => (
                <section key={`${option.id}:mobile`} className="rounded-lg border border-border bg-muted/30 p-3" data-learning-path-option={option.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-subtle">{option.scenario}</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-subtle">
                      {option.estimatedTime}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/60 p-3 text-sm">
                    <p className="leading-6 text-foreground">{option.reason}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs text-subtle">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">{option.checkpoints}</span>
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">{option.readiness}</span>
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
                        {option.resources.slice(0, 2).map((resource) => resource.label).join('、')}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-subtle">{option.outcome}</p>
                    <p className="text-xs leading-5 text-subtle">{option.riskNote}</p>
                  </div>
                  <details className="mt-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-subtle">
                    <summary className="cursor-pointer font-medium text-foreground">查看资源组合</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {option.resources.map((resource) => {
                        const Icon = adaptivePathResourceIcons[resource.kind];
                        return (
                          <span key={`${option.id}:mobile:${resource.kind}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1">
                            <Icon className="size-3.5" aria-hidden="true" />
                            {resource.label}
                          </span>
                        );
                      })}
                    </div>
                  </details>
                  <div className="mt-3 grid gap-2" data-learning-path-mobile-actions="primary-then-secondary">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathChoicePending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathChoice('selection', optionForWrite);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      选择路径
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60"
                        disabled={!option.writeOption || Boolean(pathGenerationPending)}
                        onClick={() => {
                          const optionForWrite = option.writeOption;
                          if (optionForWrite) {
                            submitPathGeneration('revise', optionForWrite);
                            return;
                          }
                          setPathChoiceUnavailable();
                        }}
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        调整
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                        disabled={!option.writeOption || Boolean(pathGenerationPending)}
                        onClick={() => {
                          const optionForWrite = option.writeOption;
                          if (optionForWrite) {
                            submitPathGeneration('explain', optionForWrite);
                            return;
                          }
                          setPathChoiceUnavailable();
                        }}
                      >
                        解释差异
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                        disabled={!option.writeOption || Boolean(pathChoicePending)}
                        onClick={() => {
                          const optionForWrite = option.writeOption;
                          if (optionForWrite) {
                            submitPathChoice('rejection', optionForWrite);
                            return;
                          }
                          setPathChoiceUnavailable();
                        }}
                      >
                        暂不采用
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                        disabled={!option.writeOption || Boolean(pathChoicePending)}
                        onClick={() => {
                          const optionForWrite = option.writeOption;
                          if (optionForWrite) {
                            submitPathChoice('helpfulness', optionForWrite, true);
                            return;
                          }
                          setPathChoiceUnavailable();
                        }}
                      >
                        有帮助
                      </button>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
              {visiblePathOptions.map((option) => (
                <div key={`${option.id}:actions`} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {option.resources.map((resource) => {
                      const Icon = adaptivePathResourceIcons[resource.kind];
                      return (
                        <span key={`${option.id}:${resource.kind}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-subtle">
                          <Icon className="size-3.5" aria-hidden="true" />
                          {resource.label}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathChoicePending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathChoice('selection', optionForWrite);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      选择路径
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathGenerationPending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathGeneration('revise', optionForWrite);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      请控灵调整
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathGenerationPending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathGeneration('explain', optionForWrite);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      解释差异
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathChoicePending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathChoice('rejection', optionForWrite);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      暂不采用
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtle disabled:opacity-60"
                      disabled={!option.writeOption || Boolean(pathChoicePending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathChoice('helpfulness', optionForWrite, true);
                          return;
                        }
                        setPathChoiceUnavailable();
                      }}
                    >
                      有帮助
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pathChoiceMessage ? (
              <p className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
                {pathChoiceMessage}
              </p>
            ) : null}
          </section>

          {pathExecutionNodes.length > 0 ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)]">
              <div className="surface-card p-5" data-adaptive-path-execution-surface="active-route">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-primary">Active route</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">当前学习路径</h2>
                    <p className="mt-2 text-sm text-subtle">完整路线、当前节点、预计时间和检查点状态保持可见。</p>
                  </div>
                  <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                    当前节点：{currentPathNode?.title ?? '待定位'}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  {[
                    ['已耗时', pathExecutionSummary.elapsed],
                    ['预计剩余', pathExecutionSummary.remaining],
                    ['预计总时长', pathExecutionSummary.total],
                    ['完成节点', pathExecutionSummary.completed],
                    ['检查点通过', pathExecutionSummary.checkpointPass],
                    ['本周学习', pathExecutionSummary.weekly],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-subtle">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-lg border border-border bg-background/55 p-3" data-adaptive-path-route-map="complete">
                    <span className="sr-only" data-adaptive-path-route-connector="true" />
                    <ol className="grid gap-3 lg:grid-cols-3" data-adaptive-path-route-flow="connected">
                      {pathExecutionNodes.map((node, index) => (
                        <li key={node.nodeId} className="relative pl-8 lg:pl-0">
                          {index < pathExecutionNodes.length - 1 ? (
                            <span
                              aria-hidden="true"
                              className="absolute left-4 top-12 h-[calc(100%+0.75rem)] w-px bg-border lg:left-[calc(100%-0.25rem)] lg:top-14 lg:h-px lg:w-[calc(100%+0.5rem)]"
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setSelectedPathNodeId(node.nodeId)}
                            aria-pressed={focusedPathNode?.nodeId === node.nodeId}
                            data-adaptive-path-node={node.nodeId}
                            data-adaptive-path-node-state={node.status}
                            data-adaptive-path-node-selectable="true"
                            className={`relative z-10 min-h-36 w-full rounded-lg border p-3 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              node.status === 'current'
                                ? 'border-primary bg-primary/10'
                                : node.status === 'completed'
                                  ? 'border-platform-evidence-eligible/40 bg-platform-evidence-eligible/10'
                                  : node.status === 'skipped' || node.status === 'blocked'
                                    ? 'border-platform-evidence-context/40 bg-platform-evidence-context/10'
                                    : node.status === 'locked'
                                      ? 'border-border bg-muted/45'
                                      : 'border-border bg-muted/25'
                            } ${focusedPathNode?.nodeId === node.nodeId ? 'ring-2 ring-primary/30' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background text-sm font-semibold text-foreground">
                                {resourceGlyph(node.type)}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs text-subtle">第 {index + 1} 步 · {node.resourceLabel}</span>
                                <span className="mt-1 block text-sm font-semibold text-foreground">{node.title}</span>
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                              <span className="rounded-md border border-border bg-background/70 px-2 py-1">
                                {node.status === 'current'
                                  ? '当前节点'
                                  : node.status === 'completed'
                                    ? '已完成'
                                    : node.status === 'skipped'
                                      ? '已跳过'
                                      : node.status === 'blocked'
                                        ? '待复核'
                                        : node.status === 'locked'
                                          ? '稍后解锁'
                                          : '等待前置节点'}
                              </span>
                              <span>预计 {formatMinutes(node.estimatedMinutes)}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {focusedPathNode ? (
                    <div className="rounded-lg border border-border bg-background/55 p-4" data-adaptive-path-node-detail="selected">
                      <p className="text-xs text-primary">{focusedPathNode.resourceLabel}</p>
                      <h3 className="mt-1 text-base font-semibold text-foreground">{focusedPathNode.title}</h3>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-subtle">推荐理由</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.reason}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-subtle">将收集的学习证据</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.evidence}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-subtle">检查标准</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.checkpoint}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {focusedPathNode.status === 'completed' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void writePathNodeActivity(focusedPathNode, 'review', 'started')}
                              disabled={pathActivityPending === `review:${focusedPathNode.nodeId}`}
                              className="rounded-lg border border-border px-3 py-2 text-xs text-foreground disabled:opacity-60"
                            >
                              回顾
                            </button>
                            <button
                              type="button"
                              onClick={() => void writePathNodeActivity(focusedPathNode, 'continued-interaction', 'started')}
                              disabled={pathActivityPending === `continued-interaction:${focusedPathNode.nodeId}`}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                            >
                              继续互动
                            </button>
                            <Link
                              href={`/profile/evidence?goal=control-correction&pathId=${encodeURIComponent(controlCorrectionPathPlan?.id ?? '')}&nodeId=${encodeURIComponent(focusedPathNode.nodeId)}`}
                              className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                            >
                              查看证据
                            </Link>
                          </>
                        ) : focusedPathNode.status === 'current' || focusedPathNode.status === 'skipped' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void launchExecutionNode(focusedPathNode)}
                              disabled={pathActivityPending === `initial-completion:${focusedPathNode.nodeId}` ||
                                pathActivityPending === `return-to-skipped:${focusedPathNode.nodeId}`}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                            >
                              {focusedPathNode.status === 'skipped' ? '返回学习' : '开始学习'}
                            </button>
                            {focusedPathNode.status !== 'skipped' ? (
                              <button
                                type="button"
                                onClick={() => setSkipCandidateNode(focusedPathNode)}
                                className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                              >
                                跳过
                              </button>
                            ) : null}
                          </>
                        ) : focusedPathNode.status === 'locked' ? (
                          <span className="rounded-lg border border-border px-3 py-2 text-xs text-subtle">
                            {focusedPathNode.unlockMessage ?? '稍后解锁'}
                          </span>
                        ) : (
                          <span className="rounded-lg border border-border px-3 py-2 text-xs text-subtle">等待前置节点</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {skipCandidateNode ? (
                  <div className="mt-4 rounded-lg border border-platform-evidence-context/60 bg-platform-evidence-context/10 p-4" data-adaptive-path-skip-warning="visible">
                    <h3 className="text-sm font-semibold text-foreground">确认跳过 {skipCandidateNode.title}</h3>
                    <p className="mt-2 text-sm text-foreground">{SKIP_WARNING_TEXT}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void skipPathNode(skipCandidateNode)}
                        disabled={pathActivityPending === `skip:${skipCandidateNode.nodeId}`}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        确认跳过
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkipCandidateNode(null)}
                        className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                      >
                        继续保留
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside
                className="surface-card p-5"
                data-adaptive-path-history-surface="timeline-evidence"
                data-adaptive-path-evidence-sources="complete"
                data-adaptive-path-evidence-states="student-safe"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-primary">Evidence Record</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">路径完成与证据</h2>
                  </div>
                  <History className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {evidenceSourceSummary.slice(0, 6).map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-subtle">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{item.count}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-3" data-adaptive-path-history-timeline="governed-activity">
                  {pathActivityTimeline.length > 0 ? pathActivityTimeline.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-background/55 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-primary">{item.sourceLabel} · {item.stateLabel}</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">{item.title}</h3>
                          <p className="mt-1 text-xs text-subtle">{item.nodeTitle} · {item.detail}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <span className="text-xs text-subtle">{item.createdAt}</span>
                          {item.nodeId && pathExecutionNodes.some((node) => node.nodeId === item.nodeId) ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPathNodeId(item.nodeId)}
                              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary"
                            >
                              查看节点
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  )) : (
                    <p className="rounded-lg border border-border bg-background/55 p-3 text-sm text-subtle">
                      路径执行、回顾、继续互动、跳过、检查点和控灵建议会在这里形成时间线。
                    </p>
                  )}
                </div>
              </aside>
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)]">
            <div className="surface-card p-5" data-adaptive-practice-resource="path-node">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">Practice resource</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">路径资源入口</h2>
                  <p className="mt-2 text-sm text-subtle">自适应练习保留为检查节点，选择路径后再展开题面和反馈。</p>
                </div>
                <button
                  type="button"
                  onClick={questionState ? () => setPracticeQuestionExpanded((expanded) => !expanded) : generateQuestion}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary disabled:opacity-60"
                >
                  <ListChecks className="size-4" aria-hidden="true" />
                  {questionState ? (practiceQuestionExpanded ? '收起练习题' : '展开练习题') : '生成练习题'}
                </button>
              </div>

              {authStatus === 'unauthenticated' && !isDemoMode ? (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-5 text-sm text-subtle">
                  <p className="font-medium text-foreground">登录后可以继续当前路径和练习任务。</p>
                  <Link
                    href={loginHref}
                    className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    登录后继续
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {error ? (
                    <div
                      className="rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-sm"
                      data-adaptive-practice-error-state="recoverable"
                    >
                      <p className="font-medium text-foreground">练习加载未完成</p>
                      <p className="mt-1 leading-6 text-subtle">{error}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={bootstrapPractice}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          <RefreshCw className="size-3.5" aria-hidden="true" />
                          重新加载
                        </button>
                        {diagnostic ? (
                          <button
                            type="button"
                            onClick={retryNextQuestion}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60"
                          >
                            <ListChecks className="size-3.5" aria-hidden="true" />
                            重试下一题
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['当前作用', '检查理解并更新路径推荐'],
                      ['资源状态', questionState ? '已准备一组练习题' : '选择路径后展开'],
                      ['后续记录', feedback ? '反馈将纳入学习证据' : '完成后形成检查证据'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <p className="text-xs text-subtle">{label}</p>
                        <p className="mt-1 font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {questionState && practiceQuestionExpanded ? (
                    <div className="rounded-lg border border-border bg-background/55 p-4" data-adaptive-practice-question="active">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">检查节点练习</p>
                        <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-subtle">
                          能力估计 {questionState.estimatedAbility.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">{questionState.question.stem}</p>
                      <div className="mt-3 grid gap-2">
                        {questionState.question.options.map((option) => (
                          <label key={option.label} className="flex gap-2 rounded-lg border border-border bg-muted/25 p-3 text-sm">
                            <input
                              type="radio"
                              name="adaptive-practice-option"
                              value={option.label}
                              checked={selectedOption === option.label}
                              onChange={() => setSelectedOption(option.label)}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-medium text-foreground">{option.label}. </span>
                              <span className="text-subtle">{option.text}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={submitCurrentAnswer}
                          disabled={!selectedOption || loading}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          提交答案
                        </button>
                        <button
                          type="button"
                          onClick={retryNextQuestion}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          换一题
                        </button>
                      </div>
                      {feedback ? (
                        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                          <p className="font-medium text-foreground">{feedback.isCorrect ? '回答正确' : '需要复盘'}</p>
                          <p className="mt-1 leading-6 text-subtle">{feedback.explanation}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : questionState ? (
                    <div
                      className="rounded-lg border border-border bg-background/55 p-4"
                      data-adaptive-practice-question="summary"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">检查节点练习已准备</p>
                          <p className="mt-1 text-sm leading-6 text-subtle">
                            题面会在选择路径或进入检查节点后展开，避免干扰路径生成与比较。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPracticeQuestionExpanded(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <ListChecks className="size-3.5" aria-hidden="true" />
                          展开练习题
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <aside
              className="surface-card p-5"
              data-learning-path-history="selection-history"
              data-learning-path-history-slot="selection-history"
              data-learning-path-validation-timeline="checkpoint-deviation-intervention-terminal"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">History</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">选择历史</h2>
                </div>
                <Timer className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-2">
                {pathSelectionHistory.length > 0 ? pathSelectionHistory.map((history, index) => (
                  <div key={`${history.type}:${history.createdAt ?? index}`} className="rounded-lg border border-border bg-muted/35 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{formatPathHistoryType(history.type)}</span>
                      <span className="text-xs text-subtle">{history.createdAt ?? '刚刚'}</span>
                    </div>
                    <p className="mt-1 text-subtle">
                      {history.selectedOptionLabel
                        ? `已选择 ${history.selectedOptionLabel}`
                        : history.rejectedOptionLabels?.length
                          ? `未采用 ${history.rejectedOptionLabels.join('、')}`
                          : '已记录路径偏好'}
                    </p>
                  </div>
                )) : (
                  <>
                    <div className="rounded-lg border border-border bg-muted/35 p-3 text-sm">
                      <p className="font-medium text-foreground">待选择</p>
                      <p className="mt-1 text-subtle">选择、拒绝、切换和有用性反馈会在这里显示。</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/35 p-3 text-sm">
                      <p className="font-medium text-foreground">控灵调整</p>
                      <p className="mt-1 text-subtle">调整请求会作为路径生成偏好进入后续推荐。</p>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </section>
        </section>
      </AppShell>
    );
}

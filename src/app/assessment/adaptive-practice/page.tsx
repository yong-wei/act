'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { extractColdStartEvidenceCount, isColdStartLearner } from '@/lib/adaptive-cold-start-detection';
import {
  AdaptivePathJourneyControlFromRoute,
  AdaptivePathOwnedResourceAction,
  publishAdaptivePathJourneyResponse,
} from '@/features/adaptive/adaptive-path-journey-control';
import {
  resolveAdaptivePathCenterOwnedTargetHref,
  resolveAdaptivePathJourneyTargetDisposition,
} from '@/features/adaptive/adaptive-path-journey-contracts';
import {
  AdaptivePathTimeline,
  getAdaptivePathResourceVisual,
} from '@/features/adaptive/adaptive-path-timeline';
import {
  PathWorkspaceModule,
  type PathWorkspaceModuleId,
} from '@/features/adaptive/path-workspace-module';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  buildAdaptivePathLaunchHref,
  buildControlCorrectionLearningCenterView,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  type ControlCorrectionLearningCenterView,
  type ControlCorrectionCenterRouteIntent,
  type PracticeEntryRouteNode,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import {
  AdaptivePathUnlockChainView,
  type AdaptivePathUnlockProjectedAction,
  resolveAdaptivePathUnlockChainAction,
} from '@/features/adaptive/adaptive-path-unlock-chain-view';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import {
  buildAdaptivePathUnlockChain,
  type AdaptivePathUnlockChain,
  type AdaptivePathUnlockChainNodeInput,
} from '@/lib/adaptive-path-unlock-chain';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import type {
  EvidenceTimelineLearnerRecordSourceScope,
  StudentSafeEvidenceEventReference,
} from '@/lib/data-governance/evidence-timeline';
import {
  buildAdaptivePathOptionDisplays,
  type AdaptivePathOptionDisplay,
  type AdaptivePathOptionWriteOption,
  type AdaptivePathResourceKind,
} from '@/lib/adaptive-path-option-display';
import {
  buildPathGenerationGoalHref,
  defaultPathGenerationPanel,
  generationResourceOptions,
  pathGenerationPanelFromSearchParams,
  type GenerationCheckpointPreference,
  type GenerationDifficultyRhythm,
  type PathGenerationPanelState,
} from '@/lib/adaptive-path-generation-panel';
import {
  adaptiveGenerationReadinessFromHttp,
  buildAdaptiveGenerationReadiness,
  selectAdaptiveGenerationReadiness,
  type AdaptiveGenerationReadiness,
} from '@/lib/adaptive-generation-readiness';
import {
  claimPathGenerationRequest,
  INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE,
  releasePathGenerationRequest,
  settlePathGenerationRequest,
  type PathGenerationRequestStatus,
} from '@/lib/path-generation-request-lifecycle';
import { restoreAdaptiveLearningPathPlanFromRound } from '@/lib/adaptive-path-round-restore';
import {
  adaptivePracticeGoalLabel,
  getAdaptivePracticeGoalOptions,
  isAdaptivePracticeGoalId,
  type AdaptivePathAdvisorQuickPrompt,
  type AdaptivePracticeGoalId,
} from '@/lib/adaptive-path-goal-options';
import {
  resolveAdaptivePathContextRecoveryState,
  resolveAdaptivePathExecutionNodeStatus,
  resolveAdaptivePathLandingState,
  type AdaptiveLearnerStateLoadState,
  type AdaptivePathContextLoadState,
} from '@/lib/adaptive-path-execution-state';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';
import { buildFeedbackTaskContext, buildFeedbackTaskHref } from '@/lib/student-feedback-task-contract';

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
  durableAnswerId?: string;
  durableSessionId?: string;
  algorithmVersion?: string;
  adaptiveAssessmentRef?: Record<string, unknown>;
}

interface PathAdvisorContextResponse {
  goalId: AdaptivePracticeGoalId;
  classId: string;
  graphNodeId?: string | null;
  modeContextToken: string;
  readiness?: AdaptiveGenerationReadiness;
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
  quickPrompts?: AdaptivePathAdvisorQuickPrompt[];
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

type PathOptionView = AdaptivePathOptionWriteOption & { batchId?: string; candidateId?: string };
type PathRecommendationProvenanceEntry = NonNullable<
  AdaptivePathOptionWriteOption['recommendationProvenance']
>['entries'][number];
type PathRecommendationProvenance = NonNullable<
  AdaptivePathOptionWriteOption['recommendationProvenance']
>;
type PathGenerationOperation = 'generate' | 'revise' | 'explain';
type PathDifferenceStatus = 'ready' | 'no-material-difference' | 'insufficient-data';

interface AdaptivePathCandidateBatchView {
  id: string;
  goalId: string;
  sourcePathId: string;
  candidates: Array<{
    id: string;
    styleId: string;
    label: string;
    snapshot: Record<string, unknown>;
  }>;
}

type CandidateBatchLoadResult =
  | { status: 'loaded'; batch: AdaptivePathCandidateBatchView }
  | { status: 'missing' }
  | { status: 'failed' };

interface PathDifferenceNode {
  nodeId: string;
  title: string;
  resourceType: string;
}

interface PathDifferenceExplanation {
  status: PathDifferenceStatus;
  pathId: string;
  options: Array<{
    optionId: string;
    styleId: string;
    label: string;
    metrics: {
      estimatedMinutes: number | null;
      nodeCount: number;
      resourceMix: Record<string, number>;
      readiness: Record<string, number>;
      readinessSummary: Array<{
        nodeId: string;
        state: string;
        message: string;
      }>;
      checkpointCount: number;
      checkpointNodeIds: string[];
      lockedNodeCount: number;
      lockedNodeIds: string[];
      terminalValidationCount: number;
      terminalValidationNodeIds: string[];
    };
  }>;
  commonNodes: Array<PathDifferenceNode & { positions: [number, number] }>;
  optionOnlyNodes: Array<{
    optionId: string;
    nodes: Array<PathDifferenceNode & { position: number }>;
  }>;
  orderDifferences: Array<{
    nodeId: string;
    title: string;
    positions: [number, number];
  }>;
  tradeoffs: string[];
  limitations: string[];
}

function publishPathGenerationStatus(
  status: Exclude<PathGenerationRequestStatus, 'idle'>,
  requestId: string,
  message: string,
) {
  window.dispatchEvent(new CustomEvent('konling:path-generation-status', {
    detail: { status, requestId, message },
  }));
}

function readAdaptiveGenerationReadiness(payload: unknown): AdaptiveGenerationReadiness | null {
  const record = getRecord(payload);
  const readiness = getRecord(record.readiness);
  const status = typeof readiness.status === 'string' ? readiness.status : '';
  const reason = typeof readiness.reason === 'string' ? readiness.reason : '';
  const studentAction = typeof readiness.studentAction === 'string' ? readiness.studentAction : '';
  const staffAction = typeof readiness.staffAction === 'string' ? readiness.staffAction : '';
  const studentMessage = typeof readiness.studentMessage === 'string' ? readiness.studentMessage : '';
  const staffMessage = typeof readiness.staffMessage === 'string' ? readiness.staffMessage : '';
  const evidence = getRecord(readiness.evidence);
  const source = typeof evidence.source === 'string' ? evidence.source : '';
  const diagnosticCode = typeof evidence.diagnosticCode === 'string' ? evidence.diagnosticCode : '';
  const safeLabel = typeof evidence.safeLabel === 'string' ? evidence.safeLabel : '';
  if (!status || !reason || !studentAction || !staffAction || !studentMessage || !staffMessage || !source || !diagnosticCode) {
    return null;
  }
  return {
    status,
    reason,
    studentAction,
    staffAction,
    studentMessage,
    staffMessage,
    evidence: {
      source,
      diagnosticCode,
      safeLabel: safeLabel || diagnosticCode,
    },
  } as AdaptiveGenerationReadiness;
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
  selectionBasis: {
    summary: string;
    confidence: 'low' | 'medium' | 'high';
    supportingFacts: string[];
    limitations: string[];
    eventReferences: StudentSafeEvidenceEventReference[];
  } | null;
  latestAdjustment: {
    kind: 'advanced' | 'delayed' | 'retained' | 'replaced' | 'removed';
    summary: string;
    supportingFacts: string[];
  } | null;
  readinessState: string;
  lockReason?: string;
  unlockMessage?: string;
  unlockChain?: AdaptivePathUnlockChain;
  result?: PathNodeResultCardView | null;
}

interface PathNodeResultCardView {
  state: 'available' | 'pending';
  label: string;
  evidenceSource: string;
  reviewState: string;
  primaryMetric?: string;
  outcomeId?: string;
  occurredAt?: string;
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
  resultLabel?: string;
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

const DEMO_ADAPTIVE_PRACTICE_EVENT_REFERENCE = {
  sourceScope: 'adaptive-practice-submission',
  occurredAt: '2026-08-03T08:30:00.000Z',
  summary: '自适应练习记录参与了该项能力判断。',
  nextAction: {
    href: '/assessment/adaptive-practice?intent=practice',
    label: '继续自适应练习',
  },
} satisfies StudentSafeEvidenceEventReference;

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
    decisionExplanation: {
      selectionBasis: {
        summary: '依据相位裕度的学习证据安排本路径。',
        confidence: 'medium',
        supportingFacts: ['掌握状态 42%，来自 3 条有效证据，置信度 68%。'],
        limitations: [],
        eventReferences: [DEMO_ADAPTIVE_PRACTICE_EVENT_REFERENCE],
      },
      latestAdjustment: {
        kind: 'advanced',
        summary: '本次确认纠偏后，该节点相对上一版活动路径提前 1 位。',
        supportingFacts: ['先完成基础复习，再进入频域到时域检查。'],
      },
    },
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
    decisionExplanation: {
      selectionBasis: {
        summary: '依据相位裕度的学习证据安排本路径。',
        confidence: 'medium',
        supportingFacts: [
          '掌握状态 42%，来自 3 条有效证据，置信度 68%。',
          '当前状态仍有提升空间，因此优先安排频域到时域检查题。',
        ],
        limitations: [],
        eventReferences: [DEMO_ADAPTIVE_PRACTICE_EVENT_REFERENCE],
      },
    },
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
    decisionExplanation: {
      selectionBasis: {
        summary: '依据相位裕度的学习证据安排本路径。',
        confidence: 'medium',
        supportingFacts: [],
        limitations: [],
      },
    },
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

const DEMO_UNLOCK_CHAIN_PATH_NODES = [
  ...DEMO_CONTROL_CORRECTION_PATH_NODES.slice(0, 2),
  {
    ...DEMO_CONTROL_CORRECTION_PATH_NODES[2],
    readiness: {
      state: 'locked',
      message: '完成检查题并补充仿真证据后解锁。',
      unlockMessage: '完成检查题并补充仿真证据后解锁。',
      reasonCodes: ['readiness-required-completion', 'readiness-minimum-evidence', 'readiness-minimum-competency'],
      fallbackNodeIds: ['demo-current-quiz'],
      missingCompetencies: ['simulationValidation'],
      missingEvidenceCount: 2,
      missingCompletedNodeIds: ['demo-current-quiz'],
      missingOutcomeRefs: ['outcome:simulation-validation'],
    },
  },
  {
    nodeId: 'demo-prerequisite-target',
    title: '进入闭环校正 Arena 终测',
    type: 'arena_task',
    pathNodeType: 'challenge',
    displayName: 'Arena',
    iconKey: 'arena-task',
    shapeHint: 'rounded',
    evidenceBehavior: 'judged-submission',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'arena_task',
    sourceRef: 'demo-prerequisite-target',
    target: '/arena/challenges/task-second-order-lead-pid?journeyFixture=1',
    estimatedTimeMinutes: 40,
    prerequisiteNodeIds: ['demo-current-quiz'],
    knowledgeCoverage: ['闭环校正', '参数验证'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: ['terminal-validation'],
    score: 0.82,
    reasonCodes: ['policy-simulation-driven'],
    status: 'locked',
    readiness: {
      state: 'locked',
      message: '完成当前检查题后会解锁 Arena。',
      unlockMessage: null,
      reasonCodes: ['readiness-fallback'],
      fallbackNodeIds: ['demo-current-quiz'],
      missingCompetencies: [],
      missingEvidenceCount: 0,
      missingCompletedNodeIds: [],
      missingOutcomeRefs: [],
    },
  },
  {
    nodeId: 'demo-prerequisite-text',
    title: '完成课程同步复盘',
    type: 'reflection',
    pathNodeType: 'reflection',
    displayName: '反思复盘',
    iconKey: 'reflection',
    shapeHint: 'rounded',
    evidenceBehavior: 'instrumented',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'reflection',
    sourceRef: 'demo-prerequisite-text',
    target: '/profile/evidence',
    estimatedTimeMinutes: 20,
    prerequisiteNodeIds: ['demo-missing-target'],
    knowledgeCoverage: ['复盘记录'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: [],
    score: 0.76,
    reasonCodes: ['policy-reflection-driven'],
    status: 'locked',
    readiness: {
      state: 'locked',
      message: '完成未知前置复盘节点后会解锁。',
      unlockMessage: null,
      reasonCodes: ['readiness-fallback'],
      fallbackNodeIds: ['demo-missing-target'],
      missingCompetencies: [],
      missingEvidenceCount: 0,
      missingCompletedNodeIds: [],
      missingOutcomeRefs: [],
    },
  },
  {
    nodeId: 'demo-unlock-message-fallback',
    title: '等待 Arena 终测开放',
    type: 'arena_task',
    pathNodeType: 'challenge',
    displayName: 'Arena',
    iconKey: 'arena-task',
    shapeHint: 'rounded',
    evidenceBehavior: 'judged-submission',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'arena_task',
    sourceRef: 'demo-unlock-message-fallback',
    target: '/arena/challenges/task-second-order-lead-pid?journeyFixture=1',
    estimatedTimeMinutes: 35,
    prerequisiteNodeIds: [],
    knowledgeCoverage: ['闭环验证'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: ['terminal-validation'],
    score: 0.8,
    reasonCodes: ['policy-simulation-driven'],
    status: 'locked',
    readiness: {
      state: 'locked',
      message: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
      unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
      reasonCodes: ['readiness-metadata-missing'],
      fallbackNodeIds: [],
      missingCompetencies: [],
      missingEvidenceCount: 0,
      missingCompletedNodeIds: [],
      missingOutcomeRefs: [],
    },
  },
  {
    nodeId: 'demo-unavailable',
    title: '完成教师批注后的复盘节点',
    type: 'reflection',
    pathNodeType: 'reflection',
    displayName: '反思复盘',
    iconKey: 'reflection',
    shapeHint: 'rounded',
    evidenceBehavior: 'instrumented',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: null,
    sourceKind: 'reflection',
    sourceRef: 'demo-unavailable',
    target: '/profile/evidence',
    estimatedTimeMinutes: 20,
    prerequisiteNodeIds: [],
    knowledgeCoverage: ['教师批注复盘'],
    teacherPolicy: 'default',
    privacyLevel: 'learner-private',
    terminalConstraints: [],
    score: 0.74,
    reasonCodes: ['readiness-metadata-missing'],
    status: 'locked',
    readiness: null,
  },
] as unknown as AdaptiveLearningPathPlan['mainPath'];
const DEMO_RECOMMENDATION_PROVENANCE = {
  summary: '依据相位裕度的学习证据安排本路径。',
  confidence: 'medium',
  entries: [{
    targetLabel: '相位裕度',
    targetKind: 'knowledge',
    confidence: 'medium',
    evidenceSummary: '掌握状态 42%，来自 3 条有效证据，置信度 68%。',
    judgment: '当前状态仍有提升空间，因此优先安排频域到时域检查题。',
    affectedNodeIds: ['demo-current-quiz'],
    affectedResourceTitles: ['完成频域到时域检查题'],
    eventReferences: [DEMO_ADAPTIVE_PRACTICE_EVENT_REFERENCE],
  }],
  evidenceReviewHref: '/profile/evidence',
  limitations: [],
  nextAction: null,
} satisfies PathRecommendationProvenance;

const DEMO_LOW_EVIDENCE_RECOMMENDATION_PROVENANCE = {
  summary: '当前证据较少，本路径主要依据课程结构、先修规则和可用资源生成。',
  confidence: 'low',
  entries: [
    ...DEMO_RECOMMENDATION_PROVENANCE.entries,
    {
      targetLabel: '参数设计',
      targetKind: 'competency',
      confidence: 'low',
      evidenceSummary: '能力状态 38%，来自 1 条有效证据，置信度 40%。',
      judgment: '暂时不能确认该项为稳定薄弱点，本路径主要依据课程结构、先修规则和可用资源安排。',
      affectedNodeIds: [],
      affectedResourceTitles: [],
      eventReferences: [{
        sourceScope: 'simulation-workbench-completion',
        occurredAt: '2026-08-02T06:20:00.000Z',
        summary: '控制工作台仿真记录参与了该项能力判断。',
        nextAction: {
          href: '/interactive-learning/control-workbench',
          label: '继续工作台验证',
        },
      }],
    },
  ],
  evidenceReviewHref: '/profile/evidence',
  limitations: ['部分判断的有效证据仍然不足。'],
  nextAction: '完成诊断或练习，补充有效学习证据。',
} satisfies PathRecommendationProvenance;

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
  pathOptions: [{
    optionId: 'path-option-1',
    nodeIds: DEMO_CONTROL_CORRECTION_PATH_NODES.map((node) => node.nodeId),
    recommendationProvenance: DEMO_RECOMMENDATION_PROVENANCE,
  }],
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
    evidence: {
      evidenceBasis: 'adaptive-learner-state',
      confidence: {
        level: 'medium',
        score: 0.76,
        sourceCoverage: 0.68,
      },
      sourceCoverage: {},
      learnerStateDeficits: [{
        targetId: '相位裕度',
        kind: 'knowledge',
        value: 0.42,
        confidence: 0.68,
        evidenceCount: 3,
        reasonCode: 'low-mastery-target',
      }],
      capabilityEvidence: [],
      prerequisiteReasons: [],
      teacherPolicy: [],
      alternatives: [],
    },
  },
} as unknown as AdaptiveLearningPathPlan;

const DEMO_UNLOCK_CHAIN_PATH_PLAN = {
  ...DEMO_CONTROL_CORRECTION_PATH_PLAN,
  id: 'demo-unlock-chain-path',
  currentNodeId: 'demo-current-quiz',
  mainPath: DEMO_UNLOCK_CHAIN_PATH_NODES,
  executionStatus: {
    adopted: true,
    completedNodeIds: ['demo-foundation-card'],
    activeNodeId: 'demo-current-quiz',
    updatedAt: '2026-06-16T09:00:00+08:00',
  },
} as unknown as AdaptiveLearningPathPlan;

const DEMO_LOW_EVIDENCE_PATH_PLAN = {
  ...DEMO_CONTROL_CORRECTION_PATH_PLAN,
  pathOptions: [{
    optionId: 'path-option-1',
    nodeIds: DEMO_CONTROL_CORRECTION_PATH_NODES.map((node) => node.nodeId),
    recommendationProvenance: DEMO_LOW_EVIDENCE_RECOMMENDATION_PROVENANCE,
  }],
  confidence: {
    level: 'high',
    score: 0.82,
    sourceCoverage: 0.72,
  },
  visualization: {
    ...DEMO_CONTROL_CORRECTION_PATH_PLAN.visualization,
    evidence: {
      ...DEMO_CONTROL_CORRECTION_PATH_PLAN.visualization.evidence,
      learnerStateDeficits: [
        ...DEMO_CONTROL_CORRECTION_PATH_PLAN.visualization.evidence.learnerStateDeficits,
        {
          targetId: 'parameterDesign',
          kind: 'competency',
          value: 0.38,
          confidence: 0.4,
          evidenceCount: 1,
          reasonCode: 'low-confidence-competency',
        },
      ],
    },
  },
} as unknown as AdaptiveLearningPathPlan;

const DEMO_LEGACY_PATH_PLAN = {
  ...DEMO_CONTROL_CORRECTION_PATH_PLAN,
  pathOptions: undefined,
  mainPath: DEMO_CONTROL_CORRECTION_PATH_NODES.map((node) => {
    const { decisionExplanation: _decisionExplanation, ...legacyNode } = node as unknown as Record<string, unknown>;
    return legacyNode;
  }),
} as unknown as AdaptiveLearningPathPlan;

type RecommendationProvenanceFixture = 'sufficient' | 'low' | 'legacy';

function resolveRecommendationProvenanceFixture(value: string | null): RecommendationProvenanceFixture {
  if (value === 'low' || value === 'legacy') return value;
  return 'sufficient';
}

function demoRecommendationProvenancePlan(
  fixture: RecommendationProvenanceFixture,
): AdaptiveLearningPathPlan {
  if (fixture === 'low') return DEMO_LOW_EVIDENCE_PATH_PLAN;
  if (fixture === 'legacy') return DEMO_LEGACY_PATH_PLAN;
  return DEMO_CONTROL_CORRECTION_PATH_PLAN;
}

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
      id: 'demo-exec-quiz-result',
      nodeId: 'demo-current-quiz',
      activityKind: 'initial-completion',
      status: 'completed',
      resourceType: 'adaptive_quiz',
      resultSummary: {
        state: 'available',
        label: '自适应练习结果',
        evidenceSource: 'AdaptiveAssessmentAnswer',
        reviewState: 'ready',
        primaryMetric: '得分 100',
        outcomeId: 'demo-answer-1',
      },
      createdAt: '2026-06-16T09:30:00+08:00',
    },
    {
      id: 'demo-exec-simulation-pending',
      nodeId: 'demo-simulation',
      activityKind: 'initial-completion',
      status: 'completed',
      resourceType: 'simulation',
      resultSummary: {
        state: 'pending',
        label: '仿真结果',
        evidenceSource: 'learning-path-execution',
        reviewState: 'pending-sync',
      },
      createdAt: '2026-06-16T09:32:00+08:00',
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

const DEMO_LOCKED_NODE_PATH_ROUND = {
  ...DEMO_CONTROL_CORRECTION_PATH_ROUND,
  lastExecutionMetadata: {
    completedNodeIds: ['demo-foundation-card'],
    failedNodeIds: ['demo-simulation'],
  },
  deviations: [],
} satisfies LearningPathRoundView;

const DEMO_ARENA_JOURNEY_NODE = {
  ...DEMO_CONTROL_CORRECTION_PATH_NODES[1],
  nodeId: 'arena-task:task-second-order-lead-pid',
  title: '完成二阶系统校正 Arena 挑战',
  type: 'arena_task',
  pathNodeType: 'challenge',
  displayName: 'Arena',
  iconKey: 'arena-task',
  evidenceBehavior: 'judged-submission',
  sourceKind: 'arena_task',
  sourceRef: 'task-second-order-lead-pid',
  target: '/arena/challenges/task-second-order-lead-pid?journeyFixture=1&publicationId=publication-path-e2e&publicationId=publication-forged&classId=class-path-e2e&classId=class-forged&seasonId=season-path-e2e&seasonId=season-forged',
  prerequisiteNodeIds: [],
  status: 'current',
} as unknown as AdaptiveLearningPathPlan['mainPath'][number];

const DEMO_ARENA_JOURNEY_PATH_PLAN = {
  ...DEMO_CONTROL_CORRECTION_PATH_PLAN,
  id: 'path-arena-e2e',
  currentNodeId: DEMO_ARENA_JOURNEY_NODE.nodeId,
  mainPath: [DEMO_ARENA_JOURNEY_NODE],
  executionStatus: {
    ...DEMO_CONTROL_CORRECTION_PATH_PLAN.executionStatus,
    completedNodeIds: [],
    activeNodeId: DEMO_ARENA_JOURNEY_NODE.nodeId,
  },
} as unknown as AdaptiveLearningPathPlan;

const DEMO_ARENA_JOURNEY_PATH_ROUND = {
  ...DEMO_CONTROL_CORRECTION_PATH_ROUND,
  id: 'path-arena-e2e',
  title: 'Arena 连续学习路径',
  currentNodeId: DEMO_ARENA_JOURNEY_NODE.nodeId,
  lastExecutionMetadata: { completedNodeIds: [], failedNodeIds: [] },
  executions: [],
  deviations: [],
  interventions: [],
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

function recommendationConfidenceLabel(confidence: 'low' | 'medium' | 'high'): string {
  if (confidence === 'high') return '高置信度';
  if (confidence === 'medium') return '中等置信度';
  return '低置信度';
}

function evidenceSourceLabel(sourceScope: EvidenceTimelineLearnerRecordSourceScope): string {
  if (sourceScope === 'interactive-lesson-submission') return '互动课程作答';
  if (sourceScope === 'arena-official-result') return 'Arena 官方评测';
  if (sourceScope === 'arena-preview-result') return 'Arena 预览';
  if (sourceScope === 'simulation-workbench-completion') return '控制工作台';
  return '自适应练习';
}

function formatEvidenceOccurredAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '时间未知';
}

function StudentEvidenceEventList({
  references,
  emptyMessage,
}: {
  references: StudentSafeEvidenceEventReference[];
  emptyMessage: string;
}) {
  if (references.length === 0) {
    return <p className="mt-2 break-words text-xs leading-5 text-subtle">{emptyMessage}</p>;
  }
  return (
    <ul className="mt-2 min-w-0 divide-y divide-border border-y border-border" data-adaptive-path-event-evidence>
      {references.map((reference, index) => (
        <li
          key={`${reference.sourceScope}:${reference.occurredAt}:${index}`}
          className="grid min-w-0 gap-1 py-2 text-xs leading-5"
        >
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">{evidenceSourceLabel(reference.sourceScope)}</span>
            <time className="break-words text-subtle" dateTime={reference.occurredAt}>
              {formatEvidenceOccurredAt(reference.occurredAt)}
            </time>
          </div>
          <p className="break-words text-subtle">{reference.summary}</p>
          <Link
            href={reference.nextAction.href}
            className="inline-flex w-fit max-w-full items-center gap-1 break-words font-medium text-primary hover:underline"
          >
            {reference.nextAction.label}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PathRecommendationProvenance({ option }: { option: AdaptivePathOptionDisplay }) {
  const provenance = option.recommendationProvenance;
  if (!option.isGenerated || !provenance) return null;

  return (
    <section
      className="mt-3 min-w-0 rounded-lg border border-primary/25 bg-primary/5 p-3"
      data-learning-path-recommendation-provenance={option.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">推荐依据</p>
        <span className="rounded-md border border-border bg-background/70 px-2 py-1 text-xs text-subtle">
          {recommendationConfidenceLabel(provenance.confidence)}
        </span>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-foreground">{provenance.summary}</p>
      <details className="mt-3 border-t border-border pt-3 text-sm" data-learning-path-recommendation-disclosure={option.id}>
        <summary className="cursor-pointer font-medium text-foreground">查看推荐依据</summary>
        <div className="mt-3 grid min-w-0 gap-3">
          {provenance.entries.map((entry, index) => (
            <article
              key={`${option.id}:${entry.targetLabel}:${index}`}
              className="min-w-0 rounded-lg border border-border bg-background/65 p-3"
              data-learning-path-recommendation-entry={entry.targetKind}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="break-words text-sm font-semibold text-foreground">{entry.targetLabel}</h4>
                <span className="text-xs text-subtle">{recommendationConfidenceLabel(entry.confidence)}</span>
              </div>
              <dl className="mt-3 grid min-w-0 gap-2 text-xs leading-5">
                <div>
                  <dt className="font-medium text-foreground">学习证据</dt>
                  <dd className="mt-1 break-words text-subtle">{entry.evidenceSummary}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">能力判断与路径影响</dt>
                  <dd className="mt-1 break-words text-subtle">{entry.judgment}</dd>
                </div>
                {entry.affectedResourceTitles.length > 0 ? (
                  <div>
                    <dt className="font-medium text-foreground">受影响的推荐资源</dt>
                    <dd className="mt-1 break-words text-subtle">{entry.affectedResourceTitles.join('、')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-medium text-foreground">相关学习事件</dt>
                  <dd>
                    <StudentEvidenceEventList
                      references={entry.eventReferences ?? []}
                      emptyMessage="该项判断尚无可核验的事件级学习记录。"
                    />
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {provenance.limitations.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/35 p-3 text-xs leading-5 text-subtle">
              {provenance.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}
            </div>
          ) : null}
          {provenance.nextAction ? (
            <p className="break-words text-xs leading-5 text-foreground">下一步：{provenance.nextAction}</p>
          ) : null}
          <Link
            href={provenance.evidenceReviewHref}
            className="inline-flex w-fit max-w-full items-center gap-1 break-words text-xs font-medium text-primary hover:underline"
          >
            查看学习记录并复核证据
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </details>
    </section>
  );
}

function PathOptionRoutePreview({ option }: { option: AdaptivePathOptionDisplay }) {
  if (!option.isGenerated) return null;
  if (!option.orderedNodes) {
    return (
      <div
        className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs leading-5 text-subtle"
        data-learning-path-route-preview="unavailable"
      >
        详细学习步骤暂不可用；请生成新的学习路径后查看具体资源安排。
      </div>
    );
  }

  const visibleNodes = option.orderedNodes.slice(0, 4);
  const remainingNodes = option.orderedNodes.slice(4);
  const renderNode = (node: typeof option.orderedNodes[number], index: number) => {
    const Icon = adaptivePathResourceIcons[node.kind];
    return (
      <li key={node.nodeId} className="relative flex gap-2.5 pb-3 last:pb-0">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/5 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-foreground">{node.title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-subtle">
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-1.5 py-0.5">
              <Icon className="size-3" aria-hidden="true" />
              {node.resourceLabel}
            </span>
            <span className="rounded-md border border-border bg-muted/30 px-1.5 py-0.5">{node.estimatedTime}</span>
            <span className="rounded-md border border-border bg-muted/30 px-1.5 py-0.5">{node.statusLabel}</span>
            {node.comparisonLabel ? (
              <span className="rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-primary">
                {node.comparisonLabel}
              </span>
            ) : null}
          </div>
          {node.unlockChain ? (
            <AdaptivePathUnlockChainView chain={node.unlockChain} />
          ) : node.unlockMessage ? (
            <p className="mt-1 text-xs leading-5 text-subtle">解锁条件：{node.unlockMessage}</p>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section
      className="mt-3 rounded-lg border border-border bg-background/60 p-3"
      data-learning-path-route-preview={option.id}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">学习步骤</p>
        <span className="text-xs text-subtle">共 {option.orderedNodes.length} 步</span>
      </div>
      <ol className="mt-3">{visibleNodes.map(renderNode)}</ol>
      {remainingNodes.length > 0 ? (
        <details className="mt-3 border-t border-border pt-3 text-sm" data-learning-path-route-disclosure="full">
          <summary className="cursor-pointer font-medium text-foreground">展开完整路径（共 {option.orderedNodes.length} 步）</summary>
          <p className="mt-2 text-xs leading-5 text-subtle">以下为前四步之后的学习安排。</p>
          <ol className="mt-3" start={5}>
            {remainingNodes.map((node, index) => renderNode(node, index + 4))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

const generationGoalOptions = getAdaptivePracticeGoalOptions();

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
    intentParam === 'path-selection' ||
    intentParam === 'path-execution' ||
    intentParam === 'evidence-review' ||
    intentParam === 'contextual-recommendation'
  ) {
    return intentParam;
  }
  return 'practice';
}

function resolveAdaptivePracticeGoalId(
  value: string | null | undefined,
  fallback: AdaptivePracticeGoalId = 'control-correction',
): AdaptivePracticeGoalId {
  const candidate = value ?? null;
  return isAdaptivePracticeGoalId(candidate) ? candidate : fallback;
}

const pathGenerationPanelSessionPrefix = 'adaptive-path-generation-panel:';

function pathGenerationPanelSessionKey(goalId: AdaptivePracticeGoalId): string {
  return `${pathGenerationPanelSessionPrefix}${goalId}`;
}

function storePathGenerationPanelForGoal(goalId: AdaptivePracticeGoalId, panel: PathGenerationPanelState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(pathGenerationPanelSessionKey(goalId), JSON.stringify(panel));
  } catch {
    // Session storage is best-effort; structured URL fields still survive.
  }
}

function takeStoredPathGenerationPanel(goalId: AdaptivePracticeGoalId | null): PathGenerationPanelState | null {
  if (!goalId || typeof window === 'undefined') return null;
  const key = pathGenerationPanelSessionKey(goalId);
  try {
    const raw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PathGenerationPanelState>;
    if (parsed.goalId !== goalId) return null;
    return {
      ...defaultPathGenerationPanel,
      ...parsed,
      goalId,
      resourcePreference: Array.isArray(parsed.resourcePreference)
        ? parsed.resourcePreference.filter((item): item is AdaptivePathResourceKind =>
            generationResourceOptions.some((option) => option.id === item))
        : defaultPathGenerationPanel.resourcePreference,
      naturalLanguageIntent: typeof parsed.naturalLanguageIntent === 'string'
        ? parsed.naturalLanguageIntent
        : '',
    };
  } catch {
    return null;
  }
}

function uniquePathIds(pathIds: Array<string | null | undefined>): string[] {
  return Array.from(new Set(pathIds.filter((pathId): pathId is string => Boolean(pathId))));
}

function compactPathNodeTitle(title?: string): string {
  if (!title) return '入门诊断';
  return title.length > 12 ? '入门诊断' : title;
}

type LearningPathRoundLoadResult =
  | { status: 'loaded'; round: LearningPathRoundView; plan: AdaptiveLearningPathPlan }
  | { status: 'missing' }
  | { status: 'failed' };

async function fetchLearningPathRound(
  pathId: string,
  goalId: AdaptivePracticeGoalId,
): Promise<LearningPathRoundLoadResult> {
  try {
    const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}`);
    if (!pathResponse.ok) return pathResponse.status === 404 ? { status: 'missing' } : { status: 'failed' };
    const payload = (await pathResponse.json()) as LearningPathRoundResponse;
    const restoredPlan = restoreAdaptiveLearningPathPlanFromRound(payload.path ?? null);
    if (payload.path?.goalId !== goalId || !restoredPlan) return { status: 'missing' };
    return { status: 'loaded', round: payload.path, plan: restoredPlan };
  } catch {
    return { status: 'failed' };
  }
}

async function fetchLatestLearningPathRound(
  goalId: AdaptivePracticeGoalId,
): Promise<LearningPathRoundLoadResult> {
  try {
    const pathResponse = await fetch(`/api/learning-paths/latest?goal=${encodeURIComponent(goalId)}`);
    if (!pathResponse.ok) return { status: 'failed' };
    const payload = (await pathResponse.json()) as LearningPathRoundResponse;
    const restoredPlan = restoreAdaptiveLearningPathPlanFromRound(payload.path ?? null);
    if (payload.path?.goalId !== goalId || !restoredPlan) return { status: 'missing' };
    return { status: 'loaded', round: payload.path, plan: restoredPlan };
  } catch {
    return { status: 'failed' };
  }
}

async function fetchCandidateBatch(
  goalId: AdaptivePracticeGoalId,
  batchId?: string | null,
  candidateId?: string | null,
): Promise<CandidateBatchLoadResult> {
  try {
    const href = batchId
      ? `/api/learning-paths/candidate-batches/${encodeURIComponent(batchId)}${candidateId ? `?candidate=${encodeURIComponent(candidateId)}` : ''}`
      : `/api/learning-paths/candidate-batches/latest?goal=${encodeURIComponent(goalId)}`;
    const response = await fetch(href);
    if (!response.ok) return response.status === 404 ? { status: 'missing' } : { status: 'failed' };
    const payload = (await response.json()) as { batch?: AdaptivePathCandidateBatchView | null };
    if (!payload.batch || payload.batch.goalId !== goalId) return { status: 'missing' };
    return { status: 'loaded', batch: payload.batch };
  } catch {
    return { status: 'failed' };
  }
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

function readPathDifferenceExplanation(value: unknown): PathDifferenceExplanation | null {
  const record = getRecord(value);
  const status = record.status;
  const pathId = typeof record.pathId === 'string' ? record.pathId : '';
  if ((status !== 'ready' && status !== 'no-material-difference' && status !== 'insufficient-data') || !pathId) {
    return null;
  }
  const options = Array.isArray(record.options)
    ? record.options.map((item) => {
        const option = getRecord(item);
        const metrics = getRecord(option.metrics);
        const estimatedMinutes = metrics.estimatedMinutes;
        return {
          optionId: typeof option.optionId === 'string' ? option.optionId : '',
          styleId: typeof option.styleId === 'string' ? option.styleId : '',
          label: typeof option.label === 'string' ? option.label : '',
          metrics: {
            estimatedMinutes: typeof estimatedMinutes === 'number' ? estimatedMinutes : null,
            nodeCount: typeof metrics.nodeCount === 'number' ? metrics.nodeCount : 0,
            resourceMix: getNumberRecord(metrics.resourceMix),
            readiness: getNumberRecord(metrics.readiness),
            readinessSummary: Array.isArray(metrics.readinessSummary)
              ? metrics.readinessSummary.map((item) => {
                  const readiness = getRecord(item);
                  return {
                    nodeId: typeof readiness.nodeId === 'string' ? readiness.nodeId : '',
                    state: typeof readiness.state === 'string' ? readiness.state : '',
                    message: typeof readiness.message === 'string' ? readiness.message : '',
                  };
                }).filter((item) => item.nodeId && item.state)
              : [],
            checkpointCount: typeof metrics.checkpointCount === 'number' ? metrics.checkpointCount : 0,
            checkpointNodeIds: getStringArray(metrics.checkpointNodeIds),
            lockedNodeCount: typeof metrics.lockedNodeCount === 'number' ? metrics.lockedNodeCount : 0,
            lockedNodeIds: getStringArray(metrics.lockedNodeIds),
            terminalValidationCount: typeof metrics.terminalValidationCount === 'number'
              ? metrics.terminalValidationCount
              : 0,
            terminalValidationNodeIds: getStringArray(metrics.terminalValidationNodeIds),
          },
        };
      }).filter((option) => option.optionId && option.styleId && option.label)
    : [];
  if (options.length !== 2) return null;
  const readNode = (item: unknown): PathDifferenceNode | null => {
    const node = getRecord(item);
    const nodeId = typeof node.nodeId === 'string' ? node.nodeId : '';
    const title = typeof node.title === 'string' ? node.title : '';
    const resourceType = typeof node.resourceType === 'string' ? node.resourceType : '';
    return nodeId && title && resourceType ? { nodeId, title, resourceType } : null;
  };
  const commonNodes = Array.isArray(record.commonNodes)
    ? record.commonNodes.map((item) => {
        const node = readNode(item);
        const positions = getRecord(item).positions;
        return node && Array.isArray(positions) && positions.length === 2
          && positions.every((position) => typeof position === 'number')
          ? { ...node, positions: positions as [number, number] }
          : null;
      }).filter((node): node is PathDifferenceExplanation['commonNodes'][number] => Boolean(node))
    : [];
  const optionOnlyNodes = Array.isArray(record.optionOnlyNodes)
    ? record.optionOnlyNodes.map((item) => {
        const group = getRecord(item);
        const optionId = typeof group.optionId === 'string' ? group.optionId : '';
        const nodes = Array.isArray(group.nodes)
          ? group.nodes.map((nodeValue) => {
              const node = readNode(nodeValue);
              const position = getRecord(nodeValue).position;
              return node && typeof position === 'number' ? { ...node, position } : null;
            }).filter((node): node is PathDifferenceExplanation['optionOnlyNodes'][number]['nodes'][number] => Boolean(node))
          : [];
        return optionId ? { optionId, nodes } : null;
      }).filter((group): group is PathDifferenceExplanation['optionOnlyNodes'][number] => Boolean(group))
    : [];
  const orderDifferences = Array.isArray(record.orderDifferences)
    ? record.orderDifferences.map((item) => {
        const difference = getRecord(item);
        const positions = difference.positions;
        return typeof difference.nodeId === 'string'
          && typeof difference.title === 'string'
          && Array.isArray(positions)
          && positions.length === 2
          && positions.every((position) => typeof position === 'number')
          ? {
              nodeId: difference.nodeId,
              title: difference.title,
              positions: positions as [number, number],
            }
          : null;
      }).filter((difference): difference is PathDifferenceExplanation['orderDifferences'][number] => Boolean(difference))
    : [];
  return {
    status,
    pathId,
    options,
    commonNodes,
    optionOnlyNodes,
    orderDifferences,
    tradeoffs: getStringArray(record.tradeoffs),
    limitations: getStringArray(record.limitations),
  };
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
      nodeIds: getStringArray(option.nodeIds),
      activeNodeIds: getStringArray(option.activeNodeIds),
      nodeSummaries: Array.isArray(option.nodeSummaries)
        ? option.nodeSummaries.map((item) => {
            const summary = getRecord(item);
            return {
              nodeId: typeof summary.nodeId === 'string' ? summary.nodeId : 'unknown-node',
              title: typeof summary.title === 'string' ? summary.title : '学习节点',
              pathNodeType: typeof summary.pathNodeType === 'string' ? summary.pathNodeType : undefined,
              displayName: typeof summary.displayName === 'string' ? summary.displayName : undefined,
              iconKey: typeof summary.iconKey === 'string' ? summary.iconKey : undefined,
              shapeHint: typeof summary.shapeHint === 'string' ? summary.shapeHint : undefined,
              evidenceBehavior: typeof summary.evidenceBehavior === 'string' ? summary.evidenceBehavior : undefined,
              evidenceStatus: typeof summary.evidenceStatus === 'string' ? summary.evidenceStatus : undefined,
              estimatedTimeMinutes: typeof summary.estimatedTimeMinutes === 'number' ? summary.estimatedTimeMinutes : undefined,
              status: typeof summary.status === 'string' ? summary.status : undefined,
            };
          })
        : [],
      lockedNodeIds: getStringArray(option.lockedNodeIds),
      readinessSummary: Array.isArray(option.readinessSummary)
        ? option.readinessSummary.map((item) => {
            const readiness = getRecord(item);
            return {
              nodeId: typeof readiness.nodeId === 'string' ? readiness.nodeId : 'unknown-node',
              state: typeof readiness.state === 'string' ? readiness.state : 'ready',
              message: typeof readiness.message === 'string' ? readiness.message : '',
            };
          })
        : [],
      readinessDetails: Array.isArray(option.readinessDetails)
        ? option.readinessDetails.map((item) => {
            const detail = getRecord(item);
            return {
              nodeId: typeof detail.nodeId === 'string' ? detail.nodeId : 'unknown-node',
              title: typeof detail.title === 'string' ? detail.title : undefined,
              target: typeof detail.target === 'string' ? detail.target : undefined,
              type: typeof detail.type === 'string' ? detail.type : undefined,
              status: typeof detail.status === 'string' ? detail.status : undefined,
              prerequisiteNodeIds: getStringArray(detail.prerequisiteNodeIds),
              readiness: getAdaptivePathUnlockReadiness(detail.readiness),
            };
          })
        : [],
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
      expectedTargetLift: typeof option.expectedTargetLift === 'number' ? option.expectedTargetLift : undefined,
      limitations: getStringArray(option.limitations),
      recommendationProvenance: getPathRecommendationProvenance(option.recommendationProvenance),
    };
  });
}

function getAdaptivePathUnlockReadiness(
  value: unknown,
): AdaptivePathUnlockChainNodeInput['readiness'] {
  const readiness = getRecord(value);
  return {
    state: typeof readiness.state === 'string' ? readiness.state : undefined,
    message: typeof readiness.message === 'string' ? readiness.message : undefined,
    unlockMessage: typeof readiness.unlockMessage === 'string' ? readiness.unlockMessage : undefined,
    fallbackNodeIds: getStringArray(readiness.fallbackNodeIds),
    missingCompetencies: getStringArray(readiness.missingCompetencies),
    missingEvidenceCount: typeof readiness.missingEvidenceCount === 'number'
      ? readiness.missingEvidenceCount
      : undefined,
    missingCompletedNodeIds: getStringArray(readiness.missingCompletedNodeIds),
    missingOutcomeRefs: getStringArray(readiness.missingOutcomeRefs),
  };
}

function getCandidateBatchPathOptions(batch: AdaptivePathCandidateBatchView | null): PathOptionView[] {
  if (!batch) return [];
  return batch.candidates.flatMap((candidate) => {
    const projected = getPathOptions({
      panels: [{ region: 'current-path', payload: { pathOptions: [candidate.snapshot] } }],
    } as ControlCorrectionLearningCenterView)[0];
    return projected && projected.optionId !== 'unknown-option'
      ? [{ ...projected, batchId: batch.id, candidateId: candidate.id }]
      : [];
  });
}

function getPathRecommendationProvenance(
  value: unknown,
): AdaptivePathOptionWriteOption['recommendationProvenance'] {
  const provenance = getRecord(value);
  const confidence = provenance.confidence;
  if (typeof provenance.summary !== 'string' ||
    (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') ||
    provenance.evidenceReviewHref !== '/profile/evidence') {
    return undefined;
  }
  const entries = (Array.isArray(provenance.entries) ? provenance.entries : [])
    .map(getRecord)
    .map((entry): PathRecommendationProvenanceEntry | null => {
      const entryConfidence = entry.confidence;
      const targetKind = entry.targetKind;
      if (typeof entry.targetLabel !== 'string' ||
        typeof entry.evidenceSummary !== 'string' ||
        typeof entry.judgment !== 'string' ||
        (entryConfidence !== 'low' && entryConfidence !== 'medium' && entryConfidence !== 'high') ||
        (targetKind !== 'knowledge' && targetKind !== 'competency')) {
        return null;
      }
      return {
        targetLabel: entry.targetLabel,
        targetKind,
        confidence: entryConfidence,
        evidenceSummary: entry.evidenceSummary,
        judgment: entry.judgment,
        affectedNodeIds: getStringArray(entry.affectedNodeIds),
        affectedResourceTitles: getStringArray(entry.affectedResourceTitles),
        eventReferences: getStudentSafeEvidenceEventReferences(entry.eventReferences),
      };
    })
    .filter((entry): entry is PathRecommendationProvenanceEntry => entry !== null);
  return {
    summary: provenance.summary,
    confidence,
    entries,
    evidenceReviewHref: '/profile/evidence',
    limitations: getStringArray(provenance.limitations),
    nextAction: typeof provenance.nextAction === 'string' ? provenance.nextAction : null,
  };
}

function getStudentSafeEvidenceEventReferences(value: unknown): StudentSafeEvidenceEventReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StudentSafeEvidenceEventReference[] => {
    const record = getRecord(item);
    const sourceScope = readEvidenceSourceScope(record.sourceScope);
    const occurredAt = typeof record.occurredAt === 'string' && Number.isFinite(new Date(record.occurredAt).getTime())
      ? record.occurredAt
      : null;
    const summary = typeof record.summary === 'string' && record.summary.trim().length > 0
      ? record.summary
      : null;
    const nextAction = getRecord(record.nextAction);
    const href = typeof nextAction.href === 'string' && isSafeEvidenceActionHref(sourceScope, nextAction.href)
      ? nextAction.href
      : null;
    const label = typeof nextAction.label === 'string' && nextAction.label.trim().length > 0
      ? nextAction.label
      : null;
    return sourceScope && occurredAt && summary && href && label
      ? [{ sourceScope, occurredAt, summary, nextAction: { href, label } }]
      : [];
  });
}

function readEvidenceSourceScope(value: unknown): EvidenceTimelineLearnerRecordSourceScope | null {
  return value === 'interactive-lesson-submission' ||
    value === 'arena-official-result' ||
    value === 'arena-preview-result' ||
    value === 'simulation-workbench-completion' ||
    value === 'adaptive-practice-submission'
    ? value
    : null;
}

function isSafeEvidenceActionHref(
  sourceScope: EvidenceTimelineLearnerRecordSourceScope | null,
  href: string,
): boolean {
  if (!sourceScope) return false;
  if (sourceScope === 'arena-official-result' || sourceScope === 'arena-preview-result') {
    return href === '/arena';
  }
  if (sourceScope === 'simulation-workbench-completion') {
    return href === '/interactive-learning/control-workbench';
  }
  if (sourceScope === 'adaptive-practice-submission') {
    return href === '/assessment/adaptive-practice?intent=practice';
  }
  try {
    const url = new URL(href, 'https://student.local');
    return url.origin === 'https://student.local' &&
      url.pathname === '/profile/evidence' &&
      [...url.searchParams.keys()].every((key) => key === 'lessonId');
  } catch {
    return false;
  }
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

type PathConfigurationFulfillmentView = {
  key: string;
  status: 'applied' | 'unmet';
  effect: string;
  message: string;
};

function getPathConfigurationFulfillment(view: ControlCorrectionLearningCenterView | null): PathConfigurationFulfillmentView[] {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  return (Array.isArray(payload.configurationFulfillment) ? payload.configurationFulfillment : [])
    .map(getRecord)
    .map((entry) => ({
      key: typeof entry.key === 'string' ? entry.key : 'configuration',
      status: entry.status === 'unmet' ? 'unmet' as const : 'applied' as const,
      effect: typeof entry.effect === 'string' ? entry.effect : '',
      message: typeof entry.message === 'string' ? entry.message : '',
    }))
    .filter((entry) => entry.effect || entry.message);
}

function getPathBudgetLimitation(view: ControlCorrectionLearningCenterView | null) {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const requestedMinutes = typeof payload.requestedTimeBudgetMinutes === 'number'
    ? payload.requestedTimeBudgetMinutes
    : null;
  const minimumMinutes = typeof payload.minimumTimeBudgetMinutes === 'number'
    ? payload.minimumTimeBudgetMinutes
    : null;
  return {
    insufficient: payload.timeBudgetInsufficient === true,
    requestedMinutes,
    minimumMinutes,
  };
}

function hasPathComparisonDiversityLimitation(fallback: Record<string, unknown> | null): boolean {
  const studentVisibleReasons = new Set([
    '路径差异不足',
    '资源形式差异不足',
    '学习时长差异不足',
    '路径选项过于接近',
  ]);
  return getStringArray(getRecord(fallback).fallbackReasons)
    .some((reason) => studentVisibleReasons.has(reason));
}

const SKIP_WARNING_TEXT = '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。';

function formatResourceType(type: string): string {
  return getAdaptivePathResourceVisual(type).label;
}

function formatReadinessState(state: string): string {
  if (state === 'ready') return '可开始';
  if (state === 'locked') return '待解锁';
  if (state === 'preparation-required') return '需准备';
  return '待确认';
}

function PathDifferenceExplanationPanel({ explanation }: { explanation: PathDifferenceExplanation }) {
  const [left, right] = explanation.options;
  if (!left || !right) return null;
  const nodeLabels = new Map<string, string>([
    ...explanation.commonNodes.map((node) => [node.nodeId, node.title] as const),
    ...explanation.optionOnlyNodes.flatMap((group) => group.nodes.map((node) => [node.nodeId, node.title] as const)),
  ]);
  const formatNodeIdentities = (nodeIds: string[]) => nodeIds
    .map((nodeId) => nodeLabels.get(nodeId) ?? nodeId)
    .join('、');
  return (
    <section
      className="min-w-0 space-y-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-xs leading-5 text-foreground"
      role="status"
      aria-live="polite"
      data-learning-path-difference-explanation={explanation.pathId}
    >
      <p className="break-words font-semibold">
        正在比较：{left.label} ↔ {right.label}
      </p>

      {explanation.status === 'insufficient-data' ? (
        <p>当前路径缺少完整节点信息，暂时无法生成可靠的差异解释。</p>
      ) : explanation.status === 'no-material-difference' ? (
        <p>两条路径目前没有实质差异。</p>
      ) : (
        <>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {explanation.options.map((option) => {
              const resourceMix = Object.entries(option.metrics.resourceMix)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => `${formatResourceType(type)} ${count}`)
                .join('、');
              const readiness = Object.entries(option.metrics.readiness)
                .filter(([, count]) => count > 0)
                .map(([state, count]) => `${formatReadinessState(state)} ${count}`)
                .join('、');
              const readinessDetails = option.metrics.readinessSummary
                .map((item) => `${nodeLabels.get(item.nodeId) ?? item.nodeId}：${formatReadinessState(item.state)}${item.message ? `（${item.message}）` : ''}`)
                .join('；');
              return (
                <div key={option.optionId} className="min-w-0 rounded-md border border-border bg-background/70 p-2">
                  <p className="break-words font-medium">{option.label}</p>
                  <p className="mt-1 break-words text-subtle">
                    {option.metrics.estimatedMinutes === null ? '时长待确认' : `${option.metrics.estimatedMinutes} 分钟`}
                    {' · '}{option.metrics.nodeCount} 个节点
                    {' · '}{option.metrics.checkpointCount} 个检查点
                  </p>
                  <p className="mt-1 break-words text-subtle">
                    锁定 {option.metrics.lockedNodeCount} 个 · 终点验证 {option.metrics.terminalValidationCount} 个
                  </p>
                  <p className="mt-1 break-words text-subtle">资源：{resourceMix || '未提供'}</p>
                  <p className="mt-1 break-words text-subtle">准备度：{readiness || '未提供'}</p>
                  <p className="mt-1 break-words text-subtle">准备度明细：{readinessDetails || '未提供'}</p>
                  <p className="mt-1 break-words text-subtle">
                    检查点：{formatNodeIdentities(option.metrics.checkpointNodeIds) || '无'}
                  </p>
                  <p className="mt-1 break-words text-subtle">
                    锁定节点：{formatNodeIdentities(option.metrics.lockedNodeIds) || '无'}
                  </p>
                  <p className="mt-1 break-words text-subtle">
                    终点验证：{formatNodeIdentities(option.metrics.terminalValidationNodeIds) || '无'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="min-w-0">
            <p className="font-medium">共同节点</p>
            {explanation.commonNodes.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {explanation.commonNodes.map((node) => (
                  <li key={node.nodeId} className="break-words">
                    {node.title}（{formatResourceType(node.resourceType)}；位置 {node.positions[0]} / {node.positions[1]}）
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-subtle">无共同节点。</p>}
          </div>

          {explanation.optionOnlyNodes.map((group) => {
            const option = explanation.options.find((candidate) => candidate.optionId === group.optionId);
            return (
              <div key={group.optionId} className="min-w-0">
                <p className="break-words font-medium">{option?.label ?? group.optionId}独有节点</p>
                {group.nodes.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {group.nodes.map((node) => (
                      <li key={node.nodeId} className="break-words">
                        第 {node.position} 步：{node.title}（{formatResourceType(node.resourceType)}）
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-subtle">无独有节点。</p>}
              </div>
            );
          })}

          {explanation.orderDifferences.length > 0 ? (
            <div className="min-w-0">
              <p className="font-medium">顺序差异</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {explanation.orderDifferences.map((difference) => (
                  <li key={difference.nodeId} className="break-words">
                    {difference.title}：{left.label}第 {difference.positions[0]} 步，{right.label}第 {difference.positions[1]} 步。
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="min-w-0">
            <p className="font-medium">方案取舍</p>
            {explanation.tradeoffs.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {explanation.tradeoffs.map((tradeoff) => <li key={tradeoff} className="break-words">{tradeoff}</li>)}
              </ul>
            ) : <p className="mt-1 text-subtle">当前指标没有可量化的差异。</p>}
          </div>
        </>
      )}

      {explanation.limitations.length > 0 ? (
        <div className="min-w-0">
          <p className="font-medium">比较限制</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-subtle">
            {explanation.limitations.map((limitation) => <li key={limitation} className="break-words">{limitation}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
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

function isComplexOutcomeNode(type: string): boolean {
  return isPathAssessmentResultNode(type) ||
    type === 'control_workbench' ||
    type === 'simulation' ||
    type === 'arena_task';
}

function isPathAssessmentResultNode(type: string): boolean {
  return type === 'adaptive_quiz' || type === 'checkpoint';
}

function readPathNodeResultSummary(record: Record<string, unknown>, type: string): PathNodeResultCardView | null {
  const summary = getRecord(record.resultSummary);
  const state = summary.state === 'available' ? 'available' : summary.state === 'pending' ? 'pending' : null;
  if (!state) return null;
  return {
    state,
    label: typeof summary.label === 'string' ? summary.label : `${formatResourceType(type)}结果`,
    evidenceSource: typeof summary.evidenceSource === 'string' ? summary.evidenceSource : 'learning-path-execution',
    reviewState: typeof summary.reviewState === 'string' ? summary.reviewState : state === 'available' ? 'ready' : 'pending-sync',
    primaryMetric: typeof summary.primaryMetric === 'string' ? summary.primaryMetric : undefined,
    outcomeId: typeof summary.outcomeId === 'string' ? summary.outcomeId : undefined,
    occurredAt: typeof summary.occurredAt === 'string' ? summary.occurredAt : undefined,
  };
}

function buildPathNodeResultCards(round: LearningPathRoundView | null): Map<string, PathNodeResultCardView> {
  const results = new Map<string, PathNodeResultCardView>();
  for (const execution of round?.executions ?? []) {
    const record = getRecord(execution);
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : null;
    const type = typeof record.resourceType === 'string' ? record.resourceType : 'resource';
    if (!nodeId || record.status !== 'completed' || !isComplexOutcomeNode(type)) continue;
    const result = readPathNodeResultSummary(record, type) ?? {
      state: 'pending',
      label: `${formatResourceType(type)}结果`,
      evidenceSource: 'learning-path-execution',
      reviewState: 'pending-sync',
    };
    results.set(nodeId, result);
  }
  return results;
}

function getPathExecutionSourceNodes(
  plan: AdaptiveLearningPathPlan,
  selectedOption: PathOptionView | null,
): Array<Record<string, unknown>> {
  const optionNodeIds = selectedOption?.nodeIds ?? [];
  if (optionNodeIds.length === 0) return plan.mainPath.map(getRecord);
  const mainPathByNodeId = new Map(plan.mainPath.map((item) => {
    const node = getRecord(item);
    return [typeof node.nodeId === 'string' ? node.nodeId : '', node] as const;
  }).filter(([nodeId]) => nodeId.length > 0));
  const selectedNodes = optionNodeIds
    .map((nodeId) => mainPathByNodeId.get(nodeId))
    .filter((node): node is Record<string, unknown> => Boolean(node));
  if (selectedNodes.length === optionNodeIds.length) return selectedNodes;
  const summariesByNodeId = new Map((selectedOption?.nodeSummaries ?? []).map((summary) => [summary.nodeId, summary]));
  return optionNodeIds.map((nodeId, index) => {
    const node = mainPathByNodeId.get(nodeId);
    if (node) return node;
    const summary = summariesByNodeId.get(nodeId);
    return {
      nodeId,
      title: summary?.title ?? summary?.displayName ?? `学习节点 ${index + 1}`,
      type: inferResourceTypeFromOptionNode(nodeId, summary?.pathNodeType),
      target: '/assessment/adaptive-practice',
      estimatedTimeMinutes: summary?.estimatedTimeMinutes ?? 0,
      status: index === 0 ? 'current' : summary?.status ?? 'locked',
      reasonCodes: ['selected-path-option-summary'],
      knowledgeCoverage: [],
      readiness: {
        state: 'ready',
      },
    };
  });
}

function inferResourceTypeFromOptionNode(nodeId: string, pathNodeType?: string): string {
  if (nodeId.startsWith('simulation:')) return 'simulation';
  if (nodeId.startsWith('arena-task:')) return 'arena_task';
  if (nodeId.startsWith('adaptive-quiz:')) return 'adaptive_quiz';
  if (nodeId.startsWith('quiz:')) return 'quiz';
  if (nodeId.startsWith('control-workbench:')) return 'control_workbench';
  if (nodeId.startsWith('knowledge-card:')) return 'knowledge_card';
  if (nodeId.startsWith('knowledge-node:')) return 'knowledge_card';
  if (nodeId.startsWith('external-resource:')) return 'external_resource';
  if (pathNodeType === 'checkpoint') return 'checkpoint';
  return 'checkpoint';
}

function getPathExecutionNodes(
  plan: AdaptiveLearningPathPlan | null,
  round: LearningPathRoundView | null,
  selectedOption: PathOptionView | null = null,
): PathExecutionNodeView[] {
  if (!plan) return [];
  const metadata = getRecord(round?.lastExecutionMetadata);
  const completedNodeIds = new Set(getStringArray(metadata.completedNodeIds));
  const failedNodeIds = new Set(getStringArray(metadata.failedNodeIds));
  const skippedNodeIds = new Set((round?.deviations ?? [])
    .filter((item) => getRecord(item).deviationType === 'skip')
    .map((item) => getRecord(item).targetNodeId)
    .filter((value): value is string => typeof value === 'string'));
  const sourceNodes = getPathExecutionSourceNodes(plan, selectedOption);
  const sourceNodeIds = sourceNodes
    .map((item) => typeof item.nodeId === 'string' ? item.nodeId : null)
    .filter((nodeId): nodeId is string => Boolean(nodeId));
  const pathNodeContext = sourceNodes.map((item) => {
    const record = getRecord(item);
    return {
      nodeId: typeof record.nodeId === 'string' ? record.nodeId : '',
      title: typeof record.title === 'string' ? record.title : undefined,
      type: typeof record.type === 'string'
        ? record.type
        : typeof record.sourceKind === 'string'
          ? record.sourceKind
          : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    };
  });
  const preferredCurrentNodeId = plan.currentNodeId ?? round?.currentNodeId ?? null;
  const currentNodeId = preferredCurrentNodeId && sourceNodeIds.includes(preferredCurrentNodeId)
    ? preferredCurrentNodeId
    : sourceNodeIds[0] ?? null;
  const resultCards = buildPathNodeResultCards(round);

  const nodes = sourceNodes.map((item, index) => {
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
    const lockReason = typeof readiness.message === 'string' && readinessState !== 'ready'
      ? readiness.message
      : unlockMessage;
    const decisionExplanation = getRecord(node.decisionExplanation);
    const selectionBasisRecord = getRecord(decisionExplanation.selectionBasis);
    const selectionConfidence = selectionBasisRecord.confidence === 'low' ||
      selectionBasisRecord.confidence === 'medium' ||
      selectionBasisRecord.confidence === 'high'
      ? selectionBasisRecord.confidence as 'low' | 'medium' | 'high'
      : null;
    const selectionBasis = typeof selectionBasisRecord.summary === 'string' && selectionConfidence
      ? {
          summary: selectionBasisRecord.summary,
          confidence: selectionConfidence,
          supportingFacts: getStringArray(selectionBasisRecord.supportingFacts),
          limitations: getStringArray(selectionBasisRecord.limitations),
          eventReferences: getStudentSafeEvidenceEventReferences(selectionBasisRecord.eventReferences),
        }
      : null;
    const latestAdjustmentRecord = getRecord(decisionExplanation.latestAdjustment);
    const adjustmentKind = latestAdjustmentRecord.kind === 'advanced' ||
      latestAdjustmentRecord.kind === 'delayed' ||
      latestAdjustmentRecord.kind === 'retained' ||
      latestAdjustmentRecord.kind === 'replaced' ||
      latestAdjustmentRecord.kind === 'removed'
      ? latestAdjustmentRecord.kind as 'advanced' | 'delayed' | 'retained' | 'replaced' | 'removed'
      : null;
    const latestAdjustment = typeof latestAdjustmentRecord.summary === 'string' && adjustmentKind
      ? {
          kind: adjustmentKind,
          summary: latestAdjustmentRecord.summary,
          supportingFacts: getStringArray(latestAdjustmentRecord.supportingFacts),
        }
      : null;
    const completed = completedNodeIds.has(nodeId) || rawStatus === 'completed';
    const result = resultCards.get(nodeId) ?? (completed && isComplexOutcomeNode(type)
      ? {
          state: 'pending' as const,
          label: `${formatResourceType(type)}结果`,
          evidenceSource: 'learning-path-execution',
          reviewState: 'pending-sync',
        }
      : null);
    const status: PathExecutionNodeView['status'] = resolveAdaptivePathExecutionNodeStatus({
      completed,
      failed: failedNodeIds.has(nodeId),
      skipped: skippedNodeIds.has(nodeId),
      current: currentNodeId === nodeId,
      rawStatus,
      readinessState,
      pendingResult: result?.state === 'pending',
    });
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
      selectionBasis,
      latestAdjustment,
      readinessState,
      lockReason,
      unlockMessage,
      result,
    };
    const unlockChain = status === 'locked'
      ? buildAdaptivePathUnlockChain({
          nodeId,
          title: viewNode.title,
          prerequisiteNodeIds: getStringArray(node.prerequisiteNodeIds),
          readiness: {
            state: readinessState,
            message: typeof readiness.message === 'string' ? readiness.message : null,
            unlockMessage: typeof readiness.unlockMessage === 'string' ? readiness.unlockMessage : null,
            fallbackNodeIds: getStringArray(readiness.fallbackNodeIds),
            missingCompetencies: getStringArray(readiness.missingCompetencies),
            missingEvidenceCount: typeof readiness.missingEvidenceCount === 'number'
              ? readiness.missingEvidenceCount
              : 0,
            missingCompletedNodeIds: getStringArray(readiness.missingCompletedNodeIds),
            missingOutcomeRefs: getStringArray(readiness.missingOutcomeRefs),
          },
        }, pathNodeContext)
      : undefined;
    const viewNodeWithUnlock = {
      ...viewNode,
      unlockChain,
    };
    return status === 'locked' && unlockChain
      ? {
          ...viewNodeWithUnlock,
          reason: unlockChain.reason,
          checkpoint: unlockChain.canExplain ? '满足解锁条件后自动进入该节点。' : unlockChain.reason,
        }
      : viewNodeWithUnlock;
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

function formatPathCompletionTime(round: LearningPathRoundView | null): string {
  const completionTimes = (round?.executions ?? [])
    .map((item) => {
      const record = getRecord(item);
      return record.completedAt ?? record.createdAt;
    })
    .map(readTimelineTime)
    .filter((item) => Number.isFinite(item.sortTime))
    .sort((left, right) => right.sortTime - left.sortTime);
  return completionTimes[0]?.label ?? '完成时间待记录';
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
    const result = readPathNodeResultSummary(record, resourceType);
    const timelineTime = readTimelineTime(record.createdAt ?? record.completedAt ?? record.startedAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `execution:${items.length}`,
      nodeId,
      type: activityKind,
      title: getPathActivityTitle(activityKind),
      detail: result?.state === 'pending'
        ? '结果待同步，后续节点会在绑定完成后解锁。'
        : activityKind === 'review' ? '回顾不会重复计算完成进度。' : '节点活动已进入学习路径记录。',
      nodeTitle: nodeTitle.get(nodeId) ?? nodeId,
      sourceLabel: formatResourceType(resourceType),
      stateLabel: getPathActivityStateLabel(activityKind, status, resourceType),
      resultLabel: result?.state === 'available' ? result.label : result?.state === 'pending' ? '结果待同步' : undefined,
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
  const { goalId, pathId } = options;
  if (!pathId) {
    const separator = href.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ goal: goalId, intent: 'path-execution', nodeId: node.nodeId });
    return `${href}${separator}${params.toString()}`;
  }
  return buildAdaptivePathLaunchHref(href, {
    goalId,
    pathId,
    nodeId: node.nodeId,
    routeIntent: 'path-execution',
    resourceType: node.type,
  });
}

function keepsOwningPathCenterOpen(node: PathExecutionNodeView): boolean {
  return Boolean(resolveAdaptivePathCenterOwnedTargetHref(node.type, node.target));
}

function requiresOwningPathCenter(node: PathExecutionNodeView): boolean {
  return node.type === 'external_resource' ||
    node.target.startsWith('/course-runtime/') ||
    node.target.startsWith('course-content/runtime/');
}

function allowsPathCenterExplicitCompletion(node: PathExecutionNodeView): boolean {
  return node.type === 'external_resource' ||
    node.type === 'knowledge_card' ||
    node.type === 'textbook_section' ||
    node.type === 'slides' ||
    node.type === 'handout';
}

function isSafeExternalBrowserTarget(target: string): boolean {
  try {
    return new URL(target).protocol === 'https:';
  } catch {
    return false;
  }
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
    batchId: option.candidateId ? option.batchId : null,
    candidateId: option.candidateId ?? null,
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
  const isArenaJourneyDemo = isDemoMode && searchParams.get('arenaJourneyFixture') === '1';
  const isUnlockChainDemo = isDemoMode && searchParams.get('unlockChainScene') === '1';
  const recommendationProvenanceFixture = resolveRecommendationProvenanceFixture(
    searchParams.get('provenanceFixture'),
  );
  const useLockedNodeDecisionFixture = isDemoMode && searchParams.get('nodeDecisionFixture') === 'locked';
  const demoScene = resolveDemoScene(searchParams.get('scene'));
  const activePracticeFocus = searchParams.get('focus');
  const localFeedbackContext = buildFeedbackTaskContext({
    assignment: searchParams.get('assignment'),
    criterion: searchParams.get('criterion'),
    source: searchParams.get('source'),
    feedbackSource: searchParams.get('feedbackSource'),
    status: searchParams.get('status'),
    action: searchParams.get('action'),
    returnTo: searchParams.get('returnTo'),
    intent: searchParams.get('intent'),
    teacherInterventionId: searchParams.get('teacherInterventionId'),
  });
  const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams);
  const withFeedbackTaskHref = useCallback((href: string, options?: Parameters<typeof buildFeedbackTaskHref>[2]) => (
    feedbackContext
      ? buildFeedbackTaskHref(href, feedbackContext, {
          status: feedbackContext.lifecycleState,
          ...options,
        })
      : href
  ), [feedbackContext]);
  const requestedGoal = searchParams.get('goal');
  const requestedIntent = searchParams.get('intent');
  const explicitGoal = isAdaptivePracticeGoalId(requestedGoal) ? requestedGoal : null;
  const hasInvalidRequestedGoal = requestedGoal !== null && !explicitGoal;
  const shouldRecoverDefaultPath = !hasInvalidRequestedGoal &&
    !explicitGoal &&
    !requestedGoal &&
    !requestedIntent &&
    !searchParams.get('pathId') &&
    !searchParams.get('nodeId');
  const activeGoal = explicitGoal ?? (shouldRecoverDefaultPath ? 'control-correction' : null);
  const activeGoalLabel = activeGoal ? adaptivePracticeGoalLabel(activeGoal) : '自适应学习';
  const routeIntent = resolveControlCorrectionIntent(requestedIntent);
  const workspaceIntent = routeIntent === 'contextual-recommendation'
    ? 'generation'
    : routeIntent === 'path-selection'
      ? 'selection'
      : routeIntent === 'path-execution'
        ? 'execution'
        : routeIntent === 'evidence-review' || routeIntent === 'learner-state-review'
          ? 'evidence-review'
        : requestedIntent !== null && requestedIntent.trim().length > 0 && routeIntent === 'practice'
          ? 'practice'
          : 'landing';
  const showLandingWorkspace = workspaceIntent === 'landing';
  const showPracticeWorkspace = workspaceIntent === 'practice';
  const showGenerationWorkspace = workspaceIntent === 'generation';
  const showSelectionWorkspace = workspaceIntent === 'selection';
  const showExecutionWorkspace = workspaceIntent === 'execution';
  const showEvidenceWorkspace = workspaceIntent === 'evidence-review';
  const isPresetGoalLanding = showLandingWorkspace && !hasInvalidRequestedGoal && !explicitGoal;
  const activePathId = searchParams.get('pathId');
  const activeNodeId = searchParams.get('nodeId');
  const activeGraphNodeId = searchParams.get('graphNodeId');
  const activeOptionId = searchParams.get('optionId');
  const requestedBatchId = searchParams.get('batch');
  const requestedCandidateId = searchParams.get('candidate');
  const activeGoalQuery = activeGoal ? new URLSearchParams({ goal: activeGoal, intent: routeIntent }) : null;
  if (activeGoalQuery && activePathId) activeGoalQuery.set('pathId', activePathId);
  if (activeGoalQuery && activeNodeId) activeGoalQuery.set('nodeId', activeNodeId);
  if (activeGoalQuery && activeGraphNodeId) activeGoalQuery.set('graphNodeId', activeGraphNodeId);
  if (activeGoalQuery && activeOptionId) activeGoalQuery.set('optionId', activeOptionId);
  if (activeGoalQuery && requestedBatchId) activeGoalQuery.set('batch', requestedBatchId);
  if (activeGoalQuery && requestedCandidateId) activeGoalQuery.set('candidate', requestedCandidateId);
  const activeGoalContextHref = withFeedbackTaskHref(activeGoal
    ? `/assessment/adaptive-practice?${activeGoalQuery?.toString() ?? ''}`
    : '/assessment/adaptive-practice');
  const compareAllCandidateQuery = new URLSearchParams(searchParams.toString());
  compareAllCandidateQuery.delete('candidate');
  const compareAllCandidateHref = withFeedbackTaskHref(
    `/assessment/adaptive-practice?${compareAllCandidateQuery.toString()}`,
  );
  const genericPathGenerationHref = '/assessment/adaptive-practice?intent=contextual-recommendation';
  const feedbackGenericPathGenerationHref = withFeedbackTaskHref(genericPathGenerationHref);
  const entryIntents = getCommercialStudentEntryIntentGroups();
  const {
    assistantEntryPoint,
    openAssistantEntryPoint,
    startAssistantConversation,
    updatePageContext,
  } = useGlobalAI();
  const searchParamsKey = searchParams.toString();
  const restoredPathGenerationPanel = useMemo(
    () => pathGenerationPanelFromSearchParams(new URLSearchParams(searchParamsKey), activeGoal),
    [activeGoal, searchParamsKey],
  );

  const practiceSessionId = useMemo(() => `practice-${Math.random().toString(36).slice(2, 10)}`, []);
  const pathAssessmentSessionId = activePathId && activeNodeId
    ? `adaptive-path:${activePathId}:${activeNodeId}`
    : null;
  const sessionId = pathAssessmentSessionId ?? practiceSessionId;

  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [questionState, setQuestionState] = useState<NextQuestionResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [attemptDiagnosisState, setAttemptDiagnosisState] = useState<'idle' | 'pending' | 'error'>('idle');
  const [pathAdvisorAssistantEntryPoint, setPathAdvisorAssistantEntryPoint] = useState<NonNullable<typeof assistantEntryPoint> | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionStartAt, setQuestionStartAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pathExecutionError, setPathExecutionError] = useState<string | null>(null);
  const [activeLearnerState, setActiveLearnerState] = useState<AdaptiveLearnerState | null>(null);
  const [learnerStateLoadState, setLearnerStateLoadState] = useState<AdaptiveLearnerStateLoadState>('idle');
  const [activePathPlan, setActivePathPlan] = useState<AdaptiveLearningPathPlan | null>(null);
  const [activePathRound, setActivePathRound] = useState<LearningPathRoundView | null>(null);
  const [activeCandidateBatch, setActiveCandidateBatch] = useState<AdaptivePathCandidateBatchView | null>(null);
  const [candidateBatchLoadState, setCandidateBatchLoadState] = useState<AdaptivePathContextLoadState>('idle');
  const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(requestedCandidateId);
  const [pathContextLoadState, setPathContextLoadState] = useState<AdaptivePathContextLoadState>('idle');
  const [loadedPathContextKey, setLoadedPathContextKey] = useState<string | null>(null);
  const [pathContextReloadKey, setPathContextReloadKey] = useState(0);
  const [pathChoicePending, setPathChoicePending] = useState<string | null>(null);
  const [pathChoiceMessage, setPathChoiceMessage] = useState<string | null>(null);
  const [pathOptionFeedback, setPathOptionFeedback] = useState<Record<string, string>>({});
  const [pathDifferenceExplanations, setPathDifferenceExplanations] = useState<Record<string, PathDifferenceExplanation>>({});
  const [pathGenerationPanel, setPathGenerationPanel] = useState<PathGenerationPanelState>(restoredPathGenerationPanel);
  const [pathGenerationPending, setPathGenerationPending] = useState<PathGenerationOperation | null>(null);
  const [pathGenerationRequestStatus, setPathGenerationRequestStatus] = useState<PathGenerationRequestStatus>('idle');
  const pathGenerationRequestLifecycleRef = useRef(INITIAL_PATH_GENERATION_REQUEST_LIFECYCLE);
  const [pathAdvisorReadiness, setPathAdvisorReadiness] = useState<AdaptiveGenerationReadiness | null>(null);
  const [learnerStateReadiness, setLearnerStateReadiness] = useState<AdaptiveGenerationReadiness | null>(null);
  const [pathAdvisorAgentSessionId, setPathAdvisorAgentSessionId] = useState<string | null>(null);
  const loginCallbackHref = showGenerationWorkspace
    ? activeGoal
      ? withFeedbackTaskHref(buildPathGenerationGoalHref(activeGoal, pathGenerationPanel))
      : feedbackGenericPathGenerationHref
    : activeGoalContextHref;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(loginCallbackHref)}`;
  const pathAdvisorContextGoal = hasInvalidRequestedGoal
    ? null
    : activeGoal ?? (showGenerationWorkspace ? pathGenerationPanel.goalId : null);
  const [pathNodeCompletionPending, setPathNodeCompletionPending] = useState<string | null>(null);
  const [skipCandidateNode, setSkipCandidateNode] = useState<PathExecutionNodeView | null>(null);
  const [pathActivityPending, setPathActivityPending] = useState<string | null>(null);
  const [selectedPathNodeId, setSelectedPathNodeId] = useState<string | null>(activeNodeId);
  const [practiceQuestionExpanded, setPracticeQuestionExpanded] = useState(activePracticeFocus === 'question');
  const [openPathModuleId, setOpenPathModuleId] = useState<PathWorkspaceModuleId | null>(null);
  const autoOpenedPathWorkspaceKeyRef = useRef<string | null>(null);
  const togglePathModule = useCallback((moduleId: PathWorkspaceModuleId) => {
    setOpenPathModuleId((current) => (current === moduleId ? null : moduleId));
  }, []);
  const openAndScrollPathModule = useCallback((moduleId: PathWorkspaceModuleId) => {
    setOpenPathModuleId(moduleId);
    window.setTimeout(() => {
      document.getElementById(`adaptive-path-module-${moduleId}`)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    }, 0);
  }, []);
  const practiceRouteNodes = useMemo(() => buildPracticeEntryRouteNodes({
    recommendedFocus: diagnostic?.recommendedFocus ?? [],
    weakAreas: diagnostic?.weakAreas ?? [],
    estimatedAbility: questionState?.estimatedAbility,
    confidenceInterval: questionState?.confidenceInterval,
    actionHref: activeGoalContextHref,
  }), [activeGoalContextHref, diagnostic, questionState]);
  const adaptivePathCenter = useMemo(() => activeGoal
    ? buildControlCorrectionLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        goalId: activeGoal,
        goalLabel: activeGoalLabel,
        learnerState: activeLearnerState,
        pathPlan: activePathPlan,
        routeIntent,
        entrySource: routeIntent === 'contextual-recommendation' ? 'contextual-recommendation' : 'adaptive-practice',
        networkError: Boolean(error) && !activeLearnerState && !activePathPlan,
        questionAvailable: Boolean(questionState),
      })
    : null, [activeGoal, activeGoalLabel, activeLearnerState, activePathPlan, error, questionState, routeIntent]);
  const currentPathOptions = useMemo(() => getPathOptions(adaptivePathCenter), [adaptivePathCenter]);
  const candidatePathOptions = useMemo(
    () => getCandidateBatchPathOptions(activeCandidateBatch),
    [activeCandidateBatch],
  );
  const pathOptions = candidatePathOptions.length > 0 ? candidatePathOptions : currentPathOptions;
  const pathOptionVersionKey = useMemo(() => [
    activePathRound?.id ?? activePathPlan?.id ?? 'no-path',
    ...pathOptions.map((option) => `${option.optionId}:${option.nodeIds?.join(',') ?? ''}`),
  ].join('|'), [activePathPlan?.id, activePathRound?.id, pathOptions]);
  const pathOptionVersionKeyRef = useRef(pathOptionVersionKey);
  pathOptionVersionKeyRef.current = pathOptionVersionKey;
  const pathOptionFallback = useMemo(() => getPathOptionFallback(adaptivePathCenter), [adaptivePathCenter]);
  const pathComparisonDiversityLimited = useMemo(
    () => hasPathComparisonDiversityLimitation(pathOptionFallback),
    [pathOptionFallback],
  );
  const visiblePathOptions = useMemo(() => {
    const displays = buildAdaptivePathOptionDisplays(pathOptions, { diversityLimited: pathComparisonDiversityLimited });
    return focusedCandidateId
      ? displays.filter((display) => (
          pathOptions.find((option) => option.optionId === display.id)?.candidateId === focusedCandidateId
        ))
      : displays;
  }, [focusedCandidateId, pathComparisonDiversityLimited, pathOptions]);
  const hasGeneratedPathOptions = pathOptions.length > 0;

  useEffect(() => {
    setPathOptionFeedback({});
    setPathDifferenceExplanations({});
  }, [pathOptionVersionKey]);
  const selectedExecutionOption = useMemo(
    () => pathOptions.find((option) => option.optionId === activeOptionId) ?? null,
    [activeOptionId, pathOptions],
  );
  const pathSelectionHistory = useMemo(() => getPathSelectionHistory(adaptivePathCenter), [adaptivePathCenter]);
  const pathConfigurationFulfillment = useMemo(
    () => getPathConfigurationFulfillment(adaptivePathCenter),
    [adaptivePathCenter],
  );
  const pathBudgetLimitation = useMemo(() => getPathBudgetLimitation(adaptivePathCenter), [adaptivePathCenter]);
  const evidenceReadiness = useMemo(() => (
    showGenerationWorkspace &&
      !isDemoMode &&
      authStatus === 'authenticated' &&
      learnerStateLoadState === 'ready' &&
      !activeLearnerState
      ? buildAdaptiveGenerationReadiness({ reason: 'insufficient-evidence', source: 'ui' })
      : null
  ), [activeLearnerState, authStatus, isDemoMode, learnerStateLoadState, showGenerationWorkspace]);
  const learnerStatePendingReadiness = useMemo(() => (
    showGenerationWorkspace &&
      !isDemoMode &&
      authStatus === 'authenticated' &&
      Boolean(pathAdvisorContextGoal) &&
      learnerStateLoadState !== 'ready'
      ? buildAdaptiveGenerationReadiness({ reason: 'retryable', source: 'learner-state' })
      : null
  ), [authStatus, isDemoMode, learnerStateLoadState, pathAdvisorContextGoal, showGenerationWorkspace]);
  const authRequiredGenerationReadiness = useMemo(() => (
    showGenerationWorkspace &&
      !isDemoMode &&
      authStatus === 'unauthenticated'
      ? buildAdaptiveGenerationReadiness({ reason: 'auth-required', source: 'session' })
      : null
  ), [authStatus, isDemoMode, showGenerationWorkspace]);
  const pathGenerationReadiness = useMemo(() => selectAdaptiveGenerationReadiness([
    authRequiredGenerationReadiness,
    pathAdvisorReadiness,
    learnerStateReadiness,
    learnerStatePendingReadiness,
    evidenceReadiness,
  ]), [authRequiredGenerationReadiness, evidenceReadiness, learnerStatePendingReadiness, learnerStateReadiness, pathAdvisorReadiness]);
  const pathGenerationDegradedReadiness = learnerStateReadiness?.status === 'degraded'
    ? learnerStateReadiness
    : evidenceReadiness?.status === 'degraded'
      ? evidenceReadiness
      : null;
  const hasPathAdvisorModeContext = pathAdvisorAssistantEntryPoint?.mode === 'path-advisor' &&
    Boolean(pathAdvisorAssistantEntryPoint.serverContext.modeContextToken);
  const canRetryPathGeneration = pathGenerationReadiness.status === 'retryable' &&
    pathAdvisorReadiness?.status === 'retryable' &&
    !pathGenerationDegradedReadiness &&
    hasPathAdvisorModeContext;
  const canSubmitPathGeneration = (pathGenerationReadiness.status === 'ready' && hasPathAdvisorModeContext) || canRetryPathGeneration;
  const pathGenerationContextReadiness = pathGenerationReadiness.status === 'ready' &&
    pathAdvisorContextGoal &&
    !hasPathAdvisorModeContext
    ? buildAdaptiveGenerationReadiness({ reason: 'retryable', source: 'path-advisor' })
    : null;
  const pathGenerationDisplayReadiness = pathGenerationContextReadiness ??
    (pathGenerationReadiness.status === 'retryable' && pathGenerationDegradedReadiness
    ? pathGenerationDegradedReadiness
    : pathGenerationReadiness);
  const pathExecutionNodes = useMemo(
    () => getPathExecutionNodes(activePathPlan, activePathRound, selectedExecutionOption),
    [activePathPlan, activePathRound, selectedExecutionOption],
  );
  const requestedPathContextKey = activeGoal
    ? `${activeGoal}:${activePathId ? `path:${activePathId}` : 'implicit'}`
    : null;
  const hasLoadedCurrentPathContext = Boolean(
    (activePathPlan || activePathRound) &&
    requestedPathContextKey &&
    loadedPathContextKey === requestedPathContextKey,
  );
  const pathContextRecoveryState = useMemo(() => resolveAdaptivePathContextRecoveryState({
    workspaceIntent,
    activeGoal: Boolean(activeGoal),
    authStatus,
    isDemoMode,
    requestedPathId: activePathId,
    hasLoadedPathContext: hasLoadedCurrentPathContext,
    loadState: pathContextLoadState,
  }), [activeGoal, activePathId, authStatus, hasLoadedCurrentPathContext, isDemoMode, pathContextLoadState, workspaceIntent]);
  const showPathContextRecovery = pathContextRecoveryState.shouldRecover;
  const pathLandingState = useMemo(() => resolveAdaptivePathLandingState({
    authStatus,
    learnerStateLoadState,
    pathContextLoadState,
    hasLoadedPathContext: hasLoadedCurrentPathContext,
  }), [authStatus, hasLoadedCurrentPathContext, learnerStateLoadState, pathContextLoadState]);
  const showColdStartLandingWorkspace = showLandingWorkspace && pathLandingState === 'cold-start';
  const showPresetGoalCards = isPresetGoalLanding && pathLandingState === 'cold-start';
  const pathContextRecoveryEvidenceHref = useMemo(() => {
    const params = new URLSearchParams();
    if (activeGoal) params.set('goal', activeGoal);
    if (activePathId) params.set('pathId', activePathId);
    if (activeNodeId) params.set('nodeId', activeNodeId);
    params.set('source', 'adaptive-path-center');
    const query = params.toString();
    return withFeedbackTaskHref(`/profile/evidence${query ? `?${query}` : ''}`);
  }, [activeGoal, activeNodeId, activePathId, withFeedbackTaskHref]);
  const pathContextRecoveryReturnHref = feedbackContext?.returnHref ?? withFeedbackTaskHref('/assessment/adaptive-practice');
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
  const pathCenterOpenedNodeIds = useMemo(() => {
    const ownedNodeIds = new Set(pathExecutionNodes.filter(keepsOwningPathCenterOpen).map((node) => node.nodeId));
    return new Set((activePathRound?.executions ?? [])
      .map(getRecord)
      .filter((execution) => execution.status === 'started' && typeof execution.nodeId === 'string')
      .map((execution) => execution.nodeId as string)
      .filter((nodeId) => ownedNodeIds.has(nodeId)));
  }, [activePathRound?.executions, pathExecutionNodes]);
  const activeExecutionPathId = activePathRound?.id ?? activePathPlan?.id ?? activePathId;
  const activeExecutionGoalId = activeGoal ?? resolveAdaptivePracticeGoalId(activePathPlan?.goal.id ?? activePathRound?.goalId ?? null);
  const activePathContinueHref = useMemo(() => {
    if (!activeExecutionPathId || !activeExecutionGoalId) return null;
    const params = new URLSearchParams({
      goal: activeExecutionGoalId,
      intent: 'path-execution',
      pathId: activeExecutionPathId,
    });
    if (currentPathNode?.nodeId) params.set('nodeId', currentPathNode.nodeId);
    return withFeedbackTaskHref(`/assessment/adaptive-practice?${params.toString()}`);
  }, [activeExecutionGoalId, activeExecutionPathId, currentPathNode?.nodeId, withFeedbackTaskHref]);
  const pathExecutionSummary = useMemo(
    () => getPathExecutionSummary(pathExecutionNodes, activePathRound),
    [activePathRound, pathExecutionNodes],
  );
  const showRecoveredExecutionWorkspace = showLandingWorkspace &&
    activePathRound?.pathStatus === 'active' &&
    pathExecutionNodes.length > 0;
  const showCompletedPathSummary = showLandingWorkspace &&
    activePathRound?.pathStatus === 'completed' &&
    pathExecutionNodes.length > 0;
  const pathActivityTimeline = useMemo(
    () => getPathActivityTimeline(pathExecutionNodes, activePathRound),
    [activePathRound, pathExecutionNodes],
  );
  const evidenceSourceSummary = useMemo(
    () => buildEvidenceSourceSummary(pathExecutionNodes),
    [pathExecutionNodes],
  );
  const pathManagementTargetModuleId = useMemo<PathWorkspaceModuleId | null>(() => {
    if (!showPathContextRecovery && showEvidenceWorkspace && pathExecutionNodes.length > 0) {
      return 'learning-record';
    }
    if (!showPathContextRecovery && (showExecutionWorkspace || showRecoveredExecutionWorkspace) && pathExecutionNodes.length > 0) {
      return 'current-path';
    }
    if (!showPathContextRecovery && showSelectionWorkspace && visiblePathOptions.length > 0) {
      return 'path-selection';
    }
    if (!showPathContextRecovery && showPracticeWorkspace) {
      return 'path-resource';
    }
    if (showPresetGoalCards) {
      return 'goal-selection';
    }
    if (showColdStartLandingWorkspace) {
      return 'learning-overview';
    }
    return null;
  }, [
    pathExecutionNodes.length,
    showEvidenceWorkspace,
    showExecutionWorkspace,
    showColdStartLandingWorkspace,
    showPathContextRecovery,
    showPracticeWorkspace,
    showPresetGoalCards,
    showRecoveredExecutionWorkspace,
    showSelectionWorkspace,
    visiblePathOptions.length,
  ]);
  const pathWorkspaceAutoOpenKey = useMemo(() => {
    if (!pathManagementTargetModuleId) return null;
    if (workspaceIntent !== 'selection' && workspaceIntent !== 'execution' && workspaceIntent !== 'evidence-review') {
      return null;
    }
    return [
      workspaceIntent,
      activeGoal ?? 'goal:none',
      activePathId ?? 'path:none',
      activeOptionId ?? 'option:none',
      pathManagementTargetModuleId,
    ].join(':');
  }, [activeGoal, activeOptionId, activePathId, pathManagementTargetModuleId, workspaceIntent]);
  useEffect(() => {
    if (!pathManagementTargetModuleId || !pathWorkspaceAutoOpenKey) return;
    if (autoOpenedPathWorkspaceKeyRef.current === pathWorkspaceAutoOpenKey) return;
    autoOpenedPathWorkspaceKeyRef.current = pathWorkspaceAutoOpenKey;
    setOpenPathModuleId(pathManagementTargetModuleId);
  }, [pathManagementTargetModuleId, pathWorkspaceAutoOpenKey]);
  useEffect(() => {
    setPathAdvisorAgentSessionId(null);
    setPathGenerationPanel(takeStoredPathGenerationPanel(activeGoal) ?? restoredPathGenerationPanel);
  }, [activeGoal, restoredPathGenerationPanel]);

  const handlePathGenerationGoalChange = useCallback((value: string) => {
    const nextGoal = resolveAdaptivePracticeGoalId(value);
    setPathAdvisorAgentSessionId(null);
    setPathGenerationPanel((current) => {
      const nextPanel = { ...current, goalId: nextGoal };
      if (nextGoal !== activeGoal) {
        storePathGenerationPanelForGoal(nextGoal, nextPanel);
        window.location.assign(buildPathGenerationGoalHref(nextGoal, nextPanel));
      }
      return nextPanel;
    });
  }, [activeGoal]);

  const setPathChoiceUnavailable = useCallback(() => {
    setPathChoiceMessage('请先登录并生成路径后再记录选择。');
  }, []);

  const clearLoadedPathContext = useCallback((loadState: AdaptivePathContextLoadState) => {
    setActivePathRound(null);
    setActivePathPlan(null);
    setLoadedPathContextKey(null);
    setPathContextLoadState(loadState);
  }, []);

  const retryPathContext = useCallback(() => {
    setLearnerStateLoadState('loading');
    setPathContextLoadState('loading');
    setPathContextReloadKey((current) => current + 1);
  }, []);

  const openPathGenerationAdvisor = useCallback(() => {
    if (!pathAdvisorAssistantEntryPoint) return;
    openAssistantEntryPoint(pathAdvisorAssistantEntryPoint);
  }, [openAssistantEntryPoint, pathAdvisorAssistantEntryPoint]);

  useEffect(() => {
    if (!pathAdvisorContextGoal || isDemoMode) {
      updatePageContext({ assistantEntryPoint: null });
      setPathAdvisorAssistantEntryPoint(null);
      setPathAdvisorReadiness(null);
      return;
    }
    const contextGoal = pathAdvisorContextGoal;

    if (authStatus === 'loading') return;

    if (authStatus !== 'authenticated') {
      updatePageContext({ assistantEntryPoint: null });
      setPathAdvisorAssistantEntryPoint(null);
      setPathAdvisorReadiness(null);
      return;
    }

    let cancelled = false;
    async function registerPathAdvisorEntryPoint() {
      try {
        const contextQuery = new URLSearchParams({ goal: contextGoal });
        if (activeGraphNodeId) contextQuery.set('graphNodeId', activeGraphNodeId);
        const response = await fetch(`/api/adaptive/path-advisor-context?${contextQuery.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (!cancelled) {
            updatePageContext({ assistantEntryPoint: null });
            setPathAdvisorAssistantEntryPoint(null);
            setPathAdvisorReadiness(readAdaptiveGenerationReadiness(payload) ?? adaptiveGenerationReadinessFromHttp({
              status: response.status,
              source: 'path-advisor',
              fallbackReason: response.status === 401 ? 'auth-required' : 'service-unavailable',
            }));
          }
          return;
        }
        const payload = (await response.json()) as PathAdvisorContextResponse;
        if (cancelled) return;
        setPathAdvisorReadiness(payload.readiness ?? buildAdaptiveGenerationReadiness({ reason: 'ready', source: 'path-advisor' }));
        const pathAdvisorEntryPoint = {
          mode: 'path-advisor' as const,
          promptContext: [
            `student-path-center:${payload.goalId}:adaptive-path-center`,
            requestedBatchId ? `authorized-candidate-batch:${requestedBatchId}` : null,
          ].filter(Boolean).join('\n'),
          serverContext: {
            classId: payload.classId,
            courseId: payload.goalId,
            goalId: payload.goalId,
            ...(payload.graphNodeId ? { graphNodeId: payload.graphNodeId } : {}),
            ...(requestedBatchId ? { candidateBatchId: requestedBatchId } : {}),
            pageId: 'adaptive-path-center',
            modeContextToken: payload.modeContextToken,
          },
        };
        setPathAdvisorAssistantEntryPoint(pathAdvisorEntryPoint);
        updatePageContext({
          pageType: 'practice',
          stepId: 'adaptive-path-center',
          knowledgeType: 'C',
          url: '/assessment/adaptive-practice',
          courseId: payload.goalId,
          courseTitle: payload.courseTitle,
          topic: payload.topic,
          learningObjectives: payload.learningObjectives,
          quickQuestions: payload.quickPrompts ?? [
            {
              label: '生成路径',
              question: payload.graphNodeId
                ? `请围绕图谱节点 ${payload.graphNodeId} 为我生成一组${payload.courseTitle}学习路径，优先给出 2 到 3 条可比较方案。`
                : `请为我生成一组${payload.courseTitle}学习路径，优先给出 2 到 3 条可比较方案。`,
            },
            {
              label: '按时间调整',
              question: `我希望在 90 分钟内完成${payload.courseTitle}的关键补强，请调整学习路径。`,
            },
          ],
          assistantEntryPoint: pathAdvisorEntryPoint,
        });
      } catch {
        if (!cancelled) {
          updatePageContext({ assistantEntryPoint: null });
          setPathAdvisorAssistantEntryPoint(null);
          setPathAdvisorReadiness(buildAdaptiveGenerationReadiness({ reason: 'retryable', source: 'path-advisor' }));
        }
      }
    }

    void registerPathAdvisorEntryPoint();
    return () => {
      cancelled = true;
      updatePageContext({ assistantEntryPoint: null });
      setPathAdvisorAssistantEntryPoint(null);
    };
  }, [activeGraphNodeId, authStatus, isDemoMode, pathAdvisorContextGoal, requestedBatchId, updatePageContext]);

  const applyDemoScene = useCallback((scene: DemoScene) => {
    const demoData = DEMO_SCENES[scene];
    setDiagnostic(demoData.diagnostic);
    setQuestionState(demoData.questionState);
    setSelectedOption(demoData.defaultSelectedOption);
    setFeedback(demoData.feedback);
    setActivePathPlan(activeGoal === 'control-correction'
      ? (isArenaJourneyDemo
          ? DEMO_ARENA_JOURNEY_PATH_PLAN
          : isUnlockChainDemo
            ? DEMO_UNLOCK_CHAIN_PATH_PLAN
            : demoRecommendationProvenancePlan(recommendationProvenanceFixture))
      : null);
    setActivePathRound(activeGoal === 'control-correction'
      ? (isArenaJourneyDemo
          ? DEMO_ARENA_JOURNEY_PATH_ROUND
          : isUnlockChainDemo
            ? null
          : useLockedNodeDecisionFixture
            ? DEMO_LOCKED_NODE_PATH_ROUND
            : DEMO_CONTROL_CORRECTION_PATH_ROUND)
      : null);
    setQuestionStartAt(Date.now());
    setLoading(false);
    setError(null);
  }, [
    activeGoal,
    isArenaJourneyDemo,
    isUnlockChainDemo,
    recommendationProvenanceFixture,
    useLockedNodeDecisionFixture,
  ]);

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
    if (isDemoMode) {
      setActiveLearnerState(null);
      setLearnerStateLoadState('ready');
      setLearnerStateReadiness(null);
      setPathContextLoadState('ready');
      setLoadedPathContextKey(requestedPathContextKey);
      return;
    }

    if (!activeGoal) {
      setActiveLearnerState(null);
      setActivePathPlan(null);
      setActivePathRound(null);
      setLearnerStateLoadState('idle');
      setLearnerStateReadiness(null);
      setPathContextLoadState('idle');
      setLoadedPathContextKey(null);
      return;
    }

    if (authStatus === 'loading') {
      setLearnerStateLoadState('loading');
      setPathContextLoadState('loading');
      return;
    }

    if (authStatus === 'unauthenticated') {
      setActiveLearnerState(null);
      setActivePathPlan(null);
      setActivePathRound(null);
      setLearnerStateLoadState('idle');
      setLearnerStateReadiness(null);
      setPathContextLoadState('missing');
      setLoadedPathContextKey(null);
      return;
    }

    const goalToLoad = activeGoal;
    const requestContextKey = requestedPathContextKey;
    let cancelled = false;
    async function loadAdaptivePathCenterData() {
      const requiresRoutePathContext = showSelectionWorkspace || showExecutionWorkspace || showEvidenceWorkspace;
      setLearnerStateLoadState('loading');
      setLearnerStateReadiness(null);
      setPathContextLoadState('loading');
      setLoadedPathContextKey(null);
      if (requiresRoutePathContext || activePathId) {
        setActivePathPlan(null);
        setActivePathRound(null);
      }
      let learnerState: AdaptiveLearnerState | null = null;
      try {
        const learnerResponse = await fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(goalToLoad)}`);
        if (!cancelled && learnerResponse.ok) {
          learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
          setActiveLearnerState(learnerState);
          setLearnerStateReadiness(null);
          setLearnerStateLoadState('ready');
        } else if (!cancelled) {
          setActiveLearnerState(null);
          setLearnerStateReadiness(adaptiveGenerationReadinessFromHttp({
            status: learnerResponse.status,
            source: 'learner-state',
            fallbackReason: 'learner-state-unavailable',
          }));
          setLearnerStateLoadState('failed');
        }
      } catch {
        if (!cancelled) {
          setActiveLearnerState(null);
          setLearnerStateReadiness(buildAdaptiveGenerationReadiness({
            reason: 'learner-state-unavailable',
            source: 'learner-state',
          }));
          setLearnerStateLoadState('failed');
        }
      }

      const fallbackPathIds = [
        ...(goalToLoad === 'control-correction'
          ? [learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null]
          : []),
        ...(learnerState?.pathContext.recentPathIds ?? []),
      ];
      const pathIdsToTry = activePathId
        ? uniquePathIds([activePathId])
        : uniquePathIds(fallbackPathIds);
      let loadedMatchingPath = false;
      let pathLoadFailed = false;
      for (const pathIdToLoad of pathIdsToTry) {
        if (cancelled) return;
        const loaded = await fetchLearningPathRound(pathIdToLoad, goalToLoad);
        if (loaded.status === 'failed') {
          pathLoadFailed = true;
          continue;
        }
        if (!cancelled && loaded.status === 'loaded') {
          setActivePathRound(loaded.round);
          setActivePathPlan(loaded.plan);
          setPathContextLoadState('ready');
          setLoadedPathContextKey(requestContextKey);
          loadedMatchingPath = true;
          break;
        }
      }
      if (!loadedMatchingPath && !activePathId && !cancelled) {
        const latest = await fetchLatestLearningPathRound(goalToLoad);
        if (latest.status === 'failed') {
          pathLoadFailed = true;
        }
        if (!cancelled && latest.status === 'loaded') {
          setActivePathRound(latest.round);
          setActivePathPlan(latest.plan);
          setPathContextLoadState('ready');
          setLoadedPathContextKey(requestContextKey);
          loadedMatchingPath = true;
        }
      }
      if (!loadedMatchingPath && !cancelled) {
        setActivePathPlan(null);
        setActivePathRound(null);
        setPathContextLoadState(pathLoadFailed ? 'failed' : 'missing');
        setLoadedPathContextKey(null);
      }
      if (cancelled) return;
    }

    void loadAdaptivePathCenterData();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, activeGoalLabel, activePathId, authStatus, isDemoMode, pathContextReloadKey, requestedPathContextKey, showEvidenceWorkspace, showExecutionWorkspace, showSelectionWorkspace]);

  useEffect(() => {
    setFocusedCandidateId(requestedCandidateId);
  }, [requestedCandidateId]);

  useEffect(() => {
    if (!activeGoal || (!isDemoMode && authStatus !== 'authenticated') || (!showSelectionWorkspace && !showGenerationWorkspace)) {
      setActiveCandidateBatch(null);
      setCandidateBatchLoadState('idle');
      return;
    }
    if (requestedCandidateId && !requestedBatchId) {
      setActiveCandidateBatch(null);
      setCandidateBatchLoadState('missing');
      return;
    }
    let cancelled = false;
    setCandidateBatchLoadState('loading');
    void fetchCandidateBatch(activeGoal, requestedBatchId, requestedCandidateId).then((result) => {
      if (cancelled) return;
      if (result.status === 'loaded') {
        setActiveCandidateBatch(result.batch);
        setCandidateBatchLoadState('ready');
      } else {
        setActiveCandidateBatch(null);
        setCandidateBatchLoadState(result.status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeGoal, authStatus, isDemoMode, requestedBatchId, requestedCandidateId, showGenerationWorkspace, showSelectionWorkspace]);

  useEffect(() => {
    if (activeGoal || !pathAdvisorContextGoal || !showGenerationWorkspace || isDemoMode) return;

    if (authStatus === 'loading') {
      setLearnerStateLoadState('loading');
      setLearnerStateReadiness(null);
      return;
    }

    if (authStatus !== 'authenticated') {
      setActiveLearnerState(null);
      setLearnerStateLoadState('idle');
      setLearnerStateReadiness(null);
      return;
    }

    const generationGoal = pathAdvisorContextGoal;
    let cancelled = false;
    async function loadPathGenerationLearnerState() {
      setLearnerStateLoadState('loading');
      setLearnerStateReadiness(null);
      try {
        const learnerResponse = await fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(generationGoal)}`);
        if (cancelled) return;
        if (learnerResponse.ok) {
          setActiveLearnerState((await learnerResponse.json()) as AdaptiveLearnerState);
          setLearnerStateReadiness(null);
          setLearnerStateLoadState('ready');
          return;
        }
        setActiveLearnerState(null);
        setLearnerStateReadiness(adaptiveGenerationReadinessFromHttp({
          status: learnerResponse.status,
          source: 'learner-state',
          fallbackReason: 'learner-state-unavailable',
        }));
        setLearnerStateLoadState('ready');
      } catch {
        if (!cancelled) {
          setActiveLearnerState(null);
          setLearnerStateReadiness(buildAdaptiveGenerationReadiness({
            reason: 'learner-state-unavailable',
            source: 'learner-state',
          }));
          setLearnerStateLoadState('ready');
        }
      }
    }

    void loadPathGenerationLearnerState();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, authStatus, isDemoMode, pathAdvisorContextGoal, showGenerationWorkspace]);

  const reloadActiveLearningPath = useCallback(async () => {
    if (isDemoMode) return;
    const pathIdToLoad = activePathRound?.id ??
      activePathId ??
      (activeGoal === 'control-correction' ? activeLearnerState?.pathContext.activeControlCorrectionPath.pathId : null) ??
      activeLearnerState?.pathContext.recentPathIds?.[0];
    if (!pathIdToLoad) return;
    const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
    if (!pathResponse.ok) {
      throw new Error('路径状态刷新失败');
    }
    const payload = (await pathResponse.json()) as LearningPathRoundResponse;
    setActivePathRound(payload.path ?? null);
    setActivePathPlan(restoreAdaptiveLearningPathPlanFromRound(payload.path ?? null));
    setLoadedPathContextKey(payload.path ? requestedPathContextKey : null);
  }, [activeGoal, activePathId, activeLearnerState, activePathRound, isDemoMode, requestedPathContextKey]);

  const refreshLatestLearningPathAfterKonling = useCallback(async () => {
    if (!activeGoal || isDemoMode || authStatus !== 'authenticated') return;

    let learnerState: AdaptiveLearnerState | null = null;
    try {
      const learnerResponse = await fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(activeGoal)}`);
      if (learnerResponse.ok) {
        learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
        setActiveLearnerState(learnerState);
      }
    } catch {
      learnerState = null;
    }

    if (activePathId) {
      const loaded = await fetchLearningPathRound(activePathId, activeGoal);
      if (loaded.status === 'loaded') {
        setActivePathRound(loaded.round);
        setActivePathPlan(loaded.plan);
        setLoadedPathContextKey(requestedPathContextKey);
        setPathContextLoadState('ready');
      } else {
        clearLoadedPathContext(loaded.status === 'failed' ? 'failed' : 'missing');
      }
      return;
    }

    const latest = await fetchLatestLearningPathRound(activeGoal);
    if (latest.status === 'loaded') {
      setActivePathRound(latest.round);
      setActivePathPlan(latest.plan);
      setLoadedPathContextKey(requestedPathContextKey);
      setPathContextLoadState('ready');
      setPathChoiceMessage('学习路径已生成，请选择一个方案开始执行。');
      return;
    }

    const fallbackPathIds = [
      ...(activeGoal === 'control-correction'
        ? [learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null]
        : []),
      ...(learnerState?.pathContext.recentPathIds ?? []),
    ];
    const pathIdsToTry = uniquePathIds(fallbackPathIds);
    let pathLoadFailed = latest.status === 'failed';
    for (const pathIdToLoad of pathIdsToTry) {
      const loaded = await fetchLearningPathRound(pathIdToLoad, activeGoal);
      if (loaded.status === 'failed') {
        pathLoadFailed = true;
        continue;
      }
      if (loaded.status === 'loaded') {
        setActivePathRound(loaded.round);
        setActivePathPlan(loaded.plan);
        setLoadedPathContextKey(requestedPathContextKey);
        setPathContextLoadState('ready');
        setPathChoiceMessage('学习路径已生成，请选择一个方案开始执行。');
        return;
      }
    }
    clearLoadedPathContext(pathLoadFailed ? 'failed' : 'missing');
  }, [activeGoal, activePathId, authStatus, clearLoadedPathContext, isDemoMode, requestedPathContextKey]);

  useEffect(() => {
    const handleAdaptivePathUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ batchId?: unknown; candidateId?: unknown }>).detail;
      const batchId = typeof detail?.batchId === 'string' ? detail.batchId : null;
      const candidateId = typeof detail?.candidateId === 'string' ? detail.candidateId : null;
      if (batchId && candidateId && activeGoal) {
        void fetchCandidateBatch(activeGoal, batchId, candidateId).then((result) => {
          if (result.status !== 'loaded') return;
          setActiveCandidateBatch(result.batch);
          setCandidateBatchLoadState('ready');
          setFocusedCandidateId(candidateId);
          setOpenPathModuleId('path-selection');
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set('batch', batchId);
          nextUrl.searchParams.set('candidate', candidateId);
          window.history.replaceState(window.history.state, '', nextUrl);
          setPathChoiceMessage('路径已选中，等待你开始学习。');
        });
      }
      void refreshLatestLearningPathAfterKonling();
    };
    window.addEventListener('konling:adaptive-path-updated', handleAdaptivePathUpdated);
    return () => window.removeEventListener('konling:adaptive-path-updated', handleAdaptivePathUpdated);
  }, [activeGoal, refreshLatestLearningPathAfterKonling]);

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
    requestedGenerationRequestId?: string,
  ) => {
    if (authStatus !== 'authenticated') {
      setPathChoiceMessage('请先登录后再生成学习路径。');
      return;
    }
    if (hasInvalidRequestedGoal) {
      setPathChoiceMessage('学习路径目标未注册，请先选择可用目标。');
      return;
    }
    if (!canSubmitPathGeneration) {
      setPathChoiceMessage(pathGenerationDisplayReadiness.studentMessage);
      return;
    }
    const modeContextToken = assistantEntryPoint?.mode === 'path-advisor'
      ? assistantEntryPoint.serverContext.modeContextToken
      : null;
    const graphNodeId = assistantEntryPoint?.mode === 'path-advisor'
      ? assistantEntryPoint.serverContext.graphNodeId ?? activeGraphNodeId
      : activeGraphNodeId;
    if (!modeContextToken) {
      setPathChoiceMessage('路径生成上下文还在准备，请稍后重试。');
      return;
    }
    const currentPathId = activePathRound?.id ?? activePathPlan?.id ?? activePathId;
    if (operation !== 'generate' && !currentPathId) {
      setPathChoiceMessage('请先生成路径后再请求调整或解释。');
      return;
    }
    if (operation === 'generate' && pathGenerationRequestStatus === 'pending') return;
    const generationRequestId = operation === 'generate'
      ? requestedGenerationRequestId ?? crypto.randomUUID()
      : undefined;
    const explanationRequestVersionKey = operation === 'explain'
      ? pathOptionVersionKeyRef.current
      : null;
    if (generationRequestId) {
      setPathGenerationRequestStatus('pending');
      publishPathGenerationStatus('pending', generationRequestId, '已接收路径生成请求，正在准备生成。');
    }
    let generationFailureIsDefinitive = false;
    setPathGenerationPending(operation);
    setPathChoiceMessage(null);
    if (option?.optionId) {
      if (operation === 'explain') {
        setPathDifferenceExplanations((current) => {
          const next = { ...current };
          delete next[option.optionId];
          return next;
        });
      }
      setPathOptionFeedback((current) => ({
        ...current,
        [option.optionId]: operation === 'revise'
          ? '正在根据这条路径调整方案...'
          : operation === 'explain'
            ? '正在生成这条路径的差异说明...'
            : current[option.optionId] ?? '',
      }));
    }
    try {
      const response = await fetch('/api/adaptive/path-advisor-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          generationRequestId,
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
          graphNodeId,
          agentSessionId: pathAdvisorAgentSessionId ?? undefined,
          priorRequestId: operation === 'revise' ? currentPathId ?? undefined : undefined,
          selectedOptionId: operation !== 'generate' ? option?.optionId : undefined,
          compareWithOptionId: operation === 'explain'
            ? pathOptions.find((item) => item.optionId !== option?.optionId)?.optionId
            : undefined,
          rejectedOptionIds: undefined,
          idempotencyKey: generationRequestId ?? `path-generation-panel:${operation}:${pathGenerationPanel.goalId}:${Date.now()}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.generationRequest?.status === 'failed') {
          generationFailureIsDefinitive = true;
        }
        const readiness = readAdaptiveGenerationReadiness(payload);
        if (readiness) {
          setPathAdvisorReadiness(readiness);
          throw new Error(readiness.studentMessage);
        }
        throw new Error(typeof payload.error === 'string' ? payload.error : '学习路径生成失败');
      }
      setPathAdvisorReadiness(readAdaptiveGenerationReadiness(payload) ?? buildAdaptiveGenerationReadiness({ reason: 'ready', source: 'path-advisor-tool' }));
      if (typeof payload.agentSessionId === 'string') {
        setPathAdvisorAgentSessionId(payload.agentSessionId);
      }
      if (generationRequestId && payload.generationRequest?.status === 'running') {
        pathGenerationRequestLifecycleRef.current = settlePathGenerationRequest(
          pathGenerationRequestLifecycleRef.current,
          'running',
        );
        setPathGenerationRequestStatus('running');
        const runningMessage = '生成仍在进行中，稍后可再次查看结果。';
        setPathChoiceMessage(runningMessage);
        publishPathGenerationStatus('running', generationRequestId, runningMessage);
        return;
      }
      if (payload.result?.generationStatus === 'blocked') {
        const budgetRequest = getRecord(payload.result?.request);
        const requestedMinutes = typeof budgetRequest.requestedTimeBudgetMinutes === 'number'
          ? budgetRequest.requestedTimeBudgetMinutes
          : null;
        const minimumMinutes = typeof budgetRequest.minimumTimeBudgetMinutes === 'number'
          ? budgetRequest.minimumTimeBudgetMinutes
          : null;
        const blockedMessage = budgetRequest.timeBudgetInsufficient === true &&
          requestedMinutes !== null &&
          minimumMinutes !== null
          ? `你选择了 ${requestedMinutes} 分钟，完成必需验证至少需要 ${minimumMinutes} 分钟。请调整学习时长后重试。`
          : typeof payload.result.comparison?.message === 'string'
          ? payload.result.comparison.message
          : '当前限制条件下暂不能生成可执行学习路径，请调整目标、时间或资源偏好后重试。';
        setPathChoiceMessage(blockedMessage);
        if (generationRequestId) {
          pathGenerationRequestLifecycleRef.current = settlePathGenerationRequest(
            pathGenerationRequestLifecycleRef.current,
            'failed',
            { definitive: true },
          );
          setPathGenerationRequestStatus('failed');
          publishPathGenerationStatus('failed', generationRequestId, blockedMessage);
        }
        if (option?.optionId) {
          setPathOptionFeedback((current) => ({ ...current, [option.optionId]: blockedMessage }));
        }
        return;
      }
      if (operation !== 'explain') {
        const generatedBatchId = operation === 'generate' && typeof payload.result?.candidateBatch?.id === 'string'
          ? payload.result.candidateBatch.id
          : null;
        if (generatedBatchId && activeGoal) {
          const loadedBatch = await fetchCandidateBatch(activeGoal, generatedBatchId);
          if (loadedBatch.status === 'loaded') {
            setActiveCandidateBatch(loadedBatch.batch);
            setCandidateBatchLoadState('ready');
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('batch', loadedBatch.batch.id);
            nextUrl.searchParams.delete('candidate');
            window.history.replaceState(window.history.state, '', nextUrl);
          }
        }
        await refreshLatestLearningPathAfterKonling();
        window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated', {
          detail: {
            mode: 'path-advisor',
            courseId: pathGenerationPanel.goalId,
            pageId: 'adaptive-path-center',
            source: 'generation-panel',
          },
        }));
        if (operation === 'revise') {
          const reviseMessage = '路径方案已按新参数调整，请重新比较后选择。';
          setPathChoiceMessage(reviseMessage);
          if (option?.optionId) {
            setPathOptionFeedback((current) => {
              const next = { ...current, [option.optionId]: reviseMessage };
              pathOptions.forEach((pathOption) => {
                next[pathOption.optionId] = reviseMessage;
              });
              return next;
            });
          }
          return;
        }
        if (generationRequestId) {
          pathGenerationRequestLifecycleRef.current = settlePathGenerationRequest(
            pathGenerationRequestLifecycleRef.current,
            'succeeded',
            { definitive: true },
          );
          setPathGenerationRequestStatus('succeeded');
          publishPathGenerationStatus('succeeded', generationRequestId, '学习路径已生成，请比较候选方案。');
        }
        setPathChoiceMessage('学习路径已生成，请比较候选方案。');
        return;
      }
      const rationale = Array.isArray(payload.result?.studentSafeRationale)
        ? payload.result.studentSafeRationale.filter((item: unknown): item is string => typeof item === 'string').join(' ')
        : null;
      const differenceExplanation = operation === 'explain'
        ? readPathDifferenceExplanation(payload.result?.comparison)
        : null;
      if (
        operation === 'explain'
        && (
          explanationRequestVersionKey !== pathOptionVersionKeyRef.current
          || (differenceExplanation && differenceExplanation.pathId !== currentPathId)
        )
      ) {
        return;
      }
      setPathChoiceMessage(
        operation === 'explain'
          ? rationale ?? '已生成路径差异说明。'
          : operation === 'revise' ? '路径方案已按新参数调整。' : '学习路径已生成，请比较后选择方案。',
      );
      if (option?.optionId) {
        if (differenceExplanation) {
          setPathDifferenceExplanations((current) => ({
            ...current,
            [option.optionId]: differenceExplanation,
          }));
        }
        setPathOptionFeedback((current) => ({
          ...current,
          [option.optionId]: operation === 'explain'
            ? rationale ?? '已生成路径差异说明。'
            : operation === 'revise'
              ? '路径方案已按新参数调整。'
              : '学习路径已生成，请比较后选择方案。',
        }));
      }
    } catch (generationError) {
      const errorMessage = generationError instanceof Error ? generationError.message : '学习路径生成失败';
      setPathChoiceMessage(errorMessage);
      if (generationRequestId) {
        pathGenerationRequestLifecycleRef.current = settlePathGenerationRequest(
          pathGenerationRequestLifecycleRef.current,
          'failed',
          { definitive: generationFailureIsDefinitive },
        );
        setPathGenerationRequestStatus('failed');
        publishPathGenerationStatus('failed', generationRequestId, errorMessage);
      }
      if (option?.optionId) {
        setPathOptionFeedback((current) => ({ ...current, [option.optionId]: errorMessage }));
      }
    } finally {
      setPathGenerationPending(null);
    }
  }, [
    activeGoal,
    activeGraphNodeId,
    activePathId,
    assistantEntryPoint,
    authStatus,
    canSubmitPathGeneration,
    hasInvalidRequestedGoal,
    activePathPlan,
    activePathRound,
    pathAdvisorAgentSessionId,
    pathExecutionNodes,
    pathGenerationPanel,
    pathGenerationDisplayReadiness,
    pathGenerationRequestStatus,
    pathOptions,
    refreshLatestLearningPathAfterKonling,
    routeIntent,
  ]);

  const startPathGenerationFromAdvisor = useCallback(() => {
    openPathGenerationAdvisor();
    const claim = claimPathGenerationRequest(
      pathGenerationRequestLifecycleRef.current,
      () => crypto.randomUUID(),
    );
    if (!claim) return;
    pathGenerationRequestLifecycleRef.current = claim.lifecycle;
    void submitPathGeneration('generate', undefined, claim.requestId).finally(() => {
      pathGenerationRequestLifecycleRef.current = releasePathGenerationRequest(
        pathGenerationRequestLifecycleRef.current,
      );
    });
  }, [openPathGenerationAdvisor, submitPathGeneration]);

  const submitPathChoice = useCallback(async (
    action: 'selection' | 'rejection' | 'switch' | 'helpfulness',
    option: PathOptionView,
    helpful?: boolean,
  ) => {
    const pathId = option.candidateId
      ? activeCandidateBatch?.sourcePathId
      : activePathRound?.id ?? activePathPlan?.id;
    if (!pathId) {
      setPathChoiceMessage('当前没有可写入的学习路径。');
      return;
    }
    setPathChoicePending(`${action}:${option.optionId}`);
    setPathChoiceMessage(null);
    setPathOptionFeedback((current) => ({
      ...current,
      [option.optionId]: action === 'rejection'
        ? '正在记录暂不采用原因...'
        : action === 'helpfulness'
          ? '正在记录这条路径的帮助反馈...'
          : '正在记录路径选择...',
    }));
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/choices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChoiceBody(action, option, pathOptions, pathSelectionHistory, helpful)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径选择写入失败');
      }
      const pathUpdate = getRecord(payload.pathUpdate);
      await reloadActiveLearningPath();
      if (action === 'selection' || action === 'switch') {
        const executionQuery = new URLSearchParams({
          goal: activeGoal ?? activePathPlan?.goal.id ?? 'control-correction',
          intent: 'path-execution',
          pathId,
          optionId: option.optionId,
        });
        const currentNodeId = typeof pathUpdate.currentNodeId === 'string'
          ? pathUpdate.currentNodeId
          : option.activeNodeIds?.[0] ?? option.nodeIds?.[0] ?? activePathPlan?.currentNodeId ?? activePathRound?.currentNodeId;
        if (currentNodeId) executionQuery.set('nodeId', currentNodeId);
        window.location.assign(withFeedbackTaskHref(`/assessment/adaptive-practice?${executionQuery.toString()}`));
        return;
      }
      const successMessage = action === 'rejection'
        ? '已记录暂不采用，控灵会在后续调整中避开这类方案。'
        : action === 'helpfulness'
          ? '已记录有帮助，后续路径会优先参考这类方案。'
          : '路径选择证据已记录。';
      setPathChoiceMessage(successMessage);
      setPathOptionFeedback((current) => ({ ...current, [option.optionId]: successMessage }));
    } catch (choiceError) {
      const errorMessage = choiceError instanceof Error ? choiceError.message : '路径选择写入失败';
      setPathChoiceMessage(errorMessage);
      setPathOptionFeedback((current) => ({ ...current, [option.optionId]: errorMessage }));
    } finally {
      setPathChoicePending(null);
    }
  }, [
    activeGoal,
    activeCandidateBatch,
    activePathPlan,
    activePathRound,
    pathOptions,
    pathSelectionHistory,
    reloadActiveLearningPath,
    withFeedbackTaskHref,
  ]);

  const launchPathNodeAction = useCallback(async (action: PostLearningPathNodeAction) => {
    if (!action.body || !action.redirectHref) return;
   if (!isSafeExternalBrowserTarget(action.redirectHref)) {
      setPathExecutionError('外部资源地址未通过平台验证，请重新生成路径。');
     return;
   }
   const resourceWindow = window.open('about:blank', '_blank');
   if (!resourceWindow) {
      setPathExecutionError('浏览器阻止了新资源窗口，请允许本站打开新窗口后重试。');
     return;
    }
    resourceWindow.opener = null;
    try {
      const response = await fetch(action.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点启动失败');
     }
     publishAdaptivePathJourneyResponse(payload);
      setPathExecutionError(null);
     resourceWindow.location.replace(action.redirectHref);
   } catch (launchError) {
     resourceWindow.close();
      setPathExecutionError(launchError instanceof Error ? launchError.message : '路径节点启动失败');
   }
  }, []);

  const launchPathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    if (!isPostLearningPathNodeAction(node.action)) return;
    await launchPathNodeAction(node.action);
  }, [launchPathNodeAction]);

  const launchNextAction = useCallback(async () => {
    const nextAction = adaptivePathCenter?.nextAction;
    if (!nextAction || !isPostLearningPathNodeAction(nextAction)) return;
    await launchPathNodeAction(nextAction);
  }, [adaptivePathCenter, launchPathNodeAction]);

  const launchProjectedUnlockAction = useCallback((action: AdaptivePathUnlockProjectedAction) => {
    if (action.method === 'POST') {
      if (isPostLearningPathNodeAction(action)) void launchPathNodeAction(action);
      return;
    }
    window.location.assign(action.href);
  }, [launchPathNodeAction]);

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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点完成确认失败');
      }
     publishAdaptivePathJourneyResponse(payload);
     await reloadActiveLearningPath();
      setPathExecutionError(null);
   } catch (completionError) {
      setPathExecutionError(completionError instanceof Error ? completionError.message : '路径节点完成确认失败');
    } finally {
      setPathNodeCompletionPending(null);
    }
  }, [reloadActiveLearningPath]);

  const completePathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    await completePathNodeAction(node.nodeId, node.action.completionAction);
  }, [completePathNodeAction]);

  const completeNextAction = useCallback(async () => {
    const nextAction = adaptivePathCenter?.nextAction;
    if (!nextAction?.nodeId) return;
    await completePathNodeAction(nextAction.nodeId, nextAction.completionAction);
  }, [completePathNodeAction, adaptivePathCenter]);

  const writePathNodeActivity = useCallback(async (
    node: PathExecutionNodeView,
    activityKind: string,
    status: 'started' | 'completed' | 'failed' = 'started',
    outcomeMetadata?: Record<string, unknown>,
  ): Promise<boolean> => {
    const pathId = activePathRound?.id ?? activePathPlan?.id;
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
          liftMetadata: { pathActivityKind: activityKind, ...(outcomeMetadata ?? {}) },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径活动写入失败');
      }
     publishAdaptivePathJourneyResponse(payload);
     await reloadActiveLearningPath();
      setPathExecutionError(null);
     return true;
   } catch (activityError) {
      setPathExecutionError(activityError instanceof Error ? activityError.message : '路径活动写入失败');
     return false;
    } finally {
      setPathActivityPending(null);
    }
  }, [activePathPlan, activePathRound, reloadActiveLearningPath]);

  const syncAdaptiveAssessmentPathResult = useCallback(async (result: SubmitAnswerResponse) => {
    if (!activePathId || !activeNodeId || !result.durableAnswerId) return;
    const targetNode = pathExecutionNodes.find((node) => node.nodeId === activeNodeId);
    if (!targetNode || !isPathAssessmentResultNode(targetNode.type)) return;
    await writePathNodeActivity(targetNode, 'initial-completion', 'completed', {
      adaptiveAssessmentRef: result.adaptiveAssessmentRef ?? { id: result.durableAnswerId },
    });
  }, [activeNodeId, activePathId, pathExecutionNodes, writePathNodeActivity]);

  const skipPathNode = useCallback(async (node: PathExecutionNodeView) => {
    const pathId = activePathRound?.id ?? activePathPlan?.id;
    if (!pathId) return;
    setPathActivityPending(`skip:${node.nodeId}`);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/deviations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviationType: 'skip',
          priorNodeId: activePathPlan?.currentNodeId ?? activePathRound?.currentNodeId ?? null,
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
     await reloadActiveLearningPath();
     setSkipCandidateNode(null);
      setPathExecutionError(null);
   } catch (skipError) {
      setPathExecutionError(skipError instanceof Error ? skipError.message : '路径偏离写入失败');
    } finally {
      setPathActivityPending(null);
    }
  }, [activePathPlan, activePathRound, reloadActiveLearningPath]);

  const launchExecutionNode = useCallback(async (node: PathExecutionNodeView) => {
    const targetDisposition = resolveAdaptivePathJourneyTargetDisposition(node.type, node.target);
    if (targetDisposition === 'blocked') {
      setPathExecutionError('路径资源地址未通过平台验证，请返回路径并重新生成。');
      return;
    }
    const ownedTarget = resolveAdaptivePathCenterOwnedTargetHref(node.type, node.target);
   if (requiresOwningPathCenter(node) && !ownedTarget) {
      setPathExecutionError('路径资源地址未通过平台验证，请返回路径并重新生成。');
     return;
   }
   const keepsPathCenter = keepsOwningPathCenterOpen(node);
   const resourceWindow = keepsPathCenter ? window.open('about:blank', '_blank') : null;
   if (keepsPathCenter && !resourceWindow) {
      setPathExecutionError('浏览器阻止了新资源窗口，请允许本站打开新窗口后重试。');
     return;
    }
    if (resourceWindow) resourceWindow.opener = null;
    const pathId = activePathPlan?.id ?? activePathRound?.id;
    const goalId = resolveAdaptivePracticeGoalId(
      activePathPlan?.goal.id ?? activePathRound?.goalId ?? activeGoal,
      activeGoal ?? 'control-correction',
    );
    const launchContext = pathId
      ? {
          goalId: resolveAdaptivePracticeGoalId(
            activePathPlan?.goal.id ?? activePathRound?.goalId ?? activeGoal,
            activeGoal ?? 'control-correction',
          ),
          pathId,
          nodeId: node.nodeId,
          routeIntent: 'path-execution' as const,
          resourceType: node.type,
        }
      : null;
    const activityWritten = await writePathNodeActivity(
      node,
      node.status === 'skipped' ? 'return-to-skipped' : 'initial-completion',
      'started',
    );
    if (!activityWritten) {
      resourceWindow?.close();
    }
    if (!activityWritten) return;
    if (resourceWindow && ownedTarget) {
      resourceWindow.location.replace(
        targetDisposition === 'external-fallback' || !launchContext
          ? ownedTarget
          : buildAdaptivePathLaunchHref(ownedTarget, launchContext),
      );
      return;
    }
    window.location.assign(withFeedbackTaskHref(pathNodeContextHref(node, {
      goalId,
      pathId,
    })));
  }, [activeGoal, activePathPlan, activePathRound, withFeedbackTaskHref, writePathNodeActivity]);

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

  const requestAttemptDiagnosis = useCallback(async () => {
    if (!feedback?.durableAnswerId || attemptDiagnosisState === 'pending') return;
    setAttemptDiagnosisState('pending');
    const entryPoint = {
      mode: 'diagnosis-explainer' as const,
      promptContext: 'adaptive-attempt',
      serverContext: { answerId: feedback.durableAnswerId },
    };
    try {
      await startAssistantConversation(entryPoint, '请解析本题');
      setAttemptDiagnosisState('idle');
    } catch {
      setAttemptDiagnosisState('error');
    }
  }, [attemptDiagnosisState, feedback?.durableAnswerId, startAssistantConversation]);

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
      setAttemptDiagnosisState('idle');
      await syncAdaptiveAssessmentPathResult(data);
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
          sessionId,
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

    const completedPathLearningTime = formatCompletedPathLearningTime(activePathPlan, Boolean(diagnostic));
    const isColdStart = isColdStartLearner({
      learnerStateLoadState,
      // demo 模式是显式零证据夹具，不能与 learner-state API 缺失/失败混为一谈。
      evidenceCount: isDemoMode ? 0 : extractColdStartEvidenceCount(activeLearnerState),
    });
    const currentNode = practiceRouteNodes.find((node) => node.state === 'current') ?? practiceRouteNodes[0];
    const compactCurrentNodeTitle = compactPathNodeTitle(currentNode?.title);
    const nextPathAction = adaptivePathCenter?.nextAction ?? null;
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
        journeyControl={<AdaptivePathJourneyControlFromRoute />}
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '自适应学习路径中心' },
        ]}
        dockControls={[
          {
            id: 'adaptive-path-konling',
            label: '控灵助手',
            control: 'konling',
            onSelect: openPathGenerationAdvisor,
            disabled: !canSubmitPathGeneration,
            icon: <BrainCircuit className="h-4 w-4 text-primary" />,
          },
        ]}
        className="surface-page"
      >
        <section
          className="flex flex-col gap-5"
          data-commercial-workspace="adaptive-path-center"
          data-adaptive-path-center="generation-selection"
          data-adaptive-path-landing-state={pathLandingState}
          data-adaptive-path-workspace-intent={workspaceIntent}
          data-commercial-student-entry-route="/assessment/adaptive-practice"
          data-commercial-entry-intent="practice"
          data-student-entry-evidence-return="/profile/evidence"
          data-adaptive-path-generation-state="generation-main"
          data-adaptive-path-comparison-state="information-grid"
          data-konling-dock-placement="shared-right-bottom"
          data-route-family={learnerDataShell.routeFamily}
          data-adaptive-path-dock-collision-policy={
            showExecutionWorkspace || showRecoveredExecutionWorkspace ? 'avoid-learning-record' : undefined
          }
          data-route-identity={learnerDataShell.routeIdentity}
          data-learner-record-surface={learnerDataShell.archetype}
          data-learner-record-priority="current-path"
          data-learner-record-next-action="generate-and-compare-path"
          data-learner-record-evidence-confidence={adaptivePathCenter?.nextAction.confidence ?? 'unknown'}
          data-learner-record-evidence-need={adaptivePathCenter?.readinessGate.missing.length ? 'learning-task-evidence-needed' : 'generic-path-center'}
        >
          <StudentFeedbackTaskPanel context={feedbackContext} surface="adaptive-practice" />
          {adaptivePathCenter ? (
            <span
              className="sr-only"
              data-control-correction-center="adaptive-practice"
              data-control-correction-goal={adaptivePathCenter.goalId}
              data-control-correction-intent={adaptivePathCenter.entry.routeIntent}
              data-control-correction-ready={String(adaptivePathCenter.readinessGate.ready)}
              data-control-correction-alternative-count={controlCorrectionAlternativeCount(adaptivePathCenter)}
            />
          ) : null}
          {showLandingWorkspace && pathLandingState === 'active' ? (
          <section
            className="surface-card flex flex-wrap items-center justify-between gap-4 p-4"
            data-adaptive-path-landing-state="active"
            data-adaptive-path-action-bar="active"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                <span className="rounded-md border border-border bg-muted px-2.5 py-1">当前学习路径</span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1">{activeGoalLabel}</span>
              </div>
              <p className="mt-2 text-sm text-subtle">
                原路径仍会保留；你可以继续学习，也可以生成新的候选路径进行比较。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activePathContinueHref ? (
                <Link
                  href={activePathContinueHref}
                  data-adaptive-path-continue-action="current-path"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  继续当前路径
                </Link>
              ) : null}
              <Link
                href={feedbackGenericPathGenerationHref}
                data-adaptive-path-generation-action="new-path"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                新建学习路径
              </Link>
              <Link
                href="/profile/evidence"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
              >
                <History className="size-4" aria-hidden="true" />
                查看学习记录
              </Link>
            </div>
          </section>
          ) : null}
          {showExecutionWorkspace || showRecoveredExecutionWorkspace ? null :
          showLandingWorkspace && pathLandingState === 'loading' ? (
          <header
            className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]"
            data-adaptive-path-landing-state="loading"
            aria-busy="true"
          >
            <div className="surface-card min-h-56 p-5" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                  <RefreshCw className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-medium text-primary">学习路径</p>
                  <h1 className="text-xl font-semibold text-foreground">正在加载学习路径</h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-subtle">
                正在确认你的活动路径、当前节点和学习进度，请稍候。
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-hidden="true">
                <div className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
                <div className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
              </div>
            </div>
            <aside className="surface-card min-h-56 p-5" aria-hidden="true">
              <div className="h-5 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="mt-5 h-4 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="mt-6 h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            </aside>
          </header>
          ) : showLandingWorkspace && pathLandingState === 'failed' ? (
          <header
            className="surface-card min-h-56 p-5"
            data-adaptive-path-landing-state="failed"
            role="alert"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                <RefreshCw className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-primary">学习路径</p>
                <h1 className="text-xl font-semibold text-foreground">学习路径暂时无法加载</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-subtle">
              当前无法确认你的活动路径，因此不会显示入门路径或生成入口。请重新加载路径数据。
            </p>
            <button
              type="button"
              onClick={retryPathContext}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              data-adaptive-path-retry="landing"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              重新加载
            </button>
          </header>
          ) : (
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
                {pathAdvisorContextGoal ? (
                  <button
                    type="button"
                    onClick={startPathGenerationFromAdvisor}
                    disabled={!canSubmitPathGeneration || pathGenerationRequestStatus === 'pending'}
                    data-adaptive-path-generation-action="open-in-page-path-advisor"
                    data-adaptive-generation-readiness-status={pathGenerationDisplayReadiness.status}
                    data-adaptive-generation-readiness-reason={pathGenerationDisplayReadiness.reason}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    {!canSubmitPathGeneration
                      ? '路径顾问准备中'
                      : pathGenerationRequestStatus === 'pending'
                        ? '正在准备生成'
                        : pathGenerationRequestStatus === 'running'
                          ? '查看生成进度'
                          : pathGenerationRequestStatus === 'failed'
                            ? '重试生成'
                            : pathGenerationRequestStatus === 'succeeded'
                              ? '重新生成'
                              : '请控灵生成路径'}
                  </button>
                ) : (
                  <Link
                    href={feedbackGenericPathGenerationHref}
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
                  查看学习记录
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (pathManagementTargetModuleId) {
                      openAndScrollPathModule(pathManagementTargetModuleId);
                    }
                  }}
                  disabled={!pathManagementTargetModuleId}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  data-adaptive-path-local-command="path-management"
                  data-primary-route-local-command-zone="adaptive-path-local-toolbar"
                >
                  <Settings className="size-4" aria-hidden="true" />
                  路径管理
                </button>
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
            {isColdStart ? (
            <>
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-subtle">推荐依据</p>
                <p className="mt-1 text-sm leading-6 text-foreground">
                  当前暂无历史学习记录，系统根据课程知识结构生成初始路径。
                  完成诊断、练习和互动任务后，系统会根据新的学习记录调整后续路径推荐。
                </p>
              </div>
              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-subtle">提升推荐准确度</p>
                <ul className="mt-2 grid gap-2 text-sm">
                  <li className="flex items-start gap-2 leading-6 text-foreground">
                    <span className="mt-1.5 grid size-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                    <span>完成诊断 → 系统了解薄弱知识点，细化能力画像</span>
                  </li>
                  <li className="flex items-start gap-2 leading-6 text-foreground">
                    <span className="mt-1.5 grid size-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                    <span>完成练习 → 系统更新知识掌握程度估计</span>
                  </li>
                  <li className="flex items-start gap-2 leading-6 text-foreground">
                    <span className="mt-1.5 grid size-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                    <span>完成仿真 → 系统优化实践能力推荐</span>
                  </li>
                </ul>
              </div>
            </>
            ) : null}
            </aside>
          </header>
          )}

          {showColdStartLandingWorkspace || showGenerationWorkspace ? (
          <section className={`order-10 grid gap-4 ${showColdStartLandingWorkspace && showGenerationWorkspace ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
            {showColdStartLandingWorkspace ? (
            <PathWorkspaceModule
              moduleId="learning-overview"
              openModuleId={openPathModuleId}
              onToggle={togglePathModule}
              eyebrow="Learning overview"
              title="学习概况"
              icon={Clock3}
              data-adaptive-path-overview="learning-overview"
            >
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['当前目标', '自动控制原理核心能力'],
                  ['当前节点', compactCurrentNodeTitle],
                  ['已完成节点时长', completedPathLearningTime],
                  ['预计总时长', '3 小时 10 分'],
                  ['本周完成情况', percentLabel(weeklyProgress)],
                  ['证据覆盖', adaptivePathCenter ? formatConfidence(adaptivePathCenter.nextAction.confidence) : '待积累'],
                  ['缺失证据', adaptivePathCenter?.readinessGate.missing.length ? '需要继续完成学习任务' : '暂无完整路径证据'],
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
                          href={withFeedbackTaskHref(nextPathAction.href)}
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
            </PathWorkspaceModule>
            ) : null}

            {showGenerationWorkspace ? (
            <div
              className="surface-card p-5"
              data-konling-generation-parameters="adaptive-path"
              data-adaptive-path-generation-panel="editable"
              data-adaptive-path-generation-mobile-sheet="bottom-sheet"
              data-konling-citation-slot="cited-explanation"
              data-adaptive-generation-readiness-status={pathGenerationDisplayReadiness.status}
              data-adaptive-generation-readiness-reason={pathGenerationDisplayReadiness.reason}
              data-adaptive-generation-student-action={pathGenerationDisplayReadiness.studentAction}
              data-adaptive-generation-staff-action={pathGenerationDisplayReadiness.staffAction}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">生成设置</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">调整路径生成方案</h2>
                  <p className="mt-2 text-sm text-subtle">选择目标和可用时间，系统会生成可比较的学习路径。</p>
                </div>
                <MessageSquare className="size-5 text-primary" aria-hidden="true" />
              </div>
              {pathGenerationDisplayReadiness.status !== 'ready' ? (
                <div
                  className="mt-4 rounded-lg border border-border bg-muted/45 p-3"
                  role="status"
                  aria-live="polite"
                  data-adaptive-generation-readiness-card={pathGenerationDisplayReadiness.reason}
                >
                  <p className="text-sm font-medium text-foreground">{pathGenerationDisplayReadiness.studentMessage}</p>
                  <p className="mt-1 text-xs leading-5 text-subtle">
                    如仍无法继续，请把当前状态转交给教师或管理员处理。
                  </p>
                  {pathGenerationDisplayReadiness.studentAction === 'login' ? (
                    <Link
                      href={loginHref}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      登录后继续
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 grid gap-3" data-adaptive-path-generation-request="structured-panel">
                <label className="block rounded-lg border border-border bg-background/45 p-3">
                  <span className="text-xs text-subtle">学习目标</span>
                  <select
                    value={pathGenerationPanel.goalId}
                    onChange={(event) => handlePathGenerationGoalChange(event.target.value)}
                    disabled={pathGenerationRequestStatus === 'pending' || pathGenerationRequestStatus === 'running'}
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
                  onClick={startPathGenerationFromAdvisor}
                  disabled={pathGenerationPending !== null || hasInvalidRequestedGoal || !canSubmitPathGeneration}
                  data-adaptive-path-generation-action="submit-panel-request"
                  data-adaptive-generation-readiness-action={pathGenerationDisplayReadiness.studentAction}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {pathGenerationRequestStatus === 'running'
                    ? '查看生成进度'
                    : pathGenerationRequestStatus === 'failed'
                      ? '重试生成'
                      : pathGenerationRequestStatus === 'succeeded'
                        ? '重新生成'
                        : pathGenerationPending === 'generate' ? '正在生成' : '生成路径'}
                </button>
                <button
                  type="button"
                  onClick={openPathGenerationAdvisor}
                  disabled={!canSubmitPathGeneration}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary disabled:opacity-60"
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                  打开控灵
                </button>
              </div>
            </div>
            ) : null}
          </section>
          ) : null}

          {showPresetGoalCards ? (
          <PathWorkspaceModule
            moduleId="goal-selection"
            openModuleId={openPathModuleId}
            onToggle={togglePathModule}
            eyebrow="Goal selection"
            title="选择路径目标"
            summary="先选定目标，再让控灵结合学习证据生成路径。目标不同，推荐资源、检查点和练习节奏也会不同。"
            className="order-30"
            trailing={(
              <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                {generationGoalOptions.length} 个目标
              </span>
            )}
            data-adaptive-path-generation-goal-list="generic"
            data-adaptive-path-generation-default-scope="goal-selection"
          >
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {generationGoalOptions.map((goal, index) => {
                const GoalIcon = goal.intentType === 'controller-design'
                  ? GitBranch
                  : goal.intentType === 'simulation-validation'
                    ? Compass
                    : Target;
                return (
                  <div
                    key={goal.id}
                    className="rounded-lg border border-border bg-background/55 p-4"
                    data-adaptive-path-generation-goal={goal.id}
                    data-adaptive-path-generation-ready="catalog"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-primary">
                        <GoalIcon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs text-subtle">目标 {index + 1}</p>
                        <h3 className="text-base font-semibold text-foreground">{goal.label}</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-subtle">{goal.detail}</p>
                    <p className="mt-2 text-xs leading-5 text-subtle">{goal.terminalValidationSummary}</p>
                    <Link
                      href={withFeedbackTaskHref(goal.hrefs.generation)}
                      data-adaptive-path-generation-action="enter-registered-goal-context"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      生成该目标路径
                    </Link>
                  </div>
                );
              })}
            </div>
          </PathWorkspaceModule>
          ) : null}

          {showGenerationWorkspace || showSelectionWorkspace ? (
            <div
              className={showSelectionWorkspace ? 'min-h-[2.75rem]' : undefined}
              data-adaptive-path-status-region={showSelectionWorkspace ? 'reserved' : 'inline'}
            >
              {pathChoiceMessage ? (
                <p
                  className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {pathChoiceMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {showPathContextRecovery ? (
            <section
              className="surface-card p-5"
              role="status"
              aria-live="polite"
              data-adaptive-path-recovery-state={pathContextRecoveryState.reason}
              data-adaptive-path-recovery-intent={workspaceIntent}
              data-adaptive-path-recovery-path-id={activePathId ?? 'missing'}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-primary">路径恢复</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{pathContextRecoveryState.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">{pathContextRecoveryState.detail}</p>
                </div>
                <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                  {workspaceIntent === 'evidence-review'
                    ? '证据复核'
                    : workspaceIntent === 'execution'
                      ? '路径执行'
                      : '路径选择'}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-subtle">请求动作</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {workspaceIntent === 'evidence-review'
                      ? '复核路径证据'
                      : workspaceIntent === 'execution'
                        ? '继续执行路径'
                        : '选择学习路径'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-subtle">路径来源</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {pathContextRecoveryState.reason === 'path-load-failed'
                      ? '路径服务暂时不可用'
                      : activePathId
                        ? '链接中的路径不可用'
                        : '当前目标尚未生成路径'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-subtle">当前状态</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">暂不展示进度或执行入口</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {pathContextRecoveryState.reason === 'auth-required' ? (
                  <Link
                    href={loginHref}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    登录后继续
                  </Link>
                ) : (
                  <Link
                    href={activeGoal ? withFeedbackTaskHref(buildPathGenerationGoalHref(activeGoal, pathGenerationPanel)) : feedbackGenericPathGenerationHref}
                    data-adaptive-path-recovery-action="generate-path"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    生成学习路径
                  </Link>
                )}
                <Link
                  href={pathContextRecoveryEvidenceHref}
                  data-adaptive-path-recovery-action="review-evidence"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
                >
                  <History className="size-4" aria-hidden="true" />
                  查看学习记录
                </Link>
                <Link
                  href={pathContextRecoveryReturnHref}
                  data-adaptive-path-recovery-action="return-to-task"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  返回来源
                </Link>
              </div>
            </section>
          ) : null}

          {showSelectionWorkspace && !showPathContextRecovery ? (
            <PathWorkspaceModule
              moduleId="path-selection"
              openModuleId={openPathModuleId}
              onToggle={togglePathModule}
              eyebrow="Path comparison"
              title={hasGeneratedPathOptions ? '选择你的学习路径' : '查看示例学习方式'}
              summary={hasGeneratedPathOptions
                ? '不同路径按同一组字段比较，便于直接判断取舍。'
                : '生成正式学习路径后，系统会展示具体资源、顺序和方案差异。'}
              className="order-40"
              trailing={(
                <div className="flex items-center gap-2">
                  {focusedCandidateId && activeCandidateBatch ? (
                    <Link
                      href={compareAllCandidateHref}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.history.pushState(window.history.state, '', compareAllCandidateHref);
                        setFocusedCandidateId(null);
                        setOpenPathModuleId('path-selection');
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                      data-learning-path-compare-all
                    >
                      比较全部路径
                    </Link>
                  ) : null}
                <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                  {hasGeneratedPathOptions ? `${visiblePathOptions.length} 条可比较路径` : `${visiblePathOptions.length} 个学习方式示例`}
                </span>
                </div>
              )}
              data-learning-path-product-surface="path-options-selection-history-terminal-validation"
              data-learning-path-options-slot={hasGeneratedPathOptions ? 'three-style' : 'starter-examples'}
              data-learning-path-options-layout="route-modules"
            >
            {pathConfigurationFulfillment.length > 0 || pathBudgetLimitation.insufficient || Boolean(pathOptionFallback) ? (
              <section
                className="mt-4 rounded-lg border border-border bg-background/55 p-3 text-sm"
                data-adaptive-path-configuration-fulfillment="visible"
              >
                <p className="font-medium text-foreground">本次配置如何影响路径</p>
                <div className="mt-2 grid gap-2">
                  {pathConfigurationFulfillment.map((entry) => (
                    <p key={entry.key} className="leading-6 text-subtle">
                      <span className="font-medium text-foreground">{entry.status === 'applied' ? '已应用：' : '未满足：'}</span>
                      {entry.status === 'applied' ? entry.effect : entry.message}
                    </p>
                  ))}
                  {pathBudgetLimitation.insufficient &&
                    pathBudgetLimitation.requestedMinutes !== null &&
                    pathBudgetLimitation.minimumMinutes !== null ? (
                    <p className="leading-6 text-subtle">
                      <span className="font-medium text-foreground">学习时长不足：</span>
                      你选择了 {pathBudgetLimitation.requestedMinutes} 分钟，完成必需验证至少需要 {pathBudgetLimitation.minimumMinutes} 分钟。
                    </p>
                  ) : null}
                  {pathOptionFallback && visiblePathOptions.length < 3 ? (
                    <p className="leading-6 text-subtle">
                      当前可用资源不足以形成更多真正不同的方案，因此仅展示 {visiblePathOptions.length} 条可执行路径。
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
            {hasGeneratedPathOptions && pathComparisonDiversityLimited ? (
              <p
                className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm leading-6 text-foreground"
                data-learning-path-diversity-notice="limited"
              >
                当前可用资源有限，推荐方案差异较小。
              </p>
            ) : null}
            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]" data-learning-path-desktop-modules="attached-actions">
              {visiblePathOptions.map((option) => (
                <article
                  key={option.id}
                  className="flex min-h-full flex-col rounded-lg border border-border bg-muted/30 p-3"
                  data-learning-path-option={option.isGenerated ? option.id : undefined}
                  data-learning-path-option-module={option.isGenerated ? 'route' : undefined}
                  data-learning-path-example={option.isGenerated ? undefined : option.id}
                >
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-subtle">{option.scenario}</p>
                    {!option.isGenerated ? (
                      <p className="mt-2 text-xs leading-5 text-subtle" data-learning-path-starter-example={option.id}>
                        示例学习方式，不是已生成的正式路径。
                      </p>
                    ) : null}
                  </div>
                  <PathOptionRoutePreview option={option} />
                  <PathRecommendationProvenance option={option} />
                  <div className="mt-3 grid gap-2 text-sm">
                    {[
                      ['预计时长', option.estimatedTime],
                      ['已匹配资源', option.resources.map((resource) => resource.label).join('、')],
                      ['准备度', option.readiness],
                      ['检查节点', option.checkpoints],
                      ['当前建议理由', option.reason],
                      ...(option.expectedAbilityImprovement ? [['预期能力改善', option.expectedAbilityImprovement]] : []),
                      ['预期结果', option.outcome],
                      ['风险提示', option.riskNote],
                    ].map(([label, value]) => (
                      <div key={`${option.id}:${label}`} className="rounded-lg border border-border bg-background/55 p-3">
                        <p className="text-xs font-medium text-foreground">{label}</p>
                        <p className="mt-1 leading-6 text-subtle">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {option.resources.map((resource, resourceIndex) => {
                      const Icon = adaptivePathResourceIcons[resource.kind];
                      return (
                        <span key={`${option.id}:${resource.kind}:${resourceIndex}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-subtle">
                          <Icon className="size-3.5" aria-hidden="true" />
                          {resource.label}
                        </span>
                      );
                    })}
                  </div>
                  {option.isGenerated ? (
                  <div className="mt-auto grid gap-2 pt-3" data-learning-path-option-actions="attached">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      aria-label={`选择${option.title}`}
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
                        aria-label={`请控灵调整${option.title}`}
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
                        aria-label={`解释${option.title}差异`}
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
                        aria-label={`暂不采用${option.title}`}
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
                        aria-label={`标记${option.title}有帮助`}
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
                    {option.writeOption && pathDifferenceExplanations[option.writeOption.optionId] ? (
                      <PathDifferenceExplanationPanel explanation={pathDifferenceExplanations[option.writeOption.optionId]} />
                    ) : option.writeOption && pathOptionFeedback[option.writeOption.optionId] ? (
                      <p
                        className="rounded-lg border border-border bg-background/65 px-3 py-2 text-xs leading-5 text-foreground"
                        role="status"
                        aria-live="polite"
                        data-learning-path-option-feedback={option.writeOption.optionId}
                      >
                        {pathOptionFeedback[option.writeOption.optionId]}
                      </p>
                    ) : null}
                  </div>
                  ) : (
                    <p className="mt-auto pt-3 text-xs leading-5 text-subtle">
                      生成正式学习路径后，可查看完整资源安排并进行选择。
                    </p>
                  )}
                </article>
              ))}
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
                <section
                  key={`${option.id}:mobile`}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                  data-learning-path-option={option.isGenerated ? option.id : undefined}
                  data-learning-path-option-module={option.isGenerated ? 'route' : undefined}
                  data-learning-path-example={option.isGenerated ? undefined : option.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-subtle">{option.scenario}</p>
                      {!option.isGenerated ? (
                        <p className="mt-2 text-xs leading-5 text-subtle" data-learning-path-starter-example={`${option.id}:mobile`}>
                          示例学习方式，不是已生成的正式路径。
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-subtle">
                      {option.estimatedTime}
                    </span>
                  </div>
                  <PathOptionRoutePreview option={option} />
                  <PathRecommendationProvenance option={option} />
                  <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/60 p-3 text-sm">
                    <p className="leading-6 text-foreground">{option.reason}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs text-subtle">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">{option.checkpoints}</span>
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">{option.readiness}</span>
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
                        {option.resources.slice(0, 2).map((resource) => resource.label).join('、')}
                      </span>
                    </div>
                    {option.expectedAbilityImprovement ? (
                      <p className="text-xs leading-5 text-subtle">预期能力改善：{option.expectedAbilityImprovement}</p>
                    ) : null}
                    <p className="text-xs leading-5 text-subtle">{option.outcome}</p>
                    <p className="text-xs leading-5 text-subtle">{option.riskNote}</p>
                  </div>
                  <details className="mt-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-subtle">
                    <summary className="cursor-pointer font-medium text-foreground">查看资源组合</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {option.resources.map((resource, resourceIndex) => {
                        const Icon = adaptivePathResourceIcons[resource.kind];
                        return (
                          <span key={`${option.id}:mobile:${resource.kind}:${resourceIndex}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1">
                            <Icon className="size-3.5" aria-hidden="true" />
                            {resource.label}
                          </span>
                        );
                      })}
                    </div>
                  </details>
                  {option.isGenerated ? (
                  <div className="mt-3 grid gap-2" data-learning-path-mobile-actions="primary-then-secondary" data-learning-path-option-actions="attached">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      aria-label={`选择${option.title}`}
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
                        aria-label={`请控灵调整${option.title}`}
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
                        aria-label={`解释${option.title}差异`}
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
                        aria-label={`暂不采用${option.title}`}
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
                        aria-label={`标记${option.title}有帮助`}
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
                    {option.writeOption && pathDifferenceExplanations[option.writeOption.optionId] ? (
                      <PathDifferenceExplanationPanel explanation={pathDifferenceExplanations[option.writeOption.optionId]} />
                    ) : option.writeOption && pathOptionFeedback[option.writeOption.optionId] ? (
                      <p
                        className="rounded-lg border border-border bg-background/65 px-3 py-2 text-xs leading-5 text-foreground"
                        role="status"
                        aria-live="polite"
                        data-learning-path-option-feedback={option.writeOption.optionId}
                      >
                        {pathOptionFeedback[option.writeOption.optionId]}
                      </p>
                    ) : null}
                  </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-subtle">
                      生成正式学习路径后，可查看完整资源安排并进行选择。
                    </p>
                  )}
                </section>
              ))}
            </div>

          </PathWorkspaceModule>
          ) : null}

          {showCompletedPathSummary ? (
            <section
              className="surface-card p-5"
              data-adaptive-path-completed-summary="latest-restored"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">Completed route</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">已完成的学习路径</h2>
                  <p className="mt-2 text-sm text-subtle">
                    最近完成的路径已恢复，可复看完成节点、证据状态，并按需要生成新路径。
                  </p>
                </div>
                <Link
                  href={buildPathGenerationGoalHref(activeExecutionGoalId, pathGenerationPanel)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  生成新路径
                </Link>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['路径名称', activePathRound?.title ?? activePathPlan?.goal.title ?? '学习路径'],
                  ['完成节点', pathExecutionSummary.completed],
                  ['完成时间', formatPathCompletionTime(activePathRound)],
                  ['证据状态', pathExecutionNodes.some((node) => node.result?.state === 'pending') ? '结果待同步' : '已记录'],
                  ['下一步', '生成新路径或切换目标'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-subtle">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!showPathContextRecovery && (showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace) && pathExecutionNodes.length > 0 ? (
            <section className="order-20 grid min-w-0 w-full gap-4">
              {showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace ? (
              <PathWorkspaceModule
                moduleId="current-path"
                openModuleId={openPathModuleId}
                onToggle={togglePathModule}
                eyebrow="Active route"
                title={activePathRound?.title ?? activePathPlan?.goal.title ?? '当前学习路径'}
                summary="按顺序完成节点；当前展开节点的详情和操作保持在原位。"
                trailing={(
                  <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-subtle">
                    当前节点：{currentPathNode?.title ?? '待定位'}
                  </span>
                )}
               data-adaptive-path-execution-surface="active-route"
            >
                {pathExecutionError ? (
                 <div
                   className="mb-4 rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-sm"
                   data-adaptive-path-execution-error="visible"
                 >
                   <p className="font-medium text-foreground">路径操作未能完成</p>
                    <p className="mt-1 leading-6 text-subtle">{pathExecutionError}</p>
                   <div className="mt-3 flex flex-wrap gap-2">
                     <button
                       type="button"
                        onClick={() => { setPathExecutionError(null); void reloadActiveLearningPath(); }}
                       className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground"
                     >
                       <RefreshCw className="size-3.5" aria-hidden="true" />
                       刷新路径状态
                     </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2 sm:grid-cols-3" data-adaptive-path-progress-summary="essential">
                  {[
                    ['完成节点', pathExecutionSummary.completed],
                    ['预计剩余', pathExecutionSummary.remaining],
                    ['检查点通过', pathExecutionSummary.checkpointPass],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-subtle">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4" data-adaptive-path-route-map="compact">
                  <AdaptivePathTimeline
                    nodes={pathExecutionNodes}
                    focusedNodeId={focusedPathNode?.nodeId ?? null}
                    onFocus={setSelectedPathNodeId}
                    renderExpandedContent={(node) => (
                      <>
                        <p className="text-xs text-primary">{node.resourceLabel}</p>
                        <h3 className="mt-1 text-base font-semibold text-foreground">{node.title}</h3>
                        <dl className="mt-4 space-y-3 text-sm">
                          <div data-adaptive-path-node-selection-basis={node.selectionBasis ? 'recorded' : 'unavailable'}>
                            <dt className="text-xs text-subtle">入选依据</dt>
                            {node.selectionBasis ? (
                              <dd className="mt-1 min-w-0 text-foreground">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="break-words">{node.selectionBasis.summary}</span>
                                  <span className="shrink-0 rounded-md border border-border bg-background/70 px-2 py-0.5 text-xs text-subtle">
                                    {recommendationConfidenceLabel(node.selectionBasis.confidence)}
                                  </span>
                                </div>
                                {node.selectionBasis.supportingFacts.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-xs leading-5 text-subtle">
                                    {node.selectionBasis.supportingFacts.map((fact) => <li key={fact} className="break-words">{fact}</li>)}
                                  </ul>
                                ) : null}
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-foreground">相关学习事件</p>
                                  <StudentEvidenceEventList
                                    references={node.selectionBasis.eventReferences}
                                    emptyMessage="该路径生成时尚未记录可核验的事件级依据。"
                                  />
                                </div>
                                {node.selectionBasis.limitations.map((limitation) => (
                                  <p key={limitation} className="mt-2 break-words text-xs leading-5 text-subtle">限制：{limitation}</p>
                                ))}
                              </dd>
                            ) : (
                              <dd className="mt-1 break-words text-foreground">
                                该路径生成时尚未记录节点级入选依据，无法用当前学习状态还原当时判断。
                              </dd>
                            )}
                          </div>
                          <div data-adaptive-path-node-latest-adjustment={node.latestAdjustment?.kind ?? 'none'}>
                            <dt className="text-xs text-subtle">最近调整</dt>
                            <dd className="mt-1 break-words text-foreground">
                              {node.latestAdjustment?.summary ?? '尚无已确认的路径调整直接影响该节点。'}
                            </dd>
                            {node.latestAdjustment && node.latestAdjustment.supportingFacts.length > 0 ? (
                              <dd className="mt-2 text-xs leading-5 text-subtle">
                                {node.latestAdjustment.supportingFacts.map((fact) => <p key={fact} className="break-words">{fact}</p>)}
                              </dd>
                            ) : null}
                          </div>
                          {node.status !== 'completed' && node.status !== 'skipped' &&
                          ['locked', 'evidence-needed', 'needs-preparation'].includes(node.readinessState) &&
                          (node.lockReason || node.unlockMessage) ? (
                            <div data-adaptive-path-node-current-lock="governed">
                              <dt className="text-xs text-subtle">当前锁定原因</dt>
                              <dd className="mt-1 break-words text-foreground">{node.lockReason ?? node.unlockMessage}</dd>
                              {node.unlockMessage && node.unlockMessage !== node.lockReason ? (
                                <dd className="mt-1 break-words text-xs text-subtle">解锁动作：{node.unlockMessage}</dd>
                              ) : null}
                            </div>
                          ) : null}
                          <div>
                            <dt className="text-xs text-subtle">节点安排说明</dt>
                            <dd className="mt-1 text-foreground">{node.reason}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">将收集的学习证据</dt>
                            <dd className="mt-1 text-foreground">{node.evidence}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">检查标准</dt>
                            <dd className="mt-1 text-foreground">{node.checkpoint}</dd>
                          </div>
                        </dl>
                        {node.unlockChain ? (
                          <div className="mt-4">
                            <AdaptivePathUnlockChainView
                              chain={node.unlockChain}
                              onAction={resolveAdaptivePathUnlockChainAction(
                                node.unlockChain,
                                adaptivePathCenter?.nextAction,
                              )
                                ? () => {
                                    const projectedAction = resolveAdaptivePathUnlockChainAction(
                                      node.unlockChain,
                                      adaptivePathCenter?.nextAction,
                                    );
                                    if (projectedAction) launchProjectedUnlockAction(projectedAction);
                                  }
                                : undefined}
                            />
                          </div>
                        ) : null}
                        {node.result ? (
                          <div
                            className={`mt-4 min-w-0 rounded-lg border p-3 text-sm ${
                              node.result.state === 'available'
                                ? 'border-platform-evidence-eligible/45 bg-platform-evidence-eligible/10'
                                : 'border-platform-evidence-context/45 bg-platform-evidence-context/10'
                            }`}
                            data-adaptive-path-result-card={node.result.state}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs text-subtle">节点结果</p>
                                <h4 className="mt-1 text-sm font-semibold text-foreground">
                                  {node.result.state === 'available' ? node.result.label : '结果待同步'}
                                </h4>
                              </div>
                              <span className="rounded-md border border-border bg-background/70 px-2 py-1 text-xs text-subtle">
                                {node.result.reviewState === 'ready' ? '可复核' : '等待绑定'}
                              </span>
                            </div>
                            <dl className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                              <div className="min-w-0">
                                <dt className="text-xs text-subtle">证据来源</dt>
                                <dd className="mt-1 break-words text-foreground">{node.result.evidenceSource}</dd>
                              </div>
                              <div className="min-w-0">
                                <dt className="text-xs text-subtle">关键指标</dt>
                                <dd className="mt-1 break-words text-foreground">{node.result.primaryMetric ?? '等待结果写入'}</dd>
                              </div>
                            </dl>
                            {node.result.state === 'pending' ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void reloadActiveLearningPath()}
                                  className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                                >
                                  刷新结果
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPathNodeId(currentPathNode?.nodeId ?? node.nodeId)}
                                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                                >
                                  返回当前节点
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-4 flex min-w-0 flex-wrap gap-2" data-adaptive-path-node-actions="attached">
                          {node.status === 'completed' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void writePathNodeActivity(node, 'review', 'started')}
                                disabled={pathActivityPending === `review:${node.nodeId}`}
                                className="rounded-lg border border-border px-3 py-2 text-xs text-foreground disabled:opacity-60"
                              >
                                回顾
                              </button>
                              <button
                                type="button"
                                onClick={() => void writePathNodeActivity(node, 'continued-interaction', 'started')}
                                disabled={pathActivityPending === `continued-interaction:${node.nodeId}`}
                                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                              >
                                继续互动
                              </button>
                              <Link
                                href={`/profile/evidence?goal=${encodeURIComponent(activeExecutionGoalId)}&pathId=${encodeURIComponent(activePathPlan?.id ?? '')}&nodeId=${encodeURIComponent(node.nodeId)}`}
                                className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                              >
                                查看证据
                              </Link>
                            </>
                          ) : node.status === 'current' || node.status === 'skipped' ? (
                            <>
                              {node.status !== 'skipped' ? (
                                <AdaptivePathOwnedResourceAction
                                  opened={pathCenterOpenedNodeIds.has(node.nodeId)}
                                  completionAllowed={allowsPathCenterExplicitCompletion(node)}
                                  pending={pathActivityPending === `initial-completion:${node.nodeId}`}
                                  onStart={() => void launchExecutionNode(node)}
                                  onComplete={() => void writePathNodeActivity(
                                    node,
                                    'initial-completion',
                                    'completed',
                                    { completionIntent: 'learner-confirmed-path-center-owned-resource' },
                                  )}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void launchExecutionNode(node)}
                                  disabled={pathActivityPending === `initial-completion:${node.nodeId}` ||
                                    pathActivityPending === `return-to-skipped:${node.nodeId}`}
                                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                                >
                                  返回学习
                                </button>
                              )}
                              {node.status !== 'skipped' ? (
                                <button
                                  type="button"
                                  onClick={() => setSkipCandidateNode(node)}
                                  className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                                >
                                  跳过
                                </button>
                              ) : null}
                            </>
                          ) : node.status === 'locked' ? (
                            resolveAdaptivePathUnlockChainAction(
                              node.unlockChain,
                              adaptivePathCenter?.nextAction,
                            ) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const projectedAction = resolveAdaptivePathUnlockChainAction(
                                    node.unlockChain,
                                    adaptivePathCenter?.nextAction,
                                  );
                                  if (projectedAction) launchProjectedUnlockAction(projectedAction);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background"
                              >
                                {node.unlockChain?.nextAction?.title}
                              </button>
                            ) : (
                              <span className="rounded-lg border border-border px-3 py-2 text-xs text-subtle">
                                {node.unlockChain?.nextAction?.title
                                  ?? node.unlockChain?.fallbackMessage
                                  ?? node.unlockMessage
                                  ?? '稍后解锁'}
                              </span>
                            )
                          ) : (
                            <span className="rounded-lg border border-border px-3 py-2 text-xs text-subtle">等待前置节点</span>
                          )}
                        </div>
                      </>
                    )}
                  />
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
              </PathWorkspaceModule>
              ) : null}

              <PathWorkspaceModule
                moduleId="learning-record"
                openModuleId={openPathModuleId}
                onToggle={togglePathModule}
                eyebrow="Learning record"
                title="学习记录"
                icon={History}
                data-adaptive-path-history-surface="timeline-evidence"
                data-adaptive-path-evidence-sources="complete"
                data-adaptive-path-evidence-states="student-safe"
              >
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
                          {item.resultLabel ? (
                            <p className="mt-2 inline-flex rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground">
                              {item.resultLabel}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <span className="text-xs text-subtle">{item.createdAt}</span>
                          {item.nodeId && activeExecutionPathId && pathExecutionNodes.some((node) => node.nodeId === item.nodeId) ? (
                            <Link
                              href={withFeedbackTaskHref(`/assessment/adaptive-practice?goal=${encodeURIComponent(activeExecutionGoalId)}&intent=path-execution&pathId=${encodeURIComponent(activeExecutionPathId)}&nodeId=${encodeURIComponent(item.nodeId)}`)}
                              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary"
                            >
                              查看节点
                            </Link>
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
              </PathWorkspaceModule>
            </section>
          ) : null}

          {!showPathContextRecovery && (showPracticeWorkspace || showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace) ? (
          <section className="order-60 grid gap-4">
            {showPracticeWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace ? (
            <PathWorkspaceModule
              moduleId="path-resource"
              openModuleId={openPathModuleId}
              onToggle={togglePathModule}
              eyebrow="Practice resource"
              title={showPracticeWorkspace ? '自适应练习' : '路径资源入口'}
              summary={showPracticeWorkspace
                ? '诊断与练习题在这里继续，完成后会更新推荐重点。'
                : '自适应练习保留为检查节点，选择路径后再展开题面和反馈。'}
              data-adaptive-practice-resource="path-node"
            >
              <div className="flex justify-end">
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
                          {feedback.durableAnswerId ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void requestAttemptDiagnosis()}
                                disabled={attemptDiagnosisState === 'pending'}
                                data-adaptive-attempt-diagnosis-action="open-konling"
                                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
                                  feedback.isCorrect ? 'border border-border text-foreground hover:border-primary' : 'bg-primary text-primary-foreground hover:opacity-90'
                                }`}
                              >
                                {attemptDiagnosisState === 'pending' ? (
                                  <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <MessageSquare className="size-3.5" aria-hidden="true" />
                                )}
                                {attemptDiagnosisState === 'pending' ? '正在创建解析对话' : '请控灵解析本题'}
                              </button>
                              {attemptDiagnosisState === 'error' ? (
                                <span className="text-xs text-destructive" role="alert">
                                  解析请求失败，请重试
                                </span>
                              ) : null}
                            </div>
                          ) : null}
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
            </PathWorkspaceModule>
            ) : null}

            {showSelectionWorkspace || showEvidenceWorkspace ? (
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
            ) : null}
          </section>
          ) : null}
        </section>
      </AppShell>
    );
}

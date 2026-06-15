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

interface PathSelectionHistoryView {
  type: string;
  createdAt?: string;
  selectedStyleId?: string | null;
  previousStyleId?: string | null;
  rejectedStyleIds?: string[];
  helpful?: boolean | null;
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

const adaptiveGenerationFields = [
  { label: '学习目标', value: '自动控制原理核心能力' },
  { label: '可用时间', value: '本周 3 小时' },
  { label: '难度节奏', value: '先稳固，再加速' },
  { label: '资源偏好', value: '互动课程、练习、仿真' },
  { label: '检查节点', value: '每 45 分钟一次' },
  { label: '站外资源', value: '允许受治理资料' },
];

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

function compactPathNodeTitle(title?: string): string {
  if (!title) return '入门诊断';
  return title.length > 12 ? '入门诊断' : title;
}

function restoreLearningPathPlan(round: LearningPathRoundResponse['path']): AdaptiveLearningPathPlan | null {
  if (!round || round.goalId !== 'control-correction') return null;
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
      id: 'control-correction',
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
      previousStyleId: typeof history.previousStyleId === 'string' ? history.previousStyleId : null,
      rejectedStyleIds: getStringArray(history.rejectedStyleIds),
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
  const activeGoal = searchParams.get('goal') === 'control-correction'
    ? 'control-correction'
    : null;
  const routeIntent = resolveControlCorrectionIntent(searchParams.get('intent'));
  const activePathId = searchParams.get('pathId');
  const activeNodeId = searchParams.get('nodeId');
  const controlCorrectionQuery = new URLSearchParams({ goal: 'control-correction', intent: routeIntent });
  if (activePathId) controlCorrectionQuery.set('pathId', activePathId);
  if (activeNodeId) controlCorrectionQuery.set('nodeId', activeNodeId);
  const controlCorrectionContextHref = `/assessment/adaptive-practice?${controlCorrectionQuery.toString()}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(activeGoal ? controlCorrectionContextHref : '/assessment/adaptive-practice')}`;
  const entryIntents = getCommercialStudentEntryIntentGroups();

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
  const [pathNodeCompletionPending, setPathNodeCompletionPending] = useState<string | null>(null);
  const practiceRouteNodes = useMemo(() => buildPracticeEntryRouteNodes({
    recommendedFocus: diagnostic?.recommendedFocus ?? [],
    weakAreas: diagnostic?.weakAreas ?? [],
    estimatedAbility: questionState?.estimatedAbility,
    confidenceInterval: questionState?.confidenceInterval,
    actionHref: activeGoal ? controlCorrectionContextHref : '/assessment/adaptive-practice',
  }), [activeGoal, controlCorrectionContextHref, diagnostic, questionState]);
  const controlCorrectionCenter = useMemo(() => activeGoal
    ? buildControlCorrectionLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        learnerState: controlCorrectionLearnerState,
        pathPlan: controlCorrectionPathPlan,
        routeIntent,
        entrySource: routeIntent === 'contextual-recommendation' ? 'contextual-recommendation' : 'adaptive-practice',
        networkError: Boolean(error) && !controlCorrectionLearnerState && !controlCorrectionPathPlan,
        questionAvailable: Boolean(questionState),
      })
    : null, [activeGoal, controlCorrectionLearnerState, controlCorrectionPathPlan, error, questionState, routeIntent]);
  const pathOptions = useMemo(() => getPathOptions(controlCorrectionCenter), [controlCorrectionCenter]);
  const visiblePathOptions = useMemo(() => buildAdaptivePathOptionDisplays(pathOptions), [pathOptions]);
  const pathSelectionHistory = useMemo(() => getPathSelectionHistory(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathOptionFallback = useMemo(() => getPathOptionFallback(controlCorrectionCenter), [controlCorrectionCenter]);

  const setPathChoiceUnavailable = useCallback(() => {
    setPathChoiceMessage('请先登录并生成路径后再记录选择。');
  }, []);

  const applyDemoScene = useCallback((scene: DemoScene) => {
    const demoData = DEMO_SCENES[scene];
    setDiagnostic(demoData.diagnostic);
    setQuestionState(demoData.questionState);
    setSelectedOption(demoData.defaultSelectedOption);
    setFeedback(demoData.feedback);
    setQuestionStartAt(Date.now());
    setLoading(false);
    setError(null);
  }, []);

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

    let cancelled = false;
    async function loadControlCorrectionCenterData() {
      let learnerState: AdaptiveLearnerState | null = null;
      try {
        const learnerResponse = await fetch('/api/adaptive/learner-state?goal=control-correction');
        if (!cancelled && learnerResponse.ok) {
          learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
          setControlCorrectionLearnerState(learnerState);
        } else if (!cancelled) {
          setControlCorrectionLearnerState(null);
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
          return;
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionLearnerState(null);
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
        return;
      }

      const fallbackPathId = learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null;
      const pathIdToLoad = activePathId ?? fallbackPathId;
      if (!pathIdToLoad) {
        if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
        return;
      }

      try {
        const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
        if (!cancelled && pathResponse.ok) {
          const payload = (await pathResponse.json()) as LearningPathRoundResponse;
          setControlCorrectionPathRound(payload.path ?? null);
          setControlCorrectionPathPlan(restoreLearningPathPlan(payload.path ?? null));
        } else if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
      }
    }

    void loadControlCorrectionCenterData();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, activePathId, authStatus, isDemoMode]);

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

  const retryNextQuestion = useCallback(async () => {
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

    const learnedTime = diagnostic ? '42 分钟' : '尚未开始';
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
            href: '/ai/copilot?mode=path-advisor',
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
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  onClick={() => setPathChoiceMessage('控灵已准备好根据你的目标生成路径。')}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  生成学习路径
                </button>
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
                  ['已学习时间', learnedTime],
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
              data-konling-citation-slot="cited-explanation"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-primary">Konling parameters</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">控灵生成参数</h2>
                  <p className="mt-2 text-sm text-subtle">告诉控灵你想达成什么，系统会把目标、时间和资源偏好转成可执行路径。</p>
                </div>
                <MessageSquare className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {adaptiveGenerationFields.map((field) => (
                  <label key={field.label} className="rounded-lg border border-border bg-background/45 p-3">
                    <span className="text-xs text-subtle">{field.label}</span>
                    <span className="mt-1 block text-sm font-medium text-foreground">{field.value}</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 block rounded-lg border border-border bg-background/45 p-3">
                <span className="text-xs text-subtle">告诉控灵你想达成什么</span>
                <span className="mt-2 block min-h-16 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-subtle">
                  例如：我想在本周完成根轨迹和频域稳定性的复习，并用一次仿真检查理解。
                </span>
              </label>
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

            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[minmax(180px,0.55fr)_repeat(3,minmax(0,1fr))]">
              <div className="hidden rounded-lg border border-border bg-muted/35 p-3 text-xs font-medium text-subtle lg:block">比较字段</div>
              {visiblePathOptions.map((option) => (
                <div key={option.id} className="rounded-lg border border-border bg-muted/35 p-3" data-learning-path-option={option.id}>
                  <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
                  <p className="mt-1 text-sm text-subtle">{option.scenario}</p>
                </div>
              ))}

              {[
                ['预计时长', (option: AdaptivePathOptionDisplay) => option.estimatedTime],
                ['已匹配资源', (option: AdaptivePathOptionDisplay) => option.resources.map((resource) => resource.label).join('、')],
                ['检查节点', (option: AdaptivePathOptionDisplay) => option.checkpoints],
                ['适合场景', (option: AdaptivePathOptionDisplay) => option.scenario],
                ['当前建议理由', (option: AdaptivePathOptionDisplay) => option.reason],
                ['预期结果', (option: AdaptivePathOptionDisplay) => option.outcome],
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
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
                        {option.resources.slice(0, 2).map((resource) => resource.label).join('、')}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-subtle">{option.outcome}</p>
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
                        disabled={!option.writeOption || Boolean(pathChoicePending)}
                        onClick={() => {
                          const optionForWrite = option.writeOption;
                          if (optionForWrite) {
                            submitPathChoice('switch', optionForWrite);
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

            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-3">
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
                      disabled={!option.writeOption || Boolean(pathChoicePending)}
                      onClick={() => {
                        const optionForWrite = option.writeOption;
                        if (optionForWrite) {
                          submitPathChoice('switch', optionForWrite);
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
                  onClick={generateQuestion}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary disabled:opacity-60"
                >
                  <ListChecks className="size-4" aria-hidden="true" />
                  生成练习题
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

                  {questionState ? (
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
                      {history.selectedStyleId ? `已选择 ${history.selectedStyleId}` : '已记录路径偏好'}
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

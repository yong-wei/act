'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  buildControlCorrectionLearningCenterView,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  type ControlCorrectionLearningCenterView,
  type ControlCorrectionCenterRouteIntent,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

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
  } | null;
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
    feedbackEvents: payload.feedbackEvents as AdaptiveLearningPathPlan['feedbackEvents'] ?? [],
    visualization: payload.visualization as AdaptiveLearningPathPlan['visualization'],
  };
}

function controlCorrectionAlternativeCount(view: ControlCorrectionLearningCenterView): number {
  const currentPath = view.panels.find((panel) => panel.region === 'current-path');
  const payload = currentPath?.payload;
  if (!payload || typeof payload !== 'object' || !('alternatives' in payload)) return 0;
  return Array.isArray(payload.alternatives) ? payload.alternatives.length : 0;
}

export default function AdaptivePracticePage() {
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();
  const isDemoMode = searchParams.get('demo') === '1';
  const demoScene = resolveDemoScene(searchParams.get('scene'));
  const activePracticeFocus = searchParams.get('focus');
  const activeGoal = searchParams.get('goal') === null || searchParams.get('goal') === 'control-correction'
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
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathPlan(null);
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
          return;
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionLearnerState(null);
          setControlCorrectionPathPlan(null);
        }
        return;
      }

      const fallbackPathId = learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null;
      const pathIdToLoad = activePathId ?? fallbackPathId;
      if (!pathIdToLoad) {
        if (!cancelled) setControlCorrectionPathPlan(null);
        return;
      }

      try {
        const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
        if (!cancelled && pathResponse.ok) {
          const payload = (await pathResponse.json()) as LearningPathRoundResponse;
          setControlCorrectionPathPlan(restoreLearningPathPlan(payload.path ?? null));
        } else if (!cancelled) {
          setControlCorrectionPathPlan(null);
        }
      } catch {
        if (!cancelled) setControlCorrectionPathPlan(null);
      }
    }

    void loadControlCorrectionCenterData();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, activePathId, authStatus, isDemoMode]);

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

  return (
    <div
      className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"
      data-commercial-workspace="adaptive-practice"
      data-commercial-student-entry-route="/assessment/adaptive-practice"
      data-route-family={learnerDataShell.routeFamily}
      data-route-identity={learnerDataShell.routeIdentity}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-400">商业入口 · Practice</p>
          <h1 className="mt-1 text-2xl font-semibold">自适应跨域题库</h1>
          <p className="mt-2 text-sm text-slate-400">
            基于答题历史动态估计能力值，针对薄弱知识点推荐下一题，并支持即时生成跨域题目。
          </p>
          {isDemoMode ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
              报告演示模式：{demoScene === 'stable' ? '题库稳定性视图' : '差异化生成视图'}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            {entryIntents.filter((intent) => ['practice', 'learn', 'challenge', 'review'].includes(intent.intent)).map((intent) => (
              <Link key={intent.intent} href={intent.hrefs[0] ?? '/dashboard'} className="rounded-full border border-slate-700 px-3 py-1 hover:border-emerald-400">
                {intent.label}
              </Link>
            ))}
          </div>
        </header>

        {controlCorrectionCenter ? (
          <section
            className="surface-card p-5"
            data-control-correction-center="adaptive-practice"
            data-control-correction-goal={controlCorrectionCenter.goalId}
            data-control-correction-intent={controlCorrectionCenter.entry.routeIntent}
            data-control-correction-ready={String(controlCorrectionCenter.readinessGate.ready)}
            data-control-correction-alternative-count={controlCorrectionAlternativeCount(controlCorrectionCenter)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Control Correction Center</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{controlCorrectionCenter.competencyHero.title}</h2>
                <p className="mt-2 text-sm text-subtle">
                  入口意图：{controlCorrectionCenter.entry.routeIntent} · 状态：
                  {controlCorrectionCenter.readinessGate.ready ? '路径可继续' : '需要补齐上下文'}
                </p>
              </div>
              <Link
                href={controlCorrectionCenter.nextAction.href}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {controlCorrectionCenter.nextAction.title}
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">Readiness Gate</p>
                <p className="mt-1 text-sm text-foreground">
                  {controlCorrectionCenter.readinessGate.missing.length > 0
                    ? controlCorrectionCenter.readinessGate.missing.join('、')
                    : 'ready'}
                </p>
              </div>
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">{controlCorrectionCenter.citationAccess.title}</p>
                <p className="mt-1 text-sm text-foreground">{controlCorrectionCenter.citationAccess.status.summary}</p>
              </div>
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">{controlCorrectionCenter.konlingDock.title}</p>
                <p className="mt-1 text-sm text-foreground">{controlCorrectionCenter.konlingDock.status.summary}</p>
              </div>
            </div>

            {controlCorrectionCenter.fallbackStates.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {controlCorrectionCenter.fallbackStates.map((state) => (
                  <Link
                    key={state.state}
                    href={state.actions[0]?.href ?? controlCorrectionContextHref}
                    className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:border-primary"
                    data-control-correction-state={state.state}
                  >
                    {state.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">能力诊断</h2>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>计算型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.computational ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-cyan-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.computational ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>跨域型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.crossDomain ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-emerald-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.crossDomain ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>设计型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.design ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-violet-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.design ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">薄弱知识点</p>
              <div className="flex flex-wrap gap-2">
                {(diagnostic?.weakAreas ?? []).map((item) => (
                  <span key={item} className="rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">当前路径与推荐节点</p>
              <ul className="space-y-2 text-sm text-slate-300">
                {practiceRouteNodes.map((node) => (
                  <li
                    key={node.nodeId}
                    className={`rounded border px-3 py-2 ${
                      activePracticeFocus === node.nodeId
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{node.title}</span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
                        {node.state === 'current' ? '当前节点' : '可选节点'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>置信度 {formatConfidence(node.confidence)}</span>
                      <span>证据覆盖 {formatEvidenceLimitation(node.evidenceLimitation)}</span>
                    </div>
                    {node.missingEvidence.length > 0 ? (
                      <p className="mt-2 text-xs text-rose-200/90">
                        缺失证据 {node.missingEvidence.join('、')}
                      </p>
                    ) : null}
                    <Link href={node.action.href} className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200">
                      {node.action.label}
                    </Link>
                  </li>
                ))}
                {practiceRouteNodes.length === 0 ? (
                  <li className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-500">
                    等待诊断结果生成当前路径节点。
                  </li>
                ) : null}
              </ul>
            </div>

            <button
              type="button"
              onClick={generateQuestion}
              disabled={loading}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            >
              AI 即时生成题目
            </button>
          </aside>

          <main className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">自适应练习区</h2>
              <div className="text-sm text-slate-300">
                能力值 θ: <span className="font-semibold text-emerald-300">{questionState?.estimatedAbility ?? 0}</span>
                <span className="ml-2 text-slate-400">
                  CI: [{questionState?.confidenceInterval?.[0] ?? 0}, {questionState?.confidenceInterval?.[1] ?? 0}]
                </span>
              </div>
            </div>

            {questionState ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {questionState.question.domains.map((domain) => (
                      <span key={domain} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300">
                        {domain}
                      </span>
                    ))}
                    <span className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-300">
                      难度 {questionState.question.difficulty}
                    </span>
                  </div>

                  <p className="text-base leading-7 text-slate-100">{questionState.question.stem}</p>

                  <div className="mt-4 space-y-2">
                    {questionState.question.options.map((option) => {
                      const active = selectedOption === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setSelectedOption(option.label)}
                          className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                            active
                              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                          }`}
                        >
                          {option.label}. {option.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitCurrentAnswer}
                    disabled={loading || !selectedOption}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                  >
                    提交答案
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadNextQuestion()}
                    disabled={loading}
                    className="rounded bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-60"
                  >
                    下一题
                  </button>
                </div>

                {feedback ? (
                  <div className={`rounded-xl border p-4 ${feedback.isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
                    <div className="text-sm font-medium">
                      {feedback.isCorrect ? '回答正确' : `回答错误，正确选项：${feedback.correctOption}`}
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{feedback.explanation}</p>
                    <div className="mt-2 text-xs text-slate-300">
                      最新能力估计 θ: <span className="text-emerald-300">{feedback.estimatedAbility}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {feedback.recommendedFocus.map((item) => (
                        <li key={item} className="rounded bg-slate-900/70 px-2 py-1">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : authStatus === 'unauthenticated' && !isDemoMode ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
                <p className="font-medium">请先登录后再进入自适应练习。</p>
                <p className="mt-2 text-amber-100/80">当前 practice intent 会在登录后继续保留。</p>
                <Link
                  href={loginHref}
                  className="mt-4 inline-flex rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
                >
                  登录后继续
                </Link>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-sm text-rose-100">
                <p className="font-medium">题目加载失败</p>
                <p className="mt-2 text-rose-100/80">{error}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href="/profile" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    查看证据画像
                  </Link>
                  <Link href="/interactive-learning" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    返回互动学习
                  </Link>
                  <Link href="/arena" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    返回竞技场
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => void bootstrapPractice()}
                  disabled={loading}
                  className="mt-4 rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
                >
                  重新加载
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                正在加载练习题...
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
              {loading
                ? '系统正在评估并更新题目推荐...'
                : error
                  ? `操作失败：${error}`
                  : isDemoMode
                    ? '提示：可切换 scene=stable / generate 直接导出两类报告配图。'
                    : '提示：答错后会触发跨域解释与后续补强建议。'}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}

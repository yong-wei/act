'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Target } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  ABILITY_POINTS,
  CRUISE_CLOSING_COPY,
  CRUISE_LESSON_STEPS,
  CRUISE_PRESET_OBJECTIVES,
  CRUISE_STEP_DURATION,
  CRUISE_WAITING_THINK_PROMPTS,
  buildAbilityProfile,
  buildPersonalizedObjectives,
  computeConsistencyScore,
  computePerformanceFromController,
  getStudentStageTask,
  pickTwoAdaptiveQuestions,
  type AdaptiveQuestion,
  type CruiseControllerParams,
  type CruiseStageTask,
  type CruiseTargetForm,
} from '@/lib/cruise-course';
import { CruiseCourseHeader } from '@/features/interactive/cruise-classroom/course-header';
import { CruiseWorkspace } from '@/features/interactive/cruise-classroom/workspace';

interface StudentSessionInfo {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  currentItemId: string | null;
}

interface SessionStateRecord {
  itemId: string | null;
  data: unknown;
  user?: {
    id: string;
    name: string | null;
  };
}

interface TeacherCourseSyncState {
  kind: 'teacher_sync';
  objectives?: Record<string, string[]>;
  precheckReleased?: boolean;
  precheckReleasedAt?: number;
  updatedAt: number;
}

interface StudentPageProps {
  sessionId: string;
}

const WORKSPACE_PERSIST_STEP_IDS = new Set([
  'engineering-target',
  'first-exploration',
  'neural-ode',
  'ai-analysis',
  'prompt-refine',
  'pause-reflection',
  'adjustment',
  'consistency',
  'group-compare',
]);

const WORKSPACE_VISIBLE_STEP_IDS = new Set([
  'engineering-target',
  'first-exploration',
  'ai-analysis',
  'prompt-refine',
  'pause-reflection',
  'adjustment',
  'consistency',
  'group-compare',
]);

const DEFAULT_CONTROLLER: CruiseControllerParams = { kp: 3.2, ki: 2.4, kd: 0.8 };
const DEFAULT_TARGET: CruiseTargetForm = { overshoot: 12, settlingTime: 65, steadyError: 2, maxLateralAccel: 0.15 };

export function CruiseStudentPage({ sessionId }: StudentPageProps) {
  const isDemo = sessionId === 'demo';
  const searchParams = useSearchParams();
  const demoStepId = searchParams.get('step');
  const { data: authSession } = useSession();

  const [sessionInfo, setSessionInfo] = useState<StudentSessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [workspaceBooted, setWorkspaceBooted] = useState(false);
  const [states, setStates] = useState<SessionStateRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [submittedLocally, setSubmittedLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState('课堂洞察生成中...');
  const [insightLoading, setInsightLoading] = useState(false);

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const syncSession = useCallback(async () => {
    if (isDemo) {
      return;
    }
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as StudentSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂读取失败');
      }
      setSessionInfo(data);
      const nextIndex = data.currentItemId ? CRUISE_LESSON_STEPS.findIndex((step) => step.id === data.currentItemId) : -1;
      if (nextIndex >= 0) {
        setActiveIndex(nextIndex);
      }
      setLoadingSession(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂同步失败');
      setLoadingSession(false);
    }
  }, [isDemo, sessionId]);

  const syncStates = useCallback(async () => {
    if (isDemo) {
      return;
    }
    try {
      const response = await fetch(`/api/session/${sessionId}/state`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { states?: SessionStateRecord[] };
      setStates(data.states ?? []);
    } catch {
      // ignore
    }
  }, [isDemo, sessionId]);

  useEffect(() => {
    if (isDemo) {
      setLoadingSession(false);
      const demoIndex = demoStepId ? CRUISE_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
      setActiveIndex(demoIndex >= 0 ? demoIndex : 0);
      return;
    }
    void syncSession();
    void syncStates();
  }, [demoStepId, isDemo, syncSession, syncStates]);

  useEffect(() => {
    if (isDemo) {
      return;
    }
    const timer = window.setInterval(() => {
      void syncSession();
      void syncStates();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [isDemo, syncSession, syncStates]);

  const step = CRUISE_LESSON_STEPS[activeIndex];

  useEffect(() => {
    if (WORKSPACE_PERSIST_STEP_IDS.has(step.id)) {
      setWorkspaceBooted(true);
    }
  }, [step.id]);

  const postState = useCallback(
    async (itemId: string, data: unknown) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, data }),
      });
    },
    [isDemo, sessionId]
  );

  const selfState = useMemo(() => {
    if (!currentUserId) {
      return null;
    }
    return states.find((record) => record.user?.id === currentUserId) ?? null;
  }, [currentUserId, states]);

  useEffect(() => {
    if (isDemo || !currentUserId || selfState) {
      return;
    }
    void postState('student:presence', {
      kind: 'presence',
      studentName: currentStudentName,
      joinedAt: Date.now(),
    });
  }, [currentStudentName, currentUserId, isDemo, postState, selfState]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of states) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      const payload = record.data as Partial<TeacherCourseSyncState> | null;
      if (payload?.kind === 'teacher_sync') {
        return payload;
      }
    }
    return null;
  }, [states]);

  const joinedStudents = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of states) {
      if (!record.itemId?.startsWith('student:') || !record.user?.id) {
        continue;
      }
      map.set(record.user.id, record.user.name?.trim() || `学生${map.size + 1}`);
    }
    return Array.from(map.values());
  }, [states]);

  const precheckReleased = isDemo ? true : Boolean(teacherSyncRecord?.precheckReleased);

  const teacherObjectives = teacherSyncRecord?.objectives?.[currentStudentName];
  const objectiveList = teacherObjectives?.length
    ? teacherObjectives
    : buildPersonalizedObjectives(currentStudentName, 'studentFallback');

  const fallbackQuestions = useMemo(() => pickTwoAdaptiveQuestions(currentStudentName), [currentStudentName]);
  const studentQuestions = fallbackQuestions;

  const submittedFromState = useMemo(() => {
    if (!selfState || selfState.itemId !== 'student:precheck') {
      return null;
    }
    const payload = selfState.data as { kind?: string; answers?: Record<string, 'A' | 'B' | 'C' | 'D'> } | null;
    if (payload?.kind !== 'precheck_answers' || !payload.answers) {
      return null;
    }
    return payload.answers;
  }, [selfState]);

  const submittedAnswers = submittedFromState ?? (submittedLocally ? answers : null);
  const hasSubmitted = Boolean(submittedAnswers);

  const submitPrecheck = useCallback(async () => {
    if (isDemo || hasSubmitted) {
      return;
    }
    setSubmittedLocally(true);
    await postState('student:precheck', {
      kind: 'precheck_answers',
      studentName: currentStudentName,
      answers,
      submittedAt: Date.now(),
    });
  }, [answers, currentStudentName, hasSubmitted, isDemo, postState]);

  const precheckScore = useMemo(() => {
    if (!submittedAnswers || studentQuestions.length === 0) {
      return 0;
    }
    const correct = studentQuestions.reduce((count, question) => count + (submittedAnswers[question.id] === question.answer ? 1 : 0), 0);
    return Math.round((correct / studentQuestions.length) * 100);
  }, [studentQuestions, submittedAnswers]);

  const weakestAbility = useMemo(() => {
    const profile = buildAbilityProfile(currentStudentName);
    return [...ABILITY_POINTS].sort((a, b) => profile[a] - profile[b])[0];
  }, [currentStudentName]);

  const simulatedPerformance = computePerformanceFromController(DEFAULT_CONTROLLER);
  const consistency = computeConsistencyScore(DEFAULT_TARGET, simulatedPerformance);

  useEffect(() => {
    if (step.id !== 'summary') {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setInsightLoading(true);
      try {
        const response = await fetch('/api/simulation/cruise-summary-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'student',
            studentName: currentStudentName,
            precheckScore,
            consistencyScore: consistency.score,
            weakestAbility,
          }),
        });
        const data = (await response.json()) as { text?: string };
        if (!cancelled) {
          setInsight(data.text || '建议继续围绕薄弱能力点复盘参数调整逻辑。');
        }
      } catch {
        if (!cancelled) {
          setInsight('建议继续围绕薄弱能力点复盘参数调整逻辑。');
        }
      } finally {
        if (!cancelled) {
          setInsightLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [consistency.score, currentStudentName, precheckScore, step.id, weakestAbility]);

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-6 text-center">
          <p className="text-lg font-semibold text-white">课堂已结束</p>
          <p className="mt-2 text-sm text-slate-300">教师已结束课堂，本页面保留结果查看。</p>
        </div>
      </div>
    );
  }

  const showWorkspace = WORKSPACE_VISIBLE_STEP_IDS.has(step.id);
  const stageTask = getStudentStageTask(step.id);

  const renderStep = () => {
    if (step.id === 'class-code') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-3xl font-semibold text-white md:text-4xl">等待教师开始授课</p>
            <p className="mt-2 text-lg text-slate-200">在等待的时候，想一想这些问题：</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-cyan-100">
              {CRUISE_WAITING_THINK_PROMPTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <JoinedStudentPanel names={joinedStudents} />
        </section>
      );
    }

    if (step.id === 'bridge') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="inline-flex rounded-full border border-sky-300/35 bg-sky-500/10 px-3 py-1 text-sm text-sky-100">
            B · 开场导入 · {CRUISE_STEP_DURATION.bridge}
          </p>
          <p className="text-3xl font-semibold text-white md:text-4xl">开场导入：速度还是舒适？</p>
          <p className="text-2xl leading-10 text-slate-200">请观看教师屏幕上的导入视频，并代入真实邮轮场景做工程判断。</p>
          <article className="rounded-xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xl font-semibold text-white">📖 场景</p>
            <p className="mt-2 text-lg leading-8 text-slate-200">
              “爱达·魔都”号正在执行 30° 紧急转向以避开台风外围涌浪。你坐在七层宴会厅，面前是一座两米高的香槟塔。
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg text-cyan-100">
              <li>转向越快，乘客一定越安全吗？</li>
              <li>如果你是船长，速度和舒适你先保哪个？</li>
            </ul>
          </article>
          <article className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4">
            <p className="text-xl font-semibold text-amber-100">📋 工程约束速览</p>
            <ul className="mt-2 space-y-1 text-base text-slate-100">
              <li>超调量 σ% ≤ 15%（超过会显著增加晕船风险）</li>
              <li>调节时间 ts ≤ 120s（过慢会压缩入港窗口）</li>
              <li>侧向加速度 0.15g 舒适线，0.2g 安全红线</li>
            </ul>
          </article>
        </section>
      );
    }

    if (step.id === 'objective') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
            O · 个性化目标 · {CRUISE_STEP_DURATION.objective}
          </p>
          <p className="text-3xl font-semibold text-white md:text-4xl">你的个性化课程目标</p>
          <p className="text-xl text-slate-200">以下目标根据你的课前能力画像生成，薄弱能力点会被重点关注。</p>
          <p className="inline-flex rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1 text-base text-rose-100">
            🔴 你的薄弱点：{weakestAbility}
          </p>
          <ul className="list-disc space-y-2 pl-6 text-xl leading-9 text-cyan-100">
            {objectiveList.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
          <details className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-base text-slate-300">
            <summary className="cursor-pointer text-slate-100">📋 参考：课程统一目标</summary>
            <p className="mt-2">{CRUISE_PRESET_OBJECTIVES.join('；')}</p>
          </details>
        </section>
      );
    }

    if (step.id === 'precheck') {
      if (!precheckReleased) {
        return (
          <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-6">
            <p className="text-3xl font-semibold text-white md:text-4xl">等待教师开始前测</p>
            <p className="mt-3 text-lg text-slate-200">教师发放后你将看到自适应题目，请保持页面开启。</p>
          </section>
        );
      }

      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1 text-sm text-amber-100">
            P1 · 快速前测 · {CRUISE_STEP_DURATION.precheck}
          </p>
          <p className="text-3xl font-semibold text-white md:text-4xl">快速前测</p>
          <p className="text-lg text-slate-200">请在 2 分钟内完成题目，不计入成绩，仅用于定位你的学习起点。</p>
          {studentQuestions.map((question: AdaptiveQuestion) => {
            const answerFromState = submittedAnswers?.[question.id];
            const selected = hasSubmitted ? answerFromState : answers[question.id];
            return (
              <div key={question.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-2 text-sm text-cyan-100">{question.abilityPoint}</div>
                <p className="mb-3 text-xl text-slate-100">{question.stem}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {question.options.map((option) => {
                    const isChosen = selected === option.key;
                    const isCorrect = hasSubmitted && option.key === question.answer;
                    const isWrongChoice = hasSubmitted && isChosen && option.key !== question.answer;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        disabled={hasSubmitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.key }))}
                        className={`rounded-lg border px-3 py-3 text-left text-base ${
                          isCorrect
                            ? 'border-emerald-300/70 bg-emerald-400/20 text-emerald-100'
                            : isWrongChoice
                              ? 'border-rose-300/70 bg-rose-400/20 text-rose-100'
                              : isChosen
                                ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                                : 'border-white/10 text-slate-200 hover:border-white/30'
                        }`}
                      >
                        {option.key}. {option.text}
                      </button>
                    );
                  })}
                </div>
                {hasSubmitted ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    正确答案：{question.answer}
                  </p>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            disabled={hasSubmitted}
            onClick={() => void submitPrecheck()}
            className="rounded-lg border border-cyan-300/70 px-5 py-2 text-base text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasSubmitted ? '已提交' : '提交前测'}
          </button>
        </section>
      );
    }

    if (step.id === 'neural-ode') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="inline-flex rounded-full border border-violet-300/35 bg-violet-500/10 px-3 py-1 text-sm text-violet-100">
            前沿窗口 · NeuralODE · {CRUISE_STEP_DURATION['neural-ode']}
          </p>
          <p className="text-3xl font-semibold text-white md:text-4xl">NeuralODE 前沿嵌入</p>
          <article className="rounded-xl border border-white/15 bg-slate-950/70 p-4 text-lg text-slate-200">
            <p>标准二阶模型在真实海况中会遇到非线性、时变和扰动耦合问题。</p>
            <p className="mt-2">
              NeuralODE 通过
              <span className="mx-1 inline-block align-middle">
                <InlineMath math={'\\dot{x}=f_{\\theta}(x,u)'} />
              </span>
              从数据中学习动力学规律。
            </p>
            <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/70 p-2 text-base">
              <BlockMath math={'\\min_{\\theta}\\sum_{t}\\left\\|x_{t+1}-\\Phi_{\\Delta t}(x_t,u_t;f_{\\theta})\\right\\|_2^2'} />
            </div>
          </article>
          <div className="relative mt-4 h-[360px] overflow-hidden rounded-xl border border-white/10 bg-slate-950">
            <Image src="/assets/cruise-comfort-boppps/neuralode-overview.svg" alt="NeuralODE overview" fill className="object-contain" />
          </div>
          <p className="mt-4 text-xl leading-8 text-slate-200">观察“模型 + 数据 + 控制”协同建模思路，准备回到仿真继续优化方案。</p>
        </section>
      );
    }

    if (step.id === 'summary') {
      const goalScore = Math.round(precheckScore * 0.45 + consistency.score * 0.55);
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="text-center text-3xl leading-10 text-cyan-100">{CRUISE_CLOSING_COPY}</p>
          <h3 className="inline-flex items-center gap-2 text-2xl font-semibold text-white">
            <Target className="h-6 w-6" />
            个性化能力达成
          </h3>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-lg font-semibold text-white">📋 你的设计档案</p>
            <div className="mt-2 grid gap-2 text-base text-slate-200 md:grid-cols-2">
              <p>最终策略：PID 控制</p>
              <p>薄弱能力点：{weakestAbility}</p>
              <p>一致性校验：{consistency.score.toFixed(0)}%</p>
              <p>前测得分：{precheckScore.toFixed(0)}%</p>
            </div>
          </div>
          <div className="space-y-2">
            <MetricBar label="个性化目标综合达成" value={goalScore} />
            <MetricBar label="前测表现" value={precheckScore} />
            <MetricBar label="一致性校验达成" value={consistency.score} />
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-lg font-medium text-white">个人课堂洞察</p>
            <p className="mt-2 text-base leading-7 text-slate-200">{insightLoading ? '正在生成个人洞察...' : insight}</p>
            <p className="mt-2 text-sm text-slate-400">建议优先继续强化：{weakestAbility}</p>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0b1f3f,transparent_40%),radial-gradient(circle_at_top_right,#09232d,transparent_45%),#020617] text-slate-100">
      <CruiseCourseHeader
        steps={CRUISE_LESSON_STEPS}
        activeIndex={activeIndex}
        middleNotice={isDemo ? '演示模式：可自由切换环节' : undefined}
        onIndexChange={(index) => {
          if (isDemo) {
            setActiveIndex(index);
          }
        }}
      />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {error ? (
          <div className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{error}</div>
        ) : null}

        {showWorkspace ? (
          <StudentTaskBanner stageTask={stageTask} stepId={step.id} />
        ) : null}

        {renderStep()}

        {workspaceBooted ? (
          <div className={showWorkspace ? 'block' : 'hidden'}>
            <CruiseWorkspace
              role="student"
              sessionId={sessionId}
              currentStepTitle={CRUISE_LESSON_STEPS.find((item) => item.id === step.id)?.title ?? step.title}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function JoinedStudentPanel({ names }: { names: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-lg font-medium text-white">已加入学生（{names.length}人）</p>
      {names.length === 0 ? (
        <p className="mt-2 text-base text-slate-300">暂无学生加入。</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {names.map((name) => (
            <span key={name} className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-cyan-200">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700/60">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function StudentTaskBanner({ stageTask, stepId }: { stageTask: CruiseStageTask; stepId: string }) {
  return (
    <section className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">当前环节任务</p>
        <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs text-slate-200">⏱ {CRUISE_STEP_DURATION[stepId]}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-white">{stageTask.title}</p>
      <p className="text-lg text-cyan-100">{stageTask.description}</p>

      {stageTask.bullets?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-100">
          {stageTask.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {stageTask.keyQuestion ? (
        <p className="mt-2 text-base text-amber-100">
          🔑 关键问题：{stageTask.keyQuestion}
        </p>
      ) : null}

      {stageTask.tips?.length ? (
        <div className="mt-2 rounded-lg border border-violet-300/25 bg-violet-500/10 p-2">
          {stageTask.tips.map((tip) => (
            <p key={tip} className="text-sm text-violet-100">
              ⚡ {tip}
            </p>
          ))}
        </div>
      ) : null}

      {stageTask.checks?.length ? (
        <div className="mt-2 rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2">
          <p className="text-sm font-medium text-emerald-100">✅ 检查清单</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {stageTask.checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {stageTask.formulaRefs?.length ? (
        <p className="mt-2 text-xs text-slate-300">参考：{stageTask.formulaRefs.join('，')}</p>
      ) : null}
    </section>
  );
}

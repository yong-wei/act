'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, GraduationCap, Loader2, PlayCircle, Sparkles } from 'lucide-react';

import {
  ABILITY_POINTS,
  BLOOM_VERBS,
  CRUISE_CLOSING_COPY,
  CRUISE_LESSON_STEPS,
  CRUISE_PRESET_OBJECTIVES,
  CRUISE_STEP_DURATION,
  CRUISE_WAITING_THINK_PROMPTS,
  buildPersonalizedObjectives,
  getTeacherStageCopy,
  pickTwoAdaptiveQuestions,
  type AdaptiveQuestion,
  type CruiseTeacherStepCopy,
} from '@/lib/cruise-course';
import { CruiseCourseHeader } from '@/features/interactive/cruise-classroom/course-header';
import { CruiseWorkspace } from '@/features/interactive/cruise-classroom/workspace';

interface TeacherSessionInfo {
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
    email: string | null;
  };
}

interface TeacherCourseSyncState {
  kind: 'teacher_sync';
  precheckReleased?: boolean;
  precheckReleasedAt?: number;
  updatedAt: number;
}

interface TeacherPageProps {
  sessionId: string;
}

const BOPPPS_STAGE_MAP = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
} as const;

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
  'adjustment',
  'consistency',
  'group-compare',
]);

export function CruiseTeacherPage({ sessionId }: TeacherPageProps) {
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [precheckTab, setPrecheckTab] = useState<'precheck' | 'stats'>('precheck');
  const [workspaceBooted, setWorkspaceBooted] = useState(false);

  const [summaryInsight, setSummaryInsight] = useState('课堂洞察生成中...');
  const [summaryInsightLoading, setSummaryInsightLoading] = useState(false);

  const step = CRUISE_LESSON_STEPS[activeIndex];

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as TeacherSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂不存在');
      }
      const index = data.currentItemId
        ? CRUISE_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId)
        : -1;
      if (index >= 0) {
        setActiveIndex(index);
      }
      setLoadingSession(false);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '课堂读取失败');
      setLoadingSession(false);
    }
  }, [sessionId]);

  const fetchStates = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}/state`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { states?: SessionStateRecord[] };
      setStateRecords(data.states ?? []);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
    void fetchStates();
  }, [fetchSession, fetchStates]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchSession();
      void fetchStates();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [fetchSession, fetchStates]);

  useEffect(() => {
    if (WORKSPACE_PERSIST_STEP_IDS.has(step.id)) {
      setWorkspaceBooted(true);
    }
  }, [step.id]);

  const patchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = CRUISE_LESSON_STEPS[nextIndex];
      setActiveIndex(nextIndex);
      setSyncError(null);
      try {
        const response = await fetch(`/api/session/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentItemId: nextStep.id,
            currentStage: BOPPPS_STAGE_MAP[nextStep.stage],
          }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || '课堂推进失败');
        }
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : '课堂推进失败');
      }
    },
    [sessionId]
  );

  const postTeacherSyncState = useCallback(
    async (payload: Omit<TeacherCourseSyncState, 'kind' | 'updatedAt'>) => {
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'teacher:course-sync',
          data: {
            kind: 'teacher_sync',
            ...payload,
            updatedAt: Date.now(),
          } satisfies TeacherCourseSyncState,
        }),
      });
    },
    [sessionId]
  );

  const joinedStudents = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of stateRecords) {
      if (!record.itemId?.startsWith('student:') || !record.user?.id) {
        continue;
      }
      const name = record.user.name?.trim() || `学生${map.size + 1}`;
      map.set(record.user.id, name);
    }
    return Array.from(map.values());
  }, [stateRecords]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of stateRecords) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      const payload = record.data as Partial<TeacherCourseSyncState> | null;
      if (payload?.kind === 'teacher_sync') {
        return payload;
      }
    }
    return null;
  }, [stateRecords]);

  const personalObjectives = useMemo(() => {
    return joinedStudents.reduce<Record<string, string[]>>((acc, studentName) => {
      acc[studentName] = buildPersonalizedObjectives(studentName, 'teacher');
      return acc;
    }, {});
  }, [joinedStudents]);

  const precheckReleased = Boolean(teacherSyncRecord?.precheckReleased);

  const releasePrecheck = useCallback(async () => {
    await postTeacherSyncState({
      precheckReleased: true,
      precheckReleasedAt: Date.now(),
    });
  }, [postTeacherSyncState]);

  const precheckSubmissions = useMemo(() => {
    const result: Array<{
      userId: string;
      studentName: string;
      answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
    }> = [];
    for (const record of stateRecords) {
      if (record.itemId !== 'student:precheck' || !record.user?.id) {
        continue;
      }
      const payload = record.data as { kind?: string; answers?: Record<string, 'A' | 'B' | 'C' | 'D'>; studentName?: string } | null;
      if (payload?.kind !== 'precheck_answers' || !payload.answers) {
        continue;
      }
      result.push({
        userId: record.user.id,
        studentName: payload.studentName || record.user.name?.trim() || '未命名学生',
        answers: payload.answers,
      });
    }
    return result;
  }, [stateRecords]);

  const previewQuestions = useMemo(() => {
    const previewStudent = joinedStudents[0] || '示例学生';
    return pickTwoAdaptiveQuestions(previewStudent);
  }, [joinedStudents]);

  const classAbilityStats = useMemo(() => {
    if (precheckSubmissions.length === 0) {
      return ABILITY_POINTS.map((abilityPoint) => ({ abilityPoint, accuracy: 0 }));
    }

    return ABILITY_POINTS.map((abilityPoint) => {
      let total = 0;
      let correct = 0;
      for (const submission of precheckSubmissions) {
        const questionSet = pickTwoAdaptiveQuestions(submission.studentName);
        for (const question of questionSet) {
          if (question.abilityPoint !== abilityPoint) {
            continue;
          }
          total += 1;
          if (submission.answers[question.id] === question.answer) {
            correct += 1;
          }
        }
      }
      return {
        abilityPoint,
        accuracy: total > 0 ? (correct / total) * 100 : 0,
      };
    });
  }, [precheckSubmissions]);

  const submitCount = precheckSubmissions.length;
  const joinedCount = joinedStudents.length;
  const classGoalAttainment = useMemo(() => {
    const abilityAvg = classAbilityStats.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(classAbilityStats.length, 1);
    const submitRate = joinedCount > 0 ? (submitCount / joinedCount) * 100 : 0;
    return Math.round(abilityAvg * 0.72 + submitRate * 0.28);
  }, [classAbilityStats, joinedCount, submitCount]);

  useEffect(() => {
    if (step.id !== 'summary') {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setSummaryInsightLoading(true);
      try {
        const response = await fetch('/api/simulation/cruise-summary-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'teacher',
            classGoalAttainment,
            joinedCount,
            submitCount,
            abilityStats: classAbilityStats,
          }),
        });
        const data = (await response.json()) as { text?: string };
        if (!cancelled) {
          setSummaryInsight(data.text || '课堂洞察暂不可用，请根据班级薄弱能力点安排补强任务。');
        }
      } catch {
        if (!cancelled) {
          setSummaryInsight('课堂洞察暂不可用，请根据班级薄弱能力点安排补强任务。');
        }
      } finally {
        if (!cancelled) {
          setSummaryInsightLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [classAbilityStats, classGoalAttainment, joinedCount, step.id, submitCount]);

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const showWorkspace = WORKSPACE_VISIBLE_STEP_IDS.has(step.id);

  const renderStepContent = () => {
    if (step.id === 'class-code') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">课堂准备中</h2>
          <p className="text-lg leading-8 text-slate-200">请等待学生加入完成，确认名单后开始授课。</p>
          <JoinedStudentPanel names={joinedStudents} />
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-lg font-medium text-cyan-100">在等待的时候，想一想这些问题</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-slate-200">
              {CRUISE_WAITING_THINK_PROMPTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    if (step.id === 'bridge') {
      const cards = [
        {
          title: '超调 σ% > 15%',
          desc: '晕船指数（MSI）显著上升',
          tone: 'border-amber-300/40 bg-amber-500/15 text-amber-100',
        },
        {
          title: '调节时间 > 120s',
          desc: '入港操作窗口不足',
          tone: 'border-sky-300/40 bg-sky-500/15 text-sky-100',
        },
        {
          title: '侧向加速度 > 0.2g',
          desc: '老年旅客骨折风险（红线）',
          tone: 'border-rose-300/40 bg-rose-500/15 text-rose-100',
        },
      ];
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100">
            <PlayCircle className="h-5 w-5" />
            B · 开场导入 · {CRUISE_STEP_DURATION.bridge}
          </div>
          <video controls className="h-[460px] w-full rounded-xl border border-white/10 bg-black">
            <source src="/videos/luxury-liner-intro.mp4" type="video/mp4" />
          </video>
          <p className="text-center text-2xl leading-10 text-slate-100">“爱达·魔都”号 · 323.6 米 · 5246 名旅客。每一次转向，都是工程决策。</p>
          <div className="grid gap-3 md:grid-cols-3">
            {cards.map((card) => (
              <article key={card.title} className={`rounded-xl border p-4 ${card.tone}`}>
                <p className="text-lg font-semibold">{card.title}</p>
                <p className="mt-2 text-base opacity-90">{card.desc}</p>
              </article>
            ))}
          </div>
          <p className="text-center text-3xl font-semibold text-cyan-100">今天不是一道例题，而是一场工程决策。</p>
        </section>
      );
    }

    if (step.id === 'objective') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
            <GraduationCap className="h-5 w-5" />
            O · 个性化目标 · {CRUISE_STEP_DURATION.objective}
          </div>
          <h2 className="text-4xl font-semibold text-white">本节学习目标</h2>
          <p className="text-xl text-slate-200">AI 已根据每位同学课前能力画像，生成个性化学习目标。</p>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-2xl font-medium text-white">预设课程目标</p>
            <ul className="mt-4 space-y-2 text-xl leading-9 text-slate-100">
              {CRUISE_PRESET_OBJECTIVES.map((goal) => (
                <li key={goal}>{renderBloomGoal(goal)}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-2xl font-medium text-white">已加入学生个性化目标预览</p>
            {joinedStudents.length === 0 ? (
              <p className="mt-2 text-base text-slate-300">暂无学生加入。</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {joinedStudents.map((studentName) => (
                  <div key={studentName} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                    <div className="text-lg font-medium text-cyan-100">{studentName}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-200">
                      {(personalObjectives[studentName] ?? []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xl text-cyan-100">教师提示：巡视目标差异，点名追问“你为何要优先这个薄弱点”。</p>
        </section>
      );
    }

    if (step.id === 'precheck') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1 text-sm text-amber-100">
            <BarChart3 className="h-5 w-5" />
            P1 · 快速前测 · {CRUISE_STEP_DURATION.precheck}
          </div>
          <h2 className="text-4xl font-semibold text-white">快速前测：2 道自适应题</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPrecheckTab('precheck')}
              className={`rounded-lg border px-4 py-2 text-sm ${precheckTab === 'precheck' ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100' : 'border-white/20 text-slate-300'}`}
            >
              前测
            </button>
            <button
              type="button"
              onClick={() => setPrecheckTab('stats')}
              className={`rounded-lg border px-4 py-2 text-sm ${precheckTab === 'stats' ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100' : 'border-white/20 text-slate-300'}`}
            >
              能力统计
            </button>
          </div>

          {precheckTab === 'precheck' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void releasePrecheck()}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-base font-medium text-slate-950"
              >
                {precheckReleased ? '已发放，重新发放' : '开始前测'}
              </button>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <p className="mb-3 text-xl font-medium text-white">题目预览</p>
                {previewQuestions.map((question: AdaptiveQuestion) => (
                  <div key={question.id} className="mb-3 rounded-lg border border-white/10 bg-slate-900/70 p-3 text-lg text-slate-100">
                    <span className="mr-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-100">{question.abilityPoint}</span>
                    {question.stem}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              {submitCount === 0 ? (
                <p className="text-lg text-slate-300">暂无提交</p>
              ) : (
                <p className="mb-3 text-lg text-slate-200">已有{submitCount}/{joinedCount}人提交</p>
              )}
              <div className="space-y-3">
                {classAbilityStats.map((item) => (
                  <MetricBar key={item.abilityPoint} label={item.abilityPoint} value={item.accuracy} />
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
                <p className="text-lg font-medium text-cyan-100">教学决策提示</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-200">
                  <li>“极点-时域映射”偏低：第一轮探索重点关注复平面与时域联动。</li>
                  <li>“频域稳定判读”偏低：加强 Bode 图相位裕度解读。</li>
                  <li>“参数整定收敛”偏低：AI 介入阶段重点追问调整理由。</li>
                </ul>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (step.id === 'neural-ode') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <h3 className="inline-flex items-center gap-2 rounded-full border border-violet-300/35 bg-violet-500/10 px-3 py-1 text-sm font-semibold text-violet-100">
            <Sparkles className="h-5 w-5" />
            前沿窗口 · NeuralODE · {CRUISE_STEP_DURATION['neural-ode']}
          </h3>
          <h2 className="text-4xl font-semibold text-white">当数学模型不够用时：NeuralODE</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-sky-300/35 bg-sky-500/10 p-4">
              <p className="text-2xl font-semibold text-sky-100">传统建模</p>
              <p className="mt-3 text-lg text-slate-100">ẋ = f(x, u)（人工推导）</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-base text-slate-200">
                <li>优点：简洁、可解释、参数物理意义清晰</li>
                <li>局限：固定参数，难适应复杂海况与大舵角非线性</li>
              </ul>
            </article>
            <article className="rounded-xl border border-violet-300/35 bg-violet-500/10 p-4">
              <p className="text-2xl font-semibold text-violet-100">数据驱动建模</p>
              <p className="mt-3 text-lg text-slate-100">ẋ = fθ(x, u)（数据学习）</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-base text-slate-200">
                <li>优点：更能捕捉非线性与时变特性</li>
                <li>局限：依赖大量真实数据，可解释性较弱</li>
              </ul>
            </article>
          </div>
          <div className="relative h-[360px] overflow-hidden rounded-xl border border-white/10 bg-slate-950">
            <Image
              src="/assets/cruise-comfort-boppps/neuralode-overview.svg"
              alt="NeuralODE embedding overview"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-xl leading-8 text-slate-200">今天的二阶模型是起点，不是终点。问题→研究→教学，构成完整闭环。</p>
        </section>
      );
    }

    if (step.id === 'pause-reflection') {
      return (
        <section className="space-y-5 rounded-2xl border border-white/15 bg-slate-900/75 p-8">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200">P2 · 结构可用 → 反思 · {CRUISE_STEP_DURATION['pause-reflection']}</p>
          <h2 className="text-5xl font-semibold text-white">⏸ 暂停：说出你的设计逻辑</h2>
          <ol className="space-y-3 text-2xl leading-10 text-slate-100">
            <li>1. 你选择了“速度优先”还是“舒适优先”？</li>
            <li>2. 你的极点配置位于复平面的哪个区域？它如何支持取舍？</li>
            <li>3. 哪个约束最接近边界？你愿意为此承担什么风险？</li>
          </ol>
          <p className="text-2xl text-emerald-200">口头表达设计逻辑，是高阶学习证据。</p>
        </section>
      );
    }

    if (step.id === 'summary') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-5 text-center">
            <p className="text-xl text-cyan-100">回到开场问题：速度，还是舒适？</p>
            <p className="mt-2 text-4xl font-semibold text-white">今天，我们选择了安全。</p>
          </div>
          <h3 className="text-3xl font-semibold text-white">班级目标达成总览</h3>
          <div className="space-y-2">
            <MetricBar label="班级目标达成度" value={classGoalAttainment} />
            <MetricBar
              label="前测能力点均值"
              value={classAbilityStats.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(classAbilityStats.length, 1)}
            />
            <MetricBar
              label="课堂参与率（前测提交）"
              value={joinedCount > 0 ? (submitCount / joinedCount) * 100 : 0}
            />
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-2xl font-medium text-white">课堂洞察</p>
            <p className="mt-2 text-base leading-7 text-slate-200">
              {summaryInsightLoading ? '正在生成课堂洞察...' : summaryInsight}
            </p>
          </div>
          <p className="text-center text-3xl font-semibold text-cyan-100">{CRUISE_CLOSING_COPY}</p>
        </section>
      );
    }

    const teacherStepCopy = getTeacherStageCopy(step.id);
    if (WORKSPACE_VISIBLE_STEP_IDS.has(step.id) && teacherStepCopy) {
      return <TeacherWorkspaceBrief copy={teacherStepCopy} />;
    }

    return (
      <StaticTeacherCopy
        title="教师提示"
        body="该环节使用教师端静态提示文案，学生端按教师口令在综合工作台持续操作。"
      />
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0b1f3f,transparent_40%),radial-gradient(circle_at_top_right,#09232d,transparent_45%),#020617] text-slate-100">
      <CruiseCourseHeader steps={CRUISE_LESSON_STEPS} activeIndex={activeIndex} onIndexChange={(index) => void patchCurrentStep(index)} />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {syncError ? (
          <div className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{syncError}</div>
        ) : null}

        {renderStepContent()}

        {workspaceBooted ? (
          <div className={showWorkspace ? 'block' : 'hidden'}>
            <CruiseWorkspace
              role="teacher"
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

function StaticTeacherCopy({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-6">
      <h3 className="mb-3 text-2xl font-semibold text-cyan-100">{title}</h3>
      <p className="text-xl leading-8 text-slate-200">{body}</p>
    </section>
  );
}

function renderBloomGoal(goal: string) {
  const [firstWord, ...rest] = goal.split(' ');
  if (!BLOOM_VERBS.includes(firstWord)) {
    return goal;
  }
  return (
    <>
      <span className="font-bold text-cyan-300">{firstWord}</span>
      <span className="text-slate-100"> {rest.join(' ')}</span>
    </>
  );
}

function TeacherWorkspaceBrief({
  copy,
}: {
  copy: CruiseTeacherStepCopy;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">{copy.layer}</span>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">⏱ {copy.duration}</span>
      </div>

      <h3 className="text-4xl font-semibold text-white">{copy.title}</h3>

      <article className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4">
        <p className="text-lg font-semibold text-cyan-100">学生任务</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-lg text-slate-100">
          {copy.studentTask.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
        <p className="text-lg font-semibold text-emerald-100">🎯 教师口令</p>
        <p className="mt-2 text-xl leading-8 text-slate-100">{copy.teacherScript}</p>
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/70 p-4">
        <p className="text-lg font-semibold text-white">🔍 巡视关注</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-200">
          {copy.patrolFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      {copy.emphasis ? <p className="text-xl font-medium text-rose-100">⚠️ {copy.emphasis}</p> : null}
    </section>
  );
}

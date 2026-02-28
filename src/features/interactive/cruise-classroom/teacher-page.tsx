'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, GraduationCap, Loader2, PlayCircle, Sparkles } from 'lucide-react';

import {
  ABILITY_POINTS,
  CRUISE_CLOSING_COPY,
  CRUISE_LESSON_STEPS,
  CRUISE_PRESET_OBJECTIVES,
  CRUISE_WAITING_THINK_PROMPTS,
  buildPersonalizedObjectives,
  pickTwoAdaptiveQuestions,
  type AdaptiveQuestion,
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
      return (
        <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-base text-cyan-100">
            <PlayCircle className="h-5 w-5" />
            开场导入（B）
          </div>
          <video controls className="h-[460px] w-full rounded-xl border border-white/10 bg-black">
            <source src="/videos/luxury-liner-intro.mp4" type="video/mp4" />
          </video>
          <p className="mt-4 text-xl leading-8 text-slate-200">今天不是一道例题，而是一场工程决策。</p>
        </section>
      );
    }

    if (step.id === 'objective') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="inline-flex items-center gap-2 text-base text-cyan-100">
            <GraduationCap className="h-5 w-5" />
            个性化目标（O）
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xl font-medium text-white">预设课程目标</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-cyan-100">
              {CRUISE_PRESET_OBJECTIVES.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xl font-medium text-white">已加入学生个性化目标预览</p>
            {joinedStudents.length === 0 ? (
              <p className="mt-2 text-base text-slate-300">暂无学生加入。</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {joinedStudents.map((studentName) => (
                  <div key={studentName} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                    <div className="text-base font-medium text-cyan-100">{studentName}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                      {(personalObjectives[studentName] ?? []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }

    if (step.id === 'precheck') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <div className="inline-flex items-center gap-2 text-base text-cyan-100">
            <BarChart3 className="h-5 w-5" />
            快速前测（P1）
          </div>
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
            </div>
          )}
        </section>
      );
    }

    if (step.id === 'neural-ode') {
      return (
        <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <h3 className="mb-3 inline-flex items-center gap-2 text-xl font-semibold text-cyan-100">
            <Sparkles className="h-5 w-5" />
            NeuralODE 前沿嵌入
          </h3>
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/10 bg-slate-950">
            <Image
              src="/assets/cruise-comfort-boppps/neuralode-overview.svg"
              alt="NeuralODE embedding overview"
              fill
              className="object-contain"
            />
          </div>
          <p className="mt-4 text-xl leading-8 text-slate-200">传统名义模型难覆盖复杂海况扰动。NeuralODE 展示“模型 + 数据 + 控制”的协同路径。</p>
        </section>
      );
    }

    if (step.id === 'pause-reflection') {
      return (
        <StaticTeacherCopy
          title="暂停反思"
          body="请两组同学分别口头说明：你们如何在速度与舒适之间取舍？你们的极点移动是否支持这个取舍？"
        />
      );
    }

    if (step.id === 'summary') {
      return (
        <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-6">
          <p className="text-2xl leading-9 text-cyan-100">{CRUISE_CLOSING_COPY}</p>
          <h3 className="text-2xl font-semibold text-white">班级目标达成总览</h3>
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
            <p className="text-lg font-medium text-white">课堂洞察</p>
            <p className="mt-2 text-base leading-7 text-slate-200">
              {summaryInsightLoading ? '正在生成课堂洞察...' : summaryInsight}
            </p>
          </div>
        </section>
      );
    }

    if (WORKSPACE_VISIBLE_STEP_IDS.has(step.id)) {
      return <StaticTeacherCopy title={getTeacherCopyTitle(step.id)} body={getTeacherCopyBody(step.id)} />;
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

function getTeacherCopyTitle(stepId: string): string {
  switch (stepId) {
    case 'ai-analysis':
      return 'AI介入分析';
    case 'prompt-refine':
      return '结构化提示词指导';
    case 'consistency':
      return '一致性校验';
    case 'group-compare':
      return '小组对比';
    case 'adjustment':
      return '反思后调整';
    case 'engineering-target':
      return '工程目标设定';
    case 'first-exploration':
      return '第一轮参数探索';
    default:
      return '教师端提示';
  }
}

function getTeacherCopyBody(stepId: string): string {
  switch (stepId) {
    case 'engineering-target':
      return '请学生先填写目标约束，再开始调参。重点检查其约束是否覆盖超调、时间和舒适度边界。';
    case 'first-exploration':
      return '引导学生观察根轨迹、时域与频域联动，并记录一次失败案例。';
    case 'ai-analysis':
      return '要求学生解释失败原因、明确约束边界，并给出一条可执行调整策略。';
    case 'prompt-refine':
      return '要求学生按“对象-目标-约束-策略”改写提示词，再执行调参验证。';
    case 'adjustment':
      return '引导学生给出“一个保留、一项调整、一个验证指标”，完成迭代。';
    case 'consistency':
      return '强调一致性校验需同时看目标表达、调参轨迹和结果指标，而不仅是最终分数。';
    case 'group-compare':
      return '请激进组和舒适组对比极点分布与响应曲线，并说明安全边界取舍。';
    default:
      return '教师端展示静态文案，学生端保持综合工作台操作。';
  }
}

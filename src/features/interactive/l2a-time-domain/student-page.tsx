'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import {
  createEmptyL2AStudentState,
  getL2AStep,
  L2A_LESSON_STEPS,
  L2A_WORKSPACE_VISIBLE_STEP_IDS,
  type L2AStudentCourseState,
  type L2AStepResponse,
} from '@/lib/l2a-course';
import { L2ACourseHeader } from './course-header';
import {
  KnowledgeMapVisual,
  StepContentPanel,
  StudentActivityForm,
  StudentSummaryPanel,
} from './step-panels';
import { L2AWorkspace } from './workspace';

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

function isL2AStudentState(value: unknown): value is L2AStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<L2AStudentCourseState>;
  return data.kind === 'l2a_student_state' && data.version === 1;
}

export function L2AStudentPage({ sessionId }: { sessionId: string }) {
  const isDemo = sessionId === 'demo';
  const searchParams = useSearchParams();
  const demoStepId = searchParams.get('step');
  const { data: authSession } = useSession();

  const [sessionInfo, setSessionInfo] = useState<StudentSessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseState, setCourseState] = useState<L2AStudentCourseState>(() =>
    createEmptyL2AStudentState(authSession?.user?.name?.trim() || '学生'),
  );
  const [error, setError] = useState<string | null>(null);
  const initialTeacherSyncRef = useRef(isDemo);

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const syncSession = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as StudentSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂读取失败');
      }
      setSessionInfo(data);
      const index = data.currentItemId ? L2A_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
      if (index >= 0) {
        setTeacherIndex(index);
        if (!initialTeacherSyncRef.current) {
          setActiveIndex(index);
          initialTeacherSyncRef.current = true;
        }
      } else if (!initialTeacherSyncRef.current) {
        initialTeacherSyncRef.current = true;
      }
      setLoadingSession(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂同步失败');
      setLoadingSession(false);
    }
  }, [isDemo, sessionId]);

  const syncStates = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await fetch(`/api/session/${sessionId}/state?scope=self`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { states?: SessionStateRecord[] };
      setStateRecords(data.states ?? []);
    } catch {
      // ignore
    }
  }, [isDemo, sessionId]);

  useEffect(() => {
    if (isDemo) {
      setLoadingSession(false);
      const demoIndex = demoStepId ? L2A_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
      const nextIndex = demoIndex >= 0 ? demoIndex : 0;
      setActiveIndex(nextIndex);
      setTeacherIndex(nextIndex);
      initialTeacherSyncRef.current = true;
      return;
    }
    void syncSession();
    void syncStates();
  }, [demoStepId, isDemo, syncSession, syncStates]);

  useEffect(() => {
    if (isDemo) return;
    const timer = window.setInterval(() => {
      void syncSession();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isDemo, syncSession]);

  useEffect(() => {
    setCourseState((prev) => ({
      ...prev,
      studentName: currentStudentName,
    }));
  }, [currentStudentName]);

  const selfState = useMemo(() => {
    if (!currentUserId) {
      return null;
    }
    const record = stateRecords.find((item) => item.user?.id === currentUserId && item.itemId === 'student:l2a:state');
    return record && isL2AStudentState(record.data) ? record.data : null;
  }, [currentUserId, stateRecords]);

  useEffect(() => {
    if (selfState) {
      setCourseState(selfState);
    }
  }, [selfState]);

  const persistState = useCallback(
    async (nextState: L2AStudentCourseState) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'student:l2a:state',
          data: {
            ...nextState,
            updatedAt: Date.now(),
          },
        }),
      });
    },
    [isDemo, sessionId],
  );

  const saveCourseState = useCallback(
    async (updater: (prev: L2AStudentCourseState) => L2AStudentCourseState) => {
      setCourseState((prev) => {
        const nextState = updater(prev);
        void persistState(nextState);
        return nextState;
      });
    },
    [persistState],
  );

  const step = L2A_LESSON_STEPS[activeIndex];
  const teacherStep = L2A_LESSON_STEPS[teacherIndex];
  const stepDefinition = getL2AStep(step.id);
  const savedResponse = courseState.responses[step.id];
  const showWorkspace = L2A_WORKSPACE_VISIBLE_STEP_IDS.has(step.id);
  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;

  const handleSubmitResponse = (response: L2AStepResponse) => {
    void saveCourseState((prev) => ({
      ...prev,
      studentName: currentStudentName,
      updatedAt: Date.now(),
      responses: {
        ...prev.responses,
        [step.id]: response,
      },
    }));
  };

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
        <div className="rounded-[28px] border border-white/12 bg-slate-900/80 p-6 text-center">
          <p className="text-lg font-semibold text-white">课堂已结束</p>
          <p className="mt-2 text-sm text-slate-300">教师已结束课堂，本页面保留你的学习记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e6333,transparent_35%),radial-gradient(circle_at_top_right,#082f4922,transparent_38%),#020617] text-slate-100">
      <L2ACourseHeader
        steps={L2A_LESSON_STEPS}
        activeIndex={activeIndex}
        middleNotice={isDemo ? '演示模式：可自由切换环节' : undefined}
        onIndexChange={(index) => {
          if (isDemo) {
            setActiveIndex(index);
          }
        }}
      />

      <main className="mx-auto max-w-[1180px] space-y-4 px-4 py-4">
        {error ? (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}
        {isOutOfSync ? (
          <div className="flex flex-col gap-3 rounded-[24px] border border-amber-300/35 bg-amber-500/10 px-4 py-4 text-sm text-amber-50 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-amber-200">同步提醒</div>
              <p className="mt-1 leading-6">
                当前页面与教师不同步，教师当前位于“{teacherStep?.title ?? '当前环节'}”。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveIndex(teacherIndex)}
              className="inline-flex items-center justify-center rounded-full border border-amber-200/40 px-4 py-2 text-xs font-medium text-amber-50 transition hover:bg-amber-200/10"
            >
              点击跳转
            </button>
          </div>
        ) : null}

        <div className="space-y-4">
          {step.id === 'knowledge-map' ? <KnowledgeMapVisual /> : null}
          <StepContentPanel content={stepDefinition.student} />
          <StudentActivityForm
            key={step.id}
            stepId={step.id}
            activity={stepDefinition.student.activity}
            savedResponse={savedResponse}
            onSubmit={handleSubmitResponse}
          />
          {step.id === 'summary' ? <StudentSummaryPanel courseState={courseState} /> : null}

          {showWorkspace ? (
            <section className="space-y-3">
              <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-500/8 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Interactive Workspace</div>
                <p className="mt-1 text-sm leading-6 text-slate-200">
                  当前环节需要你动手比较参数与曲线。若设备屏幕较小，请先阅读上方提示，再在这里完成探索。
                </p>
              </div>
              <L2AWorkspace
                role="student"
                sessionId={sessionId}
                currentStepId={step.id}
                currentStepTitle={step.title}
                state={courseState.workspace}
                onChange={(workspace) => {
                  void saveCourseState((prev) => ({
                    ...prev,
                    workspace,
                    updatedAt: Date.now(),
                  }));
                }}
              />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import {
  createEmptyL2BStudentState,
  getL2BMediaSrc,
  getL2BStep,
  L2B_LESSON_STEPS,
  L2B_WORKSPACE_VISIBLE_STEP_IDS,
  type L2BWorkspaceSnapshot,
  type L2BStudentCourseState,
  type L2BStepResponse,
} from '@/lib/l2b-course';
import { L2BCourseHeader } from './course-header';
import {
  KnowledgeMapVisual,
  StepContentPanel,
  StudentActivityForm,
  StudentSummaryPanel,
} from './step-panels';
import { L2BWorkspace } from './workspace';

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

function isL2BStudentState(value: unknown): value is L2BStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<L2BStudentCourseState>;
  return data.kind === 'l2b_student_state' && data.version === 1;
}

interface TeacherCourseSyncState {
  kind: 'teacher_sync';
  activeStepId: string;
  workspace: L2BWorkspaceSnapshot;
  updatedAt: number;
}

export function L2BStudentPage({ sessionId }: { sessionId: string }) {
  const isDemo = sessionId === 'demo';
  const searchParams = useSearchParams();
  const demoStepId = searchParams.get('step');
  const { data: authSession } = useSession();

  const [sessionInfo, setSessionInfo] = useState<StudentSessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseState, setCourseState] = useState<L2BStudentCourseState>(() =>
    createEmptyL2BStudentState(authSession?.user?.name?.trim() || '学生'),
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
      const index = data.currentItemId ? L2B_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
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
      const response = await fetch(`/api/session/${sessionId}/state?scope=student-view`);
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
      const demoIndex = demoStepId ? L2B_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
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
    const record = stateRecords.find((item) => item.user?.id === currentUserId && item.itemId === 'student:l2b:state');
    return record && isL2BStudentState(record.data) ? record.data : null;
  }, [currentUserId, stateRecords]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of stateRecords) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      const payload = record.data as Partial<TeacherCourseSyncState> | null;
      if (payload?.kind === 'teacher_sync' && payload.workspace) {
        return payload as TeacherCourseSyncState;
      }
    }
    return null;
  }, [stateRecords]);

  useEffect(() => {
    if (selfState) {
      setCourseState(selfState);
    }
  }, [selfState]);

  const persistState = useCallback(
    async (nextState: L2BStudentCourseState) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'student:l2b:state',
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
    async (updater: (prev: L2BStudentCourseState) => L2BStudentCourseState) => {
      setCourseState((prev) => {
        const nextState = updater(prev);
        void persistState(nextState);
        return nextState;
      });
    },
    [persistState],
  );

  const step = L2B_LESSON_STEPS[activeIndex];
  const teacherStep = L2B_LESSON_STEPS[teacherIndex];
  const stepDefinition = getL2BStep(step.id);
  const savedResponse = courseState.responses[step.id];
  const showWorkspace = L2B_WORKSPACE_VISIBLE_STEP_IDS.has(step.id);
  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;
  const syncedWorkspace = teacherSyncRecord?.activeStepId === step.id ? teacherSyncRecord.workspace : null;
  const readOnlyWorkspace = step.id === 'pole-drag-demo' && !isDemo && !(teacherSyncRecord?.workspace.studentUnlocked ?? false);
  const workspaceIntro =
    step.id === 'open-close-loop'
      ? '当前环节先把“调开环、看闭环”的关系讲清楚。请在下方结构图中对应旋钮位置与系统结果。'
      : '当前环节需要你动手比较参数与曲线。若设备屏幕较小，请先阅读上方提示，再在这里完成探索。';

  const handleSubmitResponse = (response: L2BStepResponse) => {
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
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <div className="premium-lesson-shell flex items-center justify-center px-3">
        <div className="premium-lesson-panel max-w-xl text-center">
          <p className="text-lg font-semibold text-slate-900">课堂已结束</p>
          <p className="premium-lesson-muted mt-2">教师已结束课堂，本页面保留你的学习记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <L2BCourseHeader
        steps={L2B_LESSON_STEPS}
        activeIndex={activeIndex}
        middleNotice={isDemo ? '演示模式：可自由切换环节' : undefined}
        onIndexChange={(index) => {
          if (isDemo) {
            setActiveIndex(index);
          }
        }}
      />

      <main className="premium-lesson-main max-w-[1080px] px-3 py-3 sm:px-4 sm:py-4">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {isOutOfSync ? (
          <div className="flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-amber-600">同步提醒</div>
              <p className="mt-1 leading-6">
                当前页面与教师不同步，教师当前位于“{teacherStep?.title ?? '当前环节'}”。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveIndex(teacherIndex)}
              className="inline-flex items-center justify-center rounded-full border border-amber-300 px-4 py-2 text-xs font-medium text-amber-700"
            >
              点击跳转
            </button>
          </div>
        ) : null}

        <div className="space-y-4">
          {step.id === 'knowledge-map' ? <KnowledgeMapVisual /> : null}
          <StepContentPanel
            content={stepDefinition.student}
            mediaSrc={getL2BMediaSrc(step.mediaKey)}
            mediaAlt={step.title}
          />
          <StudentActivityForm
            stepId={step.id}
            activity={stepDefinition.student.activity}
            savedResponse={savedResponse}
            courseState={courseState}
            onSubmit={handleSubmitResponse}
          />
          {step.id === 'summary' ? <StudentSummaryPanel courseState={courseState} /> : null}

          {showWorkspace ? (
            <section className="space-y-3">
              <div className="premium-lesson-panel-soft px-4 py-3">
                <div className="premium-lesson-kicker">Interactive Workspace</div>
                <p className="premium-lesson-muted mt-1">{workspaceIntro}</p>
              </div>
              <L2BWorkspace
                role="student"
                sessionId={sessionId}
                currentStepId={step.id}
                currentStepTitle={step.title}
                state={readOnlyWorkspace && syncedWorkspace ? syncedWorkspace : courseState.workspace}
                readOnly={readOnlyWorkspace}
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

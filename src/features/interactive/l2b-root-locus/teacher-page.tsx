'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';

import {
  getL2BMediaSrc,
  getL2BStep,
  L2B_LESSON_STEPS,
  L2B_STAGE_MAP,
  L2B_WORKSPACE_VISIBLE_STEP_IDS,
  type L2BWorkspaceSnapshot,
  type L2BStudentCourseState,
} from '@/lib/l2b-course';
import { L2BCourseHeader } from './course-header';
import { KnowledgeMapVisual, StepContentPanel, StudentSummaryPanel, TeacherActivitySummary } from './step-panels';
import { L2BWorkspace } from './workspace';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';

interface TeacherSessionInfo {
  id: string;
  joinCode: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  classId: string | null;
  currentItemId: string | null;
  planTitle?: string;
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
  activeStepId: string;
  workspace: L2BWorkspaceSnapshot;
  updatedAt: number;
}

export function L2BTeacherPage({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<TeacherSessionInfo | null>(null);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [workspaceState, setWorkspaceState] = useState<L2BWorkspaceSnapshot>({
    gain: 1,
    selectedPointKey: null,
    showRay45: false,
    studentUnlocked: false,
    lastMeasuredAt: null,
  });
  const initializedStepRef = useRef(false);
  const pendingStepIdRef = useRef<string | null>(null);

  const step = L2B_LESSON_STEPS[activeIndex];
  const showWorkspace = L2B_WORKSPACE_VISIBLE_STEP_IDS.has(step.id);
  const workspaceIntro =
    step.id === 'open-close-loop'
      ? '当前环节更适合配合反馈框图讲清“开环旋钮 vs 闭环结果”，不需要提前切回根轨迹图。'
      : '当前环节建议教师配合下方工作区演示参数变化，并决定何时切换到学生自主模式。';

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as TeacherSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂不存在');
      }
      setSessionInfo(data);
      const index = data.currentItemId
        ? L2B_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId)
        : -1;
      if (!initializedStepRef.current) {
        if (index >= 0) {
          setActiveIndex(index);
        }
        initializedStepRef.current = true;
        pendingStepIdRef.current = null;
      } else if (index >= 0 && pendingStepIdRef.current === L2B_LESSON_STEPS[index].id) {
        pendingStepIdRef.current = null;
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
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchSession, fetchStates]);

  const patchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = L2B_LESSON_STEPS[nextIndex];
      const previousIndex = activeIndex;
      setActiveIndex(nextIndex);
      setSyncError(null);
      pendingStepIdRef.current = nextStep.id;
      try {
        const response = await fetch(`/api/session/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentItemId: nextStep.id,
            currentStage: L2B_STAGE_MAP[nextStep.stage],
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || '课堂推进失败');
        }
      } catch (error) {
        pendingStepIdRef.current = null;
        setActiveIndex(previousIndex);
        setSyncError(error instanceof Error ? error.message : '课堂推进失败');
      }
    },
    [activeIndex, sessionId],
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
    [sessionId],
  );

  const studentStates = useMemo(() => {
    return stateRecords
      .map((record) => {
        const data = record.data as Partial<L2BStudentCourseState> | null;
        if (record.itemId !== 'student:l2b:state' || data?.kind !== 'l2b_student_state') {
          return null;
        }

        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as L2BStudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: L2BStudentCourseState }>;
  }, [stateRecords]);

  const joinedStudents = useMemo(() => {
    const names = new Set(studentStates.map((item) => item.studentName));
    return Array.from(names);
  }, [studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: L2BStudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) {
      return;
    }
    if (!window.confirm('确定要结束课堂吗？结束后学生将停止同步课堂进度。')) {
      return;
    }

    setEndingSession(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED' }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || '结束课堂失败');
      }

      router.push(
        buildSessionEndReturnHref({
          classId: sessionInfo.classId,
          planTitle: sessionInfo.planTitle,
        }),
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '结束课堂失败');
      setEndingSession(false);
    }
  }, [router, sessionId, sessionInfo]);

  useEffect(() => {
    void postTeacherSyncState({
      activeStepId: step.id,
      workspace: workspaceState,
    });
  }, [postTeacherSyncState, step.id, workspaceState]);

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const stepDefinition = getL2BStep(step.id);

  return (
    <div className="premium-lesson-shell">
      <L2BCourseHeader
        steps={L2B_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void patchCurrentStep(index)}
        rightSlot={(
          <button
            type="button"
            onClick={() => void handleEndSession()}
            disabled={endingSession}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 disabled:opacity-60"
          >
            {endingSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            结束课堂
          </button>
        )}
      />

      <main className="premium-lesson-main max-w-[1080px] px-3 py-3 sm:px-4 sm:py-4">
        {syncError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{syncError}</div>
        ) : null}

        <div className="space-y-4">
          {step.id === 'knowledge-map' ? <KnowledgeMapVisual /> : null}
          <StepContentPanel
            content={stepDefinition.teacher}
            mediaSrc={getL2BMediaSrc(step.mediaKey)}
            mediaAlt={step.title}
            rightSlot={
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs text-cyan-700">
                课堂码：{sessionInfo?.joinCode ?? '------'}
              </span>
            }
          />
          <TeacherActivitySummary responses={currentResponses} />
          <section className="premium-lesson-panel-soft">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Users className="h-4 w-4 text-cyan-700" />
              当前在线学生
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {joinedStudents.length ? (
                joinedStudents.map((name) => (
                  <span key={name} className="premium-lesson-chip">
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">暂无学生提交本课状态。</span>
              )}
            </div>
          </section>

          {step.id === 'summary' && studentStates[0] ? <StudentSummaryPanel courseState={studentStates[0].state} /> : null}

          {showWorkspace ? (
            <section className="space-y-3">
              <div className="premium-lesson-panel-soft px-4 py-3">
                <div className="premium-lesson-kicker">Teacher Workspace</div>
                <p className="premium-lesson-muted mt-1">{workspaceIntro}</p>
              </div>
              <L2BWorkspace
                role="teacher"
                sessionId={sessionId}
                currentStepId={step.id}
                currentStepTitle={step.title}
                state={workspaceState}
                onChange={setWorkspaceState}
              />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import {
  getLSUMMediaSrc,
  LSUM_LESSON_STEPS,
  LSUM_STAGE_MAP,
  type LSUMStudentCourseState,
  type LSUMTeacherCourseSyncState,
} from '@/lib/lsum-course';
import { LSUMCourseHeader } from './course-header';
import {
  LSUMKnowledgeMapVisual,
  LSUMStepAiAssistant,
  LSUMStepContentPanel,
  LSUMTeacherActivitySummary,
} from './step-panels';

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

function isLSUMStudentState(value: unknown): value is LSUMStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LSUMStudentCourseState>;
  return data.kind === 'lsum_student_state' && data.version === 1;
}

export function LSUMTeacherPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<TeacherSessionInfo | null>(null);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [releasedActivities, setReleasedActivities] = useState<Record<string, boolean>>({});
  const initializedStepRef = useRef(false);
  const pendingStepIdRef = useRef<string | null>(null);

  const step = LSUM_LESSON_STEPS[activeIndex];

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as TeacherSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂不存在');
      }

      setSessionInfo(data);
      const index = data.currentItemId ? LSUM_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
      if (!initializedStepRef.current) {
        if (index >= 0) {
          setActiveIndex(index);
        }
        initializedStepRef.current = true;
        pendingStepIdRef.current = null;
      } else if (index >= 0 && pendingStepIdRef.current === LSUM_LESSON_STEPS[index].id) {
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
      const nextStep = LSUM_LESSON_STEPS[nextIndex];
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
            currentStage: LSUM_STAGE_MAP[nextStep.stage],
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

  const postTeacherSyncState = useCallback(async () => {
    await fetch(`/api/session/${sessionId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'teacher:course-sync',
        data: {
          kind: 'teacher_sync_lsum',
          activeStepId: step.id,
          revealedAnswers,
          releasedActivities,
          updatedAt: Date.now(),
        } satisfies LSUMTeacherCourseSyncState,
      }),
    });
  }, [releasedActivities, revealedAnswers, sessionId, step.id]);

  useEffect(() => {
    void postTeacherSyncState();
  }, [postTeacherSyncState]);

  const studentStates = useMemo(() => {
    return stateRecords
      .map((record) => {
        if (record.itemId !== 'student:lsum:state' || !isLSUMStudentState(record.data)) {
          return null;
        }
        return {
          studentName: record.data.studentName || record.user?.name?.trim() || '未命名学生',
          state: record.data,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: LSUMStudentCourseState }>;
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
      .filter(Boolean) as Array<{ studentName: string; response: LSUMStudentCourseState['responses'][string] }>;
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

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <LSUMCourseHeader
        steps={LSUM_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void patchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={LSUM_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="premium-lesson-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="premium-lesson-kicker">Teacher Console</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">课堂码：{sessionInfo?.joinCode ?? '------'}</div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、查看学生提交统计，并在需要时释放题目、显示答案。</div>
            </div>
            <TeacherJoinQrDialog joinCode={sessionInfo?.joinCode} />
            <button
              type="button"
              onClick={() => void handleEndSession()}
              disabled={endingSession}
              className="premium-lesson-action-tone premium-tone-rose"
            >
              {endingSession ? '结束中...' : '结束课堂'}
            </button>
          </div>

          <div className="premium-lesson-panel-soft px-4 py-4">
            <button
              type="button"
              onClick={() => setShowStudentList((prev) => !prev)}
              className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                当前在线学生
              </span>
              <span className="premium-lesson-caption inline-flex items-center gap-1 text-xs">
                {joinedStudents.length} 人
                {showStudentList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showStudentList ? (
              <div className="mt-3 space-y-2">
                {joinedStudents.length ? (
                  joinedStudents.map((studentName) => (
                    <div key={studentName} className="premium-lesson-surface-elevated px-3 py-2 text-sm">
                      {studentName}
                    </div>
                  ))
                ) : (
                  <div className="premium-lesson-muted text-sm">暂无学生加入。</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {syncError ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{syncError}</div> : null}

        {step.id === 'step-01' ? <LSUMKnowledgeMapVisual /> : null}

        <LSUMStepContentPanel step={step} mediaSrc={getLSUMMediaSrc(step.id)} mediaAlt={step.title} />

        {step.pageType === 'ai' ? (
          <div className="mt-4">
            <LSUMStepAiAssistant step={step} />
          </div>
        ) : null}

        <div className="mt-4">
          <LSUMTeacherActivitySummary
            step={step}
            responses={currentResponses}
            released={Boolean(releasedActivities[step.id])}
            answerVisible={Boolean(revealedAnswers[step.id])}
            onToggleRelease={() =>
              setReleasedActivities((prev) => ({
                ...prev,
                [step.id]: !prev[step.id],
              }))
            }
            onToggleAnswerVisible={() =>
              setRevealedAnswers((prev) => ({
                ...prev,
                [step.id]: !prev[step.id],
              }))
            }
          />
        </div>
      </main>
    </div>
  );
}

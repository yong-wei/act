'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  getL2CMediaSrc,
  L2C_LESSON_STEPS,
  L2C_STAGE_MAP,
  type L2CStudentCourseState,
} from '@/lib/l2c-course';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import { L2CCourseHeader } from './course-header';
import {
  L2CKnowledgeMapVisual,
  L2CStepAiAssistant,
  L2CStepContentPanel,
  L2CTeacherActivitySummary,
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

interface TeacherCourseSyncState {
  kind: 'teacher_sync_l2c';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt: number;
}

export function L2CTeacherPage({
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
  const initializedStepRef = useRef(false);
  const pendingStepIdRef = useRef<string | null>(null);

  const step = L2C_LESSON_STEPS[activeIndex];

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as TeacherSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂不存在');
      }
      setSessionInfo(data);
      const index = data.currentItemId ? L2C_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
      if (!initializedStepRef.current) {
        if (index >= 0) {
          setActiveIndex(index);
        }
        initializedStepRef.current = true;
        pendingStepIdRef.current = null;
      } else if (index >= 0 && pendingStepIdRef.current === L2C_LESSON_STEPS[index].id) {
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
      const nextStep = L2C_LESSON_STEPS[nextIndex];
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
            currentStage: L2C_STAGE_MAP[nextStep.stage],
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
          kind: 'teacher_sync_l2c',
          activeStepId: step.id,
          revealedAnswers,
          updatedAt: Date.now(),
        } satisfies TeacherCourseSyncState,
      }),
    });
  }, [revealedAnswers, sessionId, step.id]);

  useEffect(() => {
    void postTeacherSyncState();
  }, [postTeacherSyncState]);

  const studentStates = useMemo(() => {
    return stateRecords
      .map((record) => {
        const data = record.data as Partial<L2CStudentCourseState> | null;
        if (record.itemId !== 'student:l2c:state' || data?.kind !== 'l2c_student_state') {
          return null;
        }

        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as L2CStudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: L2CStudentCourseState }>;
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
      .filter(Boolean) as Array<{ studentName: string; response: L2CStudentCourseState['responses'][string] }>;
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
      <L2CCourseHeader
        steps={L2C_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void patchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={L2C_LESSON_STEPS.map((item) => item.id)}
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
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、查看提交统计，并在需要时揭示标准答案。</div>
            </div>
            <button type="button" onClick={() => void handleEndSession()} disabled={endingSession} className="premium-lesson-action-tone premium-tone-rose">
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

        {step.id === 'step-01' ? <L2CKnowledgeMapVisual /> : null}

        <L2CStepContentPanel
          content={step.teacher}
          mediaSrc={getL2CMediaSrc(step.mediaKey)}
          mediaAlt={step.title}
        />

        {step.aiPrompts?.length ? <div className="mt-4"><L2CStepAiAssistant step={step} /></div> : null}

        <div className="mt-4">
          <L2CTeacherActivitySummary
            activity={step.student.activity}
            responses={currentResponses}
            answerVisible={Boolean(revealedAnswers[step.id])}
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

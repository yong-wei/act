'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  createEmptyL2DStudentState,
  getCourseTotals,
  L2D_LESSON_STEPS,
  scoreReflection,
  scoreTaskOne,
  scoreTaskTwoRow,
  type L2DReflectionSubmission,
  type L2DStudentCourseState,
  type L2DTaskOneSubmission,
  type L2DTaskTwoRowSubmission,
} from '@/lib/l2d-course';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { L2DCourseHeader } from './course-header';
import { L2DStepContentPanel, L2DKnowledgeMapVisual, L2DStudentActivityForm, L2DStudentSummaryPanel } from './step-panels';
import { L2DThreeDomainWorkspace } from './workspace';

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
  kind: 'teacher_sync_l2d';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt: number;
}

function isL2DStudentState(value: unknown): value is L2DStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<L2DStudentCourseState>;
  return data.kind === 'l2d_student_state' && data.version === 1;
}

export function L2DStudentPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const isDemo = sessionId === 'demo';
  const searchParams = useSearchParams();
  const demoStepId = searchParams.get('step');
  const { data: authSession } = useSession();

  const [sessionInfo, setSessionInfo] = useState<StudentSessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseState, setCourseState] = useState<L2DStudentCourseState>(() =>
    createEmptyL2DStudentState(authSession?.user?.name?.trim() || '学生'),
  );
  const [workspaceGain, setWorkspaceGain] = useState(1);
  const [workspaceMetrics, setWorkspaceMetrics] = useState({
    gain: 1,
    sigma: -0.5,
    omega: 0.5,
    mp: 5,
    ts: 5,
    gamma: 60,
    isStable: true,
  });
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
      const index = data.currentItemId ? L2D_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
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
      const demoIndex = demoStepId ? L2D_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
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
      void syncStates();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isDemo, syncSession, syncStates]);

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
    const record = stateRecords.find((item) => item.user?.id === currentUserId && item.itemId === 'student:l2d:state');
    return record && isL2DStudentState(record.data) ? record.data : null;
  }, [currentUserId, stateRecords]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of stateRecords) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      const payload = record.data as Partial<TeacherCourseSyncState> | null;
      if (payload?.kind === 'teacher_sync_l2d') {
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
    async (nextState: L2DStudentCourseState) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'student:l2d:state',
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
    async (updater: (prev: L2DStudentCourseState) => L2DStudentCourseState) => {
      setCourseState((prev) => {
        const nextState = updater(prev);
        void persistState(nextState);
        return nextState;
      });
    },
    [persistState],
  );

  const step = L2D_LESSON_STEPS[activeIndex];
  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;
  const answerVisible = teacherSyncRecord?.activeStepId === step.id ? Boolean(teacherSyncRecord.revealedAnswers?.[step.id]) : false;

  const updateWorkspaceMetrics = (metrics: typeof workspaceMetrics) => {
    setWorkspaceGain(metrics.gain);
    setWorkspaceMetrics(metrics);
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
      <div className="premium-lesson-shell px-3 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="premium-lesson-panel text-center">
            <p className="premium-lesson-title text-lg font-semibold">课堂已结束</p>
            <p className="premium-lesson-muted mt-2">教师已结束课堂，本页面保留你的学习记录与成绩概览。</p>
          </div>
          <L2DStudentSummaryPanel courseState={courseState} />
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <L2DCourseHeader
        steps={L2D_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={L2D_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button type="button" onClick={() => setActiveIndex(teacherIndex)} className="premium-lesson-action-tone premium-tone-amber">
              跳到教师当前页
            </button>
          </div>
        ) : null}

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <L2DKnowledgeMapVisual /> : null}

        <L2DStepContentPanel
          content={step.student}
        />

        {step.pageType === 'workspace' ? (
          <div className="mt-4">
            <L2DThreeDomainWorkspace
              gain={workspaceGain}
              onGainChange={setWorkspaceGain}
              accentLabel={step.observationId ?? undefined}
              onMetricsChange={updateWorkspaceMetrics}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <L2DStudentActivityForm
            stepId={step.id}
            activity={step.student.activity}
            courseState={courseState}
            metrics={workspaceMetrics}
            answerVisible={answerVisible}
            onSavePreAssessment={(answers) =>
              void saveCourseState((prev) => ({
                ...prev,
                preAssessment: { answers, submittedAt: Date.now() },
                updatedAt: Date.now(),
              }))
            }
            onSaveTaskOne={(input) => {
              const result = scoreTaskOne(input.kCritical);
              void saveCourseState((prev) => ({
                ...prev,
                taskOne:
                  !prev.taskOne || result.score >= prev.taskOne.score
                    ? {
                        ...input,
                        score: result.score,
                        feedback: result.feedback,
                        submittedAt: Date.now(),
                      }
                    : prev.taskOne,
                updatedAt: Date.now(),
              }));
            }}
            onSaveTaskTwoRow={(row) => {
              const previousRowIndex = ['row-1', 'row-2', 'row-3', 'row-4'].indexOf(row.rowId) - 1;
              const previousRow = previousRowIndex >= 0 ? courseState.taskTwoRows[['row-1', 'row-2', 'row-3', 'row-4'][previousRowIndex]] : undefined;
              const result = scoreTaskTwoRow(row, previousRow ?? null);
              void saveCourseState((prev) => {
                const previous = prev.taskTwoRows[row.rowId];
                const nextRow: L2DTaskTwoRowSubmission = {
                  ...row,
                  score: result.score,
                  checks: result.checks,
                  feedback: result.feedback,
                  submittedAt: Date.now(),
                };
                return {
                  ...prev,
                  taskTwoRows: {
                    ...prev.taskTwoRows,
                    [row.rowId]: !previous || nextRow.score >= previous.score ? nextRow : previous,
                  },
                  updatedAt: Date.now(),
                };
              });
            }}
            onSaveReflection={(input) => {
              const result = scoreReflection(input);
              void saveCourseState((prev) => ({
                ...prev,
                reflection: {
                  ...input,
                  score: result.score,
                  feedback: result.feedback,
                  submittedAt: Date.now(),
                },
                updatedAt: Date.now(),
              }));
            }}
            onSavePostAssessment={(range) =>
              void saveCourseState((prev) => ({
                ...prev,
                postAssessment: {
                  ...range,
                  submittedAt: Date.now(),
                },
                updatedAt: Date.now(),
              }))
            }
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <L2DStudentSummaryPanel courseState={courseState} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import {
  getLSUMMediaSrc,
  LSUM_LESSON_STEPS,
  LSUM_STAGE_MAP,
  LSUM_SESSION_ADAPTER,
  LSUM_RESOURCE_KEY,
  LSUM_LESSON_KEY,
  type LSUMStudentCourseState,
  type LSUMTeacherCourseSyncState,
  shouldPostLSUMTeacherSync,
  resolveLSUMTeacherSyncDraft,
  finalizeLSUMTeacherSession,
  isLSUMTeacherSyncState,
} from '@/lib/lsum-course';
import { LSUMCourseHeader } from './course-header';
import {
  LSUMKnowledgeMapVisual,
  LSUMStepAiAssistant,
  LSUMStepContentPanel,
  LSUMTeacherActivitySummary,
} from './step-panels';

export function LSUMTeacherPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const router = useRouter();
  const [endingSession, setEndingSession] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [localRevealedAnswers, setLocalRevealedAnswers] = useState<Record<string, boolean> | null>(null);
  const [localReleasedActivities, setLocalReleasedActivities] = useState<Record<string, boolean> | null>(null);

  // Unified tracking setup
  const interactiveTracking = useInteractiveTracking({
    resourceId: LSUM_RESOURCE_KEY,
    resourceKey: LSUM_RESOURCE_KEY,
    sessionId,
  });

  // Unified teacher session hook
  const {
    sessionInfo,
    courseStates,
    teacherStates,
    activeIndex,
    loadingSession,
    error,
    teacherViewHydrated,
    patchCurrentStep,
    postTeacherSyncInput,
    finishSession,
  } = useTeacherLessonSession({
    sessionId,
    steps: LSUM_LESSON_STEPS,
    adapter: LSUM_SESSION_ADAPTER,
  });

  // Course event tracking
  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: LSUM_RESOURCE_KEY,
    resourceId: LSUM_RESOURCE_KEY,
    sessionId,
    lessonKey: LSUM_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = LSUM_LESSON_STEPS[activeIndex];

  // Compute teacherSyncState from teacherStates
  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isLSUMTeacherSyncState(record.data));
    return (latestRecord?.data as LSUMTeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  // Resolve revealed/released from local draft + server state
  const { revealedAnswers, releasedActivities } = useMemo(
    () =>
      resolveLSUMTeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        teacherSyncState,
      }),
    [localRevealedAnswers, localReleasedActivities, teacherSyncState],
  );

  // Step view tracking
  const previousStepIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingSession) return;
    const previousStepId = previousStepIdRef.current;
    if (previousStepId && previousStepId !== step.id) {
      trackStepLeave(previousStepId, { nextStepId: step.id });
    }
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    previousStepIdRef.current = step.id;
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  // Error tracking
  useEffect(() => {
    if (!error) return;
    trackSyncError(step.id, { message: error, scope: 'teacher-page' });
  }, [error, step.id, trackSyncError]);

  // Teacher-sync write-back gate
  useEffect(() => {
    if (!shouldPostLSUMTeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
    });
  }, [loadingSession, postTeacherSyncInput, revealedAnswers, releasedActivities, step.id, teacherViewHydrated]);

  // Student states from courseStates
  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!record.data || typeof record.data !== 'object') return null;
        const data = record.data as { kind?: string; version?: number; studentName?: string; responses?: Record<string, unknown> };
        if (data.kind !== 'lsum_student_state' || data.version !== 1) return null;
        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as LSUMStudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: LSUMStudentCourseState }>;
  }, [courseStates]);

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

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const previousIndex = activeIndex;
      const nextStep = LSUM_LESSON_STEPS[nextIndex];
      trackStepLeave(step.id, { nextStepId: nextStep.id });
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: LSUM_STAGE_MAP[nextStep.stage],
      });
      trackStepView(nextStep.id, { pageType: nextStep.pageType, stepIndex: nextIndex });
    },
    [activeIndex, patchCurrentStep, step.id, trackStepLeave, trackStepView],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!window.confirm('确定要结束课堂吗？结束后学生将停止同步课堂进度。')) return;

    setEndingSession(true);
    try {
      await finalizeLSUMTeacherSession({
        finishSession,
        trackSessionFinalize,
        currentStepId: step.id,
      });
      router.push(
        buildSessionEndReturnHref({
          classId: sessionInfo.classId,
          planTitle: sessionInfo.planTitle,
        }),
      );
    } catch {
      setEndingSession(false);
    }
  }, [finishSession, router, sessionInfo, step.id, trackSessionFinalize]);

  // Handle AI events
  const handleAiEvent = useCallback(
    (eventType: string, data?: Record<string, unknown>) => {
      interactiveTracking.emit('interact', {
        stepId: step.id,
        data: { eventType, ...data },
      });
    },
    [step.id, interactiveTracking],
  );

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
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
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

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <LSUMKnowledgeMapVisual /> : null}

        <LSUMStepContentPanel step={step} mediaSrc={getLSUMMediaSrc(step.id)} mediaAlt={step.title} />

        {step.pageType === 'ai' ? (
          <div className="mt-4">
            <LSUMStepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <LSUMTeacherActivitySummary
            step={step}
            responses={currentResponses}
            released={Boolean(releasedActivities[step.id])}
            answerVisible={Boolean(revealedAnswers[step.id])}
            onToggleRelease={() =>
              setLocalReleasedActivities((prev) => ({
                ...(prev ?? (teacherSyncState as LSUMTeacherCourseSyncState | null)?.releasedActivities ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as LSUMTeacherCourseSyncState | null)?.releasedActivities?.[step.id]),
              }))
            }
            onToggleAnswerVisible={() =>
              setLocalRevealedAnswers((prev) => ({
                ...(prev ?? (teacherSyncState as LSUMTeacherCourseSyncState | null)?.revealedAnswers ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as LSUMTeacherCourseSyncState | null)?.revealedAnswers?.[step.id]),
              }))
            }
          />
        </div>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import { requestClassroomEndConfirmation } from '@/features/classroom/classroom-lifecycle-dialog';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import {
  finalizeUNIT_2_4TeacherSession,
  getUNIT_2_4MediaSrc,
  isUNIT_2_4AiPageType,
  isUNIT_2_4TeacherSyncState,
  resolveUNIT_2_4TeacherSyncDraft,
  shouldPostUNIT_2_4TeacherSync,
  UNIT_2_4_LESSON_KEY,
  UNIT_2_4_LESSON_STEPS,
  UNIT_2_4_RESOURCE_KEY,
  UNIT_2_4_SESSION_ADAPTER,
  UNIT_2_4_STAGE_MAP,
  type UNIT_2_4StudentCourseState,
  type UNIT_2_4TeacherCourseSyncState,
} from '@/lib/unit-2-4-course';
import { UNIT_2_4CourseHeader } from './course-header';
import {
  UNIT_2_4KnowledgeMapVisual,
  UNIT_2_4StepAiAssistant,
  UNIT_2_4StepContentPanel,
  UNIT_2_4TeacherActivitySummary,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_2_4TeacherPage({
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

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_2_4_RESOURCE_KEY,
    resourceKey: UNIT_2_4_RESOURCE_KEY,
    sessionId,
  });

  const {
    sessionInfo,
    courseStates,
    teacherStates,
    activeIndex,
    loadingSession,
    error,
    errorTelemetry,
    teacherViewHydrated,
    patchCurrentStep,
    postTeacherSyncInput,
    finishSession,
  } = useTeacherLessonSession({
    sessionId,
    steps: UNIT_2_4_LESSON_STEPS,
    adapter: UNIT_2_4_SESSION_ADAPTER,
  });

  const { trackCourseEvent, trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } =
    useCourseEventTracking({
      resourceKey: UNIT_2_4_RESOURCE_KEY,
      resourceId: UNIT_2_4_RESOURCE_KEY,
      sessionId,
      lessonKey: UNIT_2_4_LESSON_KEY,
      actorRole: 'teacher',
      emit: interactiveTracking.emit,
    });

  const step = UNIT_2_4_LESSON_STEPS[activeIndex];

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_2_4TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_2_4TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities } = useMemo(
    () =>
      resolveUNIT_2_4TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        teacherSyncState,
      }),
    [localRevealedAnswers, localReleasedActivities, teacherSyncState],
  );

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

  useEffect(() => {
    if (!error) return;
    trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostUNIT_2_4TeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
    });
  }, [loadingSession, postTeacherSyncInput, revealedAnswers, releasedActivities, step.id, teacherViewHydrated]);

  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!record.data || typeof record.data !== 'object') return null;
        const data = record.data as { kind?: string; version?: number; studentName?: string; responses?: Record<string, unknown> };
        if (data.kind !== 'unit24_student_state' || data.version !== 1) return null;
        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as UNIT_2_4StudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_2_4StudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => Array.from(new Set(studentStates.map((item) => item.studentName))), [studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_2_4StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = UNIT_2_4_LESSON_STEPS[nextIndex];
      trackStepLeave(step.id, { nextStepId: nextStep.id });
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_2_4_STAGE_MAP[nextStep.stage],
      });
      trackStepView(nextStep.id, { pageType: nextStep.pageType, stepIndex: nextIndex });
    },
    [patchCurrentStep, step.id, trackStepLeave, trackStepView],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_2_4TeacherSession({
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

  const handleAiEvent = useCallback(
    (eventType: string, data?: Record<string, unknown>) => {
      trackCourseEvent(
        eventType === 'ai_panel_open' ? COURSE_EVENT_TYPES.AI_PANEL_OPEN : COURSE_EVENT_TYPES.AI_QUERY_SUBMIT,
        {
          stepId: step.id,
          data: { eventType, ...data },
        },
      );
    },
    [step.id, trackCourseEvent],
  );

  const handleWorkspaceParameterChange = useCallback(
    (change: WorkspaceParameterChange) => {
      trackWorkspaceParamChange(step.id, {
        key: change.key,
        value: change.value,
        source: change.source,
      });
    },
    [step.id, trackWorkspaceParamChange],
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
      <UNIT_2_4CourseHeader
        steps={UNIT_2_4_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_2_4_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main py-4 sm:py-6">
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

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <UNIT_2_4KnowledgeMapVisual /> : null}

        <UNIT_2_4StepContentPanel
          step={step}
          mediaSrc={getUNIT_2_4MediaSrc(step.id)}
          mediaAlt={step.title}
          onWorkspaceParameterChange={handleWorkspaceParameterChange}
        />

        {isUNIT_2_4AiPageType(step.pageType) ? (
          <div className="mt-4">
            <UNIT_2_4StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <UNIT_2_4TeacherActivitySummary
            step={step}
            responses={currentResponses}
            released={Boolean(releasedActivities[step.id])}
            answerVisible={Boolean(revealedAnswers[step.id])}
            onToggleRelease={() =>
              setLocalReleasedActivities((prev) => ({
                ...(prev ?? (teacherSyncState as UNIT_2_4TeacherCourseSyncState | null)?.releasedActivities ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as UNIT_2_4TeacherCourseSyncState | null)?.releasedActivities?.[step.id]),
              }))
            }
            onToggleAnswerVisible={() =>
              setLocalRevealedAnswers((prev) => ({
                ...(prev ?? (teacherSyncState as UNIT_2_4TeacherCourseSyncState | null)?.revealedAnswers ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as UNIT_2_4TeacherCourseSyncState | null)?.revealedAnswers?.[step.id]),
              }))
            }
          />
        </div>
      </main>
    </div>
  );
}

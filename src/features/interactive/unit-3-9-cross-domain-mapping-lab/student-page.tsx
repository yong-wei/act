'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  buildUNIT_3_9RuntimeSteps,
  getUNIT_3_9StepManifest,
  isUNIT_3_9InteractivePageType,
  UNIT_3_9_LESSON_KEY,
  UNIT_3_9_RESOURCE_KEY,
  UNIT_3_9_SESSION_ADAPTER,
  type UNIT_3_9StudentCourseState,
  type UNIT_3_9StepResponse,
} from '@/lib/unit-3-9-course';
import { UNIT_3_9CourseHeader } from './course-header';
import {
  UNIT_3_9StepContentPanel,
  UNIT_3_9StudentActivityForm,
  UNIT_3_9StudentSummaryPanel,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_3_9StudentPage({
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
  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;
  const interactiveManifest = lessonRuntime.interactiveManifest;
  if (!interactiveManifest) {
    throw new Error('3-9 runtime manifest is missing');
  }
  const runtimeSteps = buildUNIT_3_9RuntimeSteps(interactiveManifest);

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_3_9_RESOURCE_KEY,
    resourceKey: UNIT_3_9_RESOURCE_KEY,
    userId: currentUserId,
    sessionId: isDemo ? undefined : sessionId,
  });

  const {
    sessionInfo,
    courseState,
    teacherSyncState,
    activeIndex,
    teacherIndex,
    loadingSession,
    error,
    errorTelemetry,
    isOutOfSync,
    saveCourseState,
    setActiveIndex,
  } = useStudentLessonSession({
    sessionId,
    steps: runtimeSteps,
    adapter: UNIT_3_9_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } =
    useCourseEventTracking({
      resourceKey: UNIT_3_9_RESOURCE_KEY,
      resourceId: UNIT_3_9_RESOURCE_KEY,
      sessionId: isDemo ? null : sessionId,
      lessonKey: UNIT_3_9_LESSON_KEY,
      actorRole: 'student',
      emit: interactiveTracking.emit,
    });

  const step = runtimeSteps[activeIndex];
  const stepManifest = getUNIT_3_9StepManifest(interactiveManifest, step.id);
  const savedResponse = courseState.responses[step.id];

  const answerVisible = teacherSyncState?.activeStepId === step.id ? Boolean(teacherSyncState?.revealedAnswers?.[step.id]) : false;
  const released =
    isDemo ||
    !isUNIT_3_9InteractivePageType(step.pageType) ||
    stepManifest.teacherControls.releaseActivity === 'page_load_open'
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean(teacherSyncState?.releasedActivities?.[step.id])
        : false;
  const browseEnabled =
    isDemo ||
    stepManifest.teacherControls.openBrowse === 'not_applicable' ||
    stepManifest.teacherControls.openBrowse === 'page_load_open'
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean(teacherSyncState?.browseEnabled?.[step.id])
        : false;
  const revealProgress = teacherSyncState?.activeStepId === step.id ? teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0 : 0;
  const allowInlineReveal =
    isDemo || (browseEnabled && stepManifest.teacherControls.teacherStepReveal === 'not_applicable');

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
    trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const trackSubmission = useCallback(
    (input: { stepId: string; isResubmit: boolean; data?: Record<string, unknown> }) => {
      const submittedAt = Date.now();
      const attemptKey = `${input.stepId}:response:${submittedAt}`;
      trackCourseEvent(
        input.isResubmit ? COURSE_EVENT_TYPES.LESSON_RESUBMIT : COURSE_EVENT_TYPES.LESSON_SUBMIT,
        { stepId: input.stepId, attemptKey, clientEventAt: submittedAt, data: input.data },
      );
      return submittedAt;
    },
    [trackCourseEvent],
  );

  const handleSubmitResponse = (response: UNIT_3_9StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_3_9StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        responses: {
          ...prev.responses,
          [step.id]: response,
        },
      };
      trackSubmission({ stepId: step.id, isResubmit, data: { stepId: step.id } });
      return nextState;
    });
  };

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

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <div className="premium-lesson-shell flex items-center justify-center px-3">
        <div className="premium-lesson-panel max-w-xl text-center">
          <p className="premium-lesson-title text-lg font-semibold">课堂已结束</p>
          <p className="premium-lesson-muted mt-2">教师已结束课堂，本页面保留你的学习记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <UNIT_3_9CourseHeader
        steps={runtimeSteps}
        activeIndex={activeIndex}
        onIndexChange={(index) => {
          trackStepLeave(step.id, { nextStepId: runtimeSteps[index]?.id });
          setActiveIndex(index);
        }}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={runtimeSteps.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button
              type="button"
              onClick={() => {
                trackStepView(runtimeSteps[teacherIndex]?.id, {
                  pageType: runtimeSteps[teacherIndex]?.pageType,
                  stepIndex: teacherIndex,
                  source: 'sync-to-teacher',
                });
                setActiveIndex(teacherIndex);
              }}
              className="premium-lesson-action-tone premium-tone-amber"
            >
              跳到教师当前页
            </button>
          </div>
        ) : null}

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <UNIT_3_9StepContentPanel
          manifest={interactiveManifest}
          step={step}
          stepManifest={stepManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
        />

        <div className="mt-4">
          <UNIT_3_9StudentActivityForm
            stepManifest={stepManifest}
            step={step}
            savedResponse={savedResponse}
            released={released}
            browseEnabled={browseEnabled}
            answerVisible={answerVisible}
            revealProgress={revealProgress}
            onSubmit={handleSubmitResponse}
            onWorkspaceParameterChange={handleWorkspaceParameterChange}
          />
        </div>

        {step.id === 'step-10' ? (
          <div className="mt-4">
            <UNIT_3_9StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

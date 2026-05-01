'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { getUnit52StepAIContext } from '@/lib/unit-5-2-ai-contexts';
import {
  getUNIT_5_2PageContractFromManifest,
  UNIT_5_2_LESSON_KEY,
  UNIT_5_2_LESSON_STEPS,
  UNIT_5_2_RESOURCE_KEY,
  UNIT_5_2_SESSION_ADAPTER,
  type UNIT_5_2StudentCourseState,
  type UNIT_5_2StepResponse,
} from '@/lib/unit-5-2-course';
import { UNIT_5_2CourseHeader } from './course-header';
import {
  UNIT_5_2StepContentPanel,
  UNIT_5_2StudentActivityForm,
} from './step-panels';

export function UNIT_5_2StudentPage({
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
  const [localParameters, setLocalParameters] = useState<Record<string, Record<string, string>>>({});

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_5_2_RESOURCE_KEY,
    resourceKey: UNIT_5_2_RESOURCE_KEY,
    userId: currentUserId,
    sessionId: isDemo ? undefined : sessionId,
  });

  const {
    sessionInfo,
    courseState,
    teacherSyncState,
    activeIndex,
    loadingSession,
    error,
    errorTelemetry,
    saveCourseState,
    setActiveIndex,
  } = useStudentLessonSession({
    sessionId,
    steps: [...UNIT_5_2_LESSON_STEPS],
    adapter: UNIT_5_2_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_2_RESOURCE_KEY,
    resourceId: UNIT_5_2_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_5_2_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_2_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_5_2PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    const stepContext = getUnit52StepAIContext(step.id);
    if (stepContext) updatePageContext(stepContext);
  }, [step.id, updatePageContext]);

  const answerVisible =
    teacherSyncState?.activeStepId === step.id ? Boolean(teacherSyncState?.revealedAnswers?.[step.id]) : false;
  const releasedByDefault =
    pageContract.teacherControls.releaseActivity === 'page_load_open' ||
    pageContract.teacherControls.releaseActivity === 'not_applicable';
  const released =
    isDemo || releasedByDefault
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean(teacherSyncState?.releasedActivities?.[step.id])
        : false;
  const browseEnabled =
    isDemo ||
    pageContract.teacherControls.openBrowse === 'not_applicable' ||
    pageContract.teacherControls.openBrowse === 'page_load_open'
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean(teacherSyncState?.browseEnabled?.[step.id])
        : false;
  const revealProgress =
    teacherSyncState?.activeStepId === step.id ? teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0 : 0;
  const allowInlineReveal =
    isDemo || (browseEnabled && pageContract.teacherControls.teacherStepReveal === 'not_applicable');

  useEffect(() => {
    if (loadingSession) return;
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    return () => trackStepLeave(step.id, { nextStepIndex: activeIndex + 1 });
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: UNIT_5_2StepResponse) => {
    const submittedAt = Date.now();
    const parameters = localParameters[step.id];
    void saveCourseState((prev) => {
      const nextState: UNIT_5_2StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), step.id])),
        nonlinearParameterSnapshots: {
          ...(prev.nonlinearParameterSnapshots ?? {}),
          ...(parameters ? { [step.id]: parameters } : {}),
        },
        responses: {
          ...prev.responses,
          [step.id]: {
            ...response,
            answers: parameters ? { ...response.answers, __nonlinear_parameters: JSON.stringify(parameters) } : response.answers,
          },
        },
      };
      trackCourseEvent(
        savedResponse ? COURSE_EVENT_TYPES.LESSON_RESUBMIT : COURSE_EVENT_TYPES.LESSON_SUBMIT,
        { stepId: step.id, attemptKey: `${step.id}:response:${submittedAt}`, clientEventAt: submittedAt },
      );
      return nextState;
    });
  };

  const handleParameterChange = useCallback((stepId: string, values: Record<string, string>) => {
    setLocalParameters((prev) => ({ ...prev, [stepId]: values }));
  }, []);

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <UNIT_5_2CourseHeader
        stage={step.stage}
        currentStepLabel={`第 ${String(activeIndex + 1).padStart(2, '0')} 页 · ${step.title}`}
        sessionCode={sessionInfo?.joinCode}
        rightSlot={(
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_2_LESSON_STEPS.map((item) => item.id)}
          />
        )}
      />
      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6">
        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {UNIT_5_2_LESSON_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              disabled={!isDemo && !browseEnabled && index !== activeIndex}
              className={`rounded-md border px-3 py-1.5 text-xs ${index === activeIndex ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              第 {String(index + 1).padStart(2, '0')} 页
            </button>
          ))}
        </div>

        <UNIT_5_2StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          onParameterChange={handleParameterChange}
          responses={courseState.responses}
        />

        <UNIT_5_2StudentActivityForm
          step={step}
          manifest={runtimeManifest}
          savedResponse={savedResponse}
          released={released}
          browseEnabled={browseEnabled}
          answerVisible={answerVisible}
          revealProgress={revealProgress}
          onSubmit={handleSubmitResponse}
        />

        <div className="premium-lesson-muted mt-4 text-xs">已提交 {submittedCount} 个页面作答。</div>
      </main>
    </div>
  );
}

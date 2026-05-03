'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getUnit54StepAIContext } from '@/lib/unit-5-4-ai-contexts';
import {
  getUNIT_5_4PageContractFromManifest,
  UNIT_5_4_LESSON_KEY,
  UNIT_5_4_LESSON_STEPS,
  UNIT_5_4_RESOURCE_KEY,
  UNIT_5_4_SESSION_ADAPTER,
  type UNIT_5_4StudentCourseState,
  type UNIT_5_4StepResponse,
} from '@/lib/unit-5-4-course';
import { UNIT_5_4CourseHeader } from './course-header';
import {
  UNIT_5_4StepContentPanel,
  UNIT_5_4StudentActivityForm,
} from './step-panels';

export function UNIT_5_4StudentPage({
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
    resourceId: UNIT_5_4_RESOURCE_KEY,
    resourceKey: UNIT_5_4_RESOURCE_KEY,
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
    steps: [...UNIT_5_4_LESSON_STEPS],
    adapter: UNIT_5_4_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_4_RESOURCE_KEY,
    resourceId: UNIT_5_4_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_5_4_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_4_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_5_4PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const saveQueueRef = useRef(Promise.resolve());
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const figureSubmissionCount = useMemo(
    () => Object.values(courseState.responses).filter((response) => Boolean(response.answers.__figure_parameters)).length,
    [courseState.responses],
  );
  const postTestSubmitted = Boolean(courseState.responses['step-16']);
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    if (!isDemo || !demoStepId) return;
    const demoIndex = UNIT_5_4_LESSON_STEPS.findIndex((item) => item.id === demoStepId);
    if (demoIndex >= 0 && demoIndex !== activeIndex) {
      setActiveIndex(demoIndex);
    }
  }, [activeIndex, demoStepId, isDemo, setActiveIndex]);

  const enqueueCourseStateSave = useCallback(
    (updater: (prev: UNIT_5_4StudentCourseState) => UNIT_5_4StudentCourseState) => {
      const run = saveQueueRef.current.then(() => saveCourseState(updater));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveCourseState],
  );

  useEffect(() => {
    const stepContext = getUnit54StepAIContext(step.id);
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

  const previousStepIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingSession) return;
    const previousStepId = previousStepIdRef.current;
    if (previousStepId && previousStepId !== step.id) {
      trackStepLeave(previousStepId, { nextStepId: step.id });
    }
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    setLocalViewedStepIds((prev) => Array.from(new Set([...prev, step.id])));
    if (!isDemo) {
      void enqueueCourseStateSave((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), step.id])),
      }));
    }
    previousStepIdRef.current = step.id;
  }, [activeIndex, enqueueCourseStateSave, isDemo, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: UNIT_5_4StepResponse) => {
    const submittedAt = Date.now();
    void enqueueCourseStateSave((prev) => {
      const parameters = localParameters[step.id] ?? prev.figureParameterSnapshots?.[step.id];
      const nextState: UNIT_5_4StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        figureParameterSnapshots: {
          ...(prev.figureParameterSnapshots ?? {}),
          ...(parameters ? { [step.id]: parameters } : {}),
        },
        responses: {
          ...prev.responses,
          [step.id]: {
            ...response,
            answers: parameters ? { ...response.answers, __figure_parameters: JSON.stringify(parameters) } : response.answers,
          },
        },
      };
      trackCourseEvent(
        savedResponse ? COURSE_EVENT_TYPES.LESSON_RESUBMIT : COURSE_EVENT_TYPES.LESSON_SUBMIT,
        {
          stepId: step.id,
          attemptKey: `${step.id}:response:${submittedAt}`,
          clientEventAt: submittedAt,
          data: { stepId: step.id, parameterSubmitted: Boolean(parameters) },
        },
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
      <UNIT_5_4CourseHeader
        steps={UNIT_5_4_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => {
          setActiveIndex(index);
        }}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={(
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_4_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        )}
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

        <div className="premium-lesson-panel-soft mb-4 px-4 py-4">
          <div className="premium-lesson-kicker">学生课堂台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        <UNIT_5_4StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          onParameterChange={handleParameterChange}
          mode="student"
          submittedCount={submittedCount}
          viewedStepIds={viewedStepIds}
          figureSubmissionCount={figureSubmissionCount}
          postTestSubmitted={postTestSubmitted}
        />

        <UNIT_5_4StudentActivityForm
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import {
  findManifestStepForSubmission,
  normalizeManifestSubmissionAnswers,
  useManifestSubmissionController,
} from '@/features/interactive/shared/manifest-runtime/submission-controller';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { getCruiseStepAIContext } from '@/lib/cruise-ai-contexts';
import {
  CRUISE_LESSON_KEY,
  CRUISE_RESOURCE_KEY,
  CRUISE_SESSION_ADAPTER,
  CRUISE_STANDARD_LESSON_STEPS,
  getCruisePageContractFromManifest,
  CRUISE_COURSE_TITLE,
  CRUISE_COURSE_SUBTITLE,
  CRUISE_ROUTE_SEGMENT,
  CRUISE_STAGE_LABEL,
  type CruiseStudentCourseState,
  type CruiseStepResponse,
} from '@/lib/cruise-course';
import { CruiseStepContentPanel, CruiseStudentActivityForm } from './step-panels';

export function CruiseStandardStudentPage({
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
  const { updatePageContext } = useGlobalAI();
  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);

  const interactiveTracking = useInteractiveTracking({
    resourceId: CRUISE_RESOURCE_KEY,
    resourceKey: CRUISE_RESOURCE_KEY,
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
    steps: [...CRUISE_STANDARD_LESSON_STEPS],
    adapter: CRUISE_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: CRUISE_RESOURCE_KEY,
    resourceId: CRUISE_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: CRUISE_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = CRUISE_STANDARD_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getCruisePageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;

  const submitCurrentManifestResponse = useCallback(
    (response: CruiseStepResponse, isResubmit: boolean) => submitManifestStepResponse({
      stepId: step.id,
      isResubmit,
      response: {
        stepId: step.id,
        submittedAt: response.submittedAt,
        answers: normalizeManifestSubmissionAnswers(response.answers),
      },
      stepManifest: findManifestStepForSubmission(runtimeManifest, step.id),
    }),
    [runtimeManifest, step.id, submitManifestStepResponse],
  );

  useEffect(() => {
    if (!isDemo || !demoStepId) return;
    const demoIndex = CRUISE_STANDARD_LESSON_STEPS.findIndex((item) => item.id === demoStepId);
    if (demoIndex >= 0 && demoIndex !== activeIndex) {
      setActiveIndex(demoIndex);
    }
  }, [activeIndex, demoStepId, isDemo, setActiveIndex]);

  useEffect(() => {
    const stepContext = getCruiseStepAIContext(step.id);
    if (!stepContext) return;
    updatePageContext({
      courseId: stepContext.courseId,
      courseTitle: stepContext.courseTitle,
      pageType: stepContext.pageType,
      stepId: stepContext.stepId ?? step.id,
      topic: stepContext.topic ?? step.title,
      learningObjectives: stepContext.learningObjectives ?? [],
      knowledgeType: stepContext.knowledgeType,
      tools: stepContext.tools,
      quickQuestions: stepContext.quickQuestions,
      systemPromptExtension: stepContext.systemPromptExtension,
    });
  }, [step.id, step.title, updatePageContext]);

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
      void saveCourseState((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), step.id])),
      }));
    }
    previousStepIdRef.current = step.id;
  }, [activeIndex, isDemo, loadingSession, saveCourseState, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: CruiseStepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const submittedAt = submitCurrentManifestResponse(response, isResubmit);
      const nextState: CruiseStudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        responses: {
          ...prev.responses,
          [step.id]: {
            ...response,
            submittedAt,
            answers: normalizeManifestSubmissionAnswers(response.answers),
          },
        },
      };
      return nextState;
    });
  };

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={CRUISE_COURSE_TITLE}
        subtitle={CRUISE_COURSE_SUBTITLE}
        routeSegment={CRUISE_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={CRUISE_COURSE_TITLE}
        subtitle={CRUISE_COURSE_SUBTITLE}
        routeSegment={CRUISE_ROUTE_SEGMENT}
        steps={CRUISE_STANDARD_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={CRUISE_COURSE_TITLE}
        subtitle={CRUISE_COURSE_SUBTITLE}
        routeSegment={CRUISE_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={CRUISE_STANDARD_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={CRUISE_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={setActiveIndex}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={CRUISE_STANDARD_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${CRUISE_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? CRUISE_LESSON_KEY,
          'data-activity-submission-contract': 'manifest-runtime',
          'data-evidence-flow-target': '/profile/evidence',
        }}
      >
        <div className="space-y-4">
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
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答写入标准 manifest 证据。'}
          </div>
        </div>

        <CruiseStepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
        />

        <CruiseStudentActivityForm
          step={step}
          manifest={runtimeManifest}
          savedResponse={savedResponse}
          released={released}
          browseEnabled={browseEnabled}
          answerVisible={answerVisible}
          revealProgress={revealProgress}
          onSubmit={handleSubmitResponse}
        readOnly={isDemo}
        />

        <div className="premium-lesson-muted mt-4 text-xs">
          已浏览 {viewedStepIds.length} 个环节，已提交 {Object.keys(courseState.responses).length} 个页面作答。
        </div>
        </div>
      </LessonRuntimeShell>
  );
}

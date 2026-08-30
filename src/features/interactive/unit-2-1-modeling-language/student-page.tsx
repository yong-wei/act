'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import {
  findManifestStepForSubmission,
  normalizeManifestSubmissionAnswers,
  useManifestSubmissionController,
} from '@/features/interactive/shared/manifest-runtime/submission-controller';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import {
  getUNIT_2_1MediaSrc,
  isUNIT_2_1InteractivePageType,
  UNIT_2_1_LESSON_KEY,
  UNIT_2_1_LESSON_STEPS,
  UNIT_2_1_RESOURCE_KEY,
  UNIT_2_1_SESSION_ADAPTER,
  UNIT_2_1_COURSE_TITLE,
  UNIT_2_1_COURSE_SUBTITLE,
  UNIT_2_1_ROUTE_SEGMENT,
  UNIT_2_1_STAGE_LABEL,
  type UNIT_2_1StudentCourseState,
  type UNIT_2_1StepResponse,
} from '@/lib/unit-2-1-course';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { getUnit21StepAIContext } from '@/lib/course-ai-contexts';
import {
  UNIT_2_1KnowledgeMapVisual,
  UNIT_2_1StepAiAssistant,
  UNIT_2_1StepContentPanel,
  UNIT_2_1StudentActivityForm,
  UNIT_2_1StudentSummaryPanel,
} from './step-panels';
import { commitUNIT_2_1StudentSubmission } from './submission-state';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_2_1StudentPage({
  sessionId,
  lessonRuntime,
  demoStepId,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
  demoStepId?: string;
}) {
  const isDemo = sessionId === 'demo';
  const { data: authSession } = useSession();

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_2_1_RESOURCE_KEY,
    resourceKey: UNIT_2_1_RESOURCE_KEY,
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
    steps: UNIT_2_1_LESSON_STEPS,
    adapter: UNIT_2_1_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } = useCourseEventTracking({
    resourceKey: UNIT_2_1_RESOURCE_KEY,
    resourceId: UNIT_2_1_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_2_1_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_2_1_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const submitCurrentManifestResponse = useCallback(
    (input: {
      response: { stepId: string; submittedAt: number; answers: Record<string, unknown> };
      isResubmit: boolean;
      dataOverrides?: Record<string, unknown>;
    }) => submitManifestStepResponse({
      stepId: step.id,
      isResubmit: input.isResubmit,
      response: {
        stepId: step.id,
        submittedAt: input.response.submittedAt,
        answers: normalizeManifestSubmissionAnswers(input.response.answers),
      },
      stepManifest: findManifestStepForSubmission(runtimeManifest, step.id),
      dataOverrides: input.dataOverrides,
    }),
    [runtimeManifest, step.id, submitManifestStepResponse],
  );
  const savedResponse = courseState.responses[step.id];
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    const stepContext = getUnit21StepAIContext(step.id);
    if (stepContext) {
      updatePageContext({
        courseId: stepContext.courseId,
        courseTitle: stepContext.courseTitle,
        pageType: stepContext.pageType,
        stepId: stepContext.stepId,
        topic: stepContext.topic,
        learningObjectives: stepContext.learningObjectives,
        knowledgeType: stepContext.knowledgeType,
        tools: stepContext.tools,
        quickQuestions: stepContext.quickQuestions,
        systemPromptExtension: stepContext.systemPromptExtension,
      });
    }
  }, [step.id, updatePageContext]);

  const answerVisible =
    teacherSyncState?.activeStepId === step.id
      ? Boolean((teacherSyncState as { revealedAnswers?: Record<string, boolean> })?.revealedAnswers?.[step.id])
      : false;
  const released =
    isDemo || !isUNIT_2_1InteractivePageType(step.pageType)
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean((teacherSyncState as { releasedActivities?: Record<string, boolean> })?.releasedActivities?.[step.id])
        : false;

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

  const handleSubmitResponse = (response: UNIT_2_1StepResponse) => {
    void saveCourseState((prev) => {
      return commitUNIT_2_1StudentSubmission({
        previousState: prev,
        currentStudentName,
        stepId: step.id,
        response,
        savedResponse,
        submitManifestResponse: submitCurrentManifestResponse,
      });
    });
  };

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
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_2_1_COURSE_TITLE}
        subtitle={UNIT_2_1_COURSE_SUBTITLE}
        routeSegment={UNIT_2_1_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_2_1_COURSE_TITLE}
        subtitle={UNIT_2_1_COURSE_SUBTITLE}
        routeSegment={UNIT_2_1_ROUTE_SEGMENT}
        steps={UNIT_2_1_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_2_1_COURSE_TITLE}
        subtitle={UNIT_2_1_COURSE_SUBTITLE}
        routeSegment={UNIT_2_1_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_2_1_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_2_1_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={(index) => {
          trackStepLeave(step.id, { nextStepId: UNIT_2_1_LESSON_STEPS[index]?.id });
          setActiveIndex(index);
        }}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_2_1_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_2_1_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_2_1_LESSON_KEY,
          'data-activity-submission-contract': 'manifest-runtime',
          'data-evidence-flow-target': '/profile/evidence',
        }}
      >
        <div className="space-y-4">
          {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button
              type="button"
              onClick={() => {
                trackStepView(UNIT_2_1_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_2_1_LESSON_STEPS[teacherIndex]?.pageType,
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

        <div className="premium-lesson-panel-soft mb-4 px-4 py-4">
          <div className="premium-lesson-kicker">Student Console</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        {step.id === 'step-01' ? <UNIT_2_1KnowledgeMapVisual /> : null}

        <UNIT_2_1StepContentPanel
          step={step}
          mediaSrc={getUNIT_2_1MediaSrc(step.id)}
          mediaAlt={step.title}
          onWorkspaceParameterChange={handleWorkspaceParameterChange}
        />

        {step.id === 'step-07' ? (
          <div className="mt-4">
            <UNIT_2_1StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <UNIT_2_1StudentActivityForm
            key={`${step.id}:${savedResponse?.submittedAt ?? 0}`}
            step={step}
            savedResponse={savedResponse}
            released={released}
            answerVisible={answerVisible}
            onSubmit={handleSubmitResponse}
          readOnly={isDemo}
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <UNIT_2_1StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
        </div>
      </LessonRuntimeShell>
  );
}

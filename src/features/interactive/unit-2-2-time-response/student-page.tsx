'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import {
  getUNIT_2_2MediaSrc,
  isUNIT_2_2AiPageType,
  isUNIT_2_2InteractivePageType,
  UNIT_2_2_LESSON_STEPS,
  UNIT_2_2_SESSION_ADAPTER,
  UNIT_2_2_RESOURCE_KEY,
  UNIT_2_2_LESSON_KEY,
  UNIT_2_2_COURSE_TITLE,
  UNIT_2_2_COURSE_SUBTITLE,
  UNIT_2_2_ROUTE_SEGMENT,
  UNIT_2_2_STAGE_LABEL,
  type UNIT_2_2StudentCourseState,
  type UNIT_2_2StepResponse,
} from '@/lib/unit-2-2-course';
import {
  UNIT_2_2KnowledgeMapVisual,
  UNIT_2_2StepAiAssistant,
  UNIT_2_2StepContentPanel,
  UNIT_2_2StudentActivityForm,
  UNIT_2_2StudentSummaryPanel,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { getUnit22StepAIContext } from '@/lib/course-ai-contexts';

export function UNIT_2_2StudentPage({
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

  // Unified tracking setup
  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_2_2_RESOURCE_KEY,
    resourceKey: UNIT_2_2_RESOURCE_KEY,
    userId: currentUserId,
    sessionId: isDemo ? undefined : sessionId,
  });

  // Unified student session hook
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
    steps: UNIT_2_2_LESSON_STEPS,
    adapter: UNIT_2_2_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  // Course event tracking
  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } = useCourseEventTracking({
    resourceKey: UNIT_2_2_RESOURCE_KEY,
    resourceId: UNIT_2_2_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_2_2_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_2_2_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const savedResponse = courseState.responses[step.id];

  // AI助手已通过全局框架集成，获取更新上下文的方法
  const { updatePageContext } = useGlobalAI();

  // 当步骤变化时，更新AI上下文
  useEffect(() => {
    const stepContext = getUnit22StepAIContext(step.id);
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
    isDemo || !isUNIT_2_2InteractivePageType(step.pageType)
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean((teacherSyncState as { releasedActivities?: Record<string, boolean> })?.releasedActivities?.[step.id])
        : false;

  // Step view/leave tracking
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
    trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: UNIT_2_2StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_2_2StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        responses: {
          ...prev.responses,
          [step.id]: response,
        },
      };
      submitManifestStepResponse({
        stepId: step.id,
        isResubmit,
        response: {
          stepId: step.id,
          submittedAt: response.submittedAt,
          answers: normalizeManifestSubmissionAnswers(response.answers),
        },
        stepManifest: findManifestStepForSubmission(runtimeManifest, step.id),
        dataOverrides: { stepId: step.id },
      });
      return nextState;
    });
  };

  // Handle AI events
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
        title={UNIT_2_2_COURSE_TITLE}
        subtitle={UNIT_2_2_COURSE_SUBTITLE}
        routeSegment={UNIT_2_2_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_2_2_COURSE_TITLE}
        subtitle={UNIT_2_2_COURSE_SUBTITLE}
        routeSegment={UNIT_2_2_ROUTE_SEGMENT}
        steps={UNIT_2_2_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_2_2_COURSE_TITLE}
        subtitle={UNIT_2_2_COURSE_SUBTITLE}
        routeSegment={UNIT_2_2_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_2_2_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_2_2_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={(index) => {
          // Student can navigate freely but we track it
          trackStepLeave(step.id, { nextStepId: UNIT_2_2_LESSON_STEPS[index]?.id });
          // Actually update the active index to navigate to the selected step
          setActiveIndex(index);
        }}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_2_2_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_2_2_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_2_2_LESSON_KEY,
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
                trackStepView(UNIT_2_2_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_2_2_LESSON_STEPS[teacherIndex]?.pageType,
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

        {step.id === 'step-01' ? <UNIT_2_2KnowledgeMapVisual /> : null}

        <UNIT_2_2StepContentPanel
          step={step}
          mediaSrc={getUNIT_2_2MediaSrc(step.id)}
          mediaAlt={step.title}
          onWorkspaceParameterChange={handleWorkspaceParameterChange}
        />

        {isUNIT_2_2AiPageType(step.pageType) ? (
          <div className="mt-4">
            <UNIT_2_2StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <UNIT_2_2StudentActivityForm
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
            <UNIT_2_2StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
        </div>
      </LessonRuntimeShell>
  );
}

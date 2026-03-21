'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import {
  getUNIT_1_2MediaSrc,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_SESSION_ADAPTER,
  UNIT_1_2_RESOURCE_KEY,
  UNIT_1_2_LESSON_KEY,
  type UNIT_1_2StudentCourseState,
  type UNIT_1_2StepResponse,
} from '@/lib/unit-1-2-course';
import { UNIT_1_2CourseHeader } from './course-header';
import {
  UNIT_1_2KnowledgeMapVisual,
  UNIT_1_2StepAiAssistant,
  UNIT_1_2StepContentPanel,
  UNIT_1_2StudentActivityForm,
  UNIT_1_2StudentSummaryPanel,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { getUnit12StepAIContext } from '@/lib/course-ai-contexts';

export function UNIT_1_2StudentPage({
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
    resourceId: UNIT_1_2_RESOURCE_KEY,
    resourceKey: UNIT_1_2_RESOURCE_KEY,
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
    isOutOfSync,
    saveCourseState,
    setActiveIndex,
  } = useStudentLessonSession({
    sessionId,
    steps: UNIT_1_2_LESSON_STEPS,
    adapter: UNIT_1_2_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  // Course event tracking
  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } = useCourseEventTracking({
    resourceKey: UNIT_1_2_RESOURCE_KEY,
    resourceId: UNIT_1_2_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_1_2_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_1_2_LESSON_STEPS[activeIndex];
  const savedResponse = courseState.responses[step.id];

  // AI助手已通过全局框架集成，获取更新上下文的方法
  const { updatePageContext } = useGlobalAI();

  // 当步骤变化时，更新AI上下文
  useEffect(() => {
    const stepContext = getUnit12StepAIContext(step.id);
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
    isDemo || step.pageType !== 'quiz'
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
    trackSyncError(step.id, { message: error, scope: 'student-page' });
  }, [error, step.id, trackSyncError]);

  // Track submission helper
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

  const handleSubmitResponse = (response: UNIT_1_2StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_1_2StudentCourseState = {
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
      <UNIT_1_2CourseHeader
        steps={UNIT_1_2_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => {
          // Student can navigate freely but we track it
          trackStepLeave(step.id, { nextStepId: UNIT_1_2_LESSON_STEPS[index]?.id });
          // Actually update the active index to navigate to the selected step
          setActiveIndex(index);
        }}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_1_2_LESSON_STEPS.map((item) => item.id)}
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
                trackStepView(UNIT_1_2_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_1_2_LESSON_STEPS[teacherIndex]?.pageType,
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

        {step.id === 'step-01' ? <UNIT_1_2KnowledgeMapVisual /> : null}

        <UNIT_1_2StepContentPanel
          step={step}
          mediaSrc={getUNIT_1_2MediaSrc(step.id)}
          mediaAlt={step.title}
          onWorkspaceParameterChange={handleWorkspaceParameterChange}
        />

        {step.pageType === 'ai' ? (
          <div className="mt-4">
            <UNIT_1_2StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <UNIT_1_2StudentActivityForm
            step={step}
            savedResponse={savedResponse}
            released={released}
            answerVisible={answerVisible}
            onSubmit={handleSubmitResponse}
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <UNIT_1_2StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

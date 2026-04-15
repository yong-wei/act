'use client';

import { useCallback, useEffect, useRef } from 'react';
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
import { getUnit36StepAIContext } from '@/lib/course-ai-contexts';
import {
  getUNIT_3_6MediaSrc,
  isUNIT_3_6InteractivePageType,
  UNIT_3_6_LESSON_KEY,
  UNIT_3_6_LESSON_STEPS,
  UNIT_3_6_RESOURCE_KEY,
  UNIT_3_6_SESSION_ADAPTER,
  type UNIT_3_6StudentCourseState,
  type UNIT_3_6StepResponse,
} from '@/lib/unit-3-6-course';
import { UNIT_3_6CourseHeader } from './course-header';
import {
  UNIT_3_6KnowledgeMapVisual,
  UNIT_3_6StepContentPanel,
  UNIT_3_6StudentActivityForm,
  UNIT_3_6StudentSummaryPanel,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_3_6StudentPage({
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

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_3_6_RESOURCE_KEY,
    resourceKey: UNIT_3_6_RESOURCE_KEY,
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
    isOutOfSync,
    saveCourseState,
    setActiveIndex,
  } = useStudentLessonSession({
    sessionId,
    steps: UNIT_3_6_LESSON_STEPS,
    adapter: UNIT_3_6_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } =
    useCourseEventTracking({
      resourceKey: UNIT_3_6_RESOURCE_KEY,
      resourceId: UNIT_3_6_RESOURCE_KEY,
      sessionId: isDemo ? null : sessionId,
      lessonKey: UNIT_3_6_LESSON_KEY,
      actorRole: 'student',
      emit: interactiveTracking.emit,
    });

  const step = UNIT_3_6_LESSON_STEPS[activeIndex];
  const savedResponse = courseState.responses[step.id];
  const { updatePageContext } = useGlobalAI();
  const isStep06 = step.id === 'step-06';

  useEffect(() => {
    const stepContext = getUnit36StepAIContext(step.id);
    if (stepContext) {
      const assistantLocked = step.id === 'step-04' && !savedResponse;
      const quickQuestions = assistantLocked
        ? [
            { label: '先独立作答', question: '请先提醒我独立完成三题前测和一句理由，暂时不要给答案。' },
            { label: '只做错因定位', question: '提交前只允许帮我识别入口混淆，不允许直接代答。' },
          ]
        : stepContext.quickQuestions;
      const systemPromptExtension = assistantLocked
        ? `${stepContext.systemPromptExtension}\n当前处于前测未提交阶段。你只能提醒学生先独立完成三题与理由，禁止直接给出前测答案或替学生判断。`
        : stepContext.systemPromptExtension;
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
        ...(assistantLocked
          ? {
              quickQuestions,
              systemPromptExtension,
            }
          : {}),
      });
    }
  }, [savedResponse, step.id, updatePageContext]);

  const answerVisible =
    teacherSyncState?.activeStepId === step.id
      ? Boolean((teacherSyncState as { revealedAnswers?: Record<string, boolean> })?.revealedAnswers?.[step.id])
      : false;
  const released =
    isDemo || !isUNIT_3_6InteractivePageType(step.pageType)
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
    trackSyncError(step.id, { message: error, scope: 'student-page' });
  }, [error, step.id, trackSyncError]);

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

  const handleSubmitResponse = (response: UNIT_3_6StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_3_6StudentCourseState = {
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
      <UNIT_3_6CourseHeader
        steps={UNIT_3_6_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => {
          trackStepLeave(step.id, { nextStepId: UNIT_3_6_LESSON_STEPS[index]?.id });
          setActiveIndex(index);
        }}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_3_6_LESSON_STEPS.map((item) => item.id)}
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
                trackStepView(UNIT_3_6_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_3_6_LESSON_STEPS[teacherIndex]?.pageType,
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
          <div className="premium-lesson-kicker">学生课堂台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        {step.id === 'step-01' ? <UNIT_3_6KnowledgeMapVisual /> : null}

        {isStep06 ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
            <UNIT_3_6StepContentPanel
              step={step}
              mediaSrc={getUNIT_3_6MediaSrc(step.id)}
              mediaAlt={step.title}
              onWorkspaceParameterChange={handleWorkspaceParameterChange}
            />
            <UNIT_3_6StudentActivityForm
              step={step}
              savedResponse={savedResponse}
              released={released}
              answerVisible={answerVisible}
              onSubmit={handleSubmitResponse}
              onWorkspaceParameterChange={handleWorkspaceParameterChange}
            />
          </div>
        ) : (
          <>
            <UNIT_3_6StepContentPanel
              step={step}
              mediaSrc={getUNIT_3_6MediaSrc(step.id)}
              mediaAlt={step.title}
              onWorkspaceParameterChange={handleWorkspaceParameterChange}
            />

            {step.pageType !== 'display' ? (
              <div className="mt-4">
                <UNIT_3_6StudentActivityForm
                  step={step}
                  savedResponse={savedResponse}
                  released={released}
                  answerVisible={answerVisible}
                  onSubmit={handleSubmitResponse}
                  onWorkspaceParameterChange={handleWorkspaceParameterChange}
                />
              </div>
            ) : null}
          </>
        )}

        {step.id === 'step-13' ? (
          <div className="mt-4">
            <UNIT_3_6StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

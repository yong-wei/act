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
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { getUnit43StepAIContext } from '@/lib/course-ai-contexts';
import {
  buildUNIT_4_3RuntimeSteps,
  getUNIT_4_3StepManifest,
  isUNIT_4_3AiPageType,
  isUNIT_4_3InteractivePageType,
  UNIT_4_3_LESSON_KEY,
  UNIT_4_3_RESOURCE_KEY,
  UNIT_4_3_SESSION_ADAPTER,
  UNIT_4_3_COURSE_TITLE,
  UNIT_4_3_COURSE_SUBTITLE,
  UNIT_4_3_ROUTE_SEGMENT,
  UNIT_4_3_STAGE_LABEL,
  type UNIT_4_3StudentCourseState,
  type UNIT_4_3StepResponse,
} from '@/lib/unit-4-3-course';
import {
  UNIT_4_3StepAiAssistant,
  UNIT_4_3StepContentPanel,
  UNIT_4_3StudentActivityForm,
  UNIT_4_3StudentSummaryPanel,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_4_3StudentPage({
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
    throw new Error('4-3 runtime manifest is missing');
  }
  const runtimeSteps = buildUNIT_4_3RuntimeSteps(interactiveManifest);

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_4_3_RESOURCE_KEY,
    resourceKey: UNIT_4_3_RESOURCE_KEY,
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
    adapter: UNIT_4_3_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } =
    useCourseEventTracking({
      resourceKey: UNIT_4_3_RESOURCE_KEY,
      resourceId: UNIT_4_3_RESOURCE_KEY,
      sessionId: isDemo ? null : sessionId,
      lessonKey: UNIT_4_3_LESSON_KEY,
      actorRole: 'student',
      emit: interactiveTracking.emit,
    });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = runtimeSteps[activeIndex];
  const runtimeManifest = interactiveManifest;
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
  const stepManifest = getUNIT_4_3StepManifest(interactiveManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const { updatePageContext } = useGlobalAI();
  const [workspaceParametersByStep, setWorkspaceParametersByStep] = useState<Record<string, Record<string, string | number | boolean>>>({});

  useEffect(() => {
    const stepContext = getUnit43StepAIContext(step.id);
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

  const answerVisible = teacherSyncState?.activeStepId === step.id ? Boolean(teacherSyncState?.revealedAnswers?.[step.id]) : false;
  const released =
    isDemo ||
    !isUNIT_4_3InteractivePageType(step.pageType) ||
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

  const handleSubmitResponse = (response: UNIT_4_3StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_4_3StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        responses: {
          ...prev.responses,
          [step.id]: response,
        },
      };
      submitCurrentManifestResponse({ response, isResubmit, dataOverrides: { stepId: step.id } });
      return nextState;
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
      setWorkspaceParametersByStep((current) => ({
        ...current,
        [step.id]: {
          ...(current[step.id] ?? {}),
          [change.key]: change.value,
        },
      }));
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
        title={UNIT_4_3_COURSE_TITLE}
        subtitle={UNIT_4_3_COURSE_SUBTITLE}
        routeSegment={UNIT_4_3_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_4_3_COURSE_TITLE}
        subtitle={UNIT_4_3_COURSE_SUBTITLE}
        routeSegment={UNIT_4_3_ROUTE_SEGMENT}
        steps={runtimeSteps}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_4_3_COURSE_TITLE}
        subtitle={UNIT_4_3_COURSE_SUBTITLE}
        routeSegment={UNIT_4_3_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={runtimeSteps}
        activeIndex={activeIndex}
        stageLabel={UNIT_4_3_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={(index) => {
          trackStepLeave(step.id, { nextStepId: runtimeSteps[index]?.id });
          setActiveIndex(index);
        }}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={runtimeSteps.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_4_3_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_4_3_LESSON_KEY,
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

        <div className="premium-lesson-panel-soft mb-4 px-4 py-4">
          <div className="premium-lesson-kicker">学生课堂台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        <UNIT_4_3StepContentPanel
          manifest={interactiveManifest}
          step={step}
          stepManifest={stepManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          onWorkspaceParameterChange={handleWorkspaceParameterChange}
        />

        {isUNIT_4_3AiPageType(step.pageType) ? (
          <div className="mt-4">
            <UNIT_4_3StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : null}

        <div className="mt-4">
          <UNIT_4_3StudentActivityForm
            stepManifest={stepManifest}
            step={step}
            savedResponse={savedResponse}
            released={released}
            browseEnabled={browseEnabled}
            answerVisible={answerVisible}
            revealProgress={revealProgress}
            workspaceParameters={workspaceParametersByStep[step.id]}
            onSubmit={handleSubmitResponse}
            onWorkspaceParameterChange={handleWorkspaceParameterChange}
            readOnly={isDemo}
          />
        </div>

        {step.id === 'step-19' ? (
          <div className="mt-4">
            <UNIT_4_3StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
        </div>
      </LessonRuntimeShell>
  );
}

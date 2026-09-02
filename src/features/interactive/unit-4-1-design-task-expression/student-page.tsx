'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getUnit41StepAIContext } from '@/lib/course-ai-contexts';
import { buildUNIT41SubmissionTelemetry } from '@/lib/data-governance/unit-4-1-submission-telemetry';
import {
  getUNIT_4_1PageContractFromManifest,
  isUNIT_4_1AiPageType,
  isUNIT_4_1InteractivePageType,
  UNIT_4_1_COURSE_SUBTITLE,
  UNIT_4_1_COURSE_TITLE,
  UNIT_4_1_LESSON_KEY,
  UNIT_4_1_LESSON_STEPS,
  UNIT_4_1_RESOURCE_KEY,
  UNIT_4_1_ROUTE_SEGMENT,
  UNIT_4_1_SESSION_ADAPTER,
  UNIT_4_1_STAGE_LABEL,
  type UNIT_4_1StudentCourseState,
  type UNIT_4_1StepResponse,
} from '@/lib/unit-4-1-course';
import {
  UNIT_4_1StepAiAssistant,
  UNIT_4_1StepContentPanel,
  UNIT_4_1StudentActivityForm,
} from './step-panels';
import type { WorkspaceParameterChange } from './workspace';

export function UNIT_4_1StudentPage({
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
    resourceId: UNIT_4_1_RESOURCE_KEY,
    resourceKey: UNIT_4_1_RESOURCE_KEY,
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
    steps: UNIT_4_1_LESSON_STEPS,
    adapter: UNIT_4_1_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError, trackWorkspaceParamChange } =
    useCourseEventTracking({
      resourceKey: UNIT_4_1_RESOURCE_KEY,
      resourceId: UNIT_4_1_RESOURCE_KEY,
      sessionId: isDemo ? null : sessionId,
      lessonKey: UNIT_4_1_LESSON_KEY,
      actorRole: 'student',
      emit: interactiveTracking.emit,
    });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_4_1_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const runtimeManifestTruth = runtimeManifest?.lessonId ?? UNIT_4_1_LESSON_KEY;
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
  const pageContract = getUNIT_4_1PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const [localControlParameters, setLocalControlParameters] = useState<Record<string, Record<string, string>>>({});
  const saveQueueRef = useRef(Promise.resolve());
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const parameterSubmissionCount = useMemo(
    () => Object.values(courseState.responses).filter((response) => Boolean(response.answers.__control_parameters)).length,
    [courseState.responses],
  );
  const { updatePageContext } = useGlobalAI();

  const enqueueCourseStateSave = useCallback(
    (updater: (prev: UNIT_4_1StudentCourseState) => UNIT_4_1StudentCourseState) => {
      const run = saveQueueRef.current.then(() => saveCourseState(updater));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveCourseState],
  );

  useEffect(() => {
    const stepContext = getUnit41StepAIContext(step.id);
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
  const releasedByDefault =
    pageContract.teacherControls?.releaseActivity === 'page_load_open' ||
    pageContract.teacherControls?.releaseActivity === 'not_applicable' ||
    !isUNIT_4_1InteractivePageType(step.pageType);
  const released =
    isDemo || releasedByDefault
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean((teacherSyncState as { releasedActivities?: Record<string, boolean> })?.releasedActivities?.[step.id])
        : false;
  const browseEnabled =
    isDemo ||
    pageContract.teacherControls?.openBrowse === 'not_applicable' ||
    pageContract.teacherControls?.openBrowse === 'page_load_open'
      ? true
      : teacherSyncState?.activeStepId === step.id
        ? Boolean(teacherSyncState?.browseEnabled?.[step.id])
        : false;
  const revealProgress =
    teacherSyncState?.activeStepId === step.id ? teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0 : 0;
  const allowInlineReveal =
    isDemo || (browseEnabled && pageContract.teacherControls?.teacherStepReveal === 'not_applicable');

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
    if (!error) return;
    trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: UNIT_4_1StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void enqueueCourseStateSave((prev) => {
      const parameters = localControlParameters[step.id] ?? prev.controlParameterSnapshots?.[step.id];
      const nextState: UNIT_4_1StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        controlParameterSnapshots: {
          ...(prev.controlParameterSnapshots ?? {}),
          ...(parameters ? { [step.id]: parameters } : {}),
        },
        responses: {
          ...prev.responses,
          [step.id]: {
            ...response,
            answers: parameters ? { ...response.answers, __control_parameters: JSON.stringify(parameters) } : response.answers,
          },
        },
      };
      submitCurrentManifestResponse({
        response: nextState.responses[step.id],
        isResubmit,
        dataOverrides: {
          stepId: step.id,
          parameterSubmitted: Boolean(parameters),
          ...buildUNIT41SubmissionTelemetry(nextState.responses[step.id]),
        },
      });
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
      setLocalControlParameters((prev) => ({
        ...prev,
        [step.id]: {
          ...(prev[step.id] ?? {}),
          [change.key]: String(change.value),
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
        title={UNIT_4_1_COURSE_TITLE}
        subtitle={UNIT_4_1_COURSE_SUBTITLE}
        routeSegment={UNIT_4_1_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_4_1_COURSE_TITLE}
        subtitle={UNIT_4_1_COURSE_SUBTITLE}
        routeSegment={UNIT_4_1_ROUTE_SEGMENT}
        steps={UNIT_4_1_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
      mode={isDemo ? 'guest' : 'student'}
      title={UNIT_4_1_COURSE_TITLE}
      subtitle={UNIT_4_1_COURSE_SUBTITLE}
      routeSegment={UNIT_4_1_ROUTE_SEGMENT}
      sessionId={sessionId}
      steps={UNIT_4_1_LESSON_STEPS}
      activeIndex={activeIndex}
      stageLabel={UNIT_4_1_STAGE_LABEL}
      notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
      onIndexChange={(index) => {
        trackStepLeave(step.id, { nextStepId: UNIT_4_1_LESSON_STEPS[index]?.id });
        setActiveIndex(index);
      }}
      localTools={
        <StepKnowledgeDrawer
          lessonRuntime={lessonRuntime}
          currentStepId={step.id}
          orderedStepIds={UNIT_4_1_LESSON_STEPS.map((item) => item.id)}
          title="页面知识卡片"
          inlineTool
        />
      }
      runtimeAttributes={{
        'data-launch-provenance': 'course-launched',
        'data-return-target': `/interactive-learning/courses/${UNIT_4_1_ROUTE_SEGMENT}`,
        'data-runtime-manifest-truth': runtimeManifestTruth,
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
                trackStepView(UNIT_4_1_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_4_1_LESSON_STEPS[teacherIndex]?.pageType,
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

        <div className="premium-lesson-panel-soft mb-4 px-4 py-4" data-commercial-workspace-zone="context-strip">
          <div className="premium-lesson-kicker">学生课堂台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        <div data-commercial-workspace-zone="instrument-area">
          <UNIT_4_1StepContentPanel
            step={step}
            manifest={runtimeManifest}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
            viewerRole="student"
            submittedCount={submittedCount}
            viewedCount={viewedStepIds.length}
            postTestCompletion={courseState.responses['step-12'] ? 100 : 0}
            parameterSubmissionCount={parameterSubmissionCount}
            onWorkspaceParameterChange={handleWorkspaceParameterChange}
          />
        </div>

        {isUNIT_4_1AiPageType(step.pageType) ? (
          <div className="mt-4" data-commercial-workspace-zone="support-drawer">
            <UNIT_4_1StepAiAssistant step={step} onAiEvent={handleAiEvent} />
          </div>
        ) : (
          <div className="sr-only" data-commercial-workspace-zone="support-drawer">
            页面知识卡片、课堂同步和步骤提示由课程运行态提供。
          </div>
        )}

        <section
          className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm"
          data-commercial-workspace-zone="evidence-rail"
          data-evidence-flow-state={isDemo ? 'preview-unavailable' : 'classroom-record'}
        >
          {isDemo
            ? '演示模式会展示作答流程，但不会写入学习证据。'
            : '提交后将先写入本课堂学习记录；可纳入画像的证据会在学习档案中呈现。'}
        </section>

        <div className="mt-4" data-task-workspace-zone="floating-dock-safe-area">
          <UNIT_4_1StudentActivityForm
            step={step}
            manifest={runtimeManifest}
            savedResponse={savedResponse}
            released={released}
            browseEnabled={browseEnabled}
            answerVisible={answerVisible}
            revealProgress={revealProgress}
            readOnly={isDemo}
            onSubmit={handleSubmitResponse}
          />
        </div>
      </div>
    </LessonRuntimeShell>
  );
}

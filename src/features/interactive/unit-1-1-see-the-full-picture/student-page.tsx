'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
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
  buildCoursePackageLayeredScope,
  resolveCoursePageLayeredDrawerEntries,
  type LayeredGraphPayload,
} from '@/lib/layered-graph/client';
import {
  isUNIT_1_1InteractivePageType,
  UNIT_1_1_COURSE_SUBTITLE,
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_SESSION_ADAPTER,
  UNIT_1_1_RESOURCE_KEY,
  UNIT_1_1_LESSON_KEY,
  UNIT_1_1_ROUTE_SEGMENT,
  UNIT_1_1_STAGE_LABEL,
  type UNIT_1_1StudentCourseState,
  type UNIT_1_1StepResponse,
} from '@/lib/unit-1-1-course';
import {
  UNIT_1_1KnowledgeMapVisual,
  UNIT_1_1StepContentPanel,
  UNIT_1_1StudentActivityForm,
  UNIT_1_1StudentSummaryPanel,
} from './step-panels';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { getStepAIContext } from '@/lib/course-ai-contexts';

export function UNIT_1_1StudentPage({
  sessionId,
  lessonRuntime,
  demoStepId,
  layeredGraphPayload,
  layeredResourceLaunchTargets,
  layeredResourceRegistryIds,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
  demoStepId?: string;
  /** Server-resolved Teaching Projection layered payload (active/candidate/pin). */
  layeredGraphPayload: LayeredGraphPayload;
  layeredResourceLaunchTargets?: Record<string, string | null>;
  layeredResourceRegistryIds?: Record<string, string>;
}) {
  const isDemo = sessionId === 'demo';
  const { data: authSession } = useSession();

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  // Unified tracking setup
  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_1_1_RESOURCE_KEY,
    resourceKey: UNIT_1_1_RESOURCE_KEY,
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
    steps: UNIT_1_1_LESSON_STEPS,
    adapter: UNIT_1_1_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  // Course event tracking
  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_1_1_RESOURCE_KEY,
    resourceId: UNIT_1_1_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_1_1_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_1_1_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const savedResponse = courseState.responses[step.id];
  const orderedStepIds = useMemo(
    () => UNIT_1_1_LESSON_STEPS.map((item) => item.id),
    [],
  );
  // Layered Teaching Projection drawer path (#1273 / PR #1286):
  // server resolves active/candidate payload; client scopes step.knowledgeRefs
  // → canonicalId → optional card (not the empty lesson-runtime Legacy adapter).
  const layeredDrawerEntries = useMemo(
    () =>
      resolveCoursePageLayeredDrawerEntries({
        lessonRuntime,
        currentStepId: step.id,
        orderedStepIds,
        scope: {
          ...buildCoursePackageLayeredScope({
            packageCanonicalId: '1-1',
            lessonKey: '1-1',
            stepId: step.id,
          }),
        },
        payload: layeredGraphPayload,
        resourceLaunchTargets: layeredResourceLaunchTargets,
        resourceRegistryIds: layeredResourceRegistryIds,
      }),
    [
      layeredGraphPayload,
      layeredResourceLaunchTargets,
      layeredResourceRegistryIds,
      lessonRuntime,
      orderedStepIds,
      step.id,
    ],
  );

  // Global AI context update
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    const stepContext = getStepAIContext(UNIT_1_1_LESSON_KEY, step.id);
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
    isDemo || !isUNIT_1_1InteractivePageType(step.pageType)
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

  const handleSubmitResponse = (response: UNIT_1_1StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const nextState: UNIT_1_1StudentCourseState = {
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

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_1_1_COURSE_TITLE}
        subtitle={UNIT_1_1_COURSE_SUBTITLE}
        routeSegment={UNIT_1_1_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_1_1_COURSE_TITLE}
        subtitle={UNIT_1_1_COURSE_SUBTITLE}
        routeSegment={UNIT_1_1_ROUTE_SEGMENT}
        steps={UNIT_1_1_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
      mode={isDemo ? 'guest' : 'student'}
      title={UNIT_1_1_COURSE_TITLE}
      subtitle={UNIT_1_1_COURSE_SUBTITLE}
      routeSegment={UNIT_1_1_ROUTE_SEGMENT}
      sessionId={sessionId}
      steps={UNIT_1_1_LESSON_STEPS}
      activeIndex={activeIndex}
      stageLabel={UNIT_1_1_STAGE_LABEL}
      notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
      onIndexChange={(index) => {
        trackStepLeave(step.id, { nextStepId: UNIT_1_1_LESSON_STEPS[index]?.id });
        setActiveIndex(index);
      }}
      localTools={
        <StepKnowledgeDrawer
          lessonRuntime={lessonRuntime}
          currentStepId={step.id}
          orderedStepIds={orderedStepIds}
          title="页面知识卡片"
          inlineTool
          layeredDrawerEntries={layeredDrawerEntries}
        />
      }
      runtimeAttributes={{
        'data-launch-provenance': 'course-launched',
        'data-return-target': `/interactive-learning/courses/${UNIT_1_1_ROUTE_SEGMENT}`,
        'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_1_1_LESSON_KEY,
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
                trackStepView(UNIT_1_1_LESSON_STEPS[teacherIndex]?.id, {
                  pageType: UNIT_1_1_LESSON_STEPS[teacherIndex]?.pageType,
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
          <div className="premium-lesson-kicker">学生学习台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        {step.id === 'step-01' ? <UNIT_1_1KnowledgeMapVisual /> : null}

        <UNIT_1_1StepContentPanel
          step={step}
          manifest={runtimeManifest}
        />

        <div className="mt-4">
          <UNIT_1_1StudentActivityForm
            step={step}
            savedResponse={savedResponse}
            released={released}
            answerVisible={answerVisible}
            readOnly={isDemo}
            onSubmit={handleSubmitResponse}
          />
        </div>

        {step.id === 'step-15' ? (
          <div className="mt-4">
            <UNIT_1_1StudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
      </div>
    </LessonRuntimeShell>
  );
}

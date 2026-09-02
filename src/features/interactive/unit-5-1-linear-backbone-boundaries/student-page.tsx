'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useManifestSubmissionController } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { getUnit51StepAIContext } from '@/lib/unit-5-1-ai-contexts';
import {
  getUNIT_5_1ManifestStepFromManifest,
  getUNIT_5_1PageContractFromManifest,
  UNIT_5_1_LESSON_KEY,
  UNIT_5_1_LESSON_STEPS,
  UNIT_5_1_RESOURCE_KEY,
  UNIT_5_1_SESSION_ADAPTER,
  UNIT_5_1_COURSE_TITLE,
  UNIT_5_1_COURSE_SUBTITLE,
  UNIT_5_1_ROUTE_SEGMENT,
  UNIT_5_1_STAGE_LABEL,
  type UNIT_5_1StudentCourseState,
  type UNIT_5_1StepResponse,
} from '@/lib/unit-5-1-course';
import {
  UNIT_5_1StepContentPanel,
  UNIT_5_1StudentActivityForm,
  type Unit51BoundaryParameterSnapshot,
} from './step-panels';

export function UNIT_5_1StudentPage({
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
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const [boundaryParameters, setBoundaryParameters] = useState<Record<string, Unit51BoundaryParameterSnapshot>>({});

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_5_1_RESOURCE_KEY,
    resourceKey: UNIT_5_1_RESOURCE_KEY,
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
    steps: [...UNIT_5_1_LESSON_STEPS],
    adapter: UNIT_5_1_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_1_RESOURCE_KEY,
    resourceId: UNIT_5_1_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_5_1_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_5_1_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_5_1PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const parameterSubmissionCount = useMemo(
    () => Object.values(courseState.responses).filter((response) => Boolean(response.answers.__boundary_parameters)).length,
    [courseState.responses],
  );
  const prePostCompletion = useMemo(() => {
    const hasPre = Boolean(courseState.responses['step-03']);
    const hasPost = Boolean(courseState.responses['step-13']);
    if (hasPre && hasPost) return '前测与后测均已提交';
    if (hasPre) return '已提交前测';
    if (hasPost) return '已提交后测';
    return '等待提交';
  }, [courseState.responses]);
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    const stepContext = getUnit51StepAIContext(step.id);
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
  const allowInlineReveal = isDemo || browseEnabled;

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

  const handleSubmitResponse = (response: UNIT_5_1StepResponse) => {
    const isResubmit = Boolean(savedResponse);
    void saveCourseState((prev) => {
      const currentBoundaryParameters = boundaryParameters[step.id] ?? prev.boundaryParameterSnapshots?.[step.id];
      const answers = currentBoundaryParameters
        ? { ...response.answers, __boundary_parameters: JSON.stringify(currentBoundaryParameters) }
        : response.answers;
      const submittedAt = submitManifestStepResponse({
        stepId: step.id,
        isResubmit,
        response: { ...response, answers },
        stepManifest: getUNIT_5_1ManifestStepFromManifest(runtimeManifest, step.id),
        extraEvidence: {
          parameterSubmitted: Boolean(currentBoundaryParameters),
          ...(currentBoundaryParameters ? { parameterSnapshots: currentBoundaryParameters } : {}),
        },
      });
      const nextState: UNIT_5_1StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        boundaryParameterSnapshots: {
          ...(prev.boundaryParameterSnapshots ?? {}),
          ...(currentBoundaryParameters ? { [step.id]: currentBoundaryParameters } : {}),
        },
        responses: { ...prev.responses, [step.id]: { ...response, submittedAt, answers } },
      };
      return nextState;
    });
  };

  const handleBoundaryParameterChange = useCallback((stepId: string, snapshot: Unit51BoundaryParameterSnapshot) => {
    setBoundaryParameters((prev) => ({ ...prev, [stepId]: snapshot }));
  }, []);

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_5_1_COURSE_TITLE}
        subtitle={UNIT_5_1_COURSE_SUBTITLE}
        routeSegment={UNIT_5_1_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_5_1_COURSE_TITLE}
        subtitle={UNIT_5_1_COURSE_SUBTITLE}
        routeSegment={UNIT_5_1_ROUTE_SEGMENT}
        steps={UNIT_5_1_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_5_1_COURSE_TITLE}
        subtitle={UNIT_5_1_COURSE_SUBTITLE}
        routeSegment={UNIT_5_1_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_5_1_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_5_1_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={(index) => {
          trackStepLeave(step.id, { nextStepId: UNIT_5_1_LESSON_STEPS[index]?.id });
          setActiveIndex(index);
        }}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_1_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_5_1_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_5_1_LESSON_KEY,
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
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        <UNIT_5_1StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          viewerRole="student"
          submittedCount={submittedCount}
          viewedCount={viewedStepIds.length}
          parameterSubmissionCount={parameterSubmissionCount}
          prePostCompletion={prePostCompletion}
          onParameterChange={handleBoundaryParameterChange}
        />

        <div className="mt-4">
          <UNIT_5_1StudentActivityForm
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
        </div>
        </div>
      </LessonRuntimeShell>
  );
}

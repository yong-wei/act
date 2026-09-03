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
import { getUnit53StepAIContext } from '@/lib/unit-5-3-ai-contexts';
import {
  getUNIT_5_3ManifestStepFromManifest,
  getUNIT_5_3PageContractFromManifest,
  UNIT_5_3_LESSON_KEY,
  UNIT_5_3_LESSON_STEPS,
  UNIT_5_3_RESOURCE_KEY,
  UNIT_5_3_SESSION_ADAPTER,
  UNIT_5_3_COURSE_TITLE,
  UNIT_5_3_COURSE_SUBTITLE,
  UNIT_5_3_ROUTE_SEGMENT,
  UNIT_5_3_STAGE_LABEL,
  type UNIT_5_3StudentCourseState,
  type UNIT_5_3StepResponse,
} from '@/lib/unit-5-3-course';
import {
  UNIT_5_3StepContentPanel,
  UNIT_5_3StudentActivityForm,
} from './step-panels';

export function UNIT_5_3StudentPage({
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
    resourceId: UNIT_5_3_RESOURCE_KEY,
    resourceKey: UNIT_5_3_RESOURCE_KEY,
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
    steps: [...UNIT_5_3_LESSON_STEPS],
    adapter: UNIT_5_3_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_3_RESOURCE_KEY,
    resourceId: UNIT_5_3_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_5_3_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_5_3_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_5_3PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const saveQueueRef = useRef(Promise.resolve());
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const turningSubmissionCount = useMemo(
    () => Object.values(courseState.responses).filter((response) => Boolean(response.answers.__turning_parameters)).length,
    [courseState.responses],
  );
  const prePostCompletion = useMemo(() => {
    const hasPre = Boolean(courseState.responses['step-03']);
    const hasPost = Boolean(courseState.responses['step-14']);
    if (hasPre && hasPost) return '前测与后测均已提交';
    if (hasPre) return '已提交前测';
    if (hasPost) return '已提交后测';
    return '等待提交';
  }, [courseState.responses]);
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    if (!isDemo || !demoStepId) return;
    const demoIndex = UNIT_5_3_LESSON_STEPS.findIndex((item) => item.id === demoStepId);
    if (demoIndex >= 0 && demoIndex !== activeIndex) {
      setActiveIndex(demoIndex);
    }
  }, [activeIndex, demoStepId, isDemo, setActiveIndex]);

  const enqueueCourseStateSave = useCallback(
    (updater: (prev: UNIT_5_3StudentCourseState) => UNIT_5_3StudentCourseState) => {
      const run = saveQueueRef.current.then(() => saveCourseState(updater));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveCourseState],
  );

  useEffect(() => {
    const stepContext = getUnit53StepAIContext(step.id);
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

  const handleSubmitResponse = (response: UNIT_5_3StepResponse) => {
    void enqueueCourseStateSave((prev) => {
      const parameters = localParameters[step.id] ?? prev.turningParameterSnapshots?.[step.id];
      const answers = parameters ? { ...response.answers, __turning_parameters: JSON.stringify(parameters) } : response.answers;
      const submittedAt = submitManifestStepResponse({
        stepId: step.id,
        isResubmit: Boolean(prev.responses[step.id]),
        response: { ...response, submittedAt: response.submittedAt, answers },
        stepManifest: getUNIT_5_3ManifestStepFromManifest(runtimeManifest, step.id),
        extraEvidence: {
          parameterSubmitted: Boolean(parameters),
          ...(parameters ? { parameterSnapshots: parameters } : {}),
        },
      });
      const nextState: UNIT_5_3StudentCourseState = {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        turningParameterSnapshots: {
          ...(prev.turningParameterSnapshots ?? {}),
          ...(parameters ? { [step.id]: parameters } : {}),
        },
        responses: {
          ...prev.responses,
          [step.id]: {
            ...response,
            submittedAt,
            answers,
          },
        },
      };
      return nextState;
    });
  };

  const handleParameterChange = useCallback((stepId: string, values: Record<string, string>) => {
    setLocalParameters((prev) => ({ ...prev, [stepId]: values }));
  }, []);

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_5_3_COURSE_TITLE}
        subtitle={UNIT_5_3_COURSE_SUBTITLE}
        routeSegment={UNIT_5_3_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_5_3_COURSE_TITLE}
        subtitle={UNIT_5_3_COURSE_SUBTITLE}
        routeSegment={UNIT_5_3_ROUTE_SEGMENT}
        steps={UNIT_5_3_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_5_3_COURSE_TITLE}
        subtitle={UNIT_5_3_COURSE_SUBTITLE}
        routeSegment={UNIT_5_3_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_5_3_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_5_3_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={(index) => {
          setActiveIndex(index);
        }}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_3_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_5_3_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_5_3_LESSON_KEY,
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

        <UNIT_5_3StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          browseEnabled={browseEnabled}
          onParameterChange={handleParameterChange}
          viewerRole="student"
          submittedCount={submittedCount}
          viewedCount={viewedStepIds.length}
          turningSubmissionCount={turningSubmissionCount}
          prePostCompletion={prePostCompletion}
        />

        <UNIT_5_3StudentActivityForm
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

        <div className="premium-lesson-muted mt-4 text-xs">已提交 {submittedCount} 个页面作答。</div>
        </div>
      </LessonRuntimeShell>
  );
}

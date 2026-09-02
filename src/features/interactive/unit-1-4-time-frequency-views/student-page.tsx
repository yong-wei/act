'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useManifestSubmissionController } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import { parseStructuredSubmissionAnswer } from '@/features/interactive/shared/manifest-runtime/submission-extra-evidence';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { createUNIT_1_4AIContext } from '@/lib/unit-1-4-ai-contexts';
import {
  buildUNIT_1_4ParameterSnapshots,
  getUNIT_1_4ManifestStepFromManifest,
  getUNIT_1_4PageContractFromManifest,
  UNIT_1_4_LESSON_KEY,
  UNIT_1_4_LESSON_STEPS,
  UNIT_1_4_RESOURCE_KEY,
  UNIT_1_4_SESSION_ADAPTER,
  UNIT_1_4_COURSE_TITLE,
  UNIT_1_4_COURSE_SUBTITLE,
  UNIT_1_4_ROUTE_SEGMENT,
  UNIT_1_4_STAGE_LABEL,
  type UNIT_1_4StudentCourseState,
  type UNIT_1_4StepResponse,
} from '@/lib/unit-1-4-course';
import {
  UNIT_1_4StepContentPanel,
  UNIT_1_4StudentActivityForm,
} from './step-panels';

function firstStructuredAnswer(answers: Record<string, string>) {
  for (const value of Object.values(answers)) {
    const parsed = parseStructuredSubmissionAnswer(value);
    if (parsed) return parsed;
  }
  return null;
}

function isControlWorkbenchEvidenceDraft(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).schemaVersion === 'control-workbench-evidence-v1';
}

export function UNIT_1_4StudentPage({
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
    resourceId: UNIT_1_4_RESOURCE_KEY,
    resourceKey: UNIT_1_4_RESOURCE_KEY,
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
    steps: [...UNIT_1_4_LESSON_STEPS],
    adapter: UNIT_1_4_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_1_4_RESOURCE_KEY,
    resourceId: UNIT_1_4_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_1_4_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_1_4_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const currentStepManifest = getUNIT_1_4ManifestStepFromManifest(runtimeManifest, step.id);
  const pageContract = getUNIT_1_4PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [failedSubmission, setFailedSubmission] = useState<UNIT_1_4StepResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    if (!isDemo || !demoStepId) return;
    const demoIndex = UNIT_1_4_LESSON_STEPS.findIndex((item) => item.id === demoStepId);
    if (demoIndex >= 0 && demoIndex !== activeIndex) setActiveIndex(demoIndex);
  }, [activeIndex, demoStepId, isDemo, setActiveIndex]);

  const enqueueCourseStateSave = useCallback(
    (updater: (prev: UNIT_1_4StudentCourseState) => UNIT_1_4StudentCourseState) => {
      const run = saveQueueRef.current.then(async () => {
        const confirmation: {
          previousState?: UNIT_1_4StudentCourseState;
          confirmedState?: UNIT_1_4StudentCourseState;
        } = {};
        await saveCourseState((prev) => {
          confirmation.previousState = prev;
          confirmation.confirmedState = updater(prev);
          return confirmation.confirmedState;
        });
        if (!confirmation.previousState || !confirmation.confirmedState) {
          throw new Error('课堂状态保存未返回确认状态。');
        }
        return {
          previousState: confirmation.previousState,
          confirmedState: confirmation.confirmedState,
        };
      });
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveCourseState],
  );

  const answerVisible = Boolean(teacherSyncState?.revealedAnswers?.[step.id]);
  const releasedByDefault =
    pageContract.teacherControls.releaseActivity === 'page_load_open' ||
    pageContract.teacherControls.releaseActivity === 'not_applicable';
  const released = isDemo || releasedByDefault
    ? true
    : Boolean(teacherSyncState?.releasedActivities?.[step.id]);
  const browseEnabled = isDemo ||
    pageContract.teacherControls.openBrowse === 'not_applicable' ||
    pageContract.teacherControls.openBrowse === 'page_load_open'
    ? true
    : Boolean(teacherSyncState?.browseEnabled?.[step.id]);
  const teacherStep = UNIT_1_4_LESSON_STEPS[teacherIndex] ?? step;
  const teacherPageContract = getUNIT_1_4PageContractFromManifest(runtimeManifest, teacherStep.id);
  const navigationEnabled = isDemo ||
    teacherPageContract.teacherControls.openBrowse === 'not_applicable' ||
    teacherPageContract.teacherControls.openBrowse === 'page_load_open' ||
    Boolean(teacherSyncState?.browseEnabled?.[teacherStep.id]);
  const browseRequired = currentStepManifest.studentAccess.browse_required === true
    || currentStepManifest.studentAccess.browseRequired === true;
  const revealProgress = teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0;
  const allowInlineReveal = isDemo || (browseEnabled && pageContract.teacherControls.teacherStepReveal === 'not_applicable');

  useEffect(() => {
    updatePageContext(createUNIT_1_4AIContext(currentStepManifest, {
      answers: savedResponse?.answers ?? {},
      answerVisible,
    }));
  }, [answerVisible, currentStepManifest, savedResponse, updatePageContext]);

  const previousStepIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingSession) return;
    const previousStepId = previousStepIdRef.current;
    if (previousStepId && previousStepId !== step.id) trackStepLeave(previousStepId, { nextStepId: step.id });
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    setLocalViewedStepIds((prev) => Array.from(new Set([...prev, step.id])));
    if (!isDemo) {
      void enqueueCourseStateSave((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), step.id])),
      })).catch(() => undefined);
    }
    previousStepIdRef.current = step.id;
  }, [activeIndex, enqueueCourseStateSave, isDemo, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = async (response: UNIT_1_4StepResponse) => {
    const targetStepId = response.stepId || step.id;
    setSubmissionError(null);
    setFailedSubmission(null);
    setSubmitting(true);
    try {
      const confirmation = await enqueueCourseStateSave((prev) => {
        const previousResponse = prev.responses[targetStepId];
        const persistedResponse = {
          ...response,
          stepId: targetStepId,
          submittedAt: Date.now(),
          answers: { ...(previousResponse?.answers ?? {}), ...response.answers },
        };
        return {
          ...prev,
          studentName: currentStudentName,
          updatedAt: Date.now(),
          viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
          responses: { ...prev.responses, [targetStepId]: persistedResponse },
        };
      });
      const persistedResponse = confirmation.confirmedState.responses[targetStepId];
      const stepManifest = getUNIT_1_4ManifestStepFromManifest(runtimeManifest, targetStepId);
      const structuredAnswer = firstStructuredAnswer(response.answers);
      const parameterSnapshots = buildUNIT_1_4ParameterSnapshots({
        answers: response.answers,
        submitFields: stepManifest.interactionSpec.submitFields ?? [],
      });
      await submitManifestStepResponse({
        stepId: targetStepId,
        isResubmit: Boolean(confirmation.previousState.responses[targetStepId]),
        response: persistedResponse,
        stepManifest,
        extraEvidence: {
          ...(structuredAnswer ? { structuredAnswer } : {}),
          ...(parameterSnapshots ? { parameterSnapshots } : {}),
        },
        dataOverrides: isControlWorkbenchEvidenceDraft(structuredAnswer)
          ? { controlWorkbenchEvidenceDraft: structuredAnswer }
          : undefined,
      });
    } catch (requestError) {
      setFailedSubmission(response);
      setSubmissionError(requestError instanceof Error ? requestError.message : '提交保存失败，请重试。');
      throw requestError;
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_1_4_COURSE_TITLE}
        subtitle={UNIT_1_4_COURSE_SUBTITLE}
        routeSegment={UNIT_1_4_ROUTE_SEGMENT}
      />
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <LessonRuntimeShell
        mode="invalid"
        title={UNIT_1_4_COURSE_TITLE}
        subtitle={UNIT_1_4_COURSE_SUBTITLE}
        routeSegment={UNIT_1_4_ROUTE_SEGMENT}
        steps={UNIT_1_4_LESSON_STEPS}
        activeIndex={activeIndex}
        invalidTitle="课堂已结束"
        invalidDescription="教师已结束课堂，本页面保留你的学习记录。"
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode={isDemo ? 'guest' : 'student'}
        title={UNIT_1_4_COURSE_TITLE}
        subtitle={UNIT_1_4_COURSE_SUBTITLE}
        routeSegment={UNIT_1_4_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_1_4_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_1_4_STAGE_LABEL}
        notice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        onIndexChange={navigationEnabled ? ((index) => setActiveIndex(index)) : undefined}
        localTools={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_1_4_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
        }
        runtimeAttributes={{
          'data-launch-provenance': 'course-launched',
          'data-return-target': `/interactive-learning/courses/${UNIT_1_4_ROUTE_SEGMENT}`,
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_1_4_LESSON_KEY,
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
        {submissionError ? (
          <div className="premium-lesson-tone-block premium-tone-rose mb-4 flex flex-wrap items-center justify-between gap-3" role="alert">
            <span>提交失败：{submissionError}</span>
            <button type="button" onClick={() => failedSubmission && void handleSubmitResponse(failedSubmission).catch(() => undefined)} className="premium-lesson-action-tone premium-tone-rose">
              重试提交
            </button>
          </div>
        ) : null}
        {submitting ? <div className="premium-lesson-tone-block premium-tone-cyan mb-4">提交保存中...</div> : null}
        <div className="premium-lesson-panel-soft mb-4 px-4 py-4">
          <div className="premium-lesson-kicker">学生课堂台</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        <UNIT_1_4StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          revealLocked={browseRequired && !browseEnabled}
          showFrequencyReadings={Boolean(savedResponse) || answerVisible}
          onPanelSubmit={released ? handleSubmitResponse : undefined}
        />

        {step.pageType !== 'interactive_figure_submit' || savedResponse || answerVisible ? (
          <fieldset disabled={submitting} className="min-w-0 disabled:opacity-70">
          <UNIT_1_4StudentActivityForm
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
          </fieldset>
        ) : null}

        <div className="premium-lesson-muted mt-4 text-xs">
          已浏览 {viewedStepIds.length} 个页面，已提交 {submittedCount} 个页面作答。
        </div>
        </div>
      </LessonRuntimeShell>
  );
}

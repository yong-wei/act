'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useStudentLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useManifestSubmissionController } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import { parseStructuredSubmissionAnswer } from '@/features/interactive/shared/manifest-runtime/submission-extra-evidence';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { getUnit12StepAIContext } from '@/lib/unit-1-2-ai-contexts';
import {
  buildUNIT_1_2ParameterSnapshots,
  getUNIT_1_2ManifestStepFromManifest,
  getUNIT_1_2PageContractFromManifest,
  UNIT_1_2_LESSON_KEY,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_RESOURCE_KEY,
  UNIT_1_2_SESSION_ADAPTER,
  type UNIT_1_2StudentCourseState,
  type UNIT_1_2StepResponse,
} from '@/lib/unit-1-2-course';
import { UNIT_1_2CourseHeader } from './course-header';
import {
  UNIT_1_2StepContentPanel,
  UNIT_1_2StudentActivityForm,
} from './step-panels';

function firstStructuredAnswer(answers: Record<string, string>) {
  for (const value of Object.values(answers)) {
    const parsed = parseStructuredSubmissionAnswer(value);
    if (parsed) return parsed;
  }
  return null;
}

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
  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_1_2_RESOURCE_KEY,
    resourceKey: UNIT_1_2_RESOURCE_KEY,
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
    steps: [...UNIT_1_2_LESSON_STEPS],
    adapter: UNIT_1_2_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const { trackCourseEvent, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_1_2_RESOURCE_KEY,
    resourceId: UNIT_1_2_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: UNIT_1_2_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });

  const step = UNIT_1_2_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_1_2PageContractFromManifest(runtimeManifest, step.id);
  const savedResponse = courseState.responses[step.id];
  const submittedCount = useMemo(() => Object.keys(courseState.responses).length, [courseState.responses]);
  const [localViewedStepIds, setLocalViewedStepIds] = useState<string[]>([]);
  const viewedStepIds = courseState.viewedStepIds?.length ? courseState.viewedStepIds : localViewedStepIds;
  const saveQueueRef = useRef(Promise.resolve());
  const { updatePageContext } = useGlobalAI();

  useEffect(() => {
    if (!isDemo || !demoStepId) return;
    const demoIndex = UNIT_1_2_LESSON_STEPS.findIndex((item) => item.id === demoStepId);
    if (demoIndex >= 0 && demoIndex !== activeIndex) setActiveIndex(demoIndex);
  }, [activeIndex, demoStepId, isDemo, setActiveIndex]);

  const enqueueCourseStateSave = useCallback(
    (updater: (prev: UNIT_1_2StudentCourseState) => UNIT_1_2StudentCourseState) => {
      const run = saveQueueRef.current.then(() => saveCourseState(updater));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveCourseState],
  );

  useEffect(() => {
    const stepContext = getUnit12StepAIContext(step.id);
    if (stepContext) updatePageContext(stepContext);
  }, [step.id, updatePageContext]);

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
  const revealProgress = teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0;
  const allowInlineReveal = isDemo || (browseEnabled && pageContract.teacherControls.teacherStepReveal === 'not_applicable');

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
      }));
    }
    previousStepIdRef.current = step.id;
  }, [activeIndex, enqueueCourseStateSave, isDemo, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'student-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  const handleSubmitResponse = (response: UNIT_1_2StepResponse) => {
    const targetStepId = response.stepId || step.id;
    void enqueueCourseStateSave((prev) => {
      const previousResponse = prev.responses[targetStepId];
      const answers = {
        ...(previousResponse?.answers ?? {}),
        ...response.answers,
      };
      const stepManifest = getUNIT_1_2ManifestStepFromManifest(runtimeManifest, targetStepId);
      const structuredAnswer = firstStructuredAnswer(answers);
      const parameterSnapshots = buildUNIT_1_2ParameterSnapshots({
        answers,
        submitFields: stepManifest.interactionSpec.submitFields ?? [],
      });
      const submittedAt = submitManifestStepResponse({
        stepId: targetStepId,
        isResubmit: Boolean(previousResponse),
        response: { ...response, stepId: targetStepId, submittedAt: response.submittedAt, answers },
        stepManifest,
        extraEvidence: {
          ...(structuredAnswer ? { structuredAnswer } : {}),
          ...(parameterSnapshots ? { parameterSnapshots } : {}),
        },
      });
      return {
        ...prev,
        studentName: currentStudentName,
        updatedAt: Date.now(),
        viewedStepIds: Array.from(new Set([...(prev.viewedStepIds ?? []), ...localViewedStepIds, step.id])),
        responses: {
          ...prev.responses,
          [targetStepId]: {
            ...response,
            stepId: targetStepId,
            submittedAt,
            answers,
          },
        },
      };
    });
  };

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
        onIndexChange={(index) => setActiveIndex(index)}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={(
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_1_2_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        )}
      />
      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
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

        <UNIT_1_2StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
          onPanelSubmit={released ? handleSubmitResponse : undefined}
        />

        {step.pageType === 'interactive_figure_submit' ? null : (
          <UNIT_1_2StudentActivityForm
            step={step}
            manifest={runtimeManifest}
            savedResponse={savedResponse}
            released={released}
            browseEnabled={browseEnabled}
            answerVisible={answerVisible}
            revealProgress={revealProgress}
            onSubmit={handleSubmitResponse}
          />
        )}

        <div className="premium-lesson-muted mt-4 text-xs">
          已浏览 {viewedStepIds.length} 个页面，已提交 {submittedCount} 个页面作答。
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  finalizeUNIT_5_2TeacherSession,
  getUNIT_5_2PageContractFromManifest,
  isUNIT_5_2TeacherSyncState,
  resolveUNIT_5_2TeacherSyncDraft,
  shouldPostUNIT_5_2TeacherSync,
  UNIT_5_2_LESSON_KEY,
  UNIT_5_2_LESSON_STEPS,
  UNIT_5_2_RESOURCE_KEY,
  UNIT_5_2_SESSION_ADAPTER,
  type UNIT_5_2StudentCourseState,
  type UNIT_5_2TeacherCourseSyncState,
} from '@/lib/unit-5-2-course';
import { UNIT_5_2CourseHeader } from './course-header';
import {
  UNIT_5_2StepContentPanel,
  UNIT_5_2TeacherActivitySummary,
} from './step-panels';

export function UNIT_5_2TeacherPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const [localRevealedAnswers, setLocalRevealedAnswers] = useState<Record<string, boolean> | null>(null);
  const [localReleasedActivities, setLocalReleasedActivities] = useState<Record<string, boolean> | null>(null);
  const [localBrowseEnabled, setLocalBrowseEnabled] = useState<Record<string, boolean> | null>(null);
  const [localTeacherRevealProgress, setLocalTeacherRevealProgress] = useState<Record<string, number> | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_5_2_RESOURCE_KEY,
    resourceKey: UNIT_5_2_RESOURCE_KEY,
    sessionId,
  });

  const {
    sessionInfo,
    courseStates,
    teacherStates,
    activeIndex,
    loadingSession,
    error,
    errorTelemetry,
    teacherViewHydrated,
    patchCurrentStep,
    postTeacherSyncInput,
    finishSession,
  } = useTeacherLessonSession({
    sessionId,
    steps: [...UNIT_5_2_LESSON_STEPS],
    adapter: UNIT_5_2_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_2_RESOURCE_KEY,
    resourceId: UNIT_5_2_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_5_2_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_2_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const pageContract = getUNIT_5_2PageContractFromManifest(runtimeManifest, step.id);

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_5_2TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_5_2TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_5_2TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        localBrowseEnabled,
        localTeacherRevealProgress,
        teacherSyncState,
      }),
    [localBrowseEnabled, localRevealedAnswers, localReleasedActivities, localTeacherRevealProgress, teacherSyncState],
  );

  useEffect(() => {
    if (!loadingSession) trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostUNIT_5_2TeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
      browseEnabled,
      teacherRevealProgress,
    });
  }, [browseEnabled, loadingSession, postTeacherSyncInput, releasedActivities, revealedAnswers, step.id, teacherRevealProgress, teacherViewHydrated]);

  const responses = useMemo(() => (
    courseStates
      .map((record) => {
        const data = record.data as UNIT_5_2StudentCourseState;
        const response = data.responses?.[step.id];
        return response ? { studentName: data.studentName || '学生', response } : null;
      })
      .filter((item): item is { studentName: string; response: NonNullable<typeof item>['response'] } => Boolean(item))
  ), [courseStates, step.id]);

  const releasedByDefault =
    pageContract.teacherControls.releaseActivity === 'page_load_open' ||
    pageContract.teacherControls.releaseActivity === 'not_applicable';
  const released = releasedByDefault || Boolean(releasedActivities[step.id]);
  const browseOpen =
    pageContract.teacherControls.openBrowse === 'not_applicable' ||
    pageContract.teacherControls.openBrowse === 'page_load_open' ||
    Boolean(browseEnabled[step.id]);
  const answerVisible = Boolean(revealedAnswers[step.id]);
  const revealProgress = teacherRevealProgress[step.id] ?? 0;

  const toggleState = (
    setter: (value: Record<string, boolean>) => void,
    source: Record<string, boolean>,
  ) => setter({ ...source, [step.id]: !source[step.id] });

  const handleEndSession = async () => {
    setEndingSession(true);
    await finalizeUNIT_5_2TeacherSession({
      finishSession,
      trackSessionFinalize,
      currentStepId: step.id,
    });
    setEndingSession(false);
  };

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <UNIT_5_2CourseHeader
        stage={step.stage}
        currentStepLabel={`第 ${String(activeIndex + 1).padStart(2, '0')} 页 · ${step.title}`}
        sessionCode={sessionInfo?.joinCode}
        rightSlot={(
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_2_LESSON_STEPS.map((item) => item.id)}
          />
        )}
      />
      <main className="premium-lesson-main mx-auto grid max-w-[1180px] gap-4 px-3 py-4 lg:grid-cols-[250px_1fr] sm:px-6">
        <aside className="premium-lesson-panel h-fit p-3">
          <div className="premium-lesson-kicker mb-2">页面导航</div>
          <div className="space-y-2">
            {UNIT_5_2_LESSON_STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void patchCurrentStep(index, {})}
                className={`w-full rounded-md border px-3 py-2 text-left text-xs ${index === activeIndex ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'}`}
              >
                第 {String(index + 1).padStart(2, '0')} 页 · {item.title}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void handleEndSession()} disabled={endingSession} className="premium-lesson-action-secondary mt-4 flex w-full">
            {endingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            结束课堂
          </button>
        </aside>

        <section className="space-y-4">
          {error ? <div className="premium-lesson-tone-block premium-tone-rose">{error}</div> : null}
          <UNIT_5_2StepContentPanel
            step={step}
            manifest={runtimeManifest}
            revealProgress={revealProgress}
            allowInlineReveal
            responses={responses}
            teacherMode
          />
          <UNIT_5_2TeacherActivitySummary
            step={step}
            manifest={runtimeManifest}
            responses={responses}
            released={released}
            browseEnabled={browseOpen}
            answerVisible={answerVisible}
            revealProgress={revealProgress}
            onToggleRelease={() => toggleState(setLocalReleasedActivities, releasedActivities)}
            onToggleBrowse={() => toggleState(setLocalBrowseEnabled, browseEnabled)}
            onToggleAnswerVisible={() => toggleState(setLocalRevealedAnswers, revealedAnswers)}
            onAdvanceReveal={() => setLocalTeacherRevealProgress({ ...teacherRevealProgress, [step.id]: revealProgress + 1 })}
            onResetReveal={() => setLocalTeacherRevealProgress({ ...teacherRevealProgress, [step.id]: 0 })}
          />
        </section>
      </main>
    </div>
  );
}

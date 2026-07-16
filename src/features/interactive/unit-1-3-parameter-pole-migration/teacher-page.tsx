'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { getInteractiveRevealLayerCount } from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import { requestClassroomEndConfirmation } from '@/features/classroom/classroom-lifecycle-dialog';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  finalizeUNIT_1_3TeacherSession,
  getUNIT_1_3ManifestStepFromManifest,
  isUNIT_1_3StudentState,
  isUNIT_1_3TeacherSyncState,
  resolveUNIT_1_3TeacherSyncDraft,
  shouldPostUNIT_1_3TeacherSync,
  UNIT_1_3_LESSON_KEY,
  UNIT_1_3_LESSON_STEPS,
  UNIT_1_3_RESOURCE_KEY,
  UNIT_1_3_SESSION_ADAPTER,
  UNIT_1_3_STAGE_MAP,
  type UNIT_1_3StudentCourseState,
  type UNIT_1_3TeacherCourseSyncState,
} from '@/lib/unit-1-3-course';
import { UNIT_1_3CourseHeader } from './course-header';
import {
  UNIT_1_3StepContentPanel,
  UNIT_1_3TeacherActivitySummary,
} from './step-panels';

function revealLayerCount(lessonRuntime: RuntimeLessonEntryBundle, stepId: string) {
  if (!lessonRuntime.interactiveManifest) return 0;
  return getInteractiveRevealLayerCount(
    getUNIT_1_3ManifestStepFromManifest(lessonRuntime.interactiveManifest, stepId),
  );
}

export function UNIT_1_3TeacherPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  if (sessionId === 'demo') return <UNIT_1_3TeacherDemoPage lessonRuntime={lessonRuntime} />;
  return <UNIT_1_3LiveTeacherPage sessionId={sessionId} lessonRuntime={lessonRuntime} />;
}

function UNIT_1_3LiveTeacherPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const router = useRouter();
  const [endingSession, setEndingSession] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [localRevealedAnswers, setLocalRevealedAnswers] = useState<Record<string, boolean> | null>(null);
  const [localReleasedActivities, setLocalReleasedActivities] = useState<Record<string, boolean> | null>(null);
  const [localBrowseEnabled, setLocalBrowseEnabled] = useState<Record<string, boolean> | null>(null);
  const [localTeacherRevealProgress, setLocalTeacherRevealProgress] = useState<Record<string, number> | null>(null);
  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_1_3_RESOURCE_KEY,
    resourceKey: UNIT_1_3_RESOURCE_KEY,
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
    steps: [...UNIT_1_3_LESSON_STEPS],
    adapter: UNIT_1_3_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_1_3_RESOURCE_KEY,
    resourceId: UNIT_1_3_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_1_3_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_1_3_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_1_3TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_1_3TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);
  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_1_3TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        localBrowseEnabled,
        localTeacherRevealProgress,
        teacherSyncState,
      }),
    [localBrowseEnabled, localRevealedAnswers, localReleasedActivities, localTeacherRevealProgress, teacherSyncState],
  );

  const previousStepIdRef = useRef<string | null>(null);
  const lastPostedSyncPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingSession) return;
    const previousStepId = previousStepIdRef.current;
    if (previousStepId && previousStepId !== step.id) trackStepLeave(previousStepId, { nextStepId: step.id });
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    previousStepIdRef.current = step.id;
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostUNIT_1_3TeacherSync({ loadingSession, teacherViewHydrated })) return;
    const payload = { activeStepId: step.id, revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress };
    const payloadKey = JSON.stringify(payload);
    if (lastPostedSyncPayloadRef.current === payloadKey) return;
    lastPostedSyncPayloadRef.current = payloadKey;
    void postTeacherSyncInput(payload);
  }, [browseEnabled, loadingSession, postTeacherSyncInput, releasedActivities, revealedAnswers, step.id, teacherRevealProgress, teacherViewHydrated]);

  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!isUNIT_1_3StudentState(record.data)) return null;
        return {
          studentName: record.data.studentName || record.user?.name?.trim() || '未命名学生',
          state: record.data,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_1_3StudentCourseState }>;
  }, [courseStates]);
  const joinedStudents = useMemo(() => Array.from(new Set(studentStates.map((item) => item.studentName))), [studentStates]);
  const submittedStudents = useMemo(() => studentStates.filter((item) => Object.keys(item.state.responses).length > 0).length, [studentStates]);
  const totalResponses = useMemo(() => studentStates.reduce((sum, item) => sum + Object.keys(item.state.responses).length, 0), [studentStates]);
  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_1_3StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const advanceReveal = useCallback(() => {
    setLocalTeacherRevealProgress((prev) => {
      const base = prev ?? teacherSyncState?.teacherRevealProgress ?? {};
      const layerCount = revealLayerCount(lessonRuntime, step.id);
      const maxProgress = Math.max(0, layerCount - 1);
      return {
        ...base,
        [step.id]: Math.min(maxProgress, (base[step.id] ?? 0) + 1),
      };
    });
  }, [lessonRuntime, step.id, teacherSyncState?.teacherRevealProgress]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = UNIT_1_3_LESSON_STEPS[nextIndex];
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_1_3_STAGE_MAP[nextStep.stage],
      });
    },
    [patchCurrentStep],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;
    setEndingSession(true);
    try {
      await finalizeUNIT_1_3TeacherSession({
        finishSession,
        trackSessionFinalize,
        currentStepId: step.id,
      });
      router.push(buildSessionEndReturnHref({ classId: sessionInfo.classId, planTitle: sessionInfo.planTitle }));
    } catch {
      setEndingSession(false);
    }
  }, [finishSession, router, sessionInfo, step.id, trackSessionFinalize]);

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <UNIT_1_3CourseHeader
        steps={UNIT_1_3_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_1_3_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main py-4 sm:py-6">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="premium-lesson-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="premium-lesson-kicker">教师课堂台</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">
                课堂码：{sessionInfo?.joinCode ?? '------'}
              </div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、发放作答、推进显影并显示参考解释。</div>
              <div className="premium-lesson-muted mt-1 text-xs">已加入 {joinedStudents.length} 人，提交学生 {submittedStudents} 人，累计提交 {totalResponses} 次。</div>
            </div>
            <TeacherJoinQrDialog joinCode={sessionInfo?.joinCode} />
            <button type="button" onClick={() => void handleEndSession()} disabled={endingSession} className="premium-lesson-action-tone premium-tone-rose">
              {endingSession ? '结束中...' : '结束课堂'}
            </button>
          </div>

          <div className="premium-lesson-panel-soft px-4 py-4">
            <button type="button" onClick={() => setShowStudentList((prev) => !prev)} className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                当前在线学生
              </span>
              <span className="premium-lesson-caption inline-flex items-center gap-1 text-xs">
                {joinedStudents.length} 人
                {showStudentList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showStudentList ? (
              <div className="mt-3 space-y-2">
                {joinedStudents.length ? (
                  joinedStudents.map((studentName) => (
                    <div key={studentName} className="premium-lesson-surface-elevated px-3 py-2 text-sm">
                      {studentName}
                    </div>
                  ))
                ) : (
                  <div className="premium-lesson-muted text-sm">暂无学生加入。</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <UNIT_1_3StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={true}
          onInlineReveal={advanceReveal}
        />

        <div className="mt-4">
          <UNIT_1_3TeacherActivitySummary
            step={step}
            manifest={runtimeManifest}
            responses={currentResponses}
            released={Boolean(releasedActivities[step.id])}
            browseEnabled={Boolean(browseEnabled[step.id])}
            answerVisible={Boolean(revealedAnswers[step.id])}
            revealProgress={teacherRevealProgress[step.id] ?? 0}
            onToggleRelease={() =>
              setLocalReleasedActivities((prev) => ({
                ...(prev ?? teacherSyncState?.releasedActivities ?? {}),
                [step.id]: !(prev?.[step.id] ?? teacherSyncState?.releasedActivities?.[step.id]),
              }))
            }
            onToggleBrowse={() =>
              setLocalBrowseEnabled((prev) => ({
                ...(prev ?? teacherSyncState?.browseEnabled ?? {}),
                [step.id]: !(prev?.[step.id] ?? teacherSyncState?.browseEnabled?.[step.id]),
              }))
            }
            onToggleAnswerVisible={() =>
              setLocalRevealedAnswers((prev) => ({
                ...(prev ?? teacherSyncState?.revealedAnswers ?? {}),
                [step.id]: !(prev?.[step.id] ?? teacherSyncState?.revealedAnswers?.[step.id]),
              }))
            }
            onAdvanceReveal={advanceReveal}
            onResetReveal={() =>
              setLocalTeacherRevealProgress((prev) => ({
                ...(prev ?? teacherSyncState?.teacherRevealProgress ?? {}),
                [step.id]: 0,
              }))
            }
          />
        </div>
      </main>
    </div>
  );
}

function UNIT_1_3TeacherDemoPage({ lessonRuntime }: { lessonRuntime: RuntimeLessonEntryBundle }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showStudentList, setShowStudentList] = useState(false);
  const [localRevealedAnswers, setLocalRevealedAnswers] = useState<Record<string, boolean>>({});
  const [localReleasedActivities, setLocalReleasedActivities] = useState<Record<string, boolean>>({});
  const [localBrowseEnabled, setLocalBrowseEnabled] = useState<Record<string, boolean>>({});
  const [localTeacherRevealProgress, setLocalTeacherRevealProgress] = useState<Record<string, number>>({});
  const step = UNIT_1_3_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const revealProgress = localTeacherRevealProgress[step.id] ?? 0;

  const advanceReveal = useCallback(() => {
    setLocalTeacherRevealProgress((prev) => {
      const layerCount = revealLayerCount(lessonRuntime, step.id);
      const maxProgress = Math.max(0, layerCount - 1);
      return {
        ...prev,
        [step.id]: Math.min(maxProgress, (prev[step.id] ?? 0) + 1),
      };
    });
  }, [lessonRuntime, step.id]);

  return (
    <div className="premium-lesson-shell">
      <UNIT_1_3CourseHeader
        steps={UNIT_1_3_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        middleNotice={`课堂码 DEMO · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_1_3_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main py-4 sm:py-6">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="premium-lesson-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="premium-lesson-kicker">教师课堂台</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">课堂码：DEMO</div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、发放作答、推进显影并显示参考解释。</div>
            </div>
            <TeacherJoinQrDialog joinCode="DEMO" />
            <button type="button" disabled className="premium-lesson-action-tone premium-tone-rose opacity-60">
              结束课堂
            </button>
          </div>

          <div className="premium-lesson-panel-soft px-4 py-4">
            <button type="button" onClick={() => setShowStudentList((prev) => !prev)} className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                当前在线学生
              </span>
              <span className="premium-lesson-caption inline-flex items-center gap-1 text-xs">
                0 人
                {showStudentList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showStudentList ? <div className="premium-lesson-muted mt-3 text-sm">暂无学生加入。</div> : null}
          </div>
        </div>

        <UNIT_1_3StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={revealProgress}
          allowInlineReveal={true}
          onInlineReveal={advanceReveal}
        />

        <div className="mt-4">
          <UNIT_1_3TeacherActivitySummary
            step={step}
            manifest={runtimeManifest}
            responses={[]}
            released={Boolean(localReleasedActivities[step.id])}
            browseEnabled={Boolean(localBrowseEnabled[step.id])}
            answerVisible={Boolean(localRevealedAnswers[step.id])}
            revealProgress={revealProgress}
            onToggleRelease={() => setLocalReleasedActivities((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
            onToggleBrowse={() => setLocalBrowseEnabled((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
            onToggleAnswerVisible={() => setLocalRevealedAnswers((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
            onAdvanceReveal={advanceReveal}
            onResetReveal={() => setLocalTeacherRevealProgress((prev) => ({ ...prev, [step.id]: 0 }))}
          />
        </div>
      </main>
    </div>
  );
}

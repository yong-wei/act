'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import { requestClassroomEndConfirmation } from '@/features/classroom/classroom-lifecycle-dialog';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import {
  buildUNIT_3_8RuntimeSteps,
  finalizeUNIT_3_8TeacherSession,
  isUNIT_3_8InteractivePageType,
  isUNIT_3_8TeacherSyncState,
  resolveUNIT_3_8TeacherSyncDraft,
  shouldPostUNIT_3_8TeacherSync,
  UNIT_3_8_LESSON_KEY,
  UNIT_3_8_RESOURCE_KEY,
  UNIT_3_8_SESSION_ADAPTER,
  UNIT_3_8_STAGE_MAP,
  UNIT_3_8_COURSE_TITLE,
  UNIT_3_8_COURSE_SUBTITLE,
  UNIT_3_8_ROUTE_SEGMENT,
  UNIT_3_8_STAGE_LABEL,
  type UNIT_3_8StudentCourseState,
  type UNIT_3_8TeacherCourseSyncState,
} from '@/lib/unit-3-8-course';
import {
  UNIT_3_8StepContentPanel,
  UNIT_3_8TeacherActivitySummary,
} from './step-panels';

export function UNIT_3_8TeacherPage({
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
  const runtimeManifest = lessonRuntime.interactiveManifest;
  const runtimeSteps = buildUNIT_3_8RuntimeSteps(runtimeManifest);

  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_3_8_RESOURCE_KEY,
    resourceKey: UNIT_3_8_RESOURCE_KEY,
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
    steps: runtimeSteps,
    adapter: UNIT_3_8_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } =
    useCourseEventTracking({
      resourceKey: UNIT_3_8_RESOURCE_KEY,
      resourceId: UNIT_3_8_RESOURCE_KEY,
      sessionId,
      lessonKey: UNIT_3_8_LESSON_KEY,
      actorRole: 'teacher',
      emit: interactiveTracking.emit,
    });

  const step = runtimeSteps[activeIndex];

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_3_8TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_3_8TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_3_8TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        localBrowseEnabled,
        localTeacherRevealProgress,
        teacherSyncState,
      }),
    [localBrowseEnabled, localReleasedActivities, localRevealedAnswers, localTeacherRevealProgress, teacherSyncState],
  );

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
    trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostUNIT_3_8TeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
      browseEnabled,
      teacherRevealProgress,
    });
  }, [browseEnabled, loadingSession, postTeacherSyncInput, releasedActivities, revealedAnswers, step.id, teacherRevealProgress, teacherViewHydrated]);

  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!record.data || typeof record.data !== 'object') return null;
        const data = record.data as { kind?: string; version?: number; studentName?: string; responses?: Record<string, unknown> };
        if (data.kind !== 'unit38_student_state' || data.version !== 1) return null;
        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as UNIT_3_8StudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_3_8StudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => Array.from(new Set(studentStates.map((item) => item.studentName))), [studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_3_8StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = runtimeSteps[nextIndex];
      trackStepLeave(step.id, { nextStepId: nextStep.id });
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_3_8_STAGE_MAP[nextStep.stage],
      });
      trackStepView(nextStep.id, { pageType: nextStep.pageType, stepIndex: nextIndex });
    },
    [patchCurrentStep, runtimeSteps, step.id, trackStepLeave, trackStepView],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_3_8TeacherSession({
        finishSession,
        trackSessionFinalize,
        currentStepId: step.id,
      });
      router.push(
        buildSessionEndReturnHref({
          classId: sessionInfo.classId,
          planTitle: sessionInfo.planTitle,
        }),
      );
    } catch {
      setEndingSession(false);
    }
  }, [finishSession, router, sessionInfo, step.id, trackSessionFinalize]);

  if (loadingSession) {
    return (
      <LessonRuntimeLoadingShell
        mode="teacher"
        title={UNIT_3_8_COURSE_TITLE}
        subtitle={UNIT_3_8_COURSE_SUBTITLE}
        routeSegment={UNIT_3_8_ROUTE_SEGMENT}
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode="teacher"
        title={UNIT_3_8_COURSE_TITLE}
        subtitle={UNIT_3_8_COURSE_SUBTITLE}
        routeSegment={UNIT_3_8_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={runtimeSteps}
        activeIndex={activeIndex}
        stageLabel={UNIT_3_8_STAGE_LABEL}
        notice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        toolsDefaultState="collapsed"
        localTools={
          <>
          <div className="premium-lesson-panel-soft px-4 py-4" data-teacher-projection-runtime="local-tools">
            <div>
              <div className="premium-lesson-kicker">教师课堂台</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">课堂码：{sessionInfo?.joinCode ?? '------'}</div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、查看学生提交统计，并在需要时释放题目、显示答案。</div>
            </div>
            <TeacherJoinQrDialog joinCode={sessionInfo?.joinCode} />
            <button
              type="button"
              onClick={() => void handleEndSession()}
              disabled={endingSession}
              className="premium-lesson-action-tone premium-tone-rose"
            >
              {endingSession ? '结束中...' : '结束课堂'}
            </button>
          </div>

          <div className="premium-lesson-panel-soft px-4 py-4">
            <button
              type="button"
              onClick={() => setShowStudentList((prev) => !prev)}
              className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                已加入学生
              </span>
              {showStudentList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="premium-lesson-muted mt-1 text-sm">共 {joinedStudents.length} 名学生已进入本课堂。</div>
            {showStudentList ? (
              <div className="mt-3 grid gap-2">
                {joinedStudents.length ? (
                  joinedStudents.map((name) => (
                    <div key={name} className="premium-lesson-surface-elevated rounded-2xl px-3 py-2 text-sm">
                      {name}
                    </div>
                  ))
                ) : (
                  <div className="premium-lesson-muted text-sm">暂无学生加入。</div>
                )}
              </div>
            ) : null}
          </div>
            <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={runtimeSteps.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
          </>
        }
        runtimeAttributes={{
          'data-teacher-projection-runtime': 'compact-navigation',
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_3_8_LESSON_KEY,
        }}
      >
        <div className="space-y-4">
          {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <UNIT_3_8StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={false}
        />

        {isUNIT_3_8InteractivePageType(step.pageType) ? (
          <div className="mt-4">
            <UNIT_3_8TeacherActivitySummary
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
              onAdvanceReveal={() =>
                setLocalTeacherRevealProgress((prev) => ({
                  ...(prev ?? teacherSyncState?.teacherRevealProgress ?? {}),
                  [step.id]: (prev?.[step.id] ?? teacherSyncState?.teacherRevealProgress?.[step.id] ?? 0) + 1,
                }))
              }
              onResetReveal={() =>
                setLocalTeacherRevealProgress((prev) => ({
                  ...(prev ?? teacherSyncState?.teacherRevealProgress ?? {}),
                  [step.id]: 0,
                }))
              }
            />
          </div>
        ) : null}
        </div>
      </LessonRuntimeShell>
  );
}

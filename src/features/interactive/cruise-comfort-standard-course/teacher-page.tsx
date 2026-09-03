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
  CRUISE_LESSON_KEY,
  CRUISE_RESOURCE_KEY,
  CRUISE_SESSION_ADAPTER,
  CRUISE_STAGE_MAP,
  CRUISE_STANDARD_LESSON_STEPS,
  finalizeCruiseTeacherSession,
  isCruiseStudentState,
  isCruiseTeacherSyncState,
  resolveCruiseTeacherSyncDraft,
  shouldPostCruiseTeacherSync,
  CRUISE_COURSE_TITLE,
  CRUISE_COURSE_SUBTITLE,
  CRUISE_ROUTE_SEGMENT,
  CRUISE_STAGE_LABEL,
  type CruiseStudentCourseState,
  type CruiseTeacherCourseSyncState,
} from '@/lib/cruise-course';
import { CruiseStepContentPanel, CruiseTeacherActivitySummary } from './step-panels';

export function CruiseStandardTeacherPage({
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
    resourceId: CRUISE_RESOURCE_KEY,
    resourceKey: CRUISE_RESOURCE_KEY,
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
    steps: [...CRUISE_STANDARD_LESSON_STEPS],
    adapter: CRUISE_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: CRUISE_RESOURCE_KEY,
    resourceId: CRUISE_RESOURCE_KEY,
    sessionId,
    lessonKey: CRUISE_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = CRUISE_STANDARD_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isCruiseTeacherSyncState(record.data));
    return (latestRecord?.data as CruiseTeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveCruiseTeacherSyncDraft({
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
    if (previousStepId && previousStepId !== step.id) {
      trackStepLeave(previousStepId, { nextStepId: step.id });
    }
    trackStepView(step.id, { pageType: step.pageType, stepIndex: activeIndex });
    previousStepIdRef.current = step.id;
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (error) trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostCruiseTeacherSync({ loadingSession, teacherViewHydrated })) return;
    const payload = {
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
      browseEnabled,
      teacherRevealProgress,
    };
    const payloadKey = JSON.stringify(payload);
    if (lastPostedSyncPayloadRef.current === payloadKey) return;
    lastPostedSyncPayloadRef.current = payloadKey;
    void postTeacherSyncInput(payload);
  }, [
    browseEnabled,
    loadingSession,
    postTeacherSyncInput,
    releasedActivities,
    revealedAnswers,
    step.id,
    teacherRevealProgress,
    teacherViewHydrated,
  ]);

  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!isCruiseStudentState(record.data)) return null;
        return {
          studentName: record.data.studentName || record.user?.name?.trim() || '未命名学生',
          state: record.data,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: CruiseStudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => Array.from(new Set(studentStates.map((item) => item.studentName))), [studentStates]);
  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: CruiseStudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);
  const totalResponses = useMemo(
    () => studentStates.reduce((sum, item) => sum + Object.keys(item.state.responses).length, 0),
    [studentStates],
  );

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = CRUISE_STANDARD_LESSON_STEPS[nextIndex];
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: CRUISE_STAGE_MAP[nextStep.stage],
      });
    },
    [patchCurrentStep],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;

    setEndingSession(true);
    try {
      await finalizeCruiseTeacherSession({
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
      <LessonRuntimeLoadingShell
        mode="teacher"
        title={CRUISE_COURSE_TITLE}
        subtitle={CRUISE_COURSE_SUBTITLE}
        routeSegment={CRUISE_ROUTE_SEGMENT}
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode="teacher"
        title={CRUISE_COURSE_TITLE}
        subtitle={CRUISE_COURSE_SUBTITLE}
        routeSegment={CRUISE_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={CRUISE_STANDARD_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={CRUISE_STAGE_LABEL}
        notice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        toolsDefaultState="collapsed"
        localTools={
          <>
          <div className="premium-lesson-panel-soft px-4 py-4" data-teacher-projection-runtime="local-tools">
            <div>
              <div className="premium-lesson-kicker">教师课堂台</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">
                课堂码：{sessionInfo?.joinCode ?? '------'}
              </div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、发放作答并显示参考解释。</div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TeacherJoinQrDialog joinCode={sessionInfo?.joinCode} />
              <button type="button" onClick={() => void handleEndSession()} disabled={endingSession} className="premium-lesson-action-tone premium-tone-rose">
                {endingSession ? '结束中...' : '结束课堂'}
              </button>
            </div>
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
            <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={CRUISE_STANDARD_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
          </>
        }
        runtimeAttributes={{
          'data-teacher-projection-runtime': 'compact-navigation',
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? CRUISE_LESSON_KEY,
        }}
      >
        <div className="space-y-4">
          {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <CruiseStepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={true}
        />

        <div className="mt-4">
          <CruiseTeacherActivitySummary
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

        <div className="premium-lesson-muted mt-4 text-xs">
          已加入 {joinedStudents.length} 人，累计提交 {totalResponses} 条 manifest 证据。
        </div>
        </div>
      </LessonRuntimeShell>
  );
}

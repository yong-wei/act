'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import {
  LessonRuntimeLoadingShell,
  LessonRuntimeShell,
} from '@/features/interactive/shared/lesson-runtime-shell';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import { requestClassroomEndConfirmation } from '@/features/classroom/classroom-lifecycle-dialog';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import { resolveCoursePageLayeredDrawerEntries } from '@/lib/layered-graph/course-page-drawer';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';
import { buildCoursePackageLayeredScope } from '@/lib/layered-graph/scope';
import {
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_COURSE_SUBTITLE,
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_STAGE_MAP,
  UNIT_1_1_SESSION_ADAPTER,
  UNIT_1_1_RESOURCE_KEY,
  UNIT_1_1_LESSON_KEY,
  UNIT_1_1_ROUTE_SEGMENT,
  UNIT_1_1_STAGE_LABEL,
  type UNIT_1_1StudentCourseState,
  type UNIT_1_1TeacherCourseSyncState,
  shouldPostUNIT_1_1TeacherSync,
  resolveUNIT_1_1TeacherSyncDraft,
  finalizeUNIT_1_1TeacherSession,
  isUNIT_1_1TeacherSyncState,
} from '@/lib/unit-1-1-course';
import {
  UNIT_1_1KnowledgeMapVisual,
  UNIT_1_1StepContentPanel,
  UNIT_1_1TeacherActivitySummary,
} from './step-panels';

export function UNIT_1_1TeacherPage({
  sessionId,
  lessonRuntime,
  layeredGraphPayload,
  layeredResourceLaunchTargets,
  layeredResourceRegistryIds,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
  /** Server-resolved Teaching Projection layered payload (active/candidate/pin). */
  layeredGraphPayload?: LayeredGraphPayload | null;
  layeredResourceLaunchTargets?: Record<string, string | null>;
  layeredResourceRegistryIds?: Record<string, string>;
}) {
  const router = useRouter();
  const [endingSession, setEndingSession] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [localRevealedAnswers, setLocalRevealedAnswers] = useState<Record<string, boolean> | null>(null);
  const [localReleasedActivities, setLocalReleasedActivities] = useState<Record<string, boolean> | null>(null);

  // Unified tracking setup
  const interactiveTracking = useInteractiveTracking({
    resourceId: UNIT_1_1_RESOURCE_KEY,
    resourceKey: UNIT_1_1_RESOURCE_KEY,
    sessionId,
  });

  // Unified teacher session hook
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
    steps: UNIT_1_1_LESSON_STEPS,
    adapter: UNIT_1_1_SESSION_ADAPTER,
  });

  // Course event tracking
  const { trackCourseEvent, trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_1_1_RESOURCE_KEY,
    resourceId: UNIT_1_1_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_1_1_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_1_1_LESSON_STEPS[activeIndex];
  const orderedStepIds = useMemo(
    () => UNIT_1_1_LESSON_STEPS.map((item) => item.id),
    [],
  );
  // Layered Teaching Projection drawer path (#1273 / PR #1286):
  // server resolves active/candidate payload; client scopes step.knowledgeRefs.
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

  // Compute teacherSyncState from teacherStates
  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_1_1TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_1_1TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  // Resolve revealed/released from local draft + server state
  const { revealedAnswers, releasedActivities } = useMemo(
    () =>
      resolveUNIT_1_1TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        teacherSyncState,
      }),
    [localRevealedAnswers, localReleasedActivities, teacherSyncState],
  );

  // Step view tracking
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
    trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  // Teacher-sync write-back gate
  useEffect(() => {
    if (!shouldPostUNIT_1_1TeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
    });
  }, [loadingSession, postTeacherSyncInput, revealedAnswers, releasedActivities, step.id, teacherViewHydrated]);

  // Student states from courseStates
  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        if (!record.data || typeof record.data !== 'object') return null;
        const data = record.data as { kind?: string; version?: number; studentName?: string; responses?: Record<string, unknown> };
        if (data.kind !== 'unit11_student_state' || data.version !== 1) return null;
        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as UNIT_1_1StudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_1_1StudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => {
    const names = new Set(studentStates.map((item) => item.studentName));
    return Array.from(names);
  }, [studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_1_1StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = UNIT_1_1_LESSON_STEPS[nextIndex];
      trackStepLeave(step.id, { nextStepId: nextStep.id });
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_1_1_STAGE_MAP[nextStep.stage],
      });
      trackStepView(nextStep.id, { pageType: nextStep.pageType, stepIndex: nextIndex });
    },
    [patchCurrentStep, step.id, trackStepLeave, trackStepView],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_1_1TeacherSession({
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
        title={UNIT_1_1_COURSE_TITLE}
        subtitle={UNIT_1_1_COURSE_SUBTITLE}
        routeSegment={UNIT_1_1_ROUTE_SEGMENT}
      />
    );
  }

  return (
    <LessonRuntimeShell
      mode="teacher"
      title={UNIT_1_1_COURSE_TITLE}
      subtitle={UNIT_1_1_COURSE_SUBTITLE}
      routeSegment={UNIT_1_1_ROUTE_SEGMENT}
      sessionId={sessionId}
      steps={UNIT_1_1_LESSON_STEPS}
      activeIndex={activeIndex}
      stageLabel={UNIT_1_1_STAGE_LABEL}
      notice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
      onIndexChange={(index) => void handlePatchCurrentStep(index)}
      toolsDefaultState="collapsed"
      localTools={
        <>
          <div className="premium-lesson-panel-soft px-4 py-4" data-teacher-projection-runtime="local-tools">
            <div className="premium-lesson-kicker">教师推进台</div>
            <div className="premium-lesson-title mt-2 text-lg font-semibold">课堂码：{sessionInfo?.joinCode ?? '------'}</div>
            <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、查看学生提交统计，并在需要时释放题目、显示答案。</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
          </div>
          <div className="premium-lesson-panel-soft px-4 py-4">
            <button
              type="button"
              onClick={() => setShowStudentList((prev) => !prev)}
              className="premium-lesson-title flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
            >
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
            orderedStepIds={orderedStepIds}
            title="页面知识卡片"
            inlineTool
            layeredDrawerEntries={layeredDrawerEntries}
          />
        </>
      }
      runtimeAttributes={{
        'data-teacher-projection-runtime': 'compact-navigation',
        'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_1_1_LESSON_KEY,
      }}
    >
      <div className="space-y-4">
        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <UNIT_1_1KnowledgeMapVisual /> : null}

        <UNIT_1_1StepContentPanel
          step={step}
          manifest={lessonRuntime.interactiveManifest}
        />

        <div className="mt-4">
          <UNIT_1_1TeacherActivitySummary
            step={step}
            responses={currentResponses}
            released={Boolean(releasedActivities[step.id])}
            answerVisible={Boolean(revealedAnswers[step.id])}
            onToggleRelease={() =>
              setLocalReleasedActivities((prev) => ({
                ...(prev ?? (teacherSyncState as UNIT_1_1TeacherCourseSyncState | null)?.releasedActivities ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as UNIT_1_1TeacherCourseSyncState | null)?.releasedActivities?.[step.id]),
              }))
            }
            onToggleAnswerVisible={() =>
              setLocalRevealedAnswers((prev) => ({
                ...(prev ?? (teacherSyncState as UNIT_1_1TeacherCourseSyncState | null)?.revealedAnswers ?? {}),
                [step.id]: !(prev?.[step.id] ?? (teacherSyncState as UNIT_1_1TeacherCourseSyncState | null)?.revealedAnswers?.[step.id]),
              }))
            }
          />
        </div>
      </div>
    </LessonRuntimeShell>
  );
}

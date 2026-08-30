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
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  isChoiceMultiResponseKind,
  isChoiceSingleResponseKind,
  isMatchingResponseKind,
  isOrderingResponseKind,
} from '@/lib/interactive-response-contracts';
import {
  finalizeUNIT_5_5TeacherSession,
  isUNIT_5_5StudentState,
  isUNIT_5_5TeacherSyncState,
  resolveUNIT_5_5TeacherSyncDraft,
  shouldPostUNIT_5_5TeacherSync,
  UNIT_5_5_LESSON_KEY,
  UNIT_5_5_LESSON_STEPS,
  UNIT_5_5_RESOURCE_KEY,
  UNIT_5_5_SESSION_ADAPTER,
  UNIT_5_5_STAGE_MAP,
  UNIT_5_5_COURSE_TITLE,
  UNIT_5_5_COURSE_SUBTITLE,
  UNIT_5_5_ROUTE_SEGMENT,
  UNIT_5_5_STAGE_LABEL,
  type UNIT_5_5StudentCourseState,
  type UNIT_5_5TeacherCourseSyncState,
} from '@/lib/unit-5-5-course';
import {
  UNIT_5_5StepContentPanel,
  UNIT_5_5TeacherActivitySummary,
} from './step-panels';

type Unit55ObjectiveCard = {
  stepId: string;
  card: InteractiveRuntimeActivityCardManifest;
  expected: string;
  comparison: 'single' | 'ordered' | 'set';
};

function normalizeAnswerToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAnswerList(value: string, comparison: Unit55ObjectiveCard['comparison']) {
  const items = value
    .split(/[|/,，、]/)
    .map(normalizeAnswerToken)
    .filter(Boolean);
  return comparison === 'set' ? [...items].sort() : items;
}

function expectedObjectiveAnswer(card: InteractiveRuntimeActivityCardManifest) {
  if (isMatchingResponseKind(card.responseKind) && card.referenceMatches?.length && card.matchItems?.length) {
    return {
      expected: card.matchItems.map((item) => card.referenceMatches?.find((match) => match.item === item.value)?.option ?? '').join('|'),
      comparison: 'ordered' as const,
    };
  }

  if ((isOrderingResponseKind(card.responseKind) || isMatchingResponseKind(card.responseKind)) && card.options.length) {
    return {
      expected: card.options.map((option) => option.value).join('|'),
      comparison: 'ordered' as const,
    };
  }

  const referenceAnswer = card.referenceAnswer?.trim();
  if (!referenceAnswer) return null;

  if (isChoiceMultiResponseKind(card.responseKind)) {
    return {
      expected: referenceAnswer,
      comparison: 'set' as const,
    };
  }

  if (isChoiceSingleResponseKind(card.responseKind)) {
    return {
      expected: referenceAnswer,
      comparison: 'single' as const,
    };
  }

  return null;
}

function collectObjectiveCards(manifest: InteractiveRuntimeManifest | null | undefined): Unit55ObjectiveCard[] {
  if (!manifest) return [];

  const cards: Unit55ObjectiveCard[] = [];
  for (const step of manifest.steps) {
    const activityCards = step.interactionSpec.activityCards ?? [];
    for (const card of activityCards) {
      const expected = expectedObjectiveAnswer(card);
      if (!expected) continue;
      cards.push({
        stepId: step.id,
        card,
        expected: expected.expected,
        comparison: expected.comparison,
      });
    }
  }
  return cards;
}

function isObjectiveAnswerCorrect(item: Unit55ObjectiveCard, value: string) {
  if (!value.trim()) return false;
  if (item.comparison === 'single') {
    return normalizeAnswerToken(value) === normalizeAnswerToken(item.expected);
  }
  return normalizeAnswerList(value, item.comparison).join('|') === normalizeAnswerList(item.expected, item.comparison).join('|');
}

function revealLayerCount(manifest: InteractiveRuntimeManifest | null | undefined, stepId: string) {
  const contentBlocks = manifest?.steps.find((item) => item.id === stepId)?.contentBlocks;
  const layers = contentBlocks?.reveal_layers ?? contentBlocks?.reveal_steps;
  if (Array.isArray(layers)) return layers.length;
  if (layers && typeof layers === 'object' && Array.isArray((layers as { layers?: unknown[] }).layers)) {
    return (layers as { layers: unknown[] }).layers.length;
  }
  return 0;
}

export function UNIT_5_5TeacherPage({
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
    resourceId: UNIT_5_5_RESOURCE_KEY,
    resourceKey: UNIT_5_5_RESOURCE_KEY,
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
    steps: [...UNIT_5_5_LESSON_STEPS],
    adapter: UNIT_5_5_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_5_RESOURCE_KEY,
    resourceId: UNIT_5_5_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_5_5_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_5_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_5_5TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_5_5TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_5_5TeacherSyncDraft({
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
    if (!shouldPostUNIT_5_5TeacherSync({ loadingSession, teacherViewHydrated })) return;
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
        if (!isUNIT_5_5StudentState(record.data)) return null;
        return {
          studentName: record.data.studentName || record.user?.name?.trim() || '未命名学生',
          state: record.data,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_5_5StudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => Array.from(new Set(studentStates.map((item) => item.studentName))), [studentStates]);
  const submittedStudents = useMemo(
    () => studentStates.filter((item) => Object.keys(item.state.responses).length > 0).length,
    [studentStates],
  );
  const totalResponses = useMemo(
    () => studentStates.reduce((sum, item) => sum + Object.keys(item.state.responses).length, 0),
    [studentStates],
  );
  const trainingCoverage = useMemo(() => {
    if (!studentStates.length) return 0;
    const withTrainingResults = studentStates.filter((item) =>
      Object.values(item.state.responses).some((response) =>
        Object.keys(response.answers).some((key) => key === '__rl_training_result' || key.startsWith('rl_result:')),
      ),
    ).length;
    return Math.round((withTrainingResults / studentStates.length) * 100);
  }, [studentStates]);
  const postTestCompletion = useMemo(() => {
    if (!studentStates.length) return 0;
    const completed = studentStates.filter((item) => Boolean(item.state.responses['step-16'])).length;
    return Math.round((completed / studentStates.length) * 100);
  }, [studentStates]);
  const objectiveCards = useMemo(() => collectObjectiveCards(runtimeManifest), [runtimeManifest]);
  const objectiveAccuracy = useMemo(() => {
    let checked = 0;
    let correct = 0;
    for (const student of studentStates) {
      for (const item of objectiveCards) {
        const answer = student.state.responses[item.stepId]?.answers[item.card.id] ?? '';
        if (!answer.trim()) continue;
        checked += 1;
        if (isObjectiveAnswerCorrect(item, answer)) correct += 1;
      }
    }
    return checked ? Math.round((correct / checked) * 100) : 0;
  }, [objectiveCards, studentStates]);
  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_5_5StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const advanceReveal = useCallback(() => {
    setLocalTeacherRevealProgress((prev) => {
      const base = prev ?? teacherSyncState?.teacherRevealProgress ?? {};
      const layerCount = revealLayerCount(runtimeManifest, step.id);
      const maxProgress = Math.max(0, layerCount - 1);
      return {
        ...base,
        [step.id]: Math.min(maxProgress, (base[step.id] ?? 0) + 1),
      };
    });
  }, [runtimeManifest, step.id, teacherSyncState?.teacherRevealProgress]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = UNIT_5_5_LESSON_STEPS[nextIndex];
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_5_5_STAGE_MAP[nextStep.stage],
      });
    },
    [patchCurrentStep],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!(await requestClassroomEndConfirmation())) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_5_5TeacherSession({
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
        title={UNIT_5_5_COURSE_TITLE}
        subtitle={UNIT_5_5_COURSE_SUBTITLE}
        routeSegment={UNIT_5_5_ROUTE_SEGMENT}
      />
    );
  }

  return (
    <LessonRuntimeShell
        mode="teacher"
        title={UNIT_5_5_COURSE_TITLE}
        subtitle={UNIT_5_5_COURSE_SUBTITLE}
        routeSegment={UNIT_5_5_ROUTE_SEGMENT}
        sessionId={sessionId}
        steps={UNIT_5_5_LESSON_STEPS}
        activeIndex={activeIndex}
        stageLabel={UNIT_5_5_STAGE_LABEL}
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
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、发放作答、推进显影并显示参考解释。</div>
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
            orderedStepIds={UNIT_5_5_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
            inlineTool
          />
          </>
        }
        runtimeAttributes={{
          'data-teacher-projection-runtime': 'compact-navigation',
          'data-runtime-manifest-truth': lessonRuntime.interactiveManifest?.lessonId ?? UNIT_5_5_LESSON_KEY,
        }}
      >
        <div className="space-y-4">
          {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <UNIT_5_5StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={true}
          mode="teacher"
          totalStudents={joinedStudents.length}
          submittedStudents={submittedStudents}
          totalResponses={totalResponses}
          trainingCoverage={trainingCoverage}
          objectiveAccuracy={objectiveAccuracy}
          postTestCompletion={postTestCompletion}
        />

        <div className="mt-4">
          <UNIT_5_5TeacherActivitySummary
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
        </div>
      </LessonRuntimeShell>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
import { getInteractiveRevealLayerCount } from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  finalizeUNIT_5_3TeacherSession,
  isUNIT_5_3StudentState,
  isUNIT_5_3TeacherSyncState,
  resolveUNIT_5_3TeacherSyncDraft,
  shouldPostUNIT_5_3TeacherSync,
  UNIT_5_3_LESSON_KEY,
  UNIT_5_3_LESSON_STEPS,
  UNIT_5_3_RESOURCE_KEY,
  UNIT_5_3_SESSION_ADAPTER,
  UNIT_5_3_STAGE_MAP,
  type UNIT_5_3StudentCourseState,
  type UNIT_5_3TeacherCourseSyncState,
} from '@/lib/unit-5-3-course';
import { UNIT_5_3CourseHeader } from './course-header';
import {
  UNIT_5_3StepContentPanel,
  UNIT_5_3TeacherActivitySummary,
} from './step-panels';

type Unit53ObjectiveCard = {
  stepId: string;
  card: InteractiveRuntimeActivityCardManifest;
  expected: string;
  comparison: 'single' | 'ordered' | 'set';
  misconceptionTag?: string;
};

const UNIT_5_3_MISCONCEPTION_LABELS: Record<string, string> = {
  state_point_confusion: '状态点语义误判',
  sine_parameter_confusion: '正弦参数误判',
  low_pass_confusion: '低通滤波误判',
  tool_choice_error: '分析工具选择误判',
  formula_range_missing: '公式适用范围缺失',
  intersection_equals_cycle: '交点即自振误判',
};

function normalizeAnswerToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAnswerList(value: string, comparison: Unit53ObjectiveCard['comparison']) {
  const items = value
    .split(/[|,，、]/)
    .map(normalizeAnswerToken)
    .filter(Boolean);
  return comparison === 'set' ? [...items].sort() : items;
}

function expectedObjectiveAnswer(card: InteractiveRuntimeActivityCardManifest) {
  if ((card.responseKind === 'drag_sort' || card.responseKind === 'drag_match') && card.options.length) {
    return {
      expected: card.options.map((option) => option.value).join('|'),
      comparison: 'ordered' as const,
    };
  }

  const referenceAnswer = card.referenceAnswer?.trim();
  if (!referenceAnswer) return null;

  if (card.responseKind === 'multi_select' || card.responseKind === 'multi_choice') {
    return {
      expected: referenceAnswer,
      comparison: 'set' as const,
    };
  }

  if (card.responseKind === 'single_choice' || card.responseKind === 'binary_choice') {
    return {
      expected: referenceAnswer,
      comparison: 'single' as const,
    };
  }

  return null;
}

function collectObjectiveCards(manifest: InteractiveRuntimeManifest | null | undefined): Unit53ObjectiveCard[] {
  if (!manifest) return [];

  const cards: Unit53ObjectiveCard[] = [];
  for (const step of manifest.steps) {
    const tags = step.telemetrySpec.misconceptionTags;
    const activityCards = step.interactionSpec.activityCards ?? [];
    for (let index = 0; index < activityCards.length; index += 1) {
      const card = activityCards[index];
      const expected = expectedObjectiveAnswer(card);
      if (!expected) continue;
      cards.push({
        stepId: step.id,
        card,
        expected: expected.expected,
        comparison: expected.comparison,
        misconceptionTag: tags[index] ?? tags[0],
      });
    }
  }
  return cards;
}

function isObjectiveAnswerCorrect(item: Unit53ObjectiveCard, value: string) {
  if (!value.trim()) return false;
  if (item.comparison === 'single') {
    return normalizeAnswerToken(value) === normalizeAnswerToken(item.expected);
  }
  return normalizeAnswerList(value, item.comparison).join('|') === normalizeAnswerList(item.expected, item.comparison).join('|');
}

function misconceptionLabel(tag: string) {
  return UNIT_5_3_MISCONCEPTION_LABELS[tag] ?? tag;
}

export function UNIT_5_3TeacherPage({
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
    resourceId: UNIT_5_3_RESOURCE_KEY,
    resourceKey: UNIT_5_3_RESOURCE_KEY,
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
    steps: [...UNIT_5_3_LESSON_STEPS],
    adapter: UNIT_5_3_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_3_RESOURCE_KEY,
    resourceId: UNIT_5_3_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_5_3_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_3_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_5_3TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_5_3TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_5_3TeacherSyncDraft({
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
    if (!shouldPostUNIT_5_3TeacherSync({ loadingSession, teacherViewHydrated })) return;
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
        if (!isUNIT_5_3StudentState(record.data)) return null;
        return {
          studentName: record.data.studentName || record.user?.name?.trim() || '未命名学生',
          state: record.data,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_5_3StudentCourseState }>;
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
  const turningCoverage = useMemo(() => {
    if (!studentStates.length) return 0;
    const withParameters = studentStates.filter((item) =>
      Object.values(item.state.responses).some((response) => Boolean(response.answers.__turning_parameters)),
    ).length;
    return Math.round((withParameters / studentStates.length) * 100);
  }, [studentStates]);
  const postTestCompletion = useMemo(() => {
    if (!studentStates.length) return 0;
    const completed = studentStates.filter((item) => Boolean(item.state.responses['step-14'])).length;
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
  const misconceptionSummary = useMemo(() => {
    if (!studentStates.length) return '暂无聚合';
    const counts = new Map<string, number>();

    for (const student of studentStates) {
      for (const item of objectiveCards) {
        const answer = student.state.responses[item.stepId]?.answers[item.card.id] ?? '';
        if (!answer.trim() || isObjectiveAnswerCorrect(item, answer)) continue;
        if (item.misconceptionTag) {
          counts.set(item.misconceptionTag, (counts.get(item.misconceptionTag) ?? 0) + 1);
        }
      }
    }

    const summary = Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
      .slice(0, 3)
      .map(([tag, count]) => `${misconceptionLabel(tag)} ${count}`);
    return summary.length ? summary.join(' / ') : '暂无高频误判';
  }, [objectiveCards, studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_5_3StudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  const advanceReveal = useCallback(() => {
    setLocalTeacherRevealProgress((prev) => {
      const base = prev ?? teacherSyncState?.teacherRevealProgress ?? {};
      const stepManifest = runtimeManifest?.steps.find((item) => item.id === step.id);
      const layerCount = stepManifest ? getInteractiveRevealLayerCount(stepManifest) : 0;
      const maxProgress = Math.max(0, layerCount - 1);
      return {
        ...base,
        [step.id]: Math.min(maxProgress, (base[step.id] ?? 0) + 1),
      };
    });
  }, [runtimeManifest, step.id, teacherSyncState?.teacherRevealProgress]);

  const handlePatchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = UNIT_5_3_LESSON_STEPS[nextIndex];
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_5_3_STAGE_MAP[nextStep.stage],
      });
    },
    [patchCurrentStep],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!window.confirm('确定要结束课堂吗？结束后学生将停止同步课堂进度。')) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_5_3TeacherSession({
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
      <UNIT_5_3CourseHeader
        steps={UNIT_5_3_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_3_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="premium-lesson-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="premium-lesson-kicker">教师课堂台</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">
                课堂码：{sessionInfo?.joinCode ?? '------'}
              </div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、发放作答、推进显影并显示参考解释。</div>
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

        <UNIT_5_3StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={true}
          role="teacher"
          studentCount={joinedStudents.length}
          submittedStudents={submittedStudents}
          totalResponses={totalResponses}
          turningCoverage={turningCoverage}
          objectiveAccuracy={objectiveAccuracy}
          postTestCompletion={postTestCompletion}
          misconceptionSummary={misconceptionSummary}
          onAdvanceReveal={advanceReveal}
        />

        <div className="mt-4">
          <UNIT_5_3TeacherActivitySummary
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

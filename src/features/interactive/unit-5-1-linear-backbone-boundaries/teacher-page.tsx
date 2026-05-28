'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useTeacherLessonSession } from '@/features/interactive/session-framework';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { TeacherJoinQrDialog } from '@/features/interactive/shared/teacher-join-qr-dialog';
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
  finalizeUNIT_5_1TeacherSession,
  isUNIT_5_1TeacherSyncState,
  resolveUNIT_5_1TeacherSyncDraft,
  shouldPostUNIT_5_1TeacherSync,
  UNIT_5_1_LESSON_KEY,
  UNIT_5_1_LESSON_STEPS,
  UNIT_5_1_RESOURCE_KEY,
  UNIT_5_1_SESSION_ADAPTER,
  UNIT_5_1_STAGE_MAP,
  type UNIT_5_1StudentCourseState,
  type UNIT_5_1TeacherCourseSyncState,
} from '@/lib/unit-5-1-course';
import { UNIT_5_1CourseHeader } from './course-header';
import { UNIT_5_1StepContentPanel, UNIT_5_1TeacherActivitySummary } from './step-panels';

type Unit51ObjectiveCard = {
  stepId: string;
  card: InteractiveRuntimeActivityCardManifest;
  expected: string;
  comparison: 'single' | 'ordered' | 'set';
  misconceptionTag?: string;
};

const UNIT_5_1_OBJECTIVE_STEP_IDS = new Set(['step-03', 'step-13']);
const UNIT_5_1_MISCONCEPTION_LABELS: Record<string, string> = {
  model_range_overgeneralization: '模型适用范围外推',
  superposition_error: '叠加原理误判',
  parameter_reuse_error: '固定参数复用误判',
  boundary_type_error: '边界类型匹配误判',
  linearization_rule_error: '线性化条件误判',
  boundary_note_incomplete: '边界说明不完整',
};

function normalizeAnswerToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeChoiceLetters(text: string) {
  const match = text.match(/选\s*([A-Za-z、,，\s和]+)/);
  if (!match) return [];
  return (match[1].match(/[A-Za-z]/g) ?? []).map((letter) => letter.toLowerCase());
}

function normalizeAnswerList(value: string, comparison: Unit51ObjectiveCard['comparison']) {
  const items = value.split('|').map(normalizeAnswerToken).filter(Boolean);
  return comparison === 'set' ? [...items].sort() : items;
}

function expectedObjectiveAnswer(card: InteractiveRuntimeActivityCardManifest) {
  if ((isOrderingResponseKind(card.responseKind) || isMatchingResponseKind(card.responseKind)) && card.options.length) {
    return {
      expected: card.options.map((option) => option.value).join('|'),
      comparison: 'ordered' as const,
    };
  }

  if (isChoiceMultiResponseKind(card.responseKind)) {
    const values = normalizeChoiceLetters(card.referenceAnswer ?? '');
    return values.length
      ? { expected: values.join('|'), comparison: 'set' as const }
      : null;
  }

  if (isChoiceSingleResponseKind(card.responseKind)) {
    const [value] = normalizeChoiceLetters(card.referenceAnswer ?? '');
    return value ? { expected: value, comparison: 'single' as const } : null;
  }

  return null;
}

function collectObjectiveCards(manifest: InteractiveRuntimeManifest | null | undefined): Unit51ObjectiveCard[] {
  if (!manifest) return [];

  const cards: Unit51ObjectiveCard[] = [];
  for (const step of manifest.steps) {
    if (!UNIT_5_1_OBJECTIVE_STEP_IDS.has(step.id)) continue;
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
        misconceptionTag: tags[index],
      });
    }
  }
  return cards;
}

function isObjectiveAnswerCorrect(item: Unit51ObjectiveCard, value: string) {
  if (!value.trim()) return false;
  if (item.comparison === 'single') {
    return normalizeAnswerToken(value) === normalizeAnswerToken(item.expected);
  }
  return normalizeAnswerList(value, item.comparison).join('|') === normalizeAnswerList(item.expected, item.comparison).join('|');
}

function misconceptionLabel(tag: string) {
  return UNIT_5_1_MISCONCEPTION_LABELS[tag] ?? tag;
}

function tagForCard(manifest: InteractiveRuntimeManifest | null | undefined, stepId: string, cardId: string) {
  const step = manifest?.steps.find((item) => item.id === stepId);
  const cardIndex = step?.interactionSpec.activityCards?.findIndex((card) => card.id === cardId) ?? -1;
  return cardIndex >= 0 ? step?.telemetrySpec.misconceptionTags[cardIndex] : undefined;
}

function revealLayerCount(manifest: InteractiveRuntimeManifest | null | undefined, stepId: string) {
  const layers = manifest?.steps.find((item) => item.id === stepId)?.contentBlocks.reveal_layers;
  if (Array.isArray(layers)) return layers.length;
  if (layers && typeof layers === 'object' && Array.isArray((layers as { layers?: unknown[] }).layers)) {
    return (layers as { layers: unknown[] }).layers.length;
  }
  return 0;
}

export function UNIT_5_1TeacherPage({
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
    resourceId: UNIT_5_1_RESOURCE_KEY,
    resourceKey: UNIT_5_1_RESOURCE_KEY,
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
    steps: [...UNIT_5_1_LESSON_STEPS],
    adapter: UNIT_5_1_SESSION_ADAPTER,
  });

  const { trackSessionFinalize, trackStepLeave, trackStepView, trackSyncError } = useCourseEventTracking({
    resourceKey: UNIT_5_1_RESOURCE_KEY,
    resourceId: UNIT_5_1_RESOURCE_KEY,
    sessionId,
    lessonKey: UNIT_5_1_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = UNIT_5_1_LESSON_STEPS[activeIndex];
  const runtimeManifest = lessonRuntime.interactiveManifest;

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isUNIT_5_1TeacherSyncState(record.data));
    return (latestRecord?.data as UNIT_5_1TeacherCourseSyncState | null) ?? null;
  }, [teacherStates]);

  const { revealedAnswers, releasedActivities, browseEnabled, teacherRevealProgress } = useMemo(
    () =>
      resolveUNIT_5_1TeacherSyncDraft({
        localRevealedAnswers,
        localReleasedActivities,
        localBrowseEnabled,
        localTeacherRevealProgress,
        teacherSyncState,
      }),
    [localBrowseEnabled, localRevealedAnswers, localReleasedActivities, localTeacherRevealProgress, teacherSyncState],
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
    if (error) trackSyncError(step.id, { message: error, scope: 'teacher-page', ...(errorTelemetry ?? {}) });
  }, [error, errorTelemetry, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostUNIT_5_1TeacherSync({ loadingSession, teacherViewHydrated })) return;
    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
      releasedActivities,
      browseEnabled,
      teacherRevealProgress,
    });
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
        if (!record.data || typeof record.data !== 'object') return null;
        const data = record.data as {
          kind?: string;
          version?: number;
          studentName?: string;
          responses?: Record<string, unknown>;
        };
        if (data.kind !== 'unit51_student_state' || data.version !== 1) return null;
        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as UNIT_5_1StudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: UNIT_5_1StudentCourseState }>;
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
  const parameterCoverage = useMemo(() => {
    if (!studentStates.length) return 0;
    const withParameters = studentStates.filter((item) =>
      Object.values(item.state.responses).some((response) => Boolean(response.answers.__boundary_parameters)),
    ).length;
    return Math.round((withParameters / studentStates.length) * 100);
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
  const shortAnswerCompleteness = useMemo(() => {
    const notes = studentStates
      .map((item) => item.state.responses['step-13']?.answers['boundary-note'])
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    if (!notes.length) return 0;
    const completed = notes.filter((value) => value.trim().length >= 40).length;
    return Math.round((completed / notes.length) * 100);
  }, [studentStates]);
  const misconceptionSummary = useMemo(() => {
    if (!studentStates.length) return '暂无聚合';
    const counts = new Map<string, number>();
    const boundaryNoteTag = tagForCard(runtimeManifest, 'step-13', 'boundary-note') ?? 'boundary_note_incomplete';

    for (const student of studentStates) {
      for (const item of objectiveCards) {
        const answer = student.state.responses[item.stepId]?.answers[item.card.id] ?? '';
        if (!answer.trim() || isObjectiveAnswerCorrect(item, answer)) continue;
        if (item.misconceptionTag) {
          counts.set(item.misconceptionTag, (counts.get(item.misconceptionTag) ?? 0) + 1);
        }
      }

      const boundaryNote = student.state.responses['step-13']?.answers['boundary-note'] ?? '';
      if (!boundaryNote.trim() || boundaryNote.trim().length < 40) {
        counts.set(boundaryNoteTag, (counts.get(boundaryNoteTag) ?? 0) + 1);
      }
    }

    const summary = Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
      .slice(0, 3)
      .map(([tag, count]) => `${misconceptionLabel(tag)} ${count}`);
    return summary.length ? summary.join(' / ') : '暂无高频误判';
  }, [objectiveCards, runtimeManifest, studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: UNIT_5_1StudentCourseState['responses'][string] }>;
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
      const nextStep = UNIT_5_1_LESSON_STEPS[nextIndex];
      trackStepLeave(step.id, { nextStepId: nextStep.id });
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: UNIT_5_1_STAGE_MAP[nextStep.stage],
      });
      trackStepView(nextStep.id, { pageType: nextStep.pageType, stepIndex: nextIndex });
    },
    [patchCurrentStep, step.id, trackStepLeave, trackStepView],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) return;
    if (!window.confirm('确定要结束课堂吗？结束后学生将停止同步课堂进度。')) return;

    setEndingSession(true);
    try {
      await finalizeUNIT_5_1TeacherSession({
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
      <UNIT_5_1CourseHeader
        steps={UNIT_5_1_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void handlePatchCurrentStep(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={UNIT_5_1_LESSON_STEPS.map((item) => item.id)}
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

        <UNIT_5_1StepContentPanel
          step={step}
          manifest={runtimeManifest}
          revealProgress={teacherRevealProgress[step.id] ?? 0}
          allowInlineReveal={true}
          role="teacher"
          studentCount={joinedStudents.length}
          submittedStudents={submittedStudents}
          totalResponses={totalResponses}
          parameterCoverage={parameterCoverage}
          objectiveAccuracy={objectiveAccuracy}
          shortAnswerCompleteness={shortAnswerCompleteness}
          misconceptionSummary={misconceptionSummary}
          onAdvanceReveal={advanceReveal}
        />

        <div className="mt-4">
          <UNIT_5_1TeacherActivitySummary
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

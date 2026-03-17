'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  finalizeL2DTeacherSession,
  isL2DTeacherSyncState,
  L2D_LESSON_KEY,
  L2D_LESSON_STEPS,
  L2D_RESOURCE_KEY,
  resolveL2DTeacherRevealedAnswers,
  L2D_SESSION_ADAPTER,
  L2D_STAGE_MAP,
  shouldPostL2DTeacherSync,
  type L2DStudentCourseState,
} from '@/lib/l2d-course';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { buildSessionEndReturnHref } from '@/lib/classroom-session-end';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useCourseEventTracking, useTeacherLessonSession } from '@/features/interactive/session-framework';
import { L2DCourseHeader } from './course-header';
import { L2DStepContentPanel, L2DKnowledgeMapVisual, L2DTeacherActivitySummary } from './step-panels';
import { L2DThreeDomainWorkspace, type WorkspaceParameterChange } from './workspace';

function areRevealedAnswersEqual(left: Record<string, boolean>, right: Record<string, boolean>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

export function L2DTeacherPage({
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
  const [workspaceGain, setWorkspaceGain] = useState(1);

  const interactiveTracking = useInteractiveTracking({
    resourceId: L2D_RESOURCE_KEY,
    resourceKey: L2D_RESOURCE_KEY,
    sessionId,
  });

  const {
    sessionInfo,
    courseStates,
    teacherStates,
    activeIndex,
    loadingSession,
    error,
    teacherViewHydrated,
    patchCurrentStep,
    postTeacherSyncInput,
    finishSession,
  } = useTeacherLessonSession({
    sessionId,
    steps: L2D_LESSON_STEPS,
    adapter: L2D_SESSION_ADAPTER,
  });

  const {
    trackSessionFinalize,
    trackStepLeave,
    trackStepView,
    trackSyncError,
    trackWorkspaceParamChange,
  } = useCourseEventTracking({
    resourceKey: L2D_RESOURCE_KEY,
    resourceId: L2D_RESOURCE_KEY,
    sessionId,
    lessonKey: L2D_LESSON_KEY,
    actorRole: 'teacher',
    emit: interactiveTracking.emit,
  });

  const step = L2D_LESSON_STEPS[activeIndex] ?? L2D_LESSON_STEPS[0];
  const previousStepIdRef = useRef<string | null>(null);

  const teacherSyncState = useMemo(() => {
    const latestRecord = [...teacherStates].reverse().find((record) => isL2DTeacherSyncState(record.data));
    return latestRecord && isL2DTeacherSyncState(latestRecord.data) ? latestRecord.data : null;
  }, [teacherStates]);

  const revealedAnswers = useMemo(
    () =>
      resolveL2DTeacherRevealedAnswers({
        localRevealedAnswers,
        teacherSyncState,
      }),
    [localRevealedAnswers, teacherSyncState],
  );

  useEffect(() => {
    if (loadingSession) {
      return;
    }

    const previousStepId = previousStepIdRef.current;
    if (previousStepId && previousStepId !== step.id) {
      trackStepLeave(previousStepId, {
        nextStepId: step.id,
      });
    }

    trackStepView(step.id, {
      pageType: step.pageType,
      stepIndex: activeIndex,
    });
    previousStepIdRef.current = step.id;
  }, [activeIndex, loadingSession, step.id, step.pageType, trackStepLeave, trackStepView]);

  useEffect(() => {
    if (!error) {
      return;
    }

    trackSyncError(step.id, {
      message: error,
      scope: 'teacher-page',
    });
  }, [error, step.id, trackSyncError]);

  useEffect(() => {
    if (!shouldPostL2DTeacherSync({ loadingSession, teacherViewHydrated })) {
      return;
    }

    void postTeacherSyncInput({
      activeStepId: step.id,
      revealedAnswers,
    });
  }, [loadingSession, postTeacherSyncInput, revealedAnswers, step.id, teacherViewHydrated]);

  const studentStates = useMemo(() => {
    return courseStates
      .map((record) => {
        const data = record.data as Partial<L2DStudentCourseState> | null;
        if (data?.kind !== 'l2d_student_state') {
          return null;
        }

        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as L2DStudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: L2DStudentCourseState }>;
  }, [courseStates]);

  const joinedStudents = useMemo(() => {
    const names = new Set(studentStates.map((item) => item.studentName));
    return Array.from(names);
  }, [studentStates]);

  const handleStepChange = useCallback(
    async (nextIndex: number) => {
      const nextStep = L2D_LESSON_STEPS[nextIndex];
      await patchCurrentStep(nextIndex, {
        currentItemId: nextStep.id,
        currentStage: L2D_STAGE_MAP[nextStep.stage],
      });
    },
    [patchCurrentStep],
  );

  const handleWorkspaceParameterChange = useCallback(
    (change: WorkspaceParameterChange) => {
      trackWorkspaceParamChange(step.id, {
        gain: change.gain,
        source: change.source,
      });
    },
    [step.id, trackWorkspaceParamChange],
  );

  const handleEndSession = useCallback(async () => {
    if (!sessionInfo) {
      return;
    }
    if (!window.confirm('确定要结束课堂吗？结束后学生将停止同步课堂进度。')) {
      return;
    }

    setEndingSession(true);
    try {
      await finalizeL2DTeacherSession({
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
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <L2DCourseHeader
        steps={L2D_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={(index) => void handleStepChange(index)}
        middleNotice={`课堂码 ${sessionInfo?.joinCode ?? '------'} · ${step.hint}`}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={L2D_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="premium-lesson-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="premium-lesson-kicker">Teacher Console</div>
              <div className="premium-lesson-title mt-2 text-lg font-semibold">课堂码：{sessionInfo?.joinCode ?? '------'}</div>
              <div className="premium-lesson-muted mt-1 text-sm">教师可推进步骤、查看提交统计，并在需要时揭示选择题答案。</div>
            </div>
            <button type="button" onClick={() => void handleEndSession()} disabled={endingSession} className="premium-lesson-action-tone premium-tone-rose">
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

        {step.id === 'step-01' ? <L2DKnowledgeMapVisual /> : null}

        <L2DStepContentPanel content={step.teacher} />

        {step.pageType === 'workspace' ? (
          <div className="mt-4">
            <L2DThreeDomainWorkspace
              gain={workspaceGain}
              onGainChange={setWorkspaceGain}
              accentLabel={`教师示教 · ${step.observationId ?? '自由探索'}`}
              onParameterChange={handleWorkspaceParameterChange}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <L2DTeacherActivitySummary
            stepId={step.id}
            studentStates={studentStates}
            answerVisible={Boolean(revealedAnswers[step.id])}
            onToggleAnswerVisible={() =>
              setLocalRevealedAnswers((prev) => {
                const baseAnswers = prev ?? revealedAnswers;
                const nextAnswers = {
                  ...baseAnswers,
                  [step.id]: !baseAnswers[step.id],
                };
                return areRevealedAnswersEqual(baseAnswers, nextAnswers) ? baseAnswers : nextAnswers;
              })
            }
          />
        </div>
      </main>
    </div>
  );
}

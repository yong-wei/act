'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  buildL2DAttemptKey,
  getCourseTotals,
  L2D_LESSON_KEY,
  L2D_LESSON_STEPS,
  L2D_RESOURCE_KEY,
  L2D_SESSION_ADAPTER,
  resolveL2DStudentSummaryCourseState,
  scoreReflection,
  scoreTaskOne,
  scoreTaskTwoRow,
  type L2DReflectionSubmission,
  type L2DStudentCourseState,
  type L2DTaskOneSubmission,
  type L2DTaskTwoRowSubmission,
} from '@/lib/l2d-course';
import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useCourseEventTracking, useStudentLessonSession } from '@/features/interactive/session-framework';
import { L2DCourseHeader } from './course-header';
import { L2DStepContentPanel, L2DKnowledgeMapVisual, L2DStudentActivityForm, L2DStudentSummaryPanel } from './step-panels';
import { L2DThreeDomainWorkspace, type WorkspaceMetrics, type WorkspaceParameterChange } from './workspace';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { getStepAIContext, getL2DStepAIContext } from '@/lib/course-ai-contexts';

export function L2DStudentPage({
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

  const [activeIndex, setActiveIndex] = useState(0);
  const [workspaceGain, setWorkspaceGain] = useState(1);
  const [workspaceMetrics, setWorkspaceMetrics] = useState<WorkspaceMetrics>({
    gain: 1,
    sigma: -0.5,
    omega: 0.5,
    mp: 5,
    ts: 5,
    gamma: 60,
    isStable: true,
  });

  // AI助手已通过全局框架集成，获取更新上下文的方法
  const { updatePageContext } = useGlobalAI();

  const interactiveTracking = useInteractiveTracking({
    resourceId: L2D_RESOURCE_KEY,
    resourceKey: L2D_RESOURCE_KEY,
    userId: currentUserId,
    sessionId: isDemo ? undefined : sessionId,
  });

  const {
    sessionInfo,
    loadingSession,
    error,
    courseState,
    teacherSyncState,
    teacherIndex,
    saveCourseState,
  } = useStudentLessonSession({
    sessionId,
    steps: L2D_LESSON_STEPS,
    adapter: L2D_SESSION_ADAPTER,
    currentStudentName,
    currentUserId,
    isDemo,
    demoStepId,
  });

  const {
    trackCourseEvent,
    trackStepLeave,
    trackStepView,
    trackSyncError,
    trackWorkspaceParamChange,
  } = useCourseEventTracking({
    resourceKey: L2D_RESOURCE_KEY,
    resourceId: L2D_RESOURCE_KEY,
    sessionId: isDemo ? null : sessionId,
    lessonKey: L2D_LESSON_KEY,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });

  const activeIndexInitializedRef = useRef(false);
  const previousStepIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeIndexInitializedRef.current || isDemo) {
      setActiveIndex((prev) => {
        if (prev === teacherIndex && activeIndexInitializedRef.current && !isDemo) {
          return prev;
        }
        return teacherIndex;
      });
      activeIndexInitializedRef.current = true;
    }
  }, [isDemo, teacherIndex]);

  const step = L2D_LESSON_STEPS[activeIndex] ?? L2D_LESSON_STEPS[0];

  // 当步骤变化时，更新AI上下文
  useEffect(() => {
    const stepContext = getL2DStepAIContext(step.id);
    if (stepContext) {
      updatePageContext({
        courseId: stepContext.courseId,
        courseTitle: stepContext.courseTitle,
        pageType: stepContext.pageType,
        stepId: stepContext.stepId,
        topic: stepContext.topic,
        learningObjectives: stepContext.learningObjectives,
        knowledgeType: stepContext.knowledgeType,
        tools: stepContext.tools,
        quickQuestions: stepContext.quickQuestions,
        systemPromptExtension: stepContext.systemPromptExtension,
      });
    }
  }, [step.id, updatePageContext]);

  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;
  const answerVisible = teacherSyncState?.activeStepId === step.id ? Boolean(teacherSyncState.revealedAnswers?.[step.id]) : false;
  const summaryCourseState = resolveL2DStudentSummaryCourseState({
    frozenSummary: null,
    fallbackState: courseState,
  });

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
      scope: 'student-page',
    });
  }, [error, step.id, trackSyncError]);

  const updateWorkspaceMetrics = useCallback((metrics: WorkspaceMetrics) => {
    setWorkspaceGain(metrics.gain);
    setWorkspaceMetrics(metrics);
  }, []);

  const handleWorkspaceParameterChange = useCallback(
    (change: WorkspaceParameterChange) => {
      trackWorkspaceParamChange(step.id, {
        gain: change.gain,
        source: change.source,
      });
    },
    [step.id, trackWorkspaceParamChange],
  );

  const trackSubmission = useCallback(
    (input: {
      stepId: string;
      submissionKey: string;
      isResubmit: boolean;
      data?: Record<string, unknown>;
    }) => {
      const submittedAt = Date.now();
      const attemptKey = buildL2DAttemptKey({
        stepId: input.stepId,
        submissionKey: input.submissionKey,
        submittedAt,
      });

      trackCourseEvent(
        input.isResubmit ? COURSE_EVENT_TYPES.LESSON_RESUBMIT : COURSE_EVENT_TYPES.LESSON_SUBMIT,
        {
          stepId: input.stepId,
          attemptKey,
          clientEventAt: submittedAt,
          data: {
            submissionKey: input.submissionKey,
            ...input.data,
          },
        },
      );

      return submittedAt;
    },
    [trackCourseEvent],
  );

  const handleSavePreAssessment = useCallback(
    async (answers: Record<string, string>) => {
      const isResubmit = Boolean(courseState.preAssessment);
      const submittedAt = Date.now();
      await saveCourseState((prev) => ({
        ...prev,
        preAssessment: { answers, submittedAt },
        updatedAt: submittedAt,
      }));
      trackSubmission({
        stepId: step.id,
        submissionKey: 'pre-assessment',
        isResubmit,
        data: {
          questionCount: Object.keys(answers).length,
          submittedAt,
        },
      });
    },
    [courseState.preAssessment, saveCourseState, step.id, trackSubmission],
  );

  const handleSaveTaskOne = useCallback(
    async (input: Omit<L2DTaskOneSubmission, 'score' | 'feedback' | 'submittedAt'>) => {
      const previousSubmission = courseState.taskOne;
      const result = scoreTaskOne(input.kCritical);
      const submittedAt = Date.now();

      await saveCourseState((prev) => ({
        ...prev,
        taskOne:
          !prev.taskOne || result.score >= prev.taskOne.score
            ? {
                ...input,
                score: result.score,
                feedback: result.feedback,
                submittedAt,
              }
            : prev.taskOne,
        updatedAt: submittedAt,
      }));

      trackSubmission({
        stepId: step.id,
        submissionKey: 'task-one',
        isResubmit: Boolean(previousSubmission),
        data: {
          score: result.score,
          bestScore: Math.max(previousSubmission?.score ?? 0, result.score),
          submittedAt,
        },
      });
    },
    [courseState.taskOne, saveCourseState, step.id, trackSubmission],
  );

  const handleSaveTaskTwoRow = useCallback(
    async (row: Omit<L2DTaskTwoRowSubmission, 'score' | 'checks' | 'feedback' | 'submittedAt'>) => {
      const previousSubmission = courseState.taskTwoRows[row.rowId];
      const previousRowIndex = ['row-1', 'row-2', 'row-3', 'row-4'].indexOf(row.rowId) - 1;
      const previousRow =
        previousRowIndex >= 0 ? courseState.taskTwoRows[['row-1', 'row-2', 'row-3', 'row-4'][previousRowIndex]] : undefined;
      const result = scoreTaskTwoRow(row, previousRow ?? null);
      const submittedAt = Date.now();

      await saveCourseState((prev) => {
        const existingRow = prev.taskTwoRows[row.rowId];
        const nextRow: L2DTaskTwoRowSubmission = {
          ...row,
          score: result.score,
          checks: result.checks,
          feedback: result.feedback,
          submittedAt,
        };

        return {
          ...prev,
          taskTwoRows: {
            ...prev.taskTwoRows,
            [row.rowId]: !existingRow || nextRow.score >= existingRow.score ? nextRow : existingRow,
          },
          updatedAt: submittedAt,
        };
      });

      trackSubmission({
        stepId: step.id,
        submissionKey: `task-two:${row.rowId}`,
        isResubmit: Boolean(previousSubmission),
        data: {
          rowId: row.rowId,
          score: result.score,
          bestScore: Math.max(previousSubmission?.score ?? 0, result.score),
          submittedAt,
        },
      });
    },
    [courseState.taskTwoRows, saveCourseState, step.id, trackSubmission],
  );

  const handleSaveReflection = useCallback(
    async (input: Omit<L2DReflectionSubmission, 'score' | 'feedback' | 'submittedAt'>) => {
      const previousSubmission = courseState.reflection;
      const result = scoreReflection(input);
      const submittedAt = Date.now();

      await saveCourseState((prev) => ({
        ...prev,
        reflection: {
          ...input,
          score: result.score,
          feedback: result.feedback,
          submittedAt,
        },
        updatedAt: submittedAt,
      }));

      trackSubmission({
        stepId: step.id,
        submissionKey: 'reflection',
        isResubmit: Boolean(previousSubmission),
        data: {
          score: result.score,
          selectedOption: input.selectedOption,
          submittedAt,
        },
      });
    },
    [courseState.reflection, saveCourseState, step.id, trackSubmission],
  );

  const handleSavePostAssessment = useCallback(
    async (range: { lowerBound: string; upperBound: string }) => {
      const isResubmit = Boolean(courseState.postAssessment);
      const submittedAt = Date.now();

      await saveCourseState((prev) => ({
        ...prev,
        postAssessment: {
          ...range,
          submittedAt,
        },
        updatedAt: submittedAt,
      }));

      trackSubmission({
        stepId: step.id,
        submissionKey: 'post-assessment',
        isResubmit,
        data: {
          submittedAt,
          lowerBound: range.lowerBound,
          upperBound: range.upperBound,
        },
      });
    },
    [courseState.postAssessment, saveCourseState, step.id, trackSubmission],
  );

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <div className="premium-lesson-shell px-3 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="premium-lesson-panel text-center">
            <p className="premium-lesson-title text-lg font-semibold">课堂已结束</p>
            <p className="premium-lesson-muted mt-2">教师已结束课堂，本页面保留你的学习记录与成绩概览。</p>
          </div>
          <L2DStudentSummaryPanel courseState={summaryCourseState} />
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <L2DCourseHeader
        steps={L2D_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
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
        {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button type="button" onClick={() => setActiveIndex(teacherIndex)} className="premium-lesson-action-tone premium-tone-amber">
              跳到教师当前页
            </button>
          </div>
        ) : null}

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <L2DKnowledgeMapVisual /> : null}

        <L2DStepContentPanel content={step.student} />

        {step.pageType === 'workspace' ? (
          <div className="mt-4">
            <L2DThreeDomainWorkspace
              gain={workspaceGain}
              onGainChange={setWorkspaceGain}
              accentLabel={step.observationId ?? undefined}
              onMetricsChange={updateWorkspaceMetrics}
              onParameterChange={handleWorkspaceParameterChange}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <L2DStudentActivityForm
            stepId={step.id}
            activity={step.student.activity}
            courseState={courseState}
            metrics={workspaceMetrics}
            answerVisible={answerVisible}
            onSavePreAssessment={(answers) => void handleSavePreAssessment(answers)}
            onSaveTaskOne={(input) => void handleSaveTaskOne(input)}
            onSaveTaskTwoRow={(row) => void handleSaveTaskTwoRow(row)}
            onSaveReflection={(input) => void handleSaveReflection(input)}
            onSavePostAssessment={(range) => void handleSavePostAssessment(range)}
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <L2DStudentSummaryPanel courseState={summaryCourseState} />
          </div>
        ) : null}

        <div className="sr-only">{getCourseTotals(summaryCourseState).total}</div>
      </main>
    </div>
  );
}

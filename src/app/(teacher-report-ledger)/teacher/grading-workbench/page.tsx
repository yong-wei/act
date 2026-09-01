import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import {
  TeacherDocumentGradingEmptyState,
  TeacherDocumentGradingWorkbench,
  TeacherDocumentGradingUnavailableState,
} from '@/features/assessment/document-rubric-grading-ui';
import { buildDocumentRubricDemoViews } from '@/features/assessment/document-rubric-grading-demo';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildTeacherGradingWorkbenchView,
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
} from '@/features/teacher/document-rubric-grading-workbench';
import {
  buildPipelineGradingWorkbenchView,
  assertPipelineReviewActor,
  isPipelineRunReviewable,
  PIPELINE_GRADING_REVIEW_INCLUDE,
  pipelineReviewScope,
  PipelineReviewContentUnavailableError,
  validatePipelineReviewContract,
  validatePipelineRuntimeSource,
} from '@/lib/data-governance/math-document-grading-review';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import {
  buildTeacherGradingMissingRunState,
  buildTeacherGradingRouteState,
  normalizeTeacherGradingRouteQuery,
} from '@/lib/teacher-report-grading-contracts';

export const dynamic = 'force-dynamic';

export default async function TeacherGradingWorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{
    gradingRunId?: string;
    demo?: string;
    action?: string;
    method?: string;
    status?: string;
    classId?: string;
    studentId?: string;
    assignment?: string;
    sessionId?: string;
    lessonId?: string;
    reportId?: string;
    source?: string;
    returnTo?: string;
  }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const routeQuery = normalizeTeacherGradingRouteQuery(params ?? {});
  const routeState = buildTeacherGradingRouteState(routeQuery);
  if (params?.demo === '1') {
    const { teacherView } = await buildDocumentRubricDemoViews();
    return <TeacherDocumentGradingWorkbench view={{ ...teacherView, gradingRunId: null }} routeState={routeState} />;
  }
  if (!params?.gradingRunId) {
    return <TeacherDocumentGradingEmptyState routeState={routeState} />;
  }

  const pipelineRun = await prisma.gradingRun.findUnique({
    where: { id: params.gradingRunId },
    include: PIPELINE_GRADING_REVIEW_INCLUDE,
  });
  if (pipelineRun) {
    try {
      await assertPipelineReviewActor({ db: prisma, run: pipelineRun, actor: { id: session.user.id, role: session.user.role } });
    } catch { redirect('/dashboard'); }
    const assignmentScope = pipelineReviewScope(pipelineRun);
    const submissionId = pipelineRun.answerAttempt?.answer?.submission?.id;
    if (assignmentScope.assignmentId && submissionId && pipelineRun.questionId) {
      const query = new URLSearchParams({
        questionId: pipelineRun.questionId,
        gradingRunId: pipelineRun.id,
        mode: 'student',
      });
      if (params?.returnTo) query.set('returnTo', params.returnTo);
      redirect(`/teacher/assignments/${encodeURIComponent(assignmentScope.assignmentId)}/submissions/${encodeURIComponent(submissionId)}/review?${query.toString()}`);
    }
    if (pipelineRun.state === 'CONTENT_UNAVAILABLE') return <TeacherDocumentGradingUnavailableState reasons={[...(pipelineRun.blockedReasons ?? []), ...(pipelineRun.limitations ?? []), 'rerun-required']} />;
    const scope = pipelineReviewScope(pipelineRun);
    const studentProfile = await prisma.studentProfile.findFirst({
      where: { classId: scope.classId, userId: scope.studentId },
      select: { id: true },
    });
    if (!studentProfile) return <TeacherDocumentGradingEmptyState routeState={routeState} />;
    if (!isPipelineRunReviewable(pipelineRun)) return <TeacherDocumentGradingUnavailableState reasons={['grading-run-not-reviewable']} />;
    try {
      const reasons = [...validatePipelineReviewContract(pipelineRun), ...await validatePipelineRuntimeSource(pipelineRun, createSubmissionObjectStore())];
      if (reasons.length > 0) return <TeacherDocumentGradingUnavailableState reasons={reasons} />;
      return <TeacherDocumentGradingWorkbench view={buildPipelineGradingWorkbenchView(pipelineRun)} routeState={routeState} />;
    } catch (error) {
      if (error instanceof PipelineReviewContentUnavailableError) return <TeacherDocumentGradingUnavailableState reasons={error.reasons} />;
      throw error;
    }
  }

  const draft = await prisma.learningEvidenceDraft.findFirst({
    where: {
      id: params.gradingRunId,
      sourceType: 'document_rubric_grading',
    },
  });
  if (!draft) {
    return <TeacherDocumentGradingEmptyState routeState={buildTeacherGradingMissingRunState(routeQuery)} />;
  }

  const parsed = parsePersistedDocumentRubricGradingDraft(draft);
  if (!parsed) {
    return <TeacherDocumentGradingEmptyState routeState={routeState} />;
  }
  const invariants = validateDocumentRubricGradingDraftInvariants({ draft, parsed });
  if (!invariants.valid) {
    return <TeacherDocumentGradingEmptyState routeState={routeState} />;
  }

  const classData = await prisma.class.findUnique({
    where: { id: parsed.goalContext.classId },
    select: { teacherId: true },
  });
  if (!classData || (session.user.role !== UserRole.ADMIN && classData.teacherId !== session.user.id)) {
    redirect('/dashboard');
  }

  const studentProfile = await prisma.studentProfile.findFirst({
    where: {
      classId: parsed.goalContext.classId,
      userId: draft.ownerUserId,
    },
    select: { id: true },
  });
  if (!studentProfile) {
    return <TeacherDocumentGradingEmptyState routeState={routeState} />;
  }

  const teacherView = buildTeacherGradingWorkbenchView({
    asset: parsed.asset,
    convertedDocument: parsed.convertedDocument,
    rubric: parsed.rubric,
    run: parsed.run,
  });
  return <TeacherDocumentGradingWorkbench view={teacherView} routeState={routeState} />;
}

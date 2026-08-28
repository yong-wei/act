import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/platform/app-shell';
import { StudentDocumentGradingFeedback } from '@/features/assessment/document-rubric-grading-ui';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildFeedbackTaskContext,
  resolveVerifiedTeacherInterventionId,
  type FeedbackTaskQuery,
} from '@/lib/student-feedback-task-contract';
import { createHiddenStudentGradingFeedbackView } from '@/lib/data-governance/document-rubric-grading-workbench';

export const dynamic = 'force-dynamic';

function renderDocumentFeedbackShell(
  view: Parameters<typeof StudentDocumentGradingFeedback>[0]['view'],
  feedbackContext: ReturnType<typeof buildFeedbackTaskContext>,
) {
  return (
    <AppShell
      viewerRole="student"
      title="报告反馈"
      subtitle="查看教师审核后的评分证据与后续行动"
      activeHref="/assessment/document-feedback"
      sidebarMode="collapsible"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '报告反馈' }]}
      className="surface-page"
    >
      <StudentDocumentGradingFeedback view={view} feedbackContext={feedbackContext} />
    </AppShell>
  );
}

export default async function DocumentFeedbackPage({
  searchParams,
}: {
  searchParams?: Promise<{ gradingRunId?: string; demo?: string } & FeedbackTaskQuery>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }
  if (session.user.role !== UserRole.STUDENT) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const verifiedTeacherInterventionId = await resolveVerifiedTeacherInterventionId({
    db: prisma,
    userId: session.user.id,
    teacherInterventionId: params?.teacherInterventionId,
    assignment: params?.assignment,
  });
  const feedbackContext = buildFeedbackTaskContext(params ?? {}, { verifiedTeacherInterventionId });
  if (params?.gradingRunId) {
    const approved = await prisma.teacherAssignmentApprovalSnapshot.findUnique({
      where: { gradingRunId: params.gradingRunId },
      include: { submission: true, outboxCommands: true },
    });
    const released = approved?.outboxCommands.some((command) => command.command === 'RELEASE_STUDENT_FEEDBACK' && command.state === 'SUCCEEDED');
    if (approved && released && approved.submission.studentId === session.user.id && approved.submission.frozenStudentId === session.user.id) {
      const query = new URLSearchParams({ feedbackQuestionId: approved.questionId });
      const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
      if (returnTo) query.set('returnTo', returnTo);
      redirect(`/missions/assignments/${encodeURIComponent(approved.assignmentId)}?${query.toString()}#feedback-question-${encodeURIComponent(approved.questionId)}`);
    }
  }
  return renderDocumentFeedbackShell(createHiddenStudentGradingFeedbackView({ studentId: session.user.id }), feedbackContext);
}

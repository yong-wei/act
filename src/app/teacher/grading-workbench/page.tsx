import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import {
  TeacherDocumentGradingEmptyState,
  TeacherDocumentGradingWorkbench,
} from '@/features/assessment/document-rubric-grading-ui';
import { buildDocumentRubricDemoViews } from '@/features/assessment/document-rubric-grading-demo';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildTeacherGradingWorkbenchView,
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
} from '@/lib/data-governance/document-rubric-grading-workbench';

export const dynamic = 'force-dynamic';

export default async function TeacherGradingWorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{ gradingRunId?: string; demo?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  if (params?.demo === '1') {
    const { teacherView } = await buildDocumentRubricDemoViews();
    return <TeacherDocumentGradingWorkbench view={{ ...teacherView, gradingRunId: null }} />;
  }
  if (!params?.gradingRunId) {
    return <TeacherDocumentGradingEmptyState />;
  }

  const draft = await prisma.learningEvidenceDraft.findFirst({
    where: {
      id: params.gradingRunId,
      sourceType: 'document_rubric_grading',
    },
  });
  if (!draft) {
    return <TeacherDocumentGradingEmptyState />;
  }

  const parsed = parsePersistedDocumentRubricGradingDraft(draft);
  if (!parsed) {
    return <TeacherDocumentGradingEmptyState />;
  }
  const invariants = validateDocumentRubricGradingDraftInvariants({ draft, parsed });
  if (!invariants.valid) {
    return <TeacherDocumentGradingEmptyState />;
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
    return <TeacherDocumentGradingEmptyState />;
  }

  const teacherView = buildTeacherGradingWorkbenchView({
    asset: parsed.asset,
    convertedDocument: parsed.convertedDocument,
    rubric: parsed.rubric,
    run: parsed.run,
  });
  return <TeacherDocumentGradingWorkbench view={teacherView} />;
}

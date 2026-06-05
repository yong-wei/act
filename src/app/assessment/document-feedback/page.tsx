import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { StudentDocumentGradingFeedback } from '@/features/assessment/document-rubric-grading-ui';
import { buildDocumentRubricDemoViews } from '@/features/assessment/document-rubric-grading-demo';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildStudentGradingFeedbackView,
  createHiddenStudentGradingFeedbackView,
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
} from '@/lib/data-governance/document-rubric-grading-workbench';

export const dynamic = 'force-dynamic';

export default async function DocumentFeedbackPage({
  searchParams,
}: {
  searchParams?: Promise<{ gradingRunId?: string; demo?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }
  if (session.user.role !== UserRole.STUDENT) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  if (params?.demo === '1') {
    const { studentView } = await buildDocumentRubricDemoViews({
      studentId: session.user.id,
      viewerStudentId: session.user.id,
    });
    return <StudentDocumentGradingFeedback view={studentView} />;
  }
  if (!params?.gradingRunId) {
    return <StudentDocumentGradingFeedback view={createHiddenStudentGradingFeedbackView({ studentId: session.user.id })} />;
  }

  const draft = await prisma.learningEvidenceDraft.findFirst({
    where: {
      id: params.gradingRunId,
      ownerUserId: session.user.id,
      sourceType: 'document_rubric_grading',
    },
  });
  const parsed = draft ? parsePersistedDocumentRubricGradingDraft(draft) : null;
  const valid = draft && parsed
    ? validateDocumentRubricGradingDraftInvariants({ draft, parsed }).valid
    : false;
  const studentView = parsed
    && valid
    ? buildStudentGradingFeedbackView({
        asset: parsed.asset,
        convertedDocument: parsed.convertedDocument,
        rubric: parsed.rubric,
        run: parsed.run,
        viewerStudentId: session.user.id,
      })
    : createHiddenStudentGradingFeedbackView({ studentId: session.user.id });
  return <StudentDocumentGradingFeedback view={studentView} />;
}

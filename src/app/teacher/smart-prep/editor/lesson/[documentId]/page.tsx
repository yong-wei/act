import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { LessonDocumentEditor } from '@/features/teacher/preparation-document-editor/lesson-document-editor';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';

export const dynamic = 'force-dynamic';

export default async function LessonPreparationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ kind?: string; taskId?: string }>;
}) {
  const { documentId } = await params;
  const session = await getServerAuthSession();
  if (!session?.user) redirect(buildLoginRedirectForPath(`/teacher/smart-prep/editor/lesson/${documentId}`));
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
  const query = await searchParams;
  const kind = query.kind === 'outline' ? 'outline' : 'draft';
  return <LessonDocumentEditor kind={kind} documentId={documentId} returnTaskId={query.taskId} />;
}

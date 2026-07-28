import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { LessonDocumentEditor } from '@/features/teacher/preparation-document-editor/lesson-document-editor';
import { getServerAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LessonPreparationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ kind?: string; taskId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
  const [{ documentId }, query] = await Promise.all([params, searchParams]);
  const kind = query.kind === 'outline' ? 'outline' : 'draft';
  return <LessonDocumentEditor kind={kind} documentId={documentId} returnTaskId={query.taskId} />;
}

import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { CourseBasisDocumentEditor } from '@/features/teacher/preparation-document-editor/course-basis-document-editor';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';

export const dynamic = 'force-dynamic';

export default async function CourseBasisPreparationEditorPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  const session = await getServerAuthSession();
  if (!session?.user) redirect(buildLoginRedirectForPath(`/teacher/smart-prep/editor/course-basis/${versionId}`));
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
  return <CourseBasisDocumentEditor versionId={versionId} />;
}

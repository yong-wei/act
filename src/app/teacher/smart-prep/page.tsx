import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { CourseBasisWorkspace } from '@/features/teacher/course-basis-workspace';
import { getServerAuthSession } from '@/lib/auth';
import { listCourseBases } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SmartPrepPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const courseBases = await listCourseBases(prisma, { id: session.user.id, role: 'TEACHER' });
  return <CourseBasisWorkspace initialCourseBases={courseBases} />;
}

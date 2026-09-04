import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { prisma } from '@/lib/prisma';

export default async function LegacyTeacherStudentDiagnosisPage(
  props: {
    params: Promise<{ studentId: string }>;
  }
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect(await buildLoginRedirectFromRequest());
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const { studentId } = await props.params;
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      classId: true,
      class: {
        select: {
          teacherId: true,
        },
      },
    },
  });

  if (
    studentProfile?.classId
    && (session.user.role === 'ADMIN' || studentProfile.class?.teacherId === session.user.id)
  ) {
    redirect(`/teacher/classes/${encodeURIComponent(studentProfile.classId)}/students/${encodeURIComponent(studentId)}`);
  }

  redirect('/teacher/classes');
}

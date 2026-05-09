import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';

export async function redirectInactiveStudentSessionToLessonEntry(
  sessionId: string,
  lessonEntryPath: string,
) {
  if (sessionId === 'demo') {
    return;
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!classSession || classSession.status === 'FINISHED') {
    redirect(lessonEntryPath);
  }
}

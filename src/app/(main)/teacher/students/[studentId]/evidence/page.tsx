import { redirect } from 'next/navigation';
import Link from 'next/link';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState } from '@/lib/action-status-contract';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { prisma } from '@/lib/prisma';
import { resolveTeacherReturnTo } from '@/lib/teacher-report-grading-contracts';

export default async function LegacyTeacherStudentEvidencePage(
  props: {
    params: Promise<{ studentId: string }>;
    searchParams?: Promise<{
      returnTo?: string;
      gradingRunId?: string;
      reportId?: string;
      source?: string;
    }>;
  }
) {
  const { studentId } = await props.params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect(buildLoginRedirectForPath(`/teacher/students/${studentId}/evidence`));
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const searchParams = await props.searchParams;
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
    const query = new URLSearchParams();
    query.set('returnTo', resolveTeacherReturnTo(searchParams?.returnTo, '/teacher/classes'));
    appendSearchParam(query, 'gradingRunId', searchParams?.gradingRunId);
    appendSearchParam(query, 'reportId', searchParams?.reportId);
    appendSearchParam(query, 'source', searchParams?.source);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    redirect(`/teacher/classes/${encodeURIComponent(studentProfile.classId)}/students/${encodeURIComponent(studentId)}/evidence${suffix}`);
  }

  const blockedState = createAuditedActionState({
    identity: {
      id: `teacher-student-evidence:${studentId}:missing`,
      category: 'unsupported-action',
      label: '教师学生证据',
      sourceRoute: '/teacher/students/[studentId]/evidence',
      targetId: studentId,
      requestedAction: 'open-evidence',
    },
    status: 'blocked',
    message: `学生 ${studentId} 不存在，或不在当前教师可见范围。`,
    recoveryAction: '返回班级列表选择可见学生',
    httpStatus: 404,
  });

  return (
    <main className="surface-page">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-5 px-6 py-10">
        <ActionStatusPanel state={blockedState} />
        <Link href="/teacher/classes" className="btn-ghost-themed w-fit rounded-lg px-4 py-2 text-sm">
          返回班级列表
        </Link>
      </div>
    </main>
  );
}

function appendSearchParam(query: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    query.set(key, value);
  }
}

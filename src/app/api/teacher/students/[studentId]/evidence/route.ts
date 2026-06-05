import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  listEvidenceTimeline,
  parseEvidenceTimelineFilters,
} from '@/lib/data-governance/evidence-timeline';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { studentId } = await params;
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teacherId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!studentProfile?.class) {
      return NextResponse.json({ error: '学生不在可诊断班级中' }, { status: 404 });
    }

    if (studentProfile.class.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const page = await listEvidenceTimeline({
      db: prisma,
      userId: studentId,
      filters: parseEvidenceTimelineFilters(new URL(request.url).searchParams),
      viewerRole: session.user.role === 'ADMIN' ? 'admin' : 'teacher',
      restrictedFallbackAction: {
        href: `/teacher/students/${encodeURIComponent(studentId)}/evidence`,
        label: '留在学生证据审核',
      },
    });

    return NextResponse.json({
      student: {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        classId: studentProfile.class.id,
        className: studentProfile.class.name,
      },
      ...page,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherLegacyStudentEvidence] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

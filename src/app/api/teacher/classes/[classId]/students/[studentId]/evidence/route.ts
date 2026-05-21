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
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId, studentId } = await params;
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, teacherId: true },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: { classId, userId: studentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
    }

    const page = await listEvidenceTimeline({
      db: prisma,
      userId: studentId,
      filters: parseEvidenceTimelineFilters(new URL(request.url).searchParams),
    });

    return NextResponse.json({
      student: {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        classId,
        className: classData.name,
      },
      ...page,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherStudentEvidence] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

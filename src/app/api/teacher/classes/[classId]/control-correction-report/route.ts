import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  buildControlCorrectionTeacherReport,
  buildControlCorrectionTeacherReportExport,
  CONTROL_CORRECTION_REPORT_GOAL_ID,
} from '@/features/teacher/control-correction-teacher-report';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;
    const url = new URL(request.url);
    const wantsExport = url.searchParams.get('export') === 'true';
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        teacherId: true,
        students: {
          select: {
            userId: true,
            studentNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const students = classData.students.map((student) => ({
      userId: student.userId,
      name: student.user.name || '未命名学生',
      email: student.user.email,
      studentNumber: student.studentNumber ?? null,
    }));
    const studentIds = students.map((student) => student.userId);
    const [paths, snapshots, featureCaches] = await Promise.all([
      studentIds.length
        ? prisma.learningPath.findMany({
            where: {
              classId,
              goalId: CONTROL_CORRECTION_REPORT_GOAL_ID,
              userId: { in: studentIds },
            },
            orderBy: { updatedAt: 'desc' },
            include: {
              executions: { orderBy: { createdAt: 'asc' } },
              correctionDecisions: {
                orderBy: { createdAt: 'asc' },
                select: {
                  decision: true,
                  createdAt: true,
                  applicationResult: true,
                },
              },
              deviations: { orderBy: { createdAt: 'asc' } },
              interventions: { orderBy: { createdAt: 'asc' } },
            },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.studentCompetencySnapshot.findMany({
            where: { userId: { in: studentIds } },
            orderBy: { snapshotAt: 'desc' },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.studentEvidenceFeatureCache.findMany({
            where: { userId: { in: studentIds } },
            select: {
              userId: true,
              payloadVersion: true,
              refreshedAt: true,
              statusMarkers: true,
              features: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const report = buildControlCorrectionTeacherReport({
      classInfo: {
        id: classData.id,
        name: classData.name,
        studentCount: students.length,
      },
      students,
      paths,
      snapshots,
      featureCaches,
    });

    return NextResponse.json({
      report,
      ...(wantsExport ? { export: buildControlCorrectionTeacherReportExport(report) } : {}),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse('控制校正教师报告');
    }
    console.error('[ControlCorrectionTeacherReport] Error:', error);
    return NextResponse.json({ error: '读取控制校正教师报告失败' }, { status: 500 });
  }
}

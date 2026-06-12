import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { buildIntelligentTeachingAssistantEffectReportExport } from '@/lib/data-governance/intelligent-teaching-assistant-demo-package';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
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
    const effectReport = buildIntelligentTeachingAssistantEffectReportExport();
    if (classId !== effectReport.classId) {
      return NextResponse.json({ error: '演示效果报告不存在' }, { status: 404 });
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    return NextResponse.json({ effectReport });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse('智能助教演示效果报告');
    }
    console.error('[AssistantEffectReport] Error:', error);
    return NextResponse.json({ error: '读取智能助教演示效果报告失败' }, { status: 500 });
  }
}

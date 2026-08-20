import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  preflightDiagnosisGeneration,
  projectDiagnosisGenerationPreflight,
} from '@/lib/diagnosis-generation-preflight';
import { diagnosisGenerationErrorResponse } from '@/lib/diagnosis-generation';
import { DiagnosisReportScopeError } from '@/lib/diagnosis-persistence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

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
    if (session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    const { classId } = await params;
    const targetStudentId = new URL(request.url).searchParams.get('studentId');
    const preflight = await preflightDiagnosisGeneration(prisma, {
      teacherId: session.user.id,
      classId,
      targetStudentId,
    });
    return NextResponse.json({ preflight: projectDiagnosisGenerationPreflight(preflight) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisReportScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const generationResponse = diagnosisGenerationErrorResponse(error);
    if (generationResponse) {
      return NextResponse.json(generationResponse.body, { status: generationResponse.status });
    }
    console.error('[DiagnosisReports] Preflight failed:', error);
    return NextResponse.json({ error: '读取诊断生成预检失败' }, { status: 500 });
  }
}

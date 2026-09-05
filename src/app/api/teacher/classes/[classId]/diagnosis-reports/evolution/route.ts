import { NextResponse } from 'next/server';

import { createDiagnosisEvolutionReader } from '@/features/teacher/diagnosis/adapters/diagnosis-evolution-reader';
import { readTeacherDiagnosisReportEvolution } from '@/features/teacher/diagnosis/application/read-report-evolution';
import { getServerAuthSession } from '@/lib/auth';
import { DiagnosisReportScopeError } from '@/lib/diagnosis-persistence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

/**
 * 班级诊断报告演变读取（Issue #1963）：只返回生成时冻结的指标快照，
 * 授权与 scope 校验在读取函数内 fail closed，不做任何重算。
 */
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
    const rawLimit = new URL(request.url).searchParams.get('limit');
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    if (rawLimit && (!Number.isInteger(limit) || Number(limit) < 1)) {
      return NextResponse.json({ error: 'limit 必须为正整数' }, { status: 400 });
    }

    const payload = await readTeacherDiagnosisReportEvolution({
      reader: createDiagnosisEvolutionReader(),
      teacherId: session.user.id,
      classId,
      limit,
    });
    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisReportScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[DiagnosisEvolution] Read failed:', error);
    return NextResponse.json({ error: '读取诊断报告演变失败' }, { status: 500 });
  }
}

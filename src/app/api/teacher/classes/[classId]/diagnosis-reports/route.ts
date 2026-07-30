import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  DiagnosisReportScopeError,
  persistDiagnosisReport,
  readDiagnosisReports,
} from '@/lib/diagnosis-persistence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

function scopeErrorResponse(error: unknown) {
  if (error instanceof DiagnosisReportScopeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: '诊断报告结构无效' }, { status: 400 });
  }
  return null;
}

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
    const searchParams = new URL(request.url).searchParams;
    const targetStudentId = searchParams.get('studentId');
    const rawLimit = searchParams.get('limit');
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    if (rawLimit && (!Number.isInteger(limit) || Number(limit) < 1)) {
      return NextResponse.json({ error: 'limit 必须为正整数' }, { status: 400 });
    }

    const reports = await readDiagnosisReports({
      teacherId: session.user.id,
      classId,
      targetStudentId,
      limit,
    });
    return NextResponse.json({ reports });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const scopeResponse = scopeErrorResponse(error);
    if (scopeResponse) return scopeResponse;
    console.error('[DiagnosisReports] Read failed:', error);
    return NextResponse.json({ error: '读取诊断报告失败' }, { status: 500 });
  }
}

export async function POST(
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
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '请求体无效' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const report = await persistDiagnosisReport({
      teacherId: session.user.id,
      classId,
      targetStudentId: typeof input.targetStudentId === 'string' ? input.targetStudentId : null,
      reportBody: input.reportBody as Parameters<typeof persistDiagnosisReport>[0]['reportBody'],
      riskSummary: input.riskSummary && typeof input.riskSummary === 'object' && !Array.isArray(input.riskSummary)
        ? input.riskSummary as Record<string, unknown>
        : null,
      generatorVersion: typeof input.generatorVersion === 'string' ? input.generatorVersion : undefined,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const scopeResponse = scopeErrorResponse(error);
    if (scopeResponse) return scopeResponse;
    console.error('[DiagnosisReports] Write failed:', error);
    return NextResponse.json({ error: '保存诊断报告失败' }, { status: 500 });
  }
}

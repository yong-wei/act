import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  DiagnosisReportScopeError,
  readDiagnosisReports,
  type DiagnosisReportReadModel,
} from '@/lib/diagnosis-persistence';
import {
  diagnosisGenerationErrorResponse,
  diagnosisGenerationRequestSchema,
  projectDiagnosisGenerationJob,
  startDiagnosisGenerationJob,
} from '@/lib/diagnosis-generation';
import { enqueueDiagnosisGenerationJob } from '@/lib/diagnosis-generation-queue';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export type DiagnosisReportApiItem = Omit<
  DiagnosisReportReadModel,
  'evidenceCutoff' | 'generatedAt'
> & {
  evidenceCutoff: string;
  generatedAt: string;
};

export interface DiagnosisReportsPayload {
  reports: DiagnosisReportApiItem[];
}

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
    const payload: DiagnosisReportsPayload = {
      reports: reports.map((report) => ({
        ...report,
        evidenceCutoff: report.evidenceCutoff.toISOString(),
        generatedAt: report.generatedAt.toISOString(),
      })),
    };
    return NextResponse.json(payload);
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
    const input = diagnosisGenerationRequestSchema.parse(body);
    const job = await startDiagnosisGenerationJob(prisma, {
      teacherId: session.user.id,
      classId,
      targetStudentId: input.targetStudentId ?? null,
      idempotencyKey: input.idempotencyKey,
    });
    const delivery = job.state === 'QUEUED'
      ? await enqueueDiagnosisGenerationJob(prisma, job.id)
      : { job, errorCode: null };
    const deliveredJob = delivery.job ?? job;
    return NextResponse.json(
      {
        job: projectDiagnosisGenerationJob(deliveredJob as Parameters<typeof projectDiagnosisGenerationJob>[0]),
        ...(delivery.errorCode ? { error: delivery.errorCode } : {}),
      },
      { status: delivery.errorCode ? 503 : 202 },
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const scopeResponse = scopeErrorResponse(error);
    if (scopeResponse) return scopeResponse;
    const generationResponse = diagnosisGenerationErrorResponse(error);
    if (generationResponse) return NextResponse.json(generationResponse.body, { status: generationResponse.status });
    console.error('[DiagnosisReports] Generation request failed:', error);
    return NextResponse.json({ error: '创建诊断生成任务失败' }, { status: 500 });
  }
}

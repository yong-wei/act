import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  diagnosisGenerationErrorResponse,
  diagnosisGenerationRetrySchema,
  getDiagnosisGenerationJob,
  projectDiagnosisGenerationJob,
  retryDiagnosisGenerationJob,
} from '@/lib/diagnosis-generation';
import { enqueueDiagnosisGenerationJob } from '@/lib/diagnosis-generation-queue';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function requireTeacher(): Promise<
  | { response: NextResponse }
  | { teacherId: string }
> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { response: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  if (session.user.role !== 'TEACHER') return { response: NextResponse.json({ error: '权限不足' }, { status: 403 }) };
  return { teacherId: session.user.id };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireTeacher();
  if ('response' in auth) return auth.response;
  try {
    const job = await getDiagnosisGenerationJob(prisma, {
      teacherId: auth.teacherId,
      jobId: (await params).jobId,
    });
    return NextResponse.json({ job: projectDiagnosisGenerationJob(job) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = diagnosisGenerationErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('[DiagnosisGenerationJobs] Read failed:', error);
    return NextResponse.json({ error: '读取诊断生成任务失败' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireTeacher();
  if ('response' in auth) return auth.response;
  try {
    const input = diagnosisGenerationRetrySchema.parse(await request.json());
    const job = await retryDiagnosisGenerationJob(prisma, {
      teacherId: auth.teacherId,
      jobId: (await params).jobId,
      idempotencyKey: input.idempotencyKey,
    });
    const delivery = await enqueueDiagnosisGenerationJob(prisma, job.id);
    const deliveredJob = delivery.job ?? job;
    return NextResponse.json(
      {
        job: projectDiagnosisGenerationJob(deliveredJob as Parameters<typeof projectDiagnosisGenerationJob>[0]),
        ...(delivery.errorCode ? { error: delivery.errorCode } : {}),
      },
      { status: delivery.errorCode ? 503 : 200 },
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = diagnosisGenerationErrorResponse(error);
    if (response) return NextResponse.json(response.body, { status: response.status });
    console.error('[DiagnosisGenerationJobs] Retry failed:', error);
    return NextResponse.json({ error: '重试诊断生成任务失败' }, { status: 500 });
  }
}

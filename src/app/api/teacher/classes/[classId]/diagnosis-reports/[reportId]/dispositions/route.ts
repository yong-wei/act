import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  DiagnosisDeliveryError,
  diagnosisDispositionInputSchema,
  recordDiagnosisDisposition,
} from '@/lib/diagnosis-report-delivery';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string; reportId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (session.user.role !== 'TEACHER') return NextResponse.json({ error: '权限不足' }, { status: 403 });
    const { classId, reportId } = await params;
    const disposition = diagnosisDispositionInputSchema.parse(await request.json());
    const event = await recordDiagnosisDisposition({
      teacherId: session.user.id,
      classId,
      reportId,
      disposition,
    });
    return NextResponse.json({ event: { ...event, createdAt: event.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: '处置请求无效，请检查目标、动作和幂等标识。' }, { status: 400 });
    }
    if (error instanceof DiagnosisDeliveryError) {
      return NextResponse.json({ error: dispositionMessage(error.code), code: error.code }, { status: error.status });
    }
    console.error('[DiagnosisDelivery] Disposition failed:', error);
    return NextResponse.json({ error: '处置记录失败，请稍后重试。' }, { status: 500 });
  }
}

function dispositionMessage(code: string) {
  if (code === 'diagnosis-disposition-action-ref-required') return '安排干预必须引用现有且已授权的行动入口。';
  if (code === 'diagnosis-disposition-action-ref-forbidden') return '行动引用不存在或当前账号无权访问。';
  if (code === 'diagnosis-disposition-target-invalid') return '处置目标不属于当前固定报告。';
  return '无法记录处置，报告不存在或当前账号无权访问。';
}

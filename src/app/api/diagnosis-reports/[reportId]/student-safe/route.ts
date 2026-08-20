import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { DiagnosisDeliveryError, readStudentDiagnosisDelivery } from '@/lib/diagnosis-report-delivery';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (session.user.role !== 'STUDENT') return NextResponse.json({ error: '权限不足' }, { status: 403 });
    const { reportId } = await params;
    return NextResponse.json(await readStudentDiagnosisDelivery({ studentId: session.user.id, reportId }));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisDeliveryError) {
      return NextResponse.json({ error: '报告不存在或不属于当前学生。' }, { status: error.status });
    }
    console.error('[DiagnosisDelivery] Student read failed:', error);
    return NextResponse.json({ error: '读取个人诊断报告失败，请稍后重试。' }, { status: 500 });
  }
}

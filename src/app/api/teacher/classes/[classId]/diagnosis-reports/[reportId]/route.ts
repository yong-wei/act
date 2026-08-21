import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { DiagnosisDeliveryError, readTeacherDiagnosisDelivery } from '@/lib/diagnosis-report-delivery';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string; reportId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (session.user.role !== 'TEACHER') return NextResponse.json({ error: '权限不足' }, { status: 403 });
    const { classId, reportId } = await params;
    const role = new URL(request.url).searchParams.get('role') === 'student' ? 'student' : 'teacher';
    const delivery = await readTeacherDiagnosisDelivery({
      teacherId: session.user.id,
      classId,
      reportId,
      role,
    });
    return NextResponse.json({
      ...delivery,
      dispositionEvents: delivery.dispositionEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisDeliveryError) {
      return NextResponse.json({ error: deliveryMessage(error.code), code: error.code }, { status: error.status });
    }
    console.error('[DiagnosisDelivery] Teacher read failed:', error);
    return NextResponse.json({ error: '读取诊断交付报告失败，请稍后重试。' }, { status: 500 });
  }
}

function deliveryMessage(code: string) {
  if (code === 'student-projection-unavailable') return '班级报告不能推导个人学生安全版，请选择学生范围报告。';
  if (code === 'diagnosis-delivery-student-not-current') return '目标学生已不属于当前班级，学生安全版暂不可交付。';
  return '诊断报告不存在或当前账号无权访问。';
}

import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { DiagnosisDeliveryError, exportTeacherDiagnosisPdf } from '@/lib/diagnosis-report-delivery';
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
    const artifact = await exportTeacherDiagnosisPdf({
      teacherId: session.user.id,
      classId,
      reportId,
      role,
    });
    const label = role === 'student' ? 'student-safe' : 'teacher';
    return new NextResponse(artifact.bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(artifact.bytes.byteLength),
        'Content-Disposition': `attachment; filename="diagnosis-${reportId}-${label}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Diagnosis-Artifact-Id': artifact.artifactId,
        'X-Diagnosis-Content-Hash': artifact.contentHash,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisDeliveryError) {
      return NextResponse.json({ error: pdfErrorMessage(error.code), code: error.code }, { status: error.status });
    }
    console.error('[DiagnosisDelivery] Teacher PDF failed:', error);
    return NextResponse.json({ error: 'PDF 生成失败，请返回报告后重试。' }, { status: 500 });
  }
}

function pdfErrorMessage(code: string) {
  return code === 'student-projection-unavailable'
    ? '班级报告不能导出学生安全版，请选择学生范围报告。'
    : 'PDF 导出失败，报告不存在或当前账号无权访问。';
}

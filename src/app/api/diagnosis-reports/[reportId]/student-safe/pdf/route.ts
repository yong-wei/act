import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { DiagnosisDeliveryError, exportStudentDiagnosisPdf } from '@/lib/diagnosis-report-delivery';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (session.user.role !== 'STUDENT') return NextResponse.json({ error: '权限不足' }, { status: 403 });
    const { reportId } = await params;
    const artifact = await exportStudentDiagnosisPdf({ studentId: session.user.id, reportId });
    return new NextResponse(artifact.bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(artifact.bytes.byteLength),
        'Content-Disposition': `attachment; filename="diagnosis-${reportId}-student-safe.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Diagnosis-Artifact-Id': artifact.artifactId,
        'X-Diagnosis-Content-Hash': artifact.contentHash,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof DiagnosisDeliveryError) {
      return NextResponse.json({ error: '报告不存在或不属于当前学生。' }, { status: error.status });
    }
    console.error('[DiagnosisDelivery] Student PDF failed:', error);
    return NextResponse.json({ error: 'PDF 生成失败，请返回报告后重试。' }, { status: 500 });
  }
}

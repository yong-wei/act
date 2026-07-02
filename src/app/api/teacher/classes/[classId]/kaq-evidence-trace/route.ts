import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  loadTeacherKaqEvidenceTracePayloadForUser,
  TeacherKaqEvidenceTraceRequestError,
} from '@/lib/data-governance/teacher-kaq-evidence-trace-server';

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

    const { classId } = await params;
    const payload = await loadTeacherKaqEvidenceTracePayloadForUser({
      sessionUser: {
        id: session.user.id,
        role: session.user.role,
      },
      classId,
      searchParams: new URL(request.url).searchParams,
    });

    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof TeacherKaqEvidenceTraceRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[TeacherKaqEvidenceTrace] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

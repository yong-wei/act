import { NextResponse } from 'next/server';

import { uploadCourseReportToIlab } from '@/features/ilab/adapters/ilab-course-upload';
import { resolveCurrentActorContext } from '@/features/ilab/adapters/ilab-session-lifecycle';
import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';
import { IlabServiceError, toIlabHttpError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null) as { originId?: unknown } | null;
    const actor = await resolveCurrentActorContext(readIlabGrantFromRequest(request));
    if (!actor.userId) {
      throw new IlabServiceError('请先完成账号验证或登录后再上传实验结果。', 401);
    }

    const originId = typeof body?.originId === 'string' && body.originId.trim()
      ? body.originId.trim()
      : null;

    const outcome = await uploadCourseReportToIlab({
      reportId: id,
      actorUserId: actor.userId,
      originId,
      grant: actor.grant,
    });

    const response = NextResponse.json({
      uploaded: outcome.uploaded,
      retryableUpload: outcome.retryableUpload,
      uploadMode: outcome.uploadMode,
      originId: outcome.originId,
      message: outcome.message,
    });

    if (outcome.refreshedGrant) {
      applyIlabGrantCookie(response, outcome.refreshedGrant);
    }

    return response;
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

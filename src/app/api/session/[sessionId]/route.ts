import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { isClassroomStreamEnabled } from '@/features/classroom/session/adapters/shared-classroom-reads';
import { authOptions } from '@/lib/auth';
import { classroomRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  advanceClassroomSessionUseCase,
  classroomAuthenticationResponse,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
  jsonSafeClassroomPayload,
  readClassroomSessionUseCase,
} from '@/features/classroom/session';

export const dynamic = 'force-dynamic';

function mapError(error: unknown) {
  if (error instanceof ClassroomSessionError) {
    if (error.code === 'conflict' && error.message === 'generated-courseware') {
      return NextResponse.json(jsonSafeClassroomPayload(error.payload), { status: 409 });
    }
    return NextResponse.json(
      classroomSessionErrorBody(error),
      { status: classroomSessionHttpStatus(error) },
    );
  }
  return null;
}

export async function PATCH(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return classroomAuthenticationResponse(session?.error);
    }
    const limitCheck = classroomRateLimiter.check(session.user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: limitCheck.retryAfter },
        { status: 429 },
      );
    }
    const body = await request.json();
    const result = await advanceClassroomSessionUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      sessionId: params.sessionId,
      currentItemId: body.currentItemId,
      currentStage: body.currentStage,
      status: body.status,
      classroomEvent: body.classroomEvent,
    });
    return NextResponse.json(jsonSafeClassroomPayload(result));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const userSession = await getServerSession(authOptions);
    const query = new URL(request.url).searchParams;
    if (!userSession?.user?.id) {
      if (userSession?.error === 'ACT_ACCESS_UNAVAILABLE' &&
          (query.get('admission') === 'only' || query.get('admission') === '1')) {
        return NextResponse.json({ admission: 'waiting', retryAfterMs: 3000 }, {
          status: 202, headers: { 'Cache-Control': 'private, no-store' },
        });
      }
      return classroomAuthenticationResponse(userSession?.error);
    }
    const result = await readClassroomSessionUseCase({
      actor: {
        id: userSession.user.id,
        role: userSession.user.role,
        profile: userSession.user.profile ?? null,
      },
      sessionId: params.sessionId,
      ...(query.get('studentSync') === '1' ? { studentSync: true } : {}),
      ...(query.get('admission') === '1' ? { requestAdmission: true } : {}),
      ...(query.get('admission') === 'only' ? { admissionOnly: true } : {}),
    });
    const payload = result.admission !== 'waiting' && query.get('studentSync') === '1' && isClassroomStreamEnabled()
      ? { ...result, classroomStream: true }
      : result;
    return NextResponse.json(jsonSafeClassroomPayload(payload), {
      status: result.admission === 'waiting' ? 202 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error('[Session GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

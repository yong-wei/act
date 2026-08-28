import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { classroomRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  advanceClassroomSessionUseCase,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
  readClassroomSessionUseCase,
} from '@/features/classroom/session';

export const dynamic = 'force-dynamic';

function mapError(error: unknown) {
  if (error instanceof ClassroomSessionError) {
    if (error.code === 'conflict' && error.message === 'generated-courseware') {
      return NextResponse.json(error.payload, { status: 409 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json(result);
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
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await readClassroomSessionUseCase({
      actor: {
        id: userSession.user.id,
        role: userSession.user.role,
        profile: userSession.user.profile ?? null,
      },
      sessionId: params.sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error('[Session GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

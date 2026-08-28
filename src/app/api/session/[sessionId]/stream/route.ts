import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { classroomRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  openClassroomSessionStreamUseCase,
} from '@/features/classroom/session';
import { openClassroomSessionStreamAdapter } from '@/features/classroom/session/adapters/sse';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    const limitCheck = classroomRateLimiter.check(`sse:${session.user.id}`, {
      windowMs: 60000,
      maxRequests: 60,
      blockDuration: 0,
    });
    if (!limitCheck.allowed) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    const classSession = await openClassroomSessionStreamUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      sessionId: params.sessionId,
    });
    return openClassroomSessionStreamAdapter(request, classSession);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ClassroomSessionError) {
      if (error.code === 'not-found') return new Response('Session not found', { status: 404 });
      if (error.code === 'forbidden') return new Response('Forbidden', { status: 403 });
    }
    console.error('[SSE] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

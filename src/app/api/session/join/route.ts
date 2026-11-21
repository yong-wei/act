import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  classroomAuthenticationResponse,
  classroomReadHeaders,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
  jsonSafeClassroomPayload,
} from '@/features/classroom/session';
import { joinClassroomSessionUseCase } from '@/features/classroom/session/join-api';
import { isClassroomCapacityEnabled } from '@/features/classroom/session/adapters/shared-classroom-reads';
import { studentEntryTarget } from '@/features/classroom/session/student-entry-target';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const start = performance.now();
    const userSession = await getServerSession(authOptions);
    const sessionChecked = performance.now();
    if (!userSession?.user?.id) {
      return classroomAuthenticationResponse(userSession?.error, '请先登录');
    }

    const { searchParams } = new URL(request.url);
    const result = await joinClassroomSessionUseCase({
      actor: {
        id: userSession.user.id,
        role: userSession.user.role,
        profile: userSession.user.profile ?? null,
      },
      joinCode: searchParams.get('code') ?? '',
    });
    const canWaitAtEntry = userSession.user.role === 'STUDENT' && isClassroomCapacityEnabled()
      && typeof result.id === 'string' && typeof result.studentHref === 'string'
      && studentEntryTarget(result.studentHref)?.sessionId === result.id;
    return NextResponse.json(jsonSafeClassroomPayload(canWaitAtEntry ? { ...result, waitAtEntry: true } : result), {
      headers: classroomReadHeaders(start, sessionChecked),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ClassroomSessionError) {
      return NextResponse.json(
        classroomSessionErrorBody(error),
        { status: classroomSessionHttpStatus(error) },
      );
    }
    console.error('Error finding session by join code:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

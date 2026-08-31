import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
  jsonSafeClassroomPayload,
} from '@/features/classroom/session';
import { joinClassroomSessionUseCase } from '@/features/classroom/session/join-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
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
    return NextResponse.json(jsonSafeClassroomPayload(result));
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

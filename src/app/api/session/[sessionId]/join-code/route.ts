import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
  regenerateClassroomSessionJoinCodeUseCase,
} from '@/features/classroom/session';

export const dynamic = 'force-dynamic';

export async function PATCH(_request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await regenerateClassroomSessionJoinCodeUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      sessionId: params.sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ClassroomSessionError) {
      return NextResponse.json(
        classroomSessionErrorBody(error),
        { status: classroomSessionHttpStatus(error) },
      );
    }
    console.error('Error regenerating join code:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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
import { createClassroomSessionUseCase } from '@/features/classroom/session/create-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createClassroomSessionUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      planId: body.planId,
      coursewarePublicationRevisionId: body.coursewarePublicationRevisionId,
      classId: body.classId,
      duplicateAction: body.duplicateAction,
      sourcePresetKey: body.sourcePresetKey,
    });
    return NextResponse.json(jsonSafeClassroomPayload(result));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ClassroomSessionError) {
      if (error.code === 'reuse-session') {
        return NextResponse.json(jsonSafeClassroomPayload(error.payload.session));
      }
      return NextResponse.json(
        classroomSessionErrorBody(error),
        { status: classroomSessionHttpStatus(error) },
      );
    }
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

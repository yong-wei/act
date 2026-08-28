import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ClassroomSessionError,
  classroomSessionErrorBody,
  classroomSessionHttpStatus,
} from '@/features/classroom/session';
import {
  readClassroomSessionStateUseCase,
  writeClassroomSessionStateUseCase,
} from '@/features/classroom/session/state-api';

export const dynamic = 'force-dynamic';

function mapError(error: unknown) {
  if (error instanceof ClassroomSessionError) {
    return NextResponse.json(
      classroomSessionErrorBody(error),
      { status: classroomSessionHttpStatus(error) },
    );
  }
  return null;
}

export async function POST(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await writeClassroomSessionStateUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      sessionId: params.sessionId,
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error('Error submitting student state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await readClassroomSessionStateUseCase({
      actor: {
        id: session.user.id,
        role: session.user.role,
        profile: session.user.profile ?? null,
      },
      sessionId: params.sessionId,
      scope: searchParams.get('scope'),
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error('Error fetching student states:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

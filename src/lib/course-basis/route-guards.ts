import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { ZodError } from 'zod';

import { getServerAuthSession } from '@/lib/auth';

import { CourseBasisError, type CourseBasisActor } from './domain';

export async function requireCourseBasisActor(): Promise<
  { actor: CourseBasisActor } | { response: NextResponse }
> {
  const session = await getServerAuthSession();
  if (!session?.user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
    return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { actor: { id: session.user.id, role: session.user.role } };
}

export function courseBasisErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'invalid-input', issues: error.issues }, { status: 400 });
  }
  if (error instanceof CourseBasisError) {
    const notFound = error.code.endsWith('-not-found');
    const conflict = error.code.includes('conflict') || error.code.includes('immutable');
    const tooLarge = error.code === 'source-too-large';
    return NextResponse.json({ error: error.code, details: error.details }, { status: notFound ? 404 : conflict ? 409 : tooLarge ? 413 : 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  throw error;
}

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { resolveKonlingContinuitySnapshot, type ContinuityDb } from '@/lib/konling-learning-continuity';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (session.user.role && session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'STUDENT_SCOPE_REQUIRED' }, { status: 403 });
    }

    const snapshot = await resolveKonlingContinuitySnapshot(prisma as unknown as ContinuityDb, { userId: session.user.id });
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: 'CONTINUITY_UNAVAILABLE',
      reason: error instanceof Error ? error.message : 'unknown',
    }, { status: 503 });
  }
}

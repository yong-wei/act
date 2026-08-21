import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  MicroInterventionRequestError,
  recordMicroInterventionEvent,
  type MicroInterventionDb,
  type MicroInterventionEventType,
} from '@/features/assessment/micro-intervention-outcomes';
import { scheduleMicroInterventionEvidenceProjection } from '@/features/assessment/micro-intervention-learning-evidence';

export const dynamic = 'force-dynamic';

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function eventType(value: unknown): MicroInterventionEventType | null {
  return value === 'RESOURCE_USED' || value === 'HINT_REQUESTED' || value === 'COMPLETED' ? value : null;
}

async function learner() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { error: 'UNAUTHENTICATED' as const, status: 401 as const };
  if (session.user.role !== 'STUDENT') return { error: 'LEARNER_REQUIRED' as const, status: 403 as const };
  return { userId: session.user.id };
}

export async function POST(request: Request) {
  try {
    const authenticated = await learner();
    if ('error' in authenticated) {
      return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
    }
    const body = await request.json().catch(() => null);
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    const interventionId = identifier(record?.interventionId);
    const eventKey = identifier(record?.eventKey);
    const type = eventType(record?.eventType);
    const resourceId = identifier(record?.resourceId) ?? undefined;
    const durationSeconds = typeof record?.durationSeconds === 'number' ? record.durationSeconds : undefined;
    if (!interventionId || !eventKey || !type) {
      return NextResponse.json({ error: 'EVENT_IDENTIFIERS_REQUIRED' }, { status: 400 });
    }
    const result = await recordMicroInterventionEvent({
      db: prisma as unknown as MicroInterventionDb,
      authenticatedUserId: authenticated.userId,
      interventionId,
      eventKey,
      eventType: type,
      resourceId,
      durationSeconds,
    });
    if (!result) return NextResponse.json({ error: 'INTERVENTION_NOT_FOUND' }, { status: 404 });
    if (result.status !== 'UNAVAILABLE') {
      try {
        await scheduleMicroInterventionEvidenceProjection({
          db: prisma as never,
          interventionId,
        });
      } catch (error) {
        console.error('[MicroIntervention] evidence projection failed:', error);
      }
    }
    return result.status === 'UNAVAILABLE'
      ? NextResponse.json(result, { status: 409 })
      : NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof MicroInterventionRequestError) {
      return NextResponse.json({ error: error.code }, { status: error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400 });
    }
    console.error('[MicroIntervention] event failed:', error);
    return NextResponse.json({ error: 'MICRO_INTERVENTION_EVENT_FAILED' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  MicroInterventionRequestError,
  readMicroIntervention,
  startMicroIntervention,
  type MicroInterventionDb,
} from '@/features/assessment/micro-intervention-outcomes';

export const dynamic = 'force-dynamic';

function db(): MicroInterventionDb {
  return prisma as unknown as MicroInterventionDb;
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function learner() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { error: 'UNAUTHENTICATED' as const, status: 401 as const };
  if (session.user.role !== 'STUDENT') return { error: 'LEARNER_REQUIRED' as const, status: 403 as const };
  return { userId: session.user.id };
}

function unavailableResponse(result: Awaited<ReturnType<typeof readMicroIntervention>>) {
  if (result?.status === 'UNAVAILABLE') {
    return NextResponse.json(result, { status: 409 });
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const authenticated = await learner();
    if ('error' in authenticated) {
      return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
    }
    const body = await request.json().catch(() => null);
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    const remediationResultId = identifier(record?.remediationResultId);
    const startEventKey = identifier(record?.startEventKey);
    if (!remediationResultId || !startEventKey) {
      return NextResponse.json({ error: 'START_IDENTIFIERS_REQUIRED' }, { status: 400 });
    }
    const result = await startMicroIntervention({
      db: db(),
      authenticatedUserId: authenticated.userId,
      remediationResultId,
      startEventKey,
    });
    if (!result) return NextResponse.json({ error: 'REMEDIATION_RESULT_NOT_FOUND' }, { status: 404 });
    const unavailable = unavailableResponse(result);
    return unavailable ?? NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof MicroInterventionRequestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    console.error('[MicroIntervention] POST failed:', error);
    return NextResponse.json({ error: 'MICRO_INTERVENTION_START_FAILED' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authenticated = await learner();
    if ('error' in authenticated) {
      return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
    }
    const interventionId = identifier(new URL(request.url).searchParams.get('interventionId'));
    if (!interventionId) return NextResponse.json({ error: 'INTERVENTION_ID_REQUIRED' }, { status: 400 });
    const result = await readMicroIntervention({
      db: db(),
      authenticatedUserId: authenticated.userId,
      interventionId,
    });
    if (!result) return NextResponse.json({ error: 'INTERVENTION_NOT_FOUND' }, { status: 404 });
    const unavailable = unavailableResponse(result);
    return unavailable ?? NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[MicroIntervention] GET failed:', error);
    return NextResponse.json({ error: 'MICRO_INTERVENTION_READ_FAILED' }, { status: 500 });
  }
}

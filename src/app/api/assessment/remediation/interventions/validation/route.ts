import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  MicroInterventionRequestError,
  readMicroInterventionValidationQuestion,
  submitMicroInterventionValidation,
  type MicroInterventionDb,
} from '@/features/assessment/micro-intervention-outcomes';
import {
  enqueueMicroInterventionEvidenceProjection,
  processPendingMicroInterventionEvidenceProjections,
} from '@/features/assessment/micro-intervention-learning-evidence';

export const dynamic = 'force-dynamic';

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function learner() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { error: 'UNAUTHENTICATED' as const, status: 401 as const };
  if (session.user.role !== 'STUDENT') return { error: 'LEARNER_REQUIRED' as const, status: 403 as const };
  return { userId: session.user.id };
}

export async function GET(request: Request) {
  try {
    const authenticated = await learner();
    if ('error' in authenticated) {
      return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
    }
    const interventionId = identifier(new URL(request.url).searchParams.get('interventionId'));
    if (!interventionId) {
      return NextResponse.json({ error: 'INTERVENTION_ID_REQUIRED' }, { status: 400 });
    }
    const result = await readMicroInterventionValidationQuestion({
      db: prisma as unknown as MicroInterventionDb,
      authenticatedUserId: authenticated.userId,
      interventionId,
    });
    if (!result) return NextResponse.json({ error: 'INTERVENTION_NOT_FOUND' }, { status: 404 });
    return 'status' in result
      ? NextResponse.json(result, { status: 409 })
      : NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[MicroIntervention] validation question read failed:', error);
    return NextResponse.json({ error: 'MICRO_INTERVENTION_VALIDATION_READ_FAILED' }, { status: 500 });
  }
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
    const questionId = identifier(record?.questionId);
    const selectedOption = identifier(record?.selectedOption);
    const durationSeconds = record?.durationSeconds;
    if (!interventionId || !eventKey || !questionId || !selectedOption || typeof durationSeconds !== 'number') {
      return NextResponse.json({ error: 'VALIDATION_FIELDS_REQUIRED' }, { status: 400 });
    }
    const result = await submitMicroInterventionValidation({
      db: prisma as unknown as MicroInterventionDb,
      authenticatedUserId: authenticated.userId,
      interventionId,
      eventKey,
      questionId,
      selectedOption,
      durationSeconds,
    });
    if (!result) return NextResponse.json({ error: 'INTERVENTION_NOT_FOUND' }, { status: 404 });
    if (result.status !== 'UNAVAILABLE') {
      await enqueueMicroInterventionEvidenceProjection({
        db: prisma as never,
        interventionId,
        ownerUserId: authenticated.userId,
      });
      try {
        await processPendingMicroInterventionEvidenceProjections(prisma as never, { interventionId });
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
    console.error('[MicroIntervention] validation failed:', error);
    return NextResponse.json({ error: 'MICRO_INTERVENTION_VALIDATION_FAILED' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  orchestrateRemediation,
  readRemediationOrchestration,
  type RemediationOrchestrationDb,
} from '@/features/assessment/remediation-orchestration';

export const dynamic = 'force-dynamic';

function orchestrationDb(): RemediationOrchestrationDb {
  return prisma as unknown as RemediationOrchestrationDb;
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function authenticatedLearner() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { error: 'UNAUTHENTICATED' as const, status: 401 as const };
  if (session.user.role !== 'STUDENT') return { error: 'LEARNER_REQUIRED' as const, status: 403 as const };
  return { userId: session.user.id };
}

export async function POST(request: Request) {
  try {
    const learner = await authenticatedLearner();
    if ('error' in learner) {
      return NextResponse.json({ error: learner.error }, { status: learner.status });
    }

    const body = await request.json().catch(() => null);
    const attributionId = identifier(body && typeof body === 'object'
      ? (body as Record<string, unknown>).attributionId
      : null);
    if (!attributionId) {
      return NextResponse.json({ error: 'ATTRIBUTION_ID_REQUIRED' }, { status: 400 });
    }

    const result = await orchestrateRemediation({
      db: orchestrationDb(),
      authenticatedUserId: learner.userId,
      attributionId,
    });
    if (!result) {
      return NextResponse.json({ error: 'ATTRIBUTION_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[RemediationOrchestration] POST failed:', error);
    return NextResponse.json({ error: 'REMEDIATION_ORCHESTRATION_FAILED' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const learner = await authenticatedLearner();
    if ('error' in learner) {
      return NextResponse.json({ error: learner.error }, { status: learner.status });
    }

    const resultId = identifier(new URL(request.url).searchParams.get('resultId'));
    if (!resultId) {
      return NextResponse.json({ error: 'RESULT_ID_REQUIRED' }, { status: 400 });
    }

    const result = await readRemediationOrchestration({
      db: orchestrationDb(),
      authenticatedUserId: learner.userId,
      resultId,
    });
    if (!result) {
      return NextResponse.json({ error: 'REMEDIATION_RESULT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[RemediationOrchestration] GET failed:', error);
    return NextResponse.json({ error: 'REMEDIATION_READ_FAILED' }, { status: 500 });
  }
}

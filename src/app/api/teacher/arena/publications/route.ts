import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ArenaPublicationPermissionError,
  createArenaPublicationRecord,
  listArenaPublicationsForActor,
  type ArenaPublicationStatus,
  type ArenaPublicationVisibility,
  type ArenaTelemetryLevel,
} from '@/features/arena/teacher/publication-store';
import { prisma } from '@/lib/prisma';
import type { ControllerMethod } from '@/features/arena/types';

export const dynamic = 'force-dynamic';

function parseVisibility(value: unknown): ArenaPublicationVisibility | null {
  return value === 'class' || value === 'course' || value === 'public' ? value : null;
}

function parseTelemetryLevel(value: unknown): ArenaTelemetryLevel | undefined {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3' ? value : undefined;
}

function parseStatus(value: unknown): ArenaPublicationStatus | undefined {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'archived' || value === 'closed'
    ? value
    : undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function parseScoringMetricWeights(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const weights = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => (
      entry[0].trim().length > 0 &&
      typeof entry[1] === 'number' &&
      Number.isFinite(entry[1]) &&
      entry[1] >= 0
    ));
  return weights.length > 0 ? Object.fromEntries(weights) : undefined;
}

function actorFromSession(session: Awaited<ReturnType<typeof getServerAuthSession>>) {
  if (!session?.user?.id || !['TEACHER', 'ADMIN'].includes(session.user.role ?? '')) {
    return null;
  }
  return { id: session.user.id, role: session.user.role as 'TEACHER' | 'ADMIN' };
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  const actor = actorFromSession(session);
  if (!actor) {
    return NextResponse.json({ error: session?.user?.id ? '权限不足' : '未登录' }, { status: session?.user?.id ? 403 : 401 });
  }

  const { searchParams } = new URL(request.url);
  const publications = await listArenaPublicationsForActor(prisma as any, actor, {
    classId: searchParams.get('classId') ?? undefined,
    status: parseStatus(searchParams.get('status')),
  });
  return NextResponse.json({ publications });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  const actor = actorFromSession(session);
  if (!actor) {
    return NextResponse.json({ error: session?.user?.id ? '权限不足' : '未登录' }, { status: session?.user?.id ? 403 : 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    if (
      typeof body.taskId !== 'string' ||
      typeof body.classId !== 'string' ||
      typeof body.deadline !== 'string' ||
      typeof body.leaderboardPolicyId !== 'string'
    ) {
      return NextResponse.json({ error: 'taskId, classId, deadline, and leaderboardPolicyId are required' }, { status: 400 });
    }
    const visibility = parseVisibility(body.visibility ?? 'class');
    if (!visibility) {
      return NextResponse.json({ error: 'visibility must be class, course, or public' }, { status: 400 });
    }

    const publication = await createArenaPublicationRecord(prisma as any, {
      actor,
      taskId: body.taskId,
      classId: body.classId,
      visibility,
      deadline: body.deadline,
      leaderboardPolicyId: body.leaderboardPolicyId,
      homeworkBinding: body.homeworkBinding === true,
      gradingPolicy: body.gradingPolicy && typeof body.gradingPolicy === 'object' && !Array.isArray(body.gradingPolicy)
        ? body.gradingPolicy as Record<string, unknown>
        : {},
      status: parseStatus(body.status) ?? 'active',
      templateId: typeof body.templateId === 'string' ? body.templateId : undefined,
      targetSignal: typeof body.targetSignal === 'string' ? body.targetSignal : undefined,
      disturbance: typeof body.disturbance === 'string' ? body.disturbance : undefined,
      initialCondition: typeof body.initialCondition === 'string' ? body.initialCondition : undefined,
      allowedMethods: parseStringArray(body.allowedMethods) as ControllerMethod[] | undefined,
      hardConstraints: parseStringArray(body.hardConstraints),
      scoringMetricWeights: parseScoringMetricWeights(body.scoringMetricWeights),
      paretoEnabled: typeof body.paretoEnabled === 'boolean' ? body.paretoEnabled : undefined,
      hiddenTestEnabled: typeof body.hiddenTestEnabled === 'boolean' ? body.hiddenTestEnabled : undefined,
      publicLeaderboard: typeof body.publicLeaderboard === 'boolean' ? body.publicLeaderboard : undefined,
      telemetryLevel: parseTelemetryLevel(body.telemetryLevel),
    });

    return NextResponse.json({ publication }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ArenaPublicationPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Invalid Arena publication request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

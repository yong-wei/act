import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createArenaChallengePublication } from '@/features/arena/teacher/configuration';
import type { ArenaPublicationVisibility, ArenaTelemetryLevel } from '@/features/arena/teacher/configuration';
import type { ControllerMethod } from '@/features/arena/types';

export const dynamic = 'force-dynamic';

function parseVisibility(value: unknown): ArenaPublicationVisibility | null {
  return value === 'class' || value === 'course' || value === 'public' ? value : null;
}

function parseTelemetryLevel(value: unknown): ArenaTelemetryLevel | undefined {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3' ? value : undefined;
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
      entry[0].trim().length > 0
      && typeof entry[1] === 'number'
      && Number.isFinite(entry[1])
      && entry[1] >= 0
    ));
  return weights.length > 0 ? Object.fromEntries(weights) : undefined;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id || !['TEACHER', 'ADMIN'].includes(session.user.role ?? '')) {
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

    const targetClass = await prisma.class.findUnique({
      where: { id: body.classId },
      select: { id: true, teacherId: true },
    });
    if (!targetClass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && targetClass.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const publication = createArenaChallengePublication({
      taskId: body.taskId,
      classId: body.classId,
      visibility,
      deadline: body.deadline,
      leaderboardPolicyId: body.leaderboardPolicyId,
      homeworkBinding: body.homeworkBinding === true,
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

    return NextResponse.json({ publication });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const message = error instanceof Error ? error.message : 'Invalid Arena teacher preview request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

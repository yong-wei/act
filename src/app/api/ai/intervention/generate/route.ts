import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { buildKonlingInterventionClientFields } from '@/lib/konling-intervention-client-payload';
import {
  createGovernedKonlingIntervention,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  type InterventionDecision,
  type StudentState,
} from '@/features/personalization/interventions/public-api';
import {
  ArenaCompanionContextError,
  resolveArenaCompanionContext,
} from '@/features/ai/companion/arena-companion-context';
import type { ControllerMethod } from '@/features/arena/types';

export const dynamic = 'force-dynamic';

interface GenerateRequest {
  studentState: StudentState;
  userId?: string;
  classId?: string;
  courseId?: string;
  pageId?: string;
  resourceId?: string;
  pathNodeId?: string;
  arenaTaskId?: string;
  method?: ControllerMethod;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = (await request.json()) as GenerateRequest;
    const hasArenaTaskId = Boolean(body.arenaTaskId);
    const hasArenaMethod = Boolean(body.method);
    if (hasArenaTaskId !== hasArenaMethod) {
      return NextResponse.json({ error: '竞技场任务和控制方法必须同时提供' }, { status: 400 });
    }

    let arenaContext;
    if (hasArenaTaskId && hasArenaMethod) {
      try {
        arenaContext = resolveArenaCompanionContext(body.arenaTaskId!, body.method!);
      } catch (error) {
        if (error instanceof ArenaCompanionContextError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const scope = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      role: session.user.role,
      targetUserId: body.userId || session.user.id,
      classId: body.classId,
      courseId: body.courseId,
      pageId: body.pageId,
      resourceId: body.resourceId,
      pathNodeId: body.pathNodeId,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const intervention = await createGovernedKonlingIntervention(prisma, {
      scope: scope.scope,
      studentState: body.studentState,
      arenaContext,
    });

    return NextResponse.json({
      decision: toClientDecision(intervention),
      ...buildKonlingInterventionClientFields(intervention),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: 'AI介入生成失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

function toClientDecision(
  intervention: Awaited<ReturnType<typeof createGovernedKonlingIntervention>>,
): InterventionDecision {
  return {
    shouldIntervene: intervention.shouldIntervene,
    reason: intervention.reason as InterventionDecision['reason'],
    interventionType: intervention.interventionType === 'none' || intervention.interventionType === 'cooldown'
      ? undefined
      : intervention.interventionType as InterventionDecision['interventionType'],
  };
}

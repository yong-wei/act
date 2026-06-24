import { NextResponse } from 'next/server';
import { selectNextQuestionWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface NextQuestionRequest {
  userId?: string;
  sessionId?: string;
  goalId?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再获取自适应评测题目' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as NextQuestionRequest;

    const userId = session.user.id;
    const sessionId = body.sessionId ?? `adaptive-${userId}`;
    const goalId = await readVerifiedPathGoalId(body, userId, sessionId)
      ?? readStandaloneGoalId(body);

    const result = await selectNextQuestionWithPersistenceFallback({ userId, sessionId, goalId });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '获取下一题失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

async function readVerifiedPathGoalId(body: NextQuestionRequest, userId: string, sessionId: string): Promise<string | null> {
  const pathId = typeof body.pathId === 'string' && body.pathId.trim().length > 0 ? body.pathId.trim() : null;
  const nodeId = typeof body.nodeId === 'string' && body.nodeId.trim().length > 0 ? body.nodeId.trim() : null;
  if (!pathId && !nodeId && !sessionId.startsWith('adaptive-path:')) return null;
  if (!pathId || !nodeId) {
    throw new Error('路径自适应题目请求缺少完整 path/node 上下文');
  }
  if (sessionId !== scopedPathAssessmentSessionId(pathId, nodeId)) {
    throw new Error('路径自适应题目请求的 sessionId 与 path/node 不匹配');
  }
  const path = await prisma.learningPath.findFirst({
    where: {
      id: pathId,
      userId,
      currentNodeId: nodeId,
    },
    select: {
      goalId: true,
      nodeIds: true,
      pathPayload: true,
    },
  });
  if (!path?.goalId) {
    throw new Error('未找到可用的路径自适应题目上下文');
  }
  if (readStandaloneGoalId(body) && readStandaloneGoalId(body) !== path.goalId) {
    throw new Error('路径自适应题目请求的 goalId 与服务端路径目标不匹配');
  }
  if (!readPathNodeIds(path).includes(nodeId)) {
    throw new Error('路径自适应题目请求的 nodeId 不属于当前路径');
  }
  const pathNode = readPathNode(path, nodeId);
  if (pathNode?.type !== 'adaptive_quiz') {
    throw new Error('路径自适应题目请求的 nodeId 不是自适应测验节点');
  }
  return path.goalId;
}

function readStandaloneGoalId(body: NextQuestionRequest): string | null {
  return typeof body.goalId === 'string' && body.goalId.trim().length > 0
    ? body.goalId.trim()
    : null;
}

function scopedPathAssessmentSessionId(pathId: string, nodeId: string): string {
  return `adaptive-path:${pathId}:${nodeId}`;
}

function readPathNode(path: { pathPayload?: unknown }, nodeId: string): Record<string, unknown> | null {
  const payload = readRecord(path.pathPayload);
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  return planNodes
    .map(readRecord)
    .find((entry) => entry.nodeId === nodeId) ?? null;
}

function readPathNodeIds(path: { nodeIds?: unknown; pathPayload?: unknown }): string[] {
  const payload = readRecord(path.pathPayload);
  const fromNodeIds = Array.isArray(path.nodeIds) ? path.nodeIds : [];
  const fromPayload = Array.isArray(payload.mainPathNodeIds) ? payload.mainPathNodeIds : [];
  return Array.from(new Set([...fromNodeIds, ...fromPayload].filter((value): value is string => typeof value === 'string')));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

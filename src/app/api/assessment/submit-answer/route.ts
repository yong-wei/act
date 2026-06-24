import { NextResponse } from 'next/server';
import { submitAnswerWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface SubmitAnswerRequest {
  userId?: string;
  sessionId?: string;
  questionId: string;
  selectedOption: string;
  timeSpent: number;
  goalId?: string | null;
  routeIntent?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再提交自适应评测答案' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as SubmitAnswerRequest;

    const userId = session.user.id;
    const sessionId = body.sessionId ?? `adaptive-${userId}`;

    const result = await submitAnswerWithPersistenceFallback({
      userId,
      sessionId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      timeSpent: body.timeSpent,
      pathContext: await readVerifiedPathContext(body, userId, sessionId),
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '提交答案失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

async function readVerifiedPathContext(body: SubmitAnswerRequest, userId: string, sessionId: string) {
  if (typeof body.pathId !== 'string' || !body.pathId.trim()) return undefined;
  if (typeof body.nodeId !== 'string' || !body.nodeId.trim()) return undefined;
  const pathId = body.pathId.trim();
  const nodeId = body.nodeId.trim();
  if (sessionId !== scopedPathAssessmentSessionId(pathId, nodeId)) return undefined;
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
  if (!path?.goalId) return undefined;
  if (typeof body.goalId === 'string' && body.goalId.trim() && body.goalId.trim() !== path.goalId) return undefined;
  if (!readPathNodeIds(path).includes(nodeId)) return undefined;
  const pathNode = readPathNode(path, nodeId);
  if (pathNode?.type !== 'adaptive_quiz') return undefined;
  return {
    pathId,
    nodeId,
    goalId: path.goalId,
    routeIntent: typeof body.routeIntent === 'string' && body.routeIntent.trim() ? body.routeIntent.trim() : null,
  };
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

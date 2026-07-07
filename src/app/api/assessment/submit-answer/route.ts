import { NextResponse } from 'next/server';
import type { AdaptiveQuestionScope } from '@/features/assessment/adaptive-engine';
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
  const routeIntent = typeof body.routeIntent === 'string' && body.routeIntent.trim().length > 0 ? body.routeIntent.trim() : null;
  const requiresPathContext = sessionId.startsWith('adaptive-path:')
    || routeIntent === 'path-execution'
    || Boolean(typeof body.nodeId === 'string' && body.nodeId.trim());
  if (!requiresPathContext) return undefined;
  if (typeof body.pathId !== 'string' || !body.pathId.trim() || typeof body.nodeId !== 'string' || !body.nodeId.trim()) {
    throw new Error('路径自适应答案提交缺少完整 path/node 上下文');
  }
  const pathId = body.pathId.trim();
  const nodeId = body.nodeId.trim();
  if (sessionId !== scopedPathAssessmentSessionId(pathId, nodeId)) {
    throw new Error('路径自适应答案提交的 sessionId 与 path/node 不匹配');
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
    throw new Error('未找到可用的路径自适应答案上下文');
  }
  if (typeof body.goalId === 'string' && body.goalId.trim() && body.goalId.trim() !== path.goalId) {
    throw new Error('路径自适应答案提交的 goalId 与服务端路径目标不匹配');
  }
  if (!readPathNodeIds(path).includes(nodeId)) {
    throw new Error('路径自适应答案提交的 nodeId 不属于当前路径');
  }
  const pathNode = readPathNode(path, nodeId);
  if (!isPathAssessmentNode(pathNode)) {
    throw new Error('路径自适应答案提交的 nodeId 不是自适应测验或检查点节点');
  }
  return {
    pathId,
    nodeId,
    goalId: path.goalId,
    routeIntent,
    questionScope: inferPathAssessmentScope(pathNode),
  };
}

function isPathAssessmentNode(
  pathNode: Record<string, unknown> | null,
): pathNode is Record<string, unknown> & { type: 'adaptive_quiz' | 'checkpoint' } {
  return pathNode?.type === 'adaptive_quiz' || pathNode?.type === 'checkpoint';
}

function inferPathAssessmentScope(
  pathNode: Record<string, unknown> & { type: 'adaptive_quiz' | 'checkpoint' },
): AdaptiveQuestionScope {
  const checkpoint = readRecord(pathNode.checkpoint);
  const explicitStage = readAssessmentStage(pathNode.assessmentStage) ??
    readAssessmentStage(pathNode.stagePurpose) ??
    readAssessmentStage(checkpoint.assessmentPurpose) ??
    readAssessmentStage(checkpoint.remediationBehavior) ??
    readAssessmentStage(pathNode.nodeId) ??
    readAssessmentStage(pathNode.id) ??
    readAssessmentStage(pathNode.displayName) ??
    readAssessmentStage(pathNode.title);
  if (explicitStage) return explicitStage;
  return pathNode.type === 'checkpoint' ? 'checkpoint' : 'readiness';
}

function readAssessmentStage(value: unknown): Extract<AdaptiveQuestionScope, 'readiness' | 'checkpoint' | 'remediation'> | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.includes('remediation') ||
    normalized.includes('remedial') ||
    normalized.includes('补救') ||
    normalized.includes('修复') ||
    normalized.includes('薄弱')
  ) {
    return 'remediation';
  }
  if (
    normalized.includes('checkpoint') ||
    normalized.includes('检查点') ||
    normalized.includes('阶段检查')
  ) {
    return 'checkpoint';
  }
  if (
    normalized.includes('readiness') ||
    normalized.includes('readiness-gate') ||
    normalized.includes('precheck') ||
    normalized.includes('预检') ||
    normalized.includes('准备')
  ) {
    return 'readiness';
  }
  return null;
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

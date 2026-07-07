import { NextResponse } from 'next/server';
import { AdaptiveAssessmentCatalogSelectionError } from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import type { AdaptiveQuestionScope } from '@/features/assessment/adaptive-engine';
import { selectNextQuestionWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface NextQuestionRequest {
  userId?: string;
  sessionId?: string;
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
        { error: '请先登录后再获取自适应评测题目' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as NextQuestionRequest;

    const userId = session.user.id;
    const sessionId = body.sessionId ?? `adaptive-${userId}`;
    const verifiedPathContext = await readVerifiedPathContext(body, userId, sessionId);
    const goalId = verifiedPathContext?.goalId ?? readStandaloneGoalId(body);
    const questionScope: AdaptiveQuestionScope = verifiedPathContext?.questionScope ?? 'practice';

    const result = await selectNextQuestionWithPersistenceFallback({ userId, sessionId, goalId, questionScope });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof AdaptiveAssessmentCatalogSelectionError) {
      return NextResponse.json(
        {
          error: 'assessment_catalog_coverage_limited',
          message: error.message,
          limitation: error.limitation,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: '获取下一题失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

async function readVerifiedPathContext(
  body: NextQuestionRequest,
  userId: string,
  sessionId: string,
): Promise<{ goalId: string; questionScope: AdaptiveQuestionScope } | null> {
  const pathId = typeof body.pathId === 'string' && body.pathId.trim().length > 0 ? body.pathId.trim() : null;
  const nodeId = typeof body.nodeId === 'string' && body.nodeId.trim().length > 0 ? body.nodeId.trim() : null;
  const routeIntent = typeof body.routeIntent === 'string' && body.routeIntent.trim().length > 0 ? body.routeIntent.trim() : null;
  const requiresPathContext = sessionId.startsWith('adaptive-path:')
    || routeIntent === 'path-execution'
    || Boolean(nodeId);
  if (!requiresPathContext) return null;
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
  if (!isPathAssessmentNode(pathNode)) {
    throw new Error('路径自适应题目请求的 nodeId 不是自适应测验或检查点节点');
  }
  return {
    goalId: path.goalId,
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

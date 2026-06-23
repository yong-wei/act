import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  buildKonlingRuntimeContext,
  buildKonlingRuntimeGraphContext,
  buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime,
  getOrCreateKonlingAgentSession,
  type KonlingCitationContext,
  type KonlingCitation,
  type KonlingPlanContext,
  KonlingRuntimeScopeError,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  resolveKonlingTeachingAssistantSignedGraphNodeId,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import { prisma } from '@/lib/prisma';
import { isRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PathAdvisorToolOperation = 'generate' | 'revise' | 'explain';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再生成学习路径' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: '当前入口仅支持学生生成个人学习路径' }, { status: 403 });
    }

    const body = await request.json();
    const goalId = typeof body.goalId === 'string' ? body.goalId : '';
    if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
      return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
    }
    const classId = session.user.profile?.classId ?? null;
    if (!classId) {
      return NextResponse.json({ error: '当前账号缺少班级信息，暂不能生成学习路径' }, { status: 403 });
    }

    const modeContextToken = typeof body.modeContextToken === 'string' ? body.modeContextToken : '';
    if (!modeContextToken) {
      return NextResponse.json({ error: '学习路径生成上下文缺失' }, { status: 400 });
    }

    const operation: PathAdvisorToolOperation = body.operation === 'revise' || body.operation === 'explain'
      ? body.operation
      : 'generate';
    const scopeResult = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: session.user.id,
      classId,
      courseId: goalId,
      pageId: 'adaptive-path-center',
      pageContextHint: {
        courseId: goalId,
        stepId: 'adaptive-path-center',
        pageType: 'practice',
      },
    });
    if (!scopeResult.ok) {
      return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status });
    }

    const requestedToolInput = await buildPathAdvisorToolInput(body, goalId, session.user.id);
    const requestedContextHints = {
      modeContextToken,
      goalId,
      ...(requestedToolInput.graphNodeId ? { graphNodeId: requestedToolInput.graphNodeId } : {}),
    };
    const signedGraphNodeId = resolveKonlingTeachingAssistantSignedGraphNodeId({
      modeId: 'path-advisor',
      scope: scopeResult.scope,
      clientContextHints: requestedContextHints,
    });
    if (requestedToolInput.graphNodeId && !signedGraphNodeId) {
      return NextResponse.json({ error: '图谱节点上下文未签名或已失效' }, { status: 403 });
    }
    const toolInput = signedGraphNodeId
      ? { ...requestedToolInput, graphNodeId: signedGraphNodeId }
      : requestedToolInput;
    const pathPlanContext = toolInput.pathId
      ? await readPathAdvisorPlanContext(toolInput.pathId, goalId, session.user.id, classId)
      : null;
    const baseRuntimeContext = await buildKonlingRuntimeContext(prisma, {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: session.user.id,
      classId,
      courseId: goalId,
      pageId: 'adaptive-path-center',
      pageContextHint: {
        courseId: goalId,
        stepId: 'adaptive-path-center',
        pageType: 'practice',
      },
      trustedContentContext: true,
    });
    const clientContextHints = {
      modeContextToken,
      goalId,
      ...(toolInput.graphNodeId ? { graphNodeId: toolInput.graphNodeId } : {}),
    };
    const graphRuntimeContext = pathPlanContext
      ? {
          ...baseRuntimeContext,
          planContext: pathPlanContext,
          citationContext: buildPathAwareCitationContext(
            baseRuntimeContext.citationContext,
            pathPlanContext,
          ),
        }
      : baseRuntimeContext;
    const runtimeContext = {
      ...graphRuntimeContext,
      graphContext: buildKonlingRuntimeGraphContext({
        scope: scopeResult.scope,
        runtimeContext: graphRuntimeContext,
        clientHints: clientContextHints,
      }),
    };
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext,
      scope: scopeResult.scope,
      serverModeContext: await resolveKonlingTeachingAssistantServerModeContext({
        db: prisma,
        modeId: 'path-advisor',
        runtimeContext,
        scope: scopeResult.scope,
        clientContextHints,
      }),
      clientContextHints,
    });
    if (modeContract.status === 'unavailable') {
      return NextResponse.json({
        error: 'KONLING_MODE_UNAVAILABLE',
        unavailableReasons: modeContract.unavailableReasons,
        clientHintsRejected: modeContract.clientHintsRejected,
      }, { status: 409 });
    }

    const agentSession = await getOrCreateKonlingAgentSession(prisma, {
      scope: scopeResult.scope,
      agentSessionId: typeof body.agentSessionId === 'string' ? body.agentSessionId : null,
      phase: 'path-generation-panel',
      status: 'running',
      state: {
        route: '/api/adaptive/path-advisor-tool',
        teachingAssistantMode: modeContract.mode.id,
        modeStatus: modeContract.status,
      },
      permittedTools: modeContract.permittedTools,
    });
    const runtime = buildKonlingToolRuntime({
      db: prisma,
      scope: scopeResult.scope,
      context: { ...runtimeContext, permittedTools: modeContract.permittedTools },
      agentSessionId: agentSession.id,
      permittedTools: modeContract.permittedTools,
    });
    const result = operation === 'revise'
      ? await runtime.reviseLearningPathOptions(toolInput)
      : operation === 'explain'
        ? await runtime.explainLearningPathTradeoff(toolInput)
        : await runtime.generateLearningPath(toolInput);

    return NextResponse.json({
      operation,
      agentSessionId: agentSession.id,
      result,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingRuntimeScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[AdaptivePathAdvisorTool] Error:', error);
    return NextResponse.json({ error: '学习路径生成失败' }, { status: 500 });
  }
}

function buildPathAwareCitationContext(
  citationContext: KonlingCitationContext | undefined,
  planContext: KonlingPlanContext,
): KonlingCitationContext | undefined {
  if (!citationContext) return undefined;
  if (!planContext.currentPathId) return citationContext;
  const pathCitationId = `path:${planContext.currentPathId}`;
  const evidenceCitations = citationContext.evidenceCitations.some((citation) => citation.id === pathCitationId)
    ? citationContext.evidenceCitations
    : [
        ...citationContext.evidenceCitations,
        buildPathExecutionCitation(pathCitationId),
      ];
  return {
    ...citationContext,
    evidenceCitations,
    missingCitationClasses: citationContext.missingCitationClasses.filter((item) => item !== 'path-execution'),
    lowConfidenceReasons: citationContext.lowConfidenceReasons.filter((item) => item !== 'missing-path-execution'),
  };
}

function buildPathExecutionCitation(id: string): KonlingCitation {
  return {
    id,
    sourceType: 'path-execution',
    displayTitle: '当前控制校正学习路径',
    href: null,
    confidence: 'medium',
    evidenceBasis: 'LearningPath',
    owner: 'recommendation',
  };
}

async function buildPathAdvisorToolInput(body: Record<string, unknown>, goalId: string, userId: string) {
  const pathId = typeof body.pathId === 'string' && body.pathId.length > 0 ? body.pathId : undefined;
  const pathOptionLookup = pathId
    ? await readPathOptionStyleLookup(pathId, goalId, userId)
    : new Map<string, string>();
  const resourcePreference = Array.isArray(body.resourcePreference)
    ? body.resourcePreference.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : undefined;
  const rejectedStyleIds = Array.isArray(body.rejectedStyleIds)
    ? body.rejectedStyleIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : undefined;
  const rejectedOptionStyleIds = Array.isArray(body.rejectedOptionIds)
    ? body.rejectedOptionIds
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .map((optionId) => resolveCurrentPathStyleId(pathOptionLookup, optionId, 'rejectedOptionIds'))
    : [];
  const selectedStyleId = resolveOptionalCurrentPathStyleId(pathOptionLookup, body.selectedStyleId, body.selectedOptionId, 'selectedOptionId');
  const compareWithStyleId = resolveOptionalCurrentPathStyleId(pathOptionLookup, body.compareWithStyleId, body.compareWithOptionId, 'compareWithOptionId');
  const preferredStyleId = resolveOptionalCurrentPathStyleId(pathOptionLookup, body.preferredStyleId, body.preferredOptionId, 'preferredOptionId')
    ?? selectedStyleId;
  const excludedNodeIds = Array.isArray(body.excludedNodeIds)
    ? body.excludedNodeIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : undefined;
  const graphNodeId = typeof body.graphNodeId === 'string' && body.graphNodeId.trim().length > 0
    ? body.graphNodeId.trim()
    : undefined;
  const difficultyRhythm: 'gentle' | 'steady' | 'challenge' | undefined =
    body.difficultyRhythm === 'gentle' || body.difficultyRhythm === 'steady' || body.difficultyRhythm === 'challenge'
      ? body.difficultyRhythm
      : undefined;
  const checkpointPreference: 'light' | 'standard' | 'dense' | undefined =
    body.checkpointPreference === 'light' || body.checkpointPreference === 'standard' || body.checkpointPreference === 'dense'
      ? body.checkpointPreference
      : undefined;
  return {
    idempotencyKey: typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
      ? body.idempotencyKey
      : `path-generation-panel:${goalId}:${Date.now()}`,
    goalId,
    pathId,
    routeIntent: typeof body.routeIntent === 'string' && body.routeIntent.length > 0 ? body.routeIntent : undefined,
    timeBudgetMinutes: typeof body.timeBudgetMinutes === 'number' ? body.timeBudgetMinutes : undefined,
    difficultyRhythm,
    resourcePreference,
    checkpointPreference,
    allowExternalResources: typeof body.allowExternalResources === 'boolean' ? body.allowExternalResources : undefined,
    naturalLanguageIntent: typeof body.naturalLanguageIntent === 'string' && body.naturalLanguageIntent.trim().length > 0
      ? body.naturalLanguageIntent.trim()
      : undefined,
    graphNodeId,
    priorRequestId: typeof body.priorRequestId === 'string' && body.priorRequestId.length > 0 ? body.priorRequestId : undefined,
    selectedStyleId,
    styleId: selectedStyleId,
    compareWithStyleId,
    excludedNodeIds,
    preferredStyleId,
    requestedAt: typeof body.requestedAt === 'string' && body.requestedAt.length > 0 ? body.requestedAt : new Date().toISOString(),
    rejectedStyleIds: [...(rejectedStyleIds ?? []), ...rejectedOptionStyleIds],
  };
}

async function readPathAdvisorPlanContext(
  pathId: string,
  goalId: string,
  userId: string,
  classId: string,
): Promise<KonlingPlanContext | null> {
  const path = await (prisma as any).learningPath?.findFirst?.({
    where: {
      id: pathId,
      goalId,
      userId,
      classId,
    },
    select: {
      id: true,
      currentNodeId: true,
      nodeIds: true,
      pathPayload: true,
      lastExecutionMetadata: true,
    },
  });
  if (!path) return null;

  const nodeIds = readStringArray(path.nodeIds);
  const pathPayload = readRecord(path.pathPayload);
  const executionStatus = readRecord(pathPayload.executionStatus);
  const executionMetadata = readRecord(path.lastExecutionMetadata);
  const completedNodeIds = uniqueStrings([
    ...readStringArray(executionStatus.completedNodeIds),
    ...readStringArray(executionMetadata.completedNodeIds),
  ]).filter((nodeId) => nodeIds.includes(nodeId));
  const activeNodeId = readString(path.currentNodeId) ??
    readString(executionStatus.activeNodeId) ??
    nodeIds.find((nodeId) => !completedNodeIds.includes(nodeId)) ??
    nodeIds[0] ??
    null;
  const activeIndex = activeNodeId ? nodeIds.indexOf(activeNodeId) : -1;
  const nextNodeIds = activeIndex >= 0
    ? nodeIds.slice(activeIndex, activeIndex + 3)
    : nodeIds.slice(0, 3);

  return {
    currentPathId: readString(path.id) ?? pathId,
    activeNodeId,
    nextNodeIds,
    recentPathIds: [readString(path.id) ?? pathId],
    completedNodeIds,
    status: 'available',
  };
}

function resolveOptionalCurrentPathStyleId(
  lookup: Map<string, string>,
  styleId: unknown,
  optionId: unknown,
  fieldName: string,
): string | undefined {
  if (typeof optionId === 'string' && optionId.length > 0) {
    return resolveCurrentPathStyleId(lookup, optionId, fieldName);
  }
  if (typeof styleId === 'string' && styleId.length > 0) {
    return resolveCurrentPathStyleId(lookup, styleId, fieldName);
  }
  return undefined;
}

function resolveCurrentPathStyleId(lookup: Map<string, string>, value: string, fieldName: string): string {
  const styleId = lookup.get(value);
  if (!styleId) {
    throw new KonlingRuntimeScopeError(403, `路径选项不属于当前学习路径: ${fieldName}`);
  }
  return styleId;
}

async function readPathOptionStyleLookup(pathId: string, goalId: string, userId: string): Promise<Map<string, string>> {
  const path = await (prisma as any).learningPath?.findFirst?.({
    where: {
      id: pathId,
      goalId,
      userId,
    },
    select: {
      pathPayload: true,
    },
  });
  const policyBundle = readRecord(readRecord(path?.pathPayload).policyBundle);
  const paths = Array.isArray(policyBundle.paths) ? policyBundle.paths : [];
  const lookup = new Map<string, string>();
  paths
    .map((item, index) => ({ option: readRecord(item), index }))
    .filter(({ option }) => readStringArray(option.nodeIds).length > 0)
    .forEach(({ option, index }) => {
      const styleId = readString(option.styleId);
      if (!styleId) return;
      lookup.set(styleId, styleId);
      lookup.set(readString(option.optionId) ?? `path-option-${index + 1}`, styleId);
    });
  return lookup;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

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
import { getAdaptivePracticeGoalOption } from '@/lib/adaptive-path-goal-options';
import {
  adaptiveGenerationReadinessFromHttp,
  buildAdaptiveGenerationReadiness,
  type AdaptiveGenerationReadiness,
} from '@/lib/adaptive-generation-readiness';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { readAdaptivePathCandidateBatch } from '@/lib/adaptive-path-candidate-batches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PathAdvisorToolOperation = 'generate' | 'revise' | 'explain';
type PathGenerationRequestStatus = 'running' | 'succeeded' | 'failed';

const PATH_GENERATION_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]*$/;

export async function POST(request: Request) {
  let generationRequestId: string | null = null;
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再生成学习路径' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return readinessError('当前入口仅支持学生生成个人学习路径', 403, buildAdaptiveGenerationReadiness({
        reason: 'advisor-forbidden',
        source: 'path-advisor-tool',
      }));
    }

    const body = await request.json();
    const goalId = typeof body.goalId === 'string' ? body.goalId : '';
    if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
      return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
    }
    const classId = session.user.profile?.classId ?? null;
    if (!classId) {
      return readinessError('当前账号缺少班级信息，暂不能生成学习路径', 403, buildAdaptiveGenerationReadiness({
        reason: 'missing-class-binding',
        source: 'session',
      }));
    }
    const classBinding = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });
    if (!classBinding?.teacherId) {
      return readinessError('当前班级缺少任课教师绑定，暂不能生成学习路径', 403, buildAdaptiveGenerationReadiness({
        reason: 'missing-teacher-binding',
        source: 'session',
      }));
    }

    const modeContextToken = typeof body.modeContextToken === 'string' ? body.modeContextToken : '';
    if (!modeContextToken) {
      return NextResponse.json({ error: '学习路径生成上下文缺失' }, { status: 400 });
    }

    const operation: PathAdvisorToolOperation = body.operation === 'revise' || body.operation === 'explain'
      ? body.operation
      : 'generate';
    if (operation === 'generate') {
      generationRequestId = typeof body.generationRequestId === 'string' ? body.generationRequestId : null;
      if (
        !generationRequestId ||
        generationRequestId.length > 128 ||
        !PATH_GENERATION_REQUEST_ID_PATTERN.test(generationRequestId)
      ) {
        return NextResponse.json({ error: '学习路径生成请求 ID 无效' }, { status: 400 });
      }
    }
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
      return NextResponse.json({
        error: scopeResult.error,
        readiness: adaptiveGenerationReadinessFromHttp({
          status: scopeResult.status,
          source: 'path-advisor-tool',
          fallbackReason: 'advisor-forbidden',
        }),
      }, { status: scopeResult.status });
    }

    const requestedToolInput = await buildPathAdvisorToolInput(
      body,
      goalId,
      session.user.id,
      classId,
      operation,
    );
    if (generationRequestId) {
      requestedToolInput.idempotencyKey = `path-generation-request:${generationRequestId}`;
    }
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
      return readinessError('图谱节点上下文未签名或已失效', 403, buildAdaptiveGenerationReadiness({
        reason: 'advisor-forbidden',
        source: 'path-advisor-tool',
      }));
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
            goalId,
          ),
        }
      : baseRuntimeContext;
    const runtimeContext = {
      ...graphRuntimeContext,
      teachingProjectionContext: graphRuntimeContext.teachingProjectionContext,
      graphContext: buildKonlingRuntimeGraphContext({
        scope: scopeResult.scope,
        runtimeContext: graphRuntimeContext,
        clientHints: clientContextHints,
        teachingProjectionContext: graphRuntimeContext.teachingProjectionContext,
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
        readiness: buildAdaptiveGenerationReadiness({
          reason: 'service-unavailable',
          source: 'path-advisor-tool',
        }),
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
      readiness: buildAdaptiveGenerationReadiness({ reason: 'ready', source: 'path-advisor-tool' }),
      result,
      ...(generationRequestId ? {
        generationRequest: {
          id: generationRequestId,
          status: readPathGenerationRequestStatus(result),
        },
      } : {}),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingRuntimeScopeError) {
      return NextResponse.json({
        error: error.message,
        readiness: adaptiveGenerationReadinessFromHttp({
          status: error.status,
          source: 'path-advisor-tool',
          fallbackReason: 'advisor-forbidden',
        }),
        ...(generationRequestId && error.status === 409 ? {
          generationRequest: { id: generationRequestId, status: 'failed' as const },
        } : {}),
      }, { status: error.status });
    }
    console.error('[AdaptivePathAdvisorTool] Error:', error);
    return NextResponse.json({
      error: '学习路径生成失败',
      readiness: buildAdaptiveGenerationReadiness({
        reason: 'retryable',
        source: 'path-advisor-tool',
      }),
      ...(generationRequestId ? {
        generationRequest: { id: generationRequestId, status: 'running' as const },
      } : {}),
    }, { status: 500 });
  }
}

function readPathGenerationRequestStatus(result: unknown): PathGenerationRequestStatus {
  if (!result || typeof result !== 'object') return 'succeeded';
  const resultRecord = result as Record<string, unknown>;
  const generationStatus = resultRecord.generationStatus;
  if (generationStatus === 'pending' || generationStatus === 'running') return 'running';
  if (generationStatus === 'blocked' || generationStatus === 'failed') return 'failed';
  const toolRunStatus = resultRecord.status;
  if (toolRunStatus === 'pending' || toolRunStatus === 'running' || toolRunStatus === 'awaiting_approval') return 'running';
  if (toolRunStatus === 'failed') return 'failed';
  return 'succeeded';
}

function readinessError(error: string, status: 403, readiness: AdaptiveGenerationReadiness) {
  return NextResponse.json({ error, readiness }, { status });
}

function buildPathAwareCitationContext(
  citationContext: KonlingCitationContext | undefined,
  planContext: KonlingPlanContext,
  goalId: string,
): KonlingCitationContext {
  const baseCitationContext = citationContext ?? createMissingPathAdvisorCitationContext();
  if (!planContext.currentPathId) return baseCitationContext;
  const pathCitationId = `path:${planContext.currentPathId}`;
  const evidenceCitations = baseCitationContext.evidenceCitations.some((citation) => citation.id === pathCitationId)
    ? baseCitationContext.evidenceCitations
    : [
        ...baseCitationContext.evidenceCitations,
        buildPathExecutionCitation(pathCitationId, goalId),
      ];
  return {
    ...baseCitationContext,
    evidenceCitations,
    missingCitationClasses: baseCitationContext.missingCitationClasses.filter((item) => item !== 'path-execution'),
    lowConfidenceReasons: baseCitationContext.lowConfidenceReasons.filter((item) => item !== 'missing-path-execution'),
  };
}

function createMissingPathAdvisorCitationContext(): KonlingCitationContext {
  return {
    required: true,
    contentCitations: [],
    evidenceCitations: [],
    missingCitationClasses: ['content', 'evidence'],
    lowConfidenceReasons: ['missing-content', 'missing-evidence'],
    responseProtocol: {
      requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
      minimum: {
        content: 1,
        evidenceWhenAvailable: 1,
      },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

function buildPathExecutionCitation(id: string, goalId: string): KonlingCitation {
  const goalTitle = getAdaptivePracticeGoalOption(goalId)?.title ?? '当前学习路径';
  return {
    id,
    sourceType: 'path-execution',
    displayTitle: `${goalTitle}学习路径`,
    href: null,
    confidence: 'medium',
    evidenceBasis: 'LearningPath',
    owner: 'recommendation',
  };
}

async function buildPathAdvisorToolInput(
  body: Record<string, unknown>,
  goalId: string,
  userId: string,
  classId: string,
  operation: PathAdvisorToolOperation,
) {
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
  const selectedStyleId = operation === 'revise'
    ? undefined
    : resolveOptionalCurrentPathStyleId(pathOptionLookup, body.selectedStyleId, body.selectedOptionId, 'selectedOptionId');
  const compareWithStyleId = operation === 'explain'
    ? resolveOptionalCurrentPathStyleId(pathOptionLookup, body.compareWithStyleId, body.compareWithOptionId, 'compareWithOptionId')
    : undefined;
  const preferredStyleId = operation === 'revise'
    ? undefined
    : resolveOptionalCurrentPathStyleId(pathOptionLookup, body.preferredStyleId, body.preferredOptionId, 'preferredOptionId')
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
  const sourceBatchId = typeof body.sourceBatchId === 'string' && body.sourceBatchId.length > 0
    ? body.sourceBatchId
    : undefined;
  const sourceCandidateId = typeof body.sourceCandidateId === 'string' && body.sourceCandidateId.length > 0
    ? body.sourceCandidateId
    : undefined;
  const sourceCandidateFingerprint = typeof body.sourceCandidateFingerprint === 'string'
    ? body.sourceCandidateFingerprint
    : undefined;
  const activeProgressVersion = typeof body.activeProgressVersion === 'string' && body.activeProgressVersion.length > 0
    ? body.activeProgressVersion
    : undefined;
  let adjustmentSourceStyleId: string | undefined;
  if (operation === 'revise') {
    if (!sourceBatchId || !sourceCandidateId || !sourceCandidateFingerprint || !activeProgressVersion) {
      throw new KonlingRuntimeScopeError(400, '候选路径调整缺少稳定的来源或进度版本。');
    }
    const sourceBatch = await readAdaptivePathCandidateBatch(prisma as any, sourceBatchId);
    if (
      !sourceBatch ||
      sourceBatch.userId !== userId ||
      sourceBatch.goalId !== goalId ||
      sourceBatch.classId !== classId
    ) {
      throw new KonlingRuntimeScopeError(403, '候选路径调整来源不属于当前学习范围。');
    }
    const sourceCandidate = sourceBatch.candidates.find((candidate) => candidate.id === sourceCandidateId);
    if (!sourceCandidate) {
      throw new KonlingRuntimeScopeError(404, '候选路径调整来源不属于指定批次。');
    }
    if (sourceCandidate.fingerprint !== sourceCandidateFingerprint) {
      throw new KonlingRuntimeScopeError(409, '候选路径版本已更新，请刷新后重新调整。');
    }
    adjustmentSourceStyleId = sourceCandidate.styleId;
  }
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
    selectedStyleId: adjustmentSourceStyleId ?? selectedStyleId,
    styleId: adjustmentSourceStyleId ?? selectedStyleId,
    compareWithStyleId,
    excludedNodeIds,
    preferredStyleId: adjustmentSourceStyleId ?? preferredStyleId,
    requestedAt: typeof body.requestedAt === 'string' && body.requestedAt.length > 0 ? body.requestedAt : new Date().toISOString(),
    rejectedStyleIds: [...(rejectedStyleIds ?? []), ...rejectedOptionStyleIds],
    sourceBatchId: sourceBatchId ?? '',
    sourceCandidateId: sourceCandidateId ?? '',
    sourceCandidateFingerprint: sourceCandidateFingerprint ?? '',
    activeProgressVersion: activeProgressVersion ?? '',
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
      updatedAt: true,
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
    progressVersion: path.updatedAt instanceof Date
      ? path.updatedAt.toISOString()
      : String(path.updatedAt ?? ''),
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
  const pathPayload = readRecord(path?.pathPayload);
  const policyBundle = readRecord(pathPayload.policyBundle);
  const policyPaths = Array.isArray(policyBundle.paths) ? policyBundle.paths : [];
  const paths = policyPaths.length > 0
    ? policyPaths
    : Array.isArray(pathPayload.pathOptions) ? pathPayload.pathOptions : [];
  const lookup = new Map<string, string>();
  paths
    .map((item, index) => ({ option: readRecord(item), index }))
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

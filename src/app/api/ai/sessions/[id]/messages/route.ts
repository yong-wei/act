/**
 * 控灵会话消息 API
 *
 * 管理会话消息的增删改查
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { streamText, stepCountIs } from 'ai';
import { getConfiguredAIModel } from '@/lib/ai-client';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';
import { toLegacyMessage, toModelMessages } from '@/lib/ai-message-compat';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  applyKonlingCitationFallback,
  buildKonlingCitationGuard,
  buildKonlingCitationRetrievalSources,
  buildKonlingRuntimeContext,
  buildKonlingSarAssociatedGroundingMetadataPayload,
  buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError,
  normalizeKonlingKnowledgeWorkspaceHint,
  persistKonlingSessionMemories,
  resumeKonlingAgentSession,
  serializeKonlingCitationMetadata,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  KonlingAdaptiveAttemptContextError,
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingSmartPrepSessionBinding,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import type { AIContext } from '@/types/ai-context';
import type { Message } from '@/types/ai-message';
import { redactProviderError, type ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';
import {
  claimKonlingConversationTurn,
  completeKonlingConversationTurn,
  createKonlingMessageId,
  KonlingConversationTurnConflictError,
  normalizeKonlingConversationAssistantBinding,
  prepareKonlingConversationTurn,
  releaseKonlingConversationTurn,
  resolveKonlingContextEventScope,
} from '@/lib/konling-conversation-library';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/ai/sessions/[id]/messages
 * 发送消息并获取AI回复
 */
export async function POST(request: NextRequest, context: RouteContext) {
  let claimedTurn: {
    conversationId: string;
    ownerUserId: string;
    turnId: string;
  } | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;
    const body = await request.json();
    const { content, pageContext, classId, resourceId, pathNodeId, agentSessionId, teachingAssistantModeId, modeClientContextHints, knowledgeWorkspaceHint } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Missing content' },
        { status: 400 }
      );
    }

    // 获取会话
    const konlingSession = await prisma.konlingSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        libraryVisible: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 获取现有消息
    const existingMessages = ((konlingSession.messages as unknown as Message[]) || []).map(toLegacyMessage);

    // 添加用户消息
    const userMessage: Message = toLegacyMessage({
      id: createKonlingMessageId(),
      role: 'user',
      content,
    });

    let updatedMessages = [...existingMessages, userMessage];
    let ownedTurnIds = updatedMessages.filter((message) => message.role === 'user').map((message) => message.id).filter(Boolean).slice(-50);

    const modeScopeOverride = await resolveKonlingTeachingAssistantScopeOverride({
      db: prisma,
      modeId: teachingAssistantModeId,
      authenticatedUserId: session.user.id,
      role: session.user.role,
      clientContextHints: modeClientContextHints,
    });
    const runtimeTargetUserId = modeScopeOverride.targetUserId ?? session.user.id;
    const runtimeClassId = modeScopeOverride.classId ?? classId;

    const scope = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      role: session.user.role,
      targetUserId: runtimeTargetUserId,
      classId: runtimeClassId,
      courseId: pageContext?.courseId || konlingSession.courseId,
      pageId: pageContext?.stepId || konlingSession.pageId,
      resourceId,
      pathNodeId,
      pageContextHint: pageContext,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const contextEventScope = await resolveKonlingContextEventScope(prisma, scope.scope);
    if (!contextEventScope) {
      return NextResponse.json({ error: 'Page context is not registered for Konling.' }, { status: 400 });
    }
    const authorizedScope = { ...scope.scope, ...contextEventScope };
    const preparedTurn = prepareKonlingConversationTurn({
      conversation: konlingSession,
      currentScope: authorizedScope,
      userMessage,
    });
    updatedMessages = preparedTurn.modelMessages;
    ownedTurnIds = updatedMessages
      .filter((message) => message.role === 'user')
      .map((message) => message.id)
      .filter(Boolean)
      .slice(-50);
    const runtimeInput = {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: runtimeTargetUserId,
      classId: runtimeClassId,
      courseId: authorizedScope.courseId,
      pageId: authorizedScope.pageId,
      resourceId: authorizedScope.resourceId,
      pathNodeId: authorizedScope.pathNodeId,
      knowledgeWorkspaceHint: normalizeKonlingKnowledgeWorkspaceHint(knowledgeWorkspaceHint ?? modeClientContextHints),
      teachingAssistantModeId,
      currentUserQuery: userMessage.content,
      trustedContentContext: true,
    };
    const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext({
      db: prisma,
      modeId: teachingAssistantModeId,
      scope: authorizedScope,
      clientContextHints: modeClientContextHints,
    });
    const assistantBinding = normalizeKonlingConversationAssistantBinding({
      modeId: teachingAssistantModeId,
      clientContextHints: modeClientContextHints,
      validatedModeContext: serverModeContext,
    });
    const smartPrepBinding = resolveKonlingSmartPrepSessionBinding(serverModeContext);
    const runtimeContext = await buildKonlingRuntimeContext(prisma, {
      ...runtimeInput,
      teachingAssistantServerModeContext: serverModeContext,
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: teachingAssistantModeId,
      runtimeContext,
      scope: authorizedScope,
      serverModeContext,
      clientContextHints: modeClientContextHints,
    });
    if (modeContract.status === 'unavailable') {
      return NextResponse.json({
        error: 'KONLING_MODE_UNAVAILABLE',
        mode: modeContract.mode.id,
        status: modeContract.status,
        unavailableReasons: modeContract.unavailableReasons,
        degradedReasons: modeContract.degradedReasons,
        clientHintsRejected: modeContract.clientHintsRejected,
      }, {
        status: 409,
        headers: {
          'X-Konling-Assistant-Mode': modeContract.mode.id,
          'X-Konling-Assistant-Mode-Status': modeContract.status,
        },
      });
    }
    const modeRuntimeContext = {
      ...runtimeContext,
      knowledgeCapabilityContext: modeContract.groundingContext,
      teachingAssistantMode: modeContract,
    };
    const claimedConversationTurn = await claimKonlingConversationTurn(prisma, {
      conversationId: sessionId,
      ownerUserId: session.user.id,
      currentScope: authorizedScope,
      userMessage,
      assistantBinding,
    });
    if (!claimedConversationTurn) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    claimedTurn = {
      conversationId: sessionId,
      ownerUserId: session.user.id,
      turnId: claimedConversationTurn.turnId,
    };
    updatedMessages = claimedConversationTurn.modelMessages;
    ownedTurnIds = updatedMessages
      .filter((message) => message.role === 'user')
      .map((message) => message.id)
      .filter(Boolean)
      .slice(-50);

    // 构建AI上下文
    const aiContext: AIContext = {
      page: runtimeContext.pageContext,
      user: runtimeContext.userProfile,
      sessionHistory: updatedMessages.slice(0, -1),
    };

    // 生成系统提示词
    const systemPrompt = buildKonlingSystemPrompt({
      ...aiContext,
      adaptiveRuntime: modeRuntimeContext,
    });
    const agentSession = await getOrCreateKonlingAgentSession(prisma, {
      scope: authorizedScope,
      agentSessionId,
      konlingSessionId: sessionId,
      phase: 'konling-chat-tool-runtime',
      status: 'running',
      state: {
        route: '/api/ai/sessions/[id]/messages',
        konlingSessionId: sessionId,
        currentTurnId: userMessage.id,
        ownedTurnIds,
        teachingAssistantMode: modeContract.mode.id,
        modeStatus: modeContract.status,
      },
      permittedTools: modeContract.permittedTools,
      smartPrepBinding,
    });
    const agentSessionStateUpdate = await prisma.agentSession.updateMany({
      where: {
        id: agentSession.id,
        ownerUserId: authorizedScope.targetUserId,
        actorUserId: authorizedScope.authenticatedUserId,
        konlingSessionId: sessionId,
      },
      data: { stateJson: {
        ...agentSession.state,
        route: '/api/ai/sessions/[id]/messages',
        konlingSessionId: sessionId,
        currentTurnId: userMessage.id,
        ownedTurnIds,
        teachingAssistantMode: modeContract.mode.id,
        ...(smartPrepBinding ? {
          smartPrepBinding: {
            taskId: smartPrepBinding.taskId,
            taskRevision: smartPrepBinding.taskRevision,
            ownerUserId: authorizedScope.targetUserId,
          },
        } : {}),
      } as Prisma.InputJsonObject,
      konlingSessionId: sessionId,
      },
    });
    if (agentSessionStateUpdate.count !== 1) throw new KonlingRuntimeScopeError(404, 'AgentSession turn binding persistence failed.');
    const modelRequirements: ModelProviderCapabilityRequirements = {
      tools: true,
      streaming: true,
      citationNormalization: true,
    };
    const isStructuredSmartPrepTurn = modeContract.mode.id === 'prep-coauthor'
      && Boolean(modeContract.smartPreparation);

    // 调用AI
    const result = await streamText({
      model: await getConfiguredAIModel(undefined, modelRequirements),
      system: systemPrompt,
      messages: await toModelMessages(updatedMessages),
      tools: buildScopedKonlingAiTools(buildKonlingToolRuntime({
        db: prisma,
        scope: authorizedScope,
        context: { ...modeRuntimeContext, permittedTools: modeContract.permittedTools },
        agentSessionId: agentSession.id,
        permittedTools: modeContract.permittedTools,
      })),
      ...(isStructuredSmartPrepTurn ? {
        stopWhen: stepCountIs(2),
        prepareStep: ({ stepNumber }: { stepNumber: number }) => stepNumber === 0
          ? {
            activeTools: ['propose_smart_lesson_task_change'],
            toolChoice: { type: 'tool' as const, toolName: 'propose_smart_lesson_task_change' },
          }
          : { activeTools: [], toolChoice: 'none' as const },
      } : {
        stopWhen: stepCountIs(5),
      }),
      maxOutputTokens: 1000,
      temperature: 0.7,
    });

    // 收集完整回复
    let assistantContent = '';
    for await (const chunk of result.textStream) {
      assistantContent += chunk;
    }
    const citationGuard = buildKonlingCitationGuard(modeRuntimeContext, assistantContent);
    const guardedAssistantContent = applyKonlingCitationFallback(assistantContent, citationGuard);
    const sarAssociatedGroundingMetadataPayload = buildKonlingSarAssociatedGroundingMetadataPayload(
      modeContract.groundingContext.sarAssociatedGrounding,
    );

    // 添加助手回复
    const assistantMessage: Message = toLegacyMessage({
      id: createKonlingMessageId(),
      role: 'assistant',
      content: guardedAssistantContent,
      metadata: {
        konlingCitationGuard: {
          status: citationGuard.status,
          missingCitationClasses: citationGuard.missingCitationClasses,
          lowConfidenceReasons: citationGuard.lowConfidenceReasons,
          diagnosticReasons: citationGuard.diagnosticReasons ?? [],
          personalizationAvailability: citationGuard.personalizationAvailability,
          missingContext: modeContract.groundingContext.missingContext,
          retrievalSources: buildKonlingCitationRetrievalSources(citationGuard),
          citations: citationGuard.citations.map(serializeKonlingCitationMetadata),
        },
        konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
      },
    });

    const persistedConversation = await completeKonlingConversationTurn(prisma, {
      conversationId: sessionId,
      ownerUserId: session.user.id,
      turnId: claimedConversationTurn.turnId,
      assistantMessage,
    });
    if (!persistedConversation) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const finalMessages = ((persistedConversation.messages as unknown as Message[]) || []).map(toLegacyMessage);
    await persistKonlingSessionMemories(prisma, {
      userId: konlingSession.userId,
      sessionId,
      courseId: authorizedScope.courseId,
      pageId: authorizedScope.pageId,
      classId: authorizedScope.classId,
      resourceId: authorizedScope.resourceId,
      pathNodeId: authorizedScope.pathNodeId,
      userMessage: content,
      assistantMessage: guardedAssistantContent,
    });
    const refreshedAgentSession = await resumeKonlingAgentSession(prisma, {
      scope: authorizedScope,
      agentSessionId: agentSession.id,
      konlingSessionId: sessionId,
      phase: 'konling-chat-tool-runtime',
      smartPrepBinding,
    });

    return NextResponse.json({
      messages: finalMessages,
      assistantMessage,
      citationGuard,
      agentSessionId: agentSession.id,
      pendingApproval: refreshedAgentSession.pendingApproval,
    });
  } catch (error) {
    if (claimedTurn) {
      await releaseKonlingConversationTurn(prisma, claimedTurn).catch(() => undefined);
    }
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingConversationTurnConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof KonlingRuntimeScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof KonlingAdaptiveAttemptContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AIProviderCapabilityUnavailableError) {
      console.error('Error in POST /api/ai/sessions/[id]/messages:', {
        name: error.name,
        message: redactProviderError(error),
      });
      return NextResponse.json(
        {
          error: 'AI_SERVICE_UNAVAILABLE',
          message: '智能助手暂时无法连接满足控灵能力要求的模型，请稍后再试。',
        },
        { status: 503 }
      );
    }
    console.error('Error in POST /api/ai/sessions/[id]/messages:', {
      name: error instanceof Error ? error.name : typeof error,
      message: redactProviderError(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/sessions/[id]/messages
 * 更新会话消息（批量替换）
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  void request;
  void context;
  return NextResponse.json(
    { error: 'Conversation history is append-only' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

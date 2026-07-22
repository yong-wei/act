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
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingSmartPrepSessionBinding,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import type { AIContext } from '@/types/ai-context';
import type { Message } from '@/types/ai-message';
import { redactProviderError, type ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';

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
    const konlingSession = await prisma.konlingSession.findUnique({
      where: { id: sessionId },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (konlingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 获取现有消息
    const existingMessages = ((konlingSession.messages as unknown as Message[]) || []).map(toLegacyMessage);

    // 添加用户消息
    const userMessage: Message = toLegacyMessage({
      id: Date.now().toString(),
      role: 'user',
      content,
    });

    const updatedMessages = [...existingMessages, userMessage];
    const ownedTurnIds = updatedMessages.filter((message) => message.role === 'user').map((message) => message.id).filter(Boolean).slice(-50);

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
      courseId: konlingSession.courseId,
      pageId: konlingSession.pageId,
      resourceId,
      pathNodeId,
      pageContextHint: pageContext,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const runtimeInput = {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: runtimeTargetUserId,
      classId: runtimeClassId,
      courseId: scope.scope.courseId,
      pageId: scope.scope.pageId,
      resourceId,
      pathNodeId,
      pageContextHint: pageContext,
      knowledgeWorkspaceHint: normalizeKonlingKnowledgeWorkspaceHint(knowledgeWorkspaceHint ?? modeClientContextHints),
      teachingAssistantModeId,
      currentUserQuery: userMessage.content,
      trustedContentContext: true,
    };
    const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext({
      db: prisma,
      modeId: teachingAssistantModeId,
      scope: scope.scope,
      clientContextHints: modeClientContextHints,
    });
    const smartPrepBinding = resolveKonlingSmartPrepSessionBinding(serverModeContext);
    const runtimeContext = await buildKonlingRuntimeContext(prisma, {
      ...runtimeInput,
      teachingAssistantServerModeContext: serverModeContext,
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: teachingAssistantModeId,
      runtimeContext,
      scope: scope.scope,
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

    // 构建AI上下文
    const aiContext: AIContext = {
      page: runtimeContext.pageContext,
      user: runtimeContext.userProfile,
      sessionHistory: existingMessages,
    };

    // 生成系统提示词
    const systemPrompt = buildKonlingSystemPrompt({
      ...aiContext,
      adaptiveRuntime: modeRuntimeContext,
    });
    const agentSession = await getOrCreateKonlingAgentSession(prisma, {
      scope: scope.scope,
      agentSessionId,
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
      where: { id: agentSession.id, ownerUserId: scope.scope.targetUserId, actorUserId: scope.scope.authenticatedUserId },
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
            ownerUserId: scope.scope.targetUserId,
          },
        } : {}),
      } as Prisma.InputJsonObject },
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
        scope: scope.scope,
        context: { ...modeRuntimeContext, permittedTools: modeContract.permittedTools },
        agentSessionId: agentSession.id,
        permittedTools: modeContract.permittedTools,
      })),
      ...(isStructuredSmartPrepTurn ? {
        activeTools: ['propose_smart_lesson_task_change'],
        toolChoice: { type: 'tool' as const, toolName: 'propose_smart_lesson_task_change' },
        stopWhen: stepCountIs(1),
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
      id: (Date.now() + 1).toString(),
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

    const finalMessages = [...updatedMessages, assistantMessage];

    // 更新会话
    await prisma.konlingSession.update({
      where: { id: sessionId },
      data: {
        messages: finalMessages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    await persistKonlingSessionMemories(prisma, {
      userId: konlingSession.userId,
      sessionId,
      courseId: konlingSession.courseId,
      pageId: konlingSession.pageId,
      classId: scope.scope.classId,
      resourceId: scope.scope.resourceId,
      pathNodeId: scope.scope.pathNodeId,
      userMessage: content,
      assistantMessage: guardedAssistantContent,
    });
    const refreshedAgentSession = await resumeKonlingAgentSession(prisma, {
      scope: scope.scope,
      agentSessionId: agentSession.id,
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
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingRuntimeScopeError) {
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;
    const body = await request.json();
    const { messages } = body;

    // 验证会话所有权
    const konlingSession = await prisma.konlingSession.findUnique({
      where: { id: sessionId },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (konlingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 更新消息
    await prisma.konlingSession.update({
      where: { id: sessionId },
      data: {
        messages: messages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in PUT /api/ai/sessions/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

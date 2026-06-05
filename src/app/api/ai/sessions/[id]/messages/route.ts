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
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError,
  persistKonlingSessionMemories,
  resumeKonlingAgentSession,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
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
    const { content, pageContext, classId, resourceId, pathNodeId, agentSessionId } = body;

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

    const scope = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      role: session.user.role,
      targetUserId: session.user.id,
      classId,
      courseId: konlingSession.courseId,
      pageId: konlingSession.pageId,
      resourceId,
      pathNodeId,
      pageContextHint: pageContext,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const runtimeContext = await buildKonlingRuntimeContext(prisma, {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: session.user.id,
      classId,
      courseId: scope.scope.courseId,
      pageId: scope.scope.pageId,
      resourceId,
      pathNodeId,
      pageContextHint: pageContext,
      trustedContentContext: true,
    });

    // 构建AI上下文
    const aiContext: AIContext = {
      page: runtimeContext.pageContext,
      user: runtimeContext.userProfile,
      sessionHistory: existingMessages,
    };

    // 生成系统提示词
    const systemPrompt = buildKonlingSystemPrompt({
      ...aiContext,
      adaptiveRuntime: runtimeContext,
    });
    const agentSession = await getOrCreateKonlingAgentSession(prisma, {
      scope: scope.scope,
      agentSessionId,
      phase: 'konling-chat-tool-runtime',
      status: 'running',
      state: { route: '/api/ai/sessions/[id]/messages', konlingSessionId: sessionId },
      permittedTools: runtimeContext.permittedTools,
    });
    const modelRequirements: ModelProviderCapabilityRequirements = {
      tools: true,
      streaming: true,
      citationNormalization: true,
    };

    // 调用AI
    const result = await streamText({
      model: await getConfiguredAIModel(undefined, modelRequirements),
      system: systemPrompt,
      messages: await toModelMessages(updatedMessages),
      tools: buildScopedKonlingAiTools(buildKonlingToolRuntime({
        db: prisma,
        scope: scope.scope,
        context: runtimeContext,
        agentSessionId: agentSession.id,
        permittedTools: agentSession.permittedTools,
      })),
      stopWhen: stepCountIs(5),
      maxOutputTokens: 1000,
      temperature: 0.7,
    });

    // 收集完整回复
    let assistantContent = '';
    for await (const chunk of result.textStream) {
      assistantContent += chunk;
    }
    const citationGuard = buildKonlingCitationGuard(runtimeContext, assistantContent);
    const guardedAssistantContent = applyKonlingCitationFallback(assistantContent, citationGuard);

    // 添加助手回复
    const assistantMessage: Message = toLegacyMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: guardedAssistantContent,
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

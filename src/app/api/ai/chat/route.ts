/**
 * AI Copilot 聊天 API
 *
 * 使用 Vercel AI SDK 实现流式聊天响应
 * 支持 Function Calling 工具调用
 * 支持控灵上下文感知系统提示词
 */

import { streamText, convertToCoreMessages, type Message } from 'ai';
import { getConfiguredAIModel, isConfiguredAIServiceAvailable, SYSTEM_PROMPT, buildContextAwarePrompt, type LessonContext } from '@/lib/ai-client';
import { aiTools, updateSimulationState } from '@/lib/ai-tools';
import { getServerAuthSession } from '@/lib/auth';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import type { AIContext, PageContext, UserProfile } from '@/types/ai-context';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function sanitizeAIErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+\S+/g, 'Bearer ***').slice(0, 500);
}

function isExternalAIProviderError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return /SiliconFlow|DeepSeek|curl|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|AI SDK/i.test(message);
}

function summarizeAIChatError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: sanitizeAIErrorMessage(error),
    providerFailure: isExternalAIProviderError(error),
  };
}

function buildAIChatErrorResponse(error: unknown) {
  const providerFailure = isExternalAIProviderError(error);

  return new Response(
    JSON.stringify({
      error: providerFailure ? 'AI_SERVICE_UNAVAILABLE' : '服务器错误',
      message: providerFailure
        ? '智能助手暂时无法连接外部模型，请稍后再试。'
        : '智能助手暂时无法完成请求，请稍后再试。',
    }),
    {
      status: providerFailure ? 503 : 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function getAIStreamErrorMessage(error: unknown) {
  return isExternalAIProviderError(error)
    ? '智能助手暂时无法连接外部模型，请稍后再试。'
    : '智能助手暂时无法完成请求，请稍后再试。';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      messages,
      simulationState,
      lessonContext,
      pageContext,
      userProfile,
      courseId,
      pageId,
      classId,
      resourceId,
      pathNodeId,
      agentSessionId,
    } = body as {
      messages: Message[];
      simulationState?: Record<string, unknown>;
      lessonContext?: LessonContext;
      pageContext?: PageContext;
      userProfile?: UserProfile;
      courseId?: string;
      pageId?: string;
      classId?: string;
      resourceId?: string;
      pathNodeId?: string;
      agentSessionId?: string;
    };

    // 验证用户身份
    const session = await getServerAuthSession();
    const allowAnonymousInteractive =
      process.env.NODE_ENV === 'development' &&
      lessonContext?.stage === 'interactive';

    if (!session?.user?.id && !allowAnonymousInteractive) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasRuntimeContext = Boolean(
      (courseId || pageContext?.courseId) &&
      (pageId || pageContext?.stepId),
    );

    // 旧 AI 工具仍使用全局仿真状态；Konling runtime 使用当前请求的 scoped state。
    if (simulationState && !hasRuntimeContext) {
      updateSimulationState(simulationState as Parameters<typeof updateSimulationState>[0]);
    }

    let tools: any = aiTools;

    // 构建系统提示词
    let systemPrompt: string;
    let agentSessionResponseHeaders: HeadersInit | undefined;

    if (session?.user?.id && hasRuntimeContext) {
      const scope = await verifyKonlingRuntimeScope(prisma, {
        authenticatedUserId: session.user.id,
        role: session.user.role,
        targetUserId: session.user.id,
        classId,
        courseId: courseId || pageContext?.courseId,
        pageId: pageId || pageContext?.stepId,
        resourceId,
        pathNodeId,
        pageContextHint: pageContext,
      });
      if (!scope.ok) {
        return new Response(JSON.stringify({ error: scope.error }), {
          status: scope.status,
          headers: { 'Content-Type': 'application/json' },
        });
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
      });
      const aiContext: AIContext = {
        page: runtimeContext.pageContext,
        user: runtimeContext.userProfile,
        sessionHistory: messages.slice(0, -1),
      };
      systemPrompt = buildKonlingSystemPrompt({
        ...aiContext,
        adaptiveRuntime: runtimeContext,
      });
      const agentSession = await getOrCreateKonlingAgentSession(prisma, {
        scope: scope.scope,
        agentSessionId,
        phase: 'ai-chat-tool-runtime',
        status: 'running',
        state: { route: '/api/ai/chat' },
        permittedTools: runtimeContext.permittedTools,
      });
      agentSessionResponseHeaders = {
        'X-Konling-Agent-Session-Id': agentSession.id,
      };
      tools = buildScopedKonlingAiTools(buildKonlingToolRuntime({
        db: prisma,
        scope: scope.scope,
        context: runtimeContext,
        agentSessionId: agentSession.id,
        scopedSimulationState: simulationState as Parameters<typeof updateSimulationState>[0] | undefined,
      }));
    } else if (pageContext && userProfile) {
      const aiContext: AIContext = {
        page: pageContext,
        user: userProfile,
        sessionHistory: messages.slice(0, -1),
      };
      systemPrompt = buildKonlingSystemPrompt(aiContext);
    } else {
      // 回退到旧的提示词构建方式
      systemPrompt = buildContextAwarePrompt(SYSTEM_PROMPT, lessonContext);
    }

    // 检查 API Key 配置
    if (!(await isConfiguredAIServiceAvailable())) {
      return new Response(
        JSON.stringify({
          error: 'AI 服务未配置',
          message: '请在环境变量中配置 AI_API_KEY',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 使用 Vercel AI SDK 生成流式响应
    const result = await streamText({
      model: await getConfiguredAIModel(),
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      tools,
      maxSteps: 5, // 允许最多5轮工具调用
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 2000,
    });

    // 返回流式响应
    return result.toDataStreamResponse({
      init: agentSessionResponseHeaders ? { headers: agentSessionResponseHeaders } : undefined,
      getErrorMessage: getAIStreamErrorMessage,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingRuntimeScopeError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('AI Chat API 错误:', summarizeAIChatError(error));
    return buildAIChatErrorResponse(error);
  }
}

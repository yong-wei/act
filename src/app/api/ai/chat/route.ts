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
    } = body as {
      messages: Message[];
      simulationState?: Record<string, unknown>;
      lessonContext?: LessonContext;
      pageContext?: PageContext;
      userProfile?: UserProfile;
      courseId?: string;
      pageId?: string;
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

    // 如果提供了仿真状态，更新到工具存储
    if (simulationState) {
      updateSimulationState(simulationState as Parameters<typeof updateSimulationState>[0]);
    }

    // 构建系统提示词
    let systemPrompt: string;

    // 优先使用新的控灵上下文格式
    if (pageContext && userProfile) {
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
      tools: aiTools,
      maxSteps: 5, // 允许最多5轮工具调用
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 2000,
    });

    // 返回流式响应
    return result.toDataStreamResponse({
      getErrorMessage: getAIStreamErrorMessage,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('AI Chat API 错误:', summarizeAIChatError(error));
    return buildAIChatErrorResponse(error);
  }
}

/**
 * AI Copilot 聊天 API
 *
 * 使用 Vercel AI SDK 实现流式聊天响应
 * 支持 Function Calling 工具调用
 * 支持控灵上下文感知系统提示词
 */

import { consumeStream, createUIMessageStreamResponse, streamText, stepCountIs } from 'ai';
import { getConfiguredAIModel, isConfiguredAIServiceAvailable, SYSTEM_PROMPT, buildContextAwarePrompt, type LessonContext } from '@/lib/ai-client';
import { toLegacyMessage, toModelMessages, toUIMessage, type IncomingMessage } from '@/lib/ai-message-compat';
import { aiTools, updateSimulationState } from '@/lib/ai-tools';
import { getServerAuthSession } from '@/lib/auth';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildStreamingCitationFallbackNotice,
  insertStreamingCitationFallbackNotice,
} from '@/lib/konling-streaming-citation-fallback';
import {
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import {
  buildKonlingCitationGuard,
  buildKonlingStreamingCitationGuard,
  buildKonlingRuntimeContext,
  buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError,
  normalizeKonlingKnowledgeWorkspaceHint,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';
import { redactProviderError, type ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';
import type { AIContext, PageContext, UserProfile } from '@/types/ai-context';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function sanitizeAIErrorMessage(error: unknown) {
  return redactProviderError(error);
}

function isExternalAIProviderError(error: unknown) {
  if (error instanceof AIProviderCapabilityUnavailableError) {
    return true;
  }
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
      messages: rawMessages,
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
      teachingAssistantModeId,
      modeClientContextHints,
      knowledgeWorkspaceHint,
    } = body as {
      messages: IncomingMessage[];
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
      teachingAssistantModeId?: string;
      modeClientContextHints?: Record<string, unknown>;
      knowledgeWorkspaceHint?: Record<string, unknown>;
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
    if (teachingAssistantModeId && !session?.user?.id) {
      return new Response(JSON.stringify({
        error: 'KONLING_MODE_UNAVAILABLE',
        mode: teachingAssistantModeId,
        status: 'unavailable',
        unavailableReasons: ['missing-authenticated-runtime-scope'],
        degradedReasons: [],
        clientHintsRejected: Object.keys(modeClientContextHints ?? {}),
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Konling-Assistant-Mode': teachingAssistantModeId,
          'X-Konling-Assistant-Mode-Status': 'unavailable',
        },
      });
    }

    if (!Array.isArray(rawMessages)) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uiMessages = rawMessages.map(toUIMessage);
    const messages = uiMessages.map(toLegacyMessage);

    const hasRuntimeContext = Boolean(
      (courseId || pageContext?.courseId) &&
      (pageId || pageContext?.stepId),
    );
    if (teachingAssistantModeId && !hasRuntimeContext) {
      return new Response(JSON.stringify({
        error: 'KONLING_MODE_UNAVAILABLE',
        mode: teachingAssistantModeId,
        status: 'unavailable',
        unavailableReasons: ['missing-runtime-context'],
        degradedReasons: [],
        clientHintsRejected: Object.keys(modeClientContextHints ?? {}),
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'X-Konling-Assistant-Mode': teachingAssistantModeId,
          'X-Konling-Assistant-Mode-Status': 'unavailable',
        },
      });
    }

    // 旧 AI 工具仍使用全局仿真状态；Konling runtime 使用当前请求的 scoped state。
    if (simulationState && !hasRuntimeContext) {
      updateSimulationState(simulationState as Parameters<typeof updateSimulationState>[0]);
    }

    let tools: any = aiTools;

    // 构建系统提示词
    let systemPrompt: string;
    let agentSessionResponseHeaders: HeadersInit | undefined;
    let citationGuardMetadata: ReturnType<typeof buildKonlingCitationGuard> | null = null;
    let modelRequirements: ModelProviderCapabilityRequirements = {
      tools: true,
      streaming: true,
    };

    if (session?.user?.id && hasRuntimeContext) {
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
        targetUserId: runtimeTargetUserId,
        classId: runtimeClassId,
        courseId: scope.scope.courseId,
        pageId: scope.scope.pageId,
        resourceId,
        pathNodeId,
        pageContextHint: pageContext,
        knowledgeWorkspaceHint: normalizeKonlingKnowledgeWorkspaceHint(knowledgeWorkspaceHint ?? modeClientContextHints),
        trustedContentContext: Boolean(scope.scope.courseId && scope.scope.pageId),
      });
      const modeContract = buildKonlingTeachingAssistantRuntimeContract({
        modeId: teachingAssistantModeId,
        runtimeContext,
        scope: scope.scope,
        serverModeContext: await resolveKonlingTeachingAssistantServerModeContext({
          db: prisma,
          modeId: teachingAssistantModeId,
          runtimeContext,
          scope: scope.scope,
          clientContextHints: modeClientContextHints,
        }),
        clientContextHints: modeClientContextHints,
      });
      if (modeContract.status === 'unavailable') {
        return new Response(JSON.stringify({
          error: 'KONLING_MODE_UNAVAILABLE',
          mode: modeContract.mode.id,
          status: modeContract.status,
          unavailableReasons: modeContract.unavailableReasons,
          degradedReasons: modeContract.degradedReasons,
          clientHintsRejected: modeContract.clientHintsRejected,
        }), {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'X-Konling-Assistant-Mode': modeContract.mode.id,
            'X-Konling-Assistant-Mode-Status': modeContract.status,
          },
        });
      }
      const modeRuntimeContext = {
        ...runtimeContext,
        teachingAssistantMode: modeContract,
      };
      const aiContext: AIContext = {
        page: runtimeContext.pageContext,
        user: runtimeContext.userProfile,
        sessionHistory: messages.slice(0, -1),
      };
      systemPrompt = buildKonlingSystemPrompt({
        ...aiContext,
        adaptiveRuntime: modeRuntimeContext,
      });
      citationGuardMetadata = buildKonlingStreamingCitationGuard(modeRuntimeContext);
      modelRequirements = {
        ...modelRequirements,
        tools: true,
        streaming: true,
        citationNormalization: true,
      };
      const agentSession = await getOrCreateKonlingAgentSession(prisma, {
        scope: scope.scope,
        agentSessionId,
        phase: 'ai-chat-tool-runtime',
        status: 'running',
        state: { route: '/api/ai/chat', teachingAssistantMode: modeContract.mode.id, modeStatus: modeContract.status },
        permittedTools: modeContract.permittedTools,
      });
      agentSessionResponseHeaders = {
        'X-Konling-Agent-Session-Id': agentSession.id,
        'X-Konling-Citation-Guard': citationGuardMetadata.status,
        'X-Konling-Assistant-Mode': modeContract.mode.id,
        'X-Konling-Assistant-Mode-Status': modeContract.status,
      };
      tools = buildScopedKonlingAiTools(buildKonlingToolRuntime({
        db: prisma,
        scope: scope.scope,
        context: { ...runtimeContext, permittedTools: modeContract.permittedTools },
        agentSessionId: agentSession.id,
        permittedTools: modeContract.permittedTools,
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
    if (!(await isConfiguredAIServiceAvailable(modelRequirements))) {
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
      model: await getConfiguredAIModel(undefined, modelRequirements),
      system: systemPrompt,
      messages: await toModelMessages(uiMessages),
      tools,
      stopWhen: stepCountIs(5), // 允许最多5轮工具调用
      toolChoice: 'auto',
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    const uiMessageStream = result.toUIMessageStream({
      originalMessages: uiMessages,
      generateMessageId: () => crypto.randomUUID(),
      messageMetadata: ({ part }) => {
        if (!citationGuardMetadata || (part.type !== 'start' && part.type !== 'finish')) return undefined;
        return {
          konlingCitationGuard: {
            status: citationGuardMetadata.status,
            missingCitationClasses: citationGuardMetadata.missingCitationClasses,
            lowConfidenceReasons: citationGuardMetadata.lowConfidenceReasons,
            citations: citationGuardMetadata.citations.map((citation) => ({
              sourceType: citation.sourceType,
              displayTitle: citation.displayTitle,
              href: citation.href,
              confidence: citation.confidence,
              evidenceBasis: citation.evidenceBasis,
            })),
          },
        };
      },
      onError: getAIStreamErrorMessage,
    });
    const guardedUiMessageStream = insertStreamingCitationFallbackNotice(
      uiMessageStream,
      buildStreamingCitationFallbackNotice(citationGuardMetadata),
    );

    // 返回流式响应
    return createUIMessageStreamResponse({
      headers: agentSessionResponseHeaders,
      stream: guardedUiMessageStream,
      consumeSseStream: consumeStream,
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

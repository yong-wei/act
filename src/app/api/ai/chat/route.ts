/**
 * AI Copilot 聊天 API
 *
 * 使用 Vercel AI SDK 实现流式聊天响应
 * 支持 Function Calling 工具调用
 * 支持控灵上下文感知系统提示词
 */

import { consumeStream, createUIMessageStreamResponse, streamText, stepCountIs } from 'ai';
import { createHash } from 'node:crypto';
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

const PATH_ADVISOR_GENERATION_VERB = '(?:生成|创建|新建|制定|规划|重建|重新生成|重新规划)';
const PATH_ADVISOR_PATH_NOUN = '(?:学习路径|路径方案|学习方案|学习计划|路径规划)';
const PATH_ADVISOR_NEGATION = '(?:不要|别|无需|不需要|禁止|暂不|先不要|先别|不用)';

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
      const agentSession = await getOrCreateKonlingAgentSession(prisma, {
        scope: scope.scope,
        agentSessionId,
        phase: 'ai-chat-tool-runtime',
        status: 'running',
        state: { route: '/api/ai/chat', teachingAssistantMode: modeContract.mode.id, modeStatus: modeContract.status },
        permittedTools: modeContract.permittedTools,
      });
      const toolRuntime = buildKonlingToolRuntime({
        db: prisma,
        scope: scope.scope,
        context: { ...runtimeContext, permittedTools: modeContract.permittedTools },
        agentSessionId: agentSession.id,
        permittedTools: modeContract.permittedTools,
        scopedSimulationState: simulationState as Parameters<typeof updateSimulationState>[0] | undefined,
      });
      const proactivePathGeneration = await maybeGeneratePathAdvisorPlan({
        modeId: modeContract.mode.id,
        permittedTools: modeContract.permittedTools,
        scope: scope.scope,
        agentSessionId: agentSession.id,
        messages,
        runtime: toolRuntime,
      });
      if (proactivePathGeneration) {
        systemPrompt = `${systemPrompt}\n\n${proactivePathGeneration}`;
      }
      agentSessionResponseHeaders = {
        'X-Konling-Agent-Session-Id': agentSession.id,
        'X-Konling-Citation-Guard': citationGuardMetadata.status,
        'X-Konling-Assistant-Mode': modeContract.mode.id,
        'X-Konling-Assistant-Mode-Status': modeContract.status,
      };
      tools = buildScopedKonlingAiTools(toolRuntime);
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

async function maybeGeneratePathAdvisorPlan(input: {
  modeId: string;
  permittedTools: string[];
  scope: {
    authenticatedUserId: string;
    targetUserId: string;
    courseId: string;
    pageId: string;
  };
  agentSessionId: string;
  messages: Array<{ role?: string; content?: unknown }>;
  runtime: ReturnType<typeof buildKonlingToolRuntime>;
}) {
  if (input.modeId !== 'path-advisor') return null;
  if (!input.permittedTools.includes('generate_learning_path')) return null;
  if (input.scope.authenticatedUserId !== input.scope.targetUserId) return null;

  const text = getLastUserMessageText(input.messages);
  if (!isLearningPathGenerationRequest(text)) return null;

  const generationOptions = extractPathAdvisorGenerationOptions(text);
  const result = await input.runtime.generateLearningPath({
    idempotencyKey: buildPathAdvisorGenerationIdempotencyKey(input.scope, {
      agentSessionId: input.agentSessionId,
      lastUserMessageIndex: findLastUserMessageIndex(input.messages),
      text,
    }),
    goalId: input.scope.courseId,
    routeIntent: 'path-advisor-chat-generation',
    naturalLanguageIntent: text,
    ...generationOptions,
  }) as {
    pathId?: string;
    pathOptions?: Array<{ label?: string; estimatedMinutes?: number; limitations?: string[] }>;
    comparison?: { optionCount?: number; message?: string };
  };

  const optionSummaries = (result.pathOptions ?? []).slice(0, 3).map((option, index) =>
    `${index + 1}. ${option.label ?? '学习路径'}${typeof option.estimatedMinutes === 'number' ? `，约 ${option.estimatedMinutes} 分钟` : ''}`
  );

  return [
    '**已执行路径生成工具**:',
    `- 工具: generate_learning_path`,
    `- 路径ID: ${result.pathId ?? 'unknown'}`,
    `- 方案数量: ${result.comparison?.optionCount ?? result.pathOptions?.length ?? 0}`,
    optionSummaries.length ? `- 方案摘要: ${optionSummaries.join('；')}` : null,
    '- 回答要求: 直接说明路径已经生成，可提示学生在页面的路径比较区选择方案；不要再口头虚构未持久化的新路径。',
  ].filter((line): line is string => Boolean(line)).join('\n');
}

function getLastUserMessageText(messages: Array<{ role?: string; content?: unknown }>) {
  const lastUserMessageIndex = findLastUserMessageIndex(messages);
  const lastUserMessage = lastUserMessageIndex >= 0 ? messages[lastUserMessageIndex] : null;
  if (!lastUserMessage) return '';
  return typeof lastUserMessage.content === 'string' ? lastUserMessage.content.trim() : '';
}

function findLastUserMessageIndex(messages: Array<{ role?: string; content?: unknown }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index;
  }
  return -1;
}

function isLearningPathGenerationRequest(text: string) {
  if (!text) return false;
  const compactText = text.replace(/\s+/g, '');
  const negatedGeneration = new RegExp(
    `(?:${PATH_ADVISOR_NEGATION}.{0,12}${PATH_ADVISOR_GENERATION_VERB}.{0,24}${PATH_ADVISOR_PATH_NOUN}|${PATH_ADVISOR_NEGATION}.{0,12}${PATH_ADVISOR_PATH_NOUN}.{0,24}${PATH_ADVISOR_GENERATION_VERB})`,
  );
  if (negatedGeneration.test(compactText)) return false;
  return new RegExp(
    `(?:${PATH_ADVISOR_GENERATION_VERB}.{0,24}${PATH_ADVISOR_PATH_NOUN}|${PATH_ADVISOR_PATH_NOUN}.{0,24}${PATH_ADVISOR_GENERATION_VERB})`,
  ).test(compactText);
}

function extractPathAdvisorGenerationOptions(text: string) {
  const compactText = text.replace(/\s+/g, '');
  const timeBudgetMinutes = extractPathAdvisorTimeBudgetMinutes(compactText);
  const resourcePreference = extractPathAdvisorResourcePreference(compactText);
  return {
    ...(typeof timeBudgetMinutes === 'number' ? { timeBudgetMinutes } : {}),
    ...(resourcePreference.length > 0 ? { resourcePreference } : {}),
  };
}

function extractPathAdvisorTimeBudgetMinutes(compactText: string) {
  const hourMatch = compactText.match(/(\d{1,2}(?:\.\d+)?)小时/);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }
  const minuteMatch = compactText.match(/(\d{1,3})分钟/);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }
  return null;
}

function extractPathAdvisorResourcePreference(compactText: string) {
  const preferences: string[] = [];
  if (/仿真|虚拟实验|实验/.test(compactText)) preferences.push('simulation');
  if (/练习|题目|自适应题|测验/.test(compactText)) preferences.push('adaptive_quiz');
  if (/竞技场|挑战|任务/.test(compactText)) preferences.push('arena_task');
  if (/知识卡|知识点|讲义|资料/.test(compactText)) preferences.push('knowledge_card');
  return [...new Set(preferences)];
}

function buildPathAdvisorGenerationIdempotencyKey(
  scope: { authenticatedUserId: string; targetUserId: string; courseId: string; pageId: string },
  request: { agentSessionId: string; lastUserMessageIndex: number; text: string },
) {
  const digest = createHash('sha256')
    .update([
      scope.authenticatedUserId,
      scope.targetUserId,
      scope.courseId,
      scope.pageId,
      request.agentSessionId,
      String(request.lastUserMessageIndex),
      request.text,
    ].join('\0'))
    .digest('hex')
    .slice(0, 24);
  return `path-advisor:auto-generate:${digest}`;
}

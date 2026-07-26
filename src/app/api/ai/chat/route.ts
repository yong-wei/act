/**
 * AI Copilot 聊天 API
 *
 * 使用 Vercel AI SDK 实现流式聊天响应
 * 支持 Function Calling 工具调用
 * 支持控灵上下文感知系统提示词
 */

import { consumeStream, createUIMessageStreamResponse, generateText, streamText, stepCountIs } from 'ai';
import { getConfiguredAIModel, isConfiguredAIServiceAvailable, SYSTEM_PROMPT, buildContextAwarePrompt, type LessonContext } from '@/lib/ai-client';
import {
  getMessageContent,
  replaceMessageTextContent,
  toLegacyMessage,
  toModelMessages,
  toUIMessage,
  type IncomingMessage,
} from '@/lib/ai-message-compat';
import { aiTools, updateSimulationState } from '@/lib/ai-tools';
import { getServerAuthSession } from '@/lib/auth';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildStreamingCitationFallbackNotice,
  insertStreamingCitationFallbackNotice,
} from '@/lib/konling-streaming-citation-fallback';
import { appendFinalCitationGuardMetadata } from '@/lib/konling-final-citation-metadata-stream';
import {
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingSmartPrepSessionBinding,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import {
  buildKonlingCitationGuard,
  buildKonlingCitationRetrievalSources,
  buildKonlingStreamingCitationGuard,
  buildKonlingRuntimeContext,
  buildKonlingSarAssociatedGroundingMetadataPayload,
  buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError,
  normalizeKonlingKnowledgeWorkspaceHint,
  serializeKonlingCitationMetadata,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';
import { redactProviderError, type ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';
import {
  claimKonlingConversationTurn,
  completeKonlingConversationTurn,
  KonlingConversationTurnConflictError,
  prepareKonlingConversationTurn,
  releaseKonlingConversationTurn,
  replaceKonlingConversationAssistantRevision,
  resolveKonlingContextEventScope,
} from '@/lib/konling-conversation-library';
import type { AIContext, PageContext, UserProfile } from '@/types/ai-context';
import type { Message } from '@/types/ai-message';
import type { Prisma } from '@prisma/client';
import {
  normalizeAndRepairKonlingCitations,
  type KonlingCitationRepairRequest,
  type KonlingCitationRepairMapping,
} from '@/lib/konling-citation-repair';
import type { KonlingAssignedCitation } from '@/lib/konling-citation-protocol';
import { createKonlingMessageRevisionStream } from '@/lib/konling-message-revision-stream';
import { resolveKonlingTextbookOptimizations } from '@/lib/konling-textbook-background-optimization';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const CITATION_REPAIR_SYSTEM_PROMPT = [
  '你只执行引用标记映射，不回答原问题，不改写回答正文。',
  '只能把 unresolvedMarkers 映射到 assignedCitations 中已有的 displayNumber。',
  '不得增加来源、URL、正文、解释或其他字段。',
  '仅返回 JSON 数组，元素格式为 {"marker":"原始标记","displayNumber":1}。',
].join('\n');

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

function buildCitationGuardMetadataPayload(
  citationGuardMetadata: ReturnType<typeof buildKonlingCitationGuard>,
  missingContext: string[],
) {
  return {
    status: citationGuardMetadata.status,
    missingCitationClasses: citationGuardMetadata.missingCitationClasses,
    lowConfidenceReasons: citationGuardMetadata.lowConfidenceReasons,
    diagnosticReasons: citationGuardMetadata.diagnosticReasons ?? [],
    personalizationAvailability: citationGuardMetadata.personalizationAvailability,
    studyQuestion: asPrismaJsonValue(citationGuardMetadata.studyQuestion ?? null),
    answerUnits: asPrismaJsonValue(citationGuardMetadata.answerUnits ?? []),
    missingContext,
    retrievalSources: buildKonlingCitationRetrievalSources(citationGuardMetadata),
    citations: citationGuardMetadata.citations.map(serializeKonlingCitationMetadata),
  };
}

function asPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseCitationRepairMappings(text: string): KonlingCitationRepairMapping[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const value = JSON.parse(match[0]);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const marker = (entry as Record<string, unknown>).marker;
      const displayNumber = (entry as Record<string, unknown>).displayNumber;
      return typeof marker === 'string' && Number.isInteger(displayNumber) && Number(displayNumber) > 0
        ? [{ marker, displayNumber: Number(displayNumber) }]
        : [];
    });
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  let claimedTurn: {
    conversationId: string;
    ownerUserId: string;
    turnId: string;
  } | null = null;
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
      conversationId,
      agentSessionId,
      teachingAssistantModeId,
      modeClientContextHints,
      knowledgeWorkspaceHint,
      studyAnswerPreferences,
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
      conversationId?: string;
      agentSessionId?: string;
      teachingAssistantModeId?: string;
      modeClientContextHints?: Record<string, unknown>;
      knowledgeWorkspaceHint?: Record<string, unknown>;
      studyAnswerPreferences?: unknown;
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

    let uiMessages = rawMessages.map(toUIMessage);
    let messages = uiMessages.map(toLegacyMessage);
    const requestedUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const conversation = conversationId && session?.user?.id
      ? await prisma.konlingSession.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
          libraryVisible: true,
          expiresAt: { gt: new Date() },
        },
      })
      : null;
    if (conversationId && !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (conversation && !requestedUserMessage) {
      return new Response(JSON.stringify({ error: 'Conversation turn requires a user message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    let ownedTurnIds = messages.filter((message) => message.role === 'user').map((message) => message.id).filter(Boolean).slice(-50);

    const hasRuntimeContext = Boolean(
      (courseId || pageContext?.courseId) &&
      (pageId || pageContext?.stepId),
    ) || Boolean(conversation);
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
    let citationGuardMetadataContext: { missingContext: string[] } | null = null;
    let citationGuardMetadataPayload: ReturnType<typeof buildCitationGuardMetadataPayload> | null = null;
    let sarAssociatedGroundingMetadataPayload: ReturnType<typeof buildKonlingSarAssociatedGroundingMetadataPayload> | null = null;
    let buildFinalCitationGuardMetadataPayload: ((assistantContent: string) => ReturnType<typeof buildCitationGuardMetadataPayload>) | null = null;
    let getAssignedCitationTable: (() => KonlingAssignedCitation[]) | null = null;
    let getTextbookOptimizations:
      | ReturnType<typeof buildKonlingToolRuntime>['getTextbookOptimizations']
      | null = null;
    let citationRepairUsed = false;
    let citationRepairServerContext: KonlingCitationRepairRequest['serverContext'] | null = null;
    let citationRepairPrivateValues: readonly string[] = [];
    let forceStructuredSmartPrepTool = false;
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
        courseId: courseId || pageContext?.courseId || conversation?.courseId,
        pageId: pageId || pageContext?.stepId || conversation?.pageId,
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
      const contextEventScope = conversation
        ? await resolveKonlingContextEventScope(prisma, scope.scope)
        : null;
      if (conversation && !contextEventScope) {
        return new Response(JSON.stringify({ error: 'Page context is not registered for Konling.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const authorizedScope = contextEventScope
        ? { ...scope.scope, ...contextEventScope }
        : scope.scope;
      if (conversation && requestedUserMessage) {
        const preparedTurn = prepareKonlingConversationTurn({
          conversation,
          currentScope: authorizedScope,
          userMessage: requestedUserMessage,
        });
        messages = preparedTurn.modelMessages;
        uiMessages = messages.map(toUIMessage);
        ownedTurnIds = messages
          .filter((message) => message.role === 'user')
          .map((message) => message.id)
          .filter(Boolean)
          .slice(-50);
      }
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
        currentUserQuery: messages.at(-1)?.role === 'user' ? messages.at(-1)?.content : null,
        trustedContentContext: Boolean(authorizedScope.courseId && authorizedScope.pageId),
      };
      const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext({
        db: prisma,
        modeId: teachingAssistantModeId,
        scope: authorizedScope,
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
        scope: authorizedScope,
        serverModeContext,
        clientContextHints: modeClientContextHints,
        currentUserQuery: runtimeInput.currentUserQuery,
        studyAnswerPreferences,
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
      forceStructuredSmartPrepTool = modeContract.mode.id === 'prep-coauthor'
        && Boolean(modeContract.smartPreparation);
      const modeRuntimeContext = {
        ...runtimeContext,
        knowledgeCapabilityContext: modeContract.groundingContext,
        teachingAssistantMode: modeContract,
      };
      citationRepairServerContext = Object.freeze({
        role: authorizedScope.role,
        topic: runtimeContext.pageContext.topic,
        courseTitle: runtimeContext.pageContext.courseTitle,
      });
      citationRepairPrivateValues = Object.freeze([
        session.user.id,
        session.user.name ?? '',
        authorizedScope.authenticatedUserId,
        authorizedScope.targetUserId,
        authorizedScope.classId ?? '',
        authorizedScope.resourceId ?? '',
        authorizedScope.pathNodeId ?? '',
      ].filter(Boolean));
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
      citationGuardMetadataContext = {
        missingContext: modeContract.groundingContext.missingContext,
      };
      citationGuardMetadataPayload = buildCitationGuardMetadataPayload(
        citationGuardMetadata,
        citationGuardMetadataContext.missingContext,
      );
      sarAssociatedGroundingMetadataPayload = buildKonlingSarAssociatedGroundingMetadataPayload(
        modeContract.groundingContext.sarAssociatedGrounding,
      );
      buildFinalCitationGuardMetadataPayload = (assistantContent: string) => buildCitationGuardMetadataPayload(
        buildKonlingCitationGuard(modeRuntimeContext, assistantContent),
        citationGuardMetadataContext?.missingContext ?? [],
      );
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
      if (conversation && requestedUserMessage) {
        const claimedConversationTurn = await claimKonlingConversationTurn(prisma, {
          conversationId: conversation.id,
          ownerUserId: session.user.id,
          currentScope: authorizedScope,
          userMessage: requestedUserMessage,
        });
        if (!claimedConversationTurn) {
          return new Response(JSON.stringify({ error: 'Conversation not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        claimedTurn = {
          conversationId: conversation.id,
          ownerUserId: session.user.id,
          turnId: claimedConversationTurn.turnId,
        };
        messages = claimedConversationTurn.modelMessages;
        uiMessages = messages.map(toUIMessage);
        ownedTurnIds = messages
          .filter((message) => message.role === 'user')
          .map((message) => message.id)
          .filter(Boolean)
          .slice(-50);
      }
      const agentSession = await getOrCreateKonlingAgentSession(prisma, {
        scope: authorizedScope,
        agentSessionId: conversationId && agentSessionId
          ? (await prisma.agentSession.findFirst({
            where: {
              id: agentSessionId,
              ownerUserId: authorizedScope.targetUserId,
              actorUserId: authorizedScope.authenticatedUserId,
              konlingSessionId: conversationId,
              courseId: authorizedScope.courseId,
              pageId: authorizedScope.pageId,
            },
            select: { id: true },
          }))?.id
          : agentSessionId,
        konlingSessionId: conversationId,
        phase: 'ai-chat-tool-runtime',
        status: 'running',
        state: {
          route: '/api/ai/chat',
          ...(conversationId ? { conversationId } : {}),
          currentTurnId: messages.at(-1)?.id ?? null,
          ownedTurnIds,
          teachingAssistantMode: modeContract.mode.id,
          modeStatus: modeContract.status,
          konlingCitationGuard: citationGuardMetadataPayload,
          konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
        },
        permittedTools: modeContract.permittedTools,
        smartPrepBinding,
      });
      const agentSessionStateUpdate = await prisma.agentSession.updateMany({
        where: {
          id: agentSession.id,
          ownerUserId: authorizedScope.targetUserId,
          actorUserId: authorizedScope.authenticatedUserId,
          classId: authorizedScope.classId ?? null,
          courseId: authorizedScope.courseId,
          pageId: authorizedScope.pageId,
          resourceId: authorizedScope.resourceId ?? null,
          pathNodeId: authorizedScope.pathNodeId ?? null,
          ...(conversationId ? { konlingSessionId: conversationId } : {}),
        },
        data: {
          ...(conversationId ? { konlingSessionId: conversationId } : {}),
          stateJson: {
            ...agentSession.state,
            route: '/api/ai/chat',
            ...(conversationId ? { conversationId } : {}),
            currentTurnId: messages.at(-1)?.id ?? null,
            ownedTurnIds,
            teachingAssistantMode: modeContract.mode.id,
            modeStatus: modeContract.status,
            konlingCitationGuard: citationGuardMetadataPayload,
            konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
            ...(smartPrepBinding ? {
              smartPrepBinding: {
                taskId: smartPrepBinding.taskId,
                taskRevision: smartPrepBinding.taskRevision,
                ownerUserId: authorizedScope.targetUserId,
              },
            } : {}),
          } as Prisma.InputJsonObject,
        },
      });
      if (agentSessionStateUpdate.count !== 1) {
        throw new KonlingRuntimeScopeError(404, 'AgentSession citation metadata persistence failed.');
      }
      const toolRuntime = buildKonlingToolRuntime({
        db: prisma,
        scope: authorizedScope,
        context: { ...modeRuntimeContext, permittedTools: modeContract.permittedTools },
        agentSessionId: agentSession.id,
        permittedTools: modeContract.permittedTools,
        scopedSimulationState: simulationState as Parameters<typeof updateSimulationState>[0] | undefined,
      });
      getAssignedCitationTable = toolRuntime.getAssignedCitations;
      getTextbookOptimizations = toolRuntime.getTextbookOptimizations;
      agentSessionResponseHeaders = {
        'X-Konling-Agent-Session-Id': agentSession.id,
        ...(conversationId ? { 'X-Konling-Conversation-Id': conversationId } : {}),
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
    const responseModel = await getConfiguredAIModel(undefined, modelRequirements);
    const frozenModelMessages = await toModelMessages(uiMessages);
    const result = await streamText({
      model: responseModel,
      system: systemPrompt,
      messages: frozenModelMessages,
      tools,
      ...(forceStructuredSmartPrepTool ? {
        stopWhen: stepCountIs(2),
        prepareStep: ({ stepNumber }: { stepNumber: number }) => stepNumber === 0
          ? {
            activeTools: ['propose_smart_lesson_task_change'],
            toolChoice: { type: 'tool' as const, toolName: 'propose_smart_lesson_task_change' },
          }
          : { activeTools: [], toolChoice: 'none' as const },
      } : {
        stopWhen: stepCountIs(5), // 允许最多5轮工具调用
        toolChoice: 'auto' as const,
      }),
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    let responseAssistantMessage: IncomingMessage | null = null;
    let persistedAssistantMessage: IncomingMessage | null = null;
    const uiMessageStream = result.toUIMessageStream({
      originalMessages: uiMessages,
      generateMessageId: () => crypto.randomUUID(),
      onFinish: async ({ responseMessage, isAborted }) => {
        if (!claimedTurn) {
          return;
        }
        if (isAborted) {
          await releaseKonlingConversationTurn(prisma, claimedTurn);
          claimedTurn = null;
          return;
        }
        if (!getMessageContent(responseMessage).trim()) {
          await releaseKonlingConversationTurn(prisma, claimedTurn);
          claimedTurn = null;
          return;
        }
        responseAssistantMessage = responseMessage;
      },
      messageMetadata: ({ part }) => {
        if (!citationGuardMetadataPayload || (part.type !== 'start' && part.type !== 'finish')) return undefined;
        return {
          konlingCitationGuard: citationGuardMetadataPayload,
          konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
        };
      },
      onError: (error) => {
        if (claimedTurn) {
          const failedTurn = claimedTurn;
          claimedTurn = null;
          void releaseKonlingConversationTurn(prisma, failedTurn);
        }
        return getAIStreamErrorMessage(error);
      },
    });
    const metadataStream = buildFinalCitationGuardMetadataPayload
      ? appendFinalCitationGuardMetadata(
          uiMessageStream,
          buildFinalCitationGuardMetadataPayload,
          { konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload },
        )
      : uiMessageStream;
    const finalCitationUiMessageStream = buildFinalCitationGuardMetadataPayload && getAssignedCitationTable
      ? createKonlingMessageRevisionStream({
          stream: metadataStream,
          hasPendingOptimization: () =>
            (getTextbookOptimizations?.().length ?? 0) > 0,
          finalize: async ({ messageId, body: assistantBody }) => {
            const assignedCitations = getAssignedCitationTable?.() ?? [];
            const normalized = await normalizeAndRepairKonlingCitations({
              answer: assistantBody,
              assignedCitations,
              originalQuestion: requestedUserMessage?.content ?? '',
              serverContext: citationRepairServerContext as KonlingCitationRepairRequest['serverContext'],
              privateValues: citationRepairPrivateValues,
              repair: async (repairRequest) => {
                citationRepairUsed = true;
                const repaired = await generateText({
                  model: responseModel,
                  system: CITATION_REPAIR_SYSTEM_PROMPT,
                  prompt: JSON.stringify(repairRequest),
                  temperature: 0,
                  maxOutputTokens: 500,
                });
                return parseCitationRepairMappings(repaired.text);
              },
            });
            const baseMetadata = buildFinalCitationGuardMetadataPayload(normalized.body);
            const finalCitationMetadata = {
              ...baseMetadata,
              status: baseMetadata.status === 'verified' && normalized.verificationStatus === 'verified'
                ? 'verified'
                : 'low-confidence',
              verificationStatus: normalized.verificationStatus,
              userNotice: normalized.userNotice,
              citations: normalized.citations,
              retrievalSources: normalized.citations,
              diagnosticReasons: process.env.NODE_ENV === 'production'
                ? []
                : [...new Set([
                    ...(baseMetadata.diagnosticReasons ?? []),
                    ...normalized.diagnostics,
                  ])],
            };
            const metadata = {
              konlingCitationGuard: finalCitationMetadata,
              ...(sarAssociatedGroundingMetadataPayload ? {
                konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
              } : {}),
              konlingMessageRevision: {
                revision: 1,
                status: normalized.verificationStatus,
                userNotice: normalized.userNotice,
              },
            };
            if (claimedTurn) {
              const completingTurn = claimedTurn;
              const assistantMessage = replaceMessageTextContent(
                responseAssistantMessage ?? {
                  id: messageId,
                  role: 'assistant',
                  content: assistantBody,
                },
                normalized.body,
                metadata,
              );
              assistantMessage.id = messageId;
              try {
                await completeKonlingConversationTurn(prisma, {
                  ...completingTurn,
                  assistantMessage,
                });
                persistedAssistantMessage = assistantMessage;
                claimedTurn = null;
              } catch (error) {
                await releaseKonlingConversationTurn(prisma, completingTurn);
                claimedTurn = null;
                throw error;
              }
            }
            return {
              body: normalized.body,
              citations: normalized.citations,
              status: normalized.verificationStatus,
              userNotice: normalized.userNotice,
              metadata,
            };
          },
          finalizeOptimization: async ({ messageId, revision }) => {
            const optimizations = getTextbookOptimizations?.() ?? [];
            if (optimizations.length === 0) return null;
            const decision = await resolveKonlingTextbookOptimizations({
              optimizations,
              assignedCitations: () => getAssignedCitationTable?.() ?? [],
              usedTextbookCanonicalKeys: revision.citations
                .filter((citation) => citation.sourceType === 'textbook')
                .map((citation) => citation.canonicalKey),
            });
            if (!decision.material) return null;

            const finalCitationTable = [
              ...(getAssignedCitationTable?.() ?? [])
                .filter((citation) => citation.sourceType !== 'textbook'),
              ...decision.finalTextbookCitations,
            ];
            const response = await result.response;
            const optimized = await generateText({
              model: responseModel,
              system: systemPrompt,
              messages: [
                ...frozenModelMessages,
                ...response.messages,
                {
                  role: 'user',
                  content: [
                    '请依据以下最终教材证据重新生成同一条回答。',
                    '只能使用服务器编号 [n]，不得创建链接或新编号。',
                    JSON.stringify(decision.finalResults.map(({ toolCallId, result: finalResult }) => ({
                      toolCallId,
                      candidates: finalResult.candidates.map((candidate) => ({
                        displayNumber: candidate.displayNumber,
                        title: candidate.title,
                        text: candidate.text,
                        limitation: candidate.limitation,
                      })),
                    }))),
                  ].join('\n'),
                },
              ],
              temperature: 0.7,
              maxOutputTokens: 2000,
              abortSignal: request.signal,
            });
            if (!optimized.text.trim()) return null;
            const normalized = await normalizeAndRepairKonlingCitations({
              answer: optimized.text,
              assignedCitations: finalCitationTable,
              originalQuestion: requestedUserMessage?.content ?? '',
              serverContext: citationRepairServerContext as KonlingCitationRepairRequest['serverContext'],
              privateValues: citationRepairPrivateValues,
              repair: citationRepairUsed
                ? undefined
                : async (repairRequest) => {
                    citationRepairUsed = true;
                    const repaired = await generateText({
                      model: responseModel,
                      system: CITATION_REPAIR_SYSTEM_PROMPT,
                      prompt: JSON.stringify(repairRequest),
                      temperature: 0,
                      maxOutputTokens: 500,
                      abortSignal: request.signal,
                    });
                    return parseCitationRepairMappings(repaired.text);
                  },
            });
            const baseMetadata = buildFinalCitationGuardMetadataPayload(normalized.body);
            const finalCitationMetadata = {
              ...baseMetadata,
              status: baseMetadata.status === 'verified' && normalized.verificationStatus === 'verified'
                ? 'verified'
                : 'low-confidence',
              verificationStatus: normalized.verificationStatus,
              userNotice: normalized.userNotice,
              citations: normalized.citations,
              retrievalSources: normalized.citations,
              diagnosticReasons: process.env.NODE_ENV === 'production'
                ? []
                : [...new Set([
                    ...(baseMetadata.diagnosticReasons ?? []),
                    ...normalized.diagnostics,
                  ])],
            };
            const metadata = {
              konlingCitationGuard: finalCitationMetadata,
              ...(sarAssociatedGroundingMetadataPayload ? {
                konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
              } : {}),
              konlingMessageRevision: {
                revision: 2,
                status: normalized.verificationStatus,
                userNotice: normalized.userNotice,
              },
            };
            if (conversationId && session?.user?.id) {
              const assistantMessage = replaceMessageTextContent(
                persistedAssistantMessage ?? responseAssistantMessage ?? {
                  id: messageId,
                  role: 'assistant',
                  content: revision.body,
                },
                normalized.body,
                metadata,
              );
              assistantMessage.id = messageId;
              const replaced = await replaceKonlingConversationAssistantRevision(prisma, {
                conversationId,
                ownerUserId: session.user.id,
                assistantMessage,
                expectedRevision: 1,
                revision: 2,
              });
              if (!replaced) return null;
            }
            return {
              messageId,
              revision: 2,
              body: normalized.body,
              citations: normalized.citations,
              status: normalized.verificationStatus,
              userNotice: normalized.userNotice,
              metadata,
            };
          },
        })
      : metadataStream;
    const guardedUiMessageStream = insertStreamingCitationFallbackNotice(
      finalCitationUiMessageStream,
      process.env.NODE_ENV === 'production'
        ? null
        : buildStreamingCitationFallbackNotice(citationGuardMetadataPayload),
    );

    // 返回流式响应
    return createUIMessageStreamResponse({
      headers: agentSessionResponseHeaders,
      stream: guardedUiMessageStream,
      consumeSseStream: consumeStream,
    });
  } catch (error) {
    if (claimedTurn) {
      await releaseKonlingConversationTurn(prisma, claimedTurn).catch(() => undefined);
    }
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingConversationTurnConflictError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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

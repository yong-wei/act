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
  toLegacyMessage,
  toModelMessages,
  toUIMessage,
  type IncomingMessage,
} from '@/lib/ai-message-compat';
import { aiTools, updateSimulationState } from '@/lib/ai-tools';
import { getServerAuthSession } from '@/lib/auth';
import {
  INTERACTIVE_AI_LEARNING_CONTEXT_NOTE,
} from '@/lib/interactive-ai-context';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildAiAuditTaskLogEntry,
  buildAiAuditTaskPrompt,
  resolveAiAuditTaskContext,
} from '@/lib/ai-task-boundary-contracts';
import {
  buildEvidenceCopilotPrompt,
  mapEvidenceCopilotRole,
  parseEvidenceCopilotRequest,
  resolveEvidenceCopilotContext,
  type EvidenceCopilotProjection,
} from '@/lib/evidence-copilot-context';
import {
  buildGovernedCopilotProfilePrompt,
  mapGovernedCopilotRole,
  projectGovernedCopilotProfile,
  resolveCopilotPromptUser,
  resolveGovernedCopilotProfile,
  type GovernedCopilotProfileProjection,
} from '@/lib/governed-copilot-profile-context';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildStreamingCitationFallbackNotice,
  insertStreamingCitationFallbackNotice,
} from '@/lib/konling-streaming-citation-fallback';
import { appendFinalCitationGuardMetadata } from '@/lib/konling-final-citation-metadata-stream';
import {
  KonlingAdaptiveAttemptContextError,
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingSmartPrepSessionBinding,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import {
  buildKonlingCitationGuard,
  buildKonlingCitationRetrievalSources,
  buildKonlingDualDomainProvenanceMetadataPayload,
  buildKonlingStreamingCitationGuard,
  buildKonlingRuntimeContext,
  buildKonlingSarAssociatedGroundingMetadataPayload,
  buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime,
  buildScopedKonlingAiTools,
  getOrCreateKonlingAgentSession,
  KONLING_CANDIDATE_READ_TOOLS,
  KonlingRuntimeScopeError,
  mergeCandidateAssignedCitations,
  normalizeKonlingKnowledgeWorkspaceHint,
  serializeKonlingCitationMetadata,
  stripUnverifiedKonlingCitationMarkers,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';
import { redactProviderError, type ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';
import {
  claimKonlingConversationTurn,
  completeKonlingConversationTurn,
  KonlingConversationTurnConflictError,
  konlingLibraryRetentionWhere,
  normalizeKonlingConversationAssistantBinding,
  prepareKonlingConversationTurn,
  releaseKonlingConversationTurn,
  replaceKonlingConversationAssistantRevision,
  resolveKonlingContextEventScope,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import {
  extractInteractiveSessionHint,
  resolveInteractiveTutoringState,
} from '@/lib/konling-interactive-tutoring-state';
import {
  findLatestPinnedTextbookIdentity,
  pinTextbookCoachIdentity,
} from '@/lib/textbook-resource-coach';
import {
  applyTextbookCoachRuntimeContext,
  readTextbookCoachServerBag,
} from '@/lib/textbook-resource-coach/runtime-bridge';
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
import {
  buildMathPrecomputeContext,
  precomputeMathAnswer,
  withoutCalculateTool,
} from '@/lib/konling-math-precompute';
import { resolveKonlingTextbookOptimizations } from '@/lib/konling-textbook-background-optimization';
import {
  correctKonlingMalformedStructuredResponse,
  createKonlingStructuredActionStream,
  executeKonlingScopedAiTool,
  normalizeKonlingAssistantMessage,
  normalizeKonlingStructuredText,
  type KonlingStructuredActionStreamState,
} from '@/lib/konling-structured-action-runtime';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const CITATION_REPAIR_SYSTEM_PROMPT = [
  '你只执行引用标记映射，不回答原问题，不改写回答正文。',
  '只能把 unresolvedMarkers 映射到 assignedCitations 中已有的 displayNumber。',
  '不得增加来源、URL、正文、解释或其他字段。',
  '仅返回 JSON 数组，元素格式为 {"marker":"原始标记","displayNumber":1}。',
].join('\n');
const STRUCTURED_CALL_CORRECTION_SYSTEM_PROMPT = [
  '修复一条被安全截留的助手响应。',
  '只返回面向用户的简洁正文，不得输出工具标记、XML、DSML、JSON 调用封套或链接。',
  '如果无法可靠恢复原意，明确说明结构化操作未完成并请用户重试。',
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
    answerUnitCoverage: asPrismaJsonValue(citationGuardMetadata.answerUnitCoverage ?? null),
    derivedSectionIds: asPrismaJsonValue(citationGuardMetadata.derivedSectionIds ?? []),
    unverifiedCitationMarkers: asPrismaJsonValue(citationGuardMetadata.unverifiedCitationMarkers ?? []),
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
      userProfile: clientUserProfile,
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
      auditTaskContext,
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
      auditTaskContext?: unknown;
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

    const evidenceTaskResolution = parseEvidenceCopilotRequest(auditTaskContext);
    if (evidenceTaskResolution.status === 'invalid') {
      return new Response(JSON.stringify({ error: 'INVALID_AI_TASK_CONTEXT' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const taskContextResolution = evidenceTaskResolution.status === 'valid'
      ? { status: 'absent' as const, context: null }
      : resolveAiAuditTaskContext(auditTaskContext);
    if (taskContextResolution.status === 'invalid') {
      return new Response(JSON.stringify({ error: 'INVALID_AI_TASK_CONTEXT' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const serverTaskContext = taskContextResolution.status === 'valid'
      ? taskContextResolution.context
      : null;
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    let evidenceCopilotProjection: EvidenceCopilotProjection | null = null;
    let governedCopilotProfile: GovernedCopilotProfileProjection | null = null;
    let skipGovernedProfilePrompt = false;
    if (evidenceTaskResolution.status === 'valid') {
      if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: '未授权' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      evidenceCopilotProjection = await resolveEvidenceCopilotContext({
        userId: session.user.id,
        role: mapEvidenceCopilotRole(session.user.role),
        hints: evidenceTaskResolution.hints,
      });
    }

    if (serverTaskContext) {
      console.info('[ai.task-context]', JSON.stringify(buildAiAuditTaskLogEntry(serverTaskContext, requestId)));
    }

    let uiMessages = rawMessages.map(toUIMessage);
    let messages = uiMessages.map(toLegacyMessage);
    const requestedUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const conversation = conversationId && session?.user?.id
      ? await prisma.konlingSession.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
          ...konlingLibraryRetentionWhere(),
        },
      })
      : null;
    if (conversationId && !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (lessonContext?.stage === 'interactive' && session?.user?.id) {
      const hintedCourseId = typeof pageContext?.courseId === 'string' ? pageContext.courseId.trim() : '';
      const hintedPageId = typeof pageContext?.stepId === 'string' ? pageContext.stepId.trim() : '';
      if (hintedCourseId && hintedPageId) {
        const interactiveRuntime = await verifyKonlingRuntimeScope(prisma, {
          authenticatedUserId: session.user.id,
          role: session.user.role,
          targetUserId: session.user.id,
          classId: typeof classId === 'string' ? classId : null,
          courseId: hintedCourseId,
          pageId: hintedPageId,
          resourceId: null,
          pathNodeId: null,
          pageContextHint: pageContext,
        });
        if (!interactiveRuntime.ok) {
          return new Response(JSON.stringify({ error: interactiveRuntime.error }), {
            status: interactiveRuntime.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const authorizedInteractivePage = await resolveKonlingContextEventScope(
          prisma,
          interactiveRuntime.scope,
        );
        if (!authorizedInteractivePage) {
          return new Response(JSON.stringify({ error: 'Page context is not registered for Konling.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          conversation
          && (
            conversation.courseId !== authorizedInteractivePage.courseId
            || conversation.pageId !== authorizedInteractivePage.pageId
          )
        ) {
          return new Response(JSON.stringify({
            error: 'INTERACTIVE_AI_RESOURCE_MISMATCH',
            status: 'isolated',
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
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
    let dualDomainProvenanceMetadataPayload: ReturnType<typeof buildKonlingDualDomainProvenanceMetadataPayload> | null = null;
    let buildFinalCitationGuardMetadataPayload: ((assistantContent: string) => ReturnType<typeof buildCitationGuardMetadataPayload>) | null = null;
    let buildFinalCitationGuardOutcome: ((
      assistantContent: string,
      assignedCitations?: readonly KonlingAssignedCitation[],
    ) => { guard: ReturnType<typeof buildKonlingCitationGuard>; body: string }) | null = null;
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
      const candidateScope = pageContext?.candidateGraph
        ? await verifyKonlingRuntimeScope(prisma, {
            authenticatedUserId: session.user.id,
            role: session.user.role,
            targetUserId: session.user.id,
            classId: null,
            courseId: courseId || pageContext.courseId || conversation?.courseId,
            pageId: pageId || pageContext.stepId || conversation?.pageId,
            resourceId: null,
            pathNodeId: null,
            pageContextHint: pageContext,
          })
        : null;
      if (candidateScope && !candidateScope.ok) {
        return new Response(JSON.stringify({ error: candidateScope.error }), {
          status: candidateScope.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const serverCandidateScope = candidateScope?.ok && candidateScope.scope.candidateGraph
        ? candidateScope.scope
        : null;
      const modeScopeOverride = serverCandidateScope
        ? {}
        : await resolveKonlingTeachingAssistantScopeOverride({
            db: prisma,
            modeId: teachingAssistantModeId,
            authenticatedUserId: session.user.id,
            role: session.user.role,
            clientContextHints: modeClientContextHints,
          });
      const runtimeTargetUserId = serverCandidateScope
        ? session.user.id
        : modeScopeOverride.targetUserId ?? session.user.id;
      const runtimeClassId = serverCandidateScope
        ? null
        : modeScopeOverride.classId ?? classId;
      const scope = serverCandidateScope
        ? { ok: true as const, scope: serverCandidateScope }
        : await verifyKonlingRuntimeScope(prisma, {
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
      const resolvedScope = contextEventScope
        ? { ...scope.scope, ...contextEventScope }
        : scope.scope;
      const authorizedScope = serverCandidateScope
        ? {
            ...resolvedScope,
            targetUserId: session.user.id,
            classId: null,
            resourceId: null,
            pathNodeId: null,
            candidateGraph: serverCandidateScope.candidateGraph,
          }
        : resolvedScope;
      const interactiveTutoring = await resolveInteractiveTutoringState(prisma, {
        authenticatedUserId: session.user.id,
        role: session.user.role,
        courseId: authorizedScope.courseId,
        pageId: authorizedScope.pageId,
        sessionIdHint: extractInteractiveSessionHint(pageContext),
      });
      const candidateOnly = Boolean(authorizedScope.candidateGraph);
      const effectiveModeId = candidateOnly ? null : teachingAssistantModeId;
      const effectiveModeClientContextHints = candidateOnly ? undefined : modeClientContextHints;
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
        serverAuthorizedCandidateGraph: authorizedScope.candidateGraph,
        knowledgeWorkspaceHint: candidateOnly
          ? null
          : normalizeKonlingKnowledgeWorkspaceHint(knowledgeWorkspaceHint ?? modeClientContextHints),
        teachingAssistantModeId: effectiveModeId,
        currentUserQuery: messages.at(-1)?.role === 'user' ? messages.at(-1)?.content : null,
        trustedContentContext: Boolean(authorizedScope.courseId && authorizedScope.pageId),
      };
      const existingTextbookPin = findLatestPinnedTextbookIdentity(
        (Array.isArray(conversation?.messages) ? conversation.messages as unknown as IncomingMessage[] : messages)
          .map((message) => toLegacyMessage(message)),
      );
      const serverModeContext = candidateOnly
        ? null
        : await resolveKonlingTeachingAssistantServerModeContext({
            db: prisma,
            modeId: effectiveModeId,
            scope: authorizedScope,
            clientContextHints: effectiveModeClientContextHints,
            pinnedTextbookIdentity: existingTextbookPin,
          });
      const textbookCoach = readTextbookCoachServerBag(serverModeContext);
      if (textbookCoach.textbookCoachFailure) {
        return new Response(JSON.stringify({
          error: 'KONLING_MODE_UNAVAILABLE',
          mode: 'resource-coach',
          status: 'unavailable',
          unavailableReasons: [`textbook-coach:${textbookCoach.textbookCoachFailure}`],
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const assistantBinding = candidateOnly
        ? null
        : (() => {
            const binding = normalizeKonlingConversationAssistantBinding({
              modeId: effectiveModeId,
              clientContextHints: effectiveModeClientContextHints,
              validatedModeContext: serverModeContext,
            });
            if (!binding || !textbookCoach.structuredTextbook) return binding;
            return {
              ...binding,
              pinnedTextbookResourceIdentity: pinTextbookCoachIdentity({
                existingPin: existingTextbookPin,
                verified: textbookCoach.structuredTextbook.identity,
              }).identity,
            };
          })();
      const smartPrepBinding = serverModeContext
        ? resolveKonlingSmartPrepSessionBinding(serverModeContext)
        : null;
      const runtimeContext = await buildKonlingRuntimeContext(prisma, {
        ...runtimeInput,
        teachingAssistantServerModeContext: serverModeContext,
      });
      governedCopilotProfile = projectGovernedCopilotProfile(runtimeContext.learnerState, {
        authenticatedUserId: session.user.id,
        displayName: session.user.name ?? '同学',
        unavailable: !runtimeContext.learnerState,
      });
      skipGovernedProfilePrompt = candidateOnly;
      const textbookRuntimeContext = applyTextbookCoachRuntimeContext(runtimeContext, serverModeContext);
      const modeContract = buildKonlingTeachingAssistantRuntimeContract({
        modeId: effectiveModeId,
        runtimeContext: textbookRuntimeContext,
        scope: authorizedScope,
        serverModeContext,
        clientContextHints: effectiveModeClientContextHints,
        currentUserQuery: runtimeInput.currentUserQuery,
        studyAnswerPreferences: candidateOnly ? undefined : studyAnswerPreferences,
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
      let permittedTools = authorizedScope.candidateGraph
        ? KONLING_CANDIDATE_READ_TOOLS
        : modeContract.permittedTools;
      if (interactiveTutoring && !interactiveTutoring.checkAnswerAllowed) {
        permittedTools = permittedTools.filter((toolName) => toolName !== 'analyze_attempt');
      }
      forceStructuredSmartPrepTool = modeContract.mode.id === 'prep-coauthor'
        && Boolean(modeContract.smartPreparation);
      const modeRuntimeContext = {
        ...textbookRuntimeContext,
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
      if (interactiveTutoring) {
        systemPrompt = `${systemPrompt}\n\n${interactiveTutoring.promptSection}`;
      }
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
      dualDomainProvenanceMetadataPayload = buildKonlingDualDomainProvenanceMetadataPayload(
        modeRuntimeContext,
      );
      buildFinalCitationGuardOutcome = (
        assistantContent: string,
        assignedCitations: readonly KonlingAssignedCitation[] = getAssignedCitationTable?.() ?? [],
      ) => {
        const finalRuntimeContext = mergeCandidateAssignedCitations(
          modeRuntimeContext,
          assignedCitations,
        );
        const guard = buildKonlingCitationGuard(finalRuntimeContext, assistantContent);
        return {
          guard,
          body: stripUnverifiedKonlingCitationMarkers(assistantContent, guard),
        };
      };
      buildFinalCitationGuardMetadataPayload = (assistantContent: string) => buildCitationGuardMetadataPayload(
        buildFinalCitationGuardOutcome!(assistantContent).guard,
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
          assistantBinding,
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
          konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
        },
        permittedTools,
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
            konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
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
        context: { ...modeRuntimeContext, permittedTools },
        agentSessionId: agentSession.id,
        permittedTools,
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
    } else if (pageContext) {
      governedCopilotProfile = session?.user?.id
        ? await resolveGovernedCopilotProfile({
            userId: session.user.id,
            role: mapGovernedCopilotRole(session.user.role),
            displayName: session.user.name,
          })
        : projectGovernedCopilotProfile(null, {
            authenticatedUserId: null,
            displayName: '同学',
            unavailable: true,
          });
      const aiContext: AIContext = {
        page: pageContext,
        user: resolveCopilotPromptUser({
          authenticatedUserId: session?.user?.id,
          authenticatedDisplayName: session?.user?.name,
          clientUserProfile,
          governedProfile: governedCopilotProfile,
        }),
        sessionHistory: messages.slice(0, -1),
      };
      systemPrompt = buildKonlingSystemPrompt(aiContext);
    } else {
      // 回退到旧的提示词构建方式
      systemPrompt = buildContextAwarePrompt(SYSTEM_PROMPT, lessonContext);
    }

    if (lessonContext?.stage === 'interactive') {
      systemPrompt = `${systemPrompt}\n\n${INTERACTIVE_AI_LEARNING_CONTEXT_NOTE}`;
    }

    if (serverTaskContext) {
      systemPrompt = `${systemPrompt}\n\n${buildAiAuditTaskPrompt(serverTaskContext)}`;
    }
    if (evidenceCopilotProjection) {
      systemPrompt = `${systemPrompt}\n\n${buildEvidenceCopilotPrompt(evidenceCopilotProjection)}`;
    }
    if (governedCopilotProfile && !skipGovernedProfilePrompt) {
      systemPrompt = `${systemPrompt}\n\n${buildGovernedCopilotProfilePrompt(governedCopilotProfile)}`;
    }

    tools = withoutCalculateTool(tools);
    modelRequirements = {
      ...modelRequirements,
      tools: Object.keys(tools).length > 0,
    };

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
    const frozenModelMessages = (await toModelMessages(uiMessages)).filter(
      (message) => (message as { role?: string }).role !== 'system',
    );
    const effectiveUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const precomputedMath = effectiveUserMessage
      ? await precomputeMathAnswer(effectiveUserMessage.content)
      : null;
    const mathPrecomputeContext = precomputedMath
      ? `\n\n${buildMathPrecomputeContext(precomputedMath)}`
      : '';
    const result = await streamText({
      model: responseModel,
      system: `${systemPrompt}${mathPrecomputeContext}`,
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

    let completedResponseMessage: Message | null = null;
    let structuredCorrectionUsed = false;
    const structuredActionState: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const buildPersistedAssistantRevision = (
      messageId: string,
      body: string,
      metadata: Record<string, unknown>,
    ): Message => {
      let textPartReplaced = false;
      const parts = (completedResponseMessage?.parts ?? []).flatMap((part): Message['parts'] => {
        if (part.type !== 'text') return [part];
        if (textPartReplaced) return [];
        textPartReplaced = true;
        return [{ ...part, text: body }];
      });
      if (!textPartReplaced) parts.push({ type: 'text', text: body });
      for (const call of structuredActionState.toolCalls) {
        if (parts.some((part) =>
          (part.type === 'dynamic-tool' || part.type.startsWith('tool-'))
          && 'toolCallId' in part
          && part.toolCallId === call.id
        )) continue;
        const execution = structuredActionState.executedToolResults.find((item) =>
          item.toolCallId === call.id);
        parts.push({
          type: 'dynamic-tool',
          toolCallId: call.id,
          toolName: call.name,
          state: execution
            ? execution.errorText ? 'output-error' : 'output-available'
            : 'input-available',
          input: call.input,
          ...(execution?.errorText
            ? { errorText: execution.errorText }
            : execution ? { output: execution.result } : {}),
        } as Message['parts'][number]);
      }
      const existingMetadata = completedResponseMessage?.metadata
        && typeof completedResponseMessage.metadata === 'object'
        ? completedResponseMessage.metadata as Record<string, unknown>
        : {};
      return toLegacyMessage({
        ...(completedResponseMessage ?? {}),
        id: messageId,
        role: 'assistant',
        content: body,
        parts,
        metadata: { ...existingMetadata, ...metadata },
      });
    };
    const publicStructuredActionMetadata = (
      persistedConversation: Awaited<ReturnType<typeof completeKonlingConversationTurn>>,
      assistantMessageId: string,
    ) => {
      if (!persistedConversation) return {};
      const publicAssistant = serializeKonlingConversation(persistedConversation).messages
        .find((message) => message.id === assistantMessageId && message.role === 'assistant');
      const publicMetadata = publicAssistant?.metadata
        && typeof publicAssistant.metadata === 'object'
        && !Array.isArray(publicAssistant.metadata)
        ? publicAssistant.metadata as Record<string, unknown>
        : {};
      return Array.isArray(publicMetadata.konlingSmartPreparationActions)
        ? { konlingSmartPreparationActions: publicMetadata.konlingSmartPreparationActions }
        : {};
    };
    const shouldFinalizeEmptyStructuredTurn = async () => {
      if (structuredActionState.toolCalls.length > 0) return true;
      if (forceStructuredSmartPrepTool && claimedTurn) {
        const emptyTurn = claimedTurn;
        claimedTurn = null;
        await releaseKonlingConversationTurn(prisma, emptyTurn);
      }
      return false;
    };
    const releaseUnfinalizedStructuredTurn = async () => {
      if (!forceStructuredSmartPrepTool || !claimedTurn) return;
      const unfinalizedTurn = claimedTurn;
      claimedTurn = null;
      await releaseKonlingConversationTurn(prisma, unfinalizedTurn);
    };
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
        completedResponseMessage = toLegacyMessage(responseMessage);
        completedResponseMessage = normalizeKonlingAssistantMessage(completedResponseMessage).message;
        if (
          !getMessageContent(completedResponseMessage).trim()
          && !completedResponseMessage.parts.some((part) =>
            part.type === 'dynamic-tool' || part.type.startsWith('tool-'))
          && !forceStructuredSmartPrepTool
        ) {
          await releaseKonlingConversationTurn(prisma, claimedTurn);
          claimedTurn = null;
          return;
        }
      },
      messageMetadata: ({ part }) => {
        if (!citationGuardMetadataPayload || (part.type !== 'start' && part.type !== 'finish')) return undefined;
        return {
          konlingCitationGuard: citationGuardMetadataPayload,
          konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
          konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
        };
      },
      onError: (error) => {
        if (claimedTurn && !forceStructuredSmartPrepTool) {
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
          {
            konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
            konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
          },
        )
      : uiMessageStream;
    const structuredActionStream = createKonlingStructuredActionStream({
      stream: metadataStream,
      state: structuredActionState,
      executeToolCall: (call) => executeKonlingScopedAiTool({
        tools,
        call,
        abortSignal: request.signal,
        messages: frozenModelMessages,
      }),
    });
    const finalCitationUiMessageStream = buildFinalCitationGuardMetadataPayload && getAssignedCitationTable
      ? createKonlingMessageRevisionStream({
          stream: structuredActionStream,
          shouldFinalizeEmpty: shouldFinalizeEmptyStructuredTurn,
          onUnfinalizedClose: releaseUnfinalizedStructuredTurn,
          hasPendingOptimization: () =>
            structuredActionState.withheldMalformedSyntax
            || (getTextbookOptimizations?.().length ?? 0) > 0,
          finalize: async ({ messageId, body: assistantBody }) => {
            let correctedAssistantBody = assistantBody;
            let structuredCorrectionStatus: 'not-required' | 'corrected' | 'failed' = 'not-required';
            if (structuredActionState.withheldMalformedSyntax && !structuredCorrectionUsed) {
              structuredCorrectionUsed = true;
              const correction = await correctKonlingMalformedStructuredResponse({
                abortSignal: request.signal,
                generate: async (abortSignal) => (await generateText({
                  model: responseModel,
                  system: STRUCTURED_CALL_CORRECTION_SYSTEM_PROMPT,
                  prompt: JSON.stringify({
                    question: requestedUserMessage?.content ?? '',
                    withheldResponse: structuredActionState.withheldText,
                  }),
                  temperature: 0,
                  maxOutputTokens: 500,
                  abortSignal,
                })).text,
              });
              correctedAssistantBody = correction.text;
              structuredCorrectionStatus = correction.status;
            }
            const assignedCitations = getAssignedCitationTable?.() ?? [];
            const normalized = await normalizeAndRepairKonlingCitations({
              answer: correctedAssistantBody,
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
            const finalOutcome = buildFinalCitationGuardOutcome!(normalized.body, assignedCitations);
            const finalAssistantBody = finalOutcome.body;
            const baseMetadata = buildCitationGuardMetadataPayload(
              finalOutcome.guard,
              citationGuardMetadataContext?.missingContext ?? [],
            );
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
            let metadata = {
              konlingCitationGuard: finalCitationMetadata,
              ...(sarAssociatedGroundingMetadataPayload ? {
                konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
              } : {}),
              ...(dualDomainProvenanceMetadataPayload ? {
                konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
              } : {}),
              konlingMessageRevision: {
                revision: 1,
                status: normalized.verificationStatus,
                userNotice: normalized.userNotice,
              },
              konlingStructuredCorrection: {
                status: structuredCorrectionStatus,
                attempts: structuredCorrectionStatus === 'not-required' ? 0 : 1,
              },
            };
            if (claimedTurn) {
              const completingTurn = claimedTurn;
              try {
                const persistedConversation = await completeKonlingConversationTurn(prisma, {
                  ...completingTurn,
                  assistantMessage: buildPersistedAssistantRevision(
                    messageId,
                    finalAssistantBody,
                    metadata,
                  ),
                });
                metadata = {
                  ...metadata,
                  ...publicStructuredActionMetadata(persistedConversation, messageId),
                };
                claimedTurn = null;
              } catch (error) {
                await releaseKonlingConversationTurn(prisma, completingTurn);
                claimedTurn = null;
                throw error;
              }
            }
            return {
              body: finalAssistantBody,
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
            const optimizedOutcome = buildFinalCitationGuardOutcome!(normalized.body, finalCitationTable);
            const optimizedBody = optimizedOutcome.body;
            const baseMetadata = buildCitationGuardMetadataPayload(
              optimizedOutcome.guard,
              citationGuardMetadataContext?.missingContext ?? [],
            );
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
              ...(dualDomainProvenanceMetadataPayload ? {
                konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
              } : {}),
              konlingMessageRevision: {
                revision: 2,
                status: normalized.verificationStatus,
                userNotice: normalized.userNotice,
              },
            };
            if (conversationId && session?.user?.id) {
              const replaced = await replaceKonlingConversationAssistantRevision(prisma, {
                conversationId,
                ownerUserId: session.user.id,
                assistantMessage: buildPersistedAssistantRevision(
                  messageId,
                  optimizedBody,
                  metadata,
                ),
                expectedRevision: 1,
                revision: 2,
              });
              if (!replaced) return null;
            }
            return {
              messageId,
              revision: 2,
              body: optimizedBody,
              citations: normalized.citations,
              status: normalized.verificationStatus,
              userNotice: normalized.userNotice,
              metadata,
            };
          },
        })
      : createKonlingMessageRevisionStream({
          stream: structuredActionStream,
          shouldFinalizeEmpty: shouldFinalizeEmptyStructuredTurn,
          onUnfinalizedClose: releaseUnfinalizedStructuredTurn,
          hasPendingOptimization: () => structuredActionState.withheldMalformedSyntax,
          finalize: async ({ messageId, body }) => {
            let finalBody = body;
            let correctionStatus: 'not-required' | 'corrected' | 'failed' = 'not-required';
            if (structuredActionState.withheldMalformedSyntax && !structuredCorrectionUsed) {
              structuredCorrectionUsed = true;
              const correction = await correctKonlingMalformedStructuredResponse({
                abortSignal: request.signal,
                generate: async (abortSignal) => (await generateText({
                  model: responseModel,
                  system: STRUCTURED_CALL_CORRECTION_SYSTEM_PROMPT,
                  prompt: JSON.stringify({
                    question: requestedUserMessage?.content ?? '',
                    withheldResponse: structuredActionState.withheldText,
                  }),
                  temperature: 0,
                  maxOutputTokens: 500,
                  abortSignal,
                })).text,
              });
              finalBody = correction.text;
              correctionStatus = correction.status;
            }
            let metadata = {
              konlingMessageRevision: {
                revision: 1,
                status: 'verified',
                userNotice: null,
              },
              konlingStructuredCorrection: {
                status: correctionStatus,
                attempts: correctionStatus === 'not-required' ? 0 : 1,
              },
            };
            if (claimedTurn) {
              const completingTurn = claimedTurn;
              try {
                const persistedConversation = await completeKonlingConversationTurn(prisma, {
                  ...completingTurn,
                  assistantMessage: buildPersistedAssistantRevision(messageId, finalBody, metadata),
                });
                metadata = {
                  ...metadata,
                  ...publicStructuredActionMetadata(persistedConversation, messageId),
                };
                claimedTurn = null;
              } catch (error) {
                await releaseKonlingConversationTurn(prisma, completingTurn);
                claimedTurn = null;
                throw error;
              }
            }
            return {
              body: finalBody,
              citations: [],
              status: 'verified',
              userNotice: null,
              metadata,
            };
          },
        });
    const guardedUiMessageStream = insertStreamingCitationFallbackNotice(
      finalCitationUiMessageStream,
      process.env.NODE_ENV === 'production'
        ? null
        : buildStreamingCitationFallbackNotice(citationGuardMetadataPayload),
    );

    const responseHeaders = new Headers(agentSessionResponseHeaders);
    if (lessonContext?.stage === 'interactive') {
      responseHeaders.set(
        'X-Interactive-AI-Session',
        conversation ? 'recoverable' : 'ephemeral',
      );
    }
    if (evidenceCopilotProjection) {
      responseHeaders.set('X-Evidence-Copilot-Status', evidenceCopilotProjection.status);
      responseHeaders.set(
        'X-Evidence-Copilot-Limitations',
        encodeURIComponent(evidenceCopilotProjection.limitations.join('|')),
      );
    }
    if (governedCopilotProfile) {
      responseHeaders.set('X-Governed-Copilot-Profile-Status', governedCopilotProfile.status);
      responseHeaders.set(
        'X-Governed-Copilot-Profile-Limitations',
        encodeURIComponent(governedCopilotProfile.limitations.join('|')),
      );
    }

    // 返回流式响应
    return createUIMessageStreamResponse({
      headers: responseHeaders,
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
    if (error instanceof KonlingAdaptiveAttemptContextError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('AI Chat API 错误:', summarizeAIChatError(error));
    return buildAIChatErrorResponse(error);
  }
}

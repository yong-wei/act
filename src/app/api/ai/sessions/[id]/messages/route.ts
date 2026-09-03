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
import { generateText, streamText, stepCountIs } from 'ai';
import { getConfiguredAIModel } from '@/lib/ai/provider-runtime';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';
import { toLegacyMessage, toModelMessages } from '@/lib/ai/message-compat';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  applyKonlingCitationFallback,
  buildKonlingCitationGuard,
  buildKonlingCitationRetrievalSources,
  buildKonlingDualDomainProvenanceMetadataPayload,
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
  konlingLibraryRetentionWhere,
  normalizeKonlingConversationAssistantBinding,
  prepareKonlingConversationTurn,
  releaseKonlingConversationTurn,
  resolveKonlingContextEventScope,
  serializeKonlingConversation,
} from '@/lib/konling-conversation-library';
import {
  findLatestPinnedTextbookIdentity,
  pinTextbookCoachIdentity,
} from '@/lib/textbook-resource-coach';
import {
  applyTextbookCoachRuntimeContext,
  readTextbookCoachServerBag,
} from '@/lib/textbook-resource-coach/runtime-bridge';
import {
  attachKonlingExecutedToolResults,
  correctKonlingMalformedStructuredResponse,
  executeKonlingDsmlToolCalls,
  executeKonlingScopedAiTool,
  normalizeKonlingAssistantMessage,
  normalizeKonlingStructuredText,
} from '@/lib/konling-structured-action-runtime';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const STRUCTURED_CALL_CORRECTION_SYSTEM_PROMPT = [
  '修复一条被安全截留的助手响应。',
  '只返回面向用户的简洁正文，不得输出工具标记、XML、DSML、JSON 调用封套或链接。',
  '如果无法可靠恢复原意，明确说明结构化操作未完成并请用户重试。',
].join('\n');
const STRUCTURED_ACTION_FAILURE_TEXT = '结构化操作未能安全完成，请重新生成建议。';

function hasTerminalToolFailure(parts: Message['parts']) {
  return parts.some((part) =>
    (part.type === 'dynamic-tool' || part.type.startsWith('tool-'))
    && 'state' in part
    && (part.state === 'output-error' || part.state === 'output-denied'));
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
        ...konlingLibraryRetentionWhere(),
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

    const candidateScope = pageContext?.candidateGraph
      ? await verifyKonlingRuntimeScope(prisma, {
          authenticatedUserId: session.user.id,
          role: session.user.role,
          targetUserId: session.user.id,
          classId: null,
          courseId: pageContext.courseId || konlingSession.courseId,
          pageId: pageContext.stepId || konlingSession.pageId,
          resourceId: null,
          pathNodeId: null,
          pageContextHint: pageContext,
        })
      : null;
    if (candidateScope && !candidateScope.ok) {
      return NextResponse.json({ error: candidateScope.error }, { status: candidateScope.status });
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
    const resolvedScope = { ...scope.scope, ...contextEventScope };
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
    const candidateOnly = Boolean(authorizedScope.candidateGraph);
    const effectiveModeId = candidateOnly ? null : teachingAssistantModeId;
    const effectiveModeClientContextHints = candidateOnly ? undefined : modeClientContextHints;
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
      serverAuthorizedCandidateGraph: authorizedScope.candidateGraph,
      knowledgeWorkspaceHint: candidateOnly
        ? null
        : normalizeKonlingKnowledgeWorkspaceHint(knowledgeWorkspaceHint ?? modeClientContextHints),
      teachingAssistantModeId: effectiveModeId,
      currentUserQuery: userMessage.content,
      trustedContentContext: true,
    };
    const existingTextbookPin = findLatestPinnedTextbookIdentity(existingMessages);
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
      return NextResponse.json({
        error: 'KONLING_MODE_UNAVAILABLE',
        mode: 'resource-coach',
        status: 'unavailable',
        unavailableReasons: [`textbook-coach:${textbookCoach.textbookCoachFailure}`],
        degradedReasons: [],
        clientHintsRejected: Object.keys(effectiveModeClientContextHints ?? {}),
      }, { status: 409 });
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
    const textbookRuntimeContext = applyTextbookCoachRuntimeContext(runtimeContext, serverModeContext);
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: effectiveModeId,
      runtimeContext: textbookRuntimeContext,
      scope: authorizedScope,
      serverModeContext,
      clientContextHints: effectiveModeClientContextHints,
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
    const permittedTools = authorizedScope.candidateGraph
      ? KONLING_CANDIDATE_READ_TOOLS
      : modeContract.permittedTools;
    const modeRuntimeContext = {
      ...textbookRuntimeContext,
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
      permittedTools,
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
    const toolRuntime = buildKonlingToolRuntime({
      db: prisma,
      scope: authorizedScope,
      context: { ...modeRuntimeContext, permittedTools },
      agentSessionId: agentSession.id,
      permittedTools,
    });

    // 调用AI
    const responseModel = await getConfiguredAIModel(undefined, modelRequirements);
    const scopedTools = buildScopedKonlingAiTools(toolRuntime);
    const modelMessages = await toModelMessages(updatedMessages);
    const result = await streamText({
      model: responseModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: scopedTools,
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

    let completedResponseMessage: Message | null = null;
    const responseStream = result.toUIMessageStream({
      originalMessages: updatedMessages,
      generateMessageId: () => createKonlingMessageId(),
      onFinish: ({ responseMessage, isAborted }) => {
        if (!isAborted) completedResponseMessage = toLegacyMessage(responseMessage);
      },
    });
    const reader = responseStream.getReader();
    while (!(await reader.read()).done) {
      // Drain the UI stream so native and block-based tool parts reach onFinish.
    }
    if (!completedResponseMessage) {
      throw new Error('控灵响应未完成。');
    }
    const completedAssistant = completedResponseMessage as Message;
    const structuredAssistant = normalizeKonlingAssistantMessage(completedAssistant);
    const executedToolResults = await executeKonlingDsmlToolCalls({
      toolCalls: structuredAssistant.toolCalls,
      executeToolCall: (call) => executeKonlingScopedAiTool({
        tools: scopedTools,
        call,
        abortSignal: request.signal,
        messages: modelMessages,
      }),
    });
    structuredAssistant.message = attachKonlingExecutedToolResults(
      structuredAssistant.message,
      executedToolResults,
    );
    let assistantContent = structuredAssistant.message.content;
    let structuredCorrectionStatus: 'not-required' | 'corrected' | 'failed' = 'not-required';
    if (structuredAssistant.withheldMalformedSyntax) {
      const correction = await correctKonlingMalformedStructuredResponse({
        abortSignal: request.signal,
        generate: async (abortSignal) => (await generateText({
          model: responseModel,
          system: STRUCTURED_CALL_CORRECTION_SYSTEM_PROMPT,
          prompt: JSON.stringify({
            question: content,
            withheldResponse: completedAssistant.content,
          }),
          temperature: 0,
          maxOutputTokens: 500,
          abortSignal,
        })).text,
      });
      assistantContent = correction.text;
      structuredCorrectionStatus = correction.status;
    } else if (executedToolResults.some((result) => result.errorText)) {
      assistantContent = STRUCTURED_ACTION_FAILURE_TEXT;
    } else if (
      !assistantContent
      && hasTerminalToolFailure(structuredAssistant.message.parts)
    ) {
      assistantContent = STRUCTURED_ACTION_FAILURE_TEXT;
    } else if (!assistantContent && structuredAssistant.toolCalls.length > 0) {
      assistantContent = '已完成结构化操作。';
    }
    const finalRuntimeContext = mergeCandidateAssignedCitations(
      modeRuntimeContext,
      toolRuntime.getAssignedCitations(),
    );
    const citationGuard = buildKonlingCitationGuard(finalRuntimeContext, assistantContent);
    const guardedAssistantContent = applyKonlingCitationFallback(assistantContent, citationGuard);
    const sarAssociatedGroundingMetadataPayload = buildKonlingSarAssociatedGroundingMetadataPayload(
      modeContract.groundingContext.sarAssociatedGrounding,
    );
    const dualDomainProvenanceMetadataPayload = buildKonlingDualDomainProvenanceMetadataPayload(
      modeRuntimeContext,
    );

    // 添加助手回复
    const assistantParts: Message['parts'] = structuredAssistant.message.parts
      .filter((part) => part.type !== 'text');
    if (guardedAssistantContent) {
      assistantParts.push({ type: 'text', text: guardedAssistantContent });
    }
    const assistantMessage: Message = toLegacyMessage({
      ...structuredAssistant.message,
      role: 'assistant',
      content: guardedAssistantContent,
      parts: assistantParts,
      metadata: {
        ...(structuredAssistant.message.metadata
          && typeof structuredAssistant.message.metadata === 'object'
          ? structuredAssistant.message.metadata
          : {}),
        konlingCitationGuard: {
          status: citationGuard.status,
          missingCitationClasses: citationGuard.missingCitationClasses,
          lowConfidenceReasons: citationGuard.lowConfidenceReasons,
          diagnosticReasons: citationGuard.diagnosticReasons ?? [],
          personalizationAvailability: citationGuard.personalizationAvailability,
          studyQuestion: citationGuard.studyQuestion ?? null,
          answerUnits: citationGuard.answerUnits ?? [],
          answerUnitCoverage: citationGuard.answerUnitCoverage ?? null,
          answerCitationDriftCount: citationGuard.answerCitationDriftCount ?? 0,
          answerCitationStackCount: citationGuard.answerCitationStackCount ?? 0,
          derivedSectionIds: citationGuard.derivedSectionIds ?? [],
          unverifiedCitationMarkers: citationGuard.unverifiedCitationMarkers ?? [],
          missingContext: modeContract.groundingContext.missingContext,
          retrievalSources: buildKonlingCitationRetrievalSources(citationGuard),
          citations: citationGuard.citations.map(serializeKonlingCitationMetadata),
        },
        konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload,
        konlingDualDomainProvenance: dualDomainProvenanceMetadataPayload,
        konlingStructuredCorrection: {
          status: structuredCorrectionStatus,
          attempts: structuredCorrectionStatus === 'not-required' ? 0 : 1,
        },
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
    const serializedConversation = serializeKonlingConversation(persistedConversation);
    if (!authorizedScope.candidateGraph) {
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
    }
    await resumeKonlingAgentSession(prisma, {
      scope: authorizedScope,
      agentSessionId: agentSession.id,
      konlingSessionId: sessionId,
      phase: 'konling-chat-tool-runtime',
      smartPrepBinding,
    });

    return NextResponse.json({
      messages: serializedConversation.messages,
      assistantMessage: serializedConversation.messages.at(-1),
      citationGuard,
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

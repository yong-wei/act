import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const chatRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/ai/chat/route.ts'),
  'utf8',
);
const sessionMessagesRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/ai/sessions/[id]/messages/route.ts'),
  'utf8',
);
const aiCompanionPanelSource = readFileSync(
  join(process.cwd(), 'src/features/ai/companion/ai-companion-panel.tsx'),
  'utf8',
);
const konlingRuntimeSource = readFileSync(
  join(process.cwd(), 'src/lib/konling-agent-runtime.ts'),
  'utf8',
);
const streamingCitationFallbackSource = readFileSync(
  join(process.cwd(), 'src/lib/konling-streaming-citation-fallback.ts'),
  'utf8',
);
const finalCitationMetadataStreamSource = readFileSync(
  join(process.cwd(), 'src/lib/konling-final-citation-metadata-stream.ts'),
  'utf8',
);
const globalAISidebarSource = readFileSync(
  join(process.cwd(), 'src/components/ai/global-ai-sidebar.tsx'),
  'utf8',
);
const globalAIProviderSource = readFileSync(
  join(process.cwd(), 'src/components/providers/global-ai-provider.tsx'),
  'utf8',
);
const documentGradingUiSource = readFileSync(
  join(process.cwd(), 'src/features/assessment/document-rubric-grading-ui.tsx'),
  'utf8',
);
const resourceRendererSource = readFileSync(
  join(process.cwd(), 'src/features/lesson-engine/resource-renderer.tsx'),
  'utf8',
);
const adaptivePracticeLayoutSource = readFileSync(
  join(process.cwd(), 'src/app/assessment/adaptive-practice/layout.tsx'),
  'utf8',
);
const pathAdvisorEntryPointBridgeSource = readFileSync(
  join(process.cwd(), 'src/features/adaptive/path-advisor-entrypoint-bridge.tsx'),
  'utf8',
);
const aiContextResolverSource = readFileSync(
  join(process.cwd(), 'src/lib/ai-context-resolver.ts'),
  'utf8',
);
const aiPromptBuilderSource = readFileSync(
  join(process.cwd(), 'src/lib/ai-prompt-builder.ts'),
  'utf8',
);
const simulationResourceSources = [
  'src/resources/simulations/simulations/cruise-simulation.tsx',
  'src/resources/simulations/simulations/lng-simulation.tsx',
  'src/resources/simulations/simulations/destroyer-simulation.tsx',
  'src/resources/simulations/simulations/drilling-simulation.tsx',
  'src/resources/simulations/simulations/container-simulation.tsx',
  'src/resources/simulations/simulations/icebreaker-simulation.tsx',
  'src/resources/simulations/simulations/dredger-simulation.tsx',
].map((sourcePath) => readFileSync(join(process.cwd(), sourcePath), 'utf8'));

describe('AI chat route Konling runtime guard', () => {
  it('keeps legacy lessonContext prompt construction when no page runtime context is provided', () => {
    expect(chatRouteSource).toContain('const hasRuntimeContext = Boolean');
    expect(chatRouteSource).toContain('if (session?.user?.id && hasRuntimeContext)');
    expect(chatRouteSource).toContain('systemPrompt = buildContextAwarePrompt(SYSTEM_PROMPT, lessonContext)');
  });

  it('keeps the scoped get_simulation_status tool contract compatible with legacy tools', () => {
    expect(chatRouteSource).toContain('const toolRuntime = buildKonlingToolRuntime');
    expect(chatRouteSource).toContain('tools = buildScopedKonlingAiTools(toolRuntime)');
    expect(chatRouteSource).not.toContain('...buildScopedKonlingAiTools');
  });

  it('uses AI SDK v6 message and stream contracts', () => {
    expect(chatRouteSource).toContain('toModelMessages(uiMessages)');
    expect(chatRouteSource).toContain('toUIMessageStream({');
    expect(chatRouteSource).toContain('createUIMessageStreamResponse');
    expect(chatRouteSource).toContain('let uiMessages = rawMessages.map(toUIMessage)');
    expect(chatRouteSource).toContain('originalMessages: uiMessages');
    expect(chatRouteSource).toContain('generateMessageId: () => crypto.randomUUID()');
    expect(chatRouteSource).toContain('consumeSseStream: consumeStream');
    expect(chatRouteSource).toContain('stopWhen: stepCountIs(5)');
    expect(chatRouteSource.indexOf('if (!Array.isArray(rawMessages))'))
      .toBeGreaterThan(chatRouteSource.indexOf("return new Response(JSON.stringify({ error: '未授权' })"));
    expect(chatRouteSource).not.toContain('convertToCoreMessages');
    expect(chatRouteSource).not.toContain('toDataStreamResponse');
    expect(sessionMessagesRouteSource).toContain('toModelMessages(updatedMessages)');
    expect(sessionMessagesRouteSource).toContain('stopWhen: stepCountIs(5)');
    expect(sessionMessagesRouteSource).not.toContain('StreamingTextResponse');
  });

  it('rejects expired or hidden legacy sessions before agent, tool, or model side effects', () => {
    const sessionLookup = sessionMessagesRouteSource.indexOf('const konlingSession = await prisma.konlingSession.findFirst');
    const visibilityGate = sessionMessagesRouteSource.indexOf('libraryVisible: true', sessionLookup);
    const expiryGate = sessionMessagesRouteSource.indexOf('expiresAt: { gt: new Date() }', sessionLookup);
    const notFound = sessionMessagesRouteSource.indexOf("error: 'Session not found'", sessionLookup);
    const agentSession = sessionMessagesRouteSource.indexOf('const agentSession = await getOrCreateKonlingAgentSession');
    const model = sessionMessagesRouteSource.indexOf('const result = await streamText');
    expect(sessionLookup).toBeGreaterThanOrEqual(0);
    expect(visibilityGate).toBeGreaterThan(sessionLookup);
    expect(expiryGate).toBeGreaterThan(sessionLookup);
    expect(notFound).toBeLessThan(agentSession);
    expect(notFound).toBeLessThan(model);
  });

  it('uses collision-resistant message ids and claims a conversation before model or tool execution', () => {
    expect(sessionMessagesRouteSource).not.toContain('Date.now()');
    expect(sessionMessagesRouteSource.match(/createKonlingMessageId\(\)/g)).toHaveLength(2);
    const claim = sessionMessagesRouteSource.indexOf('await claimKonlingConversationTurn');
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(claim).toBeLessThan(sessionMessagesRouteSource.indexOf('const agentSession = await getOrCreateKonlingAgentSession'));
    expect(claim).toBeLessThan(sessionMessagesRouteSource.indexOf('const result = await streamText'));
    expect(chatRouteSource.indexOf('await claimKonlingConversationTurn'))
      .toBeLessThan(chatRouteSource.indexOf('const agentSession = await getOrCreateKonlingAgentSession'));
  });

  it('keeps scoped Konling simulation parameter tools available without restoring legacy tools', () => {
    expect(chatRouteSource).toContain('const toolRuntime = buildKonlingToolRuntime');
    expect(chatRouteSource).toContain('tools = buildScopedKonlingAiTools(toolRuntime)');
    expect(konlingRuntimeSource).toContain('set_simulation_params: tool');
    expect(konlingRuntimeSource).toContain('analyze_result: tool');
    expect(konlingRuntimeSource).not.toContain('setSimulationParamsTool.execute');
    expect(konlingRuntimeSource).toContain('inputSchema: setSimulationParamsInputSchema.extend');
    expect(chatRouteSource).toContain('scopedSimulationState: simulationState');
  });

  it('leaves path-advisor generation to scoped model tool calls instead of pre-stream regex writes', () => {
    expect(chatRouteSource).not.toContain('maybeGeneratePathAdvisorPlan');
    expect(chatRouteSource).not.toContain('isLearningPathGenerationRequest');
    expect(chatRouteSource).not.toContain('path-advisor:auto-generate');
    expect(chatRouteSource).not.toContain('const proactivePathGeneration');
    expect(chatRouteSource).not.toContain('input.runtime.generateLearningPath');
    expect(chatRouteSource).toContain('agentSessionId: agentSession.id');
    expect(chatRouteSource.indexOf('isConfiguredAIServiceAvailable(modelRequirements)'))
      .toBeLessThan(chatRouteSource.indexOf('tools = buildScopedKonlingAiTools(toolRuntime)'));
    expect(chatRouteSource).toContain('tools = buildScopedKonlingAiTools(toolRuntime)');
    expect(aiPromptBuilderSource).toContain("mode.mode.id === 'path-advisor'");
    expect(aiPromptBuilderSource).toContain('只有用户明确要求生成、重建、重新规划或调整学习路径时');
    expect(aiPromptBuilderSource).toContain('不得调用路径写入工具');
    expect(aiPromptBuilderSource).toContain('naturalLanguageIntent');
  });

  it('attaches audited agent sessions before exposing scoped Konling tools', () => {
    expect(chatRouteSource).toContain('getOrCreateKonlingAgentSession');
    expect(chatRouteSource).toContain('agentSessionId?: string');
    expect(chatRouteSource).toContain("'X-Konling-Agent-Session-Id': agentSession.id");
    expect(chatRouteSource).toContain('agentSessionId: agentSession.id');
    expect(chatRouteSource).toContain('permittedTools: modeContract.permittedTools');
    expect(sessionMessagesRouteSource).toContain('getOrCreateKonlingAgentSession');
    expect(sessionMessagesRouteSource).toContain('agentSessionId');
    expect(sessionMessagesRouteSource).toContain('agentSessionId: agentSession.id');
    expect(sessionMessagesRouteSource).toContain('permittedTools: modeContract.permittedTools');
    expect(sessionMessagesRouteSource).toContain('const refreshedAgentSession = await resumeKonlingAgentSession');
    expect(sessionMessagesRouteSource).toContain("phase: 'konling-chat-tool-runtime'");
    expect(sessionMessagesRouteSource.indexOf('const refreshedAgentSession = await resumeKonlingAgentSession'))
      .toBeGreaterThan(sessionMessagesRouteSource.indexOf('await persistKonlingSessionMemories'));
    expect(sessionMessagesRouteSource).toContain('pendingApproval: refreshedAgentSession.pendingApproval');
  });

  it('applies Konling teaching-assistant mode contracts before exposing tools', () => {
    expect(chatRouteSource).toContain('buildKonlingTeachingAssistantRuntimeContract');
    expect(chatRouteSource).toContain('resolveKonlingTeachingAssistantScopeOverride');
    expect(chatRouteSource).toContain('resolveKonlingTeachingAssistantServerModeContext');
    expect(chatRouteSource).toContain('teachingAssistantModeId');
    expect(chatRouteSource).toContain('if (teachingAssistantModeId && !session?.user?.id)');
    expect(chatRouteSource.indexOf('if (teachingAssistantModeId && !session?.user?.id)'))
      .toBeLessThan(chatRouteSource.indexOf('if (!Array.isArray(rawMessages))'));
    expect(chatRouteSource).toContain("'X-Konling-Assistant-Mode': modeContract.mode.id");
    expect(chatRouteSource).toContain("'X-Konling-Assistant-Mode-Status': modeContract.status");
    expect(chatRouteSource).toContain('if (teachingAssistantModeId && !hasRuntimeContext)');
    expect(chatRouteSource.indexOf('if (teachingAssistantModeId && !hasRuntimeContext)'))
      .toBeLessThan(chatRouteSource.indexOf('let tools: any = aiTools'));
    expect(chatRouteSource).toContain("if (modeContract.status === 'unavailable')");
    expect(chatRouteSource).toContain("error: 'KONLING_MODE_UNAVAILABLE'");
    expect(chatRouteSource.indexOf("if (modeContract.status === 'unavailable'"))
      .toBeLessThan(chatRouteSource.indexOf('const agentSession = await getOrCreateKonlingAgentSession'));
    expect(chatRouteSource).toContain('permittedTools: modeContract.permittedTools');
    expect(chatRouteSource).toContain('context: { ...modeRuntimeContext, permittedTools: modeContract.permittedTools }');
    expect(chatRouteSource).toContain('knowledgeCapabilityContext: modeContract.groundingContext');
    expect(chatRouteSource).toContain('teachingAssistantMode: modeContract');
    expect(chatRouteSource).toContain('const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext');
    expect(chatRouteSource).toContain('teachingAssistantServerModeContext: serverModeContext');
    expect(chatRouteSource).not.toContain('const preliminaryRuntimeContext = await buildKonlingRuntimeContext');
    expect(chatRouteSource.indexOf('const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext'))
      .toBeLessThan(chatRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext'));
    expect(chatRouteSource).toContain('targetUserId: runtimeTargetUserId');
    expect(chatRouteSource).toContain('classId: runtimeClassId');
    expect(chatRouteSource.indexOf('const modeScopeOverride = await resolveKonlingTeachingAssistantScopeOverride'))
      .toBeLessThan(chatRouteSource.indexOf('const scope = await verifyKonlingRuntimeScope'));
    expect(chatRouteSource).toContain('const modeRuntimeContext = {');
    expect(sessionMessagesRouteSource).toContain('buildKonlingTeachingAssistantRuntimeContract');
    expect(sessionMessagesRouteSource).toContain('resolveKonlingTeachingAssistantScopeOverride');
    expect(sessionMessagesRouteSource).toContain('resolveKonlingTeachingAssistantServerModeContext');
    expect(sessionMessagesRouteSource).toContain('teachingAssistantModeId');
    expect(sessionMessagesRouteSource).toContain("if (modeContract.status === 'unavailable')");
    expect(sessionMessagesRouteSource).toContain("error: 'KONLING_MODE_UNAVAILABLE'");
    expect(sessionMessagesRouteSource.indexOf("if (modeContract.status === 'unavailable'"))
      .toBeLessThan(sessionMessagesRouteSource.indexOf('const agentSession = await getOrCreateKonlingAgentSession'));
    expect(sessionMessagesRouteSource).toContain('permittedTools: modeContract.permittedTools');
    expect(sessionMessagesRouteSource).toContain('context: { ...modeRuntimeContext, permittedTools: modeContract.permittedTools }');
    expect(sessionMessagesRouteSource).toContain('knowledgeCapabilityContext: modeContract.groundingContext');
    expect(sessionMessagesRouteSource).toContain('teachingAssistantMode: modeContract');
    expect(sessionMessagesRouteSource).toContain('const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext');
    expect(sessionMessagesRouteSource).toContain('teachingAssistantServerModeContext: serverModeContext');
    expect(sessionMessagesRouteSource).not.toContain('const preliminaryRuntimeContext = await buildKonlingRuntimeContext');
    expect(sessionMessagesRouteSource.indexOf('const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext'))
      .toBeLessThan(sessionMessagesRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext'));
    expect(sessionMessagesRouteSource).toContain('targetUserId: runtimeTargetUserId');
    expect(sessionMessagesRouteSource).toContain('classId: runtimeClassId');
    expect(sessionMessagesRouteSource.indexOf('const modeScopeOverride = await resolveKonlingTeachingAssistantScopeOverride'))
      .toBeLessThan(sessionMessagesRouteSource.indexOf('const scope = await verifyKonlingRuntimeScope'));
    expect(sessionMessagesRouteSource).toContain('const modeRuntimeContext = {');
  });

  it('wires production Konling entry points into chat request mode payloads', () => {
    expect(globalAIProviderSource).toContain('openAssistantEntryPoint');
    expect(globalAIProviderSource).toContain('assistantEntryPoint: entryPoint');
    expect(globalAIProviderSource).toContain('assistantEntryPoint: null');
    expect(globalAISidebarSource).toContain('teachingAssistantModeId: assistantEntryPoint?.mode');
    expect(globalAISidebarSource).toContain('modeClientContextHints: effectiveServerContext');
    expect(globalAISidebarSource).toContain('resourceId: effectiveServerContext?.resourceId');
    expect(documentGradingUiSource).toContain('KonlingEntryPointButton');
    expect(documentGradingUiSource).toContain('entryPoint={view.konlingEntryPoint}');
    expect(resourceRendererSource).toContain("mode: 'resource-coach'");
    expect(resourceRendererSource).toContain('assistantEntryPoint: {');
    expect(adaptivePracticeLayoutSource).toContain('createKonlingTeachingAssistantServerContextToken');
    expect(adaptivePracticeLayoutSource).toContain("mode: 'path-advisor'");
    expect(adaptivePracticeLayoutSource).toContain("'student-path-center': true");
    expect(pathAdvisorEntryPointBridgeSource).toContain("mode: 'path-advisor'");
    expect(pathAdvisorEntryPointBridgeSource).toContain('modeContextToken');
    expect(pathAdvisorEntryPointBridgeSource).toContain('assistantEntryPoint: {');
  });

  it('clears explicit assistant entry points when page context changes without a new entry point', () => {
    expect(globalAIProviderSource).toContain('assistantEntryPoint: context.assistantEntryPoint ?? null');
    expect(globalAIProviderSource).toContain('assistantEntryPoint: null');
    expect(globalAIProviderSource).toContain('pageContext: null');
    expect(globalAIProviderSource).toContain('tools: []');
    expect(globalAIProviderSource).toContain('quickQuestions: []');
    expect(globalAIProviderSource.indexOf('const resolved = resolveAIContext(pathname)'))
      .toBeLessThan(globalAIProviderSource.indexOf('setDynamicContext({'));
  });

  it('exposes server citation guard metadata and downgrades persisted uncited session replies', () => {
    expect(chatRouteSource).toContain('buildKonlingStreamingCitationGuard(modeRuntimeContext)');
    expect(chatRouteSource).toContain('let modelRequirements: ModelProviderCapabilityRequirements =');
    expect(chatRouteSource).toContain('tools: true');
    expect(chatRouteSource).toContain('streaming: true');
    expect(chatRouteSource).toContain('citationNormalization: true');
    expect(chatRouteSource).toContain('isConfiguredAIServiceAvailable(modelRequirements)');
    expect(chatRouteSource).toContain('getConfiguredAIModel(undefined, modelRequirements)');
    expect(sessionMessagesRouteSource).toContain('const modelRequirements: ModelProviderCapabilityRequirements');
    expect(sessionMessagesRouteSource).toContain('citationNormalization: true');
    expect(sessionMessagesRouteSource).toContain('getConfiguredAIModel(undefined, modelRequirements)');
    expect(chatRouteSource).toContain("'X-Konling-Citation-Guard': citationGuardMetadata.status");
    expect(chatRouteSource).toContain('const agentSessionStateUpdate = await prisma.agentSession.updateMany');
    expect(chatRouteSource).toContain('konlingCitationGuard: citationGuardMetadataPayload');
    expect(chatRouteSource).toContain('buildKonlingSarAssociatedGroundingMetadataPayload(');
    expect(chatRouteSource).toContain('konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload');
    expect(chatRouteSource).toContain('{ konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload }');
    expect(chatRouteSource).not.toContain('konlingSarAssociatedGrounding: modeContract.groundingContext.sarAssociatedGrounding');
    expect(chatRouteSource).toContain('AgentSession citation metadata persistence failed');
    expect(chatRouteSource).toContain('ownerUserId: authorizedScope.targetUserId');
    expect(chatRouteSource).toContain('actorUserId: authorizedScope.authenticatedUserId');
    expect(chatRouteSource).toContain('messageMetadata: ({ part })');
    expect(chatRouteSource).toContain('konlingCitationGuard');
    expect(chatRouteSource).toContain('appendFinalCitationGuardMetadata');
    expect(chatRouteSource).toContain('buildFinalCitationGuardMetadataPayload');
    expect(chatRouteSource).toContain('buildKonlingCitationGuard(modeRuntimeContext, assistantContent)');
    expect(finalCitationMetadataStreamSource).toContain("chunk.type === 'text-delta'");
    expect(finalCitationMetadataStreamSource).toContain("type: 'message-metadata'");
    expect(finalCitationMetadataStreamSource).toContain('konlingCitationGuard: buildFinalMetadata(assistantContent)');
    expect(chatRouteSource).toContain('function buildCitationGuardMetadataPayload');
    expect(chatRouteSource).toContain('diagnosticReasons: citationGuardMetadata.diagnosticReasons ?? []');
    expect(chatRouteSource).toContain('personalizationAvailability: citationGuardMetadata.personalizationAvailability');
    expect(chatRouteSource).toContain('missingContext,');
    expect(chatRouteSource).toContain('retrievalSources: buildKonlingCitationRetrievalSources(citationGuardMetadata)');
    expect(chatRouteSource).toContain('serializeKonlingCitationMetadata');
    expect(chatRouteSource).toContain('citations: citationGuardMetadata.citations.map(serializeKonlingCitationMetadata)');
    expect(chatRouteSource).toContain('buildStreamingCitationFallbackNotice(citationGuardMetadataPayload)');
    expect(chatRouteSource).toContain('insertStreamingCitationFallbackNotice');
    expect(streamingCitationFallbackSource).toContain('KONLING_STREAMING_CITATION_DEBUG_INJECTION');
    expect(streamingCitationFallbackSource).toContain("process.env.NODE_ENV) !== 'production'");
    expect(streamingCitationFallbackSource).toContain('diagnosticReasons?: string[]');
    expect(streamingCitationFallbackSource).toContain('missingContext?: string[]');
    expect(streamingCitationFallbackSource).toContain('personalizationAvailability?:');
    expect(streamingCitationFallbackSource).toContain('retrievalSources?:');
    expect(streamingCitationFallbackSource).toContain('【控灵证据提示】');
    expect(chatRouteSource).toContain('createUIMessageStreamResponse');
    expect(chatRouteSource).toContain('trustedContentContext: Boolean(authorizedScope.courseId && authorizedScope.pageId)');
    expect(chatRouteSource).not.toContain('trustedContentContext: Boolean(courseId && pageId)');
    expect(sessionMessagesRouteSource).toContain('const citationGuard = buildKonlingCitationGuard(modeRuntimeContext, assistantContent)');
    expect(sessionMessagesRouteSource).toContain('const guardedAssistantContent = applyKonlingCitationFallback');
    expect(sessionMessagesRouteSource).toContain('assistantMessage: guardedAssistantContent');
    expect(sessionMessagesRouteSource).toContain('metadata: {');
    expect(sessionMessagesRouteSource).toContain('konlingCitationGuard: {');
    expect(sessionMessagesRouteSource).toContain('const sarAssociatedGroundingMetadataPayload = buildKonlingSarAssociatedGroundingMetadataPayload');
    expect(sessionMessagesRouteSource).toContain('konlingSarAssociatedGrounding: sarAssociatedGroundingMetadataPayload');
    expect(sessionMessagesRouteSource).not.toContain('konlingSarAssociatedGrounding: modeContract.groundingContext.sarAssociatedGrounding');
    expect(sessionMessagesRouteSource).toContain('diagnosticReasons: citationGuard.diagnosticReasons ?? []');
    expect(sessionMessagesRouteSource).toContain('personalizationAvailability: citationGuard.personalizationAvailability');
    expect(sessionMessagesRouteSource).toContain('missingContext: modeContract.groundingContext.missingContext');
    expect(sessionMessagesRouteSource).toContain('retrievalSources: buildKonlingCitationRetrievalSources(citationGuard)');
    expect(sessionMessagesRouteSource).toContain('serializeKonlingCitationMetadata');
    expect(sessionMessagesRouteSource).toContain('citations: citationGuard.citations.map(serializeKonlingCitationMetadata)');
    expect(konlingRuntimeSource).toContain('export function serializeKonlingCitationMetadata');
    expect(konlingRuntimeSource).toContain('displayHref: citation.displayHref ?? citation.citationChip?.displayHref ?? null');
    expect(konlingRuntimeSource).toContain('answerRelevanceQueryHash: citation.answerRelevanceQueryHash ?? null');
    expect(sessionMessagesRouteSource).toContain('citationGuard,');
    const sessionRuntimeInputIndex = sessionMessagesRouteSource.indexOf('const runtimeInput = {');
    const sessionTrustedIndex = sessionMessagesRouteSource.indexOf('trustedContentContext: true', sessionRuntimeInputIndex);
    const sessionServerModeIndex = sessionMessagesRouteSource.indexOf('const serverModeContext = await resolveKonlingTeachingAssistantServerModeContext');
    const sessionRuntimeContextIndex = sessionMessagesRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext');
    expect(sessionRuntimeInputIndex).toBeGreaterThanOrEqual(0);
    expect(sessionTrustedIndex).toBeGreaterThan(sessionRuntimeInputIndex);
    expect(sessionTrustedIndex).toBeLessThan(sessionServerModeIndex);
    expect(sessionServerModeIndex).toBeLessThan(sessionRuntimeContextIndex);
  });

  it('does not write Konling runtime simulation state into the legacy global tool store', () => {
    expect(chatRouteSource).toContain('if (simulationState && !hasRuntimeContext)');
    expect(chatRouteSource).toContain('scopedSimulationState: simulationState');
  });

  it('keeps simulation Konling context scoped to route-owned runtime signals', () => {
    expect(aiContextResolverSource).toContain('simulationIdFromPath(pathname)');
    expect(aiContextResolverSource).toContain('routeProvenance: \'simulation-route\'');
    expect(aiContextResolverSource).toContain('runSummaryAvailability: \'unavailable-until-runtime-run\'');
    expect(konlingRuntimeSource).toContain('buildServerOwnedSimulationPageContext(scope)');
    expect(konlingRuntimeSource).toContain("scope.courseId !== 'simulation'");
    expect(konlingRuntimeSource).toContain('simulationId');
    expect(konlingRuntimeSource).toContain('simulation-run-summary-unavailable');
    expect(aiContextResolverSource).not.toContain('toolPermissions:');
    expect(chatRouteSource).toContain('clientHintsRejected: Object.keys(modeClientContextHints ?? {})');
    expect(sessionMessagesRouteSource).toContain('clientContextHints: modeClientContextHints');
    expect(sessionMessagesRouteSource).toContain('permittedTools: modeContract.permittedTools');
  });

  it('does not promote client page text into server-authored page context', () => {
    expect(konlingRuntimeSource).toContain('function buildServerOwnedPageContext(scope: KonlingRuntimeScope)');
    expect(konlingRuntimeSource).not.toContain('hint?.courseTitle');
    expect(konlingRuntimeSource).not.toContain('hint?.pageType');
    expect(konlingRuntimeSource).not.toContain('hint?.topic');
    expect(konlingRuntimeSource).not.toContain('hint?.learningObjectives');
    expect(konlingRuntimeSource).not.toContain('hint?.knowledgeType');
    expect(konlingRuntimeSource).not.toContain('stage: hint?.stage');
    expect(konlingRuntimeSource).not.toContain('url: hint?.url');
  });

  it('validates runtime scope before building Konling context and preserves scope error status', () => {
    const verifyIndex = chatRouteSource.indexOf('const scope = await verifyKonlingRuntimeScope');
    const buildIndex = chatRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(verifyIndex);
    expect(chatRouteSource).toContain('if (error instanceof KonlingRuntimeScopeError)');
    expect(chatRouteSource).toContain('status: error.status');
  });

  it('redacts provider errors through the shared model-provider compatibility guard', () => {
    expect(chatRouteSource).toContain('redactProviderError');
    expect(chatRouteSource).toContain('AIProviderCapabilityUnavailableError');
    expect(chatRouteSource).toContain('AI_SERVICE_UNAVAILABLE');
    expect(chatRouteSource).not.toContain("replace(/Bearer\\s+\\S+/g, 'Bearer ***')");
    expect(sessionMessagesRouteSource).toContain('redactProviderError');
    expect(sessionMessagesRouteSource).toContain('AIProviderCapabilityUnavailableError');
    expect(sessionMessagesRouteSource).toContain('AI_SERVICE_UNAVAILABLE');
    expect(sessionMessagesRouteSource).not.toContain('console.error(\'AI session message error:\', error)');
  });

  it('validates session message scope before building Konling context', () => {
    const verifyIndex = sessionMessagesRouteSource.indexOf('const scope = await verifyKonlingRuntimeScope');
    const buildIndex = sessionMessagesRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(verifyIndex);
    expect(sessionMessagesRouteSource).toContain('if (error instanceof KonlingRuntimeScopeError)');
    expect(sessionMessagesRouteSource).toContain('status: error.status');
  });

  it('hides the public simulation AI companion entry when no user is authenticated', () => {
    expect(aiCompanionPanelSource).toContain('useSession');
    expect(aiCompanionPanelSource).toContain("authStatus !== 'authenticated'");
    expect(aiCompanionPanelSource).toContain('return null');
    expect(globalAIProviderSource).toContain("sessionStatus !== 'authenticated'");
    expect(globalAIProviderSource).toContain('!session?.user');
    simulationResourceSources.forEach((source) => {
      expect(source).not.toContain('AICompanionPanel');
    });
  });
});

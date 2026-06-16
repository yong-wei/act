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
    expect(chatRouteSource).toContain('const uiMessages = rawMessages.map(toUIMessage)');
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

  it('keeps scoped Konling simulation parameter tools available without restoring legacy tools', () => {
    expect(chatRouteSource).toContain('const toolRuntime = buildKonlingToolRuntime');
    expect(chatRouteSource).toContain('tools = buildScopedKonlingAiTools(toolRuntime)');
    expect(konlingRuntimeSource).toContain('set_simulation_params: tool');
    expect(konlingRuntimeSource).toContain('analyze_result: tool');
    expect(konlingRuntimeSource).not.toContain('setSimulationParamsTool.execute');
    expect(konlingRuntimeSource).toContain('inputSchema: setSimulationParamsInputSchema.extend');
    expect(chatRouteSource).toContain('scopedSimulationState: simulationState');
  });

  it('runs path-advisor generation through the audited Konling tool before streaming a reply', () => {
    expect(chatRouteSource).toContain('maybeGeneratePathAdvisorPlan');
    expect(chatRouteSource).toContain("input.modeId !== 'path-advisor'");
    expect(chatRouteSource).toContain("input.permittedTools.includes('generate_learning_path')");
    expect(chatRouteSource).toContain('input.runtime.generateLearningPath');
    expect(chatRouteSource).toContain('path-advisor:auto-generate');
    expect(chatRouteSource).toContain('agentSessionId: agentSession.id');
    expect(chatRouteSource).toContain('agentSessionId: input.agentSessionId');
    expect(chatRouteSource).toContain('lastUserMessageIndex: findLastUserMessageIndex(input.messages)');
    expect(chatRouteSource).toContain('request.agentSessionId');
    expect(chatRouteSource).toContain('String(request.lastUserMessageIndex)');
    expect(chatRouteSource).toContain("const generationVerb = '(?:生成|创建|新建|制定|规划|重建|重新生成|重新规划)'");
    expect(chatRouteSource).toContain("const pathNoun = '(?:学习路径|路径方案|学习方案|学习计划|路径规划)'");
    expect(chatRouteSource).toContain('new RegExp(`(?:${generationVerb}.{0,24}${pathNoun}|${pathNoun}.{0,24}${generationVerb})`)');
    expect(chatRouteSource.indexOf('const proactivePathGeneration = await maybeGeneratePathAdvisorPlan'))
      .toBeLessThan(chatRouteSource.indexOf('tools = buildScopedKonlingAiTools(toolRuntime)'));
    expect(chatRouteSource.indexOf('isConfiguredAIServiceAvailable(modelRequirements)'))
      .toBeLessThan(chatRouteSource.indexOf('const proactivePathGeneration = await maybeGeneratePathAdvisorPlan'));
    const generationRequestBlock = chatRouteSource.slice(
      chatRouteSource.indexOf('function isLearningPathGenerationRequest'),
      chatRouteSource.indexOf('function buildPathAdvisorGenerationIdempotencyKey'),
    );
    expect(generationRequestBlock).not.toContain('推荐');
  });

  it('keeps path-advisor auto generation intent narrow but accepts explicit path creation requests', () => {
    const generationVerb = '(?:生成|创建|新建|制定|规划|重建|重新生成|重新规划)';
    const pathNoun = '(?:学习路径|路径方案|学习方案|学习计划|路径规划)';
    const matcher = new RegExp(`(?:${generationVerb}.{0,24}${pathNoun}|${pathNoun}.{0,24}${generationVerb})`);
    const matches = (value: string) => matcher.test(value.replace(/\s+/g, ''));

    expect(matches('生成学习路径')).toBe(true);
    expect(matches('请生成学习路径')).toBe(true);
    expect(matches('规划路径方案')).toBe(true);
    expect(matches('重建路径方案')).toBe(true);
    expect(matches('制定学习计划')).toBe(true);
    expect(matches('推荐我按当前路径下一步做什么')).toBe(false);
    expect(matches('请推荐学习路径')).toBe(false);
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
    expect(chatRouteSource).toContain('context: { ...runtimeContext, permittedTools: modeContract.permittedTools }');
    expect(chatRouteSource).toContain('teachingAssistantMode: modeContract');
    expect(chatRouteSource).toContain('serverModeContext: await resolveKonlingTeachingAssistantServerModeContext');
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
    expect(sessionMessagesRouteSource).toContain('context: { ...runtimeContext, permittedTools: modeContract.permittedTools }');
    expect(sessionMessagesRouteSource).toContain('teachingAssistantMode: modeContract');
    expect(sessionMessagesRouteSource).toContain('serverModeContext: await resolveKonlingTeachingAssistantServerModeContext');
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
    expect(globalAISidebarSource).toContain('modeClientContextHints: assistantEntryPoint?.serverContext');
    expect(globalAISidebarSource).toContain('resourceId: assistantEntryPoint?.serverContext.resourceId');
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
    expect(chatRouteSource).toContain('messageMetadata: ({ part })');
    expect(chatRouteSource).toContain('konlingCitationGuard');
    expect(chatRouteSource).toContain('buildStreamingCitationFallbackNotice(citationGuardMetadata)');
    expect(chatRouteSource).toContain('insertStreamingCitationFallbackNotice');
    expect(streamingCitationFallbackSource).toContain('【控灵证据提示】');
    expect(chatRouteSource).toContain('createUIMessageStreamResponse');
    expect(chatRouteSource).toContain('trustedContentContext: Boolean(scope.scope.courseId && scope.scope.pageId)');
    expect(chatRouteSource).not.toContain('trustedContentContext: Boolean(courseId && pageId)');
    expect(sessionMessagesRouteSource).toContain('const citationGuard = buildKonlingCitationGuard(modeRuntimeContext, assistantContent)');
    expect(sessionMessagesRouteSource).toContain('const guardedAssistantContent = applyKonlingCitationFallback');
    expect(sessionMessagesRouteSource).toContain('assistantMessage: guardedAssistantContent');
    expect(sessionMessagesRouteSource).toContain('citationGuard,');
    const sessionRuntimeContextIndex = sessionMessagesRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext');
    const sessionTrustedIndex = sessionMessagesRouteSource.indexOf('trustedContentContext: true', sessionRuntimeContextIndex);
    expect(sessionRuntimeContextIndex).toBeGreaterThanOrEqual(0);
    expect(sessionTrustedIndex).toBeGreaterThan(sessionRuntimeContextIndex);
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

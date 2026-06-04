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

describe('AI chat route Konling runtime guard', () => {
  it('keeps legacy lessonContext prompt construction when no page runtime context is provided', () => {
    expect(chatRouteSource).toContain('const hasRuntimeContext = Boolean');
    expect(chatRouteSource).toContain('if (session?.user?.id && hasRuntimeContext)');
    expect(chatRouteSource).toContain('systemPrompt = buildContextAwarePrompt(SYSTEM_PROMPT, lessonContext)');
  });

  it('keeps the scoped get_simulation_status tool contract compatible with legacy tools', () => {
    expect(chatRouteSource).toContain('tools = buildScopedKonlingAiTools(buildKonlingToolRuntime');
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
    expect(chatRouteSource).toContain('buildScopedKonlingAiTools(buildKonlingToolRuntime');
    expect(konlingRuntimeSource).toContain('set_simulation_params: tool');
    expect(konlingRuntimeSource).toContain('analyze_result: tool');
    expect(konlingRuntimeSource).not.toContain('setSimulationParamsTool.execute');
    expect(konlingRuntimeSource).toContain('inputSchema: setSimulationParamsInputSchema.extend');
    expect(chatRouteSource).toContain('scopedSimulationState: simulationState');
  });

  it('attaches audited agent sessions before exposing scoped Konling tools', () => {
    expect(chatRouteSource).toContain('getOrCreateKonlingAgentSession');
    expect(chatRouteSource).toContain('agentSessionId?: string');
    expect(chatRouteSource).toContain("'X-Konling-Agent-Session-Id': agentSession.id");
    expect(chatRouteSource).toContain('agentSessionId: agentSession.id');
    expect(chatRouteSource).toContain('permittedTools: agentSession.permittedTools');
    expect(sessionMessagesRouteSource).toContain('getOrCreateKonlingAgentSession');
    expect(sessionMessagesRouteSource).toContain('agentSessionId');
    expect(sessionMessagesRouteSource).toContain('agentSessionId: agentSession.id');
    expect(sessionMessagesRouteSource).toContain('permittedTools: agentSession.permittedTools');
    expect(sessionMessagesRouteSource).toContain('const refreshedAgentSession = await resumeKonlingAgentSession');
    expect(sessionMessagesRouteSource).toContain("phase: 'konling-chat-tool-runtime'");
    expect(sessionMessagesRouteSource.indexOf('const refreshedAgentSession = await resumeKonlingAgentSession'))
      .toBeGreaterThan(sessionMessagesRouteSource.indexOf('await persistKonlingSessionMemories'));
    expect(sessionMessagesRouteSource).toContain('pendingApproval: refreshedAgentSession.pendingApproval');
  });

  it('exposes server citation guard metadata and downgrades persisted uncited session replies', () => {
    expect(chatRouteSource).toContain('buildKonlingStreamingCitationGuard(runtimeContext)');
    expect(chatRouteSource).toContain("'X-Konling-Citation-Guard': citationGuardMetadata.status");
    expect(chatRouteSource).toContain('messageMetadata: ({ part })');
    expect(chatRouteSource).toContain('konlingCitationGuard');
    expect(chatRouteSource).toContain('buildStreamingCitationFallbackNotice(citationGuardMetadata)');
    expect(chatRouteSource).toContain('insertStreamingCitationFallbackNotice');
    expect(streamingCitationFallbackSource).toContain('【控灵证据提示】');
    expect(chatRouteSource).toContain('createUIMessageStreamResponse');
    expect(chatRouteSource).toContain('trustedContentContext: Boolean(scope.scope.courseId && scope.scope.pageId)');
    expect(chatRouteSource).not.toContain('trustedContentContext: Boolean(courseId && pageId)');
    expect(sessionMessagesRouteSource).toContain('const citationGuard = buildKonlingCitationGuard(runtimeContext, assistantContent)');
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

  it('validates runtime scope before building Konling context and preserves scope error status', () => {
    const verifyIndex = chatRouteSource.indexOf('const scope = await verifyKonlingRuntimeScope');
    const buildIndex = chatRouteSource.indexOf('const runtimeContext = await buildKonlingRuntimeContext');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(verifyIndex);
    expect(chatRouteSource).toContain('if (error instanceof KonlingRuntimeScopeError)');
    expect(chatRouteSource).toContain('status: error.status');
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
  });
});

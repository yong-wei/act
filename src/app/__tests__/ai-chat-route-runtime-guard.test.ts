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

  it('keeps scoped Konling simulation parameter tools available without restoring legacy tools', () => {
    expect(chatRouteSource).toContain('buildScopedKonlingAiTools(buildKonlingToolRuntime');
    expect(konlingRuntimeSource).toContain('set_simulation_params: tool');
    expect(konlingRuntimeSource).toContain('analyze_result: tool');
    expect(konlingRuntimeSource).not.toContain('setSimulationParamsTool.execute');
    expect(chatRouteSource).toContain('scopedSimulationState: simulationState');
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

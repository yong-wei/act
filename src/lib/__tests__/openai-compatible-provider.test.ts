import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAIMockState = vi.hoisted(() => ({
  createOpenAIOptions: undefined as { baseURL?: string; apiKey?: string; name?: string } | undefined,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((options) => {
    openAIMockState.createOpenAIOptions = options;
    return {
      chat: vi.fn((modelId: string) => ({ modelId })),
    };
  }),
}));

describe('OpenAI compatible provider adapter', () => {
  beforeEach(() => {
    openAIMockState.createOpenAIOptions = undefined;
  });

  it('passes an empty apiKey for authMode none to avoid SDK env fallback', async () => {
    const { createOpenAICompatibleAdapter } = await import('@/lib/ai/providers/openai-compatible');

    createOpenAICompatibleAdapter({
      provider: 'local-gateway',
      providerKind: 'openai-compatible',
      baseURL: 'http://localhost:11434/v1',
      apiKey: '',
      authMode: 'none',
      secretRef: 'env:LOCAL_GATEWAY_API_KEY',
      model: 'local/model',
      enabled: true,
      priority: 10,
      health: 'healthy',
      capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
    });

    expect(openAIMockState.createOpenAIOptions?.apiKey).toBe('');
  });
});

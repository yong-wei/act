import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveConfiguredAIProviderConfig: vi.fn(),
}));

class MockAIProviderCapabilityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderCapabilityUnavailableError';
  }
}

vi.mock('@/lib/ai/provider-settings', () => ({
  AIProviderCapabilityUnavailableError: MockAIProviderCapabilityUnavailableError,
  resolveConfiguredAIProviderConfig: mocks.resolveConfiguredAIProviderConfig,
}));

vi.mock('@/lib/ai/provider-registry', () => ({
  createAIProviderFromConfig: vi.fn(),
  getActiveAIProvider: vi.fn(),
}));

vi.mock('@/lib/ai/provider-config', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/ai/provider-config')>(),
  resolveAIProviderConfig: vi.fn(() => ({
    provider: 'test-provider',
    providerKind: 'openai-compatible',
    baseURL: 'https://test-provider.local/v1',
    apiKey: '',
    authMode: 'none',
    secretRef: 'env:AI_API_KEY',
    model: 'test/model',
    enabled: true,
    priority: 100,
    health: 'unknown',
    capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
  })),
}));

describe('AI client provider availability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('treats authMode none providers as available without an API key', async () => {
    mocks.resolveConfiguredAIProviderConfig.mockResolvedValue({
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
    const { isConfiguredAIServiceAvailable } = await import('@/lib/ai/provider-runtime');

    await expect(isConfiguredAIServiceAvailable()).resolves.toBe(true);
  });

  it('returns unavailable instead of throwing when no provider can satisfy requirements', async () => {
    mocks.resolveConfiguredAIProviderConfig.mockRejectedValue(
      new MockAIProviderCapabilityUnavailableError('No enabled provider can satisfy the requested capabilities.'),
    );
    const { isConfiguredAIServiceAvailable } = await import('@/lib/ai/provider-runtime');

    await expect(isConfiguredAIServiceAvailable({ tools: true })).resolves.toBe(false);
  });
});

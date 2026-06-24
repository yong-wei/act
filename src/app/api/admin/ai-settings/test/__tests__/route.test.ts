import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  resolveConfiguredAIProviderConfig: vi.fn(),
  createAIProviderFromConfig: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/ai/provider-settings', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/ai/provider-settings')>(),
  resolveConfiguredAIProviderConfig: mocks.resolveConfiguredAIProviderConfig,
}));

vi.mock('@/lib/ai/provider-registry', () => ({
  createAIProviderFromConfig: mocks.createAIProviderFromConfig,
}));

vi.mock('ai', () => ({
  generateText: mocks.generateText,
}));

import { POST } from '../route';
import { AIProviderCapabilityUnavailableError } from '@/lib/ai/provider-settings';

function buildPostRequest(payload: unknown) {
  return new Request('http://localhost/api/admin/ai-settings/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

describe('POST /api/admin/ai-settings/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
  });

  it('returns unavailable instead of server error when provider capabilities cannot run', async () => {
    mocks.resolveConfiguredAIProviderConfig.mockRejectedValue(
      new AIProviderCapabilityUnavailableError('Provider anthropic-cited lacks required capabilities: tools.')
    );

    const response = await POST(buildPostRequest({
      providerId: 'anthropic-cited',
      model: 'claude/model',
    }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      providerId: 'anthropic-cited',
      model: 'claude/model',
      error: 'Provider anthropic-cited lacks required capabilities: tools.',
    });
  });

  it('allows testing authMode none providers without an API key', async () => {
    const model = { id: 'local/model' };
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
    mocks.createAIProviderFromConfig.mockReturnValue({
      getModel: vi.fn(() => model),
    });
    mocks.generateText.mockResolvedValue({
      text: 'local gateway ok',
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 3, totalTokens: 4 },
    });

    const response = await POST(buildPostRequest({
      providerId: 'local-gateway',
      model: 'local/model',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      providerId: 'local-gateway',
      model: 'local/model',
      text: 'local gateway ok',
    });
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({ model }));
  });
});

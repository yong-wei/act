import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
    platformSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { PUT } from '../route';

function buildPutRequest(payload: unknown) {
  return new Request('http://localhost/api/admin/ai-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

describe('PUT /api/admin/ai-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    mocks.prisma.platformSetting.findUnique.mockResolvedValue(null);
    mocks.prisma.platformSetting.upsert.mockImplementation(async ({ create, update }) => update ?? create);
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await PUT(buildPutRequest({}));

    expect(response.status).toBe(401);
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects plaintext provider secret references before persistence', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'sk-plaintext-secret',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid AI provider settings');
    expect(payload.issues.join('\n')).toContain('secretRef');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-http provider endpoints before persistence', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'file:///tmp/provider',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('baseURL');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-boolean capability flags before persistence', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        capabilities: { tools: 'yes' },
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('capabilities.tools');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing capability flags before persistence when capabilities are supplied', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        capabilities: { tools: true },
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('capabilities.reasoning');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('stores only secret reference schemes in the audit record', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));

    expect(response.status).toBe(200);
    const auditCall = mocks.prisma.platformSetting.upsert.mock.calls.find(([input]) => (
      input.where.key === 'ai_provider_settings_audit'
    ));
    expect(JSON.stringify(auditCall?.[0].create.value)).not.toContain('CUSTOM_PROVIDER_API_KEY');
    expect(JSON.stringify(auditCall?.[0].update.value)).not.toContain('CUSTOM_PROVIDER_API_KEY');
    expect(auditCall?.[0].create.value).toMatchObject({
      secretRefSchemes: [{ providerId: 'custom-provider', scheme: 'env', configured: true }],
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
    platformSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    adminOperationLedger: {
      upsert: vi.fn(),
    },
    adminOperationArtifact: {
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

import { GET, PUT } from '../route';

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
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
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

  it('rejects activeProvider values that do not match a submitted provider', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'missing-provider',
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
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('activeProvider must reference an existing provider');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing activeProvider before persistence', async () => {
    const response = await PUT(buildPutRequest({
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
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('activeProvider is required');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects blank provider names before persistence', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: '   ',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('name is required');
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing provider names before persistence', async () => {
    const response = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues.join('\n')).toContain('name is required');
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
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: expect.stringMatching(/^admin-op:/) },
      create: expect.objectContaining({
        kind: 'admin-config-save',
        scope: 'admin-config-ai-settings:custom-provider',
      }),
    }));
  });

  it('changes the audit idempotency key when saved provider metadata changes', async () => {
    const firstResponse = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        authMode: 'bearer-api-key',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    }));
    const firstPayload = await firstResponse.json();

    const secondResponse = await PUT(buildPutRequest({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider Renamed',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        authMode: 'bearer-api-key',
        secretRef: 'env:CUSTOM_PROVIDER_ROTATED_API_KEY',
        selectedModel: 'custom/model',
        models: [{
          id: 'custom-model',
          label: 'Custom Model Renamed',
          model: 'custom/model',
          description: 'renamed model entry',
        }],
      }],
    }));
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstPayload.operationLedger.idempotencyKey).toMatch(/^admin-op:/);
    expect(secondPayload.operationLedger.idempotencyKey).toMatch(/^admin-op:/);
    expect(secondPayload.operationLedger.idempotencyKey).not.toBe(
      firstPayload.operationLedger.idempotencyKey
    );
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/admin/ai-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
  });

  it('exposes runtime health and capability state without secret references', async () => {
    mocks.prisma.platformSetting.findUnique.mockResolvedValue({
      value: {
        activeProvider: 'anthropic-cited',
        providers: [{
          id: 'anthropic-cited',
          name: 'Anthropic Compatible',
          providerKind: 'anthropic-compatible',
          baseURL: 'https://anthropic-compatible.test/v1',
          authMode: 'bearer-api-key',
          secretRef: 'env:ANTHROPIC_COMPATIBLE_API_KEY',
          selectedModel: 'claude/model',
          models: [{ id: 'claude-model', label: 'Claude Model', model: 'claude/model' }],
          enabled: true,
          priority: 10,
          health: 'healthy',
          capabilities: {
            tools: true,
            reasoning: true,
            vision: true,
            jsonSchema: false,
            streaming: true,
            citationNormalization: true,
          },
        }],
      },
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.runtimeStates).toEqual([
      expect.objectContaining({
        serviceId: 'anthropic-cited',
        providerKind: 'anthropic-compatible',
        health: 'healthy',
        runtimeSupported: false,
        runtimeSupport: expect.objectContaining({
          status: 'adapter-missing',
          category: 'runtime-adapter',
        }),
      }),
    ]);
    expect(JSON.stringify(payload.runtimeStates)).not.toContain('ANTHROPIC_COMPATIBLE_API_KEY');
    expect(JSON.stringify(payload.runtimeStates)).not.toContain('secretRef');
  });
});

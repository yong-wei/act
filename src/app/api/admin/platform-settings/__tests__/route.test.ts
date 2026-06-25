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
  return new Request('http://localhost/api/admin/platform-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

describe('/api/admin/platform-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.platformSetting.findUnique.mockResolvedValue(null);
    mocks.prisma.platformSetting.upsert.mockImplementation(async ({ create, update }) => update ?? create);
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const getResponse = await GET();
    const putResponse = await PUT(buildPutRequest({
      homeDynamicModelEnabled: false,
      dataCenterShowDemoSourceLabels: true,
    }));

    expect(getResponse.status).toBe(401);
    expect(putResponse.status).toBe(401);
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('defaults data-center visible demo source labels to disabled', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      homeDynamicModelEnabled: false,
      dataCenterShowDemoSourceLabels: false,
    });
  });

  it('persists the data-center demo source label display policy', async () => {
    const response = await PUT(buildPutRequest({
      homeDynamicModelEnabled: true,
      dataCenterShowDemoSourceLabels: true,
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      homeDynamicModelEnabled: true,
      dataCenterShowDemoSourceLabels: true,
      operationLedger: {
        kind: 'admin-config-save',
        outcome: 'completed',
      },
    });
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-config-save:/);
    expect(mocks.prisma.platformSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'data_center_show_demo_source_labels' },
      create: { key: 'data_center_show_demo_source_labels', value: true },
      update: { value: true },
    }));
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: expect.stringMatching(/^admin-op:/) },
    }));
  });

  it('rejects missing or non-boolean demo source label policy', async () => {
    const response = await PUT(buildPutRequest({
      homeDynamicModelEnabled: false,
      dataCenterShowDemoSourceLabels: 'yes',
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });
});

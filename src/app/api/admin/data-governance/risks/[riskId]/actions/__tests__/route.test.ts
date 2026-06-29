import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    studentRiskFlag: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminOperationLedger: {
      upsert: vi.fn(),
    },
    adminOperationArtifact: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST } from '../route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/data-governance/risks/risk-1/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/data-governance/risks/[riskId]/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma));
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue({
      id: 'risk-1',
      userId: 'student-1',
      isResolved: false,
      evidenceJson: { source: 'risk-detector' },
    });
    mocks.prisma.studentRiskFlag.update.mockResolvedValue({
      id: 'risk-1',
      userId: 'student-1',
      isResolved: true,
      resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
      resolutionNote: '管理员从数据治理工作台标记处理',
      evidenceJson: {},
    });
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'admin-1' });
  });

  it('resolves a risk and persists governance audit into evidenceJson', async () => {
    const response = await POST(postRequest({ action: 'resolve' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(payload.auditRecord).toMatchObject({
      actorId: 'admin-1',
      action: 'resolve',
      riskId: 'risk-1',
      outcome: 'resolved',
      undoAvailable: false,
      retentionPolicy: 'admin-operation-ledger-30d',
    });
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-resolve',
      actorId: 'admin-1',
      scope: 'admin-governance-resolve:risk-1',
      outcome: 'completed',
      auditSummary: '治理风险 risk-1 已由管理员标记处理。',
    });
    expect(payload.auditRecord.operationId).toBe(payload.operationLedger.operationId);
    expect(payload.auditRecord.idempotencyKey).toBe(payload.operationLedger.idempotencyKey);
    expect(response.headers.get('x-admin-operation-id')).toBe(payload.operationLedger.operationId);
    expect(response.headers.get('x-admin-operation-outcome')).toBe('completed');
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: payload.operationLedger.idempotencyKey },
      create: expect.objectContaining({
        operationId: payload.operationLedger.operationId,
        kind: 'admin-governance-resolve',
        scope: 'admin-governance-resolve:risk-1',
        outcome: 'completed',
      }),
    }));
    expect(mocks.prisma.studentRiskFlag.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'risk-1' },
      data: expect.objectContaining({
        isResolved: true,
        resolvedAt: expect.any(Date),
        evidenceJson: expect.objectContaining({
          source: 'risk-detector',
          adminGovernance: expect.objectContaining({
            auditLog: expect.arrayContaining([
              expect.objectContaining({ action: 'resolve', outcome: 'resolved' }),
            ]),
          }),
        }),
      }),
    }));
  });

  it('assigns a risk only when the assignee exists', async () => {
    const response = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      select: { id: true },
    });
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-assign',
      scope: 'admin-governance-assign:risk-1',
      outcome: 'completed',
      auditSummary: '治理风险 risk-1 已分派给 admin-1。',
    });
    expect(response.headers.get('x-admin-operation-id')).toBe(payload.operationLedger.operationId);
    expect(mocks.prisma.studentRiskFlag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        evidenceJson: expect.objectContaining({
          adminGovernance: expect.objectContaining({
            currentAssignee: 'admin-1',
            auditLog: expect.arrayContaining([
              expect.objectContaining({ action: 'assign', outcome: 'assigned' }),
            ]),
          }),
        }),
      }),
    }));
  });

  it('retries serializable governance audit conflicts before returning success', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: false,
        evidenceJson: { source: 'risk-detector' },
      })
      .mockResolvedValueOnce({
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            auditLog: [{ action: 'assign', outcome: 'assigned', recordedAt: '2026-06-21T09:00:00.000Z' }],
          },
        },
      });
    mocks.prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma));

    const response = await POST(postRequest({ action: 'resolve' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.studentRiskFlag.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.studentRiskFlag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        evidenceJson: expect.objectContaining({
          adminGovernance: expect.objectContaining({
            auditLog: [
              expect.objectContaining({ action: 'assign', outcome: 'assigned' }),
              expect.objectContaining({ action: 'resolve', outcome: 'resolved' }),
            ],
          }),
        }),
      }),
    }));
  });

  it('rejects already resolved risks before mutating data', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValueOnce({
      id: 'risk-1',
      userId: 'student-1',
      isResolved: true,
      evidenceJson: { source: 'risk-detector' },
    });

    const response = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: '治理风险已解决，不能继续提交治理动作' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.studentRiskFlag.update).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('rejects stale governance actions when the risk resolves before the transaction update', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: false,
        evidenceJson: { source: 'risk-detector' },
      })
      .mockResolvedValueOnce({
        isResolved: true,
        evidenceJson: { source: 'risk-detector' },
      });

    const response = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: '治理风险已解决，不能继续提交治理动作' });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.studentRiskFlag.update).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 for missing risks before mutating data', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ action: 'resolve' }), {
      params: Promise.resolve({ riskId: 'missing-risk' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: '治理风险不存在' });
    expect(mocks.prisma.studentRiskFlag.update).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });
});

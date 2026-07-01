import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  afterEach(() => {
    vi.useRealTimers();
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
      undoAvailable: true,
      previousState: 'open',
      newState: 'resolved',
      affectedObject: 'student:student-1',
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

  it('ignores a risk as a reversible disposition with audit state', async () => {
    const response = await POST(postRequest({ action: 'ignore', note: '误报，忽略' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auditRecord).toMatchObject({
      action: 'ignore',
      outcome: 'ignored',
      undoAvailable: true,
      previousState: 'open',
      newState: 'ignored',
      note: '误报，忽略',
    });
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-ignore',
      scope: 'admin-governance-ignore:risk-1',
      auditSummary: '治理风险 risk-1 已由管理员忽略。',
      rollback: expect.objectContaining({ available: true }),
    });
    expect(mocks.prisma.studentRiskFlag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isResolved: true,
        resolutionNote: '误报，忽略',
        evidenceJson: expect.objectContaining({
          adminGovernance: expect.objectContaining({
            lastDisposition: 'ignored',
            auditLog: expect.arrayContaining([
              expect.objectContaining({ action: 'ignore', outcome: 'ignored' }),
            ]),
          }),
        }),
      }),
    }));
  });

  it('reopens a resolved risk and records the previous handled state', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: '已人工复核',
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            auditLog: [
              {
                actorId: 'admin-1',
                action: 'resolve',
                riskId: 'risk-1',
                assignee: null,
                outcome: 'resolved',
                undoAvailable: true,
                recordedAt: '2026-06-21T10:00:00.000Z',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: '已人工复核',
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            auditLog: [
              {
                actorId: 'admin-1',
                action: 'resolve',
                riskId: 'risk-1',
                assignee: null,
                outcome: 'resolved',
                undoAvailable: true,
                recordedAt: '2026-06-21T10:00:00.000Z',
              },
            ],
          },
        },
      });

    const response = await POST(postRequest({ action: 'reopen' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auditRecord).toMatchObject({
      action: 'reopen',
      outcome: 'reopened',
      undoAvailable: false,
      previousState: 'resolved',
      newState: 'open',
    });
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-reopen',
      scope: 'admin-governance-reopen:risk-1',
      auditSummary: '治理风险 risk-1 已重新打开。',
    });
    expect(mocks.prisma.studentRiskFlag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isResolved: false,
        resolvedAt: null,
        resolutionNote: null,
        evidenceJson: expect.objectContaining({
          adminGovernance: expect.objectContaining({
            lastDisposition: 'open',
            auditLog: expect.arrayContaining([
              expect.objectContaining({ action: 'resolve', undoAvailable: false }),
              expect.objectContaining({ action: 'reopen', outcome: 'reopened' }),
            ]),
          }),
        }),
      }),
    }));
  });

  it('uses legacy lastDisposition when reopening resolved risks without audit logs', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: null,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            lastDisposition: 'ignored',
            auditLog: [],
          },
        },
      })
      .mockResolvedValueOnce({
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: null,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            lastDisposition: 'ignored',
            auditLog: [],
          },
        },
      });

    const response = await POST(postRequest({ action: 'reopen' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auditRecord).toMatchObject({
      action: 'reopen',
      previousState: 'ignored',
      newState: 'open',
    });
  });

  it('undoes a handled risk disposition and rejects undo for open risks', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: '管理员从数据治理工作台忽略该风险',
        evidenceJson: {
          adminGovernance: {
            auditLog: [
              {
                actorId: 'admin-1',
                action: 'ignore',
                riskId: 'risk-1',
                assignee: null,
                outcome: 'ignored',
                undoAvailable: true,
                recordedAt: '2026-06-21T10:00:00.000Z',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        isResolved: true,
        resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
        resolutionNote: '管理员从数据治理工作台忽略该风险',
        evidenceJson: {
          adminGovernance: {
            auditLog: [
              {
                actorId: 'admin-1',
                action: 'ignore',
                riskId: 'risk-1',
                assignee: null,
                outcome: 'ignored',
                undoAvailable: true,
                recordedAt: '2026-06-21T10:00:00.000Z',
              },
            ],
          },
        },
      });

    const undoResponse = await POST(postRequest({ action: 'undo' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const undoPayload = await undoResponse.json();

    expect(undoResponse.status).toBe(200);
    expect(undoPayload.auditRecord).toMatchObject({
      action: 'undo',
      outcome: 'undone',
      previousState: 'ignored',
      newState: 'open',
    });

    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValueOnce({
      id: 'risk-1',
      userId: 'student-1',
      isResolved: false,
      evidenceJson: { source: 'risk-detector' },
    });
    const openUndoResponse = await POST(postRequest({ action: 'undo' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const openUndoPayload = await openUndoResponse.json();

    expect(openUndoResponse.status).toBe(409);
    expect(openUndoPayload).toEqual({ error: '治理风险仍处于待处理状态，无需重新打开' });
  });

  it('rejects undo when no undoable disposition audit exists', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValueOnce({
      id: 'risk-1',
      userId: 'student-1',
      isResolved: true,
      resolvedAt: new Date('2026-06-21T10:00:00.000Z'),
      resolutionNote: 'legacy close',
      evidenceJson: {
        adminGovernance: {
          auditLog: [
            {
              actorId: 'admin-1',
              action: 'resolve',
              riskId: 'risk-1',
              assignee: null,
              outcome: 'resolved',
              undoAvailable: false,
              recordedAt: '2026-06-21T10:00:00.000Z',
            },
          ],
        },
      },
    });

    const response = await POST(postRequest({ action: 'undo' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: '治理风险没有可撤销的处置记录' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.studentRiskFlag.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the risk disappears inside the transaction', async () => {
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: false,
        evidenceJson: { source: 'risk-detector' },
      })
      .mockResolvedValueOnce(null);

    const response = await POST(postRequest({ action: 'resolve' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: '治理风险不存在' });
    expect(mocks.prisma.studentRiskFlag.update).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
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

  it('uses stable governance action idempotency keys across repeated requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T10:00:00.000Z'));
    const firstResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const firstPayload = await firstResponse.json();
    vi.setSystemTime(new Date('2026-06-21T10:05:00.000Z'));

    const secondResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstPayload.operationLedger.idempotencyKey).toBe(secondPayload.operationLedger.idempotencyKey);
    expect(firstPayload.operationLedger.operationId).toBe(secondPayload.operationLedger.operationId);
  });

  it('does not duplicate governance audit evidence for repeated idempotent actions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T10:00:00.000Z'));
    const firstResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const firstPayload = await firstResponse.json();
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: false,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            currentAssignee: 'admin-1',
            auditLog: [firstPayload.auditRecord],
          },
        },
      })
      .mockResolvedValueOnce({
        isResolved: false,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            currentAssignee: 'admin-1',
            auditLog: [firstPayload.auditRecord],
          },
        },
      });
    vi.setSystemTime(new Date('2026-06-21T10:05:00.000Z'));

    const secondResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const secondPayload = await secondResponse.json();
    const updateCall = mocks.prisma.studentRiskFlag.update.mock.calls.at(-1)?.[0];
    const governance = updateCall?.data?.evidenceJson?.adminGovernance;
    const auditLog = governance?.auditLog;

    expect(secondResponse.status).toBe(200);
    expect(secondPayload.operationLedger.idempotencyKey).toBe(firstPayload.operationLedger.idempotencyKey);
    expect(governance.currentAssignee).toBe('admin-1');
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0]).toMatchObject({
      idempotencyKey: firstPayload.operationLedger.idempotencyKey,
      recordedAt: firstPayload.auditRecord.recordedAt,
    });
  });

  it('treats assigning back to a previous assignee as a new governance action', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T10:00:00.000Z'));
    const firstResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const firstPayload = await firstResponse.json();
    const laterAssignment = {
      ...firstPayload.auditRecord,
      assignee: 'admin-2',
      idempotencyKey: 'admin-op:later-assignment',
      recordedAt: '2026-06-21T10:03:00.000Z',
    };
    mocks.prisma.studentRiskFlag.findUnique
      .mockResolvedValueOnce({
        id: 'risk-1',
        userId: 'student-1',
        isResolved: false,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            currentAssignee: 'admin-2',
            auditLog: [firstPayload.auditRecord, laterAssignment],
          },
        },
      })
      .mockResolvedValueOnce({
        isResolved: false,
        evidenceJson: {
          source: 'risk-detector',
          adminGovernance: {
            currentAssignee: 'admin-2',
            auditLog: [firstPayload.auditRecord, laterAssignment],
          },
        },
      });
    vi.setSystemTime(new Date('2026-06-21T10:05:00.000Z'));

    const reassignmentResponse = await POST(postRequest({ action: 'assign', assignee: 'admin-1' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const reassignmentPayload = await reassignmentResponse.json();
    const updateCall = mocks.prisma.studentRiskFlag.update.mock.calls.at(-1)?.[0];
    const governance = updateCall?.data?.evidenceJson?.adminGovernance;

    expect(reassignmentResponse.status).toBe(200);
    expect(reassignmentPayload.operationLedger.idempotencyKey).not.toBe(firstPayload.operationLedger.idempotencyKey);
    expect(reassignmentPayload.operationLedger.auditSummary).toBe('治理风险 risk-1 已分派给 admin-1。');
    expect(governance.currentAssignee).toBe('admin-1');
    expect(governance.auditLog).toHaveLength(3);
    expect(governance.auditLog.at(-1)).toMatchObject({
      assignee: 'admin-1',
      idempotencyKey: reassignmentPayload.operationLedger.idempotencyKey,
    });
  });

  it('includes stable resolution notes in governance action idempotency keys', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T10:00:00.000Z'));
    const firstResponse = await POST(postRequest({ action: 'resolve', note: '已人工复核' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const firstPayload = await firstResponse.json();
    vi.setSystemTime(new Date('2026-06-21T10:05:00.000Z'));

    const secondResponse = await POST(postRequest({ action: 'resolve', note: '已人工复核' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const secondPayload = await secondResponse.json();
    const thirdResponse = await POST(postRequest({ action: 'resolve', note: '需要后续跟进' }), {
      params: Promise.resolve({ riskId: 'risk-1' }),
    });
    const thirdPayload = await thirdResponse.json();

    expect(firstPayload.operationLedger.idempotencyKey).toBe(secondPayload.operationLedger.idempotencyKey);
    expect(firstPayload.operationLedger.idempotencyKey).not.toBe(thirdPayload.operationLedger.idempotencyKey);
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

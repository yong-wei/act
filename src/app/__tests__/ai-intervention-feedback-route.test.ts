import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
  recordKonlingInterventionFeedback: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { marker: 'prisma-client' },
}));

vi.mock('@/lib/konling-agent-runtime', () => ({
  KonlingRuntimeScopeError: class KonlingRuntimeScopeError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  verifyKonlingRuntimeScope: mocks.verifyKonlingRuntimeScope,
  recordKonlingInterventionFeedback: mocks.recordKonlingInterventionFeedback,
}));

import { POST } from '../api/ai/intervention/feedback/route';

function postFeedback(body: unknown) {
  return POST(new Request('http://localhost/api/ai/intervention/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/ai/intervention/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyKonlingRuntimeScope.mockResolvedValue({
      ok: true,
      scope: {
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        role: 'STUDENT',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        classId: 'class-1',
        pathNodeId: 'node-1',
      },
    });
    mocks.recordKonlingInterventionFeedback.mockResolvedValue({ success: true });
  });

  it('maps legacy negative helpful feedback to a rejected intervention outcome', async () => {
    const response = await postFeedback({
      interventionId: 'intv-negative',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      wasHelpful: false,
    });

    expect(response.status).toBe(200);
    expect(mocks.recordKonlingInterventionFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        interventionId: 'intv-negative',
        feedback: 'rejected',
        helpful: false,
      }),
    );
  });

  it('keeps explicit dismissed feedback as dismissed', async () => {
    const response = await postFeedback({
      interventionId: 'intv-dismissed',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      feedback: 'dismissed',
      wasHelpful: false,
    });

    expect(response.status).toBe(200);
    expect(mocks.recordKonlingInterventionFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        interventionId: 'intv-dismissed',
        feedback: 'dismissed',
        helpful: false,
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  attributeWrongAnswerEvidence: vi.fn(),
  orchestrateRemediation: vi.fn(),
  refreshRemediationOrchestration: vi.fn(),
  readRemediationOrchestration: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/features/assessment/remediation-orchestration', () => ({
  orchestrateRemediation: mocks.orchestrateRemediation,
  refreshRemediationOrchestration: mocks.refreshRemediationOrchestration,
  readRemediationOrchestration: mocks.readRemediationOrchestration,
}));
vi.mock('@/features/assessment/wrong-answer-attribution', () => ({
  attributeWrongAnswerEvidence: mocks.attributeWrongAnswerEvidence,
}));

import { GET, POST } from '../route';

describe('assessment remediation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'learner-1', role: 'STUDENT' } });
  });

  it('requires an authenticated learner', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ attributionId: 'attribution-1' }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'UNAUTHENTICATED' });
    expect(mocks.orchestrateRemediation).not.toHaveBeenCalled();
  });

  it('rejects teacher-triggered orchestration', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ attributionId: 'attribution-1' }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'LEARNER_REQUIRED' });
  });

  it('does not disclose an absent or foreign attribution', async () => {
    mocks.orchestrateRemediation.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ attributionId: 'foreign-attribution' }),
    }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'ATTRIBUTION_NOT_FOUND' });
    expect(mocks.orchestrateRemediation).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1',
      attributionId: 'foreign-attribution',
    }));
  });

  it('derives an owned attribution from the durable answer without accepting browser attribution state', async () => {
    mocks.attributeWrongAnswerEvidence.mockResolvedValue({ id: 'attribution-owned' });
    mocks.orchestrateRemediation.mockResolvedValue({
      id: 'result-1',
      status: 'UNAVAILABLE',
      orchestratorVersion: 'remediation-orchestrator.v1',
      unavailableReason: 'ATTRIBUTION_UNCERTAIN',
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
      createdAt: '2026-08-10T00:00:00.000Z',
    });

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ answerId: 'answer-1', attributionId: 'browser-substituted' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.attributeWrongAnswerEvidence).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1', answerId: 'answer-1',
    }));
    expect(mocks.orchestrateRemediation).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1', attributionId: 'attribution-owned',
    }));
  });

  it('returns a controlled unavailable result when answer attribution cannot be read safely', async () => {
    mocks.attributeWrongAnswerEvidence.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ answerId: 'foreign-answer' }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      status: 'UNAVAILABLE',
      unavailableReason: 'ATTRIBUTION_UNAVAILABLE',
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
    });
    expect(mocks.orchestrateRemediation).not.toHaveBeenCalled();
  });

  it('returns only the sanitized orchestration projection', async () => {
    mocks.orchestrateRemediation.mockResolvedValue({
      id: 'result-1',
      status: 'UNAVAILABLE',
      orchestratorVersion: 'remediation-orchestrator.v1',
      unavailableReason: 'RESOURCE_UNAVAILABLE',
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
      createdAt: '2026-08-03T00:00:00.000Z',
    });

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST',
      body: JSON.stringify({ attributionId: 'attribution-1', selectedAnswer: 'secret' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({ status: 'UNAVAILABLE' }));
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('refreshes only an attribution derived from the owned durable answer', async () => {
    mocks.attributeWrongAnswerEvidence.mockResolvedValue({ id: 'attribution-owned' });
    mocks.refreshRemediationOrchestration.mockResolvedValue({
      id: 'fresh-result', status: 'AVAILABLE', orchestratorVersion: 'remediation-orchestrator.v1:refresh:refresh-1',
      task: { version: 'remediation-task-snapshot.v1', goal: 'Fresh task', estimatedMinutes: 5, resources: [], validationQuestion: {} },
      createdAt: '2026-08-12T00:00:00.000Z',
    });

    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST', body: JSON.stringify({ answerId: 'answer-1', refreshKey: 'refresh-1' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.refreshRemediationOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1', attributionId: 'attribution-owned', refreshKey: 'refresh-1',
    }));
    expect(mocks.orchestrateRemediation).not.toHaveBeenCalled();
  });

  it('rejects a fresh retry that does not originate from a durable answer', async () => {
    const response = await POST(new Request('http://localhost/api/assessment/remediation', {
      method: 'POST', body: JSON.stringify({ attributionId: 'attribution-1', refreshKey: 'refresh-1' }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'ANSWER_ID_REQUIRED_FOR_REFRESH' });
    expect(mocks.refreshRemediationOrchestration).not.toHaveBeenCalled();
  });

  it('reads only a result scoped to the authenticated learner', async () => {
    mocks.readRemediationOrchestration.mockResolvedValue(null);

    const response = await GET(new Request(
      'http://localhost/api/assessment/remediation?resultId=foreign-result',
    ));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'REMEDIATION_RESULT_NOT_FOUND' });
    expect(mocks.readRemediationOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1',
      resultId: 'foreign-result',
    }));
  });
});

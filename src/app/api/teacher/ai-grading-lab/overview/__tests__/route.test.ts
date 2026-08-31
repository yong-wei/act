import { describe, expect, it, vi } from 'vitest';

import { createTeacherAiGradingLabOverviewHandler } from '../route';
import type { TeacherAiGradingLabOverview } from '@/lib/data-governance/teacher-ai-grading-lab-overview';

const ownerId = 'c123456789012345678901234';
const safeOverview: TeacherAiGradingLabOverview = {
  datasets: [], configurations: [], batches: [], metrics: { completedRate: null, meanAbsoluteScoreDifference: null, exactScoreRate: null, threeRunExactStabilityRate: null }, metricsByRun: [], executions: [], pdfVerifications: [],
  annotationJudgments: [], pendingBlindAnnotations: [], pendingBlindVisualEvidence: [],
};

function dependencies(overrides: Partial<Parameters<typeof createTeacherAiGradingLabOverviewHandler>[0]> = {}) {
  const loadOverview = vi.fn(async () => safeOverview);
  return {
    loadOverview,
    handler: createTeacherAiGradingLabOverviewHandler({
      getSession: async () => ({ user: { id: ownerId, role: 'TEACHER' } }),
      readConfig: () => ({ dataRoot: 'E:/controlled', ownerTeacherUserId: ownerId }),
      loadOverview,
      ...overrides,
    }),
  };
}

describe('GET /api/teacher/ai-grading-lab/overview', () => {
  it.each([
    { getSession: async () => null, status: 401, code: 'UNAUTHENTICATED' },
    { getSession: async () => ({ user: { id: ownerId, role: 'ADMIN' } }), status: 403, code: 'FORBIDDEN' },
    { getSession: async () => ({ user: { id: 'c999999999999999999999999', role: 'TEACHER' } }), status: 403, code: 'FORBIDDEN' },
  ])('rejects actors outside the configured owner', async ({ getSession, status, code }) => {
    const { handler, loadOverview } = dependencies({ getSession });
    const response = await handler();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
    expect(loadOverview).not.toHaveBeenCalled();
  });

  it('returns only the supplied safe projection', async () => {
    const { handler, loadOverview } = dependencies();
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(safeOverview);
    expect(loadOverview).toHaveBeenCalledWith({ dataRoot: 'E:/controlled', ownerTeacherUserId: ownerId });
  });

  it('projects internal loading failures without exposing details', async () => {
    const { handler } = dependencies({ loadOverview: async () => { throw new Error('E:/private/student.docx credential=secret'); } });
    const response = await handler();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toEqual(JSON.stringify({ error: { code: 'LAB_UNAVAILABLE' } }));
  });
});

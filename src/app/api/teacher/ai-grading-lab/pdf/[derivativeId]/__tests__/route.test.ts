import { describe, expect, it, vi } from 'vitest';

import { createTeacherAiGradingLabPdfHandler } from '../route';

const ownerId = 'c123456789012345678901234';
const context = { params: Promise.resolve({ derivativeId: 'grading-lab-derivative:abc' }) };

function dependencies(overrides: Partial<Parameters<typeof createTeacherAiGradingLabPdfHandler>[0]> = {}) {
  const loadPdf = vi.fn(async () => Buffer.from('%PDF-test'));
  return {
    loadPdf,
    handler: createTeacherAiGradingLabPdfHandler({
      getSession: async () => ({ user: { id: ownerId, role: 'TEACHER' } }),
      readConfig: () => ({ dataRoot: 'E:/controlled', ownerTeacherUserId: ownerId }),
      loadPdf,
      ...overrides,
    }),
  };
}

describe('GET /api/teacher/ai-grading-lab/pdf/[derivativeId]', () => {
  it.each([
    { getSession: async () => null, status: 401, code: 'UNAUTHENTICATED' },
    { getSession: async () => ({ user: { id: ownerId, role: 'ADMIN' } }), status: 403, code: 'FORBIDDEN' },
    { getSession: async () => ({ user: { id: 'c999999999999999999999999', role: 'TEACHER' } }), status: 403, code: 'FORBIDDEN' },
  ])('rejects every actor outside the configured owner', async ({ getSession, status, code }) => {
    const { handler, loadPdf } = dependencies({ getSession });
    const response = await handler(new Request('http://localhost'), context);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
    expect(loadPdf).not.toHaveBeenCalled();
  });

  it('serves only the verified consumed derivative as a private PDF', async () => {
    const { handler, loadPdf } = dependencies();
    const response = await handler(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).toBe('%PDF-test');
    expect(loadPdf).toHaveBeenCalledWith({ dataRoot: 'E:/controlled', derivativeId: 'grading-lab-derivative:abc' });
  });

  it('does not reveal unavailable derivatives', async () => {
    const { handler } = dependencies({ loadPdf: async () => null });
    const response = await handler(new Request('http://localhost'), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});

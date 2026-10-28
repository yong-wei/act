import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeActiveGraph: vi.fn(),
  activeUnavailableResponse: vi.fn(),
  loadActiveAuthorityMasteryOverlay: vi.fn(),
}));

vi.mock('@/app/api/knowledge/_active-authority', () => ({
  authorizeActiveGraph: mocks.authorizeActiveGraph,
  activeUnavailableResponse: mocks.activeUnavailableResponse,
}));
vi.mock('@/lib/authority-learner-mastery/server', () => ({
  loadActiveAuthorityMasteryOverlay: mocks.loadActiveAuthorityMasteryOverlay,
}));

import { NextResponse } from 'next/server';

import { GET } from '@/app/api/knowledge/shards/active/mastery/route';

const request = () => new Request('http://localhost/api/knowledge/shards/active/mastery');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeUnavailableResponse.mockImplementation((reason: string) => (
    NextResponse.json({ code: reason }, { status: 503 })
  ));
  mocks.loadActiveAuthorityMasteryOverlay.mockResolvedValue({
    contract: 'active-authority-mastery-overlay.v1',
    status: 'empty',
    domains: [],
    objects: [],
    coverage: { mappedFactCount: 0, unresolvedFactCount: 0 },
  });
});

describe('GET /api/knowledge/shards/active/mastery', () => {
  it('rejects unauthenticated requests without reading learner state', async () => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ code: 'ACTIVE_GRAPH_UNAUTHORIZED' }, { status: 401 }),
    });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.loadActiveAuthorityMasteryOverlay).not.toHaveBeenCalled();
  });

  it('reads only the signed-in student and never caches the response', async () => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({ ok: true, role: 'STUDENT', userId: 'student-1' });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.loadActiveAuthorityMasteryOverlay).toHaveBeenCalledExactlyOnceWith('student-1');
    await expect(response.json()).resolves.toMatchObject({ status: 'empty' });
  });

  it.each(['TEACHER', 'ADMIN'])('returns not-applicable for %s without learner data', async (role) => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({ ok: true, role, userId: 'staff-1' });
    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contract: 'active-authority-mastery-overlay.v1',
      status: 'not-applicable',
    });
    expect(mocks.loadActiveAuthorityMasteryOverlay).not.toHaveBeenCalled();
  });

  it('fails closed with an unavailable response when the read throws', async () => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({ ok: true, role: 'STUDENT', userId: 'student-1' });
    mocks.loadActiveAuthorityMasteryOverlay.mockRejectedValueOnce(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await GET(request());
    spy.mockRestore();
    expect(response.status).toBe(503);
  });
});

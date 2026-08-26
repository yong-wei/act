import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../api/ai/evidence-copilot/route';
import { getServerAuthSession } from '@/lib/auth';
import { resolveEvidenceCopilotContext } from '@/lib/evidence-copilot-context';

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { marker: 'prisma' },
}));

vi.mock('@/lib/evidence-copilot-context', async () => {
  const actual = await vi.importActual<typeof import('@/lib/evidence-copilot-context')>(
    '@/lib/evidence-copilot-context',
  );
  return {
    ...actual,
    resolveEvidenceCopilotContext: vi.fn(),
  };
});

const mockedAuth = vi.mocked(getServerAuthSession);
const mockedResolve = vi.mocked(resolveEvidenceCopilotContext);

describe('/api/ai/evidence-copilot', () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedResolve.mockReset();
  });

  it('requires an authenticated owner and ignores userId query spoofing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } } as never);
    mockedResolve.mockResolvedValue({
      version: 'evidence-copilot-context.v1',
      status: 'missing',
      limitations: ['当前没有可核验的学习证据。'],
      sourceCoverage: {},
      confidenceLevel: 'none',
      freshness: 'missing',
      preferredModalities: [],
      weakTargets: [],
      nextAction: {
        href: '/assessment/adaptive-practice?intent=practice',
        label: '去做一次自适应练习，补充学习证据',
      },
      navigationHint: { source: 'foreign-user', assignment: null, intent: null },
    });

    const response = await GET(new NextRequest('http://localhost/api/ai/evidence-copilot?userId=foreign-user&source=foreign-user'));
    expect(response.status).toBe(200);
    expect(mockedResolve).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      hints: expect.objectContaining({ source: 'foreign-user' }),
    }));
    expect(response.headers.get('X-Evidence-Copilot-Status')).toBe('missing');
    const body = await response.json();
    expect(body.status).toBe('missing');
    expect(body.nextAction.href).toContain('/assessment/adaptive-practice');
  });

  it('returns unauthorized without a session', async () => {
    mockedAuth.mockResolvedValue(null);
    const response = await GET(new NextRequest('http://localhost/api/ai/evidence-copilot'));
    expect(response.status).toBe(401);
    expect(mockedResolve).not.toHaveBeenCalled();
  });
});

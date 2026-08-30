import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../api/ai/copilot-profile/route';
import { getServerAuthSession } from '@/lib/auth';
import { resolveGovernedCopilotProfile } from '@/lib/governed-copilot-profile-context';

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { marker: 'prisma' },
}));

vi.mock('@/lib/governed-copilot-profile-context', async () => {
  const actual = await vi.importActual<typeof import('@/lib/governed-copilot-profile-context')>(
    '@/lib/governed-copilot-profile-context',
  );
  return {
    ...actual,
    resolveGovernedCopilotProfile: vi.fn(),
  };
});

const mockedAuth = vi.mocked(getServerAuthSession);
const mockedResolve = vi.mocked(resolveGovernedCopilotProfile);

describe('/api/ai/copilot-profile', () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedResolve.mockReset();
  });

  it('requires an authenticated owner and ignores userId query spoofing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT', name: '张三' } } as never);
    mockedResolve.mockResolvedValue({
      version: 'governed-copilot-profile-context.v1',
      status: 'missing',
      authenticatedUserId: 'student-1',
      displayName: '张三',
      limitations: ['当前没有可核验的学习画像。'],
      nextAction: {
        href: '/assessment/adaptive-practice?intent=practice',
        label: '去做一次自适应练习，补充学习证据',
      },
    });

    const response = await GET(new NextRequest('http://localhost/api/ai/copilot-profile?userId=foreign-user'));
    expect(response.status).toBe(200);
    expect(mockedResolve).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      displayName: '张三',
    }));
    expect(response.headers.get('X-Governed-Copilot-Profile-Status')).toBe('missing');
    const body = await response.json();
    expect(body.status).toBe('missing');
    expect(body.authenticatedUserId).toBe('student-1');
    expect(body.nextAction.href).toContain('/assessment/adaptive-practice');
  });

  it('returns unauthorized without a session', async () => {
    mockedAuth.mockResolvedValue(null);
    const response = await GET(new NextRequest('http://localhost/api/ai/copilot-profile'));
    expect(response.status).toBe(401);
    expect(mockedResolve).not.toHaveBeenCalled();
  });
});

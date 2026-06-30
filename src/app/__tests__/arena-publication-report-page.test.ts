import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  loadReport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/teacher/publication-store', () => ({
  ArenaPublicationPermissionError: class ArenaPublicationPermissionError extends Error {},
  prismaArenaPublicationStore: {
    loadReport: mocks.loadReport,
  },
}));

import ArenaPublicationReportPage from '../teacher/arena/publications/[publicationId]/page';

describe('ArenaPublicationReportPage permission recovery', () => {
  it('preserves the publication report path when anonymous teachers log in', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const element = await ArenaPublicationReportPage({
      params: Promise.resolve({ publicationId: 'publication-a' }),
    });

    expect(mocks.loadReport).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      kind: 'permission-boundary',
      sourceRoute: '/teacher/arena/publications/[publicationId]',
      targetLabel: 'Arena 发布报告',
      displayReference: 'publication-a',
      primaryHref: `/login?callbackUrl=${encodeURIComponent('/teacher/arena/publications/publication-a')}`,
      primaryLabel: '去登录',
      surface: 'teacher-publication-permission',
    });
  });
});

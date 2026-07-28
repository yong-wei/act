import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({
  prisma: { smartCoursewareRevision: { findFirst } },
}));

import { GET } from '@/app/api/internal/smart-courseware/publication-review/route';
import { validCoursewareManifest } from './fixtures';

describe('internal publication review manifest route', () => {
  beforeEach(() => {
    findFirst.mockReset();
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET', 'server-review-secret');
  });

  it('loads only the exact owner-bound immutable revision without caching', async () => {
    findFirst.mockResolvedValue({
      manifestSnapshot: validCoursewareManifest(),
      manifestHash: 'sha256:immutable-review',
    });
    const response = await GET(new NextRequest(
      'http://localhost/api/internal/smart-courseware/publication-review?sourceRevisionId=revision-1',
      { headers: {
        'x-act-publication-review-secret': 'server-review-secret',
        'x-act-publication-owner': 'teacher-1',
      } },
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual(expect.objectContaining({ manifestHash: 'sha256:immutable-review' }));
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-1', ownerId: 'teacher-1' },
      select: { manifestSnapshot: true, manifestHash: true },
    });
  });

  it('returns not found without querying when internal credentials are missing', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/internal/smart-courseware/publication-review?sourceRevisionId=revision-1',
    ));
    expect(response.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findProjections, findVersions, getServerAuthSession } = vi.hoisted(() => ({
  findProjections: vi.fn(),
  findVersions: vi.fn(),
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseBasisDocumentVersion: { findMany: findVersions },
    courseBasisProjection: { findMany: findProjections },
  },
}));

import { POST } from '../route';

const corpusSourceId = 'teacher-course-basis:basis-1:version-1:root%2Fparagraph%3A1';
const projection = {
  corpusSourceId,
  projectedAt: new Date('2026-07-19T00:00:00Z'),
  segment: {
    stableAnchor: 'root/paragraph:1', contentHash: 'segment-hash',
    text: '闭环控制系统通过反馈比较给定值与输出值。', orderIndex: 0,
  },
  version: {
    id: 'version-1', reviewState: 'CONFIRMED', retiredAt: null as Date | null,
    createdAt: new Date('2026-07-19T00:00:00Z'),
    document: {
      id: 'document-1', title: '自动控制原理课程标准', kind: 'STANDARD',
      courseBasis: { id: 'basis-1', ownerId: 'teacher-1' },
    },
  },
};

describe('lesson-design Course Basis Source Pack route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projection.version.retiredAt = null;
    getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    findVersions.mockResolvedValue([{ document: { courseBasis: { ownerId: 'teacher-1' } } }]);
    findProjections.mockImplementation(async (query) => query.select ? [{ corpusSourceId }] : [projection]);
  });

  it('runs the authorized projection through SAR and lesson-design retrieval with a bounded DTO', async () => {
    const response = await POST(request({ selectedVersionIds: ['version-1'], query: '闭环控制系统' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findProjections.mock.calls[0][0].where).toEqual({
      versionId: { in: ['version-1'] },
      version: {
        extractionState: 'EXTRACTED',
        reviewState: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ retiredAt: null }, { id: { in: [] } }],
        document: { courseBasis: { ownerId: 'teacher-1' } },
      },
    });
    expect(body.sourcePack).toMatchObject({
      profile: 'lesson-design', itemCount: 1,
      retrievalChunkIds: [corpusSourceId],
    });
    expect(Object.keys(body.sourcePack).sort()).toEqual([
      'citationTargetIds', 'coverage', 'itemCount', 'packId', 'profile', 'retrievalChunkIds',
    ]);
    expect(JSON.stringify(body)).not.toContain(projection.segment.text);
    expect(JSON.stringify(body)).not.toContain('limitations');
    expect(JSON.stringify(body)).not.toContain('ranked');
  });

  it('passes an explicitly selected retired version through SAR and retrieval', async () => {
    projection.version.retiredAt = new Date('2026-07-20T00:00:00Z');
    const response = await POST(request({
      selectedVersionIds: ['version-1'],
      explicitRetiredVersionIds: ['version-1'],
      query: '历史课次重放',
    }));

    expect(response.status).toBe(200);
    expect(findProjections.mock.calls[0][0].where.version.OR).toEqual([
      { retiredAt: null }, { id: { in: ['version-1'] } },
    ]);
    await expect(response.json()).resolves.toMatchObject({ sourcePack: { itemCount: 1 } });
  });

  it('rejects a retired replay version outside the selected set', async () => {
    const response = await POST(request({
      selectedVersionIds: ['version-1'],
      explicitRetiredVersionIds: ['version-2'],
      query: '历史课次重放',
    }));

    expect(response.status).toBe(400);
    expect(findVersions).not.toHaveBeenCalled();
  });

  it('returns a controlled 404 for a version outside the teacher owner scope', async () => {
    findVersions.mockResolvedValue([{ document: { courseBasis: { ownerId: 'teacher-2' } } }]);

    const response = await POST(request({ selectedVersionIds: ['version-1'], query: 'lesson' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'version-not-found', details: [] });
    expect(findProjections).not.toHaveBeenCalled();
  });

  it('rejects an empty selection before querying storage', async () => {
    const response = await POST(request({ selectedVersionIds: [], query: 'lesson' }));

    expect(response.status).toBe(400);
    expect(findVersions).not.toHaveBeenCalled();
  });
});

function request(body: unknown) {
  return new Request('https://act.example/api/teacher/course-bases/lesson-design-source-pack', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

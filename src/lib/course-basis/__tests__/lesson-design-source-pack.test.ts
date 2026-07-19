import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildCandidates, retrieveSourcePack } = vi.hoisted(() => ({
  buildCandidates: vi.fn(),
  retrieveSourcePack: vi.fn(),
}));

vi.mock('@/lib/source-pack/teacher-course-basis', () => ({
  buildTeacherCourseBasisLessonDesignCandidatesFromReader: buildCandidates,
}));
vi.mock('@/lib/source-pack/hybrid-retriever', () => ({ retrieveSourcePack }));

import { buildCourseBasisLessonDesignSourcePack } from '../lesson-design-source-pack';

describe('course-basis lesson-design source pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCandidates.mockImplementation(async ({ reader, ownerUserId, selectedVersionIds }) => {
      await reader.readCourseBasisProjections({ ownerUserId, selectedVersionIds });
      return { chunks: [], items: [] };
    });
    retrieveSourcePack.mockReturnValue({ pack: {} });
  });

  it('uses the selected teacher owner when an administrator retrieves projections', async () => {
    const findManyVersions = vi.fn(async () => [{ document: { courseBasis: { ownerId: 'teacher-1' } } }]);
    const findManyProjections = vi.fn(async () => []);
    const db = {
      courseBasisDocumentVersion: { findMany: findManyVersions },
      courseBasisProjection: { findMany: findManyProjections },
    } as any;

    await buildCourseBasisLessonDesignSourcePack(db, {
      actor: { id: 'admin-1', role: 'ADMIN' },
      selectedVersionIds: ['version-1'],
      sar: { candidateRefs: [] } as any,
      retrieval: { query: 'lesson' },
    });

    expect(findManyProjections).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        version: { document: { courseBasis: { ownerId: 'teacher-1' } } },
      }),
    }));
    expect(buildCandidates).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 'teacher-1' }));
  });
});

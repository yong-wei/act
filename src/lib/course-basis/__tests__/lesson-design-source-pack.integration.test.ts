import { describe, expect, it, vi } from 'vitest';

import {
  buildCourseBasisLessonDesignSar,
  buildCourseBasisLessonDesignSourcePack,
} from '../lesson-design-source-pack';

describe('course-basis lesson-design production chain', () => {
  it('turns an editable governed projection into a bounded lesson-design pack without freezing it', async () => {
    const corpusSourceId = 'teacher-course-basis:basis-1:version-1:root%2Fparagraph%3A1';
    const projection = {
      corpusSourceId,
      projectedAt: new Date('2026-07-19T00:00:00Z'),
      segment: {
        stableAnchor: 'root/paragraph:1',
        contentHash: 'segment-hash',
        text: '闭环控制系统通过反馈比较给定值与输出值。',
        orderIndex: 0,
      },
      version: {
        id: 'version-1', reviewState: 'PENDING', retiredAt: null,
        createdAt: new Date('2026-07-19T00:00:00Z'),
        document: {
          id: 'document-1', title: '自动控制原理课程标准', kind: 'STANDARD',
          courseBasis: { id: 'basis-1', ownerId: 'teacher-1' },
        },
      },
    };
    const db = {
      courseBasisDocumentVersion: {
        findMany: vi.fn(async () => [{ document: { courseBasis: { ownerId: 'teacher-1' } } }]),
      },
      courseBasisProjection: {
        findMany: vi.fn(async (query) => query.select ? [{ corpusSourceId }] : [projection]),
      },
    } as any;
    const actor = { id: 'teacher-1', role: 'TEACHER' } as const;
    const sar = await buildCourseBasisLessonDesignSar(db, {
      actor, selectedVersionIds: ['version-1'], query: '闭环控制系统',
    });

    const result = await buildCourseBasisLessonDesignSourcePack(db, {
      actor,
      selectedVersionIds: ['version-1'],
      sar,
      retrieval: { query: '闭环控制系统' },
    });

    expect(sar.candidateRefs.retrievalChunkIds).toEqual([corpusSourceId]);
    expect(result.chunks).toHaveLength(1);
    expect(result.retrieval.pack.profile).toBe('smart-preparation');
    expect(result.retrieval.pack.items).toHaveLength(1);
    expect(result.retrieval.pack.items[0].retrievalChunkId).toBe(corpusSourceId);
    expect(result.chunks[0].sourceRef.lifecycleState).toBe('editable');
  });
});

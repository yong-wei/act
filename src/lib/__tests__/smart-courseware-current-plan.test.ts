import { describe, expect, it, vi } from 'vitest';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { createSmartCoursewareDraft } from '@/lib/smart-courseware/service';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };
const content = {
  schemaVersion: 'smart-lesson-plan.boppps.v1',
  course: '自动控制原理',
  topic: '闭环稳定性',
  audience: '本科生',
  durationMinutes: 30,
  prerequisites: '',
  keyContent: ['稳定性判据'],
  difficultContent: ['参数变化'],
  limitations: [],
  classAdaptation: null,
  coursewareStepOutline: [],
  goals: [],
  knowledgePoints: [],
  sources: [],
  boppps: {},
};

describe('smart courseware current lesson-plan invariant', () => {
  it('rejects creation from a lesson revision invalidated by a later task edit', async () => {
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(null) },
      smartLessonRevision: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'plan-revision-1',
          ownerId: teacher.id,
          revisionNumber: 1,
          taskRevision: 1,
          task: { revision: 2 },
          content,
          contentHash: contentHash(content),
        }),
      },
    };

    await expect(createSmartCoursewareDraft(db as never, {
      actor: teacher,
      planRevisionId: 'plan-revision-1',
      idempotencyKey: 'create-key-stale',
    })).rejects.toMatchObject({ code: 'approved-plan-revision-stale', status: 409 });
    expect(db.smartCoursewareDraft.findFirst).not.toHaveBeenCalled();
  });
});

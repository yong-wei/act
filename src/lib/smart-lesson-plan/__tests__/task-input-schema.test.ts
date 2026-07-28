import { describe, expect, it } from 'vitest';

import { createTaskSchema } from '../task-input-schema';

const textbookRange = {
  bookId: 'book-1',
  level: 'SECTION' as const,
  unitId: 'section-1',
  structuralPath: ['chapter-1', 'section-1'],
};

function taskInput() {
  return {
    courseBasisId: 'basis-1',
    topic: '闭环稳定性',
    audience: '本科生',
    durationMinutes: 45,
    sourceVersionIds: ['version-1'],
    textbookRanges: [],
    knowledgePoints: [{
      content: '稳定性判据',
      sourceState: 'teacher_created_source_pending' as const,
      sourceBindings: [],
      origin: 'TEACHER_CREATED' as const,
    }],
    goals: [{
      content: '判断闭环系统稳定性',
      sourceState: 'teacher_created_source_pending' as const,
      sourceBindings: [],
    }],
  };
}

describe('smart lesson task input resource pack', () => {
  it('accepts either uploaded versions or a confirmed textbook range', () => {
    expect(createTaskSchema.safeParse(taskInput()).success).toBe(true);
    expect(createTaskSchema.safeParse({
      ...taskInput(),
      sourceVersionIds: [],
      textbookRanges: [textbookRange],
    }).success).toBe(true);
  });

  it('rejects an empty upload and textbook selection', () => {
    expect(createTaskSchema.safeParse({
      ...taskInput(),
      sourceVersionIds: [],
      textbookRanges: [],
    }).success).toBe(false);
  });
});

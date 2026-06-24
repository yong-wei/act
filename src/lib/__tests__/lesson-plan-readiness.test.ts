import { describe, expect, it } from 'vitest';

import {
  EMPTY_LESSON_PLAN_MESSAGE,
  hasLaunchableLessonItems,
} from '../lesson-plan-readiness';

describe('lesson plan readiness', () => {
  it('rejects missing or empty lesson item collections', () => {
    expect(hasLaunchableLessonItems([])).toBe(false);
    expect(hasLaunchableLessonItems(null)).toBe(false);
  });

  it('accepts lesson plans with at least one item', () => {
    expect(hasLaunchableLessonItems([{ id: 'item-1' }])).toBe(true);
  });

  it('uses a teacher-readable repair message', () => {
    expect(EMPTY_LESSON_PLAN_MESSAGE).toContain('至少 1 个环节');
  });
});

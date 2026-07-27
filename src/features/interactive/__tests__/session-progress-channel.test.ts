import { describe, expect, it } from 'vitest';

import {
  getStepIdsSyncKey,
  parseStepIdsSyncKey,
  resolveTeacherFollowIndex,
} from '../session-framework/use-session-progress-channel';

describe('session progress step id stability', () => {
  it('keeps the same sync key for equivalent step id arrays', () => {
    const first = ['step-01', 'step-02', 'step-03'];
    const second = ['step-01', 'step-02', 'step-03'];

    expect(first).not.toBe(second);
    expect(getStepIdsSyncKey(first)).toBe(getStepIdsSyncKey(second));
    expect(parseStepIdsSyncKey(getStepIdsSyncKey(second))).toEqual(first);
  });
});

describe('student teacher-step following', () => {
  it('follows the teacher when the teacher changes steps but preserves student browsing between teacher changes', () => {
    expect(resolveTeacherFollowIndex({
      activeIndex: 1,
      nextTeacherIndex: 4,
      previousTeacherIndex: 2,
    })).toBe(4);
    expect(resolveTeacherFollowIndex({
      activeIndex: 1,
      nextTeacherIndex: 4,
      previousTeacherIndex: 4,
    })).toBe(1);
  });
});

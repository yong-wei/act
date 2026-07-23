import { describe, expect, it } from 'vitest';

import {
  getArenaTaskForOdysseyLevel,
  getOdysseyLevelForArenaTask,
  isArenaOdysseyAssignment,
} from '../odyssey/assignment';

describe('Arena Odyssey assignments', () => {
  it('maps the Level 1 growth task and level bidirectionally', () => {
    expect(getOdysseyLevelForArenaTask('task-odyssey-level-one-growth')).toBe('level-1');
    expect(getArenaTaskForOdysseyLevel('level-1')).toBe('task-odyssey-level-one-growth');
    expect(isArenaOdysseyAssignment('task-odyssey-level-one-growth', 'level-1')).toBe(true);
  });

  it('rejects unmapped and mismatched task-level pairs', () => {
    expect(getOdysseyLevelForArenaTask('task-not-an-odyssey-assignment')).toBeUndefined();
    expect(getArenaTaskForOdysseyLevel('level-999')).toBeUndefined();
    expect(isArenaOdysseyAssignment('task-odyssey-level-one-growth', 'level-999')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { resolveClassAttribution } from '../class-attribution';

describe('resolveClassAttribution', () => {
  it('keeps an explicit session class binding as authoritative', () => {
    expect(resolveClassAttribution({
      sessionClassId: 'class-explicit',
    })).toMatchObject({
      classId: 'class-explicit',
      mode: 'explicit',
      confidence: 1,
      studentCount: 0,
      classCounts: {},
    });
  });

  it('keeps a classless session unassigned regardless of participant profiles', () => {
    expect(resolveClassAttribution({
      sessionClassId: null,
    })).toMatchObject({
      classId: null,
      mode: 'unassigned',
      confidence: 0,
      studentCount: 0,
      classCounts: {},
    });
  });

  it('returns unassigned when no session class is recorded', () => {
    expect(resolveClassAttribution({
      sessionClassId: null,
    })).toMatchObject({
      classId: null,
      mode: 'unassigned',
      confidence: 0,
      studentCount: 0,
      classCounts: {},
    });
  });
});

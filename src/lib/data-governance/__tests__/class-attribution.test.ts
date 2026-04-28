import { describe, expect, it } from 'vitest';

import { resolveClassAttribution } from '../class-attribution';

describe('resolveClassAttribution', () => {
  it('keeps an explicit session class binding as authoritative', () => {
    expect(resolveClassAttribution({
      sessionClassId: 'class-explicit',
      participantClassIds: ['class-a', 'class-a', 'class-b'],
    })).toMatchObject({
      classId: 'class-explicit',
      mode: 'explicit',
      confidence: 1,
      studentCount: 3,
      classCounts: { 'class-a': 2, 'class-b': 1 },
    });
  });

  it('infers the dominant student class when a direct-start session has no classId', () => {
    expect(resolveClassAttribution({
      sessionClassId: null,
      participantClassIds: ['class-a', 'class-a', 'class-a', 'class-b', null],
    })).toMatchObject({
      classId: 'class-a',
      mode: 'inferred',
      confidence: 0.75,
      studentCount: 4,
      classCounts: { 'class-a': 3, 'class-b': 1 },
    });
  });

  it('returns mixed when no class reaches the inference threshold', () => {
    expect(resolveClassAttribution({
      sessionClassId: null,
      participantClassIds: ['class-a', 'class-b', 'class-c'],
    })).toMatchObject({
      classId: null,
      mode: 'mixed',
      confidence: 1 / 3,
      studentCount: 3,
    });
  });

  it('returns unassigned when no participant has a class binding', () => {
    expect(resolveClassAttribution({
      sessionClassId: null,
      participantClassIds: [null, undefined, ''],
    })).toMatchObject({
      classId: null,
      mode: 'unassigned',
      confidence: 0,
      studentCount: 0,
      classCounts: {},
    });
  });
});

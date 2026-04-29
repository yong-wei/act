import { describe, expect, it } from 'vitest';

import {
  resolveSessionClassContext,
  shouldPersistInferredClassAttribution,
} from '../class-session-attribution';

describe('class session attribution helpers', () => {
  it('resolves an inferred class context for a direct-start session', () => {
    const result = resolveSessionClassContext({
      sessionClassId: null,
      sessionClass: null,
      participantClassIds: ['class-2024', 'class-2024', 'class-2024', null],
      classesById: new Map([
        ['class-2024', { id: 'class-2024', name: '2024自动化', code: 'AUTO2024' }],
      ]),
    });

    expect(result).toMatchObject({
      classId: 'class-2024',
      class: { id: 'class-2024', name: '2024自动化', code: 'AUTO2024' },
      attribution: {
        classId: 'class-2024',
        mode: 'inferred',
        confidence: 1,
        studentCount: 3,
      },
    });
  });

  it('only persists inferred attribution when confidence and participant count are sufficient', () => {
    expect(
      shouldPersistInferredClassAttribution({
        attribution: {
          classId: 'class-2024',
          mode: 'inferred',
          confidence: 0.97,
          studentCount: 73,
          classCounts: { 'class-2024': 73 },
        },
        minStudentCount: 5,
      })
    ).toBe(true);

    expect(
      shouldPersistInferredClassAttribution({
        attribution: {
          classId: 'class-2023',
          mode: 'inferred',
          confidence: 1,
          studentCount: 1,
          classCounts: { 'class-2023': 1 },
        },
        minStudentCount: 5,
      })
    ).toBe(false);
  });
});

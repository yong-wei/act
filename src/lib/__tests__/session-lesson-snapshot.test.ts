import { describe, expect, it } from 'vitest';

import { resolveRuntimeLessonKeyFromRouteSegment, summarizeRuntimeLessonManifest } from '../session-lesson-snapshot';

describe('session lesson snapshot helpers', () => {
  it('resolves unit route segments to runtime lesson keys', () => {
    expect(resolveRuntimeLessonKeyFromRouteSegment('unit-4-3-initial-scheme-practice-first-validation')).toBe('4-3');
  });

  it('resolves cruise comfort as a standard runtime lesson key', () => {
    expect(resolveRuntimeLessonKeyFromRouteSegment('cruise-comfort-boppps')).toBe('cruise-comfort-boppps');
  });

  it('summarizes runtime manifest version, hash and step count', () => {
    const snapshot = summarizeRuntimeLessonManifest(JSON.stringify({
      contract_version: '2.2',
      lesson_id: '4-3',
      steps: {
        'step-01': {},
        'step-02': {},
      },
    }));

    expect(snapshot).toMatchObject({
      lessonVersion: '2.2',
      totalSteps: 2,
    });
    expect(snapshot.manifestHash).toHaveLength(64);
  });
});

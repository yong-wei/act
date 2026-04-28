import { describe, expect, it } from 'vitest';

import { buildCourseEvent } from '../session-framework/build-course-event';

describe('buildCourseEvent', () => {
  it('keeps logical course keys out of resourceId while preserving resourceKey', () => {
    const event = buildCourseEvent({
      eventType: 'lesson_step_view',
      resourceId: 'unit-3-7-steady-error-low-frequency-compensation',
      resourceKey: 'unit-3-7-steady-error-low-frequency-compensation',
      sessionId: 'session-001',
      lessonKey: 'unit-3-7-steady-error-low-frequency-compensation-v1',
      stepId: 'step-01',
      actorRole: 'student',
    });

    expect(event.resourceId).toBeNull();
    expect(event.resourceKey).toBe('unit-3-7-steady-error-low-frequency-compensation');
  });
});

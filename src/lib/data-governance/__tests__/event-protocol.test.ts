import { describe, expect, it } from 'vitest';

import { toLearningEvent } from '../event-protocol';

describe('toLearningEvent', () => {
  it('uses the client event id as the canonical learning event id when available', () => {
    const event = toLearningEvent(
      {
        id: 'client-event-001',
        type: 'submit',
        sessionId: 'session-001',
        payload: { eventType: 'lesson_submit' },
      },
      {
        userId: 'user-001',
        role: 'student',
        pagePath: '/interactive-learning/courses/unit/student/session-001',
        pageType: 'classroom',
      },
    );

    expect(event.eventId).toBe('client-event-001');
    expect(event.payload.clientEventId).toBe('client-event-001');
  });
});

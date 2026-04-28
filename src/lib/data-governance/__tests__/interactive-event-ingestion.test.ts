import { describe, expect, it } from 'vitest';

import { attachAfterSessionEndFlags } from '../interactive-event-ingestion';

describe('attachAfterSessionEndFlags', () => {
  it('marks events sent after a finished session end time', () => {
    const events = attachAfterSessionEndFlags(
      [
        {
          event: {
            type: 'submit',
            timestamp: Date.parse('2026-04-28T02:06:00.000Z'),
            resourceKey: 'unit-3-7',
            sessionId: 'session-001',
            data: { eventType: 'lesson_submit' },
          },
          resourceId: null,
        },
      ],
      new Map([
        ['session-001', {
          status: 'FINISHED',
          endTime: new Date('2026-04-28T02:05:00.000Z'),
        }],
      ]),
    );

    expect(events[0].event.data).toMatchObject({
      eventType: 'lesson_submit',
      afterSessionEnd: true,
    });
  });

  it('does not mark in-class events before the session end time', () => {
    const events = attachAfterSessionEndFlags(
      [
        {
          event: {
            type: 'submit',
            timestamp: Date.parse('2026-04-28T02:04:59.000Z'),
            resourceKey: 'unit-3-7',
            sessionId: 'session-001',
            data: { eventType: 'lesson_submit' },
          },
          resourceId: null,
        },
      ],
      new Map([
        ['session-001', {
          status: 'FINISHED',
          endTime: new Date('2026-04-28T02:05:00.000Z'),
        }],
      ]),
    );

    expect(events[0].event.data).not.toHaveProperty('afterSessionEnd');
  });
});

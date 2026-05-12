import { describe, expect, it } from 'vitest';

import {
  attachAfterSessionEndFlags,
  attachSourceLogIds,
  normalizeInteractionContexts,
} from '../interactive-event-ingestion';

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

describe('attachSourceLogIds', () => {
  it('adds the persisted interaction log id to the matching learning-event payload', () => {
    const events = attachSourceLogIds(
      [
        {
          resourceId: null,
          event: {
            id: 'client-event-001',
            type: 'submit',
            timestamp: Date.parse('2026-04-29T02:31:00.000Z'),
            resourceKey: 'unit-3-8',
            sessionId: 'session-001',
            data: { eventType: 'lesson_submit' },
          },
        },
      ],
      [
        {
          id: 'interaction-log-001',
          clientEventId: 'client-event-001',
        },
      ],
    );

    expect(events[0].event.data).toMatchObject({
      eventType: 'lesson_submit',
      sourceLogId: 'interaction-log-001',
    });
  });

  it('matches source logs by payload clientEventId when the top-level event id is absent', () => {
    const events = attachSourceLogIds(
      [
        {
          resourceId: null,
          event: {
            type: 'submit',
            timestamp: Date.parse('2026-05-12T02:31:00.000Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: {
              eventType: 'lesson_submit',
              clientEventId: 'client-event-from-payload',
            },
          },
        },
      ],
      [
        {
          id: 'interaction-log-from-payload',
          clientEventId: 'client-event-from-payload',
        },
      ],
    );

    expect(events[0].event.data).toMatchObject({
      eventType: 'lesson_submit',
      clientEventId: 'client-event-from-payload',
      sourceLogId: 'interaction-log-from-payload',
    });
  });

  it('removes untrusted client sourceLogId when no persisted log matches', () => {
    const events = attachSourceLogIds(
      [
        {
          resourceId: null,
          event: {
            type: 'submit',
            timestamp: Date.parse('2026-05-12T02:31:00.000Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: {
              eventType: 'lesson_submit',
              clientEventId: 'client-event-missing-log',
              sourceLogId: 'forged-log-id',
            },
          },
        },
      ],
      [],
    );

    expect(events[0].event.data).toMatchObject({
      eventType: 'lesson_submit',
      clientEventId: 'client-event-missing-log',
    });
    expect(events[0].event.data).not.toHaveProperty('sourceLogId');
  });
});

describe('normalizeInteractionContexts', () => {
  it('marks live classroom events with a valid active session', () => {
    const events = normalizeInteractionContexts(
      [
        {
          event: {
            id: 'client-event-live',
            type: 'view',
            timestamp: Date.parse('2026-05-07T02:30:00.000Z'),
            resourceKey: 'unit-4-2',
            sessionId: 'cmouv40fy009hd2apimc3xxlp',
            data: { originPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/cmouv40fy009hd2apimc3xxlp' },
          },
          resourceId: null,
        },
      ],
      new Map([
        ['cmouv40fy009hd2apimc3xxlp', {
          status: 'ACTIVE',
          endTime: null,
        }],
      ]),
    );

    expect(events[0]).toMatchObject({
      clientEventId: 'client-event-live',
      learningContext: 'classroom_live',
      invalidContextReason: null,
    });
    expect(events[0].event.sessionId).toBe('cmouv40fy009hd2apimc3xxlp');
    expect(events[0].event.data).toMatchObject({
      clientEventId: 'client-event-live',
      learningContext: 'classroom_live',
    });
  });

  it('drops malformed session ids from persistence context', () => {
    const events = normalizeInteractionContexts(
      [
        {
          event: {
            id: 'client-event-bad-session',
            type: 'view',
            timestamp: Date.parse('2026-05-07T04:30:00.000Z'),
            resourceKey: 'unit-4-2',
            sessionId: 'cmouv40fy009hd2apimc3xxlp.',
            data: {},
          },
          resourceId: null,
        },
      ],
      new Map(),
    );

    expect(events[0]).toMatchObject({
      learningContext: 'standalone_resource',
      invalidContextReason: 'invalid_session_id_format',
    });
    expect(events[0].event.sessionId).toBeNull();
    expect(events[0].event.data).toMatchObject({
      invalidContextReason: 'invalid_session_id_format',
      learningContext: 'standalone_resource',
    });
  });

  it('classifies events sent after a finished session as classroom review', () => {
    const events = normalizeInteractionContexts(
      [
        {
          event: {
            id: 'client-event-review',
            type: 'submit',
            timestamp: Date.parse('2026-05-09T02:30:00.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: { eventType: 'lesson_submit' },
          },
          resourceId: null,
        },
      ],
      new Map([
        ['cmoxloe52000uq5bcojma7r78', {
          status: 'FINISHED',
          endTime: new Date('2026-05-09T02:04:23.000Z'),
        }],
      ]),
    );

    expect(events[0]).toMatchObject({
      learningContext: 'classroom_review',
      invalidContextReason: null,
    });
    expect(events[0].event.data).toMatchObject({
      afterSessionEnd: true,
      learningContext: 'classroom_review',
    });
  });
});

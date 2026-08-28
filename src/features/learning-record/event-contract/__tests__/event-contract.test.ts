import { describe, expect, it } from 'vitest';

import { ALL_EVENTS } from '@/lib/data-governance/event-types';
import {
  acceptLearningRecordEvent,
  adaptLegacyLearningEvent,
  assertEventDictionaryIsRegistryProjection,
  authorizeRawArtifact,
  authorizeReplay,
  canDeleteTransport,
  collectForbiddenFields,
  createMemoryAcceptanceStore,
  isRetentionExpired,
  listRegistryEntries,
  projectForConsumer,
  replayEnvelope,
  resolveRegistryEntryByAction,
  sha256Canonical,
  stableEventOrder,
} from '@/features/learning-record/event-contract';
import { LearningRecordContractError } from '@/features/learning-record/event-contract/errors';
import { containsForbiddenExportField } from '@/features/learning-record/event-contract/export-policy';
import type { TrustedServerContext } from '@/features/learning-record/event-contract/types';

function context(overrides: Partial<TrustedServerContext> = {}): TrustedServerContext {
  return {
    subjectId: 'student-1',
    role: 'student',
    producerAuthority: 'assessment-producer',
    receivedAt: new Date('2026-08-28T00:00:00.000Z'),
    sessionId: 'session-1',
    courseId: 'course-1',
    captureRevision: 'rev-1',
    revision: 'rev-1',
    ...overrides,
  };
}

describe('learning record event contract', () => {
  it('resolves every event-types action to one registry discriminator', () => {
    for (const event of ALL_EVENTS) {
      expect(resolveRegistryEntryByAction(event.eventType)?.discriminator).toBe(`learning-record.${event.eventType}`);
    }
    expect(listRegistryEntries()).toHaveLength(ALL_EVENTS.length);
  });

  it('treats the EventDictionary as a checked registry projection', () => {
    expect(assertEventDictionaryIsRegistryProjection(ALL_EVENTS)).toEqual({ ok: true });
    expect(assertEventDictionaryIsRegistryProjection([{ eventType: 'not-registered' }])).toMatchObject({ ok: false });
  });

  it('accepts a registered lesson_submit and is idempotent under concurrent replay', async () => {
    const store = createMemoryAcceptanceStore();
    const hint = {
      action: 'lesson_submit',
      eventId: 'evt-1',
      payload: { eventType: 'lesson_submit', learningContext: 'classroom_live', stepId: 'step-1' },
    };
    const [first, second] = await Promise.all([
      acceptLearningRecordEvent(store, context(), hint),
      acceptLearningRecordEvent(store, context(), hint),
    ]);
    expect(first.envelope.inputDigest).toBe(second.envelope.inputDigest);
    expect([first.duplicate, second.duplicate].filter(Boolean).length).toBe(1);
  });

  it('fails closed on dedupe collision', async () => {
    const store = createMemoryAcceptanceStore();
    await acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      dedupeKey: 'dup-1',
      payload: { stepId: 'step-1' },
    });
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-2',
      dedupeKey: 'dup-1',
      payload: { stepId: 'step-2' },
    })).rejects.toMatchObject({ code: 'dedupe-collision' });
  });

  it('does not let client identity or scope override server values', async () => {
    const store = createMemoryAcceptanceStore();
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      subjectId: 'other-student',
    })).rejects.toMatchObject({ code: 'scope-conflict' });
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      sessionId: 'session-other',
    })).rejects.toMatchObject({ code: 'scope-conflict' });
  });

  it('rejects unknown discriminator, unsupported version and authority mismatch', async () => {
    const store = createMemoryAcceptanceStore();
    await expect(acceptLearningRecordEvent(store, context(), {
      discriminator: 'learning-record.not-real',
      eventId: 'evt-1',
    })).rejects.toMatchObject({ code: 'unknown-discriminator' });
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      schemaVersion: '99',
      eventId: 'evt-1',
    })).rejects.toMatchObject({ code: 'unsupported-schema-version' });
    await expect(acceptLearningRecordEvent(store, context({ producerAuthority: 'arena-producer' }), {
      action: 'lesson_submit',
      eventId: 'evt-1',
    })).rejects.toMatchObject({ code: 'authority-conflict' });
  });

  it('rejects forbidden payload fields and cross-revision input', async () => {
    const store = createMemoryAcceptanceStore();
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      payload: { answer: '42' },
    })).rejects.toMatchObject({ code: 'forbidden-field' });
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      captureRevision: 'other',
    })).rejects.toMatchObject({ code: 'cross-revision' });
  });

  it('keeps reportedClientAt untrusted and rejects extreme clock skew', async () => {
    const store = createMemoryAcceptanceStore();
    const accepted = await acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      reportedClientAt: '2026-08-28T00:00:30.000Z',
      payload: { stepId: 'step-1' },
    });
    expect(accepted.envelope.trustedOccurredAt).toBe('2026-08-28T00:00:00.000Z');
    expect(accepted.envelope.reportedClientAt).toBe('2026-08-28T00:00:30.000Z');
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-2',
      reportedClientAt: '2020-01-01T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'clock-skew' });
  });

  it('orders delayed events by trusted time and source identity', () => {
    const late = {
      trustedOccurredAt: '2026-08-28T00:00:01.000Z',
      anchors: { sourceEventId: 'a' },
      dedupeKey: '2',
    };
    const early = {
      trustedOccurredAt: '2026-08-28T00:00:00.000Z',
      anchors: { sourceEventId: 'b' },
      dedupeKey: '1',
    };
    expect(stableEventOrder([late, early]).map((item) => item.anchors.sourceEventId)).toEqual(['b', 'a']);
  });

  it('keeps replay timestamps and anchors unchanged', async () => {
    const store = createMemoryAcceptanceStore();
    const accepted = await acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      payload: { stepId: 'step-1' },
    });
    const replayed = replayEnvelope(accepted.envelope);
    expect(replayed.trustedOccurredAt).toBe(accepted.envelope.trustedOccurredAt);
    expect(replayed.receivedAt).toBe(accepted.envelope.receivedAt);
    expect(replayed.anchors).toEqual(accepted.envelope.anchors);
    expect(replayed.inputDigest).toBe(accepted.envelope.inputDigest);
  });

  it('adapts a trustworthy legacy event and rejects unsafe identity inference', async () => {
    const store = createMemoryAcceptanceStore();
    const adapted = await adaptLegacyLearningEvent(store, context({ producerAuthority: 'interactive-producer' }), {
      eventId: 'legacy-1',
      actionType: 'page_view',
      userId: 'student-1',
      sessionId: 'session-1',
      payload: { pageType: 'classroom' },
    });
    expect(adapted.envelope.action).toBe('page_view');
    await expect(adaptLegacyLearningEvent(store, context({ producerAuthority: 'interactive-producer' }), {
      eventId: 'legacy-2',
      actionType: 'page_view',
      userId: 'other',
      payload: {},
    })).rejects.toMatchObject({ code: 'legacy-unsafe' });
  });

  it('minimizes public projections and recursively finds forbidden export fields', async () => {
    const store = createMemoryAcceptanceStore();
    const accepted = await acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      eventId: 'evt-1',
      payload: { eventType: 'lesson_submit', stepId: 'step-1', learningContext: 'classroom_live' },
    });
    expect(projectForConsumer(accepted.envelope.payload, 'public')).toEqual({
      eventType: 'lesson_submit',
      learningContext: 'classroom_live',
    });
    expect(projectForConsumer(accepted.envelope.payload, 'restricted')).toEqual({});
    expect(containsForbiddenExportField({ nested: { prompt: 'x' } })).toContain('prompt');
    expect(collectForbiddenFields({ data: { rawAnswer: 'x' } })).toEqual(['data.rawAnswer']);
  });

  it('keeps retention, terminalization, replay and raw-artifact gates fail-closed', () => {
    expect(isRetentionExpired('transport-replay', 8 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(canDeleteTransport({ terminalReceipt: false, terminalizationInProgress: false })).toBe(false);
    expect(canDeleteTransport({ terminalReceipt: true, terminalizationInProgress: true })).toBe(false);
    expect(() => authorizeReplay({
      scope: 'session-1',
      purpose: 'debug',
      ticket: 't-1',
      elevatedUntil: new Date('2026-08-29T00:00:00.000Z'),
      dualControl: false,
      role: 'operator',
    })).toThrow(LearningRecordContractError);
    expect(() => authorizeRawArtifact({ approved: true, role: 'queue' })).toThrow(LearningRecordContractError);
  });

  it('produces the same digest for the same trusted set regardless of object key order', () => {
    expect(sha256Canonical({ b: 1, a: 2 })).toBe(sha256Canonical({ a: 2, b: 1 }));
  });

  it('keeps mixed-schema and unknown digest/ref fail closed without restoring raw JSON', async () => {
    const store = createMemoryAcceptanceStore();
    await expect(acceptLearningRecordEvent(store, context(), {
      action: 'lesson_submit',
      schemaVersion: 'unknown',
      eventId: 'evt-mix',
      payload: { nested: { exception: 'boom' } },
    })).rejects.toMatchObject({ code: 'unsupported-schema-version' });
    expect(canDeleteTransport({ terminalReceipt: true, terminalizationInProgress: false })).toBe(true);
    expect(isRetentionExpired('restricted-raw', 8 * 24 * 60 * 60 * 1000)).toBe(true);
  });
});

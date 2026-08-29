import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const persist = vi.hoisted(() => ({
  persistCoreLearningFact: vi.fn(),
}));

vi.mock('@/lib/data-governance/learning-fact-materialization', () => ({
  persistCoreLearningFact: persist.persistCoreLearningFact,
}));

import { LearningRecordDoubleWriteError } from '@/features/learning-record/personalization-ports/types';
import {
  LEARNING_RECORD_DECODER_VERSION,
  LEARNING_RECORD_MATERIALIZER_VERSION,
  LEARNING_RECORD_SCHEMA_VERSION,
} from '@/features/learning-record/event-contract/types';
import {
  applyStagedLearningFactIngestions,
  applyStagedProjectionTriggers,
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  computeDigests,
  evaluateSourceTimes,
  INGESTION_STATUS,
  ingestLearningFact,
  inspectIngestionBoundary,
  LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
  orderEnvelopes,
  rejectDirectAndOutboxDoubleWrite,
  stageLearningFactIngestion,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
} from '../public-api';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import type { LearningRecordEnvelope } from '@/features/learning-record/event-contract';

function event(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'evt-1',
    occurredAt: '2026-08-29T00:00:00.000Z',
    userId: 'student-1',
    role: 'student',
    pagePath: '/lesson',
    pageType: 'practice',
    actionType: 'lesson_submit',
    payload: { stepId: 'step-01', normalizedResult: 'correct' },
    source: 'web',
    priority: 'core',
    ...overrides,
  };
}

function envelope(overrides: Partial<LearningRecordEnvelope> = {}): LearningRecordEnvelope {
  return {
    eventId: 'evt-1',
    discriminator: 'learning-record.lesson_submit',
    schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
    sourceVersion: '1',
    action: 'lesson_submit',
    owner: 'interactive',
    authority: 'interactive-producer',
    privacyClassification: 'student-private',
    trustedOccurredAt: '2026-08-29T00:00:00.000Z',
    receivedAt: '2026-08-29T00:00:00.000Z',
    subjectRef: 'sub',
    causationId: 'evt-1',
    dedupeKey: 'd',
    payload: { stepId: 'step-01', normalizedResult: 'correct' },
    anchors: {
      sourceEventId: 'evt-1',
      revision: 'rev-1',
      captureRevision: 'rev-1',
      schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
      decoderVersion: LEARNING_RECORD_DECODER_VERSION,
      materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
    },
    inputDigest: 'a'.repeat(64),
    trustedSetDigest: 'b'.repeat(64),
    ...overrides,
  };
}

function memoryOutbox() {
  const rows = new Map<string, {
    id: string;
    status: string;
    eventType: string;
    payload: Record<string, unknown>;
    dedupeKey: string;
    ownerUserId: string;
    causationId: string;
    availableAt: Date;
  }>();
  return {
    rows,
    evidenceOutbox: {
      upsert: async (args: {
        where: { dedupeKey: string };
        create: Record<string, unknown>;
        update?: Record<string, unknown>;
      }) => {
        const existing = rows.get(args.where.dedupeKey);
        const next = existing
          ? { ...existing, ...args.update, payload: (args.update?.payload as Record<string, unknown>) ?? existing.payload }
          : {
              id: `row-${rows.size + 1}`,
              status: String(args.create.status),
              eventType: String(args.create.eventType),
              payload: args.create.payload as Record<string, unknown>,
              dedupeKey: args.where.dedupeKey,
              ownerUserId: String(args.create.ownerUserId),
              causationId: String(args.create.causationId),
              availableAt: new Date(0),
            };
        rows.set(args.where.dedupeKey, next);
        return next;
      },
      findFirst: async (args: { where: { dedupeKey: string } }) => rows.get(args.where.dedupeKey) ?? null,
      findMany: async (args?: { where?: { eventType?: string; status?: string } }) => (
        [...rows.values()].filter((row) => (
          (!args?.where?.status || row.status === args.where.status)
          && (!args?.where?.eventType || row.eventType === args.where.eventType)
        ))
      ),
      updateMany: async (args: { where: { id: string; status: string }; data: { availableAt: Date } }) => {
        const match = [...rows.values()].find((row) => row.id === args.where.id && row.status === args.where.status);
        if (!match) return { count: 0 };
        match.availableAt = args.data.availableAt;
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: { status: string } }) => {
        const match = [...rows.values()].find((row) => row.id === args.where.id);
        if (match) match.status = args.data.status;
        return match;
      },
    },
    learningFact: { createMany: async () => ({ count: 0 }) },
  };
}

describe('canonical LearningFact ingestion', () => {
  beforeEach(() => {
    persist.persistCoreLearningFact.mockReset();
  });

  it('rejects a producer that writes a fact and stages the source outbox', () => {
    expect(() => rejectDirectAndOutboxDoubleWrite({
      writesLearningFact: true,
      stagesOutbox: true,
    })).toThrow(LearningRecordDoubleWriteError);
  });

  it('applies a new fact and records one durable projection trigger', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    const result = await ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.applied);
    expect(result.profileRefreshed).toBe(false);
    expect(result.trigger?.subjectUserId).toBe('student-1');
    expect(result.factsCreated).toBe(1);
    expect([...db.rows.values()][0]?.eventType).toBe(LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE);
    expect([...db.rows.values()][0]?.status).toBe('pending');
  });

  it('does not emit a trigger when the write is a duplicate or skip', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 0, skipped: true, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    const result = await ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.deduplicated);
    expect(result.trigger).toBeNull();
    expect(db.rows.size).toBe(0);
  });

  it('fails closed on envelope payloads with forbidden fields', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const result = await ingestLearningFact({
      db: { learningFact: { createMany: async () => ({ count: 0 }) } },
      transport: 'direct',
      event: event(),
      envelope: envelope({ payload: { answer: 'B' } }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.terminalFailed);
    expect(result.failure?.code).toBe('forbidden-field');
    expect(persist.persistCoreLearningFact).not.toHaveBeenCalled();
  });

  it('keeps input digests stable across delivery permutations', () => {
    const left = computeDigests({
      db: { learningFact: { createMany: async () => ({ count: 0 }) } },
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
    const right = computeDigests({
      db: { learningFact: { createMany: async () => ({ count: 0 }) } },
      transport: 'outbox-apply',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
    expect(left.inputDigest).toBe(right.inputDigest);
  });

  it('records a conflict when a dedupe identity is reused with a different digest', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    await db.evidenceOutbox.upsert({
      where: { dedupeKey: 'learning-fact-ingestion:evt-1:rev-1' },
      create: {
        eventType: 'learning-fact-ingestion',
        status: 'projected',
        payload: { inputDigest: 'other-digest' },
        ownerUserId: 'student-1',
        causationId: 'evt-1',
      },
    });
    const result = await ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
    expect(result.status).toBe(INGESTION_STATUS.terminalFailed);
    expect(result.failure?.code).toBe('dedupe-collision');
  });

  it('fails closed on unmatched cross-revision input', async () => {
    const result = await ingestLearningFact({
      db: { learningFact: { createMany: async () => ({ count: 0 }) } },
      transport: 'direct',
      event: event(),
      envelope: envelope({
        anchors: {
          sourceEventId: 'evt-1',
          revision: 'old',
          captureRevision: 'old',
          schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
          decoderVersion: LEARNING_RECORD_DECODER_VERSION,
          materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
        },
      }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.terminalFailed);
    expect(result.failure?.code).toBe('cross-revision');
  });

  it('stages a cross-process input without writing a fact', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    const staged = await stageLearningFactIngestion({
      db,
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(staged.status).toBe(INGESTION_STATUS.staged);
    expect(persist.persistCoreLearningFact).not.toHaveBeenCalled();
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const applied = await applyStagedLearningFactIngestions(db);
    expect(applied.processed).toBe(1);
    expect(applied.results[0]?.status).toBe(INGESTION_STATUS.applied);
  });

  it('records rematerialization instead of mutating original decoder versions', async () => {
    const result = await ingestLearningFact({
      db: { learningFact: { createMany: async () => ({ count: 0 }) } },
      transport: 'direct',
      event: event(),
      envelope: envelope({
        anchors: {
          sourceEventId: 'evt-1',
          revision: 'rev-1',
          captureRevision: 'rev-1',
          schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
          decoderVersion: '0',
          materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
        },
      }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.failure?.code).toBe('rematerialization-required');
    expect(result.rematerialization?.decoderVersion).toBe(LEARNING_RECORD_DECODER_VERSION);
    expect(persist.persistCoreLearningFact).not.toHaveBeenCalled();
  });

  it('preserves trusted times separately from materialization time', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const result = await ingestLearningFact({
      db: memoryOutbox(),
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
      now: new Date('2026-08-29T01:00:00.000Z'),
    });
    expect(result.times?.trustedOccurredAt).toBe('2026-08-29T00:00:00.000Z');
    expect(result.times?.materializedAt).toBe('2026-08-29T01:00:00.000Z');
  });

  it('wraps outbox-apply in $transaction even when a caller claims it is already in one', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const inner = memoryOutbox();
    const wrap = vi.fn(async (fn: (tx: ReturnType<typeof memoryOutbox>) => Promise<unknown>) => fn(inner));
    await ingestLearningFact({
      db: { ...inner, $transaction: wrap },
      transport: 'outbox-apply',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(wrap).toHaveBeenCalledTimes(1);
    expect([...inner.rows.values()][0]?.eventType).toBe(LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE);
  });

  it('rolls back a fact write when the projection trigger cannot be recorded', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const inner = memoryOutbox();
    inner.evidenceOutbox.upsert = async () => {
      throw new Error('trigger-failed');
    };
    const db = {
      ...inner,
      $transaction: async (fn: (tx: typeof inner) => Promise<unknown>) => {
        try {
          return await fn(inner);
        } catch (error) {
          inner.rows.clear();
          throw error;
        }
      },
    };
    await expect(ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    })).rejects.toThrow('trigger-failed');
    expect(inner.rows.size).toBe(0);
  });

  it('drains a durable projection trigger through the shared consumer', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    await ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    const scheduled: Array<{ ownerUserId: string; triggerKey: string }> = [];
    const drained = await applyStagedProjectionTriggers(db, async (input) => {
      scheduled.push(input);
    });
    expect(drained).toEqual({ processed: 1, failed: 0 });
    expect(scheduled).toEqual([{
      ownerUserId: 'student-1',
      triggerKey: [...db.rows.values()][0]?.dedupeKey,
    }]);
    expect([...db.rows.values()][0]?.status).toBe('projected');
  });

  it('leaves a projection trigger pending when the coordinator apply fails', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const db = memoryOutbox();
    await ingestLearningFact({
      db,
      transport: 'direct',
      event: event(),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    const drained = await applyStagedProjectionTriggers(db, async () => {
      throw new Error('snapshot-enqueue-failed');
    });
    expect(drained).toEqual({ processed: 0, failed: 1 });
    expect([...db.rows.values()][0]?.status).toBe('pending');
  });
});

describe('ingestion privacy, retention and replay', () => {
  it('rejects exception echo and user identifiers at the sanitizer boundary', () => {
    expect(inspectIngestionBoundary({ stack: 'Error: boom at /Users/YW/app.ts' }).length).toBeGreaterThan(0);
    expect(inspectIngestionBoundary({ userId: 'student-1' }).length).toBeGreaterThan(0);
  });

  it('refuses raw artifact and consumer replay without dual control', () => {
    expect(() => authorizeRawArtifact({ approved: false, role: 'queue' })).toThrow();
    expect(() => authorizeReplay({
      scope: 'fact',
      purpose: 'debug',
      ticket: 'T-1',
      elevatedUntil: new Date(Date.now() + 60_000),
      dualControl: false,
      role: 'operator',
    })).toThrow();
    expect(() => authorizeReplay({
      scope: 'fact',
      purpose: 'debug',
      ticket: 'T-1',
      elevatedUntil: new Date(Date.now() + 60_000),
      dualControl: true,
      role: 'queue',
    })).toThrow();
  });

  it('does not delete transport before a terminal receipt and verifies unreadability', () => {
    expect(() => assertTerminalBeforeDelete({
      terminalReceipt: false,
      terminalizationInProgress: false,
    })).toThrow('retention-not-terminal');
    expect(verifyDeletionUnreadability({
      object: false,
      index: false,
      cache: false,
      replica: false,
    })).toBe(true);
    expect(successfulPayloadExpired(25 * 60 * 60 * 1000)).toBe(true);
  });

  it('orders envelopes by trusted occurrence rather than arrival', () => {
    const ordered = orderEnvelopes([
      envelope({ trustedOccurredAt: '2026-08-29T02:00:00.000Z', anchors: {
        sourceEventId: 'b',
        revision: 'rev-1',
        captureRevision: 'rev-1',
        schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
        decoderVersion: LEARNING_RECORD_DECODER_VERSION,
        materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
      }, dedupeKey: 'b' }),
      envelope({ trustedOccurredAt: '2026-08-29T01:00:00.000Z', anchors: {
        sourceEventId: 'a',
        revision: 'rev-1',
        captureRevision: 'rev-1',
        schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
        decoderVersion: LEARNING_RECORD_DECODER_VERSION,
        materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
      }, dedupeKey: 'a' }),
    ]);
    expect(ordered[0]?.anchors.sourceEventId).toBe('a');
  });

  it('rejects client time outside the declared clock-skew window', () => {
    const decision = evaluateSourceTimes({
      trustClass: 'web-untrusted-client-time',
      receivedAt: new Date('2026-08-29T00:00:00.000Z'),
      reportedClientAt: new Date('2026-08-29T01:00:00.000Z'),
      trustedOccurredAt: new Date('2026-08-29T00:00:00.000Z'),
    });
    expect(decision.rejected).toBe('clock-skew');
  });
});

describe('ingestion producer characterization', () => {
  it('uses canonical ingest on the interactive vertical and claim/lease in Redis', () => {
    const interactive = readFileSync('src/app/api/interactive/events/route.ts', 'utf8');
    const buffer = readFileSync('src/lib/data-governance/event-buffer.ts', 'utf8');
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    expect(interactive).toContain('ingestLearningFact');
    expect(interactive).not.toContain('persistCoreLearningFact');
    expect(buffer).not.toContain('client.rpop(key)');
    expect(buffer).toContain('rpoplpush');
    expect(worker).toContain('claimSecondaryEvents');
    expect(worker).toContain('ackSecondaryEvents');
    expect(worker).toContain('ingestLearningFact');
  });
});

describe('control-correction course adapter ingestion', () => {
  beforeEach(() => {
    persist.persistCoreLearningFact.mockReset();
  });
  it('does not infer a course mapping from payload courseId without an explicit goal', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const result = await ingestLearningFact({
      db: memoryOutbox(),
      transport: 'direct',
      event: event({ payload: { stepId: 'step-01', courseId: '3-6' } }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.applied);
    expect(result.adapter).toEqual({ status: 'not-applicable' });
    expect(persist.persistCoreLearningFact).toHaveBeenCalled();
  });

  it('maps an explicit control-correction goal with canonical identity', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const result = await ingestLearningFact({
      db: memoryOutbox(),
      transport: 'direct',
      event: event({
        payload: {
          stepId: 'step-01',
          goalId: 'control-correction',
          canonicalLessonId: 'unit-3-6-zero-design-workshop',
        },
      }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.applied);
    expect(result.adapter?.status).toBe('mapped');
    expect(result.adapter?.adapterVersion).toBe('control-correction-learning-record-adapter.v1');
  });

  it('fails closed when an explicit goal is present without canonical identity', async () => {
    persist.persistCoreLearningFact.mockResolvedValue({ created: 1, skipped: false, actionType: 'lesson_submit' });
    const result = await ingestLearningFact({
      db: memoryOutbox(),
      transport: 'direct',
      event: event({
        payload: { stepId: 'step-01', goalId: 'control-correction' },
      }),
      actorUserId: 'student-1',
      captureRevision: 'rev-1',
    });
    expect(result.status).toBe(INGESTION_STATUS.terminalFailed);
    expect(result.adapter?.status).toBe('rejected');
    expect(result.failure?.code).toBe('missing-canonical-identity');
    expect(persist.persistCoreLearningFact).not.toHaveBeenCalled();
  });
});

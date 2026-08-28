import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_OUTBOX_STATE,
  LearningRecordDoubleWriteError,
  applyStagedMicroInterventionEvidence,
  assertPrivacySafeOutboxProjection,
  learningRecordFactWriteGuard,
  stageMicroInterventionEvidenceOutbox,
} from '../public-api';

describe('Learning Record personalization outbox port', () => {
  it('maps staged/applied/deduplicated onto durable EvidenceOutbox statuses', () => {
    expect(EVIDENCE_OUTBOX_STATE.staged).toBe('pending');
    expect(EVIDENCE_OUTBOX_STATE.applied).toBe('projected');
    expect(EVIDENCE_OUTBOX_STATE.deduplicated).toBe('superseded');
  });

  it('rejects a producer path that both writes LearningFact and stages outbox', () => {
    expect(() => learningRecordFactWriteGuard.rejectDirectAndOutboxDoubleWrite({
      writesLearningFact: true,
      stagesOutbox: true,
    })).toThrow(LearningRecordDoubleWriteError);
  });

  it('rejects raw answer, prompt, and identifier fields in outbox projections', () => {
    expect(() => assertPrivacySafeOutboxProjection({ answer: 'B', prompt: 'raw' })).toThrow(/privacy-unsafe/);
    expect(() => assertPrivacySafeOutboxProjection({
      kind: 'projection-task',
      interventionId: 'intervention-1',
      sourceWatermark: 'abc',
    })).not.toThrow();
  });

  it('stages one pending row and worker replay materializes at most one fact', async () => {
    const rows = new Map<string, {
      status: string;
      payload: Record<string, unknown>;
      correlationId: string;
      causationId: string;
      ownerUserId: string;
      dedupeKey: string;
    }>();
    const facts = new Map<string, { sourceEventId: string }>();
    const db = {
      evidenceOutbox: {
        upsert: async (args: {
          where: { dedupeKey: string };
          create: {
            status: string;
            payload: Record<string, unknown>;
            correlationId: string;
            causationId: string;
            ownerUserId: string;
            dedupeKey: string;
          };
          update: { status?: string; payload?: Record<string, unknown>; causationId?: string };
        }) => {
          const existing = rows.get(args.where.dedupeKey);
          const next = existing
            ? { ...existing, ...args.update, payload: args.update.payload ?? existing.payload }
            : args.create;
          rows.set(args.where.dedupeKey, next);
          return { id: args.where.dedupeKey, ...next };
        },
        findMany: async (args: { where: { eventType: string; status?: string; correlationId?: string } }) => (
          [...rows.values()]
            .filter((row) => (!args.where.status || row.status === args.where.status)
              && (!args.where.correlationId || row.correlationId === args.where.correlationId))
            .map((row) => ({ id: row.dedupeKey, ...row }))
        ),
        update: async (args: { where: { dedupeKey?: string }; data: { status?: string; payload?: unknown; processedAt?: Date } }) => {
          const key = args.where.dedupeKey;
          if (!key) return null;
          const current = rows.get(key);
          if (!current) return null;
          const next = { ...current, ...args.data, payload: (args.data.payload as Record<string, unknown> | undefined) ?? current.payload };
          rows.set(key, next);
          return next;
        },
      },
      microInterventionOutcome: {
        findFirst: async () => null,
      },
      learningFact: {
        createMany: async ({ data }: { data: Array<{ sourceEventId?: string | null }> }) => {
          let count = 0;
          for (const row of data) {
            const id = row.sourceEventId ?? `anon-${facts.size}`;
            if (facts.has(id)) continue;
            facts.set(id, { sourceEventId: id });
            count += 1;
          }
          return { count };
        },
      },
    };

    await stageMicroInterventionEvidenceOutbox({
      db: db as never,
      interventionId: 'intervention-1',
      ownerUserId: 'student-1',
    });
    await stageMicroInterventionEvidenceOutbox({
      db: db as never,
      interventionId: 'intervention-1',
      ownerUserId: 'student-1',
    });
    expect(rows.size).toBe(1);
    expect([...rows.values()][0]?.status).toBe(EVIDENCE_OUTBOX_STATE.staged);

    const first = await applyStagedMicroInterventionEvidence(db as never, { interventionId: 'intervention-1' });
    const second = await applyStagedMicroInterventionEvidence(db as never, { interventionId: 'intervention-1' });
    expect(first.processed).toBe(1);
    expect(second.processed).toBe(0);
    expect([...rows.values()][0]?.status).toBe(EVIDENCE_OUTBOX_STATE.applied);
  });
});

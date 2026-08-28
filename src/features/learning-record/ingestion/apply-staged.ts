import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { ingestLearningFact } from './ingest';
import { sanitizeStagingPayload } from './sanitizer';
import {
  INGESTION_STATUS,
  LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE,
  LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
  type IngestLearningFactResult,
  type IngestionWriteDb,
} from './types';

const LEASE_MS = 5 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function eventFromStagedPayload(row: {
  ownerUserId: string;
  causationId: string;
  payload: unknown;
}): LearningEvent {
  const payload = asRecord(row.payload);
  const actionType = typeof payload.actionType === 'string' ? payload.actionType : 'unknown';
  const occurredAt = typeof payload.trustedOccurredAt === 'string'
    ? payload.trustedOccurredAt
    : new Date().toISOString();
  return {
    eventId: typeof payload.eventId === 'string' ? payload.eventId : row.causationId,
    occurredAt,
    userId: row.ownerUserId,
    role: 'student',
    pagePath: '/unknown',
    pageType: typeof payload.pageType === 'string' ? payload.pageType as LearningEvent['pageType'] : 'dashboard',
    actionType,
    payload: sanitizeStagingPayload(payload),
    source: 'system',
    priority: payload.priority === 'core' ? 'core' : 'secondary',
    sessionId: typeof payload.sessionRef === 'string' ? payload.sessionRef : undefined,
  };
}

export async function applyStagedLearningFactIngestions(
  db: IngestionWriteDb,
  options: { limit?: number; now?: Date } = {},
): Promise<{ processed: number; failed: number; results: IngestLearningFactResult[] }> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 50;
  if (typeof db.evidenceOutbox?.findMany !== 'function' || typeof db.evidenceOutbox.updateMany !== 'function') {
    return { processed: 0, failed: 0, results: [] };
  }
  const rows = await db.evidenceOutbox.findMany({
    where: {
      eventType: LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE,
      status: 'pending',
      availableAt: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  const results: IngestLearningFactResult[] = [];
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    const claimed = await db.evidenceOutbox.updateMany!({
      where: { id: row.id, status: 'pending' },
      data: { availableAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count !== 1) continue;
    const payload = asRecord(row.payload);
    const captureRevision = typeof payload.captureRevision === 'string' ? payload.captureRevision : 'working-tree';
    try {
      const result = await ingestLearningFact({
        db,
        transport: 'outbox-apply',
        event: eventFromStagedPayload(row),
        actorUserId: row.ownerUserId,
        captureRevision,
        alreadyInTransaction: true,
        now,
      });
      results.push(result);
      const nextStatus = result.status === INGESTION_STATUS.deduplicated
        ? 'superseded'
        : result.status === INGESTION_STATUS.applied
          ? 'projected'
          : result.status === INGESTION_STATUS.terminalFailed
            ? 'failed'
            : 'pending';
      await db.evidenceOutbox.update?.({
        where: { id: row.id },
        data: {
          status: nextStatus,
          processedAt: nextStatus === 'pending' ? null : now,
        },
      });
      if (nextStatus === 'pending' || result.status === INGESTION_STATUS.retryableFailed) {
        failed += 1;
      } else {
        processed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { processed, failed, results };
}

export async function applyStagedProjectionTriggers(
  db: IngestionWriteDb,
  apply: (input: { ownerUserId: string; triggerKey: string }) => Promise<void>,
  options: { limit?: number; now?: Date } = {},
): Promise<{ processed: number }> {
  if (typeof db.evidenceOutbox?.findMany !== 'function') return { processed: 0 };
  const now = options.now ?? new Date();
  const rows = await db.evidenceOutbox.findMany({
    where: {
      eventType: LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
      status: 'pending',
      availableAt: { lte: now },
    },
    take: options.limit ?? 50,
  });
  let processed = 0;
  for (const row of rows) {
    await apply({ ownerUserId: row.ownerUserId, triggerKey: row.dedupeKey });
    await db.evidenceOutbox.update?.({
      where: { id: row.id },
      data: { status: 'projected', processedAt: now },
    });
    processed += 1;
  }
  return { processed };
}

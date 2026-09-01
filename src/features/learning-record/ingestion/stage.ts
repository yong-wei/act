import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import { LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE, INGESTION_STATUS, ingestionDedupeKey, readExistingInputDigest, rejectDirectAndOutboxDoubleWrite, type IngestionWriteDb, type IngestLearningFactResult } from './types';
import { computeDigests, receivedAtIso, resolveAnchors } from './ingest';
import { assertStagingPayload, sanitizeStagingPayload } from './sanitizer';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import type { LearningRecordEnvelope } from '@/features/learning-record/event-contract';

export async function stageLearningFactIngestion(input: {
  db: IngestionWriteDb;
  event: LearningEvent;
  envelope?: LearningRecordEnvelope;
  actorUserId: string;
  captureRevision: string;
  now?: Date;
}): Promise<IngestLearningFactResult> {
  rejectDirectAndOutboxDoubleWrite({
    writesLearningFact: false,
    stagesOutbox: true,
  });
  const factPayload = sanitizeStagingPayload(input.event.payload);
  const stagedPayload = {
    kind: 'learning-fact-ingestion',
    actionType: input.event.actionType,
    eventId: input.event.eventId,
    sourceEventId: input.event.eventId,
    trustedOccurredAt: input.envelope?.trustedOccurredAt ?? input.event.occurredAt,
    receivedAt: receivedAtIso(input),
    captureRevision: input.captureRevision,
    revision: input.captureRevision,
    subjectRef: opaqueSubjectRef(input.actorUserId),
    sessionRef: input.event.sessionId ?? '',
    pageType: input.event.pageType,
    priority: input.event.priority,
    ...factPayload,
  };
  const violations = assertStagingPayload(stagedPayload);
  const digestInput = {
    db: input.db,
    transport: 'outbox-apply' as const,
    event: input.event,
    envelope: input.envelope,
    actorUserId: input.actorUserId,
    captureRevision: input.captureRevision,
    now: input.now,
  };
  const { inputDigest, trustedSetDigest } = computeDigests(digestInput);
  if (violations.length > 0) {
    return {
      status: INGESTION_STATUS.terminalFailed,
      profileRefreshed: false,
      transport: 'outbox-apply',
      inputDigest,
      trustedSetDigest,
      trigger: null,
      factsCreated: 0,
      failure: { code: 'forbidden-field', fingerprint: violations[0] ?? 'forbidden-field' },
    };
  }
  const anchors = resolveAnchors(digestInput);
  const dedupeKey = ingestionDedupeKey({
    sourceEventId: anchors.sourceEventId,
    captureRevision: input.captureRevision,
  });
  if (typeof input.db.evidenceOutbox?.findFirst === 'function') {
    const existing = await input.db.evidenceOutbox.findFirst({ where: { dedupeKey } });
    if (existing) {
      const existingDigest = readExistingInputDigest(existing.payload);
      if (existingDigest && existingDigest !== inputDigest) {
        return {
          status: INGESTION_STATUS.terminalFailed,
          profileRefreshed: false,
          transport: 'outbox-apply',
          inputDigest,
          trustedSetDigest,
          trigger: null,
          factsCreated: 0,
          failure: { code: 'dedupe-collision', fingerprint: 'dedupe-collision' },
        };
      }
      return {
        status: INGESTION_STATUS.deduplicated,
        profileRefreshed: false,
        transport: 'outbox-apply',
        inputDigest,
        trustedSetDigest,
        trigger: null,
        factsCreated: 0,
      };
    }
  }
  if (typeof input.db.evidenceOutbox?.upsert !== 'function') {
    return {
      status: INGESTION_STATUS.retryableFailed,
      profileRefreshed: false,
      transport: 'outbox-apply',
      inputDigest,
      trustedSetDigest,
      trigger: null,
      factsCreated: 0,
      failure: { code: 'outbox-unavailable', fingerprint: 'outbox-unavailable' },
    };
  }
  await input.db.evidenceOutbox.upsert({
    where: { dedupeKey },
    update: { status: 'pending' },
    create: {
      eventType: LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE,
      correlationId: opaqueSubjectRef(input.actorUserId),
      causationId: anchors.sourceEventId,
      ownerUserId: input.actorUserId,
      dedupeKey,
      status: 'pending',
      payload: {
        ...stagedPayload,
        inputDigest,
        trustedSetDigest,
        kind: 'learning-fact-ingestion',
      },
    },
  });
  return {
    status: INGESTION_STATUS.staged,
    profileRefreshed: false,
    transport: 'outbox-apply',
    inputDigest,
    trustedSetDigest,
    trigger: null,
    factsCreated: 0,
  };
}

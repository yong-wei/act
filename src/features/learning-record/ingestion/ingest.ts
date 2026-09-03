import {
  opaqueSubjectRef,
  projectAllowlistedPayload,
} from '@/features/learning-record/event-contract/allowlist';
import { sha256Canonical } from '@/features/learning-record/event-contract/digest';
import {
  LEARNING_RECORD_DECODER_VERSION,
  LEARNING_RECORD_MATERIALIZER_VERSION,
  LEARNING_RECORD_SCHEMA_VERSION,
} from '@/features/learning-record/event-contract/types';
import { persistCoreLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import { inspectIngestionBoundary, minimizedFailureRecord } from './sanitizer';
import { evaluateSourceTimes } from './source-trust';
import { buildProjectionTrigger, recordProjectionTriggerIntent } from './trigger';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import type { CourseAdapterMapInput } from '@/features/personalization/plugins/learning-record-adapter-types';
import {
  INGESTION_STATUS,
  ingestionDedupeKey,
  readExistingInputDigest,
  type IngestLearningFactInput,
  type IngestLearningFactResult,
  type IngestionAnchors,
  type RebaseReceipt,
  type TrustedTimeSet,
} from './types';

function fingerprint(code: string): string {
  return sha256Canonical({ code }).slice(0, 16);
}

function readPayloadString(
  payload: Record<string, unknown> | undefined,
  envelopePayload: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const fromEnvelope = envelopePayload?.[key];
  const fromPayload = payload?.[key];
  if (typeof fromEnvelope === 'string' && fromEnvelope.trim()) return fromEnvelope.trim();
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload.trim();
  return null;
}

function readPayloadNumber(
  payload: Record<string, unknown> | undefined,
  envelopePayload: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const fromEnvelope = envelopePayload?.[key];
  const fromPayload = payload?.[key];
  if (typeof fromEnvelope === 'number' && Number.isFinite(fromEnvelope)) return fromEnvelope;
  if (typeof fromPayload === 'number' && Number.isFinite(fromPayload)) return fromPayload;
  return null;
}

function adapterHint(input: IngestLearningFactInput): CourseAdapterMapInput {
  const payload = (input.event.payload ?? {}) as Record<string, unknown>;
  const envelopePayload = input.envelope?.payload as Record<string, unknown> | undefined;
  const arenaTaskId = readPayloadString(payload, envelopePayload, 'arenaTaskId');
  return {
    goalId: readPayloadString(payload, envelopePayload, 'goalId'),
    pluginId: readPayloadString(payload, envelopePayload, 'pluginId'),
    pluginVersion: readPayloadString(payload, envelopePayload, 'pluginVersion'),
    adapterVersion: readPayloadString(payload, envelopePayload, 'adapterVersion'),
    schemaVersion: readPayloadString(payload, envelopePayload, 'schemaVersion'),
    releaseRevision: readPayloadString(payload, envelopePayload, 'releaseRevision'),
    captureRevision: input.captureRevision,
    expectedCaptureRevision: readPayloadString(payload, envelopePayload, 'expectedCaptureRevision'),
    canonicalLessonId: readPayloadString(payload, envelopePayload, 'canonicalLessonId'),
    canonicalResourceId: readPayloadString(payload, envelopePayload, 'canonicalResourceId'),
    canonicalActivityId: readPayloadString(payload, envelopePayload, 'canonicalActivityId'),
    arenaReference: arenaTaskId ? { taskId: arenaTaskId } : null,
    sourceEventId: input.event.eventId,
    sourceLogId: readPayloadString(payload, envelopePayload, 'sourceLogId') ?? undefined,
    normalizedValue: readPayloadNumber(payload, envelopePayload, 'normalizedValue')
      ?? readPayloadNumber(payload, envelopePayload, 'normalizedResult'),
    confidence: readPayloadNumber(payload, envelopePayload, 'confidence'),
    trustedOccurredAt: anchorsTrustedOccurredAt(input),
    receivedAt: receivedAtIso(input),
    subjectRef: opaqueSubjectRef(input.actorUserId),
    idempotencyKey: ingestionDedupeKey({
      sourceEventId: input.event.eventId,
      captureRevision: input.captureRevision,
    }),
    materialization: input.transport === 'outbox-apply' ? 'outbox' : 'direct',
    rebaseReceipt: input.rebaseReceipt,
    captureRebaseReceipt: input.captureRebaseReceipt,
    extra: payload,
  };
}

function rebaseAllowsRevision(receipt: RebaseReceipt | undefined, from: string, to: string): boolean {
  return Boolean(receipt && receipt.sourceRevision === from && receipt.targetRevision === to);
}

async function resolveCourseAdapter(
  input: IngestLearningFactInput,
  hint = adapterHint(input),
): Promise<{
  receipt: NonNullable<IngestLearningFactResult['adapter']>;
  persistEvent: LearningEvent;
  rejected?: { code: string };
}> {
  if (!hint.goalId && !hint.pluginId) {
    return { receipt: { status: 'not-applicable' }, persistEvent: input.event };
  }
  const { applyNormalizedCourseMappingToEvent, mapCourseLearningRecordEvidence } = await import(
    '@/features/learning-record/course-adapters/public-api'
  );
  const mapped = mapCourseLearningRecordEvidence(hint);
  if (mapped.status === 'rejected') {
    return {
      receipt: { status: 'rejected', reason: mapped.reason },
      persistEvent: input.event,
      rejected: { code: mapped.reason },
    };
  }
  if (mapped.status === 'mapped') {
    const applied = applyNormalizedCourseMappingToEvent(input.event, mapped.mapping);
    if (applied.status === 'rejected') {
      return {
        receipt: { status: 'rejected', reason: applied.reason },
        persistEvent: input.event,
        rejected: { code: applied.reason },
      };
    }
    return {
      receipt: {
        status: 'mapped',
        adapterVersion: mapped.mapping.adapterVersion,
        captureRevision: mapped.mapping.captureRevision,
      },
      persistEvent: applied.event,
    };
  }
  return { receipt: { status: 'not-applicable' }, persistEvent: input.event };
}

function failed(
  input: IngestLearningFactInput,
  code: string,
  extras: Partial<IngestLearningFactResult> = {},
): IngestLearningFactResult {
  const { inputDigest, trustedSetDigest } = computeDigests(input);
  return {
    status: code === 'retryable' ? INGESTION_STATUS.retryableFailed : INGESTION_STATUS.terminalFailed,
    profileRefreshed: false,
    transport: input.transport,
    inputDigest,
    trustedSetDigest,
    trigger: null,
    factsCreated: 0,
    failure: minimizedFailureRecord({
      stage: extras.failure?.stage ?? 'ingest',
      code: code === 'retryable' ? extras.failure?.code ?? 'retryable' : code,
      fingerprint: fingerprint(code),
    }),
    ...extras,
  };
}

export function computeDigests(input: IngestLearningFactInput): { inputDigest: string; trustedSetDigest: string } {
  if (input.envelope) {
    return {
      inputDigest: input.envelope.inputDigest,
      trustedSetDigest: input.envelope.trustedSetDigest,
    };
  }
  const anchors = resolveAnchors(input);
  const payload = projectAllowlistedPayload(input.event.payload);
  return {
    inputDigest: sha256Canonical({
      anchors,
      payload,
      action: input.event.actionType,
    }),
    trustedSetDigest: sha256Canonical({
      trustedOccurredAt: anchorsTrustedOccurredAt(input),
      receivedAt: receivedAtIso(input),
      subjectRef: opaqueSubjectRef(input.actorUserId),
      sessionRef: input.event.sessionId ?? null,
      sourceEventId: input.event.eventId,
    }),
  };
}

function anchorsTrustedOccurredAt(input: IngestLearningFactInput): string {
  return input.envelope?.trustedOccurredAt ?? input.event.occurredAt;
}

export function resolveAnchors(input: IngestLearningFactInput): IngestionAnchors {
  if (input.envelope) return input.envelope.anchors;
  const payload = input.event.payload ?? {};
  const sourceLogId = typeof payload.sourceLogId === 'string' ? payload.sourceLogId : undefined;
  return {
    sourceEventId: input.event.eventId,
    sourceLogId,
    revision: input.captureRevision,
    captureRevision: input.captureRevision,
    schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
    decoderVersion: LEARNING_RECORD_DECODER_VERSION,
    materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
  };
}

export function receivedAtIso(input: Pick<IngestLearningFactInput, 'envelope' | 'receivedAt' | 'now'>): string {
  return input.envelope?.receivedAt ?? input.receivedAt ?? (input.now ?? new Date()).toISOString();
}

function resolveTimes(input: IngestLearningFactInput, materializedAt?: string): TrustedTimeSet {
  const receivedAt = receivedAtIso(input);
  return {
    trustedOccurredAt: anchorsTrustedOccurredAt(input),
    receivedAt,
    materializedAt,
    reportedClientAt: input.envelope?.reportedClientAt
      ?? (typeof input.event.clientTimestamp === 'number'
        ? new Date(input.event.clientTimestamp).toISOString()
        : undefined),
  };
}

async function ingestInCurrentHandle(
  input: IngestLearningFactInput,
): Promise<IngestLearningFactResult> {
  const now = input.now ?? new Date();
  const anchors = resolveAnchors(input);
  const times = resolveTimes(input);
  const hint = adapterHint(input);
  if (hint.goalId || hint.pluginId) {
    const payloadHits = inspectIngestionBoundary(input.event.payload);
    if (payloadHits.length > 0) {
      return failed(input, 'forbidden-field', { anchors, times });
    }
  }

  const adapterResolution = await resolveCourseAdapter(input, hint);
  if (adapterResolution.rejected) {
    return failed(input, adapterResolution.rejected.code, {
      anchors,
      times,
      adapter: adapterResolution.receipt,
      failure: { code: adapterResolution.rejected.code, fingerprint: fingerprint(adapterResolution.rejected.code), stage: 'adapter' },
    });
  }

  if (input.envelope) {
    const boundaryHits = inspectIngestionBoundary(input.envelope.payload);
    if (boundaryHits.length > 0) {
      return failed(input, 'forbidden-field', { anchors, times });
    }
    const envelopeRevision = input.envelope.anchors.captureRevision;
    if (
      envelopeRevision !== input.captureRevision
      && !rebaseAllowsRevision(input.rebaseReceipt, envelopeRevision, input.captureRevision)
      && !rebaseAllowsRevision(input.captureRebaseReceipt, envelopeRevision, input.captureRevision)
    ) {
      return failed(input, 'cross-revision', { anchors, times });
    }
    const rematerializeDecoder = input.envelope.anchors.decoderVersion !== LEARNING_RECORD_DECODER_VERSION;
    const rematerializeMaterializer = input.envelope.anchors.materializerVersion !== LEARNING_RECORD_MATERIALIZER_VERSION;
    if (rematerializeDecoder || rematerializeMaterializer) {
      return {
        ...failed(input, 'rematerialization-required', { anchors, times }),
        rematerialization: {
          decoderVersion: LEARNING_RECORD_DECODER_VERSION,
          materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
        },
      };
    }
  }

  const reportedClientAt = times.reportedClientAt ? new Date(times.reportedClientAt) : null;
  const trust = evaluateSourceTimes({
    trustClass: input.envelope ? 'web-untrusted-client-time' : 'legacy-compat',
    receivedAt: new Date(times.receivedAt),
    reportedClientAt,
    trustedOccurredAt: new Date(times.trustedOccurredAt),
  });
  if (input.envelope && trust.rejected) {
    return failed(input, trust.rejected, { anchors, times });
  }

  const { inputDigest, trustedSetDigest } = computeDigests(input);
  const dedupeKey = ingestionDedupeKey({
    sourceEventId: anchors.sourceEventId,
    captureRevision: input.captureRevision,
  });
  if (typeof input.db.evidenceOutbox?.findFirst === 'function') {
    const existing = await input.db.evidenceOutbox.findFirst({
      where: { dedupeKey },
    });
    const existingDigest = readExistingInputDigest(existing?.payload);
    const settled = existing?.status === 'projected' || existing?.status === 'superseded';
    if (settled && existingDigest && existingDigest !== inputDigest) {
      return failed(input, 'dedupe-collision', { anchors, times });
    }
    if (settled && existingDigest === inputDigest) {
      return {
        status: INGESTION_STATUS.deduplicated,
        profileRefreshed: false,
        transport: input.transport,
        inputDigest,
        trustedSetDigest,
        trigger: null,
        factsCreated: 0,
        anchors,
        times,
      };
    }
  }

  const persisted = await persistCoreLearningFact(input.db, adapterResolution.persistEvent);
  if (persisted.created === 0) {
    return {
      status: persisted.skipped ? INGESTION_STATUS.deduplicated : INGESTION_STATUS.applied,
      profileRefreshed: false,
      transport: input.transport,
      inputDigest,
      trustedSetDigest,
      trigger: null,
      factsCreated: 0,
      anchors,
      times,
    };
  }

  const trigger = buildProjectionTrigger({
    subjectUserId: input.actorUserId,
    inputDigest,
    captureRevision: input.captureRevision,
    classId: input.classId,
  });
  await recordProjectionTriggerIntent(input.db, trigger);
  if (typeof input.db.evidenceOutbox?.upsert === 'function' && input.transport === 'outbox-apply') {
    await input.db.evidenceOutbox.upsert({
      where: { dedupeKey },
      update: { status: 'projected', processedAt: now },
      create: {
        eventType: 'learning-fact-ingestion',
        correlationId: opaqueSubjectRef(input.actorUserId),
        causationId: anchors.sourceEventId,
        ownerUserId: input.actorUserId,
        dedupeKey,
        status: 'projected',
        payload: {
          kind: 'ingestion-receipt',
          subjectRef: opaqueSubjectRef(input.actorUserId),
          inputDigest,
          captureRevision: input.captureRevision,
        },
      },
    });
  }

  return {
    status: INGESTION_STATUS.applied,
    profileRefreshed: false,
    transport: input.transport,
    inputDigest,
    trustedSetDigest,
    trigger,
    factsCreated: persisted.created,
    anchors,
    times: resolveTimes(input, now.toISOString()),
    adapter: adapterResolution.receipt,
  };
}

export async function ingestLearningFact(
  input: IngestLearningFactInput,
): Promise<IngestLearningFactResult> {
  if (typeof input.db.$transaction === 'function') {
    return input.db.$transaction((tx) => ingestInCurrentHandle({
      ...input,
      db: tx,
    }));
  }
  return ingestInCurrentHandle(input);
}

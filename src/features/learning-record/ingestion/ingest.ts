import {
  collectForbiddenFields,
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
import {
  INGESTION_STATUS,
  ingestionDedupeKey,
  type IngestLearningFactInput,
  type IngestLearningFactResult,
  type IngestionAnchors,
  type TrustedTimeSet,
} from './types';

function fingerprint(code: string): string {
  return sha256Canonical({ code }).slice(0, 16);
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
      receivedAt: (input.now ?? new Date()).toISOString(),
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

function resolveTimes(input: IngestLearningFactInput, materializedAt?: string): TrustedTimeSet {
  const receivedAt = input.envelope?.receivedAt ?? (input.now ?? new Date()).toISOString();
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

  if (input.envelope) {
    const boundaryHits = inspectIngestionBoundary(input.envelope.payload);
    const extraForbidden = collectForbiddenFields(input.envelope.payload);
    if (boundaryHits.length > 0 || extraForbidden.length > 0) {
      return failed(input, 'forbidden-field', { anchors, times });
    }
    if (
      input.envelope.anchors.captureRevision !== input.captureRevision
      && !(
        input.rebaseReceipt
        && input.rebaseReceipt.sourceRevision === input.envelope.anchors.captureRevision
        && input.rebaseReceipt.targetRevision === input.captureRevision
      )
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
    const existingDigest = existing?.payload && typeof existing.payload === 'object'
      ? (existing.payload as { inputDigest?: unknown }).inputDigest
      : undefined;
    const settled = existing?.status === 'projected' || existing?.status === 'superseded';
    if (settled && typeof existingDigest === 'string' && existingDigest !== inputDigest) {
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

  const persisted = await persistCoreLearningFact(input.db, input.event);
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

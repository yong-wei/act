import { LearningRecordContractError } from './errors';
import { collectForbiddenFields, opaqueSubjectRef, projectAllowlistedPayload } from './allowlist';
import { sha256Canonical } from './digest';
import { resolveRegistryEntry, resolveRegistryEntryByAction } from './registry';
import {
  LEARNING_RECORD_DECODER_VERSION,
  LEARNING_RECORD_MATERIALIZER_VERSION,
  LEARNING_RECORD_SCHEMA_VERSION,
  type AcceptedLearningRecord,
  type ClientEventHint,
  type LearningRecordAcceptanceStore,
  type LearningRecordEnvelope,
  type TrustedServerContext,
} from './types';

function asIso(value: Date): string {
  return value.toISOString();
}

function parseClientTime(value: string | number | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function requireMatchingHint(hint: string | undefined, trusted: string | undefined, field: string) {
  if (!hint || !trusted) return;
  if (hint !== trusted) {
    throw new LearningRecordContractError('scope-conflict', `Client ${field} does not match server scope`, {
      field,
    });
  }
}

export async function acceptLearningRecordEvent(
  store: LearningRecordAcceptanceStore,
  context: TrustedServerContext,
  hint: ClientEventHint,
): Promise<AcceptedLearningRecord> {
  const action = hint.action?.trim();
  const discriminator = hint.discriminator?.trim() || (action ? `learning-record.${action}` : '');
  const schemaVersion = hint.schemaVersion?.trim() || LEARNING_RECORD_SCHEMA_VERSION;
  const entry = discriminator
    ? resolveRegistryEntry(discriminator, schemaVersion)
    : action
      ? resolveRegistryEntryByAction(action, schemaVersion)
      : undefined;
  if (!entry) {
    throw new LearningRecordContractError(
      discriminator && schemaVersion !== LEARNING_RECORD_SCHEMA_VERSION
        ? 'unsupported-schema-version'
        : 'unknown-discriminator',
      'Event contract is not registered',
      { discriminator, schemaVersion, action },
    );
  }
  if (context.producerAuthority !== entry.authority) {
    throw new LearningRecordContractError('authority-conflict', 'Producer lacks registry authority', {
      required: entry.authority,
      actual: context.producerAuthority,
    });
  }
  if (hint.subjectId && hint.subjectId !== context.subjectId) {
    throw new LearningRecordContractError('scope-conflict', 'Client subject cannot override server identity');
  }
  if (hint.role && hint.role.toLowerCase() !== context.role) {
    throw new LearningRecordContractError('scope-conflict', 'Client role cannot override server identity');
  }
  requireMatchingHint(hint.tenantId, context.tenantId, 'tenantId');
  requireMatchingHint(hint.courseId, context.courseId, 'courseId');
  requireMatchingHint(hint.sessionId, context.sessionId, 'sessionId');
  requireMatchingHint(hint.classId, context.classId, 'classId');
  if (
    (hint.revision && hint.revision !== context.revision)
    || (hint.captureRevision && hint.captureRevision !== context.captureRevision)
  ) {
    throw new LearningRecordContractError('cross-revision', 'Capture revision does not match the active contract');
  }

  const forbidden = collectForbiddenFields(hint.payload);
  if (forbidden.length > 0) {
    throw new LearningRecordContractError('forbidden-field', 'Payload contains forbidden fields', { forbidden });
  }
  const required = Array.isArray(entry.payloadSchema?.required)
    ? entry.payloadSchema.required.filter((key): key is string => typeof key === 'string')
    : [];
  for (const key of required) {
    if (!hint.payload || hint.payload[key] === undefined) {
      throw new LearningRecordContractError('schema-invalid', `Missing required payload field ${key}`);
    }
  }

  const receivedAt = context.receivedAt;
  const reportedClientAt = parseClientTime(hint.reportedClientAt);
  let clockSkew = false;
  if (reportedClientAt) {
    const delta = Math.abs(reportedClientAt.getTime() - receivedAt.getTime());
    if (delta > entry.clockSkewMs) {
      throw new LearningRecordContractError('clock-skew', 'reportedClientAt exceeds source clock-skew window');
    }
    if (delta > 60_000) clockSkew = true;
  }

  const sourceEventId = hint.sourceEventId?.trim() || hint.eventId?.trim();
  if (!sourceEventId) {
    throw new LearningRecordContractError('schema-invalid', 'sourceEventId is required');
  }
  const causationId = hint.causationId?.trim() || sourceEventId;
  const dedupeKey = hint.dedupeKey?.trim() || `${entry.discriminator}:${context.subjectId}:${sourceEventId}`;
  const payload = projectAllowlistedPayload(hint.payload);
  const trustedOccurredAt = asIso(receivedAt);
  const envelopeBase = {
    discriminator: entry.discriminator,
    schemaVersion: entry.schemaVersion,
    sourceVersion: entry.sourceVersion,
    action: entry.action,
    owner: entry.owner,
    authority: entry.authority,
    privacyClassification: entry.privacyClassification,
    trustedOccurredAt,
    receivedAt: asIso(receivedAt),
    reportedClientAt: reportedClientAt ? asIso(reportedClientAt) : undefined,
    clockSkew,
    subjectRef: opaqueSubjectRef(context.subjectId),
    tenantRef: context.tenantId,
    courseRef: context.courseId,
    sessionRef: context.sessionId,
    causationId,
    dedupeKey,
    payload,
    anchors: {
      sourceEventId,
      sourceLogId: hint.sourceLogId,
      revision: context.revision,
      captureRevision: context.captureRevision,
      schemaVersion: entry.schemaVersion,
      decoderVersion: LEARNING_RECORD_DECODER_VERSION,
      materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
    },
  };
  const inputDigest = sha256Canonical({
    anchors: envelopeBase.anchors,
    payload: envelopeBase.payload,
    action: envelopeBase.action,
  });
  const trustedSetDigest = sha256Canonical({
    trustedOccurredAt,
    receivedAt: envelopeBase.receivedAt,
    subjectRef: envelopeBase.subjectRef,
    sessionRef: envelopeBase.sessionRef,
    sourceEventId,
  });
  const envelope: LearningRecordEnvelope = {
    ...envelopeBase,
    eventId: sourceEventId,
    inputDigest,
    trustedSetDigest,
  };

  const existing = await store.getByDedupeKey(dedupeKey);
  if (existing) {
    if (existing.envelope.inputDigest !== inputDigest || existing.envelope.anchors.sourceEventId !== sourceEventId) {
      throw new LearningRecordContractError('dedupe-collision', 'Dedupe key reused with a different event digest');
    }
    return { envelope: existing.envelope, duplicate: true };
  }

  return store.put({ envelope, duplicate: false });
}

export function createMemoryAcceptanceStore(): LearningRecordAcceptanceStore {
  const records = new Map<string, AcceptedLearningRecord>();
  return {
    async getByDedupeKey(key) {
      return records.get(key) ?? null;
    },
    async put(record) {
      const existing = records.get(record.envelope.dedupeKey);
      if (existing) {
        if (
          existing.envelope.inputDigest !== record.envelope.inputDigest
          || existing.envelope.anchors.sourceEventId !== record.envelope.anchors.sourceEventId
        ) {
          throw new LearningRecordContractError('dedupe-collision', 'Dedupe key reused with a different event digest');
        }
        return { envelope: existing.envelope, duplicate: true };
      }
      records.set(record.envelope.dedupeKey, { envelope: record.envelope, duplicate: false });
      return { envelope: record.envelope, duplicate: false };
    },
  };
}

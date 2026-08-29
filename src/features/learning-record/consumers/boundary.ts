import { inspectIngestionBoundary } from '@/features/learning-record/ingestion/sanitizer';
import {
  PROJECTION_RETENTION,
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  redactedProjectionFailure,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
} from '@/features/learning-record/projections/public-api';

export const CONSUMER_RETENTION = PROJECTION_RETENTION;
export const CONSUMER_SCHEMA_VERSION = '1';

const CONSUMER_PAYLOAD_KEYS = new Set([
  'coverage',
  'confidence',
  'freshness',
  'status',
  'qualification',
  'overallScore',
  'provenanceRevision',
  'inputDigest',
  'trustedSetDigest',
  'outputDigest',
  'calculationVersion',
  'generation',
  'queueGeneration',
  'cutoverFence',
  'captureRevision',
  'revision',
  'schemaVersion',
  'decoderVersion',
  'materializerVersion',
  'subjectRef',
  'classId',
  'scope',
  'stateWatermark',
  'processingWatermark',
  'evidenceCount',
  'reason',
  'knownZero',
  'suppressed',
  'independentLearnerCount',
  'aggregates',
  'averageScore',
  'trend',
  'masteryTarget',
  'fields',
]);

function inspectConsumerAllowlist(value: unknown, path = ''): string[] {
  if (value == null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => inspectConsumerAllowlist(item, `${path}[${index}]`));
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).flatMap(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const unknown = CONSUMER_PAYLOAD_KEYS.has(key) ? [] : [`unknown:${nextPath}`];
    return [...unknown, ...inspectConsumerAllowlist(nested, nextPath)];
  });
}

export function inspectConsumerBoundary(value: unknown): string[] {
  return [
    ...inspectIngestionBoundary(value),
    ...inspectConsumerAllowlist(value),
  ];
}

export function sanitizeLegacyConsumerPayload(
  payload: unknown,
  schemaVersion: string,
): Record<string, unknown> {
  if (schemaVersion !== CONSUMER_SCHEMA_VERSION) {
    throw new Error('consumer-unknown-schema');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('consumer-unknown-field');
  }
  const violations = inspectConsumerBoundary(payload);
  if (violations.length > 0) {
    throw new Error('consumer-unknown-field');
  }
  return payload as Record<string, unknown>;
}

export function acceptConsumerDelivery(input: {
  digest: string;
  lastDigest: string | null;
  order: number;
  lastOrder: number;
}): { duplicate: boolean } {
  if (input.lastOrder > input.order) {
    throw new Error('consumer-out-of-order');
  }
  return { duplicate: input.lastDigest === input.digest };
}

export {
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  redactedProjectionFailure,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
};

import {
  INGESTION_RETENTION,
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
} from '@/features/learning-record/ingestion/public-api';
import { inspectIngestionBoundary, minimizedFailureRecord } from '@/features/learning-record/ingestion/sanitizer';

export const PROJECTION_RETENTION = INGESTION_RETENTION;

const PROJECTION_PAYLOAD_KEYS = new Set([
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
]);

function inspectProjectionAllowlist(value: unknown, path = ''): string[] {
  if (value == null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => inspectProjectionAllowlist(item, `${path}[${index}]`));
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).flatMap(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const unknown = PROJECTION_PAYLOAD_KEYS.has(key) ? [] : [`unknown:${nextPath}`];
    return [...unknown, ...inspectProjectionAllowlist(nested, nextPath)];
  });
}

export function inspectProjectionBoundary(value: unknown): string[] {
  return [
    ...inspectIngestionBoundary(value),
    ...inspectProjectionAllowlist(value),
  ];
}

export function redactedProjectionFailure(code: string): {
  code: string;
  fingerprint: string;
  stage: string;
} {
  return minimizedFailureRecord({
    stage: 'projection',
    code,
    fingerprint: code.slice(0, 16),
  });
}

export {
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
};

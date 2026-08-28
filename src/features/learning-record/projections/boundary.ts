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

export function inspectProjectionBoundary(value: unknown): string[] {
  return inspectIngestionBoundary(value);
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

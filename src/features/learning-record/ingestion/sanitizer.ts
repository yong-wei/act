import { collectForbiddenFields, projectAllowlistedPayload } from '@/features/learning-record/event-contract/allowlist';

const EXCEPTION_ECHO = /(error:\s|exception|traceback|at\s+\S+\s+\(|\/Users\/|\/home\/|C:\\)/i;
const ALLOWED_STAGING_KEYS = new Set([
  'actionType',
  'eventType',
  'originalEventType',
  'learningContext',
  'stepId',
  'cardId',
  'resourceKey',
  'lessonKey',
  'attemptKey',
  'normalizedResult',
  'normalizedValue',
  'confidence',
  'durationMs',
  'priority',
  'pageType',
  'moduleId',
  'targetType',
  'targetId',
  'eventId',
  'trustedOccurredAt',
  'receivedAt',
  'reportedClientAt',
  'captureRevision',
  'revision',
  'schemaVersion',
  'decoderVersion',
  'materializerVersion',
  'subjectRef',
  'sessionRef',
  'inputDigest',
  'trustedSetDigest',
  'sourceEventId',
  'sourceLogId',
  'kind',
  'classId',
  'goalId',
  'pluginId',
  'pluginVersion',
  'adapterVersion',
  'releaseRevision',
  'canonicalLessonId',
  'canonicalResourceId',
  'canonicalActivityId',
  'arenaTaskId',
  'expectedCaptureRevision',
  'idempotencyKey',
  'materialization',
]);

export function collectEncodingViolations(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    if (value.includes('\u0000') || EXCEPTION_ECHO.test(value)) {
      return [path || 'value'];
    }
    return [];
  }
  if (value == null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectEncodingViolations(item, `${path}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => (
    collectEncodingViolations(nested, path ? `${path}.${key}` : key)
  ));
}

export function inspectIngestionBoundary(value: unknown): string[] {
  return [
    ...collectForbiddenFields(value),
    ...collectEncodingViolations(value),
  ];
}

export function unknownStagingKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => !ALLOWED_STAGING_KEYS.has(key)).map((key) => `unknown:${key}`);
}

export function assertStagingPayload(payload: Record<string, unknown>): string[] {
  return [
    ...inspectIngestionBoundary(payload),
    ...unknownStagingKeys(payload),
  ];
}

export function sanitizeStagingPayload(payload: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  return projectAllowlistedPayload(payload);
}

export function minimizedFailureRecord(input: {
  stage: string;
  code: string;
  fingerprint: string;
  attempts?: number;
  artifactDeleted?: boolean;
  operationRef?: string;
}): {
  code: string;
  fingerprint: string;
  stage: string;
  attempts: number;
  artifactDeleted: boolean;
  operationRef: string | null;
} {
  return {
    stage: input.stage,
    code: input.code,
    fingerprint: input.fingerprint,
    attempts: input.attempts ?? 1,
    artifactDeleted: input.artifactDeleted ?? true,
    operationRef: input.operationRef ?? null,
  };
}

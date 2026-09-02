import { createHash } from 'node:crypto';

const FORBIDDEN_KEY_PATTERN = /(answer|prompt|password|secret|token|email|stack|exception|modelOutput|rawArtifact|userId|userName|absolutePath|ipAddress)/i;

const ALLOWED_PAYLOAD_KEYS = new Set([
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
  'goalId',
  'pluginId',
  'pluginVersion',
  'adapterVersion',
  'schemaVersion',
  'releaseRevision',
  'captureRevision',
  'expectedCaptureRevision',
  'canonicalLessonId',
  'canonicalResourceId',
  'canonicalActivityId',
  'arenaTaskId',
  'sourceLogId',
  'idempotencyKey',
  'materialization',
]);

export function isAllowlistedPayloadKey(key: string): boolean {
  return ALLOWED_PAYLOAD_KEYS.has(key);
}

export function collectForbiddenFields(value: unknown, path = ''): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenFields(item, `${path}[${index}]`));
  }
  if (typeof value !== 'object') {
    return [];
  }
  const record = value as Record<string, unknown>;
  const hits: string[] = [];
  for (const [key, nested] of Object.entries(record)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      hits.push(nextPath);
    }
    hits.push(...collectForbiddenFields(nested, nextPath));
  }
  return hits;
}

export function projectAllowlistedPayload(payload: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  if (!payload) return {};
  const projected: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      projected[key] = value;
    }
  }
  return projected;
}

export function opaqueSubjectRef(subjectId: string): string {
  return createHash('sha256').update(`learning-record-subject:${subjectId}`).digest('hex');
}

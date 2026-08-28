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
  'confidence',
  'durationMs',
  'priority',
  'pageType',
  'moduleId',
  'targetType',
  'targetId',
]);

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
  return `subject:${Buffer.from(subjectId).toString('base64url')}`;
}

export const FORBIDDEN_EXPORT_FIELDS = [
  'answer',
  'rawAnswer',
  'prompt',
  'modelOutput',
  'parserText',
  'userId',
  'email',
  'rawArtifact',
  'token',
  'address',
  'absolutePath',
] as const;

export function containsForbiddenExportField(value: unknown): string[] {
  if (value == null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(containsForbiddenExportField);
  const record = value as Record<string, unknown>;
  const hits: string[] = [];
  for (const [key, nested] of Object.entries(record)) {
    if (FORBIDDEN_EXPORT_FIELDS.includes(key as typeof FORBIDDEN_EXPORT_FIELDS[number])) {
      hits.push(key);
    }
    hits.push(...containsForbiddenExportField(nested));
  }
  return hits;
}

export function projectForConsumer(
  payload: Record<string, string | number | boolean>,
  classification: 'public' | 'student-private' | 'teacher-scoped' | 'restricted',
): Record<string, string | number | boolean> {
  if (classification === 'public') {
    const allowed = new Set(['eventType', 'learningContext', 'pageType', 'priority']);
    return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
  }
  if (classification === 'restricted') {
    return {};
  }
  return { ...payload };
}

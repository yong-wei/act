export function normalizeExactKnowledgeLessonId(value: string | null | undefined): string | null {
  if (!value || value.length > 128) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || value.includes('..')) return null;
  return value;
}

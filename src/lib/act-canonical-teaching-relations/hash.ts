import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';

export { projectionDigest, projectionSha256 };

export class ActTeachingRelationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ActTeachingRelationError';
    this.code = code;
  }
}

export function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function requireNonEmpty(value: string, code: string, field: string): string {
  if (!value || value.trim().length === 0) {
    throw new ActTeachingRelationError(code, `${field} is required`);
  }
  return value;
}

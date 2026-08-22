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

export function teachingEdgeId(input: {
  family: string;
  sourceCanonicalId: string;
  targetCanonicalId: string | null;
  scopeHash: string;
}): string {
  return `edge-${projectionDigest(input).slice(0, 24)}`;
}

export function freezeEvidenceRef(ref: string, body: string): { ref: string; sha256: string } {
  if (!ref || ref.startsWith('course-root:') || ref.startsWith('scope:') || ref.startsWith('pending:')) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `evidence ref is not independently verifiable: ${ref}`);
  }
  return { ref, sha256: projectionSha256(body) };
}

export function requireNonEmpty(value: string, code: string, field: string): string {
  if (!value || value.trim().length === 0) {
    throw new ActTeachingRelationError(code, `${field} is required`);
  }
  return value;
}

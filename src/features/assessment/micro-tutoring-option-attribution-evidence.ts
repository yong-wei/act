import { createHash } from 'node:crypto';

function canonicalizeReviewSourceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeReviewSourceValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, entryValue]) => [key, canonicalizeReviewSourceValue(entryValue)]));
}

export function microTutoringOptionAttributionReviewSourceHash(
  attribution: object,
): string {
  const { reviewSourceHash: _reviewSourceHash, ...hashInput } = attribution as Record<string, unknown>;
  const canonicalJson = JSON.stringify(canonicalizeReviewSourceValue(hashInput));
  return `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
}

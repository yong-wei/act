import { createHash } from 'node:crypto';

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function stableEventOrder<T extends { trustedOccurredAt: string; anchors: { sourceEventId: string }; dedupeKey: string }>(
  events: T[],
): T[] {
  return [...events].sort((left, right) => {
    const time = left.trustedOccurredAt.localeCompare(right.trustedOccurredAt);
    if (time !== 0) return time;
    const source = left.anchors.sourceEventId.localeCompare(right.anchors.sourceEventId);
    if (source !== 0) return source;
    return left.dedupeKey.localeCompare(right.dedupeKey);
  });
}

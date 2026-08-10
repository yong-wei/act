/**
 * Deterministic hashing for ACT Teaching Projection artifacts (#1267).
 */

import { createHash } from 'node:crypto';

export class TeachingProjectionHashError extends Error {
  readonly code = 'non-deterministic-serialization' as const;

  constructor(message: string) {
    super(message);
    this.name = 'TeachingProjectionHashError';
  }
}

/** Canonical JSON for Teaching Projection digests (sorted object keys, no spaces). */
export function projectionCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TeachingProjectionHashError(
        'canonical JSON cannot contain a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new TeachingProjectionHashError('canonical JSON cannot contain bigint');
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => projectionCanonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${projectionCanonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new TeachingProjectionHashError('canonical JSON contains an unsupported value');
}

export function projectionSha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function projectionDigest(value: unknown): string {
  return projectionSha256(projectionCanonicalJson(value));
}

export function isSha256Hex(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

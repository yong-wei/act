/**
 * Deterministic digests for legacy knowledge runtime retirement (#1277).
 */

import { createHash } from 'node:crypto';

export class RetirementHashError extends Error {
  readonly code = 'non-deterministic-serialization' as const;

  constructor(message: string) {
    super(message);
    this.name = 'RetirementHashError';
  }
}

/** Canonical JSON for retirement digests (sorted object keys, no spaces). */
export function retirementCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RetirementHashError(
        'canonical JSON cannot contain a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new RetirementHashError('canonical JSON cannot contain bigint');
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => retirementCanonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${retirementCanonicalJson(record[key])}`,
      )
      .join(',')}}`;
  }
  throw new RetirementHashError(
    `unsupported type for canonical JSON: ${typeof value}`,
  );
}

export function retirementSha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function retirementDigest(value: unknown): string {
  return retirementSha256(retirementCanonicalJson(value));
}

export function isSha256Hex(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

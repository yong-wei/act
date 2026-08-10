/**
 * Deterministic digests for consumer activation manifests (#1276).
 */

import { createHash } from 'node:crypto';

import { ConsumerActivationError } from './contracts';

/** Canonical JSON for activation digests (sorted object keys, no spaces). */
export function activationCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ConsumerActivationError(
        'non-deterministic-serialization',
        'canonical JSON cannot contain a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new ConsumerActivationError(
      'non-deterministic-serialization',
      'canonical JSON cannot contain bigint',
    );
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => activationCanonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${activationCanonicalJson(record[key])}`,
      )
      .join(',')}}`;
  }
  throw new ConsumerActivationError(
    'non-deterministic-serialization',
    'canonical JSON contains an unsupported value',
  );
}

export function activationSha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function activationDigest(value: unknown): string {
  return activationSha256(activationCanonicalJson(value));
}

export function isSha256Hex(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

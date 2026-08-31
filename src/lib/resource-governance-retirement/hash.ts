/**
 * Deterministic digests for resource-governance retirement (#1592).
 */

import { createHash } from 'node:crypto';

export class ResourceGovernanceRetirementHashError extends Error {
  readonly code = 'non-deterministic-serialization' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ResourceGovernanceRetirementHashError';
  }
}

export function retirementCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ResourceGovernanceRetirementHashError(
        'canonical JSON cannot contain a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new ResourceGovernanceRetirementHashError(
      'canonical JSON cannot contain bigint',
    );
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
  throw new ResourceGovernanceRetirementHashError(
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

export function isGitRevision(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

export function recomputeTerminalDigest(
  doc: Record<string, unknown>,
  digestField: string,
): string {
  const { [digestField]: _ignored, ...rest } = doc;
  return retirementDigest(rest);
}

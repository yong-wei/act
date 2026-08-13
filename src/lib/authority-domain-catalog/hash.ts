/**
 * Deterministic hashing for Authority domain display catalog artifacts (#1369).
 * Reuses the Teaching Projection canonical JSON rules for byte stability.
 */

import {
  isSha256Hex,
  projectionCanonicalJson,
  projectionDigest,
  projectionSha256,
  TeachingProjectionHashError,
} from '@/lib/teaching-projection/hash';

export class DomainCatalogHashError extends Error {
  readonly code = 'non-deterministic-serialization' as const;

  constructor(message: string) {
    super(message);
    this.name = 'DomainCatalogHashError';
  }
}

export function catalogCanonicalJson(value: unknown): string {
  try {
    return projectionCanonicalJson(value);
  } catch (error) {
    if (error instanceof TeachingProjectionHashError) {
      throw new DomainCatalogHashError(error.message);
    }
    throw error;
  }
}

export function catalogSha256(value: string | Buffer): string {
  return projectionSha256(value);
}

export function catalogDigest(value: unknown): string {
  return projectionDigest(value);
}

export { isSha256Hex };

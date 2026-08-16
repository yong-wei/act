/**
 * Deterministic hashing for Authority domain shards (#1375).
 */

import {
  isSha256Hex,
  projectionCanonicalJson,
  projectionDigest,
  projectionSha256,
  TeachingProjectionHashError,
} from '@/lib/teaching-projection/hash';

export class AuthorityShardHashError extends Error {
  readonly code = 'non-deterministic-serialization' as const;

  constructor(message: string) {
    super(message);
    this.name = 'AuthorityShardHashError';
  }
}

export function shardCanonicalJson(value: unknown): string {
  try {
    return projectionCanonicalJson(value);
  } catch (error) {
    if (error instanceof TeachingProjectionHashError) {
      throw new AuthorityShardHashError(error.message);
    }
    throw error;
  }
}

export function shardSha256(value: string | Buffer): string {
  return projectionSha256(value);
}

export function shardDigest(value: unknown): string {
  return projectionDigest(value);
}

export { isSha256Hex };

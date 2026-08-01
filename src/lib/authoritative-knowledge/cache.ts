import { createHash } from 'node:crypto';

import { LRUCache } from '@/lib/lru-cache';

import type {
  AuthorityState,
  ConsumerSemanticSupport,
  KnowledgeRole,
} from './contracts';

export function consumerSupportDigest(support: ConsumerSemanticSupport): string {
  const canonical = JSON.stringify({
    consumerId: support.consumerId,
    supportedObjectTypes: [...new Set(support.supportedObjectTypes)].sort(),
    supportedPredicates: [...new Set(support.supportedPredicates)].sort(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildProjectionCacheKey(input: {
  projectionVersion: string;
  authorityState: AuthorityState;
  releaseSetId: string;
  releaseId: string;
  /** Release content hash; binds the key to the exact Release bytes. */
  releaseHash?: string | null;
  /** Upstream source dataset hash; binds the key to the exact dataset snapshot. */
  sourceDatasetHash?: string | null;
  role: KnowledgeRole | 'NONE';
  nodeId?: string;
  /** GraphProjection V2 version_digest; empty for historical CTKG 0.1 reads. */
  projectionDigest?: string | null;
  /**
   * Runtime Projection id/profile for standard public Bundle candidates only.
   * When both are omitted/undefined, the key matches the pre-#1131 exact shape
   * (no extra segments). Do not pass null placeholders for exact #1125.
   */
  runtimeProjectionId?: string;
  runtimeProjectionProfile?: string;
  support: ConsumerSemanticSupport;
}): string {
  const parts: string[] = [
    input.projectionVersion,
    input.authorityState,
    input.releaseSetId,
    input.releaseId,
    input.releaseHash ?? '',
    input.sourceDatasetHash ?? '',
    input.projectionDigest ?? '',
  ];
  // Append the pair only when a standard candidate explicitly supplies them.
  // Omitting both keeps the exact #1125 key identical to origin/integration.
  if (
    typeof input.runtimeProjectionId === 'string'
    || typeof input.runtimeProjectionProfile === 'string'
  ) {
    parts.push(input.runtimeProjectionId ?? '');
    parts.push(input.runtimeProjectionProfile ?? '');
  }
  parts.push(
    input.role,
    input.nodeId ?? '',
    consumerSupportDigest(input.support),
  );
  return parts.join('|');
}

export class AuthoritativeProjectionCache {
  private readonly cache: LRUCache<unknown>;

  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.cache = new LRUCache({
      maxSize: options.maxSize ?? 64,
      ttlMs: options.ttlMs ?? 60_000,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  size(): number {
    return this.cache.size();
  }

  clear(): void {
    this.cache.clear();
  }
}

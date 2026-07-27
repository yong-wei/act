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
  role: KnowledgeRole | 'NONE';
  nodeId?: string;
  support: ConsumerSemanticSupport;
}): string {
  return [
    input.projectionVersion,
    input.authorityState,
    input.releaseSetId,
    input.releaseId,
    input.role,
    input.nodeId ?? '',
    consumerSupportDigest(input.support),
  ].join('|');
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

import { createHash } from 'node:crypto';

import { LRUCache } from '@/lib/lru-cache';

import type {
  KnowledgeSurfaceAuthorityIdentity,
  KnowledgeSurfaceMathIdentity,
  KnowledgeSurfaceMode,
  KnowledgeSurfaceReadRequest,
  KnowledgeSurfaceRegistryIndexIdentity,
  KnowledgeSurfaceTeachingIdentity,
} from './types';
import type { KnowledgeSurfaceLatestCutover } from './latest-cutover';

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function authorityKey(authority: KnowledgeSurfaceAuthorityIdentity): string {
  return [
    authority.snapshotId ?? '',
    authority.snapshotHash ?? '',
    authority.releaseId,
    authority.releaseSetId,
    authority.activationId ?? '',
    authority.activationHash ?? '',
    authority.releaseHash ?? '',
    authority.sourceDatasetHash ?? '',
    authority.projectionDigest ?? '',
  ].join(':');
}

function teachingKey(teaching: KnowledgeSurfaceTeachingIdentity | null | undefined): string {
  if (!teaching) return '';
  return [
    teaching.projectionId,
    teaching.projectionHash,
    teaching.scopeId ?? '',
    teaching.cacheFamily ?? '',
    teaching.captureRevision ?? '',
  ].join(':');
}

function registryKey(index: KnowledgeSurfaceRegistryIndexIdentity | null | undefined): string {
  if (!index) return '';
  return [index.contract, index.identity, index.digest, index.captureRevision ?? ''].join(':');
}

function mathKey(math: KnowledgeSurfaceMathIdentity | null | undefined): string {
  if (!math) return '';
  return [math.owner, math.releaseId, math.releaseHash, math.locale].join(':');
}

function latestCutoverKey(latestCutover: KnowledgeSurfaceLatestCutover | undefined): string {
  if (!latestCutover) return '';
  return digest({
    ready: latestCutover.ready,
    combination: latestCutover.combination,
    identities: latestCutover.identities,
    reasons: latestCutover.reasons,
  });
}

export function buildKnowledgeSurfaceCacheKey(input: {
  mode: KnowledgeSurfaceMode;
  role: string;
  locale: string;
  kind: string;
  surfaceKey: string;
  authority: KnowledgeSurfaceAuthorityIdentity;
  teaching?: KnowledgeSurfaceTeachingIdentity | null;
  registryIndex?: KnowledgeSurfaceRegistryIndexIdentity | null;
  math?: KnowledgeSurfaceMathIdentity | null;
  latestCutover?: KnowledgeSurfaceLatestCutover;
}): string {
  return [
    'act-knowledge-surface/v1',
    input.mode,
    input.role,
    input.locale,
    input.kind,
    input.surfaceKey,
    authorityKey(input.authority),
    teachingKey(input.teaching),
    registryKey(input.registryIndex),
    mathKey(input.math),
    latestCutoverKey(input.latestCutover),
  ].join('|');
}

export function buildKnowledgeSurfaceCacheKeyFromRequest(
  request: KnowledgeSurfaceReadRequest,
  locale: string,
): string {
  return buildKnowledgeSurfaceCacheKey({
    mode: request.mode,
    role: request.role,
    locale,
    kind: request.kind,
    surfaceKey: request.surfaceKey,
    authority: request.authority,
    teaching: request.teaching,
    registryIndex: request.registryIndex,
    math: request.math,
    latestCutover: request.latestCutover,
  });
}

export class KnowledgeSurfaceCache {
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

export function knowledgeSurfaceIdentityDigest(
  input: Pick<KnowledgeSurfaceReadRequest, 'mode' | 'authority' | 'teaching' | 'registryIndex' | 'latestCutover'>,
): string {
  return digest({
    mode: input.mode,
    authority: input.authority,
    teaching: input.teaching ?? null,
    registryIndex: input.registryIndex ?? null,
    latestCutover: input.latestCutover ?? null,
  });
}

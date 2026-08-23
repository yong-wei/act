/**
 * Server-only reconstruction of the active presentation set.
 */

import {
  ENGINEERING_RELATION_FAMILIES,
  type AuthorityShardObject,
  type AuthorityShardRelation,
} from '@/lib/authority-domain-shards/contracts';
import {
  loadActiveShardContext,
  loadDomainDefaultShard,
  loadRelationFamilyShard,
  loadVerifiedShardRelative,
} from '@/lib/authority-domain-shards/loader';
import {
  resolveActiveShardIdentity,
  type ActiveShardIdentity,
} from '@/lib/authority-domain-shards/identity';
import type {
  AuthorityNodeDetailShard,
  AuthorityNodeNeighborhoodShard,
} from '@/lib/authority-domain-shards/contracts';
import { AuthorityShardStoreError, shardRelativePaths } from '@/lib/authority-domain-shards/store';

import type { LocalePresentationInventory } from './presentation-denominator';
import { sourcePresentationRecordId } from './presentation-denominator';

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id) => id.length > 0))].sort();
}

function collectObjects(
  objects: readonly AuthorityShardObject[],
  objectNames: Set<string>,
  types: Set<string>,
  aliasIds: Set<string>,
): void {
  for (const object of objects) {
    objectNames.add(object.id);
    types.add(object.canonicalType);
    aliasIds.add(object.id);
  }
}

function collectRelations(
  relations: readonly AuthorityShardRelation[],
  predicates: Set<string>,
  directions: Set<string>,
): void {
  for (const relation of relations) {
    if (relation.predicate) predicates.add(relation.predicate);
    if (relation.direction) directions.add(relation.direction);
  }
}

const inventoryByEvidence = new Map<string, LocalePresentationInventory>();

export function loadActivePresentationInventory(
  repoRoot = process.cwd(),
  identity?: ActiveShardIdentity,
): LocalePresentationInventory {
  const active = identity ?? resolveActiveShardIdentity({ repoRoot });
  const context = loadActiveShardContext({ repoRoot, identity: active });
  const cacheKey = `${active.envelope.authority.snapshotHash}:${context.manifest.shardSetHash}`;
  const cached = inventoryByEvidence.get(cacheKey);
  if (cached) return cached;
  const domains = uniqueSorted(active.catalog.domains.map((domain) => domain.visualRole));
  const objectNames = new Set<string>();
  const types = new Set<string>();
  const predicates = new Set<string>();
  const directions = new Set<string>();
  const aliasIds = new Set<string>();

  for (const domain of active.catalog.domains) {
    const shard = loadDomainDefaultShard(domain.domainId, { repoRoot, identity: active });
    collectObjects(shard.objects, objectNames, types, aliasIds);
    collectRelations(shard.teachingRelations, predicates, directions);
    for (const family of ENGINEERING_RELATION_FAMILIES) {
      const familyShard = loadRelationFamilyShard(domain.domainId, family, {
        repoRoot,
        identity: active,
      });
      collectObjects(familyShard.objects, objectNames, types, aliasIds);
      collectRelations(familyShard.relations, predicates, directions);
    }
  }

  const pending = [...objectNames];
  const visitedNeighborhoods = new Set<string>();
  while (pending.length > 0) {
    const objectId = pending.pop()!;
    if (visitedNeighborhoods.has(objectId)) continue;
    visitedNeighborhoods.add(objectId);
    const neighborhoodRelative = shardRelativePaths({ canonicalId: objectId }).neighborhood;
    if (!neighborhoodRelative) {
      throw new AuthorityShardStoreError('shard-absent', `neighborhood path missing for ${objectId}`);
    }
    if (!context.manifest.files[neighborhoodRelative]) {
      throw new AuthorityShardStoreError(
        'shard-absent',
        `expected neighborhood ${neighborhoodRelative} is not in the sealed shard set`,
      );
    }
    const before = objectNames.size;
    const neighborhood = loadVerifiedShardRelative<AuthorityNodeNeighborhoodShard>(
      neighborhoodRelative,
      'node-neighborhood',
      context,
    );
    collectObjects(neighborhood.objects, objectNames, types, aliasIds);
    collectRelations(neighborhood.relations, predicates, directions);
    if (objectNames.size > before) {
      for (const object of neighborhood.objects) {
        if (!visitedNeighborhoods.has(object.id)) pending.push(object.id);
      }
    }
  }

  const objectIds = uniqueSorted(objectNames);
  const inventory = {
    domains,
    objectNames: objectIds,
    objectExplanations: objectIds,
    types: uniqueSorted(types),
    relations: uniqueSorted(predicates),
    directions: uniqueSorted(directions),
    aliasIds: uniqueSorted(aliasIds),
    sourceIds: uniqueSorted(collectSourceIds(context, objectIds)),
  };
  inventoryByEvidence.set(cacheKey, inventory);
  return inventory;
}

function collectSourceIds(
  context: ReturnType<typeof loadActiveShardContext>,
  objectIds: readonly string[],
): string[] {
  const sourceIds = new Set<string>();
  for (const objectId of objectIds) {
    const relative = shardRelativePaths({ canonicalId: objectId }).detail;
    if (!relative) {
      throw new AuthorityShardStoreError('shard-absent', `detail path missing for ${objectId}`);
    }
    if (!context.manifest.files[relative]) {
      throw new AuthorityShardStoreError(
        'shard-absent',
        `expected detail ${relative} is not in the sealed shard set`,
      );
    }
    const shard = loadVerifiedShardRelative<AuthorityNodeDetailShard>(relative, 'node-detail', context);
    for (const source of shard.node.sources) {
      const recordId = sourcePresentationRecordId(source);
      if (recordId) sourceIds.add(recordId);
    }
  }
  return [...sourceIds];
}

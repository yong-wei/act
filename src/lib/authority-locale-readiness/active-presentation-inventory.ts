/**
 * Server-only reconstruction of the active presentation set.
 */

import {
  ENGINEERING_RELATION_FAMILIES,
  type AuthorityShardObject,
  type AuthorityShardRelation,
} from '@/lib/authority-domain-shards/contracts';
import {
  loadDomainDefaultShard,
  loadRelationFamilyShard,
} from '@/lib/authority-domain-shards/loader';
import {
  resolveActiveShardIdentity,
  type ActiveShardIdentity,
} from '@/lib/authority-domain-shards/identity';

import type { LocalePresentationInventory } from './presentation-denominator';

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

export function loadActivePresentationInventory(
  repoRoot = process.cwd(),
  identity?: ActiveShardIdentity,
): LocalePresentationInventory {
  const active = identity ?? resolveActiveShardIdentity({ repoRoot });
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
      try {
        const familyShard = loadRelationFamilyShard(domain.domainId, family, {
          repoRoot,
          identity: active,
        });
        collectObjects(familyShard.objects, objectNames, types, aliasIds);
        collectRelations(familyShard.relations, predicates, directions);
      } catch {
        // A missing optional family does not remove the remaining presentation set.
      }
    }
  }

  return {
    domains,
    objectNames: uniqueSorted(objectNames),
    objectExplanations: uniqueSorted(objectNames),
    types: uniqueSorted(types),
    relations: uniqueSorted(predicates),
    directions: uniqueSorted(directions),
    aliasIds: uniqueSorted(aliasIds),
    sourceIds: [],
  };
}

import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import type { TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { humanTitleFromResourceId } from '@/lib/teaching-projection/resource-title';
import type { AuthorityLearnerShard, AuthorityShardEnvelope } from './contracts';
import { publishedLearningContentTypes } from './learning-content';
import { matchActiveTeachingProjection } from './resource-bindings';

const resourceTypesByProjection = new Map<string, Map<string, Set<TeachingResourceType>>>();

function publishedBindingTypes(
  projection: ReturnType<typeof matchActiveTeachingProjection>,
): Map<string, Set<TeachingResourceType>> {
  const key = `${projection.projectionId ?? ''}:${projection.projectionHash ?? ''}`;
  const cached = resourceTypesByProjection.get(key);
  if (cached) return cached;
  const typesByNode = new Map<string, Set<TeachingResourceType>>();
  if (!projection.bindings || !projection.resources) return typesByNode;
  const resources = new Map(projection.resources.map((resource) => [resource.resourceId, resource]));
  for (const binding of projection.bindings) {
    const resource = resources.get(binding.resourceId);
    if (!resource) continue;
    const title = resource.title?.trim() || humanTitleFromResourceId(resource.resourceId);
    if (!title) continue;
    const types = typesByNode.get(binding.canonicalId) ?? new Set<TeachingResourceType>();
    types.add(resource.resourceType);
    typesByNode.set(binding.canonicalId, types);
  }
  resourceTypesByProjection.set(key, typesByNode);
  if (resourceTypesByProjection.size > 4) {
    resourceTypesByProjection.delete(resourceTypesByProjection.keys().next().value!);
  }
  return typesByNode;
}

export function activeAuthorityResourceTypes(envelope: AuthorityShardEnvelope, nodeIds: readonly string[], _role?: KnowledgeRole): ReadonlyMap<string, ReadonlySet<TeachingResourceType>> {
  const requested = new Set(nodeIds);
  const available = new Map<string, Set<TeachingResourceType>>([...publishedLearningContentTypes(envelope)]
    .filter(([id, types]) => requested.has(id) && types.length > 0).map(([id, types]) => [id, new Set(types)]));
  const projection = matchActiveTeachingProjection({ envelope });
  if (projection.status !== 'available' || !projection.bindings || !projection.resources) return available;
  // Overview dots only name published binding types. Launch authorization stays in node-detail.
  const published = publishedBindingTypes(projection);
  for (const nodeId of requested) {
    const types = published.get(nodeId);
    if (!types) continue;
    const dest = available.get(nodeId) ?? new Set<TeachingResourceType>();
    for (const type of types) dest.add(type);
    available.set(nodeId, dest);
  }
  return available;
}

/** Adds only existing resource type identifiers to bounded object payloads, without loading every node detail. */
export function attachActiveAuthorityResourcePresence<T extends AuthorityLearnerShard>(shard: T, role?: KnowledgeRole): T {
  if (shard.shardClass === 'root' || shard.shardClass === 'node-detail') return shard;
  const objects = shard.shardClass === 'domain-default' ? [...shard.objects, ...(shard.teachingBoundaryObjects ?? [])] : shard.objects;
  const available = activeAuthorityResourceTypes(shard.envelope, objects.map((node) => node.id), role);
  const decorate = (node: typeof objects[number]) => ({ ...node, resourceTypes: [...(available.get(node.id) ?? [])].sort() });
  return { ...shard, objects: shard.objects.map(decorate),
    ...(shard.shardClass === 'domain-default' ? { teachingBoundaryObjects: shard.teachingBoundaryObjects?.map(decorate) } : {}),
  } as T;
}

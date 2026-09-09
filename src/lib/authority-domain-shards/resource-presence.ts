import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import { sanitizePublicResourceBindingLaunches } from '@/lib/knowledge-surface/registry-closure';
import type { TeachingBindingRuntime, TeachingResourceType } from '@/lib/teaching-projection/contracts';
import type { AuthorityLearnerShard, AuthorityShardEnvelope } from './contracts';
import { publishedLearningContentTypes } from './learning-content';
import { matchActiveTeachingProjection, projectAuthorityNodeResourceBindings } from './resource-bindings';

export function activeAuthorityResourceTypes(envelope: AuthorityShardEnvelope, nodeIds: readonly string[], role?: KnowledgeRole): ReadonlyMap<string, ReadonlySet<TeachingResourceType>> {
  const requested = new Set(nodeIds);
  const available = new Map<string, Set<TeachingResourceType>>([...publishedLearningContentTypes(envelope)]
    .filter(([id, types]) => requested.has(id) && types.length > 0).map(([id, types]) => [id, new Set(types)]));
  const projection = matchActiveTeachingProjection({ envelope });
  if (projection.status !== 'available' || !projection.bindings || !projection.resources) return available;
  // Filters describe published bindings. Launch authorization remains in the node-detail registry closure.
  const bindingsByNode = new Map<string, TeachingBindingRuntime[]>();
  for (const binding of projection.bindings) {
    if (!requested.has(binding.canonicalId)) continue;
    const rows = bindingsByNode.get(binding.canonicalId) ?? [];
    rows.push(binding);
    bindingsByNode.set(binding.canonicalId, rows);
  }
  const resources = new Map(projection.resources.map((resource) => [resource.resourceId, resource]));
  for (const [nodeId, bindings] of bindingsByNode) {
    for (const resourceId of new Set(bindings.map((binding) => binding.resourceId))) {
      const resource = resources.get(resourceId);
      if (!resource) continue;
      const projected = projectAuthorityNodeResourceBindings({ nodeId,
        bindings: bindings.filter((binding) => binding.resourceId === resourceId), resources: [resource], viewerRole: role });
      const sanitized = sanitizePublicResourceBindingLaunches(projected, nodeId);
      if (sanitized.state === 'available' && sanitized.items.some((item) => item.availability === 'available')) {
        const types = available.get(nodeId) ?? new Set<TeachingResourceType>();
        types.add(resource.resourceType);
        available.set(nodeId, types);
      }
    }
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

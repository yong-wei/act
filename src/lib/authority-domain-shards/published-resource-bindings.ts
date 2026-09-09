import type { ActiveNodeResourceBindings } from '@/features/knowledge/active-authority-graph-contracts';
import type { KnowledgeSurfaceRegistryIndexIdentity } from '@/lib/knowledge-surface/types';
import { loadPublishedResourceFeatureIndex } from '@/lib/published-resource-index';
import { buildPublishedResourceHref, PUBLISHED_RESOURCE_LABELS } from '@/lib/published-resource-reference';
import type { PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';
import type { AuthorityNodeDetailShard, AuthorityShardEnvelope } from './contracts';
import { matchActiveTeachingProjection } from './resource-bindings';

export interface PublishedNodeResources {
  nodeId: string;
  envelopeKey: string;
  bindings: ActiveNodeResourceBindings;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
}

const ROLES = { EXPLAINS: '讲解', PRACTICES: '练习', ASSESSES: '评价', COVERS: '引用' } as const;
const ROLE_ORDER = ['EXPLAINS', 'PRACTICES', 'ASSESSES', 'COVERS'] as const;

export function publishedResourceEnvelopeKey(envelope: AuthorityShardEnvelope): string {
  return JSON.stringify([envelope.authority.snapshotHash, envelope.authority.activationHash,
    envelope.catalog.catalogHash, envelope.teaching.status, envelope.teaching.projectionId,
    envelope.teaching.projectionHash, envelope.match.teaching]);
}

export function publishedNodeResourceFailure(shard: AuthorityNodeDetailShard): PublishedNodeResources {
  return { nodeId: shard.node.id, envelopeKey: publishedResourceEnvelopeKey(shard.envelope),
    bindings: { state: 'unavailable', message: '当前节点资源版本暂时无法验证。' }, registryIndex: null };
}

/** Published-resource references carry their own snapshot, projection and content-version proof. */
export async function readPublishedNodeResources(
  shard: AuthorityNodeDetailShard,
  loadIndex: () => Promise<PublishedResourceFeatureIndex> = loadPublishedResourceFeatureIndex,
): Promise<PublishedNodeResources> {
  const result = publishedNodeResourceFailure(shard);
  const projection = matchActiveTeachingProjection(shard);
  if (projection.status !== 'available' || !projection.bindings) return result;
  const bindings = projection.bindings.filter((binding) => binding.canonicalId === shard.node.id);
  if (!bindings.length) return { ...result, bindings: { state: 'empty', message: '暂无已发布的节点资源。' } };
  const index = await loadIndex();
  if (index.projectionId !== projection.projectionId || index.projectionHash !== projection.projectionHash
    || index.snapshotId !== shard.envelope.authority.snapshotId || index.snapshotHash !== shard.envelope.authority.snapshotHash) {
    return result;
  }
  const byId = new Map(index.resources.map((resource) => [resource.identity.resourceId, resource]));
  const ids = [...new Set(bindings.map((binding) => binding.resourceId))];
  const items = ids.map((id) => {
    const resource = byId.get(id);
    if (!resource || !resource.canonicalIds.includes(shard.node.id)
      || resource.identity.projectionId !== index.projectionId || resource.identity.projectionHash !== index.projectionHash
      || resource.identity.snapshotId !== index.snapshotId || resource.identity.snapshotHash !== index.snapshotHash) {
      throw new Error('Published node resource identity differs from its binding');
    }
    const role = ROLE_ORDER.find((candidate) => bindings.some((binding) => binding.resourceId === id && binding.role === candidate)) ?? 'COVERS';
    const readable = resource.backend.kind !== 'reference-only'
      && (resource.backend.kind !== 'container' || resource.backend.childResourceIds.length > 0);
    return {
      resourceId: id,
      title: resource.title,
      resourceKind: PUBLISHED_RESOURCE_LABELS[resource.type],
      bindingRole: ROLES[role],
      availability: readable ? 'available' as const : 'unavailable' as const,
      launch: {
        kind: readable ? 'direct-route' as const : 'unavailable' as const,
        href: readable ? buildPublishedResourceHref({ ...resource.identity, resourceVersion: resource.version }) : null,
      },
    };
  });
  return {
    ...result,
    bindings: { state: 'available', items },
    // This index identity binds the projection, snapshot, and resource content versions.
    registryIndex: { contract: index.contract, identity: index.indexId, digest: index.indexId,
      publication: { projectionId: index.projectionId, projectionHash: index.projectionHash,
        snapshotId: index.snapshotId, snapshotHash: index.snapshotHash,
        scopeId: projection.scopeId ?? null, runtimeReleaseId: index.runtimeReleaseId } },
  };
}

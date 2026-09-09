import type { ActiveNodeResourceBindings } from '@/features/knowledge/active-authority-graph-contracts';
import type { KnowledgeSurfaceRegistryIndexIdentity } from '@/lib/knowledge-surface/types';
import { loadPublishedResourceFeatureIndexCapture, PublishedResourceSelectionChangedError, type PublishedResourceFeatureIndexCapture } from '@/lib/published-resource-index';
import { buildPublishedResourceHref, PUBLISHED_RESOURCE_LABELS } from '@/lib/published-resource-reference';
import type { AuthorityNodeDetailShard, AuthorityShardEnvelope } from './contracts';
import { matchActiveTeachingProjection } from './resource-bindings';

export interface PublishedNodeResources {
  nodeId: string;
  envelopeKey: string;
  teachingCaptureRevision: string | null;
  assertCurrent: () => void;
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

function projectionKey(projection: ReturnType<typeof matchActiveTeachingProjection>): string {
  return JSON.stringify([projection.status, projection.projectionId, projection.projectionHash,
    projection.scopeId, projection.authoringRevision]);
}

export function publishedNodeResourceFailure(
  shard: AuthorityNodeDetailShard,
  projection = matchActiveTeachingProjection(shard),
): PublishedNodeResources {
  const capturedProjectionKey = projectionKey(projection);
  return { nodeId: shard.node.id, envelopeKey: publishedResourceEnvelopeKey(shard.envelope),
    teachingCaptureRevision: projection.authoringRevision,
    assertCurrent: () => {
      if (projectionKey(matchActiveTeachingProjection(shard)) !== capturedProjectionKey) {
        throw new PublishedResourceSelectionChangedError('Node resource course projection changed while reading');
      }
    },
    bindings: { state: 'unavailable', message: '当前节点资源版本暂时无法验证。' }, registryIndex: null };
}

/** Published-resource references carry their own snapshot, projection and content-version proof. */
export async function readPublishedNodeResources(
  shard: AuthorityNodeDetailShard,
  loadIndex: () => Promise<PublishedResourceFeatureIndexCapture> = loadPublishedResourceFeatureIndexCapture,
): Promise<PublishedNodeResources> {
  const projection = matchActiveTeachingProjection(shard);
  const result = publishedNodeResourceFailure(shard, projection);
  if (projection.status !== 'available' || !projection.bindings) return result;
  const bindings = projection.bindings.filter((binding) => binding.canonicalId === shard.node.id);
  if (!bindings.length) return { ...result, bindings: { state: 'empty', message: '暂无已发布的节点资源。' } };
  const capture = await loadIndex();
  const { index } = capture;
  result.assertCurrent();
  capture.assertCurrent();
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
      || resource.identity.snapshotId !== index.snapshotId || resource.identity.snapshotHash !== index.snapshotHash
      || resource.identity.runtimeReleaseId !== index.runtimeReleaseId) {
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
    assertCurrent: () => { result.assertCurrent(); capture.assertCurrent(); },
    bindings: { state: 'available', items },
    // This index identity binds the projection, snapshot, and resource content versions.
    registryIndex: { contract: index.contract, identity: index.indexId, digest: index.indexId,
      publication: { projectionId: index.projectionId, projectionHash: index.projectionHash,
        snapshotId: index.snapshotId, snapshotHash: index.snapshotHash,
        scopeId: projection.scopeId ?? null, runtimeReleaseId: index.runtimeReleaseId } },
  };
}

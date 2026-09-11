import { hasPublishedPlanNodeIdentity, isPublishedResourceIdentity, type PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';
import { deriveTeachingProjectionResourceIdentity } from './adaptive-path-runtime-binding';
import type { AdaptiveLearningPathPlanNode } from './internal/assemble-plan';
import type { RuntimeReleaseFileIndex } from './adaptive-path-runtime-binding';
import type { AdaptivePathObjectKeyReadRecord } from './adaptive-path-oss-provenance';

/** Verify captured publication/manifest entries, without claiming or performing body reads. */
export function buildIndexedCandidateResourceRecords(
  options: readonly { styleId: string; planNodes?: readonly AdaptiveLearningPathPlanNode[] }[],
  release: RuntimeReleaseFileIndex | null,
  index?: PublishedResourceFeatureIndex,
  checkedAt = new Date().toISOString(),
): AdaptivePathObjectKeyReadRecord[] {
  const features = new Map(index?.resources.map((resource) => [resource.identity.resourceId, resource]) ?? []);
  const records: AdaptivePathObjectKeyReadRecord[] = [];
  for (const option of options) {
    for (const node of option.planNodes ?? []) {
      const ref = node.resourceFeatureRef;
      if (ref) {
        const feature = features.get(ref.resourceId);
        const valid = isPublishedResourceIdentity(ref) && feature?.recommendable === true
          && (node.sourceKind === 'teaching_projection' ? hasPublishedPlanNodeIdentity(node)
            : deriveTeachingProjectionResourceIdentity(node.nodeId)?.resourceId === ref.resourceId)
          && ref.indexId === index?.indexId && ref.resourceVersion === feature.version
          && ref.projectionId === index.projectionId && ref.projectionHash === index.projectionHash
          && ref.snapshotId === index.snapshotId && ref.snapshotHash === index.snapshotHash
          && (ref.runtimeReleaseId ?? null) === index.runtimeReleaseId;
        records.push({
          objectKey: 'published:' + ref.resourceVersion, resourceId: ref.resourceId,
          candidateStyleId: option.styleId, nodeNodeId: node.nodeId,
          state: valid ? 'index-verified' : 'unverified',
          contentSha256: valid ? feature.sourcePath?.match(/^content:([a-f0-9]{64})$/)?.[1] ?? null : null,
          verifiedAt: checkedAt, runtimeReleaseId: valid ? index.runtimeReleaseId : null,
        });
        continue;
      }
      const binding = node.runtimeResourceBinding;
      if (binding?.state !== 'bound' || !binding.objectKey) continue;
      const hash = binding.objectKey.startsWith('blob:')
        ? binding.objectKey.slice('blob:'.length)
        : release?.filesByPath.get(binding.objectKey)?.sha256;
      const releaseMatch = Boolean(release && release.releaseId === binding.runtimeReleaseId);
      const valid = Boolean(releaseMatch && hash && release!.filesBySha256.has(hash) && binding.contentSha256 === hash);
      records.push({
        objectKey: binding.objectKey, resourceId: binding.resourceId ?? node.nodeId,
        candidateStyleId: option.styleId, nodeNodeId: node.nodeId,
        state: valid ? 'index-verified' : release && binding.runtimeReleaseId && !releaseMatch ? 'release-mismatch' : 'unverified',
        contentSha256: valid ? hash! : null,
        verifiedAt: checkedAt, runtimeReleaseId: valid ? release!.releaseId : null,
      });
    }
  }
  return records;
}

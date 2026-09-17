import type { TeachingBindingRuntime, TeachingProjectionArtifacts, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';
import {
  readAgreedLiveCourseProjection,
  readAgreedLiveResourceBindingRelease,
} from '@/lib/teaching-projection/live-course-pointer';

import type { AnchoredBindingRuntime } from './contracts';
import { loadResourceBindingRelease, type LoadedResourceBindingRelease } from './store';

/** Derive the card catalog from the current binding release, without rewriting B′. */
export function overlayPublishedCardResources(
  artifacts: TeachingProjectionArtifacts,
  release: LoadedResourceBindingRelease,
): TeachingProjectionArtifacts {
  const manifest = release.manifest;
  if (!release.gate.passed || !manifest.gatePassed
    || manifest.authorityReleaseId !== artifacts.manifest.authorityReleaseId
    || manifest.authoritySnapshotId !== artifacts.manifest.authoritySnapshotId
    || manifest.authoritySnapshotHash !== artifacts.manifest.authoritySnapshotHash) {
    throw new Error('Published card binding identity mismatch');
  }
  const bindings = release.bindings.filter((b) => b.resourceType === 'card').map(asTeachingBinding);
  const cards: TeachingResourceRuntime[] = release.resources.filter((r) => r.resourceType === 'card').map((resource) => {
    const matched = bindings.filter((b) => b.resourceId === resource.resourceId);
    return { resourceId: resource.resourceId, resourceType: 'card', projectionMode: 'REQUIRED', scopeId: manifest.scopeId,
      title: resource.title, sourcePath: resource.sourcePath, legacyCrosswalkRef: null,
      bindingCount: matched.length, bindingStatus: matched.length ? 'BOUND' : 'UNBOUND',
      projectionStatus: matched.length ? 'BOUND' : 'UNBOUND',
      bindingDigest: projectionDigest(matched.map((b) => ({ canonicalId: b.canonicalId, role: b.role }))),
    };
  });
  return { ...artifacts,
    resources: [...artifacts.resources.filter((r) => r.resourceType !== 'card'), ...cards],
    bindings: [...artifacts.bindings.filter((b) => !b.resourceId.startsWith('act:card:')), ...bindings],
  };
}

export function asTeachingBinding(binding: AnchoredBindingRuntime): TeachingBindingRuntime {
  return {
    bindingId: binding.bindingId,
    resourceId: binding.resourceId,
    canonicalId: binding.canonicalId,
    role: binding.role,
    scopeId: binding.scopeId,
    sourcePath: null,
    primary: binding.primary,
    rationale: binding.anchor.kind === 'whole' ? null : `anchor:${binding.anchorKey}`,
  };
}

/**
 * Live Konling / RAG / layered-graph consumers read the agreed binding release
 * when `resource-bindings/current.json` is present. Isolated fixtures without
 * that pointer keep the supplied fallback (historical B′ spray).
 */
export function overlayTeachingBindingsFromLiveRelease(
  fallback: readonly TeachingBindingRuntime[],
  repoRoot = process.cwd(),
  required: { projectionId?: string | null; authorityReleaseId?: string | null } = {},
): { bindings: TeachingBindingRuntime[]; overlaid: boolean; bindingReleaseId: string | null } {
  const live = readAgreedLiveResourceBindingRelease(repoRoot);
  const course = readAgreedLiveCourseProjection(repoRoot);
  if (
    !live
    || !course
    || (required.projectionId && required.projectionId !== course.projectionId)
    || (required.authorityReleaseId && required.authorityReleaseId !== live.authorityReleaseId)
  ) {
    return { bindings: [...fallback], overlaid: false, bindingReleaseId: null };
  }
  const loaded = loadResourceBindingRelease(repoRoot, live.bindingReleaseId);
  return {
    bindings: loaded.bindings.map(asTeachingBinding),
    overlaid: true,
    bindingReleaseId: live.bindingReleaseId,
  };
}

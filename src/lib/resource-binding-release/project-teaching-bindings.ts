import type { TeachingBindingRuntime } from '@/lib/teaching-projection/contracts';
import {
  readAgreedLiveCourseProjection,
  readAgreedLiveResourceBindingRelease,
} from '@/lib/teaching-projection/live-course-pointer';

import type { AnchoredBindingRuntime } from './contracts';
import { loadResourceBindingRelease } from './store';

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

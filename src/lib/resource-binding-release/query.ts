import { readAgreedLiveResourceBindingRelease } from '@/lib/teaching-projection/live-course-pointer';
import { resolveAnchoredLaunchHref, type LaunchableResource } from '@/lib/layered-graph/teaching-resource-launch-maps';
import { anchorDisplayLabel } from '@/lib/layered-graph/teaching-resource-launch-maps';

import type { AnchoredBindingRuntime, AnchoredResourceRuntime, BindingAppearance } from './contracts';
import { loadResourceBindingRelease } from './store';

export interface ResourceBindingLaunchRow {
  bindingId: string;
  canonicalId: string;
  appearance: BindingAppearance;
  anchorLabel: string | null;
  href: string | null;
}

export function listLiveAnchoredBindingsForResource(
  resourceId: string,
  repoRoot = process.cwd(),
): {
  resource: AnchoredResourceRuntime | null;
  bindings: AnchoredBindingRuntime[];
  bindingReleaseId: string | null;
} {
  const live = readAgreedLiveResourceBindingRelease(repoRoot);
  if (!live) return { resource: null, bindings: [], bindingReleaseId: null };
  const loaded = loadResourceBindingRelease(repoRoot, live.bindingReleaseId);
  return {
    resource: loaded.resources.find((row) => row.resourceId === resourceId) ?? null,
    bindings: loaded.bindings.filter((row) => row.resourceId === resourceId),
    bindingReleaseId: live.bindingReleaseId,
  };
}

export function launchRowsForResource(
  resourceId: string,
  baseHref: string | null,
  repoRoot = process.cwd(),
): ResourceBindingLaunchRow[] {
  const { resource, bindings } = listLiveAnchoredBindingsForResource(resourceId, repoRoot);
  if (!resource) return [];
  const launchable: LaunchableResource = {
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    unitId: resource.unitId,
  };
  return bindings.map((binding) => ({
    bindingId: binding.bindingId,
    canonicalId: binding.canonicalId,
    appearance: binding.appearance,
    anchorLabel: anchorDisplayLabel(binding.anchor),
    href: resolveAnchoredLaunchHref(launchable, binding.anchor, baseHref),
  }));
}

import type {
  TeachingBindingRuntime,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';

import type { TeachingResourceBindingView } from './contracts';

export function buildTeachingResourceBindingViews(input: {
  bindings: readonly TeachingBindingRuntime[];
  resources: readonly TeachingResourceRuntime[];
}): TeachingResourceBindingView[] {
  const resourcesById = new Map(
    input.resources.map((resource) => [resource.resourceId, resource]),
  );
  return input.bindings.map((binding) => {
    const resource = resourcesById.get(binding.resourceId);
    return {
      bindingId: binding.bindingId,
      resourceId: binding.resourceId,
      canonicalId: binding.canonicalId,
      role: binding.role,
      scopeId: binding.scopeId,
      primary: binding.primary,
      resourceType: resource?.resourceType ?? null,
      resourceTitle: resource?.title ?? null,
      projectionMode: resource?.projectionMode ?? null,
      sourcePath: binding.sourcePath ?? resource?.sourcePath ?? null,
    };
  });
}

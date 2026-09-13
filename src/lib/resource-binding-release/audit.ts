import type { TeachingBindingRuntime, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';

import {
  RESOURCE_BINDING_AUDIT_CONTRACT,
  type AnchoredBindingRuntime,
  type AnchoredResourceRuntime,
  type ResourceBindingAuditReport,
} from './contracts';

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function computeAuditReport(input: {
  bindingReleaseId: string;
  resources: AnchoredResourceRuntime[];
  bindings: AnchoredBindingRuntime[];
  baseline: {
    kind: 'course-projection' | 'binding-release' | 'none';
    id: string | null;
    resources: Array<Pick<TeachingResourceRuntime, 'resourceId' | 'resourceType'>>;
    bindings: Array<Pick<TeachingBindingRuntime, 'resourceId' | 'canonicalId'>>;
  };
}): ResourceBindingAuditReport {
  const perNode = new Map<string, { count: number; units: Set<string> }>();
  for (const binding of input.bindings) {
    const entry = perNode.get(binding.canonicalId) ?? { count: 0, units: new Set<string>() };
    entry.count += 1;
    if (binding.teachingOrder) entry.units.add(binding.teachingOrder.unitId);
    perNode.set(binding.canonicalId, entry);
  }
  const counts = [...perNode.values()].map((v) => v.count).sort((a, b) => a - b);
  const perResource = countBy(input.bindings, (b) => b.resourceId);
  const typeByResource = new Map(input.resources.map((r) => [r.resourceId, r.resourceType]));

  const baselinePerNode = new Map<string, number>();
  for (const binding of input.baseline.bindings) {
    baselinePerNode.set(binding.canonicalId, (baselinePerNode.get(binding.canonicalId) ?? 0) + 1);
  }

  return {
    contract: RESOURCE_BINDING_AUDIT_CONTRACT,
    bindingReleaseId: input.bindingReleaseId,
    resourceCount: input.resources.length,
    bindingCount: input.bindings.length,
    canonicalCount: perNode.size,
    perNodeBindingCount: {
      min: counts[0] ?? 0,
      p50: quantile(counts, 0.5),
      p90: quantile(counts, 0.9),
      max: counts[counts.length - 1] ?? 0,
      nodesAtOrAbove50: counts.filter((c) => c >= 50).length,
      nodesAtOrAbove100: counts.filter((c) => c >= 100).length,
    },
    topFanoutResources: Object.entries(perResource)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([resourceId, bindingCount]) => ({ resourceId, resourceType: typeByResource.get(resourceId) ?? 'unknown', bindingCount })),
    topBoundNodes: [...perNode.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 15)
      .map(([canonicalId, v]) => ({ canonicalId, bindingCount: v.count, unitCount: v.units.size })),
    roleCounts: countBy(input.bindings, (b) => b.role),
    provenanceCounts: countBy(input.bindings, (b) => b.provenance.method),
    appearanceCounts: countBy(input.bindings, (b) => b.appearance),
    anchorKindCounts: countBy(input.bindings, (b) => b.anchor.kind),
    resourceTypeCounts: countBy(input.resources, (r) => r.resourceType),
    baseline: {
      kind: input.baseline.kind,
      id: input.baseline.id,
      resourceCount: input.baseline.kind === 'none' ? null : input.baseline.resources.length,
      bindingCount: input.baseline.kind === 'none' ? null : input.baseline.bindings.length,
      canonicalCount: input.baseline.kind === 'none' ? null : baselinePerNode.size,
      maxPerNode: input.baseline.kind === 'none' ? null : Math.max(0, ...baselinePerNode.values()),
    },
  };
}

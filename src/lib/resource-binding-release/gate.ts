import {
  RESOURCE_BINDING_GATE_CONTRACT,
  isMultiKnowledgeResourceType,
  type AnchoredBindingRuntime,
  type AnchoredResourceRuntime,
  type ResourceBindingGateFinding,
  type ResourceBindingGateResult,
} from './contracts';

export interface GateContext {
  excludedResourceIds: string[];
  noAnchorResourceIds: string[];
  driftedMediaIds: string[];
  unmappedCourseNodes: string[];
  ambiguousLabels: string[];
  mediaDurations: Map<string, number>;
  activeMediaSha: Map<string, string>;
  authorityMismatch: string | null;
  carryForwardGatePassed: boolean;
}

const TIME_TOLERANCE_SECONDS = 0.75;

export function evaluateResourceBindingGate(input: {
  resources: AnchoredResourceRuntime[];
  bindings: AnchoredBindingRuntime[];
  context: GateContext;
}): ResourceBindingGateResult {
  const findings: ResourceBindingGateFinding[] = [];
  const { context } = input;

  if (context.authorityMismatch) {
    findings.push({ code: 'authority-mismatch', severity: 'error', message: context.authorityMismatch });
  }
  if (!context.carryForwardGatePassed) {
    findings.push({
      code: 'carry-forward-gate-failed',
      severity: 'error',
      message: 'course projection used for exact-channel carry-forward did not pass its gate',
    });
  }

  const resourceById = new Map(input.resources.map((r) => [r.resourceId, r]));
  for (const resource of input.resources) {
    if (resource.resourceType === 'lesson' || resource.resourceType === 'textbook') {
      findings.push({
        code: 'entry-resource-present',
        severity: 'error',
        message: `${resource.resourceType} resources must not enter the binding release`,
        resourceId: resource.resourceId,
      });
    }
  }

  for (const binding of input.bindings) {
    const resource = resourceById.get(binding.resourceId);
    if (!resource) {
      findings.push({ code: 'binding-orphan', severity: 'error', message: 'binding references an unknown resource', bindingId: binding.bindingId, resourceId: binding.resourceId });
      continue;
    }
    if (binding.anchor.kind === 'whole' && isMultiKnowledgeResourceType(binding.resourceType)) {
      findings.push({
        code: 'multi-knowledge-whole-anchor',
        severity: 'error',
        message: `${binding.resourceType} bindings require a precise anchor`,
        bindingId: binding.bindingId,
        resourceId: binding.resourceId,
      });
    }
    if (binding.anchor.kind === 'time') {
      const { startSeconds, endSeconds, mediaId, runtimePath, mediaSha256 } = binding.anchor;
      if (!(startSeconds >= 0) || !(endSeconds > startSeconds)) {
        findings.push({ code: 'time-anchor-invalid', severity: 'error', message: `invalid time range ${startSeconds}-${endSeconds}`, bindingId: binding.bindingId, resourceId: binding.resourceId });
      }
      const duration = context.mediaDurations.get(mediaId);
      if (duration !== undefined && endSeconds > duration + TIME_TOLERANCE_SECONDS) {
        findings.push({ code: 'time-anchor-out-of-range', severity: 'error', message: `anchor ends at ${endSeconds}s beyond media duration ${duration}s`, bindingId: binding.bindingId, resourceId: binding.resourceId });
      }
      const activeSha = context.activeMediaSha.get(runtimePath);
      if (activeSha === undefined) {
        findings.push({ code: 'media-missing-in-active-release', severity: 'error', message: `bound media ${runtimePath} is not in the activated runtime release`, bindingId: binding.bindingId, resourceId: binding.resourceId });
      } else if (activeSha !== mediaSha256) {
        findings.push({ code: 'binding-media-drift', severity: 'error', message: `bound media ${runtimePath} sha256 differs from the activated runtime release`, bindingId: binding.bindingId, resourceId: binding.resourceId });
      }
    }
    if (binding.teachingOrder === null && binding.appearance !== 'reference') {
      findings.push({ code: 'appearance-without-order', severity: 'error', message: 'first/revisit requires a teaching order', bindingId: binding.bindingId });
    }
    if (binding.teachingOrder !== null && binding.appearance === 'reference') {
      findings.push({ code: 'reference-with-order', severity: 'error', message: 'reference appearance must not carry a teaching order', bindingId: binding.bindingId });
    }
  }

  for (const resourceId of context.excludedResourceIds) {
    findings.push({ code: 'entry-excluded', severity: 'info', message: 'lesson entry or whole-book resource excluded from the binding release', resourceId });
  }
  for (const mediaId of context.driftedMediaIds) {
    findings.push({ code: 'media-drift', severity: 'warning', message: 'local media differs from the activated runtime release; no time anchors emitted', resourceId: mediaId });
  }
  for (const resourceId of [...new Set(context.noAnchorResourceIds)].sort()) {
    findings.push({ code: 'no-anchor', severity: 'info', message: 'resource has no anchored canonical binding', resourceId });
  }
  for (const courseNodeId of context.unmappedCourseNodes) {
    findings.push({ code: 'unmapped-course-node', severity: 'info', message: 'course node has no canonical crosswalk row', canonicalId: courseNodeId });
  }
  if (context.ambiguousLabels.length > 0) {
    findings.push({ code: 'ambiguous-labels', severity: 'info', message: `${context.ambiguousLabels.length} labels resolve to several authority entities and were skipped` });
  }
  if (input.bindings.length === 0) {
    findings.push({ code: 'empty-release', severity: 'error', message: 'binding release has no bindings' });
  }

  const passed = !findings.some((f) => f.severity === 'error');
  return {
    contract: RESOURCE_BINDING_GATE_CONTRACT,
    status: passed ? 'passed' : 'failed',
    passed,
    findings,
    excludedResourceIds: [...context.excludedResourceIds].sort(),
    noAnchorResourceIds: [...new Set(context.noAnchorResourceIds)].sort(),
    unmappedCourseNodes: [...context.unmappedCourseNodes].sort(),
    driftedMediaIds: [...context.driftedMediaIds].sort(),
    ambiguousLabels: [...context.ambiguousLabels].sort(),
  };
}

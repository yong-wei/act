import {
  auditResourceNode, buildResourceNodeHighConfidencePlanningAudit, getPathNodeSemanticsForResourceType,
  RESOURCE_NODE_TYPES, type ResourceNode, type ResourceNodeRegistry,
} from './resource-node-registry';
import {
  buildPublishedResourceHref, publishedResourceNodeId, publishedResourcePathType,
  type PublishedResourceFeature, type PublishedResourceFeatureIndex,
} from './published-resource-reference';
import { deriveTeachingProjectionResourceIdentity } from '@/features/personalization/path-planning/adaptive-path-runtime-binding';

function createPublishedNode(feature: PublishedResourceFeature, indexId: string, native?: ResourceNode): ResourceNode {
  const type = publishedResourcePathType(feature.type);
  const target = buildPublishedResourceHref({ ...feature.identity, resourceVersion: feature.version });
  return {
    id: publishedResourceNodeId(feature.identity.resourceId, feature.version),
    title: feature.title, description: feature.summary, type, courseModule: native?.courseModule ?? null,
    sourceKind: 'teaching_projection', sourceRef: feature.identity.resourceId,
    sourceRefs: [{ kind: 'teaching_projection', ref: feature.identity.resourceId }],
    renderTarget: target, launchTarget: target, pathSemantics: getPathNodeSemanticsForResourceType(type),
    externalResource: null, checkpoint: null,
    sourceOfRecord: { content: 'TeachingProjection', catalogMetadata: 'TeachingProjection', planningMetadata: 'ResourceNode' },
    publishedResource: { ...feature, indexId },
    planningMetadata: {
      prerequisites: [], estimatedTimeMinutes: feature.estimatedMinutes,
      cognitiveLoad: native?.planningMetadata.cognitiveLoad ?? 'medium',
      knowledgeCoverage: [...feature.canonicalIds], abilityImpact: {},
      cost: { effort: 'medium', requiresTeacherReview: false },
      availability: native?.planningMetadata.availability ?? 'available',
      teacherPolicy: native?.planningMetadata.teacherPolicy ?? 'allowed',
      privacyLevel: native?.planningMetadata.privacyLevel ?? 'student-visible',
      terminalConstraints: [], evidenceInstrumentation: ['path-resource-open', 'path-resource-explicit-completion'],
      readiness: native?.planningMetadata.readiness ?? null,
      pathDisposition: {
        kind: 'path-plannable', reviewStatus: 'published-contract',
        rationale: '资源来自已验证发布索引，具备真实知识绑定和学生可用的学习入口。',
        sourceFamily: 'teaching_projection', stableSourceRef: feature.identity.resourceId,
        sourceVersionRef: feature.version, parentResourceNodeId: null, reviewedAt: null, reviewerId: null,
      },
    },
    eligibility: { pathEligible: false, reasons: [], auditIssues: [] },
  };
}

/** Keep native graded task contracts; replace exact duplicate reading resources by their published identity. */
export function attachPublishedResourcesToRegistry(
  registry: ResourceNodeRegistry,
  index: PublishedResourceFeatureIndex,
): ResourceNodeRegistry {
  const byResource = new Map<string, ResourceNode>();
  for (const node of registry.nodes) {
    const identity = deriveTeachingProjectionResourceIdentity(node.id);
    if (identity && !byResource.has(identity.resourceId)) byResource.set(identity.resourceId, node);
  }
  const replaced = new Set<string>();
  const published: ResourceNode[] = [];
  const nativeUpdates = new Map<string, ResourceNode>();
  for (const feature of index.resources) {
    if (feature.canonicalIds.length === 0) continue;
    const native = byResource.get(feature.identity.resourceId);
    if (native && ['arena_task', 'simulation', 'control_workbench', 'adaptive_quiz', 'checkpoint'].includes(native.type)) {
      nativeUpdates.set(native.id, {
        ...native, publishedResource: { ...feature, indexId: index.indexId },
        planningMetadata: { ...native.planningMetadata, knowledgeCoverage: [...new Set([
          ...native.planningMetadata.knowledgeCoverage, ...feature.canonicalIds,
        ])] },
      });
      continue;
    }
    if (native) replaced.add(native.id);
    published.push(createPublishedNode(feature, index.indexId, native));
  }
  // Existing explicit resource prerequisites continue to resolve to the replacement reading node.
  const replacementIds = new Map(published.flatMap((node) => {
    const native = byResource.get(node.sourceRef);
    return native ? [[native.id, node.id] as const] : [];
  }));
  const nodes = [...registry.nodes.filter((node) => !replaced.has(node.id)).map((node) => nativeUpdates.get(node.id) ?? node), ...published]
    .map((node) => ({ ...node, planningMetadata: { ...node.planningMetadata,
      prerequisites: node.planningMetadata.prerequisites.map((id) => replacementIds.get(id) ?? id),
      readiness: node.planningMetadata.readiness ? { ...node.planningMetadata.readiness,
        requiredCompletedNodeIds: node.planningMetadata.readiness.requiredCompletedNodeIds.map((id) => replacementIds.get(id) ?? id),
        fallbackNodeIds: node.planningMetadata.readiness.fallbackNodeIds.map((id) => replacementIds.get(id) ?? id),
      } : null,
    } }));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const audited = nodes.map((node) => node.sourceKind === 'teaching_projection'
    ? { ...node, eligibility: auditResourceNode(node, nodeMap) } : node);
  const ineligibleNodes = audited.filter((node) => !buildResourceNodeHighConfidencePlanningAudit(node).pathEligible)
    .map((node) => ({ id: node.id, title: node.title, type: node.type, reasons: node.eligibility.reasons }));
  return {
    ...registry, nodes: audited, supportedTypes: RESOURCE_NODE_TYPES, featureIndex: index,
    edges: registry.edges.map((edge) => ({ ...edge,
      fromNodeId: replacementIds.get(edge.fromNodeId) ?? edge.fromNodeId,
      toNodeId: replacementIds.get(edge.toNodeId) ?? edge.toNodeId,
    })),
    audit: { totalNodes: audited.length, pathEligibleNodes: audited.length - ineligibleNodes.length, ineligibleNodes },
  };
}

/** Goal aliases match exact published card identities, never names or similarities. */
export function resolvePublishedGoalCanonicalIds(
  index: PublishedResourceFeatureIndex,
  targets: readonly string[],
): string[] {
  const requested = new Set(targets);
  return [...new Set(index.resources.flatMap((resource) => {
    const exactCardTarget = resource.type === 'card' && requested.has(resource.identity.resourceId.slice('act:card:'.length));
    return resource.canonicalIds.filter((id) => requested.has(id) || requested.has(resource.identity.resourceId) || exactCardTarget);
  }))].sort();
}

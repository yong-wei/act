import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getPathNodeSemanticsForResourceType, RESOURCE_NODE_TYPES, type ResourceNode, type ResourceNodeRegistry } from '@/lib/resource-node-registry';
import { buildResourceCandidatePoolDiagnostics } from '@/lib/teacher-resource-node-data';
import {
  buildPublishedResourceHref,
  publishedResourceNodeId,
  publishedResourcePathType,
  type PublishedResourceFeature,
  type PublishedResourceFeatureIndex,
} from '@/lib/published-resource-reference';
import type { BindingAnchor, BindingAppearance, BindingTeachingOrder } from '@/lib/resource-binding-release/contracts';
import { loadCurrentResourceBindingRelease } from '@/lib/resource-binding-release';
import type { TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';
import {
  anchorDisplayLabel,
  buildTeachingResourceLaunchMaps,
  resolveAnchoredLaunchHref,
} from '@/lib/layered-graph/teaching-resource-launch-maps';

import { goalCanonicalIds } from './goal-canonical-knowledge';
import { expandFeasibleKnowledgeIds } from './knowledge-scope';
import type { TeachingPrerequisiteEdge } from './live-teaching-prerequisites';
import { resolvePlanningResourceTitle } from './planning-resource-titles';

const ESTIMATED_MINUTES: Record<string, number> = {
  card: 8,
  infographic: 5,
  handout: 20,
  video: 15,
  audio: 12,
  podcast: 12,
  lesson: 25,
  step: 10,
  exercise: 15,
  simulation: 20,
  slides: 15,
  project: 30,
  textbook: 20,
  'textbook-chapter': 20,
  'textbook-section': 15,
};

export interface ProjectionResourceRow {
  resourceId: string;
  resourceType: string;
  title: string;
  sourcePath: string | null;
  bindingDigest: string;
  projectionStatus: string;
  unitId?: string | null;
}

export interface ProjectionBindingRow {
  bindingId: string;
  resourceId: string;
  canonicalId: string;
  role: string;
  appearance?: BindingAppearance;
  teachingOrder?: BindingTeachingOrder | null;
  anchor?: BindingAnchor;
  unitId?: string | null;
}

export interface GoalPlanningUniverse {
  goalId: string;
  knowledgeIds: string[];
  edges: TeachingPrerequisiteEdge[];
  resources: PublishedResourceFeature[];
  index: PublishedResourceFeatureIndex;
}

export function sliceGoalPlanningUniverse(input: {
  goalId: string;
  projectionId: string;
  projectionHash: string;
  snapshotId: string;
  snapshotHash: string;
  authorityReleaseId: string;
  runtimeReleaseId?: string | null;
  bindingReleaseId?: string | null;
  bindingHash?: string | null;
  resources: readonly ProjectionResourceRow[];
  bindings: readonly ProjectionBindingRow[];
  edges: readonly TeachingPrerequisiteEdge[];
  generatedAt?: string;
}): GoalPlanningUniverse {
  const targets = goalCanonicalIds(input.goalId);
  const knowledgeIds = expandFeasibleKnowledgeIds(targets, input.edges);
  const knowledge = new Set(knowledgeIds);
  const edges = input.edges.filter((edge) =>
    knowledge.has(edge.sourceCanonicalId) && knowledge.has(edge.targetCanonicalId),
  );
  const resourceById = new Map(input.resources.map((row) => [row.resourceId, row]));
  const launchMaps = buildTeachingResourceLaunchMaps(
    input.resources.map((row) => ({
      resourceId: row.resourceId,
      resourceType: row.resourceType as TeachingResourceType,
      unitId: row.unitId ?? null,
    })),
  );
  const identity = {
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    runtimeReleaseId: input.runtimeReleaseId ?? null,
    bindingReleaseId: input.bindingReleaseId ?? null,
    bindingHash: input.bindingHash ?? null,
  };
  const resources = input.bindings.flatMap((binding) => {
    if (!knowledge.has(binding.canonicalId)) return [];
    const row = resourceById.get(binding.resourceId);
    if (!row) return [];
    return [toPlanningFeature(row, binding, identity, launchMaps.resourceLaunchTargets[row.resourceId] ?? null)];
  });
  const indexId = digest([
    input.projectionHash,
    input.bindingHash ?? null,
    input.goalId,
    knowledgeIds,
    resources.map((resource) => resource.bindingIds[0] ?? resource.identity.resourceId),
  ]);
  const index: PublishedResourceFeatureIndex = {
    contract: 'published-resource-features/v1',
    indexId,
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    runtimeReleaseId: input.runtimeReleaseId ?? null,
    authorityReleaseId: input.authorityReleaseId,
    bindingReleaseId: input.bindingReleaseId ?? null,
    bindingHash: input.bindingHash ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    resources: resources.map((resource) => ({ ...resource })),
    prerequisiteEdges: [],
  };
  return { goalId: input.goalId, knowledgeIds, edges, resources, index };
}

export function buildGoalPlanningRegistry(universe: GoalPlanningUniverse): ResourceNodeRegistry {
  const nodes = universe.resources.map((feature) => toPlanningNode(feature, universe.index.indexId));
  return {
    nodes,
    edges: [],
    supportedTypes: RESOURCE_NODE_TYPES,
    featureIndex: universe.index,
    audit: {
      totalNodes: nodes.length,
      pathEligibleNodes: nodes.length,
      ineligibleNodes: [],
    },
  };
}

export function loadGoalPlanningUniverse(
  goalId: string,
  repoRoot = process.cwd(),
): GoalPlanningUniverse {
  const loaded = readLiveProjectionIndex(repoRoot);
  return sliceGoalPlanningUniverse({
    goalId,
    ...loaded,
  });
}

export function loadGoalPlanningRegistry(goalId: string, repoRoot = process.cwd()) {
  const universe = loadGoalPlanningUniverse(goalId, repoRoot);
  const registry = buildGoalPlanningRegistry(universe);
  return {
    registry,
    diagnostics: buildResourceCandidatePoolDiagnostics(registry, [{
      family: 'planning-projection-index',
      status: registry.nodes.length > 0 ? 'loaded' : 'empty',
      count: registry.nodes.length,
      reason: universe.knowledgeIds.length === 0 ? 'goal-knowledge-unbound' : null,
    }]),
    universe,
  };
}

export function tryLoadGoalPlanningRegistry(goalId: string, repoRoot = process.cwd()) {
  try {
    return loadGoalPlanningRegistry(goalId, repoRoot);
  } catch {
    return null;
  }
}

function toPlanningFeature(
  row: ProjectionResourceRow,
  binding: ProjectionBindingRow,
  identity: {
    projectionId: string;
    projectionHash: string;
    snapshotId: string;
    snapshotHash: string;
    runtimeReleaseId: string | null;
  },
  baseHref: string | null,
): PublishedResourceFeature {
  const type = row.resourceType as TeachingResourceType;
  const version = /^[a-f0-9]{64}$/u.test(binding.bindingId)
    ? binding.bindingId
    : digest([binding.bindingId, row.resourceId, binding.canonicalId]);
  const featureIdentity = {
    resourceId: row.resourceId,
    projectionId: identity.projectionId,
    projectionHash: identity.projectionHash,
    snapshotId: identity.snapshotId,
    snapshotHash: identity.snapshotHash,
    runtimeReleaseId: identity.runtimeReleaseId,
    resourceVersion: version,
  };
  const label = binding.anchor ? anchorDisplayLabel(binding.anchor) : null;
  const title = row.title;
  const anchored = binding.anchor
    ? resolveAnchoredLaunchHref(
      { resourceId: row.resourceId, resourceType: type, unitId: binding.unitId ?? row.unitId ?? null },
      binding.anchor,
      baseHref,
    )
    : baseHref;
  const href = anchored ?? buildPublishedResourceHref(featureIdentity);
  return {
    identity: featureIdentity,
    version,
    type,
    title: resolvePlanningResourceTitle(title, {
      canonicalIds: [binding.canonicalId],
      resourceId: row.resourceId,
    }),
    summary: resolvePlanningResourceTitle(title, {
      canonicalIds: [binding.canonicalId],
      resourceId: row.resourceId,
    }),
    canonicalIds: [binding.canonicalId],
    bindingIds: [binding.bindingId],
    bindingRoles: [binding.role],
    sourcePath: row.sourcePath,
    baselineDifficulty: null,
    estimatedMinutes: ESTIMATED_MINUTES[type] ?? 15,
    estimateSource: 'policy-estimate',
    executable: true,
    recommendable: true,
    limitation: null,
    backend: { kind: 'route', href },
    appearance: binding.appearance,
    teachingOrder: binding.teachingOrder ?? null,
    anchorLabel: label,
  };
}

function toPlanningNode(feature: PublishedResourceFeature, indexId: string): ResourceNode {
  const type = publishedResourcePathType(feature.type);
  const published = buildPublishedResourceHref({ ...feature.identity, resourceVersion: feature.version });
  const target = feature.backend.kind === 'route' ? feature.backend.href : published;
  return {
    id: publishedResourceNodeId(feature.identity.resourceId, feature.version),
    title: feature.anchorLabel ? `${feature.title} · ${feature.anchorLabel}` : feature.title,
    description: feature.summary,
    type,
    courseModule: null,
    sourceKind: 'teaching_projection',
    sourceRef: feature.identity.resourceId,
    sourceRefs: [{ kind: 'teaching_projection', ref: feature.identity.resourceId }],
    renderTarget: target,
    launchTarget: target,
    pathSemantics: getPathNodeSemanticsForResourceType(type),
    externalResource: null,
    checkpoint: null,
    sourceOfRecord: {
      content: 'TeachingProjection',
      catalogMetadata: 'TeachingProjection',
      planningMetadata: 'ResourceNode',
    },
    publishedResource: { ...feature, indexId },
    planningMetadata: {
      prerequisites: [],
      estimatedTimeMinutes: feature.estimatedMinutes,
      cognitiveLoad: 'medium',
      knowledgeCoverage: [...feature.canonicalIds],
      abilityImpact: {},
      cost: { effort: 'medium', requiresTeacherReview: false },
      availability: 'available',
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      evidenceInstrumentation: ['path-resource-open', 'path-resource-explicit-completion'],
      readiness: null,
      pathDisposition: {
        kind: 'path-plannable',
        reviewStatus: 'published-contract',
        rationale: '资源来自已激活锚定绑定发布，规划器只使用目标知识子集上的绑定。',
        sourceFamily: 'teaching_projection',
        stableSourceRef: feature.identity.resourceId,
        sourceVersionRef: feature.version,
        parentResourceNodeId: null,
        reviewedAt: null,
        reviewerId: null,
      },
    },
    eligibility: { pathEligible: true, reasons: [], auditIssues: [] },
  };
}

function readLiveProjectionIndex(repoRoot: string) {
  const root = resolveConfiguredTeachingProjectionRoot(repoRoot);
  const current = readJson<{
    projectionId?: string;
    projectionHash?: string;
    authorityReleaseId?: string;
  }>(join(root, 'current.json'));
  const projectionId = current?.projectionId?.trim();
  if (!projectionId) throw new Error('Active teaching projection pointer is missing');
  const release = join(root, 'releases', projectionId);
  const manifest = readJson<{
    projectionId: string;
    projectionHash: string;
    authoritySnapshotId: string;
    authoritySnapshotHash: string;
    authorityReleaseId: string;
  }>(join(release, 'projection-manifest.json'));
  if (!manifest?.projectionHash || !manifest.authoritySnapshotHash) {
    throw new Error('Active teaching projection manifest is missing');
  }
  const binding = loadCurrentResourceBindingRelease(repoRoot);
  if (!binding) {
    throw new Error('Active resource binding release is missing');
  }
  if (binding.manifest.authorityReleaseId !== manifest.authorityReleaseId) {
    throw new Error('Resource binding release Authority does not match the live teaching projection');
  }
  const resourcesById = new Map(binding.resources.map((row) => [row.resourceId, row]));
  return {
    projectionId: manifest.projectionId,
    projectionHash: manifest.projectionHash,
    snapshotId: manifest.authoritySnapshotId,
    snapshotHash: manifest.authoritySnapshotHash,
    authorityReleaseId: manifest.authorityReleaseId,
    runtimeReleaseId: binding.manifest.activeRuntimeReleaseId ?? null,
    bindingReleaseId: binding.manifest.bindingReleaseId,
    bindingHash: binding.manifest.bindingHash,
    resources: binding.resources
      .filter((row) => row.resourceId.startsWith('act:') && row.resourceType !== 'lesson')
      .map((row) => ({
        resourceId: row.resourceId,
        resourceType: row.resourceType,
        title: row.title ?? row.resourceId,
        sourcePath: row.sourcePath,
        bindingDigest: binding.manifest.bindingHash,
        projectionStatus: row.bindingStatus,
        unitId: row.unitId,
      })),
    bindings: binding.bindings.flatMap((row) => {
      const resource = resourcesById.get(row.resourceId);
      if (!resource || resource.resourceType === 'lesson') return [];
      return [{
        bindingId: row.bindingId,
        resourceId: row.resourceId,
        canonicalId: row.canonicalId,
        role: row.role,
        appearance: row.appearance,
        teachingOrder: row.teachingOrder,
        anchor: row.anchor,
        unitId: row.teachingOrder?.unitId ?? resource.unitId,
      }];
    }),
    edges: readJsonl(join(release, 'prerequisites.jsonl')).flatMap((row) => {
      if (row.strength !== 'REQUIRED' && row.strength !== 'RECOMMENDED') return [];
      if (typeof row.sourceCanonicalId !== 'string' || typeof row.targetCanonicalId !== 'string') return [];
      return [{
        id: String(row.prerequisiteId ?? `${row.sourceCanonicalId}->${row.targetCanonicalId}`),
        sourceCanonicalId: row.sourceCanonicalId,
        targetCanonicalId: row.targetCanonicalId,
        strength: row.strength,
      } satisfies TeachingPrerequisiteEdge];
    }),
  };
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readJsonl(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as unknown;
      if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row as Record<string, unknown>);
    } catch {
      // skip malformed index lines
    }
  }
  return rows;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

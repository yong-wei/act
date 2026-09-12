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
import type { TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

import { goalCanonicalIds } from './goal-canonical-knowledge';
import { expandFeasibleKnowledgeIds } from './knowledge-scope';
import type { TeachingPrerequisiteEdge } from './live-teaching-prerequisites';

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
}

export interface ProjectionBindingRow {
  bindingId: string;
  resourceId: string;
  canonicalId: string;
  role: string;
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
  const scoped = new Map<string, { ids: string[]; roles: string[]; bindingIds: string[] }>();
  for (const binding of input.bindings) {
    if (!knowledge.has(binding.canonicalId)) continue;
    const current = scoped.get(binding.resourceId) ?? { ids: [], roles: [], bindingIds: [] };
    current.ids.push(binding.canonicalId);
    current.roles.push(binding.role);
    current.bindingIds.push(binding.bindingId);
    scoped.set(binding.resourceId, current);
  }
  const resources = input.resources.flatMap((row) => {
    const bound = scoped.get(row.resourceId);
    if (!bound || bound.ids.length === 0) return [];
    return [toPlanningFeature(row, bound, {
      projectionId: input.projectionId,
      projectionHash: input.projectionHash,
      snapshotId: input.snapshotId,
      snapshotHash: input.snapshotHash,
      runtimeReleaseId: input.runtimeReleaseId ?? null,
    })];
  });
  const indexId = digest([
    input.projectionHash,
    input.goalId,
    knowledgeIds,
    resources.map((resource) => resource.identity.resourceId),
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
  bound: { ids: string[]; roles: string[]; bindingIds: string[] },
  identity: {
    projectionId: string;
    projectionHash: string;
    snapshotId: string;
    snapshotHash: string;
    runtimeReleaseId: string | null;
  },
): PublishedResourceFeature {
  const type = row.resourceType as TeachingResourceType;
  const canonicalIds = unique(bound.ids);
  const version = /^[a-f0-9]{64}$/u.test(row.bindingDigest) ? row.bindingDigest : digest([row.resourceId, row.bindingDigest]);
  const featureIdentity = {
    resourceId: row.resourceId,
    projectionId: identity.projectionId,
    projectionHash: identity.projectionHash,
    snapshotId: identity.snapshotId,
    snapshotHash: identity.snapshotHash,
    runtimeReleaseId: identity.runtimeReleaseId,
    resourceVersion: version,
  };
  return {
    identity: featureIdentity,
    version,
    type,
    title: row.title,
    summary: row.title,
    canonicalIds,
    bindingIds: unique(bound.bindingIds),
    bindingRoles: unique(bound.roles),
    sourcePath: row.sourcePath,
    baselineDifficulty: null,
    estimatedMinutes: ESTIMATED_MINUTES[type] ?? 15,
    estimateSource: 'policy-estimate',
    executable: true,
    recommendable: true,
    limitation: null,
    backend: { kind: 'route', href: buildPublishedResourceHref(featureIdentity) },
  };
}

function toPlanningNode(feature: PublishedResourceFeature, indexId: string): ResourceNode {
  const type = publishedResourcePathType(feature.type);
  const target = buildPublishedResourceHref({ ...feature.identity, resourceVersion: feature.version });
  return {
    id: publishedResourceNodeId(feature.identity.resourceId, feature.version),
    title: feature.title,
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
        rationale: '资源来自已激活教学投影索引，规划器只使用目标知识子集上的绑定。',
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
  return {
    projectionId: manifest.projectionId,
    projectionHash: manifest.projectionHash,
    snapshotId: manifest.authoritySnapshotId,
    snapshotHash: manifest.authoritySnapshotHash,
    authorityReleaseId: manifest.authorityReleaseId,
    runtimeReleaseId: null,
    resources: readJsonl(join(release, 'resources.jsonl')).map((row) => ({
      resourceId: String(row.resourceId ?? ''),
      resourceType: String(row.resourceType ?? ''),
      title: String(row.title ?? row.resourceId ?? ''),
      sourcePath: typeof row.sourcePath === 'string' ? row.sourcePath : null,
      bindingDigest: String(row.bindingDigest ?? ''),
      projectionStatus: String(row.projectionStatus ?? ''),
    })).filter((row) => row.resourceId.startsWith('act:')),
    bindings: readJsonl(join(release, 'bindings.jsonl')).map((row) => ({
      bindingId: String(row.bindingId ?? ''),
      resourceId: String(row.resourceId ?? ''),
      canonicalId: String(row.canonicalId ?? ''),
      role: String(row.role ?? ''),
    })).filter((row) => row.resourceId && row.canonicalId),
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

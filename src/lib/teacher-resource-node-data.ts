import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  applyCoreResourcePathReadinessDispositions,
  buildResourceNodeRegistry,
  type KnowledgeNodeResourceInput,
  type RegisteredResourceNodeInput,
  type ResourceNodeRegistry,
  type ResourceNodeRegistryInput,
  type RuntimeResourceProjectionInput,
  type RuntimeLessonNodeInput,
  type TextbookResourceNodeInput,
  type TextbookSectionResourceNodeInput,
  type TeachingResourceNodeInput,
} from './resource-node-registry';
import type { RuntimeLessonResourceCatalogEntry } from './course-bundle';
import type { TextbookStructureRuntimeCatalogEntry } from './course-bundle';
import {
  RESOURCE_NODE_REGISTRY_VERSION,
  RESOURCE_SEMANTIC_PROJECTION_VERSION,
} from './kaq-artifact-versioning';

const RUNTIME_RESOURCE_PROJECTIONS_PATH = path.join(
  process.cwd(),
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
);

interface ResourceWithKnowledgeNodes {
  id: string;
  title: string;
  displayName?: string | null;
  description?: string | null;
  type: string;
  registryId?: string | null;
  content?: string | null;
  category?: string | null;
  teacherOnly?: boolean | null;
  config?: unknown;
  knowledgeNodes?: Array<{
    id: string;
    name: string;
    resources?: unknown;
    tags?: string[];
  }>;
}

export interface ResourceCandidatePoolDiagnostics {
  registryVersion: typeof RESOURCE_NODE_REGISTRY_VERSION;
  projectionVersion: typeof RESOURCE_SEMANTIC_PROJECTION_VERSION;
  totalCandidates: number;
  pathEligibleCandidates: number;
  candidateCountsByFamily: Record<string, number>;
  sourceFamilies: ResourceCandidatePoolSourceStatus[];
  excluded: {
    total: number;
    byReason: Record<string, number>;
  };
  sourceFamilyIssues: Record<string, number>;
  missingSourceReasons: Record<string, number>;
  nodeEligibilityMissingReasons: Record<string, number>;
}

export interface ResourceCandidatePoolSourceStatus {
  family: string;
  status: 'loaded' | 'empty' | 'missing' | 'error';
  count: number;
  reason: string | null;
}

export function buildResourceNodeRegistryFromTeachingResources(
  resources: readonly ResourceWithKnowledgeNodes[],
  registeredResources: readonly RegisteredResourceNodeInput[] = [],
  runtimeLessons: readonly RuntimeLessonResourceCatalogEntry[] = [],
  runtimeTextbooks: readonly TextbookStructureRuntimeCatalogEntry[] = [],
  runtimeResourceProjections: readonly RuntimeResourceProjectionInput[] = [],
  extraInput: ResourceNodeRegistryInput = {},
): ResourceNodeRegistry {
  const knowledgeNodesById = new Map<string, KnowledgeNodeResourceInput>();
  const registeredResourceById = new Map(registeredResources.map((resource) => [resource.id, resource]));

  const teachingResources: TeachingResourceNodeInput[] = resources.map((resource) => {
    const registeredResource = resource.registryId
      ? registeredResourceById.get(resource.registryId)
      : undefined;
    const dbKnowledgeNodeIds = (resource.knowledgeNodes ?? []).map((node) => node.id);
    for (const node of resource.knowledgeNodes ?? []) {
      knowledgeNodesById.set(node.id, {
        id: node.id,
        name: node.name,
        resources: Array.isArray(node.resources) ? node.resources : [],
        tags: node.tags ?? [],
      });
    }

    return {
      id: resource.id,
      title: resource.title,
      displayName: resource.displayName,
      description: resource.description,
      type: resource.type,
      registryId: resource.registryId,
      content: resource.content,
      category: resource.category,
      teacherOnly: resource.teacherOnly,
      knowledgeNodeIds: dbKnowledgeNodeIds.length > 0
        ? dbKnowledgeNodeIds
        : registeredResource?.knowledgeNodeIds ?? [],
      config: mergeRegisteredPlanningOverride(asRecord(resource.config), registeredResource),
    };
  });

  return applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
    ...extraInput,
    teachingResources,
    registeredResources: [
      ...registeredResources,
      ...(extraInput.registeredResources ?? []),
    ],
    knowledgeNodes: [
      ...Array.from(knowledgeNodesById.values()),
      ...(extraInput.knowledgeNodes ?? []),
    ],
    runtimeLessons: [
      ...runtimeLessons.map(toRuntimeLessonNodeInput),
      ...(extraInput.runtimeLessons ?? []),
    ],
    runtimeResourceProjections: [
      ...runtimeResourceProjections,
      ...(extraInput.runtimeResourceProjections ?? []),
    ],
    textbooks: [
      ...runtimeTextbooks.map((entry) => entry.textbook),
      ...(extraInput.textbooks ?? []),
    ],
    textbookSections: [
      ...runtimeTextbooks.flatMap(toTextbookUnitNodeInputs),
      ...(extraInput.textbookSections ?? []),
    ],
  }));
}

export async function loadRuntimeResourceProjectionInputs(
  options: { allowMissing?: boolean } = {},
): Promise<RuntimeResourceProjectionInput[]> {
  try {
    const content = await readFile(RUNTIME_RESOURCE_PROJECTIONS_PATH, 'utf8');
    return content
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RuntimeResourceProjectionInput);
  } catch (error) {
    if (isMissingFileError(error) && options.allowMissing !== false) return [];
    throw error;
  }
}

export function buildResourceCandidatePoolDiagnostics(
  registry: ResourceNodeRegistry,
  sourceFamilies: readonly ResourceCandidatePoolSourceStatus[] = [],
): ResourceCandidatePoolDiagnostics {
  const excludedReasons = registry.audit.ineligibleNodes.flatMap((node) => node.reasons);
  const sourceFamilyIssues = sourceFamilies
    .map((source) => source.reason)
    .filter((reason): reason is string => Boolean(reason));
  const missingSourceReasons = sourceFamilies
    .filter((source) => source.status === 'missing' || source.reason?.startsWith('missing-source-family:'))
    .map((source) => source.reason)
    .filter((reason): reason is string => Boolean(reason));
  const nodeEligibilityMissingReasons = excludedReasons.filter((reason) => reason.startsWith('missing-'));
  return {
    registryVersion: RESOURCE_NODE_REGISTRY_VERSION,
    projectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
    totalCandidates: registry.nodes.length,
    pathEligibleCandidates: registry.audit.pathEligibleNodes,
    candidateCountsByFamily: countBy(registry.nodes.map((node) => node.sourceKind)),
    sourceFamilies: [...sourceFamilies],
    excluded: {
      total: registry.audit.ineligibleNodes.length,
      byReason: countBy(excludedReasons),
    },
    sourceFamilyIssues: countBy(sourceFamilyIssues),
    missingSourceReasons: countBy(missingSourceReasons),
    nodeEligibilityMissingReasons: countBy(nodeEligibilityMissingReasons),
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function toRuntimeLessonNodeInput(entry: RuntimeLessonResourceCatalogEntry): RuntimeLessonNodeInput {
  const lessonId = entry.lesson.lesson_id || entry.graphOverlay.lesson_id;
  return {
    lessonId,
    title: entry.lesson.title,
    knowledgeNodeIds: uniqueSorted([
      ...entry.graphOverlay.focus_node_ids,
      ...entry.graphOverlay.card_order,
      ...entry.graphOverlay.nodes.map((node) => node.id),
    ]),
    handoutPath: entry.handoutPath,
    handoutPdfPath: entry.handoutPdfPath,
    handoutSourcePath: entry.handoutSourcePath,
    handoutSourceHash: entry.handoutSourceHash,
    handoutSourceVersionRef: entry.handoutSourceVersionRef,
    mediaResources: entry.mediaResources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      kind: resource.kind,
      url: resource.url,
      filename: resource.filename,
    })),
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function mergeRegisteredPlanningOverride(
  config: Record<string, unknown>,
  registeredResource: RegisteredResourceNodeInput | undefined,
): Record<string, unknown> {
  if (!registeredResource?.planningOverride) return config;
  const existingPlanning = asRecord(config.resourceNodePlanning);
  return {
    ...config,
    resourceNodePlanning: {
      ...registeredResource.planningOverride,
      ...existingPlanning,
    },
  };
}

export function toTextbookUnitNodeInputs(
  entry: TextbookStructureRuntimeCatalogEntry,
): Array<TextbookSectionResourceNodeInput & { bookId: TextbookResourceNodeInput['bookId'] }> {
  return entry.units.map((unit) => ({
    bookId: entry.textbook.bookId,
    sectionId: unit.unitId,
    title: unit.title,
    citationHref: unit.citationHref,
    sourceHash: unit.sourceHash,
    sourceVersionRef: unit.sourceVersionRef,
    knowledgeNodeIds: unit.knowledgeNodeIds,
    capabilityTargetIds: unit.capabilityTargetIds,
    estimatedTimeMinutes: unit.estimatedTimeMinutes,
  }));
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

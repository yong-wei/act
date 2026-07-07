import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  applyCoreResourcePathReadinessDispositions,
  buildResourceNodeRegistry,
  type KnowledgeNodeResourceInput,
  type RegisteredResourceNodeInput,
  type ResourceNodeRegistry,
  type RuntimeResourceProjectionInput,
  type RuntimeLessonNodeInput,
  type TextbookResourceNodeInput,
  type TextbookSectionResourceNodeInput,
  type TeachingResourceNodeInput,
} from './resource-node-registry';
import type { RuntimeLessonResourceCatalogEntry } from './course-runtime';
import type { TextbookRuntimeResourceCatalogEntry } from './textbook-runtime-resources';

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

export function buildResourceNodeRegistryFromTeachingResources(
  resources: readonly ResourceWithKnowledgeNodes[],
  registeredResources: readonly RegisteredResourceNodeInput[] = [],
  runtimeLessons: readonly RuntimeLessonResourceCatalogEntry[] = [],
  runtimeTextbooks: readonly TextbookRuntimeResourceCatalogEntry[] = [],
  runtimeResourceProjections: readonly RuntimeResourceProjectionInput[] = [],
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
    teachingResources,
    registeredResources: [...registeredResources],
    knowledgeNodes: Array.from(knowledgeNodesById.values()),
    runtimeLessons: runtimeLessons.map(toRuntimeLessonNodeInput),
    runtimeResourceProjections: [...runtimeResourceProjections],
    textbooks: runtimeTextbooks.map((entry) => entry.textbook),
    textbookSections: runtimeTextbooks.flatMap(toTextbookSectionNodeInputs),
  }));
}

export async function loadRuntimeResourceProjectionInputs(): Promise<RuntimeResourceProjectionInput[]> {
  try {
    const content = await readFile(RUNTIME_RESOURCE_PROJECTIONS_PATH, 'utf8');
    return content
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RuntimeResourceProjectionInput);
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function toRuntimeLessonNodeInput(entry: RuntimeLessonResourceCatalogEntry): RuntimeLessonNodeInput {
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

function toTextbookSectionNodeInputs(
  entry: TextbookRuntimeResourceCatalogEntry,
): Array<TextbookSectionResourceNodeInput & { bookId: TextbookResourceNodeInput['bookId'] }> {
  return entry.sections.map((section) => ({
    ...section,
    bookId: entry.textbook.bookId,
  }));
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

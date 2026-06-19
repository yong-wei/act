import {
  buildResourceNodeRegistry,
  type KnowledgeNodeResourceInput,
  type RegisteredResourceNodeInput,
  type ResourceNodeRegistry,
  type RuntimeLessonNodeInput,
  type TeachingResourceNodeInput,
} from './resource-node-registry';
import type { RuntimeLessonResourceCatalogEntry } from './course-runtime';

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
): ResourceNodeRegistry {
  const knowledgeNodesById = new Map<string, KnowledgeNodeResourceInput>();

  const teachingResources: TeachingResourceNodeInput[] = resources.map((resource) => {
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
      knowledgeNodeIds: (resource.knowledgeNodes ?? []).map((node) => node.id),
      config: asRecord(resource.config),
    };
  });

  return buildResourceNodeRegistry({
    teachingResources,
    registeredResources: [...registeredResources],
    knowledgeNodes: Array.from(knowledgeNodesById.values()),
    runtimeLessons: runtimeLessons.map(toRuntimeLessonNodeInput),
  });
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

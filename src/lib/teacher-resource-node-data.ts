import {
  buildResourceNodeRegistry,
  type KnowledgeNodeResourceInput,
  type RegisteredResourceNodeInput,
  type ResourceNodeRegistry,
  type TeachingResourceNodeInput,
} from './resource-node-registry';

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
  });
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

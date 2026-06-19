import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { TeacherResourceNodeManagement } from '@/features/teacher/resources/teacher-resource-node-management';
import { getServerAuthSession } from '@/lib/auth';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  type RuntimeLessonResourceCatalogEntry,
} from '@/lib/course-runtime';
import { prisma } from '@/lib/prisma';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { RESOURCE_NODE_TYPES } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  buildTeacherResourceNodeManagementSummary,
  canReadNode,
  createTeacherResourceNodeView,
  type TeacherResourceNodeScope,
} from '@/lib/teacher-resource-node-management';

export default async function TeacherResourceNodesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.TEACHER) {
    if (session.user.role === UserRole.ADMIN) {
      redirect('/admin');
    }
    redirect('/dashboard');
  }

  const resources = await prisma.teachingResource.findMany({
    where: { authorId: session.user.id },
    include: {
      knowledgeNodes: {
        select: {
          id: true,
          name: true,
          resources: true,
          tags: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
  });

  const runtimeLessons = await loadAllLessonRuntimeResourceCatalogEntries();
  const registeredResources = getAllRegisteredResourceMetadata();
  const registry = buildResourceNodeRegistryFromTeachingResources(resources, registeredResources, runtimeLessons);
  const scope = createScope(session.user.id, resources, registeredResources, runtimeLessons);
  const nodes = registry.nodes.filter((node) => canReadNode(node, scope));

  return (
    <TeacherResourceNodeManagement
      initialNodes={nodes.map((node) => createTeacherResourceNodeView(node, scope))}
      initialSummary={buildTeacherResourceNodeManagementSummary(nodes)}
      supportedTypes={RESOURCE_NODE_TYPES}
    />
  );
}

function createScope(
  teacherId: string,
  resources: ReadonlyArray<{ id: string; knowledgeNodes?: Array<{ id: string }> }>,
  registeredResources: ReadonlyArray<{ id: string }>,
  runtimeLessons: ReadonlyArray<RuntimeLessonResourceCatalogEntry>,
): TeacherResourceNodeScope {
  const resourceIds = resources.map((resource) => resource.id);
  const registeredResourceIds = registeredResources.map((resource) => resource.id);
  const knowledgeNodeIds = resources.flatMap((resource) => resource.knowledgeNodes?.map((node) => node.id) ?? []);
  const knowledgeCardIds = knowledgeNodeIds.map((id) => `${id}:card`);
  const runtimeSourceRefs = runtimeLessons.flatMap((lesson) => {
    const lessonId = lesson.lesson.lesson_id || lesson.graphOverlay.lesson_id;
    return [
      lessonId,
      ...lesson.mediaResources.map((resource) => `${lessonId}:${resource.id}`),
    ];
  });
  const runtimeKnowledgeNodeIds = runtimeLessons.flatMap((lesson) => [
    ...lesson.graphOverlay.focus_node_ids,
    ...lesson.graphOverlay.card_order,
    ...lesson.graphOverlay.nodes.map((node) => node.id),
  ]);
  const runtimeKnowledgeCardIds = runtimeKnowledgeNodeIds.map((id) => `${id}:card`);
  return {
    role: 'TEACHER',
    teacherId,
    readableSourceRefs: new Set([
      ...resourceIds,
      ...registeredResourceIds,
      ...knowledgeNodeIds,
      ...knowledgeCardIds,
      ...runtimeSourceRefs,
      ...runtimeKnowledgeNodeIds,
      ...runtimeKnowledgeCardIds,
    ]),
    editableSourceRefs: new Set(resourceIds),
  };
}

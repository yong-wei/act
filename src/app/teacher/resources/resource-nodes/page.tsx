import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { TeacherResourceNodeManagement } from '@/features/teacher/resources/teacher-resource-node-management';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

  const registry = buildResourceNodeRegistryFromTeachingResources(resources);
  const scope = createScope(session.user.id, resources);
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
): TeacherResourceNodeScope {
  const resourceIds = resources.map((resource) => resource.id);
  const knowledgeNodeIds = resources.flatMap((resource) => resource.knowledgeNodes?.map((node) => node.id) ?? []);
  const knowledgeCardIds = knowledgeNodeIds.map((id) => `${id}:card`);
  return {
    role: 'TEACHER',
    teacherId,
    readableSourceRefs: new Set([...resourceIds, ...knowledgeNodeIds, ...knowledgeCardIds]),
    editableSourceRefs: new Set(resourceIds),
  };
}

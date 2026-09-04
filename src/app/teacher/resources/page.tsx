import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { prisma } from '@/lib/prisma';
import { TeacherResourceManager } from '@/features/teacher/teacher-resource-manager';

export default async function ResourcesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect(buildLoginRedirectForPath('/teacher/resources'));
  }

  if (session.user.role !== UserRole.TEACHER) {
    if (session.user.role === UserRole.ADMIN) {
      redirect('/admin');
    }
    redirect('/dashboard');
  }

  // 获取所有教学资源
  const resources = await prisma.teachingResource.findMany({
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
  });

  // 获取所有知识节点
  const knowledgeNodes = await prisma.knowledgeNode.findMany({
    include: {
      sourceLinks: {
        include: {
          targetNode: {
            select: { id: true, name: true, nodeType: true },
          },
        },
      },
      targetLinks: {
        include: {
          sourceNode: {
            select: { id: true, name: true, nodeType: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics="path-eligible"
    >
      <TeacherResourceManager
        resources={resources.map((r) => ({
          id: r.id,
          title: r.title,
          displayName: r.displayName,
          description: r.description,
          type: r.type,
          registryId: r.registryId,
          category: r.category,
          teacherOnly: r.teacherOnly,
          displayOrder: r.displayOrder,
        }))}
        knowledgeNodes={knowledgeNodes.map((n) => ({
          id: n.id,
          name: n.name,
          description: n.description,
          nodeType: n.nodeType,
          metadata: n.metadata as any,
          sourceLinks: n.sourceLinks.map((l) => ({
            relation: l.relation,
            targetNode: l.targetNode,
          })),
          targetLinks: n.targetLinks.map((l) => ({
            relation: l.relation,
            sourceNode: l.sourceNode,
          })),
        }))}
      />
    </div>
  );
}

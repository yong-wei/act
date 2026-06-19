import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  type RuntimeLessonResourceCatalogEntry,
} from '@/lib/course-runtime';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { RESOURCE_NODE_TYPES, type ResourceNodeType } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  buildTeacherResourceNodeManagementSummary,
  canReadNode,
  createTeacherResourceNodeView,
  filterTeacherResourceNodes,
  type ResourceNodeKnowledgeMappingFilter,
  type ResourceNodePathEligibilityFilter,
  type TeacherResourceNodeScope,
} from '@/lib/teacher-resource-node-management';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const resources = await prisma.teachingResource.findMany({
      where: session.user.role === 'TEACHER' ? { authorId: session.user.id } : {},
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

    const registeredResources = getAllRegisteredResourceMetadata();
    const runtimeLessons = await loadAllLessonRuntimeResourceCatalogEntries();
    const registry = buildResourceNodeRegistryFromTeachingResources(resources, registeredResources, runtimeLessons);
    const scope = createScope(session.user.role, session.user.id, resources, registeredResources, runtimeLessons);
    const { searchParams } = new URL(request.url);
    const scopedNodes = registry.nodes.filter((node) => canReadNode(node, scope));
    const filteredNodes = filterTeacherResourceNodes(scopedNodes, {
      query: searchParams.get('q'),
      nodeType: parseNodeType(searchParams.get('nodeType')),
      courseModule: searchParams.get('courseModule'),
      knowledge: searchParams.get('knowledge'),
      knowledgeMapping: parseKnowledgeMapping(searchParams.get('knowledgeMapping')),
      availability: searchParams.get('availability') as never,
      teacherPolicy: searchParams.get('teacherPolicy') as never,
      privacyLevel: searchParams.get('privacyLevel') as never,
      pathEligibility: parsePathEligibility(searchParams.get('pathEligibility')),
    });

    return NextResponse.json({
      nodes: filteredNodes.map((node) => createTeacherResourceNodeView(node, scope)),
      summary: buildTeacherResourceNodeManagementSummary(filteredNodes),
      audit: registry.audit,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('ResourceNode 管理列表加载失败:', error);
    return NextResponse.json({ error: 'ResourceNode 管理列表加载失败' }, { status: 500 });
  }
}

function createScope(
  role: string,
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
    role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
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

function parseNodeType(value: string | null): ResourceNodeType | 'all' | null {
  if (!value) return null;
  if (value === 'all') return value;
  return RESOURCE_NODE_TYPES.includes(value as ResourceNodeType) ? value as ResourceNodeType : null;
}

function parseKnowledgeMapping(value: string | null): ResourceNodeKnowledgeMappingFilter | null {
  if (value === 'mapped' || value === 'unmapped' || value === 'all') return value;
  return null;
}

function parsePathEligibility(value: string | null): ResourceNodePathEligibilityFilter | null {
  if (value === 'eligible' || value === 'excluded' || value === 'all') return value;
  return null;
}

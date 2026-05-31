import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { buildResourceNodeRegistryFromTeachingResources, asRecord } from '@/lib/teacher-resource-node-data';
import {
  applyTeacherResourceNodePatch,
  createTeacherResourceNodeView,
  type TeacherResourceNodePatch,
  type TeacherResourceNodeScope,
} from '@/lib/teacher-resource-node-management';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { nodeId } = await params;
    const sourceRef = parseTeachingResourceSourceRef(nodeId);
    const patch = await request.json() as TeacherResourceNodePatch;

    const resource = sourceRef
      ? await prisma.teachingResource.findFirst({
          where: {
            id: sourceRef,
            ...(session.user.role === 'TEACHER' ? { authorId: session.user.id } : {}),
          },
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
        })
      : null;

    if (!resource) {
      return NextResponse.json({
        code: 'RESOURCE_NODE_FORBIDDEN',
        error: '资源不存在或无权管理。',
      }, { status: 403 });
    }

    const scopedResources = await prisma.teachingResource.findMany({
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
    const registry = buildResourceNodeRegistryFromTeachingResources(scopedResources, registeredResources);
    const node = registry.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return NextResponse.json({
        code: 'RESOURCE_NODE_FORBIDDEN',
        error: '资源不存在或无权管理。',
      }, { status: 403 });
    }

    const scope = createScope(session.user.role, session.user.id, scopedResources, registeredResources);
    const patchResult = applyTeacherResourceNodePatch({ node, scope, patch });
    if (!patchResult.ok) {
      return NextResponse.json({
        code: patchResult.code,
        error: patchResult.error,
      }, { status: patchResult.status });
    }

    const currentConfig = asRecord(resource.config);
    const currentPlanning = asRecord(currentConfig.resourceNodePlanning);
    const nextConfig = {
      ...currentConfig,
      resourceNodePlanning: {
        ...currentPlanning,
        ...patchResult.persistablePatch.resourceNodePlanning,
      },
    };

    const updatedResource = await prisma.teachingResource.update({
      where: { id: resource.id },
      data: {
        ...(patchResult.persistablePatch.displayName !== undefined
          ? { displayName: patchResult.persistablePatch.displayName }
          : {}),
        ...(patchResult.persistablePatch.description !== undefined
          ? { description: patchResult.persistablePatch.description }
          : {}),
        config: nextConfig,
      },
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
    });

    const updatedRegistry = buildResourceNodeRegistryFromTeachingResources(
      scopedResources.map((candidate) => candidate.id === updatedResource.id ? updatedResource : candidate),
      registeredResources,
    );
    const updatedNode = updatedRegistry.nodes.find((candidate) => candidate.id === nodeId) ?? node;

    return NextResponse.json({
      node: createTeacherResourceNodeView(updatedNode, scope),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('ResourceNode 规划元数据更新失败:', error);
    return NextResponse.json({ error: 'ResourceNode 规划元数据更新失败' }, { status: 500 });
  }
}

function parseTeachingResourceSourceRef(nodeId: string): string | null {
  const decoded = decodeURIComponent(nodeId);
  return decoded.startsWith('teaching-resource:') ? decoded.slice('teaching-resource:'.length) : null;
}

function createScope(
  role: string,
  teacherId: string,
  resources: ReadonlyArray<{ id: string; knowledgeNodes?: Array<{ id: string }> }>,
  registeredResources: ReadonlyArray<{ id: string }>,
): TeacherResourceNodeScope {
  const resourceIds = resources.map((resource) => resource.id);
  const registeredResourceIds = registeredResources.map((resource) => resource.id);
  const knowledgeNodeIds = resources.flatMap((resource) => resource.knowledgeNodes?.map((node) => node.id) ?? []);
  const knowledgeCardIds = knowledgeNodeIds.map((id) => `${id}:card`);
  return {
    role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
    teacherId,
    readableSourceRefs: new Set([...resourceIds, ...registeredResourceIds, ...knowledgeNodeIds, ...knowledgeCardIds]),
    editableSourceRefs: new Set(resourceIds),
  };
}

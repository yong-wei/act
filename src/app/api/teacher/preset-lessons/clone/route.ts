/**
 * 预置教案克隆 API
 *
 * POST /api/teacher/preset-lessons/clone
 * 将预置教案克隆为教师自己的教案
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons';
import { BopppsStage, LessonItemType, ResourceType } from '@prisma/client';

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 解析请求
    const body = await request.json();
    const { presetKey } = body;

    if (!presetKey) {
      return NextResponse.json({ error: 'presetKey is required' }, { status: 400 });
    }

    // 查找预置配置
    const preset = ALL_PRESETS.find((p) => p.key === presetKey);
    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    // 为每个环节查找或创建 TeachingResource
    const itemsToCreate = [];

    for (const item of preset.items) {
      const isKnowledgeNode = item.itemType === LessonItemType.KNOWLEDGE_NODE || !!item.knowledgeNodeId;

      if (isKnowledgeNode) {
        if (!item.knowledgeNodeId) {
          throw new Error(`Knowledge node id missing for preset item: ${item.title}`);
        }
        const knowledgeNode = await prisma.knowledgeNode.findUnique({
          where: { id: item.knowledgeNodeId },
          select: { id: true },
        });
        if (!knowledgeNode) {
          throw new Error(`Knowledge node not found: ${item.knowledgeNodeId}`);
        }

        itemsToCreate.push({
          itemType: LessonItemType.KNOWLEDGE_NODE,
          knowledgeNodeId: item.knowledgeNodeId,
          stage: item.stage as BopppsStage,
          order: item.order,
          duration: item.duration,
          overrideConfig: {
            titleOverride: item.title,
            descriptionOverride: item.description,
            ...((item.config || {}) as object),
          },
        });
        continue;
      }

      if (!item.registryId) {
        throw new Error(`RegistryId missing for preset item: ${item.title}`);
      }

      // 尝试查找已有的资源
      let resource = await prisma.teachingResource.findFirst({
        where: { registryId: item.registryId },
      });

      // 如果资源不存在，创建一个
      if (!resource) {
        resource = await prisma.teachingResource.create({
          data: {
            title: item.title,
            description: item.description || '',
            type: item.resourceType || ResourceType.INTERACTIVE_COMP,
            registryId: item.registryId,
            config: (item.config || {}) as object,
            authorId: user.id,
          },
        });
      }

      itemsToCreate.push({
        itemType: LessonItemType.RESOURCE,
        resourceId: resource.id,
        stage: item.stage as BopppsStage,
        order: item.order,
        duration: item.duration,
        overrideConfig: {
          titleOverride: item.title,
          descriptionOverride: item.description,
          ...((item.config || {}) as object),
        },
      });
    }

    // 创建新的教案
    const lessonPlan = await prisma.lessonPlan.create({
      data: {
        title: `${preset.title} (副本)`,
        description: preset.description,
        authorId: user.id,
        isPreset: false,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      lessonPlanId: lessonPlan.id,
      message: `成功克隆预置教案 "${preset.title}"`,
    });
  } catch (error) {
    console.error('Error cloning preset lesson:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: 500 }
    );
  }
}

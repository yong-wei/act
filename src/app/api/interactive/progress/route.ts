import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/interactive/progress
 *
 * 获取用户对某资源的学习进度
 *
 * Query params:
 * - resourceId: 资源 ID（必需）
 * - userId: 用户 ID（可选，仅教师可用）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const requestedUserId = searchParams.get('userId');

    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
    }

    // 确定要查询的用户 ID
    let targetUserId = session.user.id;

    if (requestedUserId && requestedUserId !== session.user.id) {
      // 只有教师和管理员可以查看其他用户的进度
      if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetUserId = requestedUserId;
    }

    // 获取资源关联的知识节点
    const resource = await prisma.teachingResource.findUnique({
      where: { id: resourceId },
      include: {
        knowledgeNodes: {
          select: { id: true },
        },
      },
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // 获取关联知识节点的进度
    const nodeIds = resource.knowledgeNodes.map((n) => n.id);
    let knowledgeProgress = null;

    if (nodeIds.length > 0) {
      knowledgeProgress = await prisma.knowledgeProgress.findFirst({
        where: {
          userId: targetUserId,
          nodeId: { in: nodeIds },
        },
        orderBy: { lastVisited: 'desc' },
      });
    }

    // 获取最近的互动事件统计
    const recentEvents = await prisma.interactionLog.aggregate({
      where: {
        userId: targetUserId,
        resourceId,
      },
      _count: { id: true },
      _max: { createdAt: true },
    });

    // 检查是否完成
    const completionEvent = await prisma.interactionLog.findFirst({
      where: {
        userId: targetUserId,
        resourceId,
        eventType: 'complete',
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      resourceId,
      userId: targetUserId,
      progress: knowledgeProgress?.progress ?? 0,
      status: knowledgeProgress?.status ?? 'NOT_STARTED',
      timeSpent: knowledgeProgress?.timeSpent ?? 0,
      isComplete: !!completionEvent,
      completedAt: completionEvent?.createdAt ?? null,
      lastVisited: recentEvents._max.createdAt ?? null,
      totalInteractions: recentEvents._count.id,
    });
  } catch (error) {
    console.error('[Interactive Progress API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/interactive/progress
 *
 * 更新用户对某资源的学习进度
 *
 * Body:
 * - resourceId: 资源 ID（必需）
 * - progress: 进度值 0-100（可选）
 * - timeSpent: 累计时间（秒）（可选）
 * - isComplete: 是否完成（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resourceId, progress, timeSpent, isComplete } = body;

    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
    }

    // 获取资源关联的知识节点
    const resource = await prisma.teachingResource.findUnique({
      where: { id: resourceId },
      include: {
        knowledgeNodes: {
          select: { id: true },
        },
      },
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // 如果有关联知识节点，更新 KnowledgeProgress
    const nodeIds = resource.knowledgeNodes.map((n) => n.id);

    if (nodeIds.length > 0) {
      // 更新第一个关联的知识节点进度
      const nodeId = nodeIds[0];

      const updateData: Record<string, unknown> = {
        lastVisited: new Date(),
      };

      if (typeof progress === 'number') {
        updateData.progress = Math.max(0, Math.min(100, progress));
      }

      if (typeof timeSpent === 'number') {
        updateData.timeSpent = { increment: timeSpent };
      }

      if (isComplete) {
        updateData.status = 'COMPLETED';
        updateData.completedAt = new Date();
        updateData.progress = 100;
      } else if (typeof progress === 'number' && progress > 0) {
        updateData.status = 'IN_PROGRESS';
      }

      const updated = await prisma.knowledgeProgress.upsert({
        where: {
          userId_nodeId: {
            userId: session.user.id,
            nodeId,
          },
        },
        update: updateData,
        create: {
          userId: session.user.id,
          nodeId,
          progress: typeof progress === 'number' ? progress : 0,
          status: isComplete ? 'COMPLETED' : (progress && progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'),
          timeSpent: typeof timeSpent === 'number' ? timeSpent : 0,
          completedAt: isComplete ? new Date() : null,
        },
      });

      return NextResponse.json({
        success: true,
        progress: updated,
      });
    }

    // 如果没有关联知识节点，仅返回成功
    return NextResponse.json({
      success: true,
      message: 'No knowledge node associated with this resource',
    });
  } catch (error) {
    console.error('[Interactive Progress API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

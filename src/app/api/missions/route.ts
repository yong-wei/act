/**
 * 任务列表 API
 *
 * 获取所有任务及用户的完成进度
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildFeedbackTaskContext,
  getFeedbackTaskMissionTarget,
  hasFeedbackTaskQuery,
} from '@/lib/student-feedback-task-contract';

export const dynamic = 'force-dynamic';

export interface MissionWithProgress {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  order: number;
  objectives: string[];
  seaStateConfig: {
    level: number;
    waveHeight: number;
    windSpeed: number;
  };
  unlockCriteria: {
    requiredScore?: number;
    requiredMissionId?: string;
  };
  status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
  bestScore?: number;
  completedAt?: Date;
}

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const feedbackContext = buildFeedbackTaskContext({
      assignment: url.searchParams.get('assignment') ?? url.searchParams.get('q'),
      status: url.searchParams.get('status'),
      returnTo: url.searchParams.get('returnTo'),
      intent: url.searchParams.get('intent'),
    });
    const feedbackScoped = hasFeedbackTaskQuery({
      assignment: url.searchParams.get('assignment') ?? url.searchParams.get('q'),
    });

    // 获取所有任务
    const missions = await prisma.mission.findMany({
      orderBy: { order: 'asc' },
    });

    // 获取用户进度
    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
    });

    // 构建进度映射
    const progressMap = new Map(
      userProgress.map((p) => [p.missionId, p])
    );

    // 组合任务和进度
    const missionsWithProgress: MissionWithProgress[] = missions.map((mission) => {
      const progress = progressMap.get(mission.id);

      // 确定任务状态
      let status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED' = 'LOCKED';

      if (progress) {
        status = progress.status as 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
      } else if (mission.order === 1) {
        // 第一关默认解锁
        status = 'UNLOCKED';
      }

      return {
        id: mission.id,
        title: mission.title,
        description: mission.description || '',
        difficulty: mission.difficulty as MissionWithProgress['difficulty'],
        order: mission.order,
        objectives: (mission.objectives as string[]) || [],
        seaStateConfig: (mission.seaStateConfig as MissionWithProgress['seaStateConfig']) || {
          level: 3,
          waveHeight: 1.0,
          windSpeed: 10,
        },
        unlockCriteria: (mission.unlockCriteria as MissionWithProgress['unlockCriteria']) || {},
        status,
        bestScore: progress?.bestScore ?? undefined,
        completedAt: progress?.completedAt ?? undefined,
      };
    });

    const feedbackTarget = feedbackContext ? getFeedbackTaskMissionTarget(feedbackContext) : null;
    const scopedMissions = feedbackScoped && feedbackContext
      ? feedbackTarget
        ? missionsWithProgress.filter((mission) => feedbackTarget.missionOrders.includes(mission.order))
        : []
      : missionsWithProgress;
    const statisticsMissions = feedbackScoped ? scopedMissions : missionsWithProgress;
    const unlockedCount = feedbackScoped
      ? statisticsMissions.filter((mission) => mission.status === 'UNLOCKED').length
      : userProgress.filter((progress) => progress.status === 'UNLOCKED').length
        + (missions.length > 0 && !progressMap.has(missions[0].id) ? 1 : 0);

    return NextResponse.json({
      feedbackTask: feedbackContext,
      feedbackMissionTarget: feedbackTarget,
      missions: scopedMissions,
      statistics: {
        total: statisticsMissions.length,
        completed: statisticsMissions.filter((mission) => mission.status === 'COMPLETED').length,
        unlocked: unlockedCount,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('获取任务列表失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

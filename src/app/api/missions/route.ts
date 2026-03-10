/**
 * 任务列表 API
 *
 * 获取所有任务及用户的完成进度
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

export async function GET() {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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

    return NextResponse.json({
      missions: missionsWithProgress,
      statistics: {
        total: missions.length,
        completed: userProgress.filter((p) => p.status === 'COMPLETED').length,
        unlocked: userProgress.filter((p) => p.status === 'UNLOCKED').length + (missions.length > 0 && !progressMap.has(missions[0].id) ? 1 : 0),
      },
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

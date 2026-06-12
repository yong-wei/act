'use server';

/**
 * 任务相关 Server Actions
 *
 * 处理任务完成、解锁等操作
 */

import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

interface CompleteMissionResult {
  success: boolean;
  message: string;
  score?: number;
  unlockedMissions?: string[];
  techScoreAdded?: number;
}
type ActionSession = {
  user?: {
    id?: string | null;
    role?: string | null;
  } | null;
} | null;

const getAuthenticatedActionUser = (session: ActionSession) => {
  const user = session?.user;
  const userId = user?.id;
  if (!userId) {
    return null;
  }
  return {
    id: userId,
    role: user.role ?? 'STUDENT',
  };
};

/**
 * 完成任务
 *
 * @param missionId - 任务ID
 * @param score - 得分
 * @param simulationLogId - 关联的仿真记录ID
 */
export async function completeMission(
  missionId: string,
  score: number,
  simulationLogId?: string
): Promise<CompleteMissionResult> {
  try {
    const session = await getServerSession(authOptions);
    const actionUser = getAuthenticatedActionUser(session);

    if (!actionUser) {
      return { success: false, message: '未授权' };
    }

    const userId = actionUser.id;

    // 获取任务信息
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
    });

    if (!mission) {
      return { success: false, message: '任务不存在' };
    }

    // 检查用户是否有权限完成此任务
    const currentProgress = await prisma.userProgress.findUnique({
      where: {
        userId_missionId: {
          userId,
          missionId,
        },
      },
    });

    // 如果是第一关且没有记录，自动创建
    if (!currentProgress && mission.order === 1) {
      await prisma.userProgress.create({
        data: {
          userId,
          missionId,
          status: 'UNLOCKED',
        },
      });
    } else if (!currentProgress || currentProgress.status === 'LOCKED') {
      return { success: false, message: '任务未解锁' };
    }

    if (simulationLogId) {
      const ownedSimulationLog = await prisma.simulationLog.findFirst({
        where: {
          id: simulationLogId,
          userId,
        },
        select: { id: true },
      });
      if (!ownedSimulationLog) {
        return { success: false, message: '无权关联该仿真记录' };
      }
    }

    // 更新或创建进度记录
    const isFirstCompletion = currentProgress?.status !== 'COMPLETED';
    const isNewBest = !currentProgress?.bestScore || score > currentProgress.bestScore;

    await prisma.userProgress.upsert({
      where: {
        userId_missionId: {
          userId,
          missionId,
        },
      },
      update: {
        status: 'COMPLETED',
        bestScore: isNewBest ? score : currentProgress?.bestScore,
        completedAt: isFirstCompletion ? new Date() : currentProgress?.completedAt,
      },
      create: {
        userId,
        missionId,
        status: 'COMPLETED',
        bestScore: score,
        completedAt: new Date(),
      },
    });

    // 更新仿真记录的任务关联
    if (simulationLogId) {
      await prisma.simulationLog.update({
        where: { id: simulationLogId },
        data: {
          missionId,
          score,
        },
      });
    }

    // 计算技术分增加
    const techScoreAdded = isFirstCompletion
      ? calculateTechScoreBonus(mission.difficulty, score)
      : 0;

    // 更新用户技术分
    if (techScoreAdded > 0) {
      await prisma.studentProfile.upsert({
        where: { userId },
        update: {
          techScore: { increment: techScoreAdded },
        },
        create: {
          userId,
          techScore: techScoreAdded,
        },
      });
    }

    // 尝试解锁下一关
    const unlockedMissions = await unlockNextMissions(userId, missionId, score);

    revalidatePath('/missions');
    revalidatePath('/profile');

    return {
      success: true,
      message: isFirstCompletion ? '恭喜首次完成任务！' : '任务完成',
      score,
      unlockedMissions,
      techScoreAdded,
    };
  } catch (error) {
    console.error('完成任务失败:', error);
    return { success: false, message: '服务器错误' };
  }
}

/**
 * 解锁下一个任务
 */
async function unlockNextMissions(
  userId: string,
  completedMissionId: string,
  score: number
): Promise<string[]> {
  const unlockedIds: string[] = [];

  // 查找需要此任务作为前置的任务
  const dependentMissions = await prisma.mission.findMany({
    where: {
      unlockCriteria: {
        path: ['requiredMissionId'],
        equals: completedMissionId,
      },
    },
  });

  for (const mission of dependentMissions) {
    const criteria = mission.unlockCriteria as {
      requiredScore?: number;
      requiredMissionId?: string;
    };

    // 检查分数要求
    if (criteria.requiredScore && score < criteria.requiredScore) {
      continue;
    }

    // 检查是否已解锁
    const existingProgress = await prisma.userProgress.findUnique({
      where: {
        userId_missionId: {
          userId,
          missionId: mission.id,
        },
      },
    });

    if (existingProgress && existingProgress.status !== 'LOCKED') {
      continue;
    }

    // 解锁任务
    await prisma.userProgress.upsert({
      where: {
        userId_missionId: {
          userId,
          missionId: mission.id,
        },
      },
      update: {
        status: 'UNLOCKED',
      },
      create: {
        userId,
        missionId: mission.id,
        status: 'UNLOCKED',
      },
    });

    unlockedIds.push(mission.id);
  }

  // 同时检查按顺序解锁的下一关
  const completedMission = await prisma.mission.findUnique({
    where: { id: completedMissionId },
  });

  if (completedMission) {
    const nextMission = await prisma.mission.findFirst({
      where: {
        order: completedMission.order + 1,
      },
    });

    if (nextMission && !unlockedIds.includes(nextMission.id)) {
      const existingProgress = await prisma.userProgress.findUnique({
        where: {
          userId_missionId: {
            userId,
            missionId: nextMission.id,
          },
        },
      });

      if (!existingProgress || existingProgress.status === 'LOCKED') {
        await prisma.userProgress.upsert({
          where: {
            userId_missionId: {
              userId,
              missionId: nextMission.id,
            },
          },
          update: {
            status: 'UNLOCKED',
          },
          create: {
            userId,
            missionId: nextMission.id,
            status: 'UNLOCKED',
          },
        });

        unlockedIds.push(nextMission.id);
      }
    }
  }

  return unlockedIds;
}

/**
 * 计算技术分奖励
 */
function calculateTechScoreBonus(
  difficulty: string,
  score: number
): number {
  const baseBonus: Record<string, number> = {
    EASY: 5,
    MEDIUM: 10,
    HARD: 20,
    EXPERT: 40,
  };

  const base = baseBonus[difficulty] || 5;

  // 根据得分计算倍率
  if (score >= 90) return Math.round(base * 1.5);
  if (score >= 75) return Math.round(base * 1.2);
  if (score >= 60) return base;
  return Math.round(base * 0.5);
}

/**
 * 获取单个任务详情
 */
export async function getMissionDetail(missionId: string) {
  try {
    const session = await getServerSession(authOptions);
    const actionUser = getAuthenticatedActionUser(session);

    if (!actionUser) {
      return null;
    }

    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
    });

    if (!mission) {
      return null;
    }

    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_missionId: {
          userId: actionUser.id,
          missionId,
        },
      },
    });

    return {
      ...mission,
      status: progress?.status || (mission.order === 1 ? 'UNLOCKED' : 'LOCKED'),
      bestScore: progress?.bestScore,
      completedAt: progress?.completedAt,
    };
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return null;
  }
}

/**
 * 初始化用户任务进度（新用户自动解锁第一关）
 */
export async function initializeUserProgress(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    const actionUser = getAuthenticatedActionUser(session);
    if (!actionUser || (actionUser.id !== userId && actionUser.role !== 'ADMIN')) {
      return;
    }

    // 检查是否已有进度记录
    const existingProgress = await prisma.userProgress.findFirst({
      where: { userId },
    });

    if (existingProgress) {
      return; // 已有记录，无需初始化
    }

    // 获取第一关
    const firstMission = await prisma.mission.findFirst({
      where: { order: 1 },
    });

    if (firstMission) {
      await prisma.userProgress.create({
        data: {
          userId,
          missionId: firstMission.id,
          status: 'UNLOCKED',
        },
      });
    }
  } catch (error) {
    console.error('初始化用户进度失败:', error);
  }
}

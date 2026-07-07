/**
 * 用户同步与初始化辅助函数
 */

import { prisma } from '@/lib/prisma';
import { ProgressStatus } from '@prisma/client';

type UserProgressDb = Pick<typeof prisma, 'mission' | 'userProgress'>;

/**
 * 确保用户有学生档案，如果没有则创建
 */
export async function ensureUserProfile(userId: string) {
  return prisma.studentProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      techScore: 0,
      ethicsScore: 100, // 伦理分初始满分
    },
  });
}

/**
 * 初始化用户任务进度（解锁第一关）
 */
export async function initializeUserProgress(userId: string, db: UserProgressDb = prisma) {
  // 查找第一个任务（order 最小）
  const firstMission = await db.mission.findFirst({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  if (!firstMission) {
    return null;
  }

  return db.userProgress.upsert({
    where: {
      userId_missionId: {
        userId,
        missionId: firstMission.id,
      },
    },
    update: {},
    create: {
      userId,
      missionId: firstMission.id,
      status: ProgressStatus.UNLOCKED,
    },
  });
}

/**
 * 完成任务并解锁下一关
 * @returns 解锁的新任务列表
 */
export async function completeMissionAndUnlockNext(
  userId: string,
  missionId: string,
  score: number
): Promise<{ success: boolean; unlockedMissions: string[]; message: string }> {
  // 获取当前任务
  const currentMission = await prisma.mission.findUnique({
    where: { id: missionId },
  });

  if (!currentMission) {
    return { success: false, unlockedMissions: [], message: '任务不存在' };
  }

  // 更新当前任务进度
  await prisma.userProgress.upsert({
    where: {
      userId_missionId: { userId, missionId },
    },
    update: {
      status: score >= 60 ? ProgressStatus.COMPLETED : ProgressStatus.UNLOCKED,
      bestScore: {
        set: score,
      },
      attempts: { increment: 1 },
      completedAt: score >= 60 ? new Date() : null,
    },
    create: {
      userId,
      missionId,
      status: score >= 60 ? ProgressStatus.COMPLETED : ProgressStatus.UNLOCKED,
      bestScore: score,
      attempts: 1,
      completedAt: score >= 60 ? new Date() : null,
    },
  });

  // 更新用户技术分
  await prisma.studentProfile.upsert({
    where: { userId },
    update: {
      techScore: { increment: Math.max(0, score - 60) / 10 }, // 每超过60分1点增加0.1技术分
    },
    create: {
      userId,
      techScore: Math.max(0, score - 60) / 10,
      ethicsScore: 100,
    },
  });

  // 如果分数不够，不解锁下一关
  if (score < 60) {
    return { success: true, unlockedMissions: [], message: '分数未达到60分，请继续努力' };
  }

  // 查找下一关
  const nextMission = await prisma.mission.findFirst({
    where: {
      isActive: true,
      order: { gt: currentMission.order },
    },
    orderBy: { order: 'asc' },
  });

  if (!nextMission) {
    return { success: true, unlockedMissions: [], message: '恭喜！您已完成所有任务' };
  }

  // 解锁下一关
  await prisma.userProgress.upsert({
    where: {
      userId_missionId: { userId, missionId: nextMission.id },
    },
    update: {
      status: ProgressStatus.UNLOCKED,
    },
    create: {
      userId,
      missionId: nextMission.id,
      status: ProgressStatus.UNLOCKED,
    },
  });

  return {
    success: true,
    unlockedMissions: [nextMission.id],
    message: `任务完成！已解锁：${nextMission.title}`,
  };
}

/**
 * 获取用户所有任务进度
 */
export async function getUserMissionProgress(userId: string) {
  const missions = await prisma.mission.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: {
      progress: {
        where: { userId },
      },
    },
  });

  return missions.map((mission) => ({
    ...mission,
    userProgress: mission.progress[0] ?? {
      status: ProgressStatus.LOCKED,
      bestScore: null,
      attempts: 0,
    },
  }));
}

/**
 * 记录伦理违规并扣减伦理分
 */
export async function recordEthicalViolation(
  userId: string,
  simulationLogId: string,
  violationType: 'EXCESSIVE_RUDDER_RATE' | 'EXCESSIVE_ROLL_ANGLE' | 'COLLISION_RISK' | 'ENVIRONMENTAL_HAZARD' | 'SAFETY_VIOLATION',
  thresholdValue: number,
  actualValue: number,
  aiCritique?: string
) {
  // 创建伦理违规记录
  const ethicalLog = await prisma.ethicalLog.create({
    data: {
      simulationLogId,
      userId,
      violationType,
      thresholdValue,
      actualValue,
      aiCritique,
    },
  });

  // 扣减伦理分（每次违规扣5分，最低0分）
  await prisma.studentProfile.upsert({
    where: { userId },
    update: {
      ethicsScore: {
        decrement: 5,
      },
    },
    create: {
      userId,
      techScore: 0,
      ethicsScore: 95, // 100 - 5
    },
  });

  // 确保伦理分不低于0
  await prisma.studentProfile.updateMany({
    where: {
      userId,
      ethicsScore: { lt: 0 },
    },
    data: {
      ethicsScore: 0,
    },
  });

  return ethicalLog;
}

/**
 * 提交整改方案
 */
export async function submitJustification(
  ethicalLogId: string,
  studentJustification: string
) {
  return prisma.ethicalLog.update({
    where: { id: ethicalLogId },
    data: {
      studentJustification,
      isResolved: true,
      resolvedAt: new Date(),
    },
  });
}

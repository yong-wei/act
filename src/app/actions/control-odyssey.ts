'use server';

import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  CONTROL_SHOP_CONFIG,
  CONTROLLER_UPGRADE_RULES,
  type ControllerId,
  type LevelTier
} from '@/resources/interactive-learning/control-odyssey/level-data';

export interface LeaderboardEntry {
  rank: number;
  userName: string;
  userImage?: string | null;
  score: number;
  metrics: any;
  tier?: LevelTier;
  createdAt: Date;
}

export interface ControlProfileSnapshot {
  credits: number;
  unlocks: ControllerId[];
  tierProgress: ControlTierProgress;
  controllerLevels: ControlControllerLevels;
}

const DEFAULT_UNLOCKS: ControllerId[] = ['P'];
const TIER_ORDER: LevelTier[] = ['bronze', 'silver', 'gold'];

type ControlTierProgress = Record<string, LevelTier>;
type ControlControllerLevels = Record<ControllerId, number>;

const normalizeUnlocks = (value: unknown): ControllerId[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_UNLOCKS];
  }
  const filtered = value.filter((item) => typeof item === 'string') as ControllerId[];
  return filtered.length ? filtered : [...DEFAULT_UNLOCKS];
};

const DEFAULT_CONTROLLER_LEVELS: ControlControllerLevels = {
  P: 1,
  PI: 0,
  PD: 0,
  PID: 0,
  VFB: 0,
  FF: 0
};

const getUpgradeRule = (controllerId: ControllerId) =>
  CONTROLLER_UPGRADE_RULES.find((rule) => rule.controller === controllerId);

const normalizeControllerLevels = (
  value: unknown,
  unlocks: ControllerId[]
): ControlControllerLevels => {
  const levels: ControlControllerLevels = { ...DEFAULT_CONTROLLER_LEVELS };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, rawLevel]) => {
      if (!(key in levels)) return;
      if (typeof rawLevel !== 'number' || Number.isNaN(rawLevel)) return;
      const controllerId = key as ControllerId;
      const maxLevel = getUpgradeRule(controllerId)?.maxLevel ?? 10;
      levels[controllerId] = Math.max(0, Math.min(Math.floor(rawLevel), maxLevel));
    });
  }
  unlocks.forEach((controllerId) => {
    if (levels[controllerId] < 1) {
      levels[controllerId] = 1;
    }
  });
  return levels;
};

const normalizeTierProgress = (value: unknown): ControlTierProgress => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const progress: ControlTierProgress = {};
  Object.entries(value as Record<string, unknown>).forEach(([levelId, tier]) => {
    if (typeof tier === 'string' && TIER_ORDER.includes(tier as LevelTier)) {
      progress[levelId] = tier as LevelTier;
    }
  });
  return progress;
};

const resolveTierUnlock = (currentTier: LevelTier | undefined, completedTier?: LevelTier) => {
  if (!completedTier) return currentTier ?? 'bronze';
  const unlockTier = completedTier === 'bronze' ? 'silver' : 'gold';
  const currentIndex = TIER_ORDER.indexOf(currentTier ?? 'bronze');
  const unlockIndex = TIER_ORDER.indexOf(unlockTier);
  return TIER_ORDER[Math.max(currentIndex, unlockIndex)] ?? 'bronze';
};

export async function getControlProfile(): Promise<ControlProfileSnapshot | null> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return null;
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      controlCredits: true,
      controlUnlocks: true,
      controlOdysseyProgress: true,
      controlControllerLevels: true
    }
  });

  const unlocks = normalizeUnlocks(profile?.controlUnlocks);
  const credits = profile?.controlCredits ?? 0;
  const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);
  const controllerLevels = normalizeControllerLevels(profile?.controlControllerLevels, unlocks);

  if (!profile) {
    await prisma.studentProfile.create({
      data: {
        userId: session.user.id,
        controlCredits: credits,
        controlUnlocks: unlocks,
        controlOdysseyProgress: tierProgress,
        controlControllerLevels: controllerLevels
      }
    });
  } else if (!unlocks.includes('P')) {
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: { controlUnlocks: unlocks }
    });
  }

  return { credits, unlocks, tierProgress, controllerLevels };
}

export async function purchaseController(controllerId: ControllerId): Promise<ControlProfileSnapshot | null> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return null;
  }

  const item = CONTROL_SHOP_CONFIG.items.find((entry) => entry.unlocks.controller === controllerId);
  if (!item) {
    throw new Error('无效的控制器类型');
  }

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        controlCredits: true,
        controlUnlocks: true,
        controlOdysseyProgress: true,
        controlControllerLevels: true
      }
    });

    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const credits = profile?.controlCredits ?? 0;
    const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);
    const controllerLevels = normalizeControllerLevels(profile?.controlControllerLevels, unlocks);

    if (unlocks.includes(controllerId)) {
      return { credits, unlocks, tierProgress, controllerLevels };
    }

    const requires = item.requires ?? [];
    const missing = requires.filter((required) => !unlocks.includes(required));
    if (missing.length > 0) {
      throw new Error('未满足解锁条件');
    }

    if (
      controllerId === 'PID' &&
      ((controllerLevels.PI ?? 0) < 5 || (controllerLevels.PD ?? 0) < 5)
    ) {
      throw new Error('需先将 PI 与 PD 升至 5 级');
    }

    if (credits < item.price) {
      throw new Error('积分不足');
    }

    const nextUnlocks = [...unlocks, controllerId];
    const nextControllerLevels = {
      ...controllerLevels,
      [controllerId]: Math.max(controllerLevels[controllerId] ?? 0, 1)
    };
    const updated = await tx.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        controlCredits: { decrement: item.price },
        controlUnlocks: nextUnlocks,
        controlControllerLevels: nextControllerLevels
      },
      create: {
        userId: session.user.id,
        controlCredits: credits - item.price,
        controlUnlocks: nextUnlocks,
        controlControllerLevels: nextControllerLevels
      }
    });

    return {
      credits: updated.controlCredits,
      unlocks: normalizeUnlocks(updated.controlUnlocks),
      tierProgress,
      controllerLevels: normalizeControllerLevels(updated.controlControllerLevels, nextUnlocks)
    };
  });

  return result;
}

export async function upgradeController(controllerId: ControllerId): Promise<ControlProfileSnapshot | null> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return null;
  }

  const rule = getUpgradeRule(controllerId);
  if (!rule) {
    throw new Error('无效的升级类型');
  }

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        controlCredits: true,
        controlUnlocks: true,
        controlOdysseyProgress: true,
        controlControllerLevels: true
      }
    });

    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const credits = profile?.controlCredits ?? 0;
    const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);
    const controllerLevels = normalizeControllerLevels(profile?.controlControllerLevels, unlocks);

    if (!unlocks.includes(controllerId)) {
      throw new Error('控制器尚未解锁');
    }

    const currentLevel = controllerLevels[controllerId] ?? 0;
    if (currentLevel >= rule.maxLevel) {
      throw new Error('已达到最高等级');
    }

    const upgradePrice = Math.round(rule.basePrice * Math.pow(2, Math.max(0, currentLevel - 1)));
    if (credits < upgradePrice) {
      throw new Error('积分不足');
    }

    const nextLevels = {
      ...controllerLevels,
      [controllerId]: currentLevel + 1
    };

    const updated = await tx.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        controlCredits: { decrement: upgradePrice },
        controlControllerLevels: nextLevels
      },
      create: {
        userId: session.user.id,
        controlCredits: credits - upgradePrice,
        controlUnlocks: unlocks,
        controlControllerLevels: nextLevels
      }
    });

    return {
      credits: updated.controlCredits,
      unlocks: normalizeUnlocks(updated.controlUnlocks),
      tierProgress,
      controllerLevels: normalizeControllerLevels(updated.controlControllerLevels, unlocks)
    };
  });

  return result;
}

/**
 * 获取指定关卡的排行榜 (Top 50)
 */
export async function getLevelLeaderboard(levelId: string): Promise<LeaderboardEntry[]> {
  try {
    const logs = await prisma.simulationLog.findMany({
      where: {
        score: {
          not: null
        },
        OR: [
          { missionId: levelId },
          {
            inputParams: {
              path: ['levelId'],
              equals: levelId
            }
          }
        ]
      },
      orderBy: {
        score: 'desc'
      },
      take: 200,
      include: {
        user: {
          select: {
            name: true,
            image: true,
            email: true
          }
        }
      }
    });

    const seenUsers = new Set<string>();
    const uniqueLogs = logs.filter((log) => {
      if (seenUsers.has(log.userId)) return false;
      seenUsers.add(log.userId);
      return true;
    }).slice(0, 50);

    return uniqueLogs.map((log, index) => {
      const tier = (log.inputParams as { tier?: LevelTier } | null)?.tier;
      return ({
      rank: index + 1,
      userName: log.user.name || log.user.email?.split('@')[0] || 'Unknown Captain',
      userImage: log.user.image,
      score: log.score || 0,
      metrics: log.metrics,
      tier,
      createdAt: log.createdAt
      });
    });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}

/**
 * 提交游戏成绩
 */
export async function submitGameScore(
  levelId: string,
  score: number,
  metrics: any,
  context?: { runId?: string; tier?: string; controllerId?: ControllerId }
) {
  const session = await getServerAuthSession();
  
  if (!session?.user?.id) {
    // 未登录用户不记录（或可以记录匿名？）
    // 这里简单处理：仅记录登录用户
    console.log('User not logged in, score not saved.');
    return null;
  }

  try {
    const mission = await prisma.mission.findUnique({
      where: { id: levelId },
      select: { id: true }
    });

    const runId = context?.runId;
    if (runId) {
      const existingLog = await prisma.simulationLog.findFirst({
        where: {
          userId: session.user.id,
          inputParams: {
            path: ['runId'],
            equals: runId
          }
        }
      });
      if (existingLog) {
        return existingLog;
      }
    }

    const log = await prisma.simulationLog.create({
      data: {
        userId: session.user.id,
        missionId: mission?.id ?? null,
        controlMode: 'GAME',
        inputParams: {
          levelId,
          runId,
          tier: context?.tier,
          controllerId: context?.controllerId
        }, // 记录关卡与运行信息，避免重复提交
        metrics: metrics,
        score: score,
        isEthicalViolation: false, // 暂时默认为 false
      }
    });

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        controlCredits: true,
        controlUnlocks: true,
        controlOdysseyProgress: true,
        controlControllerLevels: true
      }
    });
    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const credits = profile?.controlCredits ?? 0;
    const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);
    const controllerLevels = normalizeControllerLevels(profile?.controlControllerLevels, unlocks);
    const completedTier = context?.tier && TIER_ORDER.includes(context.tier as LevelTier)
      ? (context.tier as LevelTier)
      : undefined;
    const nextTier = resolveTierUnlock(tierProgress[levelId], completedTier);
    const nextProgress = { ...tierProgress, [levelId]: nextTier };
    const nextUnlocks = unlocks.includes('P') ? unlocks : [...unlocks, 'P'];
    const creditsEarned = Math.floor(score / 100);

    await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        controlCredits: { increment: creditsEarned },
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress,
        controlControllerLevels: controllerLevels
      },
      create: {
        userId: session.user.id,
        controlCredits: credits + creditsEarned,
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress,
        controlControllerLevels: controllerLevels
      }
    });

    revalidatePath('/interactive-learning/control-odyssey');
    return log;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return null;
  }
}

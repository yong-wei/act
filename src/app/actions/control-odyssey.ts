'use server';

import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { CONTROL_SHOP_CONFIG, type ControllerId, type LevelTier } from '@/resources/interactive-learning/control-odyssey/level-data';

export interface LeaderboardEntry {
  rank: number;
  userName: string;
  userImage?: string | null;
  score: number;
  metrics: any;
  createdAt: Date;
}

export interface ControlProfileSnapshot {
  credits: number;
  unlocks: ControllerId[];
  tierProgress: ControlTierProgress;
}

const DEFAULT_UNLOCKS: ControllerId[] = ['P'];
const TIER_ORDER: LevelTier[] = ['bronze', 'silver', 'gold'];

type ControlTierProgress = Record<string, LevelTier>;

const normalizeUnlocks = (value: unknown): ControllerId[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_UNLOCKS];
  }
  const filtered = value.filter((item) => typeof item === 'string') as ControllerId[];
  return filtered.length ? filtered : [...DEFAULT_UNLOCKS];
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
    select: { controlCredits: true, controlUnlocks: true, controlOdysseyProgress: true }
  });

  const unlocks = normalizeUnlocks(profile?.controlUnlocks);
  const credits = profile?.controlCredits ?? 0;
  const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);

  if (!profile) {
    await prisma.studentProfile.create({
      data: {
        userId: session.user.id,
        controlCredits: credits,
        controlUnlocks: unlocks,
        controlOdysseyProgress: tierProgress
      }
    });
  } else if (!unlocks.includes('P')) {
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: { controlUnlocks: unlocks }
    });
  }

  return { credits, unlocks, tierProgress };
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
      select: { controlCredits: true, controlUnlocks: true, controlOdysseyProgress: true }
    });

    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const credits = profile?.controlCredits ?? 0;
    const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);

    if (unlocks.includes(controllerId)) {
      return { credits, unlocks, tierProgress };
    }

    const requires = item.requires ?? [];
    const missing = requires.filter((required) => !unlocks.includes(required));
    if (missing.length > 0) {
      throw new Error('未满足解锁条件');
    }

    if (credits < item.price) {
      throw new Error('积分不足');
    }

    const nextUnlocks = [...unlocks, controllerId];
    const updated = await tx.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        controlCredits: { decrement: item.price },
        controlUnlocks: nextUnlocks
      },
      create: {
        userId: session.user.id,
        controlCredits: credits - item.price,
        controlUnlocks: nextUnlocks
      }
    });

    return {
      credits: updated.controlCredits,
      unlocks: normalizeUnlocks(updated.controlUnlocks),
      tierProgress
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

    return uniqueLogs.map((log, index) => ({
      rank: index + 1,
      userName: log.user.name || log.user.email?.split('@')[0] || 'Unknown Captain',
      userImage: log.user.image,
      score: log.score || 0,
      metrics: log.metrics,
      createdAt: log.createdAt
    }));
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
      select: { controlCredits: true, controlUnlocks: true, controlOdysseyProgress: true }
    });
    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const credits = profile?.controlCredits ?? 0;
    const tierProgress = normalizeTierProgress(profile?.controlOdysseyProgress);
    const completedTier = context?.tier && TIER_ORDER.includes(context.tier as LevelTier)
      ? (context.tier as LevelTier)
      : undefined;
    const nextTier = resolveTierUnlock(tierProgress[levelId], completedTier);
    const nextProgress = { ...tierProgress, [levelId]: nextTier };
    const nextUnlocks = unlocks.includes('P') ? unlocks : [...unlocks, 'P'];
    const tierBonus = completedTier === 'gold' ? 40 : completedTier === 'silver' ? 20 : 0;
    const creditsEarned = Math.floor(score / 150) + tierBonus;

    await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        controlCredits: { increment: creditsEarned },
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress
      },
      create: {
        userId: session.user.id,
        controlCredits: credits + creditsEarned,
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress
      }
    });

    revalidatePath('/interactive-learning/control-odyssey');
    return log;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return null;
  }
}

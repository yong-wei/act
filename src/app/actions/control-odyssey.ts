'use server';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import {
  CONTROL_SHOP_CONFIG,
  CONTROLLER_UPGRADE_RULES,
  type ControllerId,
  type LevelTier
} from '@/resources/interactive-learning/control-odyssey/level-data';
import { bridgeOdysseyRunToArenaSubmission, getArenaTaskForOdysseyLevel } from '@/features/arena/odyssey/bridge';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';
import { computeOfficialOdysseyTelemetry } from '@/resources/interactive-learning/control-odyssey/engine/official-simulation';

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
  bestScores?: ControlBestScores;
}

export interface ControlConfigSnapshot {
  score: number;
  createdAt: string;
  config: {
    tier?: LevelTier;
    controlMode?: string;
    controllerId?: ControllerId;
    pidParams?: { kp: number; ki: number; kd: number };
    extraParams?: { speedFeedbackTau: number; feedforwardGain: number; smithDelay?: number };
    enableSpeedFeedback?: boolean;
    enableFeedforward?: boolean;
    enableSmithPredictor?: boolean;
    difficultyScale?: number;
  };
  metrics?: Record<string, unknown> | null;
}

export interface ControlAiHistory {
  content: string;
  updatedAt: string;
}

const AI_ASSIST_COST = 20;

type ControlTierProgress = Record<string, LevelTier>;
type ControlControllerLevels = Record<ControllerId, number>;
type ControlBestScores = Record<
  string,
  {
    overall: number;
    tiers: Partial<Record<LevelTier, number>>;
  }
>;
type ControlBestScoreLog = {
  score: number | null;
  missionId: string | null;
  inputParams: unknown;
};
type ControlLeaderboardLog = {
  userId: string;
  inputParams: unknown;
  score: number | null;
  metrics: unknown;
  createdAt: Date;
  user: {
    name: string | null;
    image: string | null;
    email: string | null;
  };
};
type ControlConfigLog = {
  score: number | null;
  createdAt: Date;
  inputParams: unknown;
  metrics: unknown;
};
type ActionSession = {
  user?: {
    id?: string | null;
    name?: string | null;
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
    name: user.name ?? null,
  };
};

const defaultUnlocks = (): ControllerId[] => ['P'];

const defaultControllerLevels = (): ControlControllerLevels => ({
  P: 1,
  PI: 0,
  PD: 0,
  PID: 0,
  VFB: 0,
  FF: 0,
  SMITH: 0
});

const isLevelTier = (value: unknown): value is LevelTier =>
  value === 'bronze' || value === 'silver' || value === 'gold';

const nextTierAfter = (tier: LevelTier): LevelTier => {
  switch (tier) {
    case 'bronze':
      return 'silver';
    case 'silver':
      return 'gold';
    case 'gold':
      return 'gold';
  }
};

const tierRank = (tier: LevelTier): number => {
  switch (tier) {
    case 'bronze':
      return 0;
    case 'silver':
      return 1;
    case 'gold':
      return 2;
  }
};

const normalizeUnlocks = (value: unknown): ControllerId[] => {
  if (!Array.isArray(value)) {
    return defaultUnlocks();
  }
  const filtered = value.filter((item) => typeof item === 'string') as ControllerId[];
  return filtered.length ? filtered : defaultUnlocks();
};

const getUpgradeRule = (controllerId: ControllerId) =>
  CONTROLLER_UPGRADE_RULES.find((rule) => rule.controller === controllerId);

const normalizeControllerLevels = (
  value: unknown,
  unlocks: ControllerId[]
): ControlControllerLevels => {
  const levels = defaultControllerLevels();
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
    if (isLevelTier(tier)) {
      progress[levelId] = tier;
    }
  });
  return progress;
};

const resolveTierUnlock = (currentTier: LevelTier | undefined, completedTier?: LevelTier) => {
  const current = currentTier ?? 'bronze';
  if (!completedTier) return current;
  if (tierRank(completedTier) < tierRank(current)) return current;
  return nextTierAfter(current);
};

const buildBestScores = async (userId: string): Promise<ControlBestScores> => {
  const logs = (await prisma.simulationLog.findMany({
    where: {
      userId,
      controlMode: 'GAME',
      score: {
        not: null
      }
    },
    select: {
      score: true,
      missionId: true,
      inputParams: true
    }
  })) as ControlBestScoreLog[];
  const bestScores: ControlBestScores = {};

  logs.forEach((log) => {
    const params = log.inputParams as { levelId?: string; tier?: LevelTier } | null;
    const levelId = params?.levelId ?? log.missionId ?? undefined;
    if (!levelId) return;
    const score = log.score ?? 0;
    if (!bestScores[levelId]) {
      bestScores[levelId] = { overall: score, tiers: {} };
    } else {
      bestScores[levelId].overall = Math.max(bestScores[levelId].overall, score);
    }
    if (isLevelTier(params?.tier)) {
      const current = bestScores[levelId].tiers[params.tier];
      if (current === undefined || score > current) {
        bestScores[levelId].tiers[params.tier] = score;
      }
    }
  });

  return bestScores;
};

export async function getControlProfile(): Promise<ControlProfileSnapshot | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: actionUser.id },
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
  const bestScores = await buildBestScores(actionUser.id);

  if (!profile) {
    await prisma.studentProfile.create({
      data: {
        userId: actionUser.id,
        controlCredits: credits,
        controlUnlocks: unlocks,
        controlOdysseyProgress: tierProgress,
        controlControllerLevels: controllerLevels
      }
    });
  } else if (!unlocks.includes('P')) {
    await prisma.studentProfile.update({
      where: { userId: actionUser.id },
      data: { controlUnlocks: unlocks }
    });
  }

  return { credits, unlocks, tierProgress, controllerLevels, bestScores };
}

export async function purchaseController(controllerId: ControllerId): Promise<ControlProfileSnapshot | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }

  const item = CONTROL_SHOP_CONFIG.items.find((entry) => entry.unlocks.controller === controllerId);
  if (!item) {
    throw new Error('无效的控制器类型');
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: actionUser.id },
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
      where: { userId: actionUser.id },
      update: {
        controlCredits: { decrement: item.price },
        controlUnlocks: nextUnlocks,
        controlControllerLevels: nextControllerLevels
      },
      create: {
        userId: actionUser.id,
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
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }

  const rule = getUpgradeRule(controllerId);
  if (!rule) {
    throw new Error('无效的升级类型');
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: actionUser.id },
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
      where: { userId: actionUser.id },
      update: {
        controlCredits: { decrement: upgradePrice },
        controlControllerLevels: nextLevels
      },
      create: {
        userId: actionUser.id,
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

export async function redeemControlAICredits(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }

  const updatedCredits = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: actionUser.id },
      select: {
        controlCredits: true
      }
    });

    const credits = profile?.controlCredits ?? 0;
    if (credits < AI_ASSIST_COST) {
      throw new Error('积分不足');
    }

    const updated = await tx.studentProfile.upsert({
      where: { userId: actionUser.id },
      update: {
        controlCredits: { decrement: AI_ASSIST_COST }
      },
      create: {
        userId: actionUser.id,
        controlCredits: credits - AI_ASSIST_COST
      }
    });

    return updated.controlCredits;
  });

  return updatedCredits;
}

/**
 * 获取指定关卡的排行榜 (Top 50)
 */
export async function getLevelLeaderboard(levelId: string): Promise<LeaderboardEntry[]> {
  const session = await getServerSession(authOptions);
  void session;

  try {
    const logs = (await prisma.simulationLog.findMany({
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
    })) as ControlLeaderboardLog[];

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
  context?: {
    runId?: string;
    tier?: string;
    controllerId?: ControllerId;
    controlMode?: string;
    pidParams?: { kp: number; ki: number; kd: number };
    extraParams?: { speedFeedbackTau: number; feedforwardGain: number; smithDelay?: number };
    enableSpeedFeedback?: boolean;
    enableFeedforward?: boolean;
    enableSmithPredictor?: boolean;
    difficultyScale?: number;
    arenaTaskId?: string;
    publicationId?: string;
  }
) {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);

  if (!actionUser) {
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
          userId: actionUser.id,
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
        userId: actionUser.id,
        missionId: mission?.id ?? null,
        controlMode: 'GAME',
        inputParams: {
          levelId,
          runId,
          tier: context?.tier,
          controllerId: context?.controllerId,
          controlMode: context?.controlMode,
          pidParams: context?.pidParams,
          extraParams: context?.extraParams,
          enableSpeedFeedback: context?.enableSpeedFeedback,
          enableFeedforward: context?.enableFeedforward,
          enableSmithPredictor: context?.enableSmithPredictor,
          difficultyScale: context?.difficultyScale
        }, // 记录关卡与运行信息，避免重复提交
        metrics: metrics,
        score: score,
        isEthicalViolation: false, // 暂时默认为 false
      }
    });

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: actionUser.id },
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
    const completedTier = isLevelTier(context?.tier)
      ? context.tier
      : undefined;
    const nextTier = resolveTierUnlock(tierProgress[levelId], completedTier);
    const nextProgress = { ...tierProgress, [levelId]: nextTier };
    const nextUnlocks = unlocks.includes('P') ? unlocks : [...unlocks, 'P'];
    const creditsEarned = Math.floor(score / 100);

    await prisma.studentProfile.upsert({
      where: { userId: actionUser.id },
      update: {
        controlCredits: { increment: creditsEarned },
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress,
        controlControllerLevels: controllerLevels
      },
      create: {
        userId: actionUser.id,
        controlCredits: credits + creditsEarned,
        controlUnlocks: nextUnlocks,
        controlOdysseyProgress: nextProgress,
        controlControllerLevels: controllerLevels
      }
    });

    const expectedArenaTaskId = runId ? getArenaTaskForOdysseyLevel(levelId) : undefined;
    const requestedArenaTaskId = context?.arenaTaskId?.trim();
    const shouldSubmitArenaBridge = Boolean(
      runId
      && expectedArenaTaskId
      && requestedArenaTaskId === expectedArenaTaskId
    );
    if (shouldSubmitArenaBridge && expectedArenaTaskId) {
      const arenaTaskId = expectedArenaTaskId;
      let officialMetrics: Record<string, unknown>;
      try {
        officialMetrics = computeOfficialOdysseyTelemetry({
          levelId,
          tier: context?.tier,
          controllerId: context?.controllerId,
          controlMode: context?.controlMode,
          pidParams: context?.pidParams,
          extraParams: context?.extraParams,
          enableSpeedFeedback: context?.enableSpeedFeedback,
          enableFeedforward: context?.enableFeedforward,
          enableSmithPredictor: context?.enableSmithPredictor,
          difficultyScale: context?.difficultyScale,
          controllerLevels,
        });
      } catch (error) {
        await prisma.simulationLog.update({
          where: { id: log.id },
          data: {
            metrics: {
              ...(metrics && typeof metrics === 'object' ? metrics : {}),
              arenaBridge: {
                ok: false,
                reason: error instanceof Error ? error.message : 'Server-side Odyssey telemetry simulation failed.',
                gameScorePreserved: true,
              },
            },
          },
        });
        revalidatePath('/interactive-learning/control-odyssey');
        return log;
      }
      let publicationContext: ArenaResolvedSubmissionContext | null = null;
      if (context?.publicationId) {
        try {
          publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
            publicationId: context.publicationId,
            studentId: actionUser.id,
            taskId: arenaTaskId,
            now: log.createdAt,
          });
        } catch (error) {
          await prisma.simulationLog.update({
            where: { id: log.id },
            data: {
              metrics: {
                ...(metrics && typeof metrics === 'object' ? metrics : {}),
                arenaBridge: {
                  ok: false,
                  reason: error instanceof Error ? error.message : 'Arena publication context is not accessible.',
                  gameScorePreserved: true,
                },
              },
            },
          });
          revalidatePath('/interactive-learning/control-odyssey');
          return log;
        }
      }
      const bridgeResult = await bridgeOdysseyRunToArenaSubmission({
        userId: actionUser.id,
        studentLabel: actionUser.name ?? '匿名学生',
        runId: runId as string,
        levelId,
        tier: context?.tier ?? 'bronze',
        controllerId: context?.controllerId,
        pidParams: context?.pidParams,
        metrics: officialMetrics,
        publicationId: publicationContext?.id,
        classId: publicationContext?.classId,
        seasonId: publicationContext?.seasonId,
        isLate: publicationContext?.isLate,
        submittedAt: log.createdAt.toISOString(),
        submissionStore: prismaArenaSubmissionStore,
        store: {
          async findByOdysseyRun({ runId: odysseyRunId, taskId, publicationId }) {
            const submissions = await prismaArenaSubmissionStore.listSubmissions({
              taskId,
              userId: actionUser.id,
              publicationId,
            });
            return submissions.find((submission) =>
              (submission.artifact.params as Record<string, unknown>).odysseyRunId === odysseyRunId
            ) ?? null;
          },
          async markOdysseyRunSubmitted() {
            // The Arena submission itself carries the deterministic Odyssey run id.
          },
        },
      });
      if (!bridgeResult.ok) {
        await prisma.simulationLog.update({
          where: { id: log.id },
          data: {
            metrics: {
              ...(metrics && typeof metrics === 'object' ? metrics : {}),
              arenaBridge: bridgeResult,
            },
          },
        });
      }
    }

    revalidatePath('/interactive-learning/control-odyssey');
    return log;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return null;
  }
}

export async function getTopControlConfigs(levelId: string): Promise<ControlConfigSnapshot[]> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return [];
  }

  if (!levelId) {
    return [];
  }

  const logs = (await prisma.simulationLog.findMany({
    where: {
      userId: actionUser.id,
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
    take: 3,
    select: {
      score: true,
      createdAt: true,
      inputParams: true,
      metrics: true
    }
  })) as ControlConfigLog[];

  return logs.map((log) => {
    const params = (log.inputParams ?? {}) as Record<string, any>;
    return {
      score: log.score ?? 0,
      createdAt: log.createdAt.toISOString(),
      metrics: (log.metrics as Record<string, unknown> | null) ?? null,
      config: {
        tier: isLevelTier(params.tier) ? params.tier : undefined,
        controlMode: params.controlMode,
        controllerId: params.controllerId as ControllerId | undefined,
        pidParams: params.pidParams,
        extraParams: params.extraParams,
        enableSpeedFeedback: params.enableSpeedFeedback,
        enableFeedforward: params.enableFeedforward,
        enableSmithPredictor: params.enableSmithPredictor,
        difficultyScale: params.difficultyScale
      }
    };
  });
}

export async function getControlAiHistory(levelId: string): Promise<ControlAiHistory | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }
  if (!levelId) {
    return null;
  }

  const history = await prisma.controlOdysseyAiHistory.findUnique({
    where: {
        userId_levelId: {
        userId: actionUser.id,
        levelId,
      },
    },
    select: {
      content: true,
      updatedAt: true,
    },
  });

  if (!history) {
    return null;
  }

  return {
    content: history.content,
    updatedAt: history.updatedAt.toISOString(),
  };
}

export async function saveControlAiHistory(
  levelId: string,
  content: string
): Promise<ControlAiHistory | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }
  if (!levelId || !content) {
    throw new Error('无效的 AI 建议内容');
  }

  const history = await prisma.controlOdysseyAiHistory.upsert({
    where: {
        userId_levelId: {
        userId: actionUser.id,
        levelId,
      },
    },
    update: {
      content,
    },
    create: {
      userId: actionUser.id,
      levelId,
      content,
    },
    select: {
      content: true,
      updatedAt: true,
    },
  });

  return {
    content: history.content,
    updatedAt: history.updatedAt.toISOString(),
  };
}

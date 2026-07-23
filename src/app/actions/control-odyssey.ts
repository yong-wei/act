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
import { randomUUID } from 'node:crypto';

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

const scoreSubmissionFailure = (errorCode: string, message: string) => ({
  status: 'failed' as const,
  errorCode,
  message,
});

const AI_ASSIST_COST = 20;
const ODYSSEY_REPLAY_SNAPSHOT_VERSION = 1;
const ODYSSEY_CLAIM_LEASE_MS = 30_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isPrismaUniqueConflict = (error: unknown) =>
  isRecord(error) && error.code === 'P2002';

class OdysseyLeaseLostError extends Error {}

const assertOdysseyLeaseOwned = (result: { count: number }) => {
  if (result.count !== 1) throw new OdysseyLeaseLostError('Odyssey run lease ownership was lost.');
};

const buildOdysseyReplaySnapshot = (
  levelId: string,
  context: NonNullable<Parameters<typeof submitGameScore>[3]>,
  controllerLevels: ControlControllerLevels,
) => ({
  replaySnapshotVersion: ODYSSEY_REPLAY_SNAPSHOT_VERSION,
  levelId,
  runId: context.runId,
  tier: context.tier ?? 'bronze',
  controllerId: context.controllerId ?? 'P',
  controlMode: context.controlMode ?? 'AUTO',
  pidParams: context.pidParams ?? { kp: 1, ki: 0, kd: 0 },
  extraParams: context.extraParams ?? {
    speedFeedbackTau: 0.05,
    feedforwardGain: 0.05,
    smithDelay: 0.1,
  },
  enableSpeedFeedback: context.enableSpeedFeedback ?? false,
  enableFeedforward: context.enableFeedforward ?? false,
  enableSmithPredictor: context.enableSmithPredictor ?? false,
  difficultyScale: context.difficultyScale ?? 1,
  controllerLevels,
  arenaTaskId: context.arenaTaskId,
  arenaAssigned: context.arenaAssigned ?? false,
  publicationId: context.publicationId,
});

const readOdysseyReplaySnapshot = (value: unknown) => {
  if (!isRecord(value)
    || value.replaySnapshotVersion !== ODYSSEY_REPLAY_SNAPSHOT_VERSION
    || typeof value.levelId !== 'string'
    || typeof value.runId !== 'string'
    || typeof value.tier !== 'string'
    || typeof value.controllerId !== 'string'
    || typeof value.controlMode !== 'string'
    || !isRecord(value.pidParams)
    || !isRecord(value.extraParams)
    || !isRecord(value.controllerLevels)
    || typeof value.enableSpeedFeedback !== 'boolean'
    || typeof value.enableFeedforward !== 'boolean'
    || typeof value.enableSmithPredictor !== 'boolean'
    || typeof value.difficultyScale !== 'number') {
    return null;
  }
  return value;
};

const isPersistedArenaAssignedRun = (value: unknown): boolean => {
  if (!isRecord(value)
    || value.arenaAssigned !== true
    || typeof value.levelId !== 'string'
    || typeof value.arenaTaskId !== 'string') {
    return false;
  }
  return getArenaTaskForOdysseyLevel(value.levelId) === value.arenaTaskId.trim();
};

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
    arenaAssigned?: boolean;
    publicationId?: string;
  }
) {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);

  if (!actionUser) {
    // 未登录用户不记录（或可以记录匿名？）
    // 这里简单处理：仅记录登录用户
    console.log('User not logged in, score not saved.');
    return scoreSubmissionFailure('AUTH_REQUIRED', '登录状态已失效，请重新登录后重试。');
  }

  try {
    const mission = await prisma.mission.findUnique({
      where: { id: levelId },
      select: { id: true }
    });

    const runId = context?.runId;
    const leaseToken = runId ? randomUUID() : undefined;
    const leaseExpiresAt = () => new Date(Date.now() + ODYSSEY_CLAIM_LEASE_MS);
    let bridgeContext = context;
    let ownsRunClaim = false;
    const updateRunStage = async (logId: string, data: Prisma.SimulationLogUpdateInput) => {
      if (runId && ownsRunClaim) {
        assertOdysseyLeaseOwned(await prisma.simulationLog.updateMany({
          where: { id: logId, odysseyLeaseToken: leaseToken },
          data,
        }));
        return;
      }
      await prisma.simulationLog.update({ where: { id: logId }, data });
    };
    let existingLog: Awaited<ReturnType<typeof prisma.simulationLog.findFirst>> = null;
    if (runId) {
      existingLog = await prisma.simulationLog.findUnique({
        where: { userId_odysseyRunId: { userId: actionUser.id, odysseyRunId: runId } }
      }) ?? await prisma.simulationLog.findFirst({
        where: {
          userId: actionUser.id,
          inputParams: { path: ['runId'], equals: runId }
        }
      });
      if (existingLog) {
        if (existingLog.odysseyRunId === runId && !existingLog.odysseyCompletedAt) {
          const acquired = await prisma.simulationLog.updateMany({
            where: {
              id: existingLog.id,
              odysseyCompletedAt: null,
              OR: [
                { odysseyLeaseToken: null },
                { odysseyLeaseExpiresAt: null },
                { odysseyLeaseExpiresAt: { lte: new Date() } },
              ],
            },
            data: { odysseyLeaseToken: leaseToken, odysseyLeaseExpiresAt: leaseExpiresAt() },
          });
          if (acquired.count === 1) {
            ownsRunClaim = true;
            existingLog = await prisma.simulationLog.findUnique({
              where: { userId_odysseyRunId: { userId: actionUser.id, odysseyRunId: runId } }
            }) ?? existingLog;
            const claimedInput = isRecord(existingLog.inputParams) ? existingLog.inputParams : {};
            bridgeContext = (readOdysseyReplaySnapshot(claimedInput) ?? claimedInput) as typeof context;
          } else {
            for (let attempt = 0; attempt < 20 && !existingLog.odysseyCompletedAt; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 25));
              existingLog = await prisma.simulationLog.findUnique({
                where: { userId_odysseyRunId: { userId: actionUser.id, odysseyRunId: runId } }
              }) ?? existingLog;
            }
            if (!existingLog.odysseyCompletedAt) {
              return { status: 'pending' as const, runId, retryAfterMs: 1_000 };
            }
            return { ...existingLog, arenaSubmissionId: existingLog.odysseySubmissionId ?? undefined };
          }
        }
        if (!ownsRunClaim) {
        const persistedInput = existingLog.inputParams && typeof existingLog.inputParams === 'object' && !Array.isArray(existingLog.inputParams)
          ? existingLog.inputParams as Record<string, unknown>
          : {};
        const persistedSnapshot = readOdysseyReplaySnapshot(persistedInput);
        bridgeContext = (persistedSnapshot ?? persistedInput) as typeof context;
        const persistedLevelId = typeof persistedInput.levelId === 'string' ? persistedInput.levelId : levelId;
        const expectedArenaTaskId = getArenaTaskForOdysseyLevel(persistedLevelId);
        const requestedArenaTaskId = typeof bridgeContext?.arenaTaskId === 'string'
          ? bridgeContext.arenaTaskId.trim()
          : undefined;
        if (expectedArenaTaskId && requestedArenaTaskId === expectedArenaTaskId) {
          const submissions = await prismaArenaSubmissionStore.listSubmissions({
            taskId: expectedArenaTaskId,
            userId: actionUser.id,
            publicationId: bridgeContext?.publicationId,
          });
          const existingSubmission = submissions.find((submission) =>
            (submission.artifact.params as Record<string, unknown>).odysseyRunId === runId
          );
          if (existingSubmission) {
            return { ...existingLog, arenaSubmissionId: existingSubmission.id };
          }
        } else {
          return existingLog;
        }
        }
      }
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
    const replaySnapshot = runId && context
      ? buildOdysseyReplaySnapshot(levelId, context, controllerLevels)
      : { levelId };
    ownsRunClaim = ownsRunClaim || !existingLog;
    let log = existingLog;
    if (!log) {
      try {
        log = await prisma.simulationLog.create({
          data: {
            userId: actionUser.id,
            missionId: mission?.id ?? null,
            controlMode: 'GAME',
            odysseyRunId: runId,
            odysseyLeaseToken: leaseToken,
            odysseyLeaseExpiresAt: runId ? leaseExpiresAt() : undefined,
            inputParams: replaySnapshot,
            metrics,
            score,
            isEthicalViolation: false,
          }
        });
      } catch (error) {
        if (!runId || !isPrismaUniqueConflict(error)) throw error;
        ownsRunClaim = false;
        log = await prisma.simulationLog.findUnique({
          where: { userId_odysseyRunId: { userId: actionUser.id, odysseyRunId: runId } }
        });
        if (!log) throw error;
      }
    }

    if (!ownsRunClaim && !existingLog) {
      for (let attempt = 0; attempt < 20 && !log.odysseyCompletedAt; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        log = await prisma.simulationLog.findUnique({
          where: { userId_odysseyRunId: { userId: actionUser.id, odysseyRunId: runId as string } }
        }) ?? log;
      }
      if (!log.odysseyCompletedAt) {
        return { status: 'pending' as const, runId: runId as string, retryAfterMs: 1_000 };
      }
      const expectedArenaTaskId = getArenaTaskForOdysseyLevel(levelId);
      if (expectedArenaTaskId && context?.arenaTaskId === expectedArenaTaskId) {
        const submissions = await prismaArenaSubmissionStore.listSubmissions({
          taskId: expectedArenaTaskId,
          userId: actionUser.id,
          publicationId: context.publicationId,
        });
        const submission = submissions.find((candidate) =>
          (candidate.artifact.params as Record<string, unknown>).odysseyRunId === runId
        );
        return { ...log, arenaSubmissionId: submission?.id };
      }
      return log;
    }

    if (!bridgeContext && context) bridgeContext = context;
    const creditLevelId = isRecord(log.inputParams) && typeof log.inputParams.levelId === 'string'
      ? log.inputParams.levelId
      : levelId;
    const isArenaAssignedRun = isPersistedArenaAssignedRun(log.inputParams);
    const completedTier = isLevelTier(bridgeContext?.tier)
      ? bridgeContext.tier
      : undefined;
    const nextTier = resolveTierUnlock(tierProgress[creditLevelId], completedTier);
    const nextProgress = { ...tierProgress, [creditLevelId]: nextTier };
    const nextUnlocks = unlocks.includes('P') ? unlocks : [...unlocks, 'P'];
    const persistedScore = typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : 0;
    const creditsEarned = Math.floor(persistedScore / 100);

    if (!isArenaAssignedRun && ownsRunClaim && !log.odysseyCreditAppliedAt) {
      const creditAppliedAt = new Date();
      const claimedLogId = log.id;
      await prisma.$transaction(async (tx) => {
        await tx.studentProfile.upsert({
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
        if (runId) {
          assertOdysseyLeaseOwned(await tx.simulationLog.updateMany({
            where: { id: claimedLogId, odysseyLeaseToken: leaseToken },
            data: {
              odysseyCreditAppliedAt: creditAppliedAt,
              odysseyLeaseExpiresAt: leaseExpiresAt(),
            },
          }));
        } else {
          await tx.simulationLog.update({
            where: { id: claimedLogId },
            data: { odysseyCreditAppliedAt: creditAppliedAt },
          });
        }
      });
      log = { ...log, odysseyCreditAppliedAt: creditAppliedAt };
    }

    let arenaSubmissionId: string | undefined;
    const persistedLevelId = isRecord(log.inputParams) && typeof log.inputParams.levelId === 'string'
      ? log.inputParams.levelId
      : levelId;
    const expectedArenaTaskIdForBridge = runId ? getArenaTaskForOdysseyLevel(persistedLevelId) : undefined;
    const requestedArenaTaskId = typeof bridgeContext?.arenaTaskId === 'string'
      ? bridgeContext.arenaTaskId.trim()
      : undefined;
    const shouldSubmitArenaBridge = Boolean(
      runId
      && expectedArenaTaskIdForBridge
      && requestedArenaTaskId === expectedArenaTaskIdForBridge
    );
    if (shouldSubmitArenaBridge && expectedArenaTaskIdForBridge) {
      const officialReplaySnapshot = readOdysseyReplaySnapshot(log.inputParams);
      if (!officialReplaySnapshot) {
        return {
          ...log,
          actionError: {
            code: 'ODYSSEY_REPLAY_SNAPSHOT_INCOMPLETE',
            status: 409,
            message: '该历史运行缺少完整的官方重放快照，无法恢复 Arena 提交。',
          },
        };
      }
      bridgeContext = officialReplaySnapshot as typeof context;
      const arenaTaskId = expectedArenaTaskIdForBridge;
      let officialMetrics: Record<string, unknown> | null = isRecord(log.odysseyOfficialMetrics)
        ? log.odysseyOfficialMetrics
        : null;
      if (!officialMetrics) try {
        officialMetrics = computeOfficialOdysseyTelemetry({
          levelId: officialReplaySnapshot.levelId as string,
          tier: bridgeContext?.tier,
          controllerId: bridgeContext?.controllerId,
          controlMode: bridgeContext?.controlMode,
          pidParams: bridgeContext?.pidParams,
          extraParams: bridgeContext?.extraParams,
          enableSpeedFeedback: bridgeContext?.enableSpeedFeedback,
          enableFeedforward: bridgeContext?.enableFeedforward,
          enableSmithPredictor: bridgeContext?.enableSmithPredictor,
          difficultyScale: bridgeContext?.difficultyScale,
          controllerLevels: officialReplaySnapshot.controllerLevels as ControlControllerLevels,
        });
        await updateRunStage(log.id, {
            odysseyOfficialMetrics: officialMetrics as Prisma.InputJsonValue,
            odysseyLeaseExpiresAt: ownsRunClaim ? leaseExpiresAt() : undefined,
        });
        log = { ...log, odysseyOfficialMetrics: officialMetrics as Prisma.JsonValue };
      } catch (error) {
        if (error instanceof OdysseyLeaseLostError) throw error;
        await updateRunStage(log.id, {
            odysseyCompletedAt: ownsRunClaim ? new Date() : undefined,
            metrics: {
              ...(metrics && typeof metrics === 'object' ? metrics : {}),
              arenaBridge: {
                ok: false,
                reason: error instanceof Error ? error.message : 'Server-side Odyssey telemetry simulation failed.',
                gameScorePreserved: true,
              },
            },
          },
        );
        revalidatePath('/interactive-learning/control-odyssey');
        return log;
      }
      let publicationContext: ArenaResolvedSubmissionContext | null = null;
      if (bridgeContext?.publicationId) {
        try {
          publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
            publicationId: bridgeContext.publicationId,
            studentId: actionUser.id,
            taskId: arenaTaskId,
            now: log.createdAt,
          });
        } catch (error) {
          await updateRunStage(log.id, {
              odysseyCompletedAt: ownsRunClaim ? new Date() : undefined,
              metrics: {
                ...(metrics && typeof metrics === 'object' ? metrics : {}),
                arenaBridge: {
                  ok: false,
                  reason: error instanceof Error ? error.message : 'Arena publication context is not accessible.',
                  gameScorePreserved: true,
                },
              },
            },
          );
          revalidatePath('/interactive-learning/control-odyssey');
          return log;
        }
      }
      const bridgeResult = log.odysseySubmissionId ? {
        ok: true as const,
        duplicate: true,
        gameScorePreserved: true,
        submission: { id: log.odysseySubmissionId },
      } : await bridgeOdysseyRunToArenaSubmission({
        userId: actionUser.id,
        studentLabel: actionUser.name ?? '匿名学生',
        runId: runId as string,
        levelId: officialReplaySnapshot.levelId as string,
        tier: bridgeContext?.tier ?? 'bronze',
        controllerId: bridgeContext?.controllerId,
        pidParams: bridgeContext?.pidParams,
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
        await updateRunStage(log.id, {
            odysseyCompletedAt: ownsRunClaim ? new Date() : undefined,
            metrics: {
              ...(metrics && typeof metrics === 'object' ? metrics : {}),
              arenaBridge: bridgeResult,
            },
          },
        );
      } else {
        arenaSubmissionId = bridgeResult.submission.id;
        if (!log.odysseySubmissionId) {
          await updateRunStage(log.id, {
              odysseySubmissionId: arenaSubmissionId,
              odysseyLeaseExpiresAt: ownsRunClaim ? leaseExpiresAt() : undefined,
          });
          log = { ...log, odysseySubmissionId: arenaSubmissionId };
        }
      }
    }

    if (runId && ownsRunClaim) {
      assertOdysseyLeaseOwned(await prisma.simulationLog.updateMany({
        where: { id: log.id, odysseyLeaseToken: leaseToken },
        data: {
          odysseyCompletedAt: new Date(),
          odysseyLeaseToken: null,
          odysseyLeaseExpiresAt: null,
        },
      }));
    }

    revalidatePath('/interactive-learning/control-odyssey');
    return { ...log, arenaSubmissionId };
  } catch (error) {
    console.error('Failed to submit score:', error);
    return scoreSubmissionFailure('SCORE_SUBMISSION_FAILED', '成绩同步失败，请稍后重试。');
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

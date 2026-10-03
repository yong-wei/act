'use server';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import {
  CONTROL_BASE_CONTROLLERS,
  CONTROL_ODYSSEY_LEVELS,
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
import { replayOdysseyInput, computeOfficialOdysseyTelemetry } from '@/resources/interactive-learning/control-odyssey/engine/official-simulation';
import { calculateOdysseyScore, type OdysseyInputTrace } from '@/resources/interactive-learning/control-odyssey/engine/input-trace';
import { randomUUID } from 'node:crypto';
import { materializeOdysseyTaskEvidence } from '@/lib/data-governance/simulation-task-materialization';
import { persistAcceptedSimulationTaskEvidence } from '@/lib/data-governance/simulation-task-learning-fact';
import { hashSemanticFingerprintValue } from '@/lib/data-governance/simulation-task-evidence';
import { requestRealtimeSimulationTaskReconciliation } from '@/lib/data-governance/simulation-task-reconciliation';

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
  inputTrace: context.inputTrace,
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

const readLegacyArenaRecoverySnapshot = (value: unknown, runId: string) => {
  const snapshot = readOdysseyReplaySnapshot(value);
  if (!snapshot || snapshot.inputTrace !== undefined || snapshot.runId !== runId
    || snapshot.controlMode !== 'AUTO' || !isLevelTier(snapshot.tier)
    || !CONTROL_ODYSSEY_LEVELS.some(level => level.id === snapshot.levelId)
    || !CONTROL_BASE_CONTROLLERS.includes(snapshot.controllerId as typeof CONTROL_BASE_CONTROLLERS[number])
    || typeof snapshot.arenaTaskId !== 'string'
    || getArenaTaskForOdysseyLevel(snapshot.levelId as string) !== snapshot.arenaTaskId.trim()) return null;
  const pid = snapshot.pidParams as Record<string, unknown>;
  const extra = snapshot.extraParams as Record<string, unknown>;
  const levels = snapshot.controllerLevels as Record<string, unknown>;
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (!['kp', 'ki', 'kd'].every(key => finite(pid[key]))
    || !['speedFeedbackTau', 'feedforwardGain'].every(key => finite(extra[key]))
    || (extra.smithDelay !== undefined && !finite(extra.smithDelay))
    || !['P', 'PI', 'PD', 'PID', 'VFB', 'FF', 'SMITH'].every(key => finite(levels[key]) && Number.isInteger(levels[key]) && (levels[key] as number) >= 0 && (levels[key] as number) <= 10)
    || !finite(snapshot.difficultyScale)) return null;
  return snapshot;
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
    name: user.name ?? null,
    role: user.role ?? null,
  };
};

async function persistOrdinaryOdysseyTaskEvidence({
  userId,
  role,
  log,
  levelId,
}: {
  userId: string;
  role: string | null;
  log: {
    id: string;
    inputParams: unknown;
    score: number | null;
    odysseyCompletedAt: Date | null;
  };
  levelId: string;
}) {
  if (role?.toUpperCase() !== 'STUDENT' || !log.odysseyCompletedAt) return;
  const taskEvidence = materializeOdysseyTaskEvidence({
    actor: { userId, role: 'student' },
    eventType: 'odyssey_persistent_clear',
    levelId,
    isArenaAssigned: false,
    sourceArtifactId: log.id,
    occurredAt: log.odysseyCompletedAt.toISOString(),
    persistentClear: true,
    fingerprint: {
      modelRef: levelId,
      controllerConfigHash: hashSemanticFingerprintValue(
        readOdysseyReplaySnapshot(log.inputParams) ?? log.inputParams,
      ),
    },
    summary: {
      sourceRef: `SimulationLog:${log.id}`,
      qualityBand: 'full',
      metrics: {
        score: typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : 0,
      },
      label: 'Odyssey persistent clear',
    },
  });
  const persisted = await persistAcceptedSimulationTaskEvidence(prisma, taskEvidence, {
    userId,
    sourceLogId: `odyssey-simulation-log:${log.id}`,
  });
  if (persisted) {
    await requestRealtimeSimulationTaskReconciliation(prisma, {
      userId,
      reason: 'odyssey-task-evidence',
    });
  }
}

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

const withOdysseyAccount = <T>(userId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'control-odyssey:' + userId}))`);
    return action(tx);
  });

const buildBestScores = async (userId: string, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma): Promise<ControlBestScores> => {
  const rows = await db.$queryRaw<{ levelId: string; tier: string | null; score: number }[]>(Prisma.sql`
    SELECT COALESCE("inputParams"->>'levelId', "missionId") AS "levelId",
      "inputParams"->>'tier' AS tier, MAX(score) AS score
    FROM "SimulationLog"
    WHERE "userId" = ${userId} AND "controlMode" = 'GAME' AND score IS NOT NULL
    GROUP BY COALESCE("inputParams"->>'levelId', "missionId"), "inputParams"->>'tier'
  `);
  const best: ControlBestScores = {};
  for (const row of rows) {
    if (!row.levelId) continue;
    const item = best[row.levelId] ??= { overall: row.score, tiers: {} };
    item.overall = Math.max(item.overall, row.score);
    if (isLevelTier(row.tier)) item.tiers[row.tier] = row.score;
  }
  return best;
};

export async function getControlProfile(): Promise<ControlProfileSnapshot | null> {
  const session = await getServerSession(authOptions);
  const actionUser = getAuthenticatedActionUser(session);
  if (!actionUser) {
    return null;
  }

  const snapshot = await withOdysseyAccount(actionUser.id, async (tx) => {
    const profile = await tx.studentProfile.upsert({
      where: { userId: actionUser.id }, update: {},
      select: { controlCredits: true, controlUnlocks: true, controlOdysseyProgress: true, controlControllerLevels: true },
      create: { userId: actionUser.id, controlCredits: 0, controlUnlocks: defaultUnlocks(), controlOdysseyProgress: {}, controlControllerLevels: defaultControllerLevels() },
    });
    return {
      credits: profile.controlCredits,
      unlocks: normalizeUnlocks(profile.controlUnlocks),
      tierProgress: normalizeTierProgress(profile.controlOdysseyProgress),
      controllerLevels: normalizeControllerLevels(profile.controlControllerLevels, normalizeUnlocks(profile.controlUnlocks)),
    };
  });
  return { ...snapshot, bestScores: await buildBestScores(actionUser.id) };
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

  const result = await withOdysseyAccount(actionUser.id, async (tx) => {
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

  const result = await withOdysseyAccount(actionUser.id, async (tx) => {
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

  const updatedCredits = await withOdysseyAccount(actionUser.id, async (tx) => {
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
    const logs = await prisma.$queryRaw<{
      userId: string; name: string | null; image: string | null; email: string | null;
      score: number; metrics: unknown; tier: string | null; createdAt: Date;
    }[]>(Prisma.sql`
      WITH best AS (
        SELECT DISTINCT ON ("userId") "userId", score, metrics, "inputParams"->>'tier' AS tier, "createdAt", id
        FROM "SimulationLog"
        WHERE "controlMode" = 'GAME' AND score IS NOT NULL
          AND ("missionId" = ${levelId} OR "inputParams"->>'levelId' = ${levelId})
        ORDER BY "userId", score DESC, "createdAt" ASC, id ASC
      )
      SELECT best.*, u.name, u.image, u.email FROM best JOIN "User" u ON u.id = best."userId"
      ORDER BY best.score DESC, best."createdAt" ASC, best."userId" ASC LIMIT 50
    `);
    return logs.map((log, index) => ({
      rank: index + 1, userName: log.name || log.email?.split('@')[0] || 'Unknown Captain',
      userImage: log.image, score: log.score, metrics: log.metrics,
      tier: isLevelTier(log.tier) ? log.tier : undefined, createdAt: log.createdAt,
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
    inputTrace?: OdysseyInputTrace;
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
        if (
          existingLog.odysseyCompletedAt
          && isRecord(existingLog.inputParams) && Boolean(existingLog.inputParams.inputTrace)
          && !isPersistedArenaAssignedRun(existingLog.inputParams)
        ) {
          await persistOrdinaryOdysseyTaskEvidence({
            userId: actionUser.id,
            role: actionUser.role,
            log: existingLog,
            levelId: persistedLevelId,
          });
        }
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

    if (!runId || typeof runId !== 'string' || runId.length > 128) {
      return scoreSubmissionFailure('ODYSSEY_INPUT_REQUIRED', '该运行缺少验证记录，请重新完成关卡。');
    }
    const permission = await withOdysseyAccount(actionUser.id, async (tx) => {
      const profile = await tx.studentProfile.findUnique({ where: { userId: actionUser.id },
        select: { controlUnlocks: true, controlOdysseyProgress: true, controlControllerLevels: true } });
      return { profile, bestScores: existingLog ? {} : await buildBestScores(actionUser.id, tx) };
    });
    const profile = permission.profile;
    const unlocks = normalizeUnlocks(profile?.controlUnlocks);
    const controllerLevels = normalizeControllerLevels(profile?.controlControllerLevels, unlocks);
    const replaySnapshot = buildOdysseyReplaySnapshot(levelId, context!, controllerLevels);
    if (!existingLog && !isPersistedArenaAssignedRun(replaySnapshot)) {
      const progress = normalizeTierProgress(profile?.controlOdysseyProgress);
      const hasProgress = (id: string) => Boolean(progress[id]) || (permission.bestScores[id]?.overall ?? 0) > 0;
      const levelIndex = CONTROL_ODYSSEY_LEVELS.findIndex(level => level.id === levelId);
      const unlocked = levelIndex === 0 || hasProgress(levelId) || (levelIndex > 0 && hasProgress(CONTROL_ODYSSEY_LEVELS[levelIndex - 1].id));
      if (!unlocked || !isLevelTier(replaySnapshot.tier) || tierRank(replaySnapshot.tier) > tierRank(progress[levelId] ?? 'bronze')) {
        return scoreSubmissionFailure('ODYSSEY_LEVEL_LOCKED', '该关卡或难度尚未解锁，请先完成前置训练。');
      }
    }
    const persistedSnapshot = existingLog ? readOdysseyReplaySnapshot(existingLog.inputParams) : null;
    const legacyArenaSnapshot = existingLog?.controlMode === 'GAME' ? readLegacyArenaRecoverySnapshot(existingLog.inputParams, runId) : null;
    const verificationInput: Record<string, unknown> | null = existingLog ? persistedSnapshot : replaySnapshot;
    if ((!isRecord(verificationInput) || !verificationInput.inputTrace) && !legacyArenaSnapshot) {
      return scoreSubmissionFailure('ODYSSEY_INPUT_REQUIRED', '该运行缺少验证记录，请重新完成关卡。');
    }
    let verifiedRun: ReturnType<typeof replayOdysseyInput> | null = null;
    if (legacyArenaSnapshot) {
      // Recover only the old official side effect. Client retry fields never replace its snapshot or game result.
      metrics = existingLog!.metrics;
    } else {
      try {
        verifiedRun = replayOdysseyInput({
          levelId: verificationInput!.levelId as string, tier: verificationInput!.tier as string,
          controllerLevels: verificationInput!.controllerLevels as ControlControllerLevels,
          inputTrace: verificationInput!.inputTrace,
        });
      } catch (error) {
        return scoreSubmissionFailure('ODYSSEY_INPUT_INVALID', error instanceof Error ? error.message : '运行验证失败，请重新完成关卡。');
      }
      const verifiedTier = verificationInput!.tier as LevelTier;
      const finalInput = verifiedRun.trace.changes[verifiedRun.trace.changes.length - 1].config;
      score = calculateOdysseyScore(verifiedRun.metrics, verifiedTier, finalInput.difficultyScale);
      metrics = { ...verifiedRun.metrics, gameTelemetrySource: 'server-rust-replay' };
      if (!existingLog) Object.assign(replaySnapshot, finalInput, { inputTrace: verifiedRun.trace });
      else {
        await updateRunStage(existingLog.id, { score, metrics });
        existingLog = { ...existingLog, score, metrics };
      }
    }
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
            inputParams: replaySnapshot as unknown as Prisma.InputJsonValue,
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
      const firstInput = isRecord(log.inputParams) ? log.inputParams : {};
      const firstLevelId = typeof firstInput.levelId === 'string' ? firstInput.levelId : levelId;
      const expectedArenaTaskId = getArenaTaskForOdysseyLevel(firstLevelId);
      if (expectedArenaTaskId && firstInput.arenaTaskId === expectedArenaTaskId) {
        const submissions = await prismaArenaSubmissionStore.listSubmissions({
          taskId: expectedArenaTaskId,
          userId: actionUser.id,
          publicationId: typeof firstInput.publicationId === 'string' ? firstInput.publicationId : undefined,
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
    const creditsEarned = Math.floor(score / 100);
    if (verifiedRun && !isArenaAssignedRun && ownsRunClaim && !log.odysseyCreditAppliedAt) {
      const creditAppliedAt = new Date();
      const claimedLogId = log.id;
      await withOdysseyAccount(actionUser.id, async (tx) => {
        const latest = await tx.studentProfile.findUnique({ where: { userId: actionUser.id },
          select: { controlUnlocks: true, controlOdysseyProgress: true } });
        const latestProgress = normalizeTierProgress(latest?.controlOdysseyProgress);
        const nextProgress = { ...latestProgress, [creditLevelId]: resolveTierUnlock(latestProgress[creditLevelId], completedTier) };
        const latestUnlocks = normalizeUnlocks(latest?.controlUnlocks);
        // Claim the reward in the same transaction before changing the account.
        assertOdysseyLeaseOwned(await tx.simulationLog.updateMany({
          where: { id: claimedLogId, odysseyLeaseToken: leaseToken, odysseyCreditAppliedAt: null },
          data: { odysseyCreditAppliedAt: creditAppliedAt, odysseyLeaseExpiresAt: leaseExpiresAt() },
        }));
        await tx.studentProfile.upsert({
          where: { userId: actionUser.id },
          update: { controlCredits: { increment: creditsEarned }, controlOdysseyProgress: nextProgress },
          create: { userId: actionUser.id, controlCredits: creditsEarned, controlUnlocks: latestUnlocks,
            controlOdysseyProgress: nextProgress, controlControllerLevels: defaultControllerLevels() },
        });
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
        if (verifiedRun) {
          if (verifiedRun.trace.changes.some(change => change.config.controlMode !== 'AUTO' || change.command !== 0)) {
            throw new Error('此运行包含手动操作，不能作为 Arena 官方成绩。');
          }
          officialMetrics = { ...verifiedRun.metrics, officialTelemetrySource: 'server-rust-simulation' };
        } else {
          officialMetrics = computeOfficialOdysseyTelemetry({
            levelId: legacyArenaSnapshot!.levelId as string,
            tier: bridgeContext?.tier, controllerId: bridgeContext?.controllerId, controlMode: bridgeContext?.controlMode,
            pidParams: bridgeContext?.pidParams, extraParams: bridgeContext?.extraParams,
            enableSpeedFeedback: bridgeContext?.enableSpeedFeedback, enableFeedforward: bridgeContext?.enableFeedforward,
            enableSmithPredictor: bridgeContext?.enableSmithPredictor, difficultyScale: bridgeContext?.difficultyScale,
            controllerLevels: legacyArenaSnapshot!.controllerLevels as ControlControllerLevels,
          });
        }
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
      const completedAt = new Date();
      assertOdysseyLeaseOwned(await prisma.simulationLog.updateMany({
        where: { id: log.id, odysseyLeaseToken: leaseToken },
        data: {
          odysseyCompletedAt: completedAt,
          odysseyLeaseToken: null,
          odysseyLeaseExpiresAt: null,
        },
      }));
      if (verifiedRun && !isArenaAssignedRun) {
        await persistOrdinaryOdysseyTaskEvidence({
          userId: actionUser.id,
          role: actionUser.role,
          log: {
            ...log,
            odysseyCompletedAt: completedAt,
          },
          levelId: persistedLevelId,
        });
      }
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
      controlMode: 'GAME',
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

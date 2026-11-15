import { randomBytes, randomUUID } from 'node:crypto';

import type { IlabExperimentRun, Prisma } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { emptyAiLedger } from '../ai-data';
import type { IlabGrantPayload } from '../grant-cookie';
import { IlabServiceError, withIlabRunLock } from '../run-lock';
import { resolveSessionAuth } from '../session-shared';
import {
  ensureIlabPlatformUser,
  ensureIlabUserFromGrant,
  type IlabAuthUserSummary,
} from './ilab-account-service';

export interface StepDraftsPayload {
  activeSeq?: number;
  bySeq: Record<string, Record<string, string>>;
  updatedAtMs?: number;
  courseState?: Record<string, unknown>;
}

export type UnifiedSessionActor =
  | {
      kind: 'ilab';
      userId: string;
      displayName: string;
      user: IlabAuthUserSummary;
      grantToSet: IlabGrantPayload;
    }
  | {
      kind: 'platform';
      userId: string;
      displayName: string;
      user: null;
      grantToSet: null;
    };

function cleanDraftValues(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      out[key] = key === 'sketchImage' ? value.slice(0, 260_000) : value.slice(0, 8000);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = String(value);
    }
  }
  return out;
}

export function parseStepDrafts(raw: unknown): StepDraftsPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { bySeq: {} };
  }
  const source = raw as Record<string, unknown>;
  const bySeq: Record<string, Record<string, string>> = {};
  if (source.bySeq && typeof source.bySeq === 'object' && !Array.isArray(source.bySeq)) {
    for (const [seqKey, entry] of Object.entries(source.bySeq)) {
      if (!/^\d{1,3}$/.test(seqKey)) continue;
      const cleaned = cleanDraftValues(entry);
      if (Object.keys(cleaned).length > 0) {
        bySeq[seqKey] = cleaned;
      }
    }
  }
  const activeSeq = typeof source.activeSeq === 'number' && Number.isInteger(source.activeSeq) && source.activeSeq > 0
    ? source.activeSeq
    : undefined;
  const updatedAtMs = typeof source.updatedAtMs === 'number' && Number.isFinite(source.updatedAtMs)
    ? source.updatedAtMs
    : undefined;
  const courseState = source.courseState && typeof source.courseState === 'object' && !Array.isArray(source.courseState)
    ? source.courseState as Record<string, unknown>
    : undefined;
  return {
    ...(activeSeq !== undefined ? { activeSeq } : {}),
    bySeq,
    ...(updatedAtMs !== undefined ? { updatedAtMs } : {}),
    ...(courseState ? { courseState } : {}),
  };
}

export function mergeStepDrafts(
  currentRaw: unknown,
  patch: {
    activeSeq?: number;
    seq?: number;
    readings?: Record<string, string>;
    removeSeq?: number;
    courseState?: Record<string, unknown>;
  },
): StepDraftsPayload {
  const current = parseStepDrafts(currentRaw);
  const currentReportRef = current.courseState?.reportClientRef;
  const nextReportRef = patch.courseState?.reportClientRef;
  if (typeof currentReportRef === 'string' && typeof nextReportRef === 'string'
    && currentReportRef !== nextReportRef) {
    throw new IlabServiceError('这份草稿属于另一轮实验，请重新读取该轮进度。', 409);
  }
  const bySeq: Record<string, Record<string, string>> = { ...current.bySeq };

  if (patch.seq !== undefined && Number.isInteger(patch.seq) && patch.seq > 0 && patch.readings !== undefined) {
    const cleaned = cleanDraftValues(patch.readings);
    if (Object.keys(cleaned).length > 0) {
      bySeq[String(patch.seq)] = cleaned;
    } else {
      delete bySeq[String(patch.seq)];
    }
  }

  if (patch.removeSeq !== undefined && Number.isInteger(patch.removeSeq) && patch.removeSeq > 0) {
    delete bySeq[String(patch.removeSeq)];
  }

  const activeSeq = patch.activeSeq !== undefined && Number.isInteger(patch.activeSeq) && patch.activeSeq > 0
    ? patch.activeSeq
    : current.activeSeq;
  const courseState = patch.courseState !== undefined
    ? { ...(current.courseState ?? {}), ...patch.courseState }
    : current.courseState;

  return {
    ...(activeSeq !== undefined ? { activeSeq } : {}),
    bySeq,
    updatedAtMs: Date.now(),
    ...(courseState ? { courseState } : {}),
  };
}

export function resolveIlabUploadMode(run: { appId: string; accessToken: string }): 'local-only' | 'dev-bypass' | 'ilab-remote' {
  if (run.appId === 'platform' && !run.accessToken) return 'local-only';
  if (run.accessToken === 'dev-bypass-token') return 'dev-bypass';
  return 'ilab-remote';
}

export function resolveUploadStateLabel(run: { status: number; uploadStatus: string; appId: string; accessToken: string }):
  | 'pending'
  | 'uploaded'
  | 'failed'
  | 'score-uploaded'
  | 'local-only'
  | 'skipped' {
  const mode = resolveIlabUploadMode(run);
  if (mode === 'local-only' || run.uploadStatus === 'local-only') return 'local-only';
  if (run.uploadStatus === 'uploaded') return 'uploaded';
  if (run.uploadStatus === 'score-uploaded') return 'score-uploaded';
  if (run.uploadStatus === 'failed') return 'failed';
  if (run.uploadStatus === 'skipped') return 'skipped';
  return 'pending';
}

/**
 * 统一解析实验会话操作主体：
 * 1. 若携带实验空间 ticket 或有效 grant，则自动建号/同步并返回带 userId 的 grant；
 * 2. 若无实验空间凭据，则回退检查本平台 NextAuth 会话，为登录用户建立纯平台服务端记录；
 * 3. 未登录访客返回 null。
 */
export async function resolveUnifiedSessionActor(input: {
  ticket?: string;
  grant?: IlabGrantPayload | null;
  platformUser?: { id: string; name?: string | null } | null;
}): Promise<UnifiedSessionActor | null> {
  const auth = await resolveSessionAuth(input.ticket ?? '', input.grant ?? null);
  if (auth) {
    const provisioned = auth.freshlyExchanged && auth.token
      ? await ensureIlabPlatformUser({
          appId: auth.grant.appId,
          token: auth.token,
        })
      : await ensureIlabUserFromGrant(auth.grant);

    const displayName = (provisioned.user.name || auth.grant.displayName || provisioned.ilabUsername).trim();
    const grantToSet: IlabGrantPayload = {
      ...auth.grant,
      displayName,
      userId: provisioned.user.id,
    };
    return {
      kind: 'ilab',
      userId: provisioned.user.id,
      displayName,
      user: provisioned.user,
      grantToSet,
    };
  }

  let platformUser = input.platformUser ?? null;
  if (!platformUser) {
    const session = await getServerAuthSession().catch(() => null);
    if (session?.user?.id) {
      platformUser = {
        id: session.user.id,
        name: session.user.name,
      };
    }
  }

  if (platformUser?.id) {
    return {
      kind: 'platform',
      userId: platformUser.id,
      displayName: (platformUser.name || '同学').trim(),
      user: null,
      grantToSet: null,
    };
  }

  return null;
}

/**
 * 查找同一用户在当前船舶实验下的可恢复会话（进行中 status=2 或外网回传暂失败待重传），
 * 若传入新鲜的实验空间授权（如用户换新 ticket 重进），自动将新 accessToken 刷回原运行记录。
 */
export async function findRecoverableIlabRun(input: {
  vesselId: string;
  experimentVersion?: string;
  actor: UnifiedSessionActor;
  forceNew?: boolean;
}, db: Prisma.TransactionClient = prisma): Promise<IlabExperimentRun | null> {
  if (input.forceNew) return null;

  const baseFilter: Prisma.IlabExperimentRunWhereInput = {
    vesselId: input.vesselId,
    ...(input.experimentVersion ? { experimentVersion: input.experimentVersion } : {}),
    OR: [
      { status: 2 },
      { uploadStatus: { in: ['failed', 'score-uploaded'] } },
    ],
  };

  let existing = await db.ilabExperimentRun.findFirst({
    where: {
      userId: input.actor.userId,
      ...baseFilter,
    },
    orderBy: [{ startTimeMs: 'desc' }, { id: 'desc' }],
  });

  if (!existing && input.actor.kind === 'ilab') {
    existing = await db.ilabExperimentRun.findFirst({
      where: {
        appId: input.actor.grantToSet.appId,
        ilabUsername: input.actor.grantToSet.username,
        ...baseFilter,
      },
      orderBy: [{ startTimeMs: 'desc' }, { id: 'desc' }],
    });
  }

  if (!existing) return null;

  if (input.actor.kind === 'ilab') {
    const grant = input.actor.grantToSet;
    return db.ilabExperimentRun.update({
      where: { id: existing.id },
      data: {
        userId: input.actor.userId,
        appId: grant.appId,
        ilabUsername: grant.username,
        displayName: grant.displayName,
        accessToken: grant.accessToken,
        tokenExpiresAt: grant.expiresAtMs ? new Date(grant.expiresAtMs) : null,
      },
    });
  }

  if (!existing.userId) {
    return db.ilabExperimentRun.update({
      where: { id: existing.id },
      data: {
        userId: input.actor.userId,
        displayName: existing.displayName || input.actor.displayName,
      },
    });
  }

  return existing;
}

export async function openIlabRun(input: {
  actor: UnifiedSessionActor;
  vesselId: string;
  originPrefix: string;
  experimentVersion: string;
  forceNew?: boolean;
}): Promise<{ run: IlabExperimentRun; resumed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const lockKey = JSON.stringify([input.actor.userId, input.vesselId, input.experimentVersion]);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
    const recoverable = await findRecoverableIlabRun(input, tx);
    if (recoverable) return { run: recoverable, resumed: true };

    const { actor } = input;
    const startTimeMs = actor.kind === 'ilab' ? Math.max(Date.now(), actor.grantToSet.issuedAtMs) : Date.now();
    const run = await tx.ilabExperimentRun.create({ data: {
      originId: `${input.originPrefix}${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`,
      userId: actor.userId,
      vesselId: input.vesselId,
      experimentVersion: input.experimentVersion,
      appId: actor.kind === 'ilab' ? actor.grantToSet.appId : 'platform',
      ilabUsername: actor.kind === 'ilab' ? actor.grantToSet.username : actor.userId,
      displayName: actor.displayName,
      accessToken: actor.kind === 'ilab' ? actor.grantToSet.accessToken : '',
      tokenExpiresAt: actor.kind === 'ilab' && actor.grantToSet.expiresAtMs
        ? new Date(actor.grantToSet.expiresAtMs) : null,
      startTimeMs: BigInt(startTimeMs),
      uploadStatus: actor.kind === 'ilab' ? 'pending' : 'local-only',
      steps: [],
      ...(input.experimentVersion !== 'legacy-v1' ? { stepDrafts: {
        activeSeq: 1, bySeq: {}, courseState: { reportClientRef: randomUUID() },
      } } : {}),
      aiLedger: emptyAiLedger() as unknown as Prisma.InputJsonValue,
    } });
    return { run, resumed: false };
  });
}

export async function resolveCurrentActorContext(existingGrant: IlabGrantPayload | null): Promise<{
  userId: string | null;
  grant: IlabGrantPayload | null;
}> {
  const session = await getServerAuthSession().catch(() => null);
  return {
    userId: session?.user?.id ?? existingGrant?.userId ?? null,
    grant: existingGrant,
  };
}

export async function assertIlabRunAccess(
  run: Pick<IlabExperimentRun, 'userId' | 'appId' | 'ilabUsername'>,
  actor: { userId?: string | null; grant?: IlabGrantPayload | null },
  strict = true,
): Promise<void> {
  if (run.appId === 'platform' || strict) {
    const ownsByUser = Boolean(actor.userId && run.userId && actor.userId === run.userId);
    const ownsByGrant = Boolean(
      !actor.userId
      && actor.grant
      && actor.grant.appId === run.appId
      && actor.grant.username === run.ilabUsername,
    );
    if (!ownsByUser && !ownsByGrant) {
      throw new IlabServiceError('无权操作该实验会话。', 403);
    }
  }
}

export async function saveIlabRunDraft(input: {
  originId: string;
  expectedVesselId?: string;
  actor: { userId?: string | null; grant?: IlabGrantPayload | null };
  activeSeq?: number;
  seq?: number;
  readings?: Record<string, string>;
  courseState?: Record<string, unknown>;
}): Promise<StepDraftsPayload> {
  return withIlabRunLock(input.originId, async (existing, tx) => {
    if (input.expectedVesselId && existing.vesselId !== input.expectedVesselId) {
      throw new IlabServiceError('实验记录不存在。', 404);
    }
    await assertIlabRunAccess(existing, input.actor, true);
    let currentDrafts = parseStepDrafts(existing.stepDrafts);
    if (existing.reportId && input.courseState?.reportClientRef) {
      const report = await tx.virtualSimulationReport.findUnique({ where: { id: existing.reportId }, select: { clientRef: true } });
      if (report?.clientRef && report.clientRef !== input.courseState.reportClientRef) {
        throw new IlabServiceError('这份草稿与实验报告的轮次不一致。', 409);
      }
      if (report?.clientRef && typeof currentDrafts.courseState?.reportClientRef === 'string'
        && currentDrafts.courseState.reportClientRef !== report.clientRef) {
        currentDrafts = { bySeq: {}, courseState: { reportClientRef: report.clientRef } };
      }
    }
    const nextDrafts = mergeStepDrafts(currentDrafts, {
      activeSeq: input.activeSeq,
      seq: input.seq,
      readings: input.readings,
      courseState: input.courseState,
    });
    await tx.ilabExperimentRun.update({
      where: { id: existing.id },
      data: { stepDrafts: nextDrafts as unknown as Prisma.InputJsonValue },
    });
    return nextDrafts;
  });
}

import type { Prisma, PrismaClient } from '@prisma/client';

import { generateSessionSummaryReports } from './session-reports';

type SessionClosureDb = Pick<PrismaClient,
  | 'sessionClosureOutbox'
  | 'sessionClosurePhase'
  | 'classSessionReport'
  | 'classSession'
  | 'studentState'
  | 'interactionLog'
  | 'learningFact'
  | 'studentStepResponse'
  | 'studentCompetencySnapshot'
  | 'studentSessionReport'
  | 'user'
>;

export const CLOSURE_PHASES = ['materialize', 'summarize', 'cache'] as const;
export type SessionClosurePhaseName = (typeof CLOSURE_PHASES)[number];

const PHASE_SELECT = {
  id: true,
  closureOutboxId: true,
  sessionId: true,
  phase: true,
  status: true,
  total: true,
  done: true,
  detail: true,
  updatedAt: true,
} as const;

type PhaseRow = {
  id: string;
  closureOutboxId: string;
  sessionId: string;
  phase: string;
  status: string;
  total: number | null;
  done: number;
  detail: Prisma.JsonValue;
  updatedAt: Date;
};

/**
 * 确保闭包的阶段台账行存在（幂等）。台账是闭包完备性的唯一真源：
 * 结算不看任何旁路作业的结果，只看这里的回执。
 */
export async function ensureSessionClosurePhases(
  db: Pick<PrismaClient, 'sessionClosureOutbox' | 'sessionClosurePhase'>,
  sessionId: string,
): Promise<PhaseRow[]> {
  const closure = await db.sessionClosureOutbox.findFirst({
    where: { sessionId, status: { in: ['PENDING', 'FAILED'] } },
    orderBy: { availableAt: 'desc' },
  });
  if (!closure) return [];

  await db.sessionClosurePhase.createMany({
    data: CLOSURE_PHASES.map((phase) => ({
      closureOutboxId: closure.id,
      sessionId,
      phase,
    })),
    skipDuplicates: true,
  });

  return db.sessionClosurePhase.findMany({
    where: { closureOutboxId: closure.id },
    select: PHASE_SELECT,
    orderBy: { phase: 'asc' },
  });
}

async function markPhase(
  db: Pick<PrismaClient, 'sessionClosurePhase'>,
  phaseId: string,
  data: {
    status?: string;
    total?: number;
    done?: number;
    detail?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.sessionClosurePhase.update({ where: { id: phaseId }, data });
}

/**
 * 执行一个闭包阶段并写入持久化回执。每个阶段都可安全重放：
 * - materialize：从水位以内的持久化证据重放缺失的 LearningFact（幂等，按
 *   sourceEventId 唯一约束收敛）——这是提交后到闭课间一切物化丢失的恢复边界；
 * - summarize：重算水位限定报告（幂等 upsert）；
 * - cache：按水位内证据参与者（非 StudentState）扇出证据特征缓存刷新，
 *   按参与者聚合完成状态，任一失败保持 FAILED 待重放。
 */
export async function runSessionClosurePhase(
  db: SessionClosureDb,
  sessionId: string,
  phase: SessionClosurePhaseName,
  deps: {
    refreshEvidenceFeatureCache: (userId: string) => Promise<unknown>;
    materializeEvidence: (evidence: ClosureEvidenceRow) => Promise<boolean>;
  },
): Promise<{ status: 'SUCCEEDED' | 'FAILED'; detail: Record<string, unknown> }> {
  const rows = await ensureSessionClosurePhases(db, sessionId);
  const row = rows.find((entry) => entry.phase === phase);
  if (!row) {
    return { status: 'FAILED', detail: { reason: 'closure_not_pending' } };
  }

  try {
    if (phase === 'materialize') {
      const result = await replayMissingClosureFacts(db, sessionId, deps.materializeEvidence);
      await markPhase(db, row.id, {
        status: 'SUCCEEDED',
        total: result.examined,
        done: result.created,
        detail: result as Prisma.InputJsonValue,
      });
      await projectClosureLedgerIntoReport(db, sessionId).catch(() => undefined);
      return { status: 'SUCCEEDED', detail: result as Record<string, unknown> };
    }

    if (phase === 'summarize') {
      const result = await generateSessionSummaryReports(db, sessionId);
      if (result.skipped) {
        throw new Error('session summary report generation skipped');
      }
      await markPhase(db, row.id, {
        status: 'SUCCEEDED',
        done: 1,
        detail: result as Prisma.InputJsonValue,
      });
      return { status: 'SUCCEEDED', detail: result as Record<string, unknown> };
    }

    // cache：参与者从水位以内证据推导，逐人刷新并聚合
    const participants = await listClosureEvidenceParticipants(db, sessionId);
    const detail: Record<string, string> = {};
    let failures = 0;
    for (const userId of participants) {
      try {
        await deps.refreshEvidenceFeatureCache(userId);
        detail[userId] = 'SUCCEEDED';
      } catch (error) {
        failures += 1;
        detail[userId] = `FAILED: ${String((error as Error)?.message ?? error).slice(0, 160)}`;
      }
    }
    await markPhase(db, row.id, {
      status: failures > 0 ? 'FAILED' : 'SUCCEEDED',
      total: participants.length,
      done: participants.length - failures,
      detail: detail as Prisma.InputJsonValue,
    });
    await projectClosureLedgerIntoReport(db, sessionId).catch(() => undefined);
    return {
      status: failures > 0 ? 'FAILED' : 'SUCCEEDED',
      detail: { participants: participants.length, failures },
    };
  } catch (error) {
    const detail = { reason: String((error as Error)?.message ?? error).slice(0, 200) };
    await markPhase(db, row.id, { status: 'FAILED', detail: detail as Prisma.InputJsonValue });
    await projectClosureLedgerIntoReport(db, sessionId).catch(() => undefined);
    return { status: 'FAILED', detail };
  }
}

/** 水位以内的证据参与者：闭包派生工作的唯一合法分母。 */
export async function listClosureEvidenceParticipants(
  db: Pick<PrismaClient, 'classSession' | 'studentStepResponse'>,
  sessionId: string,
): Promise<string[]> {
  const session = await db.classSession.findUnique({
    where: { id: sessionId },
    select: { acceptedSubmissionWatermark: true },
  });
  if (!session) return [];
  const watermark = session.acceptedSubmissionWatermark;
  const rows = await db.studentStepResponse.findMany({
    where: {
      sessionId,
      evidenceStatus: 'ACCEPTED',
      ...(watermark != null
        ? {
          OR: [
            { submissionSequence: { lte: watermark } },
            { submissionSequence: null },
          ],
        }
        : {}),
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((row) => row.userId).sort();
}

/**
 * 从持久化证据重放缺失的 LearningFact。仅处理水位以内的 ACCEPTED 证据，
 * 且只补建当前事实缺失的行（sourceEventId 唯一约束兜底并发）；
 * 与提交时的内联快路径共用同一物化函数，行为一致。
 */
export interface ClosureEvidenceRow {
  userId: string;
  sessionId: string;
  clientEventId: string | null;
  sourceLogId: string | null;
  submittedAt: Date;
  responseData: Prisma.JsonValue;
}

export async function replayMissingClosureFacts(
  db: Pick<PrismaClient, 'classSession' | 'studentStepResponse' | 'learningFact'>,
  sessionId: string,
  materializeEvidence: (evidence: ClosureEvidenceRow) => Promise<boolean>,
): Promise<{ examined: number; missing: number; created: number }> {
  const session = await db.classSession.findUnique({
    where: { id: sessionId },
    select: { acceptedSubmissionWatermark: true },
  });
  if (!session) return { examined: 0, missing: 0, created: 0 };
  const watermark = session.acceptedSubmissionWatermark;

  const rows = await db.studentStepResponse.findMany({
    where: {
      sessionId,
      evidenceStatus: 'ACCEPTED',
      ...(watermark != null
        ? {
          OR: [
            { submissionSequence: { lte: watermark } },
            { submissionSequence: null },
          ],
        }
        : {}),
    },
    select: {
      userId: true,
      clientEventId: true,
      sourceLogId: true,
      submittedAt: true,
      responseData: true,
    },
  });

  let missing = 0;
  let created = 0;
  for (const row of rows) {
    if (!row.clientEventId) continue;
    const existing = await db.learningFact.findFirst({
      where: { sourceEventId: row.clientEventId },
      select: { id: true },
    });
    if (existing) continue;
    missing += 1;
    const persisted = await materializeEvidence({
      userId: row.userId,
      sessionId,
      clientEventId: row.clientEventId,
      sourceLogId: row.sourceLogId,
      submittedAt: row.submittedAt,
      responseData: row.responseData,
    });
    if (persisted) created += 1;
  }
  return { examined: rows.length, missing, created };
}

/**
 * 台账 → 报告投影回写：materialize/cache 回执变化后调用，使 class-summary
 * 报告的 phases 与台账保持一致（消除"报告生成时快照"的滞后）。
 * 与 session-reports.ts 生成时的投影共用同一形状；报告不存在时静默跳过。
 */
export async function projectClosureLedgerIntoReport(
  db: SessionClosureDb,
  sessionId: string,
): Promise<void> {
  const closure = await db.sessionClosureOutbox.findFirst({
    where: { sessionId },
    orderBy: { availableAt: 'desc' },
    select: { id: true },
  });
  const report = await db.classSessionReport.findUnique({
    where: { sessionId_reportType: { sessionId, reportType: 'class-summary' } },
    select: { reportData: true },
  });
  if (!closure || !report) return;
  const rows = await db.sessionClosurePhase.findMany({
    where: { closureOutboxId: closure.id },
    select: { phase: true, status: true, total: true, done: true, detail: true },
  });
  const materializeRow = rows.find((entry) => entry.phase === 'materialize') ?? null;
  const cacheRow = rows.find((entry) => entry.phase === 'cache') ?? null;

  const data: Record<string, unknown> =
    report.reportData && typeof report.reportData === 'object' && !Array.isArray(report.reportData)
      ? { ...(report.reportData as Record<string, unknown>) }
      : {};
  const phases: Record<string, unknown> =
    data.phases && typeof data.phases === 'object' && !Array.isArray(data.phases)
      ? { ...(data.phases as Record<string, unknown>) }
      : {};
  if (materializeRow) {
    phases.materialized = {
      status: materializeRow.status,
      examined: materializeRow.total,
      factsCreated: materializeRow.done,
      source: 'session-closure-phase ledger',
      ...(materializeRow.status === 'FAILED' ? { detail: materializeRow.detail } : {}),
    };
  }
  if (cacheRow) {
    phases.cached = {
      status: cacheRow.status,
      participants: cacheRow.total,
      refreshed: cacheRow.done,
      source: 'session-closure-phase ledger',
      ...(cacheRow.status === 'FAILED' ? { detail: cacheRow.detail } : {}),
    };
  }
  data.phases = phases;
  await db.classSessionReport.update({
    where: { sessionId_reportType: { sessionId, reportType: 'class-summary' } },
    data: { reportData: data as Prisma.InputJsonValue },
  });
}

/**
 * 收敛式结算：闭包（最新 PENDING/FAILED）的全部阶段台账行均为 SUCCEEDED 时，
 * 才置为 SUCCEEDED。其余情况保持原状，由周期协调器继续重放未完成阶段。
 */
export async function settleSessionClosuresIfComplete(
  db: Pick<PrismaClient, 'sessionClosureOutbox' | 'sessionClosurePhase'>,
  sessionIds: string[],
): Promise<number> {
  let settled = 0;
  for (const sessionId of sessionIds) {
    const closure = await db.sessionClosureOutbox.findFirst({
      where: { sessionId, status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { availableAt: 'desc' },
    });
    if (!closure) continue;
    const phases = await db.sessionClosurePhase.findMany({
      where: { closureOutboxId: closure.id },
      select: { phase: true, status: true },
    });
    const complete = CLOSURE_PHASES.every((phase) =>
      phases.some((row) => row.phase === phase && row.status === 'SUCCEEDED')
    );
    if (!complete) continue;
    await db.sessionClosureOutbox.update({
      where: { id: closure.id },
      data: { status: 'SUCCEEDED', processedAt: new Date() },
    });
    settled += 1;
  }
  return settled;
}

/**
 * 阶段执行计划（严格串行依赖链）：materialize → cache → summarize。
 * summarize 是报告的生成者，必须最后运行——它读取的台账已含最终 cache
 * 回执，从结构上消除"并发阶段把 PENDING 快照固化进报告"的竞态。
 * 每级在输入阶段成功后才运行，且输入阶段重跑后（updatedAt 更新），
 * 陈旧的下游会被强制重算。
 */
export function planClosurePhaseRun(rows: PhaseRow[]): SessionClosurePhaseName[] {
  const byPhase = new Map(rows.map((row) => [row.phase, row]));
  const materialize = byPhase.get('materialize');
  if (!materialize || materialize.status !== 'SUCCEEDED') {
    return materialize ? ['materialize'] : [];
  }
  const cache = byPhase.get('cache');
  if (!cache) return [];
  if (cache.status !== 'SUCCEEDED' || new Date(cache.updatedAt) < new Date(materialize.updatedAt)) {
    return ['cache'];
  }
  const summarize = byPhase.get('summarize');
  if (!summarize) return [];
  const stale = new Date(summarize.updatedAt) < new Date(materialize.updatedAt)
    || new Date(summarize.updatedAt) < new Date(cache.updatedAt);
  if (summarize.status !== 'SUCCEEDED' || stale) {
    return ['summarize'];
  }
  return [];
}

/** 未完成阶段的清单（含陈旧失效）：协调器据此重放（唯一的恢复入口）。 */
export function incompletePhases(rows: PhaseRow[]): SessionClosurePhaseName[] {
  return planClosurePhaseRun(rows);
}

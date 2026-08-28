import type { Prisma, PrismaClient } from '@prisma/client';

type SessionClosurePrisma = Pick<PrismaClient, 'sessionClosureOutbox' | 'classSessionReport'>;

export type SessionClosurePhase = 'captured' | 'materialized' | 'summarized' | 'cached';

/**
 * 闭包 outbox 补投扫描：找出仍处于 PENDING/FAILED 的闭包并为每个会话调用
 * 给定的入队回调（使用既有幂等 jobId）。闭课时 Redis 不可用导致的漏投，
 * 会由周期调度在本扫描中恢复，保证水位绑定的报告/物化闭环不丢。
 */
export async function redispatchPendingSessionClosures(
  db: Pick<PrismaClient, 'sessionClosureOutbox'>,
  enqueue: (sessionId: string) => Promise<unknown>,
): Promise<string[]> {
  const pending = await db.sessionClosureOutbox.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] } },
    select: { sessionId: true },
    orderBy: { availableAt: 'asc' },
    take: 50,
  });
  const sessionIds = [...new Set(pending.map((row) => row.sessionId))];
  for (const sessionId of sessionIds) {
    await enqueue(sessionId);
  }
  return sessionIds;
}

/**
 * 水印限定的报告消费成功后结算闭包 outbox。结算按 (sessionId, closureRevision)
 * 幂等：重复投递不会重复处理（PENDING/FAILED 均在成功后收敛为 SUCCEEDED），
 * 也不会扩大闭包（水位在 end 事务中已固化，此处只读）。
 */
export async function settleSessionClosureOutbox(
  db: SessionClosurePrisma,
  sessionId: string,
): Promise<number> {
  const settled = await db.sessionClosureOutbox.updateMany({
    where: { sessionId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'SUCCEEDED', processedAt: new Date() },
  });
  return settled.count;
}

export async function failSessionClosureOutbox(
  db: SessionClosurePrisma,
  sessionId: string,
  errorCode: string,
): Promise<number> {
  const failed = await db.sessionClosureOutbox.updateMany({
    where: { sessionId, status: { in: ['PENDING', 'FAILED'] } },
    data: {
      status: 'FAILED',
      lastErrorCode: errorCode,
      attemptCount: { increment: 1 },
    },
  });
  return failed.count;
}

/**
 * 阶段完成判定结算：仅当水位限定报告的 summarized 阶段晚于闭包入队时间、
 * 且缓存阶段已记录 SUCCEEDED 时才置为 SUCCEEDED。事件摄取阶段由全局
 * coordinator 消费，无法按会话记录完成回执，报告中以 materialized 观测计数
 * 如实呈现（OBSERVED，不声称完成）。
 */
export async function settleSessionClosureIfPhasesComplete(
  db: SessionClosurePrisma,
  sessionId: string,
): Promise<boolean> {
  const pending = await db.sessionClosureOutbox.findFirst({
    where: { sessionId, status: { in: ['PENDING', 'FAILED'] } },
    orderBy: { availableAt: 'desc' },
  });
  if (!pending) return false;
  const report = await db.classSessionReport.findUnique({
    where: { sessionId_reportType: { sessionId, reportType: 'class-summary' } },
    select: { reportData: true, closureRevision: true },
  });
  if (!report || report.closureRevision !== pending.closureRevision) return false;
  const data = (report.reportData && typeof report.reportData === 'object' && !Array.isArray(report.reportData)
    ? report.reportData
    : {}) as Record<string, unknown>;
  const phases = (data.phases && typeof data.phases === 'object' && !Array.isArray(data.phases)
    ? data.phases
    : {}) as Record<string, Record<string, unknown>>;
  const summarizedAt = phases.summarized?.generatedAt;
  if (typeof summarizedAt !== 'string') return false;
  if (!(new Date(summarizedAt) > pending.availableAt)) return false;
  if (phases.cached?.status !== 'SUCCEEDED') return false;
  await settleSessionClosureOutbox(db, sessionId);
  return true;
}

/** 把 worker 阶段的真实状态（含部分失败）合并进 class-summary 报告的 phases。 */
export async function recordSessionReportPhase(
  db: SessionClosurePrisma,
  sessionId: string,
  phase: SessionClosurePhase,
  entry: Record<string, unknown>,
): Promise<void> {
  const report = await db.classSessionReport.findUnique({
    where: {
      sessionId_reportType: {
        sessionId,
        reportType: 'class-summary',
      },
    },
    select: { reportData: true },
  });
  if (!report) return;

  const data: Record<string, unknown> =
    report.reportData && typeof report.reportData === 'object' && !Array.isArray(report.reportData)
      ? { ...(report.reportData as Record<string, unknown>) }
      : {};
  const phases: Record<string, unknown> =
    data.phases && typeof data.phases === 'object' && !Array.isArray(data.phases)
      ? { ...(data.phases as Record<string, unknown>) }
      : {};
  phases[phase] = entry;
  data.phases = phases;

  await db.classSessionReport.update({
    where: {
      sessionId_reportType: {
        sessionId,
        reportType: 'class-summary',
      },
    },
    data: { reportData: data as Prisma.InputJsonValue },
  });
}

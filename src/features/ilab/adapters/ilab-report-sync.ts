import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * 将完成一次实验（无论是本平台登录用户还是实验空间用户）的操作结果与报告
 * 按平台统一的 VirtualSimulationReport 结构持久化，并双向关联到 IlabExperimentRun，
 * 以便收集平台数据并在外网回传失败时本地保留报告与重试恢复。
 */
export async function syncPlatformReportForIlabRun(input: {
  runId: string;
  userId: string | null;
  experimentKey: string;
  experimentVersion?: string;
  title: string;
  score: number;
  maxScore: number;
  reportHtml: string;
  stepScores: unknown;
}): Promise<{ reportId: string | null }> {
  const userId = input.userId?.trim() || null;
  if (!userId || !input.reportHtml.trim()) {
    return { reportId: null };
  }

  const normalizedScore = Math.max(0, Math.round(input.score));
  const normalizedMaxScore = Math.max(1, Math.round(input.maxScore));
  const stepScoresJson = input.stepScores as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const run = await tx.ilabExperimentRun.findUnique({
      where: { id: input.runId },
      select: { id: true, reportId: true },
    });
    if (!run) {
      return { reportId: null };
    }

    if (run.reportId) {
      const existing = await tx.virtualSimulationReport.findUnique({
        where: { id: run.reportId },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId === userId) {
        const updated = await tx.virtualSimulationReport.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            score: normalizedScore,
            maxScore: normalizedMaxScore,
            reportHtml: input.reportHtml,
            stepScores: stepScoresJson,
            status: 'finalized',
            finalizedAt: new Date(),
          },
          select: { id: true },
        });
        return { reportId: updated.id };
      }
    }

    const created = await tx.virtualSimulationReport.create({
      data: {
        userId,
        experimentKey: input.experimentKey,
        experimentVersion: input.experimentVersion || 'legacy-v1',
        status: 'finalized',
        title: input.title,
        score: normalizedScore,
        maxScore: normalizedMaxScore,
        reportHtml: input.reportHtml,
        stepScores: stepScoresJson,
        finalizedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.ilabExperimentRun.update({
      where: { id: run.id },
      data: { reportId: created.id },
    });

    return { reportId: created.id };
  });
}

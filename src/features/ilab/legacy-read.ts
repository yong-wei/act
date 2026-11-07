import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { StoredIlabStep } from './payload';
import { IlabServiceError } from './run-lock';

function readSteps(value: Prisma.JsonValue): StoredIlabStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as unknown as StoredIlabStep;
    if (typeof record.seq !== 'number') return [];
    return [record];
  });
}

/**
 * 旧 24 步综合实验（dsc_ 前缀）的退役后只读读取。
 *
 * 仅服务于历史记录查看：不加载旧评分器、不创建或修改任何运行。
 * 访问语义与退役前一致（originId 归属即原票据语义），不构成新授权。
 */

async function findRun(originId: string) {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(originId)) {
    throw new IlabServiceError('实验记录编号无效。', 400);
  }
  const run = await prisma.ilabExperimentRun.findUnique({ where: { originId } });
  if (!run) throw new IlabServiceError('实验记录不存在。', 404);
  return run;
}

export interface LegacySessionView {
  originId: string;
  displayName: string;
  username: string;
  status: number;
  score: number;
  vesselId: string;
  uploadStatus: string;
  steps: Array<{
    seq: number;
    title: string;
    earnedPoints: number;
    maxPoints: number;
    evaluation: string;
    remarks: string;
    repeatCount: number;
  }>;
  reportReady: boolean;
}

export async function readLegacySession(originId: string): Promise<LegacySessionView> {
  const run = await findRun(originId);
  return {
    originId: run.originId,
    displayName: run.displayName,
    username: run.ilabUsername,
    status: run.status,
    score: run.score,
    vesselId: run.vesselId,
    uploadStatus: run.uploadStatus,
    steps: readSteps(run.steps).map((step) => ({
      seq: step.seq,
      title: step.title,
      earnedPoints: step.earnedPoints,
      maxPoints: step.maxPoints,
      evaluation: step.evaluation,
      remarks: step.remarks,
      repeatCount: step.repeatCount,
    })),
    reportReady: Boolean(run.reportHtml),
  };
}

export async function readLegacyReport(originId: string): Promise<string> {
  const run = await findRun(originId);
  if (!run.reportHtml) throw new IlabServiceError('实验报告尚未生成。', 404);
  return run.reportHtml;
}

import type { IlabExperimentRun, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * 共享实验运行锁与错误语义。
 *
 * 供七船独立实验（vessel/destroyer）与既有实验 API 共用的运行级事务锁、
 * 错误类型与开放状态断言；与旧 24 步综合课程实现解耦。
 */
export class IlabServiceError extends Error {
  constructor(message: string, readonly status: number, readonly retryReport = false) {
    super(message);
    this.name = 'IlabServiceError';
  }
}

export function toIlabHttpError(error: unknown): { status: number; message: string; retryReport: boolean } {
  if (error instanceof IlabServiceError) {
    return { status: error.status, message: error.message, retryReport: error.retryReport };
  }
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === 'P2021' || code === 'P2022') {
    return { status: 503, message: '实验记录表尚未迁移，暂时不能开始实验。', retryReport: false };
  }
  return { status: 500, message: '实验服务暂时不可用。', retryReport: false };
}

export function assertIlabRunOpen(run: { status: number; uploadStatus: string }): void {
  if (run.uploadStatus === 'score-uploaded') {
    throw new IlabServiceError('实验成绩已回传，请重试实验报告。', 409, true);
  }
  if (run.status === 1) {
    throw new IlabServiceError('实验已完成，不能再修改步骤。', 409);
  }
}

export async function withIlabRunLock<T>(
  originId: string,
  action: (run: IlabExperimentRun, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "IlabExperimentRun" WHERE "originId" = ${originId} FOR UPDATE
    `;
    if (locked.length === 0) throw new IlabServiceError('实验记录不存在。', 404);
    const run = await tx.ilabExperimentRun.findUnique({ where: { originId } });
    if (!run) throw new IlabServiceError('实验记录不存在。', 404);
    return action(run, tx);
  });
}

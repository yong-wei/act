import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { ClassroomSessionError } from '../errors';
import {
  ACCEPTED_EVIDENCE_STATUS,
  POST_SESSION_REVIEW_EVIDENCE_STATUS,
  PRE_CLOSURE_SESSION_STATUSES,
  type ClassroomSubmissionEvidenceReceipt,
  type ClassroomSubmissionEvidenceRuntime,
  type ClassifiedSubmissionWriteInput,
} from '../submission-evidence';

/**
 * 提交接受与闭课结束共享的会话级事务锁：两条路径在此串行化，
 * 使 submit-vs-end 的先后在数据库事务边界上可判定。
 */
export function classroomSubmissionSessionLock(sessionId: string) {
  return Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-session-submission:${sessionId}`}))`;
}

type ReceiptSelection = {
  id: string;
  sourceLogId: string | null;
  submissionIdentity: string | null;
  identityVersion: string | null;
  submissionSequence: bigint | null;
  evidenceStatus: string;
  sessionStatus: string;
};

function receiptFromRow(
  row: ReceiptSelection,
  status: ClassroomSubmissionEvidenceReceipt['status'],
): ClassroomSubmissionEvidenceReceipt {
  return {
    status,
    evidenceStatus: row.evidenceStatus,
    evidenceId: row.id,
    sourceLogId: row.sourceLogId ?? '',
    submissionIdentity: row.submissionIdentity ?? '',
    identityVersion: row.identityVersion ?? '',
    submissionSequence: row.submissionSequence,
    sessionStatus: row.sessionStatus,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function readExistingReceipt(
  db: Pick<Prisma.TransactionClient, 'studentStepResponse'>,
  input: { sessionId: string; userId: string; submissionIdentity: string },
): Promise<ClassroomSubmissionEvidenceReceipt | null> {
  const existing = await db.studentStepResponse.findFirst({
    where: {
      sessionId: input.sessionId,
      userId: input.userId,
      submissionIdentity: input.submissionIdentity,
    },
    select: {
      id: true,
      sourceLogId: true,
      submissionIdentity: true,
      identityVersion: true,
      submissionSequence: true,
      evidenceStatus: true,
      session: { select: { status: true } },
    },
  });
  if (!existing) return null;
  return receiptFromRow(
    {
      ...existing,
      sessionStatus: existing.session.status,
    },
    'DUPLICATE',
  );
}

export function createPrismaSubmissionEvidenceRuntime(): ClassroomSubmissionEvidenceRuntime {
  return {
    acceptClassifiedSubmission: (input) => acceptClassifiedSubmissionCommand(prisma, input),
  };
}

/**
 * 分类提交的冲突安全事务：
 * 1. 取会话级 advisory lock，与 end 事务串行化；
 * 2. 同身份快路径幂等返回原回执；
 * 3. 会话未结束（ACTIVE/PAUSED）时在同一事务内分配单调序列并写入
 *    源 InteractionLog + StudentStepResponse + 序列；
 * 4. 已结束（FINISHED）时保留证据但标记 POST_SESSION_REVIEW，不分配序列、
 *    不移动水位；
 * 5. 唯一约束冲突（并发同身份）回滚后重读并返回原回执——绝不覆盖先前作答。
 */
export async function acceptClassifiedSubmissionCommand(
  prisma: Prisma.TransactionClient,
  input: ClassifiedSubmissionWriteInput,
): Promise<ClassroomSubmissionEvidenceReceipt> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(classroomSubmissionSessionLock(input.sourceEvent.sessionId));

      const session = await tx.classSession.findUnique({
        where: { id: input.sourceEvent.sessionId },
        select: { status: true, submissionSequence: true },
      });
      if (!session) {
        throw new ClassroomSessionError('not-found', 'Session not found');
      }

      const existing = await readExistingReceipt(tx, {
        sessionId: input.sourceEvent.sessionId,
        userId: input.userId,
        submissionIdentity: input.submissionIdentity,
      });
      if (existing) return existing;

      const preClosure = (PRE_CLOSURE_SESSION_STATUSES as readonly string[]).includes(session.status);
      const sourceLog = await tx.interactionLog.create({
        data: {
          userId: input.userId,
          resourceId: input.sourceEvent.resourceId,
          resourceKey: input.sourceEvent.resourceKey,
          sessionId: input.sourceEvent.sessionId,
          lessonKey: input.sourceEvent.lessonKey,
          stepId: input.sourceEvent.stepId,
          actorRole: input.sourceEvent.actorRole,
          attemptKey: input.response.attemptKey,
          eventType: input.sourceEvent.eventType,
          clientEventId: input.sourceEvent.clientEventId,
          submissionIdentity: input.submissionIdentity,
          learningContext: input.sourceEvent.learningContext,
          invalidContextReason: input.sourceEvent.invalidContextReason,
          eventData: input.sourceEvent.eventData,
          clientEventAt: input.sourceEvent.clientEventAt,
        },
        select: { id: true },
      });
      const responseData = input.response.buildResponseData(sourceLog.id);

      if (!preClosure) {
        const reviewRow = await tx.studentStepResponse.create({
          data: {
            userId: input.userId,
            sessionId: input.sourceEvent.sessionId,
            lessonKey: input.response.lessonKey,
            stepId: input.response.stepId,
            attemptKey: input.response.attemptKey,
            sourceLogId: sourceLog.id,
            clientEventId: input.response.clientEventId,
            submissionIdentity: input.submissionIdentity,
            identityVersion: input.identityVersion,
            submissionSequence: null,
            evidenceStatus: POST_SESSION_REVIEW_EVIDENCE_STATUS,
            submittedAt: input.response.submittedAt,
            responseData: {
              ...responseData,
              submissionIdentity: input.submissionIdentity,
              identityVersion: input.identityVersion,
              evidenceStatus: POST_SESSION_REVIEW_EVIDENCE_STATUS,
            },
          },
          select: {
            id: true,
            sourceLogId: true,
            submissionIdentity: true,
            identityVersion: true,
            submissionSequence: true,
            evidenceStatus: true,
            session: { select: { status: true } },
          },
        });
        return receiptFromRow(
          { ...reviewRow, sessionStatus: session.status },
          'POST_SESSION_REVIEW',
        );
      }

      const submissionSequence = session.submissionSequence + BigInt(1);
      await tx.classSession.update({
        where: { id: input.sourceEvent.sessionId },
        data: { submissionSequence },
      });
      const responseRow = await tx.studentStepResponse.create({
        data: {
          userId: input.userId,
          sessionId: input.sourceEvent.sessionId,
          lessonKey: input.response.lessonKey,
          stepId: input.response.stepId,
          attemptKey: input.response.attemptKey,
          sourceLogId: sourceLog.id,
          clientEventId: input.response.clientEventId,
          submissionIdentity: input.submissionIdentity,
          identityVersion: input.identityVersion,
          submissionSequence,
          evidenceStatus: ACCEPTED_EVIDENCE_STATUS,
          submittedAt: input.response.submittedAt,
          responseData: {
            ...responseData,
            submissionIdentity: input.submissionIdentity,
            identityVersion: input.identityVersion,
            evidenceStatus: ACCEPTED_EVIDENCE_STATUS,
            submissionSequence: submissionSequence.toString(),
          },
        },
        select: {
          id: true,
          sourceLogId: true,
          submissionIdentity: true,
          identityVersion: true,
          submissionSequence: true,
          evidenceStatus: true,
          session: { select: { status: true } },
        },
      });
      return receiptFromRow(
        { ...responseRow, sessionStatus: session.status },
        'ACCEPTED',
      );
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const receipt = await readExistingReceipt(prisma, {
        sessionId: input.sourceEvent.sessionId,
        userId: input.userId,
        submissionIdentity: input.submissionIdentity,
      });
      if (receipt) return receipt;
    }
    throw error;
  }
}

export interface SessionEndTransactionOutcome {
  outcome: 'ended' | 'already-ended';
  closureRevision: number;
  acceptedSubmissionWatermark: bigint | null;
}

/**
 * 闭课事务：与提交接受共享同一会话锁，成功时在同一事务内写入
 * status/endTime/acceptedSubmissionWatermark/closureRevision 并 stage 恰好一条
 * 绑定水位的闭包 outbox；重复 end 幂等返回既有水位，不再 stage 新闭包。
 * 提交先提交则序列 ≤ 水位；end 先提交则晚到提交拿不到接受序列（转为复盘）。
 */
export async function persistSessionEndTransactionCommand(
  prisma: Prisma.TransactionClient,
  input: { sessionId: string; endTime: Date },
): Promise<SessionEndTransactionOutcome> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw(classroomSubmissionSessionLock(input.sessionId));

    const session = await tx.classSession.findUnique({
      where: { id: input.sessionId },
      select: {
        status: true,
        submissionSequence: true,
        closureRevision: true,
        acceptedSubmissionWatermark: true,
      },
    });
    if (!session) {
      throw new ClassroomSessionError('not-found', '课堂不存在');
    }

    if (session.status === 'FINISHED') {
      return {
        outcome: 'already-ended' as const,
        closureRevision: session.closureRevision,
        acceptedSubmissionWatermark: session.acceptedSubmissionWatermark,
      };
    }

    const acceptedSubmissionWatermark = session.submissionSequence;
    const closureRevision = session.closureRevision + 1;
    await tx.classSession.update({
      where: { id: input.sessionId },
      data: {
        status: 'FINISHED',
        endTime: input.endTime,
        acceptedSubmissionWatermark,
        closureRevision,
      },
    });
    await tx.sessionClosureOutbox.create({
      data: {
        sessionId: input.sessionId,
        closureRevision,
        acceptedSubmissionWatermark,
      },
    });
    return {
      outcome: 'ended' as const,
      closureRevision,
      acceptedSubmissionWatermark,
    };
  });
}

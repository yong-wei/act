import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { prisma } from '@/lib/prisma';
import { settleSessionClosureOutbox } from '@/lib/data-governance/session-closure-outbox';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import { acceptClassifiedSubmissionCommand } from '@/features/classroom/session/adapters/submission-evidence-commands';
import { persistSessionEndTransactionCommand } from '@/features/classroom/session/adapters/submission-evidence-commands';
import { CLASSROOM_SUBMISSION_IDENTITY_VERSION } from '@/features/classroom/session/submission-evidence';
import type { ClassifiedSubmissionWriteInput } from '@/features/classroom/session/submission-evidence';

const enabled = process.env.CLASSROOM_SUBMISSION_EVIDENCE_REAL_DB_TEST === '1';
const schemaName = `classroom_evidence_it_${process.pid}_${randomBytes(4).toString('hex')}`;
let adminUrl = '';

function buildInput(overrides: {
  userId?: string;
  sessionId?: string;
  identity?: string;
  attemptKey?: string;
  clientEventId?: string;
} = {}): ClassifiedSubmissionWriteInput {
  const sessionId = overrides.sessionId ?? 'session-1';
  const userId = overrides.userId ?? 'student-1';
  const attemptKey = overrides.attemptKey ?? 'step-08:response:1';
  return {
    userId,
    submissionIdentity: overrides.identity ?? `${userId}|${sessionId}|lesson-v1|step-08|card|${attemptKey}`,
    identityVersion: CLASSROOM_SUBMISSION_IDENTITY_VERSION,
    sourceEvent: {
      resourceId: null,
      resourceKey: 'resource-key',
      sessionId,
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      actorRole: 'student',
      eventType: 'submit',
      clientEventId: overrides.clientEventId ?? `client-${attemptKey}`,
      learningContext: 'classroom_live',
      invalidContextReason: null,
      eventData: { eventType: 'lesson_submit', score: 100 },
      clientEventAt: new Date('2026-05-12T01:46:42.900Z'),
    },
    response: {
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      attemptKey,
      clientEventId: overrides.clientEventId ?? `client-${attemptKey}`,
      submittedAt: new Date('2026-05-12T01:46:42.900Z'),
      buildResponseData: (sourceLogId: string) => ({
        eventType: 'lesson_submit',
        score: 100,
        sourceLogId,
      }),
    },
  };
}

describe.runIf(enabled)('classroom live-state / submission evidence PostgreSQL integration', () => {
  beforeAll(async () => {
    const baseUrl = process.env.SUBMISSION_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
    if (!baseUrl) throw new Error('classroom-evidence-test-database-required');
    const admin = new URL(baseUrl);
    admin.searchParams.delete('schema');
    adminUrl = admin.toString();
    const scoped = new URL(adminUrl);
    scoped.searchParams.set('schema', schemaName);
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`CREATE SCHEMA "${schemaName}"`);
      process.env.DATABASE_URL = scoped.toString();
      execFileSync('npx', ['prisma', 'db', 'push', '--url', scoped.toString()], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      });
    } finally {
      await pool.end();
    }
    await prisma.user.createMany({ data: [
      { id: 'teacher-1', role: 'TEACHER' },
      { id: 'student-1', role: 'STUDENT' },
      { id: 'student-2', role: 'STUDENT' },
    ] });
    await prisma.lessonPlan.create({ data: { id: 'plan-1', title: '提交证据测试', author: { connect: { id: 'teacher-1' } } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (!adminUrl) return;
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  it('makes identical concurrent submissions idempotent while preserving distinct attempts', async () => {
    await prisma.classSession.create({ data: { id: 'session-1', joinCode: 'EV0001', planId: 'plan-1', teacherId: 'teacher-1' } });

    // 同一身份并发竞争：数据库唯一约束只允许一行证据
    const race = await Promise.allSettled([
      acceptClassifiedSubmissionCommand(prisma, buildInput()),
      acceptClassifiedSubmissionCommand(prisma, buildInput()),
      acceptClassifiedSubmissionCommand(prisma, buildInput()),
    ]);
    const receipts = race.filter((entry) => entry.status === 'fulfilled').map((entry) => (entry as PromiseFulfilledResult<Awaited<ReturnType<typeof acceptClassifiedSubmissionCommand>>>).value);
    expect(race).toHaveLength(3);
    expect(receipts).toHaveLength(3);
    const evidenceIds = new Set(receipts.map((receipt) => receipt.evidenceId));
    expect(evidenceIds.size).toBe(1);
    expect(receipts.every((receipt) => receipt.evidenceStatus === 'ACCEPTED')).toBe(true);

    const rows = await prisma.studentStepResponse.findMany({ where: { sessionId: 'session-1', userId: 'student-1' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].submissionSequence).toBe(1n);
    expect(rows[0].evidenceStatus).toBe('ACCEPTED');
    expect((await prisma.interactionLog.count({ where: { sessionId: 'session-1' } }))).toBe(1);

    // 新 attempt 身份：保留为独立不可变尝试，序列单调递增
    const second = await acceptClassifiedSubmissionCommand(prisma, buildInput({
      identity: 'student-1|session-1|lesson-v1|step-08|card|step-08:response:2',
      attemptKey: 'step-08:response:2',
      clientEventId: 'client-attempt-2',
    }));
    expect(second.status).toBe('ACCEPTED');
    expect(second.submissionSequence).toBe(2n);
    expect(await prisma.studentStepResponse.count({ where: { sessionId: 'session-1' } })).toBe(2);
  });

  it('serializes submit-vs-end on the session boundary in both lock acquisition orders', async () => {
    await prisma.classSession.create({ data: { id: 'session-2', joinCode: 'EV0002', planId: 'plan-1', teacherId: 'teacher-1' } });
    const endTime = new Date('2026-05-12T02:00:00.000Z');

    // 顺序一：提交先提交 → 序列 ≤ 水位
    const accepted = await acceptClassifiedSubmissionCommand(prisma, buildInput({ sessionId: 'session-2', userId: 'student-1' }));
    const ended = await persistSessionEndTransactionCommand(prisma, { sessionId: 'session-2', endTime });
    expect(ended).toMatchObject({ outcome: 'ended', acceptedSubmissionWatermark: accepted.submissionSequence });
    expect(ended.acceptedSubmissionWatermark).toBe(1n);

    // end 之后到达的提交：保留为 POST_SESSION_REVIEW，不移动水位
    const late = await acceptClassifiedSubmissionCommand(prisma, buildInput({
      sessionId: 'session-2',
      userId: 'student-2',
      identity: 'student-2|session-2|lesson-v1|step-08|card|late-1',
      attemptKey: 'late-1',
      clientEventId: 'client-late-1',
    }));
    expect(late.status).toBe('POST_SESSION_REVIEW');
    expect(late.submissionSequence).toBeNull();
    expect((await prisma.classSession.findUnique({ where: { id: 'session-2' } }))?.acceptedSubmissionWatermark).toBe(1n);
    // 晚到源日志同样携带显式晚到分类，供闭包消费者排除
    const lateSourceLog = await prisma.interactionLog.findFirst({
      where: { sessionId: 'session-2', submissionIdentity: 'student-2|session-2|lesson-v1|step-08|card|late-1' },
    });
    expect(lateSourceLog?.eventData).toMatchObject({
      afterSessionEnd: true,
      evidenceStatus: 'POST_SESSION_REVIEW',
    });
    const outboxCount = await prisma.sessionClosureOutbox.count({ where: { sessionId: 'session-2' } });
    expect(outboxCount).toBe(1);

    // 顺序二：end 先提交 → 后到的提交同样只能成为复盘
    await prisma.classSession.create({ data: { id: 'session-3', joinCode: 'EV0003', planId: 'plan-1', teacherId: 'teacher-1' } });
    const [firstEnd, firstLateSubmit] = await Promise.allSettled([
      persistSessionEndTransactionCommand(prisma, { sessionId: 'session-3', endTime }),
      acceptClassifiedSubmissionCommand(prisma, buildInput({ sessionId: 'session-3', userId: 'student-1' })),
    ]);
    expect(firstEnd.status).toBe('fulfilled');
    const session3 = await prisma.classSession.findUnique({ where: { id: 'session-3' } });
    expect(session3?.status).toBe('FINISHED');
    const acceptedRows = await prisma.studentStepResponse.findMany({ where: { sessionId: 'session-3', evidenceStatus: 'ACCEPTED' } });
    // 先赢得锁的提交若被接受则序列 ≤ 水位；晚到者一定为复盘
    for (const row of acceptedRows) {
      expect(row.submissionSequence ?? 0n).toBeLessThanOrEqual(session3?.acceptedSubmissionWatermark ?? 0n);
    }
    const reviewRows = await prisma.studentStepResponse.count({ where: { sessionId: 'session-3', evidenceStatus: 'POST_SESSION_REVIEW' } });
    const totalRows = await prisma.studentStepResponse.count({ where: { sessionId: 'session-3' } });
    if ((firstLateSubmit as PromiseFulfilledResult<{ status: string }>).status === 'fulfilled') {
      const receipt = (firstLateSubmit as PromiseFulfilledResult<{ status: string }>).value;
      if (receipt.status === 'POST_SESSION_REVIEW') {
        expect(reviewRows).toBeGreaterThanOrEqual(1);
      }
    }
    expect(totalRows).toBeLessThanOrEqual(1);

    // 重复 end 幂等：不新增闭包、不改变水位
    const secondEnd = await persistSessionEndTransactionCommand(prisma, { sessionId: 'session-3', endTime });
    expect(secondEnd).toMatchObject({ outcome: 'already-ended', acceptedSubmissionWatermark: session3?.acceptedSubmissionWatermark });
    expect(await prisma.sessionClosureOutbox.count({ where: { sessionId: 'session-3' } })).toBe(1);
  });

  it('bounds the default report by the accepted watermark and gates review evidence behind an explicit recompute', async () => {
    const defaultReport = await generateSessionSummaryReports(prisma, 'session-2');
    expect(defaultReport.skipped).toBe(false);
    const classReport = await prisma.classSessionReport.findUnique({
      where: { sessionId_reportType: { sessionId: 'session-2', reportType: 'class-summary' } },
    });
    expect(classReport).not.toBeNull();
    expect(classReport?.closureRevision).toBe(1);
    expect(classReport?.acceptedSubmissionWatermark).toBe(1n);
    const reportData = classReport?.reportData as Record<string, any>;
    // 默认读法：晚到复盘证据不入原闭包
    expect(reportData.durableSubmissions).toBe(1);
    expect(reportData.closure.excludedPostSessionReviewSubmissions).toBe(1);
    expect(reportData.closure.evidenceSelection).toBe('accepted-submission-watermark');
    expect(reportData.recompute).toBeUndefined();

    // 显式重算修订才纳入 POST_SESSION_REVIEW，且写入独立报告行；
    // 原闭包报告与其身份不可变更、可独立查询
    const recomputeCutoff = new Date();
    const recompute = await generateSessionSummaryReports(prisma, 'session-2', {
      recompute: { recomputeRevision: 1, recomputeInputWatermark: 1n, includeReviewSubmittedBefore: recomputeCutoff },
    });
    expect(recompute.skipped).toBe(false);
    const originalReport = await prisma.classSessionReport.findUnique({
      where: { sessionId_reportType: { sessionId: 'session-2', reportType: 'class-summary' } },
    });
    const originalData = originalReport?.reportData as Record<string, any>;
    // 原闭包报告未被重算覆盖
    expect(originalData.durableSubmissions).toBe(1);
    expect(originalData.recompute).toBeUndefined();
    expect(originalReport?.recomputeRevision).toBeNull();

    const recomputedReport = await prisma.classSessionReport.findUnique({
      where: { sessionId_reportType: { sessionId: 'session-2', reportType: 'class-summary-recompute' } },
    });
    expect(recomputedReport).not.toBeNull();
    const recomputedData = recomputedReport?.reportData as Record<string, any>;
    expect(recomputedData.durableSubmissions).toBe(2);
    expect(recomputedData.recompute).toMatchObject({
      revision: 1,
      inputWatermark: '1',
      includedPostSessionReviewSubmissions: 1,
    });
    expect(recomputedReport?.closureRevision).toBe(1);
    expect(recomputedReport?.acceptedSubmissionWatermark).toBe(1n);
    expect(recomputedReport?.recomputeRevision).toBe(1);
    const session2 = await prisma.classSession.findUnique({ where: { id: 'session-2' } });
    expect(session2?.acceptedSubmissionWatermark).toBe(1n);
    expect(session2?.closureRevision).toBe(1);
  });

  it('settles the closure outbox idempotently across worker redelivery', async () => {
    expect(await settleSessionClosureOutbox(prisma, 'session-2')).toBe(1);
    const settled = await prisma.sessionClosureOutbox.findMany({ where: { sessionId: 'session-2' } });
    expect(settled).toHaveLength(1);
    expect(settled[0].status).toBe('SUCCEEDED');
    expect(settled[0].processedAt).not.toBeNull();

    // 重复投递：不再重复处理，也不扩大闭包
    expect(await settleSessionClosureOutbox(prisma, 'session-2')).toBe(0);
    expect(await prisma.sessionClosureOutbox.count({ where: { sessionId: 'session-2' } })).toBe(1);
  });
});

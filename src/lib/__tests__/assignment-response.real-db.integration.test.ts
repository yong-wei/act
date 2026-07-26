import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import {
  removeQuestionAsset,
  reorderQuestionAssets,
  saveQuestionDraft,
  signQuestionUpload,
  submitQuestionAnswer,
} from '@/lib/assignments/submission-service';
import { prisma } from '@/lib/prisma';

const enabled = process.env.ASSIGNMENT_RESPONSE_REAL_DB_TEST === '1';
const schemaName = `assignment_response_it_${process.pid}_${randomBytes(4).toString('hex')}`;
let adminUrl = '';
let scopedUrl = '';
let assignmentId = '';
let questionId = '';
let attachmentOnlyQuestionId = '';

describe.runIf(enabled)('unified assignment response PostgreSQL integration', () => {
  beforeAll(async () => {
    const baseUrl = process.env.SUBMISSION_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
    if (!baseUrl) throw new Error('submission-test-database-required');
    const admin = new URL(baseUrl);
    admin.searchParams.delete('schema');
    adminUrl = admin.toString();
    const scoped = new URL(adminUrl);
    scoped.searchParams.set('schema', schemaName);
    scopedUrl = scoped.toString();
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`CREATE SCHEMA "${schemaName}"`);
      process.env.DATABASE_URL = scopedUrl;
      execFileSync('npx', ['prisma', 'db', 'push', '--url', scopedUrl], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      });
    } finally {
      await pool.end();
    }
    await prisma.gradingLifecyclePolicy.createMany({ data: [
      { id: 'response-source-policy', dataClass: 'source-asset', version: 'test.v1', retentionSeconds: 2_592_000, deleteStrategy: 'delete-content', providerRetentionSeconds: 0 },
      { id: 'response-answer-policy', dataClass: 'answer-evidence', version: 'test.v1', retentionSeconds: 2_592_000, deleteStrategy: 'delete-content', providerRetentionSeconds: 0 },
    ] });
    await prisma.user.createMany({ data: [
      { id: 'response-teacher', role: 'TEACHER' },
      { id: 'response-student', role: 'STUDENT' },
    ] });
    await prisma.class.create({ data: {
      id: 'response-class',
      name: '统一作答测试班',
      code: 'RESPONSE-IT',
      teacherId: 'response-teacher',
    } });
    await prisma.studentProfile.create({ data: {
      userId: 'response-student',
      classId: 'response-class',
    } });
    const assignment = await prisma.assignment.create({
      data: {
        authorId: 'response-teacher',
        state: 'PUBLISHED',
        revisions: {
          create: {
            revisionNumber: 1,
            state: 'PUBLISHED',
            title: '统一作答合同',
            instructions: '提交正文与附件',
            totalPoints: 20,
            latePolicy: { version: 1, mode: 'CLOSED' },
            responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_FILE'] },
            resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
            solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
            publishedAt: new Date(),
            frozenAt: new Date(),
            questions: { create: [
              {
                stableQuestionId: 'legacy-file-question',
                orderIndex: 0,
                responseType: 'SUBJECTIVE_FILE',
                points: 10,
                promptSnapshot: { text: '证明统一合同兼容旧文件题' },
                answerSnapshot: { text: 'audit-only' },
                rubricSnapshot: { schemaVersion: 'test' },
                sourceFamily: 'MANUAL',
                sourceHash: `sha256:${'1'.repeat(64)}`,
                sourceReviewState: 'authored',
                sourceLineage: {},
                contentHash: `sha256:${'2'.repeat(64)}`,
              },
              {
                stableQuestionId: 'legacy-text-question',
                orderIndex: 1,
                responseType: 'SUBJECTIVE_TEXT',
                points: 10,
                promptSnapshot: { text: '证明统一合同兼容旧文本题' },
                answerSnapshot: { text: 'audit-only' },
                rubricSnapshot: { schemaVersion: 'test' },
                sourceFamily: 'MANUAL',
                sourceHash: `sha256:${'3'.repeat(64)}`,
                sourceReviewState: 'authored',
                sourceLineage: {},
                contentHash: `sha256:${'4'.repeat(64)}`,
              },
            ] },
            audiences: { create: {
              classId: 'response-class',
              availableAt: new Date(Date.now() - 60_000),
              dueAt: new Date(Date.now() + 3_600_000),
            } },
          },
        },
      },
      include: { revisions: { include: { questions: true } } },
    });
    assignmentId = assignment.id;
    questionId = assignment.revisions[0].questions
      .find((question) => question.stableQuestionId === 'legacy-file-question')!.id;
    attachmentOnlyQuestionId = assignment.revisions[0].questions
      .find((question) => question.stableQuestionId === 'legacy-text-question')!.id;
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

  it('seals mixed evidence, fences concurrent edits, and enforces the shared ten-asset limit', async () => {
    let saved = await saveQuestionDraft(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId,
      version: 1,
      text: '旧 FILE 题中的 Markdown 正文',
    });
    const saveRace = await Promise.allSettled([
      saveQuestionDraft(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        version: saved.version,
        text: '并发正文 A',
      }),
      saveQuestionDraft(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        version: saved.version,
        text: '并发正文 B',
      }),
    ]);
    expect(saveRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(saveRace.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: 'answer-version-conflict' }) }),
    ]);
    saved = await prisma.submissionAnswer.findUniqueOrThrow({ where: { id: saved.id } });
    const assetIds: string[] = [];
    for (let index = 0; index < 9; index += 1) {
      const asset = await prisma.submissionAsset.create({ data: {
        answerId: saved.id,
        version: index + 1,
        objectKey: `response-object-${index}`,
        originalName: `evidence-${index}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 12,
        checksum: `sha256:${String(index).padStart(64, '0')}`,
        state: 'FINALIZED',
        scanState: 'CLEAN',
        assetRole: 'ATTACHMENT',
        orderIndex: index,
      } });
      assetIds.push(asset.id);
    }
    const embeddedAsset = await prisma.submissionAsset.create({ data: {
      answerId: saved.id,
      version: 10,
      objectKey: 'response-embedded-figure',
      originalName: 'figure.png',
      mimeType: 'image/png',
      sizeBytes: 12,
      checksum: `sha256:${'e'.repeat(64)}`,
      state: 'FINALIZED',
      scanState: 'CLEAN',
      assetRole: 'EMBEDDED_IMAGE',
      orderIndex: 9,
      embeddedPosition: 'md:figure-1',
    } });
    await expect(signQuestionUpload(prisma, new MemorySubmissionObjectStore(), {
      studentId: 'response-student',
      assignmentId,
      questionId,
      fileName: 'overflow.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      checksum: `sha256:${'a'.repeat(64)}`,
    })).rejects.toMatchObject({ code: 'answer-asset-limit-exceeded' });

    const reversed = [...assetIds].reverse();
    const concurrent = await Promise.allSettled([
      reorderQuestionAssets(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        answerVersion: saved.version,
        assetIds: reversed,
      }),
      saveQuestionDraft(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        version: saved.version,
        text: '并发后的 Markdown 正文\n![图](asset:md:figure-1)',
        embeddedAssets: [{ assetId: embeddedAsset.id, positionRef: 'md:figure-1' }],
      }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: 'answer-version-conflict' }) }),
    ]);
    let answer = await prisma.submissionAnswer.findUniqueOrThrow({ where: { id: saved.id } });
    if (concurrent[0].status === 'rejected') {
      answer = await reorderQuestionAssets(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        answerVersion: answer.version,
        assetIds: reversed,
      });
    } else {
      answer = await saveQuestionDraft(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        version: answer.version,
        text: '并发后的 Markdown 正文\n![图](asset:md:figure-1)',
        embeddedAssets: [{ assetId: embeddedAsset.id, positionRef: 'md:figure-1' }],
      });
    }
    await expect(saveQuestionDraft(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId,
      version: answer.version,
      text: '正文\n![图](asset:md:figure-1)\n![失效](asset:md:missing)',
      embeddedAssets: [{ assetId: embeddedAsset.id, positionRef: 'md:figure-1' }],
    })).rejects.toMatchObject({ code: 'invalid-embedded-asset-reference' });

    const [left, right] = await Promise.all([
      submitQuestionAnswer(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        answerVersion: answer.version,
        idempotencyKey: 'response-submit-idempotency',
      }),
      submitQuestionAnswer(prisma, {
        studentId: 'response-student',
        assignmentId,
        questionId,
        answerVersion: answer.version,
        idempotencyKey: 'response-submit-idempotency',
      }),
    ]);
    expect(left.attempt?.id).toBe(right.attempt?.id);
    const attempt = await prisma.submissionAttempt.findUniqueOrThrow({
      where: { id: left.attempt!.id },
      include: { assets: { orderBy: { orderIndex: 'asc' } } },
    });
    expect(attempt.textSnapshot).toBe('并发后的 Markdown 正文\n![图](asset:md:figure-1)');
    expect(attempt.assets.map((asset) => asset.id)).toEqual([...reversed, embeddedAsset.id]);
    expect(attempt.answerSnapshot).toMatchObject({
      schemaVersion: 'assignment-response.v2',
      attachmentOrderProvenance: 'student-arranged',
      textSnapshotHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(attempt.answerSnapshot)).not.toContain('并发后的 Markdown 正文');
    expect(JSON.stringify(attempt.answerSnapshot)).not.toContain('evidence-');

    const attachmentOnly = await saveQuestionDraft(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId: attachmentOnlyQuestionId,
      version: 1,
      text: '',
    });
    await expect(submitQuestionAnswer(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId: attachmentOnlyQuestionId,
      answerVersion: attachmentOnly.version,
      idempotencyKey: 'response-empty-rejected',
    })).rejects.toMatchObject({ code: 'answer-evidence-required' });
    const removableAsset = await prisma.submissionAsset.create({ data: {
      answerId: attachmentOnly.id,
      version: 1,
      objectKey: 'response-attachment-only',
      originalName: 'attachment-only.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      checksum: `sha256:${'b'.repeat(64)}`,
      state: 'FINALIZED',
      scanState: 'CLEAN',
      assetRole: 'ATTACHMENT',
      orderIndex: 0,
    } });
    const afterRemoval = await removeQuestionAsset(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId: attachmentOnlyQuestionId,
      assetId: removableAsset.id,
      answerVersion: attachmentOnly.version,
    });
    expect(afterRemoval.answer).toMatchObject({ state: 'DRAFT', version: attachmentOnly.version + 1 });
    await expect(submitQuestionAnswer(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId: attachmentOnlyQuestionId,
      answerVersion: afterRemoval.answer.version,
      idempotencyKey: 'response-removed-asset-rejected',
    })).rejects.toMatchObject({ code: 'answer-evidence-required' });
    await prisma.submissionAsset.create({ data: {
      answerId: attachmentOnly.id,
      version: 2,
      objectKey: 'response-attachment-only-replacement',
      originalName: 'attachment-only-replacement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      checksum: `sha256:${'c'.repeat(64)}`,
      state: 'FINALIZED',
      scanState: 'CLEAN',
      assetRole: 'ATTACHMENT',
      orderIndex: 0,
    } });
    const attachmentOnlyAttempt = await submitQuestionAnswer(prisma, {
      studentId: 'response-student',
      assignmentId,
      questionId: attachmentOnlyQuestionId,
      answerVersion: afterRemoval.answer.version,
      idempotencyKey: 'response-attachment-only-submit',
    });
    expect(attachmentOnlyAttempt.aggregate.state).toBe('SUBMITTED');

    await prisma.submissionAnswer.update({
      where: { id: saved.id },
      data: { attachmentOrderProvenance: null },
    });
    await prisma.submissionAsset.updateMany({
      where: { answerId: saved.id },
      data: { orderIndex: null },
    });
    const frozenSnapshot = attempt.answerSnapshot;
    const runBackfill = (mode?: '--apply') => JSON.parse(execFileSync(
      'npx',
      ['tsx', 'scripts/db/backfill-assignment-attachment-order.ts', ...(mode ? [mode] : [])],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: scopedUrl }, encoding: 'utf8' },
    ).trim()) as { mode: string; legacyFallbackOrder: number };
    expect(runBackfill()).toMatchObject({ mode: 'dry-run', legacyFallbackOrder: 1 });
    expect(await prisma.submissionAnswer.findUniqueOrThrow({ where: { id: saved.id } }))
      .toMatchObject({ attachmentOrderProvenance: null });
    expect(runBackfill('--apply')).toMatchObject({ mode: 'apply', legacyFallbackOrder: 1 });
    const firstApplied = await prisma.submissionAsset.findMany({
      where: { answerId: saved.id },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true },
    });
    expect(firstApplied.map((asset) => asset.orderIndex)).toEqual(
      Array.from({ length: 10 }, (_, index) => index),
    );
    expect(runBackfill('--apply')).toMatchObject({ mode: 'apply', legacyFallbackOrder: 1 });
    expect(await prisma.submissionAsset.findMany({
      where: { answerId: saved.id },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true },
    })).toEqual(firstApplied);
    expect((await prisma.submissionAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).answerSnapshot)
      .toEqual(frozenSnapshot);
  });
});

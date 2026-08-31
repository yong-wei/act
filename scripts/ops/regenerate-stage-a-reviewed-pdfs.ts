import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  drainTeacherAssignmentReviewOutbox,
  type TeacherAssignmentReviewOutboxHandlers,
} from '../../src/lib/data-governance/teacher-assignment-review-outbox';
import {
  createDefaultReviewedDerivativeRenderer,
} from '../../src/lib/data-governance/teacher-assignment-review-derivative-storage';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const generatorVersion = process.env.STAGE_A_PDF_GENERATOR_VERSION?.trim() || '9-chinese-font-sidebar-fallback';
  const targetQuestionId = process.env.STAGE_A_PDF_QUESTION_ID?.trim() || null;
  const publish = process.env.STAGE_A_PDF_PUBLISH === 'true';
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const targetQuestion = targetQuestionId
    ? await prisma.assignmentQuestion.findFirstOrThrow({ where: { assignmentRevisionId: revision.id, stableQuestionId: targetQuestionId }, select: { id: true } })
    : null;
  const approvalRows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id, ...(targetQuestion ? { questionId: targetQuestion.id } : {}) },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      submissionId: true,
      questionId: true,
      reviewedDerivatives: {
        where: { state: 'READY', outputKind: 'REVIEWED_PDF' },
        orderBy: { readyAt: 'desc' },
        take: 1,
        select: { generatorId: true, anchorMapVersion: true, generatorVersion: true },
      },
    },
  });
  const approvals = approvalRows.filter((approval, index, rows) => rows.findIndex((candidate) => candidate.submissionId === approval.submissionId && candidate.questionId === approval.questionId) === index);
  const expectedCount = targetQuestion ? 3 : 12;
  if (approvals.length !== expectedCount || approvals.some((approval) => approval.reviewedDerivatives.length !== 1)) {
    throw new Error(`stage-a-pdf-scope-invalid:${approvals.length}`);
  }
  const baseline = approvals[0].reviewedDerivatives[0];
  if (approvals.some((approval) => {
    const derivative = approval.reviewedDerivatives[0];
    return derivative.generatorId !== baseline.generatorId || derivative.anchorMapVersion !== baseline.anchorMapVersion;
  })) throw new Error('stage-a-pdf-generator-lineage-mismatch');
  let drained = { claimed: 0, succeeded: 0, retryable: 0, blocked: 0, failed: 0 };
  if (baseline.generatorVersion !== generatorVersion) {
    const now = new Date();
    const commands = await prisma.teacherAssignmentReviewOutbox.findMany({
      where: { snapshotId: { in: approvals.map((approval) => approval.id) }, command: 'GENERATE_DERIVATIVE' },
      select: { id: true, snapshotId: true, state: true },
    });
    if (commands.length !== approvals.length || commands.some((command) => command.state === 'PROCESSING')) {
      throw new Error(`stage-a-pdf-command-scope-invalid:${commands.length}`);
    }
    await prisma.teacherAssignmentReviewOutbox.updateMany({
      where: { id: { in: commands.map((command) => command.id) } },
      data: {
        state: 'PENDING',
        attemptCount: 0,
        availableAt: now,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        limitationCode: null,
        processedAt: null,
        updatedAt: now,
      },
    });

    const handlers: TeacherAssignmentReviewOutboxHandlers = {
      derivativeRenderer: createDefaultReviewedDerivativeRenderer(),
      derivativeOptions: {
        generatorId: baseline.generatorId,
        generatorVersion,
        anchorMapVersion: baseline.anchorMapVersion,
        nativeFormats: ['DOCX', 'PDF'],
      },
    };
    drained = await drainTeacherAssignmentReviewOutbox({ db: prisma, handlers, limit: approvals.length });
    if (drained.succeeded !== approvals.length || drained.blocked !== 0 || drained.failed !== 0 || drained.retryable !== 0) {
      throw new Error(`stage-a-pdf-regeneration-failed:${JSON.stringify(drained)}`);
    }
  }

  const latest = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { id: { in: approvals.map((approval) => approval.id) } },
    select: {
      id: true,
      reviewedDerivatives: {
        where: { state: 'READY', outputKind: 'REVIEWED_PDF' },
        orderBy: { readyAt: 'desc' },
        take: 1,
        select: { id: true, generatorVersion: true, outputObjectKey: true, outputChecksum: true, outputSizeBytes: true },
      },
    },
  });
  if (latest.length !== approvals.length || latest.some((approval) => approval.reviewedDerivatives.length !== 1 || approval.reviewedDerivatives[0].generatorVersion !== generatorVersion || approval.reviewedDerivatives[0].outputObjectKey == null || approval.reviewedDerivatives[0].outputChecksum == null)) {
    const diagnostics = await prisma.teacherAssignmentReviewedDerivative.findMany({
      where: { snapshotId: { in: approvals.map((approval) => approval.id) } },
      orderBy: { createdAt: 'desc' },
      select: { snapshotId: true, state: true, generatorId: true, generatorVersion: true, anchorMapVersion: true, outputKind: true, limitations: true, outputObjectKey: true, outputChecksum: true, lastErrorCode: true },
    });
    console.log(JSON.stringify({ generatorVersion, latestCount: latest.length, diagnostics }));
    throw new Error('stage-a-pdf-regeneration-output-missing');
  }
  if (latest.some((approval) => approval.reviewedDerivatives[0].id == null)) throw new Error('stage-a-pdf-regeneration-output-id-missing');
  if (publish) {
    for (const approval of latest) {
      const derivative = approval.reviewedDerivatives[0];
      await prisma.teacherAssignmentFeedbackRelease.update({
        where: { snapshotId: approval.id },
        data: { derivativeId: derivative.id },
      });
    }
  }
  console.log(JSON.stringify({ revisionId: revision.id, generatorVersion, regenerated: latest.length, published: publish, drained }));
}

void main().finally(() => prisma.$disconnect());

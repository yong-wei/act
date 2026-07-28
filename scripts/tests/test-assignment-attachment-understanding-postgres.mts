import assert from 'node:assert/strict';

import { prisma } from '../../src/lib/prisma';
import {
  assembleAssignmentAnswerEvidence,
} from '../../src/lib/data-governance/assignment-attachment-understanding';
import {
  materializeAssignmentAnswerEvidence,
} from '../../src/lib/data-governance/math-document-grading-persistence';

process.env.ASSIGNMENT_ATTACHMENT_MIGRATION_IMPORT = '1';

const prefix = `assignment-understanding-pg:${Date.now()}`;
const ids = {
  teacher: `${prefix}:teacher`,
  student: `${prefix}:student`,
  class: `${prefix}:class`,
  assignment: `${prefix}:assignment`,
  revision: `${prefix}:revision`,
  audience: `${prefix}:audience`,
  question: `${prefix}:question`,
  submission: `${prefix}:submission`,
  answer: `${prefix}:answer`,
  attempt: `${prefix}:attempt`,
  asset: `${prefix}:asset`,
  conversion: `${prefix}:conversion`,
  evidence: `${prefix}:evidence`,
  batch: `${prefix}:batch`,
  approvedRun: `${prefix}:run-approved`,
  activeRun: `${prefix}:run-active`,
  approvedItem: `${prefix}:item-approved`,
  activeItem: `${prefix}:item-active`,
  conversionJob: `${prefix}:job-conversion`,
  runJob: `${prefix}:job-run`,
  itemJob: `${prefix}:job-item`,
  batchJob: `${prefix}:job-batch`,
};

async function main() {
  await createAssignmentAttempt();
  try {
    await verifyConcurrentMaterialization();
    await verifyMultiAttachmentAggregate();
    await replaceAggregateWithLegacyFixture();
    await verifyLegacyMigration();
    process.stdout.write(
      `${JSON.stringify({
        result: 'passed',
        concurrentEvidenceCount: 1,
        multiAttachmentAggregate: true,
        aggregateAssetAssociation: true,
        approvedHistoryPreserved: true,
        activeRerunBlocked: true,
        parentBatchSettled: true,
      })}\n`,
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

async function verifyMultiAttachmentAggregate() {
  const existing = await prisma.answerEvidence.findFirstOrThrow({
    where: { attemptId: ids.attempt },
  });
  await prisma.answerEvidenceBlock.deleteMany({
    where: { evidenceId: existing.id },
  });
  await prisma.answerEvidence.delete({ where: { id: existing.id } });

  const assets = [0, 1].map((index) => ({
    id: `${prefix}:multi-asset-${index}`,
    answerId: ids.answer,
    attemptId: ids.attempt,
    version: index + 1,
    orderIndex: index,
    objectKey: `${prefix}:multi-object-${index}`,
    originalName: `answer-${index}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
    checksum: `${prefix}:multi-checksum-${index}`,
    state: 'FINALIZED' as const,
    scanState: 'CLEAN' as const,
  }));
  await prisma.submissionAsset.createMany({ data: assets });
  await prisma.documentConversion.createMany({
    data: assets.map((asset, index) => ({
      id: `${prefix}:multi-conversion-${index}`,
      assetId: asset.id,
      attemptId: ids.attempt,
      version: 1,
      dedupeKey: `${prefix}:multi-conversion-dedupe-${index}`,
      adapter: 'mathpix',
      adapterVersion: 'assignment-understanding.v1',
      state: 'SUCCEEDED' as const,
      sourceChecksum: asset.checksum,
      canonicalMarkdown: `attachment ${index}`,
      normalizedBlocks: [{
        id: `mathpix-${index}`,
        blockIndex: 0,
        pageNumber: index + 1,
        text: `attachment ${index}`,
        markdown: `attachment ${index}`,
        precision: 'page',
        confidence: 0.9,
      }],
      precision: 'PAGE' as const,
      confidence: 0.9,
    })),
  });
  const conversions = await prisma.documentConversion.findMany({
    where: { id: { startsWith: `${prefix}:multi-conversion-` } },
    orderBy: { id: 'asc' },
  });
  const assembled = assembleAssignmentAnswerEvidence({
    attemptId: ids.attempt,
    answerVersion: 1,
    textSnapshot: 'fixture answer',
    attachments: conversions.map((conversion, index) => ({
      assetId: conversion.assetId!,
      displayName: assets[index].originalName,
      mimeType: assets[index].mimeType,
      checksum: conversion.sourceChecksum,
      role: 'ATTACHMENT',
      orderIndex: index,
      route: 'binary-mathpix',
      state: 'READY',
      canonicalMarkdown: conversion.canonicalMarkdown,
      blocks: conversion.normalizedBlocks as any[],
    })),
  });
  const aggregate = await materializeAssignmentAnswerEvidence({
    db: prisma,
    attemptId: ids.attempt,
    answerVersion: 1,
    normalized: assembled.evidence,
    sourceManifest: assembled.manifest,
    actor: { id: 'grading-worker', role: 'SERVICE' },
  });
  assert.equal(await prisma.answerEvidence.count({
    where: { attemptId: ids.attempt, conversionId: { not: null } },
  }), 0);
  assert.deepEqual(
    aggregate.evidence.blocks
      .filter((block: any) => block.pageNumber !== null)
      .map((block: any) => block.pageNumber),
    [1, 2],
  );
  const aggregateBySourceAsset = await prisma.answerEvidence.findMany({
    where: {
      sourceManifest: {
        path: ['sources'],
        array_contains: [{ assetId: assets[0].id }],
      },
    },
    select: { id: true },
  });
  assert.deepEqual(aggregateBySourceAsset.map((row) => row.id), [aggregate.evidence.id]);
}

async function createAssignmentAttempt() {
  await prisma.user.createMany({
    data: [
      { id: ids.teacher, role: 'TEACHER', name: 'Migration teacher' },
      { id: ids.student, role: 'STUDENT', name: 'Migration student' },
    ],
  });
  await prisma.class.create({
    data: {
      id: ids.class,
      name: 'Migration class',
      code: `M${Date.now().toString().slice(-5)}`,
      teacherId: ids.teacher,
    },
  });
  await prisma.assignment.create({
    data: {
      id: ids.assignment,
      authorId: ids.teacher,
      state: 'PUBLISHED',
    },
  });
  await prisma.assignmentRevision.create({
    data: {
      id: ids.revision,
      assignmentId: ids.assignment,
      revisionNumber: 1,
      state: 'PUBLISHED',
      title: 'Migration fixture',
      instructions: 'fixture',
      totalPoints: 10,
    },
  });
  await prisma.assignmentAudience.create({
    data: {
      id: ids.audience,
      assignmentRevisionId: ids.revision,
      classId: ids.class,
      availableAt: new Date('2026-01-01T00:00:00Z'),
      dueAt: new Date('2026-12-31T00:00:00Z'),
    },
  });
  await prisma.assignmentQuestion.create({
    data: {
      id: ids.question,
      assignmentRevisionId: ids.revision,
      stableQuestionId: 'q-1',
      orderIndex: 0,
      responseType: 'SUBJECTIVE_FILE',
      points: 10,
      promptSnapshot: { text: 'fixture' },
      answerSnapshot: { text: 'fixture' },
      rubricSnapshot: { version: 'rubric.v1', criteria: [] },
      sourceFamily: 'MANUAL',
      sourceHash: `${prefix}:source`,
      sourceReviewState: 'APPROVED',
      sourceLineage: {},
      contentHash: `${prefix}:question-hash`,
    },
  });
  await prisma.assignmentSubmission.create({
    data: {
      id: ids.submission,
      assignmentRevisionId: ids.revision,
      audienceId: ids.audience,
      studentId: ids.student,
      state: 'SUBMITTED',
      requiredQuestionCount: 1,
      submittedRequiredCount: 1,
      frozenStudentId: ids.student,
      frozenAudienceClassId: ids.class,
    },
  });
  await prisma.submissionAnswer.create({
    data: {
      id: ids.answer,
      submissionId: ids.submission,
      assignmentQuestionId: ids.question,
      state: 'SUBMITTED',
      responseType: 'SUBJECTIVE_FILE',
      currentAttemptNumber: 1,
    },
  });
  await prisma.submissionAttempt.create({
    data: {
      id: ids.attempt,
      answerId: ids.answer,
      attemptNumber: 1,
      answerVersion: 1,
      textSnapshot: 'fixture answer',
    },
  });
}

async function verifyConcurrentMaterialization() {
  const normalized = {
    sourceKind: 'document' as const,
    sourceHash: `${prefix}:aggregate-hash`,
    canonicalMarkdown: 'aggregate evidence',
    anchorVersion: 'assignment-answer-evidence.v2',
    precision: 'block' as const,
    readiness: 'ready' as const,
    limitationState: 'none',
    limitations: [],
    blocks: [{
      id: 'asset:fixture:content',
      blockIndex: 0,
      text: 'aggregate evidence',
      markdown: 'aggregate evidence',
      precision: 'block' as const,
      confidence: 1,
    }],
  };
  const sourceManifest = {
    version: 'assignment-answer-evidence.v2',
    sources: [],
  };
  const results = await Promise.all([
    materializeAssignmentAnswerEvidence({
      db: prisma,
      attemptId: ids.attempt,
      answerVersion: 1,
      normalized,
      sourceManifest,
      actor: { id: 'grading-worker-a', role: 'SERVICE' },
    }),
    materializeAssignmentAnswerEvidence({
      db: prisma,
      attemptId: ids.attempt,
      answerVersion: 1,
      normalized,
      sourceManifest,
      actor: { id: 'grading-worker-b', role: 'SERVICE' },
    }),
  ]);
  assert.equal(results[0].evidence.id, results[1].evidence.id);
  assert.deepEqual(
    results.map((result) => result.replay).sort(),
    [false, true],
  );
  assert.equal(await prisma.answerEvidence.count({
    where: {
      attemptId: ids.attempt,
      anchorVersion: 'assignment-answer-evidence.v2',
    },
  }), 1);
}

async function replaceAggregateWithLegacyFixture() {
  const aggregate = await prisma.answerEvidence.findFirstOrThrow({
    where: { attemptId: ids.attempt },
  });
  await prisma.answerEvidenceBlock.deleteMany({
    where: { evidenceId: aggregate.id },
  });
  await prisma.answerEvidence.delete({ where: { id: aggregate.id } });
  await prisma.submissionAsset.create({
    data: {
      id: ids.asset,
      answerId: ids.answer,
      attemptId: ids.attempt,
      version: 3,
      objectKey: `${prefix}:object`,
      originalName: 'legacy.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      checksum: `${prefix}:checksum`,
      state: 'FINALIZED',
      scanState: 'CLEAN',
    },
  });
  await prisma.documentConversion.create({
    data: {
      id: ids.conversion,
      assetId: ids.asset,
      attemptId: ids.attempt,
      version: 1,
      dedupeKey: `${prefix}:conversion-dedupe`,
      adapter: 'local-markitdown',
      adapterVersion: 'local.v1',
      state: 'SUCCEEDED',
      sourceChecksum: `${prefix}:checksum`,
      canonicalMarkdown: 'legacy local evidence',
    },
  });
  await prisma.answerEvidence.create({
    data: {
      id: ids.evidence,
      attemptId: ids.attempt,
      sourceAssetId: ids.asset,
      conversionId: ids.conversion,
      version: 1,
      sourceKind: 'DOCUMENT',
      sourceHash: `${prefix}:legacy-hash`,
      canonicalMarkdown: 'legacy local evidence',
      anchorVersion: 'document-evidence.v1',
      precision: 'BLOCK',
      readiness: 'READY',
    },
  });
  await prisma.gradingBatch.create({
    data: {
      id: ids.batch,
      dedupeKey: `${prefix}:batch-dedupe`,
      idempotencyKey: `${prefix}:batch-idempotency`,
      questionSnapshotHash: `${prefix}:question-hash`,
      rubricVersion: 'rubric.v1',
      evaluatorId: 'fixture',
      evaluatorVersion: 'fixture.v1',
      state: 'RUNNING',
      totalItems: 2,
    },
  });
  await prisma.gradingRun.createMany({
    data: [
      gradingRun(ids.approvedRun, 'APPROVED', 'approved'),
      gradingRun(ids.activeRun, 'AWAITING_REVIEW', 'active'),
    ],
  });
  await prisma.gradingBatchItem.createMany({
    data: [
      gradingBatchItem(ids.approvedItem, ids.approvedRun, 'SUCCEEDED'),
      gradingBatchItem(ids.activeItem, ids.activeRun, 'GRADING'),
    ],
  });
  await prisma.gradingJob.createMany({
    data: [
      gradingJob(ids.conversionJob, 'CONVERSION', 'RUNNING', {
        conversionId: ids.conversion,
      }),
      gradingJob(ids.runJob, 'GRADING', 'RUNNING', {
        gradingRunId: ids.activeRun,
      }),
      gradingJob(ids.itemJob, 'GRADING', 'QUEUED', {
        batchItemId: ids.activeItem,
      }),
      gradingJob(ids.batchJob, 'BATCH', 'RUNNING', {
        batchId: ids.batch,
      }),
    ],
  });
}

function gradingRun(
  id: string,
  state: 'APPROVED' | 'AWAITING_REVIEW',
  suffix: string,
) {
  return {
    id,
    batchId: ids.batch,
    answerAttemptId: ids.attempt,
    answerEvidenceId: ids.evidence,
    idempotencyKey: `${prefix}:run-idempotency:${suffix}`,
    dedupeKey: `${prefix}:run-dedupe:${suffix}`,
    inputHash: `${prefix}:input:${suffix}`,
    questionSnapshotHash: `${prefix}:question-hash`,
    rubricVersion: 'rubric.v1',
    evaluatorId: 'fixture',
    evaluatorVersion: 'fixture.v1',
    state,
  } as const;
}

function gradingBatchItem(
  id: string,
  gradingRunId: string,
  state: 'SUCCEEDED' | 'GRADING',
) {
  return {
    id,
    batchId: ids.batch,
    attemptId: ids.attempt,
    answerVersion: 1,
    questionSnapshotHash: `${prefix}:question-hash`,
    rubricVersion: 'rubric.v1',
    evaluatorVersion: 'fixture.v1',
    evidenceId: ids.evidence,
    conversionId: ids.conversion,
    gradingRunId,
    state,
  } as const;
}

function gradingJob(
  id: string,
  kind: 'CONVERSION' | 'GRADING' | 'BATCH',
  state: 'QUEUED' | 'RUNNING',
  links: Record<string, string>,
) {
  return {
    id,
    kind,
    state,
    dedupeKey: `${prefix}:job-dedupe:${id}`,
    correlationId: `${prefix}:correlation:${id}`,
    ...links,
  } as const;
}

async function verifyLegacyMigration() {
  const {
    runLegacyAssignmentAttachmentUnderstandingMigration,
  } = await import(
    '../assignments/migrate-legacy-assignment-attachment-understanding'
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const report = await runLegacyAssignmentAttachmentUnderstandingMigration(
      prisma,
      { mode: 'apply', runId: `${prefix}:migration-run` },
    );
    assert.equal(report.candidateCount, 1);
    assert.equal(report.approvedPreservedCount, 1);
    assert.equal(report.blockedCount, 1);
  }
  assert.equal((await prisma.documentConversion.findUniqueOrThrow({
    where: { id: ids.conversion },
  })).state, 'SUCCEEDED');
  assert.equal((await prisma.answerEvidence.findUniqueOrThrow({
    where: { id: ids.evidence },
  })).readiness, 'READY');
  assert.equal((await prisma.gradingRun.findUniqueOrThrow({
    where: { id: ids.approvedRun },
  })).state, 'APPROVED');
  assert.equal((await prisma.gradingRun.findUniqueOrThrow({
    where: { id: ids.activeRun },
  })).state, 'BLOCKED');
  assert.equal((await prisma.gradingBatchItem.findUniqueOrThrow({
    where: { id: ids.approvedItem },
  })).state, 'SUCCEEDED');
  assert.equal((await prisma.gradingBatchItem.findUniqueOrThrow({
    where: { id: ids.activeItem },
  })).state, 'BLOCKED');
  assert.equal((await prisma.gradingBatch.findUniqueOrThrow({
    where: { id: ids.batch },
  })).state, 'PARTIAL');
  assert.equal((await prisma.gradingJob.findUniqueOrThrow({
    where: { id: ids.batchJob },
  })).state, 'BLOCKED');
}

async function cleanup() {
  await prisma.gradingJob.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.gradingBatchItem.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await prisma.gradingRun.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.gradingBatch.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.answerEvidenceBlock.deleteMany({
    where: { evidenceId: { startsWith: prefix } },
  });
  await prisma.answerEvidence.deleteMany({
    where: { attemptId: ids.attempt },
  });
  await prisma.documentConversion.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await prisma.submissionAsset.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await prisma.gradingAuditEvent.deleteMany({
    where: { resourceId: { startsWith: prefix } },
  });
  await prisma.submissionAttempt.deleteMany({ where: { id: ids.attempt } });
  await prisma.submissionAnswer.deleteMany({ where: { id: ids.answer } });
  await prisma.assignmentSubmission.deleteMany({
    where: { id: ids.submission },
  });
  await prisma.assignmentQuestion.deleteMany({ where: { id: ids.question } });
  await prisma.assignmentAudience.deleteMany({ where: { id: ids.audience } });
  await prisma.assignmentRevision.deleteMany({ where: { id: ids.revision } });
  await prisma.assignment.deleteMany({ where: { id: ids.assignment } });
  await prisma.class.deleteMany({ where: { id: ids.class } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.teacher, ids.student] } },
  });
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exitCode = 1;
});

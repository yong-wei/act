import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { assignmentPublicationIdempotencyKey, createAssignmentDraft, publishAssignmentRevision } from '../../src/lib/assignments/assignment-service';
import { resolveConfiguredAIProviderConfig } from '../../src/lib/ai/provider-settings';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';
import { materializeTextAnswerEvidence, processDocumentConversionJob, writeRenderedObjectToSubmissionStore } from '../../src/lib/data-governance/math-document-grading-persistence';
import { createPrismaClient } from '../../src/lib/prisma-client';

const studentIds = ['cmrqa6wxk000401os0wd04cq3', 'cmjm5lkjk0000t69bqiupz5am'];
const activeRevisionId = 'cmsswb16s0001qsv6frywv8us';
const teacherPasswordBackupPath = path.join(process.cwd(), '.next', 'phase7-teacher-password-backup.json');
const prisma = createPrismaClient({ log: ['warn', 'error'] });

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const selectedRevisionId = argumentValue('--revision-id') ?? activeRevisionId;

const question = (id: string, dimension: 'controlModeling' | 'parameterDesign', prompt: string, answer: string, standard: string) => ({
  stableQuestionId: id,
  responseType: 'SUBJECTIVE_TEXT' as const,
  points: 10,
  prompt,
  referenceAnswer: answer,
  rubric: {
    schemaVersion: 'assignment-scoring-rubric.v2' as const,
    criteria: [{
      id: `${id}-criterion`,
      label: '核心理解',
      goalDimension: dimension,
      maxPoints: 10,
      scoringStandard: standard,
      detailedRubricEnabled: true,
      evidenceDescription: '学生作答中对控制原理和工程风险的明确论述。',
      feedbackGuidance: '分别说明作答中正确和缺失的关键点。',
      studentVisibleGuidance: '说明结论并给出必要条件或风险。',
      levels: [
        { id: `${id}-complete`, label: '完整', maxPoints: 10, guideline: '结论准确、表述完整，并说明必要条件或风险。' },
        { id: `${id}-partial`, label: '部分完成', maxPoints: 6, guideline: '包含部分正确结论，但缺少必要条件或风险。' },
      ],
    }],
  },
  source: { family: 'MANUAL' as const, authoringMarker: 'assignment-authoring' as const },
});

async function main() {
  if (process.argv.includes('--materialize-text-evidence')) {
    const attempts = await prisma.submissionAttempt.findMany({
      where: { answer: { submission: { assignmentRevisionId: selectedRevisionId } } },
      include: { answer: { include: { submission: true } } },
    });
    const results = [];
    for (const attempt of attempts) {
      if (!attempt.textSnapshot?.trim()) continue;
      results.push(await materializeTextAnswerEvidence({
        db: prisma,
        attemptId: attempt.id,
        actor: { id: attempt.answer.submission.studentId, role: 'STUDENT' },
        operation: 'phase7-retroactive-evidence',
      }));
    }
    console.log(JSON.stringify({ materialized: results.length }));
    return;
  }
  if (process.argv.includes('--reset-ai-operation')) {
    const operations = await prisma.assignmentGradingOperation.findMany({ where: { assignmentRevisionId: selectedRevisionId }, select: { id: true } });
    const operationIds = operations.map((operation) => operation.id);
    const batches = await prisma.gradingBatch.findMany({ where: { assignmentGradingOperationId: { in: operationIds } }, select: { id: true } });
    const batchIds = batches.map((batch) => batch.id);
    const runs = await prisma.gradingRun.findMany({ where: { batchId: { in: batchIds } }, select: { id: true } });
    const runIds = runs.map((run) => run.id);
    const snapshots = await prisma.assignmentSubmissionSnapshot.findMany({ where: { operationId: { in: operationIds } }, select: { id: true } });
    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    await prisma.gradingJob.deleteMany({ where: { OR: [{ batchId: { in: batchIds } }, { gradingRunId: { in: runIds } }] } });
    await prisma.gradingBatchItem.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.gradingRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.gradingBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.assignmentSubmissionSnapshotItem.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
    await prisma.assignmentSubmissionSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
    const deleted = await prisma.assignmentGradingOperation.deleteMany({ where: { id: { in: operationIds } } });
    console.log(JSON.stringify({ revisionId: selectedRevisionId, deleted: deleted.count, batches: batchIds.length, runs: runIds.length }));
    return;
  }
  if (process.argv.includes('--seed-ai-policy')) {
    const policy = await prisma.gradingLifecyclePolicy.upsert({
      where: { dataClass_version: { dataClass: 'ai-draft', version: 'phase7-v1' } },
      create: { id: 'grading-lifecycle:ai-draft:phase7-v1', dataClass: 'ai-draft', version: 'phase7-v1', retentionSeconds: 86_400, governedRecordRule: null, deleteStrategy: 'delete-content', providerRetentionSeconds: 0, enabled: true },
      update: { enabled: true },
    });
    const runPolicy = await prisma.gradingLifecyclePolicy.upsert({
      where: { dataClass_version: { dataClass: 'grading-run', version: 'phase7-v1' } },
      create: { id: 'grading-lifecycle:grading-run:phase7-v1', dataClass: 'grading-run', version: 'phase7-v1', retentionSeconds: 86_400, governedRecordRule: null, deleteStrategy: 'delete-content', providerRetentionSeconds: 0, enabled: true },
      update: { enabled: true },
    });
    console.log(JSON.stringify({ policies: [policy, runPolicy].map(({ id, dataClass, version }) => ({ id, dataClass, version })) }));
    return;
  }
  if (process.argv.includes('--drain-ai-batches')) {
    const store = createSubmissionObjectStore();
    const batches = await prisma.gradingBatch.findMany({
      where: {
        assignmentRevisionId: selectedRevisionId,
        state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
      },
      select: { id: true, jobs: { where: { kind: 'BATCH' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
    });
    const results = [];
    for (const batch of batches) {
      results.push(await processQuestionGradingBatch({ db: prisma, batchId: batch.id, jobId: batch.jobs[0]?.id, store }));
    }
    console.log(JSON.stringify({ drained: results.length, results }));
    return;
  }
  if (process.argv.includes('--drain-conversion-jobs')) {
    const store = createSubmissionObjectStore();
    const jobs = await prisma.gradingJob.findMany({
      where: {
        kind: 'CONVERSION',
        state: { in: ['QUEUED', 'RETRYABLE'] },
        conversion: { attempt: { answer: { submission: { assignmentRevisionId: selectedRevisionId } } } },
      },
      select: { id: true },
    });
    const results = [];
    for (const job of jobs) {
      results.push(await processDocumentConversionJob({
        db: prisma,
        jobId: job.id,
        store,
        writeRendered: (rendered) => writeRenderedObjectToSubmissionStore({ store, ...rendered }),
      }));
    }
    console.log(JSON.stringify({ drained: results.length, results: results.map(({ conversion, evidence }) => ({ conversion: { id: conversion.id, state: conversion.state, failureCode: conversion.failureCode, hasMarkdown: Boolean(conversion.canonicalMarkdown), hasRenderedPdf: Boolean(conversion.renderedObjectKey) }, evidence: evidence ? { id: evidence.id, readiness: evidence.readiness } : null })) }));
    return;
  }
  if (process.argv.includes('--inspect-grading-runs')) {
    const runs = await prisma.gradingRun.findMany({
      where: { batch: { assignmentRevisionId: selectedRevisionId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, state: true, blockedReasons: true, limitations: true, provider: true, providerRequestId: true, policyId: true, policySnapshot: true },
    });
    console.log(JSON.stringify(runs));
    return;
  }
  if (process.argv.includes('--inspect-provider-binding')) {
    const provider = await resolveConfiguredAIProviderConfig();
    console.log(JSON.stringify({ provider: provider.provider, model: provider.model, baseURL: provider.baseURL, secretRef: provider.secretRef, enabled: provider.enabled }));
    return;
  }
  if (process.argv.includes('--sync-runtime-provider-policy')) {
    const provider = await resolveConfiguredAIProviderConfig();
    const policy = await prisma.gradingProviderPolicy.findFirst({
      where: { provider: provider.provider, version: 'phase7-v1', purpose: 'rubric-grading' },
      select: { id: true },
    });
    if (!policy) throw new Error('phase7-rubric-provider-policy-missing');
    await prisma.gradingProviderPolicy.update({
      where: { id: policy.id },
      data: { model: provider.model, endpoint: provider.baseURL, credentialRef: provider.secretRef, enabled: provider.enabled },
    });
    console.log(JSON.stringify({ policyId: policy.id, provider: provider.provider, model: provider.model, credentialRef: provider.secretRef }));
    return;
  }
  if (process.argv.includes('--inspect-submissions')) {
    const rows = await prisma.assignmentSubmission.findMany({
      where: { assignmentRevisionId: selectedRevisionId },
      include: { student: { select: { name: true, profile: { select: { studentNumber: true } } } }, answers: { include: { attempts: true } } },
      orderBy: { createdAt: 'asc' },
    });
    console.log(JSON.stringify(rows.map((row) => ({
      student: row.student.name,
      studentNumber: row.student.profile?.studentNumber,
      state: row.state,
      submittedRequiredCount: row.submittedRequiredCount,
      answers: row.answers.map((answer) => ({ questionId: answer.assignmentQuestionId, currentAttemptNumber: answer.currentAttemptNumber, attempts: answer.attempts.map((attempt) => ({ attemptNumber: attempt.attemptNumber, state: attempt.state })) })),
    }))));
    return;
  }
  if (process.argv.includes('--set-teacher-password')) {
    const targetClass = await prisma.class.findUniqueOrThrow({ where: { code: 'D94J24' } });
    const teacher = await prisma.user.findUniqueOrThrow({ where: { id: targetClass.teacherId }, select: { id: true, passwordHash: true } });
    await writeFile(teacherPasswordBackupPath, JSON.stringify(teacher), 'utf8');
    await prisma.user.update({ where: { id: teacher.id }, data: { passwordHash: await bcrypt.hash('Phase7Teacher@Just2026!', 10) } });
    console.log(JSON.stringify({ teacherId: teacher.id, account: 'T251210301204' }));
    return;
  }
  if (process.argv.includes('--restore-teacher-password')) {
    const backup = JSON.parse(await readFile(teacherPasswordBackupPath, 'utf8')) as { id: string; passwordHash: string | null };
    await prisma.user.update({ where: { id: backup.id }, data: { passwordHash: backup.passwordHash } });
    await unlink(teacherPasswordBackupPath);
    console.log(JSON.stringify({ teacherId: backup.id, restored: true }));
    return;
  }
  if (process.argv.includes('--inspect-current-teacher')) {
    const targetClass = await prisma.class.findUniqueOrThrow({ where: { code: 'D94J24' } });
    const teacher = await prisma.user.findUniqueOrThrow({
      where: { id: targetClass.teacherId },
      select: { id: true, name: true, email: true, employeeNumber: true },
    });
    console.log(JSON.stringify(teacher));
    return;
  }
  if (process.argv.includes('--create-second-student')) {
    const targetClass = await prisma.class.findUniqueOrThrow({ where: { code: 'D94J24' } });
    const passwordHash = await bcrypt.hash('Phase7Student@Just2026!', 10);
    const user = await prisma.user.upsert({
      where: { email: 'phase7-student@example.test' },
      create: {
        name: '阶段七验收学生',
        email: 'phase7-student@example.test',
        role: 'STUDENT',
        passwordHash,
        profile: { create: { studentNumber: 'phase7_student', classId: targetClass.id, major: '自动化' } },
      },
      update: {
        passwordHash,
        profile: { upsert: { create: { studentNumber: 'phase7_student', classId: targetClass.id, major: '自动化' }, update: { studentNumber: 'phase7_student', classId: targetClass.id } } },
      },
      select: { id: true, name: true, email: true },
    });
    console.log(JSON.stringify({ ...user, account: 'phase7_student' }));
    return;
  }
  if (process.argv.includes('--future') || process.argv.includes('--past')) {
    const dueAt = process.argv.includes('--future')
      ? new Date(Date.now() + 15 * 60_000)
      : new Date(Date.now() - 60_000);
    await prisma.assignmentAudience.updateMany({ where: { assignmentRevisionId: selectedRevisionId }, data: { dueAt } });
    const submissions = await prisma.assignmentSubmission.updateMany({
      where: { assignmentRevisionId: selectedRevisionId },
      data: { frozenAudienceDueAt: dueAt },
    });
    console.log(JSON.stringify({ revisionId: selectedRevisionId, dueAt: dueAt.toISOString(), frozenSubmissions: submissions.count }));
    return;
  }
  const targetClass = await prisma.class.findUniqueOrThrow({ where: { code: 'D94J24' } });
  const teacherId = targetClass.teacherId;
  const classId = targetClass.id;
  await prisma.studentProfile.updateMany({ where: { userId: { in: studentIds } }, data: { classId } });
  const now = new Date();
  const draft = {
    title: `闭环验收作业 ${now.toISOString().slice(0, 16)}`,
    instructions: '请逐题作答。成绩、参考答案和评分标准仅在教师确认并发布结果后显示。',
    totalPoints: 20,
    latePolicy: { version: 1 as const, mode: 'CLOSED' as const },
    responsePolicy: { version: 1 as const, allowedResponseTypes: ['SUBJECTIVE_TEXT' as const] },
    resubmissionPolicy: { version: 1 as const, maxAttempts: 3, untilDueAt: false },
    solutionReleasePolicy: { version: 1 as const, mode: 'TEACHER_CONFIRMED_RESULT' as const },
    questions: [
      question('phase7-q1', 'controlModeling', '说明单位负反馈对闭环系统稳定性的基本影响。', '单位负反馈通常降低系统对参数扰动的敏感性，并可在适当条件下改善稳定性；稳定性仍取决于开环传递函数与相位裕度等条件。', '准确说明负反馈对稳定性和鲁棒性的影响，并说明不能脱离系统条件绝对判断。'),
      question('phase7-q2', 'parameterDesign', '给出比例控制器的传递函数，并说明比例增益增大的一项潜在风险。', '比例控制器传递函数为 C(s)=Kp。增大 Kp 可能减小稳态误差、提高响应速度，但也可能降低稳定裕度并引起超调或振荡。', '正确给出 C(s)=Kp，并指出增益过大可能造成稳定裕度下降、超调或振荡等风险。'),
    ],
  };
  const assignment = await createAssignmentDraft(prisma, { actor: { id: teacherId, role: 'TEACHER' }, courseContext: '自动批改闭环验收', draft });
  const revision = assignment.revisions[0];
  if (!revision?.contentHash) throw new Error('fixture-revision-missing-content-hash');
  const audience = { classId, availableAt: new Date(now.getTime() - 60_000).toISOString(), dueAt: new Date(now.getTime() + 60_000).toISOString() };
  const publicationInput = { actor: { id: teacherId, role: 'TEACHER' as const }, assignmentId: assignment.id, revisionId: revision.id, expectedVersion: revision.version, contentDigest: revision.contentHash, audiences: [audience] };
  const publication = await publishAssignmentRevision(prisma, { ...publicationInput, idempotencyKey: assignmentPublicationIdempotencyKey(publicationInput) });
  const expiredAt = new Date(Date.now() - 60_000);
  await prisma.assignmentAudience.updateMany({ where: { assignmentRevisionId: revision.id, classId }, data: { dueAt: expiredAt } });
  console.log(JSON.stringify({ teacherId, classId, assignmentId: assignment.id, revisionId: revision.id, publication, dueAt: expiredAt.toISOString() }));
}

void main().finally(() => prisma.$disconnect());

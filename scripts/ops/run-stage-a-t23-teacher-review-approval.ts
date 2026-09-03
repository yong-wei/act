import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { approveTeacherAssignmentReview, createTeacherAssignmentReview } from '../../src/lib/data-governance/teacher-assignment-review';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, assignmentId: true, assignment: { select: { authorId: true } }, questions: { select: { id: true, stableQuestionId: true } } },
  });
  const question = revision.questions.find((row) => row.stableQuestionId === 'T2-3');
  if (!question) throw new Error('t23-question-missing');
  const batch = await prisma.gradingBatch.findFirstOrThrow({ where: { assignmentRevisionId: revision.id, questionId: question.id, id: 'grading-batch:a72669bb-e3b8-4c08-90d0-165ca7bf1f2b' }, select: { items: { select: { attemptId: true, gradingRunId: true, attempt: { select: { answer: { select: { submissionId: true } } } } } } } });
  if (batch.items.length !== 1 || !batch.items[0].attemptId || !batch.items[0].gradingRunId || !batch.items[0].attempt?.answer.submissionId) throw new Error(`t23-review-candidates:${batch.items.length}`);
  const item = batch.items[0];
  const runId = item.gradingRunId;
  const submissionId = item.attempt.answer.submissionId;
  const created = await createTeacherAssignmentReview(prisma, { actor: { id: revision.assignment.authorId, role: 'TEACHER' }, assignmentId: revision.assignmentId, submissionId, gradingRunId: runId });
  const approved = await approveTeacherAssignmentReview(prisma, { actor: { id: revision.assignment.authorId, role: 'TEACHER' }, assignmentId: revision.assignmentId, submissionId, reviewId: created.review.id, expectedVersion: created.review.version, idempotencyKey: `stage-a-t23-teacher-approval:${runId}` });
  console.log(JSON.stringify({ revisionId: revision.id, submissionId, questionId: question.stableQuestionId, gradingRunId: runId, reviewId: created.review.id, snapshotId: approved.snapshot.id, replay: approved.replay }));
}

void main().finally(() => prisma.$disconnect());

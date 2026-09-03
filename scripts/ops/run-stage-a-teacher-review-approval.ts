import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import {
  approveTeacherAssignmentReview,
  createTeacherAssignmentReview,
} from '../../src/lib/data-governance/teacher-assignment-review';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, assignmentId: true, assignment: { select: { authorId: true } } },
  });
  const attempts = await prisma.submissionAttempt.findMany({
    where: { answer: { submission: { assignmentRevisionId: revision.id } } },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      attemptNumber: true,
      submittedAt: true,
      answer: { select: { assignmentQuestionId: true, submissionId: true } },
      gradingRuns: {
        where: { state: 'AWAITING_REVIEW' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true },
      },
    },
  });
  const current = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    const key = `${attempt.answer.submissionId}:${attempt.answer.assignmentQuestionId}`;
    if (!current.has(key) && attempt.gradingRuns[0]) current.set(key, attempt);
  }
  if (current.size !== 12) throw new Error(`review-candidates:${current.size}/12`);

  const results: Array<Record<string, unknown>> = [];
  for (const attempt of current.values()) {
    const gradingRunId = attempt.gradingRuns[0]!.id;
    try {
      const created = await createTeacherAssignmentReview(prisma, {
        actor: { id: revision.assignment.authorId, role: 'TEACHER' },
        assignmentId: revision.assignmentId,
        submissionId: attempt.answer.submissionId,
        gradingRunId,
      });
      const approved = await approveTeacherAssignmentReview(prisma, {
        actor: { id: revision.assignment.authorId, role: 'TEACHER' },
        assignmentId: revision.assignmentId,
        submissionId: attempt.answer.submissionId,
        reviewId: created.review.id,
        expectedVersion: created.review.version,
        idempotencyKey: `stage-a-teacher-approval:${created.review.id}`,
      });
      results.push({ submissionId: attempt.answer.submissionId, questionId: attempt.answer.assignmentQuestionId, gradingRunId, status: approved.replay ? 'APPROVED_REPLAY' : 'APPROVED', snapshotId: approved.snapshot.id });
    } catch (error) {
      results.push({ submissionId: attempt.answer.submissionId, questionId: attempt.answer.assignmentQuestionId, gradingRunId, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ revisionId: revision.id, candidateCount: current.size, results }));
  if (results.some((result) => result.status === 'FAILED')) process.exitCode = 1;
}

void main().finally(() => prisma.$disconnect());

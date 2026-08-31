import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':5432', ':5433');

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  confirmAssignmentSubmissionGrade,
  refreshAssignmentSubmissionGrade,
  releaseAssignmentSubmissionGrade,
} from '../../src/lib/data-governance/assignment-submission-grade';
import { ensureAssignmentAiResultSnapshot } from '../../src/lib/data-governance/assignment-grading-orchestration';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, assignmentId: true },
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentRevisionId: revision.id },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const reviewerId = await prisma.teacherAssignmentReview.findFirstOrThrow({
    where: { assignmentRevisionId: revision.id },
    select: { reviewerId: true },
  }).then((row) => row.reviewerId);
  const snapshotVersion = 'stage-a-chinese-2026-08-28';
  const results: Array<{ status: string; error?: string }> = [];
  for (const submission of submissions) {
    try {
      const snapshot = await ensureAssignmentAiResultSnapshot({
        db: prisma,
        assignmentId: revision.assignmentId,
        submissionId: submission.id,
        actor: { id: reviewerId, role: 'TEACHER' },
        snapshotVersion,
      });
      const refreshed = await refreshAssignmentSubmissionGrade(prisma, {
        actor: { id: reviewerId, role: 'TEACHER' },
        assignmentId: revision.assignmentId,
        submissionId: submission.id,
        snapshotId: snapshot.id,
      });
      const confirmation = await confirmAssignmentSubmissionGrade(prisma, {
        actor: { id: reviewerId, role: 'TEACHER' },
        assignmentId: revision.assignmentId,
        submissionId: submission.id,
        snapshotId: snapshot.id,
        expectedVersion: refreshed.grade.version,
        idempotencyKey: `stage-a-confirm:${snapshotVersion}:${submission.id}`,
      });
      const release = await releaseAssignmentSubmissionGrade(prisma, {
        actor: { id: reviewerId, role: 'TEACHER' },
        assignmentId: revision.assignmentId,
        submissionId: submission.id,
        snapshotId: snapshot.id,
        confirmationId: confirmation.confirmation.id,
        idempotencyKey: `stage-a-release:${snapshotVersion}:${submission.id}`,
      });
      results.push({ status: release.replay ? 'RELEASED_REPLAY' : 'RELEASED' });
    } catch (error) {
      results.push({ status: 'FAILED', error: error instanceof Error ? error.stack ?? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ submissions: submissions.length, results }));
  if (results.some((result) => result.status === 'FAILED')) process.exitCode = 1;
}

void main().finally(() => prisma.$disconnect());

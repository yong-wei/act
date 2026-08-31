import 'dotenv/config';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { ensureAssignmentAiResultSnapshot } from '../../src/lib/data-governance/assignment-grading-orchestration';
import { confirmAssignmentSubmissionGrade, refreshAssignmentSubmissionGrade, releaseAssignmentSubmissionGrade } from '../../src/lib/data-governance/assignment-submission-grade';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { assignmentId: true, assignment: { select: { authorId: true } }, submissions: { where: { id: 'cmtb3v8xd0000vkv68oteqp2z' }, select: { id: true } } },
  });
  const submission = revision.submissions[0];
  if (!submission) throw new Error('t23-submission-missing');
  const actor = { id: revision.assignment.authorId, role: 'TEACHER' as const };
  const snapshot = await ensureAssignmentAiResultSnapshot({ db: prisma, assignmentId: revision.assignmentId, submissionId: submission.id, actor, snapshotVersion: 'stage-a-t23-rerun-2026-08-28' });
  const refreshed = await refreshAssignmentSubmissionGrade(prisma, { actor, assignmentId: revision.assignmentId, submissionId: submission.id, snapshotId: snapshot.id });
  const confirmation = await confirmAssignmentSubmissionGrade(prisma, { actor, assignmentId: revision.assignmentId, submissionId: submission.id, snapshotId: snapshot.id, expectedVersion: refreshed.grade.version, idempotencyKey: `stage-a-t23-confirm:${snapshot.id}` });
  const release = await releaseAssignmentSubmissionGrade(prisma, { actor, assignmentId: revision.assignmentId, submissionId: submission.id, snapshotId: snapshot.id, confirmationId: confirmation.confirmation.id, idempotencyKey: `stage-a-t23-release:${snapshot.id}` });
  console.log(JSON.stringify({ submissionId: submission.id, snapshotId: snapshot.id, gradeVersion: refreshed.grade.version, totalScore: refreshed.grade.totalScore, confirmationId: confirmation.confirmation.id, releaseId: release.release.id, replay: release.replay }));
}

void main().finally(() => prisma.$disconnect());

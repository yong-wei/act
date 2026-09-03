import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const outputDir = join(process.cwd(), '.runtime', 'stage-a-pdf-verification');
const prisma = createPrismaClient({ log: ['warn', 'error'] });

function sha256(value: Uint8Array | string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function anonymous(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, questions: { select: { id: true, stableQuestionId: true } } },
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentRevisionId: revision.id },
    select: { id: true, studentId: true },
    orderBy: { id: 'asc' },
  });
  const snapshots = await prisma.assignmentSubmissionSnapshot.findMany({
    where: { assignmentRevisionId: revision.id, source: 'AI', submissionId: { in: submissions.map((submission) => submission.id) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, submissionId: true, grade: { select: { state: true, questionProjection: true } } },
  });
  const current = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) if (!current.has(snapshot.submissionId)) current.set(snapshot.submissionId, snapshot);
  const approvalIds = [...current.values()].flatMap((snapshot) => Array.isArray(snapshot.grade?.questionProjection)
    ? snapshot.grade.questionProjection.map((item: { approvalSnapshotId?: unknown }) => item.approvalSnapshotId).filter((id: unknown): id is string => typeof id === 'string')
    : []);
  const questionNames = new Map(revision.questions.map((question) => [question.id, question.stableQuestionId]));
  const approvals = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { id: { in: approvalIds } },
    select: { submissionId: true, questionId: true, feedbackRelease: { select: { derivative: { select: { state: true, outputChecksum: true, outputMimeType: true } } } } },
  });
  const results = await Promise.all(approvals.map(async (approval) => {
    const submission = submissions.find((candidate) => candidate.id === approval.submissionId);
    const question = questionNames.get(approval.questionId);
    const derivative = approval.feedbackRelease?.derivative;
    if (!submission || !question || !derivative?.outputChecksum || derivative.state !== 'READY' || derivative.outputMimeType !== 'application/pdf') return { valid: false, reason: 'release-reference-invalid' };
    const path = join(outputDir, `student-${anonymous(submission.studentId)}`, `${question}.pdf`);
    try {
      const actualChecksum = sha256(await readFile(path));
      return { valid: actualChecksum === derivative.outputChecksum, reason: actualChecksum === derivative.outputChecksum ? 'checksum-match' : 'checksum-mismatch' };
    } catch {
      return { valid: false, reason: 'local-copy-missing' };
    }
  }));
  const reasons = results.reduce<Record<string, number>>((counts, result) => ({ ...counts, [result.reason]: (counts[result.reason] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ expected: submissions.length * revision.questions.length, checked: results.length, matched: results.filter((result) => result.valid).length, reasons }));
}

void main().finally(() => prisma.$disconnect());

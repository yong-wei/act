import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { getStudentAssignment } from '../../src/lib/assignments/submission-service';
import { createPrismaClient } from '../../src/lib/prisma-client';
import { readReviewedDerivativeObject } from '../../src/lib/data-governance/teacher-assignment-review-derivative-storage';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const outputDir = join(process.cwd(), '.runtime', 'stage-a-pdf-verification');

function digest(value: Uint8Array | string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function anonymous(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, assignmentId: true, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } } },
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentRevisionId: revision.id },
    select: { id: true, studentId: true, frozenStudentId: true },
    orderBy: { id: 'asc' },
  });
  const resultSnapshots = await prisma.assignmentSubmissionSnapshot.findMany({
    where: { assignmentRevisionId: revision.id, source: 'AI', submissionId: { in: submissions.map((submission) => submission.id) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, submissionId: true, items: { select: { attemptId: true } }, grade: { select: { state: true, questionProjection: true } } },
  });
  const currentSnapshotBySubmission = new Map<string, (typeof resultSnapshots)[number]>();
  for (const snapshot of resultSnapshots) if (!currentSnapshotBySubmission.has(snapshot.submissionId)) currentSnapshotBySubmission.set(snapshot.submissionId, snapshot);
  if (currentSnapshotBySubmission.size !== submissions.length) throw new Error(`result-snapshot-count:${currentSnapshotBySubmission.size}/${submissions.length}`);
  const currentAttemptIds = [...currentSnapshotBySubmission.values()].flatMap((snapshot) => snapshot.items.map((item) => item.attemptId).filter((attemptId): attemptId is string => Boolean(attemptId)));
  if (currentAttemptIds.length !== submissions.length * revision.questions.length) throw new Error(`current-attempt-count:${currentAttemptIds.length}/${submissions.length * revision.questions.length}`);
  if ([...currentSnapshotBySubmission.values()].some((snapshot) => snapshot.grade?.state !== 'RELEASED')) throw new Error('result-grade-not-released');
  const currentSnapshotIds = [...currentSnapshotBySubmission.values()].map((snapshot) => snapshot.id);
  const releasedApprovalIds = [...currentSnapshotBySubmission.values()].flatMap((snapshot) => Array.isArray(snapshot.grade?.questionProjection) ? snapshot.grade.questionProjection.map((item: any) => item?.approvalSnapshotId).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0) : []);
  if (releasedApprovalIds.length !== submissions.length * revision.questions.length) throw new Error(`released-approval-reference-count:${releasedApprovalIds.length}/${submissions.length * revision.questions.length}`);
  const releaseRows = await prisma.assignmentSubmissionGradeRelease.findMany({
    where: { grade: { snapshot: { id: { in: currentSnapshotIds } } } },
    select: { ownerStudentId: true, packageSnapshot: true, releasedAt: true, grade: { select: { snapshot: { select: { submissionId: true } } } } },
  });
  if (releaseRows.length !== submissions.length) throw new Error(`release-count:${releaseRows.length}/${submissions.length}`);
  const packageBySubmission = new Map(releaseRows.map((row) => [row.grade.snapshot.submissionId, row]));
  const studentReads = [];
  for (const submission of submissions) {
    const expected = packageBySubmission.get(submission.id);
    if (!expected || expected.ownerStudentId !== submission.frozenStudentId) throw new Error(`release-owner-mismatch:${anonymous(submission.id)}`);
    const assignment = await getStudentAssignment(prisma, submission.studentId, revision.assignmentId, new Date(), revision.id);
    const result = assignment.resultPackage;
    const expectedPackage = expected.packageSnapshot;
    const resultHash = result ? digest(JSON.stringify(result)) : null;
    const expectedHash = digest(JSON.stringify(expectedPackage));
    if (!result || result.version !== 'assignment-student-result.v1' || resultHash !== expectedHash) throw new Error(`student-result-mismatch:${anonymous(submission.studentId)}`);
    if (assignment.feedbackStatus !== 'PUBLISHED' || assignment.approvedTotal !== Number(result.totalScore) || result.questions.length !== revision.questions.length) throw new Error(`student-result-incomplete:${anonymous(submission.studentId)}`);
    studentReads.push({ student: anonymous(submission.studentId), resultHash, totalScore: result.totalScore, questionCount: result.questions.length, feedbackStatus: assignment.feedbackStatus });
  }
  const approvalRows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id, id: { in: releasedApprovalIds } },
    select: {
      id: true,
      submissionId: true,
      attemptId: true,
      questionId: true,
      feedbackRelease: {
        select: {
          ownerStudentId: true,
          derivative: {
            select: {
              id: true,
              state: true,
              outputKind: true,
              outputObjectKey: true,
              outputChecksum: true,
              outputSizeBytes: true,
              outputMimeType: true,
            },
          },
        },
      },
    },
  });
  const approvals = approvalRows;
  if (approvals.length !== submissions.length * revision.questions.length) throw new Error(`current-approval-count:${approvals.length}/${submissions.length * revision.questions.length}`);
  const questionNames = new Map(revision.questions.map((question) => [question.id, question.stableQuestionId]));
  const pdfs = [];
  for (const approval of approvals) {
    const derivative = approval.feedbackRelease?.derivative;
    if (!derivative || derivative.state !== 'READY' || derivative.outputKind !== 'REVIEWED_PDF' || !derivative.outputObjectKey || !derivative.outputChecksum || derivative.outputMimeType !== 'application/pdf') throw new Error(`pdf-release-missing:${anonymous(approval.id)}`);
    const bytes = await readReviewedDerivativeObject(derivative.outputObjectKey);
    const actualChecksum = digest(bytes);
    if (actualChecksum !== derivative.outputChecksum || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) throw new Error(`pdf-integrity-failed:${anonymous(approval.id)}`);
    const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (document.getPageCount() < 1) throw new Error(`pdf-empty:${anonymous(approval.id)}`);
    const submission = submissions.find((row) => row.id === approval.submissionId);
    if (!submission || approval.feedbackRelease.ownerStudentId !== submission.frozenStudentId) throw new Error(`pdf-owner-mismatch:${anonymous(approval.id)}`);
    const directory = join(outputDir, `student-${anonymous(submission.studentId)}`);
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${questionNames.get(approval.questionId) ?? anonymous(approval.questionId)}.pdf`);
    await writeFile(path, bytes);
    pdfs.push({ approval: anonymous(approval.id), student: anonymous(submission.studentId), question: questionNames.get(approval.questionId) ?? anonymous(approval.questionId), path, checksum: actualChecksum, pages: document.getPageCount(), sizeBytes: bytes.byteLength });
  }
  if (pdfs.length !== submissions.length * revision.questions.length) throw new Error(`pdf-count:${pdfs.length}/${submissions.length * revision.questions.length}`);
  console.log(JSON.stringify({ scope: 'stage-a:T2S-20', submissions: submissions.length, releaseCount: releaseRows.length, studentReads, pdfCount: pdfs.length, pdfs }));
}

void main().finally(() => prisma.$disconnect());

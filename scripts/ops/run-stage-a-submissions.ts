import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore, createSubmissionObjectScanner } from '../../src/lib/assignments/submission-object-store';
import { createSubmissionContentScanner } from '../../src/lib/assignments/submission-scanner';
import { signQuestionUpload, finalizeQuestionAsset, submitQuestionAnswer } from '../../src/lib/assignments/submission-service';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const root = path.resolve(process.env.T2_SUBMISSIONS_ROOT ?? '../../脱敏样本/T2(max)-formal-preparation-v1/contents/submissions');
const samples = ['sample-0007', 'sample-0023', 'sample-0032'];
const questions = ['T2-1', 'T2-2', 'T2-3', 'O2'];
const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const checksum = (bytes: Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: { createdAt: 'desc' }, include: { assignment: { select: { id: true } }, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } }, audiences: { select: { classId: true, dueAt: true } } } });
  const roster = await prisma.studentProfile.findMany({ where: { classId: revision.audiences[0]?.classId }, select: { userId: true }, orderBy: { userId: 'asc' } });
  if (roster.length !== samples.length) throw new Error(`roster-count:${roster.length}`);
  const store = createSubmissionObjectStore();
  const objectScanner = createSubmissionObjectScanner();
  const contentScanner = createSubmissionContentScanner();
  await store.healthCheck(); await contentScanner.healthCheck();
  const result: Array<{ sample: string; student: string; attempts: number }> = [];
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const studentId = roster[sampleIndex].userId;
    let attempts = 0;
    for (const stableQuestionId of questions) {
      const question = revision.questions.find((row) => row.stableQuestionId === stableQuestionId);
      if (!question) throw new Error(`question-missing:${stableQuestionId}`);
      const existingSubmission = await prisma.assignmentSubmission.findUnique({ where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId } }, select: { id: true, answers: { where: { assignmentQuestionId: question.id }, select: { state: true } } } });
      if (existingSubmission?.answers[0]?.state === 'SUBMITTED') { attempts += 1; continue; }
      const filePath = path.join(root, samples[sampleIndex], `${stableQuestionId}.docx`);
      const bytes = await readFile(filePath);
      const signed = await signQuestionUpload(prisma, store, { studentId, assignmentId: revision.assignment.id, questionId: question.id, fileName: `${stableQuestionId}.docx`, mimeType, sizeBytes: bytes.byteLength, checksum: checksum(bytes) });
      const upload = await fetch(signed.url, { method: 'PUT', headers: signed.requiredHeaders, body: bytes });
      if (!upload.ok) throw new Error(`submission-upload-failed:${stableQuestionId}:${upload.status}`);
      const metadata = await store.head(signed.key); if (!metadata) throw new Error('submission-object-missing');
      const scanState = await contentScanner.scan(bytes); await objectScanner.recordTrustedResult(signed.key, scanState);
      if (scanState !== 'CLEAN') throw new Error(`submission-unsafe:${stableQuestionId}`);
      const finalized = await finalizeQuestionAsset(prisma, store, { studentId, assignmentId: revision.assignment.id, questionId: question.id, intentId: signed.intentId, idempotencyKey: `stage-a-finalize-${samples[sampleIndex]}-${stableQuestionId}` });
      if (finalized.status !== 'READY') throw new Error(`submission-finalize:${stableQuestionId}:${finalized.status}`);
      const submitted = await submitQuestionAnswer(prisma, { studentId, assignmentId: revision.assignment.id, questionId: question.id, answerVersion: finalized.answerVersion, idempotencyKey: `stage-a-submit-${samples[sampleIndex]}-${stableQuestionId}` });
      attempts += 1;
    }
    result.push({ sample: samples[sampleIndex], student: `anon-${createHash('sha256').update(studentId).digest('hex').slice(0, 12)}`, attempts });
  }
  const submissions = await prisma.assignmentSubmission.findMany({ where: { assignmentRevisionId: revision.id }, select: { studentId: true, state: true, submittedRequiredCount: true, requiredQuestionCount: true } });
  console.log(JSON.stringify({ revisionId: `sha256:${createHash('sha256').update(revision.id).digest('hex')}`, submissions: submissions.map((row) => ({ student: `anon-${createHash('sha256').update(row.studentId).digest('hex').slice(0, 12)}`, state: row.state, submittedRequiredCount: row.submittedRequiredCount, requiredQuestionCount: row.requiredQuestionCount })), uploadedAndSubmitted: result }));
}
void main().finally(() => prisma.$disconnect());

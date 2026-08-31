import 'dotenv/config';

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const samples = ['sample-0007', 'sample-0023', 'sample-0032'];
const questionNames = ['T2-1', 'T2-2', 'T2-3', 'O2'];
const sourceRoot = path.resolve(process.env.T2_SUBMISSIONS_ROOT ?? path.join('..', '脱敏样本', 'T2(max)-formal-preparation-v1', 'contents', 'submissions'));
const endpoint = process.env.SUBMISSION_S3_ENDPOINT ?? '';
const bucket = process.env.SUBMISSION_S3_BUCKET ?? '';
const region = process.env.SUBMISSION_S3_REGION ?? 'us-east-1';

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function checksumBase64(checksum: string): string {
  return Buffer.from(checksum.slice('sha256:'.length), 'hex').toString('base64');
}

function anonymous(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  if (!endpoint || !bucket || !process.env.SUBMISSION_S3_ACCESS_KEY || !process.env.SUBMISSION_S3_SECRET_KEY) {
    throw new Error('stage-a-object-store-config-missing');
  }

  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    include: {
      questions: { select: { id: true, stableQuestionId: true } },
      audiences: { select: { classId: true } },
    },
  });
  const classId = revision.audiences[0]?.classId;
  if (!classId) throw new Error('stage-a-class-missing');

  const roster = await prisma.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  });
  if (roster.length !== samples.length) throw new Error(`stage-a-roster-count:${roster.length}`);

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentRevisionId: revision.id },
    select: {
      studentId: true,
      answers: {
        select: {
          assignmentQuestionId: true,
          assets: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { objectKey: true, originalName: true, mimeType: true, sizeBytes: true, checksum: true, answerId: true, attemptId: true, state: true, scanState: true },
          },
        },
      },
    },
  });
  if (submissions.length !== samples.length) throw new Error(`stage-a-submission-count:${submissions.length}`);

  const questionByName = new Map(revision.questions.map((question) => [question.stableQuestionId, question]));
  const client = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId: process.env.SUBMISSION_S3_ACCESS_KEY, secretAccessKey: process.env.SUBMISSION_S3_SECRET_KEY } });
  const restored: Array<{ sample: string; student: string; restored: number; alreadyPresent: number }> = [];

  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const studentId = roster[sampleIndex].userId;
    const submission = submissions.find((candidate) => candidate.studentId === studentId);
    if (!submission) throw new Error(`stage-a-submission-missing:${anonymous(studentId)}`);
    let restoredCount = 0;
    let alreadyPresentCount = 0;

    for (const questionName of questionNames) {
      const question = questionByName.get(questionName);
      if (!question) throw new Error(`stage-a-question-missing:${questionName}`);
      const answer = submission.answers.find((candidate) => candidate.assignmentQuestionId === question.id);
      const asset = answer?.assets[0];
      if (!asset || asset.state !== 'FINALIZED' || asset.scanState !== 'CLEAN' || !asset.checksum || !asset.answerId) {
        throw new Error(`stage-a-asset-contract-invalid:${anonymous(studentId)}:${questionName}`);
      }

      const filePath = path.join(sourceRoot, samples[sampleIndex], `${questionName}.docx`);
      const bytes = await readFile(filePath);
      const checksum = sha256(bytes);
      if (bytes.byteLength !== asset.sizeBytes || checksum !== asset.checksum) {
        throw new Error(`stage-a-source-mismatch:${samples[sampleIndex]}:${questionName}`);
      }

      let existing: { ContentLength?: number; Metadata?: Record<string, string> } | null = null;
      try {
        existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: asset.objectKey }));
      } catch (error) {
        const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
        if (!['NotFound', 'NoSuchKey', 'NoSuchObject'].includes(name)) throw error;
      }
      if (existing) {
        if (existing.ContentLength !== bytes.byteLength || existing.Metadata?.checksum !== checksum) throw new Error(`stage-a-existing-object-mismatch:${questionName}`);
        alreadyPresentCount += 1;
        continue;
      }

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: asset.objectKey,
        Body: bytes,
        ContentType: asset.mimeType,
        ContentLength: bytes.byteLength,
        ChecksumSHA256: checksumBase64(checksum),
        Metadata: {
          owner: studentId,
          answer: asset.answerId,
          checksum,
          ...(asset.attemptId ? { 'attempt-id': asset.attemptId } : {}),
        },
        Tagging: 'scan-state=CLEAN',
      }));
      restoredCount += 1;
    }
    restored.push({ sample: samples[sampleIndex], student: `anon-${anonymous(studentId)}`, restored: restoredCount, alreadyPresent: alreadyPresentCount });
  }

  let verified = 0;
  for (const submission of submissions) {
    for (const answer of submission.answers) {
      const asset = answer.assets[0];
      if (!asset) continue;
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: asset.objectKey }));
      if (!response.Body) throw new Error('stage-a-restored-object-empty');
      const bytes = await response.Body.transformToByteArray();
      if (bytes.byteLength !== asset.sizeBytes || sha256(bytes) !== asset.checksum) throw new Error('stage-a-restored-object-verify-failed');
      verified += 1;
    }
  }

  console.log(JSON.stringify({ scope: 'stage-a:T2S-20', restored, verified }));
}

void main().finally(() => prisma.$disconnect());

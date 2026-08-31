import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PDFDocument } from 'pdf-lib';

import { buildReviewedDerivativePlan } from '../../src/lib/data-governance/teacher-assignment-review-derivative';
import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const generatorVersion = '12-pdf-annotation-layout-overall-evaluation';
const root = join(process.cwd(), '.runtime', 'stage-a-pdf-candidates', generatorVersion);
const publish = process.env.STAGE_A_PDF_PUBLISH === 'true';

type Candidate = {
  student: string;
  question: string;
  path: string;
  pages: number;
  checksum: string;
  sourcePath: string;
  sourceChecksum: string;
  sourceSizeBytes: number;
};

async function main() {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as {
    generatorVersion: string;
    candidateCount: number;
    candidates: Candidate[];
  };
  if (manifest.generatorVersion !== generatorVersion || manifest.candidateCount !== 12 || manifest.candidates.length !== 12) {
    throw new Error('stage-a-pdf-publication-manifest-invalid');
  }

  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const rows = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { assignmentRevisionId: revision.id },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
    include: {
      submission: true,
      question: true,
      answerEvidence: { include: { sourceAsset: true, conversion: true, blocks: true } },
      gradingRun: { include: { question: true, assessments: true } },
      feedbackRelease: true,
      reviewedDerivatives: {
        where: { state: 'READY', outputKind: 'REVIEWED_PDF' },
        orderBy: { readyAt: 'desc' },
        take: 1,
        select: { generatorId: true, anchorMapVersion: true },
      },
    },
  });
  const approvals = rows.filter((row, index) => rows.findIndex((candidate) => candidate.submissionId === row.submissionId && candidate.questionId === row.questionId) === index);
  if (approvals.length !== 12 || approvals.some((approval) => approval.reviewedDerivatives.length !== 1 || !approval.feedbackRelease)) {
    throw new Error(`stage-a-pdf-publication-scope-invalid:${approvals.length}`);
  }
  const baseline = approvals[0].reviewedDerivatives[0];
  if (approvals.some((approval) => {
    const derivative = approval.reviewedDerivatives[0];
    return derivative.generatorId !== baseline.generatorId || derivative.anchorMapVersion !== baseline.anchorMapVersion;
  })) throw new Error('stage-a-pdf-publication-lineage-invalid');

  const candidates = new Map(manifest.candidates.map((candidate) => [`${candidate.student}:${candidate.question}`, candidate]));
  if (candidates.size !== 12) throw new Error('stage-a-pdf-publication-candidates-duplicate');
  const prepared = [];
  for (const approval of approvals) {
    await hydrateAggregateAttachmentEvidence(approval);
    const key = `${anonymize(approval.submission.frozenStudentId)}:${approval.question.stableQuestionId}`;
    const candidate = candidates.get(key);
    if (!candidate) throw new Error('stage-a-pdf-publication-candidate-missing');
    const [sourceBytes, outputBytes] = await Promise.all([readFile(candidate.sourcePath), readFile(candidate.path)]);
    if (sha256(sourceBytes) !== candidate.sourceChecksum || sourceBytes.byteLength !== candidate.sourceSizeBytes) {
      throw new Error('stage-a-pdf-publication-source-integrity-mismatch');
    }
    if (sha256(outputBytes) !== candidate.checksum) throw new Error('stage-a-pdf-publication-output-integrity-mismatch');
    const pdf = await PDFDocument.load(outputBytes);
    if (pdf.getPageCount() !== candidate.pages) throw new Error('stage-a-pdf-publication-page-count-mismatch');
    const plan = buildReviewedDerivativePlan(approval, {
      generatorId: baseline.generatorId,
      generatorVersion,
      anchorMapVersion: baseline.anchorMapVersion,
      nativeFormats: ['DOCX', 'PDF'],
    });
    const idempotencyKey = checksum({
      sourceChecksum: candidate.sourceChecksum,
      reviewSnapshotChecksum: plan.reviewSnapshotChecksum,
      generatorId: plan.generatorId,
      generatorVersion,
      anchorMapVersion: plan.anchorMapVersion,
    });
    const sourceObjectKey = `teacher-reviewed-sources/${safeSegment(approval.id)}/${candidate.sourceChecksum.slice('sha256:'.length)}.pdf`;
    const outputObjectKey = `teacher-reviewed/${safeSegment(approval.id)}/${idempotencyKey.slice('sha256:'.length)}.pdf`;
    prepared.push({
      approval,
      candidate,
      plan,
      idempotencyKey,
      sourceObjectKey,
      outputObjectKey,
      sourceBytes,
      outputBytes,
      frozenReviewDigest: reviewDigest(approval),
    });
  }

  const existingTargets = await prisma.teacherAssignmentReviewedDerivative.count({
    where: { idempotencyKey: { in: prepared.map((item) => item.idempotencyKey) }, state: 'READY' },
  });
  if (!publish) {
    console.log(JSON.stringify({ publish: false, revisionId: revision.id, candidateCount: prepared.length, existingTargets }));
    return;
  }

  const storage = storageClient();
  for (const item of prepared) {
    await putPdf(storage, item.sourceObjectKey, item.sourceBytes, {
      'source-kind': 'canonical-pdf-regenerated-from-frozen-docx',
      'source-checksum': item.candidate.sourceChecksum,
      'review-snapshot': item.approval.id,
    });
    await putPdf(storage, item.outputObjectKey, item.outputBytes, {
      'source-checksum': item.candidate.sourceChecksum,
      'review-checksum': item.plan.reviewSnapshotChecksum,
      'generator-id': item.plan.generatorId,
      'generator-version': generatorVersion,
      'anchor-map-version': item.plan.anchorMapVersion,
    });
  }
  for (const item of prepared) {
    await verifyObject(storage, item.sourceObjectKey, item.candidate.sourceChecksum);
    await verifyObject(storage, item.outputObjectKey, item.candidate.checksum);
  }

  const publishedAt = new Date();
  const publishedRows = await prisma.$transaction(async (tx) => {
    const result = [];
    for (const item of prepared) {
      let derivative = await tx.teacherAssignmentReviewedDerivative.findUnique({ where: { idempotencyKey: item.idempotencyKey } });
      if (!derivative) {
        derivative = await tx.teacherAssignmentReviewedDerivative.create({
          data: {
            snapshotId: item.approval.id,
            sourceAssetId: item.plan.sourceAssetId,
            sourceObjectKey: item.sourceObjectKey,
            sourceChecksum: item.candidate.sourceChecksum,
            reviewSnapshotChecksum: item.plan.reviewSnapshotChecksum,
            generatorId: item.plan.generatorId,
            generatorVersion,
            anchorMapVersion: item.plan.anchorMapVersion,
            lifecyclePolicyVersion: item.plan.lifecyclePolicyVersion,
            idempotencyKey: item.idempotencyKey,
            state: 'READY',
            outputKind: 'REVIEWED_PDF',
            outputMimeType: 'application/pdf',
            outputObjectKey: item.outputObjectKey,
            outputChecksum: item.candidate.checksum,
            outputSizeBytes: item.outputBytes.byteLength,
            nativeCapable: false,
            anchorPrecision: item.plan.anchorPrecision,
            limitations: [...new Set([...item.plan.limitations, 'canonical-pdf-regenerated-from-frozen-docx'])],
            attemptCount: 1,
            readyAt: publishedAt,
          },
        });
      }
      if (derivative.state !== 'READY'
        || derivative.snapshotId !== item.approval.id
        || derivative.sourceChecksum !== item.candidate.sourceChecksum
        || derivative.outputChecksum !== item.candidate.checksum
        || derivative.outputObjectKey !== item.outputObjectKey) {
        throw new Error('stage-a-pdf-publication-existing-target-conflict');
      }
      const moved = await tx.teacherAssignmentFeedbackRelease.updateMany({
        where: { snapshotId: item.approval.id, derivativeId: item.approval.feedbackRelease!.derivativeId },
        data: { derivativeId: derivative.id },
      });
      if (moved.count !== 1) throw new Error('stage-a-pdf-publication-release-race');
      result.push({ snapshotId: item.approval.id, derivativeId: derivative.id });
    }
    return result;
  });

  const after = await prisma.teacherAssignmentApprovalSnapshot.findMany({
    where: { id: { in: prepared.map((item) => item.approval.id) } },
    include: { feedbackRelease: { include: { derivative: true } } },
  });
  if (after.length !== 12) throw new Error('stage-a-pdf-publication-verification-count');
  const expected = new Map(prepared.map((item) => [item.approval.id, item]));
  for (const approval of after) {
    const item = expected.get(approval.id);
    if (!item || reviewDigest(approval) !== item.frozenReviewDigest) throw new Error('stage-a-pdf-publication-review-mutated');
    if (approval.feedbackRelease?.derivative?.generatorVersion !== generatorVersion
      || approval.feedbackRelease.derivative.outputChecksum !== item.candidate.checksum) {
      throw new Error('stage-a-pdf-publication-release-verification-failed');
    }
  }
  await writeFile(join(root, 'publication-receipt.json'), JSON.stringify({
    generatorVersion,
    published: true,
    publishedAt: publishedAt.toISOString(),
    releaseCount: publishedRows.length,
    mode: 'new-canonical-pdf-source-version',
  }, null, 2));
  console.log(JSON.stringify({ publish: true, revisionId: revision.id, published: publishedRows.length, generatorVersion }));
}

function storageClient() {
  const bucket = process.env.TEACHER_REVIEW_DERIVATIVE_S3_BUCKET ?? process.env.SUBMISSION_S3_BUCKET ?? '';
  const accessKey = process.env.TEACHER_REVIEW_DERIVATIVE_S3_ACCESS_KEY ?? process.env.SUBMISSION_S3_ACCESS_KEY;
  const secretKey = process.env.TEACHER_REVIEW_DERIVATIVE_S3_SECRET_KEY ?? process.env.SUBMISSION_S3_SECRET_KEY;
  if (!bucket || !process.env.SUBMISSION_S3_ENDPOINT || !accessKey || !secretKey) throw new Error('stage-a-pdf-publication-storage-not-configured');
  const client = new S3Client({
    endpoint: process.env.SUBMISSION_S3_ENDPOINT,
    region: process.env.SUBMISSION_S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  return { client, bucket };
}

async function putPdf(storage: ReturnType<typeof storageClient>, key: string, bytes: Uint8Array, metadata: Record<string, string>) {
  const digest = createHash('sha256').update(bytes).digest();
  await storage.client.send(new PutObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    Body: bytes,
    ContentType: 'application/pdf',
    ContentLength: bytes.byteLength,
    ChecksumSHA256: digest.toString('base64'),
    Metadata: Object.fromEntries(Object.entries(metadata).map(([name, value]) => [name, safeMetadata(value)])),
  }));
}

async function verifyObject(storage: ReturnType<typeof storageClient>, key: string, expectedChecksum: string) {
  const response = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
  if (!response.Body) throw new Error('stage-a-pdf-publication-object-empty');
  const bytes = new Uint8Array(await response.Body.transformToByteArray());
  if (sha256(bytes) !== expectedChecksum) throw new Error('stage-a-pdf-publication-object-integrity-mismatch');
}

async function hydrateAggregateAttachmentEvidence(snapshot: any) {
  const evidence = snapshot.answerEvidence;
  if (!evidence || evidence.sourceAsset || evidence.conversion || evidence.sourceAssetId != null) return;
  const sources = Array.isArray(evidence.sourceManifest?.sources) ? evidence.sourceManifest.sources : [];
  const attachments = sources.filter((source: any) => source?.kind === 'ATTACHMENT' && source?.state === 'READY' && typeof source?.assetId === 'string');
  if (attachments.length !== 1) return;
  const assetId = attachments[0].assetId;
  const sourceAsset = await prisma.submissionAsset.findFirst({
    where: { id: assetId, attemptId: snapshot.attemptId, state: 'FINALIZED' },
    select: { id: true, objectKey: true, checksum: true, sizeBytes: true, mimeType: true },
  });
  if (!sourceAsset) return;
  const conversion = await prisma.documentConversion.findFirst({
    where: { assetId, attemptId: snapshot.attemptId, state: { in: ['SUCCEEDED', 'FALLBACK'] }, renderedObjectKey: { not: null }, renderedChecksum: { not: null } },
    orderBy: { version: 'desc' },
    select: { state: true, adapter: true, renderedObjectKey: true, renderedChecksum: true },
  });
  evidence.sourceAsset = sourceAsset;
  evidence.conversion = conversion;
}

function reviewDigest(value: any) {
  return checksum({
    snapshotId: value.id,
    questionTotal: String(value.questionTotal),
    criterionSnapshot: value.criterionSnapshot,
    annotationSnapshot: value.annotationSnapshot,
    overallComment: value.overallComment,
  });
}

function checksum(value: unknown) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function sha256(value: Uint8Array) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function anonymize(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160);
}

function safeMetadata(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '_').slice(0, 512);
}

void main().finally(() => prisma.$disconnect());

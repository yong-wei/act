import 'dotenv/config';

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { buildReviewedDerivativePlan } from '../../src/lib/data-governance/teacher-assignment-review-derivative';
import { renderFrozenPdfDerivative, type FrozenPdfAnnotationInput } from '../../src/lib/data-governance/teacher-assignment-review-derivative-storage';
import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':5432/', ':5433/');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const run = promisify(execFile);
const generatorVersion = '12-pdf-annotation-layout-overall-evaluation';
const outputDir = join(process.cwd(), '.runtime', 'stage-a-pdf-candidates', generatorVersion);
const sourceRoot = 'E:\\CODE\\脱敏样本';
const libreOffice = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

async function main() {
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
      reviewedDerivatives: {
        where: { state: 'READY', outputKind: 'REVIEWED_PDF' },
        orderBy: { readyAt: 'desc' },
        take: 1,
        select: { generatorId: true, anchorMapVersion: true, sourceAsset: { select: { checksum: true } } },
      },
    },
  });
  const approvals = rows.filter((row, index) => rows.findIndex((candidate) => candidate.submissionId === row.submissionId && candidate.questionId === row.questionId) === index);
  if (approvals.length !== 12 || approvals.some((approval) => approval.reviewedDerivatives.length !== 1)) {
    throw new Error(`stage-a-candidate-scope-invalid:${approvals.length}`);
  }
  const baseline = approvals[0].reviewedDerivatives[0];
  if (approvals.some((approval) => approval.reviewedDerivatives[0].generatorId !== baseline.generatorId || approval.reviewedDerivatives[0].anchorMapVersion !== baseline.anchorMapVersion)) {
    throw new Error('stage-a-candidate-lineage-invalid');
  }

  const sourceByChecksum = await matchingLocalDocx(new Set(approvals.map((approval) => String(approval.reviewedDerivatives[0].sourceAsset?.checksum ?? ''))));
  if (sourceByChecksum.size !== 12) throw new Error(`stage-a-candidate-source-docx-missing:${sourceByChecksum.size}`);
  await mkdir(outputDir, { recursive: true });

  const candidates = [];
  for (const approval of approvals) {
    await hydrateAggregateAttachmentEvidence(approval);
    const sourceChecksum = String(approval.reviewedDerivatives[0].sourceAsset?.checksum ?? '');
    const source = sourceByChecksum.get(sourceChecksum);
    if (!source) throw new Error('stage-a-candidate-source-docx-unresolved');
    const canonicalPdf = await renderDocxToPdf(source);
    const plan = buildReviewedDerivativePlan(approval, {
      generatorId: baseline.generatorId,
      generatorVersion,
      anchorMapVersion: baseline.anchorMapVersion,
      nativeFormats: ['DOCX', 'PDF'],
    });
    const rendered = await renderFrozenPdfDerivative({
      source: canonicalPdf,
      identity: plan.idempotencyKey,
      annotations: pdfAnnotations(plan),
      summaryLines: [`总体评价：${plan.overallComment ?? ''}`],
    });
    const student = anonymize(approval.submission.frozenStudentId);
    const question = approval.question.stableQuestionId;
    const directory = join(outputDir, `student-${student}`);
    const sourceDirectory = join(outputDir, 'sources', `student-${student}`);
    await mkdir(directory, { recursive: true });
    await mkdir(sourceDirectory, { recursive: true });
    const path = join(directory, `${question}.pdf`);
    const sourcePath = join(sourceDirectory, `${question}.pdf`);
    await writeFile(sourcePath, canonicalPdf);
    await writeFile(path, rendered.bytes);
    candidates.push({
      student,
      question,
      path,
      pages: rendered.outputPageCount,
      checksum: sha256(rendered.bytes),
      sourcePath,
      sourceChecksum: sha256(canonicalPdf),
      sourceSizeBytes: canonicalPdf.byteLength,
    });
  }
  if (candidates.length !== 12) throw new Error(`stage-a-candidate-output-count:${candidates.length}`);
  await writeFile(join(outputDir, 'manifest.json'), JSON.stringify({
    generatorVersion,
    source: 'local-docx-re-rendered-canonical-pdf',
    published: false,
    candidateCount: candidates.length,
    candidates,
  }, null, 2));
  console.log(JSON.stringify({ generatorVersion, published: false, candidateCount: candidates.length, outputDir }));
}

function pdfAnnotations(plan: ReturnType<typeof buildReviewedDerivativePlan>): FrozenPdfAnnotationInput[] {
  return plan.annotations.flatMap((annotation, index) => {
    if (!Number.isInteger(annotation.anchor?.pageNumber)) return [];
    return [{
      id: String(annotation.id ?? `${plan.snapshotId}:${index}`),
      pageNumber: Number(annotation.anchor.pageNumber),
      bbox: Array.isArray(annotation.anchor?.bbox) ? annotation.anchor.bbox as [number, number, number, number] : null,
      coordinateProvenance: annotation.anchor?.coordinateProvenance,
      marker: '',
      contents: String(annotation.comment ?? ''),
      allowPageFallback: true,
      fallbackPrecision: String(annotation.anchor?.precision ?? '').toUpperCase() === 'BLOCK' ? 'BLOCK' : 'PAGE',
      blockId: typeof annotation.anchor?.blockId === 'string' ? annotation.anchor.blockId : null,
    }];
  });
}

async function matchingLocalDocx(expected: Set<string>) {
  const matches = new Map<string, string>();
  for (const path of (await filesUnder(sourceRoot)).filter((path) => extname(path).toLowerCase() === '.docx')) {
    const checksum = sha256(await readFile(path));
    if (expected.has(checksum) && !matches.has(checksum)) matches.set(checksum, path);
  }
  return matches;
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
    where: {
      assetId,
      attemptId: snapshot.attemptId,
      state: { in: ['SUCCEEDED', 'FALLBACK'] },
      renderedObjectKey: { not: null },
      renderedChecksum: { not: null },
    },
    orderBy: { version: 'desc' },
    select: { state: true, adapter: true, renderedObjectKey: true, renderedChecksum: true },
  });
  evidence.sourceAsset = sourceAsset;
  evidence.conversion = conversion;
}

async function renderDocxToPdf(path: string) {
  const workdir = await mkdtemp(join(tmpdir(), 'stage-a-pdf-candidate-'));
  try {
    const input = join(workdir, 'answer.docx');
    const profile = join(workdir, 'libreoffice-profile');
    await writeFile(input, await readFile(path));
    await mkdir(profile);
    await run(libreOffice, [
      `-env:UserInstallation=${pathToFileURL(profile).href}`,
      '--headless', '--convert-to', 'pdf', '--outdir', workdir, input,
    ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    return new Uint8Array(await readFile(join(workdir, 'answer.pdf')));
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesUnder(join(directory, entry.name))
    : [join(directory, entry.name)]))).flat();
}

function sha256(value: Uint8Array) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function anonymize(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

void main().finally(() => prisma.$disconnect());

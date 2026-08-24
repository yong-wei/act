import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import JSZip from 'jszip';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { readTeacherAiGradingLabConfig } from '../../src/lib/data-governance/teacher-ai-grading-lab-contracts';
import { createFileSystemTeacherAiGradingLabDatasetStore } from '../../src/lib/data-governance/teacher-ai-grading-lab-dataset-store';
import {
  buildTeacherAiGradingVisualDiagnosis,
  type TeacherAiGradingVisualDiagnosticExecution,
  type TeacherAiGradingVisualDiagnosticRecord,
} from '../../src/lib/data-governance/teacher-ai-grading-visual-diagnostics';

interface QuestionComparisonRow {
  sampleId: string;
  questionId: string;
  maxScore: number;
  teacherScore: number;
  aiScores: Array<number | null>;
}

interface FailureRow {
  sampleId: string;
  questionId: string;
  repetitionOrdinal: number;
  errorCode: string;
}

interface Arguments {
  resultsRoot: string;
  output: string;
  configurationId: string;
  batchId: string;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const resultsRoot = resolve(args.resultsRoot);
  const output = assertExternalOutput(args.output);
  const [comparison, failures] = await Promise.all([
    readJson<QuestionComparisonRow[]>(resolve(resultsRoot, 'question-comparison.json')),
    readJson<FailureRow[]>(resolve(resultsRoot, 'failures.json')),
  ]);
  validateComparison(comparison);

  const db = createPrismaClient();
  try {
    const config = await db.teacherAiGradingExperimentConfig.findUnique({
      where: { id: args.configurationId },
      select: { id: true, datasetId: true, datasetVersion: true, splitId: true, processorVersion: true },
    });
    const batch = await db.teacherAiGradingExperimentBatch.findUnique({
      where: { id: args.batchId },
      select: { id: true, configId: true, splitId: true },
    });
    if (!config || !batch || batch.configId !== config.id || batch.splitId !== config.splitId) {
      throw new Error('teacher-ai-grading-visual-diagnosis-run-binding-invalid');
    }

    const sampleIds = [...new Set(comparison.map((row) => row.sampleId))].sort();
    const members = await db.teacherAiGradingLabSplitMember.findMany({
      where: { splitId: config.splitId, sampleId: { in: sampleIds } },
      select: { sampleId: true, partition: true },
    });
    if (members.length !== sampleIds.length || members.some((member) => member.partition !== 'TUNING')) {
      throw new Error('teacher-ai-grading-visual-diagnosis-hidden-partition-forbidden');
    }

    const executions = await db.teacherAiGradingExperimentExecution.findMany({
      where: { batchId: batch.id, sampleId: { in: sampleIds } },
      select: {
        sampleId: true,
        questionId: true,
        repetitionOrdinal: true,
        state: true,
        failureStage: true,
        errorCode: true,
        gradingRun: { select: { inputHash: true } },
      },
    });
    const dataset = await createFileSystemTeacherAiGradingLabDatasetStore(readTeacherAiGradingLabConfig()).load({
      datasetId: config.datasetId,
      datasetVersion: config.datasetVersion,
    });
    const submissions = new Map(comparison.map((row) => {
      const submission = dataset.manifest.samples
        .find((sample) => sample.sampleId === row.sampleId)?.submissions
        .find((candidate) => candidate.questionId === row.questionId);
      if (!submission) throw new Error('teacher-ai-grading-visual-diagnosis-submission-missing');
      return [submissionKey(row.sampleId, row.questionId), submission] as const;
    }));
    const conversionIdBySubmission = new Map([...submissions.entries()].map(([key, submission]) => [
      key,
      conversionId(batch.id, key, submission.checksum),
    ]));
    const conversions = await db.documentConversion.findMany({
      where: { id: { in: [...conversionIdBySubmission.values()] } },
      select: {
        id: true,
        state: true,
        sourceChecksum: true,
        outputChecksum: true,
        renderedChecksum: true,
        canonicalMarkdown: true,
        answerEvidence: {
          select: {
            anchorVersion: true,
            _count: { select: { blocks: true } },
          },
        },
      },
    });
    const conversionById = new Map(conversions.map((conversion) => [conversion.id, conversion]));
    const failureByExecution = new Map(failures.map((failure) => [executionKey(failure.sampleId, failure.questionId, failure.repetitionOrdinal), failure]));
    const executionByKey = new Map(executions.map((execution) => [executionKey(execution.sampleId, execution.questionId, execution.repetitionOrdinal), execution]));
    const records = await Promise.all(comparison.map(async (row) => {
      const key = submissionKey(row.sampleId, row.questionId);
      const submission = submissions.get(key)!;
      const conversion = conversionById.get(conversionIdBySubmission.get(key)!);
      const structure = await inspectDocxStructure(await dataset.readSubmission(row.sampleId, row.questionId));
      const recordExecutions = row.aiScores.map((score, index) => {
        const ordinal = (index + 1) as 1 | 2 | 3;
        const execution = executionByKey.get(executionKey(row.sampleId, row.questionId, ordinal));
        const failure = failureByExecution.get(executionKey(row.sampleId, row.questionId, ordinal));
        return {
          ordinal,
          state: score === null ? 'FAILED' : execution?.state === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
          score,
          inputHash: execution?.gradingRun.inputHash ?? null,
          failureStage: execution?.failureStage ?? null,
          errorCode: execution?.errorCode ?? failure?.errorCode ?? null,
        };
      });
      const hasConversionFailure = recordExecutions.some((execution) => execution.failureStage === 'conversion');
      return {
        anonymousSampleId: row.sampleId,
        questionId: row.questionId,
        maxScore: row.maxScore,
        teacherScore: row.teacherScore,
        visualEvidenceKind: classifyVisualEvidence(structure),
        embeddedImageCount: structure.imageCount,
        formulaCount: structure.formulaCount,
        visualEvidenceDelivered: structure.imageCount === 0,
        conversion: {
          status: hasConversionFailure ? 'FAILED' : conversion?.state === 'SUCCEEDED' ? 'SUCCEEDED' : 'UNAVAILABLE',
          sourceHash: conversion?.sourceChecksum ?? submission.checksum,
          renderedPdfChecksum: conversion?.renderedChecksum ?? null,
          markdownChecksum: conversion?.outputChecksum ?? null,
          markdownLength: conversion?.canonicalMarkdown.length ?? null,
          evidenceBlockCount: conversion?.answerEvidence?._count.blocks ?? null,
          anchorVersion: conversion?.answerEvidence?.anchorVersion ?? null,
          processorVersion: config.processorVersion,
          errorCode: recordExecutions.find((execution) => execution.failureStage === 'conversion')?.errorCode ?? null,
        },
        executions: recordExecutions.map(({ failureStage: _failureStage, errorCode: _errorCode, ...execution }) => execution),
      } satisfies TeacherAiGradingVisualDiagnosticRecord;
    }));
    const diagnosis = buildTeacherAiGradingVisualDiagnosis({
      partition: 'tuning',
      dataset: { id: config.datasetId, version: config.datasetVersion },
      run: { configurationId: config.id, batchId: batch.id, processorVersion: config.processorVersion },
      records,
    });
    const outputDocument = {
      ...diagnosis,
      generatedAt: new Date().toISOString(),
      sourcePipelineAudit: {
        conversionAttachment: 'application/pdf',
        providerAcceptedAttachmentKinds: ['image'],
        documentAttachmentDeliveredToProvider: false,
      },
      limitations: [
        '该报告只读取调优集和匿名化分数、哈希、状态及文档结构计数。',
        '结构扫描不能判定手绘图语义正确性，也不能替代人工量规或人工基准的一致性复核。',
        '现有运行表的转换尝试按样本而非题目记录；题目级转换状态仅在执行失败阶段为 conversion 时确定。',
      ],
    };
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, `${JSON.stringify(outputDocument, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ output, recordCount: records.length, rootCause: diagnosis.rootCause.code })}\n`);
  } finally {
    await db.$disconnect();
  }
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) throw new Error('teacher-ai-grading-visual-diagnosis-arguments-invalid');
    values.set(key.slice(2), value);
  }
  const resultsRoot = values.get('results-root');
  const output = values.get('output');
  const configurationId = values.get('configuration-id');
  const batchId = values.get('batch-id');
  if (!resultsRoot || !output || !configurationId || !batchId || values.size !== 4) {
    throw new Error('teacher-ai-grading-visual-diagnosis-arguments-invalid');
  }
  return { resultsRoot, output, configurationId, batchId };
}

function assertExternalOutput(value: string): string {
  if (!isAbsolute(value)) throw new Error('teacher-ai-grading-visual-diagnosis-output-must-be-absolute');
  const output = resolve(value);
  const repositoryRelative = relative(process.cwd(), output);
  if (!repositoryRelative.startsWith('..') && !isAbsolute(repositoryRelative)) {
    throw new Error('teacher-ai-grading-visual-diagnosis-output-must-be-outside-repository');
  }
  return output;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function validateComparison(rows: QuestionComparisonRow[]): void {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('teacher-ai-grading-visual-diagnosis-results-empty');
  for (const row of rows) {
    if (!/^sample-[a-z0-9]{4,32}$/u.test(row.sampleId) || !row.questionId || !Number.isFinite(row.maxScore)
      || !Number.isFinite(row.teacherScore) || !Array.isArray(row.aiScores) || row.aiScores.length !== 3
      || row.aiScores.some((score) => score !== null && !Number.isFinite(score))) {
      throw new Error('teacher-ai-grading-visual-diagnosis-results-invalid');
    }
  }
}

async function inspectDocxStructure(bytes: Buffer): Promise<{ imageCount: number; formulaCount: number; textCharacterCount: number }> {
  const archive = await JSZip.loadAsync(bytes);
  const document = await archive.file('word/document.xml')?.async('text');
  if (!document) throw new Error('teacher-ai-grading-visual-diagnosis-docx-document-missing');
  const imageCount = Object.values(archive.files).filter((file) => !file.dir && file.name.startsWith('word/media/')).length;
  const formulaCount = (document.match(/<m:oMath(?:\s|>)/gu) ?? []).length;
  const textCharacterCount = (document.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu) ?? [])
    .reduce((total, value) => total + value.replace(/<[^>]+>/gu, '').trim().length, 0);
  return { imageCount, formulaCount, textCharacterCount };
}

function classifyVisualEvidence(structure: { imageCount: number; formulaCount: number; textCharacterCount: number }) {
  if (structure.imageCount === 0) return 'TEXT_OR_FORMULA' as const;
  if (structure.formulaCount === 0 && structure.textCharacterCount < 80) return 'SCANNED_OR_HAND_DRAWN' as const;
  return 'EMBEDDED_IMAGE' as const;
}

function executionKey(sampleId: string, questionId: string, ordinal: number): string {
  return `${sampleId}:${questionId}:${ordinal}`;
}

function submissionKey(sampleId: string, questionId: string): string {
  return `${sampleId}:${questionId}`;
}

function conversionId(batchId: string, key: string, checksum: string): string {
  return `grading-lab-conversion:${createHash('sha256').update(`${batchId}:${key}:${checksum}`).digest('hex').slice(0, 32)}`;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'teacher-ai-grading-visual-diagnosis-failed'}\n`);
  process.exitCode = 1;
});

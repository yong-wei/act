import { createHash } from 'node:crypto';

import {
  renderFrozenPdfDerivative,
  type FrozenPdfAnnotationInput,
  type FrozenPdfCoordinateProvenance,
  type FrozenPdfPlacement,
} from './teacher-assignment-review-derivative-storage';
import { materializeTeacherAiGradingStructuredResult } from './teacher-ai-grading-lab-structured-review';

export const TEACHER_AI_GRADING_LAB_PDF_GENERATOR_VERSION = 'teacher-ai-grading-lab-pdf.v1' as const;

export class TeacherAiGradingLabPdfError extends Error {
  readonly blocked = true;

  constructor(public readonly code: string) {
    super(code);
    this.name = 'TeacherAiGradingLabPdfError';
  }
}

export type TeacherAiGradingLabPdfConversion = {
  id: string;
  version: number;
  adapterVersion: string;
  state: 'SUCCEEDED';
  renderedObjectKey: string;
  renderedChecksum: string;
  renderedSizeBytes: number;
};

export type TeacherAiGradingLabPdfAnchor = {
  pageNumber: number | null;
  blockId?: string | null;
  bbox?: [number, number, number, number] | null;
  coordinateProvenance?: FrozenPdfCoordinateProvenance | null;
  precision?: 'EXACT' | 'REGION' | 'BLOCK' | 'QUESTION' | 'PAGE';
};

export type TeacherAiGradingLabStructuredResultBody = {
  versionId: string;
  totalScore: number;
  maxScore: number;
  questions: Array<{ questionId: string; score: number; maxScore: number }>;
  feedback: Array<{
    id: string;
    questionId: string;
    criterionId: string;
    errorCode?: string | null;
    reason: string;
    correction: string;
    anchor: TeacherAiGradingLabPdfAnchor;
  }>;
};

export type TeacherAiGradingLabStructuredResult = TeacherAiGradingLabStructuredResultBody & {
  checksum: string;
};

export type TeacherAiGradingLabPdfPlan = {
  semanticIdentity: string;
  source: {
    conversionId: string;
    conversionVersion: number;
    adapterVersion: string;
    objectKey: string;
    checksum: string;
    sizeBytes: number;
  };
  selectedStructuredVersion: { id: string; checksum: string };
  generatorVersion: string;
  anchorVersion: string;
  annotations: Array<FrozenPdfAnnotationInput & { criterionId: string }>;
  summaryLines: string[];
};

export type TeacherAiGradingLabPdfMetadata = Omit<TeacherAiGradingLabPdfPlan, 'annotations' | 'summaryLines'> & {
  sourcePageCount: number;
  outputPageCount: number;
  summaryPageNumber: number;
  outputChecksum: string;
  outputSizeBytes: number;
  annotations: Array<FrozenPdfPlacement & { criterionId: string }>;
};

export function hashTeacherAiGradingLabStructuredResult(value: TeacherAiGradingLabStructuredResultBody): string {
  return sha256(stableStringify(value));
}

export function buildTeacherAiGradingLabPdfPlan(input: {
  conversion: TeacherAiGradingLabPdfConversion;
  structuredResult: TeacherAiGradingLabStructuredResult;
  generatorVersion?: string;
  anchorVersion: string;
}): TeacherAiGradingLabPdfPlan {
  const conversion = input.conversion;
  if (conversion.state !== 'SUCCEEDED') fail('teacher-ai-grading-lab-pdf-conversion-not-succeeded');
  if (!token(conversion.id) || !token(conversion.adapterVersion)) fail('teacher-ai-grading-lab-pdf-conversion-lineage-missing');
  if (!Number.isInteger(conversion.version) || conversion.version < 1) fail('teacher-ai-grading-lab-pdf-conversion-version-invalid');
  if (!token(conversion.renderedObjectKey)) fail('teacher-ai-grading-lab-pdf-source-object-key-missing');
  requiredChecksum(conversion.renderedChecksum, 'teacher-ai-grading-lab-pdf-source-checksum-invalid');
  if (!Number.isInteger(conversion.renderedSizeBytes) || conversion.renderedSizeBytes < 1) fail('teacher-ai-grading-lab-pdf-source-size-invalid');
  if (!token(input.anchorVersion)) fail('teacher-ai-grading-lab-pdf-anchor-version-missing');
  const generatorVersion = token(input.generatorVersion) || TEACHER_AI_GRADING_LAB_PDF_GENERATOR_VERSION;
  const structured = input.structuredResult;
  if (!token(structured.versionId)) fail('teacher-ai-grading-lab-pdf-structured-version-missing');
  validateScore(structured.totalScore, structured.maxScore, 'teacher-ai-grading-lab-pdf-total-score-invalid');
  const expectedStructuredChecksum = hashTeacherAiGradingLabStructuredResult(withoutChecksum(structured));
  if (structured.checksum !== expectedStructuredChecksum) fail('teacher-ai-grading-lab-pdf-structured-checksum-mismatch');
  const questionMap = new Map<string, { score: number; maxScore: number }>();
  for (const question of structured.questions) {
    if (!token(question.questionId) || questionMap.has(question.questionId)) fail('teacher-ai-grading-lab-pdf-question-invalid');
    validateScore(question.score, question.maxScore, 'teacher-ai-grading-lab-pdf-question-score-invalid');
    questionMap.set(question.questionId, question);
  }
  const questionScoreTotal = structured.questions.reduce((sum, question) => sum + question.score, 0);
  const questionMaxTotal = structured.questions.reduce((sum, question) => sum + question.maxScore, 0);
  if (Math.abs(questionScoreTotal - structured.totalScore) > 1e-9) fail('teacher-ai-grading-lab-pdf-total-score-mismatch');
  if (Math.abs(questionMaxTotal - structured.maxScore) > 1e-9) fail('teacher-ai-grading-lab-pdf-total-max-score-mismatch');
  const feedbackIds = new Set<string>();
  const annotations = structured.feedback.map((feedback): FrozenPdfAnnotationInput & { criterionId: string } => {
    if (!token(feedback.id) || feedbackIds.has(feedback.id)) fail('teacher-ai-grading-lab-pdf-feedback-id-invalid');
    feedbackIds.add(feedback.id);
    const question = questionMap.get(feedback.questionId);
    if (!question) fail('teacher-ai-grading-lab-pdf-feedback-question-missing');
    if (!token(feedback.criterionId)) fail('teacher-ai-grading-lab-pdf-feedback-criterion-missing');
    const pageNumber = feedback.anchor.pageNumber;
    if (!Number.isInteger(pageNumber) || Number(pageNumber) < 1) fail('teacher-ai-grading-lab-pdf-feedback-page-missing');
    const fallbackPrecision = fallbackPrecisionFor(feedback);
    return {
      id: feedback.id,
      criterionId: feedback.criterionId,
      pageNumber,
      blockId: feedback.anchor.blockId ?? null,
      questionId: feedback.questionId,
      bbox: feedback.anchor.bbox ?? null,
      coordinateProvenance: feedback.anchor.coordinateProvenance ?? null,
      marker: markerFor(feedback.questionId, question, feedback.errorCode),
      contents: detailedFeedback(feedback.reason, feedback.correction),
      fallbackPrecision,
      allowPageFallback: true,
    };
  });
  const summaryLines = [
    `TOTAL ${formatScore(structured.totalScore)}/${formatScore(structured.maxScore)}`,
    ...structured.questions.map((question) => `${asciiToken(question.questionId, 'Q')} ${formatScore(question.score)}/${formatScore(question.maxScore)}`),
  ];
  const identitySeed = {
    source: {
      conversionId: conversion.id,
      conversionVersion: conversion.version,
      adapterVersion: conversion.adapterVersion,
      objectKey: conversion.renderedObjectKey,
      checksum: conversion.renderedChecksum,
      sizeBytes: conversion.renderedSizeBytes,
    },
    selectedStructuredVersion: { id: structured.versionId, checksum: structured.checksum },
    generatorVersion,
    anchorVersion: input.anchorVersion,
    annotations,
    summaryLines,
  };
  return { semanticIdentity: sha256(stableStringify(identitySeed)), ...identitySeed };
}

export async function createTeacherAiGradingLabPdf(input: {
  conversion: TeacherAiGradingLabPdfConversion;
  renderedPdf: { objectKey: string; checksum: string; sizeBytes: number; bytes: Uint8Array };
  structuredResult: TeacherAiGradingLabStructuredResult;
  generatorVersion?: string;
  anchorVersion: string;
}): Promise<{ bytes: Uint8Array; metadata: TeacherAiGradingLabPdfMetadata }> {
  const plan = buildTeacherAiGradingLabPdfPlan(input);
  if (input.renderedPdf.objectKey !== plan.source.objectKey) fail('teacher-ai-grading-lab-pdf-source-object-key-mismatch');
  if (input.renderedPdf.checksum !== plan.source.checksum) fail('teacher-ai-grading-lab-pdf-source-checksum-mismatch');
  if (input.renderedPdf.sizeBytes !== plan.source.sizeBytes || input.renderedPdf.bytes.byteLength !== plan.source.sizeBytes) {
    fail('teacher-ai-grading-lab-pdf-source-size-mismatch');
  }
  if (sha256(input.renderedPdf.bytes) !== plan.source.checksum) fail('teacher-ai-grading-lab-pdf-source-integrity-mismatch');
  let rendered;
  try {
    rendered = await renderFrozenPdfDerivative({
      source: input.renderedPdf.bytes,
      annotations: plan.annotations,
      summaryLines: plan.summaryLines,
      identity: plan.semanticIdentity,
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'teacher-ai-grading-lab-pdf-render-failed';
    throw new TeacherAiGradingLabPdfError(code);
  }
  if (rendered.summaryPageNumber !== rendered.sourcePageCount + 1) fail('teacher-ai-grading-lab-pdf-summary-page-missing');
  const outputChecksum = sha256(rendered.bytes);
  return {
    bytes: rendered.bytes,
    metadata: {
      semanticIdentity: plan.semanticIdentity,
      source: plan.source,
      selectedStructuredVersion: plan.selectedStructuredVersion,
      generatorVersion: plan.generatorVersion,
      anchorVersion: plan.anchorVersion,
      sourcePageCount: rendered.sourcePageCount,
      outputPageCount: rendered.sourcePageCount + 1,
      summaryPageNumber: rendered.summaryPageNumber,
      outputChecksum,
      outputSizeBytes: rendered.bytes.byteLength,
      annotations: rendered.placements.map((placement) => {
        const annotation = plan.annotations.find((candidate) => candidate.id === placement.id);
        if (!annotation) throw new TeacherAiGradingLabPdfError('teacher-ai-grading-lab-pdf-placement-lineage-missing');
        return { ...placement, criterionId: annotation.criterionId };
      }),
    },
  };
}

export async function createAndPersistTeacherAiGradingLabPdf(input: {
  db: Record<string, any>;
  derivativeId: string;
  splitId: string;
  sampleId: string;
  sourceConversionId: string;
  renderedPdf: { objectKey: string; checksum: string; sizeBytes: number; bytes: Uint8Array };
  selectedReviewVersionIds: readonly string[];
  generatorVersion?: string;
  anchorVersion: string;
  now?: Date;
}): Promise<{ bytes: Uint8Array; metadata: TeacherAiGradingLabPdfMetadata; derivative: any }> {
  const derivativeId = requiredToken(input.derivativeId, 'teacher-ai-grading-pdf-derivative-id-missing');
  const splitId = requiredToken(input.splitId, 'teacher-ai-grading-pdf-split-id-missing');
  const sampleId = requiredToken(input.sampleId, 'teacher-ai-grading-pdf-sample-id-missing');
  const sourceConversionId = requiredToken(input.sourceConversionId, 'teacher-ai-grading-pdf-source-conversion-id-missing');
  const materialized = await materializeTeacherAiGradingStructuredResult({
    db: input.db,
    selectedReviewVersionIds: input.selectedReviewVersionIds,
  });
  if (materialized.splitId !== splitId || materialized.sampleId !== sampleId) {
    fail('teacher-ai-grading-pdf-review-version-scope-mismatch');
  }
  const conversion = await input.db.documentConversion.findUnique({
    where: { id: sourceConversionId },
    select: {
      id: true, version: true, adapterVersion: true, state: true,
      renderedObjectKey: true, renderedChecksum: true,
    },
  });
  if (!conversion || conversion.state !== 'SUCCEEDED' || !conversion.renderedObjectKey || !conversion.renderedChecksum) {
    fail('teacher-ai-grading-lab-pdf-conversion-not-succeeded');
  }
  const result = await createTeacherAiGradingLabPdf({
    conversion: {
      id: conversion.id,
      version: conversion.version,
      adapterVersion: conversion.adapterVersion,
      state: 'SUCCEEDED',
      renderedObjectKey: conversion.renderedObjectKey,
      renderedChecksum: conversion.renderedChecksum,
      renderedSizeBytes: input.renderedPdf.sizeBytes,
    },
    renderedPdf: input.renderedPdf,
    structuredResult: materialized.structuredResult as TeacherAiGradingLabStructuredResult,
    generatorVersion: input.generatorVersion,
    anchorVersion: input.anchorVersion,
  });
  const now = input.now ?? new Date();
  const persist = async (db: Record<string, any>) => {
    const derivative = await db.teacherAiGradingEvaluationDerivative.create({
      data: {
        id: derivativeId,
        splitId,
        sampleId,
        sourceConversionId,
        sourcePdfChecksum: result.metadata.source.checksum,
        sourcePdfObjectKey: result.metadata.source.objectKey,
        sourcePdfSizeBytes: result.metadata.source.sizeBytes,
        conversionVersion: result.metadata.source.conversionVersion,
        conversionAdapterVersion: result.metadata.source.adapterVersion,
        generatorVersion: result.metadata.generatorVersion,
        anchorVersion: result.metadata.anchorVersion,
        structuredResultHash: result.metadata.selectedStructuredVersion.checksum,
        semanticIdentity: result.metadata.semanticIdentity,
        contentChecksum: result.metadata.outputChecksum,
        contentSizeBytes: result.metadata.outputSizeBytes,
        createdAt: now,
      },
    });
    await db.teacherAiGradingDerivativeReviewVersion.createMany({
      data: materialized.selectedReviewVersionIds.map((reviewVersionId, ordinal) => ({
        derivativeId,
        reviewVersionId,
        ordinal,
      })),
    });
    return derivative;
  };
  const derivative = input.db.$transaction
    ? await input.db.$transaction(persist, { isolationLevel: 'Serializable' })
    : await persist(input.db);
  return { ...result, derivative };
}

function fallbackPrecisionFor(feedback: TeacherAiGradingLabStructuredResultBody['feedback'][number]): 'PAGE' | 'QUESTION' | 'REGION' | 'BLOCK' {
  const declared = feedback.anchor.precision;
  if (declared === 'PAGE' || declared === 'QUESTION' || declared === 'REGION' || declared === 'BLOCK') return declared;
  if (feedback.anchor.blockId) return 'BLOCK';
  if (feedback.questionId) return 'QUESTION';
  return 'PAGE';
}

function markerFor(questionId: string, score: { score: number; maxScore: number }, errorCode?: string | null): string {
  const parts = [asciiToken(questionId, 'Q'), `${formatScore(score.score)}/${formatScore(score.maxScore)}`];
  if (errorCode) parts.push(asciiToken(errorCode, 'ERR'));
  return parts.join(' ').slice(0, 48);
}

function detailedFeedback(reason: string, correction: string): string {
  return `Reason: ${reason.trim()}\nCorrection: ${correction.trim()}`;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function asciiToken(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/gu, '_').replace(/^_+|_+$/gu, '');
  return normalized || fallback;
}

function validateScore(score: number, maxScore: number, code: string) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) fail(code);
}

function withoutChecksum(value: TeacherAiGradingLabStructuredResult): TeacherAiGradingLabStructuredResultBody {
  const { checksum: _checksum, ...body } = value;
  return body;
}

function requiredChecksum(value: string, code: string) {
  if (!/^sha256:[a-f0-9]{64}$/iu.test(value)) fail(code);
}

function token(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredToken(value: string, code: string): string {
  const normalized = token(value);
  if (!normalized) fail(code);
  return normalized;
}

function fail(code: string): never {
  throw new TeacherAiGradingLabPdfError(code);
}

function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

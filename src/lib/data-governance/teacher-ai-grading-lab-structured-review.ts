import { createHash } from 'node:crypto';

type ReviewDb = Record<string, any>;

export interface TeacherAiGradingScoreCorrection {
  criterionId: string;
  score: number;
}

export type TeacherAiGradingAnnotationCorrection =
  | { action: 'add'; annotationKey: string; criterionId: string; comment: string; location: Readonly<Record<string, unknown>> }
  | { action: 'delete'; sourceAnnotationId: string }
  | { action: 'revise-text'; sourceAnnotationId: string; comment: string }
  | { action: 'revise-location'; sourceAnnotationId: string; location: Readonly<Record<string, unknown>> };

export interface AppendTeacherAiGradingStructuredReviewInput {
  db: ReviewDb;
  executionId: string;
  parentVersionId: string | null;
  decision: 'accept' | 'correct';
  scoreCorrections: readonly TeacherAiGradingScoreCorrection[];
  annotationCorrections: readonly TeacherAiGradingAnnotationCorrection[];
  operatorUserId: string;
  now?: Date;
}

export interface TeacherAiGradingDerivativeRegistration {
  derivativeId: string;
  sampleId: string;
}

export type TeacherAiGradingMaterializedStructuredResult = {
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
    anchor: {
      pageNumber: number | null;
      blockId?: string | null;
      bbox?: [number, number, number, number] | null;
      coordinateProvenance?: Readonly<Record<string, unknown>> | null;
      precision?: 'EXACT' | 'REGION' | 'BLOCK' | 'QUESTION' | 'PAGE';
    };
  }>;
  checksum: string;
};

export interface TeacherAiGradingMaterializedReviewSelection {
  splitId: string;
  sampleId: string;
  selectedReviewVersionIds: string[];
  structuredResult: TeacherAiGradingMaterializedStructuredResult;
}

export interface TeacherAiGradingPdfVerificationChecks {
  originalLayoutComplete: boolean;
  pageMarksComplete: boolean;
  nativeAnnotationsComplete: boolean;
  positioningCorrect: boolean;
  summaryPageCorrect: boolean;
}

export type TeacherAiGradingPdfVerificationStatus = 'pending' | 'failed' | 'passed';

export async function appendTeacherAiGradingStructuredReviewVersion(
  input: AppendTeacherAiGradingStructuredReviewInput,
): Promise<any> {
  const executionId = requireToken(input.executionId, 'teacher-ai-grading-review-execution-id-missing');
  const operatorUserId = requireToken(input.operatorUserId, 'teacher-ai-grading-review-operator-id-missing');
  const scoreCorrections = normalizeScoreCorrections(input.scoreCorrections);
  const annotationCorrections = normalizeAnnotationCorrections(input.annotationCorrections);
  const hasCorrections = scoreCorrections.length > 0 || annotationCorrections.length > 0;
  if (input.decision === 'accept' && hasCorrections) {
    throw new Error('teacher-ai-grading-review-accepted-corrections-forbidden');
  }
  if (input.decision === 'correct' && !hasCorrections) {
    throw new Error('teacher-ai-grading-review-empty');
  }
  const now = input.now ?? new Date();

  return serializable(input.db, async (db) => {
    await lockRow(db, 'TeacherAiGradingExperimentExecution', executionId);
    const execution = await db.teacherAiGradingExperimentExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        state: true,
        gradingRun: {
          select: {
            assessments: { select: { criterionId: true } },
            annotations: { select: { id: true } },
          },
        },
      },
    });
    if (!execution) throw new Error('teacher-ai-grading-review-execution-not-found');
    if (execution.state !== 'SUCCEEDED') throw new Error('teacher-ai-grading-review-execution-not-complete');
    validateCorrectionSources(execution.gradingRun, scoreCorrections, annotationCorrections);

    const latest = await db.teacherAiGradingStructuredReviewVersion.findFirst({
      where: { executionId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const parentVersionId = optionalToken(input.parentVersionId);
    if ((latest?.id ?? null) !== parentVersionId) throw new Error('teacher-ai-grading-review-parent-conflict');
    const version = (latest?.version ?? 0) + 1;
    const content = {
      executionId,
      version,
      parentVersionId,
      decision: input.decision === 'accept' ? 'ACCEPTED' : 'CORRECTED',
      scoreCorrections,
      annotationCorrections,
      operatorUserId,
      createdAt: now.toISOString(),
    };
    return db.teacherAiGradingStructuredReviewVersion.create({
      data: { ...content, contentHash: hashJson(content), createdAt: now },
    });
  });
}

export async function materializeTeacherAiGradingStructuredResult(input: {
  db: ReviewDb;
  selectedReviewVersionIds: readonly string[];
}): Promise<TeacherAiGradingMaterializedReviewSelection> {
  const selectedIds = [...new Set(input.selectedReviewVersionIds.map((id) =>
    requireToken(id, 'teacher-ai-grading-pdf-review-version-missing')))];
  if (selectedIds.length === 0) throw new Error('teacher-ai-grading-pdf-review-version-missing');
  const endpoints = await input.db.teacherAiGradingStructuredReviewVersion.findMany({
    where: { id: { in: selectedIds } },
    select: {
      id: true,
      executionId: true,
      execution: {
        select: {
          id: true,
          splitId: true,
          sampleId: true,
          questionId: true,
          repetitionOrdinal: true,
          state: true,
          gradingRun: {
            select: {
              id: true,
              rubricSnapshot: true,
              assessments: { select: { id: true, criterionId: true, score: true, rationale: true } },
              annotations: {
                select: {
                  id: true, criterionId: true, reason: true, pageNumber: true, blockId: true, bbox: true,
                  precision: true, comment: true, block: { select: { coordinateProvenance: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (endpoints.length !== selectedIds.length) throw new Error('teacher-ai-grading-pdf-review-version-missing');
  const executionIds = [...new Set(endpoints.map((row: any) => row.executionId))];
  if (executionIds.length !== endpoints.length) throw new Error('teacher-ai-grading-pdf-review-version-duplicate-execution');
  const versions = await input.db.teacherAiGradingStructuredReviewVersion.findMany({
    where: { executionId: { in: executionIds } },
    orderBy: [{ executionId: 'asc' }, { version: 'asc' }],
    select: {
      id: true, executionId: true, version: true, parentVersionId: true, decision: true,
      scoreCorrections: true, annotationCorrections: true, operatorUserId: true, contentHash: true, createdAt: true,
    },
  });
  const orderedEndpoints = [...endpoints].sort((left: any, right: any) =>
    left.execution.questionId.localeCompare(right.execution.questionId)
    || left.execution.repetitionOrdinal - right.execution.repetitionOrdinal
    || left.execution.id.localeCompare(right.execution.id));
  const splitIds = new Set(orderedEndpoints.map((row: any) => row.execution.splitId));
  const sampleIds = new Set(orderedEndpoints.map((row: any) => row.execution.sampleId));
  if (splitIds.size !== 1 || sampleIds.size !== 1) throw new Error('teacher-ai-grading-pdf-review-version-scope-mismatch');
  const questionIds = new Set<string>();
  const questions: Array<{ questionId: string; score: number; maxScore: number }> = [];
  const feedback: TeacherAiGradingMaterializedStructuredResult['feedback'] = [];

  for (const endpoint of orderedEndpoints as any[]) {
    if (endpoint.execution.state !== 'SUCCEEDED') throw new Error('teacher-ai-grading-review-execution-not-complete');
    if (questionIds.has(endpoint.execution.questionId)) throw new Error('teacher-ai-grading-pdf-review-question-duplicate');
    questionIds.add(endpoint.execution.questionId);
    const chain = resolveReviewChain(endpoint, versions);
    const run = endpoint.execution.gradingRun;
    const rubricCriteria = rubricCriteriaFromSnapshot(run.rubricSnapshot);
    const scores = new Map<string, number>((run.assessments ?? []).map((row: any) => [row.criterionId, Number(row.score)]));
    const annotations = new Map<string, any>((run.annotations ?? []).map((row: any) => [row.id, {
      id: row.id,
      criterionId: row.criterionId,
      reason: row.reason ?? row.comment,
      comment: String(row.comment),
      location: {
        pageNumber: row.pageNumber,
        blockId: row.blockId,
        bbox: row.bbox,
        coordinateProvenance: row.block?.coordinateProvenance ?? null,
        precision: row.precision,
      },
    }]));
    for (const version of chain) {
      for (const correction of version.scoreCorrections as any[]) scores.set(correction.criterionId, Number(correction.score));
      for (const correction of version.annotationCorrections as any[]) {
        if (correction.action === 'add') {
          annotations.set(`${version.id}:${correction.annotationKey}`, {
            id: `${version.id}:${correction.annotationKey}`,
            criterionId: correction.criterionId,
            comment: correction.comment,
            location: correction.location,
          });
          continue;
        }
        const source = annotations.get(correction.sourceAnnotationId);
        if (!source) throw new Error('teacher-ai-grading-review-annotation-chain-invalid');
        if (correction.action === 'delete') annotations.delete(correction.sourceAnnotationId);
        else if (correction.action === 'revise-text') source.comment = correction.comment;
        else source.location = correction.location;
      }
    }
    let score = 0;
    for (const [criterionId, criterionScore] of scores) {
      const maxPoints = rubricCriteria.get(criterionId);
      if (maxPoints === undefined || !Number.isFinite(criterionScore) || criterionScore < 0 || criterionScore > maxPoints) {
        throw new Error('teacher-ai-grading-pdf-structured-score-invalid');
      }
      score += criterionScore;
    }
    const maxScore = [...rubricCriteria.values()].reduce((sum, value) => sum + value, 0);
    if (!(maxScore > 0)) throw new Error('teacher-ai-grading-pdf-structured-max-score-invalid');
    questions.push({ questionId: endpoint.execution.questionId, score, maxScore });
    for (const annotation of [...annotations.values()].sort((left, right) => left.id.localeCompare(right.id))) {
      feedback.push({
        id: `${endpoint.execution.id}:${annotation.id}`,
        questionId: endpoint.execution.questionId,
        criterionId: annotation.criterionId,
        errorCode: annotation.criterionId,
        reason: annotation.reason,
        correction: annotation.comment,
        anchor: annotation.location,
      });
    }
  }
  const canonicalIds = orderedEndpoints.map((row: any) => row.id);
  const body = {
    versionId: `review-set:${hashJson(canonicalIds).slice(7)}`,
    totalScore: questions.reduce((sum, row) => sum + row.score, 0),
    maxScore: questions.reduce((sum, row) => sum + row.maxScore, 0),
    questions,
    feedback: feedback.sort((left, right) => left.id.localeCompare(right.id)),
  };
  return {
    splitId: orderedEndpoints[0].execution.splitId,
    sampleId: orderedEndpoints[0].execution.sampleId,
    selectedReviewVersionIds: canonicalIds,
    structuredResult: { ...body, checksum: hashJson(body) },
  };
}

export async function registerTeacherAiGradingHiddenPdfSet(input: {
  db: ReviewDb;
  acceptanceId: string;
  derivatives: readonly TeacherAiGradingDerivativeRegistration[];
  now?: Date;
}): Promise<{ acceptanceId: string; splitId: string; count: number; replay: boolean }> {
  const acceptanceId = requireToken(input.acceptanceId, 'teacher-ai-grading-pdf-acceptance-id-missing');
  const derivatives = normalizeDerivativeRegistrations(input.derivatives);
  const now = input.now ?? new Date();

  return serializable(input.db, async (db) => {
    await lockRow(db, 'TeacherAiGradingHiddenAcceptance', acceptanceId);
    const acceptance = await db.teacherAiGradingHiddenAcceptance.findUnique({
      where: { id: acceptanceId },
      select: { id: true, splitId: true, state: true },
    });
    if (!acceptance) throw new Error('teacher-ai-grading-pdf-acceptance-not-found');
    if (acceptance.state !== 'CONSUMED') throw new Error('teacher-ai-grading-pdf-acceptance-not-consumed');
    const split = await db.teacherAiGradingLabSplit.findUnique({
      where: { id: acceptance.splitId },
      select: { members: { where: { partition: 'HIDDEN' }, select: { sampleId: true } } },
    });
    const expected = (split?.members ?? []).map((row: any) => row.sampleId).sort();
    const actual = derivatives.map((row) => row.sampleId).sort();
    if (expected.length === 0 || !sameStrings(expected, actual)) {
      throw new Error('teacher-ai-grading-pdf-hidden-set-incomplete');
    }

    const existing = await db.teacherAiGradingPdfVerification.findMany({
      where: { acceptanceId },
      select: { sampleId: true, derivativeId: true },
    });
    if (existing.length > 0) {
      const replay = existing.length === derivatives.length && derivatives.every((item) => existing.some((row: any) =>
        row.sampleId === item.sampleId && row.derivativeId === item.derivativeId));
      if (!replay) throw new Error('teacher-ai-grading-pdf-set-conflict');
      return { acceptanceId, splitId: acceptance.splitId, count: existing.length, replay: true };
    }

    const persistedDerivatives = await db.teacherAiGradingEvaluationDerivative.findMany({
      where: { id: { in: derivatives.map((item) => item.derivativeId) } },
      include: {
        reviewVersions: { orderBy: { ordinal: 'asc' }, select: { reviewVersionId: true } },
        sourceConversion: {
          select: { id: true, version: true, adapterVersion: true, state: true, renderedObjectKey: true, renderedChecksum: true },
        },
      },
    });
    if (persistedDerivatives.length !== derivatives.length) throw new Error('teacher-ai-grading-pdf-derivative-not-generated');
    for (const derivative of derivatives) {
      const persisted = persistedDerivatives.find((row: any) => row.id === derivative.derivativeId);
      if (persisted.splitId !== acceptance.splitId || persisted.sampleId !== derivative.sampleId) {
        throw new Error('teacher-ai-grading-pdf-derivative-scope-mismatch');
      }
      const materialized = await materializeTeacherAiGradingStructuredResult({
        db,
        selectedReviewVersionIds: persisted.reviewVersions.map((row: any) => row.reviewVersionId),
      });
      if (materialized.splitId !== acceptance.splitId || materialized.sampleId !== derivative.sampleId
        || materialized.structuredResult.checksum !== persisted.structuredResultHash) {
        throw new Error('teacher-ai-grading-pdf-structured-result-mismatch');
      }
      const conversion = persisted.sourceConversion;
      if (conversion?.state !== 'SUCCEEDED' || conversion.id !== persisted.sourceConversionId
        || conversion.version !== persisted.conversionVersion || conversion.adapterVersion !== persisted.conversionAdapterVersion
        || conversion.renderedObjectKey !== persisted.sourcePdfObjectKey
        || conversion.renderedChecksum !== persisted.sourcePdfChecksum) {
        throw new Error('teacher-ai-grading-pdf-source-lineage-mismatch');
      }
      await db.teacherAiGradingPdfVerification.create({
        data: {
          acceptanceId,
          splitId: acceptance.splitId,
          sampleId: derivative.sampleId,
          derivativeId: derivative.derivativeId,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return { acceptanceId, splitId: acceptance.splitId, count: derivatives.length, replay: false };
  });
}

export async function recordTeacherAiGradingPdfVerification(input: {
  db: ReviewDb;
  acceptanceId: string;
  sampleId: string;
  derivativeId: string;
  expectedRevision: number;
  checks: TeacherAiGradingPdfVerificationChecks;
  blockingDefect: boolean;
  defectCode?: string | null;
  operatorUserId: string;
  now?: Date;
}): Promise<any> {
  const acceptanceId = requireToken(input.acceptanceId, 'teacher-ai-grading-pdf-acceptance-id-missing');
  const sampleId = requireToken(input.sampleId, 'teacher-ai-grading-pdf-sample-id-missing');
  const derivativeId = requireToken(input.derivativeId, 'teacher-ai-grading-pdf-derivative-id-missing');
  const operatorUserId = requireToken(input.operatorUserId, 'teacher-ai-grading-pdf-operator-id-missing');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new Error('teacher-ai-grading-pdf-revision-invalid');
  }
  const checks = normalizeChecks(input.checks);
  const defectCode = optionalToken(input.defectCode);
  if (input.blockingDefect && !defectCode) throw new Error('teacher-ai-grading-pdf-defect-code-missing');
  if (!input.blockingDefect && defectCode) throw new Error('teacher-ai-grading-pdf-defect-code-unexpected');
  const now = input.now ?? new Date();

  const updated = await input.db.teacherAiGradingPdfVerification.updateMany({
    where: {
      acceptanceId,
      sampleId,
      derivativeId,
      revision: input.expectedRevision,
      acceptance: { state: 'CONSUMED' },
    },
    data: {
      ...checks,
      blockingDefect: input.blockingDefect,
      defectCode,
      operatorUserId,
      reviewedAt: now,
      revision: { increment: 1 },
      updatedAt: now,
    },
  });
  if (updated.count !== 1) throw new Error('teacher-ai-grading-pdf-verification-conflict');
  return input.db.teacherAiGradingPdfVerification.findUnique({ where: { derivativeId } });
}

export async function getTeacherAiGradingPdfVerificationAggregate(input: {
  db: ReviewDb;
  acceptanceId: string;
}): Promise<{
  status: TeacherAiGradingPdfVerificationStatus;
  expectedCount: number;
  registeredCount: number;
  reviewedCount: number;
  failedCount: number;
}> {
  const acceptanceId = requireToken(input.acceptanceId, 'teacher-ai-grading-pdf-acceptance-id-missing');
  const acceptance = await input.db.teacherAiGradingHiddenAcceptance.findUnique({
    where: { id: acceptanceId },
    select: {
      state: true,
      split: {
        select: {
          hiddenCount: true,
          members: { where: { partition: 'HIDDEN' }, select: { sampleId: true } },
        },
      },
    },
  });
  if (!acceptance) throw new Error('teacher-ai-grading-pdf-acceptance-not-found');
  if (acceptance.state !== 'CONSUMED') {
    return { status: 'pending', expectedCount: acceptance.split.hiddenCount, registeredCount: 0, reviewedCount: 0, failedCount: 0 };
  }
  const rows = await input.db.teacherAiGradingPdfVerification.findMany({ where: { acceptanceId } });
  const reviewed = rows.filter(isCompleteVerification);
  const failed = reviewed.filter((row: any) => row.blockingDefect === true || !allChecksPass(row));
  const expectedSamples = acceptance.split.members.map((row: any) => row.sampleId).sort();
  const registeredSamples = rows.map((row: any) => row.sampleId).sort();
  const complete = expectedSamples.length === acceptance.split.hiddenCount
    && sameStrings(expectedSamples, registeredSamples)
    && reviewed.length === acceptance.split.hiddenCount;
  return {
    status: failed.length > 0 ? 'failed' : complete ? 'passed' : 'pending',
    expectedCount: acceptance.split.hiddenCount,
    registeredCount: rows.length,
    reviewedCount: reviewed.length,
    failedCount: failed.length,
  };
}

function normalizeScoreCorrections(input: readonly TeacherAiGradingScoreCorrection[]): TeacherAiGradingScoreCorrection[] {
  const seen = new Set<string>();
  return input.map((row) => {
    const criterionId = requireToken(row.criterionId, 'teacher-ai-grading-review-criterion-id-missing');
    if (seen.has(criterionId)) throw new Error('teacher-ai-grading-review-score-duplicate');
    if (!Number.isFinite(row.score) || row.score < 0) throw new Error('teacher-ai-grading-review-score-invalid');
    seen.add(criterionId);
    return { criterionId, score: row.score };
  }).sort((left, right) => left.criterionId.localeCompare(right.criterionId));
}

function normalizeAnnotationCorrections(input: readonly TeacherAiGradingAnnotationCorrection[]): TeacherAiGradingAnnotationCorrection[] {
  return input.map((row) => {
    if (row.action === 'add') return {
      action: row.action,
      annotationKey: requireToken(row.annotationKey, 'teacher-ai-grading-review-annotation-key-missing'),
      criterionId: requireToken(row.criterionId, 'teacher-ai-grading-review-criterion-id-missing'),
      comment: requireToken(row.comment, 'teacher-ai-grading-review-comment-missing'),
      location: normalizeObject(row.location, 'teacher-ai-grading-review-location-invalid'),
    };
    const sourceAnnotationId = requireToken(row.sourceAnnotationId, 'teacher-ai-grading-review-source-annotation-missing');
    if (row.action === 'delete') return { action: row.action, sourceAnnotationId };
    if (row.action === 'revise-text') return {
      action: row.action,
      sourceAnnotationId,
      comment: requireToken(row.comment, 'teacher-ai-grading-review-comment-missing'),
    };
    return { action: row.action, sourceAnnotationId, location: normalizeObject(row.location, 'teacher-ai-grading-review-location-invalid') };
  });
}

function validateCorrectionSources(run: any, scores: readonly TeacherAiGradingScoreCorrection[], annotations: readonly TeacherAiGradingAnnotationCorrection[]): void {
  const criteria = new Set((run?.assessments ?? []).map((row: any) => row.criterionId));
  const sourceAnnotations = new Set((run?.annotations ?? []).map((row: any) => row.id));
  for (const row of scores) if (!criteria.has(row.criterionId)) throw new Error('teacher-ai-grading-review-criterion-mismatch');
  for (const row of annotations) {
    if (row.action === 'add' && !criteria.has(row.criterionId)) throw new Error('teacher-ai-grading-review-criterion-mismatch');
    if (row.action !== 'add' && !sourceAnnotations.has(row.sourceAnnotationId)) {
      throw new Error('teacher-ai-grading-review-annotation-mismatch');
    }
  }
}

function normalizeDerivativeRegistrations(input: readonly TeacherAiGradingDerivativeRegistration[]): TeacherAiGradingDerivativeRegistration[] {
  const samples = new Set<string>();
  const ids = new Set<string>();
  return input.map((row) => {
    const derivativeId = requireToken(row.derivativeId, 'teacher-ai-grading-pdf-derivative-id-missing');
    const sampleId = requireToken(row.sampleId, 'teacher-ai-grading-pdf-sample-id-missing');
    if (samples.has(sampleId) || ids.has(derivativeId)) throw new Error('teacher-ai-grading-pdf-derivative-duplicate');
    samples.add(sampleId);
    ids.add(derivativeId);
    return { derivativeId, sampleId };
  }).sort((left, right) => left.sampleId.localeCompare(right.sampleId));
}

function resolveReviewChain(endpoint: any, versions: readonly any[]): any[] {
  const byId = new Map(versions.filter((row) => row.executionId === endpoint.executionId).map((row) => [row.id, row]));
  const reversed: any[] = [];
  const seen = new Set<string>();
  let current = byId.get(endpoint.id);
  while (current) {
    if (seen.has(current.id)) throw new Error('teacher-ai-grading-review-parent-chain-invalid');
    seen.add(current.id);
    const content = {
      executionId: current.executionId,
      version: current.version,
      parentVersionId: current.parentVersionId,
      decision: current.decision,
      scoreCorrections: current.scoreCorrections,
      annotationCorrections: current.annotationCorrections,
      operatorUserId: current.operatorUserId,
      createdAt: new Date(current.createdAt).toISOString(),
    };
    if (hashJson(content) !== current.contentHash) throw new Error('teacher-ai-grading-review-content-hash-mismatch');
    reversed.push(current);
    current = current.parentVersionId ? byId.get(current.parentVersionId) : undefined;
    if (reversed.at(-1).parentVersionId && !current) throw new Error('teacher-ai-grading-review-parent-chain-invalid');
  }
  const chain = reversed.reverse();
  if (chain.some((row, index) => row.version !== index + 1
    || row.parentVersionId !== (index === 0 ? null : chain[index - 1].id))) {
    throw new Error('teacher-ai-grading-review-parent-chain-invalid');
  }
  return chain;
}

function rubricCriteriaFromSnapshot(snapshot: unknown): Map<string, number> {
  const value = snapshot && typeof snapshot === 'object' ? snapshot as Record<string, unknown> : {};
  const criteria = Array.isArray(value.criteria) ? value.criteria : [];
  const result = new Map<string, number>();
  for (const criterion of criteria as any[]) {
    const id = requireToken(String(criterion.id ?? ''), 'teacher-ai-grading-pdf-rubric-criterion-invalid');
    const maxPoints = Number(criterion.maxPoints);
    if (!Number.isFinite(maxPoints) || maxPoints <= 0 || result.has(id)) {
      throw new Error('teacher-ai-grading-pdf-rubric-criterion-invalid');
    }
    result.set(id, maxPoints);
  }
  return result;
}

function normalizeChecks(checks: TeacherAiGradingPdfVerificationChecks): TeacherAiGradingPdfVerificationChecks {
  const keys: Array<keyof TeacherAiGradingPdfVerificationChecks> = [
    'originalLayoutComplete', 'pageMarksComplete', 'nativeAnnotationsComplete', 'positioningCorrect', 'summaryPageCorrect',
  ];
  for (const key of keys) if (typeof checks[key] !== 'boolean') throw new Error('teacher-ai-grading-pdf-checks-incomplete');
  return Object.fromEntries(keys.map((key) => [key, checks[key]])) as unknown as TeacherAiGradingPdfVerificationChecks;
}

function isCompleteVerification(row: any): boolean {
  return row.reviewedAt instanceof Date && typeof row.blockingDefect === 'boolean'
    && ['originalLayoutComplete', 'pageMarksComplete', 'nativeAnnotationsComplete', 'positioningCorrect', 'summaryPageCorrect']
      .every((key) => typeof row[key] === 'boolean');
}

function allChecksPass(row: any): boolean {
  return row.originalLayoutComplete && row.pageMarksComplete && row.nativeAnnotationsComplete
    && row.positioningCorrect && row.summaryPageCorrect;
}

function normalizeObject(value: Readonly<Record<string, unknown>>, code: string): Readonly<Record<string, unknown>> {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length === 0) throw new Error(code);
  return value;
}

async function serializable<Result>(db: ReviewDb, operation: (tx: ReviewDb) => Promise<Result>): Promise<Result> {
  return db.$transaction ? db.$transaction(operation, { isolationLevel: 'Serializable' }) : operation(db);
}

async function lockRow(db: ReviewDb, table: string, id: string): Promise<void> {
  if (db.$queryRawUnsafe) await db.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireToken(value: string, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function optionalToken(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}

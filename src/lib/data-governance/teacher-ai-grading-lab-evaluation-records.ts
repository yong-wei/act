import { createHash } from 'node:crypto';

type EvaluationRecordsDb = Record<string, any>;

export interface BlindAnnotationProjection {
  annotationId: string;
  sampleId: string;
  questionId: string;
  criterionId: string;
  issueIdentity: string;
  evidenceIdentity: string;
}

export interface BlindVisualEvidenceProjection {
  executionId: string;
  evidenceId: string;
  evidenceContentHash: string;
  sampleId: string;
  questionId: string;
  description: string;
  pageNumber: number | null;
  bbox: unknown;
  confidence: number | null;
}

export interface ProviderPricingInput {
  version: string;
  inputMicrosPerMillionTokens: bigint | string;
  outputMicrosPerMillionTokens: bigint | string;
}

export async function listBlindAnnotationProjections(input: {
  db: EvaluationRecordsDb;
  batchId: string;
}): Promise<BlindAnnotationProjection[]> {
  const batchId = requireToken(input.batchId, 'teacher-ai-grading-blind-batch-id-missing');
  const executions = await input.db.teacherAiGradingExperimentExecution.findMany({
    where: { batchId, state: 'SUCCEEDED' },
    select: {
      sampleId: true,
      questionId: true,
      gradingRun: {
        select: {
          annotations: {
            select: {
              id: true,
              criterionId: true,
              blockId: true,
              pageNumber: true,
              spanStart: true,
              spanEnd: true,
              bbox: true,
              excerpt: true,
              comment: true,
            },
          },
        },
      },
    },
  });
  return executions.flatMap((execution: any) => execution.gradingRun.annotations.map((annotation: any) => ({
    annotationId: annotation.id,
    sampleId: execution.sampleId,
    questionId: execution.questionId,
    criterionId: annotation.criterionId,
    ...annotationIdentities(annotation),
  }))).sort((left: BlindAnnotationProjection, right: BlindAnnotationProjection) =>
    left.annotationId.localeCompare(right.annotationId));
}

export async function listBlindVisualEvidenceProjections(input: {
  db: EvaluationRecordsDb;
  batchId: string;
}): Promise<BlindVisualEvidenceProjection[]> {
  const batchId = requireToken(input.batchId, 'teacher-ai-grading-blind-visual-batch-id-missing');
  const executions = await input.db.teacherAiGradingExperimentExecution.findMany({
    where: { batchId, state: 'SUCCEEDED' },
    select: {
      id: true,
      sampleId: true,
      questionId: true,
      gradingRun: {
        select: {
          answerEvidence: {
            select: {
              blocks: {
                select: { id: true, text: true, markdown: true, pageNumber: true, bbox: true, confidence: true, sourceHash: true },
                orderBy: { blockIndex: 'asc' },
              },
            },
          },
        },
      },
    },
  });
  const projections = executions.flatMap((execution: any) => (execution.gradingRun?.answerEvidence?.blocks ?? [])
    .filter((block: any) => isVisualEvidenceBlock(block))
    .map((block: any) => ({
      executionId: execution.id,
      evidenceId: block.id,
      evidenceContentHash: visualEvidenceContentHash(block),
      sampleId: execution.sampleId,
      questionId: execution.questionId,
      description: block.text,
      pageNumber: block.pageNumber ?? null,
      bbox: block.bbox ?? null,
      confidence: block.confidence ?? null,
    })));
  const unique = new Map<string, BlindVisualEvidenceProjection>();
  for (const projection of projections) {
    const existing = unique.get(projection.evidenceId);
    if (!existing) {
      unique.set(projection.evidenceId, projection);
      continue;
    }
    if (existing.evidenceContentHash !== projection.evidenceContentHash
      || existing.sampleId !== projection.sampleId
      || existing.questionId !== projection.questionId) {
      throw new Error('teacher-ai-grading-blind-visual-evidence-ambiguous');
    }
    if (projection.executionId.localeCompare(existing.executionId) < 0) unique.set(projection.evidenceId, projection);
  }
  return [...unique.values()].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}

export async function appendBlindVisualEvidenceJudgment(input: {
  db: EvaluationRecordsDb;
  executionId: string;
  visualEvidenceId: string;
  evidenceContentHash: string;
  faithful: boolean;
  sufficientForScoring: boolean;
  misattributed: boolean;
  operatorUserId: string;
  now?: Date;
}): Promise<any> {
  const executionId = requireToken(input.executionId, 'teacher-ai-grading-blind-visual-execution-id-missing');
  const visualEvidenceId = requireToken(input.visualEvidenceId, 'teacher-ai-grading-blind-visual-evidence-id-missing');
  const evidenceContentHash = requireToken(input.evidenceContentHash, 'teacher-ai-grading-blind-visual-content-hash-missing');
  const operatorUserId = requireToken(input.operatorUserId, 'teacher-ai-grading-blind-visual-operator-missing');
  const now = input.now ?? new Date();
  return withSerializableTransaction(input.db, async (db) => {
    await lockRow(db, 'TeacherAiGradingExperimentExecution', executionId);
    const execution = await db.teacherAiGradingExperimentExecution.findUnique({
      where: { id: executionId },
      select: {
        configId: true,
        state: true,
        gradingRun: {
          select: {
            answerEvidence: {
              select: {
                blocks: {
                  where: { id: visualEvidenceId },
                  select: { id: true, text: true, markdown: true, pageNumber: true, bbox: true, sourceHash: true },
                },
              },
            },
          },
        },
      },
    });
    if (!execution || execution.state !== 'SUCCEEDED') throw new Error('teacher-ai-grading-blind-visual-execution-invalid');
    const block = execution.gradingRun?.answerEvidence?.blocks?.[0];
    if (!block || !isVisualEvidenceBlock(block)) throw new Error('teacher-ai-grading-blind-visual-evidence-invalid');
    const actualHash = visualEvidenceContentHash(block);
    if (actualHash !== evidenceContentHash) throw new Error('teacher-ai-grading-blind-visual-evidence-drift');
    const latest = await db.teacherAiGradingVisualEvidenceBlindJudgment.findFirst({
      where: { executionId, visualEvidenceId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const content = {
      configId: execution.configId,
      executionId,
      visualEvidenceId,
      evidenceContentHash,
      version,
      faithful: input.faithful,
      sufficientForScoring: input.sufficientForScoring,
      misattributed: input.misattributed,
      operatorUserId,
      createdAt: now.toISOString(),
    };
    return db.teacherAiGradingVisualEvidenceBlindJudgment.create({
      data: { ...content, contentHash: hashJson(content), createdAt: now },
    });
  });
}

export async function appendAnnotationJudgment(input: {
  db: EvaluationRecordsDb;
  gradingAnnotationId: string;
  executionId: string;
  locationCorrect: boolean;
  reasonCorrect: boolean;
  suggestionCorrect: boolean;
  seriouslyMisleading: boolean;
  operatorUserId: string;
  now?: Date;
}): Promise<any> {
  const annotationId = requireToken(input.gradingAnnotationId, 'teacher-ai-grading-annotation-id-missing');
  const executionId = requireToken(input.executionId, 'teacher-ai-grading-execution-id-missing');
  const operatorUserId = requireToken(input.operatorUserId, 'teacher-ai-grading-operator-id-missing');
  const now = input.now ?? new Date();
  return withSerializableTransaction(input.db, async (db) => {
    await lockRow(db, 'GradingAnnotation', annotationId);
    const annotation = await db.gradingAnnotation.findUnique({
      where: { id: annotationId },
      select: {
        id: true,
        gradingRunId: true,
        criterionId: true,
        blockId: true,
        pageNumber: true,
        spanStart: true,
        spanEnd: true,
        bbox: true,
        excerpt: true,
        comment: true,
        gradingRun: { select: { teacherAiGradingExperimentExecution: { select: { id: true } } } },
      },
    });
    if (!annotation) throw new Error('teacher-ai-grading-annotation-not-found');
    if (annotation.gradingRun?.teacherAiGradingExperimentExecution?.id !== executionId) {
      throw new Error('teacher-ai-grading-annotation-execution-mismatch');
    }
    const latest = await db.teacherAiGradingAnnotationJudgment.findFirst({
      where: { gradingAnnotationId: annotationId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const identities = annotationIdentities(annotation);
    const content = {
      gradingAnnotationId: annotationId,
      executionId,
      version,
      locationCorrect: input.locationCorrect,
      reasonCorrect: input.reasonCorrect,
      suggestionCorrect: input.suggestionCorrect,
      seriouslyMisleading: input.seriouslyMisleading,
      ...identities,
      operatorUserId,
      createdAt: now.toISOString(),
    };
    return db.teacherAiGradingAnnotationJudgment.create({
      data: { ...content, contentHash: hashJson(content), createdAt: now },
    });
  });
}

export async function appendConversionAttempt(input: {
  db: EvaluationRecordsDb;
  batchId: string;
  sampleId: string;
  questionId: string;
  attemptOrdinal: number;
  status: 'SUCCEEDED' | 'FAILED';
  stage: string;
  errorCode?: string | null;
  durationMs: number;
  conversionVersion: string;
  sourceHash: string;
  visualEvidenceStatus?: 'COMPLETE' | 'INCOMPLETE' | 'NOT_APPLICABLE';
  telemetryComplete: boolean;
  now?: Date;
}): Promise<any> {
  const content = {
    batchId: requireToken(input.batchId, 'teacher-ai-grading-conversion-batch-id-missing'),
    sampleId: requireToken(input.sampleId, 'teacher-ai-grading-conversion-sample-id-missing'),
    questionId: requireToken(input.questionId, 'teacher-ai-grading-conversion-question-id-missing'),
    attemptOrdinal: positiveInteger(input.attemptOrdinal, 'teacher-ai-grading-conversion-attempt-invalid'),
    status: input.status,
    stage: requireToken(input.stage, 'teacher-ai-grading-conversion-stage-missing'),
    errorCode: normalizeAttemptError(input.status, input.errorCode),
    durationMs: nonNegativeInteger(input.durationMs, 'teacher-ai-grading-conversion-duration-invalid'),
    conversionVersion: requireToken(input.conversionVersion, 'teacher-ai-grading-conversion-version-missing'),
    sourceHash: requireToken(input.sourceHash, 'teacher-ai-grading-conversion-source-hash-missing'),
    visualEvidenceStatus: input.visualEvidenceStatus ?? 'NOT_APPLICABLE',
    telemetryComplete: input.telemetryComplete,
  };
  const existing = await input.db.teacherAiGradingConversionAttempt.findFirst({
    where: { batchId: content.batchId, sampleId: content.sampleId, questionId: content.questionId, attemptOrdinal: content.attemptOrdinal },
  });
  const contentHash = hashJson(content);
  if (existing) {
    if (existing.contentHash !== contentHash) throw new Error('teacher-ai-grading-conversion-attempt-conflict');
    return existing;
  }
  return input.db.teacherAiGradingConversionAttempt.create({
    data: { ...content, contentHash, createdAt: input.now ?? new Date() },
  });
}

export async function appendProviderCallAttempt(input: {
  db: EvaluationRecordsDb;
  executionId: string;
  claimToken: string;
  attemptOrdinal: number;
  callOrdinal: number;
  status: 'SUCCEEDED' | 'FAILED';
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  pricing: ProviderPricingInput | null;
  providerRequestId?: string | null;
  errorCode?: string | null;
  telemetryComplete: boolean;
  now?: Date;
}): Promise<any> {
  const executionId = requireToken(input.executionId, 'teacher-ai-grading-provider-execution-id-missing');
  const claimToken = requireToken(input.claimToken, 'teacher-ai-grading-provider-claim-token-missing');
  const now = input.now ?? new Date();
  const attemptOrdinal = positiveInteger(input.attemptOrdinal, 'teacher-ai-grading-provider-attempt-invalid');
  const callOrdinal = positiveInteger(input.callOrdinal, 'teacher-ai-grading-provider-call-invalid');
  const inputTokens = nullableNonNegativeInteger(input.inputTokens, 'teacher-ai-grading-provider-input-tokens-invalid');
  const outputTokens = nullableNonNegativeInteger(input.outputTokens, 'teacher-ai-grading-provider-output-tokens-invalid');
  const pricingVersion = input.pricing ? requireToken(input.pricing.version, 'teacher-ai-grading-pricing-version-missing') : null;
  const estimatedCostMicros = estimateProviderCostMicros({ inputTokens, outputTokens, pricing: input.pricing });
  const telemetryComplete = inputTokens !== null && outputTokens !== null && estimatedCostMicros !== null && pricingVersion !== null;
  if (input.telemetryComplete !== telemetryComplete) throw new Error('teacher-ai-grading-provider-telemetry-completeness-mismatch');
  const content = {
    executionId,
    attemptOrdinal,
    callOrdinal,
    status: input.status,
    inputTokens,
    outputTokens,
    durationMs: nonNegativeInteger(input.durationMs, 'teacher-ai-grading-provider-duration-invalid'),
    estimatedCostMicros,
    pricingVersion,
    providerRequestId: optionalToken(input.providerRequestId),
    errorCode: normalizeAttemptError(input.status, input.errorCode),
    telemetryComplete,
  };
  return withSerializableTransaction(input.db, async (db) => {
    await lockRow(db, 'TeacherAiGradingExperimentExecution', executionId);
    const execution = await db.teacherAiGradingExperimentExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error('teacher-ai-grading-execution-not-found');
    if (execution.state !== 'RUNNING' || execution.claimToken !== claimToken
      || !execution.leaseExpiresAt || execution.leaseExpiresAt <= now
      || execution.attemptCount !== attemptOrdinal) {
      throw new Error('teacher-ai-grading-provider-call-fenced');
    }
    const existing = await db.teacherAiGradingProviderCallAttempt.findFirst({
      where: { executionId, attemptOrdinal, callOrdinal },
    });
    const contentHash = hashJson({ ...content, estimatedCostMicros: estimatedCostMicros?.toString() ?? null });
    if (existing) {
      if (existing.contentHash !== contentHash) throw new Error('teacher-ai-grading-provider-call-conflict');
      return existing;
    }
    return db.teacherAiGradingProviderCallAttempt.create({
      data: { ...content, contentHash, createdAt: now },
    });
  });
}

export function estimateProviderCostMicros(input: {
  inputTokens: number | null;
  outputTokens: number | null;
  pricing: ProviderPricingInput | null;
}): bigint | null {
  if (input.inputTokens === null || input.outputTokens === null || !input.pricing) return null;
  const inputRate = nonNegativeBigInt(input.pricing.inputMicrosPerMillionTokens, 'teacher-ai-grading-input-rate-invalid');
  const outputRate = nonNegativeBigInt(input.pricing.outputMicrosPerMillionTokens, 'teacher-ai-grading-output-rate-invalid');
  const numerator = BigInt(input.inputTokens) * inputRate + BigInt(input.outputTokens) * outputRate;
  return (numerator + BigInt(999_999)) / BigInt(1_000_000);
}

export async function persistReportSnapshot(input: {
  db: EvaluationRecordsDb;
  configId: string;
  splitId: string;
  partition: 'tuning' | 'hidden';
  metricVersion: string;
  pricingVersion: string;
  configurationContentHash: string;
  snapshot: Readonly<Record<string, unknown>>;
  now?: Date;
}): Promise<{ snapshot: any; replay: boolean }> {
  const configId = requireToken(input.configId, 'teacher-ai-grading-report-config-id-missing');
  const splitId = requireToken(input.splitId, 'teacher-ai-grading-report-split-id-missing');
  const metricVersion = requireToken(input.metricVersion, 'teacher-ai-grading-report-metric-version-missing');
  const pricingVersion = requireToken(input.pricingVersion, 'teacher-ai-grading-report-pricing-version-missing');
  const configurationContentHash = requireToken(input.configurationContentHash, 'teacher-ai-grading-report-config-hash-missing');
  const config = await input.db.teacherAiGradingExperimentConfig.findUnique({
    where: { id: configId },
    select: { id: true, splitId: true, contentHash: true },
  });
  if (!config || config.splitId !== splitId || config.contentHash !== configurationContentHash) {
    throw new Error('teacher-ai-grading-report-frozen-context-mismatch');
  }
  const partition = input.partition === 'tuning' ? 'TUNING' : 'HIDDEN';
  const content = { metricVersion, pricingVersion, configurationContentHash, snapshot: input.snapshot };
  const contentHash = hashJson(content);
  const where = { configId, splitId, partition, contentHash };
  const existing = await input.db.teacherAiGradingReportSnapshot.findFirst({ where });
  if (existing) return { snapshot: existing, replay: true };
  try {
    const created = await input.db.teacherAiGradingReportSnapshot.create({
      data: { ...where, metricVersion, pricingVersion, configurationContentHash, snapshot: input.snapshot, createdAt: input.now ?? new Date() },
    });
    return { snapshot: created, replay: false };
  } catch (error) {
    const recovered = await input.db.teacherAiGradingReportSnapshot.findFirst({ where });
    if (recovered) return { snapshot: recovered, replay: true };
    throw error;
  }
}

function annotationIdentities(annotation: Record<string, unknown>): { issueIdentity: string; evidenceIdentity: string } {
  return {
    issueIdentity: hashJson({ criterionId: annotation.criterionId, comment: normalizeText(annotation.comment) }),
    evidenceIdentity: hashJson({
      blockId: annotation.blockId ?? null,
      pageNumber: annotation.pageNumber ?? null,
      spanStart: annotation.spanStart ?? null,
      spanEnd: annotation.spanEnd ?? null,
      bbox: annotation.bbox ?? null,
      excerpt: normalizeText(annotation.excerpt),
    }),
  };
}

export function isVisualEvidenceBlock(block: Record<string, unknown>): boolean {
  return (typeof block.id === 'string' && block.id.includes(':visual-evidence:'))
    || (typeof block.markdown === 'string' && block.markdown.startsWith('> 视觉证据：'));
}

export function visualEvidenceContentHash(block: Record<string, unknown>): string {
  return hashJson({
    id: block.id,
    sourceHash: block.sourceHash,
    text: block.text,
    markdown: block.markdown,
    pageNumber: block.pageNumber,
    bbox: block.bbox,
  });
}

async function withSerializableTransaction<Result>(db: EvaluationRecordsDb, operation: (tx: EvaluationRecordsDb) => Promise<Result>): Promise<Result> {
  return db.$transaction ? db.$transaction(operation, { isolationLevel: 'Serializable' }) : operation(db);
}

async function lockRow(db: EvaluationRecordsDb, table: string, id: string): Promise<void> {
  if (db.$queryRawUnsafe) await db.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
}

function normalizeAttemptError(status: 'SUCCEEDED' | 'FAILED', errorCode: string | null | undefined): string | null {
  const normalized = optionalToken(errorCode);
  if (status === 'SUCCEEDED' && normalized) throw new Error('teacher-ai-grading-success-error-code-forbidden');
  if (status === 'FAILED' && !normalized) throw new Error('teacher-ai-grading-failure-error-code-missing');
  if (normalized && !/^[a-z0-9][a-z0-9._-]{0,119}$/u.test(normalized)) throw new Error('teacher-ai-grading-error-code-invalid');
  return normalized;
}

function requireToken(value: string, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function optionalToken(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function nonNegativeInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function nullableNonNegativeInteger(value: number | null, code: string): number | null {
  return value === null ? null : nonNegativeInteger(value, code);
}

function nonNegativeBigInt(value: bigint | string, code: string): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < BigInt(0)) throw new Error(code);
    return parsed;
  } catch {
    throw new Error(code);
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

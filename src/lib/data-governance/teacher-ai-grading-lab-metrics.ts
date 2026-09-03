import { createHash } from 'node:crypto';

export type TeacherAiGradingPartition = 'tuning' | 'hidden';
export type TeacherAiGradingGateStatus = 'pass' | 'fail' | 'incomplete';

export interface TeacherAiGradingExpectedQuestion {
  questionId: string;
  maxScore: number;
  teacherScore: number;
  expectedDeductionIds?: readonly string[];
}

export interface TeacherAiGradingExpectedSample {
  sampleId: string;
  questions: readonly TeacherAiGradingExpectedQuestion[];
}

export interface TeacherAiGradingAnnotationIdentity {
  annotationId: string;
  criterionId: string;
  issueIdentity: string;
  evidenceIdentity: string;
  deductionId?: string;
}

export interface TeacherAiGradingProviderCall {
  attemptOrdinal: number;
  callOrdinal: number;
  status: 'succeeded' | 'failed';
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  estimatedCostMicros: string | null;
  pricingVersion: string | null;
  telemetryComplete: boolean;
}

export interface TeacherAiGradingExecutionResult {
  sampleId: string;
  questionId: string;
  repetitionOrdinal: 1 | 2 | 3;
  status: 'succeeded' | 'failed';
  score?: number;
  annotations?: readonly TeacherAiGradingAnnotationIdentity[];
  providerCalls?: readonly TeacherAiGradingProviderCall[];
  providerStage?: 'not_reached' | 'called';
  providerTelemetryComplete?: boolean;
  sourceKind?: 'independent-ai' | 'publication-candidate';
}

export interface TeacherAiGradingBlindAnnotationItem {
  annotationId: string;
  sampleId: string;
  questionId: string;
  criterionId: string;
  issueIdentity: string;
  evidenceIdentity: string;
}

export interface TeacherAiGradingAnnotationJudgment {
  annotationId: string;
  locationCorrect?: boolean;
  reasonCorrect?: boolean;
  suggestionCorrect?: boolean;
  seriouslyMisleading?: boolean;
}

export interface TeacherAiGradingRateMetric {
  numerator: number;
  denominator: number;
  rate: number;
}

export interface TeacherAiGradingScoringMetrics {
  exact: TeacherAiGradingRateMetric;
  withinTenPercent: TeacherAiGradingRateMetric;
  missingOrFailed: number;
  status: TeacherAiGradingGateStatus;
}

export interface TeacherAiGradingStabilityMetrics {
  exactGroups: TeacherAiGradingRateMetric;
  toleranceGroups: TeacherAiGradingRateMetric;
  incompleteGroups: number;
  annotationSubstantiveStableGroups: TeacherAiGradingRateMetric;
  annotationIncompleteGroups: number;
  status: TeacherAiGradingGateStatus;
}

export interface TeacherAiGradingAnnotationQualityMetrics {
  location: TeacherAiGradingRateMetric;
  reason: TeacherAiGradingRateMetric;
  suggestion: TeacherAiGradingRateMetric;
  seriouslyMisleadingCount: number;
  judgedCount: number;
  expectedCount: number;
  coverage: TeacherAiGradingRateMetric | null;
  coverageAvailable: boolean;
  status: TeacherAiGradingGateStatus;
}

export interface TeacherAiGradingProcessingMetrics {
  conversion: TeacherAiGradingRateMetric;
  aiSampleRepetitions: TeacherAiGradingRateMetric;
  providerCallCount: number;
  retryCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostMicros: string | null;
  pricingVersion: string;
  conversionTelemetryComplete: boolean;
  providerTelemetryComplete: boolean;
  timing: {
    perSampleDurationMs: ReadonlyArray<{ sampleId: string; durationMs: number }>;
    meanSampleDurationMs: number | null;
    batchWallClockMs: number | null;
    cumulativeProviderDurationMs: number;
    complete: boolean;
  };
  status: TeacherAiGradingGateStatus;
}

export interface TeacherAiGradingPartitionMetricsInput {
  partition: TeacherAiGradingPartition;
  visibility: 'revealed' | 'sealed';
  metricVersion: string;
  configurationContentHash: string;
  pricingVersion: string;
  expectedSamples: readonly TeacherAiGradingExpectedSample[];
  executions: readonly TeacherAiGradingExecutionResult[];
  conversions: ReadonlyArray<{
    sampleId: string;
    questionId: string;
    status: 'succeeded' | 'failed';
    stage: string;
    durationMs: number;
    conversionVersion: string;
    sourceHash: string;
    telemetryComplete: boolean;
  }>;
  sampleDurations: ReadonlyArray<{ sampleId: string; durationMs: number }>;
  batchWallClockMs?: number;
  blindAnnotationItems: readonly TeacherAiGradingBlindAnnotationItem[];
  annotationJudgments: readonly TeacherAiGradingAnnotationJudgment[];
  pdfVerificationStatus: 'not_applicable' | 'pending' | 'passed' | 'failed';
}

export type TeacherAiGradingPartitionReportStatus =
  | 'pass'
  | 'fail'
  | 'incomplete'
  | 'pending_hidden_sealed'
  | 'pending_pdf_verification';

export interface TeacherAiGradingPartitionReport {
  partition: TeacherAiGradingPartition;
  metricVersion: string;
  configurationContentHash: string;
  pricingVersion: string;
  status: TeacherAiGradingPartitionReportStatus;
  scoring: TeacherAiGradingScoringMetrics | null;
  stability: TeacherAiGradingStabilityMetrics | null;
  annotations: TeacherAiGradingAnnotationQualityMetrics | null;
  processing: TeacherAiGradingProcessingMetrics | null;
  pdfVerificationStatus: TeacherAiGradingPartitionMetricsInput['pdfVerificationStatus'];
  contentHash: string;
}

export interface TeacherAiGradingLabReport {
  metricVersion: string;
  configurationContentHash: string;
  pricingVersion: string;
  tuning: TeacherAiGradingPartitionReport;
  hidden: TeacherAiGradingPartitionReport;
  status: 'pass' | 'fail' | 'incomplete' | 'pending_hidden' | 'pending_pdf_verification';
  contentHash: string;
}

interface ExpectedExecution extends TeacherAiGradingExpectedQuestion {
  sampleId: string;
  repetitionOrdinal: 1 | 2 | 3;
}

export function buildTeacherAiGradingPartitionReport(
  input: TeacherAiGradingPartitionMetricsInput,
): TeacherAiGradingPartitionReport {
  assertPartitionInput(input);
  if (input.partition === 'hidden' && input.visibility === 'sealed') {
    return hashPartitionReport({
      partition: input.partition,
      metricVersion: input.metricVersion,
      configurationContentHash: input.configurationContentHash,
      pricingVersion: input.pricingVersion,
      status: 'pending_hidden_sealed',
      scoring: null,
      stability: null,
      annotations: null,
      processing: null,
      pdfVerificationStatus: input.pdfVerificationStatus,
    });
  }

  const scoring = calculateTeacherAiGradingScoringMetrics(input.expectedSamples, input.executions);
  const stability = calculateTeacherAiGradingStabilityMetrics(input.expectedSamples, input.executions);
  const annotations = calculateTeacherAiGradingAnnotationQualityMetrics(
    input.expectedSamples,
    input.executions,
    input.blindAnnotationItems,
    input.annotationJudgments,
  );
  const processing = calculateTeacherAiGradingProcessingMetrics(input);
  const hardStatuses = [scoring.status, stability.status, annotations.status, processing.status];
  let status: TeacherAiGradingPartitionReportStatus = hardStatuses.includes('fail')
    ? 'fail'
    : hardStatuses.includes('incomplete')
      ? 'incomplete'
      : 'pass';
  if (input.partition === 'hidden' && status === 'pass') {
    status = input.pdfVerificationStatus === 'failed'
      ? 'fail'
      : input.pdfVerificationStatus === 'passed'
        ? 'pass'
        : 'pending_pdf_verification';
  }

  return hashPartitionReport({
    partition: input.partition,
    metricVersion: input.metricVersion,
    configurationContentHash: input.configurationContentHash,
    pricingVersion: input.pricingVersion,
    status,
    scoring,
    stability,
    annotations,
    processing,
    pdfVerificationStatus: input.pdfVerificationStatus,
  });
}

export function buildTeacherAiGradingLabReport(input: {
  metricVersion: string;
  configurationContentHash: string;
  pricingVersion: string;
  tuning: TeacherAiGradingPartitionReport;
  hidden: TeacherAiGradingPartitionReport;
}): TeacherAiGradingLabReport {
  if (input.tuning.partition !== 'tuning' || input.hidden.partition !== 'hidden') {
    throw new Error('teacher-ai-grading-report-partitions-invalid');
  }
  for (const partition of [input.tuning, input.hidden]) {
    if (partition.metricVersion !== input.metricVersion
      || partition.configurationContentHash !== input.configurationContentHash
      || partition.pricingVersion !== input.pricingVersion) {
      throw new Error('teacher-ai-grading-report-frozen-context-mismatch');
    }
  }
  const statuses = [input.tuning.status, input.hidden.status];
  const status: TeacherAiGradingLabReport['status'] = statuses.includes('fail')
    ? 'fail'
    : statuses.includes('pending_hidden_sealed')
      ? 'pending_hidden'
      : statuses.includes('incomplete')
        ? 'incomplete'
        : statuses.includes('pending_pdf_verification')
          ? 'pending_pdf_verification'
          : 'pass';
  const body = { ...input, status };
  return { ...body, contentHash: hashJson(body) };
}

export function calculateTeacherAiGradingScoringMetrics(
  expectedSamples: readonly TeacherAiGradingExpectedSample[],
  executions: readonly TeacherAiGradingExecutionResult[],
): TeacherAiGradingScoringMetrics {
  const expected = expandExpectedExecutions(expectedSamples);
  const executionMap = indexExpectedExecutions(expected, executions);
  let exact = 0;
  let withinTolerance = 0;
  let missingOrFailed = 0;
  for (const item of expected) {
    const execution = executionMap.get(executionKey(item));
    if (!isScoredExecution(execution)) {
      missingOrFailed += 1;
      continue;
    }
    const difference = Math.abs(execution.score - item.teacherScore);
    if (difference === 0) exact += 1;
    if (difference <= item.maxScore * 0.1) withinTolerance += 1;
  }
  const exactMetric = rate(exact, expected.length);
  const toleranceMetric = rate(withinTolerance, expected.length);
  return {
    exact: exactMetric,
    withinTenPercent: toleranceMetric,
    missingOrFailed,
    status: exactMetric.rate >= 0.8 && toleranceMetric.rate >= 0.95 ? 'pass' : 'fail',
  };
}

export function calculateTeacherAiGradingStabilityMetrics(
  expectedSamples: readonly TeacherAiGradingExpectedSample[],
  executions: readonly TeacherAiGradingExecutionResult[],
): TeacherAiGradingStabilityMetrics {
  const expected = expandExpectedExecutions(expectedSamples);
  const executionMap = indexExpectedExecutions(expected, executions);
  const questions = expectedSamples.flatMap((sample) => sample.questions.map((question) => ({ ...question, sampleId: sample.sampleId })));
  let exactGroups = 0;
  let toleranceGroups = 0;
  let incompleteGroups = 0;
  let annotationStableGroups = 0;
  let annotationIncompleteGroups = 0;
  for (const question of questions) {
    const group = ([1, 2, 3] as const).map((repetitionOrdinal) => executionMap.get(executionKey({ ...question, repetitionOrdinal })));
    if (!group.every(isScoredExecution)) {
      incompleteGroups += 1;
    } else {
      const scores = group.map((execution) => execution.score);
      const difference = Math.max(...scores) - Math.min(...scores);
      if (difference === 0) exactGroups += 1;
      if (difference <= question.maxScore * 0.1) toleranceGroups += 1;
    }
    if (!group.every((execution) => execution?.status === 'succeeded' && execution.annotations !== undefined)) {
      annotationIncompleteGroups += 1;
    } else if (sameStringSets(group.map((execution) => annotationIdentitySet(execution!.annotations!)))) {
      annotationStableGroups += 1;
    }
  }
  const exactMetric = rate(exactGroups, questions.length);
  const toleranceMetric = rate(toleranceGroups, questions.length);
  const complete = incompleteGroups === 0 && annotationIncompleteGroups === 0;
  return {
    exactGroups: exactMetric,
    toleranceGroups: toleranceMetric,
    incompleteGroups,
    annotationSubstantiveStableGroups: rate(annotationStableGroups, questions.length),
    annotationIncompleteGroups,
    status: !complete ? 'incomplete' : exactMetric.rate >= 0.9 && toleranceMetric.rate === 1 ? 'pass' : 'fail',
  };
}

export function calculateTeacherAiGradingAnnotationQualityMetrics(
  expectedSamples: readonly TeacherAiGradingExpectedSample[],
  executions: readonly TeacherAiGradingExecutionResult[],
  blindItems: readonly TeacherAiGradingBlindAnnotationItem[],
  judgments: readonly TeacherAiGradingAnnotationJudgment[],
): TeacherAiGradingAnnotationQualityMetrics {
  const itemIds = uniqueMap(blindItems, (item) => item.annotationId, 'teacher-ai-grading-annotation-item-duplicate');
  const judgmentMap = uniqueMap(judgments, (item) => item.annotationId, 'teacher-ai-grading-annotation-judgment-duplicate');
  const actualBlindItems = uniqueMap(
    toTeacherAiGradingBlindAnnotationDto(executions.filter((execution) => execution.status === 'succeeded')),
    (item) => item.annotationId,
    'teacher-ai-grading-execution-annotation-duplicate',
  );
  if ([...itemIds].some(([annotationId, declared]) => {
    const actual = actualBlindItems.get(annotationId);
    return !actual || JSON.stringify(actual) !== JSON.stringify(declared);
  })) {
    throw new Error('teacher-ai-grading-blind-annotation-set-invalid');
  }
  const blindSetComplete = actualBlindItems.size === itemIds.size && [...actualBlindItems].every(([annotationId, actual]) => {
    const declared = itemIds.get(annotationId);
    return declared !== undefined && JSON.stringify(actual) === JSON.stringify(declared);
  });
  for (const annotationId of judgmentMap.keys()) {
    if (!actualBlindItems.has(annotationId)) throw new Error('teacher-ai-grading-annotation-judgment-unexpected');
  }
  let location = 0;
  let reason = 0;
  let suggestion = 0;
  let seriouslyMisleading = 0;
  let judgedCount = 0;
  let complete = blindSetComplete;
  for (const item of actualBlindItems.values()) {
    const judgment = judgmentMap.get(item.annotationId);
    if (!itemIds.has(item.annotationId) || !judgment
      || judgment.locationCorrect === undefined || judgment.reasonCorrect === undefined
      || judgment.suggestionCorrect === undefined || judgment.seriouslyMisleading === undefined) {
      complete = false;
      continue;
    }
    judgedCount += 1;
    if (judgment.locationCorrect) location += 1;
    if (judgment.reasonCorrect) reason += 1;
    if (judgment.suggestionCorrect) suggestion += 1;
    if (judgment.seriouslyMisleading) seriouslyMisleading += 1;
  }
  const coverageAvailable = expectedSamples.every((sample) => sample.questions.every((question) => question.expectedDeductionIds !== undefined));
  const expectedCoverage = new Set(expectedSamples.flatMap((sample) => sample.questions.flatMap((question) =>
    (question.expectedDeductionIds ?? []).map((deductionId) => `${sample.sampleId}\u0000${question.questionId}\u0000${deductionId}`))));
  const observedCoverage = new Set(executions.flatMap((execution) => (execution.annotations ?? []).flatMap((annotation) =>
    annotation.deductionId ? [`${execution.sampleId}\u0000${execution.questionId}\u0000${annotation.deductionId}`] : [])));
  const covered = [...expectedCoverage].filter((identity) => observedCoverage.has(identity)).length;
  const denominator = actualBlindItems.size;
  const metrics = {
    location: rate(location, denominator),
    reason: rate(reason, denominator),
    suggestion: rate(suggestion, denominator),
  };
  const thresholdsPass = metrics.location.rate >= 0.95 && metrics.reason.rate >= 0.9
    && metrics.suggestion.rate >= 0.85 && seriouslyMisleading === 0;
  return {
    ...metrics,
    seriouslyMisleadingCount: seriouslyMisleading,
    judgedCount,
    expectedCount: denominator,
    coverage: coverageAvailable ? rate(covered, expectedCoverage.size) : null,
    coverageAvailable,
    status: !complete || !coverageAvailable ? 'incomplete' : thresholdsPass ? 'pass' : 'fail',
  };
}

export function calculateTeacherAiGradingProcessingMetrics(
  input: Pick<TeacherAiGradingPartitionMetricsInput,
    'expectedSamples' | 'executions' | 'conversions' | 'sampleDurations' | 'batchWallClockMs' | 'pricingVersion'>,
): TeacherAiGradingProcessingMetrics {
  const expectedSampleIds = new Set(input.expectedSamples.map((sample) => sample.sampleId));
  const expectedQuestions = input.expectedSamples.flatMap((sample) => sample.questions.map((question) => ({
    sampleId: sample.sampleId,
    questionId: question.questionId,
  })));
  const expectedQuestionKeys = new Set(expectedQuestions.map(conversionKey));
  const expected = expandExpectedExecutions(input.expectedSamples);
  const conversions = uniqueMap(input.conversions, conversionKey, 'teacher-ai-grading-conversion-duplicate');
  const executionMap = indexExpectedExecutions(expected, input.executions);
  for (const key of conversions.keys()) {
    if (!expectedQuestionKeys.has(key)) throw new Error('teacher-ai-grading-conversion-unexpected');
  }
  const conversionSuccesses = expectedQuestions.filter((question) => conversions.get(conversionKey(question))?.status === 'succeeded').length;
  const conversionTelemetryComplete = expectedQuestions.every((question) => {
    const conversion = conversions.get(conversionKey(question));
    if (!conversion) return false;
    assertNonNegativeInteger(conversion.durationMs, 'teacher-ai-grading-conversion-duration-invalid');
    return conversion.telemetryComplete && Boolean(conversion.stage.trim())
      && Boolean(conversion.conversionVersion.trim()) && Boolean(conversion.sourceHash.trim());
  });
  let aiSuccesses = 0;
  for (const sample of input.expectedSamples) {
    for (const repetitionOrdinal of [1, 2, 3] as const) {
      if (sample.questions.every((question) => executionMap.get(executionKey({ ...question, sampleId: sample.sampleId, repetitionOrdinal }))?.status === 'succeeded')) {
        aiSuccesses += 1;
      }
    }
  }
  let providerCallCount = 0;
  let retryCount = 0;
  let estimatedCostMicros = BigInt(0);
  let inputTokens = 0;
  let outputTokens = 0;
  let cumulativeProviderDurationMs = 0;
  let providerTelemetryComplete = true;
  for (const item of expected) {
    const execution = executionMap.get(executionKey(item));
    if (!execution) {
      providerTelemetryComplete = false;
      continue;
    }
    const calls = execution.providerCalls ?? [];
    if (execution.status === 'succeeded' && calls.length === 0) providerTelemetryComplete = false;
    if (execution.status === 'failed' && calls.length === 0
      && !(execution.providerStage === 'not_reached' && execution.providerTelemetryComplete === true)) {
      providerTelemetryComplete = false;
    }
    providerCallCount += calls.length;
    retryCount += Math.max(0, calls.length - 1);
    const callIdentities = new Set<string>();
    for (const call of calls) {
      assertPositiveInteger(call.attemptOrdinal, 'teacher-ai-grading-provider-attempt-invalid');
      assertPositiveInteger(call.callOrdinal, 'teacher-ai-grading-provider-call-invalid');
      const callIdentity = `${call.attemptOrdinal}\u0000${call.callOrdinal}`;
      if (callIdentities.has(callIdentity)) throw new Error('teacher-ai-grading-provider-call-duplicate');
      callIdentities.add(callIdentity);
      assertNonNegativeInteger(call.durationMs, 'teacher-ai-grading-provider-duration-invalid');
      cumulativeProviderDurationMs = addSafeIntegers(
        cumulativeProviderDurationMs,
        call.durationMs,
        'teacher-ai-grading-provider-duration-total-invalid',
      );
      if (call.inputTokens !== null) {
        assertNonNegativeInteger(call.inputTokens, 'teacher-ai-grading-provider-input-tokens-invalid');
        inputTokens = addSafeIntegers(inputTokens, call.inputTokens, 'teacher-ai-grading-provider-input-token-total-invalid');
      }
      if (call.outputTokens !== null) {
        assertNonNegativeInteger(call.outputTokens, 'teacher-ai-grading-provider-output-tokens-invalid');
        outputTokens = addSafeIntegers(outputTokens, call.outputTokens, 'teacher-ai-grading-provider-output-token-total-invalid');
      }
      if (call.pricingVersion !== null && call.pricingVersion !== input.pricingVersion) {
        throw new Error('teacher-ai-grading-pricing-version-mismatch');
      }
      if (call.estimatedCostMicros !== null) {
        const cost = parseNonNegativeBigInt(call.estimatedCostMicros, 'teacher-ai-grading-provider-cost-invalid');
        estimatedCostMicros += cost;
      }
      if (!call.telemetryComplete || call.inputTokens === null || call.outputTokens === null
        || call.estimatedCostMicros === null || call.pricingVersion === null) {
        providerTelemetryComplete = false;
      }
    }
  }
  const durations = [...input.sampleDurations].sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  const durationMap = uniqueMap(durations, (item) => item.sampleId, 'teacher-ai-grading-sample-duration-duplicate');
  for (const duration of durations) {
    if (!expectedSampleIds.has(duration.sampleId)) throw new Error('teacher-ai-grading-sample-duration-unexpected');
    assertNonNegativeInteger(duration.durationMs, 'teacher-ai-grading-sample-duration-invalid');
  }
  if (input.batchWallClockMs !== undefined) assertNonNegativeInteger(input.batchWallClockMs, 'teacher-ai-grading-batch-duration-invalid');
  const timingComplete = input.batchWallClockMs !== undefined && [...expectedSampleIds].every((sampleId) => durationMap.has(sampleId));
  const conversion = rate(conversionSuccesses, expectedQuestions.length);
  const aiSampleRepetitions = rate(aiSuccesses, expectedSampleIds.size * 3);
  const ratesPass = conversion.rate >= 0.95 && aiSampleRepetitions.rate >= 0.95;
  return {
    conversion,
    aiSampleRepetitions,
    providerCallCount,
    retryCount,
    inputTokens: providerTelemetryComplete ? inputTokens : null,
    outputTokens: providerTelemetryComplete ? outputTokens : null,
    estimatedCostMicros: providerTelemetryComplete ? estimatedCostMicros.toString() : null,
    pricingVersion: input.pricingVersion,
    conversionTelemetryComplete,
    providerTelemetryComplete,
    timing: {
      perSampleDurationMs: durations,
      meanSampleDurationMs: durations.length === 0
        ? null
        : durations.reduce((total, item) => total + item.durationMs, 0) / durations.length,
      batchWallClockMs: input.batchWallClockMs ?? null,
      cumulativeProviderDurationMs,
      complete: timingComplete,
    },
    status: !timingComplete || !conversionTelemetryComplete || !providerTelemetryComplete
      ? 'incomplete'
      : ratesPass ? 'pass' : 'fail',
  };
}

export function toTeacherAiGradingBlindAnnotationDto(
  executions: readonly TeacherAiGradingExecutionResult[],
): TeacherAiGradingBlindAnnotationItem[] {
  return executions.flatMap((execution) => (execution.annotations ?? []).map((annotation) => ({
    annotationId: annotation.annotationId,
    sampleId: execution.sampleId,
    questionId: execution.questionId,
    criterionId: annotation.criterionId,
    issueIdentity: annotation.issueIdentity,
    evidenceIdentity: annotation.evidenceIdentity,
  }))).sort((left, right) => left.annotationId.localeCompare(right.annotationId));
}

function assertPartitionInput(input: TeacherAiGradingPartitionMetricsInput): void {
  if (input.partition === 'tuning' && input.visibility === 'sealed') throw new Error('teacher-ai-grading-tuning-cannot-be-sealed');
  if (input.partition === 'tuning' && input.pdfVerificationStatus !== 'not_applicable') {
    throw new Error('teacher-ai-grading-tuning-pdf-status-invalid');
  }
  if (input.partition === 'hidden' && input.pdfVerificationStatus === 'not_applicable') {
    throw new Error('teacher-ai-grading-hidden-pdf-status-invalid');
  }
  for (const value of [input.metricVersion, input.configurationContentHash, input.pricingVersion]) {
    if (!value.trim()) throw new Error('teacher-ai-grading-frozen-context-missing');
  }
  expandExpectedExecutions(input.expectedSamples);
}

function expandExpectedExecutions(expectedSamples: readonly TeacherAiGradingExpectedSample[]): ExpectedExecution[] {
  if (expectedSamples.length === 0) throw new Error('teacher-ai-grading-expected-samples-empty');
  const sampleMap = uniqueMap(expectedSamples, (sample) => sample.sampleId, 'teacher-ai-grading-expected-sample-duplicate');
  const result: ExpectedExecution[] = [];
  for (const sample of sampleMap.values()) {
    if (sample.questions.length === 0) throw new Error('teacher-ai-grading-expected-questions-empty');
    const questions = uniqueMap(sample.questions, (question) => question.questionId, 'teacher-ai-grading-expected-question-duplicate');
    for (const question of questions.values()) {
      assertScore(question.maxScore, 'teacher-ai-grading-max-score-invalid');
      assertScore(question.teacherScore, 'teacher-ai-grading-teacher-score-invalid');
      if (question.maxScore <= 0 || question.teacherScore > question.maxScore) throw new Error('teacher-ai-grading-score-range-invalid');
      for (const repetitionOrdinal of [1, 2, 3] as const) result.push({ ...question, sampleId: sample.sampleId, repetitionOrdinal });
    }
  }
  return result;
}

function indexExpectedExecutions(
  expected: readonly ExpectedExecution[],
  executions: readonly TeacherAiGradingExecutionResult[],
): Map<string, TeacherAiGradingExecutionResult> {
  const expectedMap = new Map(expected.map((item) => [executionKey(item), item]));
  const result = uniqueMap<TeacherAiGradingExecutionResult>(
    executions,
    executionKey,
    'teacher-ai-grading-execution-duplicate',
  );
  for (const execution of result.values()) {
    if (execution.sourceKind === 'publication-candidate') throw new Error('teacher-ai-grading-publication-candidate-metrics-forbidden');
    const expectedExecution = expectedMap.get(executionKey(execution));
    if (!expectedExecution) throw new Error('teacher-ai-grading-execution-unexpected');
    if (execution.score !== undefined) assertScore(execution.score, 'teacher-ai-grading-execution-score-invalid');
    if (execution.score !== undefined && execution.score > expectedExecution.maxScore) {
      throw new Error('teacher-ai-grading-execution-score-out-of-range');
    }
  }
  return result;
}

function executionKey(value: { sampleId: string; questionId: string; repetitionOrdinal: number }): string {
  return `${value.sampleId}\u0000${value.questionId}\u0000${value.repetitionOrdinal}`;
}

function conversionKey(value: { sampleId: string; questionId: string }): string {
  return `${value.sampleId}\u0000${value.questionId}`;
}

function isScoredExecution(execution: TeacherAiGradingExecutionResult | undefined): execution is TeacherAiGradingExecutionResult & { score: number } {
  return execution?.status === 'succeeded' && execution.score !== undefined;
}

function annotationIdentitySet(annotations: readonly TeacherAiGradingAnnotationIdentity[]): Set<string> {
  return new Set(annotations.map((annotation) =>
    `${annotation.criterionId}\u0000${annotation.issueIdentity}\u0000${annotation.evidenceIdentity}`));
}

function sameStringSets(sets: readonly Set<string>[]): boolean {
  if (sets.length < 2) return true;
  return sets.slice(1).every((candidate) => candidate.size === sets[0].size
    && [...sets[0]].every((value) => candidate.has(value)));
}

function rate(numerator: number, denominator: number): TeacherAiGradingRateMetric {
  return { numerator, denominator, rate: denominator === 0 ? 0 : numerator / denominator };
}

function uniqueMap<Item>(items: readonly Item[], key: (item: Item) => string, errorCode: string): Map<string, Item> {
  const result = new Map<string, Item>();
  for (const item of items) {
    const identity = key(item);
    if (!identity) throw new Error(`${errorCode}-identity-missing`);
    if (result.has(identity)) throw new Error(errorCode);
    result.set(identity, item);
  }
  return result;
}

function assertScore(value: number, errorCode: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(errorCode);
}

function assertNonNegativeInteger(value: number, errorCode: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
}

function assertPositiveInteger(value: number, errorCode: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(errorCode);
}

function parseNonNegativeBigInt(value: string, errorCode: string): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < BigInt(0)) throw new Error(errorCode);
    return parsed;
  } catch {
    throw new Error(errorCode);
  }
}

function addSafeIntegers(left: number, right: number, errorCode: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(errorCode);
  return result;
}

function hashPartitionReport(report: Omit<TeacherAiGradingPartitionReport, 'contentHash'>): TeacherAiGradingPartitionReport {
  return { ...report, contentHash: hashJson(report) };
}

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

import { createHash } from 'node:crypto';

export const TEACHER_AI_GRADING_CONTROLLED_VISUAL_EXPERIMENT_VERSION = 'teacher-ai-grading-controlled-visual-experiment.v1' as const;

export type TeacherAiGradingEvidenceChain = 'text-only' | 'visual-evidence';
export type TeacherAiGradingVisualEvidenceStatus = 'complete' | 'incomplete' | 'not-applicable';

export interface TeacherAiGradingQualityThresholds {
  maximumMeanAbsoluteError?: number;
  maximumAbsoluteMeanBias?: number;
  maximumNormalizedMeanAbsoluteError?: number;
  maximumAbsoluteNormalizedMeanBias?: number;
  minimumExactRate: number;
  minimumWithinTenPercentRate: number;
  minimumExactStabilityRate: number;
  minimumToleranceStabilityRate: number;
  minimumVisualEvidenceCompletenessRate: number;
  minimumProcessingSuccessRate: number;
  minimumConversionSuccessRate?: number;
  minimumBlindFaithfulnessRate: number;
  minimumBlindScoringSufficiencyRate: number;
  maximumBlindMisattributionRate: number;
}

export interface TeacherAiGradingVisualExperimentProcessor {
  id: string;
  version: string;
  contentHash: string;
  evidenceChain: TeacherAiGradingEvidenceChain;
  visualEvidenceContractVersion?: string;
  visualPolicy?: FrozenComponent;
}

export interface TeacherAiGradingControlledQuestionStratum {
  sampleId: string;
  questionId: string;
  questionType: string;
  hasVisualEvidence: boolean;
}

export interface TeacherAiGradingControlledVisualExperimentPlan {
  schemaVersion: typeof TEACHER_AI_GRADING_CONTROLLED_VISUAL_EXPERIMENT_VERSION;
  experimentId: string;
  partition: 'tuning';
  dataset: FrozenComponent;
  split: FrozenComponent;
  prompt: FrozenComponent;
  model: FrozenModelComponent;
  rubric: FrozenComponent;
  seed: number;
  maxAttempts?: number;
  baselineProcessor: TeacherAiGradingVisualExperimentProcessor;
  candidateProcessor: TeacherAiGradingVisualExperimentProcessor;
  strata: readonly TeacherAiGradingControlledQuestionStratum[];
  thresholds: TeacherAiGradingQualityThresholds;
  contentHash: string;
}

export interface TeacherAiGradingControlledExpectedQuestion extends TeacherAiGradingControlledQuestionStratum {
  maxScore: number;
  teacherScore: number;
}

export interface TeacherAiGradingControlledExecution {
  sampleId: string;
  questionId: string;
  repetitionOrdinal: 1 | 2 | 3;
  status: 'succeeded' | 'failed';
  score?: number;
}

export interface TeacherAiGradingControlledConversion {
  sampleId: string;
  questionId: string;
  status: 'succeeded' | 'failed';
  visualEvidenceStatus: TeacherAiGradingVisualEvidenceStatus;
}

export interface TeacherAiGradingBlindVisualEvidenceItem {
  evidenceId: string;
  sampleId: string;
  questionId: string;
}

export interface TeacherAiGradingBlindVisualEvidenceJudgment {
  evidenceId: string;
  faithful?: boolean;
  sufficientForScoring?: boolean;
  misattributed?: boolean;
}

export interface TeacherAiGradingControlledStratumMetrics {
  questionCount: number;
  executionCount: number;
  meanAbsoluteError: number | null;
  meanBias: number | null;
  normalizedMeanAbsoluteError: number | null;
  normalizedMeanBias: number | null;
  exactRate: number;
  withinTenPercentRate: number;
  scoreVariance: number | null;
  completeThreeRunRate: number;
  exactStabilityRate: number;
  toleranceStabilityRate: number;
  processingSuccessRate: number;
  conversionSuccessRate: number;
  visualEvidenceCompletenessRate: number | null;
}

export interface TeacherAiGradingControlledBlindReviewMetrics {
  expectedCount: number;
  judgedCount: number;
  faithfulRate: number | null;
  scoringSufficiencyRate: number | null;
  misattributionRate: number | null;
  complete: boolean;
}

export interface TeacherAiGradingControlledVisualExperimentReport {
  experimentId: string;
  evidenceChain: TeacherAiGradingEvidenceChain;
  evaluationRunId: string;
  strata: Record<string, TeacherAiGradingControlledStratumMetrics>;
  blindReview: TeacherAiGradingControlledBlindReviewMetrics;
  status: 'pass' | 'fail' | 'incomplete';
  contentHash: string;
}

interface FrozenComponent {
  id: string;
  version: string;
  contentHash: string;
}

interface FrozenModelComponent extends FrozenComponent {
  parameters: Record<string, unknown>;
}

export function freezeTeacherAiGradingControlledVisualExperiment(input: Omit<TeacherAiGradingControlledVisualExperimentPlan, 'schemaVersion' | 'contentHash' | 'maxAttempts'> & { maxAttempts?: number }): TeacherAiGradingControlledVisualExperimentPlan {
  assertToken(input.experimentId, 'teacher-ai-grading-controlled-experiment-id-missing');
  if (input.partition !== 'tuning') throw new Error('teacher-ai-grading-controlled-experiment-hidden-forbidden');
  assertComponent(input.dataset, 'dataset');
  assertComponent(input.split, 'split');
  assertComponent(input.prompt, 'prompt');
  assertComponent(input.model, 'model');
  assertComponent(input.rubric, 'rubric');
  if (!Number.isInteger(input.seed)) throw new Error('teacher-ai-grading-controlled-experiment-seed-invalid');
  const maxAttempts = input.maxAttempts;
  if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) throw new Error('teacher-ai-grading-controlled-experiment-max-attempts-invalid');
  assertProcessor(input.baselineProcessor, 'text-only');
  assertProcessor(input.candidateProcessor, 'visual-evidence');
  if (input.baselineProcessor.id === input.candidateProcessor.id && input.baselineProcessor.version === input.candidateProcessor.version) {
    throw new Error('teacher-ai-grading-controlled-experiment-processor-not-distinct');
  }
  assertThresholds(input.thresholds);
  const plan = {
    schemaVersion: TEACHER_AI_GRADING_CONTROLLED_VISUAL_EXPERIMENT_VERSION,
    experimentId: input.experimentId.trim(),
    partition: 'tuning' as const,
    dataset: canonicalComponent(input.dataset),
    split: canonicalComponent(input.split),
    prompt: canonicalComponent(input.prompt),
    model: { ...canonicalComponent(input.model), parameters: canonicalize(input.model.parameters) as Record<string, unknown> },
    rubric: canonicalComponent(input.rubric),
    seed: input.seed,
    ...(maxAttempts === undefined ? {} : { maxAttempts }),
    baselineProcessor: canonicalProcessor(input.baselineProcessor),
    candidateProcessor: canonicalProcessor(input.candidateProcessor),
    strata: canonicalStrata(input.strata),
    thresholds: canonicalThresholds(input.thresholds),
  };
  return { ...plan, contentHash: hashJson(plan) };
}

function canonicalStrata(input: readonly TeacherAiGradingControlledQuestionStratum[]): TeacherAiGradingControlledQuestionStratum[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('teacher-ai-grading-controlled-experiment-strata-missing');
  const seen = new Set<string>();
  const strata = input.map((stratum) => {
    assertToken(stratum.sampleId, 'teacher-ai-grading-controlled-stratum-sample-missing');
    assertToken(stratum.questionId, 'teacher-ai-grading-controlled-stratum-question-missing');
    assertToken(stratum.questionType, 'teacher-ai-grading-controlled-stratum-type-missing');
    if (typeof stratum.hasVisualEvidence !== 'boolean') throw new Error('teacher-ai-grading-controlled-stratum-visual-invalid');
    const normalized = {
      sampleId: stratum.sampleId.trim(),
      questionId: stratum.questionId.trim(),
      questionType: stratum.questionType.trim(),
      hasVisualEvidence: stratum.hasVisualEvidence,
    };
    const key = `${normalized.sampleId}\u0000${normalized.questionId}`;
    if (seen.has(key)) throw new Error('teacher-ai-grading-controlled-experiment-stratum-duplicate');
    seen.add(key);
    return normalized;
  });
  return strata.sort((left, right) => `${left.sampleId}\u0000${left.questionId}`.localeCompare(`${right.sampleId}\u0000${right.questionId}`));
}

export function buildTeacherAiGradingControlledVisualExperimentReport(input: {
  plan: TeacherAiGradingControlledVisualExperimentPlan;
  evidenceChain: TeacherAiGradingEvidenceChain;
  evaluationRunId: string;
  expectedQuestions: readonly TeacherAiGradingControlledExpectedQuestion[];
  executions: readonly TeacherAiGradingControlledExecution[];
  conversions: readonly TeacherAiGradingControlledConversion[];
  blindItems: readonly TeacherAiGradingBlindVisualEvidenceItem[];
  blindJudgments: readonly TeacherAiGradingBlindVisualEvidenceJudgment[];
}): TeacherAiGradingControlledVisualExperimentReport {
  const plan = assertPlan(input.plan);
  assertToken(input.evaluationRunId, 'teacher-ai-grading-controlled-evaluation-run-id-missing');
  const expected = expectedQuestionsWithFrozenStrata(plan, input.expectedQuestions);
  const expectedByQuestion = indexExpectedQuestions(expected);
  const executions = indexExecutions(input.executions, expectedByQuestion);
  const conversions = indexConversions(input.conversions, expectedByQuestion);
  const strata = buildStrata(expected);
  const reportStrata = Object.fromEntries([...strata.entries()].map(([key, questions]) => [
    key,
    calculateStratumMetrics(questions, executions, conversions),
  ]));
  const blindReview = calculateBlindReview(input.blindItems, input.blindJudgments, expected);
  const status = controlledExperimentStatus({ plan, evidenceChain: input.evidenceChain, all: reportStrata.all, blindReview });
  const body = { experimentId: plan.experimentId, evidenceChain: input.evidenceChain, evaluationRunId: input.evaluationRunId, strata: reportStrata, blindReview, status };
  return { ...body, contentHash: hashJson(body) };
}

function calculateStratumMetrics(
  questions: readonly TeacherAiGradingControlledExpectedQuestion[],
  executions: ReadonlyMap<string, TeacherAiGradingControlledExecution>,
  conversions: ReadonlyMap<string, TeacherAiGradingControlledConversion>,
): TeacherAiGradingControlledStratumMetrics {
  const allExecutions = questions.flatMap((question) => ([1, 2, 3] as const).map((repetitionOrdinal) => (
    executions.get(executionKey(question.sampleId, question.questionId, repetitionOrdinal))
  )));
  const scored = allExecutions.filter(isScoredExecution);
  const differences = scored.map((execution) => execution.score! - questionForExecution(questions, execution).teacherScore);
  const normalizedDifferences = scored.map((execution) => {
    const question = questionForExecution(questions, execution);
    return (execution.score! - question.teacherScore) / question.maxScore;
  });
  const exact = differences.filter((difference) => difference === 0).length;
  const withinTenPercent = scored.filter((execution) => (
    Math.abs(execution.score! - questionForExecution(questions, execution).teacherScore)
      <= questionForExecution(questions, execution).maxScore * 0.1
  )).length;
  const groups = questions.map((question) => ([1, 2, 3] as const).map((repetitionOrdinal) => (
    executions.get(executionKey(question.sampleId, question.questionId, repetitionOrdinal))
  )));
  const completeGroups = groups.flatMap((group, index) => group.every(isScoredExecution)
    ? [{ group: group as Array<TeacherAiGradingControlledExecution & { score: number }>, question: questions[index] }]
    : []);
  const variances = completeGroups.map(({ group }) => variance(group.map((execution) => execution.score)));
  const exactStableGroups = completeGroups.filter(({ group }) => scoreRange(group.map((execution) => execution.score)) === 0).length;
  const toleranceStableGroups = completeGroups.filter(({ group, question }) => (
    scoreRange(group.map((execution) => execution.score)) <= question.maxScore * 0.1
  )).length;
  const expectedVisual = questions.filter((question) => question.hasVisualEvidence);
  const completeVisual = expectedVisual.filter((question) => (
    conversions.get(questionKey(question.sampleId, question.questionId))?.visualEvidenceStatus === 'complete'
  )).length;
  const processedQuestions = groups.filter((group) => group.some(isScoredExecution)).length;
  return {
    questionCount: questions.length,
    executionCount: allExecutions.length,
    meanAbsoluteError: differences.length === 0 ? null : differences.reduce((total, difference) => total + Math.abs(difference), 0) / differences.length,
    meanBias: differences.length === 0 ? null : differences.reduce((total, difference) => total + difference, 0) / differences.length,
    normalizedMeanAbsoluteError: normalizedDifferences.length === 0 ? null : normalizedDifferences.reduce((total, difference) => total + Math.abs(difference), 0) / normalizedDifferences.length,
    normalizedMeanBias: normalizedDifferences.length === 0 ? null : normalizedDifferences.reduce((total, difference) => total + difference, 0) / normalizedDifferences.length,
    exactRate: rate(exact, questions.length * 3),
    withinTenPercentRate: rate(withinTenPercent, questions.length * 3),
    scoreVariance: variances.length === 0 ? null : variances.reduce((total, value) => total + value, 0) / variances.length,
    completeThreeRunRate: rate(completeGroups.length, questions.length),
    exactStabilityRate: rate(exactStableGroups, questions.length),
    toleranceStabilityRate: rate(toleranceStableGroups, questions.length),
    processingSuccessRate: rate(processedQuestions, questions.length),
    conversionSuccessRate: rate(questions.filter((question) => conversions.get(questionKey(question.sampleId, question.questionId))?.status === 'succeeded').length, questions.length),
    visualEvidenceCompletenessRate: expectedVisual.length === 0 ? null : rate(completeVisual, expectedVisual.length),
  };
}

function calculateBlindReview(
  items: readonly TeacherAiGradingBlindVisualEvidenceItem[],
  judgments: readonly TeacherAiGradingBlindVisualEvidenceJudgment[],
  expectedQuestions: readonly TeacherAiGradingControlledExpectedQuestion[],
): TeacherAiGradingControlledBlindReviewMetrics {
  const questionKeys = new Set(expectedQuestions.filter((question) => question.hasVisualEvidence).map((question) => questionKey(question.sampleId, question.questionId)));
  const itemMap = new Map<string, TeacherAiGradingBlindVisualEvidenceItem>();
  for (const item of items) {
    assertToken(item.evidenceId, 'teacher-ai-grading-blind-visual-evidence-id-missing');
    if (!questionKeys.has(questionKey(item.sampleId, item.questionId)) || itemMap.has(item.evidenceId)) {
      throw new Error('teacher-ai-grading-blind-visual-item-invalid');
    }
    itemMap.set(item.evidenceId, item);
  }
  const judgmentsByEvidence = new Map<string, TeacherAiGradingBlindVisualEvidenceJudgment>();
  for (const judgment of judgments) {
    if (!itemMap.has(judgment.evidenceId) || judgmentsByEvidence.has(judgment.evidenceId)) {
      throw new Error('teacher-ai-grading-blind-visual-judgment-invalid');
    }
    judgmentsByEvidence.set(judgment.evidenceId, judgment);
  }
  const completeJudgments = [...judgmentsByEvidence.values()].filter((judgment) => (
    judgment.faithful !== undefined && judgment.sufficientForScoring !== undefined && judgment.misattributed !== undefined
  ));
  const denominator = itemMap.size;
  return {
    expectedCount: denominator,
    judgedCount: completeJudgments.length,
    faithfulRate: denominator === 0 ? null : rate(completeJudgments.filter((judgment) => judgment.faithful).length, denominator),
    scoringSufficiencyRate: denominator === 0 ? null : rate(completeJudgments.filter((judgment) => judgment.sufficientForScoring).length, denominator),
    misattributionRate: denominator === 0 ? null : rate(completeJudgments.filter((judgment) => judgment.misattributed).length, denominator),
    complete: completeJudgments.length === denominator,
  };
}

function controlledExperimentStatus(input: {
  plan: TeacherAiGradingControlledVisualExperimentPlan;
  evidenceChain: TeacherAiGradingEvidenceChain;
  all: TeacherAiGradingControlledStratumMetrics;
  blindReview: TeacherAiGradingControlledBlindReviewMetrics;
}): 'pass' | 'fail' | 'incomplete' {
  const { all, blindReview, plan } = input;
  if (input.evidenceChain !== 'visual-evidence') return 'incomplete';
  if (all.meanAbsoluteError === null || all.meanBias === null || all.normalizedMeanAbsoluteError === null || all.normalizedMeanBias === null || all.scoreVariance === null
    || all.visualEvidenceCompletenessRate === null || !blindReview.complete
    || blindReview.faithfulRate === null || blindReview.scoringSufficiencyRate === null || blindReview.misattributionRate === null) {
    return 'incomplete';
  }
  const thresholds = plan.thresholds;
  const usesNormalizedAccuracyThresholds = thresholds.maximumNormalizedMeanAbsoluteError !== undefined
    || thresholds.maximumAbsoluteNormalizedMeanBias !== undefined;
  const scoreAccuracyPasses = usesNormalizedAccuracyThresholds
    ? all.normalizedMeanAbsoluteError <= thresholds.maximumNormalizedMeanAbsoluteError!
      && Math.abs(all.normalizedMeanBias) <= thresholds.maximumAbsoluteNormalizedMeanBias!
    : all.meanAbsoluteError <= thresholds.maximumMeanAbsoluteError!
      && Math.abs(all.meanBias) <= thresholds.maximumAbsoluteMeanBias!;
  const minimumConversionSuccessRate = thresholds.minimumConversionSuccessRate
    ?? thresholds.minimumProcessingSuccessRate;
  return scoreAccuracyPasses
    && all.exactRate >= thresholds.minimumExactRate
    && all.withinTenPercentRate >= thresholds.minimumWithinTenPercentRate
    && all.exactStabilityRate >= thresholds.minimumExactStabilityRate
    && all.toleranceStabilityRate >= thresholds.minimumToleranceStabilityRate
    && all.visualEvidenceCompletenessRate >= thresholds.minimumVisualEvidenceCompletenessRate
    && all.processingSuccessRate >= thresholds.minimumProcessingSuccessRate
    && all.conversionSuccessRate >= minimumConversionSuccessRate
    && blindReview.faithfulRate >= thresholds.minimumBlindFaithfulnessRate
    && blindReview.scoringSufficiencyRate >= thresholds.minimumBlindScoringSufficiencyRate
    && blindReview.misattributionRate <= thresholds.maximumBlindMisattributionRate
    ? 'pass'
    : 'fail';
}

function buildStrata(questions: readonly TeacherAiGradingControlledExpectedQuestion[]): Map<string, TeacherAiGradingControlledExpectedQuestion[]> {
  const strata = new Map<string, TeacherAiGradingControlledExpectedQuestion[]>();
  for (const question of questions) {
    for (const key of ['all', `question:${question.questionId}`, `type:${question.questionType}`, question.hasVisualEvidence ? 'visual:yes' : 'visual:no']) {
      strata.set(key, [...(strata.get(key) ?? []), question]);
    }
  }
  return strata;
}

function assertPlan(plan: TeacherAiGradingControlledVisualExperimentPlan): TeacherAiGradingControlledVisualExperimentPlan {
  const frozen = freezeTeacherAiGradingControlledVisualExperiment(plan);
  if (frozen.contentHash !== plan.contentHash) throw new Error('teacher-ai-grading-controlled-experiment-plan-drift');
  return frozen;
}

function indexExpectedQuestions(questions: readonly TeacherAiGradingControlledExpectedQuestion[]): Map<string, TeacherAiGradingControlledExpectedQuestion> {
  const result = new Map<string, TeacherAiGradingControlledExpectedQuestion>();
  for (const question of questions) {
    assertToken(question.sampleId, 'teacher-ai-grading-controlled-sample-id-missing');
    assertToken(question.questionId, 'teacher-ai-grading-controlled-question-id-missing');
    assertToken(question.questionType, 'teacher-ai-grading-controlled-question-type-missing');
    if (!Number.isFinite(question.maxScore) || question.maxScore <= 0 || !Number.isFinite(question.teacherScore)) {
      throw new Error('teacher-ai-grading-controlled-score-invalid');
    }
    const key = questionKey(question.sampleId, question.questionId);
    if (result.has(key)) throw new Error('teacher-ai-grading-controlled-question-duplicate');
    result.set(key, question);
  }
  return result;
}

function expectedQuestionsWithFrozenStrata(
  plan: TeacherAiGradingControlledVisualExperimentPlan,
  questions: readonly TeacherAiGradingControlledExpectedQuestion[],
): TeacherAiGradingControlledExpectedQuestion[] {
  const expectedByQuestion = indexExpectedQuestions(questions);
  if (expectedByQuestion.size !== plan.strata.length) throw new Error('teacher-ai-grading-controlled-experiment-strata-set-mismatch');
  return plan.strata.map((stratum) => {
    const expected = expectedByQuestion.get(questionKey(stratum.sampleId, stratum.questionId));
    if (!expected) throw new Error('teacher-ai-grading-controlled-experiment-strata-set-mismatch');
    return { ...expected, questionType: stratum.questionType, hasVisualEvidence: stratum.hasVisualEvidence };
  });
}

function indexExecutions(
  executions: readonly TeacherAiGradingControlledExecution[],
  expected: ReadonlyMap<string, TeacherAiGradingControlledExpectedQuestion>,
): Map<string, TeacherAiGradingControlledExecution> {
  const result = new Map<string, TeacherAiGradingControlledExecution>();
  for (const execution of executions) {
    if (!expected.has(questionKey(execution.sampleId, execution.questionId))) throw new Error('teacher-ai-grading-controlled-execution-unexpected');
    const key = executionKey(execution.sampleId, execution.questionId, execution.repetitionOrdinal);
    if (result.has(key)) throw new Error('teacher-ai-grading-controlled-execution-duplicate');
    result.set(key, execution);
  }
  return result;
}

function indexConversions(
  conversions: readonly TeacherAiGradingControlledConversion[],
  expected: ReadonlyMap<string, TeacherAiGradingControlledExpectedQuestion>,
): Map<string, TeacherAiGradingControlledConversion> {
  const result = new Map<string, TeacherAiGradingControlledConversion>();
  for (const conversion of conversions) {
    const key = questionKey(conversion.sampleId, conversion.questionId);
    if (!expected.has(key) || result.has(key)) throw new Error('teacher-ai-grading-controlled-conversion-invalid');
    result.set(key, conversion);
  }
  return result;
}

function questionForExecution(
  questions: readonly TeacherAiGradingControlledExpectedQuestion[],
  execution: TeacherAiGradingControlledExecution,
): TeacherAiGradingControlledExpectedQuestion {
  return questions.find((question) => question.sampleId === execution.sampleId && question.questionId === execution.questionId)!;
}

function isScoredExecution(execution: TeacherAiGradingControlledExecution | undefined): execution is TeacherAiGradingControlledExecution & { score: number } {
  return execution?.status === 'succeeded' && Number.isFinite(execution.score);
}

function variance(values: readonly number[]): number {
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
}

function scoreRange(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function questionKey(sampleId: string, questionId: string): string {
  return `${sampleId}\u0000${questionId}`;
}

function executionKey(sampleId: string, questionId: string, repetitionOrdinal: number): string {
  if (![1, 2, 3].includes(repetitionOrdinal)) throw new Error('teacher-ai-grading-controlled-repetition-invalid');
  return `${questionKey(sampleId, questionId)}\u0000${repetitionOrdinal}`;
}

function assertProcessor(processor: TeacherAiGradingVisualExperimentProcessor, expectedEvidenceChain: TeacherAiGradingEvidenceChain): void {
  assertComponent(processor, 'processor');
  if (processor.evidenceChain !== expectedEvidenceChain) throw new Error('teacher-ai-grading-controlled-processor-chain-invalid');
  if (expectedEvidenceChain === 'visual-evidence') {
    assertToken(processor.visualEvidenceContractVersion ?? '', 'teacher-ai-grading-controlled-visual-contract-missing');
    if (!processor.visualPolicy) throw new Error('teacher-ai-grading-controlled-visual-policy-missing');
    assertComponent(processor.visualPolicy, 'visual-policy');
  }
}

function assertThresholds(thresholds: TeacherAiGradingQualityThresholds): void {
  const hasRawAccuracyThresholds = thresholds.maximumMeanAbsoluteError !== undefined || thresholds.maximumAbsoluteMeanBias !== undefined;
  const hasNormalizedAccuracyThresholds = thresholds.maximumNormalizedMeanAbsoluteError !== undefined || thresholds.maximumAbsoluteNormalizedMeanBias !== undefined;
  if (hasRawAccuracyThresholds === hasNormalizedAccuracyThresholds
    || hasRawAccuracyThresholds && (!Number.isFinite(thresholds.maximumMeanAbsoluteError) || thresholds.maximumMeanAbsoluteError! < 0
      || !Number.isFinite(thresholds.maximumAbsoluteMeanBias) || thresholds.maximumAbsoluteMeanBias! < 0)
    || hasNormalizedAccuracyThresholds && (!Number.isFinite(thresholds.maximumNormalizedMeanAbsoluteError) || thresholds.maximumNormalizedMeanAbsoluteError! < 0
      || thresholds.maximumNormalizedMeanAbsoluteError! > 1
      || !Number.isFinite(thresholds.maximumAbsoluteNormalizedMeanBias) || thresholds.maximumAbsoluteNormalizedMeanBias! < 0
      || thresholds.maximumAbsoluteNormalizedMeanBias! > 1)) {
    throw new Error('teacher-ai-grading-controlled-error-threshold-invalid');
  }
  for (const value of [
    thresholds.minimumExactRate,
    thresholds.minimumWithinTenPercentRate,
    thresholds.minimumExactStabilityRate,
    thresholds.minimumToleranceStabilityRate,
    thresholds.minimumVisualEvidenceCompletenessRate,
    thresholds.minimumProcessingSuccessRate,
    ...(thresholds.minimumConversionSuccessRate === undefined ? [] : [thresholds.minimumConversionSuccessRate]),
    thresholds.minimumBlindFaithfulnessRate,
    thresholds.minimumBlindScoringSufficiencyRate,
    thresholds.maximumBlindMisattributionRate,
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('teacher-ai-grading-controlled-rate-threshold-invalid');
  }
}

function assertComponent(component: FrozenComponent, name: string): void {
  assertToken(component.id, `teacher-ai-grading-controlled-${name}-id-missing`);
  assertToken(component.version, `teacher-ai-grading-controlled-${name}-version-missing`);
  assertToken(component.contentHash, `teacher-ai-grading-controlled-${name}-hash-missing`);
}

function assertToken(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code);
}

function canonicalComponent(component: FrozenComponent): FrozenComponent {
  return { id: component.id.trim(), version: component.version.trim(), contentHash: component.contentHash.trim() };
}

function canonicalProcessor(processor: TeacherAiGradingVisualExperimentProcessor): TeacherAiGradingVisualExperimentProcessor {
  return {
    ...canonicalComponent(processor),
    evidenceChain: processor.evidenceChain,
    ...(processor.visualEvidenceContractVersion ? { visualEvidenceContractVersion: processor.visualEvidenceContractVersion.trim() } : {}),
    ...(processor.visualPolicy ? { visualPolicy: canonicalComponent(processor.visualPolicy) } : {}),
  };
}

function canonicalThresholds(thresholds: TeacherAiGradingQualityThresholds): TeacherAiGradingQualityThresholds {
  return { ...thresholds };
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

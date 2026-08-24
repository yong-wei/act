import { describe, expect, it } from 'vitest';

import {
  buildTeacherAiGradingLabReport,
  buildTeacherAiGradingPartitionReport,
  calculateTeacherAiGradingAnnotationQualityMetrics,
  calculateTeacherAiGradingProcessingMetrics,
  calculateTeacherAiGradingScoringMetrics,
  calculateTeacherAiGradingStabilityMetrics,
  toTeacherAiGradingBlindAnnotationDto,
  type TeacherAiGradingExecutionResult,
  type TeacherAiGradingExpectedSample,
  type TeacherAiGradingPartitionMetricsInput,
} from '../teacher-ai-grading-lab-metrics';

function providerCall(overrides: Partial<NonNullable<TeacherAiGradingExecutionResult['providerCalls']>[number]> = {}) {
  return {
    attemptOrdinal: 1,
    callOrdinal: 1,
    status: 'succeeded' as const,
    inputTokens: 10,
    outputTokens: 5,
    durationMs: 100,
    estimatedCostMicros: '25',
    pricingVersion: 'pricing-v1',
    telemetryComplete: true,
    ...overrides,
  };
}

function expectedSamples(count: number): TeacherAiGradingExpectedSample[] {
  return Array.from({ length: count }, (_, index) => ({
    sampleId: `sample-${String(index + 1).padStart(4, '0')}`,
    questions: [{
      questionId: 'T1-1',
      maxScore: 10,
      teacherScore: 8,
      expectedDeductionIds: ['deduction-a', 'deduction-a'],
    }],
  }));
}

function executionsFor(
  samples: readonly TeacherAiGradingExpectedSample[],
  scoreFor: (sampleIndex: number, ordinal: 1 | 2 | 3) => number = () => 8,
): TeacherAiGradingExecutionResult[] {
  return samples.flatMap((sample, sampleIndex) => sample.questions.flatMap((question) =>
    ([1, 2, 3] as const).map((repetitionOrdinal) => ({
      sampleId: sample.sampleId,
      questionId: question.questionId,
      repetitionOrdinal,
      status: 'succeeded' as const,
      score: scoreFor(sampleIndex, repetitionOrdinal),
      annotations: [{
        annotationId: `${sample.sampleId}-${question.questionId}-${repetitionOrdinal}`,
        criterionId: 'criterion-a',
        issueIdentity: 'issue-a',
        evidenceIdentity: 'evidence-a',
        deductionId: 'deduction-a',
      }],
      providerStage: 'called' as const,
      providerTelemetryComplete: true,
      providerCalls: [providerCall()],
    }))));
}

function partitionInput(
  partition: 'tuning' | 'hidden',
  sampleCount = 20,
): TeacherAiGradingPartitionMetricsInput {
  const samples = expectedSamples(sampleCount);
  const executions = executionsFor(samples);
  const blindAnnotationItems = toTeacherAiGradingBlindAnnotationDto(executions);
  return {
    partition,
    visibility: 'revealed',
    metricVersion: 'metrics-v1',
    configurationContentHash: 'sha256:configuration',
    pricingVersion: 'pricing-v1',
    expectedSamples: samples,
    executions,
    conversions: samples.flatMap(({ sampleId, questions }) => questions.map(({ questionId }) => ({
      sampleId,
      questionId,
      status: 'succeeded',
      stage: 'conversion',
      durationMs: 200,
      conversionVersion: 'conversion-v1',
      sourceHash: `sha256:${sampleId}`,
      telemetryComplete: true,
    }))),
    sampleDurations: samples.map(({ sampleId }) => ({ sampleId, durationMs: 500 })),
    batchWallClockMs: 2_000,
    blindAnnotationItems,
    annotationJudgments: blindAnnotationItems.map(({ annotationId }) => ({
      annotationId,
      locationCorrect: true,
      reasonCorrect: true,
      suggestionCorrect: true,
      seriouslyMisleading: false,
    })),
    pdfVerificationStatus: partition === 'tuning' ? 'not_applicable' : 'pending',
  };
}

describe('teacher AI grading scoring metrics', () => {
  it('passes the exact 80% and tolerance 95% boundaries', () => {
    const samples = expectedSamples(20);
    const executions = executionsFor(samples, (sampleIndex) => {
      if (sampleIndex < 16) return 8;
      if (sampleIndex < 19) return 9;
      return 10;
    });

    const result = calculateTeacherAiGradingScoringMetrics(samples, executions);

    expect(result.exact).toEqual({ numerator: 48, denominator: 60, rate: 0.8 });
    expect(result.withinTenPercent).toEqual({ numerator: 57, denominator: 60, rate: 0.95 });
    expect(result.status).toBe('pass');
  });

  it('keeps failed and absent executions in the expected denominator', () => {
    const samples = expectedSamples(1);
    const executions = executionsFor(samples);
    executions[0] = { ...executions[0], status: 'failed', score: undefined };
    executions.pop();

    const result = calculateTeacherAiGradingScoringMetrics(samples, executions);

    expect(result.exact.denominator).toBe(3);
    expect(result.missingOrFailed).toBe(2);
    expect(result.status).toBe('fail');
  });
});

describe('teacher AI grading stability metrics', () => {
  it('passes with 90% exact groups and the remaining group at the 10% maximum-difference boundary', () => {
    const samples = expectedSamples(10);
    const executions = executionsFor(samples, (sampleIndex, ordinal) =>
      sampleIndex === 9 && ordinal === 3 ? 9 : 8);

    const result = calculateTeacherAiGradingStabilityMetrics(samples, executions);

    expect(result.exactGroups).toEqual({ numerator: 9, denominator: 10, rate: 0.9 });
    expect(result.toleranceGroups).toEqual({ numerator: 10, denominator: 10, rate: 1 });
    expect(result.status).toBe('pass');
  });

  it('marks a group incomplete when any ordinal is absent', () => {
    const samples = expectedSamples(1);
    const executions = executionsFor(samples).filter((execution) => execution.repetitionOrdinal !== 2);

    const result = calculateTeacherAiGradingStabilityMetrics(samples, executions);

    expect(result.incompleteGroups).toBe(1);
    expect(result.annotationIncompleteGroups).toBe(1);
    expect(result.status).toBe('incomplete');
  });

  it('compares substantive criterion, issue, and evidence identity instead of annotation wording or IDs', () => {
    const samples = expectedSamples(1);
    const executions = executionsFor(samples).map((execution, index) => ({
      ...execution,
      annotations: [{
        annotationId: `different-wording-${index}`,
        criterionId: 'criterion-a',
        issueIdentity: 'same-issue',
        evidenceIdentity: 'same-evidence',
      }],
    }));

    const result = calculateTeacherAiGradingStabilityMetrics(samples, executions);

    expect(result.annotationSubstantiveStableGroups.rate).toBe(1);
  });
});

describe('teacher AI grading annotation metrics', () => {
  it('passes the 95%, 90%, and 85% boundaries with zero seriously misleading annotations', () => {
    const samples = expectedSamples(1);
    const executions = executionsFor(samples);
    const items = Array.from({ length: 20 }, (_, index) => ({
      annotationId: `annotation-${index}`,
      sampleId: samples[0].sampleId,
      questionId: 'T1-1',
      criterionId: 'criterion-a',
      issueIdentity: `issue-${index}`,
      evidenceIdentity: `evidence-${index}`,
    }));
    const judgments = items.map(({ annotationId }, index) => ({
      annotationId,
      locationCorrect: index < 19,
      reasonCorrect: index < 18,
      suggestionCorrect: index < 17,
      seriouslyMisleading: false,
    }));
    executions[0] = {
      ...executions[0],
      annotations: items.map((item) => ({ ...item, deductionId: 'deduction-a' })),
    };
    executions[1] = { ...executions[1], annotations: [] };
    executions[2] = { ...executions[2], annotations: [] };

    const result = calculateTeacherAiGradingAnnotationQualityMetrics(samples, executions, items, judgments);

    expect(result.location.rate).toBe(0.95);
    expect(result.reason.rate).toBe(0.9);
    expect(result.suggestion.rate).toBe(0.85);
    expect(result.coverage.rate).toBe(1);
    expect(result.status).toBe('pass');
  });

  it('marks partially judged annotations incomplete and reports coverage without a hard coverage gate', () => {
    const samples = expectedSamples(1);
    const executions = executionsFor(samples).map((execution, index) => ({
      ...execution,
      annotations: index === 0 ? [{
        annotationId: 'annotation-1',
        criterionId: 'criterion-a',
        issueIdentity: 'issue-a',
        evidenceIdentity: 'evidence-a',
      }] : [],
    }));
    const items = [{
      annotationId: 'annotation-1',
      sampleId: samples[0].sampleId,
      questionId: 'T1-1',
      criterionId: 'criterion-a',
      issueIdentity: 'issue-a',
      evidenceIdentity: 'evidence-a',
    }];

    const incomplete = calculateTeacherAiGradingAnnotationQualityMetrics(samples, executions, items, [{
      annotationId: 'annotation-1',
      locationCorrect: true,
      reasonCorrect: true,
      seriouslyMisleading: false,
    }]);
    const complete = calculateTeacherAiGradingAnnotationQualityMetrics(samples, executions, items, [{
      annotationId: 'annotation-1',
      locationCorrect: true,
      reasonCorrect: true,
      suggestionCorrect: true,
      seriouslyMisleading: false,
    }]);

    expect(incomplete.status).toBe('incomplete');
    expect(complete.coverage).toEqual({ numerator: 0, denominator: 1, rate: 0 });
    expect(complete.status).toBe('pass');
  });

  it('marks deduction coverage unavailable for a score-only teacher baseline', () => {
    const samples = expectedSamples(1).map((sample) => ({
      ...sample,
      questions: sample.questions.map(({ expectedDeductionIds: _expectedDeductionIds, ...question }) => question),
    }));
    const executions = executionsFor(samples);
    const items = toTeacherAiGradingBlindAnnotationDto(executions);
    const result = calculateTeacherAiGradingAnnotationQualityMetrics(
      samples,
      executions,
      items,
      items.map(({ annotationId }) => ({
        annotationId,
        locationCorrect: true,
        reasonCorrect: true,
        suggestionCorrect: true,
        seriouslyMisleading: false,
      })),
    );

    expect(result.coverageAvailable).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.status).toBe('incomplete');
  });

  it('marks the metric incomplete when an entire AI annotation is omitted from blind evaluation', () => {
    const input = partitionInput('tuning', 1);
    const items = input.blindAnnotationItems.slice(1);
    const judgments = input.annotationJudgments.slice(1);

    const result = calculateTeacherAiGradingAnnotationQualityMetrics(
      input.expectedSamples,
      input.executions,
      items,
      judgments,
    );

    expect(result.expectedCount).toBe(3);
    expect(result.judgedCount).toBe(2);
    expect(result.status).toBe('incomplete');
  });

  it('projects a blind-safe DTO without prompt, model, or repetition fields', () => {
    const dto = toTeacherAiGradingBlindAnnotationDto(executionsFor(expectedSamples(1)));

    expect(Object.keys(dto[0]).sort()).toEqual([
      'annotationId',
      'criterionId',
      'evidenceIdentity',
      'issueIdentity',
      'questionId',
      'sampleId',
    ]);
    expect(JSON.stringify(dto)).not.toMatch(/prompt|model|repetition|ordinal/i);
  });
});

describe('teacher AI grading processing metrics', () => {
  it('uses sample and sample-by-three denominators at the 95% boundary', () => {
    const input = partitionInput('tuning');
    input.conversions = input.conversions.map((conversion, index) => index === 19
      ? { ...conversion, status: 'failed' }
      : conversion);
    input.executions = input.executions.map((execution, index) =>
      index < 3 ? { ...execution, status: 'failed', score: undefined } : execution);

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.conversion).toEqual({ numerator: 19, denominator: 20, rate: 0.95 });
    expect(result.aiSampleRepetitions).toEqual({ numerator: 57, denominator: 60, rate: 0.95 });
    expect(result.status).toBe('pass');
  });

  it('counts question executions only as provider calls and retries without changing expected denominators', () => {
    const input = partitionInput('tuning');
    input.executions = input.executions.map((execution, index) => index === 0
      ? {
          ...execution,
          providerCalls: [
            providerCall({ durationMs: 100, estimatedCostMicros: '25' }),
            providerCall({ callOrdinal: 2, durationMs: 150, estimatedCostMicros: '30' }),
            providerCall({ attemptOrdinal: 2, callOrdinal: 1, durationMs: 200, estimatedCostMicros: '35' }),
          ],
        }
      : execution);

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.aiSampleRepetitions.denominator).toBe(60);
    expect(result.providerCallCount).toBe(62);
    expect(result.retryCount).toBe(2);
    expect(result.estimatedCostMicros).toBe('1565');
    expect(result.timing).toMatchObject({
      batchWallClockMs: 2_000,
      cumulativeProviderDurationMs: 6_350,
      complete: true,
    });
  });

  it('rejects provider cost recorded against a different frozen pricing version', () => {
    const input = partitionInput('tuning');
    input.executions = input.executions.map((execution, index) => index === 0
      ? {
          ...execution,
          providerCalls: [providerCall({ durationMs: 1, estimatedCostMicros: '1', pricingVersion: 'pricing-v2' })],
        }
      : execution);

    expect(() => calculateTeacherAiGradingProcessingMetrics(input))
      .toThrow('teacher-ai-grading-pricing-version-mismatch');
  });

  it('preserves an exact micros total beyond safe number precision', () => {
    const input = partitionInput('tuning');
    input.executions = input.executions.map((execution, index) => ({
      ...execution,
      providerCalls: index < 3 ? [providerCall({
        durationMs: 1,
        estimatedCostMicros: String(Number.MAX_SAFE_INTEGER),
      })] : [providerCall()],
    }));

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.estimatedCostMicros).toBe((BigInt(Number.MAX_SAFE_INTEGER) * BigInt(3)
      + BigInt(25) * BigInt(input.executions.length - 3)).toString());
  });

  it('marks a succeeded execution without a provider call incomplete', () => {
    const input = partitionInput('tuning', 1);
    input.executions = input.executions.map((execution, index) => index === 0
      ? { ...execution, providerCalls: [] }
      : execution);

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.providerCallCount).toBe(2);
    expect(result.providerTelemetryComplete).toBe(false);
    expect(result.estimatedCostMicros).toBeNull();
    expect(result.status).toBe('incomplete');
  });

  it('does not turn unknown token usage or pricing into zero cost', () => {
    const input = partitionInput('tuning', 1);
    input.executions = input.executions.map((execution, index) => index === 0
      ? {
          ...execution,
          providerCalls: [providerCall({
            inputTokens: null,
            outputTokens: null,
            estimatedCostMicros: null,
            pricingVersion: null,
            telemetryComplete: false,
          })],
        }
      : execution);

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.inputTokens).toBeNull();
    expect(result.outputTokens).toBeNull();
    expect(result.estimatedCostMicros).toBeNull();
    expect(result.status).toBe('incomplete');
  });

  it('allows an explicitly complete pre-provider failure to have zero calls', () => {
    const input = partitionInput('tuning', 1);
    input.executions = input.executions.map((execution, index) => index === 0
      ? {
          ...execution,
          status: 'failed' as const,
          score: undefined,
          providerCalls: [],
          providerStage: 'not_reached' as const,
          providerTelemetryComplete: true,
        }
      : execution);

    const result = calculateTeacherAiGradingProcessingMetrics(input);

    expect(result.providerTelemetryComplete).toBe(true);
    expect(result.estimatedCostMicros).toBe('50');
    expect(result.status).toBe('fail');
  });
});

describe('teacher AI grading partition and overall reports', () => {
  it('does not reveal metrics for a sealed hidden partition', () => {
    const input = partitionInput('hidden');
    input.visibility = 'sealed';

    const report = buildTeacherAiGradingPartitionReport(input);

    expect(report.status).toBe('pending_hidden_sealed');
    expect(report.scoring).toBeNull();
    expect(report.processing).toBeNull();
  });

  it('caps an otherwise passing first-round report at pending PDF verification', () => {
    const tuning = buildTeacherAiGradingPartitionReport(partitionInput('tuning'));
    const hidden = buildTeacherAiGradingPartitionReport(partitionInput('hidden'));

    const report = buildTeacherAiGradingLabReport({
      metricVersion: 'metrics-v1',
      configurationContentHash: 'sha256:configuration',
      pricingVersion: 'pricing-v1',
      tuning,
      hidden,
    });

    expect(tuning.status).toBe('pass');
    expect(hidden.status).toBe('pending_pdf_verification');
    expect(report.status).toBe('pending_pdf_verification');
  });

  it('fails when hidden fails even though an illicit pooled calculation would pass', () => {
    const tuningInput = partitionInput('tuning', 100);
    const hiddenInput = partitionInput('hidden', 20);
    hiddenInput.executions = executionsFor(hiddenInput.expectedSamples, (sampleIndex) => sampleIndex < 5 ? 9 : 8);
    hiddenInput.pdfVerificationStatus = 'passed';
    const tuning = buildTeacherAiGradingPartitionReport(tuningInput);
    const hidden = buildTeacherAiGradingPartitionReport(hiddenInput);
    const pooledExact = (tuning.scoring!.exact.numerator + hidden.scoring!.exact.numerator)
      / (tuning.scoring!.exact.denominator + hidden.scoring!.exact.denominator);

    const report = buildTeacherAiGradingLabReport({
      metricVersion: 'metrics-v1',
      configurationContentHash: 'sha256:configuration',
      pricingVersion: 'pricing-v1',
      tuning,
      hidden,
    });

    expect(pooledExact).toBeGreaterThanOrEqual(0.8);
    expect(hidden.scoring!.exact.rate).toBeLessThan(0.8);
    expect(hidden.status).toBe('fail');
    expect(report.status).toBe('fail');
  });

  it('produces a deterministic content hash', () => {
    const first = buildTeacherAiGradingPartitionReport(partitionInput('tuning'));
    const reorderedInput = partitionInput('tuning');
    reorderedInput.executions = [...reorderedInput.executions].reverse();
    reorderedInput.expectedSamples = [...reorderedInput.expectedSamples].reverse();
    reorderedInput.conversions = [...reorderedInput.conversions].reverse();
    const second = buildTeacherAiGradingPartitionReport(reorderedInput);

    expect(second.contentHash).toBe(first.contentHash);
  });
});

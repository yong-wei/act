import { describe, expect, it } from 'vitest';

import {
  buildTeacherAiGradingControlledVisualExperimentReport,
  freezeTeacherAiGradingControlledVisualExperiment,
} from '../teacher-ai-grading-lab-controlled-experiment';

function component(id: string) {
  return { id, version: 'v1', contentHash: `sha256:${id.padEnd(64, '0').slice(0, 64)}` };
}

function thresholds() {
  return {
    maximumMeanAbsoluteError: 0,
    maximumAbsoluteMeanBias: 0,
    minimumExactRate: 1,
    minimumWithinTenPercentRate: 1,
    minimumExactStabilityRate: 1,
    minimumToleranceStabilityRate: 1,
    minimumVisualEvidenceCompletenessRate: 1,
    minimumProcessingSuccessRate: 1,
    minimumConversionSuccessRate: 1,
    minimumBlindFaithfulnessRate: 1,
    minimumBlindScoringSufficiencyRate: 1,
    maximumBlindMisattributionRate: 0,
  };
}

function plan() {
  return freezeTeacherAiGradingControlledVisualExperiment({
    experimentId: 't2-visual-v1',
    partition: 'tuning',
    dataset: component('dataset'),
    split: component('split'),
    prompt: component('prompt'),
    model: { ...component('model'), parameters: { temperature: 0, topP: 1 } },
    rubric: component('rubric'),
    seed: 7,
    baselineProcessor: { ...component('text-chain'), evidenceChain: 'text-only' },
    candidateProcessor: {
      ...component('visual-chain'),
      evidenceChain: 'visual-evidence',
      visualEvidenceContractVersion: 'grading-visual-evidence.v1',
      visualPolicy: component('visual-policy'),
    },
    strata: [
      { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true },
    ],
    thresholds: thresholds(),
  });
}

describe('teacher AI grading controlled visual experiment', () => {
  it('freezes only a tuning-set control and candidate pair with explicit thresholds', () => {
    const frozen = plan();

    expect(frozen.partition).toBe('tuning');
    expect(frozen.baselineProcessor.evidenceChain).toBe('text-only');
    expect(frozen.candidateProcessor.evidenceChain).toBe('visual-evidence');
    expect(frozen.strata).toEqual([
      { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true },
    ]);
    expect(frozen.contentHash).toMatch(/^sha256:/);
  });

  it('rejects a candidate whose visual evidence contract is not frozen', () => {
    expect(() => freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      candidateProcessor: { ...component('visual-chain'), evidenceChain: 'visual-evidence' },
    })).toThrow('teacher-ai-grading-controlled-visual-contract-missing');
  });

  it('changes the frozen plan when visual strata change', () => {
    const baseline = plan();
    const changed = freezeTeacherAiGradingControlledVisualExperiment({
      ...baseline,
      strata: [{ sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: true }],
    });

    expect(changed.contentHash).not.toBe(baseline.contentHash);
  });

  it('freezes the per-slot retry limit into the plan', () => {
    const defaultPlan = plan();
    const retryingPlan = freezeTeacherAiGradingControlledVisualExperiment({ ...defaultPlan, maxAttempts: 5 });

    expect(defaultPlan.maxAttempts).toBeUndefined();
    expect(retryingPlan.maxAttempts).toBe(5);
    expect(retryingPlan.contentHash).not.toBe(defaultPlan.contentHash);
  });

  it('rejects a candidate whose visual processing policy is not frozen', () => {
    expect(() => freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      candidateProcessor: {
        ...component('visual-chain'),
        evidenceChain: 'visual-evidence',
        visualEvidenceContractVersion: 'grading-visual-evidence.v1',
      },
    })).toThrow('teacher-ai-grading-controlled-visual-policy-missing');
  });

  it('reports T2-3 separately and passes only a complete visual candidate with blind review', () => {
    const expectedQuestions = [
      { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false, maxScore: 10, teacherScore: 9 },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true, maxScore: 10, teacherScore: 8 },
    ] as const;
    const executions = expectedQuestions.flatMap((question) => ([1, 2, 3] as const).map((repetitionOrdinal) => ({
      sampleId: question.sampleId,
      questionId: question.questionId,
      repetitionOrdinal,
      status: 'succeeded' as const,
      score: question.teacherScore,
    })));
    const report = buildTeacherAiGradingControlledVisualExperimentReport({
      plan: plan(),
      evidenceChain: 'visual-evidence',
      evaluationRunId: 'batch-visual-1',
      expectedQuestions,
      executions,
      conversions: [
        { sampleId: 'sample-a', questionId: 'T2-2', status: 'succeeded', visualEvidenceStatus: 'not-applicable' },
        { sampleId: 'sample-a', questionId: 'T2-3', status: 'succeeded', visualEvidenceStatus: 'complete' },
      ],
      blindItems: [{ evidenceId: 'visual-t2-3', sampleId: 'sample-a', questionId: 'T2-3' }],
      blindJudgments: [{ evidenceId: 'visual-t2-3', faithful: true, sufficientForScoring: true, misattributed: false }],
    });

    expect(report.status).toBe('pass');
    expect(report.strata['question:T2-3']).toMatchObject({ questionCount: 1, meanAbsoluteError: 0 });
    expect(report.strata['visual:yes'].visualEvidenceCompletenessRate).toBe(1);
  });

  it('uses normalized error thresholds when question maxima differ', () => {
    const frozen = freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      thresholds: {
        ...thresholds(),
        maximumMeanAbsoluteError: undefined,
        maximumAbsoluteMeanBias: undefined,
        maximumNormalizedMeanAbsoluteError: 0.05,
        maximumAbsoluteNormalizedMeanBias: 0.05,
        minimumExactRate: 0,
      },
    });
    const expectedQuestions = [
      { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false, maxScore: 10, teacherScore: 9 },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true, maxScore: 100, teacherScore: 90 },
    ] as const;
    const executions = expectedQuestions.flatMap((question) => ([1, 2, 3] as const).map((repetitionOrdinal) => ({
      sampleId: question.sampleId,
      questionId: question.questionId,
      repetitionOrdinal,
      status: 'succeeded' as const,
      score: question.maxScore === 10 ? 8.5 : 85,
    })));
    const report = buildTeacherAiGradingControlledVisualExperimentReport({
      plan: frozen,
      evidenceChain: 'visual-evidence',
      evaluationRunId: 'batch-visual-normalized',
      expectedQuestions,
      executions,
      conversions: [
        { sampleId: 'sample-a', questionId: 'T2-2', status: 'succeeded', visualEvidenceStatus: 'not-applicable' },
        { sampleId: 'sample-a', questionId: 'T2-3', status: 'succeeded', visualEvidenceStatus: 'complete' },
      ],
      blindItems: [{ evidenceId: 'visual-t2-3', sampleId: 'sample-a', questionId: 'T2-3' }],
      blindJudgments: [{ evidenceId: 'visual-t2-3', faithful: true, sufficientForScoring: true, misattributed: false }],
    });

    expect(report.status).toBe('pass');
    expect(report.strata.all.meanAbsoluteError).toBe(2.75);
    expect(report.strata.all.normalizedMeanAbsoluteError).toBeCloseTo(0.05);
    expect(report.strata.all.normalizedMeanBias).toBeCloseTo(-0.05);
  });

  it('checks final AI processing and conversion success rates independently', () => {
    const expectedQuestions = [
      { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false, maxScore: 10, teacherScore: 9 },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true, maxScore: 10, teacherScore: 8 },
    ] as const;
    const frozen = freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      thresholds: {
        ...thresholds(),
        minimumExactRate: 0,
        minimumWithinTenPercentRate: 0,
        minimumExactStabilityRate: 0,
        minimumToleranceStabilityRate: 0,
        minimumVisualEvidenceCompletenessRate: 0,
        minimumProcessingSuccessRate: 0.9,
        minimumConversionSuccessRate: 0.95,
      },
    });
    const report = buildTeacherAiGradingControlledVisualExperimentReport({
      plan: frozen,
      evidenceChain: 'visual-evidence',
      evaluationRunId: 'batch-visual-rates',
      expectedQuestions,
      executions: [
        ...[1, 2, 3].map((repetitionOrdinal) => ({ sampleId: 'sample-a', questionId: 'T2-2', repetitionOrdinal: repetitionOrdinal as 1 | 2 | 3, status: 'succeeded' as const, score: 9 })),
        ...[1, 2, 3].map((repetitionOrdinal) => ({ sampleId: 'sample-a', questionId: 'T2-3', repetitionOrdinal: repetitionOrdinal as 1 | 2 | 3, status: 'failed' as const })),
      ],
      conversions: [
        { sampleId: 'sample-a', questionId: 'T2-2', status: 'succeeded', visualEvidenceStatus: 'not-applicable' },
        { sampleId: 'sample-a', questionId: 'T2-3', status: 'succeeded', visualEvidenceStatus: 'complete' },
      ],
      blindItems: [{ evidenceId: 'visual-t2-3', sampleId: 'sample-a', questionId: 'T2-3' }],
      blindJudgments: [{ evidenceId: 'visual-t2-3', faithful: true, sufficientForScoring: true, misattributed: false }],
    });

    expect(report.strata.all.processingSuccessRate).toBe(0.5);
    expect(report.strata.all.conversionSuccessRate).toBe(1);
    expect(report.status).toBe('fail');
  });

  it('uses the processing threshold as the conversion threshold for legacy plans', () => {
    const legacyPlan = freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      thresholds: { ...thresholds(), minimumConversionSuccessRate: undefined },
    });

    expect(legacyPlan.thresholds.minimumConversionSuccessRate).toBeUndefined();
  });

  it('rejects an ambiguous mix of raw and normalized error thresholds', () => {
    expect(() => freezeTeacherAiGradingControlledVisualExperiment({
      ...plan(),
      thresholds: { ...thresholds(), maximumNormalizedMeanAbsoluteError: 0.05, maximumAbsoluteNormalizedMeanBias: 0.02 },
    })).toThrow('teacher-ai-grading-controlled-error-threshold-invalid');
  });

  it('does not treat a text-only control report as hidden-set acceptance evidence', () => {
    const report = buildTeacherAiGradingControlledVisualExperimentReport({
      plan: plan(),
      evidenceChain: 'text-only',
      evaluationRunId: 'batch-text-1',
      expectedQuestions: [
        { sampleId: 'sample-a', questionId: 'T2-2', questionType: 'formula', hasVisualEvidence: false, maxScore: 10, teacherScore: 9 },
        { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn', hasVisualEvidence: true, maxScore: 10, teacherScore: 8 },
      ],
      executions: [
        ...[1, 2, 3].map((repetitionOrdinal) => ({ sampleId: 'sample-a', questionId: 'T2-2', repetitionOrdinal: repetitionOrdinal as 1 | 2 | 3, status: 'succeeded' as const, score: 9 })),
        ...[1, 2, 3].map((repetitionOrdinal) => ({ sampleId: 'sample-a', questionId: 'T2-3', repetitionOrdinal: repetitionOrdinal as 1 | 2 | 3, status: 'succeeded' as const, score: 8 })),
      ],
      conversions: [
        { sampleId: 'sample-a', questionId: 'T2-2', status: 'succeeded', visualEvidenceStatus: 'not-applicable' },
        { sampleId: 'sample-a', questionId: 'T2-3', status: 'succeeded', visualEvidenceStatus: 'not-applicable' },
      ],
      blindItems: [],
      blindJudgments: [],
    });

    expect(report.status).toBe('incomplete');
  });

  it('rejects report questions that do not match the frozen strata set', () => {
    expect(() => buildTeacherAiGradingControlledVisualExperimentReport({
      plan: plan(),
      evidenceChain: 'text-only',
      evaluationRunId: 'batch-text-1',
      expectedQuestions: [{ sampleId: 'sample-a', questionId: 'T2-3', questionType: 'formula', hasVisualEvidence: false, maxScore: 10, teacherScore: 8 }],
      executions: [],
      conversions: [],
      blindItems: [],
      blindJudgments: [],
    })).toThrow('teacher-ai-grading-controlled-experiment-strata-set-mismatch');
  });
});

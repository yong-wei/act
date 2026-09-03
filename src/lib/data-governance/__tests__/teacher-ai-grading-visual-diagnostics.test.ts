import { describe, expect, it } from 'vitest';

import {
  buildTeacherAiGradingVisualDiagnosis,
  type TeacherAiGradingVisualDiagnosticRecord,
} from '../teacher-ai-grading-visual-diagnostics';

function record(overrides: Partial<TeacherAiGradingVisualDiagnosticRecord> = {}): TeacherAiGradingVisualDiagnosticRecord {
  return {
    anonymousSampleId: 'sample-0001',
    questionId: 'T2-3',
    maxScore: 20,
    teacherScore: 16,
    visualEvidenceKind: 'EMBEDDED_IMAGE',
    embeddedImageCount: 1,
    formulaCount: 0,
    visualEvidenceDelivered: false,
    conversion: {
      status: 'SUCCEEDED',
      sourceHash: 'sha256:source',
      renderedPdfChecksum: 'sha256:pdf',
      markdownChecksum: 'sha256:markdown',
      markdownLength: 128,
      evidenceBlockCount: 2,
      anchorVersion: 'anchors-v1',
      processorVersion: 'processor-v1',
      errorCode: null,
    },
    executions: [
      { ordinal: 1, state: 'SUCCEEDED', score: 14, inputHash: 'sha256:input-1' },
      { ordinal: 2, state: 'SUCCEEDED', score: 15, inputHash: 'sha256:input-2' },
      { ordinal: 3, state: 'SUCCEEDED', score: 14, inputHash: 'sha256:input-3' },
    ],
    ...overrides,
  };
}

describe('teacher AI grading visual diagnosis', () => {
  it('preserves only anonymous score and chain metadata while identifying an undelivered visual input', () => {
    const diagnosis = buildTeacherAiGradingVisualDiagnosis({
      partition: 'tuning',
      dataset: { id: 't2-formal', version: 'v1' },
      run: { configurationId: 'config-1', batchId: 'batch-1', processorVersion: 'processor-v1' },
      records: [record()],
    });

    expect(diagnosis.rootCause.code).toBe('VISUAL_EVIDENCE_NOT_DELIVERED');
    expect(diagnosis.questionMetrics).toEqual([{
      questionId: 'T2-3',
      recordCount: 1,
      completeThreeRunCount: 1,
      failedOrIncompleteCount: 0,
      meanAbsoluteError: 1.666667,
      meanRunVariance: 0.222222,
      visualRecordCount: 1,
      visualEvidenceUndeliveredCount: 1,
      conversionFailureCount: 0,
    }]);
    expect(Object.keys(diagnosis.records[0].conversion).sort()).toEqual([
      'anchorVersion',
      'errorCode',
      'evidenceBlockCount',
      'markdownChecksum',
      'markdownLength',
      'processorVersion',
      'renderedPdfChecksum',
      'sourceHash',
      'status',
    ]);
    expect(JSON.stringify(diagnosis)).not.toMatch(/canonicalMarkdown|evidenceBlocks|prompt|referenceAnswer/i);
  });

  it('keeps failed runs in the incomplete denominator', () => {
    const diagnosis = buildTeacherAiGradingVisualDiagnosis({
      partition: 'tuning',
      dataset: { id: 't2-formal', version: 'v1' },
      run: { configurationId: 'config-1', batchId: 'batch-1', processorVersion: 'processor-v1' },
      records: [record({
        visualEvidenceKind: 'TEXT_OR_FORMULA',
        visualEvidenceDelivered: true,
        executions: [
          { ordinal: 1, state: 'SUCCEEDED', score: 16, inputHash: 'sha256:input-1' },
          { ordinal: 2, state: 'FAILED', score: null, inputHash: null },
          { ordinal: 3, state: 'SUCCEEDED', score: 16, inputHash: 'sha256:input-3' },
        ],
      })],
    });

    expect(diagnosis.questionMetrics[0]).toMatchObject({
      completeThreeRunCount: 0,
      failedOrIncompleteCount: 1,
      meanAbsoluteError: null,
      meanRunVariance: null,
    });
  });

  it('refuses to inspect the sealed hidden partition', () => {
    expect(() => buildTeacherAiGradingVisualDiagnosis({
      partition: 'hidden',
      dataset: { id: 't2-formal', version: 'v1' },
      run: { configurationId: 'config-1', batchId: 'batch-1', processorVersion: 'processor-v1' },
      records: [record()],
    })).toThrow('teacher-ai-grading-visual-diagnosis-hidden-partition-forbidden');
  });
});

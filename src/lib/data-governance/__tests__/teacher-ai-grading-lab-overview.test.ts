import { describe, expect, it, vi } from 'vitest';

import { getTeacherAiGradingLabOverview } from '../teacher-ai-grading-lab-overview';

describe('teacher AI grading lab overview', () => {
  it('withholds all sealed hidden details while retaining safe batch state', async () => {
    const overview = await getTeacherAiGradingLabOverview({
      datasetStore: {
        list: async () => [{ datasetId: 'dataset-t1', datasetVersion: 'v1', datasetKind: 'synthetic', sampleCount: 1, questionCount: 1 }],
        load: async () => ({ baseline: { samples: [] } }),
      } as any,
      db: {
        teacherAiGradingExperimentConfig: { findMany: async () => [] },
        teacherAiGradingExperimentBatch: { findMany: async () => [{ id: 'batch-hidden', configId: 'config-hidden', state: 'RUNNING', totalExecutions: 3, completedCount: 0, failedCount: 0, retryableCount: 0, updatedAt: new Date('2026-07-30T00:00:00Z'), hiddenAcceptance: { state: 'RUNNING' } }] },
        teacherAiGradingExperimentExecution: { findMany: async () => [{ id: 'execution-hidden', batchId: 'batch-hidden', configId: 'config-hidden', sampleId: 'sample-hidden', questionId: 'T1-1', repetitionOrdinal: 1, state: 'SUCCEEDED', failureStage: null, errorCode: null, gradingRun: { draftTotalScore: 9 }, annotationJudgments: [], batch: { hiddenAcceptance: { state: 'RUNNING' } } }] },
        teacherAiGradingPdfVerification: { findMany: async () => [{ acceptanceId: 'acceptance-hidden', sampleId: 'sample-hidden', derivativeId: 'derivative-hidden', revision: 0, blockingDefect: null, acceptance: { state: 'RUNNING' } }] },
        teacherAiGradingAnnotationJudgment: { findMany: async () => [] },
        teacherAiGradingVisualEvidenceBlindJudgment: { findMany: async () => [] },
      },
    });

    expect(overview.batches).toEqual([expect.objectContaining({ hiddenAcceptanceState: 'RUNNING' })]);
    expect(overview.executions).toEqual([]);
    expect(overview.pdfVerifications).toEqual([]);
    expect(overview.pendingBlindAnnotations).toEqual([]);
    expect(overview.pendingBlindVisualEvidence).toEqual([]);
  });

  it('projects an unjudged visual description without model scores or hidden data', async () => {
    const load = vi.fn(async () => ({ baseline: { samples: [] } }));
    const overview = await getTeacherAiGradingLabOverview({
      datasetStore: {
        list: async () => [],
        load,
      } as any,
      db: {
        teacherAiGradingExperimentConfig: { findMany: async () => [{ id: 'config-visible', datasetId: 'dataset-t1', datasetVersion: 'v1', splitId: 'split-1', createdAt: new Date('2026-08-21T00:00:00Z') }] },
        teacherAiGradingExperimentBatch: { findMany: async () => [] },
        teacherAiGradingExperimentExecution: {
          findMany: async () => [{
            id: 'execution-visible', batchId: 'batch-visible', configId: 'config-visible', sampleId: 'sample-1', questionId: 'T2-3', repetitionOrdinal: 1,
            state: 'SUCCEEDED', failureStage: null, errorCode: null,
            gradingRun: {
              draftTotalScore: 9,
              annotations: [{
                id: 'annotation-1', excerpt: '图中曲线未覆盖高频趋势。', reason: '未识别高频衰减', comment: '请补充高频段分析。',
                pageNumber: 2, precision: 'REGION',
              }],
              answerEvidence: {
                blocks: [{
                  id: 'conversion-1:visual-evidence:diagram-1', sourceHash: 'sha256:source',
                  text: '单位负反馈结构图，包含输入、输出和反馈支路。', markdown: '> 视觉证据：单位负反馈结构图。',
                  pageNumber: 1, bbox: { x: 10, y: 20, width: 30, height: 40 }, confidence: 0.92,
                }],
              },
            },
            annotationJudgments: [], batch: { hiddenAcceptance: null },
          }],
        },
        teacherAiGradingPdfVerification: { findMany: async () => [] },
        teacherAiGradingAnnotationJudgment: { findMany: async () => [] },
        teacherAiGradingVisualEvidenceBlindJudgment: { findMany: async () => [] },
      },
    });

    expect(overview.pendingBlindVisualEvidence).toEqual([expect.objectContaining({
      executionId: 'execution-visible', visualEvidenceId: 'conversion-1:visual-evidence:diagram-1',
      sampleId: 'sample-1', questionId: 'T2-3', description: '单位负反馈结构图，包含输入、输出和反馈支路。',
      pageNumber: 1, confidence: 0.92,
    })]);
    expect(overview.metrics).toEqual({ completedRate: null, meanAbsoluteScoreDifference: null, exactScoreRate: null, threeRunExactStabilityRate: null });
    expect(JSON.stringify(overview.pendingBlindVisualEvidence)).not.toContain('draftTotalScore');
    expect(overview.pendingBlindAnnotations).toEqual([expect.objectContaining({
      gradingAnnotationId: 'annotation-1', excerpt: '图中曲线未覆盖高频趋势。', reason: '未识别高频衰减',
      comment: '请补充高频段分析。', pageNumber: 2, precision: 'REGION',
    })]);
    expect(overview.executions[0]?.teacherScore).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps experiment metrics isolated per evaluation run', async () => {
    const overview = await getTeacherAiGradingLabOverview({
      datasetStore: {
        list: async () => [],
        load: async () => ({ baseline: { samples: [{ sampleId: 'sample-1', questions: [{ questionId: 'T1-1', teacherScore: 10 }] }] } }),
      } as any,
      db: {
        teacherAiGradingExperimentConfig: { findMany: async () => [
          { id: 'config-a', datasetId: 'd', datasetVersion: 'v1', splitId: 'split-a', contentHash: 'hash-a', createdAt: new Date('2026-08-21T00:00:00Z') },
          { id: 'config-b', datasetId: 'd', datasetVersion: 'v1', splitId: 'split-b', contentHash: 'hash-b', createdAt: new Date('2026-08-22T00:00:00Z') },
        ] },
        teacherAiGradingExperimentBatch: { findMany: async () => [
          { id: 'run-a', configId: 'config-a', splitId: 'split-a', state: 'SUCCEEDED', totalExecutions: 3, completedCount: 3, failedCount: 0, retryableCount: 0, updatedAt: new Date('2026-08-21T00:00:00Z'), hiddenAcceptance: null },
          { id: 'run-b', configId: 'config-b', splitId: 'split-b', state: 'SUCCEEDED', totalExecutions: 3, completedCount: 3, failedCount: 0, retryableCount: 0, updatedAt: new Date('2026-08-22T00:00:00Z'), hiddenAcceptance: null },
        ] },
        teacherAiGradingExperimentExecution: { findMany: async () => [
          ...[1, 2, 3].map((repetitionOrdinal) => ({ id: `a-${repetitionOrdinal}`, batchId: 'run-a', configId: 'config-a', splitId: 'split-a', sampleId: 'sample-1', questionId: 'T1-1', repetitionOrdinal, state: 'SUCCEEDED', failureStage: null, errorCode: null, rawOutputObjectKey: 'a', gradingRun: { aiTotalScore: 10, draftTotalScore: 10, annotations: [], answerEvidence: { blocks: [] } }, annotationJudgments: [], batch: { hiddenAcceptance: null } })),
          ...[1, 2, 3].map((repetitionOrdinal) => ({ id: `b-${repetitionOrdinal}`, batchId: 'run-b', configId: 'config-b', splitId: 'split-b', sampleId: 'sample-1', questionId: 'T1-1', repetitionOrdinal, state: 'SUCCEEDED', failureStage: null, errorCode: null, rawOutputObjectKey: 'b', gradingRun: { aiTotalScore: 8, draftTotalScore: 8, annotations: [], answerEvidence: { blocks: [] } }, annotationJudgments: [], batch: { hiddenAcceptance: null } })),
        ] },
        teacherAiGradingPdfVerification: { findMany: async () => [] },
        teacherAiGradingAnnotationJudgment: { findMany: async () => [] },
        teacherAiGradingVisualEvidenceBlindJudgment: { findMany: async () => [] },
      },
    });

    expect(overview.metrics.completedRate).toBeNull();
    expect(overview.metricsByRun).toEqual([
      expect.objectContaining({ evaluationRunId: 'run-a', configurationVersion: 'config-a', splitId: 'split-a', meanAbsoluteScoreDifference: 0, exactScoreRate: 1 }),
      expect.objectContaining({ evaluationRunId: 'run-b', configurationVersion: 'config-b', splitId: 'split-b', meanAbsoluteScoreDifference: 2, exactScoreRate: 0 }),
    ]);
  });
});

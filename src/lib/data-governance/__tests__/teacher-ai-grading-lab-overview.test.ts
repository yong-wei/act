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
              annotations: [],
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
    expect(JSON.stringify(overview.pendingBlindVisualEvidence)).not.toContain('draftTotalScore');
    expect(overview.executions[0]?.teacherScore).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});

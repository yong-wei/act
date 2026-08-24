import { describe, expect, it } from 'vitest';

import {
  appendAnnotationJudgment,
  appendBlindVisualEvidenceJudgment,
  appendConversionAttempt,
  appendProviderCallAttempt,
  estimateProviderCostMicros,
  listBlindAnnotationProjections,
  listBlindVisualEvidenceProjections,
  persistReportSnapshot,
} from '../teacher-ai-grading-lab-evaluation-records';

function transactionDb<T extends Record<string, unknown>>(db: T): T & {
  $transaction: (operation: (tx: T) => Promise<unknown>) => Promise<unknown>;
  $queryRawUnsafe: () => Promise<unknown>;
} {
  return Object.assign(db, {
    $transaction: (operation: (tx: T) => Promise<unknown>) => operation(db),
    $queryRawUnsafe: async () => [],
  });
}

describe('teacher AI grading annotation judgments', () => {
  it('appends versions without overwriting the previous judgment', async () => {
    const judgments: any[] = [];
    const annotation = {
      id: 'annotation-1',
      gradingRunId: 'run-1',
      criterionId: 'criterion-1',
      blockId: 'block-1',
      pageNumber: 1,
      spanStart: 2,
      spanEnd: 8,
      bbox: null,
      excerpt: 'student evidence',
      comment: 'reason and suggestion',
      gradingRun: { teacherAiGradingExperimentExecution: { id: 'execution-1' } },
    };
    const db = transactionDb({
      gradingAnnotation: { findUnique: async () => annotation },
      teacherAiGradingAnnotationJudgment: {
        findFirst: async () => judgments.at(-1) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `judgment-${judgments.length + 1}`, ...data };
          judgments.push(row);
          return row;
        },
      },
    });

    const first = await appendAnnotationJudgment({
      db,
      gradingAnnotationId: annotation.id,
      executionId: 'execution-1',
      locationCorrect: true,
      reasonCorrect: false,
      suggestionCorrect: false,
      seriouslyMisleading: false,
      operatorUserId: 'teacher-1',
    });
    const second = await appendAnnotationJudgment({
      db,
      gradingAnnotationId: annotation.id,
      executionId: 'execution-1',
      locationCorrect: true,
      reasonCorrect: true,
      suggestionCorrect: true,
      seriouslyMisleading: false,
      operatorUserId: 'teacher-1',
    });

    expect([first.version, second.version]).toEqual([1, 2]);
    expect(judgments).toHaveLength(2);
    expect(judgments[0].reasonCorrect).toBe(false);
    expect(judgments[1]).toMatchObject({ reasonCorrect: true, suggestionCorrect: true });
    expect(judgments[0].contentHash).not.toBe(judgments[1].contentHash);
  });

  it('returns only the blind-safe annotation projection', async () => {
    let query: unknown;
    const db = {
      teacherAiGradingExperimentExecution: {
        findMany: async (value: unknown) => {
          query = value;
          return [{
            sampleId: 'sample-1',
            questionId: 'T1-1',
            repetitionOrdinal: 3,
            promptVersion: 'secret-prompt',
            modelParameters: { temperature: 0 },
            gradingRun: { annotations: [{
              id: 'annotation-1',
              criterionId: 'criterion-1',
              blockId: 'block-1',
              pageNumber: 1,
              spanStart: null,
              spanEnd: null,
              bbox: null,
              excerpt: 'evidence',
              comment: 'feedback',
            }] },
          }];
        },
      },
    };

    const result = await listBlindAnnotationProjections({ db, batchId: 'batch-1' });

    expect(Object.keys(result[0]).sort()).toEqual([
      'annotationId',
      'criterionId',
      'evidenceIdentity',
      'issueIdentity',
      'questionId',
      'sampleId',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/prompt|model|repetition|ordinal/i);
    expect(JSON.stringify(query)).not.toMatch(/prompt|model|repetitionOrdinal/i);
  });
});

describe('teacher AI grading visual evidence blind judgments', () => {
  it('projects visual descriptions without exposing model scores and versions teacher judgments', async () => {
    const block = {
      id: 'conversion-1:visual-evidence:diagram-1',
      text: '图中给出了单位负反馈结构，并标注输入、输出与反馈支路。',
      markdown: '> 视觉证据：图中给出了单位负反馈结构，并标注输入、输出与反馈支路。',
      pageNumber: 1,
      bbox: [10, 20, 30, 40],
      confidence: 0.92,
      sourceHash: 'sha256:source',
    };
    const execution = {
      id: 'execution-1',
      configId: 'config-1',
      state: 'SUCCEEDED',
      gradingRun: { answerEvidence: { blocks: [block] } },
    };
    const judgments: any[] = [];
    const db = transactionDb({
      teacherAiGradingExperimentExecution: {
        findMany: async () => [
          { id: 'execution-2', sampleId: 'sample-a', questionId: 'T2-3', gradingRun: execution.gradingRun },
          { id: execution.id, sampleId: 'sample-a', questionId: 'T2-3', gradingRun: execution.gradingRun },
        ],
        findUnique: async () => execution,
      },
      teacherAiGradingVisualEvidenceBlindJudgment: {
        findFirst: async () => judgments.at(-1) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `judgment-${judgments.length + 1}`, ...data };
          judgments.push(row);
          return row;
        },
      },
    });

    const projections = await listBlindVisualEvidenceProjections({ db, batchId: 'batch-1' });
    expect(projections).toEqual([expect.objectContaining({ executionId: execution.id, evidenceId: block.id, sampleId: 'sample-a', questionId: 'T2-3' })]);
    expect(projections[0]).not.toHaveProperty('score');
    await appendBlindVisualEvidenceJudgment({
      db,
      executionId: execution.id,
      visualEvidenceId: projections[0].evidenceId,
      evidenceContentHash: projections[0].evidenceContentHash,
      faithful: true,
      sufficientForScoring: true,
      misattributed: false,
      operatorUserId: 'teacher-1',
    });

    expect(judgments).toHaveLength(1);
    expect(judgments[0]).toMatchObject({ configId: 'config-1', version: 1, faithful: true, sufficientForScoring: true, misattributed: false });
  });
});

describe('teacher AI grading processing records', () => {
  it('keeps failed conversion attempts auditable', async () => {
    const attempts: any[] = [];
    const db = {
      teacherAiGradingConversionAttempt: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          attempts.push(data);
          return data;
        },
      },
    };

    const result = await appendConversionAttempt({
      db,
      batchId: 'batch-1',
      sampleId: 'sample-1',
      questionId: 'T2-3',
      attemptOrdinal: 1,
      status: 'FAILED',
      stage: 'content-integrity',
      errorCode: 'conversion-formula-corrupt',
      durationMs: 210,
      conversionVersion: 'conversion-v2',
      sourceHash: 'sha256:source',
      telemetryComplete: true,
    });

    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'conversion-formula-corrupt' });
    expect(attempts).toHaveLength(1);
  });

  it('records conversion attempts independently for each question in a sample', async () => {
    const attempts: any[] = [];
    const db = {
      teacherAiGradingConversionAttempt: {
        findFirst: async ({ where }: any) => attempts.find((attempt) => (
          attempt.batchId === where.batchId
          && attempt.sampleId === where.sampleId
          && attempt.questionId === where.questionId
          && attempt.attemptOrdinal === where.attemptOrdinal
        )) ?? null,
        create: async ({ data }: any) => {
          attempts.push(data);
          return data;
        },
      },
    };
    const base = {
      db,
      batchId: 'batch-1',
      sampleId: 'sample-1',
      attemptOrdinal: 1,
      status: 'SUCCEEDED' as const,
      stage: 'conversion',
      durationMs: 210,
      conversionVersion: 'conversion-v2',
      sourceHash: 'sha256:source',
      telemetryComplete: true,
    };

    await appendConversionAttempt({ ...base, questionId: 'T2-2' });
    await appendConversionAttempt({ ...base, questionId: 'T2-3' });

    expect(attempts.map((attempt) => attempt.questionId)).toEqual(['T2-2', 'T2-3']);
  });

  it('fences provider calls and preserves retry attempts', async () => {
    const calls: any[] = [];
    const execution = {
      id: 'execution-1',
      state: 'RUNNING',
      claimToken: 'claim-1',
      leaseExpiresAt: new Date('2026-07-27T01:00:00.000Z'),
      attemptCount: 1,
    };
    const db = transactionDb({
      teacherAiGradingExperimentExecution: { findUnique: async () => execution },
      teacherAiGradingProviderCallAttempt: {
        findFirst: async ({ where }: any) => calls.find((call) => call.executionId === where.executionId
          && call.attemptOrdinal === where.attemptOrdinal && call.callOrdinal === where.callOrdinal) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `call-${calls.length + 1}`, ...data };
          calls.push(row);
          return row;
        },
      },
    });
    const base = {
      db,
      executionId: execution.id,
      status: 'SUCCEEDED' as const,
      inputTokens: 1_000,
      outputTokens: 500,
      durationMs: 100,
      pricing: {
        version: 'pricing-v1',
        inputMicrosPerMillionTokens: '2000000',
        outputMicrosPerMillionTokens: '4000000',
      },
      providerRequestId: 'request-1',
      telemetryComplete: true,
      now: new Date('2026-07-27T00:00:00.000Z'),
    };

    await appendProviderCallAttempt({ ...base, claimToken: 'claim-1', attemptOrdinal: 1, callOrdinal: 1 });
    await expect(appendProviderCallAttempt({ ...base, claimToken: 'stale', attemptOrdinal: 1, callOrdinal: 2 }))
      .rejects.toThrow('teacher-ai-grading-provider-call-fenced');
    Object.assign(execution, { claimToken: 'claim-2', attemptCount: 2 });
    await appendProviderCallAttempt({ ...base, claimToken: 'claim-2', attemptOrdinal: 2, callOrdinal: 1 });

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.attemptOrdinal)).toEqual([1, 2]);
    expect(calls[0].estimatedCostMicros).toBe(BigInt(4_000));
  });

  it('calculates integer micros exactly and returns null for unknown usage', () => {
    const pricing = {
      version: 'pricing-v1',
      inputMicrosPerMillionTokens: '2000000',
      outputMicrosPerMillionTokens: '4000000',
    };

    expect(estimateProviderCostMicros({ inputTokens: 1_000, outputTokens: 500, pricing })).toBe(BigInt(4_000));
    expect(estimateProviderCostMicros({ inputTokens: null, outputTokens: 500, pricing })).toBeNull();
    expect(estimateProviderCostMicros({ inputTokens: 1_000, outputTokens: 500, pricing: null })).toBeNull();
  });
});

describe('teacher AI grading report snapshots', () => {
  it('replays identical content and creates a new immutable row for changed content', async () => {
    const snapshots: any[] = [];
    const db = {
      teacherAiGradingExperimentConfig: {
        findUnique: async () => ({ id: 'config-1', splitId: 'split-1', contentHash: 'sha256:config' }),
      },
      teacherAiGradingReportSnapshot: {
        findFirst: async ({ where }: any) => snapshots.find((row) => row.contentHash === where.contentHash) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `report-${snapshots.length + 1}`, ...data };
          snapshots.push(row);
          return row;
        },
      },
    };
    const base = {
      db,
      configId: 'config-1',
      splitId: 'split-1',
      partition: 'tuning' as const,
      metricVersion: 'metrics-v1',
      pricingVersion: 'pricing-v1',
      configurationContentHash: 'sha256:config',
    };

    const first = await persistReportSnapshot({ ...base, snapshot: { status: 'pass' } });
    const replay = await persistReportSnapshot({ ...base, snapshot: { status: 'pass' } });
    const changed = await persistReportSnapshot({ ...base, snapshot: { status: 'fail' } });

    expect(first.replay).toBe(false);
    expect(replay).toMatchObject({ replay: true, snapshot: { id: first.snapshot.id } });
    expect(changed.replay).toBe(false);
    expect(snapshots).toHaveLength(2);
    expect(changed.snapshot.contentHash).not.toBe(first.snapshot.contentHash);
  });
});

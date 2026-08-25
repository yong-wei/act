import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createFileSystemTeacherAiGradingLabDatasetStore,
  createTeacherAiGradingLabCore,
  assertFrozenProviderPolicyBinding,
  prepareLabExperimentEvidence,
  startTeacherAiGradingClaimHeartbeat,
  TEACHER_AI_GRADING_LAB_CORE_OPERATION_KINDS,
  type TeacherAiGradingLabCore,
  type TeacherAiGradingLabCoreOperation,
  type TeacherAiGradingLabCoreOperationKind,
  type TeacherAiGradingLabCoreOperationResult,
  type TeacherAiGradingLabEvaluationRunReference,
  type TeacherAiGradingLabSplitReference,
} from '../teacher-ai-grading-lab-core';
import { buildSyntheticTeacherAiGradingPackage } from './fixtures/teacher-ai-grading-lab-synthetic';
import {
  confirmTeacherAiGradingRedaction,
  createTeacherAiGradingRedactedDocument,
  createTeacherAiGradingRedactionReview,
} from '../teacher-ai-grading-lab-redaction';
import { sha256, type ExternalProcessingPolicy } from '../math-document-grading-contracts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('teacher AI grading lab core', () => {
  it('rejects provider policy drift from a frozen configuration', () => {
    const config = {
      modelId: 'siliconflow',
      modelVersion: 'deepseek-ai/DeepSeek-V3',
      modelParameters: { providerPolicyVersion: 'policy.v1' },
    };
    expect(() => assertFrozenProviderPolicyBinding({
      config,
      policy: { provider: 'siliconflow', model: 'deepseek-ai/DeepSeek-V3', version: 'policy.v2' },
    })).toThrow('teacher-ai-grading-provider-policy-version-mismatch');
    expect(() => assertFrozenProviderPolicyBinding({
      config,
      policy: { provider: 'siliconflow', model: 'other-model', version: 'policy.v1' },
    })).toThrow('teacher-ai-grading-provider-model-identity-mismatch');
  });

  it('describes the complete PDF page set for current-question visual evidence', async () => {
    const provider = visualDescriptionProvider();
    const renderer = vi.fn(async () => [
      { pageNumber: 1, bytes: Buffer.from('page-one') },
    ]);
    const result = await prepareLabExperimentEvidence({
      result: visualConversionResult(),
      request: visualConversionRequest(provider),
      renderPdfPages: renderer,
    });

    expect(result.visualEvidenceStatus).toBe('COMPLETE');
    expect(result.visualEvidence.map((item) => item.visual)).toMatchObject([
      { sourceKind: 'pdf-page-image', pageNumber: 1, questionId: 'T2-3' },
    ]);
    expect(renderer).toHaveBeenCalledWith(expect.not.objectContaining({ pageNumbers: expect.anything() }));
    expect(provider.evaluate).toHaveBeenCalledTimes(1);
    expect(provider.evaluate.mock.calls.map(([call]) => Buffer.from((call as any).attachments[0].data).toString())).toEqual(['page-one']);
  });

  it('does not require a fragile per-image PDF page anchor', async () => {
    const result = await prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: {
          renderedPdfPageCount: 1,
          images: [{ id: 'current-image', questionId: 'T2-3' }],
          imageAnchors: [{ imageId: 'current-image', questionId: 'T2-3', pdfPageNumber: null, verified: false }],
        },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('page-one') }],
    });
    expect(result.visualEvidenceStatus).toBe('COMPLETE');
  });

  it('sorts and describes every valid page, including pages without images', async () => {
    const provider = visualDescriptionProvider();
    const result = await prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: { renderedPdfPageCount: 3, images: [{ id: 'current-image', questionId: 'T2-3' }] },
      }),
      request: visualConversionRequest(provider),
      renderPdfPages: async () => [
        { pageNumber: 3, bytes: Buffer.from('page-three-no-image') },
        { pageNumber: 1, bytes: Buffer.from('page-one-image') },
        { pageNumber: 2, bytes: Buffer.from('page-two-no-image') },
      ],
    });
    expect(result.visualEvidence.map((item) => item.visual.pageNumber)).toEqual([1, 2, 3]);
    expect(provider.evaluate).toHaveBeenCalledTimes(3);
  });

  it('rejects a rendered page set with gaps or out-of-range pages', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: { renderedPdfPageCount: 2, images: [{ id: 'current-image', questionId: 'T2-3' }] },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [
        { pageNumber: 1, bytes: Buffer.from('page-one') },
        { pageNumber: 3, bytes: Buffer.from('page-three') },
      ],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-page-projection-invalid');
  });

  it('ignores stale image anchors after switching to complete PDF page sets', async () => {
    const result = await prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: {
          renderedPdfPageCount: 1,
          images: [{ id: 'current-image', questionId: 'T2-3' }],
          imageAnchors: [
            { imageId: 'current-image', questionId: 'T2-3', pdfPageNumber: 1, verified: true },
            { imageId: 'current-image', questionId: 'T2-2', pdfPageNumber: 2, verified: true },
          ],
        },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('page-one') }],
    });
    expect(result.visualEvidenceStatus).toBe('COMPLETE');
  });

  it('fails closed when the rendered PDF does not match verified page anchors', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: {
          renderedPdfPageCount: 1,
          images: [{ id: 'current-image', questionId: 'T2-3' }],
          imageAnchors: [{ imageId: 'current-image', questionId: 'T2-3', pdfPageNumber: 1, verified: true }],
          renderedPdfChecksum: sha256(Buffer.from('%PDF-1.7\nother')),
        },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('unexpected') }],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-rendered-pdf-mismatch');
  });

  it('fails closed when the renderer returns a page outside the verified visual evidence set', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult(),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 2, bytes: Buffer.from('unexpected') }],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-page-projection-invalid');
  });

  it('fails closed when the PDF page projection cannot be rendered', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult(),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => { throw new Error('renderer-unavailable'); },
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-pdf-render-failed');
  });

  it('records a bounded reason when visual evidence is below the confidence threshold', async () => {
    const provider = visualDescriptionProvider({ confidence: 0.79 });
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult(),
      request: visualConversionRequest(provider),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('page-one') }],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-evidence-low-confidence');
  });

  it('does not process a known image assigned to another question', async () => {
    const renderer = vi.fn(async () => [{ pageNumber: 1, bytes: Buffer.from('unexpected') }]);
    const result = await prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: { images: [{ id: 'other-image', questionId: 'T2-2' }] },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: renderer,
    });

    expect(result.visualEvidenceStatus).toBe('NOT_APPLICABLE');
    expect(renderer).not.toHaveBeenCalled();
  });

  it('rejects a current-question document that also contains another question\'s image', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: {
          renderedPdfPageCount: 1,
          images: [
            { id: 'current-image', questionId: 'T2-3' },
            { id: 'other-image', questionId: 'T2-2' },
          ],
        },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('unexpected') }],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-question-mapping-invalid');
  });

  it('rejects an image whose question assignment is unknown', async () => {
    await expect(prepareLabExperimentEvidence({
      result: visualConversionResult({
        wordRepresentation: { images: [{ id: 'unknown-image', questionId: null }] },
      }),
      request: visualConversionRequest(visualDescriptionProvider()),
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from('unexpected') }],
    })).rejects.toThrow('teacher-ai-grading-controlled-visual-question-mapping-invalid');
  });

  it('defines every evaluation operation behind one execute entry point', () => {
    expect(TEACHER_AI_GRADING_LAB_CORE_OPERATION_KINDS).toEqual([
      'validate-package',
      'import-package',
      'create-split',
      'freeze-configuration',
      'freeze-controlled-visual-experiment',
      'run-evaluation',
      'resume-evaluation',
      'reveal-hidden-acceptance',
      'record-human-judgment',
      'build-report',
      'build-controlled-visual-experiment-report',
      'export-pdf-verification-checklist',
    ]);
    expect(new Set(TEACHER_AI_GRADING_LAB_CORE_OPERATION_KINDS).size).toBe(12);
    expectTypeOf<keyof TeacherAiGradingLabCore>().toEqualTypeOf<'execute'>();
    expectTypeOf<(typeof TEACHER_AI_GRADING_LAB_CORE_OPERATION_KINDS)[number]>()
      .toEqualTypeOf<TeacherAiGradingLabCoreOperationKind>();
  });

  it('maps each operation to its public input and result contract', () => {
    expectTypeOf<TeacherAiGradingLabCoreOperation<'import-package'>>()
      .toMatchTypeOf<{ kind: 'import-package'; input: { packageBytes: Buffer } }>();
    expectTypeOf<TeacherAiGradingLabCoreOperationResult<'import-package'>>()
      .toMatchTypeOf<{ datasetId: string; datasetVersion: string }>();
    expectTypeOf<TeacherAiGradingLabCoreOperation<'create-split'>>()
      .toMatchTypeOf<{ kind: 'create-split'; input: { randomSeed: string; tuningRatio: number } }>();
    expectTypeOf<TeacherAiGradingLabCoreOperationResult<'create-split'>>()
      .toEqualTypeOf<TeacherAiGradingLabSplitReference>();
    expectTypeOf<TeacherAiGradingLabCoreOperationResult<'run-evaluation'>>()
      .toEqualTypeOf<TeacherAiGradingLabEvaluationRunReference>();
    expectTypeOf<TeacherAiGradingLabCoreOperation<'build-controlled-visual-experiment-report'>>()
      .toMatchTypeOf<{ kind: 'build-controlled-visual-experiment-report'; input: { baselineConfiguration: unknown; candidateConfiguration: unknown } }>();
    expectTypeOf<TeacherAiGradingLabCoreOperation<'freeze-controlled-visual-experiment'>>()
      .toMatchTypeOf<{ kind: 'freeze-controlled-visual-experiment'; input: { experimentId: string; strata: readonly unknown[] } }>();
    expectTypeOf<TeacherAiGradingLabCoreOperationResult<'resume-evaluation'>>()
      .toEqualTypeOf<TeacherAiGradingLabEvaluationRunReference>();
  });

  it('validates, imports, and reloads datasets through the same real core without exposing paths', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grading-lab-core-'));
    temporaryRoots.push(dataRoot);
    const datasetStore = createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot });
    const core = createTeacherAiGradingLabCore({
      db: {},
      datasetStore,
      clock: () => new Date('2026-07-28T00:00:00.000Z'),
    });
    const packageBytes = await buildSyntheticTeacherAiGradingPackage();

    const validated = await core.execute({ kind: 'validate-package', input: { packageBytes } });
    const imported = await core.execute({ kind: 'import-package', input: { packageBytes } });
    const reloaded = await datasetStore.load({ datasetId: imported.datasetId, datasetVersion: imported.datasetVersion });
    const listed = await datasetStore.list();

    expect(validated).toMatchObject({ datasetId: 'synthetic-t1', datasetVersion: 'v1', sampleCount: 1 });
    expect(imported).toEqual({
      datasetId: 'synthetic-t1',
      datasetVersion: 'v1',
      datasetKind: 'synthetic',
      sampleCount: 1,
      runnable: false,
      redactionState: 'pending',
    });
    expect(reloaded.manifest.datasetId).toBe('synthetic-t1');
    expect(reloaded.baseline.samples[0].sampleId).toBe('sample-abcd');
    expect(reloaded.questions.questions[0].questionId).toBe('T1-4');
    await expect(reloaded.readSubmission('sample-abcd', 'T1-4')).resolves.toEqual(expect.any(Buffer));
    expect(listed).toEqual([{
      datasetId: 'synthetic-t1', datasetVersion: 'v1', datasetKind: 'synthetic', sampleCount: 1, questionCount: 1,
    }]);
    expect(JSON.stringify({ validated, imported })).not.toContain(dataRoot);
  });

  it('imports pilot datasets but blocks them before creating an evaluation split', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grading-lab-pilot-'));
    temporaryRoots.push(dataRoot);
    const datasetStore = createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot });
    const core = createTeacherAiGradingLabCore({
      datasetStore,
      db: {
        teacherAiGradingLabSplit: { create: async () => { throw new Error('unexpected-split-create'); } },
      },
    });
    const packageBytes = await buildSyntheticTeacherAiGradingPackage({ datasetKind: 'pilot' });

    await expect(core.execute({ kind: 'validate-package', input: { packageBytes } })).resolves.toMatchObject({ sampleCount: 1 });
    await expect(core.execute({ kind: 'import-package', input: { packageBytes } })).resolves.toMatchObject({ datasetKind: 'pilot', sampleCount: 1 });
    await expect(core.execute({
      kind: 'create-split',
      input: { datasetId: 'synthetic-t1', datasetVersion: 'v1', randomSeed: 'pilot-seed', tuningRatio: 0.7 },
    })).rejects.toThrow('teacher-ai-grading-pilot-dataset-evaluation-forbidden');
  });

  it('consumes a terminal hidden acceptance without returning hidden data', async () => {
    const acceptance = { id: 'acceptance-1', splitId: 'split-1', state: 'RUNNING', configId: 'config-1', batchId: 'batch-1' };
    const db: any = {
      $transaction: async (callback: (transaction: any) => Promise<any>) => callback(db),
      teacherAiGradingExperimentConfig: { findUnique: async () => ({ id: 'config-1' }) },
      teacherAiGradingHiddenAcceptance: {
        findUnique: async () => ({ ...acceptance }),
        updateMany: async ({ where, data }: any) => {
          if (where.id !== acceptance.id || where.state !== acceptance.state || where.configId !== acceptance.configId || where.batchId !== acceptance.batchId) return { count: 0 };
          Object.assign(acceptance, data);
          return { count: 1 };
        },
      },
      teacherAiGradingExperimentBatch: { findUnique: async () => ({ state: 'SUCCEEDED' }) },
    };
    const core = createTeacherAiGradingLabCore({ db, datasetStore: {} as any, clock: () => new Date('2026-07-30T00:00:00.000Z') });

    await expect(core.execute({
      kind: 'reveal-hidden-acceptance',
      input: { acceptanceId: 'acceptance-1', configuration: { configurationVersion: 'config-1' } },
    })).resolves.toEqual({ acceptanceId: 'acceptance-1', evaluationRunId: 'batch-1', replay: false });
    expect(acceptance.state).toBe('CONSUMED');
  });

  it('rejects hidden acceptance reveal before the batch is terminal', async () => {
    const db: any = {
      teacherAiGradingExperimentConfig: { findUnique: async () => ({ id: 'config-1' }) },
      teacherAiGradingHiddenAcceptance: { findUnique: async () => ({ id: 'acceptance-1', splitId: 'split-1', state: 'RUNNING', configId: 'config-1', batchId: 'batch-1' }) },
      teacherAiGradingExperimentBatch: { findUnique: async () => ({ state: 'RUNNING' }) },
    };
    const core = createTeacherAiGradingLabCore({ db, datasetStore: {} as any });

    await expect(core.execute({
      kind: 'reveal-hidden-acceptance',
      input: { acceptanceId: 'acceptance-1', configuration: { configurationVersion: 'config-1' } },
    })).rejects.toThrow('grading-lab-hidden-batch-not-terminal');
  });

  it('freezes the dataset rubric configuration and creates a real run set from it', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grading-lab-core-run-'));
    temporaryRoots.push(dataRoot);
    const datasetStore = createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot });
    await datasetStore.importPackage(await buildSyntheticTeacherAiGradingPackage());
    const runnableDatasetStore = {
      ...datasetStore,
      load: async (key: { datasetId: string; datasetVersion: string }) => ({
        ...await datasetStore.load(key),
        readModelSubmission: async (sampleId: string, questionId: string) => ({
          sampleId, questionId, fileName: `${questionId}.docx`, documentBytes: Buffer.from('redacted-fixture'),
          checksum: `sha256:${'2'.repeat(64)}`,
          sourceChecksum: `sha256:${'1'.repeat(64)}`,
        }),
      }),
      loadEvaluation: async (key: { datasetId: string; datasetVersion: string }) => ({
        ...await datasetStore.loadEvaluation(key),
        readModelSubmission: async (sampleId: string, questionId: string) => ({
          sampleId, questionId, fileName: `${questionId}.docx`, documentBytes: Buffer.from('redacted-fixture'),
          checksum: `sha256:${'2'.repeat(64)}`,
          sourceChecksum: `sha256:${'1'.repeat(64)}`,
        }),
      }),
    };
    const split = {
      id: 'split-1', datasetId: 'synthetic-t1', datasetVersion: 'v1', version: 1,
      contentHash: `sha256:${'1'.repeat(64)}`,
    };
    const configs: any[] = [];
    const batches: any[] = [];
    const gradingRuns: any[] = [];
    const executions: any[] = [];
    const reportSnapshots: any[] = [];
    const db: any = {
      $transaction: async (callback: (transaction: any) => Promise<any>) => callback(db),
      teacherAiGradingLabSplit: { findUnique: async () => split },
      teacherAiGradingExperimentConfig: {
        findUnique: async ({ where }: any) => configs.find((row) => row.id === where.id || row.idempotencyKey === where.idempotencyKey) ?? null,
        aggregate: async () => ({ _max: { version: configs.length || null } }),
        create: async ({ data }: any) => { configs.push(data); return data; },
      },
      teacherAiGradingLabSplitMember: {
        findMany: async () => [{ sampleId: 'sample-abcd', partition: 'TUNING' }],
      },
      gradingRun: { create: async ({ data }: any) => { gradingRuns.push(data); return data; } },
      teacherAiGradingExperimentExecution: {
        createMany: async ({ data }: any) => { executions.push(...data); return { count: data.length }; },
        findFirst: async () => null,
        findMany: async (args: any) => {
          if (args.where?.batchId && !args.select?.gradingRun?.select?.draftTotalScore) {
            return [{
              sampleId: 'sample-abcd', questionId: 'T1-4', state: 'SUCCEEDED',
              gradingRun: { answerEvidence: { blocks: [{
                id: 'grading-run:visual-evidence:T1-4', text: '图形描述', markdown: '> 视觉证据：图形描述',
                pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 1 }, confidence: 0.99,
                sourceHash: 'sha256:visual-source',
              }] } },
            }];
          }
          const configId = args.where?.configId;
          const score = (await datasetStore.load({ datasetId: 'synthetic-t1', datasetVersion: 'v1' }))
            .baseline.samples[0].questions[0].teacherScore;
          return [1, 2, 3].map((repetitionOrdinal) => ({
            sampleId: 'sample-abcd', questionId: 'T1-4', repetitionOrdinal, state: 'SUCCEEDED',
            configId,
            gradingRun: { draftTotalScore: score },
          }));
        },
      },
      teacherAiGradingConversionAttempt: {
        findMany: async (args: any) => {
          const batchId = args.where?.batchId;
          if (batchId === 'candidate-batch') return [
            { sampleId: 'sample-abcd', questionId: 'T1-4', attemptOrdinal: 1, status: 'SUCCEEDED', visualEvidenceStatus: 'COMPLETE' },
            { sampleId: 'sample-abcd', questionId: 'T1-4', attemptOrdinal: 2, status: 'FAILED', visualEvidenceStatus: 'INCOMPLETE' },
          ];
          return [{ sampleId: 'sample-abcd', questionId: 'T1-4', attemptOrdinal: 1, status: 'SUCCEEDED', visualEvidenceStatus: 'NOT_APPLICABLE' }];
        },
      },
      teacherAiGradingExperimentBatch: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'baseline-batch') return { id: 'baseline-batch', configId: controlled.baselineConfiguration.configurationVersion, splitId: split.id };
          if (where.id === 'candidate-batch') return { id: 'candidate-batch', configId: controlled.candidateConfiguration.configurationVersion, splitId: split.id };
          return batches.find((row) => row.id === where.id || row.idempotencyKey === where.idempotencyKey) ?? null;
        },
        create: async ({ data }: any) => { batches.push(data); return data; },
        findMany: async (args: any) => args.where?.configId === configs.find((config) => config.snapshot?.processor?.controlledVisualExperiment?.evidenceChain === 'visual-evidence')?.id
          ? [{ id: 'candidate-batch' }] : [],
      },
      teacherAiGradingVisualEvidenceBlindJudgment: {
        findMany: async () => [{ visualEvidenceId: 'grading-run:visual-evidence:T1-4', version: 1, faithful: true, sufficientForScoring: true, misattributed: false }],
      },
      teacherAiGradingReportSnapshot: {
        findFirst: async () => null,
        create: async ({ data }: any) => { const snapshot = { id: `report-${reportSnapshots.length + 1}`, ...data }; reportSnapshots.push(snapshot); return snapshot; },
      },
    };
    const core = createTeacherAiGradingLabCore({
      db,
      datasetStore: runnableDatasetStore,
      artifactStore: { rawOutputWriter: {} as any, read: async () => Buffer.alloc(0), write: async () => undefined, delete: async () => undefined },
      conversion: { prepare: async () => { throw new Error('not-called'); } },
    });
    const frozen = await core.execute({
      kind: 'freeze-configuration',
      input: {
        split: { datasetId: split.datasetId, datasetVersion: split.datasetVersion, splitId: split.id, splitVersion: '1', contentHash: split.contentHash },
        idempotencyKey: 'freeze-1', seed: 7,
        prompt: component('prompt'), model: { ...component('model'), parameters: { temperature: 0 } },
        processor: component('processor'), metric: component('metric'),
      },
    });
    const controlled = await core.execute({
      kind: 'freeze-controlled-visual-experiment',
      input: {
        split: { datasetId: split.datasetId, datasetVersion: split.datasetVersion, splitId: split.id, splitVersion: '1', contentHash: split.contentHash },
        idempotencyKey: 'controlled-freeze-1',
        experimentId: 't2-visual-v1',
        seed: 7,
        maxAttempts: 5,
        prompt: component('prompt'),
        model: { ...component('model'), parameters: { temperature: 0 } },
        baselineProcessor: { ...component('text-chain'), evidenceChain: 'text-only' },
        candidateProcessor: {
          ...component('visual-chain'),
          evidenceChain: 'visual-evidence',
          visualEvidenceContractVersion: 'grading-visual-evidence.v1',
          visualPolicy: component('visual-policy'),
        },
        strata: [{ sampleId: 'sample-abcd', questionId: 'T1-4', questionType: 'hand-drawn', hasVisualEvidence: true }],
        metric: {
          ...component('metric'),
          thresholds: {
            maximumMeanAbsoluteError: 1,
            maximumAbsoluteMeanBias: 1,
            minimumExactRate: 0.8,
            minimumWithinTenPercentRate: 0.95,
            minimumExactStabilityRate: 0.9,
            minimumToleranceStabilityRate: 1,
            minimumVisualEvidenceCompletenessRate: 0.95,
            minimumProcessingSuccessRate: 0.95,
            minimumConversionSuccessRate: 0.95,
            minimumBlindFaithfulnessRate: 0.95,
            minimumBlindScoringSufficiencyRate: 0.9,
            maximumBlindMisattributionRate: 0,
          },
        },
      },
    });
    const run = await core.execute({
      kind: 'run-evaluation',
      input: { configuration: frozen, partition: 'tuning', idempotencyKey: 'batch-1' },
    });

    expect(run.evaluationRunId).toBe(batches[0].id);
    expect(executions).toHaveLength(3);
    expect(gradingRuns[0].rubricSnapshot.configurationContentHash).toBe(configs[0].rubricContentHash);
    expect(gradingRuns[0].rubricSnapshot.contentHash).not.toBe(configs[0].rubricContentHash);
    expect(gradingRuns[0].rubricSnapshot.criteria[0].levels.map((level: any) => level.minPoints)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(gradingRuns[0].rubricSnapshot.criteria[0].levels.every((level: any) => level.minPoints === level.maxPoints)).toBe(true);
    expect(controlled.experimentContentHash).toMatch(/^sha256:/);
    expect(configs.find((config) => config.id === controlled.candidateConfiguration.configurationVersion)?.snapshot.processor.controlledVisualExperiment)
      .toMatchObject({ evidenceChain: 'visual-evidence', maxAttempts: 5, thresholds: { minimumVisualEvidenceCompletenessRate: 0.95 } });

    const report = await core.execute({
      kind: 'build-controlled-visual-experiment-report',
      input: {
        baselineConfiguration: controlled.baselineConfiguration,
        candidateConfiguration: controlled.candidateConfiguration,
        baselineRun: { evaluationRunId: 'baseline-batch' },
        candidateRun: { evaluationRunId: 'candidate-batch' },
      },
    });

    expect(report.candidate.status).toBe('pass');
    expect(report.candidate.strata.all.visualEvidenceCompletenessRate).toBe(1);
    expect(reportSnapshots).toHaveLength(2);
  });

  it('loads only an owner-confirmed redacted copy and rejects every incomplete gate', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grading-lab-core-redaction-'));
    temporaryRoots.push(dataRoot);
    const ownerTeacherUserId = `c${'a'.repeat(24)}`;
    const sourceBytes = await identityBearingDocx();
    const datasetStore = createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot, ownerTeacherUserId });
    await datasetStore.importPackage(await buildSyntheticTeacherAiGradingPackage({ submissionBytes: sourceBytes }));
    const dataset = await datasetStore.load({ datasetId: 'synthetic-t1', datasetVersion: 'v1' });
    const conversionCalls: Buffer[] = [];

    await expect(dataset.readModelSubmission('sample-abcd', 'T1-4')).rejects.toMatchObject({ code: 'LAB_REDACTION_UNRESOLVED' });
    await expectRunBlockedWithoutConversion(datasetStore, conversionCalls);
    const redacted = await createTeacherAiGradingRedactedDocument({
      sampleId: 'sample-abcd', questionId: 'T1-4', sourceFileName: 'student-20231234.docx', sourceBytes,
      identityTerms: [{ kind: 'student-name', value: '张三' }, { kind: 'student-number', value: '20231234' }],
    });
    const unresolved = { ...redacted, unresolvedFindingCount: 1 };
    await dataset.saveRedaction({ document: unresolved, review: createTeacherAiGradingRedactionReview(unresolved) });
    await expect(dataset.readModelSubmission('sample-abcd', 'T1-4')).rejects.toMatchObject({ code: 'LAB_REDACTION_UNRESOLVED' });
    await expectRunBlockedWithoutConversion(datasetStore, conversionCalls);

    const review = createTeacherAiGradingRedactionReview(redacted);
    await dataset.saveRedaction({ document: redacted, review });
    await expect(dataset.readModelSubmission('sample-abcd', 'T1-4')).rejects.toMatchObject({ code: 'LAB_REDACTION_UNRESOLVED' });
    await expectRunBlockedWithoutConversion(datasetStore, conversionCalls);
    expect(conversionCalls).toHaveLength(0);

    const confirmed = confirmTeacherAiGradingRedaction({ review, redactedDocument: redacted, actorUserId: ownerTeacherUserId, ownerTeacherUserId });
    await dataset.saveRedaction({ document: redacted, review: confirmed });
    const modelSubmission = await dataset.readModelSubmission('sample-abcd', 'T1-4');
    expect(modelSubmission.documentBytes).toEqual(redacted.bytes);
    expect(modelSubmission.documentBytes).not.toEqual(sourceBytes);
    expect(modelSubmission.fileName).toBe('T1-4.docx');
    expect(modelSubmission.sourceChecksum).not.toBe(modelSubmission.checksum);
  });

  it('renews a live claim during long work and detects a stale owner', async () => {
    const row = {
      id: 'execution-heartbeat', state: 'RUNNING', claimToken: 'owner-1',
      leaseExpiresAt: new Date(Date.now() + 30), updatedAt: new Date(),
    };
    let renewalCount = 0;
    const db = {
      teacherAiGradingExperimentExecution: {
        updateMany: async ({ where, data }: any) => {
          if (row.id !== where.id || row.state !== where.state || row.claimToken !== where.claimToken
            || !(row.leaseExpiresAt > where.leaseExpiresAt.gt)) return { count: 0 };
          Object.assign(row, data);
          renewalCount += 1;
          return { count: 1 };
        },
        findUnique: async () => ({ ...row }),
      },
    };
    const heartbeat = startTeacherAiGradingClaimHeartbeat({
      db, datasetStore: {} as any, leaseMs: 30, heartbeatIntervalMs: 5,
    }, row.id, 'owner-1', () => new Date());
    await delay(55);
    heartbeat.checkpoint();
    expect(renewalCount).toBeGreaterThan(1);
    expect(row.leaseExpiresAt.getTime()).toBeGreaterThan(Date.now());
    await heartbeat.stop();

    row.claimToken = 'owner-2';
    row.leaseExpiresAt = new Date(Date.now() + 30);
    const stale = startTeacherAiGradingClaimHeartbeat({
      db, datasetStore: {} as any, leaseMs: 30, heartbeatIntervalMs: 5,
    }, row.id, 'owner-1', () => new Date());
    await delay(15);
    expect(() => stale.checkpoint()).toThrow('experiment-execution-fenced');
    await stale.stop();
  });
});

function component(id: string) {
  return { id, version: 'v1', contentHash: `sha256:${id.padEnd(64, '0').slice(0, 64)}` };
}

async function expectRunBlockedWithoutConversion(
  datasetStore: ReturnType<typeof createFileSystemTeacherAiGradingLabDatasetStore>,
  conversionCalls: Buffer[],
): Promise<void> {
  const loaded = await datasetStore.load({ datasetId: 'synthetic-t1', datasetVersion: 'v1' });
  const db = {
    teacherAiGradingExperimentConfig: { findUnique: async () => ({
      id: 'config-redaction', datasetId: 'synthetic-t1', datasetVersion: 'v1', datasetContentHash: loaded.contentHash, splitId: 'split-redaction',
    }) },
    teacherAiGradingLabSplitMember: { findMany: async () => [{ sampleId: 'sample-abcd' }] },
  };
  const core = createTeacherAiGradingLabCore({
    db,
    datasetStore,
    conversion: { prepare: async ({ submission }) => { conversionCalls.push(submission.documentBytes); throw new Error('unexpected-conversion'); } },
    artifactStore: { rawOutputWriter: {} as any, read: async () => Buffer.alloc(0), write: async () => undefined, delete: async () => undefined },
  });
  await expect(core.execute({
    kind: 'run-evaluation',
    input: { configuration: { configurationVersion: 'config-redaction' }, partition: 'tuning', idempotencyKey: 'redaction-gate' },
  })).rejects.toMatchObject({ code: 'LAB_REDACTION_UNRESOLVED' });
}

async function identityBearingDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    '<w:p><w:r><w:t>姓名：张三 学号：20231234</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>答案：系统稳定。</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join(''));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function visualDescriptionPolicy(): ExternalProcessingPolicy {
  return {
    provider: 'ai-evaluator', version: 'visual.v1', model: 'vision-model.v1', endpoint: 'https://provider.example/v1',
    purpose: 'visual-description', dataCategories: ['student-answer', 'student-answer-visual'],
    minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'], institutionScope: null,
    classScope: ['teacher-ai-grading-lab'], processingRegion: 'CN', agreementVersion: 'agreement.v1',
    noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 10,
    enabled: true, disabledAt: null, credentialRef: 'env:AI_PROVIDER_KEY',
  };
}

function visualDescriptionProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vision-provider', provider: 'ai-evaluator', version: 'vision-model.v1', capabilities: { vision: true },
    evaluate: vi.fn(async ({ user }: { user: string }) => ({
      output: {
        description: 'The page contains a hand-drawn diagram and labeled calculation steps.',
        confidence: 0.91,
        pageNumber: JSON.parse(user).pageNumber,
        limitations: [],
        ...overrides,
      },
      provider: 'vision-provider', providerRequestId: 'request-1', deletionHandle: 'delete-1',
      providerRequestedAt: new Date('2026-08-18T00:00:00.000Z'),
      providerProcessedAt: new Date('2026-08-18T00:00:01.000Z'),
    })),
  };
}

function visualConversionRequest(provider: ReturnType<typeof visualDescriptionProvider>) {
  return {
    evidenceChain: 'visual-evidence', executionId: 'execution-1', signal: undefined,
    submission: { questionId: 'T2-3' }, visualPolicy: visualDescriptionPolicy(), visualProvider: provider,
  } as any;
}

function visualConversionResult(overrides: Record<string, unknown> = {}) {
  const sourceChecksum = sha256(Buffer.from('source-document'));
  return {
    sourceChecksum, renderedBytes: Buffer.from('%PDF-1.7\nsynthetic'), adapterVersion: 'test-conversion.v1',
    markdown: 'Student response',
    blocks: [{
      id: 'block-1', blockIndex: 0, pageNumber: 1, text: 'Student response', markdown: 'Student response',
      spanStart: 0, spanEnd: 16, precision: 'block', confidence: 0.9,
    }],
    limitations: ['visual-evidence-not-delivered'],
    wordRepresentation: {
      renderedPdfPageCount: 1,
      images: [{ id: 'current-image', questionId: 'T2-3' }],
      imageAnchors: [{ imageId: 'current-image', questionId: 'T2-3', pdfPageNumber: 1, verified: true }],
    },
    ...overrides,
  } as any;
}

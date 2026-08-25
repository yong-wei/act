import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';

import { externalProcessingPolicyHash, normalizeDocumentEvidence, type ExternalProcessingPolicy, type NormalizedAnswerEvidence } from './math-document-grading-contracts';
import { convertProtectedSubmission, renderPdfPagesToPng } from './math-document-conversion';
import {
  buildGradingRunEvaluationIdentity,
  persistValidatedGradingDraft,
  questionContractFromSnapshot,
  toGradingProviderPolicySnapshot,
} from './math-document-grading-persistence';
import {
  buildGradingInputHash,
  evaluateFrozenQuestionEvidence,
  type GradingEvidenceAttachment,
  type GradingProviderRuntime,
  type ProviderRuntimeResult,
  type ValidatedGradingDraft,
} from './math-document-grading-evaluator';
import {
  createFileSystemTeacherAiGradingLabArtifactStore,
  type TeacherAiGradingLabArtifactStore,
} from './teacher-ai-grading-lab-artifact-store';
import { readTeacherAiGradingLabConfig, type TeacherAiGradingLabConfig } from './teacher-ai-grading-lab-contracts';
import {
  createFileSystemTeacherAiGradingLabDatasetStore,
  type LoadedTeacherAiGradingEvaluationDataset,
  type LoadedTeacherAiGradingLabDataset,
  type TeacherAiGradingLabDatasetStore,
} from './teacher-ai-grading-lab-dataset-store';
import type { TeacherAiGradingModelSubmission } from './teacher-ai-grading-lab-redaction';

export { createFileSystemTeacherAiGradingLabArtifactStore } from './teacher-ai-grading-lab-artifact-store';
export { createFileSystemTeacherAiGradingLabDatasetStore } from './teacher-ai-grading-lab-dataset-store';
import {
  appendAnnotationJudgment,
  appendBlindVisualEvidenceJudgment,
  appendConversionAttempt,
  appendProviderCallAttempt,
  listBlindVisualEvidenceProjections,
  persistReportSnapshot,
  type ProviderPricingInput,
} from './teacher-ai-grading-lab-evaluation-records';
import {
  buildTeacherAiGradingControlledVisualExperimentReport,
  freezeTeacherAiGradingControlledVisualExperiment,
  type TeacherAiGradingBlindVisualEvidenceJudgment,
  type TeacherAiGradingControlledExpectedQuestion,
  type TeacherAiGradingControlledVisualExperimentReport,
  type TeacherAiGradingQualityThresholds,
  type TeacherAiGradingVisualExperimentProcessor,
} from './teacher-ai-grading-lab-controlled-experiment';
import { describeVisualEvidence } from './visual-evidence-description';
import { normalizeVisualEvidence, projectVisualEvidenceIntoDocument, type VisualEvidence } from './visual-evidence-contract';
import {
  revealTeacherAiGradingHiddenAcceptance,
  startTeacherAiGradingHiddenAcceptance,
} from './teacher-ai-grading-lab-evaluation-store';
import { validateTeacherAiGradingPackageZip } from './teacher-ai-grading-lab-import';
import {
  buildTeacherAiGradingPartitionReport,
  toTeacherAiGradingBlindAnnotationDto,
  type TeacherAiGradingAnnotationJudgment,
  type TeacherAiGradingExecutionResult,
  type TeacherAiGradingExpectedSample,
  type TeacherAiGradingPartitionReport,
} from './teacher-ai-grading-lab-metrics';
import { createAndPersistTeacherAiGradingLabPdf } from './teacher-ai-grading-lab-pdf';
import {
  claim,
  createRunSet,
  fail,
  freezeConfig,
  loadBatch,
  recover,
  renew,
  type VersionedExperimentComponent,
} from './teacher-ai-grading-lab-run-store';
import { persistClaimedRawOutput } from './teacher-ai-grading-lab-runner';
import { createTeacherAiGradingLabSplit } from './teacher-ai-grading-lab-split';
import {
  appendTeacherAiGradingStructuredReviewVersion,
  getTeacherAiGradingPdfVerificationAggregate,
  recordTeacherAiGradingPdfVerification,
  registerTeacherAiGradingHiddenPdfSet,
  type TeacherAiGradingAnnotationCorrection,
  type TeacherAiGradingPdfVerificationChecks,
  type TeacherAiGradingScoreCorrection,
} from './teacher-ai-grading-lab-structured-review';

type CoreDb = Record<string, any>;

export interface TeacherAiGradingLabDatasetReference {
  datasetId: string;
  datasetVersion: string;
}

export interface TeacherAiGradingLabSplitReference extends TeacherAiGradingLabDatasetReference {
  splitId: string;
  splitVersion: string;
  contentHash: string;
}

export interface TeacherAiGradingLabFrozenConfigurationReference {
  configurationVersion: string;
}

export interface TeacherAiGradingLabEvaluationRunReference {
  evaluationRunId: string;
}

export interface TeacherAiGradingControlledVisualExperimentReference {
  experimentContentHash: string;
  baselineConfiguration: TeacherAiGradingLabFrozenConfigurationReference;
  candidateConfiguration: TeacherAiGradingLabFrozenConfigurationReference;
}

export interface TeacherAiGradingControlledVisualExperimentReportReference {
  baselineReportVersion: string;
  candidateReportVersion: string;
  baseline: TeacherAiGradingControlledVisualExperimentReport;
  candidate: TeacherAiGradingControlledVisualExperimentReport;
}

export interface TeacherAiGradingLabHumanJudgmentReference {
  judgmentVersion: string;
}

export interface TeacherAiGradingLabReportReference {
  reportVersion: string;
  report: TeacherAiGradingPartitionReport;
}

export interface TeacherAiGradingLabVersionedComponent extends VersionedExperimentComponent {}

export interface TeacherAiGradingLabModelComponent extends TeacherAiGradingLabVersionedComponent {
  parameters: Record<string, unknown>;
}

export interface TeacherAiGradingLabPreparedSample {
  evidence: NormalizedAnswerEvidence;
  evidenceBlocks: readonly Record<string, unknown>[];
  answerEvidenceId?: string;
  attachments?: readonly GradingEvidenceAttachment[];
  conversionAttempt: null | {
    attemptOrdinal: number;
    status: 'SUCCEEDED' | 'FAILED';
    stage: string;
    errorCode?: string | null;
    durationMs: number;
    conversionVersion: string;
    sourceHash: string;
    visualEvidenceStatus?: 'COMPLETE' | 'INCOMPLETE' | 'NOT_APPLICABLE';
    telemetryComplete: boolean;
  };
}

export interface TeacherAiGradingLabConversionAdapter {
  prepare(input: {
    dataset: LoadedTeacherAiGradingEvaluationDataset;
    sampleId: string;
    batchId: string;
    executionId: string;
    attemptOrdinal: number;
    evidenceChain: 'text-only' | 'visual-evidence';
    visualPolicy: ExternalProcessingPolicy | null;
    visualProvider?: GradingProviderRuntime;
    submission: TeacherAiGradingModelSubmission & { checksum: string; sourceChecksum: string };
    signal?: AbortSignal;
  }): Promise<TeacherAiGradingLabPreparedSample>;
}

export interface TeacherAiGradingLabCoreDependencies {
  db: CoreDb;
  datasetStore: TeacherAiGradingLabDatasetStore;
  artifactStore?: TeacherAiGradingLabArtifactStore;
  conversion?: TeacherAiGradingLabConversionAdapter;
  provider?: GradingProviderRuntime;
  providerPolicy?: ExternalProcessingPolicy | null;
  providerPolicyResolver?: (config: Readonly<Record<string, any>>) => Promise<ExternalProcessingPolicy | null>;
  visualProvider?: GradingProviderRuntime;
  visualProviderPolicy?: ExternalProcessingPolicy | null;
  visualProviderPolicyResolver?: (config: Readonly<Record<string, any>>) => Promise<ExternalProcessingPolicy | null>;
  providerClassId?: string;
  providerPricing?: ProviderPricingInput | null;
  pricingVersion?: string;
  leaseMs?: number;
  heartbeatIntervalMs?: number;
  clock?: () => Date;
}

export interface ImportTeacherAiGradingLabPackageInput { packageBytes: Buffer }
export interface ValidateTeacherAiGradingLabPackageInput { packageBytes: Buffer }
export interface CreateTeacherAiGradingLabSplitInput extends TeacherAiGradingLabDatasetReference { randomSeed: string; tuningRatio: number }
export interface FreezeTeacherAiGradingLabConfigurationInput {
  split: TeacherAiGradingLabSplitReference;
  idempotencyKey: string;
  seed: number;
  prompt: TeacherAiGradingLabVersionedComponent;
  model: TeacherAiGradingLabModelComponent;
  processor: TeacherAiGradingLabVersionedComponent;
  metric: TeacherAiGradingLabVersionedComponent;
}
export interface FreezeTeacherAiGradingControlledVisualExperimentInput {
  split: TeacherAiGradingLabSplitReference;
  idempotencyKey: string;
  experimentId: string;
  seed: number;
  maxAttempts?: number;
  prompt: TeacherAiGradingLabVersionedComponent;
  model: TeacherAiGradingLabModelComponent;
  baselineProcessor: TeacherAiGradingVisualExperimentProcessor;
  candidateProcessor: TeacherAiGradingVisualExperimentProcessor;
  strata: readonly { sampleId: string; questionId: string; questionType: string; hasVisualEvidence: boolean }[];
  metric: TeacherAiGradingLabVersionedComponent & { thresholds: TeacherAiGradingQualityThresholds };
}
export interface RunTeacherAiGradingLabEvaluationInput {
  configuration: TeacherAiGradingLabFrozenConfigurationReference;
  partition: 'tuning' | 'hidden';
  idempotencyKey: string;
  acceptanceId?: string;
  maxAttempts?: number;
}
export interface ResumeTeacherAiGradingLabEvaluationInput { run: TeacherAiGradingLabEvaluationRunReference }
export interface RevealTeacherAiGradingLabHiddenAcceptanceInput {
  acceptanceId: string;
  configuration: TeacherAiGradingLabFrozenConfigurationReference;
}
export interface TeacherAiGradingLabHiddenAcceptanceReference {
  acceptanceId: string;
  evaluationRunId: string;
  replay: boolean;
}

export type RecordTeacherAiGradingLabHumanJudgmentInput =
  | { judgmentKind: 'blind-annotation'; executionId: string; gradingAnnotationId: string; locationCorrect: boolean; reasonCorrect: boolean; suggestionCorrect: boolean; seriouslyMisleading: boolean; operatorUserId: string }
  | { judgmentKind: 'blind-visual-evidence'; executionId: string; visualEvidenceId: string; evidenceContentHash: string; faithful: boolean; sufficientForScoring: boolean; misattributed: boolean; operatorUserId: string }
  | { judgmentKind: 'structured-review'; executionId: string; parentVersionId: string | null; decision: 'accept' | 'correct'; scoreCorrections: readonly TeacherAiGradingScoreCorrection[]; annotationCorrections: readonly TeacherAiGradingAnnotationCorrection[]; operatorUserId: string }
  | { judgmentKind: 'pdf-verification'; acceptanceId: string; sampleId: string; derivativeId: string; expectedRevision: number; checks: TeacherAiGradingPdfVerificationChecks; blockingDefect: boolean; defectCode?: string | null; operatorUserId: string };

export interface BuildTeacherAiGradingLabReportInput { configuration: TeacherAiGradingLabFrozenConfigurationReference; partition: 'tuning' | 'hidden' }
export interface BuildTeacherAiGradingControlledVisualExperimentReportInput {
  baselineConfiguration: TeacherAiGradingLabFrozenConfigurationReference;
  candidateConfiguration: TeacherAiGradingLabFrozenConfigurationReference;
  baselineRun: TeacherAiGradingLabEvaluationRunReference;
  candidateRun: TeacherAiGradingLabEvaluationRunReference;
}
export interface ExportTeacherAiGradingLabPdfVerificationChecklistInput {
  acceptanceId: string;
  items: readonly { sampleId: string; sourceConversionId: string; selectedReviewVersionIds: readonly string[] }[];
}

export const TEACHER_AI_GRADING_LAB_CORE_OPERATION_KINDS = [
  'validate-package', 'import-package', 'create-split', 'freeze-configuration', 'freeze-controlled-visual-experiment',
  'run-evaluation', 'resume-evaluation', 'reveal-hidden-acceptance', 'record-human-judgment', 'build-report',
  'build-controlled-visual-experiment-report', 'export-pdf-verification-checklist',
] as const;

export interface TeacherAiGradingLabCoreOperationContract {
  'validate-package': { input: ValidateTeacherAiGradingLabPackageInput; result: { datasetId: string; datasetVersion: string; sampleCount: number } };
  'import-package': { input: ImportTeacherAiGradingLabPackageInput; result: { datasetId: string; datasetVersion: string; datasetKind: 'synthetic' | 'pilot' | 'preflight' | 'first-round'; sampleCount: number; runnable: false; redactionState: 'pending' } };
  'create-split': { input: CreateTeacherAiGradingLabSplitInput; result: TeacherAiGradingLabSplitReference };
  'freeze-configuration': { input: FreezeTeacherAiGradingLabConfigurationInput; result: TeacherAiGradingLabFrozenConfigurationReference };
  'freeze-controlled-visual-experiment': { input: FreezeTeacherAiGradingControlledVisualExperimentInput; result: TeacherAiGradingControlledVisualExperimentReference };
  'run-evaluation': { input: RunTeacherAiGradingLabEvaluationInput; result: TeacherAiGradingLabEvaluationRunReference };
  'resume-evaluation': { input: ResumeTeacherAiGradingLabEvaluationInput; result: TeacherAiGradingLabEvaluationRunReference };
  'reveal-hidden-acceptance': { input: RevealTeacherAiGradingLabHiddenAcceptanceInput; result: TeacherAiGradingLabHiddenAcceptanceReference };
  'record-human-judgment': { input: RecordTeacherAiGradingLabHumanJudgmentInput; result: TeacherAiGradingLabHumanJudgmentReference };
  'build-report': { input: BuildTeacherAiGradingLabReportInput; result: TeacherAiGradingLabReportReference };
  'build-controlled-visual-experiment-report': { input: BuildTeacherAiGradingControlledVisualExperimentReportInput; result: TeacherAiGradingControlledVisualExperimentReportReference };
  'export-pdf-verification-checklist': { input: ExportTeacherAiGradingLabPdfVerificationChecklistInput; result: { acceptanceId: string; items: Array<{ sampleId: string; derivativeId: string; revision: number; status: 'pending' }> } };
}

export type TeacherAiGradingLabCoreOperationKind = keyof TeacherAiGradingLabCoreOperationContract;
export type TeacherAiGradingLabCoreOperation<Kind extends TeacherAiGradingLabCoreOperationKind = TeacherAiGradingLabCoreOperationKind> = {
  [OperationKind in Kind]: { kind: OperationKind; input: TeacherAiGradingLabCoreOperationContract[OperationKind]['input'] };
}[Kind];
export type TeacherAiGradingLabCoreOperationResult<Kind extends TeacherAiGradingLabCoreOperationKind> = TeacherAiGradingLabCoreOperationContract[Kind]['result'];

export interface TeacherAiGradingLabCore {
  execute<Kind extends TeacherAiGradingLabCoreOperationKind>(operation: TeacherAiGradingLabCoreOperation<Kind>): Promise<TeacherAiGradingLabCoreOperationResult<Kind>>;
}

export function createTeacherAiGradingLabCore(dependencies: TeacherAiGradingLabCoreDependencies): TeacherAiGradingLabCore {
  const clock = dependencies.clock ?? (() => new Date());
  return {
    async execute(operation) {
      switch (operation.kind) {
        case 'validate-package': {
          const input = (operation as TeacherAiGradingLabCoreOperation<'validate-package'>).input;
          const validated = await validateTeacherAiGradingPackageZip(input.packageBytes);
          return { datasetId: validated.manifest.datasetId, datasetVersion: validated.manifest.datasetVersion, sampleCount: validated.manifest.samples.length } as never;
        }
        case 'import-package': return dependencies.datasetStore.importPackage((operation as TeacherAiGradingLabCoreOperation<'import-package'>).input.packageBytes) as never;
        case 'create-split': return createSplit(dependencies, (operation as TeacherAiGradingLabCoreOperation<'create-split'>).input, clock()) as never;
        case 'freeze-configuration': return freezeConfiguration(dependencies, (operation as TeacherAiGradingLabCoreOperation<'freeze-configuration'>).input, clock()) as never;
        case 'freeze-controlled-visual-experiment': return freezeControlledVisualExperiment(dependencies, (operation as TeacherAiGradingLabCoreOperation<'freeze-controlled-visual-experiment'>).input, clock()) as never;
        case 'run-evaluation': return runEvaluation(dependencies, (operation as TeacherAiGradingLabCoreOperation<'run-evaluation'>).input, clock) as never;
        case 'resume-evaluation': return resumeEvaluation(dependencies, (operation as TeacherAiGradingLabCoreOperation<'resume-evaluation'>).input, clock) as never;
        case 'reveal-hidden-acceptance': return revealHiddenAcceptance(dependencies, (operation as TeacherAiGradingLabCoreOperation<'reveal-hidden-acceptance'>).input, clock()) as never;
        case 'record-human-judgment': return recordHumanJudgment(dependencies.db, (operation as TeacherAiGradingLabCoreOperation<'record-human-judgment'>).input, clock()) as never;
        case 'build-report': return buildReport(dependencies, (operation as TeacherAiGradingLabCoreOperation<'build-report'>).input, clock()) as never;
        case 'build-controlled-visual-experiment-report': return buildControlledVisualExperimentReport(dependencies, (operation as TeacherAiGradingLabCoreOperation<'build-controlled-visual-experiment-report'>).input, clock()) as never;
        case 'export-pdf-verification-checklist': return exportPdfChecklist(dependencies, (operation as TeacherAiGradingLabCoreOperation<'export-pdf-verification-checklist'>).input, clock()) as never;
      }
    },
  };
}

async function createSplit(dependencies: TeacherAiGradingLabCoreDependencies, input: CreateTeacherAiGradingLabSplitInput, now: Date): Promise<TeacherAiGradingLabSplitReference> {
  const dataset = await dependencies.datasetStore.loadEvaluation(input);
  requireEvaluableDataset(dataset);
  const split = await createTeacherAiGradingLabSplit({
    db: dependencies.db, datasetId: dataset.datasetId, datasetVersion: dataset.datasetVersion,
    randomSeed: input.randomSeed, tuningRatio: input.tuningRatio,
    samples: dataset.manifest.samples.map(({ sampleId, scoreBand, primaryErrorType }) => ({ sampleId, scoreBand, primaryErrorType })), now,
    createHiddenAcceptance: dataset.manifest.datasetKind !== 'preflight',
  });
  return { datasetId: split.datasetId, datasetVersion: split.datasetVersion, splitId: split.id, splitVersion: String(split.version), contentHash: split.contentHash };
}

async function freezeConfiguration(dependencies: TeacherAiGradingLabCoreDependencies, input: FreezeTeacherAiGradingLabConfigurationInput, now: Date): Promise<TeacherAiGradingLabFrozenConfigurationReference> {
  const dataset = await dependencies.datasetStore.loadEvaluation(input.split);
  requireEvaluableDataset(dataset);
  const persistedSplit = await dependencies.db.teacherAiGradingLabSplit.findUnique({ where: { id: input.split.splitId } });
  if (!persistedSplit || persistedSplit.datasetId !== dataset.datasetId || persistedSplit.datasetVersion !== dataset.datasetVersion
    || String(persistedSplit.version) !== input.split.splitVersion || persistedSplit.contentHash !== input.split.contentHash) {
    throw new Error('teacher-ai-grading-freeze-split-mismatch');
  }
  const rubric = datasetRubric(dataset);
  const frozen = await freezeConfig({
    db: dependencies.db, idempotencyKey: input.idempotencyKey,
    dataset: { id: dataset.datasetId, version: dataset.datasetVersion, contentHash: dataset.contentHash },
    split: { id: persistedSplit.id, version: String(persistedSplit.version), contentHash: persistedSplit.contentHash },
    rubric, prompt: input.prompt, model: input.model, processor: input.processor, metric: input.metric, seed: input.seed, now,
  });
  return { configurationVersion: frozen.config.id };
}

async function freezeControlledVisualExperiment(
  dependencies: TeacherAiGradingLabCoreDependencies,
  input: FreezeTeacherAiGradingControlledVisualExperimentInput,
  now: Date,
): Promise<TeacherAiGradingControlledVisualExperimentReference> {
  const dataset = await dependencies.datasetStore.loadEvaluation(input.split);
  requireEvaluableDataset(dataset);
  const persistedSplit = await dependencies.db.teacherAiGradingLabSplit.findUnique({ where: { id: input.split.splitId } });
  if (!persistedSplit || persistedSplit.datasetId !== dataset.datasetId || persistedSplit.datasetVersion !== dataset.datasetVersion
    || String(persistedSplit.version) !== input.split.splitVersion || persistedSplit.contentHash !== input.split.contentHash) {
    throw new Error('teacher-ai-grading-freeze-split-mismatch');
  }
  const rubric = datasetRubric(dataset);
  const tuningMembers = await dependencies.db.teacherAiGradingLabSplitMember.findMany({
    where: { splitId: persistedSplit.id, partition: 'TUNING' },
    select: { sampleId: true },
  });
  assertControlledStrataComplete(dataset, new Set<string>(tuningMembers.map((member: any) => String(member.sampleId))), input.strata);
  const plan = freezeTeacherAiGradingControlledVisualExperiment({
    experimentId: input.experimentId,
    partition: 'tuning',
    dataset: { id: dataset.datasetId, version: dataset.datasetVersion, contentHash: dataset.contentHash },
    split: { id: persistedSplit.id, version: String(persistedSplit.version), contentHash: persistedSplit.contentHash },
    prompt: input.prompt,
    model: input.model,
    rubric,
    seed: input.seed,
    maxAttempts: input.maxAttempts,
    baselineProcessor: input.baselineProcessor,
    candidateProcessor: input.candidateProcessor,
    strata: input.strata,
    thresholds: input.metric.thresholds,
  });
  const shared = {
    split: input.split,
    seed: input.seed,
    prompt: input.prompt,
    model: input.model,
    metric: input.metric,
  };
  const baseline = await freezeConfiguration(dependencies, {
    ...shared,
    idempotencyKey: `${input.idempotencyKey}:text-only`,
    processor: controlledExperimentProcessor(plan, input.baselineProcessor),
  }, now);
  const candidate = await freezeConfiguration(dependencies, {
    ...shared,
    idempotencyKey: `${input.idempotencyKey}:visual-evidence`,
    processor: controlledExperimentProcessor(plan, input.candidateProcessor),
  }, now);
  return {
    experimentContentHash: plan.contentHash,
    baselineConfiguration: baseline,
    candidateConfiguration: candidate,
  };
}

function controlledExperimentProcessor(
  plan: ReturnType<typeof freezeTeacherAiGradingControlledVisualExperiment>,
  processor: TeacherAiGradingVisualExperimentProcessor,
): TeacherAiGradingVisualExperimentProcessor & { controlledVisualExperiment: Record<string, unknown> } {
  return {
    ...processor,
    controlledVisualExperiment: {
      schemaVersion: plan.schemaVersion,
      experimentId: plan.experimentId,
      contentHash: plan.contentHash,
      maxAttempts: plan.maxAttempts,
      evidenceChain: processor.evidenceChain,
      strata: plan.strata,
      thresholds: plan.thresholds,
    },
  };
}

function controlledEvidenceChain(config: { snapshot?: unknown }): 'text-only' | 'visual-evidence' {
  const processor = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).processor
    : null;
  const controlled = processor && typeof processor === 'object'
    ? (processor as Record<string, unknown>).controlledVisualExperiment
    : null;
  if (!controlled) return 'text-only';
  const evidenceChain = (controlled as Record<string, unknown>).evidenceChain;
  if (evidenceChain !== 'text-only' && evidenceChain !== 'visual-evidence') {
    throw new Error('teacher-ai-grading-controlled-experiment-chain-invalid');
  }
  return evidenceChain;
}

function assertFrozenVisualProviderPolicyBinding(config: { snapshot?: unknown }, policy: ExternalProcessingPolicy | null): void {
  if (!policy || policy.purpose !== 'visual-description') {
    throw new Error('teacher-ai-grading-controlled-visual-policy-unavailable');
  }
  const processor = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).processor
    : null;
  const visualPolicy = processor && typeof processor === 'object'
    ? (processor as Record<string, unknown>).visualPolicy
    : null;
  if (!visualPolicy || typeof visualPolicy !== 'object') {
    throw new Error('teacher-ai-grading-controlled-visual-policy-missing');
  }
  const expected = visualPolicy as Record<string, unknown>;
  if (expected.version !== policy.version || expected.contentHash !== externalProcessingPolicyHash(policy)) {
    throw new Error('teacher-ai-grading-controlled-visual-policy-drift');
  }
}

async function runEvaluation(dependencies: TeacherAiGradingLabCoreDependencies, input: RunTeacherAiGradingLabEvaluationInput, clock: () => Date): Promise<TeacherAiGradingLabEvaluationRunReference> {
  if (input.partition !== 'tuning' && input.partition !== 'hidden') throw new Error('teacher-ai-grading-partition-invalid');
  const config = await loadConfigContext(dependencies, input.configuration.configurationVersion);
  const maxAttempts = controlledMaxAttempts(config);
  if (maxAttempts !== undefined && input.maxAttempts !== undefined && input.maxAttempts !== maxAttempts) {
    throw new Error('teacher-ai-grading-controlled-experiment-max-attempts-drift');
  }
  const effectiveMaxAttempts = maxAttempts ?? input.maxAttempts;
  const dataset = await dependencies.datasetStore.loadEvaluation({ datasetId: config.datasetId, datasetVersion: config.datasetVersion });
  if (dataset.manifest.datasetKind === 'preflight' && input.partition !== 'tuning') {
    throw new Error('teacher-ai-grading-preflight-hidden-evaluation-forbidden');
  }
  const samples = await buildRunSamples(dependencies, config, input.partition);
  let batchId: string;
  if (input.partition === 'hidden') {
    if (!input.acceptanceId) throw new Error('teacher-ai-grading-hidden-acceptance-id-missing');
    await assertControlledHiddenAcceptanceEligible(dependencies, config);
    const started = await startTeacherAiGradingHiddenAcceptance({
      db: dependencies.db, acceptanceId: input.acceptanceId, configId: config.id, startKey: input.idempotencyKey,
      request: { partition: 'hidden', maxAttempts: effectiveMaxAttempts ?? 3 }, now: clock(),
      createBatch: async (db, context) => (await createRunSet({ db, configId: context.configId, splitId: context.splitId,
        idempotencyKey: input.idempotencyKey, samples: samples.filter((sample) => context.hiddenSampleIds.includes(sample.sampleId)), maxAttempts: effectiveMaxAttempts, now: clock() })).batch,
    });
    batchId = started.batchId;
  } else {
    batchId = (await createRunSet({ db: dependencies.db, configId: config.id, splitId: config.splitId,
      idempotencyKey: input.idempotencyKey, samples, maxAttempts: effectiveMaxAttempts, now: clock() })).batch.id;
  }
  await drainBatch(dependencies, batchId, clock);
  return { evaluationRunId: batchId };
}

async function resumeEvaluation(dependencies: TeacherAiGradingLabCoreDependencies, input: ResumeTeacherAiGradingLabEvaluationInput, clock: () => Date): Promise<TeacherAiGradingLabEvaluationRunReference> {
  const batch = await loadBatch(dependencies.db, input.run.evaluationRunId);
  const dataset = await dependencies.datasetStore.loadEvaluation({ datasetId: batch.config.datasetId, datasetVersion: batch.config.datasetVersion });
  requireEvaluableDataset(dataset);
  await recover({ db: dependencies.db, now: clock() });
  await drainBatch(dependencies, input.run.evaluationRunId, clock);
  return input.run;
}

async function revealHiddenAcceptance(
  dependencies: TeacherAiGradingLabCoreDependencies,
  input: RevealTeacherAiGradingLabHiddenAcceptanceInput,
  now: Date,
): Promise<TeacherAiGradingLabHiddenAcceptanceReference> {
  const config = await loadConfigContext(dependencies, input.configuration.configurationVersion);
  const revealed = await revealTeacherAiGradingHiddenAcceptance({
    db: dependencies.db,
    acceptanceId: input.acceptanceId,
    configId: config.id,
    now,
    loadRevealed: async (_db, context) => ({
      acceptanceId: context.acceptanceId,
      evaluationRunId: context.batchId,
    }),
  });
  return { ...revealed.result, replay: revealed.replay };
}

async function drainBatch(dependencies: TeacherAiGradingLabCoreDependencies, batchId: string, clock: () => Date): Promise<void> {
  if (!dependencies.conversion || !dependencies.artifactStore) throw new Error('teacher-ai-grading-lab-runner-not-configured');
  const batch = await loadBatch(dependencies.db, batchId);
  const claimBudget = Math.max(1, Number(batch.totalExecutions ?? 1) * Number(batch.maxAttempts ?? 3) + 10);
  for (let claimCount = 0; claimCount < claimBudget; claimCount += 1) {
    const claimed = await claim({ db: dependencies.db, batchId, leaseMs: dependencies.leaseMs, now: clock() });
    if (!claimed) return;
    const heartbeat = startTeacherAiGradingClaimHeartbeat(dependencies, claimed.execution.id, claimed.claimToken, clock);
    try {
      await executeClaim(dependencies, claimed.execution, claimed.claimToken, claimed.resumeStage, clock, heartbeat);
    } catch (error) {
      if (!isFencingError(error)) throw error;
    } finally {
      await heartbeat.stop();
    }
  }
  throw new Error('teacher-ai-grading-drain-claim-budget-exceeded');
}

async function executeClaim(
  dependencies: TeacherAiGradingLabCoreDependencies,
  execution: any,
  claimToken: string,
  resumeStage: 'raw-output' | undefined,
  clock: () => Date,
  heartbeat: TeacherAiGradingClaimHeartbeat,
): Promise<void> {
  const artifactStore = dependencies.artifactStore!;
  const stageKey = `teacher-ai-grading/staged/${encodeURIComponent(execution.id)}/pending.json`;
  try {
    if (resumeStage === 'raw-output') {
      heartbeat.checkpoint();
      const bytes = await artifactStore.read(stageKey);
      await persistClaimedRawOutput({
        db: dependencies.db, executionId: execution.id, claimToken, bytes, writer: artifactStore.rawOutputWriter,
        clock, signal: heartbeat.signal, beforeComplete: heartbeat.stop,
      });
      await artifactStore.delete(stageKey);
      return;
    }
    heartbeat.checkpoint();
    const context = await loadExecutionContext(dependencies, execution);
    const evidenceChain = controlledEvidenceChain(context.config);
    const latestConversion = await dependencies.db.teacherAiGradingConversionAttempt.findFirst({
      where: { batchId: execution.batchId, sampleId: execution.sampleId, questionId: execution.questionId },
      orderBy: { attemptOrdinal: 'desc' },
      select: { attemptOrdinal: true },
    });
    const conversionAttemptOrdinal = (latestConversion?.attemptOrdinal ?? 0) + 1;
    const conversionStartedAt = clock();
    let prepared: TeacherAiGradingLabPreparedSample;
    try {
      const visualPolicy = evidenceChain === 'visual-evidence'
        ? dependencies.visualProviderPolicy ?? await dependencies.visualProviderPolicyResolver?.(context.config) ?? null
        : null;
      if (evidenceChain === 'visual-evidence') assertFrozenVisualProviderPolicyBinding(context.config, visualPolicy);
      prepared = await dependencies.conversion!.prepare({
        dataset: context.dataset, sampleId: execution.sampleId, batchId: execution.batchId, executionId: execution.id,
        attemptOrdinal: conversionAttemptOrdinal, evidenceChain, visualPolicy, visualProvider: dependencies.visualProvider,
        submission: await context.dataset.readModelSubmission(execution.sampleId, execution.questionId), signal: heartbeat.signal,
      });
    } catch (error) {
      const sample = context.dataset.manifest.samples.find((candidate) => candidate.sampleId === execution.sampleId)!;
      const submission = sample.submissions.find((candidate) => candidate.questionId === execution.questionId)!;
      await appendConversionAttempt({
        db: dependencies.db, batchId: execution.batchId, sampleId: execution.sampleId, questionId: execution.questionId,
        attemptOrdinal: conversionAttemptOrdinal, status: 'FAILED', stage: 'conversion', errorCode: safeErrorCode(error),
        durationMs: Math.max(0, clock().getTime() - conversionStartedAt.getTime()),
        conversionVersion: context.config.processorVersion, sourceHash: submission.checksum,
        visualEvidenceStatus: evidenceChain === 'visual-evidence' ? 'INCOMPLETE' : 'NOT_APPLICABLE', telemetryComplete: true, now: clock(),
      });
      await settleClaimFailure(dependencies, heartbeat, { executionId: execution.id, claimToken, failureStage: 'conversion', errorCode: safeErrorCode(error), retryable: true, now: clock() });
      return;
    }
    heartbeat.checkpoint();
    if (prepared.conversionAttempt) await appendConversionAttempt({
      db: dependencies.db, batchId: execution.batchId, sampleId: execution.sampleId, questionId: execution.questionId,
      ...prepared.conversionAttempt, attemptOrdinal: conversionAttemptOrdinal, now: clock(),
    });
    let rawOutput: Uint8Array | null = null;
    let providerResult: ProviderRuntimeResult | null = null;
    let providerAttempt: { status: 'succeeded' | 'failed'; result?: ProviderRuntimeResult; error?: unknown } | null = null;
    let run = await dependencies.db.gradingRun.findUnique({ where: { id: execution.gradingRunId } });
    if (!prepared.answerEvidenceId && evidenceChain === 'visual-evidence') {
      throw new Error('teacher-ai-grading-controlled-visual-evidence-reference-missing');
    }
    if (prepared.answerEvidenceId) {
      const boundEvidence = await dependencies.db.gradingRun.updateMany({
        where: {
          id: run.id,
          state: 'RUNNING',
          OR: [
            { answerEvidenceId: null },
            { answerEvidenceId: prepared.answerEvidenceId },
          ],
        },
        data: { answerEvidenceId: prepared.answerEvidenceId, updatedAt: clock() },
      });
      if (boundEvidence.count !== 1) throw new Error('teacher-ai-grading-evidence-bind-fenced');
      run = { ...run, answerEvidenceId: prepared.answerEvidenceId };
    }
    const question = questionContractFromSnapshot(run);
    const scoringAttachments = (prepared.attachments ?? []).filter((attachment) => attachment.kind === 'image');
    const attachmentHashes = scoringAttachments.map((attachment) => attachment.checksum);
    const boundInputHash = buildGradingInputHash({
      question,
      evidence: prepared.evidence,
      evaluatorId: run.evaluatorId,
      evaluatorVersion: run.evaluatorVersion,
      attachmentHashes,
    });
    if (run.inputHash !== boundInputHash) {
      if (!String(run.inputHash).startsWith('unbound:')) throw new Error('teacher-ai-grading-frozen-input-drift');
      const bound = await dependencies.db.gradingRun.updateMany({
        where: { id: run.id, state: 'RUNNING', inputHash: run.inputHash },
        data: { inputHash: boundInputHash, updatedAt: clock() },
      });
      if (bound.count !== 1) throw new Error('grading-run-fenced');
      run = { ...run, inputHash: boundInputHash };
    }
    const providerPolicy = dependencies.providerPolicy
      ?? await dependencies.providerPolicyResolver?.(context.config)
      ?? null;
    if (providerPolicy) assertFrozenProviderPolicyBinding({ config: context.config, policy: providerPolicy });
    const providerClassId = dependencies.providerClassId
      ?? (typeof context.config.modelParameters?.providerClassId === 'string' ? context.config.modelParameters.providerClassId.trim() : '');
    if (!providerClassId) throw new Error('teacher-ai-grading-lab-provider-class-id-missing');
    const startedAt = clock();
    const draft = await evaluateFrozenQuestionEvidence({
      question, evidence: prepared.evidence, classId: providerClassId,
      policy: providerPolicy, provider: dependencies.provider, attachments: scoringAttachments,
      idempotencyKey: buildGradingRunEvaluationIdentity(run),
      onProviderAttempt: (attempt) => { providerAttempt = attempt; },
      onProviderResult: (result) => { providerResult = result; rawOutput = Buffer.from(JSON.stringify(result.output)); },
      signal: heartbeat.signal,
    });
    heartbeat.checkpoint();
    const durationMs = Math.max(0, clock().getTime() - startedAt.getTime());
    const capturedProviderResult = providerResult as ProviderRuntimeResult | null;
    const capturedProviderAttempt = providerAttempt as {
      status: 'succeeded' | 'failed';
      result?: ProviderRuntimeResult;
      error?: unknown;
    } | null;
    if (capturedProviderAttempt) {
      await appendProviderCallAttempt({
        db: dependencies.db, executionId: execution.id, claimToken, attemptOrdinal: execution.attemptCount, callOrdinal: 1,
        status: capturedProviderAttempt.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED', inputTokens: capturedProviderResult?.inputTokens ?? null,
        outputTokens: capturedProviderResult?.outputTokens ?? null, durationMs, pricing: dependencies.providerPricing ?? null,
        providerRequestId: capturedProviderResult?.providerRequestId ?? null,
        errorCode: capturedProviderAttempt.status === 'succeeded' ? null : safeErrorCode(capturedProviderAttempt.error),
        telemetryComplete: Boolean(capturedProviderResult?.telemetryComplete && dependencies.providerPricing), now: clock(),
      });
    }
    if (draft.state !== 'awaiting-review' || !rawOutput) {
      await settleClaimFailure(dependencies, heartbeat, { executionId: execution.id, claimToken, failureStage: 'provider',
        errorCode: safeErrorCode(draft.blockedReasons[0] ?? draft.state), retryable: draft.state === 'retryable', now: clock() });
      return;
    }
    await artifactStore.write(stageKey, rawOutput);
    await persistValidatedGradingDraft({
      db: dependencies.db, run, evidenceBlocks: prepared.evidenceBlocks, draft, now: clock(),
      afterPersist: async (db) => {
        const marked = await (db as CoreDb).teacherAiGradingExperimentExecution.updateMany({
          where: { id: execution.id, state: 'RUNNING', claimToken },
          data: { failureStage: 'raw-output', updatedAt: clock() },
        });
        if (marked.count !== 1) throw new Error('experiment-execution-fenced');
      },
    });
    try {
      await persistClaimedRawOutput({
        db: dependencies.db, executionId: execution.id, claimToken, bytes: rawOutput,
        writer: artifactStore.rawOutputWriter, clock, signal: heartbeat.signal, beforeComplete: heartbeat.stop,
      });
      await artifactStore.delete(stageKey);
    } catch (error) {
      await settleClaimFailure(dependencies, heartbeat, { executionId: execution.id, claimToken, failureStage: 'raw-output', errorCode: safeErrorCode(error), retryable: true, now: clock() });
    }
  } catch (error) {
    await settleClaimFailure(dependencies, heartbeat, { executionId: execution.id, claimToken, failureStage: 'persistence', errorCode: safeErrorCode(error), retryable: false, now: clock() });
  }
}

async function recordHumanJudgment(db: CoreDb, input: RecordTeacherAiGradingLabHumanJudgmentInput, now: Date): Promise<TeacherAiGradingLabHumanJudgmentReference> {
  if (input.judgmentKind === 'blind-annotation') {
    const row = await appendAnnotationJudgment({ db, ...input, now });
    return { judgmentVersion: row.id };
  }
  if (input.judgmentKind === 'blind-visual-evidence') {
    const row = await appendBlindVisualEvidenceJudgment({ db, ...input, now });
    return { judgmentVersion: row.id };
  }
  if (input.judgmentKind === 'structured-review') {
    const row = await appendTeacherAiGradingStructuredReviewVersion({ db, ...input, now });
    return { judgmentVersion: row.id };
  }
  if (input.judgmentKind !== 'pdf-verification') throw new Error('teacher-ai-grading-judgment-kind-invalid');
  const row = await recordTeacherAiGradingPdfVerification({ db, ...input, now });
  return { judgmentVersion: row.id };
}

async function buildReport(dependencies: TeacherAiGradingLabCoreDependencies, input: BuildTeacherAiGradingLabReportInput, now: Date): Promise<TeacherAiGradingLabReportReference> {
  if (input.partition !== 'tuning' && input.partition !== 'hidden') throw new Error('teacher-ai-grading-partition-invalid');
  const config = await loadConfigContext(dependencies, input.configuration.configurationVersion);
  const dataset = await dependencies.datasetStore.loadEvaluation({ datasetId: config.datasetId, datasetVersion: config.datasetVersion });
  if (dataset.manifest.datasetKind === 'preflight') throw new Error('teacher-ai-grading-preflight-report-forbidden');
  const partition = input.partition === 'tuning' ? 'TUNING' : 'HIDDEN';
  await requireTerminalPartitionRun(dependencies, config, partition);
  const acceptance = input.partition === 'hidden' ? await dependencies.db.teacherAiGradingHiddenAcceptance.findUnique({ where: { splitId: config.splitId } }) : null;
  const visibility = input.partition === 'hidden' && acceptance?.state !== 'CONSUMED' ? 'sealed' : 'revealed';
  const projection = await projectReportInput(dependencies, config, partition, visibility);
  const report = buildTeacherAiGradingPartitionReport(projection);
  const persisted = await persistReportSnapshot({
    db: dependencies.db, configId: config.id, splitId: config.splitId, partition: input.partition,
    metricVersion: config.metricVersion, pricingVersion: dependencies.pricingVersion ?? 'unpriced.v1',
    configurationContentHash: config.contentHash, snapshot: report as unknown as Record<string, unknown>, now,
  });
  return { reportVersion: persisted.snapshot.id, report };
}

async function buildControlledVisualExperimentReport(
  dependencies: TeacherAiGradingLabCoreDependencies,
  input: BuildTeacherAiGradingControlledVisualExperimentReportInput,
  now: Date,
): Promise<TeacherAiGradingControlledVisualExperimentReportReference> {
  const baselineConfig = await loadConfigContext(dependencies, input.baselineConfiguration.configurationVersion);
  const candidateConfig = await loadConfigContext(dependencies, input.candidateConfiguration.configurationVersion);
  const plan = controlledExperimentPlan(baselineConfig, candidateConfig);
  await Promise.all([
    requireTerminalEvaluationRun(dependencies, baselineConfig, input.baselineRun.evaluationRunId),
    requireTerminalEvaluationRun(dependencies, candidateConfig, input.candidateRun.evaluationRunId),
  ]);
  const evaluation = await dependencies.datasetStore.loadEvaluation({ datasetId: candidateConfig.datasetId, datasetVersion: candidateConfig.datasetVersion });
  requireEvaluableDataset(evaluation);
  const members = await dependencies.db.teacherAiGradingLabSplitMember.findMany({
    where: { splitId: candidateConfig.splitId, partition: 'TUNING' },
    select: { sampleId: true },
  });
  const memberIds = new Set<string>(members.map((member: any) => String(member.sampleId)));
  assertControlledStrataComplete(evaluation, memberIds, plan.strata);
  const dataset = await dependencies.datasetStore.load({ datasetId: candidateConfig.datasetId, datasetVersion: candidateConfig.datasetVersion });
  requireEvaluableDataset(dataset);
  const expected = controlledExpectedQuestions(dataset, memberIds, plan.strata);
  const baselineInput = await controlledReportInput(dependencies, baselineConfig, input.baselineRun.evaluationRunId, expected, false);
  const candidateInput = await controlledReportInput(dependencies, candidateConfig, input.candidateRun.evaluationRunId, expected, true);
  const baseline = buildTeacherAiGradingControlledVisualExperimentReport({
    plan,
    evidenceChain: 'text-only',
    evaluationRunId: input.baselineRun.evaluationRunId,
    expectedQuestions: expected,
    ...baselineInput,
  });
  const candidate = buildTeacherAiGradingControlledVisualExperimentReport({
    plan,
    evidenceChain: 'visual-evidence',
    evaluationRunId: input.candidateRun.evaluationRunId,
    expectedQuestions: expected,
    ...candidateInput,
  });
  const [baselinePersisted, candidatePersisted] = await Promise.all([
    persistReportSnapshot({
      db: dependencies.db, configId: baselineConfig.id, splitId: baselineConfig.splitId, partition: 'tuning',
      metricVersion: baselineConfig.metricVersion, pricingVersion: dependencies.pricingVersion ?? 'unpriced.v1',
      configurationContentHash: baselineConfig.contentHash, snapshot: baseline as unknown as Record<string, unknown>, now,
    }),
    persistReportSnapshot({
      db: dependencies.db, configId: candidateConfig.id, splitId: candidateConfig.splitId, partition: 'tuning',
      metricVersion: candidateConfig.metricVersion, pricingVersion: dependencies.pricingVersion ?? 'unpriced.v1',
      configurationContentHash: candidateConfig.contentHash, snapshot: candidate as unknown as Record<string, unknown>, now,
    }),
  ]);
  return {
    baselineReportVersion: baselinePersisted.snapshot.id,
    candidateReportVersion: candidatePersisted.snapshot.id,
    baseline,
    candidate,
  };
}

function controlledExperimentPlan(baselineConfig: any, candidateConfig: any) {
  const baselineProcessor = frozenProcessor(baselineConfig);
  const candidateProcessor = frozenProcessor(candidateConfig);
  const baselineControl = controlledSnapshot(baselineProcessor);
  const candidateControl = controlledSnapshot(candidateProcessor);
  if (baselineControl.evidenceChain !== 'text-only' || candidateControl.evidenceChain !== 'visual-evidence'
    || baselineControl.experimentId !== candidateControl.experimentId
    || baselineControl.contentHash !== candidateControl.contentHash
    || hashJson(controlledStrata(baselineControl)) !== hashJson(controlledStrata(candidateControl))) {
    throw new Error('teacher-ai-grading-controlled-experiment-pair-invalid');
  }
  const comparable = (config: any) => ({
    datasetId: config.datasetId,
    datasetVersion: config.datasetVersion,
    datasetContentHash: config.datasetContentHash,
    splitId: config.splitId,
    splitVersion: config.splitVersion,
    splitContentHash: config.splitContentHash,
    promptId: config.promptId,
    promptVersion: config.promptVersion,
    promptContentHash: config.promptContentHash,
    modelId: config.modelId,
    modelVersion: config.modelVersion,
    modelParameters: config.modelParameters,
    rubricId: config.rubricId,
    rubricVersion: config.rubricVersion,
    rubricContentHash: config.rubricContentHash,
    metricId: config.metricId,
    metricVersion: config.metricVersion,
    metricContentHash: config.metricContentHash,
    seed: config.seed,
  });
  if (hashJson(comparable(baselineConfig)) !== hashJson(comparable(candidateConfig))) {
    throw new Error('teacher-ai-grading-controlled-experiment-factor-drift');
  }
  const plan = freezeTeacherAiGradingControlledVisualExperiment({
    experimentId: String(baselineControl.experimentId),
    partition: 'tuning',
    dataset: { id: baselineConfig.datasetId, version: baselineConfig.datasetVersion, contentHash: baselineConfig.datasetContentHash },
    split: { id: baselineConfig.splitId, version: baselineConfig.splitVersion, contentHash: baselineConfig.splitContentHash },
    prompt: { id: baselineConfig.promptId, version: baselineConfig.promptVersion, contentHash: baselineConfig.promptContentHash },
    model: frozenModel(baselineConfig),
    rubric: { id: baselineConfig.rubricId, version: baselineConfig.rubricVersion, contentHash: baselineConfig.rubricContentHash },
    seed: baselineConfig.seed,
    maxAttempts: controlledMaxAttempts(baselineConfig),
    baselineProcessor,
    candidateProcessor,
    strata: controlledStrata(baselineControl),
    thresholds: baselineControl.thresholds as TeacherAiGradingQualityThresholds,
  });
  if (plan.contentHash !== baselineControl.contentHash) throw new Error('teacher-ai-grading-controlled-experiment-plan-drift');
  return plan;
}

function controlledStrata(snapshot: Record<string, unknown>): Array<{ sampleId: string; questionId: string; questionType: string; hasVisualEvidence: boolean }> {
  const strata = snapshot.strata;
  if (!Array.isArray(strata)) throw new Error('teacher-ai-grading-controlled-experiment-strata-missing');
  return strata.map((stratum) => {
    if (!stratum || typeof stratum !== 'object') throw new Error('teacher-ai-grading-controlled-experiment-strata-invalid');
    const record = stratum as Record<string, unknown>;
    if (typeof record.sampleId !== 'string' || typeof record.questionId !== 'string'
      || typeof record.questionType !== 'string' || typeof record.hasVisualEvidence !== 'boolean') {
      throw new Error('teacher-ai-grading-controlled-experiment-strata-invalid');
    }
    return {
      sampleId: record.sampleId,
      questionId: record.questionId,
      questionType: record.questionType,
      hasVisualEvidence: record.hasVisualEvidence,
    };
  });
}

function controlledMaxAttempts(config: { snapshot?: unknown }): number | undefined {
  const processor = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).processor
    : null;
  const controlled = processor && typeof processor === 'object'
    ? (processor as Record<string, unknown>).controlledVisualExperiment
    : null;
  if (!controlled || typeof controlled !== 'object') return undefined;
  const maxAttempts = (controlled as Record<string, unknown>).maxAttempts;
  if (maxAttempts === undefined) return undefined;
  if (!Number.isInteger(maxAttempts) || (maxAttempts as number) < 1) {
    throw new Error('teacher-ai-grading-controlled-experiment-max-attempts-invalid');
  }
  return maxAttempts as number;
}

function frozenProcessor(config: any): TeacherAiGradingVisualExperimentProcessor {
  const processor = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).processor
    : null;
  if (!processor || typeof processor !== 'object') throw new Error('teacher-ai-grading-controlled-experiment-processor-missing');
  return processor as TeacherAiGradingVisualExperimentProcessor;
}

function frozenModel(config: any): TeacherAiGradingLabModelComponent {
  const model = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).model
    : null;
  if (!model || typeof model !== 'object') throw new Error('teacher-ai-grading-controlled-experiment-model-missing');
  const record = model as Record<string, unknown>;
  if (record.id !== config.modelId || record.version !== config.modelVersion || hashJson(record.parameters) !== hashJson(config.modelParameters)) {
    throw new Error('teacher-ai-grading-controlled-experiment-model-drift');
  }
  return record as unknown as TeacherAiGradingLabModelComponent;
}

function controlledSnapshot(processor: TeacherAiGradingVisualExperimentProcessor): Record<string, unknown> {
  const snapshot = (processor as unknown as Record<string, unknown>).controlledVisualExperiment;
  if (!snapshot || typeof snapshot !== 'object') throw new Error('teacher-ai-grading-controlled-experiment-snapshot-missing');
  return snapshot as Record<string, unknown>;
}

async function assertControlledHiddenAcceptanceEligible(dependencies: TeacherAiGradingLabCoreDependencies, config: any): Promise<void> {
  const processor = config.snapshot && typeof config.snapshot === 'object'
    ? (config.snapshot as Record<string, unknown>).processor
    : null;
  const controlled = processor && typeof processor === 'object'
    ? (processor as Record<string, unknown>).controlledVisualExperiment
    : null;
  if (!controlled) return;
  const snapshot = controlled as Record<string, unknown>;
  if (snapshot.evidenceChain !== 'visual-evidence') {
    throw new Error('teacher-ai-grading-controlled-hidden-candidate-required');
  }
  const reports = await dependencies.db.teacherAiGradingReportSnapshot.findMany({
    where: { configId: config.id, splitId: config.splitId, partition: 'TUNING' },
    orderBy: { createdAt: 'desc' },
    select: { snapshot: true },
  });
  const passed = reports.some((report: any) => {
    const reportSnapshot = report.snapshot;
    return reportSnapshot && typeof reportSnapshot === 'object'
      && (reportSnapshot as Record<string, unknown>).experimentId === snapshot.experimentId
      && (reportSnapshot as Record<string, unknown>).evidenceChain === 'visual-evidence'
      && (reportSnapshot as Record<string, unknown>).status === 'pass';
  });
  if (!passed) throw new Error('teacher-ai-grading-controlled-hidden-tuning-gate-failed');
}

function controlledExpectedQuestions(
  dataset: LoadedTeacherAiGradingLabDataset,
  memberIds: ReadonlySet<string>,
  strata: readonly { sampleId: string; questionId: string; questionType: string; hasVisualEvidence: boolean }[],
): TeacherAiGradingControlledExpectedQuestion[] {
  const baseline = dataset.baseline.samples
    .filter((sample) => memberIds.has(sample.sampleId))
    .flatMap((sample) => sample.questions.map((question) => ({ sampleId: sample.sampleId, questionId: question.questionId, maxScore: question.maxScore, teacherScore: question.teacherScore })));
  const strataByQuestion = new Map(strata.map((stratum) => [`${stratum.sampleId}\u0000${stratum.questionId}`, stratum]));
  if (strataByQuestion.size !== strata.length || strata.length !== baseline.length) throw new Error('teacher-ai-grading-controlled-experiment-strata-incomplete');
  return baseline.map((question) => {
    const stratum = strataByQuestion.get(`${question.sampleId}\u0000${question.questionId}`);
    if (!stratum) throw new Error('teacher-ai-grading-controlled-experiment-stratum-missing');
    return { ...question, questionType: stratum.questionType, hasVisualEvidence: stratum.hasVisualEvidence };
  });
}

function assertControlledStrataComplete(
  dataset: LoadedTeacherAiGradingEvaluationDataset,
  memberIds: ReadonlySet<string>,
  strata: readonly { sampleId: string; questionId: string }[],
): void {
  const expected = new Set([...memberIds].flatMap((sampleId) => (
    dataset.questions.questions.map((question) => `${sampleId}\u0000${question.questionId}`)
  )));
  const actual = new Set(strata.map((stratum) => `${stratum.sampleId}\u0000${stratum.questionId}`));
  if (actual.size !== strata.length || actual.size !== expected.size || [...expected].some((key) => !actual.has(key))) {
    throw new Error('teacher-ai-grading-controlled-experiment-strata-incomplete');
  }
}

async function controlledReportInput(
  dependencies: TeacherAiGradingLabCoreDependencies,
  config: any,
  evaluationRunId: string,
  expected: readonly TeacherAiGradingControlledExpectedQuestion[],
  includeBlindReview: boolean,
) {
  const batch = await dependencies.db.teacherAiGradingExperimentBatch.findUnique({
    where: { id: evaluationRunId },
    select: { id: true, configId: true, splitId: true },
  });
  if (!batch || batch.configId !== config.id || batch.splitId !== config.splitId) {
    throw new Error('teacher-ai-grading-controlled-experiment-run-mismatch');
  }
  const rows = await dependencies.db.teacherAiGradingExperimentExecution.findMany({
    where: { batchId: batch.id },
    select: { sampleId: true, questionId: true, repetitionOrdinal: true, state: true, gradingRun: { select: { draftTotalScore: true } } },
  });
  const conversions = await dependencies.db.teacherAiGradingConversionAttempt.findMany({
    where: { batchId: batch.id },
    select: { sampleId: true, questionId: true, attemptOrdinal: true, status: true, visualEvidenceStatus: true },
  });
  const expectedKeys = new Set(expected.map((question) => `${question.sampleId}\u0000${question.questionId}`));
  const selectedConversions = new Map<string, any>();
  for (const conversion of conversions) {
    const key = `${conversion.sampleId}\u0000${conversion.questionId}`;
    if (!expectedKeys.has(key)) continue;
    const selected = selectedConversions.get(key);
    if (!selected
      || (conversion.status === 'SUCCEEDED' && selected.status !== 'SUCCEEDED')
      || (conversion.status === selected.status && conversion.attemptOrdinal > selected.attemptOrdinal)) {
      selectedConversions.set(key, conversion);
    }
  }
  const blindItems = includeBlindReview
    ? await listBlindVisualEvidenceProjections({ db: dependencies.db, batchId: batch.id })
    : [];
  const blindEvidenceIds = new Set(blindItems.map((item) => item.evidenceId));
  const judgmentRows = includeBlindReview
    ? await dependencies.db.teacherAiGradingVisualEvidenceBlindJudgment.findMany({
        where: { configId: config.id },
        orderBy: { version: 'desc' },
        select: { visualEvidenceId: true, faithful: true, sufficientForScoring: true, misattributed: true },
      })
    : [];
  const seenJudgments = new Set<string>();
  const blindJudgments: TeacherAiGradingBlindVisualEvidenceJudgment[] = judgmentRows.flatMap((row: any) => {
    if (!blindEvidenceIds.has(row.visualEvidenceId) || seenJudgments.has(row.visualEvidenceId)) return [];
    seenJudgments.add(row.visualEvidenceId);
    return [{ evidenceId: row.visualEvidenceId, faithful: row.faithful, sufficientForScoring: row.sufficientForScoring, misattributed: row.misattributed }];
  });
  return {
    executions: rows.filter((row: any) => expectedKeys.has(`${row.sampleId}\u0000${row.questionId}`)).map((row: any) => ({
      sampleId: row.sampleId,
      questionId: row.questionId,
      repetitionOrdinal: row.repetitionOrdinal,
      status: row.state === 'SUCCEEDED' ? 'succeeded' as const : 'failed' as const,
      score: row.gradingRun?.draftTotalScore ?? undefined,
    })),
    conversions: [...selectedConversions.values()].map((row: any) => ({
      sampleId: row.sampleId,
      questionId: row.questionId,
      status: row.status === 'SUCCEEDED' ? 'succeeded' as const : 'failed' as const,
      visualEvidenceStatus: row.visualEvidenceStatus === 'COMPLETE'
        ? 'complete' as const
        : row.visualEvidenceStatus === 'INCOMPLETE'
          ? 'incomplete' as const
          : 'not-applicable' as const,
    })),
    blindItems,
    blindJudgments,
  };
}

async function exportPdfChecklist(dependencies: TeacherAiGradingLabCoreDependencies, input: ExportTeacherAiGradingLabPdfVerificationChecklistInput, now: Date) {
  if (!dependencies.artifactStore) throw new Error('teacher-ai-grading-lab-artifact-store-not-configured');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('teacher-ai-grading-pdf-items-missing');
  const derivatives: Array<{ sampleId: string; derivativeId: string }> = [];
  for (const item of [...input.items].sort((left, right) => left.sampleId.localeCompare(right.sampleId))) {
    const conversion = await dependencies.db.documentConversion.findUnique({
      where: { id: item.sourceConversionId },
      include: { answerEvidence: { select: { anchorVersion: true } } },
    });
    if (!conversion?.renderedObjectKey || !conversion.renderedChecksum || !conversion.answerEvidence?.anchorVersion) {
      throw new Error('teacher-ai-grading-pdf-source-conversion-missing');
    }
    const renderedBytes = await dependencies.artifactStore.read(conversion.renderedObjectKey);
    const derivativeId = `grading-lab-derivative:${hashText(`${input.acceptanceId}:${item.sampleId}:${item.selectedReviewVersionIds.join(',')}`).slice(7, 39)}`;
    const splitId = await acceptanceSplitId(dependencies.db, input.acceptanceId);
    const created = await createAndPersistTeacherAiGradingLabPdf({
      db: dependencies.db, derivativeId, splitId,
      sampleId: item.sampleId, sourceConversionId: item.sourceConversionId,
      renderedPdf: { objectKey: conversion.renderedObjectKey, checksum: conversion.renderedChecksum, sizeBytes: renderedBytes.byteLength, bytes: renderedBytes },
      selectedReviewVersionIds: item.selectedReviewVersionIds, anchorVersion: conversion.answerEvidence.anchorVersion, now,
    });
    const artifactKey = `teacher-ai-grading/pdf-derivatives/${encodeURIComponent(derivativeId)}.pdf`;
    await dependencies.artifactStore.write(artifactKey, created.bytes);
    const stored = await dependencies.artifactStore.read(artifactKey);
    if (hashBytes(stored) !== created.derivative.contentChecksum) throw new Error('teacher-ai-grading-pdf-artifact-checksum-mismatch');
    derivatives.push({ sampleId: item.sampleId, derivativeId });
  }
  await registerTeacherAiGradingHiddenPdfSet({ db: dependencies.db, acceptanceId: input.acceptanceId, derivatives, now });
  return { acceptanceId: input.acceptanceId, items: derivatives.map((item) => ({ ...item, revision: 0, status: 'pending' as const })) };
}

async function loadConfigContext(dependencies: TeacherAiGradingLabCoreDependencies, configId: string): Promise<any> {
  const config = await dependencies.db.teacherAiGradingExperimentConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error('teacher-ai-grading-configuration-not-found');
  return config;
}

export function assertFrozenProviderPolicyBinding(input: {
  config: { modelId?: string | null; modelVersion?: string | null; modelParameters?: unknown };
  policy: Pick<ExternalProcessingPolicy, 'provider' | 'model' | 'version'>;
}): void {
  const parameters = input.config.modelParameters && typeof input.config.modelParameters === 'object'
    ? input.config.modelParameters as Record<string, unknown>
    : {};
  if (parameters.providerPolicyVersion !== input.policy.version) throw new Error('teacher-ai-grading-provider-policy-version-mismatch');
  if (input.config.modelId !== input.policy.provider || input.config.modelVersion !== input.policy.model) {
    throw new Error('teacher-ai-grading-provider-model-identity-mismatch');
  }
}

async function buildRunSamples(dependencies: TeacherAiGradingLabCoreDependencies, config: any, partition: 'tuning' | 'hidden') {
  const dataset = await dependencies.datasetStore.loadEvaluation({ datasetId: config.datasetId, datasetVersion: config.datasetVersion });
  requireEvaluableDataset(dataset);
  if (dataset.contentHash !== config.datasetContentHash) throw new Error('teacher-ai-grading-dataset-drift');
  const members = await dependencies.db.teacherAiGradingLabSplitMember.findMany({ where: { splitId: config.splitId, partition: partition === 'tuning' ? 'TUNING' : 'HIDDEN' }, select: { sampleId: true } });
  const sampleIds = new Set<string>(members.map((member: any) => String(member.sampleId)));
  await Promise.all([...sampleIds].flatMap((sampleId) => dataset.questions.questions.map((question) => (
    dataset.readModelSubmission(sampleId, question.questionId)
  ))));
  return dataset.manifest.samples.filter((sample) => sampleIds.has(sample.sampleId)).map((sample) => ({
    sampleId: sample.sampleId,
    questions: dataset.questions.questions.map((question) => questionRunSeed(dataset, question, config)),
  }));
}

async function loadExecutionContext(dependencies: TeacherAiGradingLabCoreDependencies, execution: any) {
  const config = await loadConfigContext(dependencies, execution.configId);
  const dataset = await dependencies.datasetStore.loadEvaluation({ datasetId: config.datasetId, datasetVersion: config.datasetVersion });
  requireEvaluableDataset(dataset);
  if (dataset.contentHash !== config.datasetContentHash) throw new Error('teacher-ai-grading-dataset-drift');
  return { config, dataset };
}

function datasetRubric(dataset: LoadedTeacherAiGradingEvaluationDataset): VersionedExperimentComponent {
  const body = { questions: dataset.questions.questions.map((question) => rubricForQuestion(question)) };
  return { id: `dataset-rubric:${dataset.datasetId}`, version: dataset.datasetVersion, contentHash: hashJson(body) };
}

function requireEvaluableDataset(dataset: LoadedTeacherAiGradingEvaluationDataset): void {
  if (dataset.manifest.datasetKind === 'pilot') {
    throw new Error('teacher-ai-grading-pilot-dataset-evaluation-forbidden');
  }
}

function questionRunSeed(dataset: LoadedTeacherAiGradingEvaluationDataset, question: any, config: any) {
  const rubric = rubricForQuestion(question, {
    id: config.rubricId,
    version: config.rubricVersion,
    configurationContentHash: config.rubricContentHash,
  });
  const origin = { kind: 'evaluation-package', datasetId: dataset.datasetId, datasetVersion: dataset.datasetVersion };
  const prompt = Object.values(question.sections)[0] as { snippet: string };
  const reference = Object.values(question.sections)[1] as { snippet: string };
  const body = {
    assignmentRevisionId: null, questionId: question.questionId, stableQuestionId: question.questionId,
    responseType: 'SUBJECTIVE_FILE', prompt: prompt.snippet, referenceAnswer: reference.snippet, rubric, origin,
  };
  const questionSnapshot = { ...body, contentHash: hashJson(body) };
  return {
    questionId: question.questionId, inputHash: `unbound:${hashText(`${dataset.contentHash}:${question.questionId}:${config.contentHash}`).slice(7)}`,
    questionSnapshotHash: questionSnapshot.contentHash, rubricId: config.rubricId, rubricVersion: config.rubricVersion,
    evaluatorId: config.modelId, evaluatorVersion: config.modelVersion, questionSnapshot,
    rubricSnapshot: rubric, referenceAnswer: reference.snippet,
  };
}

function rubricForQuestion(question: any, identity?: { id: string; version: string; configurationContentHash: string }) {
  const body = {
    schemaVersion: 'assignment-analytic-rubric.v1',
    id: identity?.id ?? `dataset-rubric:${question.questionId}`,
    version: identity?.version ?? 'v1',
    ...(identity ? { configurationContentHash: identity.configurationContentHash } : {}),
    maxScore: question.maxScore,
    criteria: question.rubricItems.map((item: any) => ({
      id: item.id, label: item.label, goalDimension: item.group ?? 'grading', maxPoints: item.points,
      evidenceDescription: item.trace.snippet, feedbackGuidance: item.trace.snippet,
      levels: halfPointLevels(item.points),
    })),
  };
  return { ...body, contentHash: hashJson(body) };
}

function halfPointLevels(maxPoints: number) {
  return Array.from({ length: Math.round(maxPoints * 2) + 1 }, (_, index) => {
    const score = index / 2;
    return {
      id: `score-${String(score).replace('.', '_')}`,
      label: `${score} 分`,
      minPoints: score,
      maxPoints: score,
      description: `Award ${score} points for this criterion.`,
    };
  });
}

async function projectReportInput(dependencies: TeacherAiGradingLabCoreDependencies, config: any, partition: 'TUNING' | 'HIDDEN', visibility: 'sealed' | 'revealed') {
  const dataset = await dependencies.datasetStore.load({ datasetId: config.datasetId, datasetVersion: config.datasetVersion });
  requireEvaluableDataset(dataset);
  const members = await dependencies.db.teacherAiGradingLabSplitMember.findMany({ where: { splitId: config.splitId, partition }, select: { sampleId: true } });
  const memberIds = new Set(members.map((row: any) => row.sampleId));
  const expectedSamples: TeacherAiGradingExpectedSample[] = dataset.baseline.samples.filter((sample) => memberIds.has(sample.sampleId)).map((sample) => ({
    sampleId: sample.sampleId,
    questions: sample.questions.map((question) => ({ questionId: question.questionId, maxScore: question.maxScore, teacherScore: question.teacherScore,
      expectedDeductionIds: dataset.baseline.gradingBasis === 'structured-deductions'
        ? question.deductions.map((deduction) => deduction.criterionId)
        : undefined })),
  }));
  const rows = visibility === 'sealed' ? [] : await dependencies.db.teacherAiGradingExperimentExecution.findMany({
    where: { configId: config.id, splitId: config.splitId, sampleId: { in: [...memberIds] } },
    include: { gradingRun: { include: { assessments: true, annotations: true } }, providerCalls: true },
  });
  const executions: TeacherAiGradingExecutionResult[] = rows.map((row: any) => ({
    sampleId: row.sampleId, questionId: row.questionId, repetitionOrdinal: row.repetitionOrdinal,
    status: row.state === 'SUCCEEDED' ? 'succeeded' : 'failed', score: row.gradingRun?.draftTotalScore ?? undefined,
    annotations: (row.gradingRun?.annotations ?? []).map((annotation: any) => ({ annotationId: annotation.id, criterionId: annotation.criterionId,
      issueIdentity: hashJson({ criterionId: annotation.criterionId, comment: annotation.comment }), evidenceIdentity: hashJson({ blockId: annotation.blockId, excerpt: annotation.excerpt }) })),
    providerStage: row.providerCalls.length > 0 ? 'called' : 'not_reached',
    providerTelemetryComplete: row.providerCalls.length === 0 || row.providerCalls.every((call: any) => call.telemetryComplete),
    providerCalls: row.providerCalls.map((call: any) => ({ attemptOrdinal: call.attemptOrdinal, callOrdinal: call.callOrdinal,
      status: call.status === 'SUCCEEDED' ? 'succeeded' : 'failed', inputTokens: call.inputTokens, outputTokens: call.outputTokens,
      durationMs: call.durationMs, estimatedCostMicros: call.estimatedCostMicros?.toString() ?? null, pricingVersion: call.pricingVersion,
      telemetryComplete: call.telemetryComplete })),
  }));
  const conversions = visibility === 'sealed' ? [] : await dependencies.db.teacherAiGradingConversionAttempt.findMany({ where: { batch: { configId: config.id }, sampleId: { in: [...memberIds] } } });
  const judgments = visibility === 'sealed' ? [] : await dependencies.db.teacherAiGradingAnnotationJudgment.findMany({ where: { execution: { configId: config.id, sampleId: { in: [...memberIds] } } } });
  const pdf = partition === 'HIDDEN' && visibility === 'revealed'
    ? await getTeacherAiGradingPdfVerificationAggregate({ db: dependencies.db, acceptanceId: (await dependencies.db.teacherAiGradingHiddenAcceptance.findUnique({ where: { splitId: config.splitId } })).id })
    : null;
  return {
    partition: partition === 'TUNING' ? 'tuning' as const : 'hidden' as const, visibility,
    metricVersion: config.metricVersion, configurationContentHash: config.contentHash, pricingVersion: dependencies.pricingVersion ?? 'unpriced.v1',
    expectedSamples, executions,
    conversions: collapseConversionAttempts(conversions),
    sampleDurations: sampleDurations(rows),
    batchWallClockMs: batchWallClock(rows),
    blindAnnotationItems: toTeacherAiGradingBlindAnnotationDto(executions),
    annotationJudgments: judgments.map((row: any): TeacherAiGradingAnnotationJudgment => ({ annotationId: row.gradingAnnotationId,
      locationCorrect: row.locationCorrect, reasonCorrect: row.reasonCorrect, suggestionCorrect: row.suggestionCorrect, seriouslyMisleading: row.seriouslyMisleading })),
    pdfVerificationStatus: partition === 'TUNING' ? 'not_applicable' as const : pdf?.status ?? 'pending' as const,
  };
}

function collapseConversionAttempts(rows: any[]) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = `${row.sampleId}\u0000${row.questionId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].map((attempts) => {
    const ordered = [...attempts].sort((left, right) => left.attemptOrdinal - right.attemptOrdinal);
    const successful = ordered.find((row) => row.status === 'SUCCEEDED');
    const final = successful ?? ordered.at(-1)!;
    return {
      sampleId: final.sampleId,
      questionId: final.questionId,
      status: successful ? 'succeeded' as const : 'failed' as const,
      stage: final.stage,
      durationMs: ordered.reduce((total, row) => total + row.durationMs, 0),
      conversionVersion: final.conversionVersion,
      sourceHash: final.sourceHash,
      telemetryComplete: ordered.every((row) => row.telemetryComplete),
    };
  });
}

function sampleDurations(rows: any[]): Array<{ sampleId: string; durationMs: number }> {
  const grouped = new Map<string, Date[]>();
  for (const row of rows) if (row.startedAt && row.completedAt) grouped.set(row.sampleId, [...(grouped.get(row.sampleId) ?? []), row.startedAt, row.completedAt]);
  return [...grouped].map(([sampleId, dates]) => ({ sampleId, durationMs: Math.max(...dates.map((date) => date.getTime())) - Math.min(...dates.map((date) => date.getTime())) }));
}

function batchWallClock(rows: any[]): number | undefined {
  const starts = rows.flatMap((row) => row.startedAt ? [row.startedAt.getTime()] : []);
  const ends = rows.flatMap((row) => row.completedAt ? [row.completedAt.getTime()] : []);
  return starts.length > 0 && ends.length > 0 ? Math.max(...ends) - Math.min(...starts) : undefined;
}

async function acceptanceSplitId(db: CoreDb, acceptanceId: string): Promise<string> {
  const acceptance = await db.teacherAiGradingHiddenAcceptance.findUnique({ where: { id: acceptanceId }, select: { splitId: true } });
  if (!acceptance) throw new Error('teacher-ai-grading-pdf-acceptance-not-found');
  return acceptance.splitId;
}

function safeErrorCode(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'teacher-ai-grading-unknown-error';
}

export interface TeacherAiGradingClaimHeartbeat {
  signal: AbortSignal;
  checkpoint(): void;
  stop(): Promise<void>;
}

export function startTeacherAiGradingClaimHeartbeat(
  dependencies: TeacherAiGradingLabCoreDependencies,
  executionId: string,
  claimToken: string,
  clock: () => Date,
): TeacherAiGradingClaimHeartbeat {
  const leaseMs = dependencies.leaseMs ?? 5 * 60_000;
  const intervalMs = dependencies.heartbeatIntervalMs ?? Math.max(10, Math.floor(leaseMs / 3));
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs >= leaseMs) {
    throw new Error('teacher-ai-grading-heartbeat-interval-invalid');
  }
  const abortController = new AbortController();
  let stopped = false;
  let lostError: unknown = null;
  let inFlight: Promise<void> | null = null;
  const tick = () => {
    if (stopped || inFlight) return;
    inFlight = renew({ db: dependencies.db, executionId, claimToken, leaseMs, now: clock() })
      .then(() => undefined)
      .catch((error) => {
        lostError = error;
        abortController.abort(error);
      })
      .finally(() => { inFlight = null; });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return {
    signal: abortController.signal,
    checkpoint() {
      if (lostError) throw lostError;
    },
    async stop() {
      if (!stopped) {
        stopped = true;
        clearInterval(timer);
      }
      await inFlight;
    },
  };
}

async function settleClaimFailure(
  dependencies: TeacherAiGradingLabCoreDependencies,
  heartbeat: TeacherAiGradingClaimHeartbeat,
  input: Omit<Parameters<typeof fail>[0], 'db'>,
): Promise<void> {
  await heartbeat.stop();
  try {
    await fail({ db: dependencies.db, ...input });
  } catch (error) {
    if (!isFencingError(error)) throw error;
  }
}

function isFencingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === 'experiment-execution-fenced'
    || message === 'experiment-grading-run-fenced'
    || message === 'grading-run-fenced';
}

function hashText(value: string): string { return hashBytes(Buffer.from(value)); }
function hashBytes(value: Uint8Array): string { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }
function hashJson(value: unknown): string { return hashText(JSON.stringify(canonicalize(value))); }
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}

export interface ProductionTeacherAiGradingLabCoreOptions extends Partial<Omit<TeacherAiGradingLabCoreDependencies, 'db' | 'datasetStore' | 'artifactStore'>> {
  config?: TeacherAiGradingLabConfig;
  db?: CoreDb;
  datasetStore?: TeacherAiGradingLabDatasetStore;
  artifactStore?: TeacherAiGradingLabArtifactStore;
}

export async function createProductionTeacherAiGradingLabCore(options: ProductionTeacherAiGradingLabCoreOptions = {}): Promise<{ core: TeacherAiGradingLabCore; disconnect(): Promise<void> }> {
  const config = options.config ?? ((!options.datasetStore || !options.artifactStore) ? readTeacherAiGradingLabConfig(process.env) : undefined);
  let ownedDb: CoreDb | null = null;
  const db = options.db ?? (ownedDb = (await import('@/lib/prisma-client')).createPrismaClient({ log: ['warn', 'error'] }));
  const datasetStore = options.datasetStore ?? createFileSystemTeacherAiGradingLabDatasetStore({ dataRoot: config!.dataRoot, ownerTeacherUserId: config!.ownerTeacherUserId });
  const artifactStore = options.artifactStore ?? createFileSystemTeacherAiGradingLabArtifactStore({ artifactRoot: join(config!.dataRoot, 'artifacts') });
  const conversion = options.conversion ?? createProductionConversionAdapter({ db, artifactStore });
  const providerPolicyResolver = options.providerPolicyResolver ?? (async (frozenConfig) => {
    const policyId = typeof frozenConfig.modelParameters?.providerPolicyId === 'string'
      ? frozenConfig.modelParameters.providerPolicyId.trim()
      : '';
    if (!policyId) throw new Error('teacher-ai-grading-lab-provider-policy-id-missing');
    const policy = await db.gradingProviderPolicy.findUnique({ where: { id: policyId } });
    const snapshot = toGradingProviderPolicySnapshot(policy);
    if (!snapshot) throw new Error('teacher-ai-grading-lab-provider-policy-not-found');
    return snapshot;
  });
  const visualProviderPolicyResolver = options.visualProviderPolicyResolver ?? (async (frozenConfig) => {
    const processor = frozenConfig.snapshot && typeof frozenConfig.snapshot === 'object'
      ? (frozenConfig.snapshot as Record<string, unknown>).processor
      : null;
    const visualPolicy = processor && typeof processor === 'object'
      ? (processor as Record<string, unknown>).visualPolicy
      : null;
    const visualPolicyId = visualPolicy && typeof visualPolicy === 'object'
      ? (visualPolicy as Record<string, unknown>).id
      : null;
    const policyId = typeof visualPolicyId === 'string'
      ? visualPolicyId.trim()
      : '';
    if (!policyId) throw new Error('teacher-ai-grading-controlled-visual-policy-missing');
    const policy = await db.gradingProviderPolicy.findUnique({ where: { id: policyId } });
    const snapshot = toGradingProviderPolicySnapshot(policy);
    if (!snapshot) throw new Error('teacher-ai-grading-controlled-visual-policy-unavailable');
    return snapshot;
  });
  const core = createTeacherAiGradingLabCore({
    ...options,
    db,
    datasetStore,
    artifactStore,
    conversion,
    providerPolicyResolver,
    visualProviderPolicyResolver,
  });
  return { core, disconnect: async () => { await ownedDb?.$disconnect?.(); } };
}

function createProductionConversionAdapter(input: {
  db: CoreDb;
  artifactStore: TeacherAiGradingLabArtifactStore;
}): TeacherAiGradingLabConversionAdapter {
  return {
    async prepare(request) {
      const sample = request.dataset.manifest.samples.find((candidate) => candidate.sampleId === request.sampleId);
      if (!sample) throw new Error('teacher-ai-grading-dataset-sample-not-found');
      const submission = sample.submissions.find((candidate) => candidate.questionId === request.submission.questionId);
      if (!submission || submission.checksum !== request.submission.sourceChecksum) throw new Error('teacher-ai-grading-dataset-question-submission-not-found');
      const conversionId = `grading-lab-conversion:${hashText(`${request.batchId}:${request.sampleId}:${request.submission.questionId}:${submission.checksum}`).slice(7, 39)}`;
      const existing = await input.db.documentConversion.findUnique({
        where: { id: conversionId },
        include: { answerEvidence: { include: { blocks: { orderBy: { blockIndex: 'asc' } } } } },
      });
      if (existing?.state === 'SUCCEEDED' && existing.answerEvidence) {
        return {
          evidence: persistedEvidence(existing.answerEvidence),
          evidenceBlocks: existing.answerEvidence.blocks,
          answerEvidenceId: existing.answerEvidence.id,
          attachments: existing.renderedObjectKey && existing.renderedChecksum
            ? [{ kind: 'document', mediaType: 'application/pdf', data: await input.artifactStore.read(existing.renderedObjectKey), checksum: existing.renderedChecksum }]
            : [],
          conversionAttempt: null,
        };
      }
      const objectKey = `teacher-ai-grading/dataset-source/${encodeURIComponent(request.batchId)}/${encodeURIComponent(request.sampleId)}/${encodeURIComponent(request.submission.questionId)}`;
      const mimeType = extname(request.submission.fileName).toLowerCase() === '.doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const metadata = {
        key: objectKey, ownerId: 'teacher-ai-grading-lab', answerId: `${request.sampleId}:${request.submission.questionId}`,
        sizeBytes: request.submission.documentBytes.byteLength, mimeType, checksum: request.submission.checksum,
      };
      const conversionStartedAt = Date.now();
      const result = await convertProtectedSubmission({
        source: {
          assetId: `grading-lab:${request.sampleId}:${request.submission.questionId}`, attemptId: `grading-lab:${request.batchId}`, answerId: `${request.sampleId}:${request.submission.questionId}`,
          ownerId: metadata.ownerId, objectKey, originalName: request.submission.fileName, mimeType,
          sizeBytes: metadata.sizeBytes, checksum: metadata.checksum, classId: 'teacher-ai-grading-lab',
        },
        store: {
          async healthCheck() {}, async signUpload() { throw new Error('teacher-ai-grading-lab-upload-forbidden'); },
          async head() { throw new Error('teacher-ai-grading-lab-redacted-source-store-bypass'); },
          async readObject() { throw new Error('teacher-ai-grading-lab-redacted-source-store-bypass'); },
          async delete() {},
        },
        trustedRedactedSource: {
          provenance: 'teacher-ai-grading-confirmed-redaction',
          bytes: request.submission.documentBytes,
        },
        idempotencyKey: conversionId,
        requireWordDualRepresentation: true,
        expectedQuestionIds: [request.submission.questionId], signal: request.signal,
      });
      if (!['succeeded', 'fallback'].includes(result.state) || !result.renderedBytes || result.renderedMimeType !== 'application/pdf') {
        throw new Error(result.limitations[0] ?? result.warnings[0] ?? 'teacher-ai-grading-conversion-incomplete');
      }
      const preparedEvidence = await prepareLabExperimentEvidence({ result, request });
      const evidence = preparedEvidence.evidence;
      const renderedObjectKey = `teacher-ai-grading/conversions/${encodeURIComponent(conversionId)}.pdf`;
      const renderedChecksum = hashBytes(result.renderedBytes);
      await input.artifactStore.write(renderedObjectKey, result.renderedBytes);
      const visualObjectKeys: string[] = [];
      try {
        for (const visual of preparedEvidence.visualEvidence) {
          await input.artifactStore.write(visual.objectKey, visual.bytes);
          visualObjectKeys.push(visual.objectKey);
        }
      } catch (error) {
        await Promise.all([input.artifactStore.delete(renderedObjectKey), ...visualObjectKeys.map((objectKey) => input.artifactStore.delete(objectKey))]);
        throw error;
      }
      const now = new Date();
      const evidenceId = `grading-lab-evidence:${hashText(conversionId).slice(7, 39)}`;
      const persist = async (db: CoreDb) => {
        await db.documentConversion.create({ data: {
          id: conversionId, assetId: null, attemptId: null, version: 1, dedupeKey: conversionId,
          adapter: result.adapter, adapterVersion: result.adapterVersion, state: 'SUCCEEDED', sourceChecksum: result.sourceChecksum,
          outputChecksum: hashText(evidence.canonicalMarkdown), canonicalMarkdown: evidence.canonicalMarkdown, renderedObjectKey, renderedChecksum,
          precision: result.precision.toUpperCase(), confidence: result.confidence, warningCodes: result.warnings,
          limitationState: evidence.limitationState, providerRequestId: result.providerRequestId,
          providerRequestedAt: result.providerRequestedAt, providerProcessedAt: result.providerProcessedAt,
          progress: 100, startedAt: now, completedAt: now, createdAt: now, updatedAt: now,
        } });
        await db.answerEvidence.create({ data: {
          id: evidenceId, attemptId: null, sourceAssetId: null, conversionId, version: 1, sourceKind: 'DOCUMENT',
          sourceHash: evidence.sourceHash, canonicalMarkdown: evidence.canonicalMarkdown, anchorVersion: evidence.anchorVersion,
          precision: evidence.precision.toUpperCase(), readiness: 'READY', limitationState: evidence.limitationState,
          limitations: evidence.limitations, createdAt: now, updatedAt: now,
        } });
        await db.answerEvidenceBlock.createMany({ data: evidence.blocks.map((block) => ({
          id: `${conversionId}:${block.id}`, evidenceId, blockIndex: block.blockIndex, pageNumber: block.pageNumber ?? null,
          text: block.text, markdown: block.markdown ?? block.text, spanStart: block.spanStart ?? null, spanEnd: block.spanEnd ?? null,
          bbox: block.bbox ?? undefined, coordinateProvenance: block.coordinateProvenance ?? undefined,
          precision: (block.precision ?? evidence.precision).toUpperCase(), confidence: block.confidence ?? 0,
          sourceHash: evidence.sourceHash, createdAt: now,
        })) });
        if (preparedEvidence.visualEvidence.length > 0 && db.documentConversionVisualEvidence) {
          await db.documentConversionVisualEvidence.createMany({ data: preparedEvidence.visualEvidence.map((item) => ({
            id: `${conversionId}:visual:${item.visual.id}`,
            conversionId,
            attemptId: `grading-lab:${request.batchId}`,
            questionId: request.submission.questionId,
            sourceKind: item.visual.sourceKind,
            sourceChecksum: item.visual.sourceChecksum,
            imageChecksum: item.visual.imageChecksum,
            objectKey: item.objectKey,
            mediaType: item.mediaType,
            sizeBytes: item.bytes.byteLength,
            pageNumber: item.visual.pageNumber,
            bbox: item.visual.bbox ?? undefined,
            description: item.visual.description,
            confidence: item.visual.confidence,
            processorVersion: item.visual.processorVersion,
            provider: item.provider,
            model: item.model,
            policyVersion: item.policyVersion,
            providerRequestId: item.providerRequestId,
            providerDeletionHandle: item.deletionHandle,
            providerRequestedAt: item.providerRequestedAt,
            providerProcessedAt: item.providerProcessedAt,
            limitations: item.visual.limitations,
            readiness: item.visual.readiness,
            contentHash: item.visual.contentHash,
            createdAt: now,
            updatedAt: now,
          })) });
        }
      };
      try {
        if (input.db.$transaction) await input.db.$transaction(persist, { isolationLevel: 'Serializable' });
        else await persist(input.db);
      } catch (error) {
        await Promise.all([input.artifactStore.delete(renderedObjectKey), ...visualObjectKeys.map((objectKey) => input.artifactStore.delete(objectKey))]);
        throw error;
      }
      const evidenceBlocks = evidence.blocks.map((block) => ({ ...block, id: `${conversionId}:${block.id}` }));
      return {
        evidence,
        evidenceBlocks,
        answerEvidenceId: evidenceId,
        attachments: [],
        conversionAttempt: {
          attemptOrdinal: request.attemptOrdinal, status: 'SUCCEEDED', stage: 'conversion', durationMs: Math.max(0, Date.now() - conversionStartedAt),
          conversionVersion: result.adapterVersion, sourceHash: result.sourceChecksum,
          visualEvidenceStatus: preparedEvidence.visualEvidenceStatus, telemetryComplete: true,
        },
      };
    },
  };
}

const terminalBatchStates = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED']);

async function requireTerminalEvaluationRun(dependencies: TeacherAiGradingLabCoreDependencies, config: any, evaluationRunId: string): Promise<void> {
  const batch = await dependencies.db.teacherAiGradingExperimentBatch.findUnique({
    where: { id: evaluationRunId },
    select: { id: true, configId: true, splitId: true, state: true },
  });
  if (!batch || batch.configId !== config.id || batch.splitId !== config.splitId || !terminalBatchStates.has(batch.state)) {
    throw new Error('teacher-ai-grading-baseline-before-independent-run-complete');
  }
}

async function requireTerminalPartitionRun(
  dependencies: TeacherAiGradingLabCoreDependencies,
  config: any,
  partition: 'TUNING' | 'HIDDEN',
): Promise<void> {
  const members = await dependencies.db.teacherAiGradingLabSplitMember.findMany({
    where: { splitId: config.splitId, partition },
    select: { sampleId: true },
  });
  const expectedSampleIds = new Set(members.map((member: any) => String(member.sampleId)));
  const batches = await dependencies.db.teacherAiGradingExperimentBatch.findMany({
    where: { configId: config.id, splitId: config.splitId, state: { in: [...terminalBatchStates] } },
    select: { sampleSetSnapshot: true },
  });
  const hasMatchingRun = batches.some((batch: any) => {
    const samples = Array.isArray(batch.sampleSetSnapshot) ? batch.sampleSetSnapshot : [];
    const sampleIds = new Set(samples.flatMap((sample: unknown) => (
      sample && typeof sample === 'object' && typeof (sample as { sampleId?: unknown }).sampleId === 'string'
        ? [(sample as { sampleId: string }).sampleId]
        : []
    )));
    return sampleIds.size === expectedSampleIds.size && [...expectedSampleIds].every((sampleId) => sampleIds.has(sampleId));
  });
  if (!hasMatchingRun) throw new Error('teacher-ai-grading-baseline-before-independent-run-complete');
}

type PreparedLabVisualEvidence = {
  visual: VisualEvidence;
  bytes: Uint8Array;
  mediaType: string;
  objectKey: string;
  provider: string;
  model: string;
  policyVersion: string;
  providerRequestId: string | null;
  deletionHandle: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
};

const MAX_LAB_VISUAL_PAGE_COUNT = 24;
const MAX_LAB_VISUAL_PAGE_BYTES = 32 * 1024 * 1024;

export async function prepareLabExperimentEvidence(input: {
  result: Awaited<ReturnType<typeof convertProtectedSubmission>>;
  request: Parameters<TeacherAiGradingLabConversionAdapter['prepare']>[0];
  renderPdfPages?: typeof renderPdfPagesToPng;
}): Promise<{
  evidence: NormalizedAnswerEvidence;
  visualEvidence: PreparedLabVisualEvidence[];
  visualEvidenceStatus: 'COMPLETE' | 'INCOMPLETE' | 'NOT_APPLICABLE';
}> {
  const textEvidence = normalizeDocumentEvidence({
    sourceHash: input.result.sourceChecksum,
    markdown: input.result.markdown,
    blocks: input.result.blocks,
    limitations: input.result.limitations.filter((limitation) => limitation !== 'visual-evidence-not-delivered'),
  });
  if (input.request.evidenceChain === 'text-only') {
    return { evidence: textEvidence, visualEvidence: [], visualEvidenceStatus: 'NOT_APPLICABLE' };
  }
  if (!input.request.visualPolicy || input.request.visualPolicy.purpose !== 'visual-description') {
    throw new Error('teacher-ai-grading-controlled-visual-policy-unavailable');
  }
  if (input.result.wordRepresentation?.renderedPdfChecksum
    && hashBytes(input.result.renderedBytes!) !== input.result.wordRepresentation.renderedPdfChecksum) {
    throw new Error('teacher-ai-grading-controlled-visual-rendered-pdf-mismatch');
  }
  const allImages = input.result.wordRepresentation?.images ?? [];
  if (allImages.some((image) => image.questionId === null)) {
    throw new Error('teacher-ai-grading-controlled-visual-question-mapping-invalid');
  }
  const images = allImages.filter((image) => image.questionId === input.request.submission.questionId);
  if (images.length === 0) {
    return { evidence: textEvidence, visualEvidence: [], visualEvidenceStatus: 'NOT_APPLICABLE' };
  }
  if (allImages.some((image) => image.questionId !== input.request.submission.questionId)) {
    throw new Error('teacher-ai-grading-controlled-visual-question-mapping-invalid');
  }
  const pageCount = input.result.wordRepresentation?.renderedPdfPageCount ?? 0;
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('teacher-ai-grading-controlled-visual-pdf-page-count-invalid');
  }
  let pages: Array<{ pageNumber: number; bytes: Buffer }>;
  try {
    pages = await (input.renderPdfPages ?? renderPdfPagesToPng)({
      pdfBytes: input.result.renderedBytes!,
      signal: input.request.signal,
    });
  } catch {
    throw new Error('teacher-ai-grading-controlled-visual-pdf-render-failed');
  }
  pages = [...pages].sort((left, right) => left.pageNumber - right.pageNumber);
  const totalPageBytes = pages.reduce((total, page) => total + page.bytes.byteLength, 0);
  if (
    pages.length !== pageCount
    || pages.length > MAX_LAB_VISUAL_PAGE_COUNT
    || totalPageBytes > MAX_LAB_VISUAL_PAGE_BYTES
    || pages.some((page, index) => page.pageNumber !== index + 1 || page.bytes.byteLength === 0)
  ) {
    throw new Error('teacher-ai-grading-controlled-visual-page-projection-invalid');
  }
  const visualEvidence: PreparedLabVisualEvidence[] = [];
  for (const [index, page] of pages.entries()) {
    const imageChecksum = hashBytes(page.bytes);
    const description = await describeVisualEvidence({
      attachment: {
        kind: 'image',
        data: page.bytes,
        mediaType: 'image/png',
        checksum: imageChecksum,
        questionId: input.request.submission.questionId,
      },
      questionId: input.request.submission.questionId,
      pageNumber: page.pageNumber,
      classId: 'teacher-ai-grading-lab',
      policy: input.request.visualPolicy,
      provider: input.request.visualProvider,
      idempotencyKey: `teacher-ai-grading-visual:${input.request.executionId}:page:${page.pageNumber}:${imageChecksum}`,
      signal: input.request.signal,
    });
    const visual = normalizeVisualEvidence({
      id: `lab-visual-${index + 1}`,
      sourceKind: 'pdf-page-image',
      sourceChecksum: input.result.sourceChecksum,
      imageChecksum,
      questionId: input.request.submission.questionId,
      pageNumber: page.pageNumber,
      bbox: description.bbox ?? null,
      description: description.description,
      confidence: description.confidence,
      processorVersion: `${input.result.adapterVersion}:visual-description:${description.policyVersion}`,
      limitations: description.limitations,
      createdAt: new Date().toISOString(),
    });
    if (visual.readiness !== 'ready') {
      throw new Error(`teacher-ai-grading-controlled-visual-evidence-${visualEvidenceIncompleteReason(visual)}`);
    }
    visualEvidence.push({
      visual,
      bytes: page.bytes,
      mediaType: 'image/png',
      objectKey: `teacher-ai-grading/conversions/${encodeURIComponent(input.request.executionId)}/visual/page-${page.pageNumber}-${encodeURIComponent(imageChecksum)}.png`,
      provider: description.provider,
      model: description.model,
      policyVersion: description.policyVersion,
      providerRequestId: description.providerRequestId,
      deletionHandle: description.deletionHandle,
      providerRequestedAt: description.providerRequestedAt,
      providerProcessedAt: description.providerProcessedAt,
    });
  }
  const projection = projectVisualEvidenceIntoDocument({
    markdown: textEvidence.canonicalMarkdown,
    blocks: textEvidence.blocks,
    visualEvidence: visualEvidence.map((item) => item.visual),
  });
  const evidence = normalizeDocumentEvidence({
    sourceHash: textEvidence.sourceHash,
    markdown: projection.markdown,
    blocks: projection.blocks,
    limitations: [...textEvidence.limitations, ...projection.limitations],
    anchorVersion: textEvidence.anchorVersion,
  });
  if (evidence.readiness !== 'ready') throw new Error('teacher-ai-grading-controlled-visual-evidence-incomplete');
  return { evidence, visualEvidence, visualEvidenceStatus: 'COMPLETE' };
}

function visualEvidenceIncompleteReason(visual: VisualEvidence): string {
  if (!visual.questionId) return 'question-unassigned';
  if (!visual.pageNumber) return 'page-unassigned';
  if (!visual.description) return 'description-missing';
  if (visual.confidence === null) return 'confidence-missing';
  if (visual.confidence < 0.8) return 'low-confidence';
  if (visual.limitations.length > 0) return 'limitations';
  return 'incomplete';
}

function persistedEvidence(row: any): NormalizedAnswerEvidence {
  return {
    sourceKind: 'document', sourceHash: row.sourceHash, canonicalMarkdown: row.canonicalMarkdown,
    anchorVersion: row.anchorVersion, precision: String(row.precision).toLowerCase(), readiness: 'ready',
    limitationState: row.limitationState, limitations: row.limitations,
    blocks: row.blocks.map((block: any) => ({
      id: block.id.split(':').at(-1)!, blockIndex: block.blockIndex, pageNumber: block.pageNumber, text: block.text,
      markdown: block.markdown, spanStart: block.spanStart, spanEnd: block.spanEnd, bbox: block.bbox,
      coordinateProvenance: block.coordinateProvenance, precision: String(block.precision).toLowerCase(), confidence: block.confidence,
    })),
  } as NormalizedAnswerEvidence;
}

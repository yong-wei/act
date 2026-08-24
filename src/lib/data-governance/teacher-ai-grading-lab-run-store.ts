import { createHash, randomUUID } from 'node:crypto';

type ExperimentDb = Record<string, any>;

export interface VersionedExperimentComponent {
  id: string;
  version: string;
  contentHash: string;
}

export interface FreezeExperimentConfigInput {
  db: ExperimentDb;
  idempotencyKey: string;
  dataset: VersionedExperimentComponent;
  split: VersionedExperimentComponent;
  prompt: VersionedExperimentComponent;
  model: VersionedExperimentComponent & { parameters: Record<string, unknown> };
  rubric: VersionedExperimentComponent;
  processor: VersionedExperimentComponent;
  metric: VersionedExperimentComponent;
  seed: number;
  now?: Date;
}

export interface CreateExperimentRunSetInput {
  db: ExperimentDb;
  configId: string;
  splitId: string;
  idempotencyKey: string;
  samples: Array<{
    sampleId: string;
    questions: ExperimentQuestionRunSeed[];
  }>;
  maxAttempts?: number;
  now?: Date;
}

export interface ExperimentQuestionRunSeed {
  questionId: string;
  inputHash: string;
  questionSnapshotHash: string;
  rubricId: string | null;
  rubricVersion: string;
  evaluatorId: string;
  evaluatorVersion: string;
  questionSnapshot: Record<string, unknown>;
  rubricSnapshot: Record<string, unknown>;
  referenceAnswer: string | null;
}

export type ExperimentFailureStage =
  | 'conversion'
  | 'evidence'
  | 'grading'
  | 'provider'
  | 'persistence'
  | 'raw-output';

export interface ExperimentClaim {
  execution: any;
  claimToken: string;
  resumeStage?: 'raw-output';
}

const ACTIVE_LEASE_MS = 5 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const SERIALIZABLE_TRANSACTION_RETRY_LIMIT = 3;

export async function freezeConfig(input: FreezeExperimentConfigInput): Promise<{ config: any; replay: boolean }> {
  requireNonEmpty(input.idempotencyKey, 'experiment-config-idempotency-key-missing');
  assertComponent(input.dataset, 'dataset');
  assertComponent(input.split, 'split');
  assertComponent(input.prompt, 'prompt');
  assertComponent(input.model, 'model');
  assertComponent(input.rubric, 'rubric');
  assertComponent(input.processor, 'processor');
  assertComponent(input.metric, 'metric');
  if (!Number.isInteger(input.seed) || input.seed < -2_147_483_648 || input.seed > 2_147_483_647) {
    throw new Error('experiment-config-seed-invalid');
  }

  const snapshot = {
    dataset: input.dataset,
    split: input.split,
    prompt: input.prompt,
    model: input.model,
    rubric: input.rubric,
    processor: input.processor,
    metric: input.metric,
    seed: input.seed,
  };
  const requestHash = hashJson(snapshot);
  const existing = await input.db.teacherAiGradingExperimentConfig.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return replayOrConflict(existing, requestHash, 'experiment-config-idempotency-conflict');

  const now = input.now ?? new Date();
  const create = async (db: ExperimentDb) => {
    const replay = await db.teacherAiGradingExperimentConfig.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) return replayOrConflict(replay, requestHash, 'experiment-config-idempotency-conflict');
    const versions = await db.teacherAiGradingExperimentConfig.aggregate({
      where: { datasetId: input.dataset.id },
      _max: { version: true },
    });
    const version = (versions?._max?.version ?? 0) + 1;
    const config = await db.teacherAiGradingExperimentConfig.create({
      data: {
        id: `experiment-config:${hashText(`${input.dataset.id}:${version}:${requestHash}`).slice(7, 39)}`,
        version,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        contentHash: requestHash,
        snapshot,
        datasetId: input.dataset.id,
        datasetVersion: input.dataset.version,
        datasetContentHash: input.dataset.contentHash,
        splitId: input.split.id,
        splitVersion: input.split.version,
        splitContentHash: input.split.contentHash,
        promptId: input.prompt.id,
        promptVersion: input.prompt.version,
        promptContentHash: input.prompt.contentHash,
        modelId: input.model.id,
        modelVersion: input.model.version,
        modelParameters: input.model.parameters,
        rubricId: input.rubric.id,
        rubricVersion: input.rubric.version,
        rubricContentHash: input.rubric.contentHash,
        processorId: input.processor.id,
        processorVersion: input.processor.version,
        processorContentHash: input.processor.contentHash,
        metricId: input.metric.id,
        metricVersion: input.metric.version,
        metricContentHash: input.metric.contentHash,
        seed: input.seed,
        createdAt: now,
      },
    });
    return { config, replay: false };
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return input.db.$transaction
        ? await input.db.$transaction(create, { isolationLevel: 'Serializable' })
        : await create(input.db);
    } catch (error) {
      const recovered = await input.db.teacherAiGradingExperimentConfig.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (recovered) return replayOrConflict(recovered, requestHash, 'experiment-config-idempotency-conflict');
      if (!isUniqueConstraint(error) && !isTransactionConflict(error)) throw error;
      if (attempt === 2) throw error;
    }
  }
  throw new Error('experiment-config-version-allocation-failed');
}

export async function createRunSet(input: CreateExperimentRunSetInput): Promise<{ batch: any; replay: boolean }> {
  requireNonEmpty(input.configId, 'experiment-config-id-missing');
  requireNonEmpty(input.splitId, 'experiment-split-id-missing');
  requireNonEmpty(input.idempotencyKey, 'experiment-batch-idempotency-key-missing');
  if (input.samples.length === 0) throw new Error('experiment-samples-empty');
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('experiment-max-attempts-invalid');

  const sampleIds = new Set<string>();
  for (const sample of input.samples) {
    requireNonEmpty(sample.sampleId, 'experiment-sample-id-missing');
    if (sampleIds.has(sample.sampleId)) throw new Error('experiment-sample-duplicate');
    if (sample.questions.length === 0) throw new Error('experiment-sample-questions-empty');
    sampleIds.add(sample.sampleId);
    const questionIds = new Set<string>();
    for (const question of sample.questions) {
      assertQuestionRunSeed(question);
      if (questionIds.has(question.questionId)) throw new Error('experiment-question-duplicate');
      questionIds.add(question.questionId);
    }
  }
  const sampleSetSnapshot = input.samples
    .map((sample) => ({
      sampleId: sample.sampleId,
      questions: sample.questions
        .map((question) => canonicalize(question) as ExperimentQuestionRunSeed)
        .sort((left, right) => left.questionId.localeCompare(right.questionId)),
    }))
    .sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  const requestHash = hashJson({ configId: input.configId, splitId: input.splitId, sampleSetSnapshot, maxAttempts });
  const existing = await input.db.teacherAiGradingExperimentBatch.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    const replay = replayOrConflict(existing, requestHash, 'experiment-batch-idempotency-conflict');
    return { batch: await loadBatch(input.db, existing.id), replay: replay.replay };
  }

  const now = input.now ?? new Date();
  const create = async (db: ExperimentDb) => {
    const replay = await db.teacherAiGradingExperimentBatch.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      replayOrConflict(replay, requestHash, 'experiment-batch-idempotency-conflict');
      return { batch: replay, replay: true };
    }
    const config = await db.teacherAiGradingExperimentConfig.findUnique({ where: { id: input.configId } });
    if (!config) throw new Error('experiment-config-not-found');
    if (config.splitId !== input.splitId) throw new Error('experiment-split-config-mismatch');
    const members = await db.teacherAiGradingLabSplitMember.findMany({
      where: { splitId: input.splitId, sampleId: { in: sampleSetSnapshot.map((sample) => sample.sampleId) } },
      select: { sampleId: true, partition: true },
    });
    if (members.length !== sampleSetSnapshot.length
      || new Set(members.map((member: any) => member.sampleId)).size !== sampleSetSnapshot.length) {
      throw new Error('experiment-sample-split-membership-mismatch');
    }
    const partitions = new Set(members.map((member: any) => member.partition));
    if (partitions.size !== 1) throw new Error('experiment-sample-partition-mismatch');
    if (partitions.has('HIDDEN')) {
      const hiddenMembers = await db.teacherAiGradingLabSplitMember.findMany({
        where: { splitId: input.splitId, partition: 'HIDDEN' },
        select: { sampleId: true },
      });
      if (!sameStringSet(
        sampleSetSnapshot.map((sample) => sample.sampleId),
        hiddenMembers.map((member: any) => member.sampleId),
      )) {
        throw new Error('experiment-hidden-sample-set-mismatch');
      }
      const acceptance = await db.teacherAiGradingHiddenAcceptance.findUnique({
        where: { splitId: input.splitId },
        select: { state: true, configId: true, batchId: true },
      });
      if (acceptance?.state !== 'RUNNING'
        || acceptance.configId !== input.configId
        || acceptance.batchId !== null) {
        throw new Error('experiment-hidden-acceptance-not-running');
      }
    }
    for (const sample of sampleSetSnapshot) {
      for (const question of sample.questions) assertFrozenRunIdentity(question, config);
    }
    const batchId = `experiment-batch:${hashText(`${requestHash}\u0000${input.idempotencyKey}`).slice(7, 39)}`;
    const totalExecutions = sampleSetSnapshot.reduce((total, sample) => total + sample.questions.length * 3, 0);
    const batch = await db.teacherAiGradingExperimentBatch.create({
      data: {
        id: batchId,
        configId: input.configId,
        splitId: input.splitId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        sampleSetSnapshot,
        sampleSetHash: hashJson(sampleSetSnapshot),
        state: 'QUEUED',
        totalExecutions,
        maxAttempts,
        createdAt: now,
        updatedAt: now,
      },
    });
    const executions = [];
    for (const sample of sampleSetSnapshot) {
      for (const question of sample.questions) {
        for (let repetitionOrdinal = 1; repetitionOrdinal <= 3; repetitionOrdinal += 1) {
          const identity = `${batchId}:${sample.sampleId}:${question.questionId}:${repetitionOrdinal}`;
          const executionId = `experiment-execution:${hashText(identity).slice(7, 39)}`;
          const gradingRunId = `grading-run:${hashText(`teacher-ai-grading:${identity}`).slice(7, 39)}`;
          await db.gradingRun.create({
            data: {
              id: gradingRunId,
              batchId: null,
              answerAttemptId: null,
              answerEvidenceId: null,
              questionId: null,
              policyId: null,
              authorizationSnapshot: {
                origin: question.questionSnapshot.origin,
                experimentConfigId: input.configId,
                experimentBatchId: batchId,
                splitId: input.splitId,
                sampleId: sample.sampleId,
                questionId: question.questionId,
                repetitionOrdinal,
              },
              idempotencyKey: executionId,
              dedupeKey: `teacher-ai-grading:${hashText(identity)}`,
              inputHash: question.inputHash,
              questionSnapshotHash: question.questionSnapshotHash,
              rubricId: question.rubricId,
              rubricVersion: question.rubricVersion,
              evaluatorId: question.evaluatorId,
              evaluatorVersion: question.evaluatorVersion,
              questionSnapshot: question.questionSnapshot,
              rubricSnapshot: question.rubricSnapshot,
              referenceAnswer: question.referenceAnswer,
              state: 'QUEUED',
              createdAt: now,
              updatedAt: now,
            },
          });
          executions.push({
            id: executionId,
            configId: input.configId,
            batchId,
            splitId: input.splitId,
            sampleId: sample.sampleId,
            questionId: question.questionId,
            repetitionOrdinal,
            gradingRunId,
            state: 'QUEUED',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
    await db.teacherAiGradingExperimentExecution.createMany({ data: executions });
    return { batch, replay: false };
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = input.db.$transaction
        ? await input.db.$transaction(create, { isolationLevel: 'Serializable' })
        : await create(input.db);
      return { batch: await loadBatch(input.db, created.batch.id), replay: created.replay };
    } catch (error) {
      const recovered = await input.db.teacherAiGradingExperimentBatch.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (recovered) {
        replayOrConflict(recovered, requestHash, 'experiment-batch-idempotency-conflict');
        return { batch: await loadBatch(input.db, recovered.id), replay: true };
      }
      if ((!isUniqueConstraint(error) && !isTransactionConflict(error)) || attempt === 2) throw error;
    }
  }
  throw new Error('experiment-batch-creation-failed');
}

export async function claim(input: { db: ExperimentDb; batchId?: string; leaseMs?: number; claimToken?: string; now?: Date }): Promise<ExperimentClaim | null> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? ACTIVE_LEASE_MS;
  if (!Number.isInteger(leaseMs) || leaseMs < 1) throw new Error('experiment-lease-duration-invalid');
  const claimToken = input.claimToken ?? randomUUID();
  const claimExecution = async (db: ExperimentDb) => {
    const candidate = await db.teacherAiGradingExperimentExecution.findFirst({
      where: { ...(input.batchId ? { batchId: input.batchId } : {}), state: { in: ['QUEUED', 'RETRYABLE'] }, claimToken: null },
      orderBy: [{ createdAt: 'asc' }, { questionId: 'asc' }, { repetitionOrdinal: 'asc' }],
    });
    if (!candidate) return null;
    const resumeStage = candidate.failureStage === 'raw-output' ? 'raw-output' : undefined;
    const updated = await db.teacherAiGradingExperimentExecution.updateMany({
      where: { id: candidate.id, state: { in: ['QUEUED', 'RETRYABLE'] }, claimToken: null },
      data: {
        state: 'RUNNING',
        claimToken,
        claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        attemptCount: { increment: 1 },
        ...(resumeStage ? {} : { failureStage: null, errorCode: null }),
        startedAt: candidate.startedAt ?? now,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) return null;
    const run = await db.gradingRun.updateMany({
      where: {
        id: candidate.gradingRunId,
        state: resumeStage ? 'AWAITING_REVIEW' : { in: ['QUEUED', 'RETRYABLE', 'RUNNING'] },
      },
      data: resumeStage ? { updatedAt: now } : { state: 'RUNNING', updatedAt: now },
    });
    if (run.count !== 1) throw new Error('experiment-grading-run-fenced');
    return { candidate, resumeStage };
  };
  const claimed = input.db.$transaction
    ? await input.db.$transaction(claimExecution, { isolationLevel: 'Serializable' })
    : await claimExecution(input.db);
  if (!claimed) return null;
  await refreshBatch(input.db, claimed.candidate.batchId, now);
  return {
    execution: await input.db.teacherAiGradingExperimentExecution.findUnique({ where: { id: claimed.candidate.id } }),
    claimToken,
    ...(claimed.resumeStage ? { resumeStage: claimed.resumeStage } : {}),
  };
}

export async function renew(input: { db: ExperimentDb; executionId: string; claimToken: string; leaseMs?: number; now?: Date }): Promise<any> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? ACTIVE_LEASE_MS;
  if (!Number.isInteger(leaseMs) || leaseMs < 1) throw new Error('experiment-lease-duration-invalid');
  const updated = await input.db.teacherAiGradingExperimentExecution.updateMany({
    where: { id: input.executionId, state: 'RUNNING', claimToken: input.claimToken, leaseExpiresAt: { gt: now } },
    data: { leaseExpiresAt: new Date(now.getTime() + leaseMs), updatedAt: now },
  });
  if (updated.count !== 1) throw new Error('experiment-execution-fenced');
  return input.db.teacherAiGradingExperimentExecution.findUnique({ where: { id: input.executionId } });
}

export async function complete(input: { db: ExperimentDb; executionId: string; claimToken: string; rawOutputObjectKey: string; rawOutputChecksum: string; now?: Date }): Promise<any> {
  requireNonEmpty(input.rawOutputObjectKey, 'experiment-raw-output-key-missing');
  requireNonEmpty(input.rawOutputChecksum, 'experiment-raw-output-checksum-missing');
  const now = input.now ?? new Date();
  const settle = async (db: ExperimentDb) => {
    const current = await db.teacherAiGradingExperimentExecution.findUnique({ where: { id: input.executionId }, select: { batchId: true, gradingRunId: true } });
    if (!current) throw new Error('experiment-execution-not-found');
    const gradingRun = await db.gradingRun.findUnique({ where: { id: current.gradingRunId }, select: { state: true } });
    if (gradingRun?.state !== 'AWAITING_REVIEW') throw new Error('experiment-grading-run-not-persisted');
    const updated = await db.teacherAiGradingExperimentExecution.updateMany({
      where: { id: input.executionId, state: 'RUNNING', claimToken: input.claimToken, leaseExpiresAt: { gt: now } },
      data: {
        state: 'SUCCEEDED',
        rawOutputObjectKey: input.rawOutputObjectKey,
        rawOutputChecksum: input.rawOutputChecksum,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        failureStage: null,
        errorCode: null,
        completedAt: now,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) throw new Error('experiment-execution-fenced');
    return current.batchId;
  };
  const batchId = input.db.$transaction
    ? await input.db.$transaction(settle, { isolationLevel: 'Serializable' })
    : await settle(input.db);
  await refreshBatch(input.db, batchId, now);
  return input.db.teacherAiGradingExperimentExecution.findUnique({ where: { id: input.executionId } });
}

export async function fail(input: { db: ExperimentDb; executionId: string; claimToken: string; failureStage: ExperimentFailureStage; errorCode: string; retryable: boolean; now?: Date }): Promise<any> {
  assertSafeErrorCode(input.errorCode);
  const now = input.now ?? new Date();
  const settle = async (db: ExperimentDb) => {
    const current = await db.teacherAiGradingExperimentExecution.findUnique({
      where: { id: input.executionId },
      include: { batch: { select: { id: true, maxAttempts: true } } },
    });
    if (!current) throw new Error('experiment-execution-not-found');
    const retryable = input.retryable && current.attemptCount < current.batch.maxAttempts;
    const updated = await db.teacherAiGradingExperimentExecution.updateMany({
      where: { id: input.executionId, state: 'RUNNING', claimToken: input.claimToken, leaseExpiresAt: { gt: now } },
      data: {
        state: retryable ? 'RETRYABLE' : 'FAILED',
        failureStage: input.failureStage,
        errorCode: input.errorCode,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        completedAt: retryable ? null : now,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) throw new Error('experiment-execution-fenced');
    const preservesDraft = input.failureStage === 'raw-output' && retryable;
    const run = await db.gradingRun.updateMany({
      where: { id: current.gradingRunId, state: input.failureStage === 'raw-output' ? 'AWAITING_REVIEW' : 'RUNNING' },
      data: preservesDraft ? { updatedAt: now } : { state: retryable ? 'RETRYABLE' : 'FAILED', updatedAt: now },
    });
    if (run.count !== 1) throw new Error('experiment-grading-run-fenced');
    return current.batch.id;
  };
  const batchId = input.db.$transaction
    ? await input.db.$transaction(settle, { isolationLevel: 'Serializable' })
    : await settle(input.db);
  await refreshBatch(input.db, batchId, now);
  return input.db.teacherAiGradingExperimentExecution.findUnique({ where: { id: input.executionId } });
}

export async function recover(input: { db: ExperimentDb; limit?: number; now?: Date }): Promise<{ scanned: number; retryable: number; failed: number }> {
  const now = input.now ?? new Date();
  const expired = await input.db.teacherAiGradingExperimentExecution.findMany({
    where: { state: 'RUNNING', leaseExpiresAt: { lte: now } },
    include: { batch: { select: { id: true, maxAttempts: true } } },
    orderBy: { leaseExpiresAt: 'asc' },
    take: input.limit ?? 100,
  });
  let retryable = 0;
  let failed = 0;
  const batchIds = new Set<string>();
  for (const execution of expired) {
    const canRetry = execution.attemptCount < execution.batch.maxAttempts;
    const resumeRawOutput = execution.failureStage === 'raw-output';
    const recoverExecution = async (db: ExperimentDb) => {
      const updated = await db.teacherAiGradingExperimentExecution.updateMany({
        where: { id: execution.id, state: 'RUNNING', claimToken: execution.claimToken, leaseExpiresAt: { lte: now } },
        data: {
          state: canRetry ? 'RETRYABLE' : 'FAILED',
          failureStage: resumeRawOutput ? 'raw-output' : 'persistence',
          errorCode: canRetry ? 'worker-lease-expired' : 'worker-lease-retry-exhausted',
          claimToken: null,
          claimedAt: null,
          leaseExpiresAt: null,
          completedAt: canRetry ? null : now,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) return false;
      const preservesDraft = resumeRawOutput && canRetry;
      const run = await db.gradingRun.updateMany({
        where: { id: execution.gradingRunId, state: resumeRawOutput ? 'AWAITING_REVIEW' : 'RUNNING' },
        data: preservesDraft ? { updatedAt: now } : { state: canRetry ? 'RETRYABLE' : 'FAILED', updatedAt: now },
      });
      if (run.count !== 1) throw new Error('experiment-grading-run-fenced');
      return true;
    };
    const recovered = input.db.$transaction
      ? await input.db.$transaction(recoverExecution, { isolationLevel: 'Serializable' })
      : await recoverExecution(input.db);
    if (recovered) {
      batchIds.add(execution.batch.id);
      if (canRetry) retryable += 1;
      else failed += 1;
    }
  }
  for (const batchId of batchIds) await refreshBatch(input.db, batchId, now);
  return { scanned: expired.length, retryable, failed };
}

export async function loadBatch(db: ExperimentDb, batchId: string): Promise<any> {
  const batch = await db.teacherAiGradingExperimentBatch.findUnique({
    where: { id: batchId },
    include: {
      config: true,
      executions: {
        orderBy: [{ sampleId: 'asc' }, { questionId: 'asc' }, { repetitionOrdinal: 'asc' }],
        include: {
          gradingRun: {
            include: {
              answerEvidence: { include: { blocks: true } },
              assessments: true,
              annotations: true,
            },
          },
        },
      },
    },
  });
  if (!batch) throw new Error('experiment-batch-not-found');
  return batch;
}

async function refreshBatch(db: ExperimentDb, batchId: string, now: Date): Promise<void> {
  const recompute = async (tx: ExperimentDb) => {
    if (tx.$queryRawUnsafe) {
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "TeacherAiGradingExperimentBatch" WHERE "id" = $1 FOR UPDATE',
        batchId,
      );
    }
    const batch = await tx.teacherAiGradingExperimentBatch.findUnique({ where: { id: batchId }, select: { id: true, totalExecutions: true, startedAt: true } });
    if (!batch) return;
    const executions = await tx.teacherAiGradingExperimentExecution.findMany({ where: { batchId }, select: { state: true } });
    const completedCount = executions.filter((item: any) => item.state === 'SUCCEEDED').length;
    const failedCount = executions.filter((item: any) => item.state === 'FAILED').length;
    const retryableCount = executions.filter((item: any) => item.state === 'RETRYABLE').length;
    const runningCount = executions.filter((item: any) => item.state === 'RUNNING').length;
    const terminalCount = completedCount + failedCount;
    const state = terminalCount === batch.totalExecutions
      ? failedCount === 0 ? 'SUCCEEDED' : completedCount === 0 ? 'FAILED' : 'PARTIAL'
      : runningCount > 0 ? 'RUNNING'
        : retryableCount > 0 ? 'RETRYABLE'
          : terminalCount > 0 || batch.startedAt ? 'RUNNING'
            : 'QUEUED';
    await tx.teacherAiGradingExperimentBatch.updateMany({
      where: { id: batchId },
      data: {
        state,
        completedCount,
        failedCount,
        retryableCount,
        startedAt: batch.startedAt ?? (state === 'QUEUED' ? null : now),
        completedAt: ['SUCCEEDED', 'PARTIAL', 'FAILED'].includes(state) ? now : null,
        updatedAt: now,
      },
    });
  };
  await runSerializableTransaction(db, recompute);
}

async function runSerializableTransaction<T>(db: ExperimentDb, operation: (tx: ExperimentDb) => Promise<T>): Promise<T> {
  if (!db.$transaction) return operation(db);
  for (let attempt = 0; attempt < SERIALIZABLE_TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isTransientSerializableConflict(error) || attempt === SERIALIZABLE_TRANSACTION_RETRY_LIMIT - 1) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error('experiment-serializable-transaction-retry-exhausted');
}

function isTransientSerializableConflict(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return code === 'P2034' || code === '40001' || code === '40P01'
    || message.includes('write conflict')
    || message.includes('deadlock')
    || message.includes('could not serialize');
}

function assertQuestionRunSeed(seed: ExperimentQuestionRunSeed): void {
  requireNonEmpty(seed.questionId, 'experiment-question-id-missing');
  requireNonEmpty(seed.inputHash, 'experiment-run-input-hash-missing');
  requireNonEmpty(seed.questionSnapshotHash, 'experiment-question-snapshot-hash-missing');
  requireNonEmpty(seed.rubricVersion, 'experiment-rubric-version-missing');
  requireNonEmpty(seed.evaluatorId, 'experiment-evaluator-id-missing');
  requireNonEmpty(seed.evaluatorVersion, 'experiment-evaluator-version-missing');
  if (!seed.questionSnapshot || typeof seed.questionSnapshot !== 'object') throw new Error('experiment-question-snapshot-missing');
  if (!seed.rubricSnapshot || typeof seed.rubricSnapshot !== 'object') throw new Error('experiment-rubric-snapshot-missing');
  if (seed.questionSnapshot.questionId !== seed.questionId) throw new Error('experiment-question-snapshot-id-mismatch');
}

function assertFrozenRunIdentity(seed: ExperimentQuestionRunSeed, config: any): void {
  const origin = seed.questionSnapshot.origin as Record<string, unknown> | undefined;
  if (origin?.kind !== 'evaluation-package'
    || origin.datasetId !== config.datasetId
    || origin.datasetVersion !== config.datasetVersion) {
    throw new Error('experiment-question-origin-mismatch');
  }
  if (seed.questionSnapshot.assignmentRevisionId !== null) throw new Error('experiment-production-lineage-forbidden');
  if (seed.evaluatorId !== config.modelId || seed.evaluatorVersion !== config.modelVersion) {
    throw new Error('experiment-evaluator-config-mismatch');
  }
  const rubricSnapshot = seed.rubricSnapshot as Record<string, unknown>;
  const questionRubric = seed.questionSnapshot.rubric as Record<string, unknown> | undefined;
  const rubricContentHash = hashContent(rubricSnapshot);
  const rubricConfigurationHash = rubricSnapshot.configurationContentHash ?? rubricContentHash;
  if (seed.rubricId !== config.rubricId
    || seed.rubricVersion !== config.rubricVersion
    || rubricSnapshot.id !== config.rubricId
    || rubricSnapshot.version !== config.rubricVersion
    || rubricConfigurationHash !== config.rubricContentHash
    || rubricSnapshot.contentHash !== rubricContentHash
    || hashJson(rubricSnapshot) !== hashJson(questionRubric)) {
    throw new Error('experiment-rubric-config-mismatch');
  }
  if (seed.questionSnapshot.contentHash !== seed.questionSnapshotHash
    || hashContent(seed.questionSnapshot) !== seed.questionSnapshotHash) {
    throw new Error('experiment-question-snapshot-hash-mismatch');
  }
  if (seed.questionSnapshot.referenceAnswer !== seed.referenceAnswer) {
    throw new Error('experiment-question-snapshot-reference-answer-mismatch');
  }
}

function replayOrConflict<T extends { requestHash: string }>(row: T, requestHash: string, code: string): { config: T; replay: true } {
  if (row.requestHash !== requestHash) throw new Error(code);
  return { config: row, replay: true };
}

function assertComponent(component: VersionedExperimentComponent, name: string): void {
  requireNonEmpty(component.id, `experiment-${name}-id-missing`);
  requireNonEmpty(component.version, `experiment-${name}-version-missing`);
  requireNonEmpty(component.contentHash, `experiment-${name}-content-hash-missing`);
}

function assertSafeErrorCode(errorCode: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(errorCode)) throw new Error('experiment-error-code-invalid');
}

function requireNonEmpty(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code);
}

function hashJson(value: unknown): string {
  return hashText(JSON.stringify(canonicalize(value)));
}

function hashContent(value: Record<string, unknown>): string {
  const { contentHash: _contentHash, ...content } = value;
  return hashJson(content);
}

function sameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((value) => right.includes(value));
}

function hashText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

function isTransactionConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2034');
}

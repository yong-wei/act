import { evaluateArenaSubmission, getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import {
  arenaEvaluationCacheBindingConflicts,
  isCompleteArenaEvaluationCacheIdentity,
  resolveArenaEvaluationCacheBinding,
  withArenaEvaluationCacheBinding,
} from './evaluation-cache-identity';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';
import { ControlEngineFailure } from '@/lib/control-engine';
import {
  startOfUtcDay,
  type ArenaBlackBoxExperimentStore,
  type ArenaIdentificationModelStore,
} from '../blackbox/experiment-service';
import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import {
  normalizeCodeControllerManifest,
  type CodeControllerManifest,
} from './controller-artifact-builder';
import { hashControllerArtifact } from './artifact-hash';
import type { ArenaSubmissionRecord } from './submission-service';
import { getArenaPlantAdapterForOfficialEvaluationTaskId } from '../adapters/registry';

export class ArenaSubmissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaSubmissionInputError';
  }
}

export interface StoredArenaEvaluation {
  id: string;
  taskId: string;
  artifactHash: string;
  protocolVersion: string;
  result: ArenaEvaluationResult;
  completedAt: string;
}

export interface StoredArenaArtifact {
  id: string;
  ownerId: string;
  taskId: string;
  artifactHash: string;
  artifact: ControllerArtifact;
}

export interface StoredArenaSubmission {
  id: string;
  taskId: string;
  userId: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  isLate?: boolean;
  studentLabel: string;
  artifactHash: string;
  artifact: ControllerArtifact;
  evaluation: ArenaEvaluationResult;
  evaluationProtocolVersion?: string;
  submissionAttemptKey?: string;
  reusedEvaluation?: boolean;
  submittedAt: string;
}

export interface ArenaSubmissionStore {
  findEvaluationByHash(taskId: string, artifactHash: string, protocolVersion: string): Promise<StoredArenaEvaluation | null>;
  findDuplicateSubmissionByArtifact?(input: {
    taskId: string;
    userId: string;
    publicationId?: string;
    artifactHash: string;
    protocolVersion: string;
  }): Promise<StoredArenaSubmission | null>;
  createEvaluation(input: Omit<StoredArenaEvaluation, 'id'>): Promise<StoredArenaEvaluation>;
  upsertArtifact(input: Omit<StoredArenaArtifact, 'id'>): Promise<StoredArenaArtifact>;
  createSubmission(input: Omit<StoredArenaSubmission, 'id'> & {
    artifactId: string;
    evaluationId: string;
  }): Promise<StoredArenaSubmission>;
}

export interface CreatePersistedArenaSubmissionInput {
  taskId: string;
  artifact: ControllerArtifact;
  userId: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  isLate?: boolean;
  studentLabel: string;
  submittedAt: string;
  store: ArenaSubmissionStore;
  blackBoxExperimentStore?: ArenaBlackBoxExperimentStore;
  identificationModelStore?: ArenaIdentificationModelStore;
  source?: 'odyssey-bridge';
}

async function assertBlackBoxExperimentOwnership(input: {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  blackBoxExperimentStore?: ArenaBlackBoxExperimentStore;
  identificationModelStore?: ArenaIdentificationModelStore;
  submittedAt: string;
}): Promise<ControllerArtifact> {
  if (input.artifact.method !== 'black-box-control') return input.artifact;

  const datasetHash = input.artifact.params.experimentDatasetHash;
  const identificationModelId = input.artifact.params.identificationModelId;

  if (typeof datasetHash !== 'string' || !datasetHash.startsWith('arena-blackbox-dataset-')) {
    throw new ArenaSubmissionInputError('Black-box submissions must reference a persisted experiment dataset.');
  }
  if (typeof identificationModelId !== 'string' || !identificationModelId.trim()) {
    throw new ArenaSubmissionInputError('Black-box submissions must reference a server registered identification model.');
  }
  if (!input.blackBoxExperimentStore) {
    throw new ArenaSubmissionInputError('Black-box experiment ownership store is required.');
  }
  if (!input.identificationModelStore) {
    throw new ArenaSubmissionInputError('Black-box identification model registry store is required.');
  }

  const registeredModel = await input.identificationModelStore.findOwnedIdentificationModel({
    userId: input.userId,
    taskId: input.taskId,
    modelId: identificationModelId,
  });

  if (!registeredModel) {
    throw new ArenaSubmissionInputError('Black-box submissions must reference a server registered identification model owned by the current student.');
  }
  if (registeredModel.datasetHash !== datasetHash) {
    throw new ArenaSubmissionInputError('Black-box submission registered model does not match the experiment dataset.');
  }

  const experiment = await input.blackBoxExperimentStore.findOwnedExperiment({
    userId: input.userId,
    taskId: input.taskId,
    datasetHash,
    experimentId: registeredModel.sourceExperimentId,
  });

  if (!experiment) {
    throw new ArenaSubmissionInputError('Black-box experiment dataset does not belong to the current student.');
  }
  if (typeof input.blackBoxExperimentStore.countOwnedExperiments !== 'function') {
    throw new ArenaSubmissionInputError('Black-box experiment count store is required.');
  }

  const experimentCount = await input.blackBoxExperimentStore.countOwnedExperiments({
    userId: input.userId,
    taskId: input.taskId,
    since: startOfUtcDay(input.submittedAt).toISOString(),
    atOrBefore: input.submittedAt,
  });

  return {
    ...input.artifact,
    params: {
      representation: 'identified-model-controller',
      experimentDatasetHash: datasetHash,
      identificationModelId,
      identificationQuality: registeredModel.validationSummary.validationFit,
      experimentCount,
      controllerGain: input.artifact.params.controllerGain,
      dampingCompensation: input.artifact.params.dampingCompensation,
      energyBudget: input.artifact.params.energyBudget,
    },
  };
}

function normalizeSubmissionArtifact(taskId: string, artifact: ControllerArtifact): ControllerArtifact {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new ArenaSubmissionInputError(`Unknown arena task: ${taskId}`);
  }
  if (!task.allowedMethods.includes(artifact.method)) {
    throw new ArenaSubmissionInputError(`Controller method ${artifact.method} is not allowed for ${taskId}`);
  }
  if (artifact.method !== 'code-controller') {
    return { ...artifact, taskId };
  }
  return {
    ...artifact,
    taskId,
    params: normalizeCodeControllerManifest(artifact.params as unknown as CodeControllerManifest),
  };
}

function assertTrustedOdysseySubmissionSource(input: CreatePersistedArenaSubmissionInput): void {
  const task = getArenaChallengeTask(input.taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : null;
  if (object?.source !== 'control-odyssey') return;

  if (input.source !== 'odyssey-bridge') {
    throw new ArenaSubmissionInputError('Control Odyssey Arena submissions must be created by the Odyssey bridge.');
  }
}

function buildSubmissionAttemptKey(input: {
  taskId: string;
  userId: string;
  publicationId?: string;
  artifactHash: string;
  protocolVersion: string;
}): string {
  return [
    input.userId,
    input.publicationId ?? 'no-publication',
    input.taskId,
    input.artifactHash,
    input.protocolVersion,
  ].join(':');
}

export async function createPersistedArenaSubmission(
  input: CreatePersistedArenaSubmissionInput,
): Promise<ArenaSubmissionRecord> {
  assertTrustedOdysseySubmissionSource(input);
  getArenaPlantAdapterForOfficialEvaluationTaskId(input.taskId);
  const artifact = await assertBlackBoxExperimentOwnership({
    userId: input.userId,
    taskId: input.taskId,
    artifact: normalizeSubmissionArtifact(input.taskId, input.artifact),
    blackBoxExperimentStore: input.blackBoxExperimentStore,
    identificationModelStore: input.identificationModelStore,
    submittedAt: input.submittedAt,
  });
  const artifactHash = hashControllerArtifact(artifact);
  const protocolVersion = getArenaEvaluationProtocolVersion({ taskId: input.taskId, method: artifact.method });

  const cacheBinding = resolveArenaEvaluationCacheBinding(input.taskId);
  const cachedEvaluation = isCompleteArenaEvaluationCacheIdentity({
    taskId: input.taskId,
    artifactHash,
    protocolVersion,
  })
    ? await input.store.findEvaluationByHash(input.taskId, artifactHash, protocolVersion)
    : null;
  const existingEvaluation = cachedEvaluation
    && !arenaEvaluationCacheBindingConflicts(cachedEvaluation.result.metadata, cacheBinding)
    ? cachedEvaluation
    : null;
  const duplicateSubmission = await input.store.findDuplicateSubmissionByArtifact?.({
    taskId: input.taskId,
    userId: input.userId,
    publicationId: input.publicationId,
    artifactHash,
    protocolVersion,
  }) ?? null;
  let evaluation: ArenaEvaluationResult;
  try {
    evaluation = existingEvaluation?.result ?? await evaluateArenaSubmission({ taskId: input.taskId, artifact });
  } catch (error) {
    if (error instanceof ControlEngineFailure) throw error;
    const message = error instanceof Error ? error.message : 'Invalid Arena submission';
    throw new ArenaSubmissionInputError(message);
  }
  const storedEvaluation = existingEvaluation ?? await input.store.createEvaluation({
    taskId: input.taskId,
    artifactHash,
    protocolVersion,
    result: {
      ...evaluation,
      metadata: withArenaEvaluationCacheBinding(evaluation.metadata, cacheBinding),
    },
    completedAt: input.submittedAt,
  });
  const storedArtifact = await input.store.upsertArtifact({
    ownerId: input.userId,
    taskId: input.taskId,
    artifactHash,
    artifact,
  });
  const storedSubmission = await input.store.createSubmission({
    taskId: input.taskId,
    userId: input.userId,
    classId: input.classId,
    seasonId: input.seasonId,
    publicationId: input.publicationId,
    isLate: input.isLate,
    studentLabel: input.studentLabel,
    artifactHash,
    artifact,
    evaluation: { ...evaluation, artifact },
    submittedAt: input.submittedAt,
    evaluationProtocolVersion: protocolVersion,
    submissionAttemptKey: duplicateSubmission ? undefined : buildSubmissionAttemptKey({
      taskId: input.taskId,
      userId: input.userId,
      publicationId: input.publicationId,
      artifactHash,
      protocolVersion,
    }),
    artifactId: storedArtifact.id,
    evaluationId: storedEvaluation.id,
  });

  return {
    id: storedSubmission.id,
    taskId: storedSubmission.taskId,
    userId: storedSubmission.userId,
    classId: storedSubmission.classId,
    seasonId: storedSubmission.seasonId,
    publicationId: storedSubmission.publicationId,
    isLate: storedSubmission.isLate,
    studentLabel: storedSubmission.studentLabel,
    artifactHash: storedSubmission.artifactHash,
    artifact: storedSubmission.artifact,
    evaluation: storedSubmission.evaluation,
    evaluationProtocolVersion: protocolVersion,
    submittedAt: storedSubmission.submittedAt,
    reusedEvaluation: Boolean(duplicateSubmission) || storedSubmission.reusedEvaluation === true,
  };
}

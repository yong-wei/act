import { evaluateArenaSubmission, getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';
import type { ArenaBlackBoxExperimentStore } from '../blackbox/experiment-service';
import { getArenaChallengeTask } from '../data/seed-challenges';
import {
  normalizeCodeControllerManifest,
  type CodeControllerManifest,
} from './controller-artifact-builder';
import { hashControllerArtifact } from './artifact-hash';
import type { ArenaSubmissionRecord } from './submission-service';

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
  submittedAt: string;
}

export interface ArenaSubmissionStore {
  findEvaluationByHash(taskId: string, artifactHash: string, protocolVersion: string): Promise<StoredArenaEvaluation | null>;
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
}

function expectedIdentificationModelId(datasetHash: string): string {
  return `arena-identification-${datasetHash.replace('arena-blackbox-dataset-', '').slice(0, 12)}`;
}

async function assertBlackBoxExperimentOwnership(input: {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  blackBoxExperimentStore?: ArenaBlackBoxExperimentStore;
}) {
  if (input.artifact.method !== 'black-box-control') return;

  const datasetHash = input.artifact.params.experimentDatasetHash;
  const identificationModelId = input.artifact.params.identificationModelId;

  if (typeof datasetHash !== 'string' || !datasetHash.startsWith('arena-blackbox-dataset-')) {
    throw new ArenaSubmissionInputError('Black-box submissions must reference a persisted experiment dataset.');
  }
  if (typeof identificationModelId !== 'string' || identificationModelId !== expectedIdentificationModelId(datasetHash)) {
    throw new ArenaSubmissionInputError('Black-box submissions must reference the identification model derived from the experiment dataset.');
  }
  if (!input.blackBoxExperimentStore) {
    throw new ArenaSubmissionInputError('Black-box experiment ownership store is required.');
  }

  const experiment = await input.blackBoxExperimentStore.findOwnedExperiment({
    userId: input.userId,
    taskId: input.taskId,
    datasetHash,
  });

  if (!experiment) {
    throw new ArenaSubmissionInputError('Black-box experiment dataset does not belong to the current student.');
  }
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

export async function createPersistedArenaSubmission(
  input: CreatePersistedArenaSubmissionInput,
): Promise<ArenaSubmissionRecord> {
  const artifact = normalizeSubmissionArtifact(input.taskId, input.artifact);
  const artifactHash = hashControllerArtifact(artifact);
  const protocolVersion = getArenaEvaluationProtocolVersion({ taskId: input.taskId, method: artifact.method });

  await assertBlackBoxExperimentOwnership({
    userId: input.userId,
    taskId: input.taskId,
    artifact,
    blackBoxExperimentStore: input.blackBoxExperimentStore,
  });

  const existingEvaluation = await input.store.findEvaluationByHash(input.taskId, artifactHash, protocolVersion);
  let evaluation: ArenaEvaluationResult;
  try {
    evaluation = existingEvaluation?.result ?? await evaluateArenaSubmission({ taskId: input.taskId, artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Arena submission';
    throw new ArenaSubmissionInputError(message);
  }
  const storedEvaluation = existingEvaluation ?? await input.store.createEvaluation({
    taskId: input.taskId,
    artifactHash,
    protocolVersion,
    result: evaluation,
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
    submittedAt: storedSubmission.submittedAt,
    reusedEvaluation: Boolean(existingEvaluation),
  };
}

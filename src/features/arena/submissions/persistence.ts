import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';
import { hashControllerArtifact } from './artifact-hash';
import type { ArenaSubmissionRecord } from './submission-service';

export const ARENA_EVALUATION_PROTOCOL_VERSION = 'whitebox-v1';

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
  studentLabel: string;
  submittedAt: string;
  store: ArenaSubmissionStore;
}

export async function createPersistedArenaSubmission(
  input: CreatePersistedArenaSubmissionInput,
): Promise<ArenaSubmissionRecord> {
  const artifact = { ...input.artifact, taskId: input.taskId };
  const artifactHash = hashControllerArtifact(artifact);
  const protocolVersion = ARENA_EVALUATION_PROTOCOL_VERSION;
  const existingEvaluation = await input.store.findEvaluationByHash(input.taskId, artifactHash, protocolVersion);
  let evaluation: ArenaEvaluationResult;
  try {
    evaluation = existingEvaluation?.result ?? evaluateWhiteBoxSubmission({ taskId: input.taskId, artifact });
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
    studentLabel: storedSubmission.studentLabel,
    artifactHash: storedSubmission.artifactHash,
    artifact: storedSubmission.artifact,
    evaluation: storedSubmission.evaluation,
    submittedAt: storedSubmission.submittedAt,
    reusedEvaluation: Boolean(existingEvaluation),
  };
}

import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';
import { hashControllerArtifact } from './artifact-hash';

export interface ArenaSubmissionRecord {
  id: string;
  taskId: string;
  userId?: string;
  classId?: string;
  seasonId?: string;
  studentLabel: string;
  artifactHash: string;
  artifact: ControllerArtifact;
  evaluation: ArenaEvaluationResult;
  submittedAt: string;
  reusedEvaluation: boolean;
}

export interface CreateArenaSubmissionInput {
  taskId: string;
  artifact: ControllerArtifact;
  studentLabel: string;
  classId?: string;
  seasonId?: string;
  submittedAt: string;
  existingSubmissions: ArenaSubmissionRecord[];
}

export function createArenaSubmission(input: CreateArenaSubmissionInput): ArenaSubmissionRecord {
  const artifact = { ...input.artifact, taskId: input.taskId };
  const artifactHash = hashControllerArtifact(artifact);
  const duplicate = input.existingSubmissions.find(
    (submission) => submission.taskId === input.taskId && submission.artifactHash === artifactHash,
  );
  const evaluation = duplicate?.evaluation ?? evaluateWhiteBoxSubmission({ taskId: input.taskId, artifact });

  return {
    id: `submission-${artifactHash}-${Date.parse(input.submittedAt) || 0}`,
    taskId: input.taskId,
    classId: input.classId,
    seasonId: input.seasonId,
    studentLabel: input.studentLabel,
    artifactHash,
    artifact,
    evaluation,
    submittedAt: input.submittedAt,
    reusedEvaluation: Boolean(duplicate),
  };
}

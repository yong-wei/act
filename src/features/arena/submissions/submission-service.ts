import { evaluateArenaSubmission } from '../evaluation/evaluator';
import { hashControllerArtifact } from './artifact-hash';
import type { ArenaSubmissionRecord, CreateArenaSubmissionInput } from './types';

export type { ArenaSubmissionRecord, CreateArenaSubmissionInput } from './types';

export async function createArenaSubmission(input: CreateArenaSubmissionInput): Promise<ArenaSubmissionRecord> {
  const artifact = { ...input.artifact, taskId: input.taskId };
  const artifactHash = hashControllerArtifact(artifact);
  const duplicate = input.existingSubmissions.find(
    (submission) => submission.taskId === input.taskId && submission.artifactHash === artifactHash,
  );
  const evaluation = duplicate?.evaluation ?? await evaluateArenaSubmission({ taskId: input.taskId, artifact });

  return {
    id: `submission-${artifactHash}-${Date.parse(input.submittedAt) || 0}`,
    taskId: input.taskId,
    classId: input.classId,
    seasonId: input.seasonId,
    publicationId: input.publicationId,
    isLate: input.isLate,
    studentLabel: input.studentLabel,
    artifactHash,
    artifact,
    evaluation,
    submittedAt: input.submittedAt,
    reusedEvaluation: Boolean(duplicate),
  };
}

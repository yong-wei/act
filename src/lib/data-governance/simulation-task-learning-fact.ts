import { createHash } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import type { GovernedTaskEvidenceContext } from './simulation-task-evidence';
import type { TaskMaterializationResult } from './simulation-task-materialization';

interface LearningFactCreateManyDelegate {
  createMany(args: {
    data: Prisma.LearningFactCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
}

export interface PersistSimulationTaskEvidenceInput {
  userId: string;
  evidence: GovernedTaskEvidenceContext;
  sourceLogId: string;
  courseId?: string | null;
  lessonId?: string | null;
  sessionId?: string | null;
}

export function buildSimulationTaskLearningFact(
  input: PersistSimulationTaskEvidenceInput,
): Prisma.LearningFactCreateManyInput {
  const occurredAt = new Date(input.evidence.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error('Simulation task evidence occurredAt must be a valid timestamp.');
  }
  const sourceDigest = createHash('sha256')
    .update(`${input.evidence.artifactKey}\u001f${input.evidence.tier}`)
    .digest('hex');

  return {
    userId: input.userId,
    factType: 'simulation_task_evidence',
    moduleId: input.evidence.taskKey,
    sessionId: input.sessionId ?? null,
    startedAt: occurredAt,
    finishedAt: occurredAt,
    outcome: input.evidence.tier === 'clear' || input.evidence.tier === 'submission'
      ? 'success'
      : 'partial',
    score: null,
    timeSpent: null,
    competencyContribution: {},
    sourceEventId: `simulation-task-evidence:${sourceDigest}`,
    sourceLogId: input.sourceLogId,
    courseId: input.courseId ?? null,
    lessonId: input.lessonId ?? null,
    contextJson: {
      simulationTaskEvidence: input.evidence,
    } as unknown as Prisma.InputJsonValue,
  };
}

export async function persistSimulationTaskEvidence(
  db: { learningFact: LearningFactCreateManyDelegate },
  input: PersistSimulationTaskEvidenceInput,
): Promise<{ created: number; skipped: boolean }> {
  const result = await db.learningFact.createMany({
    data: [buildSimulationTaskLearningFact(input)],
    skipDuplicates: true,
  });
  return {
    created: result.count,
    skipped: result.count === 0,
  };
}

export async function persistAcceptedSimulationTaskEvidence(
  db: { learningFact: LearningFactCreateManyDelegate },
  result: TaskMaterializationResult,
  refs: Omit<PersistSimulationTaskEvidenceInput, 'evidence'>,
): Promise<{ created: number; skipped: boolean } | null> {
  if (result.status !== 'accepted' || !result.evidence) return null;
  return persistSimulationTaskEvidence(db, {
    ...refs,
    evidence: result.evidence,
  });
}

import { createHash } from 'node:crypto';

import { buildAdaptivePracticePathExecutionHref } from '@/lib/adaptive-practice-path-navigation';

export type KonlingContinuityState = 'unfinished_task' | 'recent_mistake' | 'cold_start';

export interface KonlingContinuitySnapshot {
  snapshotId: string;
  state: KonlingContinuityState;
  evidenceAsOf: string | null;
  unfinishedTask?: {
    pathId: string;
    title: string;
    nodeId: string;
    href: string;
  };
  recentMistake?: {
    answerId: string;
    knowledgeId: string;
    knowledgeLabel: string;
    structuredCauseId: string | null;
    structuredCauseLabel: string | null;
  };
  feedback?: {
    result: 'correct' | 'incorrect';
    message: string;
    nextAction: string;
  };
}

export interface ContinuityDb {
  learningPath: {
    findFirst(args: unknown): Promise<{
      id: string;
      title: string;
      goalId: string | null;
      currentNodeId: string | null;
      updatedAt: Date;
    } | null>;
  };
  adaptiveAssessmentAnswer: {
    findFirst(args: unknown): Promise<{
      id: string;
      answeredAt: Date;
      isCorrect?: boolean;
      session?: { metadata?: unknown };
      questionRef: {
        knowledgeTags: string[];
        metadata: unknown;
      };
    } | null>;
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const candidate of value) {
    const normalized = optionalString(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function governedLearningGoalId(metadata: Record<string, unknown>): string | null {
  const itemRef = record(metadata.adaptiveAssessmentItemRef);
  const semanticRefs = record(itemRef.semanticRefs);
  return firstString(semanticRefs.learningGoalIds)
    ?? firstString(record(metadata.kaq).learningGoalIds)
    ?? firstString(record(metadata.generatedMetadata).learningGoalIds);
}

function snapshotId(userId: string, state: KonlingContinuityState, source: string): string {
  return `continuity:${createHash('sha256').update(`${userId}:${state}:${source}`).digest('hex').slice(0, 24)}`;
}

export async function resolveKonlingContinuitySnapshot(
  db: ContinuityDb,
  input: { userId: string },
): Promise<KonlingContinuitySnapshot> {
  const unfinishedTask = await db.learningPath.findFirst({
    where: {
      userId: input.userId,
      currentNodeId: { not: null },
      pathStatus: { in: ['active', 'fallback', 'legacy'] },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, goalId: true, currentNodeId: true, updatedAt: true },
  });

  if (unfinishedTask?.currentNodeId) {
    return {
      snapshotId: snapshotId(input.userId, 'unfinished_task', `${unfinishedTask.id}:${unfinishedTask.currentNodeId}:${unfinishedTask.updatedAt.toISOString()}`),
      state: 'unfinished_task',
      evidenceAsOf: unfinishedTask.updatedAt.toISOString(),
      unfinishedTask: {
        pathId: unfinishedTask.id,
        title: unfinishedTask.title,
        nodeId: unfinishedTask.currentNodeId,
        // 与 AI 工坊路径任务同一导航口径：goal/path/node + path-execution 意图（#1910）
        href: buildAdaptivePracticePathExecutionHref({
          goalId: unfinishedTask.goalId,
          pathId: unfinishedTask.id,
          nodeId: unfinishedTask.currentNodeId,
        }),
      },
    };
  }

  const recentMistake = await db.adaptiveAssessmentAnswer.findFirst({
    where: { userId: input.userId, isCorrect: false },
    orderBy: [{ answeredAt: 'desc' }, { id: 'desc' }],
    include: { questionRef: { select: { knowledgeTags: true, metadata: true } } },
  });

  if (recentMistake) {
    const metadata = record(recentMistake.questionRef.metadata);
    const structuredCause = record(metadata.structuredCause);
    const knowledgeId = governedLearningGoalId(metadata);
    if (!knowledgeId) {
      return {
        snapshotId: snapshotId(input.userId, 'cold_start', 'no-governed-history'),
        state: 'cold_start',
        evidenceAsOf: null,
      };
    }
    const latestAnswer = await db.adaptiveAssessmentAnswer.findFirst({
      where: { userId: input.userId },
      orderBy: [{ answeredAt: 'desc' }, { id: 'desc' }],
      include: {
        session: { select: { metadata: true } },
        questionRef: { select: { knowledgeTags: true, metadata: true } },
      },
    });
    const latestSessionMetadata = record(latestAnswer?.session?.metadata);
    const isCompanionResult = latestSessionMetadata.origin === 'konling-companion-practice'
      && latestSessionMetadata.targetKnowledgeId === knowledgeId;
    const feedback = isCompanionResult && typeof latestAnswer?.isCorrect === 'boolean'
      ? {
          result: latestAnswer.isCorrect ? 'correct' as const : 'incorrect' as const,
          message: latestAnswer.isCorrect
            ? '本题已正确；单次正确不代表稳定掌握。'
            : '本题尚未通过，该知识点仍需练习。',
          nextAction: '继续做一道陪伴练习',
        }
      : undefined;
    const snapshotSource = feedback && latestAnswer
      ? `${recentMistake.id}:${latestAnswer.id}:${latestAnswer.answeredAt.toISOString()}`
      : `${recentMistake.id}:${recentMistake.answeredAt.toISOString()}`;
    return {
      snapshotId: snapshotId(input.userId, 'recent_mistake', snapshotSource),
      state: 'recent_mistake',
      evidenceAsOf: recentMistake.answeredAt.toISOString(),
      recentMistake: {
        answerId: recentMistake.id,
        knowledgeId,
        knowledgeLabel: optionalString(metadata.knowledgeLabel) ?? knowledgeId,
        structuredCauseId: optionalString(structuredCause.id),
        structuredCauseLabel: optionalString(structuredCause.label),
      },
      feedback,
    };
  }

  return {
    snapshotId: snapshotId(input.userId, 'cold_start', 'no-governed-history'),
    state: 'cold_start',
    evidenceAsOf: null,
  };
}

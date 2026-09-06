import { isLearningFactEligibleForPersonalization } from '@/lib/data-governance/learning-fact-quality-weight';
import type { AdaptiveLearnerStateDb } from '@/features/personalization/learner-state/internal';
import type { GoalPluginEvidencePort } from '../types';
import { readString } from '../json';
import {
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
} from './mappings';
import {
  buildExplicitControlCorrectionLearningFactWhere,
  buildLegacyControlCorrectionLearningFactWhere,
  hasExplicitAdaptiveGoal,
  isControlCorrectionFact,
  isLegacyControlCorrectionFact,
} from './evidence-match';

const CONTROL_CORRECTION_FACT_TAKE = 500;

function uniqueFactsById(facts: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];
  for (const fact of facts) {
    const id = readString(fact.id);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    result.push(fact);
  }
  return result;
}

export async function readControlCorrectionLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  if (!db.learningFact?.findMany) {
    return [];
  }

  const [explicitFacts, legacyFacts] = await Promise.all([
    readPagedControlCorrectionLearningFacts({
      findMany: db.learningFact.findMany,
      where: buildExplicitControlCorrectionLearningFactWhere(userId),
      filter: isControlCorrectionFact,
    }),
    readLegacyControlCorrectionLearningFacts(db, userId),
  ]);

  return uniqueFactsById([...explicitFacts, ...legacyFacts]);
}

async function readLegacyControlCorrectionLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const findMany = db.learningFact?.findMany;
  if (!findMany) {
    return [];
  }

  return readPagedControlCorrectionLearningFacts({
    findMany,
    where: buildLegacyControlCorrectionLearningFactWhere(userId),
    filter: (fact) => !hasExplicitAdaptiveGoal(fact) && isLegacyControlCorrectionFact(fact),
  });
}

async function readPagedControlCorrectionLearningFacts(input: {
  findMany: (args: any) => Promise<Array<Record<string, unknown>>>;
  where: Record<string, unknown>;
  filter: (fact: Record<string, unknown>) => boolean;
}): Promise<Array<Record<string, unknown>>> {
  const facts: Array<Record<string, unknown>> = [];
  let cursorId: string | null = null;
  while (facts.length < CONTROL_CORRECTION_FACT_TAKE) {
    const rows = await input.findMany({
      where: input.where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: CONTROL_CORRECTION_FACT_TAKE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    facts.push(...rows.filter((fact) =>
      input.filter(fact) && isLearningFactEligibleForPersonalization(fact.contextJson),
    ));
    if (facts.length >= CONTROL_CORRECTION_FACT_TAKE || rows.length < CONTROL_CORRECTION_FACT_TAKE) {
      break;
    }
    const lastId = readString(rows.at(-1)?.id);
    if (!lastId || lastId === cursorId) {
      break;
    }
    cursorId = lastId;
  }

  return facts.slice(0, CONTROL_CORRECTION_FACT_TAKE);
}

export function createControlCorrectionEvidencePort(
  db: AdaptiveLearnerStateDb,
): GoalPluginEvidencePort {
  return {
    readFacts: (userId) => readControlCorrectionLearningFacts(db, userId),
    readArenaSubmissions: async (userId) => {
      const submissions = await db.arenaSubmission?.findMany?.({
        where: {
          userId,
          valid: true,
          taskId: { in: [...CONTROL_CORRECTION_ARENA_TASK_ID_VALUES] },
        },
        include: {
          controllerArtifact: true,
          evaluationRun: true,
        },
        orderBy: { submittedAt: 'desc' },
        take: 200,
      }) ?? [];
      const { attachPersistedArenaWritebacks } = await import(
        '@/features/personalization/learner-state/effectful-reads'
      );
      return attachPersistedArenaWritebacks(db, submissions);
    },
    readAgentToolRuns: async (userId) => db.agentToolRun?.findMany?.({
      where: {
        targetUserId: userId,
        courseId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] },
        status: { in: ['completed', 'succeeded', 'success'] },
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }) ?? [],
  };
}

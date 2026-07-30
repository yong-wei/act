import { createPrismaClient } from '../../src/lib/prisma-client';
/**
 * Migrate to Learning Facts
 *
 * Transforms existing data into unified LearningFact format.
 * New rows stamp LEGACY identity via the fixed-identity adapter (#1116).
 */

import type { Prisma } from '@prisma/client';

import {
  writeLegacyKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';

const prisma = createPrismaClient();

async function writeLegacyFacts(rows: LearningFactWriteRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const activeRevision = await resolveActiveKnowledgeRevision(prisma);
  const result = await writeLegacyKnowledgeScopedLearningFacts(
    {
      learningFact: {
        createMany: async (args) => prisma.learningFact.createMany({
          data: [...args.data] as Prisma.LearningFactCreateManyInput[],
          skipDuplicates: args.skipDuplicates,
        }),
      },
    },
    rows,
    { knowledgeRevisionRef: activeRevision.id },
  );
  return result.written;
}

async function migrateToLearningFacts() {
  console.log('[Migration] Starting LearningFacts migration...');

  // 1. Migrate SimulationLogs
  console.log('[Migration] Processing SimulationLogs...');
  const simulationLogs = await prisma.simulationLog.findMany({
    take: 1000, // Process in batches
  });

  const simulationFacts = simulationLogs.map((log) => ({
    userId: log.userId,
    factType: 'simulation',
    moduleId: log.missionId,
    sessionId: log.sessionId,
    startedAt: log.createdAt,
    finishedAt: log.createdAt,
    outcome: log.score && log.score > 60 ? 'success' : log.score && log.score > 30 ? 'partial' : 'failure',
    score: log.score,
    timeSpent: Math.round(log.duration || 0),
    competencyContribution: {
      parameterDesign: log.score ? log.score / 100 : 0,
      engineeringDecision: log.isEthicalViolation ? -0.5 : 0.3,
    },
    sourceLogId: log.id,
    createdAt: log.createdAt,
  })) as LearningFactWriteRow[];

  if (simulationFacts.length > 0) {
    const written = await writeLegacyFacts(simulationFacts);
    console.log(`[Migration] Migrated ${written} simulation logs`);
  }

  // 2. Migrate UserAnswers
  console.log('[Migration] Processing UserAnswers...');
  const userAnswers = await prisma.userAnswer.findMany({
    take: 1000,
    include: { question: true },
  });

  const answerFacts = userAnswers.map((answer) => ({
    userId: answer.userId,
    factType: 'question',
    moduleId: answer.questionId,
    startedAt: answer.createdAt,
    finishedAt: answer.createdAt,
    outcome: answer.isCorrect ? 'success' : 'failure',
    score: answer.isCorrect ? 100 : 0,
    timeSpent: answer.timeSpent,
    competencyContribution: {
      controlModeling: answer.isCorrect ? 0.8 : 0.1,
      crossDomainTransfer: answer.question?.crossDomainHint ? 0.5 : 0,
    },
    sourceLogId: answer.id,
    createdAt: answer.createdAt,
  })) as LearningFactWriteRow[];

  if (answerFacts.length > 0) {
    const written = await writeLegacyFacts(answerFacts);
    console.log(`[Migration] Migrated ${written} user answers`);
  }

  // 3. Migrate AIInterventions
  console.log('[Migration] Processing AIInterventions...');
  const interventions = await prisma.aIIntervention.findMany({
    take: 1000,
  });

  const interventionFacts = interventions.map((intervention) => ({
    userId: intervention.userId,
    factType: 'ai_intervention',
    sessionId: intervention.sessionId,
    startedAt: intervention.createdAt,
    finishedAt: intervention.createdAt,
    outcome: intervention.wasHelpful ? 'success' : intervention.wasHelpful === false ? 'failure' : 'partial',
    score: intervention.wasHelpful ? 100 : intervention.wasHelpful === false ? 0 : 50,
    competencyContribution: {
      inquiryReflection: intervention.wasHelpful ? 0.7 : 0.2,
      selfDirectedLearning: 0.4,
    },
    sourceLogId: intervention.id,
    createdAt: intervention.createdAt,
  })) as LearningFactWriteRow[];

  if (interventionFacts.length > 0) {
    const written = await writeLegacyFacts(interventionFacts);
    console.log(`[Migration] Migrated ${written} AI interventions`);
  }

  // 4. Migrate PromptAssessments
  console.log('[Migration] Processing PromptAssessments...');
  const assessments = await prisma.promptAssessment.findMany({
    take: 1000,
  });

  const promptFacts = assessments.map((assessment) => ({
    userId: assessment.userId,
    factType: 'prompt_design',
    sessionId: assessment.sessionId,
    startedAt: assessment.createdAt,
    finishedAt: assessment.createdAt,
    outcome: assessment.overallScore > 70 ? 'success' : assessment.overallScore > 40 ? 'partial' : 'failure',
    score: assessment.overallScore,
    competencyContribution: {
      inquiryReflection: (assessment.overallScore || 0) / 100,
      selfDirectedLearning: (assessment.iterationCount || 0) > 3 ? 0.5 : 0.2,
    },
    sourceLogId: assessment.id,
    createdAt: assessment.createdAt,
  })) as LearningFactWriteRow[];

  if (promptFacts.length > 0) {
    const written = await writeLegacyFacts(promptFacts);
    console.log(`[Migration] Migrated ${written} prompt assessments`);
  }

  console.log('[Migration] LearningFacts migration complete');
}

migrateToLearningFacts()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

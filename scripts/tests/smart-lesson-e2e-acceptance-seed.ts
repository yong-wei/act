import { hash } from 'bcryptjs';

import { PROJECTION_INDEPENDENT_LEARNER_MINIMUM } from '../../src/features/learning-record/projections/types';
import { createPrismaClient } from '../../src/lib/prisma-client';
import { accountByKey } from '../db/verified-test-accounts.mjs';

type PrismaClient = ReturnType<typeof createPrismaClient>;

export { PROJECTION_INDEPENDENT_LEARNER_MINIMUM };

export async function seedSmartLessonE2EClassContext(
  prisma: PrismaClient,
  input: {
    teacherId: string;
    classId: string;
    schemaName: string;
    seedKey: string;
  },
) {
  const teacher = accountByKey('teacher');
  const student = accountByKey('student');
  await prisma.user.create({
    data: {
      id: input.teacherId,
      email: teacher.email,
      name: teacher.name,
      role: 'TEACHER',
      employeeNumber: teacher.employeeNumber,
      passwordHash: await hash(teacher.password, 10),
    },
  });
  await prisma.class.create({
    data: {
      id: input.classId,
      teacherId: input.teacherId,
      name: '自动控制原理验收班',
      code: `E${input.seedKey.replace(/[^0-9a-z]/gi, '').slice(-5).padStart(5, '0')}`,
    },
  });
  await prisma.user.update({
    where: { id: input.teacherId },
    data: { defaultTeachingClassId: input.classId },
  });
  await seedCurrentCumulativeClassPortrait(prisma, {
    classId: input.classId,
    schemaName: input.schemaName,
    seedKey: input.seedKey,
    canonicalStudent: student,
    studentPasswordHash: await hash(student.password, 10),
  });
}

async function seedCurrentCumulativeClassPortrait(
  prisma: PrismaClient,
  input: {
    classId: string;
    schemaName: string;
    seedKey: string;
    canonicalStudent: ReturnType<typeof accountByKey>;
    studentPasswordHash: string;
  },
) {
  const {
    CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
    materializeCumulativeClassPortrait,
  } = await import('../../src/lib/data-governance/cumulative-class-materialization');
  const { PORTRAIT_V2_CALCULATION_VERSION } = await import('../../src/lib/data-governance/portrait-v2-model');
  const migrationRunId = `smart-lesson-real-migration-${input.seedKey}`;
  const now = new Date();
  const publication = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${input.schemaName}", public`);
    const currentFence = await tx.cumulativePortraitCutoverFence.findUnique({
      where: { id: 'global' },
    });
    const next = {
      cutoverFence: BigInt(currentFence?.fence ?? 0) + 1n,
      learnerGeneration: BigInt(currentFence?.learnerGeneration ?? 0) + 1n,
      generation: BigInt(currentFence?.classGeneration ?? 0) + 1n,
      queueGeneration: BigInt(currentFence?.queueGeneration ?? 0) + 1n,
    };
    const nextPublication = {
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      materializationVersion: CUMULATIVE_CLASS_PORTRAIT_MATERIALIZATION_VERSION,
      migrationRunId,
      ...next,
    };
    await tx.cumulativePortraitMigrationRun.create({
      data: {
        id: migrationRunId,
        mode: 'APPLY',
        status: 'COMPLETED',
        calculationVersion: nextPublication.calculationVersion,
        classMaterializationVersion: nextPublication.materializationVersion,
        learnerGeneration: nextPublication.learnerGeneration,
        classGeneration: nextPublication.generation,
        queueGeneration: nextPublication.queueGeneration,
        cutoverFence: nextPublication.cutoverFence,
        inputDigest: 'smart-lesson-real-e2e',
        verificationDigest: 'smart-lesson-real-e2e',
        startedAt: now,
        completedAt: now,
      },
    });
    const fenceData = {
      fence: nextPublication.cutoverFence,
      calculationVersion: nextPublication.calculationVersion,
      learnerGeneration: nextPublication.learnerGeneration,
      classMaterializationVersion: nextPublication.materializationVersion,
      classGeneration: nextPublication.generation,
      queueGeneration: nextPublication.queueGeneration,
      activeMigrationRunId: migrationRunId,
      advancedAt: now,
    };
    await tx.cumulativePortraitCutoverFence.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...fenceData },
      update: fenceData,
    });
    return nextPublication;
  });
  await seedIndependentClassLearners(prisma, {
    classId: input.classId,
    seedKey: input.seedKey,
    publication,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    now,
    canonicalStudent: input.canonicalStudent,
    studentPasswordHash: input.studentPasswordHash,
  });
  await materializeCumulativeClassPortrait(prisma, input.classId, { now, publication });
}

async function seedIndependentClassLearners(
  prisma: PrismaClient,
  input: {
    classId: string;
    seedKey: string;
    publication: {
      learnerGeneration: bigint;
      queueGeneration: bigint;
      cutoverFence: bigint;
      migrationRunId: string;
    };
    calculationVersion: string;
    now: Date;
    canonicalStudent: ReturnType<typeof accountByKey>;
    studentPasswordHash: string;
  },
) {
  const evidencedDimensionIds = [
    'controlModelingRepresentation',
    'systemAnalysisInterpretation',
    'controllerDesignSynthesis',
    'engineeringConstraintSafety',
    'transferIntegratedApplication',
    'reflectionImprovementAiCollab',
  ];
  for (let index = 0; index < PROJECTION_INDEPENDENT_LEARNER_MINIMUM; index += 1) {
    const userId = `smart-lesson-real-student-${input.seedKey}-${index}`;
    const canonical = index === 0;
    await prisma.user.create({
      data: {
        id: userId,
        email: canonical
          ? input.canonicalStudent.email
          : `smart-lesson-e2e-learner-${input.seedKey}-${index}@example.test`,
        name: canonical ? input.canonicalStudent.name : `验收班学生${index + 1}`,
        role: 'STUDENT',
        ...(canonical ? { passwordHash: input.studentPasswordHash } : {}),
        profile: {
          create: {
            studentNumber: canonical
              ? input.canonicalStudent.studentNumber
              : `S${input.seedKey}${index}`,
            classId: input.classId,
            major: '自动化',
          },
        },
      },
    });
    const snapshot = await prisma.studentPortraitV2Snapshot.create({
      data: {
        userId,
        snapshotAt: input.now,
        payloadVersion: 'learner-portrait.v2',
        calculationVersion: input.calculationVersion,
        migrationVersion: 'portrait-v2-cumulative-migration.v3',
        derivationKind: 'native',
        payload: nativeClassPortraitPayload(userId, input.now, input.calculationVersion),
      },
    });
    const state = await prisma.learnerPortraitStateVersion.create({
      data: {
        userId,
        calculationVersion: input.calculationVersion,
        generation: input.publication.learnerGeneration,
        queueGeneration: input.publication.queueGeneration,
        stateWatermark: 1n,
        taskInputDigest: 'smart-lesson-real-e2e',
        stateKind: 'SNAPSHOT',
        snapshotId: snapshot.id,
        overallScore: 0.65,
        dimensionCoverage: {
          evidencedDimensionIds,
          missingDimensionIds: ['simulationValidationEvidence'],
        },
        evidenceAsOf: input.now,
        confidence: 0.8,
        lastTrend: 'stable',
        lastRisk: null,
        availabilityReason: 'e2e-class-portrait-seed',
        generatedAt: input.now,
        cutoverFence: input.publication.cutoverFence,
        migrationRunId: input.publication.migrationRunId,
      },
    });
    await prisma.learnerPortraitCurrentState.create({
      data: {
        userId,
        stateVersionId: state.id,
        calculationVersion: input.calculationVersion,
        generation: input.publication.learnerGeneration,
        queueGeneration: input.publication.queueGeneration,
        stateWatermark: 1n,
        taskInputDigest: 'smart-lesson-real-e2e',
        cutoverFence: input.publication.cutoverFence,
      },
    });
  }
}

function nativeClassPortraitPayload(userId: string, generatedAt: Date, calculationVersion: string) {
  const asOf = generatedAt.toISOString();
  return {
    userId,
    payloadVersion: 'learner-portrait.v2',
    migrationVersion: 'portrait-v2-cumulative-migration.v3',
    generatedAt: asOf,
    derivation: { kind: 'native' as const, limitations: [] },
    dimensions: [
      'controlModelingRepresentation',
      'systemAnalysisInterpretation',
      'controllerDesignSynthesis',
      'simulationValidationEvidence',
      'engineeringConstraintSafety',
      'transferIntegratedApplication',
      'reflectionImprovementAiCollab',
    ].map((id) => {
      const evidenced = id !== 'simulationValidationEvidence';
      return {
        id,
        label: id,
        score: evidenced ? 0.65 : 0,
        confidence: evidenced ? 0.8 : 0,
        trend: 'stable',
        freshness: {
          state: evidenced ? 'current' : 'missing',
          asOf: evidenced ? asOf : null,
          evidenceAgeDays: evidenced ? 1 : null,
        },
        evidenceSummary: {
          totalCount: evidenced ? 2 : 0,
          sourceFamilyCounts: evidenced ? { LearningFact: 2 } : {},
        },
        lastPositiveEvidenceAt: evidenced ? asOf : null,
        lastNegativeEvidenceAt: null,
        rationale: 'e2e class-portrait seed',
        limitations: [],
        sourceLineage: [],
        calculationVersion,
      };
    }),
  };
}

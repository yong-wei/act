#!/usr/bin/env node
/**
 * Local-only seed: three path-planning mastery fixtures.
 * Zero / partial (≥0.5) / mastered (≥0.85 and confidence ≥0.6).
 */
import bcrypt from 'bcryptjs';

import { createPrismaClient } from '../lib/prisma-client.mjs';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
const ALGORITHM_VERSION = 'adaptive-assessment-bkt-v1';
const KNOWLEDGE_TAG = 'ctc:v11g-5845390ded447e37f06ea222';

const LEARNERS = [
  {
    key: 'zero',
    loginId: 'path_mastery_zero',
    email: 'path_mastery_zero@example.com',
    studentNumber: '202609130001',
    name: '路径掌握度-零',
    password: 'PathMasteryZero@Just2026!',
    mastery: null,
  },
  {
    key: 'partial',
    loginId: 'path_mastery_partial',
    email: 'path_mastery_partial@example.com',
    studentNumber: '202609130002',
    name: '路径掌握度-部分',
    password: 'PathMasteryPartial@Just2026!',
    mastery: { posteriorMastery: 0.62, confidence: 0.5, priorMastery: 0.2 },
  },
  {
    key: 'mastered',
    loginId: 'path_mastery_mastered',
    email: 'path_mastery_mastered@example.com',
    studentNumber: '202609130003',
    name: '路径掌握度-已掌握',
    password: 'PathMasteryMastered@Just2026!',
    mastery: { posteriorMastery: 0.9, confidence: 0.7, priorMastery: 0.6 },
  },
];

function assertLoopbackDatabase(databaseUrl) {
  let hostname;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (!loopbackHosts.has(hostname)) {
    throw new Error('seed-path-mastery-test-learners only allows a loopback DATABASE_URL');
  }
}

async function ensureLearner(prisma, spec) {
  const passwordHash = await bcrypt.hash(spec.password, 10);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: spec.email, mode: 'insensitive' } },
        { profile: { is: { studentNumber: { equals: spec.studentNumber, mode: 'insensitive' } } } },
      ],
    },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: spec.email,
        name: spec.name,
        role: 'STUDENT',
        passwordHash,
        profile: {
          upsert: {
            create: { studentNumber: spec.studentNumber },
            update: { studentNumber: spec.studentNumber },
          },
        },
      },
    });
  }
  return prisma.user.create({
    data: {
      email: spec.email,
      name: spec.name,
      role: 'STUDENT',
      passwordHash,
      profile: {
        create: { studentNumber: spec.studentNumber },
      },
    },
  });
}

async function replaceMastery(prisma, userId, spec) {
  const sessionKey = `path-mastery-${spec.key}`;
  await prisma.adaptiveAssessmentSession.deleteMany({
    where: { userId, sessionKey },
  });
  if (!spec.mastery) return { written: 0 };

  const algorithm = await prisma.adaptiveAssessmentAlgorithmVersion.upsert({
    where: { version: ALGORITHM_VERSION },
    update: { status: 'active' },
    create: {
      version: ALGORITHM_VERSION,
      family: 'bkt',
      parameters: { fixture: true },
      status: 'active',
    },
  });
  const questionId = `path-mastery-${spec.key}-q1`;
  const item = await prisma.adaptiveAssessmentItemRef.upsert({
    where: {
      questionId_algorithmVersion_contentHash: {
        questionId,
        algorithmVersion: algorithm.version,
        contentHash: 'c'.repeat(64),
      },
    },
    update: { knowledgeTags: [KNOWLEDGE_TAG] },
    create: {
      questionId,
      contentHash: 'c'.repeat(64),
      source: 'path-mastery-fixture',
      questionType: 'single',
      domains: ['control-theory'],
      knowledgeTags: [KNOWLEDGE_TAG],
      difficulty: 0.4,
      optionCount: 4,
      algorithmVersion: algorithm.version,
    },
  });
  const session = await prisma.adaptiveAssessmentSession.create({
    data: {
      userId,
      sessionKey,
      selectedQuestionIds: [questionId],
      algorithmVersion: algorithm.version,
      metadata: { fixture: 'path-mastery', knowledgeTag: KNOWLEDGE_TAG },
    },
  });
  const answer = await prisma.adaptiveAssessmentAnswer.create({
    data: {
      userId,
      sessionId: session.id,
      questionRefId: item.id,
      questionId,
      selectedOptionKey: 'A',
      correctOptionKey: 'A',
      isCorrect: true,
      score: 1,
      responseTimeSeconds: 12,
      abilityEstimate: spec.mastery.posteriorMastery,
      algorithmVersion: algorithm.version,
    },
  });
  await prisma.adaptiveMasteryUpdate.create({
    data: {
      userId,
      sessionId: session.id,
      answerId: answer.id,
      questionId,
      knowledgeTag: KNOWLEDGE_TAG,
      priorMastery: spec.mastery.priorMastery,
      posteriorMastery: spec.mastery.posteriorMastery,
      confidence: spec.mastery.confidence,
      evidenceKind: 'adaptive-assessment',
      algorithmVersion: algorithm.version,
      updateReason: 'path-mastery-fixture',
    },
  });
  return { written: 1 };
}

async function main() {
  assertLoopbackDatabase(process.env.DATABASE_URL ?? '');
  const prisma = createPrismaClient();
  try {
    const results = [];
    for (const spec of LEARNERS) {
      const user = await ensureLearner(prisma, spec);
      const mastery = await replaceMastery(prisma, user.id, spec);
      results.push({
        key: spec.key,
        userId: user.id,
        loginId: spec.loginId,
        studentNumber: spec.studentNumber,
        knowledgeTag: KNOWLEDGE_TAG,
        masteryWrites: mastery.written,
      });
    }
    console.log(JSON.stringify({ ok: true, learners: results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

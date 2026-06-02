import { createPrismaClient } from '../lib/prisma-client.mjs';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const prisma = createPrismaClient();

const SCENARIO_MIN_ATTEMPTS = 10;
const SCENARIO_MAX_ATTEMPTS = 30;
const SCENARIO_MIN_MINUTES = 60;
const SCENARIO_MAX_MINUTES = 300;
const EXERCISE_MIN_ATTEMPTS = 300;
const EXERCISE_MAX_ATTEMPTS = 500;
const GAME_MIN_ATTEMPTS = 1;
const GAME_MAX_ATTEMPTS = 30;
const GAME_MIN_SCORE = 1000;
const GAME_MAX_SCORE = 2000;

function readStudentNumbers() {
  return fs
    .readFileSync(path.join(process.cwd(), 'data/test_students.md'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

async function main() {
  const studentNumbers = readStudentNumbers();
  if (studentNumbers.length === 0) {
    throw new Error('未读取到任何学生账号');
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers } },
    select: { userId: true, studentNumber: true },
  });

  if (profiles.length !== studentNumbers.length) {
    throw new Error(`学生档案数量不匹配：名单 ${studentNumbers.length}，档案 ${profiles.length}`);
  }

  const userIds = profiles.map((item) => item.userId);
  const byUserId = new Map(profiles.map((item) => [item.userId, item.studentNumber]));

  const [answersAgg, simulationLogs] = await Promise.all([
    prisma.userAnswer.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.simulationLog.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        controlMode: true,
        score: true,
        duration: true,
        inputParams: true,
      },
    }),
  ]);

  const answerCountByUser = new Map(answersAgg.map((item) => [item.userId, item._count._all]));

  const scenarioStatsByUser = new Map();
  const gameStatsByUser = new Map();

  for (const log of simulationLogs) {
    const userId = log.userId;
    const params = safeObject(log.inputParams);
    const levelId = typeof params.levelId === 'string' ? params.levelId : null;
    const simulationType = typeof params.simulationType === 'string' ? params.simulationType : null;

    if (log.controlMode === 'GAME' || levelId) {
      const byLevel = gameStatsByUser.get(userId) ?? new Map();
      const stats = byLevel.get(levelId ?? 'unknown') ?? {
        attempts: 0,
        minScore: Number.POSITIVE_INFINITY,
        maxScore: Number.NEGATIVE_INFINITY,
      };
      stats.attempts += 1;
      const score = typeof log.score === 'number' ? log.score : 0;
      stats.minScore = Math.min(stats.minScore, score);
      stats.maxScore = Math.max(stats.maxScore, score);
      byLevel.set(levelId ?? 'unknown', stats);
      gameStatsByUser.set(userId, byLevel);
      continue;
    }

    if (!simulationType) {
      continue;
    }

    const byScenario = scenarioStatsByUser.get(userId) ?? new Map();
    const stats = byScenario.get(simulationType) ?? { attempts: 0, totalDurationSeconds: 0 };
    stats.attempts += 1;
    stats.totalDurationSeconds += typeof log.duration === 'number' ? log.duration : 0;
    byScenario.set(simulationType, stats);
    scenarioStatsByUser.set(userId, byScenario);
  }

  const failures = [];

  for (const profile of profiles) {
    const studentNumber = profile.studentNumber ?? profile.userId;
    const userId = profile.userId;

    const answerCount = answerCountByUser.get(userId) ?? 0;
    if (answerCount < EXERCISE_MIN_ATTEMPTS || answerCount > EXERCISE_MAX_ATTEMPTS) {
      failures.push(`[${studentNumber}] 习题尝试 ${answerCount}，不在 ${EXERCISE_MIN_ATTEMPTS}-${EXERCISE_MAX_ATTEMPTS}`);
    }

    const scenarioMap = scenarioStatsByUser.get(userId) ?? new Map();
    for (const [scenarioType, stats] of scenarioMap.entries()) {
      const totalMinutes = stats.totalDurationSeconds / 60;
      if (stats.attempts < SCENARIO_MIN_ATTEMPTS || stats.attempts > SCENARIO_MAX_ATTEMPTS) {
        failures.push(
          `[${studentNumber}] 仿真 ${scenarioType} 尝试 ${stats.attempts}，不在 ${SCENARIO_MIN_ATTEMPTS}-${SCENARIO_MAX_ATTEMPTS}`
        );
      }
      if (totalMinutes < SCENARIO_MIN_MINUTES || totalMinutes > SCENARIO_MAX_MINUTES) {
        failures.push(
          `[${studentNumber}] 仿真 ${scenarioType} 时长 ${totalMinutes.toFixed(1)} 分钟，不在 ${SCENARIO_MIN_MINUTES}-${SCENARIO_MAX_MINUTES}`
        );
      }
    }

    const levelMap = gameStatsByUser.get(userId) ?? new Map();
    for (const [levelId, stats] of levelMap.entries()) {
      if (stats.attempts < GAME_MIN_ATTEMPTS || stats.attempts > GAME_MAX_ATTEMPTS) {
        failures.push(
          `[${studentNumber}] 游戏 ${levelId} 尝试 ${stats.attempts}，不在 ${GAME_MIN_ATTEMPTS}-${GAME_MAX_ATTEMPTS}`
        );
      }
      if (stats.minScore < GAME_MIN_SCORE || stats.maxScore > GAME_MAX_SCORE) {
        failures.push(
          `[${studentNumber}] 游戏 ${levelId} 积分范围 ${stats.minScore}-${stats.maxScore}，不在 ${GAME_MIN_SCORE}-${GAME_MAX_SCORE}`
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error(`校验失败：${failures.length} 条`);
    console.error(failures.slice(0, 50).join('\n'));
    process.exit(1);
  }

  const totalAnswers = answersAgg.reduce((acc, item) => acc + item._count._all, 0);
  const totalLogs = simulationLogs.length;
  const totalStudents = profiles.length;

  console.log(
    `semester usage verification passed: students=${totalStudents}, answers=${totalAnswers}, simulationLogs=${totalLogs}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


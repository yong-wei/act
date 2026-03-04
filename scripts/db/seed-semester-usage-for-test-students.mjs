import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PrismaClient, ProgressStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SEMESTER_START = new Date('2025-03-03T08:00:00+08:00');
const SEMESTER_END = new Date('2025-06-30T22:00:00+08:00');
const GAME_START = new Date('2025-03-20T08:00:00+08:00');
const GAME_END = new Date('2025-06-30T22:00:00+08:00');

const QUESTION_BANK_SIZE = 180;
const LEVEL_IDS = Array.from({ length: 15 }, (_, idx) => `level-${idx + 1}`);
const CHUNK_SIZE = 400;

const SCENARIOS = [
  { id: 'destroyer', controlMode: 'PID', seaMin: 1, seaMax: 6 },
  { id: 'lng', controlMode: 'MPC', seaMin: 2, seaMax: 6 },
  { id: 'container', controlMode: 'MPC', seaMin: 2, seaMax: 6 },
  { id: 'cruise', controlMode: 'COMFORT', seaMin: 1, seaMax: 7 },
  { id: 'drilling', controlMode: 'DP', seaMin: 1, seaMax: 6 },
  { id: 'icebreaker', controlMode: 'ROBUST', seaMin: 3, seaMax: 8 },
  { id: 'dredger', controlMode: 'ADAPTIVE', seaMin: 2, seaMax: 6 },
];

const QUESTION_DOMAINS = [
  ['time', 'complex'],
  ['frequency'],
  ['complex'],
  ['time', 'frequency'],
  ['physical'],
  ['cross-domain'],
];

const QUESTION_TAGS = [
  ['pole-time-mapping'],
  ['frequency-stability-judgement'],
  ['cross-domain-mapping'],
  ['design-tradeoff'],
  ['prompt-structuring'],
  ['controller-tuning'],
];

const CONTROLLERS = ['P', 'PI', 'PD', 'PID', 'VFB', 'FF', 'SMITH'];
const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];
const TIER_ORDER = ['bronze', 'silver', 'gold'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pickOne(random, list) {
  return list[randInt(random, 0, list.length - 1)];
}

function pickMany(random, list, count) {
  const cloned = [...list];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = randInt(random, 0, i);
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned.slice(0, count);
}

function randomDate(random, start, end) {
  const ts = start.getTime() + random() * (end.getTime() - start.getTime());
  return new Date(Math.round(ts));
}

function splitTotalWithinBounds(random, total, count, minEach, maxEach) {
  const result = [];
  let remaining = total;

  for (let i = 0; i < count; i += 1) {
    const remainingSlots = count - i - 1;
    if (remainingSlots === 0) {
      result.push(remaining);
      break;
    }

    const low = Math.max(minEach, remaining - remainingSlots * maxEach);
    const high = Math.min(maxEach, remaining - remainingSlots * minEach);
    const value = randInt(random, low, high);
    result.push(value);
    remaining -= value;
  }

  return result;
}

function tierFromScore(score) {
  if (score >= 1700) return 'gold';
  if (score >= 1350) return 'silver';
  return 'bronze';
}

function maxTier(left, right) {
  const li = TIER_ORDER.indexOf(left);
  const ri = TIER_ORDER.indexOf(right);
  return li >= ri ? left : right;
}

async function createManyChunked(model, data, chunkSize = CHUNK_SIZE) {
  if (!data || data.length === 0) return;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await model.createMany({ data: chunk });
  }
}

function readStudentNumbers() {
  return fs
    .readFileSync(path.join(process.cwd(), 'data/test_students.md'), 'utf8')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureQuestionBank() {
  const tasks = [];
  for (let i = 1; i <= QUESTION_BANK_SIZE; i += 1) {
    const id = `sem-q-${String(i).padStart(3, '0')}`;
    const domains = QUESTION_DOMAINS[(i - 1) % QUESTION_DOMAINS.length];
    const tags = QUESTION_TAGS[(i - 1) % QUESTION_TAGS.length];
    const difficulty = Number((0.45 + ((i * 37) % 35) / 100).toFixed(2));
    const correctAnswer = ANSWER_OPTIONS[(i + 1) % 4];

    tasks.push(
      prisma.question.upsert({
        where: { id },
        update: {
          stem: `学期练习题 ${String(i).padStart(3, '0')}：结合船舶控制场景，判断最优控制策略。`,
          type: 'single-choice',
          domains,
          difficulty,
          discrimination: Number((0.72 + ((i * 11) % 20) / 100).toFixed(2)),
          guessing: 0.2,
          knowledgeTags: tags,
          correctAnswer,
          explanation: '请结合系统稳定性、控制目标与扰动条件综合判断。',
          crossDomainHint: '从时域、频域与工程约束三个维度联合分析。',
          source: 'semester-usage-seed',
          validationStatus: 'approved',
        },
        create: {
          id,
          stem: `学期练习题 ${String(i).padStart(3, '0')}：结合船舶控制场景，判断最优控制策略。`,
          type: 'single-choice',
          domains,
          difficulty,
          discrimination: Number((0.72 + ((i * 11) % 20) / 100).toFixed(2)),
          guessing: 0.2,
          knowledgeTags: tags,
          correctAnswer,
          explanation: '请结合系统稳定性、控制目标与扰动条件综合判断。',
          crossDomainHint: '从时域、频域与工程约束三个维度联合分析。',
          source: 'semester-usage-seed',
          validationStatus: 'approved',
        },
      })
    );
  }

  await prisma.$transaction(tasks, { timeout: 120000 });
}

function buildScenarioLogs(random, userId, ability, missions) {
  let participated = SCENARIOS.filter(() => random() < 0.72);
  if (participated.length < 3) {
    participated = pickMany(random, SCENARIOS, 3);
  }

  const logs = [];
  let totalScenarioMinutes = 0;

  for (const scenario of participated) {
    const attempts = randInt(random, 10, 30);
    const totalMinutes = randInt(random, 60, 300);
    const totalSeconds = totalMinutes * 60;
    const durations = splitTotalWithinBounds(random, totalSeconds, attempts, 120, 1800);
    totalScenarioMinutes += totalMinutes;

    const missionId =
      scenario.id === 'destroyer' && missions.length > 0
        ? pickOne(random, missions).id
        : null;

    const createdTimes = Array.from({ length: attempts }, () =>
      randomDate(random, SEMESTER_START, SEMESTER_END)
    ).sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < attempts; i += 1) {
      const seaState = randInt(random, scenario.seaMin, scenario.seaMax);
      const avgError = Number(clamp(24 - ability * 14 + seaState * 0.9 + random() * 3, 2, 45).toFixed(2));
      const settlingTime = Number(clamp(80 - ability * 35 + seaState * 4 + random() * 8, 10, 180).toFixed(2));
      const overshoot = Number(clamp(30 - ability * 14 + seaState * 1.8 + random() * 5, 1, 60).toFixed(2));
      const maxRudderRate = Number(clamp(2.4 - ability * 0.6 + seaState * 0.08 + random() * 0.6, 0.6, 4).toFixed(2));
      const score = Number(clamp(58 + ability * 34 - seaState * 2.2 + (random() - 0.5) * 10, 40, 99).toFixed(1));

      logs.push({
        userId,
        missionId,
        controlMode: scenario.controlMode,
        inputParams: {
          source: 'semester-usage-seed',
          simulationType: scenario.id,
          seaStateLevel: seaState,
          targetHeading: randInt(random, 20, 150),
          kp: Number((0.6 + random() * 2.2).toFixed(3)),
          ki: Number((0.01 + random() * 0.35).toFixed(3)),
          kd: Number((0.05 + random() * 0.9).toFixed(3)),
          speedKnots: randInt(random, 8, 24),
        },
        metrics: {
          avgError,
          maxRudderRate,
          settlingTime,
          overshoot,
          energyConsumption: Number((120 + random() * 260).toFixed(2)),
        },
        trajectoryData: [],
        isEthicalViolation: false,
        score,
        duration: durations[i],
        createdAt: createdTimes[i],
      });
    }
  }

  return {
    logs,
    totalScenarioMinutes,
  };
}

function buildGameLogs(random, userId, ability) {
  const logs = [];
  const tierProgress = {};
  let credits = 0;

  for (const levelId of LEVEL_IDS) {
    const attempts = randInt(random, 1, 30);
    const levelNum = Number(levelId.split('-')[1] || '1');
    const createdTimes = Array.from({ length: attempts }, () =>
      randomDate(random, GAME_START, GAME_END)
    ).sort((a, b) => a.getTime() - b.getTime());

    let bestTier = 'bronze';

    for (let i = 0; i < attempts; i += 1) {
      const difficultyPenalty = (levelNum - 1) * 24;
      const growthBonus = Math.min(90, i * 4);
      const score = Math.round(
        clamp(
          1020 + ability * 760 - difficultyPenalty + growthBonus + (random() - 0.5) * 180,
          1000,
          2000
        )
      );

      const tier = tierFromScore(score);
      bestTier = maxTier(bestTier, tier);
      credits += Math.floor(score / 100);

      logs.push({
        userId,
        missionId: null,
        controlMode: 'GAME',
        inputParams: {
          source: 'semester-usage-seed',
          simulationType: 'control-odyssey',
          levelId,
          tier,
          controllerId: pickOne(random, CONTROLLERS),
          runId: `${levelId}-${i + 1}-${Math.floor(random() * 1e6)}`,
          seaStateLevel: randInt(random, 2, 7),
        },
        metrics: {
          avgError: Number(clamp(16 - ability * 8 + random() * 6, 1, 25).toFixed(2)),
          maxRudderRate: Number(clamp(1.9 - ability * 0.5 + random() * 0.7, 0.4, 3.2).toFixed(2)),
          settlingTime: Number(clamp(60 - ability * 26 + random() * 10, 8, 120).toFixed(2)),
          overshoot: Number(clamp(18 - ability * 8 + random() * 7, 1, 35).toFixed(2)),
        },
        trajectoryData: [],
        isEthicalViolation: false,
        score,
        duration: randInt(random, 120, 480),
        createdAt: createdTimes[i],
      });
    }

    tierProgress[levelId] = bestTier;
  }

  return {
    logs,
    tierProgress,
    credits,
  };
}

function buildUserAnswers(random, userId, ability, questionPool) {
  const attempts = randInt(random, 300, 500);
  const rows = [];

  for (let i = 0; i < attempts; i += 1) {
    const question = pickOne(random, questionPool);
    const diffPenalty = (question.difficulty - 0.5) * 0.45;
    const correctProb = clamp(0.45 + ability * 0.48 - diffPenalty, 0.2, 0.96);
    const isCorrect = random() < correctProb;
    const wrongOptions = ANSWER_OPTIONS.filter((item) => item !== question.correctAnswer);
    const answerGiven = isCorrect ? question.correctAnswer : pickOne(random, wrongOptions);
    const createdAt = randomDate(random, SEMESTER_START, SEMESTER_END);

    rows.push({
      userId,
      questionId: question.id,
      isCorrect,
      timeSpent: randInt(random, 25, 190),
      answerGiven,
      thetaEstimate: Number((ability * 2 - 0.8 + (random() - 0.5) * 0.9).toFixed(3)),
      createdAt,
    });
  }

  return rows;
}

function buildProgressRows(random, userId, ability, missions) {
  if (!missions.length) return [];

  const completedCount = clamp(Math.round(2 + ability * 6), 2, missions.length);
  const unlockedCount = clamp(completedCount + randInt(random, 0, 2), completedCount, missions.length);
  const rows = [];

  for (let i = 0; i < unlockedCount; i += 1) {
    const completed = i < completedCount;
    const createdAt = randomDate(random, SEMESTER_START, SEMESTER_END);
    rows.push({
      userId,
      missionId: missions[i].id,
      status: completed ? ProgressStatus.COMPLETED : ProgressStatus.UNLOCKED,
      bestScore: completed
        ? Number(clamp(68 + ability * 26 + i * 1.6 + (random() - 0.5) * 6, 60, 99).toFixed(1))
        : null,
      attempts: completed ? randInt(random, 4, 24) : randInt(random, 1, 6),
      completedAt: completed ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return rows;
}

function buildControlUnlocks(ability) {
  const unlocks = ['P'];
  if (ability >= 0.5) unlocks.push('PI');
  if (ability >= 0.55) unlocks.push('PD');
  if (ability >= 0.62) unlocks.push('PID');
  if (ability >= 0.7) unlocks.push('VFB');
  if (ability >= 0.76) unlocks.push('FF');
  if (ability >= 0.82) unlocks.push('SMITH');
  return unlocks;
}

function buildControllerLevels(random, ability, unlocks) {
  const levels = {};
  for (const controller of CONTROLLERS) {
    levels[controller] = unlocks.includes(controller)
      ? clamp(Math.round(2 + ability * 8 + (random() - 0.5) * 2), 1, 10)
      : 0;
  }
  return levels;
}

async function refreshQuestionStats(questionIds) {
  if (!questionIds.length) return;

  const [allStats, correctStats] = await Promise.all([
    prisma.userAnswer.groupBy({
      by: ['questionId'],
      where: { questionId: { in: questionIds } },
      _count: { _all: true },
      _avg: { timeSpent: true },
    }),
    prisma.userAnswer.groupBy({
      by: ['questionId'],
      where: {
        questionId: { in: questionIds },
        isCorrect: true,
      },
      _count: { _all: true },
    }),
  ]);

  const correctMap = new Map(correctStats.map((item) => [item.questionId, item._count._all]));

  for (const stat of allStats) {
    const total = stat._count._all;
    const correct = correctMap.get(stat.questionId) ?? 0;
    const correctRate = total > 0 ? Number((correct / total).toFixed(4)) : null;
    const avgTimeSpent =
      typeof stat._avg.timeSpent === 'number'
        ? Number(stat._avg.timeSpent.toFixed(2))
        : null;

    await prisma.question.update({
      where: { id: stat.questionId },
      data: {
        timesUsed: total,
        correctRate,
        avgTimeSpent,
      },
    });
  }
}

async function main() {
  const studentNumbers = readStudentNumbers();
  if (studentNumbers.length === 0) {
    throw new Error('data/test_students.md 未读取到任何账号');
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers } },
    select: {
      userId: true,
      studentNumber: true,
      techScore: true,
      ethicsScore: true,
      major: true,
      year: true,
    },
  });

  if (profiles.length !== studentNumbers.length) {
    const found = new Set(profiles.map((item) => item.studentNumber));
    const missing = studentNumbers.filter((item) => !found.has(item));
    throw new Error(`存在未匹配学生账号: ${missing.join(', ')}`);
  }

  await ensureQuestionBank();

  const [questionPool, missions] = await Promise.all([
    prisma.question.findMany({
      select: {
        id: true,
        difficulty: true,
        correctAnswer: true,
      },
      where: {
        OR: [
          { source: 'semester-usage-seed' },
          { source: 'extracurricular-showcase-seed' },
        ],
      },
    }),
    prisma.mission.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (questionPool.length === 0) {
    throw new Error('题库为空，无法生成习题作答记录');
  }

  const userIds = profiles.map((item) => item.userId);

  await prisma.$transaction([
    prisma.userAnswer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userProgress.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.simulationLog.deleteMany({ where: { userId: { in: userIds } } }),
  ]);

  let totalAnswers = 0;
  let totalSimulationLogs = 0;

  for (const profile of profiles) {
    const studentNumber = profile.studentNumber;
    if (!studentNumber) continue;

    const random = mulberry32(hashSeed(`semester:${studentNumber}`));
    const ability = clamp(
      (profile.techScore > 0 ? profile.techScore : 72) / 100 + (random() - 0.5) * 0.12,
      0.42,
      0.93
    );

    const answerRows = buildUserAnswers(random, profile.userId, ability, questionPool);
    const scenarioResult = buildScenarioLogs(random, profile.userId, ability, missions);
    const gameResult = buildGameLogs(random, profile.userId, ability);
    const progressRows = buildProgressRows(random, profile.userId, ability, missions);
    const simulationLogs = [...scenarioResult.logs, ...gameResult.logs];

    const unlocks = buildControlUnlocks(ability);
    const controllerLevels = buildControllerLevels(random, ability, unlocks);

    await createManyChunked(prisma.userAnswer, answerRows);
    await createManyChunked(prisma.simulationLog, simulationLogs);
    await createManyChunked(prisma.userProgress, progressRows);

    await prisma.studentProfile.update({
      where: { userId: profile.userId },
      data: {
        major: profile.major || '自动化',
        year: profile.year || '2023级',
        techScore: clamp(Math.round((profile.techScore > 0 ? profile.techScore : 70) * 0.35 + ability * 100 * 0.65), 55, 98),
        ethicsScore: clamp(profile.ethicsScore > 0 ? profile.ethicsScore : 92, 80, 100),
        controlCredits: gameResult.credits,
        controlUnlocks: unlocks,
        controlOdysseyProgress: gameResult.tierProgress,
        controlControllerLevels: controllerLevels,
      },
    });

    await prisma.learningProfile.upsert({
      where: { userId: profile.userId },
      update: {
        dailyStudyMinutes: clamp(Math.round(90 + ability * 70 + (random() - 0.5) * 20), 70, 220),
        experimentMinutes: clamp(Math.round(scenarioResult.totalScenarioMinutes / 16), 45, 220),
        ethicsMinutes: clamp(Math.round(18 + random() * 42), 12, 80),
        aiRecommendIndex: Number(clamp(0.58 + ability * 0.34, 0.55, 0.95).toFixed(2)),
      },
      create: {
        userId: profile.userId,
        dailyStudyMinutes: clamp(Math.round(90 + ability * 70 + (random() - 0.5) * 20), 70, 220),
        experimentMinutes: clamp(Math.round(scenarioResult.totalScenarioMinutes / 16), 45, 220),
        ethicsMinutes: clamp(Math.round(18 + random() * 42), 12, 80),
        aiRecommendIndex: Number(clamp(0.58 + ability * 0.34, 0.55, 0.95).toFixed(2)),
        unlockedShips: clamp(Math.round(6 + ability * 18), 5, 30),
        totalShips: 36,
      },
    });

    totalAnswers += answerRows.length;
    totalSimulationLogs += simulationLogs.length;
  }

  await refreshQuestionStats(questionPool.map((item) => item.id));

  console.log(
    `semester usage seeded: students=${profiles.length}, answers=${totalAnswers}, simulationLogs=${totalSimulationLogs}`
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


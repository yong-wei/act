import fs from 'node:fs'
import path from 'node:path'
import {
  PrismaClient,
  LearningStyle,
  ProgressStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

const SHOWCASE_CLASS = {
  name: '2023自动化课外展示班',
  code: 'ECSHOW',
  description: '课外教学展示用班级（长期保留，可直接复用到真实学生）',
  year: '2025-2026',
  semester: '春季学期',
}

const FOCUS_ACCOUNT_A = '20230010102608'
const FOCUS_ACCOUNT_B = '20230010102605'

const SHOWCASE_QUESTIONS = [
  {
    id: 'show-q-pole-01',
    stem: '当闭环主导极点向虚轴方向靠近时，系统超调量通常会出现什么变化？',
    type: 'single-choice',
    domains: ['time', 'complex'],
    difficulty: 0.62,
    discrimination: 0.86,
    guessing: 0.2,
    knowledgeTags: ['pole-time-mapping', 'cross-domain-mapping'],
    correctAnswer: 'A',
    explanation: '阻尼比下降通常导致超调量上升。',
    crossDomainHint: '将极点角度与阻尼比变化联系到时域超调。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-pole-02',
    stem: '根轨迹在靠近虚轴时，若希望降低超调，应优先如何调整极点分布？',
    type: 'single-choice',
    domains: ['time', 'complex'],
    difficulty: 0.68,
    discrimination: 0.82,
    guessing: 0.22,
    knowledgeTags: ['pole-time-mapping', 'design-tradeoff'],
    correctAnswer: 'C',
    explanation: '将主导极点向左移并保持适当阻尼比可兼顾速度与超调。',
    crossDomainHint: '关注“左移速度”和“角度阻尼”两个变量。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-bode-01',
    stem: '相位裕度不足时，系统在频域上最可能表现为哪类风险？',
    type: 'single-choice',
    domains: ['frequency'],
    difficulty: 0.64,
    discrimination: 0.85,
    guessing: 0.2,
    knowledgeTags: ['frequency-stability-judgement'],
    correctAnswer: 'B',
    explanation: '相位裕度不足会引发振荡风险，鲁棒性降低。',
    crossDomainHint: '结合波特图交越频率与相位裕度判断稳定边界。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-bode-02',
    stem: '若增益交越频率提高且相位曲线下沉，通常说明什么？',
    type: 'single-choice',
    domains: ['frequency', 'time'],
    difficulty: 0.7,
    discrimination: 0.83,
    guessing: 0.22,
    knowledgeTags: ['frequency-stability-judgement', 'cross-domain-mapping'],
    correctAnswer: 'D',
    explanation: '可能换来更快响应但稳定裕度下降。',
    crossDomainHint: '将频域裕度变化映射到时域震荡与超调。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-cross-01',
    stem: '已知阻尼比提升，哪项频域指标常呈同向改善趋势？',
    type: 'single-choice',
    domains: ['time', 'frequency'],
    difficulty: 0.66,
    discrimination: 0.8,
    guessing: 0.24,
    knowledgeTags: ['cross-domain-mapping'],
    correctAnswer: 'A',
    explanation: '阻尼比提升常伴随相位裕度增加。',
    crossDomainHint: '关注经验映射 ζ 与相位裕度之间的关系。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-design-01',
    stem: '在“速度-稳定-能耗”三目标冲突下，最合理的设计动作是？',
    type: 'single-choice',
    domains: ['complex', 'physical'],
    difficulty: 0.72,
    discrimination: 0.88,
    guessing: 0.2,
    knowledgeTags: ['design-tradeoff', 'prompt-structuring'],
    correctAnswer: 'C',
    explanation: '需要先明确权重，再进行参数与结构迭代。',
    crossDomainHint: '把约束写进提示词结构可提高设计一致性。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-design-02',
    stem: '提示词中若缺少可执行约束，最直接影响的是哪项结果？',
    type: 'single-choice',
    domains: ['complex'],
    difficulty: 0.61,
    discrimination: 0.79,
    guessing: 0.23,
    knowledgeTags: ['prompt-structuring'],
    correctAnswer: 'B',
    explanation: '可执行约束不足会导致结果漂移、可复现性下降。',
    crossDomainHint: '结构化提示词是设计结果一致性的前提。',
    source: 'extracurricular-showcase-seed',
  },
  {
    id: 'show-q-cross-02',
    stem: '下列哪种描述最能体现“极点-时域-频域”的跨域一致性？',
    type: 'single-choice',
    domains: ['time', 'frequency', 'complex'],
    difficulty: 0.74,
    discrimination: 0.84,
    guessing: 0.22,
    knowledgeTags: ['cross-domain-mapping', 'design-tradeoff'],
    correctAnswer: 'D',
    explanation: '跨域一致性强调同一设计意图在多表征上的一致解释。',
    crossDomainHint: '把极点位置、超调和相位裕度串成一个因果链。',
    source: 'extracurricular-showcase-seed',
  },
]

const RANKED_TAGS = [
  'pole-time-mapping',
  'frequency-stability-judgement',
  'cross-domain-mapping',
  'design-tradeoff',
  'prompt-structuring',
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hashSeed(input) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function scoreToTheta(score) {
  return Number(((score - 60) / 12).toFixed(3))
}

function thetaToScore(theta) {
  return Math.round(clamp(60 + theta * 12, 0, 100))
}

function buildGenericSeed(studentNumber, index) {
  const random = mulberry32(hashSeed(`${studentNumber}:${index}`))

  const pre = {
    computational: Math.round(50 + random() * 20),
    crossDomain: Math.round(42 + random() * 24),
    design: Math.round(44 + random() * 24),
    poleTime: Math.round(40 + random() * 34),
    frequency: Math.round(38 + random() * 34),
    promptStructuring: Math.round(45 + random() * 28),
  }

  const post = {
    computational: clamp(pre.computational + Math.round(8 + random() * 12), 55, 95),
    crossDomain: clamp(pre.crossDomain + Math.round(10 + random() * 15), 50, 95),
    design: clamp(pre.design + Math.round(9 + random() * 14), 50, 95),
    poleTime: clamp(pre.poleTime + Math.round(8 + random() * 16), 48, 95),
    frequency: clamp(pre.frequency + Math.round(6 + random() * 14), 42, 95),
    promptStructuring: clamp(pre.promptStructuring + Math.round(7 + random() * 14), 48, 95),
  }

  const postAverage = Math.round(
    (post.computational + post.crossDomain + post.design + post.poleTime + post.frequency) / 5
  )

  const ethicsScore = clamp(86 + Math.round(random() * 12), 80, 100)
  const trendNoise =
    (Math.sin((index + 1) * 1.37) + Math.cos((index + 1) * 0.73)) * 4.3
  const designEffect = clamp(Math.round(post.promptStructuring * 0.92 + trendNoise), 40, 98)

  return {
    pre,
    post,
    ethicsScore,
    postAverage,
    designEffect,
    recommendedLevel: clamp(Math.round(4 + postAverage / 10), 4, 14),
  }
}

function buildFocusSeed(studentNumber) {
  if (studentNumber === FOCUS_ACCOUNT_A) {
    return {
      pre: {
        computational: 58,
        crossDomain: 42,
        design: 54,
        poleTime: 36,
        frequency: 44,
        promptStructuring: 51,
      },
      post: {
        computational: 74,
        crossDomain: 75,
        design: 70,
        poleTime: 78,
        frequency: 49,
        promptStructuring: 79,
      },
      ethicsScore: 92,
      postAverage: 69,
      designEffect: 74,
      recommendedLevel: 7,
      forcePreWeakTag: 'pole-time-mapping',
      forcePostWeakTag: 'frequency-stability-judgement',
    }
  }

  if (studentNumber === FOCUS_ACCOUNT_B) {
    return {
      pre: {
        computational: 62,
        crossDomain: 55,
        design: 50,
        poleTime: 71,
        frequency: 34,
        promptStructuring: 49,
      },
      post: {
        computational: 73,
        crossDomain: 67,
        design: 68,
        poleTime: 79,
        frequency: 52,
        promptStructuring: 72,
      },
      ethicsScore: 90,
      postAverage: 68,
      designEffect: 69,
      recommendedLevel: 8,
      forcePreWeakTag: 'frequency-stability-judgement',
      forcePostWeakTag: 'frequency-stability-judgement',
    }
  }

  return null
}

function getTagScores(seed, phase) {
  const values = phase === 'pre' ? seed.pre : seed.post
  return {
    'pole-time-mapping': values.poleTime,
    'frequency-stability-judgement': values.frequency,
    'cross-domain-mapping': values.crossDomain,
    'design-tradeoff': values.design,
    'prompt-structuring': values.promptStructuring,
  }
}

function pickWeakTag(seed, phase) {
  const forced =
    phase === 'pre' ? seed.forcePreWeakTag : seed.forcePostWeakTag
  if (forced) {
    return forced
  }

  const scores = getTagScores(seed, phase)
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1])
  return sorted[0]?.[0] ?? 'cross-domain-mapping'
}

function buildLearningPathCards(studentNumber, seed) {
  const postWeakTag = pickWeakTag(seed, 'post')

  if (studentNumber === FOCUS_ACCOUNT_A) {
    return [
      {
        title: 'Bode图判读专项练习（3题）',
        description: '针对“频域稳定判读”短板，完成3题快速补强。',
        estimatedTime: 25,
        nodeIds: ['node-bode', 'node-phase-margin', 'frequency-stability-judgement'],
      },
      {
        title: '控制奥德赛第7关：频域稳定边界',
        description: '建议重复挑战并对比三种控制器在稳定边界下的表现。',
        estimatedTime: 30,
        nodeIds: ['level-7', 'control-odyssey', 'frequency-stability-judgement'],
      },
      {
        title: '推荐阅读：相位裕度工程解读',
        description: '通过工程案例理解相位裕度与阻尼比之间的映射关系。',
        estimatedTime: 20,
        nodeIds: ['node-phase-margin', 'node-damping-ratio', 'cross-domain-mapping'],
      },
    ]
  }

  if (studentNumber === FOCUS_ACCOUNT_B) {
    return [
      {
        title: 'Bode图分析题组（3题）',
        description: '聚焦频域稳定判读，完成基础判读到边界估算的阶梯练习。',
        estimatedTime: 24,
        nodeIds: ['node-bode', 'frequency-stability-judgement'],
      },
      {
        title: '控制奥德赛第8关：交越频率冲刺',
        description: '通过游戏化反馈建立“速度-稳定”取舍直觉。',
        estimatedTime: 28,
        nodeIds: ['level-8', 'control-odyssey', 'design-tradeoff'],
      },
      {
        title: '推荐阅读：频域判读速查',
        description: '阅读后完成一次自测，巩固相位裕度与增益裕度判读流程。',
        estimatedTime: 18,
        nodeIds: ['node-frequency-domain', 'node-phase-margin'],
      },
    ]
  }

  const genericMap = {
    'frequency-stability-judgement': {
      title: '频域稳定补强任务',
      description: '完成Bode图边界判读和相位裕度估算。',
      nodeIds: ['node-bode', 'node-phase-margin', 'frequency-stability-judgement'],
      level: 7,
    },
    'pole-time-mapping': {
      title: '极点-时域映射补强任务',
      description: '通过极点拖动练习建立阻尼比与超调映射。',
      nodeIds: ['node-root-locus', 'node-damping-ratio', 'pole-time-mapping'],
      level: 6,
    },
    'cross-domain-mapping': {
      title: '跨域映射强化任务',
      description: '完成“时域-频域-复平面”三联动练习。',
      nodeIds: ['cross-domain-mapping', 'node-bode', 'node-root-locus'],
      level: 8,
    },
    'design-tradeoff': {
      title: '设计权衡专项任务',
      description: '围绕“速度-稳定-能耗”完成三目标权衡设计。',
      nodeIds: ['design-tradeoff', 'node-controller-design'],
      level: 9,
    },
    'prompt-structuring': {
      title: '提示词结构化专项任务',
      description: '按模板重构提示词，提升设计结果一致性。',
      nodeIds: ['prompt-structuring', 'node-ai-prompting'],
      level: 7,
    },
  }

  const plan = genericMap[postWeakTag] || genericMap['cross-domain-mapping']
  const recommendedLevel = clamp(seed.recommendedLevel || plan.level, 5, 12)

  return [
    {
      title: plan.title,
      description: plan.description,
      estimatedTime: 24,
      nodeIds: plan.nodeIds,
    },
    {
      title: `控制奥德赛第${recommendedLevel}关补强挑战`,
      description: '结合关卡反馈复盘控制参数，形成可复用调参策略。',
      estimatedTime: 30,
      nodeIds: [`level-${recommendedLevel}`, 'control-odyssey'],
    },
    {
      title: '推荐阅读：工程案例迁移',
      description: '阅读案例并输出“问题-模型-策略-验证”的简要总结。',
      estimatedTime: 18,
      nodeIds: ['engineering-case-reading', 'cross-domain-mapping'],
    },
  ]
}

function buildAnswerRecords(studentNumber, userId, seed, baseTime) {
  const random = mulberry32(hashSeed(`answers:${studentNumber}`))
  const preWeakTag = pickWeakTag(seed, 'pre')

  const selectedQuestionIds = [
    'show-q-pole-01',
    'show-q-bode-01',
    'show-q-cross-01',
    'show-q-design-01',
    'show-q-pole-02',
    'show-q-bode-02',
  ]

  const questionById = new Map(SHOWCASE_QUESTIONS.map((question) => [question.id, question]))

  return selectedQuestionIds.map((questionId, idx) => {
    const question = questionById.get(questionId)
    const isWeak = Boolean(question?.knowledgeTags?.includes(preWeakTag))
    const baseAccuracy = isWeak ? 0.35 : 0.78

    let isCorrect = random() < baseAccuracy

    if (studentNumber === FOCUS_ACCOUNT_A && questionId === 'show-q-pole-01') {
      isCorrect = false
    }
    if (studentNumber === FOCUS_ACCOUNT_B && (questionId === 'show-q-bode-01' || questionId === 'show-q-bode-02')) {
      isCorrect = false
    }

    const correctAnswer = question?.correctAnswer || 'A'
    const answerGiven = isCorrect ? correctAnswer : ['A', 'B', 'C', 'D'].find((option) => option !== correctAnswer) || 'B'

    return {
      userId,
      questionId,
      isCorrect,
      timeSpent: Math.round(28 + random() * 70),
      answerGiven,
      thetaEstimate: Number(((seed.postAverage - 60) / 12 + (random() - 0.5) * 0.4).toFixed(3)),
      createdAt: new Date(baseTime.getTime() + idx * 45 * 60 * 1000),
    }
  })
}

function buildPromptAssessments(userId, studentNumber, seed, baseTime) {
  const random = mulberry32(hashSeed(`prompt:${studentNumber}`))

  const phase1Struct = clamp(seed.pre.promptStructuring - Math.round(random() * 4), 35, 92)
  const phase2Struct = clamp(Math.round((phase1Struct + seed.post.promptStructuring) / 2), 38, 94)
  const phase3Struct = clamp(seed.post.promptStructuring, 40, 96)
  const scores = [phase1Struct, phase2Struct, phase3Struct]

  return scores.map((structScore, index) => {
    const overallScore = clamp(Math.round(structScore * 0.9 + 8 + (random() - 0.5) * 6), 40, 98)
    const precisionScore = clamp(Math.round(structScore * 0.88 + (random() - 0.5) * 8), 35, 98)
    const completenessScore = clamp(Math.round(structScore * 0.9 + (random() - 0.5) * 6), 35, 98)
    const executabilityScore = clamp(Math.round(structScore * 0.92 + (random() - 0.5) * 6), 35, 98)

    return {
      userId,
      sessionId: `showcase-${studentNumber}-design`,
      promptContent: `【v${index + 1}】控制任务：在海况扰动下保持航向稳定，并兼顾能耗。请给出参数与验证步骤。`,
      structuredData: {
        constraints: ['稳态误差 < 5%', '超调量 < 15%', '舵机动作平滑'],
        focusTag: pickWeakTag(seed, index === 0 ? 'pre' : 'post'),
      },
      overallScore,
      completenessScore,
      precisionScore,
      structurizationScore: structScore,
      executabilityScore,
      suggestions: [
        `补充约束优先级（第${index + 1}轮）`,
        '在提示词中明确参数边界与验证判据',
      ],
      version: index + 1,
      createdAt: new Date(baseTime.getTime() + index * 3 * 60 * 60 * 1000),
    }
  })
}

function buildSimulationLogs(userId, studentNumber, seed, baseTime) {
  const random = mulberry32(hashSeed(`sim:${studentNumber}`))
  const logs = []
  const maxLevel = clamp(seed.recommendedLevel + 1, 5, 13)

  for (let i = 0; i < 4; i += 1) {
    const levelId = clamp(maxLevel - 2 + i, 1, 15)
    const tier = i <= 1 ? 'bronze' : i === 2 ? 'silver' : 'gold'

    let score = clamp(Math.round(seed.postAverage + (random() - 0.5) * 14 + i * 3), 45, 98)

    if (studentNumber === FOCUS_ACCOUNT_A && levelId === 7 && i === 1) {
      score = 56
    }

    logs.push({
      userId,
      missionId: null,
      controlMode: 'GAME',
      inputParams: {
        levelId: `level-${levelId}`,
        tier,
        controllerId: seed.postAverage >= 72 ? 'PID' : 'PD',
        seaStateLevel: i <= 1 ? 3 : 4,
      },
      metrics: {
        avgError: Number(clamp(22 - seed.postAverage / 8 + random() * 6, 3, 28).toFixed(2)),
        maxRudderRate: Number(clamp(2.8 - seed.postAverage / 120 + random() * 0.6, 0.9, 3.5).toFixed(2)),
        settlingTime: Number(clamp(58 - seed.postAverage / 3 + random() * 18, 18, 75).toFixed(2)),
        overshoot: Number(clamp(24 - seed.postAverage / 5 + random() * 12, 3, 35).toFixed(2)),
      },
      trajectoryData: [],
      isEthicalViolation: false,
      score,
      duration: Number(clamp(220 + random() * 160, 180, 420).toFixed(1)),
      createdAt: new Date(baseTime.getTime() + i * 80 * 60 * 1000),
    })
  }

  return logs
}

function buildControlProfile(seed, studentNumber) {
  const unlocks = ['P']
  if (seed.postAverage >= 62) unlocks.push('PI')
  if (seed.postAverage >= 65) unlocks.push('PD')
  if (seed.postAverage >= 70) unlocks.push('PID')
  if (seed.postAverage >= 74) unlocks.push('VFB')
  if (seed.postAverage >= 78) unlocks.push('FF')
  if (seed.postAverage >= 82) unlocks.push('SMITH')

  const controllerLevels = {
    P: clamp(Math.round(seed.postAverage / 18), 1, 6),
    PI: unlocks.includes('PI') ? clamp(Math.round(seed.postAverage / 16), 1, 7) : 0,
    PD: unlocks.includes('PD') ? clamp(Math.round(seed.postAverage / 17), 1, 7) : 0,
    PID: unlocks.includes('PID') ? clamp(Math.round(seed.postAverage / 15), 1, 8) : 0,
    VFB: unlocks.includes('VFB') ? clamp(Math.round(seed.postAverage / 20), 1, 6) : 0,
    FF: unlocks.includes('FF') ? clamp(Math.round(seed.postAverage / 21), 1, 6) : 0,
    SMITH: unlocks.includes('SMITH') ? clamp(Math.round(seed.postAverage / 22), 1, 6) : 0,
  }

  const recommendedLevel = clamp(seed.recommendedLevel, 4, 13)
  const tierProgress = {}

  for (let i = 1; i <= recommendedLevel; i += 1) {
    if (i <= 4) {
      tierProgress[`level-${i}`] = 'bronze'
    } else if (i <= 8) {
      tierProgress[`level-${i}`] = 'silver'
    } else {
      tierProgress[`level-${i}`] = 'gold'
    }
  }

  if (studentNumber === FOCUS_ACCOUNT_A) {
    tierProgress['level-7'] = 'silver'
  }

  return {
    credits: clamp(Math.round(120 + seed.postAverage * 2.2), 140, 360),
    unlocks,
    controllerLevels,
    tierProgress,
  }
}

function buildAbilityRows(userId, seed, preTime, postTime) {
  const preKnowledge = {
    poleTimeMapping: seed.pre.poleTime,
    frequencyStabilityJudgement: seed.pre.frequency,
    crossDomainMapping: seed.pre.crossDomain,
    designTradeoff: seed.pre.design,
    promptStructuring: seed.pre.promptStructuring,
  }

  const postKnowledge = {
    poleTimeMapping: seed.post.poleTime,
    frequencyStabilityJudgement: seed.post.frequency,
    crossDomainMapping: seed.post.crossDomain,
    designTradeoff: seed.post.design,
    promptStructuring: seed.post.promptStructuring,
  }

  return [
    {
      userId,
      computationalTheta: scoreToTheta(seed.pre.computational),
      crossDomainTheta: scoreToTheta(seed.pre.crossDomain),
      designTheta: scoreToTheta(seed.pre.design),
      knowledgePointAbilities: preKnowledge,
      assessedAt: preTime,
    },
    {
      userId,
      computationalTheta: scoreToTheta(seed.post.computational),
      crossDomainTheta: scoreToTheta(seed.post.crossDomain),
      designTheta: scoreToTheta(seed.post.design),
      knowledgePointAbilities: postKnowledge,
      assessedAt: postTime,
    },
  ]
}

async function main() {
  const studentNumbers = fs
    .readFileSync(path.join(process.cwd(), 'data/test_students.md'), 'utf8')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (studentNumbers.length === 0) {
    throw new Error('data/test_students.md 未读取到任何账号')
  }

  const profiles = await prisma.studentProfile.findMany({
    where: {
      studentNumber: {
        in: studentNumbers,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })

  if (profiles.length !== studentNumbers.length) {
    const foundNumbers = new Set(profiles.map((item) => item.studentNumber))
    const missing = studentNumbers.filter((item) => !foundNumbers.has(item))
    throw new Error(`存在未匹配学生账号: ${missing.join(', ')}`)
  }

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  if (teachers.length === 0) {
    throw new Error('未找到教师账号，无法创建展示班级')
  }

  const teacher =
    teachers.find((item) => item.name && item.name.includes('张永韡')) || teachers[0]

  const showcaseClass = await prisma.class.upsert({
    where: { code: SHOWCASE_CLASS.code },
    update: {
      name: SHOWCASE_CLASS.name,
      description: SHOWCASE_CLASS.description,
      year: SHOWCASE_CLASS.year,
      semester: SHOWCASE_CLASS.semester,
      teacherId: teacher.id,
      isActive: true,
    },
    create: {
      ...SHOWCASE_CLASS,
      teacherId: teacher.id,
      isActive: true,
    },
  })

  const userIds = profiles.map((item) => item.userId)

  await prisma.$transaction([
    prisma.controlOdysseyAiHistory.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userProgress.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.learningMilestone.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.achievement.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userAnswer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.abilityAssessment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.promptAssessment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.designSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.aIIntervention.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.linkageSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.learningPath.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.learningProfile.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.ethicalLog.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.simulationLog.deleteMany({ where: { userId: { in: userIds } } }),
  ])

  for (const question of SHOWCASE_QUESTIONS) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        stem: question.stem,
        type: question.type,
        domains: question.domains,
        difficulty: question.difficulty,
        discrimination: question.discrimination,
        guessing: question.guessing,
        knowledgeTags: question.knowledgeTags,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        crossDomainHint: question.crossDomainHint,
        source: question.source,
        validationStatus: 'approved',
      },
      create: {
        ...question,
        validationStatus: 'approved',
      },
    })
  }

  const missionList = await prisma.mission.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  const orderedProfiles = [...profiles].sort((a, b) => {
    const left = studentNumbers.indexOf(a.studentNumber || '')
    const right = studentNumbers.indexOf(b.studentNumber || '')
    return left - right
  })

  const now = Date.now()
  let insertedAbilityRows = 0
  let insertedPromptRows = 0
  let insertedPathRows = 0

  for (let i = 0; i < orderedProfiles.length; i += 1) {
    const profile = orderedProfiles[i]
    const studentNumber = profile.studentNumber

    if (!studentNumber) {
      continue
    }

    const genericSeed = buildGenericSeed(studentNumber, i)
    const focusSeed = buildFocusSeed(studentNumber)
    const seed = focusSeed || genericSeed

    const controlProfile = buildControlProfile(seed, studentNumber)

    const preTime = new Date(now - 6 * 24 * 60 * 60 * 1000 - i * 11 * 60 * 1000)
    const postTime = new Date(now - 20 * 60 * 60 * 1000 - i * 9 * 60 * 1000)
    const answerBaseTime = new Date(now - 5 * 24 * 60 * 60 * 1000 - i * 7 * 60 * 1000)
    const promptBaseTime = new Date(now - 2 * 24 * 60 * 60 * 1000 - i * 5 * 60 * 1000)
    const simulationBaseTime = new Date(now - 24 * 60 * 60 * 1000 - i * 6 * 60 * 1000)

    const abilityRows = buildAbilityRows(profile.userId, seed, preTime, postTime)
    const promptRows = buildPromptAssessments(profile.userId, studentNumber, seed, promptBaseTime)
    const learningPathCards = buildLearningPathCards(studentNumber, seed)
    const answerRows = buildAnswerRecords(studentNumber, profile.userId, seed, answerBaseTime)
    const simulationLogs = buildSimulationLogs(profile.userId, studentNumber, seed, simulationBaseTime)
    const alignmentNoise = Math.sin((i + 1) * 0.91) * 4
    const coherenceNoise = Math.cos((i + 1) * 1.17) * 4

    const preWeakTag = pickWeakTag(seed, 'pre')
    const postWeakTag = pickWeakTag(seed, 'post')

    const learningStyle =
      i % 5 === 0
        ? LearningStyle.VISUAL
        : i % 5 === 1
          ? LearningStyle.INTERACTIVE
          : i % 5 === 2
            ? LearningStyle.LOGICAL
            : i % 5 === 3
              ? LearningStyle.TEXTUAL
              : LearningStyle.AUDITORY

    await prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { userId: profile.userId },
        data: {
          classId: showcaseClass.id,
          className: showcaseClass.name,
          major: profile.major || '自动化',
          year: profile.year || '2023级',
          techScore: seed.postAverage,
          ethicsScore: seed.ethicsScore,
          controlCredits: controlProfile.credits,
          controlUnlocks: controlProfile.unlocks,
          controlOdysseyProgress: controlProfile.tierProgress,
          controlControllerLevels: controlProfile.controllerLevels,
        },
      })

      await tx.learningProfile.create({
        data: {
          userId: profile.userId,
          learningStyle,
          cognitiveLevel: clamp(Math.round(seed.postAverage / 18), 2, 5),
          fleetGroup: i % 2 === 0 ? '舰队A' : '舰队B',
          dailyStudyMinutes: clamp(42 + Math.round(seed.postAverage * 0.7), 60, 140),
          experimentMinutes: clamp(18 + Math.round(seed.post.design * 0.4), 30, 110),
          ethicsMinutes: clamp(10 + Math.round(seed.ethicsScore * 0.25), 20, 55),
          aiRecommendIndex: Number(clamp(seed.postAverage / 100, 0.55, 0.95).toFixed(2)),
          unlockedShips: clamp(Math.round(seed.postAverage / 10), 4, 18),
          totalShips: 36,
        },
      })

      await tx.abilityAssessment.createMany({ data: abilityRows })
      await tx.promptAssessment.createMany({ data: promptRows })

      await tx.designSession.create({
        data: {
          userId: profile.userId,
          taskType: 'cruise-comfort-control-design',
          promptVersions: promptRows.map((item) => ({
            version: item.version,
            structurizationScore: item.structurizationScore,
            overallScore: item.overallScore,
            weakTag: postWeakTag,
          })),
          designActions: [
            { type: 'precheck', weakTag: preWeakTag },
            { type: 'retune', target: postWeakTag },
            { type: 'validation', outcome: seed.designEffect },
          ],
          finalResult: {
            postAverage: seed.postAverage,
            recommendation: learningPathCards[0]?.title || '补强任务',
          },
          consistencyScore: seed.designEffect,
          goalBehaviorAlignment: clamp(seed.designEffect + 3 + alignmentNoise, 40, 98),
          behaviorResultCoherence: clamp(seed.designEffect - 2 + coherenceNoise, 38, 98),
          startedAt: new Date(postTime.getTime() - 2 * 60 * 60 * 1000),
          completedAt: new Date(postTime.getTime() - 90 * 60 * 1000),
        },
      })

      await tx.userAnswer.createMany({ data: answerRows })
      await tx.simulationLog.createMany({ data: simulationLogs })

      await tx.learningPath.createMany({
        data: learningPathCards.map((card, idx) => ({
          userId: profile.userId,
          title: card.title,
          description: card.description,
          estimatedTime: card.estimatedTime,
          nodeIds: card.nodeIds,
          isAiGenerated: true,
          isBookmarked: idx === 0,
          createdAt: new Date(postTime.getTime() + idx * 5 * 60 * 1000),
          updatedAt: new Date(postTime.getTime() + idx * 5 * 60 * 1000),
        })),
      })

      if (missionList.length > 0) {
        const completed = clamp(Math.round(seed.postAverage / 15), 2, Math.min(10, missionList.length))
        const unlocked = clamp(completed + 2, completed, missionList.length)

        await tx.userProgress.createMany({
          data: missionList.slice(0, unlocked).map((mission, idx) => ({
            userId: profile.userId,
            missionId: mission.id,
            status: idx < completed ? ProgressStatus.COMPLETED : ProgressStatus.UNLOCKED,
            bestScore: idx < completed ? clamp(68 + idx * 2 + (seed.postAverage - 60) * 0.5, 60, 99) : null,
            attempts: idx < completed ? 2 + (idx % 3) : 0,
            completedAt: idx < completed ? new Date(postTime.getTime() - idx * 60 * 60 * 1000) : null,
            createdAt: new Date(preTime.getTime() + idx * 60 * 60 * 1000),
            updatedAt: new Date(postTime.getTime() - idx * 30 * 60 * 1000),
          })),
        })
      }

      if (studentNumber === FOCUS_ACCOUNT_A) {
        await tx.controlOdysseyAiHistory.upsert({
          where: {
            userId_levelId: {
              userId: profile.userId,
              levelId: 'level-7',
            },
          },
          update: {
            content: '建议先固定 PI 抑制稳态误差，再逐步加入超前环节改善相位裕度，最后在 level-7 中验证频域稳定边界。',
          },
          create: {
            userId: profile.userId,
            levelId: 'level-7',
            content: '建议先固定 PI 抑制稳态误差，再逐步加入超前环节改善相位裕度，最后在 level-7 中验证频域稳定边界。',
          },
        })
      }

      if (studentNumber === FOCUS_ACCOUNT_B) {
        await tx.controlOdysseyAiHistory.upsert({
          where: {
            userId_levelId: {
              userId: profile.userId,
              levelId: 'level-8',
            },
          },
          update: {
            content: '当前短板集中在高频段判读，建议在第8关先控制交越频率，再观察相位裕度变化趋势。',
          },
          create: {
            userId: profile.userId,
            levelId: 'level-8',
            content: '当前短板集中在高频段判读，建议在第8关先控制交越频率，再观察相位裕度变化趋势。',
          },
        })
      }
    })

    insertedAbilityRows += abilityRows.length
    insertedPromptRows += promptRows.length
    insertedPathRows += learningPathCards.length
  }

  const focusProfiles = await prisma.studentProfile.findMany({
    where: {
      studentNumber: {
        in: [FOCUS_ACCOUNT_A, FOCUS_ACCOUNT_B],
      },
    },
    select: {
      studentNumber: true,
      techScore: true,
      ethicsScore: true,
      controlCredits: true,
      classId: true,
      className: true,
    },
  })

  const summary = {
    class: {
      id: showcaseClass.id,
      name: showcaseClass.name,
      code: showcaseClass.code,
      teacherId: showcaseClass.teacherId,
    },
    studentsSeeded: orderedProfiles.length,
    abilityRows: insertedAbilityRows,
    promptRows: insertedPromptRows,
    learningPathRows: insertedPathRows,
    focusProfiles,
  }

  console.log('[seed-extracurricular-showcase] done')
  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error('[seed-extracurricular-showcase] failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

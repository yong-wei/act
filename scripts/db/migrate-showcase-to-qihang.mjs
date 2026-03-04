import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_CLASS_NAME = '2023自动化启航班'
const SHOWCASE_CLASS_NAME = '2023自动化课外展示班'
const SHOWCASE_CLASS_CODE = 'ECSHOW'
const TARGET_DESCRIPTION = 'AI-OBE平台教改班'
const DEMO_STUDENT_NUMBER = 'demo'
const FIXED_FOCUS_STUDENTS = ['20230010102608', '20230010102605']

const PREVIOUS_COURSE_TITLES = [
  '反馈：控制原理的核心思想',
  '机理建模·微分方程',
  '微分方程与控制系统基础模型',
  '传递函数与控制系统数学模型',
  '方框图、信号流图与梅森公式',
  '控制奥德赛·指标裁判席',
  '衰减振荡·欠阻尼二阶系统',
  '稳定性与稳态误差：控制系统首要任务与准确性的度量',
  '根轨迹法：放眼大局与细节修正',
  '幅相特性与稳定判据：频域的启示',
  '稳定裕度与三频段：宽备窄用',
  '非线性系统与描述函数基础：从现象到模型',
  '描述函数分析法与自振判别：交点与稳定性',
  '传递函数与控制系统数学模型',
  '控制奥德赛·指标裁判席',
  '幅相特性与稳定判据：频域的启示',
]

const CURRENT_SHOWCASE_COURSE_TITLE = '柔性之海——豪华邮轮的舒适度控制'

const DIMENSIONS = [
  'computational',
  'crossDomain',
  'designTradeoff',
  'poleTimeMapping',
  'frequencyStability',
]

function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  return {}
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function scoreFromTheta(theta) {
  if (typeof theta !== 'number' || Number.isNaN(theta)) {
    return 0
  }
  return Math.round(clamp(60 + theta * 12, 0, 100))
}

function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRng(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeakTag(vector) {
  const pairs = [
    ['computational', vector.computational],
    ['cross-domain-mapping', vector.crossDomain],
    ['design-tradeoff', vector.designTradeoff],
    ['pole-time-mapping', vector.poleTimeMapping],
    ['frequency-stability-judgement', vector.frequencyStability],
  ]
  pairs.sort((a, b) => a[1] - b[1])
  return pairs[0]?.[0] ?? 'cross-domain-mapping'
}

function titleToProfile(title) {
  if (title.includes('柔性之海') || title.includes('邮轮')) {
    return {
      key: 'cruise-comfort',
      focusDimensions: ['crossDomain', 'designTradeoff', 'frequencyStability'],
      pathTemplates: [
        {
          title: '舒适度控制参数复盘',
          description: '围绕 ISO 2631 指标复盘参数调节过程，形成可复用策略。',
          estimatedTime: 25,
        },
        {
          title: '邮轮场景：频域稳定边界专项',
          description: '聚焦相位裕度与阻尼比映射，完成场景化频域练习。',
          estimatedTime: 30,
        },
        {
          title: '阅读：乘坐舒适度与控制工程',
          description: '从工程案例理解“舒适度-能耗-稳定性”三目标权衡。',
          estimatedTime: 18,
        },
      ],
    }
  }

  if (title.includes('反馈')) {
    return {
      key: 'feedback-core',
      focusDimensions: ['computational', 'designTradeoff'],
      pathTemplates: [
        {
          title: '反馈核心概念巩固题组',
          description: '补强开环/闭环判别与反馈回路理解。',
          estimatedTime: 20,
        },
        {
          title: '反馈场景判断训练',
          description: '完成典型工程场景分类与反馈价值分析。',
          estimatedTime: 22,
        },
        {
          title: '阅读：反馈思想工程案例',
          description: '通过案例理解反馈结构与鲁棒性的关系。',
          estimatedTime: 16,
        },
      ],
    }
  }

  if (title.includes('建模') || title.includes('微分方程')) {
    return {
      key: 'modeling',
      focusDimensions: ['computational', 'designTradeoff'],
      pathTemplates: [
        {
          title: '机理建模流程补强',
          description: '按“对象-假设-方程-验证”完成一次完整建模。',
          estimatedTime: 26,
        },
        {
          title: '微分方程到传函过渡训练',
          description: '强化微分方程与系统结构的映射关系。',
          estimatedTime: 24,
        },
        {
          title: '阅读：工程建模误差来源',
          description: '理解线性化误差与参数不确定性影响。',
          estimatedTime: 18,
        },
      ],
    }
  }

  if (title.includes('传递函数') || title.includes('方框图') || title.includes('梅森')) {
    return {
      key: 'transfer-topology',
      focusDimensions: ['computational', 'poleTimeMapping'],
      pathTemplates: [
        {
          title: '传递函数推导专项',
          description: '补强从方程到传函、从结构图到总传函的核心步骤。',
          estimatedTime: 24,
        },
        {
          title: '信号流图与梅森公式训练',
          description: '完成前向通路与回路增益判别练习。',
          estimatedTime: 26,
        },
        {
          title: '阅读：结构化建模策略',
          description: '梳理复杂系统分层建模的可复用策略。',
          estimatedTime: 16,
        },
      ],
    }
  }

  if (title.includes('根轨迹') || title.includes('衰减振荡')) {
    return {
      key: 'root-locus',
      focusDimensions: ['poleTimeMapping', 'crossDomain'],
      pathTemplates: [
        {
          title: '根轨迹规则巩固题组',
          description: '聚焦起终点、分离点与出射角判断。',
          estimatedTime: 24,
        },
        {
          title: '极点-时域映射强化',
          description: '提升阻尼比与超调、调节时间的映射能力。',
          estimatedTime: 22,
        },
        {
          title: '阅读：根轨迹工程调参与复盘',
          description: '学习参数修正与细节调优方法。',
          estimatedTime: 18,
        },
      ],
    }
  }

  if (
    title.includes('幅相') ||
    title.includes('稳定裕度') ||
    title.includes('稳态误差')
  ) {
    return {
      key: 'frequency-stability',
      focusDimensions: ['frequencyStability', 'crossDomain'],
      pathTemplates: [
        {
          title: '频域判稳专项题组',
          description: '补强相位裕度、增益裕度与交越频率判读。',
          estimatedTime: 25,
        },
        {
          title: '时频域映射训练',
          description: '强化频域裕度变化到时域响应变化的映射。',
          estimatedTime: 24,
        },
        {
          title: '阅读：频域判据工程手册',
          description: '通过工程案例理解频域判据的使用边界。',
          estimatedTime: 16,
        },
      ],
    }
  }

  if (title.includes('奥德赛')) {
    return {
      key: 'odyssey',
      focusDimensions: ['designTradeoff', 'frequencyStability'],
      pathTemplates: [
        {
          title: '控制奥德赛关卡复盘',
          description: '结合评分指标复盘参数策略与控制模式切换。',
          estimatedTime: 28,
        },
        {
          title: '指标裁判席追踪训练',
          description: '针对超调、调节时间和能耗指标进行平衡优化。',
          estimatedTime: 24,
        },
        {
          title: '阅读：游戏化控制学习策略',
          description: '总结“试错-反馈-修正”的高效迭代方式。',
          estimatedTime: 16,
        },
      ],
    }
  }

  if (title.includes('非线性') || title.includes('描述函数')) {
    return {
      key: 'nonlinear',
      focusDimensions: ['designTradeoff', 'crossDomain'],
      pathTemplates: [
        {
          title: '非线性系统判别训练',
          description: '强化非线性现象识别与描述函数使用前提。',
          estimatedTime: 25,
        },
        {
          title: '描述函数自振判别专项',
          description: '围绕交点与稳定性完成判别流程演练。',
          estimatedTime: 26,
        },
        {
          title: '阅读：非线性控制案例分析',
          description: '从案例中提炼非线性近似建模策略。',
          estimatedTime: 18,
        },
      ],
    }
  }

  return {
    key: 'general',
    focusDimensions: ['crossDomain', 'designTradeoff'],
    pathTemplates: [
      {
        title: '跨域映射巩固任务',
        description: '补强时域、频域与复平面之间的联动理解。',
        estimatedTime: 22,
      },
      {
        title: '设计权衡复盘训练',
        description: '围绕性能指标冲突进行参数修正练习。',
        estimatedTime: 24,
      },
      {
        title: '阅读：课程关键难点回顾',
        description: '总结本课概念链路并完成知识闭环。',
        estimatedTime: 16,
      },
    ],
  }
}

function buildTracking(basePre, basePost, courseProfile, seedKey) {
  const rng = createRng(hashString(seedKey))
  const pre = {}
  const post = {}

  for (const dim of DIMENSIONS) {
    const basePreValue = basePre[dim] ?? 0
    const basePostValue = basePost[dim] ?? basePreValue
    const preJitter = Math.round((rng() - 0.5) * 6)
    const learningRatio = 0.5 + rng() * 0.25

    const preValue = clamp(basePreValue + preJitter, 20, 95)
    const progressive = Math.round((basePostValue - basePreValue) * learningRatio)
    const focusBoost = courseProfile.focusDimensions.includes(dim) ? 6 + Math.round(rng() * 4) : 1 + Math.round(rng() * 2)
    const postValue = clamp(preValue + Math.max(1, progressive) + focusBoost, preValue + 1, 99)

    pre[dim] = preValue
    post[dim] = postValue
  }

  const delta = {}
  for (const dim of DIMENSIONS) {
    delta[dim] = post[dim] - pre[dim]
  }

  return {
    pre,
    post,
    delta,
    weakTag: pickWeakTag(post),
  }
}

function personalizePaths(courseProfile, weakTag, studentNumber) {
  const weakTagLabelMap = {
    'computational': '计算能力',
    'cross-domain-mapping': '跨域映射',
    'design-tradeoff': '设计权衡',
    'pole-time-mapping': '极点-时域映射',
    'frequency-stability-judgement': '频域稳定判读',
  }

  const weakLabel = weakTagLabelMap[weakTag] || weakTag

  return courseProfile.pathTemplates.map((path, idx) => ({
    title: idx === 0 ? `${path.title}（针对${weakLabel}）` : path.title,
    description: path.description,
    estimatedTime: path.estimatedTime,
    studentNumber,
  }))
}

function buildRecommendedQuestions(title, weakTag, studentNumber) {
  const weakLabelMap = {
    'computational': '计算能力',
    'cross-domain-mapping': '跨域映射',
    'design-tradeoff': '设计权衡',
    'pole-time-mapping': '极点-时域映射',
    'frequency-stability-judgement': '频域稳定判读',
  }
  const weakLabel = weakLabelMap[weakTag] || weakTag

  return [
    {
      stem: `【${title}】请围绕“${weakLabel}”说明你的解题步骤，并给出关键判据。`,
      difficulty: 0.62,
      knowledgeTags: [weakTag],
      studentNumber,
    },
    {
      stem: `【${title}】结合本课案例，完成一次“参数调整→现象观察→结论复盘”的闭环分析。`,
      difficulty: 0.68,
      knowledgeTags: [weakTag, 'design-tradeoff'],
      studentNumber,
    },
  ]
}

function pickSpotlightStudents(profiles, title, sessionIndex) {
  if (title.includes('柔性之海')) {
    const fixed = profiles.filter((item) => FIXED_FOCUS_STUDENTS.includes(item.studentNumber || ''))
    if (fixed.length >= 2) {
      return new Set(fixed.slice(0, 2).map((item) => item.studentNumber))
    }
  }

  const rng = createRng(hashString(`${title}:${sessionIndex}:spotlight`))
  const first = Math.floor(rng() * profiles.length)
  let second = Math.floor(rng() * profiles.length)
  if (second === first) {
    second = (second + 1) % profiles.length
  }

  return new Set([profiles[first].studentNumber, profiles[second].studentNumber])
}

async function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = ''
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    const existing = await prisma.classSession.findUnique({ where: { joinCode: code }, select: { id: true } })
    if (!existing) {
      return code
    }
  }
  throw new Error('无法生成唯一课堂码')
}

async function getOrCreatePlan(teacherId, title) {
  const existing = await prisma.lessonPlan.findFirst({
    where: { title },
    select: { id: true, title: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) {
    return existing
  }

  return prisma.lessonPlan.create({
    data: {
      title,
      description: `互动教案课堂记录：${title}`,
      authorId: teacherId,
      isPublic: false,
      isPreset: false,
    },
    select: { id: true, title: true },
  })
}

function buildHistoricalSchedule() {
  const sessions = []
  const start = new Date(2025, 2, 3, 8, 30, 0, 0) // 2025-03-03 周一

  for (let i = 0; i < PREVIOUS_COURSE_TITLES.length; i += 1) {
    const startTime = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000)
    const duration = 90 + (i % 3) * 5
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    sessions.push({
      title: PREVIOUS_COURSE_TITLES[i],
      isCurrent: false,
      startTime,
      endTime,
      duration,
    })
  }

  const currentStart = new Date()
  currentStart.setHours(8, 30, 0, 0)
  const currentEnd = new Date(currentStart.getTime() + 95 * 60 * 1000)

  sessions.push({
    title: CURRENT_SHOWCASE_COURSE_TITLE,
    isCurrent: true,
    startTime: currentStart,
    endTime: currentEnd,
    duration: 95,
  })

  return sessions
}

async function main() {
  const studentNumbers = fs
    .readFileSync(path.join(process.cwd(), 'data/test_students.md'), 'utf8')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (studentNumbers.length !== 31) {
    throw new Error(`期望31个测试学生，实际读取到 ${studentNumbers.length}`)
  }

  const targetClass = await prisma.class.findFirst({
    where: { name: TARGET_CLASS_NAME },
    include: { teacher: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  if (!targetClass) {
    throw new Error(`未找到目标班级：${TARGET_CLASS_NAME}`)
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers } },
    select: {
      userId: true,
      studentNumber: true,
      classId: true,
      className: true,
    },
  })

  if (profiles.length !== studentNumbers.length) {
    throw new Error('测试学生资料不完整，无法迁移')
  }

  const demoProfile = profiles.find((item) => item.studentNumber === DEMO_STUDENT_NUMBER)
  if (!demoProfile) {
    throw new Error('未找到 demo 学生资料')
  }

  const showcaseClass = await prisma.class.findFirst({
    where: {
      OR: [{ name: SHOWCASE_CLASS_NAME }, { code: SHOWCASE_CLASS_CODE }],
      NOT: { id: targetClass.id },
    },
    select: { id: true },
  })

  const nonDemoProfiles = profiles
    .filter((item) => item.studentNumber !== DEMO_STUDENT_NUMBER)
    .sort((a, b) => (a.studentNumber || '').localeCompare(b.studentNumber || ''))

  await prisma.class.update({
    where: { id: targetClass.id },
    data: {
      description: TARGET_DESCRIPTION,
      isActive: true,
    },
  })

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      nonDemoProfiles.map((profile) =>
        tx.studentProfile.update({
          where: { userId: profile.userId },
          data: {
            classId: targetClass.id,
            className: targetClass.name,
          },
        })
      )
    )

    await tx.studentProfile.update({
      where: { userId: demoProfile.userId },
      data: { classId: null, className: null },
    })
  })

  if (showcaseClass) {
    await prisma.$transaction(async (tx) => {
      await tx.studentProfile.updateMany({
        where: { classId: showcaseClass.id },
        data: { classId: null, className: null },
      })
      await tx.studentState.deleteMany({ where: { session: { classId: showcaseClass.id } } })
      await tx.classSession.deleteMany({ where: { classId: showcaseClass.id } })
      await tx.class.delete({ where: { id: showcaseClass.id } })
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.studentState.deleteMany({ where: { session: { classId: targetClass.id } } })
    await tx.classSession.deleteMany({ where: { classId: targetClass.id } })
  })

  const schedule = buildHistoricalSchedule()
  const uniqueTitles = [...new Set(schedule.map((item) => item.title))]

  const plans = {}
  for (const title of uniqueTitles) {
    plans[title] = await getOrCreatePlan(targetClass.teacherId, title)
  }

  const assessments = await prisma.abilityAssessment.findMany({
    where: { userId: { in: nonDemoProfiles.map((item) => item.userId) } },
    select: {
      userId: true,
      computationalTheta: true,
      crossDomainTheta: true,
      designTheta: true,
      knowledgePointAbilities: true,
      assessedAt: true,
    },
    orderBy: [{ userId: 'asc' }, { assessedAt: 'asc' }],
  })

  const assessmentByUser = new Map()
  assessments.forEach((item) => {
    const list = assessmentByUser.get(item.userId) || []
    list.push(item)
    assessmentByUser.set(item.userId, list)
  })

  let latestSessionId = null

  for (let sessionIndex = 0; sessionIndex < schedule.length; sessionIndex += 1) {
    const sessionMeta = schedule[sessionIndex]
    const plan = plans[sessionMeta.title]

    const classSession = await prisma.classSession.create({
      data: {
        joinCode: await generateJoinCode(),
        planId: plan.id,
        teacherId: targetClass.teacherId,
        classId: targetClass.id,
        status: 'FINISHED',
        currentStage: 'SUMMARY',
        startTime: sessionMeta.startTime,
        endTime: sessionMeta.endTime,
      },
      select: { id: true },
    })

    if (sessionMeta.isCurrent) {
      latestSessionId = classSession.id
    }

    const participantCount = sessionMeta.isCurrent
      ? nonDemoProfiles.length
      : clamp(24 + (sessionIndex % 7), 24, nonDemoProfiles.length)

    const participants = []
    for (let i = 0; i < participantCount; i += 1) {
      participants.push(nonDemoProfiles[(sessionIndex + i) % nonDemoProfiles.length])
    }

    const courseProfile = titleToProfile(sessionMeta.title)
    const spotlightSet = pickSpotlightStudents(participants, sessionMeta.title, sessionIndex)

    await prisma.studentState.createMany({
      data: participants.map((profile) => {
        const records = assessmentByUser.get(profile.userId) || []
        const preRecord = records[0]
        const postRecord = records[records.length - 1] || preRecord

        const preKnowledge = asObject(preRecord?.knowledgePointAbilities)
        const postKnowledge = asObject(postRecord?.knowledgePointAbilities)

        const basePre = {
          computational: scoreFromTheta(preRecord?.computationalTheta),
          crossDomain: scoreFromTheta(preRecord?.crossDomainTheta),
          designTradeoff: scoreFromTheta(preRecord?.designTheta),
          poleTimeMapping:
            Number(preKnowledge.poleTimeMapping || preKnowledge['pole-time-mapping'] || scoreFromTheta(preRecord?.crossDomainTheta)),
          frequencyStability:
            Number(
              preKnowledge.frequencyStabilityJudgement ||
                preKnowledge['frequency-stability-judgement'] ||
                scoreFromTheta(preRecord?.crossDomainTheta)
            ),
        }

        const basePost = {
          computational: scoreFromTheta(postRecord?.computationalTheta),
          crossDomain: scoreFromTheta(postRecord?.crossDomainTheta),
          designTradeoff: scoreFromTheta(postRecord?.designTheta),
          poleTimeMapping:
            Number(postKnowledge.poleTimeMapping || postKnowledge['pole-time-mapping'] || scoreFromTheta(postRecord?.crossDomainTheta)),
          frequencyStability:
            Number(
              postKnowledge.frequencyStabilityJudgement ||
                postKnowledge['frequency-stability-judgement'] ||
                scoreFromTheta(postRecord?.crossDomainTheta)
            ),
        }

        const tracking = buildTracking(
          basePre,
          basePost,
          courseProfile,
          `${sessionMeta.title}:${sessionIndex}:${profile.studentNumber}`
        )

        const reinforcementPaths = personalizePaths(
          courseProfile,
          tracking.weakTag,
          profile.studentNumber || '-'
        )
        const recommendedQuestions = buildRecommendedQuestions(
          sessionMeta.title,
          tracking.weakTag,
          profile.studentNumber || '-'
        )

        return {
          sessionId: classSession.id,
          userId: profile.userId,
          itemId: 'review:course',
          data: {
            kind: 'course_review',
            courseTitle: sessionMeta.title,
            isCurrentCourse: sessionMeta.isCurrent,
            topicKey: courseProfile.key,
            tracking: {
              pre: tracking.pre,
              post: tracking.post,
              delta: tracking.delta,
              weakTag: tracking.weakTag,
              focusDimensions: courseProfile.focusDimensions,
            },
            reinforcementPaths,
            recommendedQuestions,
            spotlight: spotlightSet.has(profile.studentNumber),
          },
          submittedAt: new Date(sessionMeta.endTime.getTime() - 2 * 60 * 1000),
        }
      }),
    })
  }

  const [targetClassAfter, deletedShowcaseClass, demoAfter] = await Promise.all([
    prisma.class.findUnique({
      where: { id: targetClass.id },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        _count: { select: { students: true, sessions: true } },
      },
    }),
    prisma.class.findFirst({
      where: {
        OR: [{ name: SHOWCASE_CLASS_NAME }, { code: SHOWCASE_CLASS_CODE }],
        NOT: { id: targetClass.id },
      },
      select: { id: true },
    }),
    prisma.studentProfile.findUnique({
      where: { userId: demoProfile.userId },
      select: { studentNumber: true, classId: true, className: true },
    }),
  ])

  console.log('[migrate-showcase-to-qihang] done')
  console.log(
    JSON.stringify(
      {
        targetClass: targetClassAfter,
        showcaseClassDeleted: !deletedShowcaseClass,
        demoProfile: demoAfter,
        movedStudents: nonDemoProfiles.length,
        latestSessionId,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error('[migrate-showcase-to-qihang] failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

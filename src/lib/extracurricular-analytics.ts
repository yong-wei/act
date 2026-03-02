import { prisma } from '@/lib/prisma'

type JsonObject = Record<string, unknown>

export type AbilityDimensionKey =
  | 'computational'
  | 'crossDomain'
  | 'designTradeoff'
  | 'poleTimeMapping'
  | 'frequencyStability'

export interface AbilityVector {
  computational: number
  crossDomain: number
  designTradeoff: number
  poleTimeMapping: number
  frequencyStability: number
}

export interface LearningPathCard {
  id: string
  title: string
  description: string
  estimatedTime: number
}

export interface RecommendedQuestion {
  id: string
  stem: string
  difficulty: number
  knowledgeTags: string[]
}

export interface StudentAnalyticsCard {
  userId: string
  studentNumber: string
  name: string
  techScore: number
  ethicsScore: number
  pre: AbilityVector
  post: AbilityVector
  delta: AbilityVector
  preWeakTag: string
  postWeakTag: string
  weakTagLabel: string
  promptStructuringScore: number | null
  designEffectScore: number | null
  recommendedPaths: LearningPathCard[]
  recommendedQuestions: RecommendedQuestion[]
}

export interface UserExtracurricularSnapshot {
  pre: AbilityVector
  post: AbilityVector
  delta: AbilityVector
  preWeakTag: string
  postWeakTag: string
  weakTagLabel: string
  promptStructuringScore: number | null
  designEffectScore: number | null
  reinforcementPaths: LearningPathCard[]
  recommendedQuestions: RecommendedQuestion[]
}

export interface ClassAnalyticsPayload {
  classInfo: {
    id: string
    name: string
    code: string
    studentCount: number
  }
  summary: {
    averagePre: AbilityVector
    averagePost: AbilityVector
    averageDelta: AbilityVector
    promptDesignCorrelation: number
    promptDesignCorrelationText: string
    totalAnswerLogs: number
    totalSimulationLogs: number
  }
  recommendationFlow: Array<{
    key: string
    title: string
    value: string
    description: string
  }>
  studentCards: StudentAnalyticsCard[]
  focusStudents: StudentAnalyticsCard[]
}

const DIMENSION_LABEL: Record<AbilityDimensionKey, string> = {
  computational: '计算能力',
  crossDomain: '跨域映射',
  designTradeoff: '设计权衡',
  poleTimeMapping: '极点-时域映射',
  frequencyStability: '频域稳定判读',
}

const TAG_LABEL: Record<string, string> = {
  'computational': '计算能力',
  'cross-domain-mapping': '跨域映射',
  'design-tradeoff': '设计权衡',
  'pole-time-mapping': '极点-时域映射',
  'frequency-stability-judgement': '频域稳定判读',
  'prompt-structuring': '提示词结构化',
}

const FOCUS_STUDENT_NUMBERS = ['20230010102608', '20230010102605']

const DEFAULT_VECTOR: AbilityVector = {
  computational: 0,
  crossDomain: 0,
  designTradeoff: 0,
  poleTimeMapping: 0,
  frequencyStability: 0,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function thetaToScore(theta: number | null | undefined): number {
  if (typeof theta !== 'number' || Number.isNaN(theta)) {
    return 0
  }
  return Math.round(clamp(60 + theta * 12, 0, 100))
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  return null
}

function asObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject
  }
  return {}
}

function extractAbilityVector(assessment: {
  computationalTheta: number
  crossDomainTheta: number
  designTheta: number
  knowledgePointAbilities: unknown
} | null | undefined): AbilityVector {
  if (!assessment) {
    return { ...DEFAULT_VECTOR }
  }

  const knowledge = asObject(assessment.knowledgePointAbilities)
  const poleTime =
    numberFromUnknown(knowledge.poleTimeMapping) ??
    numberFromUnknown(knowledge['pole-time-mapping']) ??
    thetaToScore(assessment.crossDomainTheta)

  const frequency =
    numberFromUnknown(knowledge.frequencyStabilityJudgement) ??
    numberFromUnknown(knowledge['frequency-stability-judgement']) ??
    thetaToScore(assessment.crossDomainTheta)

  return {
    computational: thetaToScore(assessment.computationalTheta),
    crossDomain: thetaToScore(assessment.crossDomainTheta),
    designTradeoff: thetaToScore(assessment.designTheta),
    poleTimeMapping: Math.round(clamp(poleTime, 0, 100)),
    frequencyStability: Math.round(clamp(frequency, 0, 100)),
  }
}

function subtractVector(post: AbilityVector, pre: AbilityVector): AbilityVector {
  return {
    computational: post.computational - pre.computational,
    crossDomain: post.crossDomain - pre.crossDomain,
    designTradeoff: post.designTradeoff - pre.designTradeoff,
    poleTimeMapping: post.poleTimeMapping - pre.poleTimeMapping,
    frequencyStability: post.frequencyStability - pre.frequencyStability,
  }
}

function averageVectors(vectors: AbilityVector[]): AbilityVector {
  if (vectors.length === 0) {
    return { ...DEFAULT_VECTOR }
  }

  const sums = vectors.reduce(
    (acc, item) => ({
      computational: acc.computational + item.computational,
      crossDomain: acc.crossDomain + item.crossDomain,
      designTradeoff: acc.designTradeoff + item.designTradeoff,
      poleTimeMapping: acc.poleTimeMapping + item.poleTimeMapping,
      frequencyStability: acc.frequencyStability + item.frequencyStability,
    }),
    { ...DEFAULT_VECTOR }
  )

  return {
    computational: Math.round(sums.computational / vectors.length),
    crossDomain: Math.round(sums.crossDomain / vectors.length),
    designTradeoff: Math.round(sums.designTradeoff / vectors.length),
    poleTimeMapping: Math.round(sums.poleTimeMapping / vectors.length),
    frequencyStability: Math.round(sums.frequencyStability / vectors.length),
  }
}

function getWeakTag(vector: AbilityVector): string {
  const entries: Array<{ tag: string; value: number }> = [
    { tag: 'computational', value: vector.computational },
    { tag: 'cross-domain-mapping', value: vector.crossDomain },
    { tag: 'design-tradeoff', value: vector.designTradeoff },
    { tag: 'pole-time-mapping', value: vector.poleTimeMapping },
    { tag: 'frequency-stability-judgement', value: vector.frequencyStability },
  ]

  entries.sort((left, right) => left.value - right.value)
  return entries[0]?.tag ?? 'cross-domain-mapping'
}

function getTagLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag
}

function calculateDesignEffect(design: {
  consistencyScore: number | null
  goalBehaviorAlignment: number | null
  behaviorResultCoherence: number | null
} | null | undefined): number | null {
  if (!design) {
    return null
  }
  const values = [
    design.consistencyScore,
    design.goalBehaviorAlignment,
    design.behaviorResultCoherence,
  ].filter((item): item is number => typeof item === 'number' && !Number.isNaN(item))

  if (values.length === 0) {
    return null
  }

  return Number((values.reduce((acc, item) => acc + item, 0) / values.length).toFixed(1))
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const size = Math.min(xs.length, ys.length)
  if (size < 2) {
    return 0
  }

  const x = xs.slice(0, size)
  const y = ys.slice(0, size)

  const meanX = x.reduce((acc, item) => acc + item, 0) / size
  const meanY = y.reduce((acc, item) => acc + item, 0) / size

  let numerator = 0
  let denominatorX = 0
  let denominatorY = 0

  for (let i = 0; i < size; i += 1) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denominatorX += dx * dx
    denominatorY += dy * dy
  }

  if (denominatorX === 0 || denominatorY === 0) {
    return 0
  }

  return numerator / Math.sqrt(denominatorX * denominatorY)
}

function toLearningPathCard(path: {
  id: string
  title: string
  description: string | null
  estimatedTime: number
}): LearningPathCard {
  return {
    id: path.id,
    title: path.title,
    description: path.description || '暂无说明',
    estimatedTime: path.estimatedTime,
  }
}

function getQuestionFallbackByTag(
  weakTag: string,
  questionBank: Array<{
    id: string
    stem: string
    difficulty: number
    knowledgeTags: string[]
  }>
): RecommendedQuestion[] {
  return questionBank
    .filter((item) => item.knowledgeTags.includes(weakTag))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      stem: item.stem,
      difficulty: item.difficulty,
      knowledgeTags: item.knowledgeTags,
    }))
}

function vectorToRows(vector: AbilityVector) {
  return (Object.keys(vector) as AbilityDimensionKey[]).map((key) => ({
    key,
    label: DIMENSION_LABEL[key],
    value: vector[key],
  }))
}

export async function getUserExtracurricularSnapshot(userId: string): Promise<UserExtracurricularSnapshot> {
  const [assessments, learningPaths, prompt, design, questionBank] = await Promise.all([
    prisma.abilityAssessment.findMany({
      where: { userId },
      orderBy: { assessedAt: 'asc' },
      select: {
        computationalTheta: true,
        crossDomainTheta: true,
        designTheta: true,
        knowledgePointAbilities: true,
      },
    }),
    prisma.learningPath.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        description: true,
        estimatedTime: true,
      },
    }),
    prisma.promptAssessment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        structurizationScore: true,
      },
    }),
    prisma.designSession.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: {
        consistencyScore: true,
        goalBehaviorAlignment: true,
        behaviorResultCoherence: true,
      },
    }),
    prisma.question.findMany({
      where: {
        source: 'extracurricular-showcase-seed',
      },
      select: {
        id: true,
        stem: true,
        difficulty: true,
        knowledgeTags: true,
      },
    }),
  ])

  const preVector = extractAbilityVector(assessments[0])
  const postVector = extractAbilityVector(assessments[assessments.length - 1] || assessments[0])
  const delta = subtractVector(postVector, preVector)

  const preWeakTag = getWeakTag(preVector)
  const postWeakTag = getWeakTag(postVector)

  const recommendedQuestions = getQuestionFallbackByTag(preWeakTag, questionBank)

  return {
    pre: preVector,
    post: postVector,
    delta,
    preWeakTag,
    postWeakTag,
    weakTagLabel: getTagLabel(postWeakTag),
    promptStructuringScore: prompt?.structurizationScore ?? null,
    designEffectScore: calculateDesignEffect(design),
    reinforcementPaths: learningPaths.map(toLearningPathCard),
    recommendedQuestions,
  }
}

export async function getClassExtracurricularAnalytics(classId: string): Promise<ClassAnalyticsPayload> {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      code: true,
      students: {
        select: {
          userId: true,
          studentNumber: true,
          techScore: true,
          ethicsScore: true,
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { studentNumber: 'asc' },
      },
    },
  })

  if (!classData) {
    throw new Error('班级不存在')
  }

  const userIds = classData.students.map((item) => item.userId)

  const [assessments, prompts, designs, learningPaths, answers, questionBank, simulationLogCount] =
    await Promise.all([
      prisma.abilityAssessment.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        orderBy: [{ userId: 'asc' }, { assessedAt: 'asc' }],
        select: {
          userId: true,
          computationalTheta: true,
          crossDomainTheta: true,
          designTheta: true,
          knowledgePointAbilities: true,
          assessedAt: true,
        },
      }),
      prisma.promptAssessment.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
        select: {
          userId: true,
          structurizationScore: true,
          createdAt: true,
        },
      }),
      prisma.designSession.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        orderBy: [{ userId: 'asc' }, { completedAt: 'desc' }],
        select: {
          userId: true,
          consistencyScore: true,
          goalBehaviorAlignment: true,
          behaviorResultCoherence: true,
          completedAt: true,
        },
      }),
      prisma.learningPath.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          userId: true,
          title: true,
          description: true,
          estimatedTime: true,
          createdAt: true,
        },
      }),
      prisma.userAnswer.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        select: {
          userId: true,
          isCorrect: true,
          question: {
            select: {
              knowledgeTags: true,
            },
          },
        },
      }),
      prisma.question.findMany({
        where: {
          source: 'extracurricular-showcase-seed',
        },
        select: {
          id: true,
          stem: true,
          difficulty: true,
          knowledgeTags: true,
        },
        orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.simulationLog.count({
        where: {
          userId: {
            in: userIds,
          },
        },
      }),
    ])

  const assessmentByUser = new Map<string, typeof assessments>()
  const promptByUser = new Map<string, typeof prompts>()
  const designByUser = new Map<string, typeof designs>()
  const pathByUser = new Map<string, typeof learningPaths>()
  const answersByUser = new Map<string, typeof answers>()

  assessments.forEach((item) => {
    const list = assessmentByUser.get(item.userId) || []
    list.push(item)
    assessmentByUser.set(item.userId, list)
  })

  prompts.forEach((item) => {
    const list = promptByUser.get(item.userId) || []
    list.push(item)
    promptByUser.set(item.userId, list)
  })

  designs.forEach((item) => {
    const list = designByUser.get(item.userId) || []
    list.push(item)
    designByUser.set(item.userId, list)
  })

  learningPaths.forEach((item) => {
    const list = pathByUser.get(item.userId) || []
    list.push(item)
    pathByUser.set(item.userId, list)
  })

  answers.forEach((item) => {
    const list = answersByUser.get(item.userId) || []
    list.push(item)
    answersByUser.set(item.userId, list)
  })

  const cards: StudentAnalyticsCard[] = classData.students.map((student) => {
    const userAssessments = assessmentByUser.get(student.userId) || []
    const preVector = extractAbilityVector(userAssessments[0])
    const postVector = extractAbilityVector(
      userAssessments[userAssessments.length - 1] || userAssessments[0]
    )
    const delta = subtractVector(postVector, preVector)

    const preWeakTag = getWeakTag(preVector)
    const postWeakTag = getWeakTag(postVector)

    const latestPrompt = (promptByUser.get(student.userId) || [])[0]
    const latestDesign = (designByUser.get(student.userId) || [])[0]

    const wrongTagCounter = new Map<string, number>()
    ;(answersByUser.get(student.userId) || []).forEach((item) => {
      if (item.isCorrect) {
        return
      }
      item.question.knowledgeTags.forEach((tag) => {
        wrongTagCounter.set(tag, (wrongTagCounter.get(tag) || 0) + 1)
      })
    })

    const dominantWrongTag = Array.from(wrongTagCounter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const recommendationTag = dominantWrongTag || preWeakTag

    const recommendedQuestions = getQuestionFallbackByTag(recommendationTag, questionBank)
    const recommendedPaths = (pathByUser.get(student.userId) || [])
      .slice(0, 3)
      .map(toLearningPathCard)

    return {
      userId: student.userId,
      studentNumber: student.studentNumber || '-',
      name: student.user.name || '未命名学生',
      techScore: Math.round(student.techScore || 0),
      ethicsScore: Math.round(student.ethicsScore || 0),
      pre: preVector,
      post: postVector,
      delta,
      preWeakTag,
      postWeakTag,
      weakTagLabel: getTagLabel(postWeakTag),
      promptStructuringScore: latestPrompt?.structurizationScore ?? null,
      designEffectScore: calculateDesignEffect(latestDesign),
      recommendedPaths,
      recommendedQuestions,
    }
  })

  const averagePre = averageVectors(cards.map((item) => item.pre))
  const averagePost = averageVectors(cards.map((item) => item.post))
  const averageDelta = subtractVector(averagePost, averagePre)

  const promptScores: number[] = []
  const designScores: number[] = []

  cards.forEach((item) => {
    if (typeof item.promptStructuringScore === 'number' && typeof item.designEffectScore === 'number') {
      promptScores.push(item.promptStructuringScore)
      designScores.push(item.designEffectScore)
    }
  })

  const correlation = Number(pearsonCorrelation(promptScores, designScores).toFixed(3))

  const recommendationFlow = [
    {
      key: 'logs',
      title: '行为日志采集',
      value: `${answers.length} 条答题 + ${simulationLogCount} 条仿真`,
      description: '汇聚答题、仿真和课堂行为数据，形成学习过程画像。',
    },
    {
      key: 'weakness',
      title: '薄弱点识别',
      value: '5维能力自动诊断',
      description: '结合 pre/post 能力向量与错误标签分布，识别个体短板。',
    },
    {
      key: 'recommendation',
      title: '个性化推题/补强',
      value: `${cards.reduce((acc, item) => acc + item.recommendedQuestions.length, 0)} 条推荐题`,
      description: '按弱项标签输出题单、奥德赛关卡与阅读建议。',
    },
  ]

  const focusStudents = cards.filter((item) =>
    FOCUS_STUDENT_NUMBERS.includes(item.studentNumber)
  )

  return {
    classInfo: {
      id: classData.id,
      name: classData.name,
      code: classData.code,
      studentCount: classData.students.length,
    },
    summary: {
      averagePre,
      averagePost,
      averageDelta,
      promptDesignCorrelation: correlation,
      promptDesignCorrelationText: `r = ${correlation.toFixed(3)}`,
      totalAnswerLogs: answers.length,
      totalSimulationLogs: simulationLogCount,
    },
    recommendationFlow,
    studentCards: cards,
    focusStudents,
  }
}

export function formatVectorRows(vector: AbilityVector) {
  return vectorToRows(vector)
}

export function getDimensionLabel(key: AbilityDimensionKey) {
  return DIMENSION_LABEL[key]
}

export function getTagDisplayName(tag: string) {
  return getTagLabel(tag)
}

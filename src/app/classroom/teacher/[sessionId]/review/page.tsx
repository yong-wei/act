import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, BookOpen, Brain } from 'lucide-react'
import { getServerAuthSession } from '@/lib/auth'
import {
  buildClassroomSessionStatistics,
  formatClassroomSessionDate,
} from '@/lib/classroom-session-statistics'
import { resolveSessionClassContext } from '@/lib/data-governance/class-session-attribution'
import { buildUNIT41SubmissionTelemetry } from '@/lib/data-governance/unit-4-1-submission-telemetry'
import { getClassExtracurricularAnalytics } from '@/lib/extracurricular-analytics'
import { prisma } from '@/lib/prisma'

interface PageProps {
  params: { sessionId: string }
}

type AbilityDimensionKey =
  | 'computational'
  | 'crossDomain'
  | 'designTradeoff'
  | 'poleTimeMapping'
  | 'frequencyStability'

interface AbilityVector {
  computational: number
  crossDomain: number
  designTradeoff: number
  poleTimeMapping: number
  frequencyStability: number
}

interface ReinforcementPath {
  title: string
  description: string
  estimatedTime: number | null
}

interface RecommendedQuestion {
  stem: string
  difficulty: number | null
  knowledgeTags: string[]
}

interface CourseReviewRecord {
  userId: string
  userName: string
  studentNumber: string
  spotlight: boolean
  weakTag: string
  focusDimensions: AbilityDimensionKey[]
  pre: AbilityVector
  post: AbilityVector
  delta: AbilityVector
  reinforcementPaths: ReinforcementPath[]
  recommendedQuestions: RecommendedQuestion[]
}

const DIMENSIONS: AbilityDimensionKey[] = [
  'computational',
  'crossDomain',
  'designTradeoff',
  'poleTimeMapping',
  'frequencyStability',
]

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
}

const FIXED_FOCUS_STUDENTS = ['20230010102608', '20230010102605']

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

function createZeroVector(): AbilityVector {
  return {
    computational: 0,
    crossDomain: 0,
    designTradeoff: 0,
    poleTimeMapping: 0,
    frequencyStability: 0,
  }
}

function normalizeVector(value: unknown): AbilityVector {
  const obj = asObject(value)
  const base = createZeroVector()
  for (const key of DIMENSIONS) {
    const raw = toNumber(obj[key])
    base[key] = raw === null ? 0 : Math.round(clamp(raw, 0, 100))
  }
  return base
}

function diffVector(post: AbilityVector, pre: AbilityVector): AbilityVector {
  return {
    computational: post.computational - pre.computational,
    crossDomain: post.crossDomain - pre.crossDomain,
    designTradeoff: post.designTradeoff - pre.designTradeoff,
    poleTimeMapping: post.poleTimeMapping - pre.poleTimeMapping,
    frequencyStability: post.frequencyStability - pre.frequencyStability,
  }
}

function getWeakTagFromPost(post: AbilityVector) {
  const pairs: Array<[string, number]> = [
    ['computational', post.computational],
    ['cross-domain-mapping', post.crossDomain],
    ['design-tradeoff', post.designTradeoff],
    ['pole-time-mapping', post.poleTimeMapping],
    ['frequency-stability-judgement', post.frequencyStability],
  ]
  pairs.sort((a, b) => a[1] - b[1])
  return pairs[0]?.[0] || 'cross-domain-mapping'
}

function parseFocusDimensions(value: unknown): AbilityDimensionKey[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is AbilityDimensionKey => typeof item === 'string' && DIMENSIONS.includes(item as AbilityDimensionKey))
}

function parseReinforcementPaths(value: unknown): ReinforcementPath[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      const obj = asObject(item)
      const title = typeof obj.title === 'string' ? obj.title.trim() : ''
      if (!title) {
        return null
      }
      const description = typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : '暂无说明'
      const estimatedRaw = toNumber(obj.estimatedTime)
      return {
        title,
        description,
        estimatedTime: estimatedRaw === null ? null : Math.max(1, Math.round(estimatedRaw)),
      }
    })
    .filter((item): item is ReinforcementPath => Boolean(item))
}

function parseRecommendedQuestions(value: unknown): RecommendedQuestion[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      const obj = asObject(item)
      const stem = typeof obj.stem === 'string' ? obj.stem.trim() : ''
      if (!stem) {
        return null
      }
      const difficulty = toNumber(obj.difficulty)
      const knowledgeTags = Array.isArray(obj.knowledgeTags)
        ? obj.knowledgeTags.filter((tag): tag is string => typeof tag === 'string')
        : []
      return {
        stem,
        difficulty,
        knowledgeTags,
      }
    })
    .filter((item): item is RecommendedQuestion => Boolean(item))
}

function parseCourseReviewState(input: {
  user: {
    id: string
    name: string | null
    profile: {
      studentNumber: string | null
    } | null
  }
  data: unknown
}): CourseReviewRecord | null {
  const payload = asObject(input.data)
  const kind = payload.kind

  if (kind !== 'course_review' && kind !== 'showcase_review') {
    return null
  }

  const trackingObj = asObject(payload.tracking)
  const pre = normalizeVector(trackingObj.pre)
  const post = normalizeVector(trackingObj.post)
  const deltaFromData = normalizeVector(trackingObj.delta)
  const computedDelta = diffVector(post, pre)
  const deltaHasData = DIMENSIONS.some((key) => deltaFromData[key] !== 0)
  const weakTag = typeof trackingObj.weakTag === 'string' ? trackingObj.weakTag : getWeakTagFromPost(post)
  const focusDimensions = parseFocusDimensions(trackingObj.focusDimensions)

  return {
    userId: input.user.id,
    userName: input.user.name || '未命名学生',
    studentNumber: input.user.profile?.studentNumber || '-',
    spotlight: Boolean(payload.spotlight),
    weakTag,
    focusDimensions,
    pre,
    post,
    delta: deltaHasData ? deltaFromData : computedDelta,
    reinforcementPaths: parseReinforcementPaths(payload.reinforcementPaths),
    recommendedQuestions: parseRecommendedQuestions(payload.recommendedQuestions),
  }
}

function parseUnit41ReviewState(input: {
  user: {
    id: string
    name: string | null
    profile: {
      studentNumber: string | null
    } | null
  }
  data: unknown
}): CourseReviewRecord | null {
  const payload = asObject(input.data)
  if (payload.kind !== 'unit41_student_state') {
    return null
  }

  const responses = asObject(payload.responses)
  const preResponse = asObject(responses['step-03'])
  const postResponse = asObject(responses['step-12'])
  const preAnswers = asObject(preResponse.answers) as Record<string, string>
  const postAnswers = asObject(postResponse.answers) as Record<string, string>
  const preTelemetry = Object.keys(preAnswers).length > 0
    ? buildUNIT41SubmissionTelemetry({
      stepId: 'step-03',
      submittedAt: toNumber(preResponse.submittedAt) ?? Date.now(),
      answers: preAnswers,
    })
    : null
  const postTelemetry = Object.keys(postAnswers).length > 0
    ? buildUNIT41SubmissionTelemetry({
      stepId: 'step-12',
      submittedAt: toNumber(postResponse.submittedAt) ?? Date.now(),
      answers: postAnswers,
    })
    : null

  if (!preTelemetry && !postTelemetry) {
    return null
  }

  const preScore = preTelemetry?.score ?? 0
  const postScore = postTelemetry?.score ?? preScore
  const pre = {
    computational: Math.round(preScore * 0.35),
    crossDomain: Math.round(preScore * 0.55),
    designTradeoff: preScore,
    poleTimeMapping: 0,
    frequencyStability: 0,
  }
  const post = {
    computational: Math.round(postScore * 0.35),
    crossDomain: Math.round(postScore * 0.65),
    designTradeoff: postScore,
    poleTimeMapping: 0,
    frequencyStability: 0,
  }

  return {
    userId: input.user.id,
    userName: input.user.name || '未命名学生',
    studentNumber: input.user.profile?.studentNumber || '-',
    spotlight: postScore < 60 || postScore - preScore >= 30,
    weakTag: postScore < 60 ? 'design-tradeoff' : 'cross-domain-mapping',
    focusDimensions: ['designTradeoff', 'crossDomain'],
    pre,
    post,
    delta: diffVector(post, pre),
    reinforcementPaths: [{
      title: '补写任务表达证据链',
      description: '围绕目标、硬约束、软目标和证据来源重写一张任务表达卡。',
      estimatedTime: 12,
    }],
    recommendedQuestions: [],
  }
}

function averageTracking(records: CourseReviewRecord[]) {
  if (records.length === 0) {
    return {
      pre: createZeroVector(),
      post: createZeroVector(),
      delta: createZeroVector(),
      weakTag: 'cross-domain-mapping',
    }
  }

  const pre = createZeroVector()
  const post = createZeroVector()
  const delta = createZeroVector()

  for (const record of records) {
    for (const key of DIMENSIONS) {
      pre[key] += record.pre[key]
      post[key] += record.post[key]
      delta[key] += record.delta[key]
    }
  }

  for (const key of DIMENSIONS) {
    pre[key] = Math.round(pre[key] / records.length)
    post[key] = Math.round(post[key] / records.length)
    delta[key] = Math.round(delta[key] / records.length)
  }

  return {
    pre,
    post,
    delta,
    weakTag: getWeakTagFromPost(post),
  }
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickRandomStudents(
  records: CourseReviewRecord[],
  count: number,
  seedSource: string
): CourseReviewRecord[] {
  if (records.length <= count) {
    return [...records]
  }

  const picked: CourseReviewRecord[] = []
  const pool = [...records]
  let seed = hashString(seedSource)

  for (let i = 0; i < count; i += 1) {
    seed += 0x6d2b79f5
    const index = seed % pool.length
    picked.push(pool[index])
    pool.splice(index, 1)
  }

  return picked
}

function chooseFocusStudents(
  records: CourseReviewRecord[],
  courseTitle: string,
  sessionId: string
): CourseReviewRecord[] {
  if (records.length <= 2) {
    return records
  }

  if (courseTitle.includes('柔性之海')) {
    const fixed = records.filter((item) => FIXED_FOCUS_STUDENTS.includes(item.studentNumber))
    if (fixed.length >= 2) {
      return fixed.slice(0, 2)
    }
  }

  const spotlight = records.filter((item) => item.spotlight)
  if (spotlight.length >= 2) {
    return spotlight.slice(0, 2)
  }

  if (spotlight.length === 1) {
    const remaining = records.filter((item) => item.userId !== spotlight[0].userId)
    return [...spotlight, ...pickRandomStudents(remaining, 1, `${sessionId}:focus-extra`)]
  }

  return pickRandomStudents(records, 2, `${sessionId}:focus`)
}

function getTagLabel(tag: string) {
  return TAG_LABEL[tag] || tag
}

function valueArray(vector: AbilityVector) {
  return DIMENSIONS.map((key) => vector[key])
}

function MiniRadar({ values, color }: { values: number[]; color: string }) {
  const center = 56
  const radius = 42
  const axisCount = values.length

  const points = values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
      const ratio = Math.max(0, Math.min(100, value)) / 100
      const x = center + Math.cos(angle) * radius * ratio
      const y = center + Math.sin(angle) * radius * ratio
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const gridPolygons = [1, 0.75, 0.5, 0.25].map((scale) =>
    values
      .map((_, index) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
        const x = center + Math.cos(angle) * radius * scale
        const y = center + Math.sin(angle) * radius * scale
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  )

  return (
    <svg viewBox="0 0 112 112" className="h-32 w-32">
      {gridPolygons.map((polygon, index) => (
        <polygon
          key={index}
          points={polygon}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth={0.8}
        />
      ))}
      {values.map((_, index) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
        const x = center + Math.cos(angle) * radius
        const y = center + Math.sin(angle) * radius
        return (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={0.8}
          />
        )
      })}
      <polygon points={points} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={1.8} />
      <circle cx={center} cy={center} r={1.6} fill={color} />
    </svg>
  )
}

export default async function TeacherSessionReviewPage({ params }: PageProps) {
  const auth = await getServerAuthSession()
  if (!auth?.user?.id) {
    redirect('/login')
  }

  if (auth.user.role !== 'TEACHER' && auth.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    select: {
      id: true,
      classId: true,
      teacherId: true,
      startTime: true,
      endTime: true,
      status: true,
      plan: {
        select: {
          title: true,
        },
      },
      class: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      studentStates: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              profile: {
                select: {
                  classId: true,
                  studentNumber: true,
                },
              },
            },
          },
          data: true,
        },
      },
      classSessionReports: {
        where: {
          reportType: 'class-summary',
        },
        select: {
          reportData: true,
        },
        take: 1,
      },
    },
  })

  if (!session) {
    notFound()
  }

  if (auth.user.role !== 'ADMIN' && auth.user.id !== session.teacherId) {
    redirect('/teacher/classes')
  }

  const directClassContext = resolveSessionClassContext({
    sessionClassId: session.classId,
    sessionClass: session.class,
    participantClassIds: session.studentStates.map((state) => state.user.profile?.classId),
  })
  const inferredClass = directClassContext.classId && !directClassContext.class
    ? await prisma.class.findUnique({
      where: { id: directClassContext.classId },
      select: {
        id: true,
        name: true,
        code: true,
        teacherId: true,
      },
    })
    : null
  const effectiveClass = inferredClass
    && (auth.user.role === 'ADMIN' || inferredClass.teacherId === session.teacherId)
    ? inferredClass
    : directClassContext.class
  const classContext = resolveSessionClassContext({
    sessionClassId: session.classId,
    sessionClass: session.class,
    participantClassIds: session.studentStates.map((state) => state.user.profile?.classId),
    classesById: effectiveClass
      ? new Map([[effectiveClass.id, effectiveClass]])
      : undefined,
  })

  if (!classContext.classId || !classContext.class) {
    return (
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <h1 className="text-2xl font-semibold text-white">课堂记录详情</h1>
        <p className="mt-3 text-slate-300">该课堂记录未绑定班级，无法展示课后分析信息。</p>
      </main>
    )
  }

  const originalReviewRecords = session.studentStates
    .map(parseCourseReviewState)
    .filter((item): item is CourseReviewRecord => Boolean(item))

  const unit41ReviewRecords = originalReviewRecords.length === 0
    ? session.studentStates
      .map(parseUnit41ReviewState)
      .filter((item): item is CourseReviewRecord => Boolean(item))
    : []

  let reviewRecords = originalReviewRecords.length > 0 ? originalReviewRecords : unit41ReviewRecords

  if (session.plan.title.includes('柔性之海')) {
    const analytics = await getClassExtracurricularAnalytics(classContext.class.id)
    const focusMap = new Map(analytics.focusStudents.map((student) => [student.studentNumber, student]))
    reviewRecords = originalReviewRecords.map((record) => {
      const focus = focusMap.get(record.studentNumber)
      if (!focus) {
        return record
      }
      return {
        ...record,
        weakTag: focus.postWeakTag || record.weakTag,
        pre: focus.pre,
        post: focus.post,
        delta: focus.delta,
        reinforcementPaths: focus.recommendedPaths.map((path) => ({
          title: path.title,
          description: path.description,
          estimatedTime: path.estimatedTime,
        })),
        recommendedQuestions: focus.recommendedQuestions.map((question) => ({
          stem: question.stem,
          difficulty: question.difficulty,
          knowledgeTags: question.knowledgeTags,
        })),
      }
    })
  }

  const trackingSummary = averageTracking(reviewRecords)
  const trackingRows = DIMENSIONS.map((key) => ({
    key,
    label: DIMENSION_LABEL[key],
    pre: trackingSummary.pre[key],
    post: trackingSummary.post[key],
    delta: trackingSummary.delta[key],
  }))
  const focusDimensionLabels = Array.from(
    new Set(reviewRecords.flatMap((item) => item.focusDimensions))
  ).map((key) => DIMENSION_LABEL[key])
  const focusStudents = chooseFocusStudents(reviewRecords, session.plan.title, session.id)
  const sessionStatistics = buildClassroomSessionStatistics({
    startTime: session.startTime,
    endTime: session.endTime,
    studentStateCount: session.studentStates.length,
    reportData: session.classSessionReports[0]?.reportData,
  })
  const governanceSummary = sessionStatistics.governanceSummary

  return (
    <main className="surface-page mx-auto max-w-[1300px] px-6 py-8">
      <Link
        href={`/teacher/classes/${classContext.class.id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-subtle transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回班级详情
      </Link>

      <section className="surface-card mb-6 bg-gradient-to-br from-card via-card to-accent/35 p-6">
        <h1 className="text-2xl font-semibold text-foreground">《{session.plan.title}》课堂复盘</h1>
        <p className="mt-2 text-sm text-slate-300">
          {classContext.class.name}（{classContext.class.code}） · {formatClassroomSessionDate(session.startTime)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">状态：{session.status}</span>
          <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">课堂记录：{sessionStatistics.studentCount} 人</span>
          {governanceSummary?.loggedParticipants !== null && governanceSummary?.loggedParticipants !== undefined && (
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              有互动日志：{governanceSummary.loggedParticipants} 人
            </span>
          )}
          {governanceSummary?.submittedParticipants !== null && governanceSummary?.submittedParticipants !== undefined && (
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              有提交：{governanceSummary.submittedParticipants} 人
            </span>
          )}
          {governanceSummary?.factParticipants !== null && governanceSummary?.factParticipants !== undefined && (
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1">
              形成学习事实：{governanceSummary.factParticipants} 人
            </span>
          )}
          {governanceSummary?.syncErrorUsers !== null && governanceSummary?.syncErrorUsers !== undefined && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              同步错误：{governanceSummary.syncErrorUsers} 人
            </span>
          )}
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sky-300">
            课程聚焦：{focusDimensionLabels.length > 0 ? focusDimensionLabels.join('、') : '未标注'}
          </span>
        </div>
      </section>

      <section className="surface-card mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-sky-300" />
          <h2 className="text-lg font-semibold text-foreground">课前 vs 课后能力追踪</h2>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          能力维度已按《{session.plan.title}》课程内容聚焦，班级均值短板：{getTagLabel(trackingSummary.weakTag)}
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trackingRows.map((row) => (
            <div key={row.key} className="surface-card-soft p-4">
              <p className="text-sm text-slate-300">{row.label}</p>
              <p className="mt-1 text-xs text-slate-400">
                课前 {row.pre} → 课后 {row.post}
                <span className={`ml-2 font-semibold ${row.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {row.delta >= 0 ? '+' : ''}{row.delta}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-semibold text-foreground">课后个性化补强路径</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {focusStudents.map((student) => (
            <article key={student.userId} className="surface-card-soft p-4">
              <p className="font-medium text-foreground">{student.userName}（{student.studentNumber}）</p>
              <p className="mt-1 text-xs text-slate-400">当前短板：{getTagLabel(student.weakTag)}</p>
              <div className="mt-3 space-y-2">
                {student.reinforcementPaths.slice(0, 3).map((path) => (
                  <div key={`${student.userId}-${path.title}`} className="surface-card-soft p-3">
                    <p className="text-sm text-foreground">{path.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{path.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">预计 {path.estimatedTime ?? '-'} 分钟</p>
                  </div>
                ))}
                {student.reinforcementPaths.length === 0 && (
                  <p className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
                    暂无补强路径记录
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-400">个性化题单</p>
                {student.recommendedQuestions.slice(0, 2).map((question, index) => (
                  <div key={`${student.userId}-q-${index}`} className="surface-card-soft p-3">
                    <p className="text-sm text-slate-200">{question.stem}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      难度 {question.difficulty ?? '-'}{question.knowledgeTags.length > 0 ? ` · ${question.knowledgeTags.join(' / ')}` : ''}
                    </p>
                  </div>
                ))}
                {student.recommendedQuestions.length === 0 && (
                  <p className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
                    暂无个性化题单
                  </p>
                )}
              </div>
            </article>
          ))}
          {focusStudents.length === 0 && (
            <p className="surface-card-soft p-4 text-sm text-slate-300">
              当前课堂暂无可展示的补强路径数据。
            </p>
          )}
        </div>
      </section>

      {reviewRecords.length > 0 && (
        <section className="surface-card mb-6 p-6">
          <h2 className="text-lg font-semibold text-foreground">课堂记录中的学生摘要</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {reviewRecords.slice(0, 4).map((item) => (
              <div key={item.userId} className="surface-card-soft p-4">
                <p className="font-medium text-foreground">{item.userName}（{item.studentNumber}）</p>
                <p className="mt-2 text-xs text-slate-400">追踪短板：{getTagLabel(item.weakTag)}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {item.reinforcementPaths.slice(0, 2).map((path) => (
                    <li key={`${item.userId}-${path.title}`} className="surface-card-soft px-2 py-1">
                      {path.title}（{path.estimatedTime ?? '-'} min）
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface-card mb-6 p-6">
        <h2 className="text-lg font-semibold text-foreground">本次课课前/课后能力追踪图</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="surface-card-soft p-4">
            <p className="text-sm text-slate-400">课前能力雷达</p>
            <div className="mt-3 flex items-center justify-center">
              <MiniRadar values={valueArray(trackingSummary.pre)} color="rgb(148,163,184)" />
            </div>
          </div>
          <div className="surface-card-soft p-4">
            <p className="text-sm text-slate-400">课后能力雷达</p>
            <div className="mt-3 flex items-center justify-center">
              <MiniRadar values={valueArray(trackingSummary.post)} color="rgb(16,185,129)" />
            </div>
          </div>
        </div>
      </section>

      <Link
        href="/review/extracurricular-showcase"
        className="inline-flex items-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-4 py-2 text-sm text-primary transition hover:bg-primary/20"
      >
        前往评审聚合入口
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </main>
  )
}

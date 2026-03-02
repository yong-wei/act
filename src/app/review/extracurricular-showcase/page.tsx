import Link from 'next/link'
import { ArrowUpRight, Brain, Sigma, Users } from 'lucide-react'
import { getClassExtracurricularAnalytics } from '@/lib/extracurricular-analytics'
import { prisma } from '@/lib/prisma'

const SHOWCASE_CLASS_NAME = '2023自动化启航班'
const SHOWCASE_CLASS_CODE = 'CGK7XQ'

export default async function ExtracurricularShowcaseReviewPage() {
  let analytics = null as Awaited<ReturnType<typeof getClassExtracurricularAnalytics>> | null
  let error: string | null = null

  try {
    const classInfo = await fetchShowcaseClass()
    if (!classInfo?.id) {
      error = `未找到展示班级（${SHOWCASE_CLASS_NAME} / ${SHOWCASE_CLASS_CODE}），请先执行 scripts/migrate-showcase-to-qihang.mjs`
    } else {
      analytics = await getClassExtracurricularAnalytics(classInfo.id)
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败'
  }

  if (error || !analytics) {
    return (
      <main className="surface-page px-6 py-10">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-foreground">
          <h1 className="text-2xl font-semibold">课外展示聚合入口</h1>
          <p className="mt-3 text-sm text-red-200">{error || '暂无可展示数据'}</p>
          <p className="mt-3 text-xs text-subtle">建议执行：`node scripts/migrate-showcase-to-qihang.mjs`</p>
        </div>
      </main>
    )
  }

  return (
    <main className="surface-page">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="surface-card mb-6 p-6">
          <h1 className="text-3xl font-semibold text-foreground">课外教学展示聚合入口</h1>
          <p className="mt-2 text-sm text-subtle">
            覆盖脚本关键镜头：P-05 ~ P-13。展示班级：2023启航班（{analytics.classInfo.code}）
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryChip icon={<Users className="h-4 w-4" />} label="学生数" value={`${analytics.classInfo.studentCount}`} />
            <SummaryChip icon={<Brain className="h-4 w-4" />} label="答题日志" value={`${analytics.summary.totalAnswerLogs}`} />
            <SummaryChip icon={<Sigma className="h-4 w-4" />} label="提示-设计相关" value={analytics.summary.promptDesignCorrelationText} />
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <QuickLink
            href={`/teacher/classes/${analytics.classInfo.id}/analytics`}
            title="教师端班级展示分析（P-06~P-12）"
            description="推荐流程、A/B差异题单、班级热力图、前后测追踪、补强路径、相关性散点图。"
          />
          <QuickLink
            href="/knowledge"
            title="知识图谱（P-01~P-04）"
            description="全局视图、关系筛选、节点聚焦与跨域关联高亮。"
          />
          <QuickLink
            href="/interactive-learning/courses/cruise-comfort-boppps"
            title="BOPPPS课堂入口（P-10）"
            description="个性化目标生成入口（Step 2 Objective）。"
          />
          <QuickLink
            href="/interactive-learning/control-odyssey"
            title="控制奥德赛（P-13）"
            description="关卡总览、失败后AI建议、积分/解锁逻辑。"
          />
        </section>

        <section className="surface-card p-6">
          <h2 className="text-xl font-semibold text-foreground">重点学生镜头账号</h2>
          <p className="mt-2 text-sm text-subtle">
            学生A：20230010102608（课前极点-时域薄弱，课后跨域明显提升，频域仍短板）
            <br />
            学生B：20230010102605（频域稳定判读薄弱，重点推荐Bode题组）
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {analytics.focusStudents.map((student) => (
              <div key={student.userId} className="surface-card-soft p-4">
                <p className="font-medium text-foreground">{student.name}（{student.studentNumber}）</p>
                <p className="mt-1 text-xs text-subtle">
                  弱项：{student.weakTagLabel} · 结构分 {student.promptStructuringScore ?? '-'} · 设计分 {student.designEffectScore ?? '-'}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-subtle">
                  {student.recommendedQuestions.slice(0, 2).map((question) => (
                    <li key={question.id} className="rounded border border-border/60 bg-background/55 px-2 py-1">
                      {question.stem}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card mt-6 p-6">
          <h2 className="text-xl font-semibold text-foreground">建议截图顺序</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-subtle">
            <li>知识图谱全局 + 关系筛选 + 阻尼比节点聚焦 + 跨域映射</li>
            <li>教师端班级分析：推荐流程图 → A/B题单 → 热力图</li>
            <li>教师端班级分析：课前/课后平均能力对比 + 相关性散点</li>
            <li>学生个人中心：补强路径卡片（任选一个重点账号登录）</li>
            <li>控制奥德赛：关卡总览 + 对应重点账号AI建议</li>
          </ol>
        </section>

        <div className="mt-6">
          <Link
            href="/review"
            className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:border-primary/60"
          >
            返回评审入口
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}

function SummaryChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card-soft px-3 py-2 text-sm text-foreground">
      <div className="mb-1 flex items-center gap-2 text-xs text-subtle">
        {icon}
        {label}
      </div>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="surface-card-soft group p-5 transition hover:-translate-y-0.5 hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-subtle transition group-hover:text-primary" />
      </div>
      <p className="mt-2 text-sm text-subtle">{description}</p>
    </Link>
  )
}

async function fetchShowcaseClass() {
  return prisma.class.findFirst({
    where: {
      OR: [
        { name: SHOWCASE_CLASS_NAME },
        { code: SHOWCASE_CLASS_CODE },
      ],
    },
    select: { id: true },
  })
}

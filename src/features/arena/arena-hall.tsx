import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  FlaskConical,
  Gauge,
  ListChecks,
  Medal,
  Trophy,
} from 'lucide-react';

import {
  ARENA_CHALLENGE_TASKS,
  getArenaChallengeObject,
  type ChallengeObjectSource,
  type ControllerMethod,
  type WorkspaceMode,
} from '@/features/arena';

const sourceLabels: Record<ChallengeObjectSource, string> = {
  typical: '典型传递函数',
  homework: '作业对象',
  'control-odyssey': '控制奥德赛',
  'virtual-simulation': '虚拟仿真对象',
  frontier: '前沿拓展对象',
};

const methodLabels: Record<ControllerMethod, string> = {
  'serial-compensator': '串联校正',
  pid: 'PID',
  'composite-compensation': '复合校正',
  mpc: 'MPC',
  'black-box-control': '黑箱控制',
};

const workspaceLabels: Record<WorkspaceMode, string> = {
  'multi-representation-linkage': '多表征联动工作台',
  'block-diagram-workbench': '框图工作台',
  'black-box-identification': '辨识 + 控制工作台',
  'predictive-control': '预测控制工作台',
};

const phaseItems = [
  { label: '白箱对象', value: '8-12 个典型对象', icon: FlaskConical },
  { label: '挑战任务', value: '对象 + 目标 + 方法 + 评测', icon: ListChecks },
  { label: '评分协议', value: '硬约束 + 指标满意度', icon: Gauge },
  { label: '榜单结构', value: '主榜、方法榜、指标榜', icon: Medal },
];

export function ArenaHall() {
  return (
    <main className="surface-page min-h-screen">
      <header className="surface-topbar">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <Link href="/" className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            Arena Mode
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 lg:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs text-subtle">
            <BarChart3 className="h-4 w-4 text-primary" />
            第一阶段：白箱对象竞技场
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-5xl">竞技场大厅</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-subtle">
              从挑战任务进入控制设计：每个任务由被控对象、任务目标、允许方法、官方评测和榜单规则共同定义。学生先选择要解决的任务，再进入合适的工作台。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {phaseItems.map((item) => (
              <div key={item.label} className="surface-card-soft p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs text-subtle">{item.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-foreground">推荐挑战任务</div>
              <div className="mt-1 text-xs text-subtle">MVP 阶段先开放串联校正与 PID 的白箱挑战</div>
            </div>
            <div className="text-xs text-subtle">任务优先，不按技术入口分流</div>
          </div>

          <div className="grid gap-4">
            {ARENA_CHALLENGE_TASKS.map((challenge) => {
              const object = getArenaChallengeObject(challenge.objectId);

              return (
              <article key={challenge.id} className="surface-card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span>{object ? sourceLabels[object.source] : '未知对象来源'}</span>
                      <span>·</span>
                      <span>{challenge.difficulty}</span>
                      <span>·</span>
                      <span>{challenge.homeworkPolicy}</span>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">{object?.name ?? challenge.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">{challenge.goal}</p>
                  </div>
                  <div className="min-w-28 rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-right">
                    <div className="text-xs text-subtle">当前最高分</div>
                    <div className="mt-1 text-2xl font-semibold text-primary">{challenge.topScore.toFixed(1)}</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {challenge.allowedMethods.map((method) => (
                    <span key={method} className="rounded-full border border-border/70 bg-accent/45 px-3 py-1 text-xs text-muted-foreground">
                      {methodLabels[method]}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-subtle md:flex-row md:items-center md:justify-between">
                  <div>
                    {challenge.participantCount} 人参与 · 推荐进入 {workspaceLabels[challenge.workspaceMode]}
                  </div>
                  <button className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm" type="button">
                    查看挑战
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

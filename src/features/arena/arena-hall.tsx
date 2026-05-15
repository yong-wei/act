'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
  filterArenaChallengeTasks,
  getArenaChallengeObject,
  type ChallengeObjectSource,
  type ControllerMethod,
  type LeaderboardType,
  type ModelVisibility,
  type WorkspaceMode,
  type ArenaTaskStats,
} from '@/features/arena/domain';
import { selectArenaHallPublicationForTask } from './arena-publication-selection';
import type { ArenaPublicationRecord } from './teacher/publication-store';

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
  'optimized-pid': '优化调参',
  'composite-compensation': '复合校正',
  mpc: 'MPC',
  'black-box-control': '黑箱控制',
  'code-controller': '代码控制器',
};

const workspaceLabels: Record<WorkspaceMode, string> = {
  'multi-representation-linkage': '多表征联动工作台',
  'block-diagram-workbench': '框图工作台',
  'black-box-identification': '辨识 + 控制工作台',
  'predictive-control': '预测控制工作台',
  'control-odyssey': '控制奥德赛工作台',
};

const sourceOptions: Array<{ value: ChallengeObjectSource | 'all'; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'typical', label: '典型对象' },
  { value: 'homework', label: '作业对象' },
  { value: 'control-odyssey', label: '奥德赛' },
  { value: 'virtual-simulation', label: '虚拟仿真' },
];

const methodOptions: Array<{ value: ControllerMethod | 'all'; label: string }> = [
  { value: 'all', label: '全部方法' },
  { value: 'serial-compensator', label: '串联校正' },
  { value: 'pid', label: 'PID' },
  { value: 'optimized-pid', label: '优化调参' },
  { value: 'composite-compensation', label: '复合校正' },
  { value: 'black-box-control', label: '黑箱控制' },
  { value: 'mpc', label: 'MPC' },
];

const visibilityOptions: Array<{ value: ModelVisibility | 'all'; label: string }> = [
  { value: 'all', label: '全部公开程度' },
  { value: 'white-box', label: '白箱' },
  { value: 'gray-box', label: '灰箱' },
  { value: 'black-box', label: '黑箱' },
];

const leaderboardOptions: Array<{ value: LeaderboardType | 'all'; label: string }> = [
  { value: 'all', label: '全部榜单' },
  { value: 'main', label: '主榜' },
  { value: 'method', label: '方法榜' },
  { value: 'metric', label: '指标榜' },
  { value: 'pareto', label: 'Pareto 榜' },
  { value: 'class', label: '班级榜' },
  { value: 'season', label: '赛季榜' },
];

const phaseItems = [
  { label: '对象来源', value: '典型、作业、奥德赛、仿真', icon: FlaskConical },
  { label: '挑战任务', value: '对象 + 目标 + 方法 + 评测', icon: ListChecks },
  { label: '评分协议', value: '硬约束 + 指标满意度', icon: Gauge },
  { label: '榜单结构', value: '主榜、方法榜、指标榜、专题榜', icon: Medal },
];

export function ArenaHall({
  taskStats = {},
  studentPublications = [],
}: {
  taskStats?: Record<string, ArenaTaskStats>;
  studentPublications?: ArenaPublicationRecord[];
}) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ChallengeObjectSource | 'all'>('all');
  const [method, setMethod] = useState<ControllerMethod | 'all'>('all');
  const [difficulty, setDifficulty] = useState<'all' | '基础' | '进阶' | '挑战'>('all');
  const [visibility, setVisibility] = useState<ModelVisibility | 'all'>('all');
  const [homework, setHomework] = useState<'all' | 'homework-capable' | 'open-practice'>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardType | 'all'>('all');
  const filteredTasks = useMemo(
    () => filterArenaChallengeTasks(ARENA_CHALLENGE_TASKS, {
      query,
      source,
      method,
      difficulty,
      visibility,
      homework,
      leaderboard,
    }),
    [difficulty, homework, leaderboard, method, query, source, visibility],
  );

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
            任务清单与评价方案覆盖
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
              <div className="mt-1 text-xs text-subtle">覆盖典型对象、作业对象、控制奥德赛和虚拟仿真对象</div>
            </div>
            <div className="text-xs text-subtle">任务优先，不按技术入口分流</div>
          </div>

          <div className="surface-card p-4">
            <div className="text-sm font-semibold text-foreground">筛选挑战任务</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索对象、目标或知识点"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
              />
              <FilterSelect value={source} onChange={(value) => setSource(value as ChallengeObjectSource | 'all')} options={sourceOptions} label="对象来源" />
              <FilterSelect value={method} onChange={(value) => setMethod(value as ControllerMethod | 'all')} options={methodOptions} label="允许方法" />
              <FilterSelect
                value={difficulty}
                onChange={(value) => setDifficulty(value as typeof difficulty)}
                options={[
                  { value: 'all', label: '全部难度' },
                  { value: '基础', label: '基础' },
                  { value: '进阶', label: '进阶' },
                  { value: '挑战', label: '挑战' },
                ]}
                label="难度"
              />
              <FilterSelect value={visibility} onChange={(value) => setVisibility(value as ModelVisibility | 'all')} options={visibilityOptions} label="公开程度" />
              <FilterSelect
                value={homework}
                onChange={(value) => setHomework(value as typeof homework)}
                options={[
                  { value: 'all', label: '全部任务属性' },
                  { value: 'homework-capable', label: '可作为作业' },
                  { value: 'open-practice', label: '开放练习' },
                ]}
                label="任务属性"
              />
              <FilterSelect value={leaderboard} onChange={(value) => setLeaderboard(value as LeaderboardType | 'all')} options={leaderboardOptions} label="榜单" />
            </div>
          </div>

          <div className="grid gap-4">
            {filteredTasks.map((challenge) => {
              const object = getArenaChallengeObject(challenge.objectId);
              const stats = taskStats[challenge.id] ?? {
                participantCount: 0,
                submissionCount: 0,
                topScore: null,
              };
              const publication = selectArenaHallPublicationForTask(studentPublications, challenge.id);
              const challengeHref = publication
                ? `/arena/challenges/${challenge.id}?publicationId=${publication.id}`
                : `/arena/challenges/${challenge.id}`;

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
                    <h2 className="mt-2 text-xl font-semibold text-foreground">{challenge.title}</h2>
                    {object ? (
                      <p className="mt-1 text-xs text-muted-foreground">对象：{object.name}</p>
                    ) : null}
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">{challenge.goal}</p>
                    {publication ? (
                      <div className="mt-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                        班级发布 · 截止 {new Date(publication.deadline).toLocaleString('zh-CN')}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-28 rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-right">
                    <div className="text-xs text-subtle">当前最高分</div>
                    <div className="mt-1 text-2xl font-semibold text-primary">
                      {stats.topScore === null ? '暂无' : stats.topScore.toFixed(1)}
                    </div>
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
                    {stats.participantCount} 人参与 · {stats.submissionCount} 次提交 · 推荐进入 {workspaceLabels[challenge.workspaceMode]}
                  </div>
                  <Link href={challengeHref} className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    查看挑战
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
              );
            })}
            {filteredTasks.length === 0 ? (
              <div className="surface-card p-8 text-center">
                <div className="text-sm font-semibold text-foreground">暂无匹配的挑战任务</div>
                <div className="mt-2 text-sm text-subtle">请减少筛选条件，或先查看全部白箱对象挑战。</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-subtle">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

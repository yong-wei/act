'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Search,
  FlaskConical,
  Gauge,
  ListChecks,
  Medal,
} from 'lucide-react';

import { ArenaPageShell } from './arena-page-shell';
import {
  ARENA_HIDDEN_TEST_SIGNAL_LABELS,
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
  ARENA_CHALLENGE_TASKS,
  getArenaChallengeObject,
} from './data/seed-challenges';
import {
  arenaMethodLabels,
  arenaSourceLabels,
  arenaVisibilityLabels,
} from './display-labels';
import { filterArenaChallengeTasks } from './filtering';
import {
  getArenaTrainingCapabilityGroups,
  getArenaTrainingStageGroups,
} from './training-map';
import {
  type ArenaTrainingCapabilityId,
  type ArenaTrainingStageId,
  type ChallengeObjectSource,
  type ControllerMethod,
  type LeaderboardType,
  type ModelVisibility,
  type ArenaTaskStats,
  type WorkspaceMode,
} from './types';
import { selectArenaHallCurrentPublication, selectArenaHallPublicationForTask } from './arena-publication-selection';
import type { ArenaPublicationRecord } from './teacher/publication-store';
import { ARENA_VISUAL_ASSETS } from '@/components/platform/visual-world-assets';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

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
  { value: 'white-box', label: arenaVisibilityLabels['white-box'] },
  { value: 'gray-box', label: arenaVisibilityLabels['gray-box'] },
  { value: 'black-box', label: arenaVisibilityLabels['black-box'] },
];

const leaderboardOptions: Array<{ value: LeaderboardType | 'all'; label: string }> = [
  { value: 'all', label: '全部榜单' },
  { value: 'main', label: '主榜' },
  { value: 'method', label: '方法榜' },
  { value: 'metric', label: '指标榜' },
];

const trainingStageOptions: Array<{ value: ArenaTrainingStageId | 'all'; label: string }> = [
  { value: 'all', label: '全部训练阶段' },
  ...Object.entries(ARENA_TRAINING_STAGE_LABELS).map(([value, label]) => ({
    value: value as ArenaTrainingStageId,
    label,
  })),
];

const capabilityOptions: Array<{ value: ArenaTrainingCapabilityId | 'all'; label: string }> = [
  { value: 'all', label: '全部训练能力' },
  ...Object.entries(ARENA_TRAINING_CAPABILITY_LABELS).map(([value, label]) => ({
    value: value as ArenaTrainingCapabilityId,
    label,
  })),
];

const phaseItems = [
  { label: '对象来源', value: '典型、作业、奥德赛、仿真', icon: FlaskConical },
  { label: '挑战任务', value: '对象 + 目标 + 方法 + 评测', icon: ListChecks },
  { label: '评分协议', value: '硬约束 + 指标满意度', icon: Gauge },
  { label: '榜单结构', value: '主榜、方法榜、指标榜', icon: Medal },
];

function getArenaHallEntryLabel(source: ChallengeObjectSource | undefined, workspaceMode: WorkspaceMode): string {
  return source === 'control-odyssey' || workspaceMode === 'control-odyssey'
    ? '控制奥德赛'
    : '控制工作台';
}

function getArenaHallPublicationLifecycle(publication: ArenaPublicationRecord): {
  state: 'active' | 'expired' | 'late-only' | 'report-ready' | 'unavailable';
  label: string;
  actionLabel: string;
} {
  if (publication.status === 'draft' || publication.status === 'paused') {
    return {
      state: 'unavailable',
      label: '发布暂不可用',
      actionLabel: '等待教师开放',
    };
  }

  if (publication.status === 'closed' || publication.status === 'archived') {
    return {
      state: 'report-ready',
      label: '报告/复盘可用',
      actionLabel: '查看发布报告',
    };
  }

  const deadlineTime = new Date(publication.deadline).getTime();
  const expired = Number.isFinite(deadlineTime) && deadlineTime < Date.now();

  if (expired) {
    if (publication.gradingPolicy.allowLateSubmissions === true) {
      return {
        state: 'late-only',
        label: '已截止，可迟交',
        actionLabel: '迟交不进入正式榜单',
      };
    }
    return {
      state: 'expired',
      label: '发布已截止',
      actionLabel: '报告/复盘可用',
    };
  }

  return {
    state: 'active',
    label: '发布进行中',
    actionLabel: '继续正式提交',
  };
}

function getArenaHallPublicationBoundary(publication: ArenaPublicationRecord): string {
  if (publication.visibility === 'public' || publication.studentVisibility === 'public') {
    return '公开榜单：官方提交';
  }

  if (publication.visibility === 'course') {
    return '课程榜单：本发布官方提交';
  }

  return '班级榜单：本发布官方提交';
}

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
  const [trainingStage, setTrainingStage] = useState<ArenaTrainingStageId | 'all'>('all');
  const [capability, setCapability] = useState<ArenaTrainingCapabilityId | 'all'>('all');
  const filteredTasks = useMemo(
    () => filterArenaChallengeTasks(ARENA_CHALLENGE_TASKS, {
      query,
      source,
      method,
      difficulty,
      visibility,
      homework,
      leaderboard,
      trainingStage,
      capability,
    }),
    [capability, difficulty, homework, leaderboard, method, query, source, trainingStage, visibility],
  );
  const stageGroups = useMemo(() => getArenaTrainingStageGroups(filteredTasks), [filteredTasks]);
  const capabilityGroups = useMemo(() => getArenaTrainingCapabilityGroups(filteredTasks), [filteredTasks]);
  const entryIntents = getCommercialStudentEntryIntentGroups();
  const activePublication = selectArenaHallCurrentPublication(studentPublications);

  return (
    <ArenaPageShell
      activePath="/arena"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '竞技场首页', href: '/arena' },
      ]}
    >
      <section
        className="w-full px-4 py-6 sm:px-6 lg:px-8"
        data-commercial-student-entry-route="/arena"
        data-commercial-entry-intent="challenge"
      >
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <div
            className="surface-card relative flex min-h-[260px] overflow-hidden rounded-lg p-5"
            data-entry-current-work-priority="active-arena-publication"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px bg-cover bg-center opacity-24 mix-blend-luminosity dark:opacity-20"
              style={{ backgroundImage: `url(${ARENA_VISUAL_ASSETS['challenge-map'].src})` }}
            />
            <div className="relative z-10 flex min-h-full w-full flex-col justify-between">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-primary">挑战任务</div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-subtle">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  能力训练地图
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">竞技场大厅</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-subtle">
                  从训练阶段进入控制设计：每个任务标明训练能力、前置能力、预计用时和官方隐藏评测边界。
                </p>
              </div>
              {activePublication ? (
                <Link
                  href={`/arena/challenges/${activePublication.taskId}?publicationId=${activePublication.id}`}
                  className="mt-5 inline-flex w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  data-entry-primary-action="active-arena-publication"
                >
                  继续当前挑战
                </Link>
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {entryIntents.filter((intent) => intent.intent === 'challenge' || intent.intent === 'experiment').map((intent) => (
                  <Link key={intent.intent} href={intent.hrefs[0] ?? '/arena'} className="rounded-lg border border-border/60 bg-background/68 p-3 transition hover:border-primary/40">
                    <div className="text-sm font-semibold text-foreground">{intent.label}</div>
                    <div className="mt-1 text-xs text-subtle">{intent.summary}</div>
                  </Link>
                ))}
                {phaseItems.map((item) => (
                  <div key={item.label} className="hidden rounded-lg border border-border/60 bg-background/68 p-3 sm:block">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <item.icon className="h-4 w-4" />
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
          </div>

          <div className="surface-card relative flex min-h-[260px] flex-col overflow-hidden rounded-lg p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px bg-cover bg-center opacity-18 mix-blend-luminosity dark:opacity-16"
              style={{ backgroundImage: `url(${ARENA_VISUAL_ASSETS['score-field'].src})` }}
            />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">筛选挑战任务</div>
                <div className="mt-1 text-xs text-subtle">任务优先，不按技术入口分流</div>
              </div>
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="relative z-10 mt-4 grid flex-1 content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input aria-label="搜索对象、目标或知识点"
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
              <FilterSelect value={trainingStage} onChange={(value) => setTrainingStage(value as ArenaTrainingStageId | 'all')} options={trainingStageOptions} label="训练阶段" />
              <FilterSelect value={capability} onChange={(value) => setCapability(value as ArenaTrainingCapabilityId | 'all')} options={capabilityOptions} label="训练能力" />
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
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-foreground">能力训练地图</div>
              <div className="mt-1 text-xs text-subtle">按训练阶段组织，同时保留对象、方法、难度和榜单筛选</div>
            </div>
            <div className="text-xs text-subtle">{filteredTasks.length} 个任务</div>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              {stageGroups.map((group) => (
                <section key={group.stage} className="space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
                    <span className="text-xs text-subtle">本阶段 {group.tasks.length} 个挑战</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.tasks.map((challenge) => {
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
                      const publicationLifecycle = publication
                        ? getArenaHallPublicationLifecycle(publication)
                        : null;

                      return (
                        <article key={challenge.id} className="surface-card rounded-lg p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                                <span>{object ? arenaSourceLabels[object.source] : '未知对象来源'}</span>
                                <span>·</span>
                                <span>{challenge.difficulty}</span>
                                <span>·</span>
                                <span>预计 {challenge.training.estimatedEffortMinutes} 分钟</span>
                                <span>·</span>
                                <span>{ARENA_HIDDEN_TEST_SIGNAL_LABELS[challenge.training.hiddenTestSignal]}</span>
                              </div>
                              <h3 className="mt-2 text-xl font-semibold text-foreground">{challenge.title}</h3>
                              {object ? (
                                <p className="mt-1 text-xs text-muted-foreground">对象：{object.name}</p>
                              ) : null}
                              <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">{challenge.training.goal}</p>
                              {publication && publicationLifecycle ? (
                                <div
                                  className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
                                  data-arena-publication-lifecycle={publicationLifecycle.state}
                                >
                                  <span>{publicationLifecycle.label}</span>
                                  <span>·</span>
                                  <span>{getArenaHallPublicationBoundary(publication)}</span>
                                  <span>·</span>
                                  <span>截止 {new Date(publication.deadline).toLocaleString('zh-CN')}</span>
                                  <span>·</span>
                                  <span>{publicationLifecycle.actionLabel}</span>
                                </div>
                              ) : null}
                            </div>
                            <div className="min-w-28 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-right">
                              <div className="text-xs text-subtle">当前最高分</div>
                              <div className="mt-1 text-2xl font-semibold text-primary">
                                {stats.topScore === null ? '暂无' : stats.topScore.toFixed(1)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            {challenge.training.capabilityTags.map((item) => (
                              <span key={item} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
                                {ARENA_TRAINING_CAPABILITY_LABELS[item]}
                              </span>
                            ))}
                            {challenge.allowedMethods.map((method) => (
                              <span key={method} className="rounded-full border border-border/70 bg-accent/45 px-3 py-1 text-xs text-muted-foreground">
                                {arenaMethodLabels[method]}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs leading-5 text-subtle">
                            常见失误：{challenge.training.commonFailurePoints[0]}
                          </div>

                          <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-subtle md:flex-row md:items-center md:justify-between">
                            <div>
                              {stats.participantCount} 人参与 · {stats.submissionCount} 次提交 · 推荐进入{getArenaHallEntryLabel(object?.source, challenge.workspaceMode)}
                            </div>
                            <Link href={challengeHref} className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm">
                              查看挑战
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <aside className="surface-card h-fit rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground">训练能力覆盖</h2>
              <div className="mt-4 grid gap-3">
                {capabilityGroups.map((group) => (
                  <div key={group.capability} className="rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="text-sm font-medium text-foreground">{group.label}</div>
                    <div className="mt-1 text-xs text-subtle">{group.tasks.length} 个任务</div>
                  </div>
                ))}
              </div>
            </aside>
            {filteredTasks.length === 0 ? (
              <div className="surface-card p-8 text-center xl:col-span-2">
                <div
                  aria-hidden="true"
                  className="mx-auto mb-4 h-32 w-full max-w-sm bg-contain bg-center bg-no-repeat opacity-70"
                  style={{ backgroundImage: `url(${ARENA_VISUAL_ASSETS['empty-state'].src})` }}
                />
                <div className="text-sm font-semibold text-foreground">暂无匹配的挑战任务</div>
                <div className="mt-2 text-sm text-subtle">请减少筛选条件，或先查看全部白箱对象挑战。</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </ArenaPageShell>
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

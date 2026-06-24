import { ArrowUpRight, BarChart3, ListChecks, Rocket, Trophy } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type { ChallengeObject, ChallengeTask, LeaderboardPolicy, MetricProfile } from './types';
import type { ArenaSubmissionRecord } from './submissions/submission-service';
import { buildArenaTaskStats } from './stats';
import { getArenaWorkspaceHref } from './workspace-routing';
import { ArenaChallengeTelemetry, ArenaWorkspaceLink } from './arena-telemetry-client';
import { ArenaPageShell } from './arena-page-shell';
import { ChallengeKnowledgePreview } from './challenge-knowledge-preview';
import { ChallengeLeaderboardBrowser } from './challenge-leaderboard-browser';
import { ARENA_VISUAL_ASSETS } from '@/components/platform/visual-world-assets';
import { getChallengeLeaderboardBrowserData } from './leaderboards/leaderboard-service';
import { buildArenaLeaderboardHonors, buildArenaShowcaseSummaries } from './leaderboards/honors-showcase';
import {
  ARENA_HIDDEN_TEST_SIGNAL_LABELS,
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
} from './data/seed-challenges';
import {
  ARENA_STUDENT_LEADERBOARD_TYPES,
  arenaMethodLabels,
  arenaSourceLabels,
  arenaVisibilityLabels,
  arenaWorkspaceLabels,
  formatArenaHardConstraint,
  formatArenaLeaderboardType,
  formatArenaMetricExplanation,
  formatArenaMetricGoal,
  formatArenaTieBreaker,
} from './display-labels';

interface ChallengeDetailProps {
  task: ChallengeTask;
  object: ChallengeObject;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  submissions: ArenaSubmissionRecord[];
  publicationId?: string;
  classId?: string;
  seasonId?: string;
}

export function ChallengeDetail({
  task,
  object,
  metricProfile,
  leaderboardPolicy,
  submissions,
  publicationId,
  classId,
  seasonId,
}: ChallengeDetailProps) {
  const stats = buildArenaTaskStats(submissions, [task.id])[task.id] ?? {
    participantCount: 0,
    submissionCount: 0,
    topScore: null,
  };
  const workspaceContext = publicationId ? { publicationId, classId, seasonId } : undefined;
  const workspaceHref = getArenaWorkspaceHref(task, object, workspaceContext);
  const leaderboardBrowser = getChallengeLeaderboardBrowserData({
    taskId: task.id,
    submissions,
    leaderboardPolicyId: leaderboardPolicy.id,
    classId,
    seasonId,
  });
  const studentLeaderboardTypes = leaderboardBrowser.categories
    .map((category) => category.type)
    .filter((type) => ARENA_STUDENT_LEADERBOARD_TYPES.includes(type));
  const honors = buildArenaLeaderboardHonors(submissions, { taskId: task.id });
  const showcase = buildArenaShowcaseSummaries(submissions, { taskId: task.id });
  const prerequisiteLabels = task.training.prerequisiteCapabilityTags.map((item) =>
    ARENA_TRAINING_CAPABILITY_LABELS[item],
  );
  const launchProvenance = publicationId ? 'official-evaluation' : 'arena-preview';

  return (
    <ArenaPageShell
      activePath={`/arena/challenges/${task.id}`}
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '竞技场首页', href: '/arena' },
        { label: task.title, href: `/arena/challenges/${task.id}` },
      ]}
    >
      <ArenaChallengeTelemetry task={task} object={object} hasLeaderboard={submissions.length > 0} />
      <section
        className="w-full px-4 pb-32 pt-8 sm:px-6 lg:px-8"
        data-commercial-workspace="arena-challenge-detail"
        data-task-workspace-archetype="challenge-task"
        data-launch-provenance={launchProvenance}
        data-return-target="/arena"
        data-evidence-flow-target="/profile/evidence"
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
          <div className="min-w-0 space-y-6" data-commercial-workspace-zone="instrument-area">
            <div className="surface-card relative min-w-0 overflow-hidden rounded-lg p-6 shadow-sm" data-commercial-workspace-zone="context-strip">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px bg-cover bg-center opacity-24 mix-blend-luminosity dark:opacity-20"
                style={{ backgroundImage: `url(${ARENA_VISUAL_ASSETS['control-bench'].src})` }}
              />
              <div className="relative z-10 max-w-5xl">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  <Trophy className="h-5 w-5" />
                  自动控制竞技场
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs">{task.difficulty}</span>
                </div>
                <h1 className="mt-4 break-words text-3xl font-semibold text-foreground md:text-4xl">{task.title}</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-subtle">{task.goal}</p>
                <ArenaWorkspaceLink
                  href={workspaceHref}
                  task={task}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 xl:hidden"
                  data-primary-instrument-entry="arena-workbench-launch"
                  data-mobile-first-workspace-entry="true"
                >
                  进入控制工作台
                  <ArrowUpRight className="h-4 w-4" />
                </ArenaWorkspaceLink>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <DetailItem label="对象来源" value={arenaSourceLabels[object.source]} />
                  <DetailItem label="公开程度" value={arenaVisibilityLabels[object.visibility]} />
                  <DetailItem label="工作台" value={arenaWorkspaceLabels[task.workspaceMode]} />
                  <DetailItem label="榜单规则" value={leaderboardPolicy.name} />
                </div>
              </div>
            </div>

            <div className="surface-card rounded-lg p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ListChecks className="h-5 w-5 text-primary" />
                对象说明
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <DetailItem label="被控对象" value={object.name} />
                <DetailItem label="章节关联" value={object.chapter} />
                <DetailItem label="任务属性" value={task.homeworkPolicy} />
                {object.evaluationInterface ? (
                  <DetailItem label="评测接口" value={object.evaluationInterface} />
                ) : null}
              </div>
              <div className="mt-4 rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                <div className="text-xs font-medium text-subtle">{object.model ? '模型表达' : '公开接口'}</div>
                {object.model ? (
                  <div className="mt-2 overflow-x-auto text-sm [&_.katex-display]:m-0">
                    <BlockMath math={object.model.latex ?? object.model.display} />
                  </div>
                ) : (
                  <div className="mt-2 text-sm leading-6 text-foreground">
                    {object.publicInterface ?? '该对象不公开传递函数模型'}
                  </div>
                )}
              </div>
              {object.scenarioSummary ? (
                <p className="mt-4 text-sm leading-6 text-subtle">{object.scenarioSummary}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {object.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="surface-card rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">训练意图</h2>
              <p className="mt-3 text-sm leading-6 text-subtle">{task.training.goal}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <DetailItem label="训练阶段" value={ARENA_TRAINING_STAGE_LABELS[task.training.stage]} />
                <DetailItem label="预计用时" value={`${task.training.estimatedEffortMinutes} 分钟`} />
                <DetailItem label="隐藏评测信号" value={ARENA_HIDDEN_TEST_SIGNAL_LABELS[task.training.hiddenTestSignal]} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <div className="text-sm font-semibold text-foreground">训练能力</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.training.capabilityTags.map((item) => (
                      <span key={item} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
                        {ARENA_TRAINING_CAPABILITY_LABELS[item]}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <div className="text-sm font-semibold text-foreground">前置能力</div>
                  <div className="mt-3 text-sm leading-6 text-subtle">
                    {prerequisiteLabels.length > 0 ? prerequisiteLabels.join(' / ') : '无硬性前置能力'}
                  </div>
                </section>
              </div>
              <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">常见失误</div>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                  {task.training.commonFailurePoints.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="surface-card rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">评价规则</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="overflow-hidden rounded-lg border border-border/70">
                  <div className="bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">基础目标</div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-muted/45 text-xs text-subtle">
                        <tr>
                          <th className="px-4 py-2 font-medium">指标</th>
                          <th className="px-4 py-2 font-medium">目标或允许范围</th>
                          <th className="px-4 py-2 font-medium">说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {metricProfile.rankingMetrics.map((metric) => (
                          <tr key={metric.id}>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {metric.label}
                              {metric.unit ? <span className="ml-1 text-xs text-subtle">({metric.unit})</span> : null}
                            </td>
                            <td className="px-4 py-3 text-subtle">{formatArenaMetricGoal(metric)}</td>
                            <td className="px-4 py-3 text-subtle">{formatArenaMetricExplanation(metric)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-red-500/25 bg-red-500/10 p-4">
                  <div className="text-sm font-semibold text-red-600 dark:text-red-300">硬约束</div>
                  <div className="mt-3 grid gap-3">
                    {metricProfile.hardConstraints.map((constraint) => (
                      <div key={constraint} className="rounded-lg border border-red-500/20 bg-background/70 px-3 py-2 text-sm text-foreground">
                        {formatArenaHardConstraint(constraint)}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-red-600 dark:text-red-300">任一硬约束未通过时，提交不进入正式排名。</p>
                </section>
              </div>
            </div>

            <div className="surface-card rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">相关知识点</h2>
              <div className="mt-4">
                <ChallengeKnowledgePreview items={object.relatedKnowledge} />
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="surface-card rounded-lg p-6 shadow-sm" data-commercial-workspace-zone="command-bar">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Rocket className="h-5 w-5 text-primary" />
                进入控制工作台
              </h2>
              <p className="mt-2 text-sm leading-6 text-subtle">
                推荐预设：{arenaWorkspaceLabels[task.workspaceMode]}。仿真调试与方案提交均在控制工作台内完成。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {task.allowedMethods.map((method) => (
                  <span key={method} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
                    {arenaMethodLabels[method]}
                  </span>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                官方提交通过硬约束且得分大于 0 时，按个人最佳有效尝试进入已开放榜单；最新提交和全部尝试保留在提交记录，迟交、零分和无效提交只作为复盘证据，不标记为优秀方案。
              </div>
              <ArenaWorkspaceLink
                href={workspaceHref}
                task={task}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                data-primary-instrument-entry="arena-workbench-launch"
              >
                进入控制工作台
                <ArrowUpRight className="h-4 w-4" />
              </ArenaWorkspaceLink>
            </div>

            <div className="surface-card relative overflow-hidden rounded-lg p-6 shadow-sm" data-commercial-workspace-zone="evidence-rail">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px bg-cover bg-center opacity-18 mix-blend-luminosity dark:opacity-14"
                style={{ backgroundImage: `url(${ARENA_VISUAL_ASSETS['score-field'].src})` }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">榜单摘要</h2>
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <DetailItem label="当前最高分" value={stats.topScore === null ? '暂无提交' : stats.topScore.toFixed(1)} />
                  <DetailItem label="参与人数" value={`${stats.participantCount} 人`} />
                  <DetailItem label="提交次数" value={`${stats.submissionCount} 次`} />
                  <DetailItem label="榜单类型" value={studentLeaderboardTypes.map(formatArenaLeaderboardType).join(' / ')} />
                  <DetailItem label="同分决胜" value={leaderboardPolicy.tieBreakers.map(formatArenaTieBreaker).join(' / ')} />
                  <DetailItem label="荣誉记录" value={honors.length === 0 ? '暂无荣誉' : `${honors.length} 项`} />
                </div>
                <ChallengeLeaderboardBrowser browser={leaderboardBrowser} />
                <ArenaShowcaseList showcase={showcase} />
              </div>
            </div>
            <section className="surface-card rounded-lg p-6 shadow-sm" data-commercial-workspace-zone="support-drawer">
              <h2 className="text-lg font-semibold text-foreground">支持与说明</h2>
              <p className="mt-2 text-sm leading-6 text-subtle">
                任务上下文、榜单状态和工作台入口来自 Arena 域数据；页面只组织挑战详情的专业工作区层级。
              </p>
            </section>
            <div className="sr-only" data-task-workspace-zone="floating-dock-safe-area">
              Arena 挑战入口避让全局浮动控件、榜单筛选和主工作台 CTA。
            </div>
          </aside>
        </div>
      </section>
    </ArenaPageShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-subtle">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function ArenaShowcaseList({ showcase }: { showcase: ReturnType<typeof buildArenaShowcaseSummaries> }) {
  return (
    <section className="mt-5 border-t border-border/70 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">优秀方案展示</h3>
        <span className="text-xs text-subtle">摘要展示</span>
      </div>
      {showcase.length > 0 ? (
        <div className="mt-3 grid gap-3">
          {showcase.map((item) => (
            <article key={item.submissionId} className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{item.studentLabel}</div>
                  <div className="mt-0.5 text-xs text-subtle">{item.methodLabel} · {item.score.toFixed(1)} 分</div>
                </div>
                {item.honors.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {item.honors.map((honor) => (
                      <span key={honor.id} className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                        {honor.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-subtle">{item.explanationSummary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.metrics.slice(0, 3).map((metric) => (
                  <span key={metric.id} className="rounded-full border border-border/70 bg-card px-2 py-1 text-[11px] text-subtle">
                    {metric.label} {formatShowcaseMetric(metric.value, metric.unit)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-border/70 bg-background/60 px-3 py-4 text-sm text-subtle">
          暂无可展示的官方有效提交。
        </p>
      )}
    </section>
  );
}

function formatShowcaseMetric(value: number | undefined, unit?: string): string {
  if (!Number.isFinite(value)) return '暂无';
  const formatted = Math.abs(value as number) >= 100 ? (value as number).toFixed(0) : (value as number).toFixed(3).replace(/\.?0+$/, '');
  return `${formatted}${unit ?? ''}`;
}

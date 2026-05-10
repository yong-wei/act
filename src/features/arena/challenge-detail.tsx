import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, BarChart3, ListChecks, Trophy } from 'lucide-react';

import type { ChallengeObject, ChallengeTask, LeaderboardPolicy, MetricProfile } from './types';
import type { ArenaSubmissionRecord } from './submissions/submission-service';
import { buildArenaTaskStats } from './stats';
import { ArenaSubmissionPanel } from './submissions/arena-submission-panel';

const methodLabels: Record<ChallengeTask['allowedMethods'][number], string> = {
  'serial-compensator': '串联校正',
  pid: 'PID',
  'composite-compensation': '复合校正',
  mpc: 'MPC',
  'black-box-control': '黑箱控制',
};

const workspaceLabels: Record<ChallengeTask['workspaceMode'], string> = {
  'multi-representation-linkage': '多表征联动工作台',
  'block-diagram-workbench': '框图工作台',
  'black-box-identification': '辨识 + 控制工作台',
  'predictive-control': '预测控制工作台',
};

interface ChallengeDetailProps {
  task: ChallengeTask;
  object: ChallengeObject;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  submissions: ArenaSubmissionRecord[];
}

export function ChallengeDetail({
  task,
  object,
  metricProfile,
  leaderboardPolicy,
  submissions,
}: ChallengeDetailProps) {
  const stats = buildArenaTaskStats(submissions, [task.id])[task.id] ?? {
    participantCount: 0,
    submissionCount: 0,
    topScore: null,
  };

  return (
    <main className="surface-page min-h-screen">
      <header className="surface-topbar">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <Link href="/arena" className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            返回竞技场大厅
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            {leaderboardPolicy.name}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs text-subtle">
              <ListChecks className="h-4 w-4 text-primary" />
              挑战任务 · {task.difficulty}
            </div>
            <div>
              <h1 className="text-4xl font-semibold text-foreground md:text-5xl">{task.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-subtle">{task.goal}</p>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground">对象说明</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <DetailItem label="被控对象" value={object.name} />
                <DetailItem label="公开程度" value={object.visibility === 'white-box' ? '白箱模型' : object.visibility} />
                <DetailItem label="章节关联" value={object.chapter} />
                <DetailItem label="任务属性" value={task.homeworkPolicy} />
                <DetailItem label="模型表达" value={object.model.display} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {object.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border/70 bg-accent/45 px-3 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground">评价规则</h2>
              <div className="mt-4 grid gap-3">
                {metricProfile.rankingMetrics.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm">
                    <span className="text-foreground">{metric.label}</span>
                    <span className="text-subtle">
                      理想 {metric.idealValue}{metric.unit ?? ''} · 不可接受 {metric.unacceptableValue}{metric.unit ?? ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-subtle">
                硬约束：{metricProfile.hardConstraints.join(' / ')}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground">进入工作台</h2>
              <p className="mt-2 text-sm leading-6 text-subtle">
                该任务推荐进入 {workspaceLabels[task.workspaceMode]}。当前阶段只建立任务入口，工作台复用既有页面。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {task.allowedMethods.map((method) => (
                  <span key={method} className="rounded-full border border-border/70 bg-accent/45 px-3 py-1 text-xs text-muted-foreground">
                    {methodLabels[method]}
                  </span>
                ))}
              </div>
              <Link
                href={`/interactive-learning/multi-representation-linkage?arenaTask=${task.id}`}
                className="cta-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
              >
                进入工作台
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground">相关知识点</h2>
              <div className="mt-4 grid gap-2">
                {object.relatedKnowledge.map((item) => (
                  <div key={item} className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm text-subtle">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">榜单摘要</h2>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <DetailItem label="当前最高分" value={stats.topScore === null ? '暂无提交' : stats.topScore.toFixed(1)} />
                <DetailItem label="参与人数" value={`${stats.participantCount} 人`} />
                <DetailItem label="提交次数" value={`${stats.submissionCount} 次`} />
                <DetailItem label="榜单类型" value={task.leaderboardTypes.join(' / ')} />
                <DetailItem label="同分决胜" value={leaderboardPolicy.tieBreakers.join(' / ')} />
              </div>
            </div>

            <ArenaSubmissionPanel task={task} initialSubmissions={submissions} />
          </aside>
        </div>
      </section>
    </main>
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

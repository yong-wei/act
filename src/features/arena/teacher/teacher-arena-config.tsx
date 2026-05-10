import Link from 'next/link';
import { ArrowLeft, CalendarClock, ClipboardList, Trophy } from 'lucide-react';

import {
  ARENA_CHALLENGE_TASKS,
  getArenaChallengeObject,
  getArenaLeaderboardPolicy,
} from '@/features/arena';
import {
  createArenaChallengePublication,
  deriveArenaHomeworkAssessment,
} from './configuration';

const previewPublication = createArenaChallengePublication({
  taskId: 'task-integrator-low-frequency-balance',
  classId: 'class-2026-control',
  visibility: 'class',
  deadline: '2026-06-01T15:00:00.000Z',
  leaderboardPolicyId: 'leaderboard-class-homework',
  homeworkBinding: true,
});

const previewAssessment = deriveArenaHomeworkAssessment({
  validSubmission: true,
  score: 86.4,
  rank: 1,
  diagnosticWeakMetrics: ['controlEnergy'],
});

export function TeacherArenaConfig() {
  return (
    <main className="surface-page min-h-screen">
      <header className="surface-topbar">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <Link href="/teacher" className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            返回教师工作台
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            竞技场教师配置
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <h1 className="text-4xl font-semibold text-foreground">竞技场挑战配置</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-subtle">
              教师从已有挑战任务中选择对象、班级范围、截止时间和榜单策略。作业评价不等同排行榜名次，名次只作为比较反馈。
            </p>
          </div>

          <div className="grid gap-4">
            {ARENA_CHALLENGE_TASKS.map((task) => {
              const object = getArenaChallengeObject(task.objectId);
              const policy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);
              return (
                <article key={task.id} className="surface-card p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs text-subtle">{object?.name ?? '未知对象'} · {task.difficulty}</div>
                      <h2 className="mt-2 text-lg font-semibold text-foreground">{task.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-subtle">{task.goal}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-sm text-subtle">
                      {policy?.name ?? task.leaderboardPolicyId}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">发布预览</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <PreviewRow label="班级" value={previewPublication.classId} />
              <PreviewRow label="任务" value={previewPublication.taskId} />
              <PreviewRow label="可见性" value={previewPublication.studentVisibility} />
              <PreviewRow label="截止时间" value={previewPublication.deadline} />
              <PreviewRow label="作业绑定" value={previewPublication.homeworkBinding ? '是' : '否'} />
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">作业评价边界</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-subtle">{previewAssessment.summary}</p>
            <div className="mt-4 grid gap-2 text-sm">
              <PreviewRow label="达标提交" value={`${previewAssessment.gradeComponents.completionScore}`} />
              <PreviewRow label="指标掌握" value={`${previewAssessment.gradeComponents.masteryScore}`} />
              <PreviewRow label="诊断表现" value={`${previewAssessment.gradeComponents.diagnosticScore}`} />
              <PreviewRow label="名次贡献" value={`${previewAssessment.gradeComponents.rankContribution}`} />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/55 px-3 py-2">
      <span className="text-subtle">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

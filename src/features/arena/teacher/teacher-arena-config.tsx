'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, ClipboardList, Trophy } from 'lucide-react';

import {
  ARENA_CHALLENGE_TASKS,
  ARENA_LEADERBOARD_POLICIES,
  getArenaChallengeObject,
} from '@/features/arena';
import {
  createArenaChallengePublication,
  deriveArenaHomeworkAssessment,
} from './configuration';

const previewAssessment = deriveArenaHomeworkAssessment({
  validSubmission: true,
  score: 86.4,
  rank: 1,
  diagnosticWeakMetrics: ['controlEnergy'],
});

export function TeacherArenaConfig() {
  const [taskId, setTaskId] = useState('task-integrator-low-frequency-balance');
  const [classId, setClassId] = useState('class-2026-control');
  const [visibility, setVisibility] = useState<'class' | 'course' | 'public'>('class');
  const [deadline, setDeadline] = useState('2026-06-01T15:00');
  const [leaderboardPolicyId, setLeaderboardPolicyId] = useState('leaderboard-class-homework');
  const [homeworkBinding, setHomeworkBinding] = useState(true);
  const [apiStatus, setApiStatus] = useState('尚未发送预览请求');

  const previewPublication = useMemo(() => {
    try {
      return createArenaChallengePublication({
        taskId,
        classId,
        visibility,
        deadline: new Date(deadline).toISOString(),
        leaderboardPolicyId,
        homeworkBinding,
      });
    } catch {
      return null;
    }
  }, [classId, deadline, homeworkBinding, leaderboardPolicyId, taskId, visibility]);

  const submitPreviewRequest = async () => {
    setApiStatus('正在生成预览');
    try {
      const response = await fetch('/api/teacher/arena/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          classId,
          visibility,
          deadline: new Date(deadline).toISOString(),
          leaderboardPolicyId,
          homeworkBinding,
        }),
      });
      const payload = await response.json() as { error?: string };
      setApiStatus(response.ok ? '预览请求已通过权限和配置校验' : payload.error ?? '预览请求未通过');
    } catch {
      setApiStatus('预览请求失败');
    }
  };

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

          <div className="surface-card grid gap-4 p-5">
            <label className="grid gap-1 text-sm text-subtle">
              挑战任务
              <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                {ARENA_CHALLENGE_TASKS.map((task) => {
                  const object = getArenaChallengeObject(task.objectId);
                  return (
                    <option key={task.id} value={task.id}>
                      {task.title} · {object?.name ?? task.objectId}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-subtle">
                班级范围
                <input value={classId} onChange={(event) => setClassId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                可见性
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  <option value="class">班级</option>
                  <option value="course">课程</option>
                  <option value="public">公开</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                截止时间
                <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
              </label>
              <label className="grid gap-1 text-sm text-subtle">
                榜单策略
                <select value={leaderboardPolicyId} onChange={(event) => setLeaderboardPolicyId(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                  {ARENA_LEADERBOARD_POLICIES.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-subtle">
              <input type="checkbox" checked={homeworkBinding} onChange={(event) => setHomeworkBinding(event.target.checked)} />
              绑定为作业挑战
            </label>
            <button type="button" onClick={submitPreviewRequest} className="cta-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm">
              生成发布预览
            </button>
            <div className="text-xs text-subtle">{apiStatus}</div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">发布预览</h2>
            </div>
            {previewPublication ? (
              <div className="mt-4 grid gap-3 text-sm">
                <PreviewRow label="班级" value={previewPublication.classId} />
                <PreviewRow label="任务" value={previewPublication.taskId} />
                <PreviewRow label="可见性" value={previewPublication.studentVisibility} />
                <PreviewRow label="截止时间" value={previewPublication.deadline} />
                <PreviewRow label="作业绑定" value={previewPublication.homeworkBinding ? '是' : '否'} />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                当前任务、可见性、榜单或作业绑定组合不兼容。
              </div>
            )}
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

'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import { createArenaSubmission, type ArenaSubmissionRecord } from './submission-service';
import type { ChallengeTask, ControllerArtifact } from '../types';

function sampleArtifact(task: ChallengeTask, id: string, params: ControllerArtifact['params']): ControllerArtifact {
  return {
    id,
    taskId: task.id,
    method: 'pid',
    params,
    createdAt: '2026-05-10T10:00:00.000Z',
  };
}

export function ArenaSubmissionPanel({ task }: { task: ChallengeTask }) {
  const baselineSubmissions = useMemo<ArenaSubmissionRecord[]>(() => {
    const first = createArenaSubmission({
      taskId: task.id,
      artifact: sampleArtifact(task, 'artifact-preview-a', { kp: 2.2, ki: 0.7, kd: 0.28 }),
      studentLabel: '样例方案 A',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = createArenaSubmission({
      taskId: task.id,
      artifact: sampleArtifact(task, 'artifact-preview-b', { kp: 1.1, ki: 0.2, kd: 0.08 }),
      studentLabel: '样例方案 B',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });
    return [first, second];
  }, [task]);
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[]>(baselineSubmissions);
  const latest = submissions[submissions.length - 1];
  const leaderboard = buildArenaLeaderboard(submissions, { taskId: task.id, type: 'main' });

  const submitPreview = () => {
    const next = createArenaSubmission({
      taskId: task.id,
      artifact: sampleArtifact(task, `artifact-preview-${submissions.length + 1}`, { kp: 2.4, ki: 0.8, kd: 0.35 }),
      studentLabel: '我的示例提交',
      submittedAt: new Date().toISOString(),
      existingSubmissions: submissions,
    });
    setSubmissions((current) => [...current, next]);
  };

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">提交与排行榜预览</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-subtle">
        当前阶段使用本地确定性评测演示提交闭环；正式提交持久化将在后续阶段接入。
      </p>
      <button
        type="button"
        onClick={submitPreview}
        className="cta-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
      >
        <Send className="h-4 w-4" />
        提交示例 PID
      </button>
      {latest ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-subtle">最近得分</span>
            <span className="font-semibold text-primary">{latest.evaluation.score.toFixed(1)}</span>
          </div>
          <div className="mt-2 text-xs text-subtle">
            {latest.reusedEvaluation ? '重复控制器已复用既有评测结果。' : latest.evaluation.explanation[0]}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        {leaderboard.entries.slice(0, 4).map((entry) => (
          <div key={entry.submissionId} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm">
            <span className="text-foreground">#{entry.rank} {entry.studentLabel}</span>
            <span className="text-primary">{entry.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

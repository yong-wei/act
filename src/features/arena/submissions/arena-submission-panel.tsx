'use client';

import { useState } from 'react';
import { BarChart3, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import type { ArenaSubmissionRecord } from './submission-service';
import type { ChallengeTask, ControllerArtifact, LeaderboardType } from '../types';

type PreviewLeaderboardType = Exclude<LeaderboardType, 'class' | 'season'>;

function makePidArtifact(task: ChallengeTask, params: ControllerArtifact['params']): ControllerArtifact {
  return {
    id: `artifact-${task.id}-${Date.now()}`,
    taskId: task.id,
    method: 'pid',
    params,
    createdAt: new Date().toISOString(),
  };
}

export function ArenaSubmissionPanel({
  task,
  initialSubmissions,
}: {
  task: ChallengeTask;
  initialSubmissions: ArenaSubmissionRecord[];
}) {
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[]>(initialSubmissions);
  const [kp, setKp] = useState('2.4');
  const [ki, setKi] = useState('0.8');
  const [kd, setKd] = useState('0.35');
  const [status, setStatus] = useState<string | null>(null);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>(task.leaderboardTypes[0] ?? 'main');
  const [metricId, setMetricId] = useState(task.primaryMetrics[0] ?? '');
  const [method, setMethod] = useState(task.allowedMethods[0] ?? 'pid');
  const latest = submissions[submissions.length - 1];
  const availableLeaderboardTypes = task.leaderboardTypes.filter(isPreviewLeaderboardType);
  const selectedLeaderboardType: PreviewLeaderboardType = isPreviewLeaderboardType(leaderboardType) &&
    availableLeaderboardTypes.includes(leaderboardType)
    ? leaderboardType
    : availableLeaderboardTypes[0] ?? 'main';
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId: task.id,
    type: selectedLeaderboardType,
    method: selectedLeaderboardType === 'method' ? method : undefined,
    metricId: selectedLeaderboardType === 'metric' ? metricId : undefined,
  });

  const submitController = async () => {
    setStatus('正在提交官方评测...');
    const artifact = makePidArtifact(task, {
      kp: Number(kp),
      ki: Number(ki),
      kd: Number(kd),
    });
    const response = await fetch('/api/arena/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, artifact }),
    });
    const payload = await response.json() as { submission?: ArenaSubmissionRecord; error?: string };

    if (!response.ok || !payload.submission) {
      setStatus(payload.error ?? '提交失败');
      return;
    }

    setSubmissions((current) => [...current, payload.submission as ArenaSubmissionRecord]);
    setStatus(payload.submission.reusedEvaluation ? '重复控制器已复用官方评测结果。' : '官方评测已完成。');
  };

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">提交与排行榜预览</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-subtle">
        提交 PID 参数后，平台会执行官方评测并写入真实排行榜记录。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {availableLeaderboardTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setLeaderboardType(type)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              leaderboardType === type
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/70 bg-card/55 text-subtle hover:text-foreground'
            }`}
          >
            {leaderboardTypeLabel(type)}
          </button>
        ))}
      </div>
      {selectedLeaderboardType === 'metric' ? (
        <label className="mt-3 grid gap-1 text-xs text-subtle">
          指标榜
          <select
            value={metricId}
            onChange={(event) => setMetricId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          >
            {task.primaryMetrics.map((metric) => (
              <option key={metric} value={metric}>{metric}</option>
            ))}
          </select>
        </label>
      ) : null}
      {selectedLeaderboardType === 'method' ? (
        <label className="mt-3 grid gap-1 text-xs text-subtle">
          方法榜
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as typeof method)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          >
            {task.allowedMethods.map((allowedMethod) => (
              <option key={allowedMethod} value={allowedMethod}>{methodLabel(allowedMethod)}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberInput label="Kp" value={kp} onChange={setKp} />
        <NumberInput label="Ki" value={ki} onChange={setKi} />
        <NumberInput label="Kd" value={kd} onChange={setKd} />
      </div>
      <button
        type="button"
        onClick={submitController}
        className="cta-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
      >
        <Send className="h-4 w-4" />
        提交 PID 控制器
      </button>
      {status ? <div className="mt-3 text-xs text-subtle">{status}</div> : null}
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
            <span className="text-primary">{formatLeaderboardValue(entry, selectedLeaderboardType)}</span>
          </div>
        ))}
        {leaderboard.entries.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm text-subtle">
            暂无真实提交记录。
          </div>
        ) : null}
      </div>
    </section>
  );
}

function methodLabel(method: ChallengeTask['allowedMethods'][number]): string {
  const labels: Record<ChallengeTask['allowedMethods'][number], string> = {
    'serial-compensator': '串联校正',
    pid: 'PID',
    'composite-compensation': '复合校正',
    mpc: 'MPC',
    'black-box-control': '黑箱控制',
  };
  return labels[method];
}

function isPreviewLeaderboardType(type: LeaderboardType): type is PreviewLeaderboardType {
  return type !== 'class' && type !== 'season';
}

function leaderboardTypeLabel(type: LeaderboardType): string {
  const labels: Record<LeaderboardType, string> = {
    main: '主榜',
    method: '方法榜',
    metric: '指标榜',
    pareto: 'Pareto',
    class: '班级榜',
    season: '赛季榜',
  };
  return labels[type];
}

function formatLeaderboardValue(
  entry: ReturnType<typeof buildArenaLeaderboard>['entries'][number],
  type: LeaderboardType,
): string {
  if (type === 'metric' && typeof entry.metricValue === 'number') {
    return entry.metricValue.toFixed(3);
  }
  if (type === 'pareto' && typeof entry.paretoTier === 'number') {
    return `Tier ${entry.paretoTier}`;
  }
  return entry.score.toFixed(1);
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-subtle">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

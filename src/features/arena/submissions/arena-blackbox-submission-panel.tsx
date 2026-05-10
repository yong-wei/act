'use client';

import { useState } from 'react';
import { Radar, Save, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import type { ChallengeTask } from '../types';
import { sendArenaCoreEvent } from '../telemetry';
import { buildBlackBoxControlArtifactFromParams } from './blackbox-artifact-builder';
import type { ArenaSubmissionRecord } from './submission-service';

export function ArenaBlackBoxSubmissionPanel({
  task,
  initialSubmissions,
}: {
  task: ChallengeTask;
  initialSubmissions: ArenaSubmissionRecord[];
}) {
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[]>(initialSubmissions);
  const [identificationQuality, setIdentificationQuality] = useState('0.82');
  const [experimentCount, setExperimentCount] = useState('6');
  const [controllerGain, setControllerGain] = useState('1.6');
  const [dampingCompensation, setDampingCompensation] = useState('0.72');
  const [energyBudget, setEnergyBudget] = useState('12');
  const [status, setStatus] = useState<string | null>(null);
  const latest = submissions[submissions.length - 1];
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId: task.id,
    type: task.leaderboardTypes.includes('method') ? 'method' : 'main',
    method: task.leaderboardTypes.includes('method') ? 'black-box-control' : undefined,
  });

  const saveIdentificationModel = () => {
    setStatus('辨识模型已保存为黑箱控制工件草稿。');
    void sendArenaCoreEvent('arena_identification_model_save', {
      taskId: task.id,
      identificationQuality: Number(identificationQuality),
      experimentCount: Number(experimentCount),
    });
  };

  const submitController = async () => {
    setStatus('正在提交黑箱官方评测...');
    let artifact;
    try {
      artifact = buildBlackBoxControlArtifactFromParams({
        taskId: task.id,
        values: {
          identificationQuality,
          experimentCount,
          controllerGain,
          dampingCompensation,
          energyBudget,
        },
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '黑箱控制参数无效');
      return;
    }

    void sendArenaCoreEvent('arena_identification_model_save', {
      taskId: task.id,
      identificationQuality: Number(identificationQuality),
      experimentCount: Number(experimentCount),
    });
    void sendArenaCoreEvent('arena_controller_save', {
      taskId: task.id,
      method: 'black-box-control',
    });
    void sendArenaCoreEvent('arena_submit', {
      taskId: task.id,
      method: 'black-box-control',
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
    setStatus(payload.submission.reusedEvaluation ? '重复黑箱控制器已复用官方评测结果。' : '黑箱官方评测已完成。');
    void sendArenaCoreEvent('arena_evaluation_complete', {
      taskId: task.id,
      method: payload.submission.artifact.method,
      score: payload.submission.evaluation.score,
      valid: payload.submission.evaluation.valid,
    });
    void sendArenaCoreEvent('arena_result_view', {
      taskId: task.id,
      score: payload.submission.evaluation.score,
      valid: payload.submission.evaluation.valid,
    });
    void sendArenaCoreEvent('arena_feedback_view', {
      taskId: task.id,
      valid: payload.submission.evaluation.valid,
    });
  };

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">黑箱辨识与提交</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-subtle">
        这里提交的是基于实验数据形成的辨识模型与控制器参数，官方评测会在隐藏海况上复算。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberInput label="辨识质量" value={identificationQuality} onChange={setIdentificationQuality} />
        <NumberInput label="实验次数" value={experimentCount} onChange={setExperimentCount} />
        <NumberInput label="控制增益" value={controllerGain} onChange={setControllerGain} />
        <NumberInput label="阻尼补偿" value={dampingCompensation} onChange={setDampingCompensation} />
        <NumberInput label="能耗预算" value={energyBudget} onChange={setEnergyBudget} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={saveIdentificationModel}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <Save className="h-4 w-4" />
          保存辨识模型
        </button>
        <button
          type="button"
          onClick={submitController}
          className="cta-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
        >
          <Send className="h-4 w-4" />
          提交黑箱评测
        </button>
      </div>
      {status ? <div className="mt-3 text-xs text-subtle">{status}</div> : null}
      {latest ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-subtle">最近得分</span>
            <span className="font-semibold text-primary">{latest.evaluation.score.toFixed(1)}</span>
          </div>
          <div className="mt-2 text-xs text-subtle">
            {latest.evaluation.explanation[0]}
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
        {leaderboard.entries.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm text-subtle">
            暂无真实黑箱提交记录。
          </div>
        ) : null}
      </div>
    </section>
  );
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

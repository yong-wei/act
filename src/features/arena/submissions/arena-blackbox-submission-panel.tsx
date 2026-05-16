'use client';

import { useState } from 'react';
import { Radar, Save, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import type { ChallengeTask } from '../types';
import { sendArenaCoreEvent } from '../telemetry';
import { buildBlackBoxControlArtifactFromParams } from './blackbox-artifact-builder';
import type { ArenaSubmissionRecord } from './submission-service';
import type { ArenaBlackBoxExperimentDataset, ArenaIdentificationArtifactReference } from '../blackbox/experiment';
import type { ArenaVirtualSimulationPreviewRun } from '../blackbox/controller-preview';
import { ArenaPersonalFeedback } from '../student/arena-personal-feedback';

type ExperimentDatasetResponse = ArenaBlackBoxExperimentDataset & { id: string };

function buildClientIdentificationReference(
  dataset: ExperimentDatasetResponse,
): ArenaIdentificationArtifactReference {
  return {
    modelId: `arena-identification-${dataset.datasetHash.replace('arena-blackbox-dataset-', '').slice(0, 12)}`,
    taskId: dataset.taskId,
    datasetHash: dataset.datasetHash,
    modelType: 'second-order-fit',
    validationFit: dataset.summary.dataQuality,
    createdAt: new Date().toISOString(),
  };
}

export function ArenaBlackBoxSubmissionPanel({
  task,
  initialSubmissions,
  publicationId,
  viewerUserId,
}: {
  task: ChallengeTask;
  initialSubmissions: ArenaSubmissionRecord[];
  publicationId?: string;
  viewerUserId?: string;
}) {
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[]>(initialSubmissions);
  const [signalType, setSignalType] = useState('step');
  const [amplitude, setAmplitude] = useState('0.8');
  const [duration, setDuration] = useState('8');
  const [sampleTime, setSampleTime] = useState('0.2');
  const [identificationQuality, setIdentificationQuality] = useState('0.82');
  const [experimentCount, setExperimentCount] = useState('6');
  const [controllerGain, setControllerGain] = useState('1.6');
  const [dampingCompensation, setDampingCompensation] = useState('0.72');
  const [energyBudget, setEnergyBudget] = useState('12');
  const [latestDataset, setLatestDataset] = useState<ExperimentDatasetResponse | null>(null);
  const [identificationModel, setIdentificationModel] = useState<ArenaIdentificationArtifactReference | null>(null);
  const [previewRun, setPreviewRun] = useState<(ArenaVirtualSimulationPreviewRun & { id: string }) | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const personalSubmissions = viewerUserId
    ? submissions.filter((submission) => submission.userId === viewerUserId)
    : [];
  const latest = personalSubmissions[personalSubmissions.length - 1];
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId: task.id,
    type: task.leaderboardTypes.includes('method') ? 'method' : 'main',
    method: task.leaderboardTypes.includes('method') ? 'black-box-control' : undefined,
  });

  const runExperiment = async () => {
    setStatus('正在运行黑箱实验...');
    void sendArenaCoreEvent('arena_simulation_run', {
      taskId: task.id,
      signalType,
    });

    const response = await fetch('/api/arena/blackbox-experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        experimentInput: {
          signalType,
          amplitude: Number(amplitude),
          duration: Number(duration),
          sampleTime: Number(sampleTime),
          initialRoll: 0.05,
          disturbanceLevel: 0.3,
        },
      }),
    });
    const payload = await response.json() as {
      dataset?: ExperimentDatasetResponse;
      budget?: { limit: number; used: number; remaining: number };
      error?: string;
    };

    if (!response.ok || !payload.dataset || !payload.budget) {
      setStatus(payload.error ?? '黑箱实验失败');
      return;
    }

    setLatestDataset(payload.dataset);
    setExperimentCount(String(payload.budget.used));
    setIdentificationQuality(payload.dataset.summary.dataQuality.toFixed(2));
    setIdentificationModel(null);
    setPreviewRun(null);
    setStatus(`黑箱实验数据集已导入工作台，剩余预算 ${payload.budget.remaining}/${payload.budget.limit}。`);
    void sendArenaCoreEvent('arena_virtual_simulation_import', {
      taskId: task.id,
      datasetHash: payload.dataset.datasetHash,
      budgetRemaining: payload.budget.remaining,
    });
  };

  const saveIdentificationModel = () => {
    if (!latestDataset) {
      setStatus('请先运行黑箱实验并导入数据集。');
      return;
    }

    const model = buildClientIdentificationReference(latestDataset);
    setIdentificationModel(model);
    setStatus('辨识模型已保存为黑箱控制工件草稿。');
    void sendArenaCoreEvent('arena_identification_model_save', {
      taskId: task.id,
      datasetHash: latestDataset.datasetHash,
      identificationModelId: model.modelId,
      identificationQuality: Number(identificationQuality),
      experimentCount: Number(experimentCount),
    });
  };

  const buildCurrentArtifact = () => {
    if (!latestDataset) {
      throw new Error('请先运行黑箱实验并导入数据集。');
    }
    if (!identificationModel) {
      throw new Error('请先保存辨识模型。');
    }

    return buildBlackBoxControlArtifactFromParams({
      taskId: task.id,
      values: {
        identificationQuality,
        experimentCount,
        controllerGain,
        dampingCompensation,
        energyBudget,
      },
      experimentDatasetHash: latestDataset.datasetHash,
      identificationModelId: identificationModel.modelId,
    });
  };

  const applyControllerPreview = async () => {
    setStatus('正在将控制器导入虚拟仿真预演...');
    let artifact;
    try {
      artifact = buildCurrentArtifact();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '黑箱控制参数无效');
      return;
    }

    void sendArenaCoreEvent('arena_simulation_run', {
      taskId: task.id,
      method: 'black-box-control',
      previewMode: 'virtual-simulation-controller',
    });

    const response = await fetch('/api/arena/virtual-simulation-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: publicationId
        ? JSON.stringify({ taskId: task.id, artifact, publicationId })
        : JSON.stringify({ taskId: task.id, artifact }),
    });
    const payload = await response.json() as {
      preview?: ArenaVirtualSimulationPreviewRun & { id: string };
      error?: string;
    };

    if (!response.ok || !payload.preview) {
      setStatus(payload.error ?? '虚拟仿真预演失败');
      return;
    }

    setPreviewRun(payload.preview);
    setStatus('虚拟仿真预演已完成，可对照摘要后提交官方评测。');
  };

  const submitController = async () => {
    setStatus('正在提交黑箱官方评测...');
    let artifact;
    try {
      artifact = buildCurrentArtifact();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '黑箱控制参数无效');
      return;
    }

    void sendArenaCoreEvent('arena_identification_model_save', {
      taskId: task.id,
      datasetHash: String(artifact.params.experimentDatasetHash),
      identificationModelId: String(artifact.params.identificationModelId),
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
      body: publicationId
        ? JSON.stringify({ taskId: task.id, artifact, publicationId })
        : JSON.stringify({ taskId: task.id, artifact }),
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
      publicationId: publicationId ?? null,
      score: payload.submission.evaluation.score,
      valid: payload.submission.evaluation.valid,
      artifactHash: payload.submission.artifactHash,
      classId: payload.submission.classId ?? null,
      metricProfileId: task.metricProfileId,
      leaderboardPolicyId: task.leaderboardPolicyId,
      metricsJson: JSON.stringify(payload.submission.evaluation.metrics),
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
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-xs text-subtle">
          实验信号
          <select
            value={signalType}
            onChange={(event) => setSignalType(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          >
            <option value="step">阶跃</option>
            <option value="impulse">脉冲</option>
            <option value="prbs">PRBS</option>
            <option value="sine">正弦</option>
          </select>
        </label>
        <NumberInput label="幅值" value={amplitude} onChange={setAmplitude} />
        <NumberInput label="实验时长" value={duration} onChange={setDuration} />
        <NumberInput label="采样周期" value={sampleTime} onChange={setSampleTime} />
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={runExperiment}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <Radar className="h-4 w-4" />
          运行黑箱实验并导入数据集
        </button>
      </div>
      {latestDataset ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-xs text-subtle">
          数据集 {latestDataset.datasetHash} · {latestDataset.samples.length} 个采样点 · 数据质量 {latestDataset.summary.dataQuality.toFixed(2)}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberInput label="辨识质量" value={identificationQuality} onChange={setIdentificationQuality} />
        <NumberInput label="实验次数" value={experimentCount} onChange={setExperimentCount} />
        <NumberInput label="控制增益" value={controllerGain} onChange={setControllerGain} />
        <NumberInput label="阻尼补偿" value={dampingCompensation} onChange={setDampingCompensation} />
        <NumberInput label="能耗预算" value={energyBudget} onChange={setEnergyBudget} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
          onClick={applyControllerPreview}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <Radar className="h-4 w-4" />
          导入虚拟仿真预演
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
      {previewRun ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-subtle">虚拟仿真预演</span>
            <span className="font-semibold text-primary">误差 {previewRun.summary.trackingError.toFixed(3)}</span>
          </div>
          <div className="mt-2 text-xs text-subtle">
            最大偏差 {previewRun.summary.maxDeviation.toFixed(3)} · 能耗 {previewRun.summary.controlEnergy.toFixed(2)} · 安全违反 {previewRun.summary.safetyViolations}
          </div>
        </div>
      ) : null}
      {latest ? (
        <ArenaPersonalFeedback
          latest={latest}
          previousSubmissions={personalSubmissions.slice(0, -1)}
          mode="black-box"
        />
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

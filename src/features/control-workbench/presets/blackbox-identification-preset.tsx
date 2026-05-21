'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, EyeOff, Radar, Save, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '@/features/arena/leaderboards/leaderboard';
import { ArenaPersonalFeedback } from '@/features/arena/student/arena-personal-feedback';
import { sendArenaCoreEvent } from '@/features/arena/telemetry';
import type { ArenaBlackBoxExperimentDataset, ArenaBlackBoxSignalType } from '@/features/arena/blackbox/experiment';
import type { ArenaVirtualSimulationPreviewRun } from '@/features/arena/blackbox/controller-preview';
import { buildBlackBoxControlArtifactFromParams } from '@/features/arena/submissions/blackbox-artifact-builder';
import type { ArenaSubmissionRecord } from '@/features/arena/submissions/submission-service';
import type { ChallengeTask } from '@/features/arena/types';
import type {
  NominalModelArtifact,
  WorkbenchSessionContext,
  WorkbenchViewId,
} from '../contracts';
import type { WorkbenchPanelInstance } from '../views';

type ExperimentDatasetResponse = ArenaBlackBoxExperimentDataset & { id: string };
interface BlackBoxIdentificationPanelProps {
  task: ChallengeTask;
  initialSubmissions: ArenaSubmissionRecord[];
  publicationId?: string;
  viewerUserId?: string;
  officialTargetHidden?: boolean;
  panelInstances?: WorkbenchPanelInstance[];
}

function qualityStatus(value: number): NominalModelArtifact['validationMetrics'][number]['status'] {
  if (value >= 0.78) return 'pass';
  if (value >= 0.55) return 'warning';
  return 'fail';
}

export function buildClientNominalModelFromDataset(
  dataset: ExperimentDatasetResponse,
  now = new Date().toISOString(),
): NominalModelArtifact {
  const identificationModelId = `arena-identification-${dataset.datasetHash.replace('arena-blackbox-dataset-', '').slice(0, 12)}`;

  return {
    id: `nominal-model:${dataset.datasetHash}`,
    sourceObjectId: dataset.objectId,
    sourceDatasetHash: dataset.datasetHash,
    sourceExperimentId: dataset.id,
    sourceVisibility: 'black-box',
    modelType: 'data-driven',
    representation: {
      kind: 'data-driven',
      modelRef: identificationModelId,
      summary: `学生名义模型，来源于 ${dataset.samples.length} 个黑箱实验采样点。`,
    },
    validationMetrics: [
      {
        id: 'data-quality',
        label: '名义模型数据质量',
        value: dataset.summary.dataQuality,
        status: qualityStatus(dataset.summary.dataQuality),
      },
      {
        id: 'input-energy',
        label: '实验输入能量',
        value: dataset.summary.inputEnergy,
        status: 'unknown',
      },
    ],
    createdAt: now,
    notes: '学生名义模型用于工作台绘图、预演和控制器草稿，不代表官方隐藏对象。',
  };
}

function nominalModelId(model: NominalModelArtifact) {
  const representation = model.representation;
  if ('modelRef' in representation) return representation.modelRef;
  return model.id;
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

function activePanelLabels(panelInstances?: WorkbenchPanelInstance[]) {
  return panelInstances
    ?.filter((panel) => panel.enabled)
    .map((panel) => panel.title) ?? [];
}

function isBlackBoxWorkbenchOptionSelected(
  panelInstances: WorkbenchPanelInstance[] | undefined,
  viewId: WorkbenchViewId,
  optionId: string,
) {
  const panels = panelInstances?.filter((panel) => panel.enabled && panel.viewId === viewId) ?? [];
  return panels.some((panel) => !panel.selectedOptions || panel.selectedOptions.includes(optionId));
}

export function BlackBoxIdentificationPanel({
  task,
  initialSubmissions,
  publicationId,
  viewerUserId,
  officialTargetHidden = true,
  panelInstances,
}: BlackBoxIdentificationPanelProps) {
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[]>(initialSubmissions);
  const [signalType, setSignalType] = useState<ArenaBlackBoxSignalType>('step');
  const [amplitude, setAmplitude] = useState('0.8');
  const [duration, setDuration] = useState('8');
  const [sampleTime, setSampleTime] = useState('0.2');
  const [identificationQuality, setIdentificationQuality] = useState('0.82');
  const [experimentCount, setExperimentCount] = useState('6');
  const [controllerGain, setControllerGain] = useState('1.6');
  const [dampingCompensation, setDampingCompensation] = useState('0.72');
  const [energyBudget, setEnergyBudget] = useState('12');
  const [latestDataset, setLatestDataset] = useState<ExperimentDatasetResponse | null>(null);
  const [nominalModel, setNominalModel] = useState<NominalModelArtifact | null>(null);
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
  const viewLabels = activePanelLabels(panelInstances);
  const showExperimentDataset = isBlackBoxWorkbenchOptionSelected(
    panelInstances,
    'experiment-dataset',
    'persisted-experiment-dataset',
  );
  const showIdentificationModel = isBlackBoxWorkbenchOptionSelected(
    panelInstances,
    'identification',
    'student-nominal-model',
  );
  const showNominalResponse = isBlackBoxWorkbenchOptionSelected(
    panelInstances,
    'response-comparison',
    'nominal-model-response',
  );
  const showPreviewResponse = isBlackBoxWorkbenchOptionSelected(
    panelInstances,
    'response-comparison',
    'virtual-preview-response',
  );
  const showMetricSummary = isBlackBoxWorkbenchOptionSelected(
    panelInstances,
    'metric-summary',
    'leaderboard-official-metrics',
  );
  const showModelAndResponse = showIdentificationModel || showNominalResponse || showPreviewResponse;

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
    setNominalModel(null);
    setPreviewRun(null);
    setStatus(`黑箱实验数据集已导入工作台，剩余预算 ${payload.budget.remaining}/${payload.budget.limit}。`);
    void sendArenaCoreEvent('arena_virtual_simulation_import', {
      taskId: task.id,
      datasetHash: payload.dataset.datasetHash,
      budgetRemaining: payload.budget.remaining,
    });
  };

  const saveNominalModel = () => {
    if (!latestDataset) {
      setStatus('请先运行黑箱实验并导入数据集。');
      return;
    }

    const model = buildClientNominalModelFromDataset(latestDataset);
    setNominalModel(model);
    setStatus('学生名义模型已保存，可用于工作台响应对照、控制器草稿和虚拟仿真预演。');
    void sendArenaCoreEvent('arena_identification_model_save', {
      taskId: task.id,
      datasetHash: latestDataset.datasetHash,
      identificationModelId: nominalModelId(model),
      identificationQuality: Number(identificationQuality),
      experimentCount: Number(experimentCount),
    });
  };

  const buildCurrentArtifact = () => {
    if (!latestDataset) {
      throw new Error('请先运行黑箱实验并导入数据集。');
    }
    if (!nominalModel) {
      throw new Error('请先保存学生名义模型。');
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
      identificationModelId: nominalModelId(nominalModel),
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
    setStatus('虚拟仿真预演已完成，该结果仅用于提交前检查，不进入榜单。');
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
    <section className="rounded-lg border border-white/10 bg-slate-950/40 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-cyan-200" />
            <h2 className="text-xl font-semibold text-slate-50">黑箱辨识工作台</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            实验数据来自竞技场持久化服务；学生名义模型只用于工作台分析、预演和控制器草稿。
          </p>
        </div>
        {officialTargetHidden ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            <EyeOff className="h-4 w-4" />
            官方隐藏对象不展示
          </div>
        ) : null}
      </div>

      {viewLabels.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          {viewLabels.map((label) => (
            <span key={label} className="rounded-md border border-white/10 px-2 py-1">{label}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {showExperimentDataset ? (
          <section className="rounded-md border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-200" />
              <h3 className="text-base font-semibold">黑箱实验数据</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="grid gap-1 text-xs text-slate-300">
                实验信号
                <select
                  value={signalType}
                  onChange={(event) => setSignalType(event.target.value as ArenaBlackBoxSignalType)}
                  className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
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
            <button
              type="button"
              onClick={runExperiment}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
            >
              <Radar className="h-4 w-4" />
              运行黑箱实验并导入数据集
            </button>
            {latestDataset ? (
              <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-3 text-xs text-cyan-50">
                数据集 {latestDataset.datasetHash} · {latestDataset.samples.length} 个采样点 · 数据质量 {latestDataset.summary.dataQuality.toFixed(2)}
              </div>
            ) : null}
          </section>
          ) : null}

          {showModelAndResponse ? (
          <section className="rounded-md border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-200" />
              <h3 className="text-base font-semibold">学生名义模型与响应对照</h3>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              名义模型由当前学生拥有的数据集生成，响应图和频域图均标注为名义结果。
            </p>
            {showIdentificationModel ? (
              <button
                type="button"
                onClick={saveNominalModel}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
              >
                <Save className="h-4 w-4" />
                保存学生名义模型
              </button>
            ) : null}
            {nominalModel ? (
              <div className="mt-4 grid gap-2 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                <span>模型编号：{nominalModelId(nominalModel)}</span>
                <span>来源数据集：{nominalModel.sourceDatasetHash}</span>
                <span>{nominalModel.notes}</span>
              </div>
            ) : null}
          </section>
          ) : null}
          {!showExperimentDataset && !showModelAndResponse ? (
            <section className="rounded-md border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              当前视图配置未启用黑箱实验或名义模型视图。
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-white/10 bg-slate-900/60 p-4">
            <h3 className="text-base font-semibold">黑箱控制器草稿</h3>
            <div className="mt-4 grid gap-3">
              <NumberInput label="辨识质量" value={identificationQuality} onChange={setIdentificationQuality} />
              <NumberInput label="实验次数" value={experimentCount} onChange={setExperimentCount} />
              <NumberInput label="控制增益" value={controllerGain} onChange={setControllerGain} />
              <NumberInput label="阻尼补偿" value={dampingCompensation} onChange={setDampingCompensation} />
              <NumberInput label="能耗预算" value={energyBudget} onChange={setEnergyBudget} />
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={applyControllerPreview}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
              >
                <Radar className="h-4 w-4" />
                导入虚拟仿真预演
              </button>
              <button
                type="button"
                onClick={submitController}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-200"
              >
                <Send className="h-4 w-4" />
                提交黑箱评测
              </button>
            </div>
            {status ? <div className="mt-3 text-xs text-slate-300">{status}</div> : null}
          </section>

          {previewRun && showPreviewResponse ? (
            <section className="rounded-md border border-cyan-300/20 bg-cyan-950/20 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-cyan-100">虚拟仿真预演</span>
                <span className="font-semibold text-cyan-200">误差 {previewRun.summary.trackingError.toFixed(3)}</span>
              </div>
              <div className="mt-2 text-xs text-cyan-50">
                最大偏差 {previewRun.summary.maxDeviation.toFixed(3)} · 能耗 {previewRun.summary.controlEnergy.toFixed(2)} · 安全违反 {previewRun.summary.safetyViolations}
              </div>
            </section>
          ) : null}

          {latest ? (
            <ArenaPersonalFeedback
              latest={latest}
              previousSubmissions={personalSubmissions.slice(0, -1)}
              mode="black-box"
              officialOnlyMetricIds={task.primaryMetrics.filter((metricId) => /hidden/i.test(metricId))}
            />
          ) : null}

          {showMetricSummary ? (
          <section className="rounded-md border border-white/10 bg-slate-900/60 p-4">
            <h3 className="text-base font-semibold">黑箱榜单摘录</h3>
            <div className="mt-3 grid gap-2">
              {leaderboard.entries.slice(0, 4).map((entry) => (
                <div key={entry.submissionId} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
                  <span className="text-slate-100">#{entry.rank} {entry.studentLabel}</span>
                  <span className="text-cyan-200">{entry.score.toFixed(1)}</span>
                </div>
              ))}
              {leaderboard.entries.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
                  暂无真实黑箱提交记录。
                </div>
              ) : null}
            </div>
          </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

export function BlackBoxIdentificationPreset({
  session,
  panelInstances,
}: {
  session: WorkbenchSessionContext;
  panelInstances?: WorkbenchPanelInstance[];
}) {
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[] | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | undefined>(undefined);
  const task = 'task' in session ? session.task : null;
  const publicationId = 'publicationId' in session ? session.publicationId : undefined;
  const officialTargetHidden = Boolean(session.officialTarget?.hiddenTarget);

  useEffect(() => {
    let cancelled = false;
    setSubmissions(null);
    setViewerUserId(undefined);

    if (!task) {
      setSubmissions([]);
      return () => {
        cancelled = true;
      };
    }

    const submissionParams = new URLSearchParams({ taskId: task.id });
    if (publicationId) {
      submissionParams.set('publicationId', publicationId);
    }

    fetch(`/api/arena/submissions?${submissionParams.toString()}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json() as {
          submissions?: ArenaSubmissionRecord[];
          viewerUserId?: string;
        };
        if (!cancelled) {
          setSubmissions(response.ok ? payload.submissions ?? [] : []);
          setViewerUserId(response.ok ? payload.viewerUserId : undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
          setViewerUserId(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicationId, task]);

  const incompatibleMessage = useMemo(() => {
    if (!task) return '黑箱辨识预设需要绑定竞技场任务。';
    if (!('recommendedWorkspaceMode' in session) || session.recommendedWorkspaceMode !== 'black-box-identification') {
      return '当前任务不属于黑箱辨识工作台。';
    }
    return null;
  }, [session, task]);

  if (incompatibleMessage) {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        {incompatibleMessage}
      </section>
    );
  }

  if (!task || submissions === null) {
    return (
      <section className="rounded-lg border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-300">
        正在加载黑箱工作台数据...
      </section>
    );
  }

  return (
    <BlackBoxIdentificationPanel
      key={`${task.id}:${publicationId ?? 'open'}`}
      task={task}
      initialSubmissions={submissions}
      publicationId={publicationId}
      viewerUserId={viewerUserId}
      officialTargetHidden={officialTargetHidden}
      panelInstances={panelInstances}
    />
  );
}

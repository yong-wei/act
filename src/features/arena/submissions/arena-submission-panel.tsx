'use client';

import { useState } from 'react';
import { BarChart3, PlayCircle, Send } from 'lucide-react';

import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import type { ArenaSubmissionRecord } from './submission-service';
import type { ChallengeTask, LeaderboardType } from '../types';
import {
  buildControllerArtifactFromParams,
  getEvaluableControllerMethods,
  type EvaluableControllerMethod,
} from './controller-artifact-builder';
import {
  buildArenaWorkbenchPreview,
  type ArenaWorkbenchPreview,
} from './workbench-preview';
import { sendArenaCoreEvent } from '../telemetry';

type PreviewLeaderboardType = Exclude<LeaderboardType, 'class' | 'season'>;

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
  const [gain, setGain] = useState('2');
  const [zero, setZero] = useState('1');
  const [pole, setPole] = useState('4');
  const [prefilterGain, setPrefilterGain] = useState('0.9');
  const [forwardGain, setForwardGain] = useState('2.2');
  const [localFeedbackGain, setLocalFeedbackGain] = useState('0.7');
  const [disturbanceCompensation, setDisturbanceCompensation] = useState('0.4');
  const [predictionHorizon, setPredictionHorizon] = useState('18');
  const [controlHorizon, setControlHorizon] = useState('5');
  const [outputWeight, setOutputWeight] = useState('1.4');
  const [controlWeight, setControlWeight] = useState('0.32');
  const [terminalWeight, setTerminalWeight] = useState('2');
  const [inputLimit, setInputLimit] = useState('4.5');
  const [sampleTime, setSampleTime] = useState('0.1');
  const [speedWeight, setSpeedWeight] = useState('1.2');
  const [energyWeight, setEnergyWeight] = useState('0.7');
  const [robustnessWeight, setRobustnessWeight] = useState('1.4');
  const [overshootWeight, setOvershootWeight] = useState('0.9');
  const [searchBudget, setSearchBudget] = useState('80');
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArenaWorkbenchPreview | null>(null);
  const evaluableMethods = getEvaluableControllerMethods(task);
  const [controllerMethod, setControllerMethod] = useState<EvaluableControllerMethod>(evaluableMethods[0] ?? 'pid');
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

  const currentValues = () => controllerValues(controllerMethod, {
    kp,
    ki,
    kd,
    gain,
    zero,
    pole,
    prefilterGain,
    forwardGain,
    localFeedbackGain,
    disturbanceCompensation,
    predictionHorizon,
    controlHorizon,
    outputWeight,
    controlWeight,
    terminalWeight,
    inputLimit,
    sampleTime,
    speedWeight,
    energyWeight,
    robustnessWeight,
    overshootWeight,
    searchBudget,
  });

  const runLocalPreview = () => {
    if (!evaluableMethods.includes(controllerMethod)) {
      setStatus('当前任务没有可由白箱工作台预览的控制器方法。');
      return;
    }
    try {
      const nextPreview = buildArenaWorkbenchPreview({
        task,
        method: controllerMethod,
        values: currentValues(),
        previousSubmission: latest,
      });
      setPreview(nextPreview);
      setStatus('工作台仿真已完成，可与最近一次真实提交比较。');
      void sendArenaCoreEvent('arena_simulation_run', {
        taskId: task.id,
        method: controllerMethod,
        previewMode: 'whitebox-workbench',
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '工作台仿真失败');
    }
  };

  const submitController = async () => {
    if (!evaluableMethods.includes(controllerMethod)) {
      setStatus('当前任务没有可由白箱评测器直接评测的控制器方法。');
      return;
    }
    setStatus('正在提交官方评测...');
    let artifact;
    try {
      artifact = buildControllerArtifactFromParams({
        task,
        method: controllerMethod,
        values: currentValues(),
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '控制器参数无效');
      return;
    }
    void sendArenaCoreEvent('arena_controller_save', {
      taskId: task.id,
      method: controllerMethod,
    });
    void sendArenaCoreEvent('arena_simulation_run', {
      taskId: task.id,
      method: controllerMethod,
    });
    void sendArenaCoreEvent('arena_submit', {
      taskId: task.id,
      method: controllerMethod,
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
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">提交与排行榜预览</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-subtle">
        提交控制器参数后，平台会执行官方评测并写入真实排行榜记录。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {evaluableMethods.map((allowedMethod) => (
          <button
            key={allowedMethod}
            type="button"
            onClick={() => setControllerMethod(allowedMethod)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              controllerMethod === allowedMethod
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/70 bg-card/55 text-subtle hover:text-foreground'
            }`}
          >
            {methodLabel(allowedMethod)}
          </button>
        ))}
      </div>
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
      <ControllerParamInputs
        method={controllerMethod}
        values={{
          kp,
          ki,
          kd,
          gain,
          zero,
          pole,
          prefilterGain,
          forwardGain,
          localFeedbackGain,
          disturbanceCompensation,
          predictionHorizon,
          controlHorizon,
          outputWeight,
          controlWeight,
          terminalWeight,
          inputLimit,
          sampleTime,
          speedWeight,
          energyWeight,
          robustnessWeight,
          overshootWeight,
          searchBudget,
        }}
        setters={{
          setKp,
          setKi,
          setKd,
          setGain,
          setZero,
          setPole,
          setPrefilterGain,
          setForwardGain,
          setLocalFeedbackGain,
          setDisturbanceCompensation,
          setPredictionHorizon,
          setControlHorizon,
          setOutputWeight,
          setControlWeight,
          setTerminalWeight,
          setInputLimit,
          setSampleTime,
          setSpeedWeight,
          setEnergyWeight,
          setRobustnessWeight,
          setOvershootWeight,
          setSearchBudget,
        }}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={runLocalPreview}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <PlayCircle className="h-4 w-4" />
          运行工作台仿真
        </button>
        <button
          type="button"
          onClick={submitController}
          className="cta-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
        >
          <Send className="h-4 w-4" />
          提交{methodLabel(controllerMethod)}控制器
        </button>
      </div>
      {status ? <div className="mt-3 text-xs text-subtle">{status}</div> : null}
      {preview ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-card/55 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-subtle">工作台仿真得分</span>
            <span className="font-semibold text-primary">
              {preview.evaluation.score.toFixed(1)} · {preview.evaluation.valid ? '达标' : '未达标'}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {task.primaryMetrics.map((metricId) => {
              const metricDelta = preview.comparison?.metricDeltas.find((delta) => delta.metricId === metricId);
              return (
                <div key={metricId} className="grid gap-1 rounded-md border border-border/60 bg-background/45 px-2 py-1 text-xs sm:grid-cols-[1fr_auto]">
                  <span className="text-subtle">{metricId}</span>
                  <span className="text-right text-foreground">
                    {formatMetricValue(preview.evaluation.metrics[metricId])}
                    {metricDelta ? (
                      <span className="ml-2 text-muted-foreground">{formatMetricDelta(metricDelta.delta)}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-subtle">
            方案比较：{preview.comparison ? formatScoreDelta(preview.comparison.scoreDelta) : '暂无真实提交可比较'}
          </div>
        </div>
      ) : null}
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
    'optimized-pid': '优化调参',
    'composite-compensation': '复合校正',
    mpc: 'MPC',
    'black-box-control': '黑箱控制',
    'code-controller': '代码控制器',
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

function formatMetricValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '暂无';
}

function formatMetricDelta(value: number | null): string {
  if (value === null) return '无可比数据';
  const prefix = value > 0 ? '+' : '';
  return `较上次 ${prefix}${value.toFixed(3)}`;
}

function formatScoreDelta(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `较最近真实提交 ${prefix}${value.toFixed(1)} 分`;
}

interface ControllerInputValues {
  kp: string;
  ki: string;
  kd: string;
  gain: string;
  zero: string;
  pole: string;
  prefilterGain: string;
  forwardGain: string;
  localFeedbackGain: string;
  disturbanceCompensation: string;
  predictionHorizon: string;
  controlHorizon: string;
  outputWeight: string;
  controlWeight: string;
  terminalWeight: string;
  inputLimit: string;
  sampleTime: string;
  speedWeight: string;
  energyWeight: string;
  robustnessWeight: string;
  overshootWeight: string;
  searchBudget: string;
}

interface ControllerInputSetters {
  setKp: (value: string) => void;
  setKi: (value: string) => void;
  setKd: (value: string) => void;
  setGain: (value: string) => void;
  setZero: (value: string) => void;
  setPole: (value: string) => void;
  setPrefilterGain: (value: string) => void;
  setForwardGain: (value: string) => void;
  setLocalFeedbackGain: (value: string) => void;
  setDisturbanceCompensation: (value: string) => void;
  setPredictionHorizon: (value: string) => void;
  setControlHorizon: (value: string) => void;
  setOutputWeight: (value: string) => void;
  setControlWeight: (value: string) => void;
  setTerminalWeight: (value: string) => void;
  setInputLimit: (value: string) => void;
  setSampleTime: (value: string) => void;
  setSpeedWeight: (value: string) => void;
  setEnergyWeight: (value: string) => void;
  setRobustnessWeight: (value: string) => void;
  setOvershootWeight: (value: string) => void;
  setSearchBudget: (value: string) => void;
}

function controllerValues(
  method: EvaluableControllerMethod,
  values: ControllerInputValues,
): Record<string, string> {
  if (method === 'pid') {
    return { kp: values.kp, ki: values.ki, kd: values.kd };
  }
  if (method === 'serial-compensator') {
    return { gain: values.gain, zero: values.zero, pole: values.pole };
  }
  if (method === 'mpc') {
    return {
      predictionHorizon: values.predictionHorizon,
      controlHorizon: values.controlHorizon,
      outputWeight: values.outputWeight,
      controlWeight: values.controlWeight,
      terminalWeight: values.terminalWeight,
      inputLimit: values.inputLimit,
      sampleTime: values.sampleTime,
    };
  }
  if (method === 'optimized-pid') {
    return {
      speedWeight: values.speedWeight,
      energyWeight: values.energyWeight,
      robustnessWeight: values.robustnessWeight,
      overshootWeight: values.overshootWeight,
      searchBudget: values.searchBudget,
    };
  }
  return {
    prefilterGain: values.prefilterGain,
    forwardGain: values.forwardGain,
    localFeedbackGain: values.localFeedbackGain,
    disturbanceCompensation: values.disturbanceCompensation,
  };
}

function ControllerParamInputs({
  method,
  values,
  setters,
}: {
  method: EvaluableControllerMethod;
  values: ControllerInputValues;
  setters: ControllerInputSetters;
}) {
  if (method === 'pid') {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberInput label="Kp" value={values.kp} onChange={setters.setKp} />
        <NumberInput label="Ki" value={values.ki} onChange={setters.setKi} />
        <NumberInput label="Kd" value={values.kd} onChange={setters.setKd} />
      </div>
    );
  }

  if (method === 'serial-compensator') {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberInput label="Gain" value={values.gain} onChange={setters.setGain} />
        <NumberInput label="Zero" value={values.zero} onChange={setters.setZero} />
        <NumberInput label="Pole" value={values.pole} onChange={setters.setPole} />
      </div>
    );
  }

  if (method === 'mpc') {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <NumberInput label="Prediction horizon" value={values.predictionHorizon} onChange={setters.setPredictionHorizon} />
        <NumberInput label="Control horizon" value={values.controlHorizon} onChange={setters.setControlHorizon} />
        <NumberInput label="Output weight" value={values.outputWeight} onChange={setters.setOutputWeight} />
        <NumberInput label="Control weight" value={values.controlWeight} onChange={setters.setControlWeight} />
        <NumberInput label="Terminal weight" value={values.terminalWeight} onChange={setters.setTerminalWeight} />
        <NumberInput label="Input limit" value={values.inputLimit} onChange={setters.setInputLimit} />
        <NumberInput label="Sample time" value={values.sampleTime} onChange={setters.setSampleTime} />
      </div>
    );
  }

  if (method === 'optimized-pid') {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <NumberInput label="Speed weight" value={values.speedWeight} onChange={setters.setSpeedWeight} />
        <NumberInput label="Energy weight" value={values.energyWeight} onChange={setters.setEnergyWeight} />
        <NumberInput label="Robustness" value={values.robustnessWeight} onChange={setters.setRobustnessWeight} />
        <NumberInput label="Overshoot" value={values.overshootWeight} onChange={setters.setOvershootWeight} />
        <NumberInput label="Search budget" value={values.searchBudget} onChange={setters.setSearchBudget} />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-4">
      <NumberInput label="Prefilter" value={values.prefilterGain} onChange={setters.setPrefilterGain} />
      <NumberInput label="Forward" value={values.forwardGain} onChange={setters.setForwardGain} />
      <NumberInput label="Local feedback" value={values.localFeedbackGain} onChange={setters.setLocalFeedbackGain} />
      <NumberInput
        label="Disturbance"
        value={values.disturbanceCompensation}
        onChange={setters.setDisturbanceCompensation}
      />
    </div>
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

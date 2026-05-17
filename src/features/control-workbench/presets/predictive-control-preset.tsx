'use client';

import { useMemo, useState } from 'react';
import { Activity, BarChart3, Gauge, SlidersHorizontal } from 'lucide-react';

import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';
import type { WorkbenchSessionContext } from '../types';
import type { WorkbenchPanelInstance } from '../views';
import {
  buildPredictiveControlArtifactFromDraft,
  DEFAULT_PREDICTIVE_CONTROL_DRAFT,
  PREDICTIVE_OFFICIAL_ONLY_METRICS,
  type PredictiveControlDraft,
  type PredictiveControlMethod,
} from './predictive-control-draft';

type PredictiveDraftField = keyof PredictiveControlDraft;

const mpcParameterLabels: Array<[PredictiveDraftField, string, string]> = [
  ['predictionHorizon', '预测时域', '模型向前预测的离散步数。'],
  ['controlHorizon', '控制时域', '优化中直接调整控制量的步数。'],
  ['outputWeight', '输出误差权重', '提高跟踪误差在目标函数中的权重。'],
  ['controlWeight', '控制量权重', '提高控制动作代价，抑制过大输入。'],
  ['terminalWeight', '终端权重', '提高预测窗口末端状态的约束倾向。'],
  ['inputLimit', '输入限幅', '记录第一版模板的控制输入边界。'],
  ['sampleTime', '采样时间', '离散预测模板采用的采样周期。'],
];

const optimizedPidParameterLabels: Array<[PredictiveDraftField, string, string]> = [
  ['speedWeight', '速度权重', '强调快速响应与调节时间。'],
  ['energyWeight', '能量权重', '强调控制量消耗与执行代价。'],
  ['robustnessWeight', '鲁棒权重', '强调参数扰动下的稳定裕量。'],
  ['overshootWeight', '超调权重', '强调峰值约束与过渡过程平顺性。'],
  ['searchBudget', '搜索预算', '限制优化模板的搜索轮次。'],
];

function formatDraftNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : value;
}

function resolvePredictiveMethod(session: WorkbenchSessionContext): PredictiveControlMethod | null {
  if (session.allowedMethods.includes('mpc')) return 'mpc';
  if (session.allowedMethods.includes('optimized-pid')) return 'optimized-pid';
  return null;
}

function selectedPanelLabels(panelInstances?: WorkbenchPanelInstance[]) {
  return panelInstances
    ?.filter((panel) => panel.enabled)
    .map((panel) => panel.title) ?? [];
}

function NumberInput({
  field,
  label,
  description,
  value,
  onChange,
}: {
  field: PredictiveDraftField;
  label: string;
  description: string;
  value: string;
  onChange: (field: PredictiveDraftField, value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        inputMode="decimal"
        className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
      />
      <span className="text-xs leading-5 text-slate-500">{description}</span>
    </label>
  );
}

function PredictiveParameterPanel({
  method,
  draft,
  onChange,
}: {
  method: PredictiveControlMethod;
  draft: PredictiveControlDraft;
  onChange: (field: PredictiveDraftField, value: string) => void;
}) {
  const parameters = method === 'mpc' ? mpcParameterLabels : optimizedPidParameterLabels;
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/40 p-5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
        <h3 className="text-base font-semibold text-slate-100">
          {method === 'mpc' ? '有界线性 MPC 参数' : '优化辅助 PID 权重'}
        </h3>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {parameters.map(([field, label, description]) => (
          <NumberInput
            key={field}
            field={field}
            label={label}
            description={description}
            value={draft[field]}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

export function PredictiveControlPreset({
  session,
  panelInstances,
}: {
  session: WorkbenchSessionContext;
  panelInstances?: WorkbenchPanelInstance[];
}) {
  const [draft, setDraft] = useState<PredictiveControlDraft>(DEFAULT_PREDICTIVE_CONTROL_DRAFT);
  const activeMethod = resolvePredictiveMethod(session);
  const viewLabels = selectedPanelLabels(panelInstances);
  const artifactPreview = useMemo(() => {
    if (!activeMethod || !('task' in session)) return null;
    try {
      return buildPredictiveControlArtifactFromDraft({
        task: session.task,
        method: activeMethod,
        draft,
      });
    } catch {
      return null;
    }
  }, [activeMethod, draft, session]);

  const updateDraft = (field: PredictiveDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  if (!('taskId' in session) || !('recommendedWorkspaceMode' in session)) {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="text-xs font-medium text-amber-200">工作台模式不匹配</p>
        <h2 className="mt-2 text-lg font-semibold text-amber-50">当前上下文不能使用预测控制工作台</h2>
        <p className="mt-2 leading-6">预测控制预设只服务于预测控制类竞技场挑战。</p>
      </section>
    );
  }

  if (!activeMethod) {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="text-xs font-medium text-amber-200">方法不匹配</p>
        <h2 className="mt-2 text-lg font-semibold text-amber-50">当前任务没有可用的预测控制模板</h2>
        <p className="mt-2 leading-6">该预设仅支持 MPC 与优化辅助 PID。</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-100">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-cyan-200">参数化模板评测</p>
            <h2 className="text-lg font-semibold text-slate-50">
              {activeMethod === 'mpc' ? '有界线性模型预测控制' : '优化辅助 PID 模板'}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          当前版本提供可复现的有界模板参数，并通过统一提交通道进入官方隐藏场景评测。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <PredictiveParameterPanel method={activeMethod} draft={draft} onChange={updateDraft} />

        <section className="rounded-lg border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-200" />
            <h3 className="text-base font-semibold text-slate-100">模板摘要</h3>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            {(activeMethod === 'mpc' ? mpcParameterLabels : optimizedPidParameterLabels).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-slate-900/60 px-3 py-2">
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-100">{formatDraftNumber(draft[field])}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-md border border-white/10 bg-slate-900/60 p-3 text-xs leading-5 text-slate-400">
            <p>控制器方法：{artifactPreview?.method === 'mpc' ? 'MPC' : artifactPreview?.method === 'optimized-pid' ? '优化 PID' : '参数未形成有效控制器数据'}</p>
            {viewLabels.length ? <p>当前视图：{viewLabels.join('、')}</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-white/10 bg-slate-950/40 p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-200" />
          <h3 className="text-base font-semibold text-slate-100">官方指标说明</h3>
        </div>
        <div className="mt-3 grid gap-2 text-sm">
          {PREDICTIVE_OFFICIAL_ONLY_METRICS.map((metric) => (
            <div key={metric.id} className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-2">
              <p className="font-medium text-slate-100">{metric.label}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
            </div>
          ))}
        </div>
      </section>

      <ArenaWorkbenchSubmissionMount
        workspaceMode={session.recommendedWorkspaceMode}
        className=""
        predictiveDraft={draft}
        onPredictiveDraftChange={(nextDraft) => setDraft(nextDraft)}
        officialOnlyMetricIds={PREDICTIVE_OFFICIAL_ONLY_METRICS.map((metric) => metric.id)}
        evaluationModeLabel="预测控制模板评测"
        preferredControllerMethod={activeMethod}
      />
    </section>
  );
}

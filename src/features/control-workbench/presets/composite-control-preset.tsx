'use client';

import { useMemo, useState } from 'react';
import { Gauge, Network, SlidersHorizontal } from 'lucide-react';

import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';
import type { WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';
import {
  buildCompositeCompensationArtifactFromDraft,
  DEFAULT_COMPOSITE_CONTROL_DRAFT,
  type CompositeControlDraft,
} from './composite-control-draft';

type CompositePresetViewConfigs = Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;

const parameterLabels: Record<keyof CompositeControlDraft, string> = {
  prefilterGain: '前置滤波增益',
  forwardGain: '前馈通道增益',
  localFeedbackGain: '局部反馈增益',
  disturbanceCompensation: '扰动补偿强度',
  controlLimit: '控制量限幅',
};

const parameterDescriptions: Record<keyof CompositeControlDraft, string> = {
  prefilterGain: '调整参考输入进入主通道前的幅值。',
  forwardGain: '设置主前向通道的模板增益。',
  localFeedbackGain: '提高局部反馈对中间状态偏差的抑制作用。',
  disturbanceCompensation: '设置扰动估计与抵消的模板强度。',
  controlLimit: '记录第一版模板的控制量约束。',
};

function formatDraftNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : value;
}

function NumberInput({
  field,
  value,
  onChange,
}: {
  field: keyof CompositeControlDraft;
  value: string;
  onChange: (field: keyof CompositeControlDraft, value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{parameterLabels[field]}</span>
      <input
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        inputMode="decimal"
        className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
      />
      <span className="text-xs leading-5 text-slate-500">{parameterDescriptions[field]}</span>
    </label>
  );
}

function selectedViewLabels(viewConfigs?: CompositePresetViewConfigs) {
  if (!viewConfigs) return [];
  return Object.values(viewConfigs)
    .filter((config): config is WorkbenchViewConfig => Boolean(config?.enabled))
    .map((config) => config.title);
}

export function CompositeControlPreset({
  session,
  viewConfigs,
}: {
  session: WorkbenchSessionContext;
  viewConfigs?: CompositePresetViewConfigs;
}) {
  const [draft, setDraft] = useState<CompositeControlDraft>(DEFAULT_COMPOSITE_CONTROL_DRAFT);
  const viewLabels = selectedViewLabels(viewConfigs);
  const artifactPreview = useMemo(() => {
    if (!('task' in session)) return null;
    try {
      return buildCompositeCompensationArtifactFromDraft({
        task: session.task,
        draft,
      });
    } catch {
      return null;
    }
  }, [draft, session]);

  const updateDraft = (field: keyof CompositeControlDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  if (!('taskId' in session) || !('recommendedWorkspaceMode' in session)) {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="text-xs font-medium text-amber-200">工作台模式不匹配</p>
        <h2 className="mt-2 text-lg font-semibold text-amber-50">当前上下文不能使用复合校正工作台</h2>
        <p className="mt-2 leading-6">复合校正预设只服务于框图工作台类型的竞技场挑战。</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-100">
            <Network className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-cyan-200">参数化模板评测</p>
            <h2 className="text-lg font-semibold text-slate-50">复合校正结构</h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          当前版本固定为前置滤波、前馈通道、局部反馈和扰动补偿的复合结构，官方提交生成复合校正控制器数据。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
            <h3 className="text-base font-semibold text-slate-100">校正方法参数</h3>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(Object.keys(parameterLabels) as Array<keyof CompositeControlDraft>).map((field) => (
              <NumberInput
                key={field}
                field={field}
                value={draft[field]}
                onChange={updateDraft}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-200" />
            <h3 className="text-base font-semibold text-slate-100">结构摘要</h3>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            {(Object.keys(parameterLabels) as Array<keyof CompositeControlDraft>).map((field) => (
              <div key={field} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-slate-900/60 px-3 py-2">
                <dt className="text-slate-400">{parameterLabels[field]}</dt>
                <dd className="font-medium text-slate-100">{formatDraftNumber(draft[field])}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-md border border-white/10 bg-slate-900/60 p-3 text-xs leading-5 text-slate-400">
            <p>模板结构：前置滤波 + 前馈通道 + 局部反馈 + 扰动补偿</p>
            <p>控制器方法：{artifactPreview?.method === 'composite-compensation' ? '复合校正' : '参数未形成有效控制器数据'}</p>
            {viewLabels.length ? <p>当前视图：{viewLabels.join('、')}</p> : null}
          </div>
        </section>
      </div>

      <ArenaWorkbenchSubmissionMount
        workspaceMode={session.recommendedWorkspaceMode}
        className=""
        compositeDraft={draft}
        onCompositeDraftChange={(nextDraft) => setDraft(nextDraft)}
        evaluationModeLabel="参数化模板评测"
        preferredControllerMethod="composite-compensation"
      />
    </section>
  );
}

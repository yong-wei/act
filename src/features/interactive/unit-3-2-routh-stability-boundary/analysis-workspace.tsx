'use client';

import { useMemo, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';

import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import {
  MagnitudePanel,
  RootLocusPanel,
  StepResponsePanel,
} from '@/resources/control-system/charts/control-analysis-panels';
import type { WorkspaceParameterChange } from './workspace';

type UNIT_3_2AnalysisStepId = 'step-06' | 'step-09' | 'step-10';

const TYPICAL_K_VALUES = [-2, 0, 4, 18, 22] as const;
const BASE_DENOMINATOR = [1, 5, 9, 7, 2] as const;

function buildRootLocusRequest(gain: number): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: 'unit-3-2-root-locus',
    plant: {
      numerator: [1, 1],
      denominator: [...BASE_DENOMINATOR],
      coefficientOrder: 'descending',
      label: 'L(s)=K(s+1)/P(s)',
    },
    structures: [{ kind: 'gain', enabled: true, params: { k: gain }, label: 'K' }],
    outputs: ['root_locus'],
    timeRange: { start: 0, end: 12, samples: 240 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
    rootLocus: { minGain: 0, maxGain: 24, samples: 160, currentGain: gain },
  };
}

function buildClosedLoopRequest(
  gain: number,
  outputs: ControlAnalysisRequest['outputs'],
  caseId: string,
): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId,
    plant: {
      numerator: [gain + 2],
      denominator: [1, 5, 9, 7 + gain, 2 + gain],
      coefficientOrder: 'descending',
      label: 'T(s)=\\frac{k+2}{D(s,k)}',
    },
    structures: [],
    outputs,
    timeRange: { start: 0, end: 16, samples: 320 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 320 },
    rootLocus: { minGain: 0, maxGain: 24, samples: 2, currentGain: gain },
  };
}

function describeIntervalStatus(gain: number) {
  if (gain < -2) {
    return {
      title: '稳定区外',
      tone: 'premium-tone-rose',
      body: '常数项已经翻到负侧，闭环极点不可能全部留在左半平面。',
    };
  }
  if (gain === -2) {
    return {
      title: '边界点：原点根',
      tone: 'premium-tone-amber',
      body: '此时闭环特征方程出现原点根，系统刚好触到稳定底线。',
    };
  }
  if (gain < 18) {
    return {
      title: '稳定区间',
      tone: 'premium-tone-emerald',
      body: '当前满足 -2 < k < 18，第一列全正，对应全部极点仍在左半平面。',
    };
  }
  if (gain === 18) {
    return {
      title: '边界点：纯虚根',
      tone: 'premium-tone-amber',
      body: '此时共轭根压到虚轴上，已经进入纯虚根边界。',
    };
  }
  return {
    title: '稳定区外',
    tone: 'premium-tone-rose',
    body: '参数越过 k=18 后，共轭根穿入右半平面，系统失稳。',
  };
}

function AnalysisControls({
  gain,
  onGainChange,
  onWorkspaceParameterChange,
}: {
  gain: number;
  onGainChange: (nextValue: number) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const status = describeIntervalStatus(gain);

  return (
    <div className="grid gap-4">
      <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">参数控件</div>
        <div className="premium-lesson-muted mt-2 text-sm">下方滑块直接驱动根轨迹与响应面板，典型值按钮用于快速回到关键边界与代表点。</div>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>当前参数</span>
            <span className="font-medium">k = {gain.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={-4}
            max={24}
            step={0.5}
            value={gain}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onGainChange(nextValue);
              onWorkspaceParameterChange?.({ key: 'gain', value: nextValue, source: 'input' });
            }}
            className="mt-3 w-full accent-cyan-500"
          />
        </div>
        <div className="mt-4">
          <div className="premium-lesson-title text-sm font-medium">典型值</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TYPICAL_K_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  onGainChange(value);
                  onWorkspaceParameterChange?.({ key: 'gain', value, source: 'button' });
                }}
                className={`premium-lesson-control ${gain === value ? 'ring-2 ring-cyan-400' : ''}`}
              >
                {`k=${value}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`premium-lesson-tone-block ${status.tone}`}>
        <div className="premium-lesson-title text-sm font-medium">区间状态</div>
        <div className="mt-2 text-sm font-medium">{status.title}</div>
        <div className="mt-2 text-sm leading-7">{status.body}</div>
      </div>

      <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">当前分析对象</div>
        <div className="mt-3 text-sm [&_.katex-display]:m-0">
          <BlockMath math={`D(s,k)=s^4+5s^3+9s^2+(${(7 + gain).toFixed(1).replace(/\.0$/, '')})s+${(2 + gain)
            .toFixed(1)
            .replace(/\.0$/, '')}`} />
        </div>
      </div>
    </div>
  );
}

export function UNIT_3_2DynamicAnalysisPanel({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: UNIT_3_2AnalysisStepId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return (
    <UNIT_3_2DynamicAnalysisPanelContent
      key={stepId}
      stepId={stepId}
      onWorkspaceParameterChange={onWorkspaceParameterChange}
    />
  );
}

function UNIT_3_2DynamicAnalysisPanelContent({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: UNIT_3_2AnalysisStepId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [gain, setGain] = useState(4);

  const rootLocusRequest = useMemo(() => buildRootLocusRequest(gain), [gain]);
  const responseRequest = useMemo(() => {
    if (stepId === 'step-09') {
      return buildClosedLoopRequest(gain, ['step_response'], 'unit-3-2-time-response');
    }
    return buildClosedLoopRequest(gain, ['magnitude', 'phase'], 'unit-3-2-frequency-response');
  }, [gain, stepId]);

  const rootLocusState = useControlEngine(rootLocusRequest);
  const responseState = useControlEngine(responseRequest);

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-base font-semibold">
        {stepId === 'step-06' ? '边界点复平面分析' : stepId === 'step-09' ? '时域响应对照分析' : '频域迹象对照分析'}
      </div>
      <div className="premium-lesson-muted mt-2 text-sm">
        先用复平面位置确认极点结构，再结合当前页面读取参数状态、时域响应或幅频迹象。
      </div>

      {stepId === 'step-06' ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">根轨迹</div>
            <div className="premium-lesson-muted mt-2 text-sm">
              固定对象是 <InlineMath math={'P(s)=s^4+5s^3+9s^2+7s+2'} />，增益项通过 <InlineMath math={'k(s+1)'} /> 进入闭环特征方程。
            </div>
            <div className="mt-4">
              {rootLocusState.result ? (
                <RootLocusPanel result={rootLocusState.result} caseId={rootLocusRequest.caseId} />
              ) : (
                <div className="premium-lesson-tone-block premium-tone-amber text-sm">根轨迹正在计算。</div>
              )}
            </div>
          </div>
          <AnalysisControls gain={gain} onGainChange={setGain} onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">根轨迹</div>
              <div className="mt-4">
                {rootLocusState.result ? (
                  <RootLocusPanel result={rootLocusState.result} caseId={rootLocusRequest.caseId} />
                ) : (
                  <div className="premium-lesson-tone-block premium-tone-amber text-sm">根轨迹正在计算。</div>
                )}
              </div>
            </div>

            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{stepId === 'step-09' ? '时域响应' : '幅频特性'}</div>
              <div className="mt-4">
                {responseState.result ? (
                  stepId === 'step-09' ? (
                    <StepResponsePanel result={responseState.result} caseId={responseRequest.caseId} />
                  ) : (
                    <MagnitudePanel result={responseState.result} caseId={responseRequest.caseId} />
                  )
                ) : (
                  <div className="premium-lesson-tone-block premium-tone-amber text-sm">
                    {stepId === 'step-09' ? '时域响应正在计算。' : '幅频特性正在计算。'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <AnalysisControls gain={gain} onGainChange={setGain} onWorkspaceParameterChange={onWorkspaceParameterChange} />
          </div>
        </>
      )}
    </section>
  );
}

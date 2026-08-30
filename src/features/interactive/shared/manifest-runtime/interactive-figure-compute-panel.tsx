'use client';

import { useState } from 'react';

import type {
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';
import { asRecord, blockFor, stringField, titleFromModule } from './manifest-payload-fields';
import type { ManifestComputePanelSubmission } from './plugins/plugin-contract';

type InteractiveFigureKind = 'drag_pole_s_plane' | 'three_ships_case';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function interactiveFigureSpecKey(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const block = asRecord(blockFor(step, module.payload));
  return stringField(module.payload, ['spec_key', 'specKey'])
    || stringField(block, ['spec_key', 'specKey']);
}

function isInteractiveFigureKind(value: string): value is InteractiveFigureKind {
  return value === 'drag_pole_s_plane' || value === 'three_ships_case';
}
function svgPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function responsePoints({
  sigma,
  omega,
  mode,
  width,
  height,
  timeScale = 1,
}: {
  sigma: number;
  omega: number;
  mode: 'conjugate_pair' | 'single_real';
  width: number;
  height: number;
  timeScale?: number;
}) {
  const points: Array<{ x: number; raw: number }> = [];
  const horizon = 8 / Math.max(1, timeScale);
  for (let index = 0; index <= 96; index += 1) {
    const t = (index / 96) * horizon;
    const envelope = Math.exp(sigma * t);
    const raw = mode === 'single_real'
      ? 1 - envelope
      : 1 - envelope * Math.cos(Math.max(0.05, omega) * t);
    points.push({ x: (index / 96) * width, raw });
  }
  const rawValues = points.map((point) => point.raw);
  const minY = Math.min(-1.5, ...rawValues);
  const maxY = Math.max(2.5, ...rawValues);
  return points.map((point) => ({
    x: point.x,
    y: height - ((point.raw - minY) / Math.max(1e-6, maxY - minY)) * height,
  }));
}

function PoleResponseComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const [sigma, setSigma] = useState(-1);
  const [omega, setOmega] = useState(2);
  const [mode, setMode] = useState<'conjugate_pair' | 'single_real'>('conjugate_pair');
  const [observationText, setObservationText] = useState('左半平面对应收敛，虚部越大摆动越密。');
  const plotWidth = 320;
  const plotHeight = 180;
  const planeX = ((clamp(sigma, -5, 2) + 5) / 7) * plotWidth;
  const planeY = plotHeight - (clamp(omega, 0, 5) / 5) * plotHeight;
  const curve = responsePoints({ sigma, omega, mode, width: plotWidth, height: plotHeight });
  const cardId = step.interactionSpec.activityCards?.[0]?.id ?? 'drag-pole-submit';

  const submitCurrent = () => {
    if (!onPanelSubmit) return;
    onPanelSubmit?.({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: {
        [cardId]: JSON.stringify({
          sigma: sigma.toFixed(2),
          omega: mode === 'single_real' ? '0.00' : omega.toFixed(2),
          observation_text: observationText,
        }),
      },
    });
  };

  return (
    <section className="premium-lesson-panel interactive-courseware-panel" data-interactive-figure-panel="drag_pole_s_plane" data-module-id={module.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="premium-lesson-kicker">极点行为地图</div>
          <h3 className="interactive-courseware-title-level-3">拖动极点看响应</h3>
          <p className="interactive-courseware-body">左侧记录极点坐标，右侧实时显示对应的响应走势。</p>
        </div>
        <button
          type="button"
          onClick={submitCurrent}
          disabled={!onPanelSubmit}
          className="premium-lesson-action-primary interactive-courseware-control px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {onPanelSubmit ? '提交当前参数' : '等待教师发放'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="premium-lesson-surface-elevated p-3">
          <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[220px] w-full" role="img" aria-label="极点复平面">
            <rect x="0" y="0" width={plotWidth / 7 * 5} height={plotHeight} fill="hsl(var(--platform-action-primary) / 0.10)" />
            <rect x={plotWidth / 7 * 5} y="0" width={plotWidth / 7 * 2} height={plotHeight} fill="hsl(var(--platform-evidence-unsupported) / 0.10)" />
            <line x1={plotWidth / 7 * 5} y1="0" x2={plotWidth / 7 * 5} y2={plotHeight} stroke="hsl(var(--platform-fg-secondary))" strokeWidth="2" />
            <line x1="0" y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="hsl(var(--platform-border-strong))" />
            <line x1="0" y1={plotHeight} x2="0" y2="0" stroke="hsl(var(--platform-border-strong))" />
            <text x="10" y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">稳定区</text>
            <text x={plotWidth - 60} y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">不稳定区</text>
            <text x={plotWidth / 7 * 5 + 6} y={plotHeight - 8} fill="hsl(var(--platform-fg-muted))" className="text-[10px]">虚轴</text>
            <circle cx={planeX} cy={planeY} r="8" fill="hsl(var(--platform-action-primary))" />
            <line x1={planeX - 12} y1={planeY} x2={planeX + 12} y2={planeY} stroke="hsl(var(--platform-fg-inverse))" strokeWidth="2" />
            <line x1={planeX} y1={planeY - 12} x2={planeX} y2={planeY + 12} stroke="hsl(var(--platform-fg-inverse))" strokeWidth="2" />
          </svg>
        </div>
        <div className="premium-lesson-surface-elevated p-3">
          <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[220px] w-full" role="img" aria-label="极点对应的时域响应">
            <line x1="0" y1={plotHeight * 0.58} x2={plotWidth} y2={plotHeight * 0.58} stroke="hsl(var(--platform-border))" strokeDasharray="4 4" />
            <path d={svgPath(curve)} fill="none" stroke="hsl(var(--platform-action-primary))" strokeWidth="3" />
            <text x="10" y="20" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">响应曲线</text>
          </svg>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 interactive-courseware-control">
          <span>σ（实部）</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="-5" max="2" step="0.1" value={sigma} onChange={(event) => setSigma(Number(event.target.value))} />
          <span className="premium-lesson-caption">{sigma.toFixed(1)}</span>
        </label>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 interactive-courseware-control">
          <span>ω（虚部）</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="0" max="5" step="0.1" value={omega} disabled={mode === 'single_real'} onChange={(event) => setOmega(Number(event.target.value))} />
          <span className="premium-lesson-caption">{mode === 'single_real' ? '0.0' : omega.toFixed(1)}</span>
        </label>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 interactive-courseware-control">
          <span>极点模式</span>
          <select className="premium-lesson-select" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="conjugate_pair">共轭极点</option>
            <option value="single_real">单实极点</option>
          </select>
        </label>
        <button type="button" className="premium-lesson-action-tone interactive-courseware-control premium-tone-slate self-end px-4 py-2" onClick={() => { setSigma(-1); setOmega(2); setMode('conjugate_pair'); }}>
          复位
        </button>
      </div>

      <label className="premium-lesson-control block px-3 py-2 interactive-courseware-control">
        <span className="premium-lesson-title font-medium">行为特征</span>
        <textarea value={observationText} onChange={(event) => setObservationText(event.target.value)} className="premium-lesson-input mt-2 min-h-[76px] w-full" />
      </label>
    </section>
  );
}

function ThreeShipsCaseComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const [selectedShip, setSelectedShip] = useState<'A' | 'B' | 'C' | 'all'>('all');
  const [timeScale, setTimeScale] = useState(1.5);
  const [interactionCount, setInteractionCount] = useState(0);
  const plotWidth = 360;
  const plotHeight = 190;
  const shipSeries = [
    { id: 'A', label: 'A：边摆边收', sigma: -1.5, omega: 2.2, stroke: 'hsl(var(--platform-action-primary))' },
    { id: 'B', label: 'B：单调收敛', sigma: -0.8, omega: 0, stroke: 'hsl(var(--platform-evidence-eligible))' },
    { id: 'C', label: 'C：摆动发散', sigma: 0.3, omega: 1.4, stroke: 'hsl(var(--platform-evidence-unsupported))' },
  ] as const;
  const visible = shipSeries.filter((ship) => selectedShip === 'all' || ship.id === selectedShip);
  const updateSelectedShip = (ship: 'A' | 'B' | 'C' | 'all') => {
    setSelectedShip(ship);
    setInteractionCount((value) => value + 1);
  };
  const updateTimeScale = (value: number) => {
    setTimeScale(value);
    setInteractionCount((current) => current + 1);
  };
  const submitSimulationRecord = () => {
    if (!onPanelSubmit) return;
    onPanelSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers: {
        [module.id]: JSON.stringify({
          selected_ship: selectedShip,
          time_scale: timeScale.toFixed(1),
          simulation_interaction_count: interactionCount,
          compared_ships: selectedShip === 'all' ? ['A', 'B', 'C'] : [selectedShip],
        }),
      },
    });
  };

  return (
    <section className="premium-lesson-panel interactive-courseware-panel" data-interactive-figure-panel="three_ships_case" data-module-id={module.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="premium-lesson-kicker">三艘船响应仿真</div>
          <h3 className="interactive-courseware-title-level-3">同样指令下的三种极点行为</h3>
          <p className="interactive-courseware-body">切换船型，观察“边摆边收、单调收敛、摆动发散”与极点位置的对应关系。</p>
        </div>
        <button
          type="button"
          onClick={submitSimulationRecord}
          disabled={!onPanelSubmit}
          className="premium-lesson-action-primary interactive-courseware-control px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {onPanelSubmit ? '记录比较' : '等待教师发放'}
        </button>
      </div>
      <div className="premium-lesson-surface-elevated p-3">
        <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="h-[240px] w-full" role="img" aria-label="三艘船航向响应曲线">
          <line x1="0" y1={plotHeight * 0.55} x2={plotWidth} y2={plotHeight * 0.55} stroke="hsl(var(--platform-border))" strokeDasharray="4 4" />
          {visible.map((ship) => (
            <path
              key={ship.id}
              d={svgPath(responsePoints({
                sigma: ship.sigma,
                omega: ship.omega,
                mode: ship.omega === 0 ? 'single_real' : 'conjugate_pair',
                width: plotWidth,
                height: plotHeight,
                timeScale,
              }))}
              fill="none"
              stroke={ship.stroke}
              strokeWidth="3"
            />
          ))}
          {visible.map((ship, index) => (
            <g key={ship.id} transform={`translate(18, ${22 + index * 20})`}>
              <line x1="0" y1="0" x2="24" y2="0" stroke={ship.stroke} strokeWidth="3" />
              <text x="32" y="4" fill="hsl(var(--platform-fg-secondary))" className="text-[11px]">{ship.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-wrap gap-2">
          {(['all', 'A', 'B', 'C'] as const).map((ship) => (
            <button
              key={ship}
              type="button"
              onClick={() => updateSelectedShip(ship)}
              className={`premium-lesson-action-tone interactive-courseware-control ${selectedShip === ship ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
            >
              {ship === 'all' ? '全部' : `船 ${ship}`}
            </button>
          ))}
        </div>
        <label className="premium-lesson-control flex flex-col gap-2 px-3 py-2 interactive-courseware-control">
          <span>时间轴缩放</span>
          <input className="accent-[hsl(var(--platform-action-primary))]" type="range" min="1" max="5" step="0.5" value={timeScale} onChange={(event) => updateTimeScale(Number(event.target.value))} />
        </label>
      </div>
    </section>
  );
}

export function InteractiveFigureComputePanel({
  step,
  module,
  onPanelSubmit,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onPanelSubmit?: (response: ManifestComputePanelSubmission) => void;
}) {
  const specKey = interactiveFigureSpecKey(step, module);
  if (isInteractiveFigureKind(specKey)) {
    return specKey === 'drag_pole_s_plane'
      ? <PoleResponseComputePanel step={step} module={module} onPanelSubmit={onPanelSubmit} />
      : <ThreeShipsCaseComputePanel step={step} module={module} onPanelSubmit={onPanelSubmit} />;
  }
  const title = titleFromModule(module, step);
  const text = stringField(module.payload, ['text', 'caption', 'description']);
  return (
    <section className="premium-lesson-panel interactive-courseware-panel">
      <h2 className="interactive-courseware-title-level-2">{title}</h2>
      {text ? <p className="interactive-courseware-body">{text}</p> : null}
    </section>
  );
}

'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type { CorrectionKind, CorrectionState, LinkageResponseType, PoleZeroPoint } from './model';

interface ParameterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCourseMode: boolean;
  isLockedOrCourse?: boolean;
  modelPoles: PoleZeroPoint[];
  modelZeros: PoleZeroPoint[];
  gain: number;
  correctionState: CorrectionState;
  responseType: LinkageResponseType;
  showMargins: boolean;
  onGainChange: (value: number) => void;
  onCorrectionChange: (patch: Partial<CorrectionState>) => void;
  onResponseTypeChange: (value: LinkageResponseType) => void;
  onShowMarginsChange: (value: boolean) => void;
  onAddPoint: (type: 'pole' | 'zero', pair: boolean) => void;
  onUpdatePole: (pointId: string, next: { re: number; im: number }) => void;
  onUpdateZero: (pointId: string, next: { re: number; im: number }) => void;
  onRemovePole: (pointId: string) => void;
  onRemoveZero: (pointId: string) => void;
  onReset: () => void;
}

function NumberInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => value.toFixed(2));

  useEffect(() => {
    if (!isEditing) {
      setDraft(Number.isFinite(value) ? value.toFixed(2) : '');
    }
  }, [isEditing, value]);

  const commit = () => {
    setIsEditing(false);
    const next = Number(draft);
    if (Number.isFinite(next)) {
      onChange(next);
      return;
    }
    setDraft(Number.isFinite(value) ? value.toFixed(2) : '');
  };

  return (
    <label className="premium-lesson-caption text-xs">
      {label}
      <input
        type="number"
        step="1"
        disabled={disabled}
        value={draft}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const next = Number(nextDraft);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="premium-lesson-input mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function formatMathNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '0';
}

function buildControllerExpression(state: CorrectionState): string {
  const k = formatMathNumber(state.controllerGain);
  if (state.kind === 'pi') {
    return `C(s)=${k}\\left(${formatMathNumber(state.kp)}+\\frac{${formatMathNumber(state.ki)}}{s}\\right)`;
  }
  if (state.kind === 'pd') {
    return `C(s)=${k}\\left(${formatMathNumber(state.kp)}+${formatMathNumber(state.kd)}s\\right)`;
  }
  if (state.kind === 'pid') {
    return `C(s)=${k}\\left(${formatMathNumber(state.kp)}+\\frac{${formatMathNumber(state.ki)}}{s}+${formatMathNumber(state.kd)}s\\right)`;
  }
  if (state.kind === 'lead') {
    return `C(s)=${k}\\frac{1+s/${formatMathNumber(state.leadZeroFrequency)}}{1+s/${formatMathNumber(state.leadPoleFrequency)}}`;
  }
  if (state.kind === 'lag') {
    return `C(s)=${k}\\frac{1+s/${formatMathNumber(state.lagZeroFrequency)}}{1+s/${formatMathNumber(state.lagPoleFrequency)}}`;
  }
  return `C(s)=${k}\\frac{1+s/${formatMathNumber(state.leadZeroFrequency)}}{1+s/${formatMathNumber(state.leadPoleFrequency)}}\\frac{1+s/${formatMathNumber(state.lagZeroFrequency)}}{1+s/${formatMathNumber(state.lagPoleFrequency)}}`;
}

function PointRows({
  title,
  type,
  points,
  disabled,
  onUpdate,
  onRemove,
}: {
  title: string;
  type: 'p' | 'z';
  points: PoleZeroPoint[];
  disabled: boolean;
  onUpdate: (pointId: string, next: { re: number; im: number }) => void;
  onRemove: (pointId: string) => void;
}) {
  return (
    <section className="premium-lesson-tone-block premium-tone-slate space-y-3">
      <div className="premium-lesson-title text-sm font-medium">{title}</div>
      {points.length === 0 ? <div className="premium-lesson-muted text-sm">当前无开环零点</div> : null}
      {points.map((point, index) => (
        <div key={point.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <NumberInput
            label={`${type}${index + 1}.Re`}
            value={point.re}
            disabled={disabled}
            onChange={(value) => { if (!disabled) onUpdate(point.id, { re: value, im: point.im }); }}
          />
          <NumberInput
            label={`${type}${index + 1}.Im`}
            value={point.im}
            disabled={disabled}
            onChange={(value) => { if (!disabled) onUpdate(point.id, { re: point.re, im: value }); }}
          />
          <div className="flex flex-col items-end justify-end gap-1 pb-1">
            <span className="premium-lesson-caption rounded border border-border/50 px-2 py-0.5 text-[11px]">
              {point.pairKey ? '共轭' : '实数'}
            </span>
            <button
              type="button"
              onClick={() => onRemove(point.id)}
              disabled={disabled}
              className="premium-lesson-control min-h-0 px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function CorrectionControls({
  state,
  disabled,
  onChange,
}: {
  state: CorrectionState;
  disabled: boolean;
  onChange: (patch: Partial<CorrectionState>) => void;
}) {
  const isPidFamily = state.kind === 'pi' || state.kind === 'pd' || state.kind === 'pid';
  const hasI = state.kind === 'pi' || state.kind === 'pid';
  const hasD = state.kind === 'pd' || state.kind === 'pid';
  const isLead = state.kind === 'lead' || state.kind === 'lead_lag';
  const isLag = state.kind === 'lag' || state.kind === 'lead_lag';

  return (
    <section className="premium-lesson-tone-block premium-tone-cyan space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="premium-lesson-title text-sm font-medium">校正装置</div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={disabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            className="h-4 w-4 rounded border-border bg-background"
          />
          启用校正
        </label>
      </div>

      <label className="premium-lesson-caption block text-xs">
        结构
        <select
          value={state.kind}
          disabled={disabled || !state.enabled}
          onChange={(event) => onChange({ kind: event.target.value as CorrectionKind })}
          className="premium-lesson-select mt-1 w-full"
        >
          <option value="pi">PI</option>
          <option value="pd">PD</option>
          <option value="pid">PID</option>
          <option value="lead">超前</option>
          <option value="lag">滞后</option>
          <option value="lead_lag">滞后-超前</option>
        </select>
      </label>

      <div className="rounded-lg border border-cyan-500/20 bg-background/75 px-3 py-2 text-sm [&_.katex-display]:m-0">
        <BlockMath math={buildControllerExpression(state)} />
      </div>

      <NumberInput
        label="控制器增益 K"
        value={state.controllerGain}
        disabled={disabled || !state.enabled}
        onChange={(controllerGain) => onChange({ controllerGain })}
      />

      {isPidFamily ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Kp" value={state.kp} disabled={disabled || !state.enabled} onChange={(kp) => onChange({ kp })} />
          {hasI ? <NumberInput label="Ki" value={state.ki} disabled={disabled || !state.enabled} onChange={(ki) => onChange({ ki })} /> : null}
          {hasD ? <NumberInput label="Kd" value={state.kd} disabled={disabled || !state.enabled} onChange={(kd) => onChange({ kd })} /> : null}
          {hasI ? <NumberInput label="Ti=Kp/Ki" value={state.ti} disabled={disabled || !state.enabled} onChange={(ti) => onChange({ ti, ki: ti > 0 ? state.kp / ti : 0 })} /> : null}
          {hasD ? <NumberInput label="Td=Kd/Kp" value={state.td} disabled={disabled || !state.enabled} onChange={(td) => onChange({ td, kd: state.kp * td })} /> : null}
          {hasD ? (
            <label className="premium-lesson-caption col-span-2 inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={state.derivativeFilterEnabled}
                disabled={disabled || !state.enabled}
                onChange={(event) => onChange({ derivativeFilterEnabled: event.target.checked })}
                className="h-4 w-4 rounded border-border bg-background"
              />
              启用微分滤波
            </label>
          ) : null}
          {hasD && state.derivativeFilterEnabled ? (
            <NumberInput label="Tf" value={state.tf} disabled={disabled || !state.enabled} onChange={(tf) => onChange({ tf })} />
          ) : null}
        </div>
      ) : null}

      {!isPidFamily ? (
        <div className="grid grid-cols-2 gap-2">
          {isLead ? (
            <>
              <NumberInput label="超前零点频率" value={state.leadZeroFrequency} disabled={disabled || !state.enabled} onChange={(leadZeroFrequency) => onChange({ leadZeroFrequency })} />
              <NumberInput label="超前极点频率" value={state.leadPoleFrequency} disabled={disabled || !state.enabled} onChange={(leadPoleFrequency) => onChange({ leadPoleFrequency })} />
            </>
          ) : null}
          {isLag ? (
            <>
              <NumberInput label="滞后零点频率" value={state.lagZeroFrequency} disabled={disabled || !state.enabled} onChange={(lagZeroFrequency) => onChange({ lagZeroFrequency })} />
              <NumberInput label="滞后极点频率" value={state.lagPoleFrequency} disabled={disabled || !state.enabled} onChange={(lagPoleFrequency) => onChange({ lagPoleFrequency })} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type DrawerWheelEvent = WheelEvent | ReactWheelEvent<HTMLDivElement>;

function containDrawerWheel(event: DrawerWheelEvent, element: HTMLElement) {
  const atTop = element.scrollTop <= 0;
  const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
  const scrollingPastTop = event.deltaY < 0 && atTop;
  const scrollingPastBottom = event.deltaY > 0 && atBottom;

  event.stopPropagation();
  if (scrollingPastTop || scrollingPastBottom) {
    event.preventDefault();
  }
}

export function ParameterDrawer({
  open,
  onOpenChange,
  isCourseMode,
  isLockedOrCourse,
  modelPoles,
  modelZeros,
  gain,
  correctionState,
  responseType,
  showMargins,
  onGainChange,
  onCorrectionChange,
  onResponseTypeChange,
  onShowMarginsChange,
  onAddPoint,
  onUpdatePole,
  onUpdateZero,
  onRemovePole,
  onRemoveZero,
  onReset,
}: ParameterDrawerProps) {
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const [activeTab, setActiveTab] = useState<'plant' | 'correction'>('plant');
  const drawerTabBaseClass = 'flex h-10 w-full min-w-0 items-center justify-center overflow-hidden rounded-md border px-3 text-sm font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  const drawerTabActiveClass = 'border-cyan-600 bg-cyan-100 text-cyan-950 shadow-sm hover:bg-cyan-100 dark:border-cyan-300/70 dark:bg-cyan-300/20 dark:text-cyan-50 dark:hover:bg-cyan-300/20';
  const drawerTabInactiveClass = 'border-transparent bg-transparent text-muted-foreground hover:border-cyan-300/70 hover:bg-cyan-50 hover:text-cyan-900 dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/10 dark:hover:text-cyan-50';
  const drawerTabClass = (tab: 'plant' | 'correction') =>
    activeTab === tab
      ? `${drawerTabBaseClass} ${drawerTabActiveClass}`
      : `${drawerTabBaseClass} ${drawerTabInactiveClass}`;

  const setContentNode = useCallback((element: HTMLDivElement | null) => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    if (!element) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof Node && element.contains(event.target)) {
        containDrawerWheel(event, element);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    wheelCleanupRef.current = () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  useEffect(() => () => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={setContentNode}
          className="fixed inset-y-0 right-0 left-auto top-0 z-50 grid h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto overscroll-contain rounded-none border-l border-border bg-background p-5 text-foreground shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[420px] sm:rounded-none"
          onWheelCapture={(event) => containDrawerWheel(event, event.currentTarget)}
        >
          <div className="flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="premium-lesson-title text-lg">参数抽屉</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 rounded-md border border-border/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('plant')}
              aria-pressed={activeTab === 'plant'}
              data-testid="parameter-drawer-object-tab"
              data-state={activeTab === 'plant' ? 'active' : 'inactive'}
              className={drawerTabClass('plant')}
            >
              <span className="block max-w-full truncate" title="对象">对象</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('correction')}
              aria-pressed={activeTab === 'correction'}
              data-testid="parameter-drawer-correction-tab"
              data-state={activeTab === 'correction' ? 'active' : 'inactive'}
              className={drawerTabClass('correction')}
            >
              <span className="block max-w-full truncate" title="校正">校正</span>
            </button>
          </div>

          <div className="space-y-4">
            {activeTab === 'correction' ? (
              <CorrectionControls
                state={correctionState}
                disabled={isCourseMode}
                onChange={onCorrectionChange}
              />
            ) : (
              <>
            <section className="premium-lesson-tone-block premium-tone-cyan space-y-3">
              <div className="premium-lesson-title text-sm font-medium">联动参数</div>
              {!correctionState.enabled ? (
                <NumberInput label="开环增益 K" value={gain} onChange={onGainChange} />
              ) : null}
              <label className="premium-lesson-caption block text-xs">
                响应类型
                <select
                  value={responseType}
                  onChange={(event) => onResponseTypeChange(event.target.value as LinkageResponseType)}
                  className="premium-lesson-select mt-1 w-full"
                >
                  <option value="step">阶跃响应</option>
                  <option value="impulse">脉冲响应</option>
                  <option value="ramp">斜坡响应</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={showMargins}
                  onChange={(event) => onShowMarginsChange(event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background"
                />
                显示裕度标注
              </label>
            </section>

            <section className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAddPoint('pole', false)}
              disabled={isCourseMode || Boolean(isLockedOrCourse)}
              className="premium-lesson-action-tone premium-tone-cyan disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加实极点
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('pole', true)}
              disabled={isCourseMode || Boolean(isLockedOrCourse)}
              className="premium-lesson-action-tone premium-tone-cyan disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加共轭极点对
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('zero', false)}
              disabled={isCourseMode || Boolean(isLockedOrCourse)}
              className="premium-lesson-action-tone premium-tone-rose disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加实零点
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('zero', true)}
              disabled={isCourseMode || Boolean(isLockedOrCourse)}
              className="premium-lesson-action-tone premium-tone-rose disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加共轭零点对
            </button>
            </section>

            <PointRows
            title="开环极点"
            type="p"
            points={modelPoles}
            disabled={isCourseMode || Boolean(isLockedOrCourse)}
            onUpdate={onUpdatePole}
            onRemove={onRemovePole}
          />
            <PointRows
            title="开环零点"
            type="z"
            points={modelZeros}
            disabled={isCourseMode || Boolean(isLockedOrCourse)}
            onUpdate={onUpdateZero}
            onRemove={onRemoveZero}
          />

            <button type="button" onClick={onReset} className="premium-lesson-control w-full justify-center">
              恢复默认
            </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

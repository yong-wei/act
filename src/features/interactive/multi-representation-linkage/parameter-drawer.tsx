'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';

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
  return (
    <label className="premium-lesson-caption text-xs">
      {label}
      <input
        type="number"
        step="0.001"
        disabled={disabled}
        value={value.toFixed(3)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        className="premium-lesson-input mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
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
            onChange={(value) => onUpdate(point.id, { re: value, im: point.im })}
          />
          <NumberInput
            label={`${type}${index + 1}.Im`}
            value={point.im}
            onChange={(value) => onUpdate(point.id, { re: point.re, im: value })}
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
  const tabClass = (tab: 'plant' | 'correction') =>
    activeTab === tab
      ? 'premium-lesson-action-tone premium-tone-cyan justify-center'
      : 'premium-lesson-control justify-center';

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

          <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('plant')}
              aria-pressed={activeTab === 'plant'}
              className={tabClass('plant')}
            >
              对象
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('correction')}
              aria-pressed={activeTab === 'correction'}
              className={tabClass('correction')}
            >
              校正
            </button>
          </div>

          <div className="space-y-4">
            {activeTab === 'correction' ? (
              <CorrectionControls
                state={correctionState}
                disabled={isCourseMode || Boolean(isLockedOrCourse)}
                onChange={onCorrectionChange}
              />
            ) : (
              <>
            <section className="premium-lesson-tone-block premium-tone-cyan space-y-3">
              <div className="premium-lesson-title text-sm font-medium">联动参数</div>
              <NumberInput label="增益 K（闭环极点联动）" value={gain} onChange={onGainChange} />
              <label className="premium-lesson-caption block text-xs">
                响应类型
                <select
                  value={responseType}
                  onChange={(event) => onResponseTypeChange(event.target.value as LinkageResponseType)}
                  className="premium-lesson-select mt-1 w-full"
                >
                  <option value="step">Step</option>
                  <option value="impulse">Impulse</option>
                  <option value="ramp">Ramp</option>
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

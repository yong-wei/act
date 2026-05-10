'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import type { LinkageResponseType, PoleZeroPoint } from './model';

interface ParameterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCourseMode: boolean;
  modelPoles: PoleZeroPoint[];
  modelZeros: PoleZeroPoint[];
  gain: number;
  responseType: LinkageResponseType;
  showMargins: boolean;
  onGainChange: (value: number) => void;
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="premium-lesson-caption text-xs">
      {label}
      <input
        type="number"
        step="0.001"
        value={value.toFixed(3)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        className="premium-lesson-input mt-1 w-full"
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

export function ParameterDrawer({
  open,
  onOpenChange,
  isCourseMode,
  modelPoles,
  modelZeros,
  gain,
  responseType,
  showMargins,
  onGainChange,
  onResponseTypeChange,
  onShowMarginsChange,
  onAddPoint,
  onUpdatePole,
  onUpdateZero,
  onRemovePole,
  onRemoveZero,
  onReset,
}: ParameterDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 left-auto top-0 z-50 grid h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto rounded-none border-l border-border bg-background p-5 text-foreground shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[420px] sm:rounded-none">
          <div className="flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="premium-lesson-title text-lg">参数抽屉</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-4">
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
              disabled={isCourseMode}
              className="premium-lesson-action-tone premium-tone-cyan disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加实极点
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('pole', true)}
              disabled={isCourseMode}
              className="premium-lesson-action-tone premium-tone-cyan disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加共轭极点对
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('zero', false)}
              disabled={isCourseMode}
              className="premium-lesson-action-tone premium-tone-rose disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加实零点
            </button>
            <button
              type="button"
              onClick={() => onAddPoint('zero', true)}
              disabled={isCourseMode}
              className="premium-lesson-action-tone premium-tone-rose disabled:cursor-not-allowed disabled:opacity-45"
            >
              添加共轭零点对
            </button>
            </section>

            <PointRows
            title="开环极点"
            type="p"
            points={modelPoles}
            disabled={isCourseMode}
            onUpdate={onUpdatePole}
            onRemove={onRemovePole}
          />
            <PointRows
            title="开环零点"
            type="z"
            points={modelZeros}
            disabled={isCourseMode}
            onUpdate={onUpdateZero}
            onRemove={onRemoveZero}
          />

            <button type="button" onClick={onReset} className="premium-lesson-control w-full justify-center">
              恢复默认
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { AlertTriangle, Lock, Pause, Play, RotateCcw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { simulationUi } from './simulation-ui';

/**
 * 实验状态面板与控制面板的统一构件。
 * 色调只取平台语义色（深浅主题各自取值），避免各实验自带颜色导致某一主题下看不清。
 */
export type SimTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export const simToneText: Record<SimTone, string> = {
  neutral: 'text-platform-fg-primary',
  accent: 'text-platform-action-primary',
  success: 'text-[hsl(var(--platform-brand-success))]',
  warning: 'text-[hsl(var(--platform-brand-evidence))]',
  danger: 'text-[hsl(var(--platform-brand-danger))]',
};

const simToneFill: Record<SimTone, string> = {
  neutral: 'bg-platform-fg-secondary',
  accent: 'bg-platform-action-primary',
  success: 'bg-[hsl(var(--platform-brand-success))]',
  warning: 'bg-[hsl(var(--platform-brand-evidence))]',
  danger: 'bg-[hsl(var(--platform-brand-danger))]',
};

/** 绝对值超过 warn 为警示，超过 danger 为危险，否则为 calm。 */
export function simToneForMagnitude(value: number, warn: number, danger = Number.POSITIVE_INFINITY, calm: SimTone = 'success'): SimTone {
  const magnitude = Math.abs(value);
  if (magnitude > danger) return 'danger';
  if (magnitude > warn) return 'warning';
  return calm;
}

export function SimPanelStack({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('w-full min-w-0 space-y-3 text-sm', className)} {...props} />;
}

export function SimPanelSection({
  title,
  icon: Icon,
  aside,
  tone = 'neutral',
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
  title?: ReactNode;
  icon?: LucideIcon;
  aside?: ReactNode;
  tone?: SimTone;
}) {
  return (
    <section data-sim-panel-section="" data-sim-tone={tone} className={cn('sim-panel-section', className)} {...props}>
      {title ? (
        <header className="mb-2.5 flex min-w-0 items-center gap-2">
          {Icon ? (
            <span className="sim-panel-icon" aria-hidden="true">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <h4 className={cn('min-w-0 truncate text-xs font-semibold tracking-wide', simToneText[tone])}>{title}</h4>
          {aside ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function SimReadoutGrid({
  columns = 2,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & { columns?: 1 | 2 | 3 }) {
  const grid = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return <div className={cn('grid gap-1.5', grid, className)} {...props} />;
}

/** 单个读数；`valueProps` 用于把 data-* 等属性挂在数值节点上，方便测试只读取数值文本。 */
export function SimReadout({
  label,
  value,
  unit,
  tone = 'neutral',
  size = 'md',
  span = false,
  className,
  valueProps,
  ...props
}: Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  tone?: SimTone;
  size?: 'md' | 'lg';
  span?: boolean;
  valueProps?: ComponentPropsWithoutRef<'span'> & Record<`data-${string}`, string | number | boolean | undefined>;
}) {
  return (
    <div className={cn('sim-panel-readout min-w-0', span && 'col-span-full', className)} {...props}>
      <div className="truncate text-[11px] leading-4 text-platform-fg-secondary">{label}</div>
      <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
        <span
          {...valueProps}
          className={cn(
            'truncate font-mono font-semibold tabular-nums leading-tight',
            size === 'lg' ? 'text-lg' : 'text-sm',
            simToneText[tone],
            valueProps?.className,
          )}
        >
          {value}
        </span>
        {unit ? <span className="shrink-0 text-[11px] text-platform-fg-secondary">{unit}</span> : null}
      </div>
    </div>
  );
}

export type SimRunState = 'running' | 'paused' | 'idle';

const RUN_STATE_LABEL: Record<SimRunState, string> = {
  running: '运行中',
  paused: '已暂停',
  idle: '待开始',
};

export function SimStatusStrip({
  state,
  time,
  children,
  className,
}: {
  state: SimRunState;
  time?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div data-sim-status-strip={state} className={cn('sim-panel-strip flex min-w-0 flex-wrap items-center gap-2 px-2.5 py-2', className)}>
      <span className="sim-status-dot" data-state={state} aria-hidden="true" />
      <span className="text-xs font-semibold text-platform-fg-primary">{RUN_STATE_LABEL[state]}</span>
      {children}
      {time !== undefined ? (
        <span className="ml-auto whitespace-nowrap text-[11px] text-platform-fg-secondary">
          仿真时间{' '}
          <span className="ml-1 font-mono text-xs font-semibold tabular-nums text-platform-fg-primary">{time}</span>
        </span>
      ) : null}
    </div>
  );
}

export function SimChip({
  tone = 'neutral',
  icon: Icon,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'span'> & { tone?: SimTone; icon?: LucideIcon }) {
  return (
    <span data-sim-tone={tone} className={cn('sim-chip', className)} {...props}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** 参数由当前实验步骤设定、学生不能改时的统一提示。 */
export function SimLockedChip({ locked, children = '本步锁定' }: { locked: boolean; children?: ReactNode }) {
  if (!locked) return null;
  return <SimChip icon={Lock}>{children}</SimChip>;
}

export function SimMeter({
  value,
  tone = 'accent',
  label,
  valueLabel,
  scale,
  className,
}: {
  /** 0–1 */
  value: number;
  tone?: SimTone;
  label?: ReactNode;
  valueLabel?: ReactNode;
  scale?: ReactNode[];
  className?: string;
}) {
  const width = `${Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100}%`;
  return (
    <div className={cn('min-w-0', className)}>
      {label !== undefined || valueLabel !== undefined ? (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="truncate text-platform-fg-secondary">{label}</span>
          <span className={cn('shrink-0 font-mono font-semibold tabular-nums', simToneText[tone === 'accent' ? 'neutral' : tone])}>{valueLabel}</span>
        </div>
      ) : null}
      <div className="sim-meter">
        <span className={simToneFill[tone]} style={{ width }} />
      </div>
      {scale?.length ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-platform-fg-muted">
          {scale.map((tick, index) => <span key={index}>{tick}</span>)}
        </div>
      ) : null}
    </div>
  );
}

export function SimNotice({
  tone = 'warning',
  icon: Icon = AlertTriangle,
  title,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'div'>, 'title'> & { tone?: SimTone; icon?: LucideIcon; title?: ReactNode }) {
  return (
    <div role="status" data-sim-tone={tone} className={cn('sim-panel-notice', className)} {...props}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <div className={cn('font-semibold', simToneText[tone])}>{title}</div> : null}
        {children ? <div className={title ? 'mt-0.5 text-platform-fg-secondary' : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

export function SimField({
  label,
  value,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}) {
  const labelClass = 'min-w-0 truncate text-xs text-platform-fg-secondary';
  return (
    <div className={cn('min-w-0 space-y-1.5', className)} data-sim-field="">
      <div className="flex items-baseline justify-between gap-2">
        {htmlFor ? <label htmlFor={htmlFor} className={labelClass}>{label}</label> : <span className={labelClass}>{label}</span>}
        {value !== undefined ? (
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-platform-fg-primary">{value}</span>
        ) : null}
      </div>
      {children}
      {hint ? <div className="text-[11px] leading-4 text-platform-fg-muted">{hint}</div> : null}
    </div>
  );
}

export interface SimSegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function SimSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: {
  options: readonly SimSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('sim-segmented', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled || option.disabled}
          onClick={() => onChange(option.value)}
          className="sim-segment"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SimToggleRow({
  label,
  description,
  icon: Icon,
  htmlFor,
  control,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  htmlFor?: string;
  control: ReactNode;
  className?: string;
}) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <Label {...(htmlFor ? { htmlFor } : {})} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-platform-fg-primary">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-platform-action-primary" aria-hidden="true" /> : null}
          <span className="truncate">{label}</span>
        </Label>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-platform-fg-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}

/** 原生复选框画成开关，保留 checkbox 语义与 id/label 关联。 */
export function SimSwitchInput({ className, ...props }: Omit<ComponentPropsWithoutRef<'input'>, 'type'>) {
  return <input type="checkbox" className={cn('sim-switch', className)} {...props} />;
}

export function SimRunControls({
  running,
  primaryLabel,
  onPrimary,
  primarySoundStart = true,
  onReset,
  resetLabel = '重置',
  disabled = false,
}: {
  /** 运行中时主按钮显示为暂停样式。 */
  running: boolean;
  primaryLabel: ReactNode;
  onPrimary: () => void;
  /** 主按钮是否带 data-sound-start（启动音效与测试入口）。 */
  primarySoundStart?: boolean;
  onReset: () => void;
  resetLabel?: string;
  disabled?: boolean;
}) {
  const PrimaryIcon = running ? Pause : Play;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <button
        type="button"
        data-sound-start={primarySoundStart ? '' : undefined}
        disabled={disabled}
        onClick={onPrimary}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          running ? simulationUi.buttonSecondary : simulationUi.buttonPrimary,
        )}
      >
        <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
        {primaryLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onReset}
        aria-label={resetLabel}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50',
          simulationUi.buttonOutline,
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {resetLabel}
      </button>
    </div>
  );
}

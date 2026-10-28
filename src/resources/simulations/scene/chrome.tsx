'use client';

/**
 * 场景 chrome 基元：tooltip 封装与弹出式 chrome 按钮。
 * `@radix-ui/react-tooltip` 的唯一依赖点——其余组件禁止直接引用 radix（ADR：
 * 统一底部 chrome 家族形态，design §1）。
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 场景 chrome 统一 tooltip：触发器 asChild，内容浮层为平台 chrome 风格（Provider 内置，免挂载）。 */
export function SceneTooltip({
  content,
  children,
  side = 'top',
}: {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-56 rounded-md border border-platform-action-primary/30 bg-platform-canvas/95 px-2.5 py-1.5 text-xs leading-4 text-platform-fg-primary shadow-[0_12px_30px_-12px_rgb(2_8_23/0.8)] backdrop-blur"
          >
            {content}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** 弹出式 chrome 按钮的状态契约：收起时按钮只呈现当前态，点击向上展开，再点或选后收起。 */
export interface ChromePopoverOption<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly description?: string;
}

/**
 * 弹出式 chrome 按钮基元（图标+两字、向上展开、当前态回显）。
 * 选项区由调用方渲染（含自定义尾槽，如视图弹出层的网格开关）。
 */
export function ChromePopoverButton<T extends string>({
  icon,
  label,
  currentLabel,
  tooltip,
  options,
  currentId,
  onSelect,
  tail,
  dataHook,
  ariaLabel,
  optionDataHook,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly currentLabel: string;
  readonly tooltip: ReactNode;
  readonly options: readonly ChromePopoverOption<T>[];
  readonly currentId: T | null;
  readonly onSelect: (id: T) => void;
  readonly tail?: ReactNode;
  readonly dataHook: string;
  readonly ariaLabel: string;
  /** 选项按钮需要额外携带的 data-* 钩子名（如 quality-tier，供既有测试选择器复用）。 */
  readonly optionDataHook?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点击空白处关闭打开的选单（打开期间挂一次全局监听）。
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-chrome-popover={dataHook}>
      <SceneTooltip content={tooltip}>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          data-chrome-popover-trigger={dataHook}
          onClick={() => setOpen((previous) => !previous)}
          className={
            open
              ? 'flex h-8 items-center gap-1.5 rounded-lg border border-platform-action-primary/60 bg-platform-action-primary/15 px-2.5 text-xs text-platform-action-primary shadow-[0_0_16px_-6px_hsl(var(--platform-action-primary))] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary'
              : 'flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs text-platform-fg-muted transition hover:border-platform-fg-primary/15 hover:bg-platform-fg-primary/5 hover:text-platform-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary'
          }
        >
          {icon}
          <span className="max-[480px]:hidden">{label}</span>
          <span className="font-semibold text-platform-fg-primary max-[480px]:hidden">{currentLabel}</span>
        </button>
      </SceneTooltip>
      {open ? (
        <div
          role="menu"
          data-chrome-popover-panel={dataHook}
          className="sim-hud-actionbar absolute bottom-full left-1/2 z-40 mb-2.5 min-w-32 -translate-x-1/2 p-1"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === currentId}
              data-chrome-popover-option={option.id}
              {...(optionDataHook ? { [`data-${optionDataHook}`]: option.id } : {})}
              title={option.description}
              onClick={() => {
                onSelect(option.id);
                setOpen(false);
              }}
              className={
                option.id === currentId
                  ? 'block w-full whitespace-nowrap rounded-md border border-platform-action-primary/45 bg-platform-action-primary/15 px-3 py-1.5 text-left text-xs font-semibold text-platform-action-primary shadow-[inset_2px_0_0_hsl(var(--platform-action-primary))]'
                  : 'block w-full whitespace-nowrap rounded-md border border-transparent px-3 py-1.5 text-left text-xs text-platform-fg-secondary transition hover:bg-platform-fg-primary/5 hover:text-platform-fg-primary'
              }
            >
              {option.label}
            </button>
          ))}
          {tail}
        </div>
      ) : null}
    </div>
  );
}

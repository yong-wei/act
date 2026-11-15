'use client';

import Link from 'next/link';
import { Compass, Lock, LogOut, Sparkles } from 'lucide-react';
import {
  HIGHLIGHT_TOUR_NODES,
  type HighlightTourNode,
} from './highlight-tour';

/**
 * Highlight Tour entry section for /simulations catalog (never touches AppShell top-right).
 */
export function HighlightTourCatalogSection() {
  return (
    <section
      className="surface-card rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/8 via-platform-surface/90 to-sky-500/8 p-4"
      aria-label="典型高光工况只读导览"
      data-highlight-tour-catalog
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>典型高光工况只读导览（评委与观摩专用入口）</span>
          </div>
          <h2 className="text-base font-semibold text-platform-fg-primary">
            一键直达五大核心教学高光时刻
          </h2>
          <p className="text-xs text-platform-fg-secondary">
            无需从第 1 步漫长预跑即可观摩三层隔离失配、邮轮左鳍冻结、集装箱立方油耗天平、981 平台 T2 断桨重分配与第 20 步实证闭环；
            <strong className="ml-1 font-semibold text-amber-800 dark:text-amber-200">
              导览态严格锁定为只读示范，严禁触发正式成绩提交或实验空间回传。
            </strong>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-platform-border-subtle bg-platform-canvas/60 px-2.5 py-1 text-[11px] font-medium text-platform-fg-secondary">
          <Lock className="h-3 w-3 text-amber-500" aria-hidden="true" />
          只读零污染保证
        </span>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
        {HIGHLIGHT_TOUR_NODES.map((node, index) => (
          <Link
            key={node.id}
            href={`/simulations/${node.vesselId}?tour=1&node=${node.id}`}
            prefetch={false}
            data-tour-catalog-node={node.id}
            className="group flex flex-col justify-between rounded-lg border border-platform-border-subtle bg-platform-canvas/65 p-3 transition hover:border-amber-500/60 hover:bg-platform-canvas"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-platform-fg-secondary">
                <span>高光 #{index + 1} · 步 {node.stepSeq}</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                  {node.vesselId === 'cruise'
                    ? '邮轮'
                    : node.vesselId === 'container'
                      ? '集装箱船'
                      : '981平台'}
                </span>
              </div>
              <div className="text-xs font-semibold text-platform-fg-primary group-hover:text-primary">
                {node.title}
              </div>
              <p className="text-[11px] leading-4 text-platform-fg-secondary">
                {node.focusFeature}
              </p>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <Compass className="h-3 w-3" aria-hidden="true" />
              <span>进入只读导览 →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HighlightTourToggleButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-highlight-tour-toggle
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? 'border-amber-500/60 bg-amber-500/20 text-amber-800 dark:text-amber-200'
          : 'border-platform-border-subtle bg-platform-surface/80 text-platform-fg-primary hover:border-amber-500/50'
      }`}
    >
      <Compass className="h-3 w-3" aria-hidden="true" />
      <span>{active ? '导览只读中' : '高光导览'}</span>
    </button>
  );
}

/**
 * Interactive banner mounted inside SimulationMissionTracker when highlight tour mode is active.
 */
export function HighlightTourBanner({
  activeNode,
  currentVesselId,
  onSelectNode,
  onExit,
}: {
  activeNode: HighlightTourNode;
  currentVesselId: string;
  onSelectNode: (node: HighlightTourNode) => void;
  onExit: () => void;
}) {
  return (
    <div
      className="space-y-1.5 rounded-lg border border-amber-500/45 bg-amber-500/12 px-2.5 py-2 text-[11px]"
      data-highlight-tour-banner
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
          <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <span>只读高光工况导览中 · 严禁正式计分与回传</span>
        </span>
        <button
          type="button"
          onClick={onExit}
          data-highlight-tour-exit
          className="inline-flex items-center gap-1 rounded border border-amber-500/45 bg-platform-canvas/75 px-2 py-0.5 text-[10px] font-semibold text-platform-fg-primary hover:bg-platform-canvas"
        >
          <LogOut className="h-3 w-3" aria-hidden="true" />
          <span>退出导览</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {HIGHLIGHT_TOUR_NODES.map((node, index) => {
          const isCurrent = node.id === activeNode.id;
          const sameVessel = node.vesselId === currentVesselId;
          if (sameVessel) {
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node)}
                data-tour-node-pill={node.id}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                  isCurrent
                    ? 'bg-amber-600 text-white'
                    : 'border border-platform-border-subtle bg-platform-canvas/65 text-platform-fg-secondary hover:text-platform-fg-primary'
                }`}
              >
                #{index + 1} {node.title}
              </button>
            );
          }
          return (
            <Link
              key={node.id}
              href={`/simulations/${node.vesselId}?tour=1&node=${node.id}`}
              prefetch={false}
              data-tour-node-pill={node.id}
              className="rounded border border-platform-border-subtle bg-platform-canvas/65 px-1.5 py-0.5 text-[10px] font-medium text-platform-fg-secondary transition hover:text-platform-fg-primary"
            >
              #{index + 1} {node.title} ↗
            </Link>
          );
        })}
      </div>
    </div>
  );
}

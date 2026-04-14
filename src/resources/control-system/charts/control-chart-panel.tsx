'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import {
  CanvasRenderer,
} from 'echarts/renderers';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import {
  LineChart,
  ScatterChart,
} from 'echarts/charts';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';

use([CanvasRenderer, GridComponent, TooltipComponent, LegendComponent, LineChart, ScatterChart, MarkLineComponent]);

export interface ControlChartPanelProps {
  title: string;
  subtitle: string;
  option: EChartsCoreOption;
  overlay?: ReactNode;
  fallback?: ReactNode;
  isFallback?: boolean;
  className?: string;
}

export function ControlChartPanel({
  title,
  subtitle,
  option,
  overlay,
  fallback,
  isFallback = false,
  className = '',
}: ControlChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div className={`premium-lesson-tone-block premium-tone-slate ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-semibold">{title}</div>
          <div className="premium-lesson-muted mt-1 text-xs">{subtitle}</div>
        </div>
        {isFallback ? <div className="premium-lesson-caption text-[11px]">fixture fallback</div> : null}
      </div>
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background/55">
        <div ref={containerRef} className="h-[260px] w-full" />
        {overlay ? <div className="pointer-events-none absolute inset-0">{overlay}</div> : null}
        {isFallback && fallback ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {fallback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

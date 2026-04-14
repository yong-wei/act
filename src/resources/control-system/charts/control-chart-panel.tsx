'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

export interface ControlChartPanelProps {
  title: string;
  meta?: ReactNode;
  option: EChartsCoreOption;
  overlay?: ReactNode;
  fallback?: ReactNode;
  isFallback?: boolean;
  className?: string;
}

export function ControlChartPanel({
  title,
  meta,
  option,
  overlay,
  fallback,
  isFallback = false,
  className = '',
}: ControlChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const optionRef = useRef<EChartsCoreOption>(option);

  optionRef.current = option;

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let disposed = false;
    let cleanup = () => undefined;

    void (async () => {
      const [{ init, use }, { CanvasRenderer }, components, charts] = await Promise.all([
        import('echarts/core'),
        import('echarts/renderers'),
        import('echarts/components'),
        import('echarts/charts'),
      ]);

      use([
        CanvasRenderer,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.MarkLineComponent,
        charts.LineChart,
        charts.ScatterChart,
        charts.CustomChart,
      ]);

      if (disposed || !containerRef.current) {
        return;
      }

      const chart = init(containerRef.current, undefined, { renderer: 'canvas' });
      chartRef.current = chart;
      chart.setOption(optionRef.current, { notMerge: false, lazyUpdate: true });

      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(containerRef.current);

      cleanup = () => {
        observer.disconnect();
        chart.dispose();
        chartRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  return (
    <div className={`premium-lesson-tone-block premium-tone-slate ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="premium-lesson-title text-sm font-semibold">{title}</div>
        {meta ? <div className="premium-lesson-caption max-w-[72%] text-right text-[11px]">{meta}</div> : null}
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

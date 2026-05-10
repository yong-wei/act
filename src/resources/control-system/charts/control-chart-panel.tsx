'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

import { useTheme } from '@/components/providers/theme-provider';
import { DEFAULT_THEME } from '@/lib/theme-config';

import { applyControlChartTheme } from './control-chart-theme';

export interface ControlChartPanelProps {
  title: string;
  meta?: ReactNode;
  option: EChartsCoreOption;
  overlay?: ReactNode;
  onChartReady?: (chart: ECharts, container: HTMLDivElement) => void;
  fallback?: ReactNode;
  isFallback?: boolean;
  className?: string;
  chartClassName?: string;
}

export function ControlChartPanel({
  title,
  meta,
  option,
  overlay,
  onChartReady,
  fallback,
  isFallback = false,
  className = '',
  chartClassName = 'h-[520px]',
}: ControlChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const onChartReadyRef = useRef<typeof onChartReady>(onChartReady);
  const { mounted, theme } = useTheme();
  const themedOption = useMemo(
    () => applyControlChartTheme(option, mounted ? theme : DEFAULT_THEME),
    [mounted, option, theme],
  );
  const optionRef = useRef<EChartsCoreOption>(themedOption);

  optionRef.current = themedOption;
  onChartReadyRef.current = onChartReady;

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
        components.DataZoomComponent,
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
      onChartReadyRef.current?.(chart, containerRef.current);

      const observer = new ResizeObserver(() => {
        chart.resize();
        if (containerRef.current) {
          onChartReadyRef.current?.(chart, containerRef.current);
        }
      });
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
    chartRef.current?.setOption(themedOption, { notMerge: false, lazyUpdate: true });
  }, [themedOption]);

  return (
    <div className={`premium-lesson-tone-block premium-tone-slate ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{title}</div>
        {meta ? <div className="premium-lesson-caption max-w-[72%] text-right text-[11px]">{meta}</div> : null}
        {isFallback ? <div className="premium-lesson-caption text-[11px]">fixture fallback</div> : null}
      </div>
      <div className="relative mt-3 flex-1 overflow-hidden rounded-2xl border border-border/50 bg-background/55">
        <div ref={containerRef} className={`${chartClassName} w-full`} />
        {overlay ? <div className="pointer-events-none absolute inset-0">{overlay}</div> : null}
        {isFallback && fallback ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-100">
            {fallback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

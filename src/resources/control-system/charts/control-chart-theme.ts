import type { EChartsCoreOption } from 'echarts/core';

import type { ThemeMode } from '@/lib/theme-config';

type AxisOption = Record<string, unknown>;
type LegendOption = Record<string, unknown>;
type TooltipOption = Record<string, unknown>;
type SeriesOption = Record<string, unknown>;

export interface ControlChartThemeTokens {
  textPrimary: string;
  textSecondary: string;
  axisLine: string;
  splitLine: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
}

const CONTROL_CHART_THEMES: Record<ThemeMode, ControlChartThemeTokens> = {
  light: {
    textPrimary: 'rgba(51, 65, 85, 0.88)',
    textSecondary: 'rgba(71, 85, 105, 0.82)',
    axisLine: 'rgba(148, 163, 184, 0.55)',
    splitLine: 'rgba(148, 163, 184, 0.22)',
    tooltipBackground: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: 'rgba(148, 163, 184, 0.45)',
    tooltipText: '#0f172a',
  },
  dark: {
    textPrimary: 'rgba(226, 232, 240, 0.9)',
    textSecondary: 'rgba(226, 232, 240, 0.75)',
    axisLine: 'rgba(148, 163, 184, 0.45)',
    splitLine: 'rgba(148, 163, 184, 0.12)',
    tooltipBackground: 'rgba(15, 23, 42, 0.94)',
    tooltipBorder: 'rgba(148, 163, 184, 0.28)',
    tooltipText: '#e2e8f0',
  },
};

function mapAxis(axis: AxisOption, tokens: ControlChartThemeTokens): AxisOption {
  return {
    ...axis,
    axisLabel: {
      ...(axis.axisLabel as Record<string, unknown> | undefined),
      color: tokens.textSecondary,
    },
    nameTextStyle: {
      ...(axis.nameTextStyle as Record<string, unknown> | undefined),
      color: tokens.textPrimary,
    },
    axisLine: {
      ...(axis.axisLine as Record<string, unknown> | undefined),
      lineStyle: {
        ...(((axis.axisLine as Record<string, unknown> | undefined)?.lineStyle as Record<string, unknown> | undefined) ?? {}),
        color: tokens.axisLine,
      },
    },
    axisTick: {
      ...(axis.axisTick as Record<string, unknown> | undefined),
      lineStyle: {
        ...(((axis.axisTick as Record<string, unknown> | undefined)?.lineStyle as Record<string, unknown> | undefined) ?? {}),
        color: tokens.axisLine,
      },
    },
    splitLine: {
      ...(axis.splitLine as Record<string, unknown> | undefined),
      lineStyle: {
        ...(((axis.splitLine as Record<string, unknown> | undefined)?.lineStyle as Record<string, unknown> | undefined) ?? {}),
        color: tokens.splitLine,
      },
    },
  };
}

function mapLegend(legend: LegendOption, tokens: ControlChartThemeTokens): LegendOption {
  return {
    ...legend,
    textStyle: {
      ...(legend.textStyle as Record<string, unknown> | undefined),
      color: tokens.textPrimary,
    },
  };
}

function mapTooltip(tooltip: TooltipOption, tokens: ControlChartThemeTokens): TooltipOption {
  return {
    ...tooltip,
    backgroundColor: tokens.tooltipBackground,
    borderColor: tokens.tooltipBorder,
    textStyle: {
      ...(tooltip.textStyle as Record<string, unknown> | undefined),
      color: tokens.tooltipText,
    },
  };
}

function mapSeries(series: SeriesOption, tokens: ControlChartThemeTokens): SeriesOption {
  const markLine = series.markLine as Record<string, unknown> | undefined;
  if (!markLine) {
    return series;
  }

  return {
    ...series,
    markLine: {
      ...markLine,
      label: {
        ...((markLine.label as Record<string, unknown> | undefined) ?? {}),
        color: tokens.textSecondary,
      },
    },
  };
}

function mapMaybeArray<T extends Record<string, unknown>>(value: T | T[] | undefined, mapper: (item: T) => T): T | T[] | undefined {
  if (!value) {
    return value;
  }
  return Array.isArray(value) ? value.map((item) => mapper(item)) : mapper(value);
}

export function applyControlChartTheme(option: EChartsCoreOption, themeMode: ThemeMode): EChartsCoreOption {
  const tokens = CONTROL_CHART_THEMES[themeMode];

  return {
    ...option,
    textStyle: {
      ...(option.textStyle as Record<string, unknown> | undefined),
      color: tokens.textPrimary,
    },
    legend: mapMaybeArray(option.legend as LegendOption | LegendOption[] | undefined, (legend) => mapLegend(legend, tokens)),
    xAxis: mapMaybeArray(option.xAxis as AxisOption | AxisOption[] | undefined, (axis) => mapAxis(axis, tokens)),
    yAxis: mapMaybeArray(option.yAxis as AxisOption | AxisOption[] | undefined, (axis) => mapAxis(axis, tokens)),
    tooltip: option.tooltip ? mapTooltip(option.tooltip as TooltipOption, tokens) : option.tooltip,
    series: mapMaybeArray(option.series as SeriesOption | SeriesOption[] | undefined, (series) => mapSeries(series, tokens)) as EChartsCoreOption['series'],
  };
}

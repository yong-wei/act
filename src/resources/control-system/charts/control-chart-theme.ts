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
  rootLocusLine: string;
  rootLocusAsymptote: string;
  rootLocusStationaryPoint: string;
  rootLocusCrossingPoint: string;
  rootLocusOpenPole: string;
  rootLocusOpenZero: string;
  timeResponseLine: string;
  bodeMagnitudeLine: string;
  bodePhaseLine: string;
  nyquistLine: string;
  nyquistUnitCircle: string;
}

const CONTROL_CHART_THEMES: Record<ThemeMode, ControlChartThemeTokens> = {
  light: {
    textPrimary: 'rgba(30, 41, 59, 0.9)',
    textSecondary: 'rgba(71, 85, 105, 0.84)',
    axisLine: 'rgba(148, 163, 184, 0.55)',
    splitLine: 'rgba(148, 163, 184, 0.22)',
    tooltipBackground: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: 'rgba(148, 163, 184, 0.45)',
    tooltipText: '#0f172a',
    rootLocusLine: '#2563eb',
    rootLocusAsymptote: '#64748b',
    rootLocusStationaryPoint: '#7c3aed',
    rootLocusCrossingPoint: '#f97316',
    rootLocusOpenPole: '#dc2626',
    rootLocusOpenZero: '#d97706',
    timeResponseLine: '#0f766e',
    bodeMagnitudeLine: '#6d28d9',
    bodePhaseLine: '#be123c',
    nyquistLine: '#0f766e',
    nyquistUnitCircle: '#5b21b6',
  },
  dark: {
    textPrimary: 'rgba(241, 245, 249, 0.92)',
    textSecondary: 'rgba(203, 213, 225, 0.78)',
    axisLine: 'rgba(148, 163, 184, 0.45)',
    splitLine: 'rgba(148, 163, 184, 0.12)',
    tooltipBackground: 'rgba(15, 23, 42, 0.94)',
    tooltipBorder: 'rgba(148, 163, 184, 0.28)',
    tooltipText: '#e2e8f0',
    rootLocusLine: '#38bdf8',
    rootLocusAsymptote: '#94a3b8',
    rootLocusStationaryPoint: '#c084fc',
    rootLocusCrossingPoint: '#fb923c',
    rootLocusOpenPole: '#f87171',
    rootLocusOpenZero: '#fbbf24',
    timeResponseLine: '#22d3ee',
    bodeMagnitudeLine: '#a78bfa',
    bodePhaseLine: '#fb7185',
    nyquistLine: '#22d3ee',
    nyquistUnitCircle: '#a78bfa',
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
  const name = series.name;
  const rootLocusColor =
    name === '根轨迹' || name === '当前闭环极点'
      ? tokens.rootLocusLine
      : name === '根轨迹渐近线'
        ? tokens.rootLocusAsymptote
        : name === '分离/会合点'
          ? tokens.rootLocusStationaryPoint
          : name === '虚轴交点'
            ? tokens.rootLocusCrossingPoint
            : name === '开环极点'
              ? tokens.rootLocusOpenPole
              : name === '开环零点'
                ? tokens.rootLocusOpenZero
                : name === '响应'
                  ? tokens.timeResponseLine
                  : name === '幅频'
                    ? tokens.bodeMagnitudeLine
                    : name === '相频'
                      ? tokens.bodePhaseLine
                      : name === 'Nyquist 正频率支'
                        || name === 'Nyquist 负频率支'
                        || name === '无穷远闭合段'
                        || name === 'Nyquist 大圆弧'
                          ? tokens.nyquistLine
                          : name === '单位圆'
                            ? tokens.nyquistUnitCircle
                            : null;
  const nextSeries: SeriesOption = rootLocusColor
    ? {
        ...series,
        lineStyle: {
          ...((series.lineStyle as Record<string, unknown> | undefined) ?? {}),
          color: rootLocusColor,
        },
        itemStyle: {
          ...((series.itemStyle as Record<string, unknown> | undefined) ?? {}),
          color: name === '开环零点'
            ? ((series.itemStyle as Record<string, unknown> | undefined)?.color ?? 'rgba(255, 255, 255, 0)')
            : rootLocusColor,
          borderColor: name === '当前闭环极点' ? rootLocusColor : rootLocusColor,
        },
      }
    : series;

  if (!markLine) {
    return nextSeries;
  }

  return {
    ...nextSeries,
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

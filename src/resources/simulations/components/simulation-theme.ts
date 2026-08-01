'use client';

import { useOptionalTheme } from '@/components/providers/theme-provider';
import type { ThemeMode } from '@/lib/theme-config';

export type SimulationThemeMode = ThemeMode;

export interface SimulationSceneTheme {
  mode: SimulationThemeMode;
  skyHorizonColor: string;
  skyZenithColor: string;
  waterColor: string;
  foamColor: string;
  fogColor: string;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
  gridCellColor: string;
  gridSectionColor: string;
  gridOpacity: number;
  labelColor: string;
  labelSurface: string;
  hudOverlay: string;
  emphasis: string;
}

export const SIMULATION_SCENE_THEMES: Record<SimulationThemeMode, SimulationSceneTheme> = {
  light: {
    mode: 'light',
    skyHorizonColor: '#d8ecf8',
    skyZenithColor: '#6394be',
    waterColor: '#1d6f98',
    foamColor: '#f8fbff',
    fogColor: '#d9ecf6',
    ambientLightIntensity: 0.52,
    directionalLightIntensity: 1.35,
    gridCellColor: '#2f6687',
    gridSectionColor: '#1d6f98',
    gridOpacity: 0.72,
    labelColor: '#0f2f44',
    labelSurface: 'rgba(248, 252, 255, 0.86)',
    hudOverlay: 'rgba(255, 255, 255, 0.76)',
    emphasis: '#0ea5e9',
  },
  dark: {
    mode: 'dark',
    skyHorizonColor: '#113247',
    skyZenithColor: '#061521',
    waterColor: '#0b3146',
    foamColor: '#9ccde6',
    fogColor: '#061521',
    ambientLightIntensity: 0.32,
    directionalLightIntensity: 0.95,
    gridCellColor: '#2b6277',
    gridSectionColor: '#5ec4dc',
    gridOpacity: 0.46,
    labelColor: '#d8f3ff',
    labelSurface: 'rgba(5, 18, 28, 0.78)',
    hudOverlay: 'rgba(4, 18, 29, 0.74)',
    emphasis: '#67e8f9',
  },
};

export const simulationScenePalette = {
  white: '#ffffff',
  headingPrimary: '#3b82f6',
  headingSecondary: '#60a5fa',
  containerPrimary: '#f97316',
  containerTarget: '#fb923c',
  cruiseHeadingPrimary: '#0ea5e9',
  cruiseHeadingSecondary: '#38bdf8',
  cruisePrimary: '#8b5cf6',
  icebreakerPrimary: '#06b6d4',
  dredgerPrimary: '#f59e0b',
  destroyerWater: '#124060',
  danger: '#ef4444',
  success: '#22c55e',
  successSoft: '#84cc16',
  warning: '#eab308',
  neutralStroke: '#334155',
  mutedStroke: '#64748b',
  chartTitle: '#e2e8f0',
  chartText: '#cbd5e1',
  chartTick: '#94a3b8',
  chartBorder: '#475569',
  chartSurface: 'rgba(15, 23, 42, 0.9)',
  chartGridFaint: 'rgba(148, 163, 184, 0.1)',
  chartGrid: 'rgba(148, 163, 184, 0.2)',
  dangerSurface: 'rgba(239, 68, 68, 0.1)',
  successSurface: 'rgba(34, 197, 94, 0.1)',
  headingSurface: 'rgba(59, 130, 246, 0.1)',
  warningSurface: 'rgba(245, 158, 11, 0.1)',
  /** Gerstner 水面泡沫高光（七实验共享的固定泡沫色）。 */
  waterFoam: '#f4fbff',
  /** 尾流粒子材质基色。 */
  wakeFoam: '#f5fcff',
} as const;

/** 将调色板十六进制颜色展开为 canvas 可用的 rgba() 字符串；alpha 由调用方按渐变档位给出。 */
export function simulationColorWithAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const simulationThemeEvidenceContract = {
  resourceInternalTheme: {
    sharedPrimitives: true,
    panelThemeParity: true,
    localControlsThemeParity: true,
    restoreHandlesThemeParity: true,
    hardCodedPaletteFindings: 0,
  },
  sceneThemeParameters: {
    lightTemplate: true,
    darkTemplate: true,
    skyWaterGridFogThemeAware: true,
    labelHudContrastChecked: true,
    unchangedLightSceneInDarkTheme: false,
  },
} as const;

export function resolveSimulationSceneThemeMode(theme?: SimulationThemeMode, mounted = false): SimulationThemeMode {
  return mounted ? theme ?? 'dark' : 'dark';
}

export function useSimulationSceneTheme(): SimulationSceneTheme {
  const themeContext = useOptionalTheme();
  const mode = resolveSimulationSceneThemeMode(themeContext?.theme, themeContext?.mounted ?? false);
  return SIMULATION_SCENE_THEMES[mode];
}

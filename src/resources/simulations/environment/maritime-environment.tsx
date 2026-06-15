'use client';

/**
 * 海洋环境组合组件
 * 提供统一的天空、云层和海面渲染
 */

import { SkyDome } from './sky-dome';
import { ProceduralClouds } from './procedural-clouds';
import { WaveWater } from './wave-water';
import { SIMULATION_SCENE_THEMES, type SimulationSceneTheme } from '../components/simulation-theme';

interface MaritimeEnvironmentProps {
  /** 船舶位置 (用于海面跟随) */
  shipPosition?: { x: number; z: number };
  /** 海况等级 (1-6) */
  seaState?: number;
  /** 天空地平线颜色 */
  skyHorizonColor?: string;
  /** 天空天顶颜色 */
  skyZenithColor?: string;
  /** 水体颜色 */
  waterColor?: string;
  /** 是否显示云层 */
  showClouds?: boolean;
  /** 统一仿真场景主题 */
  sceneTheme?: SimulationSceneTheme;
}

export function MaritimeEnvironment({
  shipPosition,
  seaState = 3,
  skyHorizonColor = SIMULATION_SCENE_THEMES.light.skyHorizonColor,
  skyZenithColor = SIMULATION_SCENE_THEMES.light.skyZenithColor,
  waterColor = SIMULATION_SCENE_THEMES.light.waterColor,
  showClouds = true,
  sceneTheme,
}: MaritimeEnvironmentProps) {
  const skyHorizon = sceneTheme?.skyHorizonColor ?? skyHorizonColor;
  const skyZenith = sceneTheme?.skyZenithColor ?? skyZenithColor;
  const water = sceneTheme?.waterColor ?? waterColor;
  const foam = sceneTheme?.foamColor;
  const fog = sceneTheme?.fogColor ?? skyHorizon;

  return (
    <>
      <fog attach="fog" args={[fog, 4500, 18000]} />
      <SkyDome horizonColor={skyHorizon} zenithColor={skyZenith} />
      {showClouds && <ProceduralClouds />}
      <WaveWater shipPosition={shipPosition} seaState={seaState} waterColor={water} foamColor={foam} />
    </>
  );
}

'use client';

/**
 * 海洋环境组合组件
 * 提供统一的天空、云层和海面渲染
 */

import { SkyDome } from './sky-dome';
import { ProceduralClouds } from './procedural-clouds';
import { WaveWater } from './wave-water';

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
}

export function MaritimeEnvironment({
  shipPosition,
  seaState = 3,
  skyHorizonColor = '#d4e8f7',
  skyZenithColor = '#4a7ba7',
  waterColor = '#124060',
  showClouds = true,
}: MaritimeEnvironmentProps) {
  return (
    <>
      <SkyDome horizonColor={skyHorizonColor} zenithColor={skyZenithColor} />
      {showClouds && <ProceduralClouds />}
      <WaveWater shipPosition={shipPosition} seaState={seaState} waterColor={waterColor} />
    </>
  );
}

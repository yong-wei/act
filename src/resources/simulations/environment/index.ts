/**
 * 船舶仿真环境组件
 * 提供统一的天空、云层和海面渲染
 */

export { SkyDome } from './sky-dome';
export { ProceduralClouds } from './procedural-clouds';
export { WaveWater, waveParams, getWaveHeight } from './wave-water';

// 组合组件 - 提供完整的海洋环境
export { MaritimeEnvironment } from './maritime-environment';

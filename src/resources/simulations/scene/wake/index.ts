/**
 * 尾迹模块公开接口：Froude 活跃度、四族预算、确定性噪声、
 * 环形缓冲、增量几何与 R3F 粒子场组件。
 */
export {
  DEFAULT_WAKE_TRAIL_STYLE,
  allocateWakeCapacities,
  clamp01,
  computeWakeFamilyBudget,
  computeWakeSpeedActivity,
  computeThrusterWashActivity,
  knotsToMetersPerSecond,
  resolveWakeTrailStyle,
  smoothstep,
  smoothstep01,
  WAKE_SCENE_MAX_PARTICLES,
} from './wake-physics';
export type {
  ResolvedWakeTrailStyle,
  ThrusterWashActivity,
  WakeFamilyBudget,
  WakeSpeedActivity,
  WakeTrailStyle,
} from './wake-physics';
export {
  computeWakeFamilyCounts,
  countWakeFamilyTotal,
  createWakeTrailBuffer,
  hash01,
  hashSigned,
} from './wake-buffer';
export type {
  WakeAnchorSnapshot,
  WakeFamilyCounts,
  WakeParticleSlot,
  WakeTrailBuffer,
  WakeVec3,
} from './wake-buffer';
export {
  MIN_WAKE_PARTICLE_OPACITY,
  computeWakeEnvelope,
  createWakeTrailGeometry,
  forEachWakeParticleVisual,
  resolveWakeParticleVisual,
  updateWakeSprayGeometry,
  updateWakeTrailGeometry,
} from './wake-geometry';
export type { WakeFamily, WakeParticleVisual, WakeTrailGeometryHandle } from './wake-geometry';
export { WakeTrail, wakeSceneCapacityForTier } from './wake-trail';
export type { WakeQualityTier, WakeTrailProps } from './wake-trail';

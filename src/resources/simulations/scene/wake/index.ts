/**
 * 尾迹模块公开接口：Froude 活跃度、四族预算、确定性噪声、
 * 环形缓冲、增量几何与 R3F 粒子场组件。
 */
export {
  DEFAULT_WAKE_TRAIL_STYLE,
  clamp01,
  computeWakeFamilyBudget,
  computeWakeSpeedActivity,
  knotsToMetersPerSecond,
  resolveWakeTrailStyle,
  smoothstep,
  smoothstep01,
} from './wake-physics';
export type {
  ResolvedWakeTrailStyle,
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
  resolveWakeParticleVisual,
  updateWakeTrailGeometry,
} from './wake-geometry';
export type { WakeFamily, WakeParticleVisual, WakeTrailGeometryHandle } from './wake-geometry';
export { WakeTrail } from './wake-trail';
export type { WakeQualityTier, WakeTrailProps } from './wake-trail';

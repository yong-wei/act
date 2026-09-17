'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import type { SceneShipVisualProfile } from '../types';
import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { createWakeTrailBuffer, type WakeAnchorSnapshot } from './wake-buffer';
import { createWakeTrailGeometry, updateWakeTrailGeometry } from './wake-geometry';
import { computeWakeSpeedActivity, type WakeTrailStyle } from './wake-physics';
import { simulationColorWithAlpha, simulationScenePalette } from '../../components/simulation-theme';

/**
 * 尾迹粒子场组件：每帧记录船尾/肩部锚点，驱动环形缓冲发射与淘汰，
 * 只更新 geometry 属性并置 needsUpdate（不重建 BufferGeometry）。
 * 材质与源实现一致：meshBasicMaterial + Canvas alphaMap + 顶点色 + 加法混合。
 */

declare global {
  interface Window {
    /** QA 观测面（默认关闭）：页面置为 {} 后，各尾迹实例每帧写入活跃粒子数。 */
    __wakeTrailLiveCounts?: Record<string, number>;
  }
}

let wakeTrailDebugSeq = 0;

/** 质量档位粒子缩放：高档全量、中档减半、低档四分之一（change 设计第 6 节）。 */
const PARTICLE_SCALE_BY_TIER = {
  high: 1,
  medium: 0.5,
  low: 0.25,
} as const;

export type WakeQualityTier = keyof typeof PARTICLE_SCALE_BY_TIER;

export interface WakeTrailProps {
  /** 船舶视觉档案：船长/设计航速（Froude 语义）与尾迹发射锚点（模型局部坐标）。 */
  readonly profile: SceneShipVisualProfile;
  /** 船舶位姿：世界坐标位置 + 航向角（弧度，forward = (sin h, 0, cos h)）。 */
  readonly shipTransform: {
    readonly position: readonly [number, number, number];
    readonly heading: number;
  };
  /** 质量档位：决定粒子容量上限。 */
  readonly qualityTier: WakeQualityTier;
  /** 播放状态：暂停时停止发射（活跃度数零即不再产生新粒子）；
   * 老化时钟持续推进，存量粒子经各自生命周期后完全消散。 */
  readonly playing: boolean;
  /** 世界坐标中的船长：默认取档案船长（1:1 世界）。 */
  readonly worldShipLength?: number;
  /** 水面高度（世界坐标）：默认取船尾锚点世界高度；接入海面模块后可显式传入。 */
  readonly waterY?: number;
  /** 逐粒子按世界 (x,z) 采样水面高度的回调（优先级高于 waterY；尾迹随涌浪连续贴水）。 */
  readonly waterYSampler?: (x?: number, z?: number) => number;
  /** 场景预算份额（#2101）：双桨/多推进器各 Trail 按份额共享全场预算（缺省 1 全额）。 */
  readonly budgetShare?: number;
  /** 推进器洗流活跃度采样（#2101）：平台零平移时局部泡沫源；缺省无（不伪造推进活动）。 */
  readonly washActivitySampler?: () => number;
  /** 局部洗流专用 Trail（#2101 二轮复审）：kelvin 与 farFoam 全抑制（不产生远场泡沫/航行尾波）。 */
  readonly localWashOnly?: boolean;
  /** 显式航速采样（米/秒，模型语义）：提供时替代位姿差分，保证播放倍率不改变 Froude 活跃度。 */
  readonly worldSpeedSampler?: () => number;
  /** 逐帧发射器世界位置（语义推进器节点）：提供且非 null 时优先于 profile 手填锚点。 */
  readonly emitterWorldSampler?: () => readonly [number, number, number] | null;
  /** 是否发射开尔文臂粒子（源默认模式为含开尔文）。 */
  readonly includeKelvin?: boolean;
  /** 样式覆盖：挂载时定型，运行期变更不生效（切档重建除外）。 */
  readonly style?: WakeTrailStyle;
}

/** 粒子 alpha 贴图：纵向主体渐变 × 横向边缘渐隐 × 内部纹理 stroke，与源实现一致。 */
const createWakeParticleAlphaTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const wakeWhite = (alpha: number) => simulationColorWithAlpha(simulationScenePalette.white, alpha);
  const bodyGradient = ctx.createLinearGradient(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  bodyGradient.addColorStop(0, wakeWhite(0));
  bodyGradient.addColorStop(0.08, wakeWhite(0.2));
  bodyGradient.addColorStop(0.34, wakeWhite(0.85));
  bodyGradient.addColorStop(0.7, wakeWhite(0.65));
  bodyGradient.addColorStop(1, wakeWhite(0));
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.18, canvas.height * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const edgeGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeGradient.addColorStop(0, wakeWhite(0));
  edgeGradient.addColorStop(0.28, wakeWhite(0.72));
  edgeGradient.addColorStop(0.5, wakeWhite(1));
  edgeGradient.addColorStop(0.72, wakeWhite(0.72));
  edgeGradient.addColorStop(1, wakeWhite(0));
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = wakeWhite(0.18);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 12;
  ctx.shadowColor = wakeWhite(0.2);
  for (let index = 0; index < 7; index += 1) {
    const x = canvas.width * (0.34 + (index / 6) * 0.32);
    ctx.beginPath();
    ctx.moveTo(x, canvas.height * 0.08);
    ctx.quadraticCurveTo(
      x + (index % 2 === 0 ? 10 : -10),
      canvas.height * 0.42,
      x + (index % 2 === 0 ? -6 : 6),
      canvas.height * 0.92
    );
    ctx.stroke();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
};

/** 局部锚点 → 世界坐标：绕 Y 轴按航向旋转后平移（局部 +Z 为船艏方向）。 */
const anchorToWorld = (
  local: readonly [number, number, number],
  position: readonly [number, number, number],
  sinH: number,
  cosH: number
): [number, number, number] => [
  position[0] + local[0] * cosH + local[2] * sinH,
  position[1] + local[1],
  position[2] - local[0] * sinH + local[2] * cosH,
];

export interface WakeEmitterAnchors {
  readonly stern: [number, number, number];
  readonly portShoulder: [number, number, number];
  readonly starboardShoulder: [number, number, number];
}

/**
 * 发射锚点解析：提供 emitterOverride（语义推进器节点的逐帧世界位置）时以其为
 * 发射点、肩部按航向对称外推；否则回退 profile 手填锚点。
 */
export function resolveEmitterAnchors(
  profile: SceneShipVisualProfile,
  position: readonly [number, number, number],
  heading: number,
  emitterOverride?: readonly [number, number, number] | null,
): WakeEmitterAnchors {
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  if (emitterOverride) {
    const stern: [number, number, number] = [emitterOverride[0], emitterOverride[1], emitterOverride[2]];
    const shoulder = (lateral: number, forward: number): [number, number, number] => [
      stern[0] + lateral * cosH + forward * sinH,
      stern[1],
      stern[2] - lateral * sinH + forward * cosH,
    ];
    return {
      stern,
      portShoulder: shoulder(6, 30),
      starboardShoulder: shoulder(-6, 30),
    };
  }
  return {
    stern: anchorToWorld(profile.wakeAnchors.stern, position, sinH, cosH),
    portShoulder: anchorToWorld(profile.wakeAnchors.portShoulder, position, sinH, cosH),
    starboardShoulder: anchorToWorld(profile.wakeAnchors.starboardShoulder, position, sinH, cosH),
  };
}

export function WakeTrail({
  profile,
  shipTransform,
  qualityTier,
  playing,
  worldShipLength,
  waterY,
  waterYSampler,
  budgetShare = 1,
  washActivitySampler,
  localWashOnly = false,
  worldSpeedSampler,
  emitterWorldSampler,
  includeKelvin = true,
  style,
}: WakeTrailProps) {
  // 样式在挂载时定型，避免父组件行内对象每帧重建缓冲
  const styleRef = useRef(style);
  styleRef.current = style;

  const capacity = useMemo(() => {
    const resolved = styleRef.current?.maxParticles ?? 2200;
    return Math.max(1, Math.round(resolved * PARTICLE_SCALE_BY_TIER[qualityTier]));
  }, [qualityTier]);

  const buffer = useMemo(
    () => createWakeTrailBuffer({ capacity, style: styleRef.current }),
    [capacity]
  );
  const handle = useMemo(() => createWakeTrailGeometry(capacity), [capacity]);
  const alphaTexture = useMemo(() => createWakeParticleAlphaTexture(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        alphaMap: alphaTexture,
        color: simulationScenePalette.wakeFoam,
        vertexColors: true,
        transparent: true,
        opacity: buffer.style.foamOpacity * 0.28,
        alphaTest: 0.002,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [alphaTexture, buffer]
  );

  const frameState = useRef({
    simTime: 0,
    emitAccumulator: 0,
    pathLength: 0,
    lastX: null as number | null,
    lastZ: null as number | null,
  });
  const debugId = useMemo(() => `trail-${wakeTrailDebugSeq++}`, []);
  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.__wakeTrailLiveCounts) {
      delete window.__wakeTrailLiveCounts[debugId];
    }
  }, [debugId]);

  const marineVisualTime = useMarineVisualTime();

  useFrame((frameStateArg, delta) => {
    if (!buffer.style.enabled) {
      return;
    }
    const state = frameState.current;
    const dt = Math.max(0, delta);
    // 尾迹时间源 = 共享视觉时钟（同帧唯一；暂停下环境继续推进，存量粒子按政策走完生命周期）。
    state.simTime = marineVisualTime(frameStateArg, delta);

    if (playing) {
      const { position, heading } = shipTransform;
      let worldSpeed = worldSpeedSampler?.() ?? 0;
      if (worldSpeedSampler === undefined) {
        if (state.lastX !== null && state.lastZ !== null && dt > 1e-6) {
          const distance = Math.hypot(position[0] - state.lastX, position[2] - state.lastZ);
          worldSpeed = distance / dt;
        }
      }
      if (state.lastX !== null && state.lastZ !== null && dt > 1e-6) {
        state.pathLength += Math.hypot(position[0] - state.lastX, position[2] - state.lastZ);
      }
      state.lastX = position[0];
      state.lastZ = position[2];

      const transitActivity = computeWakeSpeedActivity({
        worldSpeed,
        worldShipLength: worldShipLength ?? profile.shipLengthMeters,
        profile,
        speedCoupling: buffer.style.speedCoupling,
        minLifetimeScale: buffer.style.minLifetimeScale,
      });
      // 推进器洗流（#2101）：只抬升 core/foam（局部泡沫），不产生 Kelvin/远场——
      // 平台零平移时不编造航行尾波；航行船保持其更大的转移活跃度。
      const wash = washActivitySampler?.() ?? 0;
      const activity = localWashOnly
        ? {
            ...transitActivity,
            wakeActivity: wash * 0.6,
            foamActivity: wash,
            kelvinActivity: 0,
          }
        : wash > 0
          ? {
              ...transitActivity,
              wakeActivity: Math.max(transitActivity.wakeActivity, wash * 0.6),
              foamActivity: Math.max(transitActivity.foamActivity, wash),
            }
          : transitActivity;

      state.emitAccumulator += dt;
      if (state.emitAccumulator >= buffer.style.emitIntervalSeconds) {
        state.emitAccumulator = 0;
        const anchors = resolveEmitterAnchors(profile, [position[0], position[1], position[2]], heading, emitterWorldSampler?.() ?? null);
        const snapshot: WakeAnchorSnapshot = {
          stern: anchors.stern,
          portShoulder: anchors.portShoulder,
          starboardShoulder: anchors.starboardShoulder,
          forwardX: Math.sin(heading),
          forwardZ: Math.cos(heading),
          waterY: waterYSampler?.() ?? waterY ?? anchors.stern[1],
          worldShipLength: worldShipLength ?? profile.shipLengthMeters,
          pathLength: state.pathLength,
        };
        // 场景预算份额（#2101）：双桨/多推进器共享全场预算，不按实例倍增；
        // 局部洗流 Trail 抑制远场泡沫份额（farFoam，二轮复审）。
        buffer.emit({
          now: state.simTime,
          activity,
          anchors: snapshot,
          includeKelvin,
          emissionRate: budgetShare,
          farFoamScale: localWashOnly ? 0 : 1,
        });
      }
    }

    // 老化与几何刷新不受播放门控：停发后存量粒子走完生命周期并完全消散。
    buffer.update(state.simTime, state.pathLength);
    updateWakeTrailGeometry(handle, buffer, state.simTime, waterYSampler);
    if (typeof window !== 'undefined' && window.__wakeTrailLiveCounts) {
      window.__wakeTrailLiveCounts[debugId] = buffer.liveCount();
    }
  });

  if (!buffer.style.enabled) {
    return null;
  }

  return <mesh geometry={handle.geometry} material={material} renderOrder={9} frustumCulled={false} />;
}

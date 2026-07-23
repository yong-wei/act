'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import type { SceneShipVisualProfile } from '../types';
import { createWakeTrailBuffer, type WakeAnchorSnapshot } from './wake-buffer';
import { createWakeTrailGeometry, updateWakeTrailGeometry } from './wake-geometry';
import { computeWakeSpeedActivity, type WakeTrailStyle } from './wake-physics';

/**
 * 尾迹粒子场组件：每帧记录船尾/肩部锚点，驱动环形缓冲发射与淘汰，
 * 只更新 geometry 属性并置 needsUpdate（不重建 BufferGeometry）。
 * 材质与源实现一致：meshBasicMaterial + Canvas alphaMap + 顶点色 + 加法混合。
 */

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
  /** 播放状态：暂停时冻结发射与老化（尾迹静止）。 */
  readonly playing: boolean;
  /** 世界坐标中的船长：默认取档案船长（1:1 世界）。 */
  readonly worldShipLength?: number;
  /** 水面高度（世界坐标）：默认取船尾锚点世界高度；接入海面模块后可显式传入。 */
  readonly waterY?: number;
  /** 逐帧采样水面高度的回调（优先级高于 waterY；用于让尾迹随几何涌浪起伏）。 */
  readonly waterYSampler?: () => number;
  /** 显式航速采样（米/秒，模型语义）：提供时替代位姿差分，保证播放倍率不改变 Froude 活跃度。 */
  readonly worldSpeedSampler?: () => number;
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
  const bodyGradient = ctx.createLinearGradient(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  bodyGradient.addColorStop(0, 'rgba(255,255,255,0)');
  bodyGradient.addColorStop(0.08, 'rgba(255,255,255,0.2)');
  bodyGradient.addColorStop(0.34, 'rgba(255,255,255,0.85)');
  bodyGradient.addColorStop(0.7, 'rgba(255,255,255,0.65)');
  bodyGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.18, canvas.height * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const edgeGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeGradient.addColorStop(0, 'rgba(255,255,255,0)');
  edgeGradient.addColorStop(0.28, 'rgba(255,255,255,0.72)');
  edgeGradient.addColorStop(0.5, 'rgba(255,255,255,1)');
  edgeGradient.addColorStop(0.72, 'rgba(255,255,255,0.72)');
  edgeGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(255,255,255,0.2)';
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

export function WakeTrail({
  profile,
  shipTransform,
  qualityTier,
  playing,
  worldShipLength,
  waterY,
  waterYSampler,
  worldSpeedSampler,
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
        color: '#f5fcff',
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

  useFrame((_, delta) => {
    if (!playing || !buffer.style.enabled) {
      return;
    }
    const state = frameState.current;
    const dt = Math.max(0, delta);
    state.simTime += dt;

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

    const activity = computeWakeSpeedActivity({
      worldSpeed,
      worldShipLength: worldShipLength ?? profile.shipLengthMeters,
      profile,
      speedCoupling: buffer.style.speedCoupling,
      minLifetimeScale: buffer.style.minLifetimeScale,
    });

    state.emitAccumulator += dt;
    if (state.emitAccumulator >= buffer.style.emitIntervalSeconds) {
      state.emitAccumulator = 0;
      const sinH = Math.sin(heading);
      const cosH = Math.cos(heading);
      const stern = anchorToWorld(profile.wakeAnchors.stern, position, sinH, cosH);
      const snapshot: WakeAnchorSnapshot = {
        stern,
        portShoulder: anchorToWorld(profile.wakeAnchors.portShoulder, position, sinH, cosH),
        starboardShoulder: anchorToWorld(profile.wakeAnchors.starboardShoulder, position, sinH, cosH),
        forwardX: sinH,
        forwardZ: cosH,
        waterY: waterYSampler?.() ?? waterY ?? stern[1],
        worldShipLength: worldShipLength ?? profile.shipLengthMeters,
        pathLength: state.pathLength,
      };
      buffer.emit({ now: state.simTime, activity, anchors: snapshot, includeKelvin });
    }

    buffer.update(state.simTime, state.pathLength);
    updateWakeTrailGeometry(handle, buffer, state.simTime);
  });

  if (!buffer.style.enabled) {
    return null;
  }

  return <mesh geometry={handle.geometry} material={material} renderOrder={9} frustumCulled={false} />;
}

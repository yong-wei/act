'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import type { SceneShipVisualProfile } from '../types';
import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { VESSEL_FOAM_RATE_PER_SECOND } from '../water/foam-history';
import { readMarineFoamFieldFromScene } from '../water/foam-history-layer';
import { createWakeTrailBuffer, type WakeAnchorSnapshot } from './wake-buffer';
import {
  createWakeTrailGeometry,
  forEachWakeParticleVisual,
  updateWakeSprayGeometry,
  updateWakeTrailGeometry,
} from './wake-geometry';
import {
  computeWakeSpeedActivity,
  WAKE_SCENE_MAX_PARTICLES,
  type WakeTrailStyle,
} from './wake-physics';
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

/** 档位场景总容量（#2115 硬预算基数）：多 Trail 经 allocateWakeCapacities 切分。 */
export const wakeSceneCapacityForTier = (tier: WakeQualityTier): number =>
  Math.max(1, Math.round(WAKE_SCENE_MAX_PARTICLES * PARTICLE_SCALE_BY_TIER[tier]));

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
  /**
   * 分配的槽位容量（#2115 硬预算）：多推进器场景由 allocateWakeCapacities 切分
   * 场景总容量后传入（环形缓冲容量 = 分配值）；缺省按档位缩放的全额容量。
   */
  readonly capacity?: number;
  /** 飞沫受光（#2115）：与水材质同源太阳方向/辐照（缺省开阔海默认）。 */
  readonly sunDirection?: THREE.Vector3;
  readonly sunIllumination?: number;
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

/** 船艏触水沉积速率（密度/秒 × wakeActivity；#2115 船体源）。 */
const BOW_FOAM_RATE_PER_SECOND = 1.8;
/** 船艏沉积冲点半径：max(6m, 船长 × 0.055)。 */
const bowFoamRadiusMeters = (worldShipLength: number) =>
  Math.max(6, worldShipLength * 0.055);

/**
 * 飞沫材质（#2115）：受太阳辐照的正常混合 quad——替换不受光 additive 全量尾迹；
 * 飞沫近似朝上受光（与水材质同源公式 light×0.65 + 0.35×辐照），随场景雾衰减。
 */
const createWakeSprayMaterial = ({
  alphaTexture,
  color,
  sunDirection,
  sunIllumination,
}: {
  alphaTexture: THREE.Texture;
  color: THREE.ColorRepresentation;
  sunDirection: THREE.Vector3;
  sunIllumination: number;
}): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      uAlphaMap: { value: alphaTexture },
      uColor: { value: new THREE.Color(color) },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uSunIllumination: { value: sunIllumination },
      uOpacity: { value: 0.3 },
      // fog uniforms 由 renderer 按 scene.fog 刷新（材质 fog: true）。
      fogColor: { value: new THREE.Color(0xffffff) },
      fogNear: { value: 1 },
      fogFar: { value: 2000 },
      fogDensity: { value: 0.0002 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vAlpha = color.r;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAlphaMap;
      uniform vec3 uColor;
      uniform vec3 uSunDirection;
      uniform float uSunIllumination;
      uniform float uOpacity;
      #include <fog_pars_fragment>
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float alpha = texture2D(uAlphaMap, vUv).a * vAlpha * uOpacity;
        if (alpha < 0.003) discard;
        float light = max(uSunDirection.y, 0.0) * uSunIllumination;
        vec3 lit = uColor * (light * 0.65 + 0.35 * uSunIllumination);
        gl_FragColor = vec4(lit, alpha);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: true,
  });

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
  capacity,
  sunDirection = new THREE.Vector3(0.45, 0.75, 0.35),
  sunIllumination = 1,
  style,
}: WakeTrailProps) {
  // 样式在挂载时定型，避免父组件行内对象每帧重建缓冲
  const styleRef = useRef(style);
  styleRef.current = style;

  const resolvedCapacity = useMemo(() => {
    if (capacity !== undefined) return Math.max(1, Math.round(capacity));
    const resolved = styleRef.current?.maxParticles ?? 2200;
    return Math.max(1, Math.round(resolved * PARTICLE_SCALE_BY_TIER[qualityTier]));
  }, [qualityTier, capacity]);

  const buffer = useMemo(
    () => createWakeTrailBuffer({ capacity: resolvedCapacity, style: styleRef.current }),
    [resolvedCapacity]
  );
  const handle = useMemo(() => createWakeTrailGeometry(resolvedCapacity), [resolvedCapacity]);
  const alphaTexture = useMemo(() => createWakeParticleAlphaTexture(), []);
  // 泡沫历史场（#2115，P1 修复）：尾迹 Rig 与水面互为兄弟节点，Context 不可达——
  // 逐帧从 R3F scene.userData 读取（水面晚挂载/卸载时自动过渡）。场存在且船源
  // 归因开启 → 沉积模式（贴水泡沫由水面材质呈现，quad 只保留少量受光飞沫）；
  // 无场时保持既有 additive 全量尾迹。
  const scene = useThree((state) => state.scene);
  const sprayMaterial = useMemo(
    () =>
      createWakeSprayMaterial({
        alphaTexture,
        color: simulationScenePalette.wakeFoam,
        sunDirection,
        sunIllumination,
      }),
    [alphaTexture, sunDirection, sunIllumination]
  );
  const legacyMaterial = useMemo(
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
  const meshRef = useRef<THREE.Mesh>(null);

  const frameState = useRef({
    simTime: 0,
    lastVisualTime: null as number | null,
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
    // 逐帧解析泡沫场与沉积门控（水面可能晚于尾迹挂载或中途卸载）。
    const foamField = readMarineFoamFieldFromScene(scene);
    // 三态区分（P2 修复）：无场=兼容回退（additive 全量尾迹）；场+船源开=沉积
    // 模式（场泡沫 + 少量受光飞沫）；场+船源显式关闭=归因隔离（不渲染任何
    // 船源泡沫——"只自然源/全关"镜头不得再显示 legacy 船舶尾迹）。
    const vesselFoamSuppressed = foamField !== null && !foamField.attribution.vessel;
    const depositToField = foamField !== null && foamField.attribution.vessel;
    if (meshRef.current) {
      meshRef.current.visible = !vesselFoamSuppressed;
      const targetMaterial = depositToField ? sprayMaterial : legacyMaterial;
      if (meshRef.current.material !== targetMaterial) {
        meshRef.current.material = targetMaterial;
      }
    }
    const state = frameState.current;
    const dt = Math.max(0, delta);
    // 尾迹时间源 = 共享视觉时钟（同帧唯一；暂停下环境继续推进，存量粒子按政策走完生命周期）。
    state.simTime = marineVisualTime(frameStateArg, delta);
    // 沉积积分用视觉时间增量（倍速/暂停下与场推进同口径；钳制防长帧超额沉积）。
    const visualDelta = state.lastVisualTime === null
      ? 0
      : Math.min(Math.max(state.simTime - state.lastVisualTime, 0), 0.25);
    state.lastVisualTime = state.simTime;
    // 当帧源活跃度（P2 修复）：沉积只发生在推进/洗流真实活跃的帧——
    // 停推/暂停后存量粒子只经场衰减消散，不再被反复补沉积。
    let vesselSourceActive = false;

    // 归因隔离（P2 修复）：场存在但船源显式关闭时不发射、不沉积、不绘制；
    // 时间推进与老化仍每帧执行（存量粒子自然消散）。
    if (playing && !vesselFoamSuppressed) {
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
      vesselSourceActive = transitActivity.wakeActivity > 0.01 || wash > 0.01;
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

      // 船艏触水源（#2115）：对水速度经 Froude 活跃度驱动的艏部沉积，
      // 按视觉时间秒积分（不随帧率翻倍）；零速/停推时自然停止。
      // 只用转移活跃度——局部洗流 Trail（零平移平台）不产生艏波。
      if (depositToField && foamField && visualDelta > 0 && transitActivity.wakeActivity > 0.01) {
        const length = worldShipLength ?? profile.shipLengthMeters;
        const bowWorld: [number, number, number] = [
          shipTransform.position[0] + Math.sin(shipTransform.heading) * length * 0.45,
          shipTransform.position[1],
          shipTransform.position[2] + Math.cos(shipTransform.heading) * length * 0.45,
        ];
        foamField.deposit(
          bowWorld[0],
          bowWorld[2],
          bowFoamRadiusMeters(length),
          BOW_FOAM_RATE_PER_SECOND * transitActivity.wakeActivity * visualDelta
        );
      }
    }

    // 老化不受播放门控：停发后存量粒子走完生命周期并完全消散。
    buffer.update(state.simTime, state.pathLength);

    if (vesselFoamSuppressed) {
      // 归因隔离：mesh 已隐藏，跳过沉积与几何刷新（不绘制任何船源泡沫）。
    } else if (depositToField && foamField) {
      // 场模式（P2 修复）：几何始终为受限飞沫子集（是否沉积与使用哪种几何分开
      // ——停推/暂停时不再让全量 quad 以 spray 材质突然重现）。
      if (visualDelta > 0 && vesselSourceActive) {
        // 贴水泡沫沉积（#2115）：逐粒子视觉（世界位置 + 年龄/活跃度加权不透明度）
        // 按秒积分写入共享密度场；转弯后旧泡沫留在原世界轨迹，随场输运/衰减消散。
        const amount = VESSEL_FOAM_RATE_PER_SECOND * visualDelta;
        forEachWakeParticleVisual(buffer, state.simTime, (visual) => {
          foamField.deposit(
            visual.center[0],
            visual.center[2],
            Math.max(3.5, visual.width * 0.7),
            amount * visual.opacity
          );
        }, waterYSampler);
      }
      updateWakeSprayGeometry(handle, buffer, state.simTime, waterYSampler);
    } else {
      updateWakeTrailGeometry(handle, buffer, state.simTime, waterYSampler);
    }
    if (typeof window !== 'undefined' && window.__wakeTrailLiveCounts) {
      window.__wakeTrailLiveCounts[debugId] = buffer.liveCount();
    }
  });

  if (!buffer.style.enabled) {
    return null;
  }

  return (
    <mesh
      ref={meshRef}
      name="marine-wake"
      geometry={handle.geometry}
      material={legacyMaterial}
      renderOrder={9}
      frustumCulled={false}
    />
  );
}

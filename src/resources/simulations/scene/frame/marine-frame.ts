/**
 * 海洋场景统一帧契约（#2097）：只读帧快照、共享视觉时钟、世界坐标与姿态所有权。
 *
 * 纯模块：不依赖 React/three/R3F，行为可被纯函数测试钉住。
 * 契约边界（见 openspec/changes/unify-marine-scene-runtime）：
 * - 一帧只生成一份冻结快照；水/船/尾迹/标注/光照同帧消费同一份。
 * - 视觉时钟独立于数值推进（SimulationClock/Rust-WASM 保持数值权威）；
 *   默认暂停下环境可继续，推进/发射服从 advancing；回放与 QA 可注入确定时间。
 * - 世界坐标与渲染局部坐标分离：波相位锚定世界点，原点移动不改变同一世界点的相位。
 * - heave/pitch/roll 逐自由度声明 telemetry / visual-water / fixed 所有权；
 *   telemetry 自由度只读展示，不得被视觉响应覆盖或叠加。
 */

/** 逐自由度姿态所有权。 */
export type MarinePoseDofOwnership = 'telemetry' | 'visual-water' | 'fixed';

export interface MarinePoseOwnership {
  readonly heave: MarinePoseDofOwnership;
  readonly pitch: MarinePoseDofOwnership;
  readonly roll: MarinePoseDofOwnership;
}

export interface MarineWorldPose {
  /** 世界坐标位置（米）。 */
  readonly x: number;
  readonly z: number;
  /** 场景视觉航向（弧度，见 scene/heading.ts 的平台→场景适配）。 */
  readonly headingRad: number;
}

export interface MarineRenderOrigin {
  readonly x: number;
  readonly z: number;
}

/** 世界空间波高采样器（含水面基准高度；对同一世界点与时间结果确定）。 */
export type MarineWorldWaterSampler = (worldX: number, worldZ: number, timeSeconds: number) => number;

export interface MarineFrameSnapshot {
  readonly worldPose: MarineWorldPose;
  readonly renderOrigin: MarineRenderOrigin;
  readonly simulationTimeSeconds: number;
  readonly visualTimeSeconds: number;
  readonly advancing: boolean;
  readonly playbackRate: number;
  readonly ownership: MarinePoseOwnership;
  /** 环境预设与画质档位（表现成本与光照来源；不改变波场基准与姿态所有权）。 */
  readonly environmentPresetId: string | null;
  readonly qualityTier: string | null;
  /** 共享世界空间波高采样：同一世界点 + 同一时间返回同一高度（含原点补偿）。 */
  readonly sampleWaterHeight: (worldX: number, worldZ: number) => number;
}

export interface MarineFrameInputs {
  readonly worldPoseSampler: () => MarineWorldPose;
  /** 渲染原点（跟船水面网格中心）；缺省跟船位。 */
  readonly renderOriginSampler?: () => MarineRenderOrigin;
  readonly simulationTimeSampler: () => number;
  /** 数值推进门控（推进/发射服从；不影响环境视觉时钟的默认连续推进）。 */
  readonly advancingSampler: () => boolean;
  readonly playbackRateSampler?: () => number;
  readonly waterSampler: MarineWorldWaterSampler;
  readonly ownership: MarinePoseOwnership;
  readonly environmentPresetIdSampler?: () => string | null;
  readonly qualityTierSampler?: () => string | null;
}

/** 共享视觉时钟：可注入、可 seek/reset 的单调时间；不读任何墙钟。 */
export interface MarineVisualClock {
  readonly timeSeconds: () => number;
  /** 推进（由本帧首个消费者调用；delta 为显示帧时长，不含暂停门控）。 */
  readonly advance: (deltaSeconds: number) => void;
  /** 注入确定时间（QA/回放）。 */
  readonly seek: (timeSeconds: number) => void;
  /** 回到 epoch（与重挂载语义同源；尾迹等历史消费者经 React key 重挂载同步清空）。 */
  readonly reset: () => void;
}

export function createMarineVisualClock(options: { initialTimeSeconds?: number } = {}): MarineVisualClock {
  let time = options.initialTimeSeconds ?? 0;
  return {
    timeSeconds: () => time,
    advance: (deltaSeconds) => {
      if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) time += deltaSeconds;
    },
    seek: (timeSeconds) => {
      if (Number.isFinite(timeSeconds) && timeSeconds >= 0) time = timeSeconds;
    },
    reset: () => {
      time = options.initialTimeSeconds ?? 0;
    },
  };
}

export interface MarineFrameRunner {
  /**
   * 本帧首个消费者调用：推进视觉时钟并生成冻结快照；同帧后续调用返回同一对象。
   * stamp 为逐帧唯一单调值（R3F 传入 clock.elapsedTime；纯测试传递增整数）。
   */
  readonly consumeFrame: (stamp: number, deltaSeconds: number) => MarineFrameSnapshot;
  /** 读取最近一份快照（引擎在数值推进后采样用；首帧前为 null）。 */
  readonly latest: () => MarineFrameSnapshot | null;
  readonly clock: MarineVisualClock;
}

export function createMarineFrameRunner(inputs: MarineFrameInputs): MarineFrameRunner {
  const clock = createMarineVisualClock();
  let lastStamp: number | null = null;
  let current: MarineFrameSnapshot | null = null;

  const build = (): MarineFrameSnapshot => {
    const worldPose = inputs.worldPoseSampler();
    const renderOrigin = inputs.renderOriginSampler?.() ?? { x: worldPose.x, z: worldPose.z };
    const playbackRate = inputs.playbackRateSampler?.() ?? 1;
    const visualTimeSeconds = clock.timeSeconds();
    const snapshot: MarineFrameSnapshot = {
      worldPose,
      renderOrigin,
      simulationTimeSeconds: inputs.simulationTimeSampler(),
      visualTimeSeconds,
      advancing: inputs.advancingSampler(),
      playbackRate,
      ownership: inputs.ownership,
      environmentPresetId: inputs.environmentPresetIdSampler?.() ?? null,
      qualityTier: inputs.qualityTierSampler?.() ?? null,
      sampleWaterHeight: (worldX, worldZ) => inputs.waterSampler(worldX, worldZ, visualTimeSeconds),
    };
    return Object.freeze(snapshot);
  };

  return {
    clock,
    consumeFrame: (stamp, deltaSeconds) => {
      if (stamp !== lastStamp) {
        lastStamp = stamp;
        clock.advance(deltaSeconds);
        current = build();
      }
      return current!;
    },
    latest: () => current,
  };
}

/**
 * 按所有权解析视觉姿态：telemetry 自由度原样展示（只读），visual-water 取共享
 * 波场采样结果，fixed 保持 0。质量/预设切换不进入此函数——所有权不随画质变化。
 */
export function resolveMarineVisualPose(input: {
  readonly ownership: MarinePoseOwnership;
  readonly visualWater: { readonly heave: number; readonly pitch: number; readonly roll: number };
  readonly telemetry?: { readonly heave?: number; readonly pitch?: number; readonly roll?: number };
}): { heave: number; pitch: number; roll: number } {
  const resolve = (
    ownership: MarinePoseDofOwnership,
    visualValue: number,
    telemetryValue: number | undefined,
  ): number => {
    if (ownership === 'telemetry') return telemetryValue ?? 0;
    if (ownership === 'fixed') return 0;
    return visualValue;
  };
  return {
    heave: resolve(input.ownership.heave, input.visualWater.heave, input.telemetry?.heave),
    pitch: resolve(input.ownership.pitch, input.visualWater.pitch, input.telemetry?.pitch),
    roll: resolve(input.ownership.roll, input.visualWater.roll, input.telemetry?.roll),
  };
}

export interface MarineShipDimensions {
  readonly length: number;
  readonly width: number;
}

/**
 * 四点共享波场采样 → visual-water 姿态（船中/艏/艉/左舷/右舷），纯函数：
 * 同一世界姿态、同一时间与网格参数结果确定；近场近似容差由采样器网格分辨率决定。
 */
export function computeVisualWaterPose(
  sampler: (worldX: number, worldZ: number) => number,
  worldPose: MarineWorldPose,
  dimensions: MarineShipDimensions,
): { heave: number; pitch: number; roll: number } {
  const { x, z, headingRad } = worldPose;
  const halfLength = dimensions.length / 2;
  const halfWidth = dimensions.width / 2;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  const centerY = sampler(x, z);
  const bowY = sampler(x + cosH * halfLength, z + sinH * halfLength);
  const sternY = sampler(x - cosH * halfLength, z - sinH * halfLength);
  const portY = sampler(x - sinH * halfWidth, z + cosH * halfWidth);
  const starboardY = sampler(x + sinH * halfWidth, z - cosH * halfWidth);

  return {
    heave: centerY,
    pitch: Math.atan2(bowY - sternY, dimensions.length),
    roll: Math.atan2(portY - starboardY, dimensions.width),
  };
}

/**
 * 世界坐标 → 渲染局部坐标（跟随原点平移；无旋转/缩放）。
 * 波相位补偿由采样器在世界坐标上完成：同一世界点不因原点移动改变相位。
 */
export function marineWorldToRenderLocal(
  worldX: number,
  worldZ: number,
  origin: MarineRenderOrigin,
): { x: number; z: number } {
  return { x: worldX - origin.x, z: worldZ - origin.z };
}

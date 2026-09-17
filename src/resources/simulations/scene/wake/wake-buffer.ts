import {
  computeWakeFamilyBudget,
  resolveWakeTrailStyle,
  type ResolvedWakeTrailStyle,
  type WakeFamilyBudget,
  type WakeSpeedActivity,
  type WakeTrailStyle,
} from './wake-physics';

/**
 * 尾迹环形缓冲：固定容量、发射写入、按寿命/航程淘汰。
 *
 * 与源实现"每帧按历史轨迹全量重建"不同，实时管线只在新发射事件写入粒子槽位；
 * 粒子的族归属与外观由几何模块按 (emitOrdinal, planIndex, 当前年龄) 确定性重算，
 * 因此缓冲只保存出生时刻的锚点快照与活跃度，不保存任何逐帧状态。
 * 所有随机性来自与源实现同语义的 hash01/hashSigned，不使用任何运行时随机源。
 */

const fract = (value: number) => value - Math.floor(value);

/** 与源实现一致的确定性哈希：同参数恒同结果，值域 [0,1)。 */
export const hash01 = (seed: number, a: number, b = 0, c = 0, stream = 0) => {
  const value =
    Math.sin(seed * 12.9898 + a * 78.233 + b * 37.719 + c * 11.131 + stream * 91.173) *
    43758.5453123;
  return fract(value);
};

/** 值域 [-1,1) 的确定性哈希。 */
export const hashSigned = (seed: number, a: number, b = 0, c = 0, stream = 0) =>
  hash01(seed, a, b, c, stream) * 2 - 1;

/** 源非 scenario 路径的哈希取整：floor + (hash < 小数部分 ? 1 : 0)，逐帧稳定不闪烁。 */
const scaledDiscreteCount = (expected: number, seed: number, emitOrdinal: number, stream: number) => {
  if (expected <= 0) {
    return 0;
  }
  const integer = Math.floor(expected);
  const fractional = expected - integer;
  return integer + (hash01(seed, emitOrdinal, 0, 0, stream) < fractional ? 1 : 0);
};

/** 各族整数计数：流编号与源实现一致（401/409/419/421）。 */
export interface WakeFamilyCounts {
  readonly core: number;
  readonly foam: number;
  readonly farFoam: number;
  readonly kelvin: number;
}

export const computeWakeFamilyCounts = (
  budget: WakeFamilyBudget,
  seed: number,
  emitOrdinal: number
): WakeFamilyCounts => ({
  core: scaledDiscreteCount(budget.core, seed, emitOrdinal, 401),
  foam: scaledDiscreteCount(budget.foam, seed, emitOrdinal, 409),
  farFoam: scaledDiscreteCount(budget.farFoam, seed, emitOrdinal, 419),
  kelvin: scaledDiscreteCount(budget.kelvin, seed, emitOrdinal, 421),
});

export const countWakeFamilyTotal = (counts: WakeFamilyCounts) =>
  counts.core + counts.foam + counts.farFoam + counts.kelvin;

/** 世界坐标三元组。 */
export type WakeVec3 = readonly [number, number, number];

/** 发射时刻的船舶锚点快照（shipFrame 语义：船尾中线 + 左右肩部）。 */
export interface WakeAnchorSnapshot {
  readonly stern: WakeVec3;
  readonly portShoulder: WakeVec3;
  readonly starboardShoulder: WakeVec3;
  /** 水平单位航向（世界坐标）。 */
  readonly forwardX: number;
  readonly forwardZ: number;
  /** 发射时刻的水面高度（世界坐标）。 */
  readonly waterY: number;
  /** 世界坐标中的船长（1:1 世界即真实船长）。 */
  readonly worldShipLength: number;
  /** 发射时刻的累计航程（世界单位），用于 maxTrailLength 淘汰。 */
  readonly pathLength: number;
}

/** 粒子槽位：只保存出生时刻数据，外观由几何模块按年龄重算。 */
export interface WakeParticleSlot {
  active: boolean;
  /** 发射序号（对应源 sampleIndex，噪声输入）。 */
  emitOrdinal: number;
  /** 批内序号（对应源 particleIndex，噪声输入）。 */
  planIndex: number;
  birthTime: number;
  /** 寿命（秒）：lifetimeScale × lifetimeSeconds。 */
  lifetime: number;
  birthPathLength: number;
  /** 最大跟随航程（世界单位）：particleLength × max(4, lengthMultiplier)。 */
  maxTrailLength: number;
  anchorStern: WakeVec3;
  anchorPortShoulder: WakeVec3;
  anchorStarboardShoulder: WakeVec3;
  forwardX: number;
  forwardZ: number;
  waterY: number;
  /** 粒子基准长度：max(0.32, birthScale × 0.09)，与源 shipFrame 一致。 */
  particleLength: number;
  /** 尺寸基准：worldShipLength / 0.84，对应源 scale 与船长 0.84 的比例。 */
  birthScale: number;
  wakeActivity: number;
  foamActivity: number;
  kelvinActivity: number;
  /** 远场泡沫份额缩放（#2101 二轮复审）：随粒子持久化，几何重算同口径。 */
  farFoamScale: number;
  emissionRate: number;
  emissionOpacity: number;
  includeKelvin: boolean;
}

const createEmptySlot = (): WakeParticleSlot => ({
  active: false,
  emitOrdinal: 0,
  planIndex: 0,
  birthTime: 0,
  lifetime: 0,
  birthPathLength: 0,
  maxTrailLength: 0,
  anchorStern: [0, 0, 0],
  anchorPortShoulder: [0, 0, 0],
  anchorStarboardShoulder: [0, 0, 0],
  forwardX: 0,
  forwardZ: 1,
  waterY: 0,
  particleLength: 0,
  birthScale: 0,
  wakeActivity: 0,
  foamActivity: 0,
  kelvinActivity: 0,
  farFoamScale: 1,
  emissionRate: 1,
  emissionOpacity: 1,
  includeKelvin: true,
});

export interface WakeTrailBuffer {
  readonly capacity: number;
  readonly style: ResolvedWakeTrailStyle;
  /** 槽位只读视图（几何模块与测试内省用）。 */
  readonly slots: readonly WakeParticleSlot[];
  /** 未淘汰槽位数。 */
  liveCount(): number;
  /** 下次发射序号。 */
  nextEmitOrdinal(): number;
  /**
   * 发射一批粒子：批大小为四族计数在寿命区间上的最大值（确定性网格扫描），
   * 超容量时按写入顺序覆盖最旧槽位；返回写入粒子数。
   */
  emit(input: {
    now: number;
    activity: WakeSpeedActivity;
    anchors: WakeAnchorSnapshot;
    includeKelvin: boolean;
    emissionRate?: number;
    emissionOpacity?: number;
    /** 局部洗流（#2101）：farFoam 份额缩放（0 = 不产生中远龄远场泡沫）。 */
    farFoamScale?: number;
  }): number;
  /** 按寿命与累计航程淘汰粒子。 */
  update(now: number, pathLength: number): void;
}

/** 批大小扫描步数：在 [0,1] 寿命区间上取四族计数峰值的确定性网格。 */
const BATCH_SCAN_STEPS = 24;

export const createWakeTrailBuffer = ({
  capacity,
  style,
}: {
  capacity?: number;
  style?: WakeTrailStyle;
} = {}): WakeTrailBuffer => {
  const resolvedStyle = resolveWakeTrailStyle(style);
  const resolvedCapacity = Math.max(
    1,
    Math.round(capacity ?? resolvedStyle.maxParticles)
  );
  const slots: WakeParticleSlot[] = Array.from({ length: resolvedCapacity }, createEmptySlot);
  let head = 0;
  let emitOrdinal = 0;

  const batchSizeFor = (
    activity: WakeSpeedActivity,
    emissionRate: number,
    includeKelvin: boolean,
    farFoamScale = 1
  ) => {
    let peak = 0;
    for (let step = 0; step <= BATCH_SCAN_STEPS; step += 1) {
      const age01 = step / BATCH_SCAN_STEPS;
      const rawBudget = computeWakeFamilyBudget({
        age01,
        activity,
        style: resolvedStyle,
        emissionRate,
        includeKelvin,
      });
      // 局部洗流（#2101 二轮复审）：farFoam 份额可缩放（洗流不产生中远龄远场泡沫）。
      const budget = farFoamScale === 1 ? rawBudget : { ...rawBudget, farFoam: rawBudget.farFoam * farFoamScale };
      peak = Math.max(peak, countWakeFamilyTotal(computeWakeFamilyCounts(budget, resolvedStyle.seed, emitOrdinal)));
    }
    return Math.min(peak, resolvedCapacity);
  };

  return {
    capacity: resolvedCapacity,
    style: resolvedStyle,
    slots,
    liveCount() {
      return slots.reduce((sum, slot) => sum + (slot.active ? 1 : 0), 0);
    },
    nextEmitOrdinal() {
      return emitOrdinal;
    },
    emit({ now, activity, anchors, includeKelvin, emissionRate = 1, emissionOpacity = 1, farFoamScale = 1 }) {
      if (!resolvedStyle.enabled) {
        return 0;
      }
      const batchSize = batchSizeFor(activity, emissionRate, includeKelvin, farFoamScale);
      if (batchSize <= 0) {
        return 0;
      }
      const birthScale = Math.max(0.001, anchors.worldShipLength) / 0.84;
      const particleLength = Math.max(0.32, birthScale * 0.09);
      const maxTrailLength = particleLength * Math.max(4, resolvedStyle.lengthMultiplier);
      const lifetime = Math.max(0.001, activity.lifetimeScale * resolvedStyle.lifetimeSeconds);

      for (let planIndex = 0; planIndex < batchSize; planIndex += 1) {
        const slot = slots[head];
        slot.active = true;
        slot.emitOrdinal = emitOrdinal;
        slot.planIndex = planIndex;
        slot.birthTime = now;
        slot.lifetime = lifetime;
        slot.birthPathLength = anchors.pathLength;
        slot.maxTrailLength = maxTrailLength;
        slot.anchorStern = anchors.stern;
        slot.anchorPortShoulder = anchors.portShoulder;
        slot.anchorStarboardShoulder = anchors.starboardShoulder;
        slot.forwardX = anchors.forwardX;
        slot.forwardZ = anchors.forwardZ;
        slot.waterY = anchors.waterY;
        slot.particleLength = particleLength;
        slot.birthScale = birthScale;
        slot.wakeActivity = activity.wakeActivity;
        slot.foamActivity = activity.foamActivity;
        slot.kelvinActivity = activity.kelvinActivity;
        slot.emissionRate = emissionRate;
        slot.emissionOpacity = emissionOpacity;
        slot.includeKelvin = includeKelvin;
        slot.farFoamScale = farFoamScale;
        head = (head + 1) % resolvedCapacity;
      }
      emitOrdinal += 1;
      return batchSize;
    },
    update(now, pathLength) {
      for (const slot of slots) {
        if (!slot.active) {
          continue;
        }
        if (now - slot.birthTime > slot.lifetime) {
          slot.active = false;
          continue;
        }
        if (pathLength - slot.birthPathLength > slot.maxTrailLength) {
          slot.active = false;
        }
      }
    },
  };
};

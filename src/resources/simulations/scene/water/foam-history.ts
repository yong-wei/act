/**
 * 泡沫历史密度场（#2115）：有界局部密度网格 + 输运/衰减/源注入的纯逻辑实现。
 *
 * 密度决定"哪里有泡沫、活多久"；形态细节由水材质的多尺度纹理采样提供。
 * 所有步进按秒积分（衰减 exp(-λ·dt)、漂移 dt 线性、源速率 × dt），
 * 同一时间总量的步数切分不改变结果（跨更新频率一致性）。
 * 域重定位按世界坐标重采样：旧历史保持世界位置，新进入区域从 0 开始，
 * 采样地址钳制在域内（禁止环回把旧尾迹送到对侧边界）。
 */

import type { GerstnerWave } from './gerstner-waves';

/** 密度衰减半衰期（秒）：>25s 与尾迹寿命同量级，源停止后可见消散。 */
export const FOAM_HALF_LIFE_SECONDS = 26;

/** 域重定位步长（米）：船累计位移超过该值才整场重采样一次。 */
export const FOAM_RECENTER_STEP_METERS = 64;

/** 视觉时间跳变阈值（秒）：seek/重置（回退或大幅前进）时显式清空历史。 */
export const FOAM_SEEK_CLEAR_SECONDS = 1.5;

/** 单次 advanceTime 的最大补步数：后台恢复后不做无限追赶（泡沫为显示状态）。 */
export const FOAM_MAX_STEPS_PER_ADVANCE = 8;

/** 自然白浪源：归一化压缩的起止门限（压缩区平滑出沫）。 */
export const NATURAL_FOAM_COMPRESSION_THRESHOLD = 0.45;
export const NATURAL_FOAM_COMPRESSION_FULL = 0.78;

/** 自然白浪源注入速率（密度/秒，满强度处）。 */
export const NATURAL_FOAM_RATE_PER_SECOND = 1.6;

/** 自然白浪源冲点半径（米）。 */
export const NATURAL_FOAM_RADIUS_METERS = 6;

/** 船体/推进器源沉积速率基准（密度/秒/不透明度单位）。 */
export const VESSEL_FOAM_RATE_PER_SECOND = 2.4;

/** 密度上限（clamp，冲点不无限叠加）。 */
export const MAX_FOAM_DENSITY = 1;

export interface FoamHistoryTierSpec {
  /** 网格边长（texel 数）。 */
  readonly resolution: number;
  /** 固定步进频率（Hz）。 */
  readonly updateHz: number;
  /** 自然源压缩采样步距（texel）：自然白浪斑块大，粗采样后双线性放大。 */
  readonly naturalStride: number;
}

/** 三档退化（设计：低档降低分辨率/更新频率，不退回大尺度重复贴花）。 */
export const FOAM_HISTORY_BY_TIER: Record<'high' | 'medium' | 'low', FoamHistoryTierSpec> = {
  high: { resolution: 256, updateHz: 25, naturalStride: 4 },
  medium: { resolution: 128, updateHz: 20, naturalStride: 4 },
  low: { resolution: 64, updateHz: 12.5, naturalStride: 2 },
};

/** 海况门限（自然白浪需要足够能量；平静海况不得始终满屏白沫）。 */
export function naturalFoamSeaStateGate(seaState: number): number {
  const t = Math.min(Math.max((seaState - 2.2) / 1.6, 0), 1);
  return t * t * (3 - 2 * t);
}

const waveNumber = (wavelength: number) => (2 * Math.PI) / wavelength;

/**
 * Gerstner 水平映射的压缩（Jacobian 散度的负值，归一化到波组系数量级）：
 * 正值 = 水平位移收敛（波前变陡、破碎），是自然白浪的物理源；
 * 只作视觉源，不向数值模型回写。
 */
export function naturalCompression(
  waves: readonly GerstnerWave[],
  amplitudeScale: number,
  worldX: number,
  worldZ: number,
  timeSeconds: number,
): number {
  let divergence = 0;
  let coefficientSum = 0;
  for (const wave of waves) {
    const [rawDx, rawDz] = wave.direction;
    const length = Math.hypot(rawDx, rawDz) || 1;
    const dx = rawDx / length;
    const dz = rawDz / length;
    const k = waveNumber(wave.wavelength);
    const c = wave.speed * Math.sqrt(9.8 / k);
    const phase = k * (dx * worldX + dz * worldZ) - c * k * timeSeconds;
    const amp = wave.amplitude * amplitudeScale;
    // ∂Sx/∂x + ∂Sz/∂z = Σ -steep·amp·k·sin(phase)（dx²+dz²=1）
    divergence -= wave.steepness * amp * k * Math.sin(phase);
    coefficientSum += wave.steepness * amp * k;
  }
  if (coefficientSum <= 0) return 0;
  // 压缩为正（发散项为负）
  return -divergence / coefficientSum;
}

/** 自然源强度 [0,1]：压缩门限 × 海况门限。 */
export function naturalFoamSourceStrength(normalizedCompression: number, seaState: number): number {
  const t = Math.min(
    Math.max(
      (normalizedCompression - NATURAL_FOAM_COMPRESSION_THRESHOLD) /
        (NATURAL_FOAM_COMPRESSION_FULL - NATURAL_FOAM_COMPRESSION_THRESHOLD),
      0,
    ),
    1,
  );
  const aboveThreshold = t * t * (3 - 2 * t);
  return aboveThreshold * naturalFoamSeaStateGate(seaState);
}

/** 密度衰减因子（纯函数）：exp(-ln2·dt/halfLife)。 */
export function foamDecayFactor(halfLifeSeconds: number, dtSeconds: number): number {
  return Math.exp((-Math.LN2 * Math.max(0, dtSeconds)) / Math.max(1e-6, halfLifeSeconds));
}

/** 展示性漂移（米/秒）：沿主波向的受控慢漂——不是波峰相速度，也不是教学海流。 */
export function displayDriftVelocity(
  waves: readonly GerstnerWave[],
  speedMetersPerSecond: number,
): readonly [number, number] {
  const first = waves[0];
  if (!first) return [0, 0];
  const [rawDx, rawDz] = first.direction;
  const length = Math.hypot(rawDx, rawDz) || 1;
  return [(rawDx / length) * speedMetersPerSecond, (rawDz / length) * speedMetersPerSecond];
}

export interface FoamHistoryFieldOptions {
  readonly spec: FoamHistoryTierSpec;
  /** 域边长（米，世界坐标）。 */
  readonly domainMeters: number;
  readonly halfLifeSeconds?: number;
  readonly driftMetersPerSecond?: readonly [number, number];
}

export interface FoamSourceInputs {
  readonly waves: readonly GerstnerWave[];
  readonly amplitudeScale: number;
  readonly seaState: number;
  /** 自然源开关（QA 归因）。 */
  readonly naturalEnabled: boolean;
}

/** 有界泡沫历史场：网格数据 + 步进/沉积/重定位/seek 政策。无渲染依赖，可纯测试。 */
export class FoamHistoryField {
  readonly resolution: number;
  readonly domainMeters: number;
  readonly cellMeters: number;
  readonly fixedDtSeconds: number;
  readonly halfLifeSeconds: number;
  readonly driftMetersPerSecond: readonly [number, number];

  /** 密度网格（row-major：index = j * resolution + i；x→i，z→j）。 */
  readonly grid: Float32Array;
  private readonly scratch: Float32Array;

  /** 域中心（世界坐标）。 */
  originX = 0;
  originZ = 0;
  /** 场时间（秒）：固定步累计推进的视觉时间。 */
  timeSeconds = 0;
  /**
   * 自然源相位时间（秒）：对齐绝对视觉时钟（水面 shader 同源）——挂载时基线
   * 为当时的视觉时间，seek/重置清空后由下次同步重定；跨更新节奏只随步数累加
   * fixedDt（保持节奏不变性）。
   */
  naturalPhaseTimeSeconds = 0;
  /** 清空/重置计数（seek 政策与复现测试的 epoch 真源）。 */
  epoch = 0;

  private lastVisualTime: number | null = null;
  private accumulator = 0;
  private readonly naturalStride: number;
  private naturalCompressionCache: Float32Array | null = null;

  constructor(options: FoamHistoryFieldOptions) {
    this.resolution = Math.max(8, Math.round(options.spec.resolution));
    this.domainMeters = Math.max(64, options.domainMeters);
    this.cellMeters = this.domainMeters / this.resolution;
    this.fixedDtSeconds = 1 / Math.max(1, options.spec.updateHz);
    this.halfLifeSeconds = options.halfLifeSeconds ?? FOAM_HALF_LIFE_SECONDS;
    this.driftMetersPerSecond = options.driftMetersPerSecond ?? [0, 0];
    this.naturalStride = Math.max(1, Math.round(options.spec.naturalStride));
    this.grid = new Float32Array(this.resolution * this.resolution);
    this.scratch = new Float32Array(this.resolution * this.resolution);
  }

  /** texel 中心的局部坐标（x/z）。 */
  localToWorldI(i: number): number {
    return (i + 0.5) * this.cellMeters - this.domainMeters / 2 + this.originX;
  }

  localToWorldJ(j: number): number {
    return (j + 0.5) * this.cellMeters - this.domainMeters / 2 + this.originZ;
  }

  /** 世界 → texel 单位坐标（格心对齐）；域外返回越界值由采样器处理。 */
  private worldToGridX(worldX: number): number {
    return (worldX - this.originX + this.domainMeters / 2) / this.cellMeters - 0.5;
  }

  private worldToGridZ(worldZ: number): number {
    return (worldZ - this.originZ + this.domainMeters / 2) / this.cellMeters - 0.5;
  }

  /** 双线性采样（地址钳制在域内，域外 1 texel 内平滑到 0；无环回）。 */
  private sampleGrid(grid: Float32Array, gx: number, gz: number): number {
    const res = this.resolution;
    if (gx < -1 || gz < -1 || gx > res || gz > res) return 0;
    const x0 = Math.min(Math.max(Math.floor(gx), 0), res - 1);
    const z0 = Math.min(Math.max(Math.floor(gz), 0), res - 1);
    const x1 = Math.min(x0 + 1, res - 1);
    const z1 = Math.min(z0 + 1, res - 1);
    const fx = Math.min(Math.max(gx - x0, 0), 1);
    const fz = Math.min(Math.max(gz - z0, 0), 1);
    const row0 = z0 * res;
    const row1 = z1 * res;
    const top = grid[row0 + x0] * (1 - fx) + grid[row0 + x1] * fx;
    const bottom = grid[row1 + x0] * (1 - fx) + grid[row1 + x1] * fx;
    return top * (1 - fz) + bottom * fz;
  }

  /** 世界坐标密度读取（测试与 QA 探针）。 */
  densityAt(worldX: number, worldZ: number): number {
    return this.sampleGrid(this.grid, this.worldToGridX(worldX), this.worldToGridZ(worldZ));
  }

  /** 以 (worldX, worldZ) 为中心、半径 radius 的圆盘冲点（峰值密度 amount，边缘 smoothstep 衰减）。 */
  deposit(worldX: number, worldZ: number, radiusMeters: number, amount: number): void {
    if (amount <= 0) return;
    const gx = this.worldToGridX(worldX);
    const gz = this.worldToGridZ(worldZ);
    const radius = Math.max(this.cellMeters * 0.75, radiusMeters) / this.cellMeters;
    const extent = Math.ceil(radius);
    const i0 = Math.max(0, Math.floor(gx) - extent);
    const i1 = Math.min(this.resolution - 1, Math.ceil(gx) + extent);
    const j0 = Math.max(0, Math.floor(gz) - extent);
    const j1 = Math.min(this.resolution - 1, Math.ceil(gz) + extent);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const d = Math.hypot(i - gx, j - gz) / radius;
        if (d >= 1) continue;
        const falloff = 1 - d * d * (3 - 2 * d);
        const index = j * this.resolution + i;
        this.grid[index] = Math.min(MAX_FOAM_DENSITY, this.grid[index] + amount * falloff);
      }
    }
  }

  /**
   * 单个固定步进（dt 秒）：
   * 1) 沿展示性漂移输运（采样上一状态于 w - drift·dt）；
   * 2) 指数衰减；
   * 3) 自然压缩源注入（粗步距采样压缩，按速率 × dt 积分）。
   * 自然源相位使用对齐后的绝对视觉时间（phaseTimeSeconds，见 advanceTime），
   * 与水面 shader 的波相位同源——否则泡沫注入位置与画面波峰错相。
   */
  step(dtSeconds: number, sources: FoamSourceInputs | null): void {
    const dt = Math.max(0, dtSeconds);
    const res = this.resolution;
    const decay = foamDecayFactor(this.halfLifeSeconds, dt);
    const driftX = (this.driftMetersPerSecond[0] * dt) / this.cellMeters;
    const driftZ = (this.driftMetersPerSecond[1] * dt) / this.cellMeters;
    const next = this.scratch;
    next.fill(0);
    for (let j = 0; j < res; j += 1) {
      for (let i = 0; i < res; i += 1) {
        const advected = this.sampleGrid(this.grid, i - driftX, j - driftZ) * decay;
        next[j * res + i] = advected > 1e-5 ? Math.min(MAX_FOAM_DENSITY, advected) : 0;
      }
    }
    this.grid.set(next);

    if (sources && sources.naturalEnabled && sources.waves.length > 0) {
      this.injectNatural(dt, sources);
    }
    this.timeSeconds += dt;
    this.naturalPhaseTimeSeconds += dt;
  }

  /** 自然源：粗步距网格上计算压缩，双线性放大到全网格冲点。 */
  private injectNatural(dt: number, sources: FoamSourceInputs): void {
    const stride = this.naturalStride;
    const res = this.resolution;
    const coarse = Math.floor(res / stride) + 1;
    let cache = this.naturalCompressionCache;
    if (!cache || cache.length !== coarse * coarse) {
      cache = new Float32Array(coarse * coarse);
      this.naturalCompressionCache = cache;
    }
    // 粗网格（步距 = stride texel）上的世界坐标
    const coarseCell = this.cellMeters * stride;
    for (let cj = 0; cj < coarse; cj += 1) {
      const worldZ = (cj * stride + 0.5) * this.cellMeters - this.domainMeters / 2 + this.originZ;
      for (let ci = 0; ci < coarse; ci += 1) {
        const worldX = (ci * stride + 0.5) * this.cellMeters - this.domainMeters / 2 + this.originX;
        cache[cj * coarse + ci] = naturalCompression(
          sources.waves,
          sources.amplitudeScale,
          worldX,
          worldZ,
          this.naturalPhaseTimeSeconds,
        );
      }
    }
    const amount = NATURAL_FOAM_RATE_PER_SECOND * dt;
    for (let cj = 0; cj + 1 < coarse; cj += 1) {
      for (let ci = 0; ci + 1 < coarse; ci += 1) {
        const strength = naturalFoamSourceStrength(cache[cj * coarse + ci], sources.seaState);
        if (strength <= 0.01) continue;
        const i = ci * stride;
        const j = cj * stride;
        this.deposit(
          this.localToWorldI(i),
          this.localToWorldJ(j),
          NATURAL_FOAM_RADIUS_METERS,
          amount * strength,
        );
      }
    }
  }

  /**
   * 域重定位：新域内容按世界坐标从旧域重采样（钳制寻址 → 新进入区域 0，
   * 边缘双线性平滑衰减；旧尾迹保持世界位置，不随船整体平移，无环回）。
   * 新 texel (i,j) 的世界位置 = 新原点 + local(i,j)，映射回旧网格坐标
   * (i + Δorigin/cell, j + Δorigin/cell)。
   */
  recenter(newOriginX: number, newOriginZ: number): void {
    const shiftI = (newOriginX - this.originX) / this.cellMeters;
    const shiftJ = (newOriginZ - this.originZ) / this.cellMeters;
    if (Math.abs(shiftI) < 1e-9 && Math.abs(shiftJ) < 1e-9) return;
    const oldGrid = this.grid;
    const next = this.scratch;
    next.fill(0);
    const res = this.resolution;
    for (let j = 0; j < res; j += 1) {
      for (let i = 0; i < res; i += 1) {
        next[j * res + i] = this.sampleGrid(oldGrid, i + shiftI, j + shiftJ);
      }
    }
    oldGrid.set(next);
    this.originX = newOriginX;
    this.originZ = newOriginZ;
  }

  /** 清空历史并重置时间基准（seek/重置政策；epoch 递增供复现断言）。 */
  clear(): void {
    this.grid.fill(0);
    this.accumulator = 0;
    this.lastVisualTime = null;
    this.timeSeconds = 0;
    this.epoch += 1;
  }

  /** 上次视觉时间（seek 检测用）。 */
  get lastSyncedVisualTime(): number | null {
    return this.lastVisualTime;
  }

  /**
   * 对齐共享视觉时间：正常前进 → 固定步累积推进；回退或超过阈值的跳变
   * （seek/重置）→ 显式清空（明确重置政策，不保留未来泡沫）。
   * 单次最多补 FOAM_MAX_STEPS_PER_ADVANCE 步，超出丢弃并重置累积器
   * （后台长暂停后不做无限追赶）。
   */
  advanceTime(visualTimeSeconds: number, sources: FoamSourceInputs | null): void {
    if (this.lastVisualTime === null) {
      this.lastVisualTime = visualTimeSeconds;
      // 相位对齐绝对视觉时钟（水面 Suspense 晚挂载/seek 后基线非零）。
      this.naturalPhaseTimeSeconds = visualTimeSeconds;
      return;
    }
    const delta = visualTimeSeconds - this.lastVisualTime;
    if (delta < -1e-6 || delta > FOAM_SEEK_CLEAR_SECONDS) {
      this.clear();
      this.lastVisualTime = visualTimeSeconds;
      this.naturalPhaseTimeSeconds = visualTimeSeconds;
      return;
    }
    this.lastVisualTime = visualTimeSeconds;
    this.accumulator += Math.max(0, delta);
    // 浮点容差：帧间 Δt 的累计误差不得吞掉/多出一个固定步（跨更新频率一致性）。
    let steps = 0;
    while (this.accumulator >= this.fixedDtSeconds - 1e-9 && steps < FOAM_MAX_STEPS_PER_ADVANCE) {
      this.step(this.fixedDtSeconds, sources);
      this.accumulator -= this.fixedDtSeconds;
      steps += 1;
    }
    if (this.accumulator >= this.fixedDtSeconds - 1e-9) {
      this.accumulator = 0;
    }
  }
}

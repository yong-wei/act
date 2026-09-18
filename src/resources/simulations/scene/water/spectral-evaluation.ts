/**
 * 海洋频谱后端评估（#2105）：Gerstner / WebGL FFT / WebGPU FFT 投入产出的
 * 公平比较框架——受控变量声明、频谱统计与证据化结论（不接入生产）。
 *
 * 纯模块。实验设计约束（见 change design）：
 * - 同几何可见密度/材质/环境/镜头/船包/drawing buffer/泡沫选项——比较波场算法，
 *   再比较后端；不得让 WebGPU 方案同时换天空/材质而把全部收益归给 FFT。
 * - 记录方向谱、峰值周期、有效波高定义与空间/时间统计，不能仅看一张截图。
 * - 生产不变量：本评估不修改生产 renderer 或默认海洋后端；采用需单独 change。
 */

/** 候选海洋波场后端。 */
export type SpectralBackendId = 'gerstner-analytic' | 'webgl-fft' | 'webgpu-fft';

export interface SpectralExperimentControls {
  /** 受控变量（公平比较前提）：全部候选一致。 */
  readonly vesselId: string;
  readonly cameraView: string;
  readonly drawingBufferWidth: number;
  readonly drawingBufferHeight: number;
  readonly environmentPresetId: string;
  readonly seaState: number;
  readonly foamEnabled: boolean;
  readonly materialStack: 'shared-gerstner-material';
  /** 分辨率/级联仅对 FFT 候选有效（128²/256²、1-2 级联为实验起点）。 */
  readonly fftResolution?: 128 | 256;
  readonly fftCascades?: 1 | 2;
}

/** 单候选测量结果（来自真实硬件运行的实测字段；未测为 null，不得填目标）。 */
export interface SpectralBackendMeasurement {
  readonly backend: SpectralBackendId;
  /** 空间统计：有效波高 Hs（米，20 分钟海况记录定义）与重复性（同种子两次运行差）。 */
  readonly significantWaveHeightMeters: number | null;
  readonly repeatabilityDeltaMeters: number | null;
  /** 时间统计：稳定帧率 p95（ms，预热后 60s，#2103 探针口径）。 */
  readonly frameP95Ms: number | null;
  /** 首载成本（ms，着色器编译+纹理初始化）。 */
  readonly firstLoadMs: number | null;
  /** 船体 CPU 查询策略：GPU-only 高频场是否需要读回（逐帧同步整纹理读回 = 不合格）。 */
  readonly cpuQueryStrategy: 'analytic-closed-form' | 'gpu-readback-partial' | 'gpu-readback-full-per-frame' | null;
  /** 视觉质量（人工评估记录，非自动指标）。 */
  readonly visualQualityNotes: string | null;
}

export interface SpectralEvaluationReport {
  readonly controls: SpectralExperimentControls;
  readonly measurements: readonly SpectralBackendMeasurement[];
  /** 未受控差异（诚实声明：不能归因给 FFT 的差异来源）。 */
  readonly unresolvedDifferences: readonly string[];
  readonly hardwareContext: string | null;
  /** 结论：仅证据化建议——生产默认不变，采用需单独 change。 */
  readonly verdict: 'adopt-candidate-change' | 'defer-more-evidence' | 'keep-current-path';
  readonly rationale: string;
}

/**
 * 方向谱统计（Phillips 型实验谱，纯函数参照）：给定风速/风区与网格，
 * 生成离散方向谱能量（FFT 候选的输入定义）——统计定义与 Gerstner 手调
 * 波组的等效统计可对照（空间/时间统计，非单张截图）。
 */
export function experimentalDirectionalSpectrum(input: {
  readonly windSpeedMps: number;
  readonly fetchMeters: number;
  readonly directionBins: number;
  readonly frequencyBins: number;
  readonly seed: number;
}): Array<{ readonly frequencyHz: number; readonly directionRad: number; readonly energy: number }> {
  const points: Array<{ frequencyHz: number; directionRad: number; energy: number }> = [];
  // 简单可复现伪随机（与 wake-buffer 的 hash 风格一致；实验谱不需要物理精确）。
  let state = (input.seed * 2654435761) >>> 0;
  const nextUnit = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  // 峰值频率随风速下移（0.8·g/u）+ 风输入尺度 u²：强风 → 低频大能量（实验定义固定可复现）。
  const peakFrequency = Math.min(0.45, 0.8 * 9.81 / Math.max(input.windSpeedMps, 1));
  const windScale = Math.pow(Math.max(input.windSpeedMps, 1), 2);
  const bandHz = 0.12;
  for (let f = 0; f < input.frequencyBins; f += 1) {
    const frequencyHz = 0.05 + (f / Math.max(input.frequencyBins - 1, 1)) * 0.45;
    // 频率峰形（高斯带）：峰在峰值频率处，两侧衰减（Pierson-Moskowitz 单峰形态的实验简化）。
    const frequencyFactor = Math.exp(-Math.pow((frequencyHz - peakFrequency) / bandHz, 2));
    for (let d = 0; d < input.directionBins; d += 1) {
      const directionRad = (d / input.directionBins) * Math.PI * 2;
      // 单峰方向扩散（风向下能量最大）。
      const directionSpread = Math.pow(Math.abs(Math.cos(directionRad / 2)), 4);
      points.push({
        frequencyHz,
        directionRad,
        energy: windScale * frequencyFactor * directionSpread * (0.5 + nextUnit() * 0.5),
      });
    }
  }
  return points;
}

/**
 * 谱 → 等效统计：由方向谱计算有效波高（Hs = 4√m0，m0 = 谱零阶矩）与
 * 峰值周期（能量最大频率分量倒数）——跨候选的统计对照口径。
 */
export function spectrumStatistics(
  spectrum: ReadonlyArray<{
    readonly frequencyHz: number;
    readonly directionRad: number;
    readonly energy: number;
  }>,
): { significantWaveHeightMeters: number; peakPeriodSeconds: number } {
  if (spectrum.length === 0) {
    return { significantWaveHeightMeters: 0, peakPeriodSeconds: 0 };
  }
  // 二维密度积分（二轮复审）：先按频率聚合全部方向（每方向计入 Δθ = 2π/每频率点数），
  // 再沿频率取相邻差 Δf 积分——方向/频率分辨率变化不改变 Hs；峰值取聚合谱。
  const frequencies = [...new Set(spectrum.map((point) => point.frequencyHz))].sort((l, r) => l - r);
  const pointsPerFrequency = spectrum.length / frequencies.length;
  const deltaTheta = (Math.PI * 2) / Math.max(pointsPerFrequency, 1);
  const aggregated = frequencies.map((frequencyHz) => {
    let directionalEnergy = 0;
    for (const point of spectrum) {
      if (point.frequencyHz === frequencyHz) directionalEnergy += point.energy * deltaTheta;
    }
    return { frequencyHz, energy: directionalEnergy };
  });
  let m0 = 0;
  let peakEnergy = -1;
  let peakFrequency = aggregated[0]!.frequencyHz;
  for (let i = 0; i < aggregated.length; i += 1) {
    const point = aggregated[i]!;
    const previous = i > 0 ? aggregated[i - 1]!.frequencyHz : point.frequencyHz;
    const deltaF = Math.max(point.frequencyHz - previous, 1e-6);
    m0 += point.energy * deltaF;
    if (point.energy > peakEnergy) {
      peakEnergy = point.energy;
      peakFrequency = point.frequencyHz;
    }
  }
  return {
    significantWaveHeightMeters: 4 * Math.sqrt(m0),
    peakPeriodSeconds: peakFrequency > 0 ? 1 / peakFrequency : 0,
  };
}

/**
 * 判定规则（可复现决策，证据不足不激进）：
 * - 任一候选存在逐帧整纹理读回（CPU 查询不合格）→ 该候选不可采用；
 * - 视觉收益未记录（visualQualityNotes null）或硬件实测不足（<2 候各有 p95）→ defer；
 * - 全部候选无实测 → keep-current-path（保留 Gerstner 路线的默认结论可以是终态）。
 */
/** 单候选证据完备性（三轮复审）：五项必需实测字段 + 视觉记录全部在场才算齐备。 */
/** 数值证据必须为有限的非负值（六轮复审）：NaN/Infinity/负数经 JSON 落盘变 null，不算实测。 */
function finiteNonNegative(value: number | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function backendEvidenceComplete(measurement: SpectralBackendMeasurement): boolean {
  return finiteNonNegative(measurement.frameP95Ms)
    && finiteNonNegative(measurement.significantWaveHeightMeters)
    && finiteNonNegative(measurement.repeatabilityDeltaMeters)
    && finiteNonNegative(measurement.firstLoadMs)
    && measurement.cpuQueryStrategy !== null
    // 五轮复审：视觉记录与硬件上下文一样要求去空白后非空（空串不算证据）。
    && typeof measurement.visualQualityNotes === 'string'
    && measurement.visualQualityNotes.trim().length > 0;
}

export function evaluateSpectralBackends(
  report: Omit<SpectralEvaluationReport, 'verdict' | 'rationale'>,
): SpectralEvaluationReport {
  const disqualified = report.measurements.filter(
    (m) => m.cpuQueryStrategy === 'gpu-readback-full-per-frame',
  );
  const complete = report.measurements.filter(backendEvidenceComplete);
  const hardwareKnown = typeof report.hardwareContext === 'string' && report.hardwareContext.trim().length > 0;
  let verdict: SpectralEvaluationReport['verdict'];
  let rationale: string;
  const REQUIRED_BACKENDS: readonly SpectralBackendId[] = ['gerstner-analytic', 'webgl-fft', 'webgpu-fft'];
  const allPresent = REQUIRED_BACKENDS.every((required) =>
    report.measurements.some((m) => m.backend === required));
  if (!allPresent || complete.length < report.measurements.length || complete.length < 2 || !hardwareKnown) {
    verdict = 'keep-current-path';
    const missing = report.measurements.length - complete.length;
    rationale = `实测证据不足（${missing} 个候选必需字段未齐备${allPresent ? '' : '，候选集不完整（需 Gerstner/WebGL FFT/WebGPU FFT 三者同场）'}${hardwareKnown ? '' : '，且硬件上下文缺失'}——p95/Hs/重复性/首载/CPU 查询/视觉记录为提案要求的完整检查集）：保留当前 Gerstner 解析路线；结论可以就是终点，采用需补充证据后另立 change。`;
  } else if (disqualified.length > 0) {
    verdict = complete.length - disqualified.length >= 2 ? 'defer-more-evidence' : 'keep-current-path';
    rationale = `候选 ${disqualified.map((m) => m.backend).join('、')} 的船体 CPU 查询需逐帧同步读回整张纹理（不合格）；其余候选证据继续收集或维持现路线。`;
  } else {
    verdict = 'defer-more-evidence';
    rationale = '实测与视觉证据齐备（三候选同场、五项实测 + 视觉记录 + 硬件上下文）但采用需要单独批准的迁移 change（目标硬件预算/接口一致性/维护成本评估）；本评估只输出建议，不改生产默认。';
  }
  return { ...report, verdict, rationale };
}

/** 浏览器能力门槛（运行时探测结果记录；探测本身在浏览器侧，本模块只定型）。 */
export interface SpectralBackendCapability {
  readonly webgpuAvailable: boolean | null;
  readonly webgl2Available: boolean | null;
  readonly floatRenderTargetsUsable: boolean | null;
  /** 缺失能力的失败行为声明（不把 Three 后端回退等同于自定义 FFT compute 回退）。 */
  readonly failureBehavior: string;
}

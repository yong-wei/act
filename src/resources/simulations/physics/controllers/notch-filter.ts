/**
 * 陷波滤波器控制器
 *
 * 用于抑制特定频率范围的振动
 * 主要应用于邮轮减摇系统，抑制致晕频段 (0.1-0.3 Hz)
 *
 * 传递函数:
 *   H(s) = (s² + 2*ζz*ωn*s + ωn²) / (s² + 2*ζp*ωn*s + ωn²)
 *
 * 参数说明:
 *   ωn: 陷波中心频率 (rad/s)
 *   ζz: 零点阻尼比 (小值产生深陷波，如 0.1)
 *   ζp: 极点阻尼比 (大值产生平滑响应，如 0.5)
 *
 * 数字实现:
 *   使用 Tustin (双线性) 变换将连续传递函数离散化
 *
 * 教学映射:
 *   Ch5: 频率响应分析
 *   Ch6: 陷波滤波器设计
 */

import type { NotchFilterParams, NotchFilterState, BodePlotData } from '../../core/types';
import {
  clamp,
  NOTCH_FILTER_DEFAULTS,
  CRUISE_COMFORT_THRESHOLDS,
} from '../../core/constants';

// ============ 类型导出 ============

export type { NotchFilterParams, NotchFilterState, BodePlotData };

// ============ 默认参数 ============

/** 默认陷波滤波器参数 */
export const DEFAULT_NOTCH_PARAMS: NotchFilterParams = {
  centerFrequencyHz: NOTCH_FILTER_DEFAULTS.CENTER_FREQUENCY,
  bandwidthHz: NOTCH_FILTER_DEFAULTS.BANDWIDTH,
  depthDb: NOTCH_FILTER_DEFAULTS.DEPTH,
  zeroDamping: NOTCH_FILTER_DEFAULTS.ZERO_DAMPING,
  poleDamping: NOTCH_FILTER_DEFAULTS.POLE_DAMPING,
};

// ============ 状态初始化 ============

/**
 * 创建初始陷波滤波器状态
 */
export function createNotchFilterState(
  enabled: boolean = true
): NotchFilterState {
  return {
    // 二阶滤波器需要 2 个历史输入和 2 个历史输出
    inputHistory: [0, 0],
    outputHistory: [0, 0],
    enabled,
    currentGainDb: 0,
  };
}

// ============ 双线性变换系数计算 ============

/**
 * 计算陷波滤波器的数字滤波器系数
 *
 * 使用 Tustin (双线性) 变换
 *
 * @param params 滤波器参数
 * @param sampleRate 采样率 (Hz)
 */
export function computeNotchCoefficients(
  params: NotchFilterParams,
  sampleRate: number
): {
  b0: number; b1: number; b2: number;
  a0: number; a1: number; a2: number;
} {
  const { centerFrequencyHz, zeroDamping, poleDamping } = params;

  // 中心频率 (rad/s)
  const omegaN = 2 * Math.PI * centerFrequencyHz;

  // 采样周期
  const T = 1 / sampleRate;

  // 预畸变频率 (Tustin 变换)
  const omegaP = (2 / T) * Math.tan(omegaN * T / 2);

  // 归一化变量
  const K = (2 / T);
  const K2 = K * K;
  const omega2 = omegaP * omegaP;

  // 连续域传递函数系数
  // H(s) = (s² + 2*ζz*ωn*s + ωn²) / (s² + 2*ζp*ωn*s + ωn²)
  // 分子: s² + 2*ζz*ω*s + ω²
  // 分母: s² + 2*ζp*ω*s + ω²

  // 双线性变换: s = K * (1 - z⁻¹) / (1 + z⁻¹)
  // 代入后得到离散域系数

  // 分母归一化因子
  const denom = K2 + 2 * poleDamping * omegaP * K + omega2;

  // 数字滤波器系数 (归一化)
  const b0 = (K2 + 2 * zeroDamping * omegaP * K + omega2) / denom;
  const b1 = (2 * omega2 - 2 * K2) / denom;
  const b2 = (K2 - 2 * zeroDamping * omegaP * K + omega2) / denom;

  const a0 = 1.0;
  const a1 = (2 * omega2 - 2 * K2) / denom;
  const a2 = (K2 - 2 * poleDamping * omegaP * K + omega2) / denom;

  return { b0, b1, b2, a0, a1, a2 };
}

// ============ 频率响应分析 ============

/**
 * 计算陷波滤波器的频率响应
 *
 * @param params 滤波器参数
 * @param frequenciesHz 要计算的频率点 (Hz)
 */
export function computeFrequencyResponse(
  params: NotchFilterParams,
  frequenciesHz: number[]
): BodePlotData {
  const { centerFrequencyHz, zeroDamping, poleDamping } = params;
  const omegaN = 2 * Math.PI * centerFrequencyHz;

  const magnitudeDb: number[] = [];
  const phaseDeg: number[] = [];

  for (const f of frequenciesHz) {
    const omega = 2 * Math.PI * f;
    const s = { real: 0, imag: omega };  // s = jω

    // 计算分子: s² + 2*ζz*ωn*s + ωn²
    // s² = -ω²
    // 2*ζz*ωn*s = j*2*ζz*ωn*ω
    const numReal = -omega * omega + omegaN * omegaN;
    const numImag = 2 * zeroDamping * omegaN * omega;

    // 计算分母: s² + 2*ζp*ωn*s + ωn²
    const denReal = -omega * omega + omegaN * omegaN;
    const denImag = 2 * poleDamping * omegaN * omega;

    // 复数除法: H = num / den
    const denMag2 = denReal * denReal + denImag * denImag;
    const hReal = (numReal * denReal + numImag * denImag) / denMag2;
    const hImag = (numImag * denReal - numReal * denImag) / denMag2;

    // 幅值 (dB)
    const mag = Math.sqrt(hReal * hReal + hImag * hImag);
    magnitudeDb.push(20 * Math.log10(Math.max(mag, 1e-10)));

    // 相位 (度)
    phaseDeg.push(Math.atan2(hImag, hReal) * (180 / Math.PI));
  }

  return {
    frequencies: frequenciesHz,
    magnitudeDb,
    phaseDeg,
  };
}

/**
 * 生成 Bode 图数据
 *
 * @param params 滤波器参数
 * @param fMin 最小频率 (Hz)
 * @param fMax 最大频率 (Hz)
 * @param numPoints 点数
 */
export function generateBodePlot(
  params: NotchFilterParams = DEFAULT_NOTCH_PARAMS,
  fMin: number = 0.01,
  fMax: number = 1.0,
  numPoints: number = 200
): BodePlotData {
  // 对数分布频率点
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  const frequencies: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const logF = logMin + (logMax - logMin) * (i / (numPoints - 1));
    frequencies.push(Math.pow(10, logF));
  }

  return computeFrequencyResponse(params, frequencies);
}

// ============ 致晕频段分析 ============

/**
 * 检测信号在致晕频段的能量
 *
 * 使用简单的频谱分析估算致晕频段能量占比
 *
 * @param signal 时域信号
 * @param sampleRate 采样率 (Hz)
 */
export function analyzeMotionSicknessFrequency(
  signal: number[],
  sampleRate: number = 100
): {
  totalEnergy: number;
  motionSicknessEnergy: number;
  motionSicknessRatio: number;
  dominantFrequency: number;
  isProblematic: boolean;
} {
  // 简化的能量分析 (不使用完整 FFT)
  // 通过带通滤波估算致晕频段能量

  const N = signal.length;
  if (N < 2) {
    return {
      totalEnergy: 0,
      motionSicknessEnergy: 0,
      motionSicknessRatio: 0,
      dominantFrequency: 0,
      isProblematic: false,
    };
  }

  // 总能量
  const totalEnergy = signal.reduce((sum, x) => sum + x * x, 0) / N;

  // 致晕频段: 0.1-0.3 Hz
  const fLow = CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_LOW;
  const fHigh = CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_HIGH;
  const centerFreq = (fLow + fHigh) / 2;

  // 使用带通滤波器提取致晕频段
  const bandPassParams: NotchFilterParams = {
    centerFrequencyHz: centerFreq,
    bandwidthHz: fHigh - fLow,
    depthDb: 0,  // 带通而非陷波
    zeroDamping: 0.7,
    poleDamping: 0.1,
  };

  // 这里使用简化估算: 基于信号变化率估算主频
  let sumSquaredDiff = 0;
  for (let i = 1; i < N; i++) {
    const diff = signal[i] - signal[i - 1];
    sumSquaredDiff += diff * diff;
  }

  const avgSquaredDiff = sumSquaredDiff / (N - 1);
  const estimatedFreq = Math.sqrt(avgSquaredDiff * sampleRate * sampleRate / (4 * Math.PI * Math.PI * totalEnergy));

  // 估算致晕频段能量 (基于主频与致晕频段的重叠)
  let motionSicknessEnergy = 0;
  if (estimatedFreq >= fLow && estimatedFreq <= fHigh) {
    motionSicknessEnergy = totalEnergy * 0.8;  // 主频在致晕频段内
  } else if (estimatedFreq < fLow) {
    const overlap = Math.max(0, 1 - (fLow - estimatedFreq) / fLow);
    motionSicknessEnergy = totalEnergy * overlap * 0.5;
  } else {
    const overlap = Math.max(0, 1 - (estimatedFreq - fHigh) / fHigh);
    motionSicknessEnergy = totalEnergy * overlap * 0.5;
  }

  const motionSicknessRatio = totalEnergy > 1e-9 ? motionSicknessEnergy / totalEnergy : 0;

  return {
    totalEnergy,
    motionSicknessEnergy,
    motionSicknessRatio,
    dominantFrequency: estimatedFreq,
    isProblematic: motionSicknessRatio > 0.3,  // 30% 以上能量在致晕频段
  };
}

// ============ 滤波器参数调整 ============

/**
 * 根据海况自动调整陷波参数
 *
 * @param seaState 海况等级 (1-9)
 * @param baseParams 基础参数
 */
export function autoTuneNotchParams(
  seaState: number,
  baseParams: NotchFilterParams = DEFAULT_NOTCH_PARAMS
): NotchFilterParams {
  const level = clamp(seaState, 1, 9);

  // 海况越高，需要更宽的陷波带宽
  const bandwidthScale = 1 + (level - 3) * 0.1;  // 3 级为基准

  // 海况越高，陷波深度可以稍浅 (避免过度滤波)
  const depthScale = 1 - (level - 3) * 0.05;

  return {
    ...baseParams,
    bandwidthHz: baseParams.bandwidthHz * clamp(bandwidthScale, 0.8, 1.5),
    depthDb: baseParams.depthDb * clamp(depthScale, 0.7, 1.0),
  };
}

/**
 * 创建可配置的陷波滤波器
 *
 * @param centerFreqHz 中心频率 (Hz)
 * @param bandwidthHz 带宽 (Hz)
 * @param depthDb 陷波深度 (dB, 负值)
 */
export function createCustomNotchFilter(
  centerFreqHz: number,
  bandwidthHz: number,
  depthDb: number = -30
): NotchFilterParams {
  // 计算阻尼比以实现指定的带宽和深度
  const zeroDamping = 0.1;  // 固定零点阻尼
  const poleDamping = bandwidthHz / (2 * centerFreqHz);  // 带宽决定极点阻尼

  return {
    centerFrequencyHz: clamp(centerFreqHz, 0.01, 10),
    bandwidthHz: clamp(bandwidthHz, 0.01, 5),
    depthDb: clamp(depthDb, -60, 0),
    zeroDamping: clamp(zeroDamping, 0.01, 0.5),
    poleDamping: clamp(poleDamping, 0.1, 2.0),
  };
}

// ============ 陷波效果评估 ============

/**
 * 评估陷波滤波效果
 *
 * @param inputSignal 滤波前信号
 * @param outputSignal 滤波后信号
 * @param params 滤波器参数
 */
export function evaluateNotchEffect(
  inputSignal: number[],
  outputSignal: number[],
  params: NotchFilterParams
): {
  inputRms: number;
  outputRms: number;
  attenuationDb: number;
  isEffective: boolean;
  rating: string;
} {
  const N = Math.min(inputSignal.length, outputSignal.length);

  // 计算 RMS
  let inputSum = 0;
  let outputSum = 0;
  for (let i = 0; i < N; i++) {
    inputSum += inputSignal[i] * inputSignal[i];
    outputSum += outputSignal[i] * outputSignal[i];
  }

  const inputRms = Math.sqrt(inputSum / N);
  const outputRms = Math.sqrt(outputSum / N);

  // 衰减量 (dB)
  const attenuationDb =
    inputRms > 1e-9
      ? 20 * Math.log10(outputRms / inputRms)
      : 0;

  // 效果评估
  let isEffective = false;
  let rating = '无效';

  if (attenuationDb < -20) {
    rating = '优秀';
    isEffective = true;
  } else if (attenuationDb < -10) {
    rating = '良好';
    isEffective = true;
  } else if (attenuationDb < -5) {
    rating = '一般';
    isEffective = true;
  } else if (attenuationDb < -2) {
    rating = '有限';
    isEffective = false;
  }

  return {
    inputRms,
    outputRms,
    attenuationDb,
    isEffective,
    rating,
  };
}

// ============ 切换控制 ============

/**
 * 切换陷波滤波器启用状态
 */
export function toggleNotchFilter(
  state: NotchFilterState,
  enabled: boolean
): NotchFilterState {
  return {
    ...state,
    enabled,
    // 禁用时清空历史
    inputHistory: enabled ? state.inputHistory : [0, 0],
    outputHistory: enabled ? state.outputHistory : [0, 0],
  };
}

/**
 * 重置陷波滤波器状态
 */
export function resetNotchFilter(state: NotchFilterState): NotchFilterState {
  return {
    ...state,
    inputHistory: [0, 0],
    outputHistory: [0, 0],
    currentGainDb: 0,
  };
}

// ============ 指标获取 ============

/**
 * 获取陷波滤波器指标
 */
export function getNotchFilterMetrics(
  state: NotchFilterState,
  params: NotchFilterParams
): {
  centerFrequencyHz: number;
  bandwidthHz: number;
  depthDb: number;
  currentGainDb: number;
  isActive: boolean;
  statusText: string;
} {
  return {
    centerFrequencyHz: params.centerFrequencyHz,
    bandwidthHz: params.bandwidthHz,
    depthDb: params.depthDb,
    currentGainDb: state.currentGainDb,
    isActive: state.enabled && Math.abs(state.currentGainDb) > 3,
    statusText: state.enabled
      ? Math.abs(state.currentGainDb) > 3
        ? '活跃滤波'
        : '监控中'
      : '已禁用',
  };
}

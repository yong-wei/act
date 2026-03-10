/**
 * 舒适度评估系统
 *
 * 基于 ISO 2631-1 人体振动暴露评价标准
 * 和 O'Hanlon-McCauley 晕船率预测模型
 *
 * 主要评估指标:
 * - MSI (Motion Sickness Incidence): 晕船发生率
 * - VDV (Vibration Dose Value): 振动剂量值
 * - RMS 加速度: 均方根加速度
 *
 * 舒适度等级:
 * - 优秀: 横摇角 < 1°, MSI < 5%
 * - 良好: 横摇角 < 2°, MSI < 10%
 * - 中等: 横摇角 < 4°, MSI < 20%
 * - 较差: 横摇角 < 6°, MSI < 40%
 * - 不可接受: 横摇角 > 6°, MSI > 40%
 */

import type { ComfortMetrics } from '../core/types';
import { clamp, CRUISE_COMFORT_THRESHOLDS } from '../core/constants';

// ============ 类型导出 ============

export type { ComfortMetrics };

/** 舒适度评级 */
export type ComfortRating = 'excellent' | 'good' | 'moderate' | 'poor' | 'unacceptable';

/** 舒适度评估配置 */
export interface ComfortConfig {
  excellentRollDeg: number;
  goodRollDeg: number;
  moderateRollDeg: number;
  poorRollDeg: number;
  excellentMsi: number;
  goodMsi: number;
  moderateMsi: number;
  poorMsi: number;
  motionSicknessFreqLow: number;
  motionSicknessFreqHigh: number;
}

// ============ 默认配置 ============

/** 默认舒适度配置 */
export const DEFAULT_COMFORT_CONFIG: ComfortConfig = {
  excellentRollDeg: CRUISE_COMFORT_THRESHOLDS.EXCELLENT_ROLL,
  goodRollDeg: CRUISE_COMFORT_THRESHOLDS.GOOD_ROLL,
  moderateRollDeg: CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL,
  poorRollDeg: CRUISE_COMFORT_THRESHOLDS.POOR_ROLL,
  excellentMsi: CRUISE_COMFORT_THRESHOLDS.EXCELLENT_MSI,
  goodMsi: CRUISE_COMFORT_THRESHOLDS.GOOD_MSI,
  moderateMsi: CRUISE_COMFORT_THRESHOLDS.MODERATE_MSI,
  poorMsi: CRUISE_COMFORT_THRESHOLDS.POOR_MSI,
  motionSicknessFreqLow: CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_LOW,
  motionSicknessFreqHigh: CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_HIGH,
};

// ============ 状态初始化 ============

/**
 * 创建初始舒适度指标
 */
export function createComfortMetrics(): ComfortMetrics {
  return {
    msi: 0,
    rollRms: 0,
    rollPeak: 0,
    comfortRating: 'excellent',
    vdv: 0,
    frequencyWeightedAccel: 0,
  };
}

// ============ MSI 计算 ============

/**
 * O'Hanlon-McCauley 晕船率预测模型
 *
 * MSI = 100 * Φ(ln(A/A_50) / σ)
 *
 * 其中:
 * - A: 垂向加速度 RMS (m/s²)
 * - A_50: 导致 50% 晕船率的加速度 (与暴露时间和频率相关)
 * - σ: 标准差参数
 * - Φ: 标准正态分布累积函数
 *
 * @param verticalAccelRms 垂向加速度 RMS (m/s²)
 * @param exposureTimeHours 暴露时间 (小时)
 * @param frequencyHz 主要运动频率 (Hz)
 */
export function computeMsi(
  verticalAccelRms: number,
  exposureTimeHours: number = 2.0,
  frequencyHz: number = 0.16
): number {
  // 致晕频段加权
  const fLow = DEFAULT_COMFORT_CONFIG.motionSicknessFreqLow;
  const fHigh = DEFAULT_COMFORT_CONFIG.motionSicknessFreqHigh;
  const fCenter = (fLow + fHigh) / 2;

  // 频率加权因子 (致晕频段内最高)
  let freqWeight = 1.0;
  if (frequencyHz >= fLow && frequencyHz <= fHigh) {
    // 在致晕频段内
    const distFromCenter = Math.abs(frequencyHz - fCenter);
    freqWeight = 1.0 - distFromCenter / (fCenter - fLow) * 0.2;
  } else if (frequencyHz < fLow) {
    freqWeight = Math.max(0.3, frequencyHz / fLow);
  } else {
    freqWeight = Math.max(0.3, fHigh / frequencyHz);
  }

  // A_50 计算 (基于 ISO 2631-1 简化模型)
  // 2小时暴露，0.16Hz 频率下，A_50 ≈ 0.5 m/s²
  const baseA50 = 0.5;
  const timeAdjustment = Math.pow(2.0 / exposureTimeHours, 0.5);  // 时间越长，阈值越低
  const a50 = baseA50 * timeAdjustment / freqWeight;

  // 标准差参数
  const sigma = 0.4;

  // 计算加权加速度
  const weightedAccel = verticalAccelRms * freqWeight;

  // 避免 log(0)
  if (weightedAccel < 0.01 || a50 < 0.01) {
    return 0;
  }

  // 计算 ln(A/A_50) / σ
  const z = Math.log(weightedAccel / a50) / sigma;

  // 标准正态分布累积函数 (近似)
  const msi = 100 * normalCdf(z);

  return clamp(msi, 0, 100);
}

/**
 * 基于横摇角估算 MSI
 *
 * 简化模型: 从横摇角推算等效垂向加速度
 *
 * @param rollAngleDeg 横摇角 (°)
 * @param rollPeriodSec 横摇周期 (s)
 * @param shipBeam 船宽 (m)
 * @param exposureHours 暴露时间 (小时)
 */
export function estimateMsiFromRoll(
  rollAngleDeg: number,
  rollPeriodSec: number = 18,
  shipBeam: number = 37,
  exposureHours: number = 2.0
): number {
  // 横摇角转弧度
  const rollRad = rollAngleDeg * (Math.PI / 180);

  // 估算舷侧甲板垂向加速度
  // a_z ≈ (φ * ω²) * (B/2)
  const omega = (2 * Math.PI) / rollPeriodSec;
  const armLength = shipBeam / 2;
  const verticalAccel = Math.abs(rollRad) * omega * omega * armLength;

  // RMS 加速度 (假设正弦运动)
  const rmsAccel = verticalAccel / Math.sqrt(2);

  // 频率
  const frequencyHz = 1 / rollPeriodSec;

  return computeMsi(rmsAccel, exposureHours, frequencyHz);
}

/**
 * 教学仿真舒适度 MSI 估算
 *
 * 在传统横摇 MSI 基础上，叠加转向引起的横向加速度与转艏角速度影响，
 * 使“满舵+大浪”工况下舒适度降级更符合教学感知。
 */
export function estimateMsiFromMotion(
  rollRmsDeg: number,
  lateralAccelG: number,
  yawRateDegPerSec: number,
  rollPeriodSec: number = 18,
  shipBeam: number = 37,
  exposureHours: number = 2.0
): number {
  const rollMsi = estimateMsiFromRoll(rollRmsDeg, rollPeriodSec, shipBeam, exposureHours);
  const normalizedRoll = Math.pow(clamp(rollRmsDeg / 2.2, 0, 2), 1.25);
  const normalizedLateral = Math.pow(clamp(lateralAccelG / 0.06, 0, 2), 1.35);
  const normalizedYaw = Math.pow(clamp(Math.abs(yawRateDegPerSec) / 1.4, 0, 2), 1.1);
  const lateralCoupling = clamp(
    0.18 + 0.82 * Math.pow(clamp(rollRmsDeg / 1.1, 0, 2), 1.2),
    0.18,
    1.2
  );
  const yawCoupling = clamp(
    0.25 + 0.5 * Math.pow(clamp(rollRmsDeg / 1.2, 0, 2), 1.15),
    0.25,
    0.95
  );
  const load =
    0.62 * normalizedRoll +
    0.26 * normalizedLateral * lateralCoupling +
    0.12 * normalizedYaw * yawCoupling;
  const motionMsi = clamp(100 * (1 - Math.exp(-1.6 * load)), 0, 100);

  return clamp(0.4 * rollMsi + 0.6 * motionMsi, 0, 100);
}

// ============ 振动剂量值 ============

/**
 * 计算振动剂量值 (VDV)
 *
 * VDV = (∫ a⁴(t) dt)^(1/4)
 *
 * @param accelerationHistory 加速度历史 (m/s²)
 * @param dt 采样间隔 (s)
 */
export function computeVdv(
  accelerationHistory: number[],
  dt: number
): number {
  if (accelerationHistory.length === 0) {
    return 0;
  }

  // 计算 ∫ a⁴ dt
  let sum = 0;
  for (const a of accelerationHistory) {
    sum += Math.pow(a, 4) * dt;
  }

  // VDV = (∫ a⁴ dt)^(1/4)
  return Math.pow(sum, 0.25);
}

/**
 * 从横摇历史计算 VDV
 *
 * @param rollHistory 横摇角历史 (°)
 * @param rollPeriodSec 横摇周期 (s)
 * @param shipBeam 船宽 (m)
 * @param dt 采样间隔 (s)
 */
export function computeVdvFromRoll(
  rollHistory: number[],
  rollPeriodSec: number = 18,
  shipBeam: number = 37,
  dt: number = 0.1
): number {
  // 转换为垂向加速度
  const omega = (2 * Math.PI) / rollPeriodSec;
  const armLength = shipBeam / 2;

  const accelHistory = rollHistory.map(rollDeg => {
    const rollRad = rollDeg * (Math.PI / 180);
    return Math.abs(rollRad) * omega * omega * armLength;
  });

  return computeVdv(accelHistory, dt);
}

// ============ RMS 计算 ============

/**
 * 计算横摇角 RMS
 *
 * @param rollHistory 横摇角历史 (°)
 */
export function computeRollRms(rollHistory: number[]): number {
  if (rollHistory.length === 0) {
    return 0;
  }

  const sumSquares = rollHistory.reduce((sum, r) => sum + r * r, 0);
  return Math.sqrt(sumSquares / rollHistory.length);
}

/**
 * 计算横摇角峰值
 *
 * @param rollHistory 横摇角历史 (°)
 */
export function computeRollPeak(rollHistory: number[]): number {
  if (rollHistory.length === 0) {
    return 0;
  }

  return Math.max(...rollHistory.map(r => Math.abs(r)));
}

// ============ 频率加权加速度 ============

/**
 * ISO 2631-1 频率加权
 *
 * 对垂向加速度进行频率加权
 *
 * @param frequency 频率 (Hz)
 */
export function iso2631FrequencyWeight(frequency: number): number {
  // 简化的加权曲线
  // 0.1-0.5 Hz 为人体最敏感频段

  if (frequency < 0.1) {
    return 0.5;  // 低频衰减
  } else if (frequency < 0.5) {
    return 1.0;  // 敏感频段
  } else if (frequency < 2.0) {
    return Math.max(0.5, 0.5 / frequency);  // 高频衰减
  } else {
    return 0.25 / frequency;
  }
}

/**
 * 计算频率加权加速度
 *
 * @param accelerations 加速度数组
 * @param frequencies 对应频率数组
 */
export function computeFrequencyWeightedAccel(
  accelerations: number[],
  frequencies: number[]
): number {
  if (accelerations.length === 0 || frequencies.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  const n = Math.min(accelerations.length, frequencies.length);

  for (let i = 0; i < n; i++) {
    const weight = iso2631FrequencyWeight(frequencies[i]);
    sumSquares += Math.pow(accelerations[i] * weight, 2);
  }

  return Math.sqrt(sumSquares / n);
}

// ============ 舒适度评级 ============

/**
 * 获取舒适度评级
 *
 * @param rollRmsDeg 横摇角 RMS (°)
 * @param msi 晕船率 (%)
 * @param config 配置
 */
export function getComfortRating(
  rollRmsDeg: number,
  msi: number,
  config: ComfortConfig = DEFAULT_COMFORT_CONFIG
): ComfortRating {
  // 同时满足横摇和 MSI 要求才能达到对应等级
  if (rollRmsDeg <= config.excellentRollDeg && msi <= config.excellentMsi) {
    return 'excellent';
  } else if (rollRmsDeg <= config.goodRollDeg && msi <= config.goodMsi) {
    return 'good';
  } else if (rollRmsDeg <= config.moderateRollDeg && msi <= config.moderateMsi) {
    return 'moderate';
  } else if (rollRmsDeg <= config.poorRollDeg && msi <= config.poorMsi) {
    return 'poor';
  } else {
    return 'unacceptable';
  }
}

/**
 * 获取评级描述
 *
 * @param rating 评级
 */
export function getComfortRatingDescription(rating: ComfortRating): {
  label: string;
  description: string;
  color: string;
} {
  switch (rating) {
    case 'excellent':
      return {
        label: '优秀',
        description: '平稳如镜，乘客几乎无感',
        color: '#22c55e',  // green-500
      };
    case 'good':
      return {
        label: '良好',
        description: '轻微摇晃，舒适度高',
        color: '#84cc16',  // lime-500
      };
    case 'moderate':
      return {
        label: '中等',
        description: '有摇晃感，部分乘客可能不适',
        color: '#eab308',  // yellow-500
      };
    case 'poor':
      return {
        label: '较差',
        description: '明显摇晃，建议减速或改变航向',
        color: '#f97316',  // orange-500
      };
    case 'unacceptable':
      return {
        label: '不可接受',
        description: '严重摇晃，需立即采取措施',
        color: '#ef4444',  // red-500
      };
  }
}

// ============ 综合评估 ============

/**
 * 计算综合舒适度指标
 *
 * @param rollHistory 横摇角历史 (°)
 * @param rollPeriodSec 横摇周期 (s)
 * @param shipBeam 船宽 (m)
 * @param exposureHours 暴露时间 (小时)
 * @param dt 采样间隔 (s)
 */
export function computeComfortMetrics(
  rollHistory: number[],
  rollPeriodSec: number = 18,
  shipBeam: number = 37,
  exposureHours: number = 2.0,
  dt: number = 0.1
): ComfortMetrics {
  // 计算横摇统计
  const rollRms = computeRollRms(rollHistory);
  const rollPeak = computeRollPeak(rollHistory);

  // 估算 MSI
  const msi = estimateMsiFromMotion(rollRms, 0, 0, rollPeriodSec, shipBeam, exposureHours);

  // 计算 VDV
  const vdv = computeVdvFromRoll(rollHistory, rollPeriodSec, shipBeam, dt);

  // 估算频率加权加速度
  const omega = (2 * Math.PI) / rollPeriodSec;
  const freq = 1 / rollPeriodSec;
  const freqWeight = iso2631FrequencyWeight(freq);
  const armLength = shipBeam / 2;
  const frequencyWeightedAccel = rollRms * (Math.PI / 180) * omega * omega * armLength * freqWeight;

  // 获取评级
  const comfortRating = getComfortRating(rollRms, msi);

  return {
    msi,
    rollRms,
    rollPeak,
    comfortRating,
    vdv,
    frequencyWeightedAccel,
  };
}

/**
 * 实时舒适度更新
 *
 * 用于仿真循环中的增量更新
 *
 * @param prevMetrics 上一次指标
 * @param currentRollDeg 当前横摇角 (°)
 * @param alpha 指数平滑系数
 */
export function updateComfortMetricsRealtime(
  prevMetrics: ComfortMetrics,
  currentRollDeg: number,
  rollPeriodSec: number = 18,
  shipBeam: number = 37,
  alpha: number = 0.02,
  dtSec: number = 1 / 60,
  lateralAccelG: number = 0,
  yawRateDegPerSec: number = 0
): ComfortMetrics {
  // 根据步长补偿平滑系数，避免加速仿真导致舒适度评估偏差
  const baseDt = 1 / 60;
  const safeAlpha = clamp(alpha, 0.001, 0.999);
  const tau = -baseDt / Math.log(1 - safeAlpha);
  const alphaEffective = clamp(1 - Math.exp(-Math.max(dtSec, 1e-4) / tau), 0.001, 0.8);

  // 指数平滑更新 RMS
  const absRoll = Math.abs(currentRollDeg);
  const newRollRms = Math.sqrt(
    alphaEffective * absRoll * absRoll + (1 - alphaEffective) * prevMetrics.rollRms * prevMetrics.rollRms
  );

  // 更新峰值
  const newRollPeak = Math.max(prevMetrics.rollPeak * 0.999, absRoll);  // 缓慢衰减

  // 重新估算 MSI
  const newMsi = estimateMsiFromMotion(
    newRollRms,
    lateralAccelG,
    yawRateDegPerSec,
    rollPeriodSec,
    shipBeam,
    2.0
  );

  // VDV 简化更新
  const omega = (2 * Math.PI) / rollPeriodSec;
  const armLength = shipBeam / 2;
  const currentAccel = absRoll * (Math.PI / 180) * omega * omega * armLength;
  const newVdv = Math.pow(
    alphaEffective * Math.pow(currentAccel, 4) + (1 - alphaEffective) * Math.pow(prevMetrics.vdv, 4),
    0.25
  );

  // 频率加权加速度
  const freq = 1 / rollPeriodSec;
  const freqWeight = iso2631FrequencyWeight(freq);
  const rollWeightedAccel = newRollRms * (Math.PI / 180) * omega * omega * armLength * freqWeight;
  const lateralWeightedAccel = lateralAccelG * 9.81 * 0.65;
  const newFreqWeightedAccel = Math.sqrt(
    rollWeightedAccel * rollWeightedAccel + lateralWeightedAccel * lateralWeightedAccel
  );

  // 评级
  const newRating = getComfortRating(newRollRms, newMsi);

  return {
    msi: newMsi,
    rollRms: newRollRms,
    rollPeak: newRollPeak,
    comfortRating: newRating,
    vdv: newVdv,
    frequencyWeightedAccel: newFreqWeightedAccel,
  };
}

// ============ 工具函数 ============

/**
 * 标准正态分布累积函数 (近似)
 *
 * 使用 Abramowitz & Stegun 近似
 */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * 判断是否超出舒适度阈值
 *
 * @param metrics 舒适度指标
 * @param threshold 阈值评级
 */
export function isComfortExceeded(
  metrics: ComfortMetrics,
  threshold: ComfortRating = 'moderate'
): boolean {
  const ratings: ComfortRating[] = ['excellent', 'good', 'moderate', 'poor', 'unacceptable'];
  const currentIndex = ratings.indexOf(metrics.comfortRating);
  const thresholdIndex = ratings.indexOf(threshold);

  return currentIndex > thresholdIndex;
}

/**
 * 获取舒适度建议
 *
 * @param metrics 舒适度指标
 */
export function getComfortRecommendation(metrics: ComfortMetrics): {
  action: 'none' | 'monitor' | 'adjust' | 'urgent';
  suggestion: string;
} {
  switch (metrics.comfortRating) {
    case 'excellent':
      return {
        action: 'none',
        suggestion: '舒适度优秀，保持当前航行状态',
      };
    case 'good':
      return {
        action: 'none',
        suggestion: '舒适度良好，可继续当前航行',
      };
    case 'moderate':
      return {
        action: 'monitor',
        suggestion: '建议监控舒适度变化，必要时启用减摇系统',
      };
    case 'poor':
      return {
        action: 'adjust',
        suggestion: '建议调整航向或减速，增强减摇鳍控制',
      };
    case 'unacceptable':
      return {
        action: 'urgent',
        suggestion: '紧急! 需立即采取措施: 减速、改向、最大化减摇',
      };
  }
}

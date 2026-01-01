/**
 * 增益调度控制器
 *
 * 用于变参数系统 (如集装箱船) 的自适应 PID 控制
 *
 * 设计理念:
 * - 系统参数随工况 (如装载率) 剧烈变化时，固定增益无法兼顾各工况
 * - 增益调度根据测量的调度变量 (如装载率) 实时调整 PID 增益
 * - 实现平滑过渡，避免增益突变引起的系统不稳定
 *
 * 典型应用:
 * - 集装箱船: 满载 (高惯性、低灵敏度) vs 空载 (低惯性、高灵敏度)
 * - 飞机: 不同高度、速度下的气动特性变化
 */

import type { PIDGains, ControlMode, GainScheduleConfig } from '../../core/types';
import {
  clamp,
  lerp,
  CONTAINER_GAIN_SCHEDULE,
  CONTAINER_DEFAULT_PID,
} from '../../core/constants';
import {
  PIDController,
  interpolateGains,
  type PIDControllerConfig,
  type PIDControllerState,
  type PIDControlOutput,
} from './pid-controller';

// ============ 类型定义 ============

export type { GainScheduleConfig };

/** 调度模式 */
export type SchedulingMode =
  | 'fixed'       // 固定增益 (不调度)
  | 'linear'      // 线性插值调度
  | 'lookup'      // 查找表调度
  | 'adaptive';   // 自适应调度

/** 增益调度器配置 */
export interface GainSchedulerConfig {
  schedule: GainScheduleConfig;       // 增益调度表
  mode: SchedulingMode;               // 调度模式
  smoothingFactor: number;            // 平滑因子 (0-1), 越大越平滑
  maxRudderDeg: number;               // 最大舵角
  rateLimit?: number;                 // 舵角变化率限制 (°/s)
  derivativeFilter?: number;          // 微分滤波系数
}

/** 增益调度器状态 */
export interface GainSchedulerState extends PIDControllerState {
  currentGains: PIDGains;             // 当前增益
  targetGains: PIDGains;              // 目标增益 (调度后)
  schedulingVariable: number;         // 调度变量值 (如装载率)
}

/** 增益调度器诊断信息 */
export interface SchedulerDiagnostics {
  schedulingVariable: number;         // 调度变量
  currentGains: PIDGains;             // 当前增益
  targetGains: PIDGains;              // 目标增益
  gainsConverged: boolean;            // 增益是否收敛
  isSchedulingActive: boolean;        // 调度是否生效
}

// ============ 默认配置 ============

/** 默认增益调度器配置 */
export const DEFAULT_SCHEDULER_CONFIG: GainSchedulerConfig = {
  schedule: CONTAINER_GAIN_SCHEDULE,
  mode: 'linear',
  smoothingFactor: 0.1,               // 较慢的增益变化
  maxRudderDeg: 35,
  rateLimit: 2.5,
  derivativeFilter: 0.1,
};

// ============ 核心调度算法 ============

/**
 * 线性插值调度
 *
 * 根据调度变量在 [0, 1] 范围内线性插值增益
 *
 * @param variable 调度变量 [0, 1], 如装载率
 * @param schedule 增益调度配置
 */
export function linearSchedule(
  variable: number,
  schedule: GainScheduleConfig
): PIDGains {
  const t = clamp(variable, 0, 1);
  return interpolateGains(schedule.empty, schedule.full, t);
}

/**
 * 查找表调度 (多点插值)
 *
 * 支持非线性调度曲线
 *
 * @param variable 调度变量
 * @param breakpoints 断点数组 (调度变量值)
 * @param gains 各断点对应的增益
 */
export function lookupSchedule(
  variable: number,
  breakpoints: number[],
  gains: PIDGains[]
): PIDGains {
  if (breakpoints.length !== gains.length || breakpoints.length < 2) {
    throw new Error('Breakpoints and gains arrays must have same length >= 2');
  }

  const t = clamp(variable, breakpoints[0], breakpoints[breakpoints.length - 1]);

  // 找到插值区间
  let i = 0;
  while (i < breakpoints.length - 2 && t > breakpoints[i + 1]) {
    i++;
  }

  // 区间内线性插值
  const t_local = (t - breakpoints[i]) / (breakpoints[i + 1] - breakpoints[i]);
  return interpolateGains(gains[i], gains[i + 1], t_local);
}

/**
 * 平滑增益过渡
 *
 * 使用一阶滤波器平滑增益变化，避免突变
 *
 * @param currentGains 当前增益
 * @param targetGains 目标增益
 * @param smoothingFactor 平滑因子 (0-1)
 */
export function smoothGainsTransition(
  currentGains: PIDGains,
  targetGains: PIDGains,
  smoothingFactor: number
): PIDGains {
  const alpha = clamp(smoothingFactor, 0, 1);

  return {
    kp: currentGains.kp + alpha * (targetGains.kp - currentGains.kp),
    ki: currentGains.ki + alpha * (targetGains.ki - currentGains.ki),
    kd: currentGains.kd + alpha * (targetGains.kd - currentGains.kd),
  };
}

/**
 * 计算增益变化率
 */
export function computeGainChangeRate(
  prevGains: PIDGains,
  currentGains: PIDGains,
  dt: number
): { dKp: number; dKi: number; dKd: number; magnitude: number } {
  const dKp = (currentGains.kp - prevGains.kp) / dt;
  const dKi = (currentGains.ki - prevGains.ki) / dt;
  const dKd = (currentGains.kd - prevGains.kd) / dt;

  // 归一化变化率幅值
  const magnitude = Math.sqrt(dKp * dKp + dKi * dKi + dKd * dKd);

  return { dKp, dKi, dKd, magnitude };
}

// ============ 增益调度器类 ============

/**
 * 增益调度控制器
 *
 * 扩展 PID 控制器，添加基于调度变量的增益自动调整
 */
export class GainScheduler {
  private pidController: PIDController;
  private config: GainSchedulerConfig;
  private currentGains: PIDGains;
  private targetGains: PIDGains;
  private schedulingVariable: number;
  private mode: ControlMode;
  private schedulingEnabled: boolean;

  constructor(
    config?: Partial<GainSchedulerConfig>,
    initialMode: ControlMode = 'pid_scheduled',
    initialVariable: number = 0.5
  ) {
    // 合并配置
    this.config = {
      ...DEFAULT_SCHEDULER_CONFIG,
      ...config,
    };

    // 初始化增益
    this.schedulingVariable = clamp(initialVariable, 0, 1);
    this.targetGains = linearSchedule(this.schedulingVariable, this.config.schedule);
    this.currentGains = { ...this.targetGains };

    // 创建内部 PID 控制器
    this.pidController = new PIDController(
      {
        gains: this.currentGains,
        maxRudderDeg: this.config.maxRudderDeg,
        rateLimit: this.config.rateLimit,
        derivativeFilter: this.config.derivativeFilter,
      },
      'pid'
    );

    this.mode = initialMode;
    this.schedulingEnabled = initialMode === 'pid_scheduled';
  }

  /**
   * 更新调度变量 (如装载率)
   */
  updateSchedulingVariable(variable: number): void {
    this.schedulingVariable = clamp(variable, 0, 1);

    if (this.schedulingEnabled) {
      // 计算新的目标增益
      switch (this.config.mode) {
        case 'linear':
          this.targetGains = linearSchedule(this.schedulingVariable, this.config.schedule);
          break;
        case 'fixed':
          // 固定模式不更新目标增益
          break;
        case 'lookup':
        case 'adaptive':
          // 暂时使用线性调度
          this.targetGains = linearSchedule(this.schedulingVariable, this.config.schedule);
          break;
      }
    }
  }

  /**
   * 设置控制模式
   */
  setMode(mode: ControlMode): void {
    this.mode = mode;

    // 根据模式启用/禁用调度
    if (mode === 'pid_scheduled') {
      this.schedulingEnabled = true;
      // 立即更新目标增益
      this.updateSchedulingVariable(this.schedulingVariable);
    } else if (mode === 'pid') {
      // 固定 PID 模式，使用当前增益但停止调度
      this.schedulingEnabled = false;
    } else {
      this.schedulingEnabled = false;
    }

    // 更新内部控制器模式
    if (mode === 'manual' || mode === 'dp' || mode === 'autopilot') {
      this.pidController.setMode(mode);
    } else {
      this.pidController.setMode('pid');
    }
  }

  /**
   * 设置固定增益 (禁用调度)
   */
  setFixedGains(gains: PIDGains): void {
    this.schedulingEnabled = false;
    this.targetGains = { ...gains };
    this.currentGains = { ...gains };
    this.pidController.setGains(gains);
  }

  /**
   * 重置控制器状态
   */
  reset(): void {
    this.pidController.reset();
    // 重新计算增益
    this.updateSchedulingVariable(this.schedulingVariable);
    this.currentGains = { ...this.targetGains };
    this.pidController.setGains(this.currentGains);
  }

  /**
   * 计算控制输出
   */
  compute(
    targetHeading: number,
    currentHeading: number,
    dt: number
  ): PIDControlOutput {
    // 平滑增益过渡
    if (this.schedulingEnabled) {
      this.currentGains = smoothGainsTransition(
        this.currentGains,
        this.targetGains,
        this.config.smoothingFactor
      );

      // 更新 PID 控制器增益
      this.pidController.setGains(this.currentGains);
    }

    // 计算控制输出
    return this.pidController.compute(targetHeading, currentHeading, dt);
  }

  /**
   * 获取诊断信息
   */
  getDiagnostics(): SchedulerDiagnostics {
    // 判断增益是否收敛
    const gainsConverged =
      Math.abs(this.currentGains.kp - this.targetGains.kp) < 0.01 &&
      Math.abs(this.currentGains.ki - this.targetGains.ki) < 0.001 &&
      Math.abs(this.currentGains.kd - this.targetGains.kd) < 0.01;

    return {
      schedulingVariable: this.schedulingVariable,
      currentGains: { ...this.currentGains },
      targetGains: { ...this.targetGains },
      gainsConverged,
      isSchedulingActive: this.schedulingEnabled,
    };
  }

  /**
   * 获取当前增益
   */
  getCurrentGains(): PIDGains {
    return { ...this.currentGains };
  }

  /**
   * 获取当前控制模式
   */
  getMode(): ControlMode {
    return this.mode;
  }

  /**
   * 获取调度变量
   */
  getSchedulingVariable(): number {
    return this.schedulingVariable;
  }

  /**
   * 获取调度配置
   */
  getConfig(): GainSchedulerConfig {
    return { ...this.config };
  }
}

// ============ 工具函数 ============

/**
 * 根据系统参数计算推荐增益
 *
 * 基于 Nomoto 模型参数估算 PID 增益
 *
 * @param K 系统增益
 * @param T 时间常数 (s)
 * @param targetSettlingTime 期望调节时间 (s)
 */
export function computeRecommendedGains(
  K: number,
  T: number,
  targetSettlingTime: number = 60
): PIDGains {
  // 期望闭环带宽
  const omega = 4 / targetSettlingTime;

  // 期望阻尼比 (0.7 为临界阻尼附近)
  const zeta = 0.7;

  // 基于二阶系统极点配置
  const kp = (2 * zeta * omega * T - 1) / K;
  const ki = omega * omega * T / K;
  const kd = Math.max(0, (T - 1 / omega) / K);

  return {
    kp: Math.max(0.1, kp),
    ki: Math.max(0.001, ki),
    kd: Math.max(0.1, kd),
  };
}

/**
 * 创建基于装载率的增益调度配置
 *
 * @param K_empty 空载系统增益
 * @param K_full 满载系统增益
 * @param T_empty 空载时间常数
 * @param T_full 满载时间常数
 */
export function createLoadBasedSchedule(
  K_empty: number,
  K_full: number,
  T_empty: number,
  T_full: number
): GainScheduleConfig {
  return {
    empty: computeRecommendedGains(K_empty, T_empty),
    full: computeRecommendedGains(K_full, T_full),
  };
}

/**
 * 分析增益调度性能
 *
 * 计算不同装载率下的闭环特性
 */
export function analyzeSchedulePerformance(
  schedule: GainScheduleConfig,
  K_range: { empty: number; full: number },
  T_range: { empty: number; full: number },
  testPoints: number = 5
): {
  loadRatio: number;
  gains: PIDGains;
  estimatedSettlingTime: number;
  stabilityMargin: number;
}[] {
  const results = [];

  for (let i = 0; i < testPoints; i++) {
    const loadRatio = i / (testPoints - 1);

    // 获取增益
    const gains = linearSchedule(loadRatio, schedule);

    // 获取系统参数
    const K = lerp(K_range.empty, K_range.full, loadRatio);
    const T = lerp(T_range.empty, T_range.full, loadRatio);

    // 估算闭环特性 (简化分析)
    // 开环增益
    const openLoopGain = gains.kp * K;

    // 估算调节时间 (基于主导极点)
    const estimatedSettlingTime = T / (1 + openLoopGain);

    // 稳定裕度 (简化: 基于相位裕度估算)
    const stabilityMargin = Math.max(0, 1 - gains.kp * K / 3);

    results.push({
      loadRatio,
      gains,
      estimatedSettlingTime,
      stabilityMargin,
    });
  }

  return results;
}

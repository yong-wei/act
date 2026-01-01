/**
 * 挖掘冲击扰动模型
 * 模拟挖泥船绞刀切入岩石时的突变扰动
 *
 * 扰动特征:
 * - 阶跃分量: 模拟绞刀切入硬质岩石的持续反力
 * - 脉冲分量: 模拟岩块破碎瞬间的冲击力
 * - 随机间隔: 真实作业的不确定性
 */

import type { DisturbanceVector } from '../../core/types';
import { randomInRange, DREDGING_IMPACT_CONFIG } from '../../core/constants';

// ============ 类型定义 ============

/** 挖掘扰动配置 */
export interface DredgingImpactConfig {
  maxForce: number;           // 峰值力 (N)
  minInterval: number;        // 最小冲击间隔 (s)
  maxInterval: number;        // 最大冲击间隔 (s)
  decayTimeConstant: number;  // 衰减时间常数 (s)
  stepRatio: number;          // 阶跃分量比例
  impulseRatio: number;       // 脉冲分量比例
  directionVariance: number;  // 方向随机性 (rad)
}

/** 挖掘扰动状态 */
export interface DredgingImpactState {
  lastImpactTime: number;     // 上次冲击时间
  nextInterval: number;       // 下次冲击间隔
  isImpactActive: boolean;    // 是否正在冲击
  impactStartTime: number;    // 冲击开始时间
  currentForce: number;       // 当前力大小
  forceDirection: number;     // 力方向 (rad, 相对于船尾)
  impactType: 'step' | 'impulse' | 'mixed';
}

// ============ 默认配置 ============

export const DEFAULT_DREDGING_CONFIG: DredgingImpactConfig = {
  maxForce: DREDGING_IMPACT_CONFIG.MAX_FORCE,
  minInterval: DREDGING_IMPACT_CONFIG.MIN_INTERVAL,
  maxInterval: DREDGING_IMPACT_CONFIG.MAX_INTERVAL,
  decayTimeConstant: DREDGING_IMPACT_CONFIG.DECAY_TIME_CONSTANT,
  stepRatio: DREDGING_IMPACT_CONFIG.STEP_RATIO,
  impulseRatio: DREDGING_IMPACT_CONFIG.IMPULSE_RATIO,
  directionVariance: 0.3,  // ~17° 随机偏差
};

// ============ 状态管理 ============

/** 创建初始扰动状态 */
export function createDredgingImpactState(): DredgingImpactState {
  return {
    lastImpactTime: 0,
    nextInterval: randomInRange(
      DEFAULT_DREDGING_CONFIG.minInterval,
      DEFAULT_DREDGING_CONFIG.maxInterval
    ),
    isImpactActive: false,
    impactStartTime: 0,
    currentForce: 0,
    forceDirection: Math.PI,  // 默认向后 (船尾方向)
    impactType: 'mixed',
  };
}

// ============ 扰动计算 ============

/**
 * 计算阶跃响应
 * 快速上升，缓慢衰减
 */
function computeStepResponse(
  timeSinceStart: number,
  maxForce: number,
  riseTime: number = 0.5,
  decayTime: number = 3.0
): number {
  if (timeSinceStart < 0) return 0;

  // 上升阶段 (一阶响应)
  const riseFactor = 1 - Math.exp(-timeSinceStart / riseTime);

  // 衰减阶段
  const decayFactor = Math.exp(-timeSinceStart / decayTime);

  // 组合: 快速上升后缓慢衰减
  return maxForce * riseFactor * decayFactor;
}

/**
 * 计算脉冲响应
 * 尖峰脉冲，快速衰减
 */
function computeImpulseResponse(
  timeSinceStart: number,
  maxForce: number,
  peakTime: number = 0.1,
  decayTime: number = 0.5
): number {
  if (timeSinceStart < 0) return 0;

  // 高斯脉冲形状
  const normalized = (timeSinceStart - peakTime) / decayTime;
  return maxForce * Math.exp(-0.5 * normalized * normalized);
}

/**
 * 计算混合扰动响应
 */
function computeMixedResponse(
  timeSinceStart: number,
  config: DredgingImpactConfig
): number {
  const stepForce = computeStepResponse(
    timeSinceStart,
    config.maxForce * config.stepRatio,
    0.5,
    config.decayTimeConstant
  );

  const impulseForce = computeImpulseResponse(
    timeSinceStart,
    config.maxForce * config.impulseRatio,
    0.1,
    0.3
  );

  return stepForce + impulseForce;
}

/**
 * 主扰动计算函数
 */
export function computeDredgingDisturbance(
  time: number,
  state: DredgingImpactState,
  config: DredgingImpactConfig = DEFAULT_DREDGING_CONFIG
): { disturbance: DisturbanceVector; newState: DredgingImpactState } {
  let newState = { ...state };

  // 检查是否触发新冲击
  if (!state.isImpactActive && time - state.lastImpactTime >= state.nextInterval) {
    newState = triggerNewImpact(time, config);
  }

  // 计算当前扰动力
  let force = 0;
  if (newState.isImpactActive) {
    const timeSinceStart = time - newState.impactStartTime;
    force = computeMixedResponse(timeSinceStart, config);

    // 检查冲击是否结束 (力衰减到 1%)
    if (force < config.maxForce * 0.01) {
      newState.isImpactActive = false;
      newState.lastImpactTime = time;
      newState.nextInterval = randomInRange(config.minInterval, config.maxInterval);
      force = 0;
    }
  }

  newState.currentForce = force;

  // 计算扰动向量 (转换到船体坐标)
  const direction = newState.forceDirection;

  // 主要是向后的反力 (绞刀在船艏，反力向船尾)
  // 加上随机横向分量
  const forceX = -force * Math.cos(direction);  // 负=向后
  const forceY = force * Math.sin(direction);   // 横向分量
  const momentN = force * 10 * Math.sin(direction);  // 力矩臂约 10m

  return {
    disturbance: { forceX, forceY, momentN },
    newState,
  };
}

/**
 * 触发新的冲击事件
 */
function triggerNewImpact(
  time: number,
  config: DredgingImpactConfig
): DredgingImpactState {
  // 随机选择冲击类型
  const rand = Math.random();
  let impactType: 'step' | 'impulse' | 'mixed';
  if (rand < 0.3) {
    impactType = 'step';
  } else if (rand < 0.5) {
    impactType = 'impulse';
  } else {
    impactType = 'mixed';
  }

  // 随机力方向 (主要向后，略有偏差)
  const direction = Math.PI + randomInRange(-config.directionVariance, config.directionVariance);

  return {
    lastImpactTime: time,
    nextInterval: randomInRange(config.minInterval, config.maxInterval),
    isImpactActive: true,
    impactStartTime: time,
    currentForce: 0,
    forceDirection: direction,
    impactType,
  };
}

// ============ 扰动模型类 ============

/**
 * 挖掘扰动模型类
 * 封装状态管理和计算
 */
export class DredgingImpactModel {
  private state: DredgingImpactState;
  private config: DredgingImpactConfig;
  private enabled: boolean = true;

  constructor(config: Partial<DredgingImpactConfig> = {}) {
    this.config = { ...DEFAULT_DREDGING_CONFIG, ...config };
    this.state = createDredgingImpactState();
  }

  /** 启用/禁用扰动 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.state.isImpactActive = false;
      this.state.currentForce = 0;
    }
  }

  /** 更新配置 */
  updateConfig(config: Partial<DredgingImpactConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 重置状态 */
  reset(): void {
    this.state = createDredgingImpactState();
  }

  /** 计算扰动 */
  compute(time: number): DisturbanceVector {
    if (!this.enabled) {
      return { forceX: 0, forceY: 0, momentN: 0 };
    }

    const result = computeDredgingDisturbance(time, this.state, this.config);
    this.state = result.newState;
    return result.disturbance;
  }

  /** 获取当前状态 (用于可视化) */
  getState(): DredgingImpactState {
    return { ...this.state };
  }

  /** 手动触发冲击 (用于测试/演示) */
  triggerImpact(): void {
    this.state = triggerNewImpact(this.state.lastImpactTime + this.state.nextInterval, this.config);
  }
}

// ============ 其他环境扰动 ============

/**
 * 计算海流扰动
 */
export function computeCurrentDisturbance(
  currentSpeed: number,       // 流速 (m/s)
  currentDirection: number,   // 流向 (rad, 地固)
  shipHeading: number,        // 船舶航向 (rad)
  waterplaneArea: number,     // 水线面积 (m²)
  draft: number               // 吃水 (m)
): DisturbanceVector {
  // 相对流向 (体固坐标)
  const relativeDirection = currentDirection - shipHeading;

  // 流体力 (简化模型)
  const rho = 1025;  // 海水密度
  const Cd = 1.0;    // 阻力系数
  const area = waterplaneArea * draft * 0.1;  // 有效面积

  const force = 0.5 * rho * Cd * area * currentSpeed * currentSpeed;

  const forceX = force * Math.cos(relativeDirection);
  const forceY = force * Math.sin(relativeDirection);

  // 力矩 (假设作用点偏离船中)
  const momentArm = 10;  // m
  const momentN = forceY * momentArm;

  return { forceX, forceY, momentN };
}

/**
 * 计算风扰动
 */
export function computeWindDisturbance(
  windSpeed: number,          // 风速 (m/s)
  windDirection: number,      // 风向 (rad, 地固)
  shipHeading: number,        // 船舶航向 (rad)
  superstructureArea: number, // 上层建筑面积 (m²)
  Cx: number = 0.8,           // 纵向风力系数
  Cy: number = 1.2            // 横向风力系数
): DisturbanceVector {
  // 相对风向 (体固坐标)
  const relativeDirection = windDirection - shipHeading;

  // 空气动力
  const rho = 1.225;  // 空气密度

  const forceX = 0.5 * rho * Cx * superstructureArea *
    windSpeed * windSpeed * Math.cos(relativeDirection);
  const forceY = 0.5 * rho * Cy * superstructureArea *
    windSpeed * windSpeed * Math.sin(relativeDirection);

  // 风力矩
  const momentArm = 20;  // m
  const momentN = forceY * momentArm;

  return { forceX, forceY, momentN };
}

/**
 * 组合所有环境扰动
 */
export function computeTotalDisturbance(
  dredgingModel: DredgingImpactModel | null,
  time: number,
  currentSpeed: number,
  currentDirection: number,
  windSpeed: number,
  windDirection: number,
  shipHeading: number,
  shipParams: {
    waterplaneArea: number;
    draft: number;
    superstructureArea: number;
  }
): DisturbanceVector {
  let total: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 };

  // 挖掘扰动
  if (dredgingModel) {
    const dredging = dredgingModel.compute(time);
    total.forceX += dredging.forceX;
    total.forceY += dredging.forceY;
    total.momentN += dredging.momentN;
  }

  // 海流扰动
  const current = computeCurrentDisturbance(
    currentSpeed,
    currentDirection,
    shipHeading,
    shipParams.waterplaneArea,
    shipParams.draft
  );
  total.forceX += current.forceX;
  total.forceY += current.forceY;
  total.momentN += current.momentN;

  // 风扰动
  const wind = computeWindDisturbance(
    windSpeed,
    windDirection,
    shipHeading,
    shipParams.superstructureArea
  );
  total.forceX += wind.forceX;
  total.forceY += wind.forceY;
  total.momentN += wind.momentN;

  return total;
}

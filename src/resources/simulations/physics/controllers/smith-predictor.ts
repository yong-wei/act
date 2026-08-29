/**
 * Smith 预估器控制器
 *
 * 用于克服大纯时滞系统的控制难题
 *
 * 原理:
 * Smith 预估器通过内部模型预测系统的无时滞响应，
 * 从而让控制器"看不到"时滞，实现更好的控制性能。
 *
 * 结构:
 *          +------+
 *   r(t) ─→| PID  |─→ u(t) ─→ [Plant with Delay] ─→ y(t)
 *          +------+                                    ↓
 *             ↑                                        │
 *   e'(t) ←───┴── y_m(t) ─ y_md(t) + y(t) ←───────────┘
 *                    ↑           ↑
 *             [Model]   [Model+Delay]
 *
 * 其中:
 * - y_m(t): 无时滞模型输出
 * - y_md(t): 带时滞模型输出
 * - e'(t) = r(t) - (y(t) + y_m(t) - y_md(t))
 *         = r(t) - y(t) - (y_m(t) - y_md(t))
 *
 * 通过这种结构，PID 控制器"感知"的是无时滞的等效系统
 */

import type { SmithPredictorState, PIDState } from '../../core/types';

// ============ 类型导出 ============

export type { SmithPredictorState };

/** Smith 预估器配置 */
export interface SmithPredictorConfig {
  modelK: number;         // 模型增益
  modelT: number;         // 模型时间常数 (s)
  modelDelay: number;     // 模型时滞 (s)
  dt: number;             // 积分步长 (s)
}

/** Smith 预估器完整状态 */
export interface SmithPredictorFullState {
  predictor: SmithPredictorState;
  pid: PIDState;
  modelState: number;     // 无时滞模型状态 (航向)
}

// ============ 初始化 ============

/**
 * 创建 Smith 预估器初始状态
 */
export function createSmithPredictorState(
  config: SmithPredictorConfig
): SmithPredictorState {
  const bufferSize = Math.max(1, Math.ceil(config.modelDelay / config.dt));

  return {
    modelOutput: 0,
    delayedModelOutput: 0,
    modelHistory: new Array(bufferSize).fill(0),
    historyIndex: 0,
  };
}

/**
 * 创建完整 Smith 预估器状态
 */
export function createSmithPredictorFullState(
  config: SmithPredictorConfig
): SmithPredictorFullState {
  return {
    predictor: createSmithPredictorState(config),
    pid: { integral: 0, prevError: 0 },
    modelState: 0,
  };
}

// ============ 工具函数 ============

/**
 * 比较 Smith 预估器与普通 PID 的性能
 */
export function compareControlPerformance(
  smithError: number[],
  pidError: number[]
): {
  smithIAE: number;       // Smith 积分绝对误差
  pidIAE: number;         // PID 积分绝对误差
  improvement: number;    // 改善百分比
  smithSettling: number;  // Smith 调节时间索引
  pidSettling: number;    // PID 调节时间索引
} {
  // 计算 IAE (积分绝对误差)
  const smithIAE = smithError.reduce((sum, e) => sum + Math.abs(e), 0);
  const pidIAE = pidError.reduce((sum, e) => sum + Math.abs(e), 0);

  // 改善百分比
  const improvement = pidIAE > 0 ? ((pidIAE - smithIAE) / pidIAE) * 100 : 0;

  // 调节时间 (误差首次进入 ±2% 范围)
  const threshold = 2;
  const findSettling = (errors: number[]): number => {
    for (let i = errors.length - 1; i >= 0; i--) {
      if (Math.abs(errors[i]) > threshold) {
        return i + 1;
      }
    }
    return 0;
  };

  return {
    smithIAE,
    pidIAE,
    improvement,
    smithSettling: findSettling(smithError),
    pidSettling: findSettling(pidError),
  };
}

/**
 * 获取 Smith 预估器状态摘要
 */
export function getSmithPredictorSummary(state: SmithPredictorFullState): {
  modelPrediction: number;
  delayCompensation: number;
  integralTerm: number;
} {
  return {
    modelPrediction: state.predictor.modelOutput,
    delayCompensation: state.predictor.modelOutput - state.predictor.delayedModelOutput,
    integralTerm: state.pid.integral,
  };
}

/**
 * 重置 Smith 预估器状态
 */
export function resetSmithPredictor(
  state: SmithPredictorFullState,
  config: SmithPredictorConfig
): SmithPredictorFullState {
  return createSmithPredictorFullState(config);
}

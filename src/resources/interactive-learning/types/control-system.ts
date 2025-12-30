/**
 * 通用控制系统类型定义
 * Universal Control System Type Definitions
 *
 * 支持传递函数、状态空间和非线性模型的可扩展仿真框架
 */

// ===== 物理模型类型 =====

/**
 * 模型类型标识
 */
export type ModelType = 'transfer_function' | 'state_space' | 'nonlinear';

/**
 * 传递函数模型
 * G(s) = (b_n*s^n + ... + b_1*s + b_0) / (a_m*s^m + ... + a_1*s + a_0)
 */
export interface TransferFunctionModel {
  type: 'transfer_function';

  /** 分子多项式系数 [b_0, b_1, ..., b_n]（从低次到高次） */
  numerator: number[];

  /** 分母多项式系数 [a_0, a_1, ..., a_m]（从低次到高次） */
  denominator: number[];

  /** 额外参数（用于参数化传递函数，如 K, T, zeta 等） */
  params?: Record<string, number>;

  /** 模型名称（可选，用于调试和显示） */
  name?: string;
}

/**
 * 状态空间模型
 * ẋ = Ax + Bu
 * y = Cx + Du
 */
export interface StateSpaceModel {
  type: 'state_space';

  /** 系统矩阵 A (n×n) */
  A: number[][];

  /** 输入矩阵 B (n×p) */
  B: number[][];

  /** 输出矩阵 C (q×n) */
  C: number[][];

  /** 直接传递矩阵 D (q×p) */
  D: number[][];

  /** 额外参数 */
  params?: Record<string, number>;

  /** 模型名称（可选） */
  name?: string;
}

/**
 * 非线性模型导数函数类型
 * f(x, u, t, params) = dx/dt
 */
export type DerivativesFunction = (
  state: number[],
  input: number[],
  t: number,
  params: Record<string, number>
) => number[];

/**
 * 非线性模型输出函数类型
 * g(x, u, t, params) = y
 */
export type OutputFunction = (
  state: number[],
  input: number[],
  t: number,
  params: Record<string, number>
) => number[];

/**
 * 非线性模型（函数式接口）
 * 通过用户自定义的 derivatives 函数支持任意非线性系统
 */
export interface NonlinearModel {
  type: 'nonlinear';

  /** 模型参数 */
  params: Record<string, number>;

  /**
   * 状态导数函数：dx/dt = f(x, u, t, params)
   * 这是非线性模型的核心扩展点
   */
  derivatives: DerivativesFunction;

  /**
   * 输出函数：y = g(x, u, t, params)
   * 如未提供，默认返回全部状态
   */
  output?: OutputFunction;

  /** 状态维度 */
  stateSize: number;

  /** 输入维度 */
  inputSize: number;

  /** 输出维度（如未提供，等于 stateSize） */
  outputSize?: number;

  /** 模型名称（可选） */
  name?: string;
}

/**
 * 联合系统模型类型
 */
export type SystemModel = TransferFunctionModel | StateSpaceModel | NonlinearModel;

// ===== 求解器类型 =====

/**
 * 求解器类型
 */
export type SolverType = 'euler' | 'runge_kutta_4';

/**
 * 求解器配置
 */
export interface SolverConfig {
  /** 求解器类型 */
  type: SolverType;

  /** 积分步长 dt（秒） */
  stepSize: number;

  /** 最大仿真时间（可选，秒） */
  maxTime?: number;

  /** 状态边界限制（可选） */
  stateBounds?: {
    min?: number[];
    max?: number[];
  };
}

// ===== 仿真配置 =====

/**
 * 安全检查配置
 */
export interface SafetyConfig {
  /** 是否启用安全检查 */
  enabled: boolean;

  /** 状态上限阈值 */
  stateUpperBounds?: number[];

  /** 状态下限阈值 */
  stateLowerBounds?: number[];

  /** 输出上限阈值 */
  outputUpperBounds?: number[];

  /** 输出下限阈值 */
  outputLowerBounds?: number[];

  /** 自定义检查函数 */
  customCheck?: (
    state: number[],
    output: number[],
    t: number
  ) => SafetyViolation | null;
}

/**
 * 控制系统仿真配置
 */
export interface ControlSystemConfig {
  /** 系统模型 */
  model: SystemModel;

  /** 求解器配置 */
  solver: SolverConfig;

  /** 初始状态（可选，默认全零） */
  initialState?: number[];

  /** 初始输入（可选，默认全零） */
  initialInputs?: number[];

  /** 仿真时长（秒，可选） */
  duration?: number;

  /** 时间缩放因子（可选，默认 1.0） */
  timeScale?: number;

  /** 安全配置（可选） */
  safety?: SafetyConfig;

  /** 历史记录采样间隔（秒，可选） */
  recordInterval?: number;

  /** 最大历史记录数（可选，防止内存溢出） */
  maxHistoryLength?: number;
}

// ===== 仿真状态 =====

/**
 * 安全违规信息
 */
export interface SafetyViolation {
  /** 违规类型 */
  type: string;

  /** 违规描述 */
  message: string;

  /** 发生时间戳 */
  timestamp: number;

  /** 违规值（可选） */
  value?: number;

  /** 阈值（可选） */
  threshold?: number;

  /** 违规的状态/输出索引（可选） */
  index?: number;

  /** 严重等级 */
  severity?: 'warning' | 'error' | 'critical';
}

/**
 * 控制系统仿真状态
 */
export interface ControlSystemState {
  /** 当前仿真时间（秒） */
  t: number;

  /** 输入向量 u */
  inputs: number[];

  /** 输出向量 y */
  outputs: number[];

  /** 状态向量 x */
  states: number[];

  /** 仿真是否正在运行 */
  isRunning: boolean;

  /** 仿真是否暂停 */
  isPaused: boolean;

  /** 仿真是否完成 */
  isCompleted: boolean;

  /** 安全违规信息（伦理熔断） */
  safetyViolation: SafetyViolation | null;

  /** 仿真步数计数 */
  stepCount: number;
}

/**
 * 仿真历史记录点
 */
export interface SimulationRecord {
  /** 时间戳 */
  t: number;

  /** 输入向量快照 */
  inputs: number[];

  /** 输出向量快照 */
  outputs: number[];

  /** 状态向量快照 */
  states: number[];
}

// ===== 仿真指标 =====

/**
 * 时域性能指标
 */
export interface TimedomainMetrics {
  /** 上升时间（秒，0% → 100%） */
  riseTime?: number;

  /** 调节时间（秒，进入 ±2% 或 ±5%） */
  settlingTime?: number;

  /** 超调量（百分比） */
  overshoot?: number;

  /** 稳态误差 */
  steadyStateError?: number;

  /** 峰值时间（秒） */
  peakTime?: number;

  /** 峰值 */
  peakValue?: number;
}

/**
 * 能量和效率指标
 */
export interface EnergyMetrics {
  /** 控制能量积分 ∫u²dt */
  controlEnergy?: number;

  /** 误差能量积分 ∫e²dt */
  errorEnergy?: number;

  /** 平均功率 */
  averagePower?: number;
}

/**
 * 综合仿真指标
 */
export interface SimulationMetrics {
  /** 时域性能指标 */
  timedomain?: TimedomainMetrics;

  /** 能量指标 */
  energy?: EnergyMetrics;

  /** 安全违规次数 */
  violationCount?: number;

  /** 自定义指标 */
  custom?: Record<string, number>;
}

// ===== Hook 回调类型 =====

/**
 * 仿真步进回调
 */
export type OnStepCallback = (state: ControlSystemState, record: SimulationRecord) => void;

/**
 * 仿真完成回调
 */
export type OnCompleteCallback = (
  finalState: ControlSystemState,
  history: SimulationRecord[],
  metrics: SimulationMetrics
) => void;

/**
 * 安全违规回调
 */
export type OnViolationCallback = (violation: SafetyViolation, state: ControlSystemState) => void;

/**
 * Hook 回调配置
 */
export interface SimulationCallbacks {
  /** 每步回调 */
  onStep?: OnStepCallback;

  /** 完成回调 */
  onComplete?: OnCompleteCallback;

  /** 违规回调 */
  onViolation?: OnViolationCallback;
}

// ===== Hook 返回类型 =====

/**
 * useControlSystem Hook 返回接口
 */
export interface UseControlSystemReturn {
  /** 当前仿真状态 */
  state: ControlSystemState;

  /** 仿真历史记录 */
  history: SimulationRecord[];

  /** 性能指标 */
  metrics: SimulationMetrics;

  // ===== 生命周期控制 =====

  /** 启动仿真 */
  start: () => void;

  /** 暂停仿真 */
  pause: () => void;

  /** 恢复仿真 */
  resume: () => void;

  /** 重置仿真 */
  reset: () => void;

  /** 单步执行 */
  step: () => void;

  // ===== 输入控制 =====

  /** 设置单个输入 */
  setInput: (index: number, value: number) => void;

  /** 设置所有输入 */
  setInputs: (inputs: number[]) => void;

  // ===== 参数控制 =====

  /** 设置模型参数 */
  setParam: (key: string, value: number) => void;

  /** 批量设置参数 */
  setParams: (params: Record<string, number>) => void;

  /** 更新配置 */
  updateConfig: (config: Partial<ControlSystemConfig>) => void;

  // ===== 状态查询 =====

  /** 获取当前状态 */
  getState: () => ControlSystemState;

  /** 清除安全违规 */
  clearViolation: () => void;

  /** 清除历史记录 */
  clearHistory: () => void;
}

// ===== 工具类型 =====

/**
 * 传递函数工厂参数
 */
export interface TransferFunctionParams {
  /** 增益 */
  K?: number;

  /** 时间常数 */
  T?: number;

  /** 阻尼比 */
  zeta?: number;

  /** 自然频率 */
  omega_n?: number;

  /** 零点 */
  zeros?: number[];

  /** 极点 */
  poles?: number[];
}

/**
 * 预定义传递函数类型
 */
export type PredefinedTransferFunction =
  | 'first_order'     // 一阶系统 K/(Ts+1)
  | 'second_order'    // 二阶系统 K*omega_n^2/(s^2+2*zeta*omega_n*s+omega_n^2)
  | 'integrator'      // 积分器 K/s
  | 'differentiator'  // 微分器 Ks
  | 'pid';            // PID 控制器

/**
 * 状态空间模型转换结果
 */
export interface StateSpaceConversion {
  /** 转换后的状态空间模型 */
  model: StateSpaceModel;

  /** 状态变量含义（可选） */
  stateNames?: string[];

  /** 转换方法（可控标准型、可观标准型等） */
  form?: 'controllable' | 'observable' | 'diagonal' | 'jordan';
}

// ===== 预定义非线性模型示例类型 =====

/**
 * 非线性模型工厂函数类型
 */
export type NonlinearModelFactory = (params: Record<string, number>) => NonlinearModel;

/**
 * 常见非线性模型标识
 */
export type CommonNonlinearModel =
  | 'saturation'      // 饱和非线性
  | 'dead_zone'       // 死区非线性
  | 'backlash'        // 间隙非线性
  | 'relay'           // 继电器非线性
  | 'van_der_pol'     // Van der Pol 振荡器
  | 'duffing'         // Duffing 振荡器
  | 'lorenz';         // Lorenz 混沌系统

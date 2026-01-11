export type SolverType = 'euler' | 'runge_kutta_4';

export interface TransferFunctionModel {
  type: 'transfer_function';
  /** 分子多项式系数 [b_0, b_1, ..., b_n]（从低次到高次） */
  numerator: number[];
  /** 分母多项式系数 [a_0, a_1, ..., a_m]（从低次到高次） */
  denominator: number[];
  /** 纯延时（秒，可选） */
  delay?: number;
  /** 额外参数（用于参数化传递函数，如 K, T, zeta 等） */
  params?: Record<string, number>;
  /** 模型名称（可选，用于调试和显示） */
  name?: string;
}

export interface StateSpaceModel {
  type: 'state_space';
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
  delay?: number;
  params?: Record<string, number>;
  name?: string;
}

export interface DiscreteStateSpaceModel {
  type: 'state_space_discrete';
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
  dt: number;
  delay?: number;
  params?: Record<string, number>;
  name?: string;
}

export interface NonlinearModel {
  type: 'nonlinear';
  stateSize: number;
  inputSize: number;
  outputSize: number;
  derivatives: (state: number[], input: number[], t: number, params?: Record<string, number>) => number[];
  output?: (state: number[], input: number[], t: number, params?: Record<string, number>) => number[];
  delay?: number;
  params?: Record<string, number>;
  name?: string;
}

export type SystemModel = TransferFunctionModel | StateSpaceModel | NonlinearModel;

export interface SimulationClockOptions {
  dt: number;
  maxSubSteps?: number;
}

export interface SimulationStateSnapshot {
  time: number;
  state: number[];
  output: number[];
}

'use client';

/**
 * 通用控制系统仿真 Hook
 * Universal Control System Simulation Hook
 *
 * 支持传递函数、状态空间和非线性模型的实时仿真
 * 使用 requestAnimationFrame 驱动仿真循环
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ControlSystemConfig,
  ControlSystemState,
  SimulationRecord,
  SimulationMetrics,
  UseControlSystemReturn,
  SafetyViolation,
  SystemModel,
  TransferFunctionModel,
  StateSpaceModel,
  NonlinearModel,
  SolverType,
  SimulationCallbacks,
  TimedomainMetrics,
  EnergyMetrics,
} from '@/resources/interactive-learning/types/control-system';

// ===== 默认配置 =====

const DEFAULT_STATE: ControlSystemState = {
  t: 0,
  inputs: [0],
  outputs: [0],
  states: [0],
  isRunning: false,
  isPaused: false,
  isCompleted: false,
  safetyViolation: null,
  stepCount: 0,
};

const DEFAULT_METRICS: SimulationMetrics = {
  timedomain: {},
  energy: {
    controlEnergy: 0,
    errorEnergy: 0,
  },
  violationCount: 0,
};

// ===== 数学工具函数 =====

/**
 * 向量加法
 */
function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

/**
 * 向量标量乘法
 */
function vectorScale(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

/**
 * 矩阵向量乘法
 */
function matVecMul(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((sum, m, j) => sum + m * (v[j] ?? 0), 0));
}

/**
 * 限幅函数
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ===== 传递函数转状态空间 =====

/**
 * 将传递函数转换为可控标准型状态空间模型
 * G(s) = (b_n*s^n + ... + b_0) / (s^n + a_{n-1}*s^{n-1} + ... + a_0)
 */
function transferFunctionToStateSpace(tf: TransferFunctionModel): StateSpaceModel {
  const { numerator, denominator } = tf;

  // 确保分母首项系数为 1（归一化）
  const a0 = denominator[denominator.length - 1] || 1;
  const normDen = denominator.map((c) => c / a0);
  const normNum = numerator.map((c) => c / a0);

  const n = normDen.length - 1; // 系统阶数

  if (n <= 0) {
    // 静态增益
    const gain = normNum[0] ?? 0;
    return {
      type: 'state_space',
      A: [[0]],
      B: [[1]],
      C: [[gain]],
      D: [[0]],
      params: tf.params,
    };
  }

  // 构建可控标准型
  // A 矩阵：伴随矩阵形式
  const A: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n - 1; i++) {
    A[i][i + 1] = 1;
  }

  // 最后一行是 -a_0, -a_1, ..., -a_{n-1}
  for (let i = 0; i < n; i++) {
    A[n - 1][i] = -(normDen[i] ?? 0);
  }

  // B 矩阵
  const B: number[][] = Array(n)
    .fill(null)
    .map(() => [0]);
  B[n - 1][0] = 1;

  // C 矩阵：来自分子系数
  const C: number[][] = [Array(n).fill(0)];
  for (let i = 0; i < Math.min(normNum.length, n); i++) {
    C[0][i] = normNum[i] ?? 0;
  }

  // D 矩阵：如果分子阶数等于分母阶数
  const D: number[][] = [[normNum.length > n ? normNum[n] ?? 0 : 0]];

  return {
    type: 'state_space',
    A,
    B,
    C,
    D,
    params: tf.params,
  };
}

// ===== 模型求解函数 =====

/**
 * 获取状态空间模型的导数 dx/dt = Ax + Bu
 */
function getStateSpaceDerivatives(
  ss: StateSpaceModel,
  x: number[],
  u: number[]
): number[] {
  const Ax = matVecMul(ss.A, x);
  const Bu = matVecMul(ss.B, u);
  return vectorAdd(Ax, Bu);
}

/**
 * 计算状态空间模型的输出 y = Cx + Du
 */
function getStateSpaceOutput(
  ss: StateSpaceModel,
  x: number[],
  u: number[]
): number[] {
  const Cx = matVecMul(ss.C, x);
  const Du = matVecMul(ss.D, u);
  return vectorAdd(Cx, Du);
}

/**
 * 获取任意模型的导数
 */
function getDerivatives(
  model: SystemModel,
  x: number[],
  u: number[],
  t: number,
  ssCache: StateSpaceModel | null
): number[] {
  switch (model.type) {
    case 'transfer_function': {
      const ss = ssCache ?? transferFunctionToStateSpace(model);
      return getStateSpaceDerivatives(ss, x, u);
    }
    case 'state_space': {
      return getStateSpaceDerivatives(model, x, u);
    }
    case 'nonlinear': {
      return model.derivatives(x, u, t, model.params);
    }
  }
}

/**
 * 获取模型输出
 */
function getOutput(
  model: SystemModel,
  x: number[],
  u: number[],
  t: number,
  ssCache: StateSpaceModel | null
): number[] {
  switch (model.type) {
    case 'transfer_function': {
      const ss = ssCache ?? transferFunctionToStateSpace(model);
      return getStateSpaceOutput(ss, x, u);
    }
    case 'state_space': {
      return getStateSpaceOutput(model, x, u);
    }
    case 'nonlinear': {
      if (model.output) {
        return model.output(x, u, t, model.params);
      }
      // 默认返回全部状态
      return [...x];
    }
  }
}

// ===== 数值求解器 =====

/**
 * Euler 方法
 */
function eulerStep(
  model: SystemModel,
  x: number[],
  u: number[],
  t: number,
  dt: number,
  ssCache: StateSpaceModel | null
): number[] {
  const dxdt = getDerivatives(model, x, u, t, ssCache);
  return vectorAdd(x, vectorScale(dxdt, dt));
}

/**
 * Runge-Kutta 4 方法
 */
function rk4Step(
  model: SystemModel,
  x: number[],
  u: number[],
  t: number,
  dt: number,
  ssCache: StateSpaceModel | null
): number[] {
  const k1 = getDerivatives(model, x, u, t, ssCache);
  const k2 = getDerivatives(
    model,
    vectorAdd(x, vectorScale(k1, dt / 2)),
    u,
    t + dt / 2,
    ssCache
  );
  const k3 = getDerivatives(
    model,
    vectorAdd(x, vectorScale(k2, dt / 2)),
    u,
    t + dt / 2,
    ssCache
  );
  const k4 = getDerivatives(
    model,
    vectorAdd(x, vectorScale(k3, dt)),
    u,
    t + dt,
    ssCache
  );

  // x_next = x + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)
  const weightedSum = vectorAdd(
    vectorAdd(k1, vectorScale(k2, 2)),
    vectorAdd(vectorScale(k3, 2), k4)
  );

  return vectorAdd(x, vectorScale(weightedSum, dt / 6));
}

/**
 * 执行一步仿真
 */
function solverStep(
  solverType: SolverType,
  model: SystemModel,
  x: number[],
  u: number[],
  t: number,
  dt: number,
  ssCache: StateSpaceModel | null
): number[] {
  switch (solverType) {
    case 'euler':
      return eulerStep(model, x, u, t, dt, ssCache);
    case 'runge_kutta_4':
      return rk4Step(model, x, u, t, dt, ssCache);
    default:
      return eulerStep(model, x, u, t, dt, ssCache);
  }
}

// ===== 安全检测 =====

/**
 * 检查安全违规
 */
function checkSafety(
  config: ControlSystemConfig,
  state: number[],
  output: number[],
  t: number
): SafetyViolation | null {
  const safety = config.safety;
  if (!safety?.enabled) return null;

  // 检查状态边界
  if (safety.stateUpperBounds) {
    for (let i = 0; i < state.length; i++) {
      const bound = safety.stateUpperBounds[i];
      if (bound !== undefined && state[i] > bound) {
        return {
          type: 'STATE_OVERFLOW',
          message: `状态变量 x[${i}] 超过上限`,
          timestamp: t,
          value: state[i],
          threshold: bound,
          index: i,
          severity: 'error',
        };
      }
    }
  }

  if (safety.stateLowerBounds) {
    for (let i = 0; i < state.length; i++) {
      const bound = safety.stateLowerBounds[i];
      if (bound !== undefined && state[i] < bound) {
        return {
          type: 'STATE_UNDERFLOW',
          message: `状态变量 x[${i}] 低于下限`,
          timestamp: t,
          value: state[i],
          threshold: bound,
          index: i,
          severity: 'error',
        };
      }
    }
  }

  // 检查输出边界
  if (safety.outputUpperBounds) {
    for (let i = 0; i < output.length; i++) {
      const bound = safety.outputUpperBounds[i];
      if (bound !== undefined && output[i] > bound) {
        return {
          type: 'OUTPUT_OVERFLOW',
          message: `输出 y[${i}] 超过上限`,
          timestamp: t,
          value: output[i],
          threshold: bound,
          index: i,
          severity: 'warning',
        };
      }
    }
  }

  if (safety.outputLowerBounds) {
    for (let i = 0; i < output.length; i++) {
      const bound = safety.outputLowerBounds[i];
      if (bound !== undefined && output[i] < bound) {
        return {
          type: 'OUTPUT_UNDERFLOW',
          message: `输出 y[${i}] 低于下限`,
          timestamp: t,
          value: output[i],
          threshold: bound,
          index: i,
          severity: 'warning',
        };
      }
    }
  }

  // 自定义检查
  if (safety.customCheck) {
    return safety.customCheck(state, output, t);
  }

  return null;
}

// ===== 获取初始状态维度 =====

function getStateDimension(model: SystemModel): number {
  switch (model.type) {
    case 'transfer_function':
      return model.denominator.length - 1 || 1;
    case 'state_space':
      return model.A.length;
    case 'nonlinear':
      return model.stateSize;
  }
}

function getInputDimension(model: SystemModel): number {
  switch (model.type) {
    case 'transfer_function':
      return 1;
    case 'state_space':
      return model.B[0]?.length ?? 1;
    case 'nonlinear':
      return model.inputSize;
  }
}

function getOutputDimension(model: SystemModel): number {
  switch (model.type) {
    case 'transfer_function':
      return 1;
    case 'state_space':
      return model.C.length;
    case 'nonlinear':
      return model.outputSize ?? model.stateSize;
  }
}

// ===== 主 Hook =====

export interface UseControlSystemOptions extends SimulationCallbacks {
  /** 是否自动开始 */
  autoStart?: boolean;
}

export function useControlSystem(
  config: ControlSystemConfig,
  options: UseControlSystemOptions = {}
): UseControlSystemReturn {
  const { onStep, onComplete, onViolation, autoStart = false } = options;

  // ===== 状态 =====
  const [state, setState] = useState<ControlSystemState>(() => {
    const stateDim = getStateDimension(config.model);
    const inputDim = getInputDimension(config.model);
    const outputDim = getOutputDimension(config.model);

    return {
      ...DEFAULT_STATE,
      states: config.initialState ?? Array(stateDim).fill(0),
      inputs: config.initialInputs ?? Array(inputDim).fill(0),
      outputs: Array(outputDim).fill(0),
    };
  });

  const [history, setHistory] = useState<SimulationRecord[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics>(DEFAULT_METRICS);

  // ===== Refs（内部状态缓存，避免频繁 React 更新） =====
  const configRef = useRef(config);
  const stateRef = useRef(state);
  const historyRef = useRef<SimulationRecord[]>([]);
  const metricsRef = useRef<{
    controlEnergy: number;
    errorEnergy: number;
    peakValue: number;
    peakTime: number;
    settlingTime: number | null;
    overshoot: number;
    violationCount: number;
  }>({
    controlEnergy: 0,
    errorEnergy: 0,
    peakValue: 0,
    peakTime: 0,
    settlingTime: null,
    overshoot: 0,
    violationCount: 0,
  });

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastRecordTimeRef = useRef<number>(0);

  // 状态空间缓存（用于传递函数转换）
  const ssCache = useRef<StateSpaceModel | null>(null);

  // 更新配置时重新计算缓存
  useEffect(() => {
    configRef.current = config;
    if (config.model.type === 'transfer_function') {
      ssCache.current = transferFunctionToStateSpace(config.model);
    } else {
      ssCache.current = null;
    }
  }, [config]);

  // 同步状态到 ref
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ===== 仿真循环 =====
  const simulationLoop = useCallback(
    (timestamp: number) => {
      if (!stateRef.current.isRunning || stateRef.current.isPaused) {
        return;
      }

      const cfg = configRef.current;
      const dt = cfg.solver.stepSize;
      const timeScale = cfg.timeScale ?? 1.0;

      // 计算实际经过时间
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // 仿真时间步进
      const simDelta = (deltaMs / 1000) * timeScale;
      const steps = Math.max(1, Math.floor(simDelta / dt));

      let currentState = stateRef.current;

      for (let i = 0; i < steps; i++) {
        const { t, states, inputs } = currentState;

        // 执行一步求解
        const newStates = solverStep(
          cfg.solver.type,
          cfg.model,
          states,
          inputs,
          t,
          dt,
          ssCache.current
        );

        // 应用状态边界限制
        const boundedStates = cfg.solver.stateBounds
          ? newStates.map((s, idx) =>
              clamp(
                s,
                cfg.solver.stateBounds?.min?.[idx] ?? -Infinity,
                cfg.solver.stateBounds?.max?.[idx] ?? Infinity
              )
            )
          : newStates;

        // 计算输出
        const newOutputs = getOutput(
          cfg.model,
          boundedStates,
          inputs,
          t + dt,
          ssCache.current
        );

        // 安全检测
        const violation = checkSafety(cfg, boundedStates, newOutputs, t + dt);

        if (violation) {
          metricsRef.current.violationCount++;
          onViolation?.(violation, currentState);

          // 伦理熔断：暂停仿真
          if (violation.severity === 'critical' || violation.severity === 'error') {
            currentState = {
              ...currentState,
              t: t + dt,
              states: boundedStates,
              outputs: newOutputs,
              safetyViolation: violation,
              isPaused: true,
              stepCount: currentState.stepCount + 1,
            };
            break;
          }
        }

        // 更新指标
        const u = inputs[0] ?? 0;
        const y = newOutputs[0] ?? 0;
        const target = 1.0; // 假设目标为 1（阶跃响应）
        const error = target - y;

        metricsRef.current.controlEnergy += u * u * dt;
        metricsRef.current.errorEnergy += error * error * dt;

        if (Math.abs(y) > Math.abs(metricsRef.current.peakValue)) {
          metricsRef.current.peakValue = y;
          metricsRef.current.peakTime = t + dt;
        }

        // 计算超调量（假设目标为正值）
        if (y > target && y > metricsRef.current.overshoot + target) {
          metricsRef.current.overshoot = y - target;
        }

        // 更新当前状态
        currentState = {
          ...currentState,
          t: t + dt,
          states: boundedStates,
          outputs: newOutputs,
          stepCount: currentState.stepCount + 1,
          safetyViolation: violation,
        };

        // 记录历史
        const recordInterval = cfg.recordInterval ?? 0.05;
        if (t + dt - lastRecordTimeRef.current >= recordInterval) {
          const record: SimulationRecord = {
            t: t + dt,
            inputs: [...currentState.inputs],
            outputs: [...newOutputs],
            states: [...boundedStates],
          };

          historyRef.current.push(record);

          // 限制历史长度
          const maxLen = cfg.maxHistoryLength ?? 10000;
          if (historyRef.current.length > maxLen) {
            historyRef.current = historyRef.current.slice(-maxLen);
          }

          lastRecordTimeRef.current = t + dt;
          onStep?.(currentState, record);
        }

        // 检查是否完成
        if (cfg.duration && t + dt >= cfg.duration) {
          currentState = {
            ...currentState,
            isRunning: false,
            isCompleted: true,
          };

          const finalMetrics: SimulationMetrics = {
            timedomain: {
              peakValue: metricsRef.current.peakValue,
              peakTime: metricsRef.current.peakTime,
              overshoot: (metricsRef.current.overshoot / target) * 100,
              settlingTime: metricsRef.current.settlingTime ?? undefined,
            },
            energy: {
              controlEnergy: metricsRef.current.controlEnergy,
              errorEnergy: metricsRef.current.errorEnergy,
            },
            violationCount: metricsRef.current.violationCount,
          };

          setMetrics(finalMetrics);
          onComplete?.(currentState, historyRef.current, finalMetrics);
          break;
        }
      }

      // 批量更新 React 状态
      setState(currentState);
      stateRef.current = currentState;

      // 继续循环
      if (currentState.isRunning && !currentState.isPaused) {
        animationFrameRef.current = requestAnimationFrame(simulationLoop);
      }
    },
    [onStep, onComplete, onViolation]
  );

  // ===== 控制方法 =====

  const start = useCallback(() => {
    if (stateRef.current.isRunning) return;

    setState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    }));

    lastTimeRef.current = performance.now();
    lastRecordTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [simulationLoop]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true }));
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (!stateRef.current.isRunning || !stateRef.current.isPaused) return;

    setState((prev) => ({ ...prev, isPaused: false, safetyViolation: null }));
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [simulationLoop]);

  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const cfg = configRef.current;
    const stateDim = getStateDimension(cfg.model);
    const inputDim = getInputDimension(cfg.model);
    const outputDim = getOutputDimension(cfg.model);

    const initialState: ControlSystemState = {
      ...DEFAULT_STATE,
      states: cfg.initialState ?? Array(stateDim).fill(0),
      inputs: cfg.initialInputs ?? Array(inputDim).fill(0),
      outputs: Array(outputDim).fill(0),
    };

    setState(initialState);
    stateRef.current = initialState;
    historyRef.current = [];
    setHistory([]);
    setMetrics(DEFAULT_METRICS);

    metricsRef.current = {
      controlEnergy: 0,
      errorEnergy: 0,
      peakValue: 0,
      peakTime: 0,
      settlingTime: null,
      overshoot: 0,
      violationCount: 0,
    };

    lastRecordTimeRef.current = 0;
  }, []);

  const step = useCallback(() => {
    const cfg = configRef.current;
    const dt = cfg.solver.stepSize;
    const { t, states, inputs } = stateRef.current;

    const newStates = solverStep(
      cfg.solver.type,
      cfg.model,
      states,
      inputs,
      t,
      dt,
      ssCache.current
    );

    const newOutputs = getOutput(cfg.model, newStates, inputs, t + dt, ssCache.current);
    const violation = checkSafety(cfg, newStates, newOutputs, t + dt);

    const newState: ControlSystemState = {
      ...stateRef.current,
      t: t + dt,
      states: newStates,
      outputs: newOutputs,
      stepCount: stateRef.current.stepCount + 1,
      safetyViolation: violation,
    };

    setState(newState);
    stateRef.current = newState;

    const record: SimulationRecord = {
      t: t + dt,
      inputs: [...inputs],
      outputs: [...newOutputs],
      states: [...newStates],
    };

    historyRef.current.push(record);
    setHistory([...historyRef.current]);
  }, []);

  // ===== 输入/参数控制 =====

  const setInput = useCallback((index: number, value: number) => {
    setState((prev) => {
      const newInputs = [...prev.inputs];
      newInputs[index] = value;
      return { ...prev, inputs: newInputs };
    });
  }, []);

  const setInputs = useCallback((inputs: number[]) => {
    setState((prev) => ({ ...prev, inputs }));
  }, []);

  const setParam = useCallback((key: string, value: number) => {
    configRef.current = {
      ...configRef.current,
      model: {
        ...configRef.current.model,
        params: {
          ...configRef.current.model.params,
          [key]: value,
        },
      },
    };
  }, []);

  const setParams = useCallback((params: Record<string, number>) => {
    configRef.current = {
      ...configRef.current,
      model: {
        ...configRef.current.model,
        params: {
          ...configRef.current.model.params,
          ...params,
        },
      },
    };
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ControlSystemConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    if (newConfig.model?.type === 'transfer_function') {
      ssCache.current = transferFunctionToStateSpace(
        newConfig.model as TransferFunctionModel
      );
    }
  }, []);

  // ===== 状态查询 =====

  const getState = useCallback(() => stateRef.current, []);

  const clearViolation = useCallback(() => {
    setState((prev) => ({ ...prev, safetyViolation: null }));
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  // ===== 自动启动 =====
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [autoStart, start]);

  // ===== 同步历史到外部 =====
  useEffect(() => {
    const interval = setInterval(() => {
      if (historyRef.current.length !== history.length) {
        setHistory([...historyRef.current]);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [history.length]);

  // ===== 返回接口 =====
  return {
    state,
    history,
    metrics,

    start,
    pause,
    resume,
    reset,
    step,

    setInput,
    setInputs,
    setParam,
    setParams,
    updateConfig,

    getState,
    clearViolation,
    clearHistory,
  };
}

// ===== 工具函数导出 =====

/**
 * 创建一阶系统传递函数
 * G(s) = K / (T*s + 1)
 */
export function createFirstOrderTF(K: number, T: number): TransferFunctionModel {
  return {
    type: 'transfer_function',
    numerator: [K],
    denominator: [1, T],
    params: { K, T },
    name: `First Order (K=${K}, T=${T})`,
  };
}

/**
 * 创建二阶系统传递函数
 * G(s) = K * ωn² / (s² + 2ζωn*s + ωn²)
 */
export function createSecondOrderTF(
  K: number,
  zeta: number,
  omega_n: number
): TransferFunctionModel {
  const wn2 = omega_n * omega_n;
  return {
    type: 'transfer_function',
    numerator: [K * wn2],
    denominator: [wn2, 2 * zeta * omega_n, 1],
    params: { K, zeta, omega_n },
    name: `Second Order (K=${K}, ζ=${zeta}, ωn=${omega_n})`,
  };
}

/**
 * 创建 PID 控制器传递函数
 * G(s) = Kp + Ki/s + Kd*s = (Kd*s² + Kp*s + Ki) / s
 */
export function createPIDController(
  Kp: number,
  Ki: number,
  Kd: number
): TransferFunctionModel {
  return {
    type: 'transfer_function',
    numerator: [Ki, Kp, Kd],
    denominator: [0, 1],
    params: { Kp, Ki, Kd },
    name: `PID (Kp=${Kp}, Ki=${Ki}, Kd=${Kd})`,
  };
}

/**
 * 创建非线性 Van der Pol 振荡器模型
 */
export function createVanDerPolOscillator(mu: number = 1.0): NonlinearModel {
  return {
    type: 'nonlinear',
    params: { mu },
    stateSize: 2,
    inputSize: 1,
    outputSize: 2,
    derivatives: (x, u, t, params) => {
      const muVal = params.mu ?? 1.0;
      return [x[1], muVal * (1 - x[0] * x[0]) * x[1] - x[0] + (u[0] ?? 0)];
    },
    name: `Van der Pol (μ=${mu})`,
  };
}

/**
 * 创建带饱和的非线性模型
 */
export function createSaturatedModel(
  baseModel: SystemModel,
  saturationLimits: { min: number; max: number }
): NonlinearModel {
  const stateDim = getStateDimension(baseModel);
  const inputDim = getInputDimension(baseModel);

  // 如果基础模型是传递函数，先转换
  let ssModel: StateSpaceModel | null = null;
  if (baseModel.type === 'transfer_function') {
    ssModel = transferFunctionToStateSpace(baseModel);
  } else if (baseModel.type === 'state_space') {
    ssModel = baseModel;
  }

  return {
    type: 'nonlinear',
    params: { ...baseModel.params, ...saturationLimits },
    stateSize: stateDim,
    inputSize: inputDim,
    derivatives: (x, u, t, params) => {
      // 应用输入饱和
      const saturatedU = u.map((ui) =>
        clamp(ui, params.min ?? -Infinity, params.max ?? Infinity)
      );

      if (ssModel) {
        return getStateSpaceDerivatives(ssModel, x, saturatedU);
      }

      if (baseModel.type === 'nonlinear') {
        return baseModel.derivatives(x, saturatedU, t, params);
      }

      return x.map(() => 0);
    },
    output: (x, u, t, params) => {
      if (ssModel) {
        return getStateSpaceOutput(ssModel, x, u);
      }
      return x;
    },
    name: `Saturated Model (${saturationLimits.min}, ${saturationLimits.max})`,
  };
}

export default useControlSystem;

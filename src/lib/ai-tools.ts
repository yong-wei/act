/**
 * AI Copilot 工具定义
 *
 * 定义 AI 助手可以调用的 Function Calling 工具
 */

import { z } from 'zod';
import { tool } from 'ai';

// 仿真状态存储（在实际应用中可能需要使用 Redis 或其他状态存储）
let simulationState: SimulationStateStore = {
  isRunning: false,
  isPaused: false,
  time: 0,
  position: { x: 0, z: 0 },
  heading: 0,
  rudder: 0,
  speed: 15,
  targetHeading: 0,
  pidGains: { kp: 1.4, ki: 0.02, kd: 0.7 },
  nomotoParams: { K: 0.08, T: 55 },
  seaState: { level: 3, waveHeight: 1.0, windSpeed: 10 },
  metrics: {
    avgError: 0,
    maxRudderRate: 0,
    currentError: 0,
  },
};

export interface SimulationStateStore {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: { x: number; z: number };
  heading: number;
  rudder: number;
  speed: number;
  targetHeading: number;
  pidGains: { kp: number; ki: number; kd: number };
  nomotoParams: { K: number; T: number };
  seaState: { level: number; waveHeight: number; windSpeed: number };
  metrics: {
    avgError: number;
    maxRudderRate: number;
    currentError: number;
  };
}

// 更新仿真状态（供外部调用）
export function updateSimulationState(newState: Partial<SimulationStateStore>) {
  simulationState = { ...simulationState, ...newState };
}

// 获取当前仿真状态（供外部读取）
export function getSimulationState(): SimulationStateStore {
  return { ...simulationState };
}

// 待执行的参数修改（需要前端确认）
let pendingParamChanges: {
  type: 'pid' | 'seaState' | 'speed';
  params: Record<string, number>;
  confirmed: boolean;
} | null = null;

export interface SimulationParamChangeInput {
  kp?: number;
  ki?: number;
  kd?: number;
  seaStateLevel?: number;
  speed?: number;
}

export interface SimulationParamChangeRequest {
  type: 'pid' | 'seaState' | 'speed';
  params: Record<string, number>;
  descriptions: string[];
}

export interface SimulationAnalysisInput {
  avgError: number;
  maxRudderRate: number;
  overshoot?: number;
  settlingTime?: number;
  duration: number;
  controlMode: string;
  kp: number;
  ki: number;
  kd: number;
}

export function getPendingChanges() {
  return pendingParamChanges;
}

export function clearPendingChanges() {
  pendingParamChanges = null;
}

export function confirmPendingChanges() {
  if (pendingParamChanges) {
    pendingParamChanges.confirmed = true;
  }
}

export function buildSimulationParamChangeRequest({
  kp,
  ki,
  kd,
  seaStateLevel,
  speed,
}: SimulationParamChangeInput): SimulationParamChangeRequest {
  const changes: Record<string, number> = {};
  let changeType: 'pid' | 'seaState' | 'speed' = 'pid';

  if (kp !== undefined) changes.kp = kp;
  if (ki !== undefined) changes.ki = ki;
  if (kd !== undefined) changes.kd = kd;

  if (seaStateLevel !== undefined) {
    changeType = 'seaState';
    changes.level = seaStateLevel;
    const seaStateMap: Record<number, { waveHeight: number; windSpeed: number }> = {
      1: { waveHeight: 0.3, windSpeed: 3 },
      2: { waveHeight: 0.5, windSpeed: 7 },
      3: { waveHeight: 1.0, windSpeed: 12 },
      4: { waveHeight: 2.0, windSpeed: 20 },
      5: { waveHeight: 3.5, windSpeed: 30 },
    };
    const config = seaStateMap[seaStateLevel] || seaStateMap[3];
    changes.waveHeight = config.waveHeight;
    changes.windSpeed = config.windSpeed;
  }

  if (speed !== undefined) {
    changeType = 'speed';
    changes.speed = speed;
  }

  const descriptions: string[] = [];
  if (kp !== undefined) descriptions.push(`Kp: ${kp}`);
  if (ki !== undefined) descriptions.push(`Ki: ${ki}`);
  if (kd !== undefined) descriptions.push(`Kd: ${kd}`);
  if (seaStateLevel !== undefined) descriptions.push(`海况: ${seaStateLevel}级`);
  if (speed !== undefined) descriptions.push(`航速: ${speed} m/s`);

  return {
    type: changeType,
    params: changes,
    descriptions,
  };
}

export function formatSimulationParamChangeResponse(request: SimulationParamChangeRequest) {
  return {
    success: true,
    message: '参数修改请求已创建',
    pendingChanges: request.descriptions.join(', '),
    note: '请在仿真界面确认参数修改',
  };
}

export function analyzeSimulationResult({
  avgError,
  maxRudderRate,
  overshoot,
  duration,
  controlMode,
  kp,
  ki,
  kd,
}: SimulationAnalysisInput) {
  const performanceGrade =
    avgError < 50
      ? 'A (优秀)'
      : avgError < 100
        ? 'B (良好)'
        : avgError < 200
          ? 'C (合格)'
          : 'D (不合格)';

  const safetyIssues: string[] = [];
  if (maxRudderRate > 5.0) {
    safetyIssues.push(`舵角速度过快 (${maxRudderRate.toFixed(2)}°/s > 5°/s)，可能导致舵机过载`);
  }
  if (overshoot && overshoot > 20) {
    safetyIssues.push(`超调量过大 (${overshoot.toFixed(1)}% > 20%)，存在过度修正风险`);
  }

  const paramAnalysis: string[] = [];
  if (avgError > 100 && kp < 1.0) {
    paramAnalysis.push('Kp偏小，响应速度不足，建议增加至1.0-2.0');
  }
  if (maxRudderRate > 5.0 && kp > 2.0) {
    paramAnalysis.push('Kp偏大，响应过于激进，建议降至1.0-1.5');
  }
  if (overshoot && overshoot > 20 && kd < 0.5) {
    paramAnalysis.push('Kd偏小，阻尼不足导致超调，建议增加至0.5-1.0');
  }
  if (controlMode === 'p' || controlMode === 'pd') {
    paramAnalysis.push('当前未使用完整PID控制，建议启用积分项消除稳态误差');
  }

  return {
    performance: {
      grade: performanceGrade,
      avgError: `${avgError.toFixed(1)} 米`,
      duration: `${duration} 秒`,
      controlMode: controlMode.toUpperCase(),
    },
    safety: {
      status: safetyIssues.length === 0 ? '安全' : '存在风险',
      issues: safetyIssues.length > 0 ? safetyIssues : ['无明显安全问题'],
    },
    analysis: {
      currentParams: `Kp=${kp}, Ki=${ki}, Kd=${kd}`,
      suggestions: paramAnalysis.length > 0 ? paramAnalysis : ['当前参数配置合理'],
    },
    ccsCompliance: {
      status: avgError < 200 && maxRudderRate < 5.0 ? '符合' : '不符合',
      reference: 'CCS《船舶操纵性规范》第4.2.3条',
    },
  };
}

/**
 * 工具1: 获取仿真状态
 */
export const getSimulationStatusInputSchema = z.object({});

export const getSimulationStatusTool = tool({
  description: '获取当前仿真器的状态信息，包括船舶位置、航向、舵角、PID参数、海况等',
  inputSchema: getSimulationStatusInputSchema,
  execute: async () => {
    const state = getSimulationState();
    return {
      status: state.isRunning ? (state.isPaused ? '已暂停' : '运行中') : '已停止',
      time: `${state.time.toFixed(1)} 秒`,
      position: {
        x: `${state.position.x.toFixed(1)} 米`,
        z: `${state.position.z.toFixed(1)} 米`,
      },
      heading: `${state.heading.toFixed(1)}°`,
      targetHeading: `${state.targetHeading.toFixed(1)}°`,
      rudder: `${state.rudder.toFixed(1)}°`,
      speed: `${state.speed.toFixed(1)} m/s`,
      pidGains: {
        Kp: state.pidGains.kp,
        Ki: state.pidGains.ki,
        Kd: state.pidGains.kd,
      },
      nomotoModel: {
        K: state.nomotoParams.K,
        T: `${state.nomotoParams.T} 秒`,
      },
      seaState: {
        level: `${state.seaState.level} 级`,
        waveHeight: `${state.seaState.waveHeight} 米`,
        windSpeed: `${state.seaState.windSpeed} m/s`,
      },
      metrics: {
        avgError: `${state.metrics.avgError.toFixed(1)} 米`,
        maxRudderRate: `${state.metrics.maxRudderRate.toFixed(2)} °/s`,
        currentError: `${state.metrics.currentError.toFixed(1)} 米`,
      },
    };
  },
});

/**
 * 工具2: 修改仿真参数
 */
export const setSimulationParamsInputSchema = z.object({
  kp: z.number().min(0).max(5).optional().describe('比例增益 Kp (0-5)'),
  ki: z.number().min(0).max(1).optional().describe('积分增益 Ki (0-1)'),
  kd: z.number().min(0).max(3).optional().describe('微分增益 Kd (0-3)'),
  seaStateLevel: z.number().min(1).max(5).optional().describe('海况等级 (1-5)'),
  speed: z.number().min(4).max(22).optional().describe('目标航速 m/s (4-22)'),
});

export const setSimulationParamsTool = tool({
  description: '修改仿真器的PID参数或环境配置。修改会生成一个待确认的变更请求，需要学生在前端确认后才会生效。',
  inputSchema: setSimulationParamsInputSchema,
  execute: async ({ kp, ki, kd, seaStateLevel, speed }) => {
    const request = buildSimulationParamChangeRequest({ kp, ki, kd, seaStateLevel, speed });

    // 存储待确认的变更
    pendingParamChanges = {
      type: request.type,
      params: request.params,
      confirmed: false,
    };

    return formatSimulationParamChangeResponse(request);
  },
});

/**
 * 工具3: 分析仿真结果
 */
export const analyzeResultInputSchema = z.object({
  avgError: z.number().describe('平均航迹误差(米)'),
  maxRudderRate: z.number().describe('最大舵角速度(度/秒)'),
  overshoot: z.number().optional().describe('超调量(%)'),
  settlingTime: z.number().optional().describe('调节时间(秒)'),
  duration: z.number().describe('仿真时长(秒)'),
  controlMode: z.string().describe('控制模式: manual/p/pd/pid'),
  kp: z.number().describe('当前Kp值'),
  ki: z.number().describe('当前Ki值'),
  kd: z.number().describe('当前Kd值'),
});

export const analyzeResultTool = tool({
  description: '分析仿真结果，结合船舶控制知识库给出专业点评，包括性能评估、安全分析和改进建议',
  inputSchema: analyzeResultInputSchema,
  execute: async (args) => analyzeSimulationResult(args),
});

// 导出所有工具
export const aiTools = {
  get_simulation_status: getSimulationStatusTool,
  set_simulation_params: setSimulationParamsTool,
  analyze_result: analyzeResultTool,
};

/**
 * 仿真引擎 - 纯函数计算模块
 * 包含诺莫托船舶模型、PID控制器、波浪计算等
 */

import {
  type NomotoParams,
  type PIDGains,
  type Position,
  type SeaStateConfig,
  type ControlMode,
  DEFAULT_NOMOTO_PARAMS,
  ETHICAL_THRESHOLDS,
} from '@/types/simulation';

// ============ 数学工具函数 ============

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const normalizeHeading = (heading: number) =>
  ((heading % 360) + 360) % 360;

export const normalizeSignedHeading = (heading: number) => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

/**
 * 计算两个航向角之间的差值（考虑角度环绕）
 */
export const angleDelta = (target: number, current: number) => {
  const normalizedTarget = normalizeHeading(target);
  const normalizedCurrent = normalizeHeading(current);
  let diff = normalizedTarget - normalizedCurrent;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

// ============ 波浪模型 ============

// 波浪参数：复合波浪模型
const WAVE_PARAMS = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } }, // 主涌浪
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } }, // 交叉浪
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } }, // 干扰浪
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } }, // 细节浪
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } }, // 微波
];

/**
 * 计算指定位置和时间的波浪高度
 */
export function getWaveHeight(x: number, z: number, time: number, seaState?: SeaStateConfig): number {
  const amplitudeScale = seaState?.waveHeight ? seaState.waveHeight / 1.2 : 1.0;
  let y = 0;
  WAVE_PARAMS.forEach((wave) => {
    const phase = (x * wave.direction.x + z * wave.direction.z) * wave.frequency + time * wave.speed;
    y += wave.amplitude * amplitudeScale * Math.sin(phase);
  });
  return y;
}

/**
 * 计算船舶在波浪中的姿态（纵摇、横摇）
 */
export function calculateWaveAttitude(
  x: number,
  z: number,
  heading: number,
  time: number,
  shipLength: number = 180,
  shipWidth: number = 20,
  seaState?: SeaStateConfig
): { pitch: number; roll: number; heave: number } {
  const halfLength = shipLength / 2;
  const halfWidth = shipWidth / 2;
  const cosH = Math.cos(heading);
  const sinH = Math.sin(heading);

  const centerY = getWaveHeight(x, z, time, seaState);
  const bowY = getWaveHeight(x + cosH * halfLength, z + sinH * halfLength, time, seaState);
  const sternY = getWaveHeight(x - cosH * halfLength, z - sinH * halfLength, time, seaState);
  const portY = getWaveHeight(x - sinH * halfWidth, z + cosH * halfWidth, time, seaState);
  const starboardY = getWaveHeight(x + sinH * halfWidth, z - cosH * halfWidth, time, seaState);

  const pitch = Math.atan2(bowY - sternY, shipLength);
  const roll = Math.atan2(portY - starboardY, shipWidth);

  return { pitch, roll, heave: centerY };
}

// ============ 诺莫托船舶模型 ============

export interface NomotoState {
  headingRad: number;
  yawRateRad: number;
  rudderDeg: number;
  positionX: number;
  positionZ: number;
  speedMps: number;
}

/**
 * 诺莫托一阶船舶模型步进
 * dr/dt = (K * δ - r) / T
 * dψ/dt = r
 */
export function nomotoStep(
  state: NomotoState,
  rudderDeg: number,
  dt: number,
  params: NomotoParams = DEFAULT_NOMOTO_PARAMS
): NomotoState {
  const rudderRad = toRadians(clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg));

  // 更新转向角速度
  const newYawRateRad = state.yawRateRad +
    ((params.K * rudderRad - state.yawRateRad) / params.T) * dt;

  // 更新航向
  const newHeadingRad = state.headingRad + newYawRateRad * dt;

  // 更新位置
  const newPositionX = state.positionX + state.speedMps * Math.cos(newHeadingRad) * dt;
  const newPositionZ = state.positionZ + state.speedMps * Math.sin(newHeadingRad) * dt;

  return {
    headingRad: newHeadingRad,
    yawRateRad: newYawRateRad,
    rudderDeg: clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg),
    positionX: newPositionX,
    positionZ: newPositionZ,
    speedMps: state.speedMps,
  };
}

// ============ PID 控制器 ============

export interface PIDState {
  integral: number;
  prevError: number;
}

/**
 * PID 控制器计算
 */
export function pidControl(
  targetHeading: number,
  currentHeading: number,
  pidState: PIDState,
  gains: PIDGains,
  controlMode: ControlMode,
  dt: number,
  maxRudderDeg: number = DEFAULT_NOMOTO_PARAMS.maxRudderDeg
): { rudderDeg: number; newPidState: PIDState } {
  if (controlMode === 'manual') {
    return { rudderDeg: 0, newPidState: pidState };
  }

  // 计算误差（考虑角度环绕）
  const errorDeg = angleDelta(targetHeading, currentHeading);
  const errorRad = toRadians(errorDeg);

  // 微分项
  const derivative = (errorRad - pidState.prevError) / dt;

  // 积分项
  const newIntegral = pidState.integral + errorRad * dt;

  // 根据控制模式选择增益
  let kp = gains.kp;
  let ki = gains.ki;
  let kd = gains.kd;

  if (controlMode === 'p') {
    ki = 0;
    kd = 0;
  } else if (controlMode === 'pd') {
    ki = 0;
  }

  // 计算控制输出
  const deltaRad = kp * errorRad + ki * newIntegral + kd * derivative;
  const rudderDeg = clamp(toDegrees(deltaRad), -maxRudderDeg, maxRudderDeg);

  return {
    rudderDeg,
    newPidState: {
      integral: newIntegral,
      prevError: errorRad,
    },
  };
}

// ============ 航迹误差计算 ============

/**
 * 计算点到航线的最小距离（航迹误差）
 */
export function getCrossTrackError(position: Position, path: Position[]): number {
  if (path.length < 2) return 0;

  let minDistSq = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    // 线段 p1-p2
    const vx = p2.x - p1.x;
    const vz = p2.z - p1.z;
    const wx = position.x - p1.x;
    const wz = position.z - p1.z;

    const c1 = wx * vx + wz * vz;
    const c2 = vx * vx + vz * vz;

    let distSq = 0;

    if (c1 <= 0) {
      // 最近点是 p1
      distSq = (position.x - p1.x) ** 2 + (position.z - p1.z) ** 2;
    } else if (c2 <= c1) {
      // 最近点是 p2
      distSq = (position.x - p2.x) ** 2 + (position.z - p2.z) ** 2;
    } else {
      // 最近点在线段上
      const b = c1 / c2;
      const pbx = p1.x + vx * b;
      const pbz = p1.z + vz * b;
      distSq = (position.x - pbx) ** 2 + (position.z - pbz) ** 2;
    }

    if (distSq < minDistSq) minDistSq = distSq;
  }

  return Math.sqrt(minDistSq);
}

// ============ 伦理检测 ============

export interface EthicalCheckResult {
  isViolation: boolean;
  violationType?: 'EXCESSIVE_RUDDER_RATE' | 'EXCESSIVE_ROLL_ANGLE' | 'SAFETY_VIOLATION';
  thresholdValue?: number;
  actualValue?: number;
  description?: string;
}

/**
 * 检测伦理违规
 */
export function checkEthicalViolation(
  rudderRate: number,     // 舵角变化速度 (度/秒)
  rollAngle: number,      // 横摇角 (度)
  yawRate: number,        // 转向角速度 (度/秒)
  thresholds = ETHICAL_THRESHOLDS
): EthicalCheckResult {
  // 检查舵角速度
  if (Math.abs(rudderRate) > thresholds.MAX_RUDDER_RATE) {
    return {
      isViolation: true,
      violationType: 'EXCESSIVE_RUDDER_RATE',
      thresholdValue: thresholds.MAX_RUDDER_RATE,
      actualValue: Math.abs(rudderRate),
      description: `舵角变化速度过快：${Math.abs(rudderRate).toFixed(2)}°/s > ${thresholds.MAX_RUDDER_RATE}°/s，可能导致舵机液压系统过载`,
    };
  }

  // 检查横摇角
  if (Math.abs(rollAngle) > thresholds.MAX_ROLL_ANGLE) {
    return {
      isViolation: true,
      violationType: 'EXCESSIVE_ROLL_ANGLE',
      thresholdValue: thresholds.MAX_ROLL_ANGLE,
      actualValue: Math.abs(rollAngle),
      description: `横摇角过大：${Math.abs(rollAngle).toFixed(2)}° > ${thresholds.MAX_ROLL_ANGLE}°，存在船体倾覆风险`,
    };
  }

  return { isViolation: false };
}

// ============ 场景生成 ============

export interface ScenarioLogic {
  getDesiredHeading: (t: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
}

/**
 * 获取预设场景逻辑
 */
export function getScenarioLogic(scenario: 'turn90' | 'obstacle' | 'circle' | 'straight'): ScenarioLogic {
  const REF_SPEED = 15.0;

  switch (scenario) {
    case 'straight':
      return {
        startPos: { x: -3000, z: 0, headingDeg: 0 },
        getDesiredHeading: () => 0,
      };
    case 'turn90':
      return {
        startPos: { x: -6000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => (t < 60 ? 0 : 90),
      };
    case 'obstacle':
      return {
        startPos: { x: -2000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          if (t < 90) return 45;
          if (t < 120) return 0;
          if (t < 150) return -45;
          return 0;
        },
      };
    case 'circle': {
      const radius = 1350;
      const circumference = 2 * Math.PI * radius;
      const turnTime = circumference / REF_SPEED;
      const degPerSec = 360 / turnTime;
      return {
        startPos: { x: 0, z: -(radius + 900), headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          return -90 + degPerSec * (t - 60);
        },
      };
    }
  }
}

/**
 * 生成参考航迹
 */
export function generateGuidePath(logic: ScenarioLogic, duration: number, speed: number = 15.0): Position[] {
  const points: Position[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  const dt = 0.5;

  points.push({ x, z });

  for (let t = 0; t <= duration; t += dt) {
    const headingDeg = logic.getDesiredHeading(t);
    const headingRad = toRadians(headingDeg);
    x += speed * Math.cos(headingRad) * dt;
    z += speed * Math.sin(headingRad) * dt;
    points.push({ x, z });
  }

  return points;
}

// ============ 快速仿真 ============

export interface QuickSimConfig {
  pid: PIDGains;
  controlMode: ControlMode;
  start: { x: number; z: number; headingDeg: number };
  duration: number;
  getDesiredHeading: (t: number) => number;
  nomoto?: NomotoParams;
}

export interface QuickSimResult {
  trajectory: Array<{ time: number; x: number; z: number; heading: number; rudder: number }>;
  chartData: {
    time: number[];
    desiredHeading: number[];
    actualHeading: number[];
    speed: number[];
    rudder: number[];
  };
  metrics: {
    avgError: number;
    maxRudderRate: number;
  };
}

/**
 * 运行快速仿真（无渲染）
 */
export function runQuickSimulation(config: QuickSimConfig, guidePath: Position[]): QuickSimResult {
  const nomoto = config.nomoto || DEFAULT_NOMOTO_PARAMS;
  const dt = 0.5;

  const chartData = {
    time: [] as number[],
    desiredHeading: [] as number[],
    actualHeading: [] as number[],
    speed: [] as number[],
    rudder: [] as number[],
  };

  const trajectory: QuickSimResult['trajectory'] = [];

  let state: NomotoState = {
    headingRad: toRadians(config.start.headingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX: config.start.x,
    positionZ: config.start.z,
    speedMps: nomoto.speedMps,
  };

  let pidState: PIDState = { integral: 0, prevError: 0 };
  let totalError = 0;
  let errorCount = 0;
  let maxRudderRate = 0;
  let prevRudder = 0;

  const mode = config.controlMode === 'manual' ? 'pid' : config.controlMode;

  for (let t = 0; t <= config.duration; t += dt) {
    const targetHeading = config.getDesiredHeading(t);
    const currentHeading = normalizeHeading(toDegrees(state.headingRad));

    // PID 控制
    const { rudderDeg, newPidState } = pidControl(
      targetHeading,
      currentHeading,
      pidState,
      config.pid,
      mode,
      dt,
      nomoto.maxRudderDeg
    );
    pidState = newPidState;

    // 更新船舶状态
    state = nomotoStep(state, rudderDeg, dt, nomoto);

    // 计算航迹误差
    const error = getCrossTrackError({ x: state.positionX, z: state.positionZ }, guidePath);
    totalError += error;
    errorCount++;

    // 计算舵角速度
    const rudderRate = Math.abs(rudderDeg - prevRudder) / dt;
    if (rudderRate > maxRudderRate) maxRudderRate = rudderRate;
    prevRudder = rudderDeg;

    // 记录数据
    chartData.time.push(t);
    chartData.desiredHeading.push(normalizeSignedHeading(targetHeading));
    chartData.actualHeading.push(normalizeSignedHeading(currentHeading));
    chartData.speed.push(state.speedMps);
    chartData.rudder.push(rudderDeg);

    trajectory.push({
      time: t,
      x: state.positionX,
      z: state.positionZ,
      heading: currentHeading,
      rudder: rudderDeg,
    });
  }

  return {
    trajectory,
    chartData,
    metrics: {
      avgError: errorCount > 0 ? totalError / errorCount : 0,
      maxRudderRate,
    },
  };
}

/**
 * 仿真引擎类型定义
 */

// 控制模式
export type ControlMode = 'manual' | 'p' | 'pd' | 'pid';

// 任务场景类型
export type TaskScenario = 'turn90' | 'obstacle' | 'circle' | 'straight';

// 海况配置
export interface SeaStateConfig {
  waveHeight: number;   // 波高(米)
  windSpeed: number;    // 风速(m/s)
  current: number;      // 流速(m/s)
  level?: number;       // 海况等级 1-5
}

// 诺莫托模型参数
export interface NomotoParams {
  K: number;            // 转向增益
  T: number;            // 时间常数(秒)
  maxRudderDeg: number; // 最大舵角(度)
  speedMps: number;     // 参考航速(m/s)
}

// PID 增益参数
export interface PIDGains {
  kp: number;
  ki: number;
  kd: number;
}

// 仿真配置
export interface SimulationConfig {
  pid: PIDGains;
  controlMode: ControlMode;
  seaState?: SeaStateConfig;
  nomoto?: Partial<NomotoParams>;
  duration?: number;          // 仿真时长(秒)
  timeScale?: number;         // 时间缩放
}

// 船舶位置
export interface Position {
  x: number;
  z: number;
}

// 仿真状态
export interface SimulationState {
  // 位置和运动
  position: Position;
  heading: number;        // 航向角(度)
  headingRad: number;     // 航向角(弧度)
  yawRate: number;        // 转向角速度(度/秒)
  yawRateRad: number;     // 转向角速度(弧度/秒)
  rudder: number;         // 舵角(度)
  speed: number;          // 航速(m/s)

  // 控制器状态
  integral: number;       // 积分项
  prevError: number;      // 上一时刻误差(弧度)

  // 波浪影响
  waveY: number;
  wavePitch: number;
  waveRoll: number;

  // 时间
  time: number;           // 仿真时间(秒)
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
}

// 仿真指标
export interface SimulationMetrics {
  avgError: number;           // 平均航迹误差(米)
  maxRudderRate: number;      // 最大舵角速度(度/秒)
  currentError: number;       // 当前航迹误差(米)
  energyConsumption: number;  // 能耗积分
  settlingTime: number | null; // 调节时间(秒)
  overshoot: number;          // 超调量(%)
  crossTrackError: number;    // 航迹误差(米)
}

// 轨迹点
export interface TrajectoryPoint {
  time: number;
  x: number;
  z: number;
  heading: number;
  rudder: number;
  speed: number;
  targetHeading: number;
}

// 图表数据
export interface ChartData {
  time: number[];
  desiredHeading: number[];
  actualHeading: number[];
  speed: number[];
  rudder: number[];
  error: number[];
}

// 伦理违规类型
export type ViolationType =
  | 'EXCESSIVE_RUDDER_RATE'
  | 'EXCESSIVE_ROLL_ANGLE'
  | 'COLLISION_RISK'
  | 'ENVIRONMENTAL_HAZARD'
  | 'SAFETY_VIOLATION';

// 伦理违规信息
export interface EthicalViolation {
  type: ViolationType;
  thresholdValue: number;
  actualValue: number;
  timestamp: number;
  description: string;
}

// 仿真回调
export interface SimulationCallbacks {
  onStep?: (state: SimulationState, metrics: SimulationMetrics) => void;
  onComplete?: (finalMetrics: SimulationMetrics, trajectory: TrajectoryPoint[]) => void;
  onViolation?: (violation: EthicalViolation) => void;
  onTargetHeadingChange?: (targetHeading: number) => void;
}

// 场景逻辑定义
export interface ScenarioLogic {
  getDesiredHeading: (t: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
}

// 仿真结果
export interface SimulationResult {
  metrics: SimulationMetrics;
  trajectory: TrajectoryPoint[];
  chartData: ChartData;
  duration: number;
  success: boolean;
}

// Hook 返回类型
export interface UseShipSimulationReturn {
  // 状态
  state: SimulationState;
  metrics: SimulationMetrics;
  trajectory: TrajectoryPoint[];
  chartData: ChartData;
  targetHeading: number;

  // 控制
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setManualRudder: (rudder: number) => void;
  setManualSpeed: (speed: number) => void;

  // 配置
  updateConfig: (config: Partial<SimulationConfig>) => void;
  setScenario: (scenario: ScenarioLogic, duration: number, guidePath?: Position[]) => void;
}

// 快速仿真结果
export interface QuickSimulationResult {
  data: ChartData;
  desiredPath: Position[];
  actualPath: Position[];
  metrics: SimulationMetrics;
  duration: number;
}

// 默认参数
export const DEFAULT_NOMOTO_PARAMS: NomotoParams = {
  K: 0.08,
  T: 55,
  maxRudderDeg: 35,
  speedMps: 15.0,
};

export const DEFAULT_PID_GAINS: PIDGains = {
  kp: 1.4,
  ki: 0.02,
  kd: 0.7,
};

export const DEFAULT_SEA_STATE: SeaStateConfig = {
  waveHeight: 1.0,
  windSpeed: 10,
  current: 0.2,
  level: 3,
};

// 伦理阈值常量
export const ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 5.0,     // 度/秒
  MAX_ROLL_ANGLE: 15.0,     // 度
  MAX_YAW_RATE: 3.0,        // 度/秒
  MIN_COLLISION_DISTANCE: 100, // 米
};

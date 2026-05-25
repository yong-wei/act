/**
 * 仿真框架共享常量
 */

import type {
  NomotoParams,
  PIDGains,
  SeaStateConfig,
  WaveComponent,
} from './types';
import type { RandomNumberGenerator } from './seeded-rng';

// ============ 数学常量 ============

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const TWO_PI = 2 * Math.PI;

// ============ 物理常量 ============

export const GRAVITY = 9.81;           // 重力加速度 (m/s²)
export const SEA_WATER_DENSITY = 1025; // 海水密度 (kg/m³)
export const AIR_DENSITY = 1.225;      // 空气密度 (kg/m³)

// ============ 默认 Nomoto 参数 ============

/** 055 驱逐舰基准参数 */
export const DEFAULT_NOMOTO_PARAMS: NomotoParams = {
  K: 0.08,          // 转向增益
  T: 55,            // 时间常数 (s)
  maxRudderDeg: 35, // 最大舵角 (°)
  speedMps: 15.0,   // 参考航速 (m/s)
};

/** 挖泥船 Nomoto 参数 (高惯性) */
export const DREDGER_NOMOTO_PARAMS: NomotoParams = {
  K: 0.04,          // 较低增益 (大质量)
  T: 120,           // 较大时间常数
  maxRudderDeg: 35,
  speedMps: 6.0,    // 较低航速
};

// ============ 默认 PID 增益 ============

export const DEFAULT_PID_GAINS: PIDGains = {
  kp: 1.4,
  ki: 0.02,
  kd: 0.7,
};

/** 高增益 PID (用于稳态误差消除) */
export const HIGH_GAIN_PID: PIDGains = {
  kp: 2.5,
  ki: 0.08,
  kd: 1.2,
};

/** 低增益 PID (用于大惯性系统) */
export const LOW_GAIN_PID: PIDGains = {
  kp: 0.8,
  ki: 0.01,
  kd: 0.4,
};

// ============ 默认海况配置 ============

export const DEFAULT_SEA_STATE: SeaStateConfig = {
  level: 3,
  waveHeight: 1.0,
  wavePeriod: 8.0,
  waveDirection: 0,
  windSpeed: 10,
  windDirection: 0,
  currentSpeed: 0.2,
  currentDirection: 0,
};

/** 平静海况 (等级1) */
export const CALM_SEA_STATE: SeaStateConfig = {
  level: 1,
  waveHeight: 0.1,
  wavePeriod: 4.0,
  waveDirection: 0,
  windSpeed: 2,
  windDirection: 0,
  currentSpeed: 0.1,
  currentDirection: 0,
};

/** 恶劣海况 (等级5) */
export const ROUGH_SEA_STATE: SeaStateConfig = {
  level: 5,
  waveHeight: 4.0,
  wavePeriod: 12.0,
  waveDirection: 0,
  windSpeed: 25,
  windDirection: 0,
  currentSpeed: 1.0,
  currentDirection: 0,
};

// ============ 波浪参数 ============

/** 五层复合波浪模型 */
export const WAVE_COMPONENTS: WaveComponent[] = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } },   // 主涌浪
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } },   // 交叉浪
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } },   // 干扰浪
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } },  // 细节浪
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } }, // 微波
];

// ============ 伦理阈值 ============

/** 通用伦理阈值 */
export const ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 5.0,           // 度/秒
  MAX_ROLL_ANGLE: 15.0,           // 度
  MAX_YAW_RATE: 3.0,              // 度/秒
  MIN_COLLISION_DISTANCE: 100,    // 米
};

/** 驱逐舰伦理阈值 */
export const DESTROYER_ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 5.0,
  MAX_ROLL_ANGLE: 15.0,
  MAX_YAW_RATE: 3.0,
  MIN_COLLISION_DISTANCE: 100,
};

/** 挖泥船伦理阈值 (更严格) */
export const DREDGER_ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 2.5,           // 更慢的舵角变化
  MAX_ROLL_ANGLE: 10.0,           // 更低的横摇限制
  MAX_YAW_RATE: 1.5,              // 更低的转向速度
  MIN_COLLISION_DISTANCE: 50,     // 作业区更近距离
  MAX_TURBIDITY: 50,              // 浊度限制 (NTU)
  MAX_POSITION_ERROR: 0.1,        // 定位精度 (m)
};

// ============ 仿真参数 ============

/** 默认仿真时长 (秒) */
export const DEFAULT_SIMULATION_DURATION = 300;

/** 默认积分步长 (秒) */
export const DEFAULT_DT = 0.5;

/** 最大积分步长 (秒) */
export const MAX_DT = 0.1;

/** 默认时间缩放 */
export const DEFAULT_TIME_SCALE = 1.0;

/** 轨迹采样间隔 (秒) */
export const TRAJECTORY_SAMPLE_INTERVAL = 1.0;

// ============ 渲染参数 ============

/** 网格范围 */
export const GRID_SIZE = 10000;

/** 网格密度 */
export const GRID_DIVISIONS = 100;

/** 航迹线最大点数 */
export const MAX_TRAIL_POINTS = 500;

/** 相机跟随距离 */
export const CAMERA_FOLLOW_DISTANCE = 500;

// ============ UI 参数 ============

/** 图表最大数据点数 */
export const CHART_MAX_POINTS = 600;

/** 状态更新节流 (ms) */
export const STATE_UPDATE_THROTTLE = 50;

/** HUD 更新频率 (ms) */
export const HUD_UPDATE_INTERVAL = 100;

// ============ 挖泥船特定参数 ============

/** 挖掘冲击扰动配置 */
export const DREDGING_IMPACT_CONFIG = {
  MAX_FORCE: 500000,          // 峰值力 (N)
  MIN_INTERVAL: 5,            // 最小间隔 (s)
  MAX_INTERVAL: 15,           // 最大间隔 (s)
  DECAY_TIME_CONSTANT: 2.0,   // 衰减时间常数 (s)
  STEP_RATIO: 0.6,            // 阶跃分量比例
  IMPULSE_RATIO: 0.4,         // 脉冲分量比例
};

/** 天鲸号挖泥船物理参数 */
export const TIANJING_DREDGER_PARAMS = {
  // 尺度
  LENGTH: 127.5,              // m
  BEAM: 23.0,                 // m
  DRAFT: 6.2,                 // m
  DISPLACEMENT: 17000,        // t

  // 质量和惯性
  MASS: 17000000,             // kg
  MOMENT_OF_INERTIA: 2.5e9,   // kg·m²
  CENTER_OF_GRAVITY_X: -2.5,  // m (相对于船中)

  // 附加质量系数
  ADDED_MASS_X: 0.05,         // 5%
  ADDED_MASS_Y: 0.90,         // 90% (宽船体)
  ADDED_INERTIA_Z: 0.15,

  // 速度限制
  MAX_SPEED: 6.0,             // m/s
  CRUISE_SPEED: 2.0,          // m/s (作业速度)

  // 舵角限制
  MAX_RUDDER_ANGLE: 35,       // °
  MAX_RUDDER_RATE: 2.5,       // °/s
};

// ============ 数学工具 ============

/** 限幅函数 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** 角度归一化到 [0, 360) */
export const normalizeHeading = (heading: number): number =>
  ((heading % 360) + 360) % 360;

/** 角度归一化到 [-180, 180) */
export const normalizeSignedHeading = (heading: number): number => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

/** 角度转弧度 */
export const toRadians = (degrees: number): number => degrees * DEG_TO_RAD;

/** 弧度转角度 */
export const toDegrees = (radians: number): number => radians * RAD_TO_DEG;

/** 计算两个航向角之间的差值 (考虑角度环绕) */
export const angleDelta = (target: number, current: number): number => {
  const normalizedTarget = normalizeHeading(target);
  const normalizedCurrent = normalizeHeading(current);
  let diff = normalizedTarget - normalizedCurrent;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

/** 线性插值 */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1);

/** 随机数 (指定范围) */
export const randomInRange = (
  min: number,
  max: number,
  rng: RandomNumberGenerator = Math.random,
): number => rng() * (max - min) + min;

// ============ LNG 船特定参数 ============

/** 长恒系列 LNG 船物理参数 */
export const LNG_CHANGHENG_PARAMS = {
  // 尺度
  LENGTH: 295,              // m
  BEAM: 46.4,               // m
  DRAFT: 11.5,              // m
  DISPLACEMENT: 115000,     // t (满载)
  CARGO_CAPACITY: 174000,   // m³ LNG

  // Nomoto 二阶参数
  K: 0.03,                  // 转向增益 (大船较小)
  T1: 80,                   // 主时间常数 (s)
  T2: 20,                   // 次时间常数 (s)
  TIME_DELAY: 25,           // 纯滞后 (s)

  // 速度限制
  MAX_SPEED: 10.5,          // m/s (~20节)
  CRUISE_SPEED: 9.8,        // m/s (~19节)

  // 舵角限制
  MAX_RUDDER_ANGLE: 35,     // °
  MAX_RUDDER_RATE: 2.3,     // °/s

  // 质量和惯性 (满载)
  MASS: 115000000,          // kg
  MOMENT_OF_INERTIA: 8e10,  // kg·m²

  // 货舱
  TANK_COUNT: 4,
  BOIL_OFF_RATE: 0.1,       // %/day
};

/** LNG 液货晃荡参数 */
export const LNG_SLOSHING_PARAMS = {
  NATURAL_FREQ: 0.5,        // 固有频率 (rad/s), 周期 ~12.5s
  DAMPING: 0.1,             // 阻尼比 ζ (欠阻尼)
  COUPLING: 5e8,            // 耦合系数 (N·m/rad)
  INERTIA: 1e10,            // 液货惯量 (kg·m²)
  BASE_PRESSURE: 100,       // 基准压力 (kPa)
  PRESSURE_SENSITIVITY: 50, // 压力敏感度 (kPa/rad)
};

/** LNG 船默认 PID (针对时滞优化) */
export const LNG_DEFAULT_PID: PIDGains = {
  kp: 0.8,      // 较低比例增益
  ki: 0.005,    // 较慢积分
  kd: 2.0,      // 增强微分预测
};

/** LNG 船伦理阈值 */
export const LNG_ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 2.3,         // °/s
  MAX_ROLL_ANGLE: 8.0,          // ° (LNG船更严格)
  MAX_YAW_RATE: 1.0,            // °/s
  MIN_COLLISION_DISTANCE: 500,  // m (大船需更大安全距离)
  MAX_SLOSHING_ANGLE: 10.0,     // ° (晃荡角度限制)
  MAX_TANK_PRESSURE: 200,       // kPa
  LNG_LEAK_THRESHOLD: 20,       // %LEL
};

// ============ 集装箱船特定参数 ============

/** MSC Tessa 超大型集装箱船物理参数 */
export const CONTAINER_MSC_PARAMS = {
  // 尺度
  LENGTH: 399.9,              // m
  BEAM: 61.5,                 // m
  DRAFT_FULL: 16.5,           // 满载吃水 (m)
  DRAFT_EMPTY: 8.0,           // 空载吃水 (m)
  DISPLACEMENT_FULL: 240000,  // 满载 (t)
  DISPLACEMENT_EMPTY: 80000,  // 空载 (t)
  TEU_CAPACITY: 24116,        // 标箱数

  // Nomoto 变参数 (随装载率变化)
  K_FULL: 0.04,               // 满载转向增益 (迟钝)
  K_EMPTY: 0.12,              // 空载转向增益 (灵敏)
  T_FULL: 120,                // 满载时间常数 (s)
  T_EMPTY: 40,                // 空载时间常数 (s)

  // 速度限制
  MAX_SPEED: 12.4,            // m/s (~24节)
  CRUISE_SPEED: 10.3,         // m/s (~20节)

  // 舵角限制
  MAX_RUDDER_ANGLE: 35,       // °
  MAX_RUDDER_RATE: 2.5,       // °/s

  // 风载荷参数
  WIND_AREA_HULL: 2000,       // 船体受风面积 (m²)
  WIND_AREA_CARGO: 6000,      // 货物受风面积 (m²)
  WIND_COEFF: 0.8,            // 风力系数
  WIND_ARM_RATIO: 0.3,        // 风力臂比例 (相对船长)

  // 横摇参数
  ROLL_NATURAL_FREQ: 0.3,     // rad/s (周期 ~21s)
  ROLL_DAMPING: 0.05,         // 阻尼比 (欠阻尼)
  MAX_SAFE_ROLL: 10,          // 最大安全横摇角 (°)
  CARGO_SHIFT_ROLL: 8,        // 货物移位临界横摇角 (°)

  // 质量参数
  MASS_FULL: 240000000,       // 满载质量 (kg)
  MASS_EMPTY: 80000000,       // 空载质量 (kg)
  MOMENT_OF_INERTIA_FULL: 1.5e11,  // 满载转动惯量 (kg·m²)
  MOMENT_OF_INERTIA_EMPTY: 5e10,   // 空载转动惯量 (kg·m²)

  // 操纵安全限值
  MAX_WIND_SPEED: 20,         // 最大允许操纵风速 (m/s)
};

/** 集装箱船增益调度配置 */
export const CONTAINER_GAIN_SCHEDULE = {
  // 空载时: 系统更灵敏，需要较低增益
  empty: { kp: 0.8, ki: 0.01, kd: 0.5 },
  // 满载时: 系统更迟钝，需要较高增益
  full: { kp: 2.5, ki: 0.03, kd: 1.5 },
};

/** 集装箱船默认 PID (中等装载率) */
export const CONTAINER_DEFAULT_PID: PIDGains = {
  kp: 1.6,
  ki: 0.02,
  kd: 1.0,
};

/** 集装箱船伦理阈值 */
export const CONTAINER_ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 2.5,         // °/s
  MAX_ROLL_ANGLE: 10.0,         // ° (丢箱风险)
  CARGO_SHIFT_ROLL: 8.0,        // ° (货物移位)
  MAX_YAW_RATE: 1.5,            // °/s
  MIN_COLLISION_DISTANCE: 500,  // m (大船需更大安全距离)
  MAX_WIND_SPEED: 20,           // m/s (风速限制)
};

// ============ 邮轮特定参数 ============

/** 爱达·魔都号邮轮物理参数 */
export const CRUISE_ADORA_PARAMS = {
  // 尺度
  LENGTH: 323.6,              // m
  BEAM: 37.2,                 // m
  DRAFT: 8.5,                 // m
  DISPLACEMENT: 135500,       // GT (总吨)

  // 质量和惯性
  MASS: 140000000,            // kg (~14万吨)
  ROLL_INERTIA: 1.5e11,       // 横摇转动惯量 (kg·m²)
  YAW_INERTIA: 2.0e11,        // 艏摇转动惯量 (kg·m²)

  // Nomoto 二阶航向参数
  K: 0.05,                    // 转向增益 (大船较低)
  T1: 90,                     // 主时间常数 (s)
  T2: 25,                     // 副时间常数 (s)

  // 横摇动力学参数
  K_PHI: 0.15,                // 横摇响应增益
  T_PHI1: 8.0,                // 横摇主时间常数 (s)
  T_PHI2: 2.0,                // 横摇副时间常数 (s)
  NATURAL_ROLL_PERIOD: 18.0,  // 自然横摇周期 (s)
  ROLL_DAMPING: 0.08,         // 无减摇鳍时阻尼比

  // 速度限制
  MAX_SPEED: 11.3,            // m/s (~22节)
  CRUISE_SPEED: 9.3,          // m/s (~18节)

  // 舵角限制
  MAX_RUDDER_ANGLE: 35,       // °
  MAX_RUDDER_RATE: 2.5,       // °/s
};

/** 减摇鳍参数 */
export const FIN_STABILIZER_PARAMS = {
  FIN_AREA: 12.0,             // 单侧鳍面积 (m²)
  FIN_SPAN: 4.0,              // 鳍展 (m)
  FIN_CHORD: 3.0,             // 鳍弦长 (m)
  ASPECT_RATIO: 1.33,         // 展弦比
  MAX_FIN_ANGLE: 25,          // 最大偏转角 (°)
  MAX_FIN_RATE: 15,           // 最大偏转率 (°/s)
  LIFT_COEFFICIENT_SLOPE: 5.5, // 升力系数斜率 (/rad)
  ARM_LENGTH: 15.0,           // 力臂 (m)
  EFFICIENCY: 0.85,           // 效率系数
  MAX_POWER: 500,             // 最大功率 (kW)
};

/** 舒适度阈值 */
export const CRUISE_COMFORT_THRESHOLDS = {
  // 横摇角等级 (°)
  EXCELLENT_ROLL: 1.0,
  GOOD_ROLL: 2.0,
  MODERATE_ROLL: 4.0,
  POOR_ROLL: 6.0,

  // 运动病指数 MSI (%)
  EXCELLENT_MSI: 5,
  GOOD_MSI: 10,
  MODERATE_MSI: 20,
  POOR_MSI: 40,

  // 致晕频段 (Hz)
  MOTION_SICKNESS_FREQ_LOW: 0.1,
  MOTION_SICKNESS_FREQ_HIGH: 0.3,

  // 横摇角速度限制 (°/s)
  MAX_ROLL_RATE: 3.0,
};

/** 陷波滤波器默认参数 */
export const NOTCH_FILTER_DEFAULTS = {
  CENTER_FREQUENCY: 0.16,     // 中心频率 (Hz)
  BANDWIDTH: 0.15,            // 带宽 (Hz)
  DEPTH: -30,                 // 陷波深度 (dB)
  ZERO_DAMPING: 0.1,          // 零点阻尼比
  POLE_DAMPING: 0.5,          // 极点阻尼比
};

/** 邮轮默认 PID */
export const CRUISE_DEFAULT_PID: PIDGains = {
  kp: 0.6,
  ki: 0.008,
  kd: 1.5,
};

/** 邮轮伦理阈值 */
export const CRUISE_ETHICAL_THRESHOLDS = {
  MAX_RUDDER_RATE: 2.5,         // °/s
  MAX_ROLL_ANGLE: 6.0,          // ° (乘客舒适限制)
  MAX_YAW_RATE: 1.0,            // °/s
  MIN_COLLISION_DISTANCE: 800,  // m (大船需更大安全距离)
  MAX_MSI: 40,                  // % 晕船率阈值
  EXCESSIVE_FIN_ENERGY: 500,    // kW 减摇鳍功率阈值
  FIN_ENERGY_EXCEEDED: 500,     // kW 减摇鳍功率阈值 (别名)
  COMFORT_WARNING_ROLL: 4.0,    // ° 舒适度警告横摇角
  COMFORT_VIOLATION: 6.0,       // ° 舒适度违规横摇角
  EXCESSIVE_RUDDER_RATE: 2.5,   // °/s 过度舵角速率
  EXCESSIVE_ROLL_ANGLE: 6.0,    // ° 过度横摇角
};

// ============ 半潜式钻井平台参数 (HYSY981) ============

/** 海洋石油981平台物理参数 */
export const HYSY981_PLATFORM_PARAMS = {
  // 尺度
  LENGTH: 114.0,                // m (船长)
  WIDTH: 78.0,                  // m (型宽)
  DRAFT_OPERATING: 37.0,        // m (作业吃水)
  DRAFT_TRANSIT: 19.0,          // m (航行吃水)
  DISPLACEMENT: 55000,          // t (排水量)

  // 质量和惯性
  MASS: 55000000,               // kg (55,000吨)
  ADDED_MASS_X: 0.05,           // 纵向附加质量系数
  ADDED_MASS_Y: 0.85,           // 横向附加质量系数 (半潜较大)
  INERTIA_Z: 8.0e11,            // kg·m² (艏摇转动惯量)
  ADDED_INERTIA_Z: 0.12,        // 附加惯性系数

  // 阻尼系数 (线性化)
  DAMPING_U: 5e5,               // N/(m/s) 纵向阻尼
  DAMPING_V: 1e7,               // N/(m/s) 横向阻尼
  DAMPING_R: 5e10,              // N·m/(rad/s) 艏摇阻尼
  DAMPING_VR: 1e9,              // 横荡-艏摇耦合阻尼 (sway→yaw)
  DAMPING_RV: 1e8,              // 艏摇-横荡耦合阻尼 (yaw→sway)

  // 投影面积 (用于环境力计算)
  AREA_SURGE: 2000,             // m² (纵向投影面积)
  AREA_SWAY: 4000,              // m² (横向投影面积)
  AREA_WIND_SURGE: 3000,        // m² (水上纵向受风面积)
  AREA_WIND_SWAY: 5000,         // m² (水上横向受风面积)

  // 钻井作业参数
  MAX_WATER_DEPTH: 3000,        // m (最大作业水深)
  RISER_LENGTH: 2800,           // m (隔水管长度)
};

/** HYSY981 推进器布局 (8台全回转推进器) */
export const HYSY981_THRUSTER_LAYOUT = [
  // 前部推进器 (Fore)
  { id: 1, positionX: -45, positionY: 30, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 2, positionX: -45, positionY: -30, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 3, positionX: -30, positionY: 35, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 4, positionX: -30, positionY: -35, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  // 后部推进器 (Aft)
  { id: 5, positionX: 45, positionY: 30, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 6, positionX: 45, positionY: -30, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 7, positionX: 30, positionY: 35, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
  { id: 8, positionX: 30, positionY: -35, maxThrust: 800, maxPower: 4500, maxAzimuthRate: 15 },
];

/** 钻井平台默认 DP 增益 */
export const DRILLING_DEFAULT_DP = {
  surge: { kp: 500, ki: 10, kd: 2000 },   // 纵荡控制 (kN/m, kN/m·s, kN·s/m)
  sway: { kp: 800, ki: 15, kd: 3000 },    // 横荡控制 (需更大增益抵抗横流)
  yaw: { kp: 1e8, ki: 1e6, kd: 5e8 },     // 艏摇控制 (kN·m/rad)
};

/** 钻井平台伦理阈值 */
export const DRILLING_ETHICAL_THRESHOLDS = {
  // 位置警报阈值
  YELLOW_ALERT_POSITION: 3.0,     // m (黄色警报)
  RED_ALERT_POSITION: 5.0,        // m (红色警报-准备解脱)
  EMERGENCY_DISCONNECT: 10.0,     // m (自动紧急解脱)

  // 航向阈值
  MAX_HEADING_DEVIATION: 15,      // ° (最大航向偏差)

  // 推进器阈值
  MAX_THRUSTER_POWER: 4500,       // kW (单台最大功率)
  MAX_TOTAL_POWER: 32000,         // kW (总功率限制, 8×4000)
  MAX_AZIMUTH_RATE: 15,           // °/s (方位角变化速率)

  // 环境阈值
  MAX_CURRENT_SPEED: 1.5,         // m/s (最大作业海流)
  MAX_WIND_SPEED: 25,             // m/s (最大作业风速)
  MAX_SEA_STATE: 6,               // 最大作业海况等级
};

/** 海流力系数 */
export const CURRENT_FORCE_COEFFICIENTS = {
  CX: 0.8,                        // 纵向力系数
  CY: 1.2,                        // 横向力系数
  CN: 0.15,                       // 力矩系数
};

/** 风力系数 */
export const WIND_FORCE_COEFFICIENTS = {
  CX: 0.7,                        // 纵向力系数
  CY: 1.0,                        // 横向力系数
  CN: 0.12,                       // 力矩系数
};

// ============ 雪龙2号破冰船参数 ============

/** 雪龙2号破冰船物理参数 */
export const XUELONG_ICEBREAKER_PARAMS = {
  // 尺度
  LENGTH: 122.5,                  // m (总长)
  BEAM: 22.0,                     // m (型宽)
  DRAFT: 7.85,                    // m (设计吃水)
  DISPLACEMENT: 13990,            // t (排水量)
  BLOCK_COEFFICIENT: 0.65,        // 方形系数

  // 质量和惯性
  MASS: 13990000,                 // kg
  ADDED_MASS_X: 0.05,             // 纵向附加质量系数
  ADDED_MASS_Y: 0.60,             // 横向附加质量系数
  INERTIA_Z: 5.0e10,              // kg·m² (艏摇转动惯量)
  ADDED_INERTIA_Z: 0.10,          // 附加惯性系数

  // 阻尼系数 (线性化)
  DAMPING_U: 2e5,                 // N/(m/s) 纵向阻尼
  DAMPING_V: 3e6,                 // N/(m/s) 横向阻尼
  DAMPING_R: 1e10,                // N·m/(rad/s) 艏摇阻尼

  // 速度限制
  DESIGN_SPEED: 15.5,             // 节 (开阔水域)
  MAX_SPEED: 8.0,                 // m/s (~15.5节)
  CRUISE_SPEED: 6.0,              // m/s (~12节)
  ICE_BREAKING_SPEED: 1.5,        // m/s (~3节, 冰区作业)

  // 破冰能力
  ICE_BREAKING_AHEAD: 1.5,        // m (前进破冰厚度)
  ICE_BREAKING_ASTERN: 1.5,       // m (倒退破冰厚度)
};

/** Azipod 吊舱推进器配置 */
export const XUELONG_AZIPOD_LAYOUT = [
  {
    id: 1,
    positionX: -55,               // m (船尾位置)
    positionY: 5,                 // m (左侧偏置)
    maxThrust: 7500,              // kN (单吊舱最大推力)
    maxPower: 7500,               // kW (单吊舱最大功率)
    maxSlewRate: 12,              // °/s (关键约束: 回转速率限制)
  },
  {
    id: 2,
    positionX: -55,               // m (船尾位置)
    positionY: -5,                // m (右侧偏置)
    maxThrust: 7500,              // kN
    maxPower: 7500,               // kW
    maxSlewRate: 12,              // °/s
  },
];

/** Azipod 控制参数 */
export const XUELONG_AZIPOD_PARAMS = {
  AZIPOD_COUNT: 2,                // 吊舱数量
  MAX_SINGLE_THRUST: 7500,        // kN (单吊舱最大推力)
  MAX_TOTAL_THRUST: 15000,        // kN (总推力)
  MAX_SLEW_RATE: 12,              // °/s (关键约束！)
  MIN_SLEW_RATE: 0.5,             // °/s (最小转动速率)
  SLEW_ACCELERATION: 5,           // °/s² (回转加速度)

  // 推力响应
  THRUST_TIME_CONSTANT: 3.0,      // s (推力响应时间常数)
  THRUST_RATE_LIMIT: 500,         // kN/s (推力变化率限制)

  // Azipod 物理
  PROPELLER_DIAMETER: 4.5,        // m (螺旋桨直径)
  PROPELLER_RPM_MAX: 200,         // rpm (最大转速)
};

/** 冰阻力模型参数 */
export const XUELONG_ICE_PARAMS = {
  // 破冰能力
  MAX_ICE_THICKNESS: 1.5,         // m (最大破冰厚度)
  ICE_DENSITY: 917,               // kg/m³ (海冰密度)
  ICE_STRENGTH: 500,              // kPa (冰抗压强度)

  // 冰阻力经验系数 R = a × h^1.5 × v^0.5
  RESISTANCE_COEFF_A: 5e6,        // N/m^1.5/(m/s)^0.5
  RESISTANCE_COEFF_H: 1.5,        // h 指数
  RESISTANCE_COEFF_V: 0.5,        // v 指数

  // Stick-Slip 粘滑模型参数
  STICK_DURATION_MIN: 2.0,        // s (粘滞相最短持续)
  STICK_DURATION_MAX: 6.0,        // s (粘滞相最长持续)
  SLIP_DURATION_MIN: 0.5,         // s (滑动相最短持续)
  SLIP_DURATION_MAX: 2.0,         // s (滑动相最长持续)

  // 参数摄动范围 (冰接触时)
  K_PERTURBATION_MIN: 0.4,        // K × [0.4, 1.1]，最低-60%
  K_PERTURBATION_MAX: 1.1,        // 最高+10%
  T_PERTURBATION_MIN: 0.8,        // T × [0.8, 1.4]，最低-20%
  T_PERTURBATION_MAX: 1.4,        // 最高+40%

  // 摩擦系数
  STATIC_FRICTION: 0.4,           // 静摩擦系数 (粘滞)
  KINETIC_FRICTION: 0.1,          // 动摩擦系数 (滑动)
};

/** 雪龙号默认控制增益 */
export const XUELONG_DEFAULT_GAINS = {
  // 航向控制 PID
  heading: { kp: 1.2, ki: 0.015, kd: 0.8 },

  // 冰区模式: 更保守的增益
  ice: { kp: 0.8, ki: 0.008, kd: 0.5 },

  // Azipod 角度控制
  azipod: {
    kp: 2.0,                      // 比例增益
    ki: 0.1,                      // 积分增益
    kd: 0.3,                      // 微分增益
    slewLimit: 12,                // °/s 回转速率限制
  },
};

/** 雪龙号伦理阈值 */
export const XUELONG_ETHICAL_THRESHOLDS = {
  // 航向控制阈值
  MAX_HEADING_ERROR: 10,          // ° (最大允许航向误差)
  MAX_YAW_RATE: 3.0,              // °/s (最大艏摇角速度)
  MAX_RUDDER_RATE: 0,             // 无舵 (Azipod 推进)

  // 横摇阈值
  MAX_ROLL_ANGLE: 12.0,           // ° (极地作业允许较大)

  // Azipod 阈值
  AZIPOD_SLEW_RATE_WARNING: 10,   // °/s (接近限制)
  AZIPOD_SLEW_RATE_EXCEEDED: 12,  // °/s (超限)
  AZIPOD_POWER_WARNING: 6500,     // kW (单吊舱功率警告)
  AZIPOD_POWER_EXCEEDED: 7500,    // kW (单吊舱功率超限)

  // 冰区安全阈值
  ICE_THICKNESS_WARNING: 1.2,     // m (接近破冰能力极限)
  ICE_THICKNESS_EXCEEDED: 1.5,    // m (超出破冰能力)
  PROPELLER_STRESS_WARNING: 0.8,  // 相对设计载荷
  PROPELLER_STRESS_EXCEEDED: 1.0, // 超载

  // 环境保护阈值
  WILDLIFE_MIN_DISTANCE: 500,     // m (野生动物最小距离)
  SPEED_IN_WILDLIFE_ZONE: 3.0,    // m/s (野生动物区域限速)

  // 安全距离
  MIN_COLLISION_DISTANCE: 200,    // m (与其他船舶)
};

/** 极地环境参数 */
export const POLAR_ENVIRONMENT_PARAMS = {
  // 海水参数 (极地海水密度更高)
  SEA_WATER_DENSITY: 1028,        // kg/m³
  SEA_WATER_TEMPERATURE: -1.8,    // °C (冰点附近)

  // 风场参数
  KATABATIC_WIND_MAX: 35,         // m/s (下降风最大速度)
  WIND_CHILL_FACTOR: 1.5,         // 风寒效应系数

  // 能见度
  VISIBILITY_BLIZZARD: 50,        // m (暴风雪)
  VISIBILITY_NORMAL: 10000,       // m (正常)
};

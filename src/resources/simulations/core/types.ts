/**
 * 仿真框架核心类型定义
 * 统一所有船舶仿真的类型系统
 */

// ============ 基础类型 ============

/** 二维向量 */
export interface Vector2 {
  x: number;
  z: number;
}

/** 三维向量 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** 六自由度状态 */
export interface DOF6State {
  x: number;      // 纵向位置 (m)
  y: number;      // 横向位置 (m)
  z: number;      // 垂向位置 (m)
  phi: number;    // 横摇角 (rad)
  theta: number;  // 纵摇角 (rad)
  psi: number;    // 航向角 (rad)
}

/** 三自由度运动状态 (水平面) */
export interface DOF3State {
  x: number;      // 纵向位置 (m)
  y: number;      // 横向位置 (m)
  psi: number;    // 航向角 (rad)
  u: number;      // 纵向速度 (m/s)
  v: number;      // 横向速度 (m/s)
  r: number;      // 转艏角速度 (rad/s)
}

// ============ 控制相关类型 ============

/** 控制模式 */
export type ControlMode =
  | 'manual'           // 手动控制
  | 'p'                // P 控制
  | 'pd'               // PD 控制
  | 'pid'              // PID 控制
  | 'pid_scheduled'    // 增益调度 PID (集装箱船等变参数系统)
  | 'dp'               // 动力定位
  | 'autopilot';       // 自动舵

/** 任务场景类型 */
export type TaskScenario =
  | 'turn90'           // 90度转向
  | 'obstacle'         // 避障机动
  | 'circle'           // 回旋运动
  | 'straight'         // 直线航行
  | 'position_keeping' // 定点保持
  | 'path_following';  // 路径跟踪

/** PID 增益参数 */
export interface PIDGains {
  kp: number;
  ki: number;
  kd: number;
}

/** 动力定位控制增益 */
export interface DPGains {
  surge: PIDGains;     // 纵荡控制
  sway: PIDGains;      // 横荡控制
  yaw: PIDGains;       // 艏摇控制
}

/** PID 控制器状态 */
export interface PIDState {
  integral: number;
  prevError: number;
}

/** 动力定位控制器状态 */
export interface DPState {
  surge: PIDState;
  sway: PIDState;
  yaw: PIDState;
}

/** 控制输入 */
export interface ControlInput {
  rudder: number;           // 舵角 (rad)
  propellerRPM?: number;    // 螺旋桨转速
  thrusterForce?: Vector3;  // 侧推力 (N)
}

// ============ 海况与环境 ============

/** 海况等级 (1-5) */
export type SeaStateLevel = 1 | 2 | 3 | 4 | 5;

/** 海况配置 */
export interface SeaStateConfig {
  level: SeaStateLevel;
  waveHeight: number;     // 有效波高 (m)
  wavePeriod: number;     // 波周期 (s)
  waveDirection: number;  // 波向 (rad, 0=船艏方向)
  windSpeed: number;      // 风速 (m/s)
  windDirection: number;  // 风向 (rad)
  currentSpeed: number;   // 流速 (m/s)
  currentDirection: number; // 流向 (rad)
}

/** 扰动向量 */
export interface DisturbanceVector {
  forceX: number;     // 纵向力 (N)
  forceY: number;     // 横向力 (N)
  momentN: number;    // 艏摇力矩 (N·m)
}

/** 波浪单元参数 */
export interface WaveComponent {
  amplitude: number;
  frequency: number;
  speed: number;
  direction: Vector2;
}

// ============ 物理模型类型 ============

/** 物理模型类型 */
export type PhysicsModelType =
  | 'Nomoto1stOrder'      // Nomoto 一阶模型
  | 'Nomoto2ndOrder'      // Nomoto 二阶模型
  | 'NomotoVariableMass'  // Nomoto 变质量模型 (集装箱船)
  | 'MMG3DOF'             // MMG 三自由度模型
  | '3DOF_Coupled'        // 耦合三自由度模型
  | 'SemiSubmersible3DOF' // 半潜平台3DOF动力定位模型
  | 'Azipod3DOF';         // Azipod吊舱推进3DOF模型 (破冰船)

/** Nomoto 模型参数 */
export interface NomotoParams {
  K: number;              // 转向增益
  T: number;              // 时间常数 (1阶)
  T1?: number;            // 时间常数1 (2阶)
  T2?: number;            // 时间常数2 (2阶)
  T3?: number;            // 时间常数3 (2阶)
  maxRudderDeg: number;   // 最大舵角 (度)
  speedMps: number;       // 参考航速 (m/s)
}

/** Nomoto 模型状态 */
export interface NomotoState {
  headingRad: number;
  yawRateRad: number;
  rudderDeg: number;
  positionX: number;
  positionZ: number;
  speedMps: number;
}

/** Nomoto 二阶模型参数 (带时滞) */
export interface Nomoto2ndOrderParams {
  K: number;              // 转向增益
  T1: number;             // 主时间常数 (s)
  T2: number;             // 次时间常数 (s)
  T3?: number;            // 可选第三时间常数
  timeDelay: number;      // 纯滞后 (s)
  maxRudderDeg: number;   // 最大舵角 (度)
  speedMps: number;       // 参考航速 (m/s)
}

/** Nomoto 二阶模型状态 (带时滞) */
export interface Nomoto2ndOrderDelayState extends NomotoState {
  yawRateDerivative: number;    // 转艏角加速度 (rad/s²)
  rudderHistory: number[];       // 舵角历史缓冲区
  historyIndex: number;          // 当前缓冲区索引
}

/** 液货晃荡状态 */
export interface SloshingState {
  angle: number;           // 晃荡角度 (rad)
  rate: number;            // 晃荡角速度 (rad/s)
  tankPressure: number;    // 货舱压力 (kPa)
}

/** 液货晃荡参数 */
export interface SloshingParams {
  naturalFreq: number;     // 固有频率 (rad/s)
  damping: number;         // 阻尼比 ζ
  coupling: number;        // 耦合系数 (N·m/rad)
  inertia: number;         // 液货惯量 (kg·m²)
  basePressure: number;    // 基准压力 (kPa)
  pressureSensitivity: number;  // 压力对晃荡的敏感度 (kPa/rad)
}

/** LNG 船完整状态 */
export interface LNGCarrierState extends Nomoto2ndOrderDelayState {
  sloshing: SloshingState;
}

/** Smith 预估器状态 */
export interface SmithPredictorState {
  modelOutput: number;        // 无时滞模型输出
  delayedModelOutput: number; // 带时滞模型输出
  modelHistory: number[];     // 模型输出历史
  historyIndex: number;
}

// ============ 集装箱船类型 ============

/** 变质量 Nomoto 参数 */
export interface VariableMassNomotoParams {
  K_full: number;           // 满载转向增益
  K_empty: number;          // 空载转向增益
  T_full: number;           // 满载时间常数 (s)
  T_empty: number;          // 空载时间常数 (s)
  maxRudderDeg: number;     // 最大舵角 (度)
  speedMps: number;         // 参考航速 (m/s)
}

/** 风载荷状态 */
export interface WindLoadState {
  force: number;            // 横向风力 (N)
  moment: number;           // 风致力矩 (N·m)
  relativeDirection: number; // 相对风向 (rad)
}

/** 横摇状态 */
export interface RollState {
  angle: number;            // 横摇角 (rad)
  rate: number;             // 横摇角速度 (rad/s)
}

/** 集装箱船完整状态 */
export interface ContainerShipState extends NomotoState {
  loadRatio: number;        // 装载率 [0, 1]
  cargoMass: number;        // 货物质量 (t)
  currentK: number;         // 当前转向增益
  currentT: number;         // 当前时间常数
  windLoad: WindLoadState;  // 风载荷状态
  roll: RollState;          // 横摇状态
}

/** 增益调度配置 */
export interface GainScheduleConfig {
  empty: PIDGains;          // 空载增益
  full: PIDGains;           // 满载增益
}

// ============ 邮轮类型 ============

/** 横摇耦合 Nomoto 参数 (邮轮) */
export interface RollCoupledNomotoParams {
  // 航向动力学 (Nomoto 二阶)
  K: number;              // 转向增益
  T1: number;             // 主时间常数 (s)
  T2: number;             // 副时间常数 (s)

  // 横摇动力学
  K_phi: number;          // 横摇增益
  T_phi1: number;         // 横摇主时间常数 (s)
  T_phi2: number;         // 横摇副时间常数 (s)
  naturalRollPeriod: number;  // 自然横摇周期 (s)
  rollDamping: number;    // 横摇阻尼比

  // 舵角与速度限制
  maxRudderDeg: number;
  speedMps: number;
}

/** 横摇耦合状态 (邮轮) */
export interface RollCoupledState {
  // 航向状态
  headingRad: number;
  yawRateRad: number;
  yawAccelRad: number;    // 转艏角加速度 (rad/s²)

  // 横摇状态
  rollRad: number;        // 横摇角 (rad)
  rollRateRad: number;    // 横摇角速度 (rad/s)

  // 位置与速度
  positionX: number;
  positionZ: number;
  speedMps: number;

  // 控制输入
  rudderDeg: number;
  finAngleDeg: number;    // 减摇鳍角度 (deg)
}

/** 减摇鳍参数 */
export interface FinStabilizerParams {
  finArea: number;            // 单侧鳍面积 (m²)
  finAspectRatio: number;     // 展弦比
  maxFinAngle: number;        // 最大偏转角 (deg)
  maxFinRate: number;         // 最大偏转率 (deg/s)
  liftCoefficientSlope: number;  // 升力系数斜率 (/rad)
  armLength: number;          // 力臂长度 (m)
  efficiency: number;         // 效率系数
}

/** 减摇鳍状态 */
export interface FinStabilizerState {
  portFinAngleDeg: number;      // 左舷鳍角度 (°)
  starboardFinAngleDeg: number; // 右舷鳍角度 (°)
  portLiftForce: number;        // 左舷升力 (N)
  starboardLiftForce: number;   // 右舷升力 (N)
  antiRollMoment: number;       // 抗横摇力矩 (N·m)
  powerConsumption: number;     // 功耗 (kW)
  enabled: boolean;             // 是否启用
}

/** 陷波滤波器参数 */
export interface NotchFilterParams {
  centerFrequencyHz: number;  // 中心频率 (Hz)
  bandwidthHz: number;        // 带宽 (Hz)
  depthDb: number;            // 陷波深度 (dB)
  zeroDamping: number;        // 零点阻尼比 zeta_z
  poleDamping: number;        // 极点阻尼比 zeta_p
}

/** 陷波滤波器状态 */
export interface NotchFilterState {
  inputHistory: [number, number];   // 输入历史 (二阶)
  outputHistory: [number, number];  // 输出历史 (二阶)
  enabled: boolean;                 // 滤波器是否启用
  currentGainDb: number;            // 当前增益 (dB)
}

/** 舒适度等级 */
export type ComfortLevel = 'excellent' | 'good' | 'moderate' | 'poor' | 'unacceptable';

/** 舒适度指标 (基于 ISO 2631-1 和 O'Hanlon-McCauley 模型) */
export interface ComfortMetrics {
  // 晕船率指标
  msi: number;                  // Motion Sickness Incidence 晕船率 (0-100%)

  // 横摇统计
  rollRms: number;              // 横摇角 RMS (deg)
  rollPeak: number;             // 峰值横摇角 (deg)

  // 舒适度等级
  comfortRating: ComfortLevel;  // 舒适度评级

  // 振动剂量
  vdv: number;                  // Vibration Dose Value 振动剂量值
  frequencyWeightedAccel: number; // 频率加权加速度 (m/s²)
}

/** Bode 图数据 */
export interface BodePlotData {
  frequencies: number[];      // 频率 (Hz)
  magnitudeDb: number[];      // 幅值 (dB)
  phaseDeg: number[];         // 相位 (deg)
}

/** 邮轮完整状态 */
export interface CruiseShipState extends RollCoupledState {
  finStabilizer: FinStabilizerState;
  comfort: ComfortMetrics;
}

// ============ 半潜平台类型 ============

/** 推进器配置 (单台全回转推进器) */
export interface ThrusterConfig {
  id: number;                 // 推进器编号 (1-8)
  positionX: number;          // X位置 (m, 相对平台中心)
  positionY: number;          // Y位置 (m, 相对平台中心)
  maxThrust: number;          // 最大推力 (kN)
  maxPower: number;           // 最大功率 (kW)
  maxAzimuthRate: number;     // 最大回转速率 (deg/s)
  forbiddenZones?: Array<[number, number]>;  // 禁止角度区间 (deg)
}

/** 单台推进器状态 */
export interface ThrusterState {
  id: number;                 // 推进器编号
  thrust: number;             // 当前推力 (kN)
  azimuth: number;            // 当前方位角 (deg, 0=前, 90=右)
  power: number;              // 当前功率 (kW)
  enabled: boolean;           // 是否启用
  failed: boolean;            // 是否故障
}

/** 推力分配结果 */
export interface ThrustAllocationResult {
  thrusters: ThrusterState[];       // 各推进器状态
  totalForceX: number;              // 合力X (kN)
  totalForceY: number;              // 合力Y (kN)
  totalMomentN: number;             // 合力矩 (kN·m)
  totalPower: number;               // 总功率 (kW)
  feasible: boolean;                // 是否可行
  saturated: boolean;               // 是否有推进器饱和
}

/** 半潜平台3DOF状态 */
export interface SemiSubmersible3DOFState {
  // 位置 (地固坐标系)
  x: number;                  // 北向位置 (m)
  y: number;                  // 东向位置 (m)
  psi: number;                // 航向角 (rad)

  // 速度 (体坐标系)
  u: number;                  // 纵向速度 (m/s)
  v: number;                  // 横向速度 (m/s)
  r: number;                  // 转艏角速度 (rad/s)

  // 推进器状态
  thrusters: ThrusterState[];

  // 环境扰动
  currentForceX: number;      // 海流X力 (kN)
  currentForceY: number;      // 海流Y力 (kN)
  currentMomentN: number;     // 海流力矩 (kN·m)
  windForceX: number;         // 风力X (kN)
  windForceY: number;         // 风力Y (kN)
  windMomentN: number;        // 风力矩 (kN·m)

  // DP状态
  targetX: number;            // 目标X位置 (m)
  targetY: number;            // 目标Y位置 (m)
  targetPsi: number;          // 目标航向 (rad)
  positionError: number;      // 位置误差 (m)
  headingError: number;       // 航向误差 (deg)

  // 控制状态
  decouplingEnabled: boolean; // 解耦控制开关
}

/** DP解耦控制增益 */
export interface DPDecouplingGains {
  surge: PIDGains;            // 纵荡控制增益
  sway: PIDGains;             // 横荡控制增益
  yaw: PIDGains;              // 艏摇控制增益
  decouplingMatrix?: number[][]; // 解耦矩阵 (3x3)
}

// ============ 破冰船 Azipod 类型 ============

/** Azipod 吊舱配置 */
export interface AzipodConfig {
  id: number;                 // 吊舱编号 (1=左舷, 2=右舷)
  positionX: number;          // X位置 (m, 相对船中)
  positionY: number;          // Y位置 (m, 相对中线)
  maxThrust: number;          // 最大推力 (kN)
  maxPower: number;           // 最大功率 (kW)
  maxSlewRate: number;        // 最大回转速率 (°/s)
}

/** Azipod 吊舱状态 */
export interface AzipodState {
  id: number;                 // 吊舱编号
  azimuth: number;            // 当前方位角 (rad, 0=正前, π/2=右)
  azimuthCmd: number;         // 目标方位角 (rad)
  thrust: number;             // 当前推力 (kN)
  thrustCmd: number;          // 目标推力 (kN)
  power: number;              // 当前功率 (kW)
  slewRate: number;           // 当前回转速率 (°/s)
  enabled: boolean;           // 是否启用
}

/** Azipod 3DOF 状态 (破冰船) */
export interface Azipod3DOFState {
  // 位置 (地固坐标系)
  x: number;                  // 北向位置 (m)
  y: number;                  // 东向位置 (m)
  psi: number;                // 航向角 (rad)

  // 速度 (体坐标系)
  u: number;                  // 纵向速度 (m/s)
  v: number;                  // 横向速度 (m/s)
  r: number;                  // 转艏角速度 (rad/s)

  // 吊舱状态 (2个)
  azipods: [AzipodState, AzipodState];

  // 冰阻力状态
  iceContact: boolean;        // 是否与冰接触
  iceResistance: number;      // 冰阻力 (kN)
  perturbedK: number;         // 摄动后的 K 值
  perturbedT: number;         // 摄动后的 T 值

  // 控制状态
  targetHeading: number;      // 目标航向 (rad)
  headingError: number;       // 航向误差 (rad)
}

/** 冰阻力参数 */
export interface IceBreakingParams {
  enabled: boolean;           // 是否启用破冰模式
  iceThickness: number;       // 冰厚 (m)
  iceDensity: number;         // 冰密度 (kg/m³)
  frictionCoeff: number;      // 冰-船摩擦系数
  // 参数摄动范围
  kVariationMin: number;      // K 最小变化率 (如 -0.6 = -60%)
  kVariationMax: number;      // K 最大变化率 (如 +0.1 = +10%)
  tVariationMin: number;      // T 最小变化率 (如 -0.2 = -20%)
  tVariationMax: number;      // T 最大变化率 (如 +0.4 = +40%)
  // Stick-slip 参数
  stickSlipCycleMin: number;  // 粘滑周期最小值 (s)
  stickSlipCycleMax: number;  // 粘滑周期最大值 (s)
}

/** 冰阻力状态 */
export interface IceBreakingState {
  inContact: boolean;         // 是否接触冰层
  stickPhase: boolean;        // 当前是否为粘滞相
  phaseTime: number;          // 当前相位持续时间 (s)
  nextPhaseTime: number;      // 下次相位切换时间 (s)
  currentK: number;           // 当前摄动 K 值
  currentT: number;           // 当前摄动 T 值
  resistanceForce: number;    // 当前冰阻力 (N)
}

/** MMG 质量惯性矩阵 */
export interface MassInertiaMatrix {
  m: number;      // 船舶质量 (kg)
  Iz: number;     // 转动惯量 (kg·m²)
  xG: number;     // 重心纵向位置 (m)
  mx: number;     // 附加质量系数 X
  my: number;     // 附加质量系数 Y
  Jz: number;     // 附加转动惯量系数
}

/** 水动力导数 (无量纲) */
export interface HydrodynamicCoefficients {
  // 纵向力导数
  Xuu: number;
  Xvv: number;
  Xrr: number;
  Xvr: number;
  // 横向力导数
  Yv: number;
  Yr: number;
  Yvvv: number;
  Yrrr: number;
  Yvvr: number;
  Yvrr: number;
  // 艏摇力矩导数
  Nv: number;
  Nr: number;
  Nvvv: number;
  Nrrr: number;
  Nvvr: number;
  Nvrr: number;
}

/** MMG 3-DOF 模型参数 */
export interface MMG3DOFParams {
  massInertia: MassInertiaMatrix;
  hydro: HydrodynamicCoefficients;
  // 舵参数
  rudder: {
    maxAngle: number;       // 最大舵角 (rad)
    maxRate: number;        // 最大舵速 (rad/s)
    tR: number;             // 舵时间常数
    aH: number;             // 舵力系数
    xR: number;             // 舵位置 (m)
  };
  // 推进器参数
  propeller: {
    Dp: number;             // 螺旋桨直径 (m)
    wp: number;             // 伴流分数
    tp: number;             // 推力减额
  };
}

// ============ 仿真状态 ============

/** 统一仿真状态 */
export interface SimulationState {
  // 位置和运动
  position: Vector2;
  heading: number;          // 航向角 (度)
  headingRad: number;       // 航向角 (弧度)
  yawRate: number;          // 转向角速度 (度/秒)
  yawRateRad: number;       // 转向角速度 (弧度/秒)
  rudder: number;           // 舵角 (度)
  speed: number;            // 航速 (m/s)

  // 三自由度扩展 (用于 DP 模式)
  surgeVelocity?: number;   // 纵荡速度 (m/s)
  swayVelocity?: number;    // 横荡速度 (m/s)

  // 波浪影响
  waveY: number;
  wavePitch: number;
  waveRoll: number;

  // 时间与控制
  time: number;             // 仿真时间 (秒)
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;

  // 控制器状态
  controllerState?: PIDState | DPState;
}

/** 仿真指标 */
export interface SimulationMetrics {
  avgError: number;             // 平均航迹误差 (m)
  maxRudderRate: number;        // 最大舵角速度 (°/s)
  currentError: number;         // 当前航迹误差 (m)
  energyConsumption: number;    // 能耗积分
  settlingTime: number | null;  // 调节时间 (s)
  overshoot: number;            // 超调量 (%)
  crossTrackError: number;      // 航迹偏差 (m)

  // 定点保持指标 (DP 模式)
  positionError?: number;       // 位置误差 (m)
  headingError?: number;        // 航向误差 (°)
  maxPositionError?: number;    // 最大位置误差 (m)
  maxHeadingError?: number;     // 最大航向误差 (°)
  positionRMS?: number;         // 位置RMS (m)
  headingRMS?: number;          // 航向RMS (°)
}

/** 轨迹点 */
export interface TrajectoryPoint {
  time: number;
  x: number;
  z: number;
  heading: number;
  rudder: number;
  speed: number;
  targetHeading?: number;
  targetX?: number;
  targetZ?: number;
}

/** 图表数据 */
export interface ChartData {
  time: number[];
  desiredHeading: number[];
  actualHeading: number[];
  speed: number[];
  rudder: number[];
  error: number[];
  // DP 扩展
  desiredX?: number[];
  desiredY?: number[];
  actualX?: number[];
  actualY?: number[];
  positionError?: number[];
}

// ============ 伦理系统 ============

/** 伦理违规类型 */
export type ViolationType =
  | 'EXCESSIVE_RUDDER_RATE'     // 舵角变化过快
  | 'EXCESSIVE_ROLL_ANGLE'      // 横摇角过大
  | 'COLLISION_RISK'            // 碰撞风险
  | 'ENVIRONMENTAL_HAZARD'      // 环境危害
  | 'SAFETY_VIOLATION'          // 安全违规
  | 'CORAL_REEF_ZONE'           // 珊瑚礁保护区
  | 'TURBIDITY_EXCEEDED'        // 泥浆浊度超标
  | 'SLOSHING_EXCEEDED'         // 液货晃荡过大
  | 'TANK_PRESSURE_EXCEEDED'    // 货舱压力超限
  | 'LNG_LEAK_RISK'             // LNG 泄漏风险
  | 'CARGO_SHIFT_RISK'          // 货物移位风险
  | 'WIND_SPEED_EXCEEDED'       // 风速超限
  | 'COMFORT_VIOLATION'         // 舒适度违规 (邮轮)
  | 'FIN_ENERGY_EXCEEDED'       // 减摇鳍能耗超限 (邮轮)
  // 钻井平台违规类型
  | 'YELLOW_ALERT_POSITION'     // 黄色警报-位置偏差 (钻井平台)
  | 'RED_ALERT_POSITION'        // 红色警报-必须解脱 (钻井平台)
  | 'EMERGENCY_DISCONNECT'      // 紧急自动解脱 (钻井平台)
  | 'THRUSTER_POWER_EXCEEDED'   // 单台推进器过载 (钻井平台)
  | 'TOTAL_POWER_EXCEEDED'      // 总功率超限 (钻井平台)
  | 'AZIMUTH_RATE_EXCEEDED'     // 方位角变化过快 (钻井平台)
  | 'HEADING_DEVIATION'         // 航向偏差过大 (钻井平台)
  | 'THRUSTER_FORBIDDEN_ZONE'   // 推进器禁止区域 (钻井平台)
  // 破冰船违规类型
  | 'AZIPOD_SLEW_RATE_EXCEEDED' // Azipod回转速率超限 (破冰船)
  | 'AZIPOD_SLEW_RATE_WARNING'  // Azipod回转速率警告 (破冰船)
  | 'WILDLIFE_DISTANCE_VIOLATION' // 野生动物距离违规 (破冰船)
  | 'ICE_THICKNESS_EXCEEDED'    // 冰层厚度超限 (破冰船)
  | 'ICE_THICKNESS_WARNING'     // 冰层厚度警告 (破冰船)
  | 'PROPELLER_STRESS_EXCEEDED' // 螺旋桨应力超限 (破冰船)
  | 'PROPELLER_STRESS_WARNING'; // 螺旋桨应力警告 (破冰船)

/** 伦理违规信息 */
export interface EthicalViolation {
  type: ViolationType;
  thresholdValue: number;
  actualValue: number;
  timestamp: number;
  description: string;
  severity: 'warning' | 'critical';
}

/** 伦理上下文配置 */
export interface EthicalContext {
  dilemma: string;
  rules: string[];
  thresholds: Partial<Record<ViolationType, number>>;  // Partial: 不同船型只需定义相关阈值
  protectedZones?: ProtectedZone[];
}

/** 保护区域 */
export interface ProtectedZone {
  id: string;
  name: string;
  type: 'coral_reef' | 'wildlife' | 'restricted';
  boundary: Vector2[];
}

// ============ 仿真配置 ============

/** 仿真配置 */
export interface SimulationConfig {
  // 控制配置
  controlMode: ControlMode;
  pid?: PIDGains;
  dp?: DPGains;

  // 环境配置
  seaState?: Partial<SeaStateConfig>;

  // 物理模型配置
  physicsModel?: PhysicsModelType;
  nomoto?: Partial<NomotoParams>;
  mmg?: Partial<MMG3DOFParams>;

  // 仿真参数
  duration?: number;          // 仿真时长 (s)
  timeScale?: number;         // 时间缩放
  dt?: number;                // 积分步长 (s)
}

/** 场景逻辑定义 */
export interface ScenarioLogic {
  getDesiredHeading: (t: number) => number;
  getDesiredPosition?: (t: number) => Vector2;
  startPos: { x: number; z: number; headingDeg: number };
}

// ============ 回调接口 ============

/** 仿真回调 */
export interface SimulationCallbacks {
  onStep?: (state: SimulationState, metrics: SimulationMetrics) => void;
  onComplete?: (finalMetrics: SimulationMetrics, trajectory: TrajectoryPoint[]) => void;
  onViolation?: (violation: EthicalViolation) => void;
  onTargetChange?: (target: { heading?: number; position?: Vector2 }) => void;
}

// ============ 仿真结果 ============

/** 仿真结果 */
export interface SimulationResult {
  metrics: SimulationMetrics;
  trajectory: TrajectoryPoint[];
  chartData: ChartData;
  duration: number;
  success: boolean;
  violations: EthicalViolation[];
}

/** 快速仿真结果 */
export interface QuickSimulationResult {
  data: ChartData;
  desiredPath: Vector2[];
  actualPath: Vector2[];
  metrics: SimulationMetrics;
  duration: number;
}

// ============ Hook 返回类型 ============

/** useSimulation Hook 返回类型 */
export interface UseSimulationReturn {
  // 状态
  state: SimulationState;
  metrics: SimulationMetrics;
  trajectory: TrajectoryPoint[];
  chartData: ChartData;
  target: { heading: number; position?: Vector2 };
  violations: EthicalViolation[];

  // 控制
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setManualRudder: (rudder: number) => void;
  setManualSpeed: (speed: number) => void;
  setTargetPosition?: (position: Vector2) => void;

  // 配置
  updateConfig: (config: Partial<SimulationConfig>) => void;
  setScenario: (scenario: ScenarioLogic, duration: number, guidePath?: Vector2[]) => void;
}

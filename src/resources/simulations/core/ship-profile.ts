/**
 * 船舶配置接口定义
 * 定义船舶的物理特性、控制要求和仿真配置
 */

import type {
  PhysicsModelType,
  NomotoParams,
  MMG3DOFParams,
  PIDGains,
  DPGains,
  ControlMode,
  SeaStateConfig,
  EthicalContext,
  Vector2,
  Vector3,
  VariableMassNomotoParams,
  GainScheduleConfig,
} from './types';

// ============ 船舶类型 ============

/** 船舶分类 */
export type ShipCategory = 'flagship' | 'fleet' | 'atomic';

/** 船舶ID类型 */
export type ShipId =
  | 'destroyer-055'           // 旗舰: 055驱逐舰
  | 'fleet-dredger-tianjing'  // 舰队: 天鲸号挖泥船
  | 'fleet-lng-changheng'     // 舰队: 长恒系列LNG船
  | 'fleet-container-msc'     // 舰队: MSC集装箱船
  | 'fleet-cruise-adora'      // 舰队: 爱达·魔都号邮轮
  | 'fleet-drill-hysy981'     // 舰队: 海洋石油981平台
  | 'fleet-icebreaker-xuelong2' // 舰队: 雪龙2号破冰船
  | 'atom-radar-stabilizer'   // 原子: 雷达稳定平台
  | 'atom-antiroll-tank'      // 原子: 减摇水舱
  | 'atom-propulsion-filter'; // 原子: 推进滤波回路

// ============ 船舶尺度 ============

/** 船舶尺度配置 */
export interface ShipDimensions {
  length: number;           // 船长 (m)
  beam: number;             // 船宽 (m)
  draft: number;            // 吃水 (m)
  displacement: number;     // 排水量 (t)
  blockCoefficient?: number; // 方形系数
}

// ============ 动力学配置 ============

/** 扰动模式 */
export type DisturbancePattern =
  | 'normal'                // 正常海况
  | 'step_impulse_mixed'    // 阶跃+脉冲混合 (挖泥船)
  | 'random_walk'           // 随机游走 (钻井平台)
  | 'periodic'              // 周期性 (液货晃荡)
  | 'wind'                  // 风载荷 (集装箱船)
  | 'coupled_3dof';         // 3DOF耦合 (半潜平台)

/** 动力学修正配置 */
export interface DynamicsModifications {
  massMultiplier?: number;        // 质量倍数 (相对于基准)
  timeDelay?: number;             // 纯滞后时间 (s)
  variableMass?: boolean;         // 变质量模式
  sloshingEffect?: boolean;       // 液货晃荡效应
  windLoadEffect?: boolean;       // 风载荷效应 (集装箱船)
  rollDynamics?: boolean;         // 横摇动力学 (集装箱船)
  finStabilizer?: boolean;        // 减摇鳍
  disturbancePattern?: DisturbancePattern;
  windAreaMultiplier?: number;    // 受风面积倍数
}

/** 动力学配置 */
export interface DynamicsConfig {
  modelType: PhysicsModelType;

  // Nomoto 模型参数 (适用于 Nomoto1stOrder, Nomoto2ndOrder)
  nomoto?: NomotoParams;

  // 变质量 Nomoto 参数 (适用于 NomotoVariableMass)
  variableMassParams?: VariableMassNomotoParams;

  // MMG 模型参数 (适用于 MMG3DOF)
  mmg?: MMG3DOFParams;

  // 修正参数
  modifications: DynamicsModifications;

  // 速度限制
  speed: {
    min: number;
    max: number;
    cruise: number;
  };

  // 舵角限制
  rudder: {
    maxAngle: number;       // 最大舵角 (°)
    maxRate: number;        // 最大舵速 (°/s)
  };
}

// ============ 控制配置 ============

/** 控制目标配置 */
export interface ControlTargets {
  positionTolerance?: number;   // 定位精度 (m)
  headingTolerance?: number;    // 航向精度 (°)
  settlingTime?: number;        // 期望调节时间 (s)
  overshootMax?: number;        // 最大超调 (%)
}

/** 控制要求配置 */
export interface ControlRequirements {
  highGainIntegrator?: boolean;     // 高增益积分器
  feedforwardDisturbance?: boolean; // 前馈扰动补偿
  adaptiveGain?: boolean;           // 自适应增益
  antiWindup?: boolean;             // 抗积分饱和
  gainScheduling?: boolean;         // 增益调度 (集装箱船)
}

/** 控制配置 */
export interface ControlConfig {
  defaultMode: ControlMode;
  supportedModes: ControlMode[];
  targets: ControlTargets;
  requirements: ControlRequirements;

  // 默认增益
  defaultPID?: PIDGains;
  defaultDP?: DPGains;

  // 增益调度配置 (集装箱船等变参数系统)
  gainSchedule?: GainScheduleConfig;
}

// ============ 视觉配置 ============

/** 视觉资源配置 */
export interface VisualConfig {
  modelPath: string;            // 3D模型路径
  modelForward: Vector3;        // 模型前向轴
  modelScale?: number;          // 模型缩放
  trailColor?: string;          // 航迹颜色
  wakeIntensity?: number;       // 尾迹强度
}

// ============ 任务场景 ============

/** 扰动配置 */
export interface ScenarioDisturbance {
  current?: {
    speed: number;
    direction: number;
  };
  wind?: {
    speed: number;
    direction: number;
  };
  dredgingImpacts?: {
    pattern: DisturbancePattern;
    maxForce: number;
    interval: [number, number];
  };
  thrusterFailures?: Array<{
    thrusterId: number;
    failureTime: number;
    type: 'complete' | 'partial' | 'stuck';
  }>;
}

/** 场景初始条件 */
export interface ScenarioInitialConditions {
  loadRatio?: number;              // 装载率 [0, 1] (集装箱船)
  loadRatioVariation?: boolean;    // 装载率是否会变化
  speedMps?: number;               // 初始航速 (m/s)
  gustEnabled?: boolean;           // 启用阵风
  sloshingEnabled?: boolean;       // 启用液货晃荡 (LNG船)
}

/** 场景定义 */
export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  type: 'heading_control' | 'position_keeping' | 'path_following';
  duration: number;
  startPosition: { x: number; z: number; headingDeg: number };
  targets?: {
    heading?: number | ((t: number) => number);
    position?: Vector2 | ((t: number) => Vector2);
    path?: Vector2[];
  };
  seaState?: Partial<SeaStateConfig>;
  disturbances?: ScenarioDisturbance;
  initialConditions?: ScenarioInitialConditions;
  successCriteria?: {
    maxError?: number;
    maxPositionError?: number;
    maxSettlingTime?: number;
    maxRollAngle?: number;         // 横摇角限制 (集装箱船)
  };
  teachingFocus?: {
    topic: string;
    description: string;
    visualization?: boolean;
    metrics?: string[];
    comparison?: {
      modeA: { decouplingEnabled: boolean; label: string };
      modeB: { decouplingEnabled: boolean; label: string };
    };
  };
}

// ============ 船舶配置接口 ============

/** 完整船舶配置 */
export interface ShipProfile {
  // 基本信息
  id: ShipId;
  name: string;
  nameEn?: string;
  type: ShipCategory;
  description?: string;

  // 物理尺度
  dimensions: ShipDimensions;

  // 动力学配置
  dynamics: DynamicsConfig;

  // 控制配置
  control: ControlConfig;

  // 视觉配置
  visual: VisualConfig;

  // 预设场景
  scenarios: ScenarioDefinition[];

  // 伦理上下文
  ethics?: EthicalContext;

  // 教学映射
  teachingContext?: {
    chapter: string[];          // 关联章节
    knowledgePoints: string[];  // 知识点
    challenges: string[];       // 挑战描述
  };
}

// ============ 配置验证 ============

/** 验证船舶配置完整性 */
export function validateShipProfile(profile: ShipProfile): string[] {
  const errors: string[] = [];

  // 基本信息验证
  if (!profile.id) errors.push('Missing ship ID');
  if (!profile.name) errors.push('Missing ship name');

  // 尺度验证
  if (profile.dimensions.length <= 0) errors.push('Invalid ship length');
  if (profile.dimensions.beam <= 0) errors.push('Invalid ship beam');
  if (profile.dimensions.displacement <= 0) errors.push('Invalid displacement');

  // 动力学验证
  if (!profile.dynamics.modelType) errors.push('Missing physics model type');

  if (profile.dynamics.modelType === 'Nomoto1stOrder' || profile.dynamics.modelType === 'Nomoto2ndOrder') {
    if (!profile.dynamics.nomoto) {
      errors.push('Nomoto model requires nomoto parameters');
    }
  }

  if (profile.dynamics.modelType === 'MMG3DOF') {
    if (!profile.dynamics.mmg) {
      errors.push('MMG3DOF model requires mmg parameters');
    }
  }

  // 控制验证
  if (!profile.control.defaultMode) errors.push('Missing default control mode');
  if (!profile.control.supportedModes?.length) errors.push('No supported control modes');

  // 视觉验证
  if (!profile.visual.modelPath) errors.push('Missing 3D model path');

  return errors;
}

// ============ 配置工厂 ============

/** 创建默认动力学修正 */
export function createDefaultModifications(): DynamicsModifications {
  return {
    massMultiplier: 1.0,
    disturbancePattern: 'normal',
  };
}

/** 创建默认控制配置 */
export function createDefaultControlConfig(): ControlConfig {
  return {
    defaultMode: 'pid',
    supportedModes: ['manual', 'p', 'pd', 'pid'],
    targets: {
      headingTolerance: 1.0,
      settlingTime: 60,
      overshootMax: 10,
    },
    requirements: {
      antiWindup: true,
    },
    defaultPID: {
      kp: 1.4,
      ki: 0.02,
      kd: 0.7,
    },
  };
}

/** 合并船舶配置 */
export function mergeShipProfile(
  base: ShipProfile,
  overrides: Partial<ShipProfile>
): ShipProfile {
  return {
    ...base,
    ...overrides,
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    dynamics: {
      ...base.dynamics,
      ...overrides.dynamics,
      modifications: {
        ...base.dynamics.modifications,
        ...overrides.dynamics?.modifications,
      },
      speed: { ...base.dynamics.speed, ...overrides.dynamics?.speed },
      rudder: { ...base.dynamics.rudder, ...overrides.dynamics?.rudder },
    },
    control: {
      ...base.control,
      ...overrides.control,
      targets: { ...base.control.targets, ...overrides.control?.targets },
      requirements: { ...base.control.requirements, ...overrides.control?.requirements },
    },
    visual: { ...base.visual, ...overrides.visual },
    scenarios: overrides.scenarios ?? base.scenarios,
    ethics: overrides.ethics ?? base.ethics,
  };
}

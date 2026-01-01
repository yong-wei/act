/**
 * MSC Tessa 超大型集装箱船配置
 * 舰队模型 - 变质量参数、风载荷
 *
 * 工程特性：参数剧烈漂移 (满载vs空载 3倍差异) + 大受风面积
 * 控制难点：同一套PID参数无法兼顾空载与满载工况
 * 知识点映射：根轨迹参数扫描 (Ch4)，鲁棒性 (Ch6)，增益调度
 */

import type { ShipProfile } from '../core/ship-profile';
import {
  CONTAINER_MSC_PARAMS,
  CONTAINER_DEFAULT_PID,
  CONTAINER_GAIN_SCHEDULE,
  CONTAINER_ETHICAL_THRESHOLDS,
} from '../core/constants';

export const containerMscProfile: ShipProfile = {
  // 基本信息
  id: 'fleet-container-msc',
  name: 'MSC Tessa 集装箱船',
  nameEn: 'MSC Tessa Container Ship',
  type: 'fleet',
  description:
    '地中海航运 (MSC) 旗下超大型集装箱船，满载排水量24万吨，可装载24116标箱。' +
    '空载与满载时惯性相差3倍，需要增益调度控制策略。强侧风时受风面积巨大。',

  // 物理尺度
  dimensions: {
    length: CONTAINER_MSC_PARAMS.LENGTH,           // 399.9m
    beam: CONTAINER_MSC_PARAMS.BEAM,               // 61.5m
    draft: CONTAINER_MSC_PARAMS.DRAFT_FULL,        // 16.5m (满载)
    displacement: CONTAINER_MSC_PARAMS.DISPLACEMENT_FULL,  // 240000t
    blockCoefficient: 0.72,
  },

  // 动力学配置 - 使用变质量 Nomoto 一阶模型
  dynamics: {
    modelType: 'NomotoVariableMass',

    // Nomoto 变参数 (随装载率变化)
    nomoto: {
      K: CONTAINER_MSC_PARAMS.K_FULL,              // 满载基准 0.04
      T: CONTAINER_MSC_PARAMS.T_FULL,              // 满载基准 120s
      T1: CONTAINER_MSC_PARAMS.T_FULL,
      T2: undefined,
      T3: undefined,
      maxRudderDeg: CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,  // 10.3 m/s
    },

    modifications: {
      massMultiplier: 18.5,          // 相对于驱逐舰质量的倍数 (240000/13000)
      variableMass: true,            // 启用变质量模型
      windLoadEffect: true,          // 启用风载荷
      rollDynamics: true,            // 启用横摇动力学
      disturbancePattern: 'wind',    // 风扰动模式
    },

    // 变质量参数范围
    variableMassParams: {
      K_full: CONTAINER_MSC_PARAMS.K_FULL,      // 0.04 (迟钝)
      K_empty: CONTAINER_MSC_PARAMS.K_EMPTY,    // 0.12 (灵敏)
      T_full: CONTAINER_MSC_PARAMS.T_FULL,      // 120s
      T_empty: CONTAINER_MSC_PARAMS.T_EMPTY,    // 40s
      maxRudderDeg: CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,
      speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
    },

    speed: {
      min: 0,
      max: CONTAINER_MSC_PARAMS.MAX_SPEED,       // 12.4 m/s
      cruise: CONTAINER_MSC_PARAMS.CRUISE_SPEED, // 10.3 m/s
    },

    rudder: {
      maxAngle: CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      maxRate: CONTAINER_MSC_PARAMS.MAX_RUDDER_RATE,    // 2.5°/s
    },
  },

  // 控制配置
  control: {
    defaultMode: 'pid_scheduled',
    supportedModes: ['manual', 'p', 'pd', 'pid', 'pid_scheduled', 'autopilot'],

    targets: {
      headingTolerance: 1.5,    // 航向精度 1.5°
      settlingTime: 120,        // 调节时间 120s
      overshootMax: 10,         // 最大超调 10%
    },

    requirements: {
      highGainIntegrator: false,
      feedforwardDisturbance: true,     // 风干扰前馈
      antiWindup: true,
      adaptiveGain: true,               // 增益调度
      gainScheduling: true,             // 启用增益调度
    },

    defaultPID: CONTAINER_DEFAULT_PID,

    // 增益调度配置
    gainSchedule: CONTAINER_GAIN_SCHEDULE,
  },

  // 视觉配置
  visual: {
    modelPath: '/assets/container.glb',
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#f97316',  // 橙色
    wakeIntensity: 0.9,
  },

  // 预设场景
  scenarios: [
    {
      id: 'full-load-straight',
      title: '满载远洋直航',
      description: '满载24万吨航行，体会大惯性系统的缓慢响应',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 12,
        windDirection: 45,
      },
      initialConditions: {
        loadRatio: 1.0,          // 满载
      },
      successCriteria: {
        maxError: 3,
        maxSettlingTime: 90,
      },
    },
    {
      id: 'empty-ballast',
      title: '空载压载航行',
      description: '空载8万吨时系统更灵敏，观察同样PID参数可能导致的超调',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -3000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => t < 60 ? 0 : 20,
      },
      seaState: {
        level: 2,
        waveHeight: 1.0,
        windSpeed: 8,
        windDirection: 90,
      },
      initialConditions: {
        loadRatio: 0.1,          // 接近空载
      },
      successCriteria: {
        maxError: 5,
        maxSettlingTime: 60,
      },
    },
    {
      id: 'crosswind-challenge',
      title: '强侧风偏航',
      description: '满载时受风面积巨大，抵抗15m/s侧风干扰',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -5000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 4,
        waveHeight: 2.5,
        windSpeed: 15,
        windDirection: 90,          // 正横风
      },
      initialConditions: {
        loadRatio: 0.8,
        gustEnabled: true,          // 开启阵风
      },
      successCriteria: {
        maxError: 5,
      },
    },
    {
      id: 'gain-schedule-compare',
      title: '增益调度对比',
      description: '在不同装载率下对比固定PID与增益调度PID的性能差异',
      type: 'heading_control',
      duration: 900,
      startPosition: { x: -6000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          if (t < 120) return 0;
          if (t < 240) return 30;
          if (t < 360) return 0;
          if (t < 480) return -30;
          if (t < 600) return 0;
          if (t < 720) return 20;
          return 0;
        },
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 10,
        windDirection: 45,
      },
      initialConditions: {
        loadRatio: 0.5,            // 中等装载
        loadRatioVariation: true,  // 装载率会变化 (模拟卸货)
      },
      successCriteria: {
        maxError: 8,
      },
    },
    {
      id: 'roll-safety-test',
      title: '横摇安全测试',
      description: '急转弯时监测横摇角，防止落箱事故',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          if (t < 60) return 0;
          if (t < 120) return 45;    // 大角度转向
          if (t < 180) return 45;
          if (t < 240) return 0;
          if (t < 300) return -45;
          return 0;
        },
      },
      seaState: {
        level: 4,
        waveHeight: 2.0,
        windSpeed: 12,
        windDirection: 60,
      },
      initialConditions: {
        loadRatio: 0.9,            // 接近满载
      },
      successCriteria: {
        maxRollAngle: 10,          // 横摇不超过10°
      },
    },
    {
      id: 'port-approach',
      title: '港口进港航行',
      description: '低速进港，多次航向修正，考验控制精度',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -2000, z: -500, headingDeg: 15 },
      targets: {
        heading: (t: number) => {
          if (t < 60) return 15;
          if (t < 150) return 0;
          if (t < 240) return -10;
          if (t < 330) return 0;
          if (t < 420) return 5;
          return 0;
        },
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 6,
        windDirection: 30,
      },
      initialConditions: {
        loadRatio: 0.7,
        speedMps: 5.0,             // 低速进港
      },
      successCriteria: {
        maxError: 2,
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '准点率 vs 货物安全',
    rules: [
      '侧倾角超过10度有丢箱风险，需强制减速或减舵',
      '强风条件 (>20m/s) 下禁止急转弯',
      '空载航行时舵角变化率需限制，防止过度响应',
      '横摇角超过8°时货物可能移位，需发出警告',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: CONTAINER_ETHICAL_THRESHOLDS.MAX_RUDDER_RATE,     // 2.5°/s
      EXCESSIVE_ROLL_ANGLE: CONTAINER_ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE,       // 10°
      CARGO_SHIFT_RISK: CONTAINER_ETHICAL_THRESHOLDS.CARGO_SHIFT_ROLL,         // 8°
      COLLISION_RISK: CONTAINER_ETHICAL_THRESHOLDS.MIN_COLLISION_DISTANCE,     // 500m
      WIND_SPEED_EXCEEDED: CONTAINER_ETHICAL_THRESHOLDS.MAX_WIND_SPEED,        // 20m/s
      ENVIRONMENTAL_HAZARD: 0,
      SAFETY_VIOLATION: 1,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
    },
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch4 根轨迹法', 'Ch6 鲁棒性与灵敏度', 'Ch3 系统特性'],
    knowledgePoints: [
      '参数变化对系统响应的影响',
      '根轨迹参数扫描',
      '增益调度控制策略',
      '鲁棒性与灵敏度权衡',
      '风扰动的前馈补偿',
      '一阶系统时间常数的物理意义',
    ],
    challenges: [
      '设计能适应3倍参数变化的控制器',
      '克服大受风面积带来的扰动',
      '实现平滑的增益切换',
      '防止横摇过大导致落箱',
    ],
  },
};

/**
 * 获取集装箱船仿真的默认配置
 */
export function getContainerDefaultConfig() {
  return {
    controlMode: 'pid_scheduled' as const,
    targetHeading: 0,
    loadRatio: 0.5,                  // 默认半载
    seaState: {
      level: 3 as const,
      waveHeight: 1.5,
      wavePeriod: 10,
      waveDirection: 0,
      windSpeed: 10,
      windDirection: 45,
      currentSpeed: 0.3,
      currentDirection: 90,
    },
    windLoadEnabled: true,
    gainSchedulingEnabled: true,
    rollMonitoringEnabled: true,
  };
}

/**
 * 获取变质量参数
 */
export function getContainerVariableMassParams() {
  return {
    K_full: CONTAINER_MSC_PARAMS.K_FULL,
    K_empty: CONTAINER_MSC_PARAMS.K_EMPTY,
    T_full: CONTAINER_MSC_PARAMS.T_FULL,
    T_empty: CONTAINER_MSC_PARAMS.T_EMPTY,
    maxRudderDeg: CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,
    speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
  };
}

/**
 * 获取风载荷参数
 */
export function getContainerWindLoadParams() {
  return {
    airDensity: 1.225,
    hullArea: CONTAINER_MSC_PARAMS.WIND_AREA_HULL,
    cargoArea: CONTAINER_MSC_PARAMS.WIND_AREA_CARGO,
    windCoeff: CONTAINER_MSC_PARAMS.WIND_COEFF,
    armRatio: CONTAINER_MSC_PARAMS.WIND_ARM_RATIO,
    shipLength: CONTAINER_MSC_PARAMS.LENGTH,
  };
}

/**
 * 获取增益调度配置
 */
export function getContainerGainSchedule() {
  return {
    empty: { ...CONTAINER_GAIN_SCHEDULE.empty },
    full: { ...CONTAINER_GAIN_SCHEDULE.full },
  };
}

/**
 * 根据装载率获取系统参数描述
 */
export function getLoadRatioDescription(loadRatio: number): {
  label: string;
  K: number;
  T: number;
  description: string;
} {
  const K = CONTAINER_MSC_PARAMS.K_EMPTY +
    (CONTAINER_MSC_PARAMS.K_FULL - CONTAINER_MSC_PARAMS.K_EMPTY) * loadRatio;
  const T = CONTAINER_MSC_PARAMS.T_EMPTY +
    (CONTAINER_MSC_PARAMS.T_FULL - CONTAINER_MSC_PARAMS.T_EMPTY) * loadRatio;

  let label: string;
  let description: string;

  if (loadRatio < 0.2) {
    label = '空载';
    description = '系统灵敏，响应快但容易过调';
  } else if (loadRatio < 0.4) {
    label = '轻载';
    description = '响应较快，需适当降低增益';
  } else if (loadRatio < 0.6) {
    label = '半载';
    description = '中等响应特性';
  } else if (loadRatio < 0.8) {
    label = '重载';
    description = '响应变慢，需增加增益';
  } else {
    label = '满载';
    description = '系统迟钝，大惯性缓慢响应';
  }

  return { label, K, T, description };
}

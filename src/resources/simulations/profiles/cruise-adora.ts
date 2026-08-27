/**
 * 爱达·魔都号豪华邮轮配置
 * 舰队模型 - 舒适度优先、减摇控制
 *
 * 工程特性：频域舒适度要求、减摇鳍主动控制
 * 控制难点：抑制致晕频段 (0.1-0.3Hz)，平衡舒适度与能耗
 * 知识点映射：频率特性 (Ch5)，陷波滤波器 (Ch6)，Bode图分析
 *
 * 爱达·魔都号 (Adora Magic City) 是中国首艘国产大型邮轮
 * 2023年下水，总吨位 135,500 GT，可载客 5,246 人
 */

import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { ShipProfile } from '../core/ship-profile';
import {
  CRUISE_ADORA_PARAMS,
  CRUISE_DEFAULT_PID,
  CRUISE_ETHICAL_THRESHOLDS,
  CRUISE_COMFORT_THRESHOLDS,
} from '../core/constants';

export const cruiseAdoraProfile: ShipProfile = {
  // 基本信息
  id: 'fleet-cruise-adora',
  name: '爱达·魔都号',
  nameEn: 'Adora Magic City Cruise',
  type: 'fleet',
  description:
    '中国首艘国产大型豪华邮轮，总吨位 135,500 GT，载客 5,246 人。' +
    '控制系统强调乘客舒适度，需要抑制致晕频段 (0.1-0.3 Hz)，配备主动减摇鳍系统。',

  // 物理尺度
  dimensions: {
    length: CRUISE_ADORA_PARAMS.LENGTH,     // 323.6m
    beam: CRUISE_ADORA_PARAMS.BEAM,         // 37.2m
    draft: CRUISE_ADORA_PARAMS.DRAFT,       // 8.5m
    displacement: CRUISE_ADORA_PARAMS.DISPLACEMENT,  // 135500 GT
    blockCoefficient: 0.65,
  },

  // 动力学配置 - 使用横摇耦合 Nomoto 二阶模型
  dynamics: {
    modelType: 'Nomoto2ndOrder',

    // Nomoto 二阶参数 (航向动力学)
    nomoto: {
      K: CRUISE_ADORA_PARAMS.K,               // 0.05
      T: CRUISE_ADORA_PARAMS.T1,              // 90s (主时间常数)
      T1: CRUISE_ADORA_PARAMS.T1,             // 90s
      T2: CRUISE_ADORA_PARAMS.T2,             // 25s
      T3: undefined,
      maxRudderDeg: CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED,  // 9.3 m/s
    },

    modifications: {
      massMultiplier: 10.4,  // 相对于驱逐舰质量的倍数
      rollDynamics: true,    // 启用横摇动力学
      finStabilizer: true,   // 启用减摇鳍
      disturbancePattern: 'normal',
    },

    speed: {
      min: 0,
      max: CRUISE_ADORA_PARAMS.MAX_SPEED,      // 11.3 m/s (~22节)
      cruise: CRUISE_ADORA_PARAMS.CRUISE_SPEED,  // 9.3 m/s (~18节)
    },

    rudder: {
      maxAngle: CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      maxRate: CRUISE_ADORA_PARAMS.MAX_RUDDER_RATE,    // 2.5°/s
    },
  },

  // 控制配置
  control: {
    defaultMode: 'pid',
    supportedModes: ['manual', 'p', 'pd', 'pid', 'autopilot'],

    targets: {
      headingTolerance: 1.5,    // 航向精度 1.5° (舒适优先)
      settlingTime: 120,        // 调节时间 120s (避免急转)
      overshootMax: 8,          // 最大超调 8% (减少晃动)
    },

    requirements: {
      highGainIntegrator: false,      // 低增益积分 (平滑响应)
      feedforwardDisturbance: false,
      antiWindup: true,
      adaptiveGain: false,
    },

    defaultPID: CRUISE_DEFAULT_PID,
  },

  // 视觉配置
  visual: {
    modelPath: resolveRegisteredSimulationModel('luxury-liner').originalUrl,
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#8b5cf6',  // 紫色 (豪华感)
    wakeIntensity: 0.6,
  },

  // 预设场景
  scenarios: [
    {
      id: 'calm-cruise',
      title: '平静海域巡航',
      description: '在 2 级海况下体验邮轮的基准舒适度，感受稳定航行的乐趣',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -3000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 5,
      },
      initialConditions: {
        speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
      },
      successCriteria: {
        maxError: 3,
        maxRollAngle: CRUISE_COMFORT_THRESHOLDS.EXCELLENT_ROLL,  // 1°
      },
    },
    {
      id: 'roll-suppression',
      title: '五级海况横摇抑制',
      description: '在恶劣海况下启用减摇鳍，将横摇角控制在 2° 以内',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -5000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 5,
        waveHeight: 3.5,
        windSpeed: 18,
      },
      initialConditions: {
        speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED * 0.8,  // 降速 20%
      },
      successCriteria: {
        maxError: 5,
        maxRollAngle: CRUISE_COMFORT_THRESHOLDS.GOOD_ROLL,  // 2°
      },
    },
    {
      id: 'notch-filter-compare',
      title: '陷波滤波器对比实验',
      description: '对比有/无陷波滤波器时的横摇响应，理解频率选择性抑制原理',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          // 小幅航向变化以观察横摇响应
          if (t < 60) return 0;
          if (t < 180) return 5;
          if (t < 300) return 0;
          if (t < 420) return -5;
          return 0;
        },
      },
      seaState: {
        level: 4,
        waveHeight: 2.5,
        windSpeed: 12,
      },
      successCriteria: {
        maxError: 4,
        maxRollAngle: CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL,  // 4°
      },
    },
    {
      id: 'energy-optimization',
      title: '减摇能耗优化',
      description: '探索减摇鳍功率与舒适度的权衡，实现经济性航行',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 4,
        waveHeight: 2.0,
        windSpeed: 10,
      },
      initialConditions: {
        speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
      },
      successCriteria: {
        maxError: 4,
        maxRollAngle: CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL,  // 4°
      },
    },
    {
      id: 'bode-analysis',
      title: 'Bode 图分析实验',
      description: '通过频率扫描测试，绘制系统 Bode 图，分析频率响应特性',
      type: 'heading_control',
      duration: 480,
      startPosition: { x: -3000, z: 0, headingDeg: 0 },
      targets: {
        // 正弦扫频输入
        heading: (t: number) => {
          // 从 0.05Hz 到 0.5Hz 线性扫频
          const fStart = 0.05;
          const fEnd = 0.5;
          const f = fStart + (fEnd - fStart) * (t / 480);
          const omega = 2 * Math.PI * f;
          return 10 * Math.sin(omega * t);  // 10° 振幅
        },
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 8,
      },
      successCriteria: {
        maxRollAngle: CRUISE_COMFORT_THRESHOLDS.GOOD_ROLL,  // 2°
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '减摇能耗 vs 乘客舒适度',
    rules: [
      `横摇角超过 ${CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL}° 时需降低航速或调整航向`,
      `减摇鳍功率超过 ${CRUISE_ETHICAL_THRESHOLDS.FIN_ENERGY_EXCEEDED} kW 时需权衡舒适与经济`,
      `晕船率超过 ${CRUISE_COMFORT_THRESHOLDS.MODERATE_MSI}% 时强制启动所有减摇措施`,
      '急转弯时横摇角不得超过 6°',
      '乘客安全优先于航行时刻表',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_RUDDER_RATE,
      EXCESSIVE_ROLL_ANGLE: CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_ROLL_ANGLE,
      COLLISION_RISK: 1000,
      ENVIRONMENTAL_HAZARD: 1,
      SAFETY_VIOLATION: 1,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
      COMFORT_VIOLATION: CRUISE_ETHICAL_THRESHOLDS.COMFORT_VIOLATION,
      FIN_ENERGY_EXCEEDED: CRUISE_ETHICAL_THRESHOLDS.FIN_ENERGY_EXCEEDED,
    },
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch5 频率响应分析', 'Ch6 陷波滤波器设计', 'Ch3 时域响应'],
    knowledgePoints: [
      '频率响应与 Bode 图',
      '陷波滤波器原理与设计',
      '致晕频段的物理意义',
      '二阶系统的谐振特性',
      '减摇鳍的 PD 控制',
      'ISO 2631-1 人体振动暴露标准',
    ],
    challenges: [
      '设计陷波滤波器抑制 0.1-0.3 Hz 致晕频段',
      '平衡减摇效果与能耗',
      '理解频率响应对舒适度的影响',
      '通过 Bode 图分析系统特性',
    ],
  },
};

/**
 * 获取邮轮仿真的默认配置
 */
export function getCruiseDefaultConfig() {
  return {
    controlMode: 'pid' as const,
    targetHeading: 0,
    seaState: {
      level: 3 as const,
      waveHeight: 1.5,
      wavePeriod: 8,
      waveDirection: 90,  // 横浪 (最易引起横摇)
      windSpeed: 10,
      windDirection: 90,
      currentSpeed: 0.5,
      currentDirection: 180,
    },
    finStabilizerEnabled: true,
    notchFilterEnabled: true,
    showBodePlot: false,
  };
}

/**
 * 获取横摇动力学参数
 */
export function getCruiseRollParams() {
  return {
    K_phi: CRUISE_ADORA_PARAMS.K_PHI,
    T_phi1: CRUISE_ADORA_PARAMS.T_PHI1,
    T_phi2: CRUISE_ADORA_PARAMS.T_PHI2,
    naturalRollPeriod: CRUISE_ADORA_PARAMS.NATURAL_ROLL_PERIOD,
    rollDamping: CRUISE_ADORA_PARAMS.ROLL_DAMPING,
  };
}

/**
 * 获取舒适度阈值
 */
export function getComfortThresholds() {
  return {
    excellentRoll: CRUISE_COMFORT_THRESHOLDS.EXCELLENT_ROLL,
    goodRoll: CRUISE_COMFORT_THRESHOLDS.GOOD_ROLL,
    moderateRoll: CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL,
    poorRoll: CRUISE_COMFORT_THRESHOLDS.POOR_ROLL,
    excellentMsi: CRUISE_COMFORT_THRESHOLDS.EXCELLENT_MSI,
    goodMsi: CRUISE_COMFORT_THRESHOLDS.GOOD_MSI,
    moderateMsi: CRUISE_COMFORT_THRESHOLDS.MODERATE_MSI,
    poorMsi: CRUISE_COMFORT_THRESHOLDS.POOR_MSI,
    motionSicknessFreqLow: CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_LOW,
    motionSicknessFreqHigh: CRUISE_COMFORT_THRESHOLDS.MOTION_SICKNESS_FREQ_HIGH,
  };
}

/**
 * 获取陷波滤波器预设
 */
export function getNotchFilterPresets() {
  return {
    // 标准致晕频段滤波
    standard: {
      centerFrequencyHz: 0.16,
      bandwidthHz: 0.15,
      depthDb: -30,
      zeroDamping: 0.1,
      poleDamping: 0.5,
    },
    // 低频增强 (针对长周期横浪)
    lowFrequency: {
      centerFrequencyHz: 0.12,
      bandwidthHz: 0.1,
      depthDb: -25,
      zeroDamping: 0.1,
      poleDamping: 0.4,
    },
    // 高频增强 (针对短周期横浪)
    highFrequency: {
      centerFrequencyHz: 0.25,
      bandwidthHz: 0.12,
      depthDb: -25,
      zeroDamping: 0.1,
      poleDamping: 0.4,
    },
    // 宽带抑制 (恶劣海况)
    wideBand: {
      centerFrequencyHz: 0.2,
      bandwidthHz: 0.2,
      depthDb: -20,
      zeroDamping: 0.15,
      poleDamping: 0.6,
    },
  };
}

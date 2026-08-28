/**
 * 长恒系列 LNG 运输船配置
 * 舰队模型 - 大纯时滞、液货晃荡
 *
 * 工程特性：大纯滞后 (25秒) + 液货晃荡
 * 控制难点：控制指令发出后船体要过几十秒才有反应
 * 知识点映射：滞后系统 (Ch5)，Smith预估器 (Ch6)，稳定裕度
 */

import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { ShipProfile } from '../core/ship-profile';
import {
  LNG_CHANGHENG_PARAMS,
  LNG_DEFAULT_PID,
  LNG_SLOSHING_PARAMS,
} from '../core/constants';

export const lngChanghengProfile: ShipProfile = {
  // 基本信息
  id: 'fleet-lng-changheng',
  name: '长恒系列 LNG 船',
  nameEn: 'Changheng Series LNG Carrier',
  type: 'fleet',
  description: '沪东中华建造的大型 LNG 运输船，具有 174,000 立方米货舱容量。控制系统需要克服25秒纯滞后和液货晃荡干扰。',

  // 物理尺度
  dimensions: {
    length: LNG_CHANGHENG_PARAMS.LENGTH,      // 295m
    beam: LNG_CHANGHENG_PARAMS.BEAM,          // 46.4m
    draft: LNG_CHANGHENG_PARAMS.DRAFT,        // 11.5m
    displacement: LNG_CHANGHENG_PARAMS.DISPLACEMENT,  // 115000t
    blockCoefficient: 0.75,
  },

  // 动力学配置 - 使用 Nomoto 二阶模型 (带时滞)
  dynamics: {
    modelType: 'Nomoto2ndOrder',

    // Nomoto 二阶参数
    nomoto: {
      K: LNG_CHANGHENG_PARAMS.K,              // 0.03
      T: LNG_CHANGHENG_PARAMS.T1,             // 80s (主时间常数)
      T1: LNG_CHANGHENG_PARAMS.T1,            // 80s
      T2: LNG_CHANGHENG_PARAMS.T2,            // 20s
      T3: undefined,
      maxRudderDeg: LNG_CHANGHENG_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      speedMps: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,  // 9.8 m/s
    },

    modifications: {
      massMultiplier: 8.8,  // 相对于驱逐舰质量的倍数 (115000/13000)
      timeDelay: LNG_CHANGHENG_PARAMS.TIME_DELAY,  // 25秒纯滞后
      sloshingEffect: true,  // 开启液货晃荡
      disturbancePattern: 'periodic',  // 周期性扰动 (晃荡)
    },

    speed: {
      min: 0,
      max: LNG_CHANGHENG_PARAMS.MAX_SPEED,     // 10.5 m/s
      cruise: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,  // 9.8 m/s
    },

    rudder: {
      maxAngle: LNG_CHANGHENG_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      maxRate: LNG_CHANGHENG_PARAMS.MAX_RUDDER_RATE,    // 2.3°/s
    },
  },

  // 控制配置
  control: {
    defaultMode: 'pid',
    supportedModes: ['manual', 'p', 'pd', 'pid', 'autopilot'],

    targets: {
      headingTolerance: 2.0,    // 航向精度 2° (时滞系统宽松)
      settlingTime: 180,        // 调节时间 180s
      overshootMax: 15,         // 最大超调 15%
    },

    requirements: {
      highGainIntegrator: false,      // 时滞系统不宜高增益
      feedforwardDisturbance: false,  // 无前馈
      antiWindup: true,               // 必须抗积分饱和
      adaptiveGain: false,
    },

    defaultPID: LNG_DEFAULT_PID,
  },

  // 视觉配置
  visual: {
    modelPath: resolveRegisteredSimulationModel('lng-carrier').originalUrl,
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#3b82f6',  // 蓝色
    wakeIntensity: 0.8,
  },

  // 预设场景
  scenarios: [
    {
      id: 'straight-lng',
      title: '远洋直航',
      description: '保持航向稳定，体会大时滞系统的响应滞后',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -3000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 10,
      },
      successCriteria: {
        maxError: 5,
        maxSettlingTime: 120,
      },
    },
    {
      id: 'turn15-delay',
      title: '航向变换 (时滞挑战)',
      description: '感受25秒纯滞后带来的相位损失，尝试提前操舵',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -5000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => t < 60 ? 0 : 15,
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 10,
      },
      successCriteria: {
        maxError: 8,
        maxSettlingTime: 180,
      },
    },
    {
      id: 'sloshing-excitation',
      title: '急转弯晃荡',
      description: '观察转向如何激发液货共振，学习减摇策略',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => t < 60 ? 0 : 30,
      },
      seaState: {
        level: 2,
        waveHeight: 1.0,
        windSpeed: 8,
      },
      successCriteria: {
        maxError: 10,
      },
    },
    {
      id: 'smith-predictor',
      title: 'Smith预估器对比',
      description: '对比普通PID与Smith预估器在时滞系统中的性能',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: -4000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          if (t < 60) return 0;
          if (t < 180) return 20;
          if (t < 300) return 0;
          if (t < 420) return -20;
          return 0;
        },
      },
      seaState: {
        level: 2,
        waveHeight: 0.8,
        windSpeed: 6,
      },
      successCriteria: {
        maxError: 8,
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '经济航速 vs 泄漏风险',
    rules: [
      '急转弯导致液货压力报警时必须熔断',
      '晃荡角度超过10°时禁止继续转向',
      'LNG泄漏浓度超过20%LEL时启动紧急程序',
      '舵角变化速率不得超过 2.3°/s，保护舵机系统',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: 2.3,        // °/s
      EXCESSIVE_ROLL_ANGLE: 8.0,         // °
      COLLISION_RISK: 500,               // m
      ENVIRONMENTAL_HAZARD: 1,
      SAFETY_VIOLATION: 1,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
      SLOSHING_EXCEEDED: 10.0,           // °
      TANK_PRESSURE_EXCEEDED: 200,       // kPa
      LNG_LEAK_RISK: 20,                 // %LEL
    },
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch5 频率响应与稳定裕度', 'Ch6 Smith预估器', 'Ch3 时域响应'],
    knowledgePoints: [
      '纯滞后系统的相位损失',
      '时滞对稳定性的影响',
      'Smith预估器原理',
      '二阶系统的阻尼与振荡',
      '液货晃荡的共振现象',
    ],
    challenges: [
      '克服25秒纯滞后带来的相位损失',
      '防止液货剧烈晃荡引发共振',
      '设计适合大时滞系统的PID参数',
      '理解并应用Smith预估器',
    ],
  },
};

/**
 * 获取 LNG 船仿真的默认配置
 */
export function getLNGDefaultConfig() {
  return {
    controlMode: 'pid' as const,
    targetHeading: 0,
    seaState: {
      level: 3 as const,
      waveHeight: 1.5,
      wavePeriod: 8,
      waveDirection: 0,
      windSpeed: 10,
      windDirection: 45,
      currentSpeed: 0.3,
      currentDirection: 90,
    },
    sloshingEnabled: true,
    smithPredictorEnabled: false,
    timeDelay: LNG_CHANGHENG_PARAMS.TIME_DELAY,
  };
}

/**
 * 获取晃荡参数
 */
export function getLNGSloshingParams() {
  return {
    naturalFreq: LNG_SLOSHING_PARAMS.NATURAL_FREQ,
    damping: LNG_SLOSHING_PARAMS.DAMPING,
    coupling: LNG_SLOSHING_PARAMS.COUPLING,
    inertia: LNG_SLOSHING_PARAMS.INERTIA,
    basePressure: LNG_SLOSHING_PARAMS.BASE_PRESSURE,
    pressureSensitivity: LNG_SLOSHING_PARAMS.PRESSURE_SENSITIVITY,
  };
}

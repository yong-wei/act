/**
 * 雪龙2号 (Xuelong 2) 极地科考破冰船配置
 * 舰队模型 - Azipod 吊舱推进 + 冰阻力摄动
 *
 * 工程特性: 双 Azipod 全回转推进，无传统舵
 * 控制难点: 冰接触时参数剧烈摄动 (K: -60%~+10%, T: -20%~+40%)
 * 知识点映射: Ch4 根轨迹鲁棒性, Ch6 非线性控制
 */

import type { ShipProfile } from '../core/ship-profile';
import {
  XUELONG_ICEBREAKER_PARAMS,
  XUELONG_AZIPOD_PARAMS,
  XUELONG_AZIPOD_LAYOUT,
  XUELONG_ICE_PARAMS,
  XUELONG_DEFAULT_GAINS,
  XUELONG_ETHICAL_THRESHOLDS,
} from '../core/constants';

// 扩展 ShipProfile 类型以支持破冰船特性
export interface IcebreakerProfile extends ShipProfile {
  azipodConfig?: {
    layout: typeof XUELONG_AZIPOD_LAYOUT;
    constraints: {
      maxSingleThrust: number;   // kN
      maxTotalPower: number;     // kW
      maxSlewRate: number;       // °/s
    };
  };
  iceBreakingConfig?: {
    maxIceThickness: number;     // m
    maxIceBreakingSpeed: number; // m/s
    stickSlipEnabled: boolean;
    parameterPerturbation: {
      kMin: number;
      kMax: number;
      tMin: number;
      tMax: number;
    };
  };
}

export const icebreakerXuelongProfile: IcebreakerProfile = {
  // 基本信息
  id: 'fleet-icebreaker-xuelong2',
  name: '雪龙2号',
  nameEn: 'Xuelong 2 (Snow Dragon 2)',
  type: 'fleet',
  description:
    '中国首艘自主建造的极地科学考察破冰船，采用双 Azipod 吊舱推进系统，具备双向破冰能力。教学重点为根轨迹鲁棒性分析和非线性控制。',

  // 物理尺度
  dimensions: {
    length: XUELONG_ICEBREAKER_PARAMS.LENGTH,         // 122.5m
    beam: XUELONG_ICEBREAKER_PARAMS.BEAM,             // 22.0m
    draft: XUELONG_ICEBREAKER_PARAMS.DRAFT,           // 7.85m
    displacement: XUELONG_ICEBREAKER_PARAMS.DISPLACEMENT, // 13990t
    blockCoefficient: XUELONG_ICEBREAKER_PARAMS.BLOCK_COEFFICIENT,
  },

  // 动力学配置 - 使用 Azipod 3DOF 模型
  dynamics: {
    modelType: 'Azipod3DOF',

    // 破冰船不使用传统 Nomoto 模型，但保留参考值用于参数摄动
    nomoto: {
      K: 0.06,                  // 基准转向增益
      T: 45,                    // 基准时间常数 (s)
      maxRudderDeg: 0,          // 无传统舵
      speedMps: XUELONG_ICEBREAKER_PARAMS.CRUISE_SPEED,
    },

    mmg: undefined,

    modifications: {
      massMultiplier: 1.0,
      disturbancePattern: 'normal',  // 开阔水域
    },

    speed: {
      min: 0,
      max: XUELONG_ICEBREAKER_PARAMS.MAX_SPEED,       // 8 m/s
      cruise: XUELONG_ICEBREAKER_PARAMS.CRUISE_SPEED, // 6 m/s
    },

    // 破冰船没有传统舵
    rudder: {
      maxAngle: 0,
      maxRate: 0,
    },
  },

  // Azipod 推进器配置
  azipodConfig: {
    layout: XUELONG_AZIPOD_LAYOUT,
    constraints: {
      maxSingleThrust: XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST, // 7500 kN
      maxTotalPower: XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST * 2, // 15000 kW
      maxSlewRate: XUELONG_AZIPOD_PARAMS.MAX_SLEW_RATE, // 12 °/s
    },
  },

  // 破冰配置
  iceBreakingConfig: {
    maxIceThickness: XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS, // 1.5m
    maxIceBreakingSpeed: XUELONG_ICEBREAKER_PARAMS.ICE_BREAKING_SPEED, // 1.5 m/s
    stickSlipEnabled: true,
    parameterPerturbation: {
      kMin: XUELONG_ICE_PARAMS.K_PERTURBATION_MIN, // 0.4 (-60%)
      kMax: XUELONG_ICE_PARAMS.K_PERTURBATION_MAX, // 1.1 (+10%)
      tMin: XUELONG_ICE_PARAMS.T_PERTURBATION_MIN, // 0.8 (-20%)
      tMax: XUELONG_ICE_PARAMS.T_PERTURBATION_MAX, // 1.4 (+40%)
    },
  },

  // 控制配置
  control: {
    defaultMode: 'pid',
    supportedModes: ['manual', 'p', 'pd', 'pid'],

    targets: {
      headingTolerance: 2.0,    // 航向精度 2°
      settlingTime: 90,         // 调节时间 90s (大惯性)
      overshootMax: 15,         // 最大超调 15%
    },

    requirements: {
      highGainIntegrator: false,
      feedforwardDisturbance: false,
      adaptiveGain: false,
      antiWindup: true,
      gainScheduling: false,
    },

    defaultPID: XUELONG_DEFAULT_GAINS.heading,
  },

  // 视觉配置
  visual: {
    modelPath: '/assets/icebreaker.glb',
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#06b6d4',     // 青色
    wakeIntensity: 0.5,
  },

  // 预设场景
  scenarios: [
    {
      id: 'open-water',
      title: '开阔水域航行',
      description:
        '在无冰条件下学习 Azipod 推进控制基础，理解回转速率限制对控制性能的影响',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        heading: 45,
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 8,
        currentSpeed: 0.2,
        currentDirection: 30,
      },
      initialConditions: {
        speedMps: 6,
      },
      successCriteria: {
        maxError: 2,             // 航向误差 < 2°
        maxSettlingTime: 60,     // 调节时间 < 60s
      },
      teachingFocus: {
        topic: 'azipod-basics',
        description:
          '观察 Azipod 12°/s 回转速率限制如何影响航向控制响应。对比舵角控制和 Azipod 控制的差异。',
        metrics: ['headingError', 'azipodSlewRate', 'settlingTime'],
      },
    },
    {
      id: 'ice-channel',
      title: '冰区航道',
      description:
        '在 1.0m 冰层条件下航行，观察冰接触导致的参数摄动及其对控制性能的影响',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        heading: 30,
      },
      seaState: {
        level: 3,
        waveHeight: 1.0,
        windSpeed: 12,
        currentSpeed: 0.3,
        currentDirection: 60,
      },
      initialConditions: {
        speedMps: 2,             // 冰区低速
      },
      successCriteria: {
        maxError: 5,             // 冰区允许更大误差
        maxSettlingTime: 120,
      },
      teachingFocus: {
        topic: 'parameter-perturbation',
        description:
          '冰接触时 K 下降 40-60%，T 上升 20-40%，观察 Stick-Slip 效应导致的参数剧烈变化。思考: 控制器如何在参数不确定性下保持稳定?',
        visualization: true,
        metrics: ['perturbedK', 'perturbedT', 'iceResistance', 'headingError'],
      },
    },
    {
      id: 'station-keeping',
      title: '冰区定点保持',
      description:
        '在浮冰撞击条件下保持位置，模拟科考作业时的定位需求',
      type: 'position_keeping',
      duration: 600,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.2,
        windSpeed: 15,
        currentSpeed: 0.4,
        currentDirection: 90,
      },
      disturbances: {
        current: { speed: 0.4, direction: 90 },
        wind: { speed: 15, direction: 45 },
      },
      successCriteria: {
        maxPositionError: 5,     // 位置误差 < 5m
        maxSettlingTime: 90,
      },
      teachingFocus: {
        topic: 'disturbance-rejection',
        description:
          '观察浮冰撞击产生的脉冲扰动，以及 Azipod 推力分配如何抵抗环境力。',
        metrics: ['positionError', 'azipodThrust', 'iceImpactForce'],
      },
    },
    {
      id: 'ramming-maneuver',
      title: '冲撞破冰机动',
      description:
        '模拟倒车加速冲击破冰的极限工况，测试控制器鲁棒性',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -200, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 4,
        waveHeight: 2.0,
        windSpeed: 18,
        currentSpeed: 0.5,
        currentDirection: 0,
      },
      initialConditions: {
        speedMps: -3,            // 倒车
      },
      successCriteria: {
        maxError: 5,             // 航向偏差 < 5°
      },
      teachingFocus: {
        topic: 'robustness',
        description:
          '冲撞破冰时参数变化最剧烈，观察根轨迹分析预测的稳定性边界是否准确。',
        metrics: ['perturbedK', 'perturbedT', 'headingError', 'propellerStress'],
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '科考任务进度 vs 设备安全',
    rules: [
      '冰厚超过 1.2m 时触发警告',
      '冰厚超过 1.5m 时必须停止前进',
      'Azipod 回转速率接近 12°/s 时警告',
      '螺旋桨应力超过 80% 设计载荷时警告',
      '接近野生动物时减速至 3m/s 以下',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: 0,                    // 无舵
      EXCESSIVE_ROLL_ANGLE: XUELONG_ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE,
      COLLISION_RISK: XUELONG_ETHICAL_THRESHOLDS.MIN_COLLISION_DISTANCE,
      ENVIRONMENTAL_HAZARD: 1,
      SAFETY_VIOLATION: 1,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
      // 破冰船特有阈值
      AZIPOD_SLEW_RATE_WARNING: XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_WARNING,
      AZIPOD_SLEW_RATE_EXCEEDED: XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_EXCEEDED,
      ICE_THICKNESS_WARNING: XUELONG_ETHICAL_THRESHOLDS.ICE_THICKNESS_WARNING,
      ICE_THICKNESS_EXCEEDED: XUELONG_ETHICAL_THRESHOLDS.ICE_THICKNESS_EXCEEDED,
      PROPELLER_STRESS_WARNING: XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_WARNING,
      PROPELLER_STRESS_EXCEEDED: XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_EXCEEDED,
      WILDLIFE_DISTANCE_VIOLATION: XUELONG_ETHICAL_THRESHOLDS.WILDLIFE_MIN_DISTANCE,
    },
    protectedZones: [
      {
        id: 'penguin-colony-1',
        name: '企鹅栖息地',
        type: 'wildlife',
        boundary: [
          { x: 800, z: 300 },
          { x: 1200, z: 300 },
          { x: 1200, z: 700 },
          { x: 800, z: 700 },
        ],
      },
      {
        id: 'seal-rest-area-1',
        name: '海豹休息区',
        type: 'wildlife',
        boundary: [
          { x: -650, z: 650 },
          { x: -350, z: 650 },
          { x: -350, z: 950 },
          { x: -650, z: 950 },
        ],
      },
    ],
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch4 根轨迹分析', 'Ch6 非线性控制', 'Ch5 频率响应'],
    knowledgePoints: [
      'Azipod 吊舱推进原理',
      '回转速率约束对控制的影响',
      '参数摄动与鲁棒稳定性',
      'Stick-Slip 非线性效应',
      '根轨迹鲁棒性分析',
      '增益裕度与相位裕度',
    ],
    challenges: [
      '理解 Azipod 与传统舵角控制的差异',
      '分析参数摄动对闭环极点的影响',
      '设计鲁棒控制器应对冰区工况',
      '观察根轨迹预测与实际响应的对应',
    ],
  },
};

/**
 * 获取破冰船仿真的默认配置
 */
export function getIcebreakerDefaultConfig() {
  return {
    controlMode: 'pid' as const,
    targetHeading: 0,
    speed: XUELONG_ICEBREAKER_PARAMS.CRUISE_SPEED,
    iceModeEnabled: false,
    iceThickness: 0,
    pidGains: XUELONG_DEFAULT_GAINS.heading,
  };
}

/**
 * 获取 Azipod 布局描述 (用于 UI 显示)
 */
export function getAzipodLayoutDescription(): string {
  return `
雪龙2号 Azipod 布局 (船尾视图):

         船艏 →
    ┌─────────────────┐
    │                 │
    │    船体中心      │
    │                 │
    │   [P1]   [P2]   │   ← 双 Azipod 吊舱
    └─────────────────┘
         船尾

吊舱参数:
- 数量: 2 台
- 单台最大推力: 7500 kN
- 单台最大功率: 7500 kW
- 最大回转速率: 12°/s (关键约束!)
- 回转角度: ±180° (全回转)
`;
}

/**
 * 获取冰区参数摄动说明
 */
export function getIcePerturbationDescription(): string {
  return `
冰区参数摄动范围:

粘滞相 (Stick):
- K (转向增益): × [0.4, 0.7] → -30% ~ -60%
- T (时间常数): × [1.2, 1.4] → +20% ~ +40%
- 物理解释: 船舶推动冰层，阻力增大，响应变迟钝

滑动相 (Slip):
- K (转向增益): × [0.9, 1.1] → -10% ~ +10%
- T (时间常数): × [0.8, 1.0] → -20% ~ 0%
- 物理解释: 冰层破碎，阻力骤降，响应恢复正常

Stick-Slip 周期: 2-6 秒 (随机)

教学要点:
1. 参数不确定性下的稳定性分析
2. 根轨迹变化范围与增益裕度的关系
3. 鲁棒控制器设计思路
`;
}

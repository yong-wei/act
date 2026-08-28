/**
 * 海洋石油981 (HYSY981) 深水半潜式钻井平台配置
 * 舰队模型 - 3DOF 动力定位，多变量强耦合
 *
 * 工程特性：DP3 动力定位 + 8台全回转推进器
 * 控制难点：X-Y-Ψ 三自由度耦合，推力分配优化
 * 知识点映射：解耦控制 (Ch6)，现代控制理论
 */

import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { ShipProfile } from '../core/ship-profile';
import {
  HYSY981_PLATFORM_PARAMS,
  HYSY981_THRUSTER_LAYOUT,
  DRILLING_DEFAULT_DP,
  DRILLING_ETHICAL_THRESHOLDS,
} from '../core/constants';

// 为半潜式平台扩展 ShipProfile 类型
export interface DrillingPlatformProfile extends ShipProfile {
  thrusterConfig?: {
    layout: typeof HYSY981_THRUSTER_LAYOUT;
    constraints: {
      maxSingleThrust: number;
      maxTotalPower: number;
      maxAzimuthRate: number;
    };
  };
  dpConfig?: {
    gains: typeof DRILLING_DEFAULT_DP;
    decouplingEnabled: boolean;
    positionDeadband: number;
    headingDeadband: number;
  };
}

export const drillingHYSY981Profile: DrillingPlatformProfile = {
  // 基本信息
  id: 'fleet-drill-hysy981',
  name: '海洋石油981',
  nameEn: 'Ocean Oil 981 (HYSY981)',
  type: 'fleet',
  description:
    '中国首座3000米超深水半潜式钻井平台，配备8台全回转推进器，实现DP3级动力定位。教学重点为多变量解耦控制和推力分配算法。',

  // 物理尺度
  dimensions: {
    length: HYSY981_PLATFORM_PARAMS.LENGTH, // 114m
    beam: HYSY981_PLATFORM_PARAMS.WIDTH, // 78m
    draft: HYSY981_PLATFORM_PARAMS.DRAFT_OPERATING, // 37m
    displacement: HYSY981_PLATFORM_PARAMS.DISPLACEMENT, // 55000t
    blockCoefficient: 0.92, // 半潜式方形系数大
  },

  // 动力学配置 - 使用 3DOF 耦合模型
  dynamics: {
    modelType: 'SemiSubmersible3DOF',

    // 半潜平台不使用 Nomoto 模型
    nomoto: undefined,

    // MMG 参数预留 (可选用于高级仿真)
    mmg: undefined,

    modifications: {
      massMultiplier: 4.2, // 相对于驱逐舰质量的倍数 (55000/13000)
      disturbancePattern: 'coupled_3dof',
    },

    speed: {
      min: 0,
      max: 3.5, // ~7节 最大航速
      cruise: 0, // 定位作业时速度为0
    },

    // 半潜式平台没有传统舵
    rudder: {
      maxAngle: 0,
      maxRate: 0,
    },
  },

  // 推进器配置
  thrusterConfig: {
    layout: HYSY981_THRUSTER_LAYOUT,
    constraints: {
      maxSingleThrust: 800, // kN
      maxTotalPower: 32000, // kW
      maxAzimuthRate: 15, // °/s
    },
  },

  // DP 控制配置
  dpConfig: {
    gains: DRILLING_DEFAULT_DP,
    decouplingEnabled: true,
    positionDeadband: 0.1, // m
    headingDeadband: 0.5, // °
  },

  // 控制配置
  control: {
    defaultMode: 'dp',
    supportedModes: ['manual', 'dp'],

    targets: {
      positionTolerance: 1.0, // 定位精度 1m (钻井作业)
      headingTolerance: 2.0, // 航向精度 2°
      settlingTime: 120, // 调节时间 120s
      overshootMax: 10, // 最大超调 10%
    },

    requirements: {
      highGainIntegrator: true, // 高增益积分消除稳态误差
      feedforwardDisturbance: true, // 环境力前馈
      antiWindup: true, // 抗积分饱和
      adaptiveGain: false, // 暂不使用自适应
    },

    defaultPID: DRILLING_DEFAULT_DP.surge, // 使用 surge 通道参数
    defaultDP: DRILLING_DEFAULT_DP,
  },

  // 视觉配置
  visual: {
    modelPath: resolveRegisteredSimulationModel('drilling-rig').originalUrl,
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#ef4444', // 红色
    wakeIntensity: 0.3, // 低速，尾迹小
  },

  // 预设场景
  scenarios: [
    {
      id: 'basic-station-keeping',
      title: '基础定点保持',
      description:
        '在平静海况下学习 DP 控制基础，理解位置误差到推力命令的控制回路',
      type: 'position_keeping',
      duration: 300,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 5,
        currentSpeed: 0.3,
        currentDirection: 45,
      },
      disturbances: {
        current: { speed: 0.3, direction: 45 },
      },
      successCriteria: {
        maxPositionError: 1.0, // m
        maxSettlingTime: 60, // s
      },
    },
    {
      id: 'strong-current',
      title: '强流定位挑战',
      description:
        '在 1.5 节强海流条件下保持定位，观察推进器功率分配与饱和现象',
      type: 'position_keeping',
      duration: 600,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 4,
        waveHeight: 2.5,
        windSpeed: 15,
        currentSpeed: 0.75, // ~1.5节
        currentDirection: 90, // 横流
      },
      disturbances: {
        current: { speed: 0.75, direction: 90 },
      },
      successCriteria: {
        maxPositionError: 2.0, // m
        maxSettlingTime: 120, // s
      },
    },
    {
      id: 'thruster-failure',
      title: '推进器故障恢复',
      description:
        '模拟 2 号推进器故障，观察推力重分配算法如何维持定位精度',
      type: 'position_keeping',
      duration: 600,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.5,
        windSpeed: 10,
        currentSpeed: 0.5,
        currentDirection: 45,
      },
      disturbances: {
        current: { speed: 0.5, direction: 45 },
        thrusterFailures: [
          { thrusterId: 2, failureTime: 60, type: 'complete' },
        ],
      },
      successCriteria: {
        maxPositionError: 3.0, // m (故障后允许更大误差)
        maxSettlingTime: 180, // s
      },
    },
    {
      id: 'decoupling-demo',
      title: '解耦控制对比',
      description:
        '开启/关闭解耦补偿，可视化对比耦合干扰对控制性能的影响 (教学核心)',
      type: 'position_keeping',
      duration: 600,
      startPosition: { x: 5, z: 3, headingDeg: 5 }, // 初始偏差
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.2,
        windSpeed: 8,
        currentSpeed: 0.4,
        currentDirection: 60,
      },
      disturbances: {
        current: { speed: 0.4, direction: 60 },
      },
      successCriteria: {
        maxPositionError: 1.5, // m
      },
      teachingFocus: {
        topic: 'decoupling',
        description:
          '观察 sway-yaw 耦合：当平台横移时会产生艏摇干扰。解耦控制通过补偿矩阵 D⁻¹ 消除这种交叉干扰。',
        metrics: ['positionRMS', 'headingRMS', 'settlingTime'],
        comparison: {
          modeA: { decouplingEnabled: false, label: '标准 PID (有耦合)' },
          modeB: { decouplingEnabled: true, label: '解耦 PID (已补偿)' },
        },
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '钻井进度 vs 安全解脱',
    rules: [
      '位置偏差超过 3m 触发黄色警报',
      '位置偏差超过 5m 触发红色警报 (必须考虑解脱)',
      '位置偏差超过 10m 强制紧急解脱',
      '航向偏差超过 15° 影响钻柱安全',
      '单台推进器功率不得超过 4500kW',
      '总推进功率不得超过 32000kW',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: 0, // 无舵
      EXCESSIVE_ROLL_ANGLE: 5.0, // °
      COLLISION_RISK: 100, // m
      ENVIRONMENTAL_HAZARD: 1,
      SAFETY_VIOLATION: 1,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
      // 钻井平台特有阈值
      YELLOW_ALERT_POSITION: DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION,
      RED_ALERT_POSITION: DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION,
      EMERGENCY_DISCONNECT: DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT,
      HEADING_DEVIATION: DRILLING_ETHICAL_THRESHOLDS.MAX_HEADING_DEVIATION,
      THRUSTER_POWER_EXCEEDED: DRILLING_ETHICAL_THRESHOLDS.MAX_THRUSTER_POWER,
      TOTAL_POWER_EXCEEDED: DRILLING_ETHICAL_THRESHOLDS.MAX_TOTAL_POWER,
    },
    protectedZones: [],
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch6 解耦控制', 'Ch7 现代控制理论', 'Ch6 多变量系统'],
    knowledgePoints: [
      '多变量耦合系统特性',
      '解耦控制原理与设计',
      '推力分配算法',
      'DP 动力定位控制',
      '环境力前馈补偿',
      '积分抗饱和设计',
    ],
    challenges: [
      '理解 X-Y-Ψ 三自由度耦合',
      '设计解耦补偿矩阵 D⁻¹',
      '观察解耦前后性能差异',
      '学习推力分配伪逆算法',
      '处理推进器故障重构',
    ],
  },
};

/**
 * 获取钻井平台仿真的默认配置
 */
export function getDrillingDefaultConfig() {
  return {
    controlMode: 'dp' as const,
    targetPosition: { x: 0, z: 0 },
    targetHeading: 0,
    seaState: {
      level: 3 as const,
      waveHeight: 1.5,
      wavePeriod: 8,
      waveDirection: 0,
      windSpeed: 10,
      windDirection: 45,
      currentSpeed: 0.5,
      currentDirection: 45,
    },
    decouplingEnabled: true,
    thrusterLayout: HYSY981_THRUSTER_LAYOUT,
  };
}

/**
 * 获取推进器布局描述 (用于 UI 显示)
 */
export function getThrusterLayoutDescription(): string {
  return `
HYSY981 推进器布局 (俯视图):
          前 (Fore)
    T1(-45,+30)  T5(+45,+30)
    T3(-30,+35)  T7(+30,+35)
          ▣ 平台中心
    T4(-30,-35)  T8(+30,-35)
    T2(-45,-30)  T6(+45,-30)
          后 (Aft)

共8台全回转推进器
单台最大推力: 800 kN
单台最大功率: 4500 kW
最大回转速率: 15 °/s
`;
}

/**
 * 获取 DP 控制增益描述
 */
export function getDPGainsDescription(): string {
  const { surge, sway, yaw } = DRILLING_DEFAULT_DP;
  return `
DP 控制增益:
- Surge (纵荡): Kp=${surge.kp}, Ki=${surge.ki}, Kd=${surge.kd}
- Sway (横荡): Kp=${sway.kp}, Ki=${sway.ki}, Kd=${sway.kd}
- Yaw (艏摇): Kp=${yaw.kp.toExponential(1)}, Ki=${yaw.ki.toExponential(1)}, Kd=${yaw.kd.toExponential(1)}
`;
}

/**
 * 获取安全阈值描述
 */
export function getSafetyThresholdsDescription(): string {
  const T = DRILLING_ETHICAL_THRESHOLDS;
  return `
安全阈值:
- 黄色警报: 位置偏差 > ${T.YELLOW_ALERT_POSITION}m
- 红色警报: 位置偏差 > ${T.RED_ALERT_POSITION}m
- 紧急解脱: 位置偏差 > ${T.EMERGENCY_DISCONNECT}m
- 最大航向偏差: ${T.MAX_HEADING_DEVIATION}°
- 单台推进器功率上限: ${T.MAX_THRUSTER_POWER} kW
- 总功率上限: ${T.MAX_TOTAL_POWER} kW
`;
}

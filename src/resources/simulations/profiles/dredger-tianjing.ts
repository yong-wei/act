/**
 * 天鲸号挖泥船配置
 * 舰队模型 - 高保真非线性模型，动力定位控制
 *
 * 工程特性：定位精度极高 + 强负载扰动
 * 控制难点：绞刀切入岩石时的巨大后坐力
 * 知识点映射：稳态误差 (Ch3)，前馈控制 (Ch6)
 */

import type { ShipProfile } from '../core/ship-profile';
import { TIANJING_DREDGER_PARAMS, HIGH_GAIN_PID } from '../core/constants';
import { DEFAULT_MMG_PARAMS } from '../physics/simulation-engine-facade';
import { HIGH_PRECISION_DP_GAINS } from '../physics/controllers/dp-controller';

export const dredgerTianjingProfile: ShipProfile = {
  // 基本信息
  id: 'fleet-dredger-tianjing',
  name: '天鲸号挖泥船',
  nameEn: 'Tianjing Cutter Suction Dredger',
  type: 'fleet',
  description: '亚洲最大自航绞吸式挖泥船，用于港口疏浚和岛礁建设。配备高精度动力定位系统，可在恶劣海况下精确作业。',

  // 物理尺度
  dimensions: {
    length: TIANJING_DREDGER_PARAMS.LENGTH,      // 127.5m
    beam: TIANJING_DREDGER_PARAMS.BEAM,          // 23m
    draft: TIANJING_DREDGER_PARAMS.DRAFT,        // 6.2m
    displacement: TIANJING_DREDGER_PARAMS.DISPLACEMENT,  // 17000t
    blockCoefficient: 0.85,  // 方船型，方形系数大
  },

  // 动力学配置 - 使用 MMG 高保真模型
  dynamics: {
    modelType: 'MMG3DOF',

    // MMG 模型参数
    mmg: {
      massInertia: {
        m: TIANJING_DREDGER_PARAMS.MASS,
        Iz: TIANJING_DREDGER_PARAMS.MOMENT_OF_INERTIA,
        xG: TIANJING_DREDGER_PARAMS.CENTER_OF_GRAVITY_X,
        mx: TIANJING_DREDGER_PARAMS.ADDED_MASS_X,
        my: TIANJING_DREDGER_PARAMS.ADDED_MASS_Y,
        Jz: TIANJING_DREDGER_PARAMS.ADDED_INERTIA_Z,
      },
      hydro: {
        // 挖泥船水动力导数 (宽船体特征)
        Xuu: -0.025,
        Xvv: -0.045,
        Xrr: 0.002,
        Xvr: 0.003,
        Yv: -0.350,
        Yr: 0.095,
        Yvvv: -1.800,
        Yrrr: 0.010,
        Yvvr: 0.420,
        Yvrr: -0.430,
        Nv: -0.150,
        Nr: -0.055,
        Nvvv: -0.035,
        Nrrr: -0.015,
        Nvvr: -0.320,
        Nvrr: 0.060,
      },
      rudder: {
        maxAngle: TIANJING_DREDGER_PARAMS.MAX_RUDDER_ANGLE * Math.PI / 180,
        maxRate: TIANJING_DREDGER_PARAMS.MAX_RUDDER_RATE * Math.PI / 180,
        tR: 0.45,
        aH: 0.35,
        xR: -63.75,  // 船尾
      },
      propeller: {
        Dp: 4.5,
        wp: 0.28,
        tp: 0.18,
      },
    },

    modifications: {
      massMultiplier: 5.0,  // 相对于驱逐舰质量的倍数
      disturbancePattern: 'step_impulse_mixed',  // 挖掘冲击扰动
    },

    speed: {
      min: 0,
      max: TIANJING_DREDGER_PARAMS.MAX_SPEED,     // 6 m/s
      cruise: TIANJING_DREDGER_PARAMS.CRUISE_SPEED,  // 2 m/s (作业速度)
    },

    rudder: {
      maxAngle: TIANJING_DREDGER_PARAMS.MAX_RUDDER_ANGLE,  // 35°
      maxRate: TIANJING_DREDGER_PARAMS.MAX_RUDDER_RATE,    // 2.5°/s
    },
  },

  // 控制配置
  control: {
    defaultMode: 'dp',  // 默认动力定位模式
    supportedModes: ['manual', 'p', 'pd', 'pid', 'dp'],

    targets: {
      positionTolerance: 0.1,   // 定位精度 0.1m
      headingTolerance: 0.5,    // 航向精度 0.5°
      settlingTime: 30,         // 调节时间 30s
      overshootMax: 5,          // 最大超调 5%
    },

    requirements: {
      highGainIntegrator: true,       // 高增益积分器消除稳态误差
      feedforwardDisturbance: true,   // 前馈扰动补偿
      antiWindup: true,               // 抗积分饱和
      adaptiveGain: false,            // 暂不使用自适应增益
    },

    defaultPID: HIGH_GAIN_PID,
    defaultDP: HIGH_PRECISION_DP_GAINS,
  },

  // 视觉配置
  visual: {
    modelPath: '/assets/dredger.glb',
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#f59e0b',  // 琥珀色
    wakeIntensity: 0.6,     // 低速作业，尾迹较小
  },

  // 预设场景
  scenarios: [
    {
      id: 'position-keeping',
      title: '定点保持',
      description: '在强海流和挖掘反力下，保持船位误差 < 0.1m',
      type: 'position_keeping',
      duration: 300,
      startPosition: { x: 0, z: 0, headingDeg: 0 },
      targets: {
        position: { x: 0, z: 0 },
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 0.8,
        windSpeed: 8,
        currentSpeed: 0.5,
        currentDirection: 45,
      },
      disturbances: {
        current: { speed: 0.5, direction: 45 },
        dredgingImpacts: {
          pattern: 'step_impulse_mixed',
          maxForce: 500000,  // 500kN
          interval: [5, 15],
        },
      },
      successCriteria: {
        maxPositionError: 0.1,
        maxSettlingTime: 30,
      },
    },
    {
      id: 'slow-advance',
      title: '缓进作业',
      description: '边挖掘边前进，保持定位精度',
      type: 'path_following',
      duration: 600,
      startPosition: { x: -100, z: 0, headingDeg: 0 },
      targets: {
        path: [
          { x: -100, z: 0 },
          { x: 0, z: 0 },
          { x: 100, z: 0 },
        ],
        heading: 0,
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 5,
        currentSpeed: 0.3,
        currentDirection: 90,
      },
      disturbances: {
        current: { speed: 0.3, direction: 90 },
        dredgingImpacts: {
          pattern: 'step_impulse_mixed',
          maxForce: 400000,
          interval: [8, 20],
        },
      },
      successCriteria: {
        maxPositionError: 0.2,
      },
    },
    {
      id: 'heading-control',
      title: '航向控制',
      description: '纯航向控制模式，不使用定位',
      type: 'heading_control',
      duration: 180,
      startPosition: { x: -500, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => t < 60 ? 0 : 45,
      },
      seaState: {
        level: 2,
        waveHeight: 0.5,
        windSpeed: 5,
      },
      successCriteria: {
        maxError: 3,
        maxSettlingTime: 90,
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '吹填造岛效率 vs 生态保护',
    rules: [
      '禁止在珊瑚礁保护区作业',
      '泥浆浊度超过 50 NTU 需停工',
      '作业期间保持定位精度，防止对周边生态造成额外破坏',
      '舵角变化速率不得超过 2.5°/s，保护液压系统',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: 2.5,        // °/s
      EXCESSIVE_ROLL_ANGLE: 10.0,        // °
      COLLISION_RISK: 50,                // m
      ENVIRONMENTAL_HAZARD: 1,           // 环境危害开关
      SAFETY_VIOLATION: 1,               // 安全违规开关
      CORAL_REEF_ZONE: 1,                // 珊瑚礁检测开关
      TURBIDITY_EXCEEDED: 50,            // NTU
    },
    protectedZones: [
      {
        id: 'coral-zone-1',
        name: '南沙珊瑚礁保护区',
        type: 'coral_reef',
        boundary: [
          { x: 500, z: 500 },
          { x: 800, z: 500 },
          { x: 800, z: 800 },
          { x: 500, z: 800 },
        ],
      },
    ],
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch3 稳态误差', 'Ch6 前馈控制', 'Ch6 鲁棒性'],
    knowledgePoints: [
      '稳态误差与系统型次',
      '高增益积分器设计',
      '前馈补偿原理',
      '扰动抑制',
      '多变量控制基础',
    ],
    challenges: [
      '在强海流和挖掘反力下，保持船位误差 < 0.1m',
      '设计高增益积分器消除静差',
      '利用前馈补偿预测挖掘冲击',
      '理解质量增大对系统响应的影响',
    ],
  },
};

/**
 * 获取挖泥船仿真的默认配置
 */
export function getDredgerDefaultConfig() {
  return {
    controlMode: 'dp' as const,
    targetPosition: { x: 0, z: 0 },
    targetHeading: 0,
    seaState: {
      level: 3 as const,
      waveHeight: 0.8,
      wavePeriod: 6,
      waveDirection: 0,
      windSpeed: 8,
      windDirection: 45,
      currentSpeed: 0.5,
      currentDirection: 45,
    },
    dredgingEnabled: true,
  };
}

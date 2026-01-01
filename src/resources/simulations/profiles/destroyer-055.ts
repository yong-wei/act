/**
 * 055型驱逐舰配置
 * 旗舰模型 - 全参数、高保真、多自由度耦合
 */

import type { ShipProfile } from '../core/ship-profile';
import { DEFAULT_NOMOTO_PARAMS, DEFAULT_PID_GAINS } from '../core/constants';

export const destroyer055Profile: ShipProfile = {
  // 基本信息
  id: 'destroyer-055',
  name: '055型驱逐舰',
  nameEn: 'Type 055 Destroyer',
  type: 'flagship',
  description: '中国人民解放军海军新一代万吨级导弹驱逐舰，具有优秀的操纵性和高机动性能。',

  // 物理尺度
  dimensions: {
    length: 180,          // m
    beam: 20,             // m
    draft: 6.6,           // m
    displacement: 13000,  // t
    blockCoefficient: 0.5,
  },

  // 动力学配置
  dynamics: {
    modelType: 'Nomoto1stOrder',

    nomoto: {
      K: 0.08,              // 转向增益
      T: 55,                // 时间常数 (s)
      maxRudderDeg: 35,     // 最大舵角 (°)
      speedMps: 15.0,       // 参考航速 (m/s) ≈ 29节
    },

    modifications: {
      massMultiplier: 1.0,
      disturbancePattern: 'normal',
    },

    speed: {
      min: 0,
      max: 18,        // ~35节
      cruise: 15,     // ~29节
    },

    rudder: {
      maxAngle: 35,   // °
      maxRate: 5.0,   // °/s
    },
  },

  // 控制配置
  control: {
    defaultMode: 'pid',
    supportedModes: ['manual', 'p', 'pd', 'pid'],

    targets: {
      headingTolerance: 1.0,    // °
      settlingTime: 60,         // s
      overshootMax: 10,         // %
    },

    requirements: {
      antiWindup: true,
    },

    defaultPID: DEFAULT_PID_GAINS,
  },

  // 视觉配置
  visual: {
    modelPath: '/assets/destroyer.glb',
    modelForward: { x: 1, y: 0, z: 0 },
    modelScale: 1,
    trailColor: '#4ade80',
    wakeIntensity: 1.0,
  },

  // 预设场景
  scenarios: [
    {
      id: 'straight',
      title: '直线航行',
      description: '保持航向稳定直线航行',
      type: 'heading_control',
      duration: 180,
      startPosition: { x: -3000, z: 0, headingDeg: 0 },
      targets: {
        heading: 0,
      },
      seaState: {
        level: 3,
        waveHeight: 1.0,
        windSpeed: 10,
      },
      successCriteria: {
        maxError: 5,
        maxSettlingTime: 30,
      },
    },
    {
      id: 'turn90',
      title: '90度转向',
      description: '执行90度航向变换',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -6000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => t < 60 ? 0 : 90,
      },
      seaState: {
        level: 3,
        waveHeight: 1.0,
        windSpeed: 10,
      },
      successCriteria: {
        maxError: 5,
        maxSettlingTime: 120,
      },
    },
    {
      id: 'obstacle',
      title: '障碍规避',
      description: '执行一系列机动以规避障碍',
      type: 'heading_control',
      duration: 300,
      startPosition: { x: -2000, z: 0, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          if (t < 60) return 0;
          if (t < 90) return 45;
          if (t < 120) return 0;
          if (t < 150) return -45;
          return 0;
        },
      },
      seaState: {
        level: 4,
        waveHeight: 2.0,
        windSpeed: 15,
      },
      successCriteria: {
        maxError: 10,
      },
    },
    {
      id: 'circle',
      title: '回旋运动',
      description: '执行定常回旋运动',
      type: 'heading_control',
      duration: 600,
      startPosition: { x: 0, z: -2250, headingDeg: 0 },
      targets: {
        heading: (t: number) => {
          if (t < 60) return 0;
          const radius = 1350;
          const circumference = 2 * Math.PI * radius;
          const speed = 15;
          const turnTime = circumference / speed;
          const degPerSec = 360 / turnTime;
          return -90 + degPerSec * (t - 60);
        },
      },
      seaState: {
        level: 3,
        waveHeight: 1.0,
        windSpeed: 10,
      },
      successCriteria: {
        maxError: 15,
      },
    },
  ],

  // 伦理上下文
  ethics: {
    dilemma: '战术机动效率 vs 舰艇安全',
    rules: [
      '舵角变化速率不得超过 5°/s，防止舵机液压系统过载',
      '横摇角不得超过 15°，确保舰载设备正常工作',
      '高速转向时需注意倾覆风险',
    ],
    thresholds: {
      EXCESSIVE_RUDDER_RATE: 5.0,
      EXCESSIVE_ROLL_ANGLE: 15.0,
      COLLISION_RISK: 100,
      ENVIRONMENTAL_HAZARD: 0,
      SAFETY_VIOLATION: 0,
      CORAL_REEF_ZONE: 0,
      TURBIDITY_EXCEEDED: 0,
    },
  },

  // 教学映射
  teachingContext: {
    chapter: ['Ch3 稳定性', 'Ch4 根轨迹', 'Ch5 频率响应'],
    knowledgePoints: [
      '一阶系统时间响应',
      'PID 控制器设计',
      '稳定性判据',
    ],
    challenges: [
      '设计 PID 控制器使航向误差收敛',
      '调节参数减小超调量',
      '在海浪扰动下保持航向稳定',
    ],
  },
};

export type PlantModelType = 'PROPORTIONAL' | 'INERTIAL' | 'INTEGRAL';
export type LevelTier = 'bronze' | 'silver' | 'gold';
export type ControllerId = 'P' | 'PI' | 'PD' | 'PID';
export type SignalType = 'step' | 'sequence' | 'ramp' | 'accel' | 'custom';
export type DisturbanceType = 'none' | 'output-step';

export interface SignalEvent {
  at: number;
  amplitude: number;
}

export interface ReferenceSequenceRandomConfig {
  count: number;
  minAt: number;
  maxAt: number;
  minGap?: number;
  minAmplitude: number;
  maxAmplitude: number;
}

export interface ReferenceSignalConfig {
  type: SignalType;
  base?: number;
  events: SignalEvent[];
  random?: ReferenceSequenceRandomConfig;
  seed?: number;
  rampRate?: number;
  accelRate?: number;
  startSafeDistance?: number;
}

export interface DisturbanceEvent {
  at: number;
  amplitude: number;
  duration?: number;
}

export interface DisturbanceConfig {
  type: DisturbanceType;
  events: DisturbanceEvent[];
  visual?: {
    style: 'turbulence' | 'dark-current';
    direction?: 'up' | 'down';
    intensity?: 'low' | 'mid' | 'high';
  };
}

export interface EnvelopeConfig {
  margin: number;
}

export interface ModelConfigTF {
  form: 'tf';
  numerator: number[];
  denominator: number[];
  delay?: number;
}

export interface ModelConfigZPK {
  form: 'zpk';
  zeros: number[];
  poles: number[];
  gain: number;
  delay?: number;
}

export interface SimulationModelConfig {
  engineType: PlantModelType;
  gain: number;
  timeConstant?: number;
  inputDelay?: number;
}

export interface LevelTierConfig {
  tier: LevelTier;
  distance: number;
  reference: ReferenceSignalConfig;
  disturbance: DisturbanceConfig;
  envelope: EnvelopeConfig;
}

export interface ControlOdysseyLevel {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  unlocked: boolean;
  highScore?: number;
  model: ModelConfigTF | ModelConfigZPK;
  simulation: SimulationModelConfig;
  tiers: LevelTierConfig[];
}

export interface ShopItem {
  id: string;
  label: string;
  price: number;
  unlocks: { controller: ControllerId };
  requires?: ControllerId[];
  description?: string;
}

export interface ShopConfig {
  currency: 'credits';
  items: ShopItem[];
}

const DEFAULT_DISTANCE = 3000;
const DEFAULT_ENVELOPE: EnvelopeConfig = { margin: 60 };
const DEFAULT_SAFE_DISTANCE = 500;

const createStepSequence = (
  count: number,
  minAt: number,
  maxAt: number,
  minAmplitude: number,
  maxAmplitude: number,
  minGap: number
) => {
  const events: SignalEvent[] = [];
  let attempts = 0;
  while (events.length < count && attempts < 200) {
    attempts += 1;
    const at = Math.round(minAt + Math.random() * (maxAt - minAt));
    const amplitude = Math.round(minAmplitude + Math.random() * (maxAmplitude - minAmplitude));
    if (events.some((event) => Math.abs(event.at - at) < minGap)) {
      continue;
    }
    events.push({ at, amplitude });
  }

  if (events.length < count) {
    const step = Math.max(minGap, Math.floor((maxAt - minAt) / count));
    for (let i = events.length; i < count; i += 1) {
      const at = Math.round(minAt + i * step);
      const amplitude = Math.round(minAmplitude + Math.random() * (maxAmplitude - minAmplitude));
      events.push({ at, amplitude });
    }
  }

  return events.sort((a, b) => a.at - b.at);
};

const buildTierConfigs = (): LevelTierConfig[] => {
  const bronzeReference: ReferenceSignalConfig = {
    type: 'step',
    startSafeDistance: DEFAULT_SAFE_DISTANCE,
    events: [{ at: 700, amplitude: 60 }],
  };

  const silverReference: ReferenceSignalConfig = {
    type: 'sequence',
    startSafeDistance: DEFAULT_SAFE_DISTANCE,
    events: [],
    random: {
      count: 4,
      minAt: 600,
      maxAt: DEFAULT_DISTANCE - 400,
      minGap: 250,
      minAmplitude: -90,
      maxAmplitude: 90,
    },
  };

  const goldReference: ReferenceSignalConfig = {
    type: 'sequence',
    startSafeDistance: DEFAULT_SAFE_DISTANCE,
    events: [],
    random: {
      count: 4,
      minAt: 600,
      maxAt: DEFAULT_DISTANCE - 400,
      minGap: 250,
      minAmplitude: -90,
      maxAmplitude: 90,
    },
  };

  const goldDisturbance: DisturbanceConfig = {
    type: 'output-step',
    visual: { style: 'dark-current', intensity: 'mid' },
    events: [
      { at: 900, amplitude: 24, duration: 140 },
      { at: 1700, amplitude: -30, duration: 160 },
      { at: 2400, amplitude: 20, duration: 120 },
    ],
  };

  return [
    {
      tier: 'bronze',
      distance: DEFAULT_DISTANCE,
      reference: bronzeReference,
      disturbance: { type: 'none', events: [] },
      envelope: { ...DEFAULT_ENVELOPE, margin: 70 },
    },
    {
      tier: 'silver',
      distance: DEFAULT_DISTANCE,
      reference: silverReference,
      disturbance: { type: 'none', events: [] },
      envelope: { ...DEFAULT_ENVELOPE, margin: 60 },
    },
    {
      tier: 'gold',
      distance: DEFAULT_DISTANCE,
      reference: goldReference,
      disturbance: goldDisturbance,
      envelope: { ...DEFAULT_ENVELOPE, margin: 55 },
    },
  ];
};

export const CONTROL_SHOP_CONFIG: ShopConfig = {
  currency: 'credits',
  items: [
    {
      id: 'controller-p',
      label: 'P 控制器',
      price: 0,
      unlocks: { controller: 'P' },
      description: '基础比例控制，可进行 Kp 调节。',
    },
    {
      id: 'controller-pi',
      label: 'PI 控制器',
      price: 1200,
      unlocks: { controller: 'PI' },
      requires: ['P'],
      description: '引入积分消除稳态误差。',
    },
    {
      id: 'controller-pd',
      label: 'PD 控制器',
      price: 1200,
      unlocks: { controller: 'PD' },
      requires: ['P'],
      description: '引入微分提升阻尼。',
    },
    {
      id: 'controller-pid',
      label: 'PID 控制器',
      price: 2600,
      unlocks: { controller: 'PID' },
      requires: ['PI', 'PD'],
      description: '完整 PID 控制能力。',
    },
  ],
};

export const CONTROL_ODYSSEY_LEVELS: ControlOdysseyLevel[] = [
  {
    id: 'level-1',
    name: 'Level 01: 纯比例环节',
    description: '比例环节，理解比例增益与静态误差。',
    difficulty: 1,
    unlocked: true,
    highScore: 0,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1],
    },
    simulation: {
      engineType: 'PROPORTIONAL',
      gain: 1.0,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-2',
    name: 'Level 02: 纯积分环节',
    description: '积分环节，观察缓慢积累与过冲。',
    difficulty: 2,
    unlocked: true,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1, 0],
    },
    simulation: {
      engineType: 'INTEGRAL',
      gain: 1.0,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-3',
    name: 'Level 03: 小惯性环节',
    description: '小惯性对象，响应相对快速。',
    difficulty: 3,
    unlocked: true,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [0.6, 1],
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 0.6,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-4',
    name: 'Level 04: 大惯性环节',
    description: '大惯性对象，需要提前预判。',
    difficulty: 4,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1.6, 1],
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 1.6,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-5',
    name: 'Level 05: 小惯性 + 纯延时',
    description: '小惯性与延迟耦合。',
    difficulty: 5,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [0.8, 1],
      delay: 0.4,
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 0.8,
      inputDelay: 0.4,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-6',
    name: 'Level 06: 大惯性 + 纯延时',
    description: '大惯性加延迟。',
    difficulty: 6,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1.8, 1],
      delay: 0.5,
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 1.8,
      inputDelay: 0.5,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-7',
    name: 'Level 07: 大惯性 + 大延时',
    description: '强延迟导致的滞后系统。',
    difficulty: 7,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [2.2, 1],
      delay: 0.8,
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 2.2,
      inputDelay: 0.8,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-8',
    name: 'Level 08: 欠阻尼二阶系统',
    description: '不同阻尼比的二阶系统挑战。',
    difficulty: 8,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1, 1.4, 1],
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 1.4,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-9',
    name: 'Level 09: 无阻尼二阶系统',
    description: 'ζ=0，响应持续震荡。',
    difficulty: 9,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1, 0, 1],
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 1.2,
    },
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-10',
    name: 'Level 10: 高阶系统',
    description: '多极点系统，复杂动态。',
    difficulty: 10,
    unlocked: false,
    model: {
      form: 'tf',
      numerator: [1],
      denominator: [1, 2.1, 1.6, 0.4],
    },
    simulation: {
      engineType: 'INERTIAL',
      gain: 1.0,
      timeConstant: 2.0,
    },
    tiers: buildTierConfigs(),
  },
];

const LEVEL_MAP = new Map(CONTROL_ODYSSEY_LEVELS.map((level) => [level.id, level]));

export const getLevelConfigById = (levelId: string) =>
  LEVEL_MAP.get(levelId) ?? CONTROL_ODYSSEY_LEVELS[0];

export const getTierConfig = (levelId: string, tier: LevelTier) => {
  const level = getLevelConfigById(levelId);
  return level.tiers.find((item) => item.tier === tier) ?? level.tiers[0];
};

export const buildRuntimeTierConfig = (tierConfig: LevelTierConfig): LevelTierConfig => {
  const reference = tierConfig.reference;
  if (reference.type !== 'sequence' || !reference.random) {
    return tierConfig;
  }

  const { count, minAt, maxAt, minAmplitude, maxAmplitude, minGap = 200 } = reference.random;
  return {
    ...tierConfig,
    reference: {
      ...reference,
      events: createStepSequence(count, minAt, maxAt, minAmplitude, maxAmplitude, minGap),
    },
  };
};

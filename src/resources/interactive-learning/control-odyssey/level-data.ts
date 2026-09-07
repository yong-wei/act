import type { TransferFunctionModel } from '@/lib/simulation';

export type LevelTier = 'bronze' | 'silver' | 'gold';
export type ControllerId = 'P' | 'PI' | 'PD' | 'PID' | 'VFB' | 'FF' | 'SMITH';
export type BaseControllerId = 'P' | 'PI' | 'PD' | 'PID';
export type ModuleControllerId = 'VFB' | 'FF' | 'SMITH';
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
  plantLabel: string;
  difficulty: number;
  unlocked: boolean;
  highScore?: number;
  model: ModelConfigTF | ModelConfigZPK;
  disturbanceTau?: number;
  tiers: LevelTierConfig[];
  /** Canonical knowledge anchors consumed by the teaching projection restage (#2042). */
  relatedCanonicalIds?: string[];
}

export interface ShopItem {
  id: string;
  label: string;
  price: number;
  unlocks: { controller: ControllerId };
  requires?: ControllerId[];
  description?: string;
}

export interface ControllerUpgradeRule {
  controller: ControllerId;
  basePrice: number;
  maxLevel: number;
  paramLabel: string;
}

export interface ShopConfig {
  currency: 'credits';
  items: ShopItem[];
}

const DEFAULT_DISTANCE = 3000;
const DEFAULT_ENVELOPE: EnvelopeConfig = { margin: 60 };
const DEFAULT_SAFE_DISTANCE = 500;
const DEFAULT_STEADY_DISTANCE = 500;

const convolvePolynomials = (a: number[], b: number[]) => {
  const result = Array(a.length + b.length - 1).fill(0);
  a.forEach((av, i) => {
    b.forEach((bv, j) => {
      result[i + j] += av * bv;
    });
  });
  return result;
};

const scalePolynomial = (poly: number[], gain: number) => poly.map((value) => value * gain);

const polynomialFromRoots = (roots: number[]) =>
  roots.reduce((poly, root) => convolvePolynomials(poly, [-root, 1]), [1]);

export const getTransferFunctionModel = (
  model: ModelConfigTF | ModelConfigZPK
): TransferFunctionModel => {
  if (model.form === 'tf') {
    return {
      type: 'transfer_function',
      numerator: model.numerator,
      denominator: model.denominator,
      delay: model.delay,
    };
  }
  const numerator = scalePolynomial(polynomialFromRoots(model.zeros), model.gain);
  const denominator = polynomialFromRoots(model.poles);
  return {
    type: 'transfer_function',
    numerator,
    denominator,
    delay: model.delay,
  };
};

const createStepSequence = (
  count: number,
  minAt: number,
  maxAt: number,
  minAmplitude: number,
  maxAmplitude: number,
  minGap: number,
  random: () => number = Math.random
) => {
  const events: SignalEvent[] = [];
  let attempts = 0;
  while (events.length < count && attempts < 200) {
    attempts += 1;
    const at = Math.round(minAt + random() * (maxAt - minAt));
    const amplitude = Math.round(minAmplitude + random() * (maxAmplitude - minAmplitude));
    if (events.some((event) => Math.abs(event.at - at) < minGap)) {
      continue;
    }
    events.push({ at, amplitude });
  }

  if (events.length < count) {
    const step = Math.max(minGap, Math.floor((maxAt - minAt) / count));
    for (let i = events.length; i < count; i += 1) {
      const at = Math.round(minAt + i * step);
      const amplitude = Math.round(minAmplitude + random() * (maxAmplitude - minAmplitude));
      events.push({ at, amplitude });
    }
  }

  return events.sort((a, b) => a.at - b.at);
};

const hashSeed = (source: string) => {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 4294967296);
  };
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
      maxAt: DEFAULT_DISTANCE - DEFAULT_STEADY_DISTANCE,
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
      maxAt: DEFAULT_DISTANCE - DEFAULT_STEADY_DISTANCE,
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

const tf = (numerator: number[], denominator: number[], delay?: number): ModelConfigTF => ({
  form: 'tf',
  numerator,
  denominator,
  delay,
});

const integratorModel = (gain: number, delay?: number) =>
  tf([gain], [0, 1], delay);

const inertialModel = (gain: number, timeConstant: number, delay?: number) =>
  tf([gain], [1, timeConstant], delay);

const integratorInertiaModel = (gain: number, timeConstant: number, delay?: number) =>
  tf([gain], convolvePolynomials([0, 1], [1, timeConstant]), delay);

const doubleIntegratorModel = (gain: number, delay?: number) =>
  tf([gain], [0, 0, 1], delay);

const secondOrderModel = (gain: number, zeta: number, omega: number, delay?: number) =>
  tf([gain * omega * omega], [omega * omega, 2 * zeta * omega, 1], delay);

const nonMinimumPhaseModel = (gain: number, zeroTime: number, timeConstant: number, delay?: number) =>
  tf(
    scalePolynomial([1, -zeroTime], gain),
    convolvePolynomials([1, timeConstant], [1, timeConstant * 0.35]),
    delay
  );

const nonMinimumPhaseIntegratorModel = (
  gain: number,
  zeroTime: number,
  timeConstant: number,
  delay?: number
) =>
  tf(
    scalePolynomial([1, -zeroTime], gain),
    convolvePolynomials([0, 1], [1, timeConstant]),
    delay
  );

const unstablePoleModel = (gain: number, timeConstant: number, delay?: number) =>
  tf([gain], [-1, timeConstant], delay);

const unstablePoleWithInertiaModel = (gain: number, timeConstant: number, inertia: number, delay?: number) =>
  tf([gain], convolvePolynomials([-1, timeConstant], [1, inertia]), delay);

const nonMinimumPhaseUnstableModel = (
  gain: number,
  zeroTime: number,
  timeConstant: number,
  inertia: number,
  delay?: number
) =>
  tf(
    scalePolynomial([1, -zeroTime], gain),
    convolvePolynomials([-1, timeConstant], [1, inertia]),
    delay
  );

const highOrderInertiaModel = (gain: number, t1: number, t2: number, t3: number, delay?: number) => {
  const denominator = convolvePolynomials(
    convolvePolynomials([1, t1], [1, t2]),
    [1, t3]
  );
  return tf([gain], denominator, delay);
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
    {
      id: 'controller-vfb',
      label: '测速反馈模块',
      price: 1600,
      unlocks: { controller: 'VFB' },
      requires: ['P'],
      description: '引入速度反馈增强阻尼。',
    },
    {
      id: 'controller-ff',
      label: '前馈模块',
      price: 1800,
      unlocks: { controller: 'FF' },
      requires: ['P'],
      description: '基于给定值的前馈补偿。',
    },
    {
      id: 'controller-smith',
      label: '史密斯预估器',
      price: 2000,
      unlocks: { controller: 'SMITH' },
      requires: ['P'],
      description: '基于模型的延时补偿模块。',
    },
  ],
};

export const CONTROL_BASE_CONTROLLERS: BaseControllerId[] = ['P', 'PI', 'PD', 'PID'];
export const CONTROL_MODULES: ModuleControllerId[] = ['VFB', 'FF', 'SMITH'];
export const CONTROLLER_UPGRADE_RULES: ControllerUpgradeRule[] = [
  { controller: 'P', basePrice: 200, maxLevel: 10, paramLabel: 'Kp' },
  { controller: 'PI', basePrice: 600, maxLevel: 10, paramLabel: 'Ki' },
  { controller: 'PD', basePrice: 600, maxLevel: 10, paramLabel: 'Kd' },
  { controller: 'PID', basePrice: 1200, maxLevel: 10, paramLabel: '综合等级' },
  { controller: 'VFB', basePrice: 800, maxLevel: 10, paramLabel: 'τ' },
  { controller: 'FF', basePrice: 800, maxLevel: 10, paramLabel: 'Kff' },
  { controller: 'SMITH', basePrice: 900, maxLevel: 10, paramLabel: 'L_est' },
];

export const CONTROL_ODYSSEY_LEVELS: ControlOdysseyLevel[] = [
  {
    id: 'level-1',
    name: 'Level 01: 积分环节',
    description: '积分对象，理解累积响应与稳态误差。',
    plantLabel: '积分环节',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-8d214840417a4c3b5780c715',
    ],
    difficulty: 1,
    unlocked: true,
    highScore: 0,
    model: integratorModel(120),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-2',
    name: 'Level 02: 一阶惯性',
    description: '一阶惯性对象，响应滞后。',
    plantLabel: '一阶惯性',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-8d825b96ea1a50aab0eb7e6c',
    ],
    difficulty: 2,
    unlocked: true,
    model: inertialModel(120, 0.6),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-3',
    name: 'Level 03: 积分 + 小惯性',
    description: '积分与惯性耦合，容易超调。',
    plantLabel: '积分 + 小惯性',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-3311578f3f7796d3b9ff0830',
    ],
    difficulty: 3,
    unlocked: true,
    model: integratorInertiaModel(120, 0.6),
    disturbanceTau: 0.8,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-4',
    name: 'Level 04: 积分 + 大惯性',
    description: '大惯性对象，需要提前预判。',
    plantLabel: '积分 + 大惯性',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-5feb0e2f507966e1ca9ac627',
    ],
    difficulty: 4,
    unlocked: false,
    model: integratorInertiaModel(120, 1.8),
    disturbanceTau: 1.2,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-5',
    name: 'Level 05: 积分 + 纯延时',
    description: '控制延时带来的相位滞后。',
    plantLabel: '积分 + 延时',
    relatedCanonicalIds: [
      'ctkg:v3e-object-b0cbf122498bca9269e55406',
    ],
    difficulty: 5,
    unlocked: false,
    model: integratorModel(120, 0.5),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-6',
    name: 'Level 06: 惯性 + 延时',
    description: '惯性与延时叠加，响应更慢。',
    plantLabel: '惯性 + 延时',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-3311578f3f7796d3b9ff0830',
      'ctkg:v3e-object-b0cbf122498bca9269e55406',
    ],
    difficulty: 6,
    unlocked: false,
    model: integratorInertiaModel(120, 1.2, 0.6),
    disturbanceTau: 1.0,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-7',
    name: 'Level 07: 双重积分',
    description: '加速度控制，必须引入阻尼。',
    plantLabel: '双重积分',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-772065f42947b660c72584f3',
    ],
    difficulty: 7,
    unlocked: false,
    model: doubleIntegratorModel(80),
    disturbanceTau: 0.8,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-8',
    name: 'Level 08: 欠阻尼二阶',
    description: '低阻尼振荡特性。',
    plantLabel: '欠阻尼二阶',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-ad988c74286cfcad2c3fdf98',
    ],
    difficulty: 8,
    unlocked: false,
    model: secondOrderModel(100, 0.35, 2.2),
    disturbanceTau: 0.7,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-9',
    name: 'Level 09: 欠阻尼 + 延时',
    description: '振荡系统叠加延时。',
    plantLabel: '欠阻尼 + 延时',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-ad988c74286cfcad2c3fdf98',
      'ctkg:v3e-object-b0cbf122498bca9269e55406',
    ],
    difficulty: 9,
    unlocked: false,
    model: secondOrderModel(100, 0.25, 2.0, 0.4),
    disturbanceTau: 0.7,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-10',
    name: 'Level 10: 非最小相位零点',
    description: '反向响应的非最小相位对象。',
    plantLabel: '非最小相位零点',
    relatedCanonicalIds: [
      'ctkg:v3e-object-5a7582dcb72b1d33d09ca641',
    ],
    difficulty: 10,
    unlocked: false,
    model: nonMinimumPhaseModel(100, 0.8, 1.2),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-11',
    name: 'Level 11: 非最小相位 + 积分',
    description: '反向响应伴随累积环节。',
    plantLabel: '非最小相位 + 积分',
    relatedCanonicalIds: [
      'ctkg:v3e-object-5a7582dcb72b1d33d09ca641',
      'ctkg:v3e-canonical-8d214840417a4c3b5780c715',
    ],
    difficulty: 11,
    unlocked: false,
    model: nonMinimumPhaseIntegratorModel(80, 0.9, 1.0),
    disturbanceTau: 0.8,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-12',
    name: 'Level 12: 开环不稳定',
    description: '右半平面极点导致发散。',
    plantLabel: '开环不稳定',
    relatedCanonicalIds: [
      'ctkg:v3e-object-d09d1eba56a786a96d39d085',
    ],
    difficulty: 12,
    unlocked: false,
    model: unstablePoleModel(60, 1.8),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-13',
    name: 'Level 13: 不稳定 + 延时',
    description: '不稳定对象叠加延时。',
    plantLabel: '不稳定 + 延时',
    relatedCanonicalIds: [
      'ctkg:v3e-object-d09d1eba56a786a96d39d085',
      'ctkg:v3e-object-b0cbf122498bca9269e55406',
    ],
    difficulty: 13,
    unlocked: false,
    model: unstablePoleModel(60, 1.8, 0.3),
    disturbanceTau: 0.6,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-14',
    name: 'Level 14: 三阶惯性链',
    description: '多极点慢动态。',
    plantLabel: '三阶惯性链',
    relatedCanonicalIds: [
      'ctkg:m3-v2h:source-object:552dae0908d9e549e2e5603d',
    ],
    difficulty: 14,
    unlocked: false,
    model: highOrderInertiaModel(100, 0.4, 0.9, 1.6),
    disturbanceTau: 1.0,
    tiers: buildTierConfigs(),
  },
  {
    id: 'level-15',
    name: 'Level 15: 终极混合',
    description: '非最小相位 + 不稳定 + 延时。',
    plantLabel: '终极混合',
    relatedCanonicalIds: [
      'ctkg:v3e-canonical-772065f42947b660c72584f3',
      'ctkg:v3e-object-d09d1eba56a786a96d39d085',
    ],
    difficulty: 15,
    unlocked: false,
    model: nonMinimumPhaseUnstableModel(60, 0.6, 1.5, 0.8, 0.3),
    disturbanceTau: 0.9,
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
  const seed = reference.seed ?? hashSeed(`${tierConfig.tier}:${count}:${minAt}:${maxAt}:${minAmplitude}:${maxAmplitude}:${minGap}`);
  return {
    ...tierConfig,
    reference: {
      ...reference,
      seed,
      events: createStepSequence(
        count,
        minAt,
        maxAt,
        minAmplitude,
        maxAmplitude,
        minGap,
        createSeededRandom(seed),
      ),
    },
  };
};

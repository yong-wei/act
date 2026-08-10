/**
 * Gerstner 波数学层：GPU 着色器与 CPU 参照共用同一公式，
 * 保证着色器行为可被纯函数测试钉住（深水色散关系 c = speed·√(g/k)）。
 */

export interface GerstnerWave {
  /** 传播方向（函数内归一化）。 */
  readonly direction: readonly [number, number];
  /** 振幅（米）。 */
  readonly amplitude: number;
  /** 波长（米）。 */
  readonly wavelength: number;
  /** 波速倍率（乘在深水色散速度上）。 */
  readonly speed: number;
  /** 陡峭度 0..1：水平位移与波峰锐化强度。 */
  readonly steepness: number;
}

export const GERSTNER_MAX_WAVES = 12;

const GRAVITY = 9.8;

function waveNumber(wave: GerstnerWave) {
  return (2 * Math.PI) / wave.wavelength;
}

/** 深水色散波速（米/秒）乘波速倍率。 */
export function gerstnerPhaseSpeed(wave: GerstnerWave) {
  return wave.speed * Math.sqrt(GRAVITY / waveNumber(wave));
}

export interface GerstnerDisplacement {
  /** 垂直位移（米）。 */
  readonly y: number;
  /** 水平位移 x 分量（米）。 */
  readonly offsetX: number;
  /** 水平位移 z 分量（米）。 */
  readonly offsetZ: number;
  /** 波峰因子 0..1：全波同相波峰为 1，波谷为 0，驱动泡沫。 */
  readonly crest: number;
}

export function computeGerstnerDisplacement(
  waves: readonly GerstnerWave[],
  x: number,
  z: number,
  timeSeconds: number
): GerstnerDisplacement {
  let y = 0;
  let offsetX = 0;
  let offsetZ = 0;
  let crestRaw = 0;
  let amplitudeSum = 0;
  for (const wave of waves) {
    const [rawDx, rawDz] = wave.direction;
    const length = Math.hypot(rawDx, rawDz) || 1;
    const dx = rawDx / length;
    const dz = rawDz / length;
    const k = waveNumber(wave);
    const c = gerstnerPhaseSpeed(wave);
    const phase = k * (dx * x + dz * z) - c * k * timeSeconds;
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);
    y += wave.amplitude * sin;
    offsetX += wave.steepness * wave.amplitude * dx * cos;
    offsetZ += wave.steepness * wave.amplitude * dz * cos;
    crestRaw += wave.amplitude * sin;
    amplitudeSum += wave.amplitude;
  }
  const crest = amplitudeSum > 0 ? 0.5 * (1 + crestRaw / amplitudeSum) : 0;
  return { y, offsetX, offsetZ, crest };
}

const WAVE_SET_HIGH: readonly GerstnerWave[] = [
  { direction: [1.0, 0.1], amplitude: 1.1, wavelength: 300, speed: 1.0, steepness: 0.35 },
  { direction: [0.7, 0.7], amplitude: 0.8, wavelength: 210, speed: 1.05, steepness: 0.3 },
  { direction: [-0.3, 1.0], amplitude: 0.65, wavelength: 150, speed: 1.1, steepness: 0.3 },
  { direction: [1.0, -0.4], amplitude: 0.5, wavelength: 110, speed: 1.15, steepness: 0.28 },
  { direction: [0.2, 1.0], amplitude: 0.42, wavelength: 85, speed: 1.2, steepness: 0.26 },
  { direction: [-0.8, 0.5], amplitude: 0.36, wavelength: 64, speed: 1.25, steepness: 0.24 },
  { direction: [0.9, 0.3], amplitude: 0.3, wavelength: 48, speed: 1.3, steepness: 0.22 },
  { direction: [-0.5, -0.8], amplitude: 0.24, wavelength: 36, speed: 1.35, steepness: 0.2 },
  { direction: [0.4, -0.9], amplitude: 0.18, wavelength: 27, speed: 1.45, steepness: 0.18 },
  { direction: [-0.9, -0.2], amplitude: 0.14, wavelength: 20, speed: 1.55, steepness: 0.16 },
  { direction: [0.6, 0.8], amplitude: 0.1, wavelength: 14, speed: 1.7, steepness: 0.14 },
  { direction: [-0.2, -1.0], amplitude: 0.07, wavelength: 9, speed: 1.9, steepness: 0.12 },
];

/** 质量档位波分量：high 12 / medium 8 / low 4，随波长谱系裁剪。 */
export const GERSTNER_WAVE_SETS = {
  high: WAVE_SET_HIGH,
  medium: [0, 1, 2, 3, 5, 7, 9, 11].map((index) => WAVE_SET_HIGH[index]),
  low: [0, 2, 5, 9].map((index) => WAVE_SET_HIGH[index]),
} as const;

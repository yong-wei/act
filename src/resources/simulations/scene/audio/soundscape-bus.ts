/**
 * 音景总线：WebAudio 注入式实现，全部声音当前为程序合成占位
 * （素材来源待 spec 后续裁决，见 change design 第 8 节）。
 * 自动播放策略：任何节点创建都推迟到首次用户手势 unlock 之后。
 */

export interface SoundscapeAudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  resume(): Promise<void> | void;
  createGain(): {
    gain: { value: number; setTargetAtTime: (value: number, time: number, constant: number) => void };
    connect: (node: unknown) => void;
  };
  createBufferSource(): {
    buffer: unknown;
    loop: boolean;
    connect: (node: unknown) => void;
    start: () => void;
    stop: () => void;
  };
  createOscillator(): {
    type: string;
    frequency: { value: number };
    connect: (node: unknown) => void;
    start: () => void;
    stop: (when?: number) => void;
  };
  createBiquadFilter(): {
    type: string;
    frequency: { value: number };
    Q: { value: number };
    connect: (node: unknown) => void;
  };
  createBuffer(channels: number, length: number, sampleRate: number): {
    getChannelData: (channel: number) => Float32Array;
  };
}

export type AmbienceKey = 'calm-sea' | 'dawn-harbor' | 'sunset-coast' | 'overcast-wind' | 'storm';
export type FeedbackKind = 'camera-switch' | 'button';
export type AlertKind = 'warning';

export interface AmbienceProgram {
  /** 低通截止（浪声厚度）。 */
  readonly lowpassHz: number;
  /** 慢速起伏频率（涌浪节奏）。 */
  readonly lfoHz: number;
  /** 基础响度。 */
  readonly baseGain: number;
}

export const AMBIENCE_PROGRAMS: Record<AmbienceKey, AmbienceProgram> = {
  'calm-sea': { lowpassHz: 320, lfoHz: 0.08, baseGain: 0.4 },
  'dawn-harbor': { lowpassHz: 380, lfoHz: 0.06, baseGain: 0.34 },
  'sunset-coast': { lowpassHz: 420, lfoHz: 0.07, baseGain: 0.38 },
  'overcast-wind': { lowpassHz: 520, lfoHz: 0.12, baseGain: 0.46 },
  storm: { lowpassHz: 680, lfoHz: 0.18, baseGain: 0.6 },
};

const FEEDBACK_PROGRAMS: Record<FeedbackKind, { frequencyHz: number; durationSeconds: number }> = {
  'camera-switch': { frequencyHz: 880, durationSeconds: 0.06 },
  button: { frequencyHz: 660, durationSeconds: 0.04 },
};

const ALERT_PROGRAM: Record<AlertKind, readonly number[]> = {
  warning: [520, 780],
};

const MUTED_STORAGE_KEY = 'scene-soundscape-muted';

export function readSoundscapeMutedPreference(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(MUTED_STORAGE_KEY) === 'true';
}

export function writeSoundscapeMutedPreference(
  storage: Pick<Storage, 'setItem'>,
  muted: boolean
): void {
  storage.setItem(MUTED_STORAGE_KEY, muted ? 'true' : 'false');
}

/** 确定性 brown 噪声（LCG 种子，禁止 Math.random：保持场景随机性可重放）。 */
function createBrownNoiseBuffer(context: SoundscapeAudioContextLike, seconds: number, seed: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = (state / 0xffffffff) * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[index] = last * 3.2;
  }
  return buffer;
}

interface AmbienceChain {
  readonly source: { stop: () => void };
  readonly gain: { gain: { value: number; setTargetAtTime: (v: number, t: number, c: number) => void } };
}

export function createSoundscapeBus(context: SoundscapeAudioContextLike) {
  let state: 'locked' | 'unlocked' = 'locked';
  let muted = false;
  let ambienceKey: AmbienceKey | null = null;
  let ambienceChain: AmbienceChain | null = null;
  let masterGain: ReturnType<SoundscapeAudioContextLike['createGain']> | null = null;

  const startAmbience = () => {
    if (!ambienceKey || !masterGain) return;
    ambienceChain?.source.stop();
    const program = AMBIENCE_PROGRAMS[ambienceKey];
    const source = context.createBufferSource();
    source.buffer = createBrownNoiseBuffer(context, 4, 0x5eed);
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = program.lowpassHz;
    const gain = context.createGain();
    gain.gain.value = program.baseGain;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    ambienceChain = { source, gain };
  };

  return {
    get state() {
      return state;
    },
    get ambienceKey() {
      return ambienceKey;
    },
    unlock() {
      if (state === 'unlocked') return;
      context.resume();
      masterGain = context.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(context.destination);
      state = 'unlocked';
      startAmbience();
    },
    setAmbience(key: AmbienceKey) {
      ambienceKey = key;
      if (state === 'unlocked') startAmbience();
    },
    playFeedback(kind: FeedbackKind) {
      if (state !== 'unlocked' || !masterGain) return;
      const program = FEEDBACK_PROGRAMS[kind];
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = program.frequencyHz;
      oscillator.connect(masterGain);
      oscillator.start();
      oscillator.stop(context.currentTime + program.durationSeconds);
    },
    playAlert(kind: AlertKind) {
      if (state !== 'unlocked' || !masterGain) return;
      for (const frequency of ALERT_PROGRAM[kind]) {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        oscillator.connect(masterGain);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.18);
      }
    },
    mute() {
      muted = true;
      masterGain?.gain.setTargetAtTime(0, context.currentTime, 0.02);
    },
    unmute() {
      muted = false;
      masterGain?.gain.setTargetAtTime(1, context.currentTime, 0.02);
    },
  };
}

export type SoundscapeBus = ReturnType<typeof createSoundscapeBus>;

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AMBIENCE_PROGRAMS,
  createSoundscapeBus,
  readSoundscapeMutedPreference,
  writeSoundscapeMutedPreference,
  type SoundscapeAudioContextLike,
} from '../scene/audio/soundscape-bus';

const AUDIO_DIR = path.join(process.cwd(), 'src/resources/simulations/scene/audio');

function createFakeContext() {
  const calls = {
    gain: 0,
    bufferSource: 0,
    oscillator: 0,
    biquad: 0,
    resume: 0,
    sourceStop: 0,
    close: 0,
  };
  const context: SoundscapeAudioContextLike & { calls: typeof calls; close: () => void } = {
    calls,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume() {
      calls.resume += 1;
    },
    close() {
      calls.close += 1;
    },
    createGain() {
      calls.gain += 1;
      return {
        gain: { value: 1, setTargetAtTime: () => undefined },
        connect: () => undefined,
      };
    },
    createBufferSource() {
      calls.bufferSource += 1;
      return {
        buffer: null,
        loop: false,
        connect: () => undefined,
        start: () => undefined,
        stop: () => {
          calls.sourceStop += 1;
        },
      };
    },
    createOscillator() {
      calls.oscillator += 1;
      return {
        type: 'sine',
        frequency: { value: 440 },
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createBiquadFilter() {
      calls.biquad += 1;
      return {
        type: 'lowpass',
        frequency: { value: 350 },
        Q: { value: 1 },
        connect: () => undefined,
      };
    },
    createBuffer: () => ({ getChannelData: () => new Float32Array(16) }),
  };
  return context;
}

describe('soundscape muted preference', () => {
  const createFakeStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
  };

  it('defaults to unmuted (default-on) and persists mute across reads', () => {
    const storage = createFakeStorage();
    expect(readSoundscapeMutedPreference(storage)).toBe(false);
    writeSoundscapeMutedPreference(storage, true);
    expect(readSoundscapeMutedPreference(storage)).toBe(true);
    writeSoundscapeMutedPreference(storage, false);
    expect(readSoundscapeMutedPreference(storage)).toBe(false);
  });
});

describe('soundscape bus', () => {
  it('creates no audio nodes before the first user gesture unlock', () => {
    const context = createFakeContext();
    const bus = createSoundscapeBus(context);
    bus.setAmbience('calm-sea');
    bus.playFeedback('camera-switch');
    expect(bus.state).toBe('locked');
    expect(context.calls.gain).toBe(0);
    expect(context.calls.bufferSource).toBe(0);
    expect(context.calls.oscillator).toBe(0);
  });

  it('starts ambience only after unlock, driven by the current preset ambience', () => {
    const context = createFakeContext();
    const bus = createSoundscapeBus(context);
    bus.setAmbience('storm');
    bus.unlock();
    expect(bus.state).toBe('unlocked');
    expect(context.calls.resume).toBe(1);
    expect(context.calls.bufferSource).toBeGreaterThan(0);
    expect(bus.ambienceKey).toBe('storm');
  });

  it('covers every preset ambience key with a synthesis program', () => {
    for (const key of ['calm-sea', 'dawn-harbor', 'sunset-coast', 'overcast-wind', 'storm'] as const) {
      expect(AMBIENCE_PROGRAMS[key]).toBeDefined();
      expect(AMBIENCE_PROGRAMS[key].baseGain).toBeGreaterThan(0);
    }
  });

  it('plays interaction feedback and alerts only when unlocked', () => {
    const context = createFakeContext();
    const bus = createSoundscapeBus(context);
    bus.unlock();
    bus.playFeedback('camera-switch');
    expect(context.calls.oscillator).toBe(1);
    bus.playAlert('warning');
    expect(context.calls.oscillator).toBe(3);
  });

  it('stops the ambience source and closes the audio context on dispose', () => {
    const context = createFakeContext();
    const bus = createSoundscapeBus(context);
    bus.setAmbience('calm-sea');
    bus.unlock();
    expect(context.calls.bufferSource).toBeGreaterThan(0);
    bus.dispose();
    expect(context.calls.sourceStop).toBe(1);
    expect(context.calls.close).toBe(1);
    expect(bus.state).toBe('locked');
    expect(bus.ambienceKey).toBeNull();
  });
});

describe('sample experiment soundscape wiring', () => {
  it('mounts provider, ambience driver, and mute toggle in the sample experiment', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('SceneSoundscapeProvider');
    expect(destroyer).toContain('SoundscapeAmbienceDriver');
    expect(destroyer).toContain('SoundscapeMuteToggle');
  });

  it('synthesizes placeholder sounds without audio asset files', () => {
    const bus = readFileSync(path.join(AUDIO_DIR, 'soundscape-bus.ts'), 'utf8');
    expect(bus).not.toContain('.mp3');
    expect(bus).not.toContain('.wav');
    expect(bus).not.toContain('.ogg');
  });
});

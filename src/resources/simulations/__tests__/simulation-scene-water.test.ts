import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  computeGerstnerDisplacement,
  GERSTNER_MAX_WAVES,
  GERSTNER_WAVE_SETS,
  type GerstnerWave,
} from '../scene/water/gerstner-waves';

const SINGLE_WAVE: GerstnerWave = {
  direction: [1, 0],
  amplitude: 2,
  wavelength: 40,
  speed: 1,
  steepness: 0.5,
};

describe('gerstner wave sets', () => {
  it('scales wave component counts down across quality tiers', () => {
    expect(GERSTNER_WAVE_SETS.high.length).toBe(GERSTNER_MAX_WAVES);
    expect(GERSTNER_WAVE_SETS.high.length).toBeGreaterThan(GERSTNER_WAVE_SETS.medium.length);
    expect(GERSTNER_WAVE_SETS.medium.length).toBeGreaterThan(GERSTNER_WAVE_SETS.low.length);
    for (const tier of ['high', 'medium', 'low'] as const) {
      expect(GERSTNER_WAVE_SETS[tier].length).toBeLessThanOrEqual(GERSTNER_MAX_WAVES);
    }
  });
});

describe('computeGerstnerDisplacement', () => {
  it('returns zero vertical displacement at zero phase and full amplitude at quarter period', () => {
    const k = (2 * Math.PI) / SINGLE_WAVE.wavelength;
    const c = SINGLE_WAVE.speed * Math.sqrt(9.8 / k);
    // f = k*x - c*k*t = 0 时 sin(f) = 0
    expect(computeGerstnerDisplacement([SINGLE_WAVE], 0, 0, 0).y).toBeCloseTo(0, 6);
    // f = π/2 → x = (π/2 + c*k*t)/k，取 t=0
    const crest = computeGerstnerDisplacement([SINGLE_WAVE], Math.PI / 2 / k, 0, 0);
    expect(crest.y).toBeCloseTo(SINGLE_WAVE.amplitude, 6);
  });

  it('sharpens crests with horizontal displacement proportional to steepness', () => {
    // f = 0 → cos(f) = 1，水平偏移 = steepness * amplitude * direction
    const atZero = computeGerstnerDisplacement([SINGLE_WAVE], 0, 0, 0);
    expect(atZero.offsetX).toBeCloseTo(SINGLE_WAVE.steepness * SINGLE_WAVE.amplitude, 6);
    expect(atZero.offsetZ).toBeCloseTo(0, 6);
  });

  it('is deterministic for identical inputs', () => {
    const waves = GERSTNER_WAVE_SETS.high;
    const a = computeGerstnerDisplacement(waves, 12.5, -7.25, 3.75);
    const b = computeGerstnerDisplacement(waves, 12.5, -7.25, 3.75);
    expect(a).toEqual(b);
  });

  it('is periodic in time with the deep-water dispersion relation scaled by speed', () => {
    const k = (2 * Math.PI) / SINGLE_WAVE.wavelength;
    const c = SINGLE_WAVE.speed * Math.sqrt(9.8 / k);
    const period = SINGLE_WAVE.wavelength / c;
    const a = computeGerstnerDisplacement([SINGLE_WAVE], 3.3, 0, 1.1);
    const b = computeGerstnerDisplacement([SINGLE_WAVE], 3.3, 0, 1.1 + period);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(b.offsetX).toBeCloseTo(a.offsetX, 6);
  });

  it('reports crest factor near one at wave peaks and near zero at troughs', () => {
    const k = (2 * Math.PI) / SINGLE_WAVE.wavelength;
    const crest = computeGerstnerDisplacement([SINGLE_WAVE], Math.PI / 2 / k, 0, 0);
    const trough = computeGerstnerDisplacement([SINGLE_WAVE], (3 * Math.PI) / 2 / k, 0, 0);
    expect(crest.crest).toBeCloseTo(1, 6);
    expect(trough.crest).toBeCloseTo(0, 6);
  });
});

describe('gerstner water material and component', () => {
  const readSource = (file: string) =>
    readFileSync(path.join(process.cwd(), 'src/resources/simulations/scene/water', file), 'utf8');

  it('exposes a material factory with wave-count uniform capped at the maximum', () => {
    const source = readSource('gerstner-water-material.ts');
    expect(source).toContain('uWaveCount');
    expect(source).toContain('uTime');
    expect(source).toContain('GERSTNER_MAX_WAVES');
  });

  it('samples the copied foam noise texture for crest foam', () => {
    const source = readSource('gerstner-water.tsx');
    expect(source).toContain('ocean-foam-noise-alpha.png');
  });

  it('mounts GerstnerWater in the sample experiment and retires the local sine water', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('<GerstnerWater');
    expect(destroyer).not.toContain('function WaveWater(');
  });
});

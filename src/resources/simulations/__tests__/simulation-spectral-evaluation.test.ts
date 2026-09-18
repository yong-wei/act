import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateSpectralBackends,
  experimentalDirectionalSpectrum,
  spectrumStatistics,
  type SpectralBackendMeasurement,
  type SpectralExperimentControls,
} from '@/resources/simulations/scene/water/spectral-evaluation';

const ROOT = process.cwd();

const CONTROLS: SpectralExperimentControls = {
  vesselId: 'type055',
  cameraView: 'chase',
  drawingBufferWidth: 1920,
  drawingBufferHeight: 1080,
  environmentPresetId: 'open-sea',
  seaState: 4,
  foamEnabled: true,
  materialStack: 'shared-gerstner-material',
  fftResolution: 128,
  fftCascades: 1,
};

const BASE: Omit<SpectralBackendMeasurement, 'backend'> = {
  significantWaveHeightMeters: null,
  repeatabilityDeltaMeters: null,
  frameP95Ms: null,
  firstLoadMs: null,
  cpuQueryStrategy: null,
  visualQualityNotes: null,
};

describe('spectral experiment controls (#2105)', () => {
  it('defines controlled variables identically across candidates (fair comparison)', () => {
    // 受控变量进入报告且不可按候选漂移：报告结构只携带一份 controls。
    const measurement = (backend: SpectralBackendMeasurement['backend']): SpectralBackendMeasurement => ({
      ...BASE,
      backend,
});
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [measurement('gerstner-analytic'), measurement('webgl-fft')],
      unresolvedDifferences: ['FFT 候选的级联覆盖与解析波组的频带边界不同（声明不归因给后端）'],
      hardwareContext: null,
    });
    expect(report.controls.materialStack).toBe('shared-gerstner-material');
    expect(report.controls.fftResolution).toBe(128);
    expect(report.unresolvedDifferences).toHaveLength(1);
  });

  it('does not activate production changes regardless of findings', () => {
    const strongEvidence: SpectralBackendMeasurement[] = [
      { ...BASE, backend: 'gerstner-analytic', frameP95Ms: 14.2, visualQualityNotes: '基线', cpuQueryStrategy: 'analytic-closed-form' },
      { ...BASE, backend: 'webgpu-fft', frameP95Ms: 12.8, visualQualityNotes: '高频细节显著', cpuQueryStrategy: 'gpu-readback-partial' },
    ];
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: strongEvidence,
      unresolvedDifferences: [],
      hardwareContext: 'Apple M2 (mock)',
    });
    // 证据齐备也只输出建议：adopt-candidate-change 表示"提出下一项单独 change"，
    // 决不直接改生产默认——判定词与 rationale 均如此声明。
    expect(['adopt-candidate-change', 'defer-more-evidence']).toContain(report.verdict);
    expect(report.rationale).toContain('不改生产默认');
  });
});

describe('spectral verdict rules (#2105)', () => {
  it('keeps the current path when evidence is insufficient (no measurements)', () => {
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...BASE, backend: 'gerstner-analytic' },
        { ...BASE, backend: 'webgl-fft' },
        { ...BASE, backend: 'webgpu-fft' },
      ],
      unresolvedDifferences: [],
      hardwareContext: null,
    });
    expect(report.verdict).toBe('keep-current-path');
    expect(report.rationale).toContain('实测证据不足');
  });

  it('disqualifies candidates that require full-texture readback every frame', () => {
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...BASE, backend: 'gerstner-analytic', frameP95Ms: 14.2, visualQualityNotes: '基线', cpuQueryStrategy: 'analytic-closed-form' },
        { ...BASE, backend: 'webgl-fft', frameP95Ms: 15.1, visualQualityNotes: '细节多', cpuQueryStrategy: 'gpu-readback-full-per-frame' },
      ],
      unresolvedDifferences: [],
      hardwareContext: 'mock',
    });
    expect(report.rationale).toContain('逐帧同步读回');
    expect(report.rationale).toContain('webgl-fft');
  });
});

describe('experimental spectrum statistics (#2105)', () => {
  it('is reproducible for the same seed and inputs', () => {
    const input = { windSpeedMps: 12, fetchMeters: 50000, directionBins: 8, frequencyBins: 16, seed: 17 };
    const first = experimentalDirectionalSpectrum(input);
    const replay = experimentalDirectionalSpectrum(input);
    expect(replay).toEqual(first);
    expect(first).toHaveLength(8 * 16);
  });

  it('computes Hs and peak period from the directional spectrum (not a screenshot)', () => {
    const spectrum = experimentalDirectionalSpectrum({
      windSpeedMps: 12, fetchMeters: 50000, directionBins: 4, frequencyBins: 8, seed: 3,
    });
    const stats = spectrumStatistics(spectrum);
    expect(stats.significantWaveHeightMeters).toBeGreaterThan(0);
    expect(stats.peakPeriodSeconds).toBeGreaterThan(0);
    // 空谱退化安全。
    expect(spectrumStatistics([])).toEqual({ significantWaveHeightMeters: 0, peakPeriodSeconds: 0 });
  });

  it('integrates spectral density so Hs is resolution-invariant (fair cross-candidate stats)', () => {
    const build = (bins: number) => spectrumStatistics(experimentalDirectionalSpectrum({
      windSpeedMps: 12, fetchMeters: 50000, directionBins: 4, frequencyBins: bins, seed: 3,
    }));
    // 网格加密（8→32 频率格）不人为放大有效波高（密度×Δf 积分）。
    const coarse = build(8);
    const fine = build(32);
    expect(Math.abs(fine.significantWaveHeightMeters - coarse.significantWaveHeightMeters))
      .toBeLessThan(coarse.significantWaveHeightMeters * 0.25);
  });

  it('derives stronger seas from stronger wind (monotone Hs)', () => {
    const light = spectrumStatistics(experimentalDirectionalSpectrum({
      windSpeedMps: 5, fetchMeters: 50000, directionBins: 4, frequencyBins: 8, seed: 3,
    }));
    const strong = spectrumStatistics(experimentalDirectionalSpectrum({
      windSpeedMps: 20, fetchMeters: 50000, directionBins: 4, frequencyBins: 8, seed: 3,
    }));
    expect(strong.significantWaveHeightMeters).toBeGreaterThan(light.significantWaveHeightMeters);
  });
});

describe('production invariants (#2105 contracts)', () => {
  it('keeps the evaluation module out of the production water stack', () => {
    // 评估模块零生产引用：GerstnerWater/材质不 import spectral-evaluation。
    const consumers = [
      'src/resources/simulations/scene/water/gerstner-water.tsx',
      'src/resources/simulations/scene/water/gerstner-water-material.ts',
    ];
    for (const file of consumers) {
      const source = readFileSync(path.join(ROOT, file), 'utf-8');
      expect(source, file).not.toContain('spectral-evaluation');
    }
    // 七船型亦不引用（实验隔离）。
    for (const vessel of ['destroyer', 'cruise', 'container', 'lng', 'dredger', 'drilling', 'icebreaker']) {
      const source = readFileSync(
        path.join(ROOT, `src/resources/simulations/simulations/${vessel}-simulation.tsx`),
        'utf-8',
      );
      expect(source, vessel).not.toContain('spectral-evaluation');
    }
  });

  it('keeps the default ocean backend unchanged (Gerstner remains the only production water)', () => {
    const water = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/water/gerstner-water.tsx'),
      'utf-8',
    );
    expect(water).toContain('NEAR_FIELD_VISIBLE_WAVES');
    expect(water).not.toContain('fft');
    expect(water).not.toContain('computePipeline');
  });
});

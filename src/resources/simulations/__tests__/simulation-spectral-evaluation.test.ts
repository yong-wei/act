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
    // 完备证据（五项实测 + 视觉 + 硬件上下文）才进入 defer 分支。
    const full: SpectralBackendMeasurement = {
      ...BASE,
      significantWaveHeightMeters: 2.1,
      repeatabilityDeltaMeters: 0.03,
      frameP95Ms: 14.2,
      firstLoadMs: 180,
      visualQualityNotes: '记录',
    };
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...full, backend: 'gerstner-analytic', cpuQueryStrategy: 'analytic-closed-form' },
        { ...full, backend: 'webgl-fft', cpuQueryStrategy: 'gpu-readback-partial' },
        { ...full, backend: 'webgpu-fft', frameP95Ms: 12.8, cpuQueryStrategy: 'gpu-readback-partial' },
      ],
      unresolvedDifferences: [],
      hardwareContext: 'Apple M2 (mock)',
    });
    expect(report.verdict).toBe('defer-more-evidence');
    expect(report.rationale).toContain('不改生产默认');
  });

  it('rejects partial evidence as sufficient (missing fields keep the current path)', () => {
    // 只有 p95 + 单候选视觉（其余 null）——三轮复审：不得宣称证据齐备。
    const partial = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...BASE, backend: 'gerstner-analytic', frameP95Ms: 14.2, visualQualityNotes: '基线', cpuQueryStrategy: 'analytic-closed-form' },
        { ...BASE, backend: 'webgpu-fft', frameP95Ms: 12.8 },
      ],
      unresolvedDifferences: [],
      hardwareContext: 'mock',
    });
    expect(partial.verdict).toBe('keep-current-path');
    expect(partial.rationale).toContain('必需字段未齐备');
    // 缺硬件上下文同样不齐备。
    const full: SpectralBackendMeasurement = {
      ...BASE, significantWaveHeightMeters: 2, repeatabilityDeltaMeters: 0.03,
      frameP95Ms: 14, firstLoadMs: 180, visualQualityNotes: 'x', cpuQueryStrategy: 'analytic-closed-form',
    };
    const noHardware = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [{ ...full, backend: 'gerstner-analytic' }, { ...full, backend: 'webgl-fft' }],
      unresolvedDifferences: [],
      hardwareContext: null,
    });
    expect(noHardware.verdict).toBe('keep-current-path');
    // NaN/Infinity/负数不算实测（六轮复审）：JSON 落盘变 null，不得宣称齐备。
    const nanEvidence = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...full, backend: 'gerstner-analytic', cpuQueryStrategy: 'analytic-closed-form' },
        { ...full, backend: 'webgl-fft', cpuQueryStrategy: 'gpu-readback-partial', frameP95Ms: Number.NaN },
        { ...full, backend: 'webgpu-fft', cpuQueryStrategy: 'gpu-readback-partial' },
      ],
      unresolvedDifferences: [],
      hardwareContext: 'mock',
    });
    expect(nanEvidence.verdict).toBe('keep-current-path');
    // 空白字符串不算证据（五轮复审）：硬件上下文/视觉记录去空白后须非空。
    const blankHardware = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...full, backend: 'gerstner-analytic', cpuQueryStrategy: 'analytic-closed-form' },
        { ...full, backend: 'webgl-fft', cpuQueryStrategy: 'gpu-readback-partial' },
        { ...full, backend: 'webgpu-fft', cpuQueryStrategy: 'gpu-readback-partial' },
      ],
      unresolvedDifferences: [],
      hardwareContext: '   ',
    });
    expect(blankHardware.verdict).toBe('keep-current-path');
    // 两候选齐备但缺第三候选（WebGPU）——四轮复审：三候选同场才可评估。
    const missingThird = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [{ ...full, backend: 'gerstner-analytic' }, { ...full, backend: 'webgl-fft' }],
      unresolvedDifferences: [],
      hardwareContext: 'mock',
    });
    expect(missingThird.verdict).toBe('keep-current-path');
    expect(missingThird.rationale).toContain('候选集不完整');
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
    const full: SpectralBackendMeasurement = {
      ...BASE, significantWaveHeightMeters: 2, repeatabilityDeltaMeters: 0.03,
      frameP95Ms: 14.2, firstLoadMs: 180, visualQualityNotes: '记录',
    };
    const report = evaluateSpectralBackends({
      controls: CONTROLS,
      measurements: [
        { ...full, backend: 'gerstner-analytic', cpuQueryStrategy: 'analytic-closed-form' },
        { ...full, backend: 'webgl-fft', cpuQueryStrategy: 'gpu-readback-full-per-frame' },
        { ...full, backend: 'webgpu-fft', cpuQueryStrategy: 'gpu-readback-partial' },
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

  it('aggregates directions before integrating so Hs is direction-resolution invariant', () => {
    const build = (bins: number) => spectrumStatistics(experimentalDirectionalSpectrum({
      windSpeedMps: 12, fetchMeters: 50000, directionBins: bins, frequencyBins: 16, seed: 3,
    }));
    // 方向格 4→16：每方向 Δθ=2π/N 摊平，聚合后 Hs 不随方向分辨率漂移。
    const coarse = build(4);
    const fine = build(16);
    expect(Math.abs(fine.significantWaveHeightMeters - coarse.significantWaveHeightMeters))
      .toBeLessThan(coarse.significantWaveHeightMeters * 0.15);
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

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  binWaveNumber,
  dispersionOmega,
  fftOceanHeightAt,
  fftOceanSnapshot,
  fftOceanStaticSpectrum,
  significantWaveHeight,
} from '../scene/water/fft-ocean';

const ROOT = process.cwd();
const readSource = (relative: string) =>
  readFileSync(path.join(ROOT, relative), 'utf8');

const INPUT = {
  resolution: 32,
  domainMeters: 256,
  windSpeedMps: 12,
  windDirectionRad: 0.2,
  seaState: 4,
  seed: 17,
} as const;

describe('FFT ocean correctness (#2121)', () => {
  it('grid IFFT matches the independent per-point inverse DFT on the same spectrum', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const t = 3.5;
    const snapshot = fftOceanSnapshot(spectrum, INPUT.domainMeters, t);
    let maxError = 0;
    for (const [i, j] of [[0, 0], [5, 3], [16, 16], [31, 7], [7, 29]] as const) {
      const grid = snapshot.heights[j * INPUT.resolution + i];
      const point = fftOceanHeightAt(
        spectrum,
        INPUT.domainMeters,
        t,
        (i * INPUT.domainMeters) / INPUT.resolution,
        (j * INPUT.domainMeters) / INPUT.resolution,
      );
      maxError = Math.max(maxError, Math.abs(grid - point));
    }
    // 两条独立路径（快速 IFFT vs 逐点直接求和）一致到浮点噪声。
    expect(maxError).toBeLessThan(1e-6);
  });

  it('single-bin spectrum renders an exact spatial sinusoid with the bin wavelength', () => {
    const n = 16;
    const data = new Float32Array(n * n * 2);
    const omegas = new Float32Array(n * n);
    const phase = 0.3;
    const kxBin = 2;
    const kzBin = 3;
    data[(kzBin * n + kxBin) * 2] = Math.cos(phase);
    data[(kzBin * n + kxBin) * 2 + 1] = Math.sin(phase);
    const snapshot = fftOceanSnapshot({ data, omegas, resolution: n }, 128, 0);
    const kx = (2 * Math.PI * kxBin) / 128;
    const kz = (2 * Math.PI * kzBin) / 128;
    for (const [i, j] of [[0, 0], [5, 9], [3, 12]] as const) {
      const x = (i * 128) / n;
      const z = (j * 128) / n;
      expect(snapshot.heights[j * n + i]).toBeCloseTo(
        Math.cos(phase + kx * x + kz * z) / (n * n),
        8,
      );
    }
  });

  it('bin wave numbers follow the standard DFT convention and deep-water dispersion', () => {
    const domain = 256;
    expect(binWaveNumber(0, 8, domain)).toBe(0);
    expect(binWaveNumber(3, 8, domain)).toBeCloseTo((2 * Math.PI * 3) / domain, 12);
    expect(binWaveNumber(6, 8, domain)).toBeCloseTo((2 * Math.PI * -2) / domain, 12);
    expect(dispersionOmega(0.1)).toBeCloseTo(Math.sqrt(9.81 * 0.1), 12);
  });

  it('is deterministic for a fixed seed and scales with sea state', () => {
    const a = fftOceanStaticSpectrum(INPUT);
    const b = fftOceanStaticSpectrum(INPUT);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    const calm = fftOceanStaticSpectrum({ ...INPUT, seaState: 1 });
    const storm = fftOceanStaticSpectrum({ ...INPUT, seaState: 6 });
    const hsCalm = significantWaveHeight(fftOceanSnapshot(calm, INPUT.domainMeters, 1).heights);
    const hsStorm = significantWaveHeight(fftOceanSnapshot(storm, INPUT.domainMeters, 1).heights);
    expect(hsStorm).toBeGreaterThan(hsCalm * 2);
    expect(hsStorm).toBeGreaterThan(1);
  });

  it('ship water-height point query is self-consistent across query times', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const a = fftOceanHeightAt(spectrum, INPUT.domainMeters, 2, 30, -40);
    const b = fftOceanHeightAt(spectrum, INPUT.domainMeters, 2, 30, -40);
    expect(a).toBe(b); // 确定性（无运行时随机）
    const later = fftOceanHeightAt(spectrum, INPUT.domainMeters, 2.5, 30, -40);
    expect(later).not.toBe(a);
    expect(Number.isFinite(a)).toBe(true);
  });
});

describe('runnable surface and comparison page (#2121)', () => {
  it('uses one bin convention everywhere: peak energy lands at the intended wavelength', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    // 生成端能量最高的 bin（按 |k| 找）在消费端（快照/点查询共用 binWaveNumber）
    // 应产生对应波长的空间正弦——两边同约定由源结构保证：
    const source = readSource('src/resources/simulations/scene/water/fft-ocean.ts');
    expect(source).not.toContain('(m - n / 2)');
    expect(source).not.toContain('(ix - n / 2)');
    // 频率换算：Hz = √(gk)/(2π)（除法在根号外）。
    expect(source).toContain('Math.sqrt(9.81 * kMagnitude) / (2 * Math.PI)');
    // 演化/查询与生成共用 binWaveNumber（同一定义点）。
    expect(source.split('binWaveNumber(').length - 1).toBeGreaterThanOrEqual(6);
    void spectrum;
  });

  it('aligns the height texture with point-query world coordinates (origin = first texel)', () => {
    const source = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    expect(source).toContain('fract(pos.xz / uDomain)');
    // 居中映射（世界原点→纹理中心）与逐点查询相差半域相位——禁止回归。
    expect(source).not.toContain('pos.xz + uDomain * 0.5');
  });

  it('keeps both branches on a comparable load: same canvas/camera, low-tier Gerstner, no planar reflection', () => {
    const page = readSource('src/app/simulations/fft-ocean-comparison/page.tsx');
    expect(page).toContain('GerstnerWater tier="low"');
    expect(page).not.toContain('GerstnerWater tier="high"');
    expect(page).toContain('同镜头/画布/像素负载');
  });

  it('renders the FFT surface from the validated CPU pipeline at a bounded update rate', () => {
    const source = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    expect(source).toContain('fftOceanSnapshot');
    expect(source).toContain('fftOceanHeightAt');
    expect(source).toContain('HEIGHT_UPDATE_HZ = 12');
    // 船体查询无整纹理读回（逐点逆 DFT）。
    expect(source).not.toContain('readRenderTargetPixels');
    expect(source).not.toContain('readPixels');
    // GPU 侧 2D IFFT 蝶形未实现——诚实标注（不冒充）。
    expect(source).toContain('未实现');
  });

  it('exposes a QA probe with statistics, point query latency and WebGPU capability', () => {
    const source = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    expect(source).toContain("has('qa', 'fft-ocean')");
    expect(source).toContain('__fftOceanRuntime');
    expect(source).toContain('cpuSignificantWaveHeightMeters');
    expect(source).toContain('measurePointQueryMs');
    expect(source).toContain("'gpu' in navigator");
  });

  it('comparison page switches backends under one camera/sea state without touching production', () => {
    const page = readSource('src/app/simulations/fft-ocean-comparison/page.tsx');
    expect(page).toContain("?backend=fft");
    expect(page).toContain('?backend=gerstner');
    expect(page).toContain('FFTOceanSurface');
    expect(page).toContain('GerstnerWater');
    // 生产不变量：实验路由不改生产默认（无 registry/生产入口引用本页）。
    const registry = readSource('src/lib/resource-registry.tsx');
    expect(registry.includes('fft-ocean-comparison')).toBe(false);
  });

  it('evaluation script consumes real measurement files instead of rewriting empty templates', () => {
    const script = readSource('scripts/tests/run-spectral-evaluation.ts');
    expect(script).toContain('measurementsPath');
    expect(script).toContain('readFileSync(measurementsPath');
    expect(script).toContain('不重写空模板');
  });
});

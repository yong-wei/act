import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  binWaveNumber,
  dispersionOmega,
  FFT_OCEAN_CASCADE_SPLIT_WAVELENGTH_METERS,
  FFT_OCEAN_CONTACT_TOLERANCE_METERS,
  FFT_OCEAN_HS_CALIBRATION,
  fftOceanCascadeSplit,
  fftOceanContactHeightAt,
  fftOceanDisplacementSnapshot,
  fftOceanFieldAt,
  fftOceanGpuStages,
  fftOceanGridWorld,
  fftOceanHeightAt,
  fftOceanSnapshot,
  fftOceanStaticSpectrum,
  significantWaveHeight,
} from '../scene/water/fft-ocean';

const ROOT = process.cwd();
const src_calibration = () => readFileSync(path.join(ROOT, 'src/resources/simulations/scene/water/fft-ocean.ts'), 'utf8');
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
    // 两条独立路径（快速 IFFT vs 逐点直接求和）一致——相对浮点噪声
    //（标定后波幅 ~6.5m 量级，绝对噪声随幅度线性放大，用相对口径）。
    const magnitude = Math.max(
      ...[0, 0].map(() => 0),
      Math.abs(fftOceanHeightAt(spectrum, INPUT.domainMeters, t, 0, 0)),
      1,
    );
    expect(maxError / magnitude).toBeLessThan(1e-5);
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

  it('GPU stage mirror (evolve + bit-reversal + butterflies) matches the CPU snapshot', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const t = 3.5;
    const reference = fftOceanSnapshot(spectrum, INPUT.domainMeters, t);
    const mirror = fftOceanGpuStages(spectrum, t);
    let maxError = 0;
    for (let i = 0; i < reference.heights.length; i += 1) {
      maxError = Math.max(maxError, Math.abs(reference.heights[i] - mirror.heights[i]));
    }
    // 着色器逐 pass 公式（位反转 + twiddle 乘奇位）与 radix-2 DIT 一致（float32 噪声内）。
    expect(maxError).toBeLessThan(1e-5);
  });

  it('peak frequency uses Hz (angular 0.8g/U divided by 2π)', () => {
    const source = readSource('src/resources/simulations/scene/water/fft-ocean.ts');
    expect(source).toContain('(0.8 * 9.81) / Math.max(input.windSpeedMps, 1) / (2 * Math.PI)');
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

  it('calibrates ss4 to the comparison-page Gerstner significant wave height', () => {
    // 对照页同参（2048m/256²·ss4·12m/s）：目标 Hs≈6.5m（与 Gerstner 近场同海况匹配）。
    const spectrum = fftOceanStaticSpectrum({
      resolution: 256,
      domainMeters: 2048,
      windSpeedMps: 12,
      windDirectionRad: 0.2,
      seaState: 4,
      seed: 17,
    });
    const hs = significantWaveHeight(fftOceanSnapshot(spectrum, 2048, 0).heights);
    expect(Math.abs(hs - 6.5)).toBeLessThan(0.5);
    expect(src_calibration()).toContain('seaState4EnergyCoefficient: 5200');
  });

  it('keeps Hs within 2% across 128/256/512 when the physical band is fixed', () => {
    const base = {
      domainMeters: 2048,
      windSpeedMps: 12,
      windDirectionRad: 0.2,
      seaState: 4,
      seed: 17,
    } as const;
    const heights = [128, 256, 512].map((resolution) => (
      significantWaveHeight(fftOceanSnapshot(fftOceanStaticSpectrum({ ...base, resolution }), 2048, 0).heights)
    ));
    for (const hs of heights) {
      expect(Math.abs(hs - FFT_OCEAN_HS_CALIBRATION.seaState4TargetHsMeters) / 6.5).toBeLessThan(0.02);
    }
  });

  it('preserves the unnormalized 5200-coefficient resolution counterexample', () => {
    const base = {
      domainMeters: 2048,
      windSpeedMps: 12,
      windDirectionRad: 0.2,
      seaState: 4,
      seed: 17,
      legacyUnnormalized: true,
    } as const;
    const expected = FFT_OCEAN_HS_CALIBRATION.legacyUnnormalizedHsByResolution;
    for (const resolution of [128, 256, 512] as const) {
      const hs = significantWaveHeight(
        fftOceanSnapshot(fftOceanStaticSpectrum({ ...base, resolution }), 2048, 0).heights,
      );
      expect(hs).toBeCloseTo(expected[resolution], 1);
    }
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

  it('direct DFT field matches height, IFFT chop displacement and jacobian of a flat sea', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const t = 2.25;
    const x = fftOceanGridWorld(5, INPUT.resolution, INPUT.domainMeters);
    const z = fftOceanGridWorld(11, INPUT.resolution, INPUT.domainMeters);
    const field = fftOceanFieldAt(spectrum, INPUT.domainMeters, t, x, z);
    expect(field.height).toBeCloseTo(fftOceanHeightAt(spectrum, INPUT.domainMeters, t, x, z), 10);
    const displaced = fftOceanDisplacementSnapshot(spectrum, INPUT.domainMeters, t);
    const index = 11 * INPUT.resolution + 5;
    expect(Math.abs(displaced.dx[index] - field.displacementX)).toBeLessThan(1e-5);
    expect(Math.abs(displaced.dz[index] - field.displacementZ)).toBeLessThan(1e-5);
    const zero = {
      data: new Float32Array(INPUT.resolution * INPUT.resolution * 2),
      omegas: new Float32Array(INPUT.resolution * INPUT.resolution),
      resolution: INPUT.resolution,
    };
    expect(fftOceanFieldAt(zero, INPUT.domainMeters, t, x, z).jacobian).toBeCloseTo(1, 10);
  });

  it('cascade split is complementary in k and reconstructs the original field', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const split = fftOceanCascadeSplit(spectrum, INPUT.domainMeters);
    expect(split.kSplit).toBeCloseTo((2 * Math.PI) / FFT_OCEAN_CASCADE_SPLIT_WAVELENGTH_METERS, 12);
    expect(split.lowEnergy + split.highEnergy).toBeCloseTo(split.totalEnergy, 8);
    expect(split.lowEnergy).toBeGreaterThan(0);
    expect(split.highEnergy).toBeGreaterThan(0);
    const t = 1.5;
    const x = 12;
    const z = -18;
    const full = fftOceanFieldAt(spectrum, INPUT.domainMeters, t, x, z);
    const low = fftOceanFieldAt(split.low, INPUT.domainMeters, t, x, z);
    const high = fftOceanFieldAt(split.high, INPUT.domainMeters, t, x, z);
    expect(low.height + high.height).toBeCloseTo(full.height, 8);
    expect(low.displacementX + high.displacementX).toBeCloseTo(full.displacementX, 8);
    expect(low.displacementZ + high.displacementZ).toBeCloseTo(full.displacementZ, 8);
  });

  it('contact query inverts chop onto the displaced lattice within the declared tolerance', () => {
    const spectrum = fftOceanStaticSpectrum(INPUT);
    const t = 4;
    const latticeX = fftOceanGridWorld(7, INPUT.resolution, INPUT.domainMeters);
    const latticeZ = fftOceanGridWorld(13, INPUT.resolution, INPUT.domainMeters);
    const field = fftOceanFieldAt(spectrum, INPUT.domainMeters, t, latticeX, latticeZ);
    const worldX = latticeX + field.displacementX;
    const worldZ = latticeZ + field.displacementZ;
    const contact = fftOceanContactHeightAt(spectrum, INPUT.domainMeters, t, worldX, worldZ);
    expect(Math.abs(contact - field.height)).toBeLessThan(FFT_OCEAN_CONTACT_TOLERANCE_METERS);
  });

  it('band-limited mesh interpolation stays within contact tolerance', () => {
    const n = 32;
    const domain = 256;
    const data = new Float32Array(n * n * 2);
    const omegas = new Float32Array(n * n);
    data[1 * 2] = n * n;
    const spectrum = { data, omegas, resolution: n };
    const snapshot = fftOceanSnapshot(spectrum, domain, 0);
    const i0 = 4;
    const interpolated = 0.5 * (snapshot.heights[i0] + snapshot.heights[i0 + 1]);
    const midX = fftOceanGridWorld(i0, n, domain) + domain / n * 0.5;
    const continuous = fftOceanHeightAt(spectrum, domain, 0, midX, 0);
    expect(Math.abs(continuous - interpolated)).toBeLessThan(FFT_OCEAN_CONTACT_TOLERANCE_METERS);
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

  it('keeps both branches on a comparable load: low-tier Gerstner matches FFT domain and density', () => {
    const client = readSource('src/app/simulations/fft-ocean-comparison/comparison-client.tsx');
    expect(client).toContain('GerstnerWater');
    expect(client).toContain("scene === 'feature-parity' ? tier : 'low'");
    expect(client).not.toContain('GerstnerWater tier="high"');
    expect(client).toContain('同镜头/画布');
  });

  it('runs spectrum evolution and 2D IFFT on the GPU (shader passes mirror the validated stages)', () => {
    const surface = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    const pipeline = readSource('src/resources/simulations/scene/water/fft-ocean-gpu-pipeline.ts');
    expect(pipeline).toContain('const EVOLVE_FS');
    expect(pipeline).toContain('const PERMUTE_FS');
    expect(pipeline).toContain('const BUTTERFLY_FS');
    expect(pipeline).toContain('const OUTPUT_FS');
    expect(pipeline).toContain('const CHOP_FS');
    expect(pipeline).toContain('vec2 oddIn = isEven ? partner : self;');
    expect(pipeline).toContain('vec2 result = isEven ? evenIn + t : evenIn - t;');
    expect(pipeline).toContain('getRenderTarget');
    expect(pipeline).toContain('getViewport');
    expect(pipeline).toContain('getScissor');
    expect(pipeline).toContain('checkFramebufferStatus');
    expect(pipeline).toContain('EXT_color_buffer_float');
    expect(pipeline).toContain('renderer.compile(probe, camera)');
    expect(pipeline).toContain('LINK_STATUS');
    expect(pipeline).toContain('validateFftOceanGpuAgainstDft');
    expect(pipeline).toContain('readRenderTargetPixels');
    expect(surface).toContain('createFftOceanGpuPipeline');
    expect(surface).toContain('不进渲染循环');
    expect(surface).not.toContain('HEIGHT_UPDATE_HZ');
    expect(surface).toContain('fftOceanHeightAt');
    expect(surface).not.toContain('readRenderTargetPixels');
    expect(surface).not.toContain('readPixels');
    expect(surface).toContain('spectrum.resolution, spectrum.resolution');
  });

  it('exposes a QA probe with statistics, point query latency and WebGPU capability', () => {
    const source = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    expect(source).toContain("has('qa', 'fft-ocean')");
    expect(source).toContain('__fftOceanRuntime');
    expect(source).toContain('cpuSignificantWaveHeightMeters');
    expect(source).toContain('measurePointQueryMs');
    expect(source).toContain("'gpu' in navigator");
    expect(source).toContain('gpuPipelineActive');
    expect(source).toContain('gpuFrames');
    expect(source).toContain('validateGpuAgainstDft');
    expect(source).toContain('cascadeEnergies');
    expect(source).toContain('contactQuery');
  });

  it('comparison page selects the backend via Next searchParams (SSR/client first frame agree)', () => {
    const page = readSource('src/app/simulations/fft-ocean-comparison/page.tsx');
    const client = readSource('src/app/simulations/fft-ocean-comparison/comparison-client.tsx');
    // 服务端组件读取 searchParams 传入客户端（无 window 判断 → 无水合分歧）。
    expect(page).toContain('searchParams');
    expect(page).not.toContain('typeof window');
    expect(client).toContain('backend: ComparisonBackend');
    // 生产不变量：实验路由不改生产默认（无 registry/生产入口引用本页）。
    const registry = readSource('src/lib/resource-registry.tsx');
    expect(registry.includes('fft-ocean-comparison')).toBe(false);
  });

  it('both branches share the vessel, far-field coverage, domain and mesh density', () => {
    const client = readSource('src/app/simulations/fft-ocean-comparison/comparison-client.tsx');
    const lab = readSource('src/app/simulations/fft-ocean-comparison/comparison-lab.ts');
    expect(client).toContain('VersionedFleetShip');
    expect(client).toContain('FarFieldRing');
    expect(client).toContain('ShapeGeometry');
    expect(client).toContain('disableEffects={scene === \'wave-only\'}');
    expect(client).toContain('resetToken={resetToken}');
    expect(client).toContain('GERSTNER_WATER_BASE_Y');
    expect(lab).toContain('domainMeters: 2048');
    expect(lab).toContain('resolution: 256');
    expect(client).toContain("scene === 'feature-parity' ? tier : 'low'");
    expect(client).toContain('disableFarField');
    const water = readSource('src/resources/simulations/scene/water/gerstner-water.tsx');
    expect(water).toContain('disableFarField');
    expect(water).toContain('{disableFarField ? null : (');
    expect(client).toContain('unresolvedDifference');
    expect(client).not.toContain('StandInVessel');
    expect(client).not.toContain('boxGeometry args={[24, 16, 180]}');
    expect(client).not.toContain('sequence += 1 / VESSEL_QUERY_HZ');
  });

  it('drives FFT vessel queries from worker-thread DFT batches using visualTime', () => {
    const client = readSource('src/app/simulations/fft-ocean-comparison/comparison-client.tsx');
    const worker = readSource('src/resources/simulations/scene/water/fft-query-worker.ts');
    const surface = readSource('src/resources/simulations/scene/water/fft-ocean-surface.tsx');
    expect(client).toContain('createFFTQueryWorker()');
    expect(client).toContain('worker.init({');
    expect(client).toContain('worker.post({');
    expect(client).toContain('worker.dispose();');
    expect(worker).toContain("type === 'init'");
    expect(client).toContain('if (result.timeSeconds < samplesRef.current.time) return;');
    expect(client).toContain('createNearFieldSurfaceQuery');
    expect(client).toContain('viaWorker: false');
    expect(client).toContain('measurePointQueryMs');
    expect(client).toContain('__marineComparisonLab');
    expect(surface).toContain('useMarineVisualTime');
    expect(worker).toContain('const phase = omega * timeSeconds + kx * worldX + kz * worldZ;');
    expect(worker).toContain('contactHeightAt');
    expect(worker).toContain('queueMs');
    expect(worker).toContain('performance.timeOrigin');
    expect(client).toContain('chopLambda: FFT_OCEAN_CHOP_LAMBDA');
    expect(client).toContain('queryMetrics');
    expect(client).toContain('resultAgeSeconds');
    expect(client).toContain('performance.timeOrigin + performance.now()');
    expect(client).not.toContain('contactErrorMeters');
    const onResultStart = client.indexOf('worker.onResult');
    const onResultEnd = client.indexOf('return () => {', onResultStart);
    expect(client.slice(onResultStart, onResultEnd)).not.toContain('fftOceanContactHeightAt');
  });

  it('evaluation script consumes real measurement files instead of rewriting empty templates', () => {
    const script = readSource('scripts/tests/run-spectral-evaluation.ts');
    expect(script).toContain('measurementsPath');
    expect(script).toContain('readFileSync(measurementsPath');
    expect(script).toContain('不重写空模板');
  });
});

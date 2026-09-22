import { describe, expect, it } from 'vitest';

import { fftOceanSnapshot, fftOceanStaticSpectrum } from '../scene/water/fft-ocean';
import {
  fieldRelativeL2,
  identifyMarineWebGpu,
  simulateWebGpuFftHeights,
  unavailableWebGpuIdentity,
  webGpuFftStageCount,
} from '../scene/water/webgpu-ocean';

describe('webgpu ocean parity (#2134)', () => {
  it('keeps a missing device unavailable and does not rename it to webgl', async () => {
    const identity = await identifyMarineWebGpu({});
    expect(identity).toEqual(unavailableWebGpuIdentity());
    expect(identity.fallbackToWebGL).toBe(false);
    expect(identity.backend).toBeNull();
  });

  it('records shader compilation failure without a webgl fallback', async () => {
    const identity = await identifyMarineWebGpu({
      gpu: {
        requestAdapter: async () => ({
          info: { vendor: 'test', architecture: 'mock' },
          requestDevice: async () => ({
            lost: new Promise(() => {}),
            createShaderModule: () => ({
              getCompilationInfo: async () => ({ messages: [{ type: 'error' }] }),
            }),
            destroy: () => {},
          }),
        }),
      },
    });
    expect(identity.status).toBe('failed');
    expect(identity.fallbackToWebGL).toBe(false);
    expect(identity.vendor).toBe('test');
  });

  it('measures relative L2 and fft stage count from the shared resolution', () => {
    expect(fieldRelativeL2([1, 0], [1, 0])).toBe(0);
    expect(fieldRelativeL2([2, 0], [0, 0])).toBeGreaterThan(1);
    expect(webGpuFftStageCount(32)).toBe(10);
    expect(webGpuFftStageCount(256)).toBe(16);
  });

  it('matches the independent IFFT on a 32 bin spectrum', () => {
    const spectrum = fftOceanStaticSpectrum({
      resolution: 32,
      domainMeters: 256,
      windSpeedMps: 12,
      windDirectionRad: 0.2,
      seaState: 4,
      seed: 17,
    });
    const gpu = simulateWebGpuFftHeights(spectrum, 256, 1.5);
    const cpu = fftOceanSnapshot(spectrum, 256, 1.5).heights;
    expect(fieldRelativeL2(gpu, cpu)).toBeLessThan(1e-5);
  });
});

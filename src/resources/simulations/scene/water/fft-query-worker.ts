/**
 * FFT 海面船体查询 Worker（#2121 复审六轮）：完整 256² 逆 DFT 批次 ~30ms 级——
 * 在 Worker 线程执行（主线程/被测 RAF 零占用）；结果按查询时间戳回传，
 * 主线程按序消费（过期结果丢弃）。
 *
 * Worker 内联源：与 fft-ocean.ts 的 fftOceanHeightAt 同公式（复制为自包含
 * 实现——Worker 无模块图；一致性由主线程测试对同一谱双路径钉住）。
 */

const WORKER_SOURCE = `
function dispersionOmega(k) { return Math.sqrt(9.81 * Math.max(k, 1e-9)); }
function binWaveNumber(index, resolution, domainMeters) {
  const folded = index <= resolution / 2 ? index : index - resolution;
  return (2 * Math.PI * folded) / domainMeters;
}
function heightAt(spectrum, resolution, domain, timeSeconds, worldX, worldZ) {
  let sum = 0;
  for (let m = 0; m < resolution; m += 1) {
    const kz = binWaveNumber(m, resolution, domain);
    for (let ix = 0; ix < resolution; ix += 1) {
      const kx = binWaveNumber(ix, resolution, domain);
      const omega = dispersionOmega(Math.hypot(kx, kz));
      const phase = omega * timeSeconds + kx * worldX + kz * worldZ;
      const index = (m * resolution + ix) * 2;
      sum += spectrum[index] * Math.cos(phase) - spectrum[index + 1] * Math.sin(phase);
    }
  }
  return sum / (resolution * resolution);
}
self.onmessage = (event) => {
  const { spectrum, resolution, domain, queries, timeSeconds } = event.data;
  const results = queries.map(([x, z]) => heightAt(spectrum, resolution, domain, timeSeconds, x, z));
  self.postMessage({ timeSeconds, results });
};
`;

export interface FFTQueryWorkerResult {
  readonly timeSeconds: number;
  readonly results: readonly number[];
}

export interface FFTQueryWorkerInput {
  readonly spectrum: Float32Array;
  readonly resolution: number;
  readonly domain: number;
  readonly queries: ReadonlyArray<readonly [number, number]>;
  readonly timeSeconds: number;
}

/**
 * 创建船体查询 Worker（自包含 Blob 源）。失败（如环境不支持）返回 null——
 * 调用方回退到主线程低频查询并如实标记。
 */
export function createFFTQueryWorker(): {
  readonly post: (input: FFTQueryWorkerInput) => void;
  readonly onResult: (handler: (result: FFTQueryWorkerResult) => void) => void;
  readonly dispose: () => void;
} | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
  } catch {
    return null;
  }
  let handler: ((result: FFTQueryWorkerResult) => void) | null = null;
  worker.onmessage = (event: MessageEvent<FFTQueryWorkerResult>) => {
    handler?.(event.data);
  };
  return {
    post(input) {
      worker.postMessage(input);
    },
    onResult(next) {
      handler = next;
    },
    dispose() {
      worker.terminate();
    },
  };
}

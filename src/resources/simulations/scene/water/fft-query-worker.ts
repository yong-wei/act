/**
 * FFT 海面船体查询 Worker（#2131）：静态谱只初始化一次，后续只传时间与点。
 * 接触查询含 chop 反解；回传计算耗时与排队，主线程再记端到端与结果年龄。
 */

const WORKER_SOURCE = `
function dispersionOmega(k) { return Math.sqrt(9.81 * Math.max(k, 1e-9)); }
function binWaveNumber(index, resolution, domainMeters) {
  const folded = index <= resolution / 2 ? index : index - resolution;
  return (2 * Math.PI * folded) / domainMeters;
}
function fieldAt(spectrum, resolution, domain, timeSeconds, worldX, worldZ, chopLambda) {
  const inv = 1 / (resolution * resolution);
  let height = 0;
  let displacementX = 0;
  let displacementZ = 0;
  let dDxDx = 0;
  let dDzDz = 0;
  let dDxDz = 0;
  let dDzDx = 0;
  for (let m = 0; m < resolution; m += 1) {
    const kz = binWaveNumber(m, resolution, domain);
    for (let ix = 0; ix < resolution; ix += 1) {
      const kx = binWaveNumber(ix, resolution, domain);
      const kMagnitude = Math.hypot(kx, kz);
      const omega = dispersionOmega(kMagnitude);
      const phase = omega * timeSeconds + kx * worldX + kz * worldZ;
      const index = (m * resolution + ix) * 2;
      const re = spectrum[index];
      const im = spectrum[index + 1];
      const cos = Math.cos(phase);
      const sin = Math.sin(phase);
      const heightTerm = re * cos - im * sin;
      height += heightTerm;
      if (kMagnitude > 1e-6) {
        const imagRot = -im * cos - re * sin;
        const kxHat = kx / kMagnitude;
        const kzHat = kz / kMagnitude;
        displacementX += imagRot * kxHat;
        displacementZ += imagRot * kzHat;
        const realNeg = -heightTerm;
        dDxDx += realNeg * kx * kxHat;
        dDzDz += realNeg * kz * kzHat;
        dDxDz += realNeg * kz * kxHat;
        dDzDx += realNeg * kx * kzHat;
      }
    }
  }
  return {
    height: height * inv,
    displacementX: chopLambda * displacementX * inv,
    displacementZ: chopLambda * displacementZ * inv,
    mapXx: 1 + chopLambda * dDxDx * inv,
    mapXz: chopLambda * dDxDz * inv,
    mapZx: chopLambda * dDzDx * inv,
    mapZz: 1 + chopLambda * dDzDz * inv,
  };
}
function contactHeightAt(spectrum, resolution, domain, timeSeconds, worldX, worldZ, chopLambda) {
  let latticeX = worldX;
  let latticeZ = worldZ;
  for (let step = 0; step < 3; step += 1) {
    const sample = fieldAt(spectrum, resolution, domain, timeSeconds, latticeX, latticeZ, chopLambda);
    const residualX = latticeX + sample.displacementX - worldX;
    const residualZ = latticeZ + sample.displacementZ - worldZ;
    const det = sample.mapXx * sample.mapZz - sample.mapXz * sample.mapZx;
    if (Math.abs(det) < 1e-8) break;
    latticeX -= (sample.mapZz * residualX - sample.mapXz * residualZ) / det;
    latticeZ -= (-sample.mapZx * residualX + sample.mapXx * residualZ) / det;
  }
  return fieldAt(spectrum, resolution, domain, timeSeconds, latticeX, latticeZ, chopLambda).height;
}
let cached = null;
self.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    cached = {
      spectrum: message.spectrum,
      resolution: message.resolution,
      domain: message.domain,
      chopLambda: message.chopLambda,
    };
    return;
  }
  if (!cached) return;
  const startedMs = performance.now();
  const startedAbs = performance.timeOrigin + startedMs;
  const { queries, timeSeconds, postedAt } = message;
  const results = queries.map(([x, z]) => contactHeightAt(
    cached.spectrum,
    cached.resolution,
    cached.domain,
    timeSeconds,
    x,
    z,
    cached.chopLambda,
  ));
  const computeMs = performance.now() - startedMs;
  self.postMessage({
    timeSeconds,
    results,
    computeMs,
    queueMs: Math.max(0, startedAbs - postedAt),
    postedAt,
  });
};
`;

export interface FFTQueryWorkerResult {
  readonly timeSeconds: number;
  readonly results: readonly number[];
  readonly computeMs: number;
  readonly queueMs: number;
  readonly postedAt: number;
}

export interface FFTQueryWorkerInit {
  readonly type: 'init';
  readonly spectrum: Float32Array;
  readonly resolution: number;
  readonly domain: number;
  readonly chopLambda: number;
}

export interface FFTQueryWorkerQuery {
  readonly type: 'query';
  readonly queries: ReadonlyArray<readonly [number, number]>;
  readonly timeSeconds: number;
  readonly postedAt: number;
}

/**
 * 创建船体查询 Worker（自包含 Blob 源）。失败返回 null——
 * 调用方回退到主线程低频查询并如实标记。
 */
export function createFFTQueryWorker(): {
  readonly init: (input: Omit<FFTQueryWorkerInit, 'type'>) => void;
  readonly post: (input: Omit<FFTQueryWorkerQuery, 'type' | 'postedAt'> & { readonly postedAt?: number }) => void;
  readonly onResult: (handler: (result: FFTQueryWorkerResult) => void) => void;
  readonly dispose: () => void;
} | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  let objectUrl: string;
  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    objectUrl = URL.createObjectURL(blob);
    worker = new Worker(objectUrl);
  } catch {
    return null;
  }
  let handler: ((result: FFTQueryWorkerResult) => void) | null = null;
  worker.onmessage = (event: MessageEvent<FFTQueryWorkerResult>) => {
    handler?.(event.data);
  };
  return {
    init(input) {
      worker.postMessage({ type: 'init', ...input });
    },
    post(input) {
      worker.postMessage({
        type: 'query',
        queries: input.queries,
        timeSeconds: input.timeSeconds,
        postedAt: input.postedAt ?? (performance.timeOrigin + performance.now()),
      });
    },
    onResult(next) {
      handler = next;
    },
    dispose() {
      worker.terminate();
      URL.revokeObjectURL(objectUrl);
    },
  };
}

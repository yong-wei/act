/**
 * WebGPU 海洋实验后端（#2134）。
 * 计算与绘制都走 WebGPURenderer 的设备；初始化失败时保持不可用，不改走 WebGL。
 */

import {
  attributeArray,
  cos,
  float,
  Fn,
  instanceIndex,
  PI2,
  select,
  sin,
  sqrt,
  uint,
  vec2,
  vec4,
} from 'three/tsl';
import type { StorageBufferAttribute } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';

import {
  fftOceanDisplacementSnapshot,
  fftOceanSnapshot,
  type ComplexGrid,
} from './fft-ocean';
import { computeGerstnerDisplacement, type GerstnerWave } from './gerstner-waves';

export type MarineWebGpuStatus = 'ready' | 'unavailable' | 'failed';

export interface MarineWebGpuIdentity {
  readonly status: MarineWebGpuStatus;
  readonly backend: string | null;
  readonly vendor: string | null;
  readonly architecture: string | null;
  readonly deviceLost: boolean;
  /** 失败或缺失时仍为 false：不得把 WebGL 记成 WebGPU。 */
  readonly fallbackToWebGL: false;
}

export interface MarineWebGpuProbe {
  readonly gpu?: {
    requestAdapter: () => Promise<{
      readonly info?: { vendor?: string; architecture?: string; description?: string };
      requestDevice: () => Promise<{
        lost: Promise<{ message: string }>;
        createShaderModule: (descriptor: { code: string }) => { getCompilationInfo?: () => Promise<{ messages: Array<{ type: string }> }> };
        destroy: () => void;
      }>;
    } | null>;
  };
}

export function unavailableWebGpuIdentity(): MarineWebGpuIdentity {
  return {
    status: 'unavailable',
    backend: null,
    vendor: null,
    architecture: null,
    deviceLost: false,
    fallbackToWebGL: false,
  };
}

/** 应用边界注入：没有 gpu 时明确不可用，不创建 WebGL 上下文。 */
export async function identifyMarineWebGpu(probe?: MarineWebGpuProbe): Promise<MarineWebGpuIdentity> {
  const resolved = probe ?? {
    gpu: typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { gpu?: MarineWebGpuProbe['gpu'] }).gpu,
  };
  const gpu = resolved.gpu;
  if (!gpu) return unavailableWebGpuIdentity();
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    return { ...unavailableWebGpuIdentity(), status: 'failed' };
  }
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: '@compute @workgroup_size(1) fn main() {}' });
  const info = await module.getCompilationInfo?.();
  const failed = info?.messages.some((message) => message.type === 'error') ?? false;
  const vendor = adapter.info?.vendor ?? null;
  const architecture = adapter.info?.architecture ?? adapter.info?.description ?? null;
  let deviceLost = false;
  device.lost.then(() => {
    deviceLost = true;
  }).catch(() => {
    deviceLost = true;
  });
  device.destroy();
  if (failed) {
    return { status: 'failed', backend: 'webgpu', vendor, architecture, deviceLost, fallbackToWebGL: false };
  }
  return { status: 'ready', backend: 'webgpu', vendor, architecture, deviceLost: false, fallbackToWebGL: false };
}

export function fieldRelativeL2(actual: ArrayLike<number>, expected: ArrayLike<number>): number {
  let err2 = 0;
  let ref2 = 0;
  const count = Math.min(actual.length, expected.length);
  for (let i = 0; i < count; i += 1) {
    const delta = actual[i] - expected[i];
    err2 += delta * delta;
    ref2 += expected[i] * expected[i];
  }
  return Math.sqrt(err2 / Math.max(ref2, 1e-30));
}

export function webGpuFftStageCount(resolution: number): number {
  return Math.round(Math.log2(resolution)) * 2;
}

/** 与 compute shader 同一套下标，用来在没有 GPU 时核对蝶形。 */
export function simulateWebGpuFftHeights(
  spectrum: ComplexGrid,
  domainMeters: number,
  timeSeconds: number,
): Float32Array {
  const n = spectrum.resolution;
  const bits = Math.round(Math.log2(n));
  const reverse = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) reverse[i] = bitReverse(i, bits);
  const evolved = new Float32Array(n * n * 2);
  for (let row = 0; row < n; row += 1) {
    const kzIndex = row <= n / 2 ? row : row - n;
    const kz = (2 * Math.PI * kzIndex) / domainMeters;
    for (let col = 0; col < n; col += 1) {
      const kxIndex = col <= n / 2 ? col : col - n;
      const kx = (2 * Math.PI * kxIndex) / domainMeters;
      const omega = Math.sqrt(9.81 * Math.max(Math.hypot(kx, kz), 1e-9));
      const angle = omega * timeSeconds;
      const index = (row * n + col) * 2;
      const re = spectrum.data[index];
      const im = spectrum.data[index + 1];
      evolved[index] = re * Math.cos(angle) - im * Math.sin(angle);
      evolved[index + 1] = re * Math.sin(angle) + im * Math.cos(angle);
    }
  }
  let current = evolved;
  let other = new Float32Array(evolved.length);
  const read = (buffer: Float32Array, index: number) => [buffer[index * 2], buffer[index * 2 + 1]] as const;
  const write = (buffer: Float32Array, index: number, re: number, im: number) => {
    buffer[index * 2] = re;
    buffer[index * 2 + 1] = im;
  };
  for (const axis of [0, 1]) {
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const srcRow = axis === 0 ? row : reverse[row];
        const srcCol = axis === 0 ? reverse[col] : col;
        const [re, im] = read(current, srcRow * n + srcCol);
        write(other, row * n + col, re, im);
      }
    }
    [current, other] = [other, current];
    for (let stage = 0; stage < bits; stage += 1) {
      const len = 2 ** (stage + 1);
      const half = len / 2;
      other.fill(0);
      for (let thread = 0; thread < (n * n) / 2; thread += 1) {
        const line = Math.floor(thread / (n / 2));
        const inner = thread % (n / 2);
        const group = Math.floor(inner / half);
        const k = inner % half;
        const evenAxis = group * len + k;
        const oddAxis = evenAxis + half;
        const evenIndex = axis === 0 ? line * n + evenAxis : evenAxis * n + line;
        const oddIndex = axis === 0 ? line * n + oddAxis : oddAxis * n + line;
        const [aRe, aIm] = read(current, evenIndex);
        const [bRe, bIm] = read(current, oddIndex);
        const angle = (2 * Math.PI * k) / len;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);
        const tRe = wRe * bRe - wIm * bIm;
        const tIm = wRe * bIm + wIm * bRe;
        write(other, evenIndex, aRe + tRe, aIm + tIm);
        write(other, oddIndex, aRe - tRe, aIm - tIm);
      }
      [current, other] = [other, current];
    }
    for (let i = 0; i < n * n; i += 1) {
      current[i * 2] /= n;
      current[i * 2 + 1] /= n;
    }
  }
  const heights = new Float32Array(n * n);
  for (let i = 0; i < heights.length; i += 1) heights[i] = current[i * 2];
  return heights;
}

function bitReverse(index: number, bits: number): number {
  let value = index;
  let result = 0;
  for (let bit = 0; bit < bits; bit += 1) {
    result = (result << 1) | (value & 1);
    value >>= 1;
  }
  return result;
}

interface StorageNode {
  element: (index: unknown) => any;
  value: StorageBufferAttribute;
}

function asStorage(node: unknown): StorageNode {
  return node as StorageNode;
}

const DIRECT_DFT_SHADER = `
fn bin_k(i: u32, n: u32, domain: f32) -> f32 {
  let folded = select(i32(i) - i32(n), i32(i), i <= n / 2u);
  return 6.283185307179586 * f32(folded) / domain;
}

struct Params {
  n: u32,
  time: f32,
  domain: f32,
  pad: f32,
}

@group(0) @binding(0) var<storage, read> spectrum: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> heights: array<f32>;
@group(0) @binding(2) var<storage, read_write> slopes: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn height_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  let count = n * n;
  if (gid.x >= count) { return; }
  let col = gid.x % n;
  let row = gid.x / n;
  let x = f32(col) * params.domain / f32(n);
  let z = f32(row) * params.domain / f32(n);
  var sum = 0.0;
  for (var m: u32 = 0u; m < n; m = m + 1u) {
    let kz = bin_k(m, n, params.domain);
    for (var ix: u32 = 0u; ix < n; ix = ix + 1u) {
      let kx = bin_k(ix, n, params.domain);
      let omega = sqrt(9.81 * max(sqrt(kx * kx + kz * kz), 1e-9));
      let phase = omega * params.time + kx * x + kz * z;
      let sample = spectrum[m * n + ix];
      sum = sum + sample.x * cos(phase) - sample.y * sin(phase);
    }
  }
  heights[gid.x] = sum / f32(count);
}

@compute @workgroup_size(64)
fn slope_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  let col = gid.x % n;
  let row = gid.x / n;
  let right = heights[row * n + (col + 1u) % n];
  let left = heights[row * n + (col + n - 1u) % n];
  let cell = params.domain / f32(n);
  slopes[gid.x] = (right - left) / (2.0 * cell);
}
`;

const GPU_MAP_READ = 0x0001;
const GPU_COPY_SRC = 0x0004;
const GPU_COPY_DST = 0x0008;
const GPU_UNIFORM = 0x0040;
const GPU_STORAGE = 0x0080;
const GPU_SHADER_COMPUTE = 0x4;

async function readStorageFloats(device: any, source: any, floatCount: number): Promise<Float32Array> {
  const byteLength = floatCount * 4;
  const readback = device.createBuffer({
    size: byteLength,
    usage: GPU_COPY_DST | GPU_MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_READ);
  const copy = new Float32Array(readback.getMappedRange().slice(0));
  readback.destroy();
  return copy;
}

async function runDirectWebGpuDft(
  renderer: WebGPURenderer,
  spectrum: ComplexGrid,
  domainMeters: number,
  timeSeconds: number,
): Promise<{ heights: Float32Array; slope: Float32Array }> {
  const device: any = (renderer as unknown as { backend: { device: unknown } }).backend.device;
  const n = spectrum.resolution;
  const count = n * n;
  const module = device.createShaderModule({ code: DIRECT_DFT_SHADER });
  const compiled = await module.getCompilationInfo();
  const errors = compiled.messages.filter((message: { type: string }) => message.type === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((message: { message: string }) => message.message).join('\n'));
  }
  const params = new ArrayBuffer(16);
  const paramsView = new DataView(params);
  paramsView.setUint32(0, n, true);
  paramsView.setFloat32(4, timeSeconds, true);
  paramsView.setFloat32(8, domainMeters, true);
  const spectrumBuffer = device.createBuffer({
    size: spectrum.data.byteLength,
    usage: GPU_STORAGE | GPU_COPY_DST,
  });
  const heightBuffer = device.createBuffer({
    size: count * 4,
    usage: GPU_STORAGE | GPU_COPY_SRC,
  });
  const slopeBuffer = device.createBuffer({
    size: count * 4,
    usage: GPU_STORAGE | GPU_COPY_SRC,
  });
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPU_UNIFORM | GPU_COPY_DST,
  });
  device.queue.writeBuffer(spectrumBuffer, 0, spectrum.data);
  device.queue.writeBuffer(uniformBuffer, 0, params);
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'uniform' } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const heightPipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module, entryPoint: 'height_main' },
  });
  const slopePipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module, entryPoint: 'slope_main' },
  });
  const bound = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: spectrumBuffer } },
      { binding: 1, resource: { buffer: heightBuffer } },
      { binding: 2, resource: { buffer: slopeBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const heightPass = encoder.beginComputePass();
  heightPass.setPipeline(heightPipeline);
  heightPass.setBindGroup(0, bound);
  heightPass.dispatchWorkgroups(Math.ceil(count / 64));
  heightPass.end();
  const slopePass = encoder.beginComputePass();
  slopePass.setPipeline(slopePipeline);
  slopePass.setBindGroup(0, bound);
  slopePass.dispatchWorkgroups(Math.ceil(count / 64));
  slopePass.end();
  device.queue.submit([encoder.finish()]);
  const heights = await readStorageFloats(device, heightBuffer, count);
  const slope = await readStorageFloats(device, slopeBuffer, count);
  spectrumBuffer.destroy();
  heightBuffer.destroy();
  slopeBuffer.destroy();
  uniformBuffer.destroy();
  return { heights, slope };
}

export interface WebGpuOceanField {
  readonly resolution: number;
  readonly heights: Float32Array;
  readonly dx: Float32Array;
  readonly slope: Float32Array;
  readonly heightL2: number;
  readonly displacementL2: number;
  readonly slopeL2: number;
  readonly nativeBackend: boolean;
  readonly fieldNode: any;
  readonly probeHeights: readonly number[];
  readonly referenceHeights: readonly number[];
  dispose: () => void;
}

export async function computeWebGpuOceanField(
  renderer: WebGPURenderer,
  input: {
    readonly algorithm: 'fft' | 'gerstner';
    readonly spectrum?: ComplexGrid;
    readonly waves?: readonly GerstnerWave[];
    readonly domainMeters: number;
    readonly timeSeconds: number;
    readonly amplitudeScale?: number;
  },
): Promise<WebGpuOceanField> {
  const backendName = (renderer as unknown as { backend?: { constructor?: { name?: string } } }).backend?.constructor?.name ?? '';
  const nativeBackend = backendName === 'WebGPUBackend';
  if (!nativeBackend) {
    throw new Error('WebGPU ocean compute requires a WebGPU backend');
  }
  const resolution = input.algorithm === 'fft'
    ? input.spectrum?.resolution ?? 0
    : 64;
  if (resolution < 8 || (resolution & (resolution - 1)) !== 0) {
    throw new Error('WebGPU ocean resolution must be a power of two');
  }
  const count = resolution * resolution;
  const spectrumNode = asStorage(attributeArray(count, 'vec2'));
  const ping = asStorage(attributeArray(count, 'vec2'));
  const pong = asStorage(attributeArray(count, 'vec2'));
  const field = asStorage(attributeArray(count, 'vec4'));
  const resources = [spectrumNode.value, ping.value, pong.value, field.value];
  const timeSeconds = input.timeSeconds;
  const domainMeters = input.domainMeters;
  const bits = Math.round(Math.log2(resolution));
  const reverse = new Uint32Array(resolution);
  for (let i = 0; i < resolution; i += 1) reverse[i] = bitReverse(i, bits);
  const reverseNode = asStorage(attributeArray(reverse, 'uint'));
  resources.push(reverseNode.value);

  const dispose = () => {
    for (const resource of resources) resource.dispose?.();
  };

  let directHeights: Float32Array | null = null;
  let directSlope: Float32Array | null = null;
  if (input.algorithm === 'gerstner') {
    const waves = input.waves ?? [];
    const scale = input.amplitudeScale ?? 1;
    const node = Fn(() => {
      const id = instanceIndex;
      const n = uint(resolution);
      const x = float(id.mod(n)).div(float(resolution - 1)).sub(0.5).mul(domainMeters);
      const z = float(id.div(n)).div(float(resolution - 1)).sub(0.5).mul(domainMeters);
      let y: any = float(0);
      let ox: any = float(0);
      let oz: any = float(0);
      let crest: any = float(0);
      for (const wave of waves) {
        const length = Math.hypot(wave.direction[0], wave.direction[1]) || 1;
        const dx = wave.direction[0] / length;
        const dz = wave.direction[1] / length;
        const k = (2 * Math.PI) / wave.wavelength;
        const c = wave.speed * Math.sqrt(9.8 / k);
        const phase = x.mul(dx * k).add(z.mul(dz * k)).sub(float(timeSeconds).mul(c * k));
        y = y.add(sin(phase).mul(wave.amplitude * scale));
        ox = ox.add(cos(phase).mul(wave.steepness * wave.amplitude * scale * dx));
        oz = oz.add(cos(phase).mul(wave.steepness * wave.amplitude * scale * dz));
        crest = crest.add(sin(phase).mul(wave.amplitude * scale));
      }
      const amplitudeSum = waves.reduce((sum, wave) => sum + wave.amplitude * scale, 0);
      field.element(id).assign(vec4(y, ox, oz, crest.div(float(Math.max(amplitudeSum, 1e-4))).mul(0.5).add(0.5)));
    })().compute(count);
    await renderer.computeAsync(node);
  } else {
    const spectrum = input.spectrum;
    if (!spectrum) throw new Error('WebGPU FFT requires a spectrum');
    const direct = await runDirectWebGpuDft(renderer, spectrum, domainMeters, timeSeconds);
    directHeights = direct.heights;
    directSlope = direct.slope;
    const packedField = field.value.array as Float32Array;
    for (let i = 0; i < count; i += 1) {
      packedField[i * 4] = direct.heights[i];
      packedField[i * 4 + 1] = 0;
      packedField[i * 4 + 2] = direct.slope[i];
      packedField[i * 4 + 3] = 0;
    }
    field.value.needsUpdate = true;
  }

  const cell = input.domainMeters / resolution;
  const heights = directHeights ?? new Float32Array(count);
  const dx = new Float32Array(count);
  const slope = directSlope ?? new Float32Array(count);
  if (!directHeights) {
  const slopePass = Fn(() => {
    const n = uint(resolution);
    const id = instanceIndex;
    const col = id.mod(n);
    const row = id.div(n);
    const rightCol = col.add(uint(1)).mod(n);
    const leftCol = col.add(n.sub(uint(1))).mod(n);
    const self = field.element(id);
    const right = field.element(row.mul(n).add(rightCol));
    const left = field.element(row.mul(n).add(leftCol));
    const slopeValue = float(right.x).sub(float(left.x)).div(float(2 * cell));
    field.element(id).assign(vec4(float(self.x), float(self.y), slopeValue, float(self.w)));
  })().compute(count);
  await renderer.computeAsync(slopePass);
  const raw = await renderer.getArrayBufferAsync(field.value);
  const view = new Float32Array(raw instanceof ArrayBuffer ? raw : (raw as { buffer: ArrayBuffer }).buffer);
  const packed = view.length >= count * 4 ? view : view.subarray(0, view.length);
  for (let i = 0; i < count; i += 1) {
    heights[i] = packed[i * 4];
    dx[i] = packed[i * 4 + 1];
    slope[i] = packed[i * 4 + 2];
  }
  }
  let heightL2 = 0;
  let displacementL2 = 0;
  let slopeL2 = 0;
  let referenceHeights: readonly number[] = [];
  if (input.algorithm === 'fft' && input.spectrum) {
    const reference = fftOceanSnapshot(input.spectrum, input.domainMeters, input.timeSeconds);
    const displacement = fftOceanDisplacementSnapshot(input.spectrum, input.domainMeters, input.timeSeconds);
    const referenceSlope = new Float32Array(count);
    for (let j = 0; j < resolution; j += 1) {
      for (let i = 0; i < resolution; i += 1) {
        const right = reference.heights[j * resolution + ((i + 1) % resolution)];
        const left = reference.heights[j * resolution + ((i - 1 + resolution) % resolution)];
        referenceSlope[j * resolution + i] = (right - left) / (2 * cell);
      }
    }
    referenceHeights = Array.from(reference.heights.slice(0, 8));
    heightL2 = fieldRelativeL2(heights, reference.heights);
    displacementL2 = fieldRelativeL2(dx, displacement.dx);
    slopeL2 = fieldRelativeL2(slope, referenceSlope);
  } else if (input.waves) {
    const scale = input.amplitudeScale ?? 1;
    const referenceH = new Float32Array(count);
    const referenceDx = new Float32Array(count);
    for (let j = 0; j < resolution; j += 1) {
      const z = (j / (resolution - 1) - 0.5) * input.domainMeters;
      for (let i = 0; i < resolution; i += 1) {
        const x = (i / (resolution - 1) - 0.5) * input.domainMeters;
        const sample = computeGerstnerDisplacement(
          input.waves.map((wave) => ({ ...wave, amplitude: wave.amplitude * scale })),
          x,
          z,
          input.timeSeconds,
        );
        referenceH[j * resolution + i] = sample.y;
        referenceDx[j * resolution + i] = sample.offsetX;
      }
    }
    heightL2 = fieldRelativeL2(heights, referenceH);
    displacementL2 = fieldRelativeL2(dx, referenceDx);
  }
  return {
    resolution,
    heights,
    dx,
    slope,
    heightL2,
    displacementL2,
    slopeL2,
    nativeBackend,
    fieldNode: field,
    probeHeights: Array.from(heights.slice(0, 8)),
    referenceHeights,
    dispose,
  };
}

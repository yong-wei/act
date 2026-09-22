/**
 * WebGPU 二维 IFFT（#2134）。下标与 simulateWebGpuFftHeights 相同，
 * 结果对照独立的 fftOceanSnapshot，而不是再跑一遍 O(N⁴) 直接求和。
 */

import type { WebGPURenderer } from 'three/webgpu';

import { FFT_OCEAN_CHOP_LAMBDA, type ComplexGrid } from './fft-ocean';

const GPU_MAP_READ = 0x0001;
const GPU_COPY_SRC = 0x0004;
const GPU_COPY_DST = 0x0008;
const GPU_UNIFORM = 0x0040;
const GPU_STORAGE = 0x0080;
const GPU_SHADER_COMPUTE = 0x4;

const IFFT_SHADER = `
struct Params {
  n: u32,
  len: u32,
  axis: u32,
  bits: u32,
  time: f32,
  domain: f32,
  chop: f32,
  chop_axis: f32,
}

@group(0) @binding(0) var<storage, read> spectrum: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> ping: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> pong: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read> reverse_bits: array<u32>;

fn folded(i: u32, n: u32) -> f32 {
  let value = select(i32(i) - i32(n), i32(i), i <= n / 2u);
  return f32(value);
}

@compute @workgroup_size(64)
fn evolve(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  let col = gid.x % n;
  let row = gid.x / n;
  let kx = 6.283185307179586 * folded(col, n) / params.domain;
  let kz = 6.283185307179586 * folded(row, n) / params.domain;
  let omega = sqrt(9.81 * max(sqrt(kx * kx + kz * kz), 1e-9));
  let angle = omega * params.time;
  let sample = spectrum[gid.x];
  ping[gid.x] = vec2<f32>(
    sample.x * cos(angle) - sample.y * sin(angle),
    sample.x * sin(angle) + sample.y * cos(angle),
  );
}

@compute @workgroup_size(64)
fn permute_ping_to_pong(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  let row = gid.x / n;
  let col = gid.x % n;
  let src_row = select(reverse_bits[row], row, params.axis == 0u);
  let src_col = select(col, reverse_bits[col], params.axis == 0u);
  pong[gid.x] = ping[src_row * n + src_col];
}

@compute @workgroup_size(64)
fn permute_pong_to_ping(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  let row = gid.x / n;
  let col = gid.x % n;
  let src_row = select(reverse_bits[row], row, params.axis == 0u);
  let src_col = select(col, reverse_bits[col], params.axis == 0u);
  ping[gid.x] = pong[src_row * n + src_col];
}

fn butterfly_pair(a: vec2<f32>, b: vec2<f32>, k: u32, len: u32) -> vec4<f32> {
  let angle = 6.283185307179586 * f32(k) / f32(len);
  let w_re = cos(angle);
  let w_im = sin(angle);
  let t_re = w_re * b.x - w_im * b.y;
  let t_im = w_re * b.y + w_im * b.x;
  return vec4<f32>(a.x + t_re, a.y + t_im, a.x - t_re, a.y - t_im);
}

@compute @workgroup_size(64)
fn butterfly_ping_to_pong(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  let pairs = n * n / 2u;
  if (gid.x >= pairs) { return; }
  let half_n = n / 2u;
  let line = gid.x / half_n;
  let inner = gid.x % half_n;
  let len = params.len;
  let half = len / 2u;
  let group = inner / half;
  let k = inner % half;
  let even_axis = group * len + k;
  let odd_axis = even_axis + half;
  let even_index = select(even_axis * n + line, line * n + even_axis, params.axis == 0u);
  let odd_index = select(odd_axis * n + line, line * n + odd_axis, params.axis == 0u);
  let mixed = butterfly_pair(ping[even_index], ping[odd_index], k, len);
  pong[even_index] = mixed.xy;
  pong[odd_index] = mixed.zw;
}

@compute @workgroup_size(64)
fn butterfly_pong_to_ping(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  let pairs = n * n / 2u;
  if (gid.x >= pairs) { return; }
  let half_n = n / 2u;
  let line = gid.x / half_n;
  let inner = gid.x % half_n;
  let len = params.len;
  let half = len / 2u;
  let group = inner / half;
  let k = inner % half;
  let even_axis = group * len + k;
  let odd_axis = even_axis + half;
  let even_index = select(even_axis * n + line, line * n + even_axis, params.axis == 0u);
  let odd_index = select(odd_axis * n + line, line * n + odd_axis, params.axis == 0u);
  let mixed = butterfly_pair(pong[even_index], pong[odd_index], k, len);
  ping[even_index] = mixed.xy;
  ping[odd_index] = mixed.zw;
}

@compute @workgroup_size(64)
fn normalize_ping(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  ping[gid.x] = ping[gid.x] / f32(n);
}

@compute @workgroup_size(64)
fn normalize_pong(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  pong[gid.x] = pong[gid.x] / f32(n);
}

@compute @workgroup_size(64)
fn chop_ping(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.n;
  if (gid.x >= n * n) { return; }
  let col = gid.x % n;
  let row = gid.x / n;
  let kx = 6.283185307179586 * folded(col, n) / params.domain;
  let kz = 6.283185307179586 * folded(row, n) / params.domain;
  let magnitude = sqrt(kx * kx + kz * kz);
  let axis_k = select(kz, kx, params.chop_axis < 0.5);
  let scale = select(0.0, params.chop * axis_k / magnitude, magnitude > 1e-6);
  let sample = ping[gid.x];
  ping[gid.x] = vec2<f32>(scale * -sample.y, scale * sample.x);
}
`;

function bitReverseTable(resolution: number): Uint32Array {
  const bits = Math.round(Math.log2(resolution));
  const table = new Uint32Array(resolution);
  for (let index = 0; index < resolution; index += 1) {
    let value = index;
    let reversed = 0;
    for (let bit = 0; bit < bits; bit += 1) {
      reversed = (reversed << 1) | (value & 1);
      value >>= 1;
    }
    table[index] = reversed;
  }
  return table;
}

async function readFloats(device: any, source: any, floatCount: number): Promise<Float32Array> {
  const byteLength = Math.ceil(floatCount * 4 / 4) * 4;
  const readback = device.createBuffer({ size: byteLength, usage: GPU_COPY_DST | GPU_MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_READ);
  const copy = new Float32Array(readback.getMappedRange().slice(0));
  readback.destroy();
  return copy;
}

export async function runWebGpuButterflyIfft(
  renderer: WebGPURenderer,
  spectrum: ComplexGrid,
  domainMeters: number,
  timeSeconds: number,
): Promise<{ heights: Float32Array; dx: Float32Array; dz: Float32Array; slope: Float32Array }> {
  const device: any = (renderer as unknown as { backend: { device: unknown } }).backend.device;
  const n = spectrum.resolution;
  const count = n * n;
  const module = device.createShaderModule({ code: IFFT_SHADER });
  const compiled = await module.getCompilationInfo();
  const errors = compiled.messages.filter((message: { type: string }) => message.type === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((message: { message: string }) => message.message).join('\n'));
  }
  const reverse = bitReverseTable(n);
  const buffer = (size: number, usage: number) => device.createBuffer({ size, usage });
  const spectrumBuffer = buffer(spectrum.data.byteLength, GPU_STORAGE | GPU_COPY_DST);
  const ping = buffer(count * 8, GPU_STORAGE | GPU_COPY_SRC | GPU_COPY_DST);
  const pong = buffer(count * 8, GPU_STORAGE | GPU_COPY_SRC | GPU_COPY_DST);
  const reverseBuffer = buffer(reverse.byteLength, GPU_STORAGE | GPU_COPY_DST);
  const uniformBuffer = buffer(32, GPU_UNIFORM | GPU_COPY_DST);
  device.queue.writeBuffer(spectrumBuffer, 0, spectrum.data);
  device.queue.writeBuffer(reverseBuffer, 0, reverse);
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'uniform' } },
      { binding: 4, visibility: GPU_SHADER_COMPUTE, buffer: { type: 'read-only-storage' } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const pipeline = (entryPoint: string) => device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module, entryPoint },
  });
  const pipelines = {
    evolve: pipeline('evolve'),
    permutePing: pipeline('permute_ping_to_pong'),
    permutePong: pipeline('permute_pong_to_ping'),
    butterflyPing: pipeline('butterfly_ping_to_pong'),
    butterflyPong: pipeline('butterfly_pong_to_ping'),
    normalizePing: pipeline('normalize_ping'),
    normalizePong: pipeline('normalize_pong'),
    chop: pipeline('chop_ping'),
  };
  const group = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: spectrumBuffer } },
      { binding: 1, resource: { buffer: ping } },
      { binding: 2, resource: { buffer: pong } },
      { binding: 3, resource: { buffer: uniformBuffer } },
      { binding: 4, resource: { buffer: reverseBuffer } },
    ],
  });
  const params = new ArrayBuffer(32);
  const view = new DataView(params);
  const writeParams = (len: number, axis: number, chopAxis: number) => {
    view.setUint32(0, n, true);
    view.setUint32(4, len, true);
    view.setUint32(8, axis, true);
    view.setUint32(12, Math.round(Math.log2(n)), true);
    view.setFloat32(16, timeSeconds, true);
    view.setFloat32(20, domainMeters, true);
    view.setFloat32(24, FFT_OCEAN_CHOP_LAMBDA, true);
    view.setFloat32(28, chopAxis, true);
    device.queue.writeBuffer(uniformBuffer, 0, params);
  };
  const dispatch = (pipe: any, workgroups: number) => {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(workgroups);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };
  const bits = Math.round(Math.log2(n));
  const ifft = () => {
    let onPing = true;
    for (const axis of [0, 1]) {
      writeParams(2, axis, 0);
      dispatch(onPing ? pipelines.permutePing : pipelines.permutePong, Math.ceil(count / 64));
      onPing = !onPing;
      for (let stage = 0; stage < bits; stage += 1) {
        writeParams(2 ** (stage + 1), axis, 0);
        dispatch(onPing ? pipelines.butterflyPing : pipelines.butterflyPong, Math.ceil((count / 2) / 64));
        onPing = !onPing;
      }
      writeParams(2, axis, 0);
      dispatch(onPing ? pipelines.normalizePing : pipelines.normalizePong, Math.ceil(count / 64));
    }
    return onPing;
  };
  writeParams(2, 0, 0);
  dispatch(pipelines.evolve, Math.ceil(count / 64));
  const evolved = await readFloats(device, ping, count * 2);
  const heightOnPing = ifft();
  const heightComplex = await readFloats(device, heightOnPing ? ping : pong, count * 2);
  device.queue.writeBuffer(ping, 0, evolved);
  writeParams(2, 0, 0);
  dispatch(pipelines.chop, Math.ceil(count / 64));
  const dxOnPing = ifft();
  const dxComplex = await readFloats(device, dxOnPing ? ping : pong, count * 2);
  device.queue.writeBuffer(ping, 0, evolved);
  writeParams(2, 0, 1);
  dispatch(pipelines.chop, Math.ceil(count / 64));
  const dzOnPing = ifft();
  const dzComplex = await readFloats(device, dzOnPing ? ping : pong, count * 2);
  const heights = new Float32Array(count);
  const dx = new Float32Array(count);
  const dz = new Float32Array(count);
  const slope = new Float32Array(count);
  const cell = domainMeters / n;
  for (let i = 0; i < count; i += 1) {
    heights[i] = heightComplex[i * 2];
    dx[i] = dxComplex[i * 2];
    dz[i] = dzComplex[i * 2];
  }
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const right = heights[row * n + ((col + 1) % n)];
      const left = heights[row * n + ((col - 1 + n) % n)];
      slope[row * n + col] = (right - left) / (2 * cell);
    }
  }
  spectrumBuffer.destroy();
  ping.destroy();
  pong.destroy();
  reverseBuffer.destroy();
  uniformBuffer.destroy();
  return { heights, dx, dz, slope };
}

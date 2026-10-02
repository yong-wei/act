import { marineBackendName } from '../marine-backend';
/**
 * 对比页专用、GPU 常驻的节点 FFT。
 * 数学只定义一次，TSL 分别生成 WebGL GLSL / WebGPU WGSL。
 * 常规 run 不读回；独立 QA 才调用 readField。
 */
import {
  DataTexture, FloatType, NearestFilter, RGBAFormat, RenderTarget,
  MeshBasicNodeMaterial, QuadMesh, type WebGPURenderer, type Node,
} from 'three/webgpu';
import { Fn, vec2, vec4, uv, texture, uniform } from 'three/tsl';
import { FFT_OCEAN_CHOP_LAMBDA, type ComplexGrid } from './fft-ocean';
import { createOceanGpuTransform } from './ocean-gpu-transform';

let resourceGeneration = 0;

export function createComparisonOceanPipeline(
  renderer: WebGPURenderer,
  spectrum: ComplexGrid,
  domain: number,
) {
  const n = spectrum.resolution;
  const transform = createOceanGpuTransform(renderer, n);
  const rgba = new Float32Array(n * n * 4);
  for (let i = 0; i < n * n; i += 1) {
    rgba[i * 4] = spectrum.data[i * 2];
    rgba[i * 4 + 1] = spectrum.data[i * 2 + 1];
    rgba[i * 4 + 2] = spectrum.omegas[i];
    rgba[i * 4 + 3] = 1;
  }
  const sourceTexture = new DataTexture(rgba, n, n, RGBAFormat, FloatType);
  sourceTexture.minFilter = sourceTexture.magFilter = NearestFilter;
  sourceTexture.needsUpdate = true;
  const makeTarget = () => new RenderTarget(n, n, {
    type: FloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter,
    depthBuffer: false, stencilBuffer: false,
  });
  const ping = makeTarget();
  const evolved = makeTarget();
  const height = makeTarget();
  const dx = makeTarget();
  const dz = makeTarget();
  const input = texture(sourceTexture);
  const t = uniform(0);
  const axisX = uniform(1);
  const sample = (at: Node) => texture(input, at, 0);
  const material = (output: Node) => {
    const result = new MeshBasicNodeMaterial();
    result.fragmentNode = output;
    result.depthTest = result.depthWrite = result.toneMapped = false;
    return result;
  };
  const evolve = material(Fn(() => {
    const bin = texture(sourceTexture, uv(), 0);
    const angle = bin.z.mul(t);
    return vec4(bin.x.mul(angle.cos()).sub(bin.y.mul(angle.sin())),
      bin.x.mul(angle.sin()).add(bin.y.mul(angle.cos())), 0, 1);
  })());
  const chop = material(Fn(() => {
    const index = uv().mul(n).floor();
    const k = vec2(index.x.lessThanEqual(n / 2).select(index.x, index.x.sub(n)),
      index.y.lessThanEqual(n / 2).select(index.y, index.y.sub(n))).mul(2 * Math.PI / domain);
    const h = sample(uv()).xy;
    const scale = axisX.greaterThan(0.5).select(k.x, k.y)
      .mul(FFT_OCEAN_CHOP_LAMBDA).div(k.length().max(1e-6));
    return vec4(vec2(h.y.negate(), h.x).mul(scale), 0, 1);
  })());
  const quad = new QuadMesh(evolve);
  let disposed = false;
  const generation = ++resourceGeneration;
  let frames = 0;
  let lastTime: number | null = null;
  let readbacks = 0;
  const pass = (mat: MeshBasicNodeMaterial, target: RenderTarget, from?: RenderTarget) => {
    if (from) input.value = from.texture;
    quad.material = mat;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };
  const inverse = (from: RenderTarget, target: RenderTarget) => transform.run(from, target);
  return {
    heightTexture: height.texture, displacementXTexture: dx.texture, displacementZTexture: dz.texture,
    resolution: n,
    inverse,
    stats: () => ({ frames, readbacks, disposed, generation }),
    run(timeSeconds: number) {
      if (disposed || lastTime === timeSeconds) return;
      const previous = renderer.getRenderTarget();
      try {
        t.value = timeSeconds;
        pass(evolve, evolved);
        inverse(evolved, height);
        axisX.value = 1;
        pass(chop, ping, evolved);
        inverse(ping, dx);
        axisX.value = 0;
        pass(chop, ping, evolved);
        inverse(ping, dz);
        lastTime = timeSeconds;
        frames += 1;
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    async readField() {
      if (disposed) throw new Error('Ocean pipeline disposed');
      readbacks += 1;
      const read = async (target: RenderTarget) => {
        const values = await renderer.readRenderTargetPixelsAsync(target, 0, 0, n, n);
        const packed = values as Float32Array;
        const flipRows = marineBackendName(renderer.backend) === 'WebGLBackend';
        // WebGPU readback 保留 256-byte 行对齐（末行无 padding）。
        const rowStride = (packed.length - n * 4) / (n - 1);
        return Float32Array.from({ length: n * n }, (_, i) => {
          const row = Math.floor(i / n);
          return packed[(flipRows ? n - 1 - row : row) * rowStride + (i % n) * 4];
        });
      };
      const [heights, displacementX, displacementZ] = await Promise.all([read(height), read(dx), read(dz)]);
      return { heights, dx: displacementX, dz: displacementZ };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sourceTexture.dispose();
      transform.dispose();
      for (const target of [ping, evolved, height, dx, dz]) target.dispose();
      for (const mat of [evolve, chop]) mat.dispose();
    },
  };
}

export type ComparisonOceanPipeline = ReturnType<typeof createComparisonOceanPipeline>;

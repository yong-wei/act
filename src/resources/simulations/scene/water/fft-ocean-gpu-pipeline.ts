/**
 * WebGL FFT 海洋 GPU 管线（#2131）：演化 + 2D IFFT → 高度/水平位移，
 * 可选斜率 IFFT。离屏 pass 结束时恢复原 render target / viewport / scissor。
 * 读回只给 QA 小变换用，不进生产帧循环。
 */

import * as THREE from 'three';

import {
  binWaveNumber,
  dispersionOmega,
  FFT_OCEAN_CHOP_LAMBDA,
  fftOceanFieldAt,
  fftOceanGridWorld,
  type ComplexGrid,
} from './fft-ocean';

const FULLSCREEN_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const EVOLVE_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uSpectrum;
  uniform float uTimeSeconds;
  varying vec2 vUv;
  void main() {
    vec4 bin = texture2D(uSpectrum, vUv);
    float angle = bin.z * uTimeSeconds;
    float c = cos(angle);
    float s = sin(angle);
    gl_FragColor = vec4(bin.x * c - bin.y * s, bin.x * s + bin.y * c, bin.z, 1.0);
  }
`;

const PERMUTE_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uInput;
  uniform float uHorizontal;
  uniform float uResolution;
  uniform float uBits;
  varying vec2 vUv;
  float reverseBits(float value, float bits) {
    float result = 0.0;
    for (float b = 0.0; b < 12.0; b += 1.0) {
      if (b >= bits) break;
      result = result * 2.0 + mod(floor(value / pow(2.0, b)), 2.0);
    }
    return result;
  }
  void main() {
    float texel = 1.0 / uResolution;
    float n = floor((uHorizontal > 0.5 ? vUv.x : vUv.y) * uResolution);
    float reversed = reverseBits(n, uBits);
    vec2 source = uHorizontal > 0.5
      ? vec2((reversed + 0.5) * texel, vUv.y)
      : vec2(vUv.x, (reversed + 0.5) * texel);
    gl_FragColor = texture2D(uInput, source);
  }
`;

const BUTTERFLY_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uInput;
  uniform float uSpan;
  uniform float uHorizontal;
  uniform float uResolution;
  varying vec2 vUv;
  const float PI = 3.141592653589793;
  void main() {
    float texel = 1.0 / uResolution;
    float n = floor((uHorizontal > 0.5 ? vUv.x : vUv.y) * uResolution);
    float halfSpan = uSpan * 0.5;
    bool isEven = mod(n, uSpan) < halfSpan;
    float j = mod(n, halfSpan);
    float partnerN = isEven ? n + halfSpan : n - halfSpan;
    vec2 selfUv = uHorizontal > 0.5
      ? vec2((n + 0.5) * texel, vUv.y)
      : vec2(vUv.x, (n + 0.5) * texel);
    vec2 partnerUv = uHorizontal > 0.5
      ? vec2((partnerN + 0.5) * texel, vUv.y)
      : vec2(vUv.x, (partnerN + 0.5) * texel);
    vec2 self = texture2D(uInput, selfUv).xy;
    vec2 partner = texture2D(uInput, partnerUv).xy;
    float angle = 2.0 * PI * j / uSpan;
    float c = cos(angle);
    float s = sin(angle);
    vec2 oddIn = isEven ? partner : self;
    vec2 evenIn = isEven ? self : partner;
    vec2 t = vec2(oddIn.x * c - oddIn.y * s, oddIn.x * s + oddIn.y * c);
    vec2 result = isEven ? evenIn + t : evenIn - t;
    gl_FragColor = vec4(result, 0.0, 1.0);
  }
`;

const OUTPUT_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uInput;
  uniform float uResolution;
  varying vec2 vUv;
  void main() {
    float height = texture2D(uInput, vUv).x / (uResolution * uResolution);
    gl_FragColor = vec4(height, 0.0, 0.0, 1.0);
  }
`;

const COPY_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uInput;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uInput, vUv);
  }
`;

/** chop：λ (k_axis/|k|) i H；斜率：k_axis i H（uDivideByK=0）。 */
const CHOP_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uInput;
  uniform float uResolution;
  uniform float uDomain;
  uniform float uLambda;
  uniform float uAxisX;
  uniform float uDivideByK;
  varying vec2 vUv;
  const float PI2 = 6.283185307179586;
  void main() {
    vec2 h = texture2D(uInput, vUv).xy;
    float ix = floor(vUv.x * uResolution);
    float iz = floor(vUv.y * uResolution);
    float foldedX = ix <= uResolution * 0.5 ? ix : ix - uResolution;
    float foldedZ = iz <= uResolution * 0.5 ? iz : iz - uResolution;
    float kx = PI2 * foldedX / uDomain;
    float kz = PI2 * foldedZ / uDomain;
    float k = length(vec2(kx, kz));
    vec2 iH = vec2(-h.y, h.x);
    float axis = uAxisX > 0.5 ? kx : kz;
    float scale = uDivideByK > 0.5
      ? (k > 1e-6 ? uLambda * axis / k : 0.0)
      : axis;
    gl_FragColor = vec4(scale * iH, 0.0, 1.0);
  }
`;

export interface FftOceanGpuPipelineOptions {
  readonly chopLambda?: number;
  readonly includeSlopes?: boolean;
}

export interface FftOceanGpuPipeline {
  run(timeSeconds: number): void;
  dispose(): void;
  readonly heightTexture: THREE.Texture;
  readonly displacementXTexture: THREE.Texture;
  readonly displacementZTexture: THREE.Texture;
  readonly slopeXTexture: THREE.Texture | null;
  readonly slopeZTexture: THREE.Texture | null;
  readonly resolution: number;
  readonly domainMeters: number;
  readHeightGrid(): Float32Array | null;
  readDisplacementXGrid(): Float32Array | null;
  readDisplacementZGrid(): Float32Array | null;
  readSlopeXGrid(): Float32Array | null;
  readSlopeZGrid(): Float32Array | null;
}

function makeFloatTarget(n: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(n, n, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.flipY = false;
  target.texture.generateMipmaps = false;
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
}

export function createFftOceanGpuPipeline(
  gl: THREE.WebGLRenderer,
  spectrum: ComplexGrid,
  domainMeters: number,
  options: FftOceanGpuPipelineOptions = {},
): FftOceanGpuPipeline {
  const n = spectrum.resolution;
  const stages = Math.round(Math.log2(n));
  const chopLambda = options.chopLambda ?? FFT_OCEAN_CHOP_LAMBDA;
  const includeSlopes = options.includeSlopes === true;
  const rgba = new Float32Array(n * n * 4);
  for (let i = 0; i < n * n; i += 1) {
    rgba[i * 4] = spectrum.data[i * 2];
    rgba[i * 4 + 1] = spectrum.data[i * 2 + 1];
    rgba[i * 4 + 2] = spectrum.omegas[i];
    rgba[i * 4 + 3] = 1;
  }
  const spectrumTexture = new THREE.DataTexture(rgba, n, n, THREE.RGBAFormat, THREE.FloatType);
  spectrumTexture.flipY = false;
  spectrumTexture.generateMipmaps = false;
  spectrumTexture.minFilter = THREE.NearestFilter;
  spectrumTexture.magFilter = THREE.NearestFilter;
  spectrumTexture.colorSpace = THREE.NoColorSpace;
  spectrumTexture.needsUpdate = true;

  const evolveMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: EVOLVE_FS,
    uniforms: { uSpectrum: { value: spectrumTexture }, uTimeSeconds: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  });
  const permuteMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: PERMUTE_FS,
    uniforms: {
      uInput: { value: null },
      uHorizontal: { value: 1 },
      uResolution: { value: n },
      uBits: { value: stages },
    },
    depthTest: false,
    depthWrite: false,
  });
  const butterflyMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: BUTTERFLY_FS,
    uniforms: {
      uInput: { value: null },
      uSpan: { value: 2 },
      uHorizontal: { value: 1 },
      uResolution: { value: n },
    },
    depthTest: false,
    depthWrite: false,
  });
  const outputMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: OUTPUT_FS,
    uniforms: { uInput: { value: null }, uResolution: { value: n } },
    depthTest: false,
    depthWrite: false,
  });
  const copyMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: COPY_FS,
    uniforms: { uInput: { value: null } },
    depthTest: false,
    depthWrite: false,
  });
  const chopMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VS,
    fragmentShader: CHOP_FS,
    uniforms: {
      uInput: { value: null },
      uResolution: { value: n },
      uDomain: { value: domainMeters },
      uLambda: { value: chopLambda },
      uAxisX: { value: 1 },
      uDivideByK: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  });

  const ping = makeFloatTarget(n);
  const pong = makeFloatTarget(n);
  const evolvedTarget = makeFloatTarget(n);
  const heightTarget = makeFloatTarget(n);
  const dispXTarget = makeFloatTarget(n);
  const dispZTarget = makeFloatTarget(n);
  const slopeXTarget = includeSlopes ? makeFloatTarget(n) : null;
  const slopeZTarget = includeSlopes ? makeFloatTarget(n) : null;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), evolveMaterial);
  scene.add(quad);

  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();

  const renderPass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) => {
    quad.material = material;
    gl.setRenderTarget(target);
    gl.setViewport(0, 0, n, n);
    gl.clear(true, false, false);
    gl.render(scene, camera);
  };

  const ifftPingTo = (outputTarget: THREE.WebGLRenderTarget) => {
    permuteMaterial.uniforms.uInput.value = ping.texture;
    permuteMaterial.uniforms.uHorizontal.value = 1;
    renderPass(permuteMaterial, pong);
    let source: THREE.WebGLRenderTarget = pong;
    for (let stage = 0; stage < stages; stage += 1) {
      const sink = source === ping ? pong : ping;
      butterflyMaterial.uniforms.uInput.value = source.texture;
      butterflyMaterial.uniforms.uSpan.value = Math.pow(2, stage + 1);
      butterflyMaterial.uniforms.uHorizontal.value = 1;
      renderPass(butterflyMaterial, sink);
      source = sink;
    }
    const sink0 = source === ping ? pong : ping;
    permuteMaterial.uniforms.uInput.value = source.texture;
    permuteMaterial.uniforms.uHorizontal.value = 0;
    renderPass(permuteMaterial, sink0);
    source = sink0;
    for (let stage = 0; stage < stages; stage += 1) {
      const sink = source === ping ? pong : ping;
      butterflyMaterial.uniforms.uInput.value = source.texture;
      butterflyMaterial.uniforms.uSpan.value = Math.pow(2, stage + 1);
      butterflyMaterial.uniforms.uHorizontal.value = 0;
      renderPass(butterflyMaterial, sink);
      source = sink;
    }
    outputMaterial.uniforms.uInput.value = source.texture;
    renderPass(outputMaterial, outputTarget);
  };

  const chopThenIfft = (axisX: boolean, divideByK: boolean, output: THREE.WebGLRenderTarget) => {
    chopMaterial.uniforms.uInput.value = evolvedTarget.texture;
    chopMaterial.uniforms.uAxisX.value = axisX ? 1 : 0;
    chopMaterial.uniforms.uDivideByK.value = divideByK ? 1 : 0;
    renderPass(chopMaterial, ping);
    ifftPingTo(output);
  };

  const withRestoredGl = (fn: () => void) => {
    const previousTarget = gl.getRenderTarget();
    gl.getViewport(savedViewport);
    gl.getScissor(savedScissor);
    const previousScissorTest = gl.getScissorTest();
    const previousAutoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setScissorTest(false);
    fn();
    gl.autoClear = previousAutoClear;
    gl.setRenderTarget(previousTarget);
    gl.setViewport(savedViewport);
    gl.setScissor(savedScissor);
    gl.setScissorTest(previousScissorTest);
  };

  const readGrid = (target: THREE.WebGLRenderTarget | null): Float32Array | null => {
    if (!target) return null;
    const buffer = new Float32Array(n * n * 4);
    try {
      gl.readRenderTargetPixels(target, 0, 0, n, n, buffer);
    } catch {
      return null;
    }
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i += 1) grid[i] = buffer[i * 4];
    return grid;
  };

  const run = (timeSeconds: number) => {
    withRestoredGl(() => {
      evolveMaterial.uniforms.uTimeSeconds.value = timeSeconds;
      renderPass(evolveMaterial, ping);
      copyMaterial.uniforms.uInput.value = ping.texture;
      renderPass(copyMaterial, evolvedTarget);
      ifftPingTo(heightTarget);
      chopThenIfft(true, true, dispXTarget);
      chopThenIfft(false, true, dispZTarget);
      if (slopeXTarget && slopeZTarget) {
        chopThenIfft(true, false, slopeXTarget);
        chopThenIfft(false, false, slopeZTarget);
      }
    });
  };

  const dispose = () => {
    spectrumTexture.dispose();
    ping.dispose();
    pong.dispose();
    evolvedTarget.dispose();
    heightTarget.dispose();
    dispXTarget.dispose();
    dispZTarget.dispose();
    slopeXTarget?.dispose();
    slopeZTarget?.dispose();
    evolveMaterial.dispose();
    permuteMaterial.dispose();
    butterflyMaterial.dispose();
    outputMaterial.dispose();
    copyMaterial.dispose();
    chopMaterial.dispose();
    quad.geometry.dispose();
  };

  return {
    run,
    dispose,
    heightTexture: heightTarget.texture,
    displacementXTexture: dispXTarget.texture,
    displacementZTexture: dispZTarget.texture,
    slopeXTexture: slopeXTarget?.texture ?? null,
    slopeZTexture: slopeZTarget?.texture ?? null,
    resolution: n,
    domainMeters,
    readHeightGrid: () => readGrid(heightTarget),
    readDisplacementXGrid: () => readGrid(dispXTarget),
    readDisplacementZGrid: () => readGrid(dispZTarget),
    readSlopeXGrid: () => readGrid(slopeXTarget),
    readSlopeZGrid: () => readGrid(slopeZTarget),
  };
}

export interface FftOceanGpuValidation {
  readonly ok: boolean;
  readonly resolutions: readonly number[];
  readonly relativeL2: number;
  readonly maxAbsError: number;
  readonly displacementMaxAbsError: number;
  readonly slopeMaxAbsError: number;
  readonly gpuHeightMin: number;
  readonly gpuHeightMax: number;
  readonly dftHeightMin: number;
  readonly dftHeightMax: number;
  readonly samples: readonly {
    readonly ix: number;
    readonly iz: number;
    readonly gpuH: number;
    readonly dftH: number;
    readonly gpuDx: number;
    readonly dftDx: number;
  }[];
  readonly reason?: string;
}

function knownModeSpectrum(resolution: number, domainMeters: number): ComplexGrid {
  const data = new Float32Array(resolution * resolution * 2);
  const omegas = new Float32Array(resolution * resolution);
  const modes: ReadonlyArray<readonly [number, number, number, number]> = [
    [2, 1, 1, 0.2],
    [1, 0, 0.4, -0.15],
  ];
  for (const [kxBin, kzBin, re, im] of modes) {
    const index = kzBin * resolution + kxBin;
    data[index * 2] = re;
    data[index * 2 + 1] = im;
    const kx = binWaveNumber(kxBin, resolution, domainMeters);
    const kz = binWaveNumber(kzBin, resolution, domainMeters);
    omegas[index] = dispersionOmega(Math.hypot(kx, kz));
  }
  return { data, omegas, resolution };
}

function accumulateError(
  gpu: Float32Array,
  expected: (index: number) => number,
): { err2: number; ref2: number; maxAbs: number } {
  let err2 = 0;
  let ref2 = 0;
  let maxAbs = 0;
  for (let i = 0; i < gpu.length; i += 1) {
    const value = expected(i);
    const delta = gpu[i] - value;
    err2 += delta * delta;
    ref2 += value * value;
    maxAbs = Math.max(maxAbs, Math.abs(delta));
  }
  return { err2, ref2, maxAbs };
}

/** QA：8/16/32 真实 GPU 读回对独立直接 DFT，不用 TS pass 镜像。 */
export function validateFftOceanGpuAgainstDft(gl: THREE.WebGLRenderer): FftOceanGpuValidation {
  const resolutions = [8, 16, 32] as const;
  const times = [0, 1.25];
  let err2 = 0;
  let ref2 = 0;
  let maxAbsError = 0;
  let displacementMaxAbsError = 0;
  let slopeMaxAbsError = 0;
  let gpuHeightMin = Number.POSITIVE_INFINITY;
  let gpuHeightMax = Number.NEGATIVE_INFINITY;
  let dftHeightMin = Number.POSITIVE_INFINITY;
  let dftHeightMax = Number.NEGATIVE_INFINITY;
  const samples: FftOceanGpuValidation['samples'][number][] = [];
  const failed = (
    reason: string,
  ): FftOceanGpuValidation => ({
    ok: false,
    resolutions,
    relativeL2: Number.POSITIVE_INFINITY,
    maxAbsError: Number.POSITIVE_INFINITY,
    displacementMaxAbsError: Number.POSITIVE_INFINITY,
    slopeMaxAbsError: Number.POSITIVE_INFINITY,
    gpuHeightMin,
    gpuHeightMax,
    dftHeightMin,
    dftHeightMax,
    samples,
    reason,
  });
  for (const resolution of resolutions) {
    const domainMeters = 128;
    const spectrum = knownModeSpectrum(resolution, domainMeters);
    const pipeline = createFftOceanGpuPipeline(gl, spectrum, domainMeters, {
      includeSlopes: true,
    });
    try {
      for (const timeSeconds of times) {
        pipeline.run(timeSeconds);
        const heights = pipeline.readHeightGrid();
        const dx = pipeline.readDisplacementXGrid();
        const dz = pipeline.readDisplacementZGrid();
        const sx = pipeline.readSlopeXGrid();
        const sz = pipeline.readSlopeZGrid();
        if (!heights || !dx || !dz || !sx || !sz) {
          pipeline.dispose();
          return failed('readback-failed');
        }
        const heightError = accumulateError(heights, (index) => {
          const ix = index % resolution;
          const iz = Math.floor(index / resolution);
          return fftOceanFieldAt(
            spectrum,
            domainMeters,
            timeSeconds,
            fftOceanGridWorld(ix, resolution, domainMeters),
            fftOceanGridWorld(iz, resolution, domainMeters),
          ).height;
        });
        err2 += heightError.err2;
        ref2 += heightError.ref2;
        maxAbsError = Math.max(maxAbsError, heightError.maxAbs);
        const dispErrorX = accumulateError(dx, (index) => {
          const ix = index % resolution;
          const iz = Math.floor(index / resolution);
          return fftOceanFieldAt(
            spectrum,
            domainMeters,
            timeSeconds,
            fftOceanGridWorld(ix, resolution, domainMeters),
            fftOceanGridWorld(iz, resolution, domainMeters),
          ).displacementX;
        });
        const dispErrorZ = accumulateError(dz, (index) => {
          const ix = index % resolution;
          const iz = Math.floor(index / resolution);
          return fftOceanFieldAt(
            spectrum,
            domainMeters,
            timeSeconds,
            fftOceanGridWorld(ix, resolution, domainMeters),
            fftOceanGridWorld(iz, resolution, domainMeters),
          ).displacementZ;
        });
        displacementMaxAbsError = Math.max(
          displacementMaxAbsError,
          dispErrorX.maxAbs,
          dispErrorZ.maxAbs,
        );
        const slopeErrorX = accumulateError(sx, (index) => {
          const ix = index % resolution;
          const iz = Math.floor(index / resolution);
          return fftOceanFieldAt(
            spectrum,
            domainMeters,
            timeSeconds,
            fftOceanGridWorld(ix, resolution, domainMeters),
            fftOceanGridWorld(iz, resolution, domainMeters),
          ).slopeX;
        });
        const slopeErrorZ = accumulateError(sz, (index) => {
          const ix = index % resolution;
          const iz = Math.floor(index / resolution);
          return fftOceanFieldAt(
            spectrum,
            domainMeters,
            timeSeconds,
            fftOceanGridWorld(ix, resolution, domainMeters),
            fftOceanGridWorld(iz, resolution, domainMeters),
          ).slopeZ;
        });
        slopeMaxAbsError = Math.max(slopeMaxAbsError, slopeErrorX.maxAbs, slopeErrorZ.maxAbs);
        for (let i = 0; i < heights.length; i += 1) {
          gpuHeightMin = Math.min(gpuHeightMin, heights[i]);
          gpuHeightMax = Math.max(gpuHeightMax, heights[i]);
        }
        if (samples.length === 0) {
          for (const [ix, iz] of [[0, 0], [2, 1], [resolution - 1, 0]] as const) {
            const index = iz * resolution + ix;
            const field = fftOceanFieldAt(
              spectrum,
              domainMeters,
              timeSeconds,
              fftOceanGridWorld(ix, resolution, domainMeters),
              fftOceanGridWorld(iz, resolution, domainMeters),
            );
            dftHeightMin = Math.min(dftHeightMin, field.height);
            dftHeightMax = Math.max(dftHeightMax, field.height);
            samples.push({
              ix,
              iz,
              gpuH: heights[index],
              dftH: field.height,
              gpuDx: dx[index],
              dftDx: field.displacementX,
            });
          }
        }
      }
    } finally {
      pipeline.dispose();
    }
  }
  const relativeL2 = Math.sqrt(err2 / Math.max(ref2, 1e-30));
  return {
    ok: relativeL2 < 2e-4 && maxAbsError < 1e-3 && displacementMaxAbsError < 1e-3 && slopeMaxAbsError < 1e-3,
    resolutions,
    relativeL2,
    maxAbsError,
    displacementMaxAbsError,
    slopeMaxAbsError,
    gpuHeightMin,
    gpuHeightMax,
    dftHeightMin,
    dftHeightMax,
    samples,
  };
}

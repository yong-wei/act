'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import { useMarineVisualTime } from '../frame/marine-frame-provider';
import {
  fftOceanHeightAt,
  fftOceanSnapshot,
  fftOceanStaticSpectrum,
  significantWaveHeight,
  type FFTOceanSpectrumInput,
} from './fft-ocean';

/**
 * WebGL GPU FFT 海面（#2121）：**GPU 频谱演化 + GPU 2D IFFT + GPU 渲染**。
 * - 静态谱（CPU 一次，含逐 bin 色散 ω）→ RGBA float 纹理；
 * - GPU 演化 pass（h₀·e^{iωt}，ω 与 CPU 参照同源）；
 * - GPU 位反转置换 pass（每轴一次）+ span 递增蝶形 pass（每轴 log₂N 次）：
 *   twiddle 乘奇位输入（偶位出 = even + t，奇位出 = even − t）——与
 *   fftOceanGpuStages 镜像逐 pass 同公式，镜像对快照/逐点逆 DFT 双路径验证；
 * - 输出 pass（高度 = Re/N²）→ 高度 RT，水面网格顶点采样；
 * - CPU 只保留调度、QA 统计与**独立**逐点逆 DFT 船体水高查询（无读回）。
 */

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

/** 位反转置换（uHorizontal 选择轴；读 reversed 索引写自然序）。 */
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

/** 蝶形（一个 span stage；twiddle 乘奇位输入——与 CPU fft1d 同 DIT 公式）。 */
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
    // twiddle 乘在**奇位输入**上：偶位出 = even + t；奇位出 = even − t。
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

export interface FFTOceanSurfaceProps {
  readonly spectrumInput: FFTOceanSpectrumInput;
  readonly domainMeters?: number;
}

export function FFTOceanSurface({ spectrumInput, domainMeters }: FFTOceanSurfaceProps) {
  const gl = useThree((state) => state.gl);
  const meshRef = useRef<THREE.Mesh>(null);
  const marineVisualTime = useMarineVisualTime();
  const domain = domainMeters ?? spectrumInput.domainMeters;

  const spectrum = useMemo(() => fftOceanStaticSpectrum(spectrumInput), [spectrumInput]);
  // QA 统计（一次）：t=0 快照 Hs——CPU 快照只做统计，不进渲染循环。
  const cpuHs = useMemo(
    () => significantWaveHeight(fftOceanSnapshot(spectrum, domain, 0).heights),
    [spectrum, domain],
  );

  // GPU 管线：谱纹理 → 演化 → 位反转 → 蝶形 → 高度 RT。
  const pipeline = useMemo(() => {
    const n = spectrum.resolution;
    const stages = Math.round(Math.log2(n));
    const rgba = new Float32Array(n * n * 4);
    for (let i = 0; i < n * n; i += 1) {
      rgba[i * 4] = spectrum.data[i * 2];
      rgba[i * 4 + 1] = spectrum.data[i * 2 + 1];
      rgba[i * 4 + 2] = spectrum.omegas[i];
      rgba[i * 4 + 3] = 1;
    }
    const spectrumTexture = new THREE.DataTexture(rgba, n, n, THREE.RGBAFormat, THREE.FloatType);
    spectrumTexture.minFilter = THREE.NearestFilter;
    spectrumTexture.magFilter = THREE.NearestFilter;
    spectrumTexture.needsUpdate = true;

    const makeTarget = () =>
      new THREE.WebGLRenderTarget(n, n, {
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
      });
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
    const ping = makeTarget();
    const pong = makeTarget();
    const heightTarget = makeTarget();
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), evolveMaterial);
    scene.add(quad);
    const renderPass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) => {
      quad.material = material;
      gl.setRenderTarget(target);
      gl.clear(true, false, false);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
    };

    const run = (timeSeconds: number) => {
      evolveMaterial.uniforms.uTimeSeconds.value = timeSeconds;
      renderPass(evolveMaterial, ping);
      // 行轴：位反转 → 蝶形 stages（ping/pong 交替）。
      permuteMaterial.uniforms.uInput.value = ping.texture;
      permuteMaterial.uniforms.uHorizontal.value = 1;
      renderPass(permuteMaterial, pong);
      let source = pong;
      for (let stage = 0; stage < stages; stage += 1) {
        const sink = source === ping ? pong : ping;
        butterflyMaterial.uniforms.uInput.value = source.texture;
        butterflyMaterial.uniforms.uSpan.value = Math.pow(2, stage + 1);
        butterflyMaterial.uniforms.uHorizontal.value = 1;
        renderPass(butterflyMaterial, sink);
        source = sink;
      }
      // 列轴：位反转 → 蝶形 stages。
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
      renderPass(outputMaterial, heightTarget);
    };

    const dispose = () => {
      spectrumTexture.dispose();
      ping.dispose();
      pong.dispose();
      heightTarget.dispose();
      evolveMaterial.dispose();
      permuteMaterial.dispose();
      butterflyMaterial.dispose();
      outputMaterial.dispose();
      quad.geometry.dispose();
    };

    return { run, dispose, heightTexture: heightTarget.texture, resolution: n };
  }, [gl, spectrum]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);

  // 每帧跑 GPU pass（演化 + 2×(1+log₂N) 个 @256² pass——微小成本）。
  const statsRef = useRef({ frames: 0 });
  useFrame((state, delta) => {
    pipeline.run(marineVisualTime(state, delta));
    statsRef.current.frames += 1;
  });

  // QA 探针（#2121）。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('qa', 'fft-ocean')) return;
    window.__fftOceanRuntime = {
      resolution: spectrum.resolution,
      cpuSignificantWaveHeightMeters: cpuHs,
      gpuPipelineActive: true,
      gpuFrames: () => statsRef.current.frames,
      pointQuery: (x: number, z: number, t: number) => fftOceanHeightAt(spectrum, domain, t, x, z),
      measurePointQueryMs: (samples = 60) => {
        const startedAt = performance.now();
        for (let i = 0; i < samples; i += 1) {
          fftOceanHeightAt(spectrum, domain, i * 0.1, 12.3, -45.6);
        }
        return (performance.now() - startedAt) / samples;
      },
      webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator,
      rendererInfo: gl.getContext().getParameter(gl.getContext().RENDERER) ?? null,
    };
    return () => {
      delete window.__fftOceanRuntime;
    };
  }, [spectrum, cpuHs, domain, gl]);

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(domain, domain, spectrum.resolution - 1, spectrum.resolution - 1);
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, [domain, spectrum.resolution]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHeightTexture: { value: pipeline.heightTexture },
          uDomain: { value: domain },
        },
        vertexShader: /* glsl */ `
          uniform sampler2D uHeightTexture;
          uniform float uDomain;
          varying float vHeight;
          varying vec3 vWorldPos;
          void main() {
            vec3 pos = position;
            // 世界原点 → 首 texel（IFFT 网格采样 x_i = i·L/N 的语义），
            // 与逐点逆 DFT 查询同相位。
            vec2 uvH = fract(pos.xz / uDomain);
            float h = texture2D(uHeightTexture, uvH).r;
            pos.y += h;
            vHeight = h;
            vec4 world = modelMatrix * vec4(pos, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vHeight;
          varying vec3 vWorldPos;
          void main() {
            float shade = clamp(0.5 + vHeight * 0.6, 0.35, 1.0);
            vec3 color = mix(vec3(0.05, 0.16, 0.24), vec3(0.12, 0.30, 0.38), shade);
            float fog = clamp(length(vWorldPos.xz - cameraPosition.xz) / 9000.0, 0.0, 1.0);
            color = mix(color, vec3(0.58, 0.66, 0.72), fog * 0.6);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [pipeline.heightTexture, domain],
  );

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, 0, 0]} />;
}

declare global {
  interface Window {
    /** QA 观测面（#2121 实验）：?qa=fft-ocean。 */
    __fftOceanRuntime?: {
      readonly resolution: number;
      readonly cpuSignificantWaveHeightMeters: number;
      readonly gpuPipelineActive: boolean;
      readonly gpuFrames: () => number;
      readonly pointQuery: (x: number, z: number, t: number) => number;
      readonly measurePointQueryMs: (samples?: number) => number;
      readonly webgpuAvailable: boolean;
      readonly rendererInfo: string | null;
    };
  }
}

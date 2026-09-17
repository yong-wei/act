import * as THREE from 'three';

import { GERSTNER_MAX_WAVES, type GerstnerWave } from './gerstner-waves';
import { NEAR_FIELD_FADE_BAND_METERS } from './ocean-bands';
import {
  FOAM_ROUGHNESS,
  MICRO_NORMAL_FADE_DISTANCE_METERS,
  MICRO_NORMAL_OCTAVES_BY_TIER,
  WATER_BASE_ROUGHNESS,
  type MicroNormalOctave,
} from './micro-optics';

export interface GerstnerWaterMaterialOptions {
  readonly waves: readonly GerstnerWave[];
  /** 主水色。 */
  readonly waterColor: THREE.ColorRepresentation;
  /** 深水色（光照弱处）。 */
  readonly deepColor: THREE.ColorRepresentation;
  /** 菲涅尔地平线过渡色。 */
  readonly horizonColor: THREE.ColorRepresentation;
  readonly foamColor: THREE.ColorRepresentation;
  readonly sunDirection: THREE.Vector3;
  /** 波峰泡沫噪声贴图（world xz 平铺）。 */
  readonly foamTexture?: THREE.Texture | null;
  /** 海况振幅倍率（1 为标准海况）。 */
  readonly amplitudeScale?: number;
  /**
   * 近场幅度包络（#2098）：网格局部坐标超出 fadeStart 后幅度平滑衰减到边缘 0，
   * 使近场边缘与无几何波的远场平面在接缝处同为基准高度。0 表示不启用包络。
   */
  readonly envelopeSizeMeters?: number;
  readonly envelopeFadeBandMeters?: number;
  /**
   * 远场近场挖空半宽（#2098 复审）：远场片元落在近场网格方形覆盖区内时丢弃，
   * 避免透明平面与近场波谷重叠遮挡/交叉闪烁。0 表示不启用。
   */
  readonly nearCutoutHalfSizeMeters?: number;
  /** 光学质量档（#2100）：微法线八分量数随档变化（high 3/medium 2/low 0），只影响着色法线。 */
  readonly microNormalTier?: 'high' | 'medium' | 'low';
  /** 同源太阳辐照（#2100 复审）：preset.sun.intensity / 预设最大值，暗预设泡沫/水色随之变暗。 */
  readonly sunIllumination?: number;
}

const FLOATS_PER_WAVE = 6;
const MAX_MICRO_OCTAVES = 3;
const MICRO_FLOATS_PER_OCTAVE = 5;

function packMicroOctaves(tier: 'high' | 'medium' | 'low'): { data: Float32Array; count: number } {
  const octaves: readonly MicroNormalOctave[] = MICRO_NORMAL_OCTAVES_BY_TIER[tier];
  const data = new Float32Array(MAX_MICRO_OCTAVES * MICRO_FLOATS_PER_OCTAVE);
  octaves.slice(0, MAX_MICRO_OCTAVES).forEach((octave, index) => {
    const base = index * MICRO_FLOATS_PER_OCTAVE;
    data[base] = octave.direction[0];
    data[base + 1] = octave.direction[1];
    data[base + 2] = octave.waveNumber;
    data[base + 3] = octave.slopeAmplitude;
    data[base + 4] = octave.speedScale;
  });
  return { data, count: Math.min(octaves.length, MAX_MICRO_OCTAVES) };
}

/**
 * GPU Gerstner 海面材质：vertex 阶段做几何位移（含水平分量锐化波峰），
 * fragment 阶段按波峰因子 + 噪声贴图出泡沫，菲涅尔过渡到地平线色。
 * 与 scene/water/gerstner-waves.ts 的 CPU 参照共用同一公式。
 */
export function createGerstnerWaterMaterial(options: GerstnerWaterMaterialOptions): THREE.ShaderMaterial {
  const envelopeSize = options.envelopeSizeMeters ?? 0;
  const envelopeFade = options.envelopeFadeBandMeters ?? NEAR_FIELD_FADE_BAND_METERS;
  const micro = packMicroOctaves(options.microNormalTier ?? 'high');
  const waveData = new Float32Array(GERSTNER_MAX_WAVES * FLOATS_PER_WAVE);
  options.waves.slice(0, GERSTNER_MAX_WAVES).forEach((wave, index) => {
    const [rawDx, rawDz] = wave.direction;
    const length = Math.hypot(rawDx, rawDz) || 1;
    const base = index * FLOATS_PER_WAVE;
    waveData[base] = rawDx / length;
    waveData[base + 1] = rawDz / length;
    waveData[base + 2] = wave.amplitude;
    waveData[base + 3] = wave.wavelength;
    waveData[base + 4] = wave.speed;
    waveData[base + 5] = wave.steepness;
  });

  // 深水默认不透明单面（#2100 复审落实）：不做透明混合/背面渲染，消除排序与背景透出。
  return new THREE.ShaderMaterial({
    transparent: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      // 网格世界原点（跟船平移）：相位取世界坐标，波场不随原点移动漂移（#2097）。
      uWorldOrigin: { value: new THREE.Vector2(0, 0) },
      uWaves: { value: waveData },
      uWaveCount: { value: Math.min(options.waves.length, GERSTNER_MAX_WAVES) },
      uAmplitudeScale: { value: options.amplitudeScale ?? 1 },
      uEnvelopeHalfSize: { value: envelopeSize > 0 ? envelopeSize / 2 : 0 },
      uEnvelopeFadeBand: { value: envelopeFade },
      uNearCutoutHalfSize: { value: options.nearCutoutHalfSizeMeters ?? 0 },
      uMicroOctaves: { value: micro.data },
      uMicroOctaveCount: { value: micro.count },
      uMicroFadeStart: { value: MICRO_NORMAL_FADE_DISTANCE_METERS * 0.35 },
      uMicroFadeEnd: { value: MICRO_NORMAL_FADE_DISTANCE_METERS },
      uSunIllumination: { value: options.sunIllumination ?? 1 },
      uWaterColor: { value: new THREE.Color(options.waterColor) },
      uDeepColor: { value: new THREE.Color(options.deepColor) },
      uHorizonColor: { value: new THREE.Color(options.horizonColor) },
      uFoamColor: { value: new THREE.Color(options.foamColor) },
      uSunDirection: { value: options.sunDirection.clone().normalize() },
      uFoamTex: { value: options.foamTexture ?? null },
    },
    vertexShader: /* glsl */ `
      #define MAX_WAVES ${GERSTNER_MAX_WAVES}
      #define FLOATS_PER_WAVE ${FLOATS_PER_WAVE}

      uniform float uTime;
      uniform vec2 uWorldOrigin;
      uniform float uWaves[MAX_WAVES * FLOATS_PER_WAVE];
      uniform int uWaveCount;
      uniform float uAmplitudeScale;
      uniform float uEnvelopeHalfSize;
      uniform float uEnvelopeFadeBand;
      uniform float uNearCutoutHalfSize;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPos;
      varying float vCrest;
      varying float vElevation;
      varying vec2 vLocalXZ;

      void main() {
        vec3 pos = position;
        // 相位必须使用未位移的原始坐标：Gerstner 场是 (x,z,t) 的确定函数，
        // 若逐波用已水平位移的 pos.xz 取相位，波序依赖且与 CPU 参照不再同公式。
        vec3 basePos = position;
        vec2 worldXZ = basePos.xz + uWorldOrigin;
        // 近场幅度包络（#2098）：外环 smoothstep 衰减，一阶导两端为零避免折痕。
        float envelope = 1.0;
        if (uEnvelopeHalfSize > 0.0) {
          float edgeDistance = max(abs(basePos.x), abs(basePos.z));
          float fadeStart = uEnvelopeHalfSize - uEnvelopeFadeBand;
          float t = clamp((edgeDistance - fadeStart) / uEnvelopeFadeBand, 0.0, 1.0);
          envelope = 1.0 - t * t * (3.0 - 2.0 * t);
        }
        // 近场挖空（#2098 二轮复审）：传网格局部坐标，片元级精确判定
        // （顶点二值标记会被光栅器插值，边界落到顶点中点而非 1024 m）。
        vLocalXZ = basePos.xz;
        // 包络梯度（#2098 复审）：衰减环内 dE/dd = -6t(1-t)/fade（两端为 0，C1）。
        float envelopeDx = 0.0;
        float envelopeDz = 0.0;
        if (uEnvelopeHalfSize > 0.0) {
          float ax = abs(basePos.x);
          float az = abs(basePos.z);
          float edgeDistance = max(ax, az);
          float fadeStartE = uEnvelopeHalfSize - uEnvelopeFadeBand;
          float te = clamp((edgeDistance - fadeStartE) / uEnvelopeFadeBand, 0.0, 1.0);
          float dEdge = -6.0 * te * (1.0 - te) / uEnvelopeFadeBand;
          envelopeDx = ax >= az ? dEdge * sign(basePos.x) : 0.0;
          envelopeDz = az > ax ? dEdge * sign(basePos.z) : 0.0;
        }
        // 完整参数曲面偏导（#2098）：P(x,z) = (x+Sx, Y, z+Sz)，法线取 +Y 主导方向。
        float dYdx = 0.0;
        float dYdz = 0.0;
        float dSxdx = 0.0;
        float dSxdz = 0.0;
        float dSzdx = 0.0;
        float dSzdz = 0.0;
        float crestRaw = 0.0;
        float amplitudeSum = 0.0;
        // 未包络原始位移累计（二轮复审）：乘积法则需要 E'·S，S 不得再含一次 E。
        float rawY = 0.0;
        float rawSx = 0.0;
        float rawSz = 0.0;

        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          int base = i * FLOATS_PER_WAVE;
          float dx = uWaves[base];
          float dz = uWaves[base + 1];
          float ampRaw = uWaves[base + 2] * uAmplitudeScale;
          float amp = ampRaw * envelope;
          float wavelength = uWaves[base + 3];
          float speed = uWaves[base + 4];
          float steepness = uWaves[base + 5];

          float k = 6.28318530718 / wavelength;
          float c = speed * sqrt(9.8 / k);
          float phase = k * (dx * worldXZ.x + dz * worldXZ.y) - c * k * uTime;
          float s = sin(phase);
          float co = cos(phase);

          pos.y += amp * s;
          pos.x += steepness * amp * dx * co;
          pos.z += steepness * amp * dz * co;

          dYdx += amp * co * k * dx;
          dYdz += amp * co * k * dz;
          dSxdx -= steepness * amp * s * k * dx * dx;
          dSxdz -= steepness * amp * s * k * dx * dz;
          dSzdx -= steepness * amp * s * k * dz * dx;
          dSzdz -= steepness * amp * s * k * dz * dz;
          crestRaw += amp * s;
          amplitudeSum += amp;
          rawY += ampRaw * s;
          rawSx += steepness * ampRaw * dx * co;
          rawSz += steepness * ampRaw * dz * co;
        }

        vElevation = pos.y;
        vCrest = amplitudeSum > 0.0 ? 0.5 * (1.0 + crestRaw / amplitudeSum) : 0.0;
        // 乘积法则（#2098 复审）：衰减环内 P = (x+E·Sx, E·Y, z+E·Sz)，
        // 偏导补 E'×原始位移项（rawSx/rawY/rawSz 未含包络，避免 E'·E·S）。
        vec3 dPdx = vec3(1.0 + dSxdx + envelopeDx * rawSx, dYdx + envelopeDx * rawY, dSzdx + envelopeDx * rawSz);
        vec3 dPdz = vec3(dSxdz + envelopeDz * rawSx, dYdz + envelopeDz * rawY, 1.0 + dSzdz + envelopeDz * rawSz);
        vec3 surfaceNormal = normalize(cross(dPdx, dPdz));
        if (surfaceNormal.y < 0.0) surfaceNormal = -surfaceNormal;
        // 世界空间几何法线（#2100 二轮复审）：光照/微法线/视线全程统一世界空间。
        vWorldNormal = surfaceNormal;
        vNormal = normalize(normalMatrix * surfaceNormal);

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPosition.xyz;
        vec4 viewPosition = viewMatrix * worldPosition;
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uWaterColor;
      uniform vec3 uDeepColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uFoamColor;
      uniform vec3 uSunDirection;
      uniform sampler2D uFoamTex;
      uniform float uNearCutoutHalfSize;
      uniform float uMicroOctaves[3 * 5];
      uniform int uMicroOctaveCount;
      uniform float uMicroFadeStart;
      uniform float uMicroFadeEnd;
      uniform float uSunIllumination;

      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPos;
      varying float vCrest;
      varying float vElevation;
      varying vec2 vLocalXZ;

      void main() {
        // 近场挖空（#2098 二轮复审）：远场片元按网格局部坐标精确判定
        // max(|x|,|z|) < 1024（顶点二值标记会被插值，边界落到顶点中点）。
        if (uNearCutoutHalfSize > 0.0 && max(abs(vLocalXZ.x), abs(vLocalXZ.y)) < uNearCutoutHalfSize) discard;
        // 世界空间统一（#2100 二轮复审）：法线/视线/光照全程世界空间，
        // 相机旋转只改变视线本身，波纹与高光不随视图变换旋转。
        vec3 viewDirection = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vWorldNormal);

        // 微法线（#2100）：只对着色法线加高频细节（光学），不动几何/姿态；
        // 像素脚印按相机距离 smoothstep 衰减，远海退化为基础法线不闪烁。
        float cameraDistance = length(vViewPosition);
        float footprint = clamp(
          (uMicroFadeEnd - cameraDistance) / max(uMicroFadeEnd - uMicroFadeStart, 1.0),
          0.0, 1.0);
        footprint = footprint * footprint * (3.0 - 2.0 * footprint);
        if (uMicroOctaveCount > 0 && footprint > 0.001) {
          float slopeX = 0.0;
          float slopeZ = 0.0;
          for (int i = 0; i < 3; i++) {
            if (i >= uMicroOctaveCount) break;
            int base = i * 5;
            float dx = uMicroOctaves[base];
            float dz = uMicroOctaves[base + 1];
            float k = uMicroOctaves[base + 2];
            float amp = uMicroOctaves[base + 3];
            float speedScale = uMicroOctaves[base + 4];
            float phase = k * (dx * vWorldPos.x + dz * vWorldPos.z)
              - k * speedScale * 1.2 * uTime;
            float slope = amp * cos(phase) * k;
            slopeX += slope * dx;
            slopeZ += slope * dz;
          }
          normal = normalize(normal + vec3(slopeX, 0.0, slopeZ) * footprint);
        }

        // 同源辐照（#2100 复审）：入射角 × 预设太阳强度归一——暗预设下水色与泡沫
        // 整体变暗（受光表面，非恒亮 additive）。
        float light = max(dot(normal, uSunDirection), 0.0) * uSunIllumination;

        float foamNoise = texture2D(uFoamTex, vWorldPos.xz / 80.0).a;
        float foam = smoothstep(0.72, 0.95, vCrest) * smoothstep(0.35, 0.7, foamNoise);

        // 介质光学（#2100 二轮复审落实）：Fresnel-Schlick（F0=0.02）与 GGX 高光
        // （D·F·G/(4 nv nl)，Smith-Schlick G），粗糙度随泡沫提升（受光且改变粗糙度）。
        float nDotV = max(dot(normal, viewDirection), 1e-4);
        float nDotL = max(dot(normal, uSunDirection), 0.0);
        vec3 halfVector = normalize(uSunDirection + viewDirection);
        float nDotH = max(dot(normal, halfVector), 0.0);
        float roughness = mix(0.06, 0.6, foam);
        float a = max(roughness * roughness, 1e-4);
        float a2 = a * a;
        float dTerm = (nDotH * nDotH) * (a2 - 1.0) + 1.0;
        float distribution = a2 / (3.14159265 * dTerm * dTerm);
        float fresnel = 0.02 + 0.98 * pow(1.0 - nDotL, 5.0);
        float k = a / 2.0;
        float gV = nDotV / (nDotV * (1.0 - k) + k);
        float gL = max(nDotL, 1e-4) / (max(nDotL, 1e-4) * (1.0 - k) + k);
        float specular = distribution * fresnel * gV * gL / max(4.0 * nDotV * max(nDotL, 1e-4), 1e-4);
        float viewFresnel = 0.02 + 0.98 * pow(1.0 - nDotV, 5.0);

        vec3 color = mix(uDeepColor, uWaterColor, light * 0.65 + 0.35 * uSunIllumination);
        color = mix(color, uHorizonColor, viewFresnel * 0.45);
        color += specular * uSunIllumination;
        vec3 foamLit = uFoamColor * (light * 0.65 + 0.35 * uSunIllumination);
        color = mix(color, foamLit, foam * 0.85);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

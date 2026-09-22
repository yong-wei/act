import * as THREE from 'three';

import { GERSTNER_MAX_WAVES, type GerstnerWave } from './gerstner-waves';
import { NEAR_FIELD_FADE_BAND_METERS } from './ocean-bands';
import { FOAM_EDGE_FADE_METERS } from './foam-history';
import { MAX_HULL_EXCLUSION_BOXES } from './hull-exclusion';
import type { MarineShoreSegment } from '../environment/scene-layouts';

/** 岸线段 uniform 上限（#2102）。 */
export const MAX_SHORE_SEGMENTS = 4;
import {
  LOW_TIER_ROUGHNESS_FLOOR,
  MICRO_COMPENSATED_ROUGHNESS_CAP,
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
  /** 光学质量档（#2116 修订）：微法线分量数随档变化（high 8/medium 3/low 0），只影响着色法线。 */
  readonly microNormalTier?: 'high' | 'medium' | 'low';
  /** 微法线 QA 归因开关（#2116）：false = 完全关闭（A/B 分层归因）。 */
  readonly microEnabled?: boolean;
  /** 同源太阳辐照（#2100 复审）：preset.sun.intensity / 预设最大值，暗预设泡沫/水色随之变暗。 */
  readonly sunIllumination?: number;
  /** 船壳排水排除框数（#2101）：0 表示无排除（uniform 数组仍按上限分配）。 */
  readonly hullExclusionCount?: number;
  /** 岸线段（#2102）：显示海面波幅随距岸衰减（渲染输入，非水动力）。 */
  readonly shoreSegments?: readonly MarineShoreSegment[];
  /** 岸线波幅衰减带宽度（米）。 */
  readonly shoreFadeBandMeters?: number;
  /** 挖泥羽流（#2102 六轮复审）：合入水面片元着色（贴合动态波面，前景几何天然正确遮挡）。 */
  readonly sedimentPlume?: { x: number; z: number; radiusMeters: number; opacity: number } | null;
  /** 替换顶点波场（FFT 位移纹理）时仍使用同一片元光学。 */
  readonly vertexShaderOverride?: string;
  /**
   * 环境辐射（#2118）：PMREM 天空纹理 + CubeUV 高度（来自 renderer×preset 缓存）。
   * 水面菲涅尔项混合 IBL 天空倒影；缺省保持 horizonColor 过渡（行为不变）。
   */
  readonly environment?: {
    readonly texture: THREE.Texture;
    readonly cubeUVHeight: number;
    readonly intensity: number;
  } | null;
  /**
   * 泡沫历史密度场（#2115）：密度纹理（R 通道，世界域跟船重定位）。
   * 提供时泡沫覆盖 = 场密度 × 多尺度细节；缺省回退平滑波峰覆盖（无重复贴花）。
   */
  readonly foamField?: {
    readonly texture: THREE.Texture;
    readonly domainMeters: number;
    readonly resolution: number;
  } | null;
}

const FLOATS_PER_WAVE = 6;
const MAX_MICRO_OCTAVES = 8;
const MICRO_FLOATS_PER_OCTAVE = 6;

/** CubeUV 采样定义（#2118）：与 three WebGLProgram.generateCubeUVSize 同推导。 */
export function cubeUvDefinesForHeight(imageHeight: number): Record<string, string> {
  const height = Math.max(16, Math.round(imageHeight));
  const maxMip = Math.log2(height) - 2;
  const texelHeight = 1 / height;
  const texelWidth = 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
  return {
    CUBEUV_TEXEL_WIDTH: String(texelWidth),
    CUBEUV_TEXEL_HEIGHT: String(texelHeight),
    CUBEUV_MAX_MIP: `${maxMip.toFixed(1)}`,
  };
}

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
    data[base + 5] = octave.phaseOffset;
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
  const env = options.environment ?? null;
  return new THREE.ShaderMaterial({
    transparent: false,
    side: THREE.FrontSide,
    // 环境辐射（#2118）：CubeUV PMREM 采样（与 three 内建 PBR 同 chunk/布局）。
    defines: env
      ? { USE_ENVMAP: '', ENVMAP_TYPE_CUBE_UV: '', ...cubeUvDefinesForHeight(env.cubeUVHeight) }
      : {},
    fog: true,
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
      // QA 归因开关（#2116）：?qa-micro=off 关闭全部微法线（A/B 分离归因）。
      uMicroEnabled: { value: options.microEnabled === false ? 0 : 1 },
      // 低档/远场粗糙度下限（#2116）：无细节成本下保持合理远海粗糙度。
      uMicroRoughnessFloor: { value: micro.count === 0 ? LOW_TIER_ROUGHNESS_FLOOR : WATER_BASE_ROUGHNESS },
      uSunIllumination: { value: options.sunIllumination ?? 1 },
      uHullExclusionBoxes: { value: new Float32Array(MAX_HULL_EXCLUSION_BOXES * 4) },
      uHullExclusionCount: { value: options.hullExclusionCount ?? 0 },
      uShipHeading: { value: 0 },
      uShoreSegments: { value: new Float32Array(MAX_SHORE_SEGMENTS * 4) },
      // 羽流经组件层逐帧写 uniform（见 gerstner-water.tsx），材质默认零半径。
      uShoreDepths: { value: new Float32Array(MAX_SHORE_SEGMENTS) },
      uPlumeCenter: { value: new THREE.Vector2(0, 0) },
      uPlumeRadius: { value: 0 },
      uPlumeOpacity: { value: 0 },
      uShoreSegmentCount: { value: 0 },
      uShoreFadeBand: { value: 400 },
      uWaterColor: { value: new THREE.Color(options.waterColor) },
      uDeepColor: { value: new THREE.Color(options.deepColor) },
      uHorizonColor: { value: new THREE.Color(options.horizonColor) },
      uFoamColor: { value: new THREE.Color(options.foamColor) },
      uSunDirection: { value: options.sunDirection.clone().normalize() },
      uFoamTex: { value: options.foamTexture ?? null },
      // 泡沫历史密度场（#2115）：uFoamOrigin 由组件逐帧写（域跟船重定位）。
      uFoamDensityTex: { value: options.foamField?.texture ?? null },
      uFoamOrigin: { value: new THREE.Vector2(0, 0) },
      uFoamDomain: { value: options.foamField?.domainMeters ?? 0 },
      uFoamResolution: { value: options.foamField?.resolution ?? 0 },
      uFoamFieldEnabled: { value: options.foamField ? 1 : 0 },
      uFoamEdgeFade: { value: FOAM_EDGE_FADE_METERS },
      // 环境辐射（#2118）：envMap/envMapIntensity/envMapRotation 为 three chunk
      // 契约 uniform；uEnvEnabled 兜底禁用（无纹理时不采样）。
      envMap: { value: env?.texture ?? null },
      envMapIntensity: { value: env?.intensity ?? 0 },
      envMapRotation: { value: new THREE.Matrix3() },
      uEnvEnabled: { value: env ? 1 : 0 },
      // 平面反射（#2118 受控高档）：投影矩阵/纹理/强度由反射组件逐帧写。
      uPlanarTex: { value: null },
      uPlanarMatrix: { value: new THREE.Matrix4() },
      uPlanarStrength: { value: 0 },
      uPlanarPlaneY: { value: -1 },
      uShallowBgTex: { value: null },
      uShallowBgEnabled: { value: 0 },
      uViewport: { value: new THREE.Vector2(1, 1) },
      // 浅水消费者开关（#2119 复审）：关闭时逐片元跳过岸线循环/吸收/折射
      //（额外工作归零）。
      uShallowFxEnabled: { value: 1 },
      // 雾（#2118）：材质 fog:true 时 renderer 按 scene.fog 刷新。
      fogColor: { value: new THREE.Color(0xffffff) },
      fogNear: { value: 1 },
      fogFar: { value: 30000 },
      fogDensity: { value: 0.00025 },
    },
    vertexShader: options.vertexShaderOverride ?? /* glsl */ `
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
      uniform vec4 uShoreSegments[4];
      uniform float uShoreDepths[4];
      uniform float uShoreSegmentCount;
      uniform float uShoreFadeBand;

      varying vec3 vNormal;
      varying vec3 vWorldNormal;
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
        // 岸线波幅衰减（#2102）：距岸线越近波幅越小（与 CPU shorelineAmplitudeAttenuation
        // 同公式：岸边 0.15 残余，带内 smoothstep，带外 1）；纯显示输入，非水动力。
        float shoreAttenuation = 1.0;
        if (uShoreSegmentCount > 0.0 && uShoreFadeBand > 0.0) {
          float minDistance = 1e9;
          for (int i = 0; i < 4; i++) {
            if (float(i) >= uShoreSegmentCount) break;
            vec4 seg = uShoreSegments[i];
            vec2 ab = seg.zw - seg.xy;
            float lenSq = dot(ab, ab);
            float t = lenSq > 0.0 ? clamp(dot(worldXZ - seg.xy, ab) / lenSq, 0.0, 1.0) : 0.0;
            float distance = length(worldXZ - (seg.xy + ab * t));
            if (distance < minDistance) {
              minDistance = distance;
            }
          }
          if (minDistance < uShoreFadeBand) {
            float t = minDistance / uShoreFadeBand;
            shoreAttenuation = 0.15 + 0.85 * t * t * (3.0 - 2.0 * t);
          }
        }
        float effectiveAmplitudeScale = uAmplitudeScale * shoreAttenuation;
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
          float ampRaw = uWaves[base + 2] * effectiveAmplitudeScale;
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
      uniform vec2 uWorldOrigin;
      uniform vec3 uWaterColor;
      uniform vec3 uDeepColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uFoamColor;
      uniform vec3 uSunDirection;
      uniform sampler2D uFoamTex;
      uniform float uNearCutoutHalfSize;
      uniform float uMicroOctaves[8 * 6];
      uniform int uMicroOctaveCount;
      uniform float uMicroEnabled;
      uniform float uMicroRoughnessFloor;
      uniform float uSunIllumination;
      uniform vec4 uHullExclusionBoxes[6];
      uniform float uHullExclusionCount;
      uniform float uShipHeading;
      uniform vec2 uPlumeCenter;
      uniform float uPlumeRadius;
      uniform float uPlumeOpacity;
      uniform vec4 uShoreSegments[4];
      uniform float uShoreDepths[4];
      uniform float uShoreSegmentCount;
      uniform float uShoreFadeBand;
      uniform sampler2D uFoamDensityTex;
      uniform vec2 uFoamOrigin;
      uniform float uFoamDomain;
      uniform float uFoamResolution;
      uniform float uFoamFieldEnabled;
      uniform float uFoamEdgeFade;
      uniform float uEnvEnabled;
      uniform sampler2D uPlanarTex;
      uniform mat4 uPlanarMatrix;
      uniform float uPlanarStrength;
      uniform float uPlanarPlaneY;
      uniform sampler2D uShallowBgTex;
      uniform float uShallowBgEnabled;
      uniform vec2 uViewport;
      uniform float uShallowFxEnabled;

      // 环境辐射（#2118）：与 three 内建 PBR 同一 CubeUV chunk（锁定版本布局）。
      #include <common>
      #include <cube_uv_reflection_fragment>
      #include <envmap_common_pars_fragment>
      #include <envmap_physical_pars_fragment>
      #include <fog_pars_fragment>

      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPos;
      varying float vCrest;
      varying float vElevation;
      varying vec2 vLocalXZ;

      // 浅水效应（#2117 片元化 / #2119 深度消费者）：x = 浅水因子（近岸程度 ×
      // 岸深反比），y = 估计水深（米）——供深度分级吸收与有界折射。
      // 远场细分降低后顶点插值不可用，片元按世界坐标独立求值。
      vec2 shoreEffects(vec2 worldXZ) {
        if (uShallowFxEnabled < 0.5 || uShoreSegmentCount <= 0.0 || uShoreFadeBand <= 0.0) return vec2(0.0, 20.0);
        float minDistance = 1e9;
        float nearestShoreDepth = 0.0;
        for (int i = 0; i < 4; i++) {
          if (float(i) >= uShoreSegmentCount) break;
          vec4 seg = uShoreSegments[i];
          vec2 ab = seg.zw - seg.xy;
          float lenSq = dot(ab, ab);
          float t = lenSq > 0.0 ? clamp(dot(worldXZ - seg.xy, ab) / lenSq, 0.0, 1.0) : 0.0;
          float distance = length(worldXZ - (seg.xy + ab * t));
          if (distance < minDistance) {
            minDistance = distance;
            nearestShoreDepth = uShoreDepths[i];
          }
        }
        if (minDistance >= uShoreFadeBand) return vec2(0.0, 20.0);
        float t = minDistance / uShoreFadeBand;
        float attenuation = 0.15 + 0.85 * t * t * (3.0 - 2.0 * t);
        float nearness = clamp((1.0 - attenuation) / 0.85, 0.0, 1.0);
        float depthFactor = clamp((20.0 - nearestShoreDepth) / 16.0, 0.05, 1.0);
        // 水深估计：岸边 ≈ 岸深的 15%（残余），带内线性到 ~岸深。
        float depth = mix(nearestShoreDepth * 0.15, nearestShoreDepth, t);
        return vec2(nearness * depthFactor, depth);
      }

      // 泡沫历史密度（#2115）：R 通道密度纹理 + 手动双线性（NearestFilter 上采样
      // 与 GPU 无关，跨设备确定）。域外 0；域缘按羽化带平滑衰减（ClampToEdge
      // 只钳制寻址，不提供衰减——否则随船域缘出现刚性方形泡沫边界）。
      float sampleFoamField(vec2 worldXZ) {
        vec2 local = worldXZ - uFoamOrigin;
        // 域缘羽化（P2 修复）：边缘带内 smoothstep 到 0。
        vec2 edgeT = (abs(local) - (uFoamDomain * 0.5 - uFoamEdgeFade)) / max(uFoamEdgeFade, 1.0);
        float edge = clamp(max(edgeT.x, edgeT.y), 0.0, 1.0);
        float feather = 1.0 - edge * edge * (3.0 - 2.0 * edge);
        if (feather <= 0.0) return 0.0;
        vec2 g = (local + uFoamDomain * 0.5) / (uFoamDomain / uFoamResolution) - 0.5;
        if (g.x < -0.5 || g.y < -0.5 || g.x > uFoamResolution - 0.5 || g.y > uFoamResolution - 0.5) {
          return 0.0;
        }
        vec2 base = floor(g);
        vec2 f = clamp(g - base, 0.0, 1.0);
        float inv = 1.0 / uFoamResolution;
        vec2 uv00 = (base + vec2(0.5, 0.5)) * inv;
        float t00 = texture2D(uFoamDensityTex, uv00).r;
        float t10 = texture2D(uFoamDensityTex, uv00 + vec2(inv, 0.0)).r;
        float t01 = texture2D(uFoamDensityTex, uv00 + vec2(0.0, inv)).r;
        float t11 = texture2D(uFoamDensityTex, uv00 + vec2(inv, inv)).r;
        return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y) * feather;
      }

      // 多尺度细节（#2115）：三个非谐波尺度 + 固定偏移去相关——同一噪声图不再
      // 以单一周期平铺（消除 80m 大贴花）；相位只随世界位置变化，不逐帧换噪声。
      float foamDetail(vec2 worldXZ) {
        float a = texture2D(uFoamTex, worldXZ / 23.0).a;
        float b = texture2D(uFoamTex, worldXZ / 71.0 + vec2(0.37, 0.13)).a;
        float c = texture2D(uFoamTex, worldXZ / 149.0 + vec2(0.71, 0.53)).a;
        return a * 0.4 + b * 0.35 + c * 0.25;
      }

      void main() {
        // 近场挖空（#2098 二轮复审）：远场片元按网格局部坐标精确判定
        // max(|x|,|z|) < 1024（顶点二值标记会被插值，边界落到顶点中点）。
        if (uNearCutoutHalfSize > 0.0 && max(abs(vLocalXZ.x), abs(vLocalXZ.y)) < uNearCutoutHalfSize) discard;
        // 船壳排水排除（#2101 四轮复审）：用位移后的世界坐标（vWorldPos - 网格原点）
        // 旋转到船体局部再判定——顶点着色器的水平位移会使未位移的 vLocalXZ 与
        // 实际渲染片元错开（壳缘穿水条带/误裁壳外海面）。
        if (uHullExclusionCount > 0.0) {
          vec2 displacedLocal = vWorldPos.xz - uWorldOrigin;
          float cosH = cos(uShipHeading);
          float sinH = sin(uShipHeading);
          float localX = displacedLocal.x * cosH + displacedLocal.y * sinH;
          float localZ = -displacedLocal.x * sinH + displacedLocal.y * cosH;
          for (int i = 0; i < 6; i++) {
            if (float(i) >= uHullExclusionCount) break;
            vec4 box = uHullExclusionBoxes[i];
            if (abs(localX - box.x) <= box.z && abs(localZ - box.y) <= box.w) discard;
          }
        }
        // 世界空间统一（#2100 二轮复审）：法线/视线/光照全程世界空间，
        // 相机旋转只改变视线本身，波纹与高光不随视图变换旋转。
        vec3 viewDirection = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vWorldNormal);

        // 微法线（#2100 / #2116 修订）：只对着色法线加高频细节（光学），不动几何/姿态。
        // 投影像素脚印（dFdx/dFdy 世界足迹）逐频带过滤亚 Nyquist 分量——
        // 分辨率/FOV/掠射变化改变足迹，过滤随采样密度变化而非只随距离。
        vec2 footprintStepX = dFdx(vWorldPos.xz);
        vec2 footprintStepY = dFdy(vWorldPos.xz);
        float slopeX = 0.0;
        float slopeZ = 0.0;
        float slopeEnergyTotal = 0.0;
        float slopeEnergyRetained = 0.0;
        if (uMicroEnabled > 0.5 && uMicroOctaveCount > 0) {
          for (int i = 0; i < 8; i++) {
            if (i >= uMicroOctaveCount) break;
            int base = i * 6;
            float dx = uMicroOctaves[base];
            float dz = uMicroOctaves[base + 1];
            float k = uMicroOctaves[base + 2];
            float amp = uMicroOctaves[base + 3];
            float speedScale = uMicroOctaves[base + 4];
            float phaseOffset = uMicroOctaves[base + 5];
            float wavelength = 6.28318530718 / k;
            // 逐频带方向脚印（复审）：像素世界步投影到该分量传播方向——
            // 掠射各向异性足迹下，沿短轴传播的波仍按自身方向可解析性过滤。
            float directionalStep = max(
              abs(footprintStepX.x * dx + footprintStepX.y * dz),
              abs(footprintStepY.x * dx + footprintStepY.y * dz));
            // 逐频带脚印权重（与 microOctaveFootprintWeight 同公式）。
            float t = clamp((wavelength / max(directionalStep, 1e-4) - 1.15) / 1.45, 0.0, 1.0);
            float weight = t * t * (3.0 - 2.0 * t);
            // 斜率方差口径（复审）：进入法线的斜率 = amp·k·weight，总方差按
            // (amp·k)²、保留方差含 weight²——否则高波数被滤除时补偿明显低估。
            float slopeVariance = amp * k * amp * k;
            slopeEnergyTotal += slopeVariance;
            slopeEnergyRetained += slopeVariance * weight * weight;
            if (weight > 0.002) {
              float phase = k * (dx * vWorldPos.x + dz * vWorldPos.z)
                - k * speedScale * 1.2 * uTime + phaseOffset;
              float slope = amp * cos(phase) * k * weight;
              slopeX += slope * dx;
              slopeZ += slope * dz;
            }
          }
          normal = normalize(normal + vec3(slopeX, 0.0, slopeZ));
        }
        // 斜率能量补偿（#2116）：被滤除能量转成有界粗糙度——远海保留高光
        // 能量与质感，900m 处不再硬变镜面；低档/远场用粗糙度下限兜底。
        float lostSlopeFraction = slopeEnergyTotal > 0.0
          ? clamp(1.0 - slopeEnergyRetained / slopeEnergyTotal, 0.0, 1.0)
          : 0.0;

        // 同源辐照（#2100 复审）：入射角 × 预设太阳强度归一——暗预设下水色与泡沫
        // 整体变暗（受光表面，非恒亮 additive）。
        float light = max(dot(normal, uSunDirection), 0.0) * uSunIllumination;

        // 浅水消费者（#2119）：深度分级吸收（有界 Beer-Lambert——浅处向青绿、
        // 深处回基础色；替代固定 0.45 平铺混色）+ 有界折射（浅水梯度上按视线
        // 偏移细节采样 ≤0.35m，视觉近似非光线追踪）。
        // 开关整体包裹（复审修复）：关闭时吸收/折射/浅水混色的全部逐片元
        // 计算（不只岸线循环）都不执行——性能 A/B 干净。
        float absorption = 1.0;
        vec2 refractionOffset = vec2(0.0);
        float shallowMix = 0.0;
        if (uShallowFxEnabled > 0.5) {
          vec2 shoreFx = shoreEffects(vWorldPos.xz);
          absorption = exp(-max(shoreFx.y, 0.2) * 0.55);
          refractionOffset = viewDirection.xz * (1.0 - absorption) * 0.35 * shoreFx.x;
          shallowMix = shoreFx.x;
        }
        // 泡沫覆盖（#2115）：有历史场时覆盖 = 场密度（自然压缩 + 船体/推进器源
        // 的输运/衰减历史），无场回退平滑波峰覆盖——两条路径都乘多尺度细节，
        // 不再用单一 80m 平铺贴花。
        float foamCoverage = uFoamFieldEnabled > 0.5
          ? sampleFoamField(vWorldPos.xz)
          : smoothstep(0.72, 0.95, vCrest) * 0.55;
        float foam = foamCoverage * smoothstep(0.22, 0.78, foamDetail(vWorldPos.xz + refractionOffset));

        // 介质光学（#2100 二轮复审落实）：Fresnel-Schlick（F0=0.02）与 GGX 高光
        // （D·F·G/(4 nv nl)，Smith-Schlick G），粗糙度随泡沫提升（受光且改变粗糙度）。
        float nDotV = max(dot(normal, viewDirection), 1e-4);
        float nDotL = max(dot(normal, uSunDirection), 0.0);
        vec3 halfVector = normalize(uSunDirection + viewDirection);
        float nDotH = max(dot(normal, halfVector), 0.0);
        float baseRoughness = max(uMicroRoughnessFloor, mix(0.06, 0.6, foam));
        float compensatedRoughness = mix(0.06, ${MICRO_COMPENSATED_ROUGHNESS_CAP}, lostSlopeFraction);
        float roughness = max(baseRoughness, compensatedRoughness);
        float a = max(roughness * roughness, 1e-4);
        float a2 = a * a;
        float dTerm = (nDotH * nDotH) * (a2 - 1.0) + 1.0;
        float distribution = a2 / (3.14159265 * dTerm * dTerm);
        float vDotH = max(dot(viewDirection, halfVector), 0.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - vDotH, 5.0);
        float k = a / 2.0;
        float gV = nDotV / (nDotV * (1.0 - k) + k);
        float gL = max(nDotL, 1e-4) / (max(nDotL, 1e-4) * (1.0 - k) + k);
        float specular = distribution * fresnel * gV * gL / max(4.0 * nDotV * max(nDotL, 1e-4), 1e-4);
        float viewFresnel = 0.02 + 0.98 * pow(1.0 - nDotV, 5.0);

        vec3 color = mix(uDeepColor, uWaterColor, light * 0.65 + 0.35 * uSunIllumination);
        // 浅水色（#2102 → #2119 深度吸收）：近岸按估计水深做有界指数吸收——
        // 深度差异可见（4m 岸与 18m 岸的浅水带颜色不同）；船边遮挡由既有
        // 船壳排水排除（壳下水片元被丢弃，浅水色不从船底透出）。
        vec3 shallowColor = mix(vec3(0.28, 0.52, 0.5), color, absorption);
        if (uShallowBgEnabled > 0.5) {
          vec2 screenUv = gl_FragCoord.xy / max(uViewport, vec2(1.0));
          vec2 shift = clamp(refractionOffset / 40.0, vec2(-0.02), vec2(0.02));
          vec4 centerSample = texture2D(uShallowBgTex, screenUv);
          vec4 shiftedSample = texture2D(uShallowBgTex, screenUv + shift);
          float depthFault = abs(shiftedSample.a - centerSample.a);
          vec3 background = depthFault > 0.2 ? centerSample.rgb : shiftedSample.rgb;
          shallowColor = background * absorption;
        }
        color = mix(color, shallowColor, shallowMix);
        // 挖泥羽流（#2102 六轮复审）：水面片元内合成——贴合动态波面（波峰波谷下
        // 持续可见）、不穿透前景几何（正常深度队列），软边径向过渡；采样位置
        // 施加浅水折射偏移（羽流边缘随水层厚度弯折——水柱内容的可见折射）。
        if (uPlumeRadius > 0.0 && uPlumeOpacity > 0.0) {
          float plumeDistance = length(vWorldPos.xz + refractionOffset - uPlumeCenter);
          float plumeMix = (1.0 - smoothstep(uPlumeRadius * 0.55, uPlumeRadius, plumeDistance)) * uPlumeOpacity;
          color = mix(color, vec3(0.478, 0.416, 0.322), plumeMix);
        }
        // 环境倒影（#2118）：菲涅尔项从纯 horizonColor 过渡升级为
        // horizonColor↔PMREM 天空 IBL 混合（GGX 粗糙度感知，chunk 同布局采样）；
        // 无环境（intensity 0）时退回原 horizon 过渡——波光责任不变。
        vec3 reflectionTint = uHorizonColor;
        #ifdef USE_ENVMAP
        if (uEnvEnabled > 0.5) {
          // 世界空间直接采样（P1 修复）：three 的 getIBLRadiance 期望视图空间
          // 入参（内部做 inverseTransformDirection(viewMatrix)）——这里手动展开
          // 同一公式（pow4 粗糙度混合 + envMapRotation），与船体 PBR 方向一致。
          vec3 envReflect = reflect(-viewDirection, normal);
          envReflect = normalize(mix(envReflect, normal, pow4(roughness)));
          vec3 ibl = textureCubeUV(envMap, envMapRotation * envReflect, roughness).rgb
            * envMapIntensity;
          reflectionTint = mix(uHorizonColor, ibl, clamp(envMapIntensity, 0.0, 1.0));
        }
        #endif
        // 平面反射（#2118 受控高档）：镜像世界坐标投影采样；近船强、远端衰减，
        // 掠射菲涅尔加权——船体倒影可开关且不递归（反射 pass 隐藏水面自身）。
        if (uPlanarStrength > 0.001) {
          vec3 mirrored = vec3(vWorldPos.x, 2.0 * uPlanarPlaneY - vWorldPos.y, vWorldPos.z);
          vec4 planarUv = uPlanarMatrix * vec4(mirrored, 1.0);
          vec3 planarColor = texture2DProj(uPlanarTex, planarUv).rgb;
          float planarFade = 1.0 - smoothstep(120.0, 900.0, length(vWorldPos.xz - cameraPosition.xz));
          reflectionTint = mix(
            reflectionTint,
            mix(reflectionTint, planarColor, uPlanarStrength * planarFade),
            viewFresnel
          );
        }
        color = mix(color, reflectionTint, viewFresnel * 0.45);
        color += specular * uSunIllumination;
        vec3 foamLit = uFoamColor * (light * 0.65 + 0.35 * uSunIllumination);
        color = mix(color, foamLit, foam * 0.85);

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

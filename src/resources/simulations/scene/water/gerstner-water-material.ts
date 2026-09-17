import * as THREE from 'three';

import { GERSTNER_MAX_WAVES, type GerstnerWave } from './gerstner-waves';
import { NEAR_FIELD_FADE_BAND_METERS } from './ocean-bands';

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
}

const FLOATS_PER_WAVE = 6;

/**
 * GPU Gerstner 海面材质：vertex 阶段做几何位移（含水平分量锐化波峰），
 * fragment 阶段按波峰因子 + 噪声贴图出泡沫，菲涅尔过渡到地平线色。
 * 与 scene/water/gerstner-waves.ts 的 CPU 参照共用同一公式。
 */
export function createGerstnerWaterMaterial(options: GerstnerWaterMaterialOptions): THREE.ShaderMaterial {
  const envelopeSize = options.envelopeSizeMeters ?? 0;
  const envelopeFade = options.envelopeFadeBandMeters ?? NEAR_FIELD_FADE_BAND_METERS;
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

  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      // 网格世界原点（跟船平移）：相位取世界坐标，波场不随原点移动漂移（#2097）。
      uWorldOrigin: { value: new THREE.Vector2(0, 0) },
      uWaves: { value: waveData },
      uWaveCount: { value: Math.min(options.waves.length, GERSTNER_MAX_WAVES) },
      uAmplitudeScale: { value: options.amplitudeScale ?? 1 },
      uEnvelopeHalfSize: { value: envelopeSize > 0 ? envelopeSize / 2 : 0 },
      uEnvelopeFadeBand: { value: envelopeFade },
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

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPos;
      varying float vCrest;
      varying float vElevation;

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
        // 完整参数曲面偏导（#2098）：P(x,z) = (x+Sx, Y, z+Sz)，法线取 +Y 主导方向。
        float dYdx = 0.0;
        float dYdz = 0.0;
        float dSxdx = 0.0;
        float dSxdz = 0.0;
        float dSzdx = 0.0;
        float dSzdz = 0.0;
        float crestRaw = 0.0;
        float amplitudeSum = 0.0;

        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          int base = i * FLOATS_PER_WAVE;
          float dx = uWaves[base];
          float dz = uWaves[base + 1];
          float amp = uWaves[base + 2] * uAmplitudeScale * envelope;
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
        }

        vElevation = pos.y;
        vCrest = amplitudeSum > 0.0 ? 0.5 * (1.0 + crestRaw / amplitudeSum) : 0.0;
        vec3 dPdx = vec3(1.0 + dSxdx, dYdx, dSzdx);
        vec3 dPdz = vec3(dSxdz, dYdz, 1.0 + dSzdz);
        vec3 surfaceNormal = normalize(cross(dPdx, dPdz));
        if (surfaceNormal.y < 0.0) surfaceNormal = -surfaceNormal;
        vNormal = normalize(normalMatrix * surfaceNormal);

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPosition.xyz;
        vec4 viewPosition = viewMatrix * worldPosition;
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uWaterColor;
      uniform vec3 uDeepColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uFoamColor;
      uniform vec3 uSunDirection;
      uniform sampler2D uFoamTex;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPos;
      varying float vCrest;
      varying float vElevation;

      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        vec3 normal = normalize(vNormal);

        float light = max(dot(normal, uSunDirection), 0.0);
        float specular = pow(max(dot(reflect(-uSunDirection, normal), viewDirection), 0.0), 64.0);
        float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);

        float foamNoise = texture2D(uFoamTex, vWorldPos.xz / 80.0).a;
        float foam = smoothstep(0.72, 0.95, vCrest) * smoothstep(0.35, 0.7, foamNoise);

        vec3 color = mix(uDeepColor, uWaterColor, light * 0.65 + 0.35);
        color = mix(color, uHorizonColor, fresnel * 0.45);
        color += specular * 0.3;
        color = mix(color, uFoamColor, foam * 0.85);

        gl_FragColor = vec4(color, 0.94);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

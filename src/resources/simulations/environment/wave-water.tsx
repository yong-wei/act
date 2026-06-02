'use client';

/**
 * 波浪海面组件
 * 使用5层波浪着色器的逼真海面效果
 */

import { useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ============ 波浪参数 ============

export const waveParams = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } },
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } },
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } },
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } },
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } },
];

// ============ 着色器材质 ============

const WaterShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#124060'),
    uFoamColor: new THREE.Color('#ffffff'),
    uSunPosition: new THREE.Vector3(200, 150, 200),
    uWaveAmplitude: 1.0,
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uWaveAmplitude;
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    const int WAVE_COUNT = 5;

    const float waves[25] = float[](
      1.2, 0.018, 0.9, 1.0, 0.1,
      0.9, 0.035, 1.1, 0.4, 0.9,
      0.6, 0.06,  1.3, -0.6, 0.5,
      0.35, 0.12, 1.6, 0.3, -0.7,
      0.15, 0.25, 2.0, -0.5, -0.6
    );

    void main() {
      vUv = uv;
      vec3 pos = position;
      float elevation = 0.0;
      float dHdx = 0.0;
      float dHdz = 0.0;

      for(int i = 0; i < WAVE_COUNT; i++) {
        int idx = i * 5;
        float amp = waves[idx] * uWaveAmplitude;
        float freq = waves[idx + 1];
        float speed = waves[idx + 2];
        float dx = waves[idx + 3];
        float dz = waves[idx + 4];

        float phase = (pos.x * dx + pos.z * dz) * freq + uTime * speed;
        elevation += amp * sin(phase);

        float derivative = amp * cos(phase) * freq;
        dHdx += derivative * dx;
        dHdz += derivative * dz;
      }

      pos.y += elevation;
      vElevation = elevation;

      vec3 normal = normalize(vec3(-dHdx, 1.0, -dHdz));
      vNormal = normalMatrix * normal;

      vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vViewPosition = viewPosition.xyz;

      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor;
    uniform vec3 uFoamColor;
    uniform vec3 uSunPosition;

    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec3 viewDirection = normalize(-vViewPosition);
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(uSunPosition);

      float light = max(dot(normal, sunDir), 0.0);
      float specular = pow(max(dot(reflect(-sunDir, normal), viewDirection), 0.0), 64.0);
      float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);

      float noiseVal = noise(vUv * 300.0);
      float foamThreshold = 0.9;
      float foamFactor = smoothstep(foamThreshold, foamThreshold + 0.3, vElevation + noiseVal * 0.4);

      vec3 waterColor = mix(uColor * 0.5, uColor * 1.3, light * 0.7 + 0.3);
      vec3 finalColor = mix(waterColor, vec3(0.7, 0.85, 0.95), fresnel * 0.4);
      finalColor += vec3(specular * 0.4);
      finalColor = mix(finalColor, uFoamColor, foamFactor * 0.85);

      gl_FragColor = vec4(finalColor, 0.92);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
);

extend({ WaterShaderMaterial });

// ============ 波浪高度计算函数 ============

export function getWaveHeight(x: number, z: number, time: number, amplitudeScale: number = 1.0): number {
  let y = 0;
  waveParams.forEach((wave) => {
    const phase = (x * wave.direction.x + z * wave.direction.z) * wave.frequency + time * wave.speed;
    y += wave.amplitude * amplitudeScale * Math.sin(phase);
  });
  return y;
}

// ============ 波浪海面组件 ============

interface WaveWaterProps {
  /** 船舶位置 (用于海面跟随) */
  shipPosition?: { x: number; z: number };
  /** 海面尺寸 */
  size?: number;
  /** 网格分辨率 */
  resolution?: number;
  /** 海况等级 (1-6, 影响波浪振幅) */
  seaState?: number;
  /** 水体颜色 */
  waterColor?: string;
  /** 泡沫颜色 */
  foamColor?: string;
}

export function WaveWater({
  shipPosition,
  size = 60000,
  resolution = 512,
  seaState = 3,
  waterColor = '#124060',
  foamColor = '#ffffff',
}: WaveWaterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(size, size, resolution, resolution),
    [size, resolution]
  );

  // 根据海况调整波浪振幅
  const waveAmplitude = useMemo(() => {
    // 海况 1-6 对应振幅 0.3 - 2.0
    return 0.3 + (seaState - 1) * 0.34;
  }, [seaState]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // 跟随船舶位置
    if (meshRef.current && shipPosition) {
      meshRef.current.position.x = shipPosition.x;
      meshRef.current.position.z = shipPosition.z;
    }

    // 更新着色器时间
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <waterShaderMaterial
        ref={materialRef}
        side={THREE.DoubleSide}
        transparent
        uColor={new THREE.Color(waterColor)}
        uFoamColor={new THREE.Color(foamColor)}
        uWaveAmplitude={waveAmplitude}
      />
    </mesh>
  );
}

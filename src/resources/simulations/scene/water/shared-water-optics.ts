/**
 * Gerstner 与 FFT 共用的水体光学入口（#2132）。
 * 波场只提供位移和法线；菲涅尔、IBL、平面反射、泡沫和浅水吸收走同一套 uniform。
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import { cubeUvDefinesForHeight } from './gerstner-water-material';

/** wave-only 两条路线共用的中性片元：只有高度明暗和几何法线，不含 Fresnel/GGX/IBL。 */
export const NEUTRAL_WATER_FRAGMENT = /* glsl */ `
  varying float vElevation;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vHorizontalDisp;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float ndl = clamp(dot(n, normalize(vec3(0.35, 1.0, 0.25))), 0.25, 1.0);
    float shade = clamp(0.5 + vElevation * 0.6 + length(vHorizontalDisp) * 1e-8, 0.35, 1.0);
    vec3 color = mix(vec3(0.05, 0.16, 0.24), vec3(0.12, 0.30, 0.38), shade);
    color *= ndl;
    float fog = clamp(length(vWorldPos.xz - cameraPosition.xz) / 9000.0, 0.0, 1.0);
    color = mix(color, vec3(0.58, 0.66, 0.72), fog * 0.6);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Beer-Lambert 水层吸收。深度用米，系数与片元着色器 `exp(-depth * 0.55)` 相同。 */
export function shallowPathAbsorption(depthMeters: number): number {
  return Math.exp(-Math.max(depthMeters, 0.2) * 0.55);
}

export const COMPARISON_SUN_DIRECTION = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

export interface SharedWaterOpticsFrame {
  readonly material: THREE.ShaderMaterial;
  readonly scene: THREE.Scene;
  readonly gl: THREE.WebGLRenderer;
  readonly disableEnvironment: boolean;
  readonly shallowEnabled: boolean;
  readonly foamOrigin?: { readonly x: number; readonly z: number } | null;
  readonly envSpin: boolean;
  readonly elapsedSeconds: number;
}

const ENV_SPIN_MATRIX = new THREE.Matrix4();
const VIEWPORT_SIZE = new THREE.Vector2();

/** 把场景里的 IBL、平面反射和浅水背景写进共用材质。 */
export function syncSharedWaterOptics(frame: SharedWaterOpticsFrame): void {
  const { material, scene, gl, disableEnvironment, shallowEnabled } = frame;
  material.uniforms.uShallowFxEnabled.value = shallowEnabled ? 1 : 0;
  gl.getDrawingBufferSize(VIEWPORT_SIZE);
  material.uniforms.uViewport.value.set(VIEWPORT_SIZE.x, VIEWPORT_SIZE.y);
  if (frame.foamOrigin) {
    material.uniforms.uFoamOrigin.value.set(frame.foamOrigin.x, frame.foamOrigin.z);
  }
  const foamDrift = (scene.userData as {
    marineFoamField?: { driftMetersPerSecond?: readonly [number, number] };
  }).marineFoamField?.driftMetersPerSecond;
  if (foamDrift && material.uniforms.uFoamDrift) {
    material.uniforms.uFoamDrift.value.set(foamDrift[0], foamDrift[1]);
  }
  const env = disableEnvironment
    ? undefined
    : (scene.userData as {
      marineEnvRadiance?: { texture: THREE.Texture; cubeUVHeight: number; intensity: number };
    }).marineEnvRadiance;
  if (env && material.uniforms.envMap.value !== env.texture) {
    material.uniforms.envMap.value = env.texture;
    material.uniforms.envMapIntensity.value = env.intensity;
    material.uniforms.uEnvEnabled.value = 1;
    let definesChanged = false;
    if (material.defines.USE_ENVMAP === undefined) {
      material.defines.USE_ENVMAP = '';
      material.defines.ENVMAP_TYPE_CUBE_UV = '';
      definesChanged = true;
    }
    const defines = cubeUvDefinesForHeight(env.cubeUVHeight);
    for (const [key, value] of Object.entries(defines)) {
      if (material.defines[key] !== value) {
        material.defines[key] = value;
        definesChanged = true;
      }
    }
    if (definesChanged) material.needsUpdate = true;
  } else if (!env && material.uniforms.uEnvEnabled.value !== 0) {
    material.uniforms.uEnvEnabled.value = 0;
    material.uniforms.envMapIntensity.value = 0;
  }
  if (frame.envSpin && material.uniforms.uEnvEnabled.value > 0) {
    (material.uniforms.envMapRotation.value as THREE.Matrix3)
      .setFromMatrix4(ENV_SPIN_MATRIX.makeRotationY(frame.elapsedSeconds * 0.4))
      .transpose();
  }
  const planar = (scene.userData as {
    marinePlanarReflection?: { texture: THREE.Texture; matrix: THREE.Matrix4; strength: number; planeY: number };
  }).marinePlanarReflection;
  if (planar && !disableEnvironment) {
    material.uniforms.uPlanarTex.value = planar.texture;
    (material.uniforms.uPlanarMatrix.value as THREE.Matrix4).copy(planar.matrix);
    material.uniforms.uPlanarStrength.value = planar.strength;
    material.uniforms.uPlanarPlaneY.value = planar.planeY;
  } else if (material.uniforms.uPlanarStrength.value !== 0) {
    material.uniforms.uPlanarStrength.value = 0;
  }
  const backdrop = (scene.userData as {
    marineShallowBackdrop?: { texture: THREE.Texture } | null;
  }).marineShallowBackdrop;
  if (shallowEnabled && backdrop) {
    material.uniforms.uShallowBgTex.value = backdrop.texture;
    material.uniforms.uShallowBgEnabled.value = 1;
  } else if (material.uniforms.uShallowBgEnabled.value !== 0) {
    material.uniforms.uShallowBgEnabled.value = 0;
    material.uniforms.uShallowBgTex.value = null;
  }
}

const BACKDROP_VS = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKDROP_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDepthNorm;
  void main() {
    gl_FragColor = vec4(uColor, uDepthNorm);
  }
`;

function backdropPlane(color: THREE.Color, depthMeters: number, z: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(500, 220);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uDepthNorm: { value: depthMeters / 30 },
    },
    vertexShader: BACKDROP_VS,
    fragmentShader: BACKDROP_FS,
    depthTest: true,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, -8, z);
  mesh.name = 'marine-seabed';
  return mesh;
}

/**
 * 浅水背景通道。只在启用时分配 RT，并只渲染水底测试面，不包含船体等前景。
 * 关闭时释放目标，深海路径不保留这张纹理。
 */
export function MarineShallowBackdrop({ enabled }: { readonly enabled: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const backdropScene = useMemo(() => {
    const next = new THREE.Scene();
    next.add(backdropPlane(new THREE.Color(0.76, 0.42, 0.18), 4, 0));
    next.add(backdropPlane(new THREE.Color(0.12, 0.22, 0.34), 18, 260));
    return next;
  }, []);

  useEffect(() => () => {
    backdropScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | undefined;
      material?.dispose?.();
    });
  }, [backdropScene]);

  useEffect(() => {
    if (!enabled) {
      targetRef.current?.dispose();
      targetRef.current = null;
      delete scene.userData.marineShallowBackdrop;
      return undefined;
    }
    const target = new THREE.WebGLRenderTarget(320, 180, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    targetRef.current = target;
    scene.userData.marineShallowBackdrop = { texture: target.texture };
    return () => {
      target.dispose();
      if (targetRef.current === target) targetRef.current = null;
      if (scene.userData.marineShallowBackdrop?.texture === target.texture) {
        delete scene.userData.marineShallowBackdrop;
      }
    };
  }, [enabled, gl, scene]);

  useFrame(() => {
    const target = targetRef.current;
    if (!enabled || !target) return;
    const previous = gl.getRenderTarget();
    const viewport = new THREE.Vector4();
    gl.getViewport(viewport);
    gl.setRenderTarget(target);
    gl.setViewport(0, 0, target.width, target.height);
    gl.clear(true, true, true);
    gl.render(backdropScene, camera);
    gl.setRenderTarget(previous);
    gl.setViewport(viewport);
  });

  return null;
}

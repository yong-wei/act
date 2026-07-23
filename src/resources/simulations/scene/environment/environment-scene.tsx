'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { useSceneEnvironment } from './environment-state';

/** 平台尺度的环境组成（天空球体/地平线剪影带/云层/光照/雾），全部由当前环境预设驱动。 */
export function EnvironmentScene() {
  const { preset } = useSceneEnvironment();

  const [skyTexture, horizonTexture, cloudTexture] = useTexture([
    preset.skyTexture,
    preset.horizonTexture,
    preset.cloudTexture,
  ]);

  useMemo(() => {
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    horizonTexture.wrapS = THREE.RepeatWrapping;
    horizonTexture.wrapT = THREE.ClampToEdgeWrapping;
    horizonTexture.repeat.set(2.6 * preset.scale, 1);
    horizonTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
    cloudTexture.repeat.set(2.2 * preset.scale, 1);
  }, [skyTexture, horizonTexture, cloudTexture, preset.scale]);

  const cloudDriftRef = useRef(0);
  useFrame((state, delta) => {
    cloudDriftRef.current = (cloudDriftRef.current + delta * 0.004) % 1;
    cloudTexture.offset.set(cloudDriftRef.current, 0);
    void state;
  });

  const sunPosition = useMemo(
    () => new THREE.Vector3(...preset.sun.position).multiplyScalar(1000),
    [preset.sun.position]
  );
  const fillPosition = useMemo(() => sunPosition.clone().multiplyScalar(-1), [sunPosition]);

  return (
    <>
      <fog attach="fog" args={[preset.fog.color, 4500 * preset.fog.nearScale, 18000 * preset.fog.farScale]} />

      <hemisphereLight
        args={[preset.hemisphere.skyColor, preset.hemisphere.groundColor, preset.hemisphere.intensity]}
      />
      <directionalLight
        color={preset.sun.color}
        intensity={preset.sun.intensity}
        position={sunPosition}
        castShadow
      />
      <directionalLight color={preset.fill.color} intensity={preset.fill.intensity} position={fillPosition} />

      {/* 天空球体 */}
      <mesh position={[0, 900, 0]} renderOrder={-30}>
        <sphereGeometry args={[10000 * preset.scale, 48, 24]} />
        <meshBasicMaterial
          map={skyTexture}
          transparent
          opacity={preset.skyOpacity}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 地平线剪影带 */}
      <mesh position={[0, preset.horizonY * 1700, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={-20}>
        <cylinderGeometry args={[8000 * preset.scale, 8000 * preset.scale, 2700 * preset.scale, 72, 1, true]} />
        <meshBasicMaterial
          map={horizonTexture}
          transparent
          opacity={preset.horizonOpacity}
          alphaTest={0.05}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 漂移云层 */}
      <mesh position={[0, 3300 * preset.scale, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={-10}>
        <cylinderGeometry args={[7800 * preset.scale, 7800 * preset.scale, 3000 * preset.scale, 72, 1, true]} />
        <meshBasicMaterial
          map={cloudTexture}
          transparent
          opacity={preset.cloudOpacity}
          alphaTest={0.03}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

/** 当前环境预设的海面颜色组（供 GerstnerWater 按预设驱动）。 */
export function useEnvironmentWaterColors() {
  const { preset } = useSceneEnvironment();
  return preset.water;
}

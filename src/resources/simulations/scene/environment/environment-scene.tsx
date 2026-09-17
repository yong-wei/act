'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { useSceneEnvironment } from './environment-state';
import {
  disposeMarineEnvironmentRadiance,
  MARINE_ENVIRONMENT_IBL_INTENSITY,
  MARINE_SHADOW_BOUNDS_METERS,
  marineRendererKey,
  marineSunFrameForSubject,
  resolveMarineEnvironmentRadiance,
  worldSunDirection,
  type MarinePmremSource,
} from './environment-radiance';
import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { useSceneQuality } from '../quality/quality-state';

export interface EnvironmentSceneProps {
  /**
   * 主体（船）位置采样器（#2099）：方向光与阴影 target 围绕主体拟合并逐帧跟随，
   * 主体远离原点时阴影保持稳定；缺省退回世界原点（旧语义）。
   */
  readonly subjectPositionSampler?: () => { readonly x: number; readonly z: number };
}

/** 平台尺度的环境组成（天空球体/地平线剪影带/云层/光照/雾），全部由当前环境预设驱动。 */
export function EnvironmentScene({ subjectPositionSampler }: EnvironmentSceneProps = {}) {
  const { preset } = useSceneEnvironment();
  const { params } = useSceneQuality();
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunTargetRef = useRef<THREE.Object3D>(null);

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

  const marineVisualTime = useMarineVisualTime();

  // 环境辐射（#2099）：同一天空纹理构建仅含天空的离屏场景 → PMREM 按 preset 缓存，
  // 预设不变时复用不重生成；scene.environment 供船体 PBR 拾取，IBL 降权避免与
  // 方向光太阳能量重复计入。
  useEffect(() => {
    let generator: THREE.PMREMGenerator | null = null;
    const source: MarinePmremSource = {
      fromSkyScene: (skyScene) => {
        generator = new THREE.PMREMGenerator(gl);
        return generator.fromScene(skyScene, 0, 1, 10000).texture;
      },
    };
    const skySceneFactory = () => {
      const skyScene = new THREE.Scene();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(100, 32, 16),
        new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, toneMapped: false }),
      );
      skyScene.add(sphere);
      return skyScene;
    };
    // PMREM render-target 属于生成它的 renderer：缓存按 renderer 隔离，卸载释放本 renderer 条目。
    const rendererKey = marineRendererKey(gl);
    const entry = resolveMarineEnvironmentRadiance(source, skySceneFactory, preset.id, rendererKey);
    scene.environment = entry.texture;
    scene.environmentIntensity = MARINE_ENVIRONMENT_IBL_INTENSITY;
    return () => {
      generator?.dispose();
      disposeMarineEnvironmentRadiance(rendererKey);
      if (scene.environment === entry.texture) scene.environment = null;
    };
  }, [gl, scene, preset.id, skyTexture]);

  useFrame((state, delta) => {
    // 云漂移是共享视觉时间的纯函数：同帧唯一、可注入重放（不再自累加独立时钟）。
    cloudTexture.offset.set((marineVisualTime(state, delta) * 0.004) % 1, 0);
    // 方向光跟随主体（#2099）：位置 = 主体 + 太阳方向 × 距离；target = 主体。
    // 主体远离原点时阴影相机随之平移，覆盖与方向保持稳定。
    const sunLight = sunLightRef.current;
    const sunTarget = sunTargetRef.current;
    if (sunLight && sunTarget) {
      const subject = subjectPositionSampler?.() ?? { x: 0, z: 0 };
      const frame = marineSunFrameForSubject(preset, subject);
      sunLight.position.copy(frame.lightPosition);
      sunTarget.position.copy(frame.targetPosition);
      sunLight.target = sunTarget;
    }
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
      <object3D ref={sunTargetRef} />
      <directionalLight
        ref={sunLightRef}
        key={`sun-${params.shadowMapSize}`}
        color={preset.sun.color}
        intensity={preset.sun.intensity}
        position={sunPosition}
        castShadow={params.shadowsEnabled}
        shadow-mapSize={params.shadowMapSize}
        shadow-camera-near={100}
        shadow-camera-far={2200}
        shadow-camera-left={-MARINE_SHADOW_BOUNDS_METERS}
        shadow-camera-right={MARINE_SHADOW_BOUNDS_METERS}
        shadow-camera-top={MARINE_SHADOW_BOUNDS_METERS}
        shadow-camera-bottom={-MARINE_SHADOW_BOUNDS_METERS}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
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
/** 当前环境预设的海面颜色组与同源太阳方向（#2099：水面着色器共用预设太阳）。 */
export function useEnvironmentWaterColors() {
  const { preset } = useSceneEnvironment();
  return {
    ...preset.water,
    sunDirection: worldSunDirection(preset),
  };
}

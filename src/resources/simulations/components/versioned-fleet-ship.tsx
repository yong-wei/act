'use client';

/**
 * 船队版本化模型共享挂载：质量档位 LOD、DWL 锚定、坐标基一次适配、语义绑定。
 * 旧单文件候选失败时沿用 bbox 居中与各船既有 yaw 补偿，保持可逆回退。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import {
  resolveRegisteredSimulationModel,
  resolveVersionedDefault,
  type SimulationModelId,
} from '@/lib/browser-delivery/client';
import { FallbackGltfModel } from './fallback-gltf-model';
import { HeroModelBasis } from './hero-model-basis';
import { VersionedShipModel } from './versioned-ship-model';
import { SemanticBindingsRig, type BindingTelemetrySource } from './semantic-bindings-rig';
import { cloneSkinnedScene } from '../model-packages/clone-skinned-scene';
import { matchActivatedFleetPackage } from '../model-packages/fleet-packages';
import { isDescriptorArtifactUrl, type VersionedModelPackageDescriptor } from '../model-packages/types';
import { useSceneQuality } from '../scene/quality';

export function VersionedFleetShip({
  logicalId,
  simRef,
  position,
  headingRad,
  extraEuler,
  waterY = 0,
  waterYSampler,
  sceneLengthMeters,
  resetToken = 0,
  legacyYawOffsetRad,
  fallbackDraftMeters,
  verticalOffsetMeters = 0,
  legacyOverlay,
  onMountedUrl,
}: {
  logicalId: SimulationModelId;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  position: { x: number; z: number };
  headingRad: number;
  extraEuler?: { x?: number; z?: number };
  waterY?: number;
  /** 逐帧水线采样（#2117）：提供时覆盖固定 waterY（共享波面参考，替代隐含 0）。 */
  waterYSampler?: () => number;
  sceneLengthMeters: number;
  resetToken?: number;
  legacyYawOffsetRad: number;
  fallbackDraftMeters: number;
  verticalOffsetMeters?: number;
  legacyOverlay?: (scale: number) => React.ReactNode;
  onMountedUrl?: (url: string) => void;
}) {
  const { tier } = useSceneQuality();
  const activated = matchActivatedFleetPackage(logicalId, resolveVersionedDefault(logicalId));
  const MODEL = resolveRegisteredSimulationModel(logicalId);

  if (!activated) {
    return (
      <FallbackGltfModel
        candidates={MODEL.candidates}
        render={(url) => (
          <FleetModelScene
            url={url}
            descriptor={null}
            simRef={simRef}
            position={position}
            headingRad={headingRad}
            extraEuler={extraEuler}
            waterY={waterY}
            waterYSampler={waterYSampler}
            sceneLengthMeters={sceneLengthMeters}
            resetToken={resetToken}
            basisYawRad={0}
            outerYawOffsetRad={legacyYawOffsetRad}
            bboxCenter
            fallbackDraftMeters={fallbackDraftMeters}
            verticalOffsetMeters={0}
            legacyOverlay={legacyOverlay}
            onMountedUrl={onMountedUrl}
          />
        )}
      />
    );
  }

  return (
    <VersionedShipModel
      descriptor={activated}
      tier={tier}
      legacyCandidates={MODEL.candidates}
      renderScene={(url) => {
        const versioned = isDescriptorArtifactUrl(activated, url);
        const useMatrix = Boolean(versioned && activated.modelToSceneMatrix);
        return (
          <FleetModelScene
            url={url}
            descriptor={versioned ? activated : null}
            simRef={simRef}
            position={position}
            headingRad={headingRad}
            extraEuler={extraEuler}
            waterY={waterY}
            waterYSampler={waterYSampler}
            sceneLengthMeters={sceneLengthMeters}
            resetToken={resetToken}
            basisYawRad={versioned && !useMatrix ? activated.basisYawRad : 0}
            modelToSceneMatrix={useMatrix ? activated.modelToSceneMatrix : undefined}
            outerYawOffsetRad={versioned ? Math.PI / 2 : legacyYawOffsetRad}
            bboxCenter={!versioned}
            fallbackDraftMeters={fallbackDraftMeters}
            verticalOffsetMeters={versioned && !useMatrix ? verticalOffsetMeters : 0}
            legacyOverlay={versioned ? undefined : legacyOverlay}
            onMountedUrl={onMountedUrl}
          />
        );
      }}
    />
  );
}

function FleetModelScene({
  url,
  descriptor,
  simRef,
  position,
  headingRad,
  extraEuler,
  waterY,
  waterYSampler,
  sceneLengthMeters,
  resetToken,
  basisYawRad,
  modelToSceneMatrix,
  outerYawOffsetRad,
  bboxCenter,
  fallbackDraftMeters,
  verticalOffsetMeters,
  legacyOverlay,
  onMountedUrl,
}: {
  url: string;
  descriptor: VersionedModelPackageDescriptor | null;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  position: { x: number; z: number };
  headingRad: number;
  extraEuler?: { x?: number; z?: number };
  waterY: number;
  waterYSampler?: () => number;
  sceneLengthMeters: number;
  resetToken: number;
  basisYawRad: number;
  modelToSceneMatrix?: VersionedModelPackageDescriptor['modelToSceneMatrix'];
  outerYawOffsetRad: number;
  bboxCenter: boolean;
  fallbackDraftMeters: number;
  verticalOffsetMeters: number;
  legacyOverlay?: (scale: number) => React.ReactNode;
  onMountedUrl?: (url: string) => void;
}) {
  const { scene, animations } = useGLTF(url, true, true);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    onMountedUrl?.(url);
  }, [url, onMountedUrl]);

  const { model, scale, waterlineOffset } = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    if (bboxCenter) cloned.position.sub(center);

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const calculatedScale = bboxCenter
      ? sceneLengthMeters / maxDim
      : sceneLengthMeters / (descriptor?.modelLengthMeters ?? sceneLengthMeters);
    const offset = bboxCenter
      ? (size.y * calculatedScale) * 0.5 - fallbackDraftMeters
      : modelToSceneMatrix
        ? 0
        : -(descriptor?.verticalAnchor?.designWaterlineY ?? 0) * calculatedScale + verticalOffsetMeters;

    return { model: cloned, scale: calculatedScale, waterlineOffset: offset };
  }, [scene, descriptor, bboxCenter, modelToSceneMatrix, sceneLengthMeters, fallbackDraftMeters, verticalOffsetMeters]);

  useFrame(() => {
    if (!groupRef.current) return;
    // 水线参考（#2117）：采样器优先（共享波面），缺省回退显式 waterY——
    // 不再隐含 waterY=0；数值横摇（extraEuler）不受影响。
    const resolvedWaterY = waterYSampler ? waterYSampler() : waterY;
    groupRef.current.position.set(position.x, resolvedWaterY + waterlineOffset, position.z);
    groupRef.current.rotation.set(
      extraEuler?.x ?? 0,
      -headingRad + outerYawOffsetRad,
      extraEuler?.z ?? 0,
    );
  });

  return (
    <group ref={groupRef} name="fleet-ship-root">
      <group rotation-y={basisYawRad}>
        <HeroModelBasis matrix={modelToSceneMatrix}>
          <primitive object={model} scale={scale} />
          {descriptor ? (
            <SemanticBindingsRig
              key={resetToken}
              model={model}
              animations={animations}
              descriptor={descriptor}
              simRef={simRef}
              modelScale={scale}
            />
          ) : null}
          {legacyOverlay ? legacyOverlay(scale) : null}
        </HeroModelBasis>
      </group>
    </group>
  );
}

'use client';

/**
 * xue-long-2 v0.1.0 候选模型包 QA 验收页（type055-model-candidate 同构先例）。
 *
 * 不进入任何导航；仅供 Playwright/人工验收候选模型（spec:
 * versioned-simulation-model-package-integration 的激活视觉验收面）：
 * - 装配 ship LOD（?lod=0|1|2，默认 0）并按声明驱动语义动画绑定；
 * - 通过 window.__xuelong2Qa 暴露遥测注入与节点采样，供浏览器断言
 *   （整舰取景、桨随航速、吊舱随方位、结束展示随机组合）。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { XUE_LONG_2_V0, XUE_LONG_2_BASIS_YAW_RAD } from '@/resources/simulations/model-packages/xue-long-2-v0';
import { VersionedShipModel } from '@/resources/simulations/components/versioned-ship-model';
import { SemanticBindingsRig, type BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { cloneSkinnedScene, skinnedBindingsIntact } from '@/resources/simulations/model-packages/clone-skinned-scene';
import {
  boxProjectsInsideNdc,
  framePerspectiveCameraToBox,
} from '@/resources/simulations/scene/camera';
import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';

type QaApi = {
  ready: boolean;
  shipUrl: string | null;
  boxInView: boolean;
  skinnedIntact: boolean;
  showcaseClips: readonly string[];
  /** 左右桨/吊舱节点局部四元数（绑定断言：桨随航速转、吊舱随方位偏转）。 */
  propPortQuat: [number, number, number, number] | null;
  propStarboardQuat: [number, number, number, number] | null;
  podPortQuat: [number, number, number, number] | null;
  podStarboardQuat: [number, number, number, number] | null;
  /** 遥测注入：驱动桨转速（speedMps×advancing）与吊舱方位（azimuths）。 */
  setTelemetry: (input: { speedMps?: number; advancing?: boolean; azimuthDeg?: [number, number] }) => void;
};

declare global {
  interface Window { __xuelong2Qa?: QaApi }
}

const LOD_TIERS = ['high', 'medium', 'low'] as const;

function lodTierFromSearch(): (typeof LOD_TIERS)[number] {
  if (typeof window === 'undefined') return 'high';
  const value = Number(new URLSearchParams(window.location.search).get('lod'));
  return LOD_TIERS[value] ?? 'high';
}

function QaFramingCamera({ targetRef }: { targetRef: React.RefObject<THREE.Object3D | null> }) {
  const framedRef = useRef(false);
  const { camera, size } = useThree();

  useFrame(() => {
    const object = targetRef.current;
    if (!object || framedRef.current) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const aspect = Math.min(Math.max(size.width / Math.max(size.height, 1), 1), 2.2);
    const framing = framePerspectiveCameraToBox(box, 45, aspect, 1.12);
    camera.position.copy(framing.position);
    camera.lookAt(framing.target);
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
    if (boxProjectsInsideNdc(camera, box)) framedRef.current = true;
  });

  return <PerspectiveCamera makeDefault fov={45} near={1} far={8000} />;
}

/** 候选装配：声明式水线锚定 + 语义绑定 + QA 遥测注入。 */
function QaShip({
  url,
  simRef,
  onVersionedMount,
  frameTargetRef,
}: {
  url: string;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  onVersionedMount: (mounted: boolean) => void;
  frameTargetRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const { camera } = useThree();
  const { scene, animations } = useGLTF(url, true, true);
  const groupRef = useRef<THREE.Group>(null);

  const { model, scale, waterlineOffset, podNodes, propNodes } = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    cloned.position.sub(center);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) child.frustumCulled = false;
    });
    const calculatedScale = XUE_LONG_2_V0.modelLengthMeters
      ? 122.5 / XUE_LONG_2_V0.modelLengthMeters
      : 1;
    const offset = XUE_LONG_2_V0.verticalAnchor
      ? (center.y - XUE_LONG_2_V0.verticalAnchor.designWaterlineY) * calculatedScale
      : 0;
    return {
      model: cloned,
      scale: calculatedScale,
      waterlineOffset: offset,
      podNodes: {
        port: cloned.getObjectByName('XL2_POD_P') ?? null,
        starboard: cloned.getObjectByName('XL2_POD_S') ?? null,
      },
      propNodes: {
        port: cloned.getObjectByName('XL2_PROP_P') ?? null,
        starboard: cloned.getObjectByName('XL2_PROP_S') ?? null,
      },
    };
  }, [scene]);

  const versioned = url.startsWith(XUE_LONG_2_V0.baseUrl);
  useEffect(() => {
    onVersionedMount(versioned);
    return () => onVersionedMount(false);
  }, [versioned, onVersionedMount]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.y = waterlineOffset;
    const api = window.__xuelong2Qa;
    if (!api) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const quatOf = (node: THREE.Object3D | null): [number, number, number, number] | null => node
      ? [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w]
      : null;
    api.ready = true;
    api.shipUrl = url;
    api.boxInView = boxProjectsInsideNdc(camera, box);
    api.skinnedIntact = skinnedBindingsIntact(model);
    api.showcaseClips = (model.userData.showcaseActiveClips as string[] | undefined) ?? [];
    api.propPortQuat = quatOf(propNodes.port);
    api.propStarboardQuat = quatOf(propNodes.starboard);
    api.podPortQuat = quatOf(podNodes.port);
    api.podStarboardQuat = quatOf(podNodes.starboard);
  });

  return (
    <group ref={(node) => {
      groupRef.current = node;
      frameTargetRef.current = node;
    }}>
      <group rotation-y={XUE_LONG_2_BASIS_YAW_RAD}>
        <primitive object={model} scale={scale} />
        {versioned ? (
          <SemanticBindingsRig
            model={model}
            animations={animations}
            descriptor={XUE_LONG_2_V0}
            simRef={simRef}
            modelScale={scale}
          />
        ) : null}
      </group>
    </group>
  );
}

function QaBridge() {
  const legacyCandidates = useMemo(() => resolveRegisteredSimulationModel('icebreaker').candidates, []);
  const tier = useMemo(() => lodTierFromSearch(), []);
  const simRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: 0,
    attainedCount: 0,
    advancing: false,
    podAzimuthDeg: [0, 0],
  });
  const [versionedMounted, setVersionedMounted] = useState(false);
  const handleVersionedMount = (mounted: boolean) => setVersionedMounted(mounted);
  const frameTargetRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    window.__xuelong2Qa = {
      ready: false,
      shipUrl: null,
      boxInView: false,
      skinnedIntact: false,
      showcaseClips: [],
      propPortQuat: null,
      propStarboardQuat: null,
      podPortQuat: null,
      podStarboardQuat: null,
      setTelemetry: ({ speedMps, advancing, azimuthDeg }) => {
        const current = simRef.current;
        simRef.current = {
          ...current,
          speedMps: speedMps ?? current.speedMps,
          advancing: advancing ?? current.advancing,
          podAzimuthDeg: azimuthDeg ?? current.podAzimuthDeg,
        };
      },
    };
  }, []);

  return (
    <div data-qa-xue-long-2-candidate data-versioned-mounted={String(versionedMounted)} style={{ width: '100vw', height: '100vh' }}>
      <Canvas>
        <ambientLight intensity={1.2} />
        <directionalLight position={[120, 160, 80]} intensity={2} />
        <QaFramingCamera targetRef={frameTargetRef} />
        <Suspense fallback={null}>
          <VersionedShipModel
            descriptor={XUE_LONG_2_V0}
            tier={tier}
            legacyCandidates={legacyCandidates}
            renderScene={(url) => (
              <QaShip key={url} url={url} simRef={simRef} onVersionedMount={handleVersionedMount} frameTargetRef={frameTargetRef} />
            )}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function XueLong2CandidateQaPage() {
  return <QaBridge />;
}

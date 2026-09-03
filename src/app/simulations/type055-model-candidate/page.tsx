'use client';

/**
 * type055-nanchang-101 v2.0.0 候选模型包 QA 验收页（issue #1898 任务 3.3/3.4/5.2）。
 *
 * 不进入任何导航；仅供 Playwright/人工验收候选模型：
 * - 装配 ship LOD（?lod=0|1|2，默认 0）并按语义名播放代表性动画；
 * - weapon demo / payload 仅在显式激活后按需加载（普通首屏不请求）;
 * - 通过 window.__type055Qa 暴露节点采样与生命周期计数，供浏览器断言。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import {
  TYPE055_NANCHANG_101_V2,
  TYPE055_V2_BASIS_YAW_RAD,
} from '@/resources/simulations/model-packages/type055-nanchang-101-v2';
import { VersionedShipModel } from '@/resources/simulations/components/versioned-ship-model';
import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';

type QaApi = {
  ready: boolean;
  shipUrl: string | null;
  playAnimation: (name: string) => string;
  sampleNode: (name: string) => { position: number[]; rotation: number[] } | null;
  decalMaterials: () => { name: string; transparent: boolean; alphaTest: number }[];
  demo: { loaded: boolean; load: () => void; play: (name: string) => string };
  payload: {
    loaded: boolean;
    load: () => void;
    templates: () => string[];
    spawn: (template: string) => string;
    spawned: () => string[];
    destroyAll: () => number;
  };
};

declare global {
  interface Window { __type055Qa?: QaApi }
}

const LOD_ROLES = ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const;

function lodFromSearch(): 0 | 1 | 2 {
  if (typeof window === 'undefined') return 0;
  const value = Number(new URLSearchParams(window.location.search).get('lod'));
  return value === 1 || value === 2 ? value : 0;
}

/** 主舰装配：语义动画播放器 + 节点采样 + 贴花材质检查。 */
function QaShip({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url, true, true);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const mounted = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) child.frustumCulled = false;
    });
    return cloned;
  }, [scene]);

  const mixer = useMemo(() => new THREE.AnimationMixer(mounted), [mounted]);
  mixerRef.current = mixer;

  useFrame((_, delta) => mixer.update(delta));

  useEffect(() => {
    const api = window.__type055Qa;
    if (!api) return;
    api.ready = true;
    api.shipUrl = url;
    api.playAnimation = (name: string) => {
      const clip = animations.find((item) => item.name === name);
      if (!clip) return `clip-not-found:${name}`;
      actionRef.current?.stop();
      actionRef.current = mixer.clipAction(clip);
      actionRef.current.reset().play();
      return `playing:${name}`;
    };
    api.sampleNode = (name: string) => {
      let node: THREE.Object3D | null = null;
      mounted.traverse((child) => {
        if (node || child.name !== name) return;
        node = child;
      });
      if (!node) return null;
      const target = node as THREE.Object3D;
      target.updateWorldMatrix(true, false);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      target.getWorldPosition(position);
      target.getWorldQuaternion(quaternion);
      const euler = new THREE.Euler().setFromQuaternion(quaternion);
      return { position: position.toArray(), rotation: [euler.x, euler.y, euler.z] };
    };
    api.decalMaterials = () => {
      const decals = TYPE055_NANCHANG_101_V2.interfaceContract.decalImages;
      const found: { name: string; transparent: boolean; alphaTest: number }[] = [];
      mounted.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          const texture = material?.map ?? null;
          const name = texture?.name ?? '';
          if (decals.includes(name)) {
            found.push({ name, transparent: material.transparent === true, alphaTest: material.alphaTest ?? 0 });
          }
        }
      });
      return found;
    };
    return () => { api.ready = false; };
  }, [animations, mixer, mounted, url]);

  return (
    <group rotation-y={TYPE055_V2_BASIS_YAW_RAD}>
      <primitive object={mounted} />
    </group>
  );
}

/** 武器演示：仅显式激活后才挂载（延迟加载证据由网络请求记录）。 */
function QaDemo() {
  const { scene, animations } = useGLTF(TYPE055_NANCHANG_101_V2.roles.demo.url, true, true);
  const mounted = useMemo(() => scene.clone(true), [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(mounted), [mounted]);
  useFrame((_, delta) => mixer.update(delta));

  useEffect(() => {
    const api = window.__type055Qa;
    if (!api) return;
    api.demo.loaded = true;
    api.demo.play = (name: string) => {
      const clip = animations.find((item) => item.name === name);
      if (!clip) return `clip-not-found:${name}`;
      mixer.stopAllAction();
      mixer.clipAction(clip).reset().play();
      return `playing:${name}`;
    };
    return () => { api.demo.loaded = false; };
  }, [animations, mixer]);

  return <primitive object={mounted} />;
}

/** 武器载荷：按需加载 + 弹药模板运行时克隆生成与寿命销毁（与主舰生命周期分离）。 */
function QaPayload() {
  const { scene } = useGLTF(TYPE055_NANCHANG_101_V2.roles.payload.url, true, true);
  // ref 为生成实例的即时真源；renderTick 只触发重渲染，保证 QA API 同步可断言
  const spawnedRef = useRef<THREE.Object3D[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  const source = useMemo(() => {
    const cloned = scene.clone(true);
    // 模板源只作克隆参考，不直接渲染常驻节点
    cloned.visible = false;
    return cloned;
  }, [scene]);

  useEffect(() => {
    const api = window.__type055Qa;
    if (!api) return;
    api.payload.loaded = true;
    api.payload.templates = () => {
      const names: string[] = [];
      source.traverse((child) => {
        if (/^MUNITION_.*_TEMPLATE$/.test(child.name)) names.push(child.name);
      });
      return names;
    };
    api.payload.spawn = (template: string) => {
      let origin: THREE.Object3D | null = null;
      source.traverse((child) => { if (child.name === template) origin = child; });
      if (!origin) return `template-not-found:${template}`;
      const instance = (origin as THREE.Object3D).clone(true);
      instance.visible = true;
      instance.position.set(Math.random() * 10 - 5, 6, Math.random() * 10 - 5);
      spawnedRef.current = [...spawnedRef.current, instance];
      setRenderTick((tick) => tick + 1);
      return `spawned:${instance.uuid}`;
    };
    api.payload.spawned = () => spawnedRef.current.map((item) => item.uuid);
    api.payload.destroyAll = () => {
      const count = spawnedRef.current.length;
      spawnedRef.current = [];
      setRenderTick((tick) => tick + 1);
      return count;
    };
    return () => { api.payload.loaded = false; };
  }, [source]);

  return (
    <>
      <primitive object={source} />
      {spawnedRef.current.map((instance) => <primitive key={instance.uuid} object={instance} />)}
    </>
  );
}

function QaBridge() {
  const [demoActive, setDemoActive] = useState(false);
  const [payloadActive, setPayloadActive] = useState(false);
  const legacyCandidates = useMemo(() => resolveRegisteredSimulationModel('destroyer').candidates, []);
  const lodIndex = useMemo(() => lodFromSearch(), []);

  useEffect(() => {
    window.__type055Qa = {
      ready: false,
      shipUrl: null,
      playAnimation: () => 'not-ready',
      sampleNode: () => null,
      decalMaterials: () => [],
      demo: {
        loaded: false,
        load: () => setDemoActive(true),
        play: () => 'demo-not-loaded',
      },
      payload: {
        loaded: false,
        load: () => setPayloadActive(true),
        templates: () => [],
        spawn: () => 'payload-not-loaded',
        spawned: () => [],
        destroyAll: () => 0,
      },
    };
  }, []);

  return (
    <div data-qa-type055-candidate>
      <Canvas>
        <ambientLight intensity={1.2} />
        <directionalLight position={[120, 160, 80]} intensity={2} />
        <Suspense fallback={null}>
          <VersionedShipModel
            descriptor={TYPE055_NANCHANG_101_V2}
            tier={lodIndex === 0 ? 'high' : lodIndex === 1 ? 'medium' : 'low'}
            legacyCandidates={legacyCandidates}
            renderScene={(url) => <QaShip url={url} />}
          />
        </Suspense>
        {demoActive ? (
          <Suspense fallback={null}>
            <QaDemo />
          </Suspense>
        ) : null}
        {payloadActive ? (
          <Suspense fallback={null}>
            <QaPayload />
          </Suspense>
        ) : null}
      </Canvas>
    </div>
  );
}

export default function Type055ModelCandidateQaPage() {
  return <QaBridge />;
}

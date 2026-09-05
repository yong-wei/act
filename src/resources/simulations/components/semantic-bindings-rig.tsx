'use client';

/**
 * 声明式语义动画绑定装配（spec: simulation-scene-visual-pipeline / versioned-simulation-model-package-integration）。
 *
 * - L0 常开：clip-loop（螺旋桨/国旗/雷达）与程序化（舵角/天线倾角）绑定，只读遥测；
 * - L1：达标后启动主舰内武器巡检循环（零额外加载）；
 * - L2：每次达标随机播放一条 weapon-demo clip（demo GLB 此时才按需加载）。
 * 单条绑定解析失败 fail closed（告警并跳过），不影响模型与其余绑定。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { cloneSkinnedScene } from '../model-packages/clone-skinned-scene';
import type { VersionedModelPackageDescriptor } from '../model-packages/type055-nanchang-101-v2';

/** 绑定消费的最小遥测视图（结构类型，由仿真状态满足）。 */
export interface BindingTelemetrySource {
  readonly rudderDeg: number;
  readonly speedMps: number;
  readonly attainedCount: number;
}

const DEFAULT_TELEMETRY_SCALE = { designSpeedMps: 15, rudderLimitDeg: 35 };

export function SemanticBindingsRig({
  model,
  animations,
  descriptor,
  simRef,
  modelScale,
}: {
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
  descriptor: VersionedModelPackageDescriptor;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  modelScale: number;
}) {
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const speedCoupledRef = useRef<{ action: THREE.AnimationAction; rate: number }[]>([]);
  const patrolStartedRef = useRef(false);
  const lastAttainedRef = useRef(0);
  const [demoRequest, setDemoRequest] = useState<{ clip: string; key: number } | null>(null);

  // L0 clip-loop 绑定：立即播放；speedCoupled 的 timeScale 每帧随航速更新。
  useMemo(() => {
    speedCoupledRef.current = [];
    for (const binding of descriptor.semanticBindings ?? []) {
      if (binding.drive !== 'clip-loop') continue;
      const clip = animations.find((candidate) => candidate.name === binding.clip);
      if (!clip) {
        console.warn(`[semantic-bindings] clip missing, binding skipped: ${binding.id} (${binding.clip})`);
        continue;
      }
      const action = mixer.clipAction(clip);
      action.play();
      if (binding.speedCoupled) speedCoupledRef.current.push({ action, rate: binding.rate ?? 1 });
    }
  }, [mixer, animations, descriptor]);

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  // L0 程序化绑定：按语义名解析节点；任一节点缺失则该绑定整体 fail closed。
  const procedural = useMemo(() => (descriptor.semanticBindings ?? [])
    .filter((binding) => binding.drive === 'procedural')
    .map((binding) => {
      const nodes = binding.nodes.map((name) => model.getObjectByName(name));
      if (nodes.some((node) => !node)) {
        console.warn(`[semantic-bindings] node missing, binding skipped: ${binding.id}`);
        return null;
      }
      return { binding, nodes: nodes as THREE.Object3D[] };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null), [model, descriptor]);

  useFrame((_, delta) => {
    const sim = simRef.current;
    const scale = descriptor.telemetryScale ?? DEFAULT_TELEMETRY_SCALE;

    for (const { action, rate } of speedCoupledRef.current) {
      action.timeScale = rate * THREE.MathUtils.clamp(sim.speedMps / scale.designSpeedMps, 0, 1.2);
    }
    for (const { binding, nodes } of procedural) {
      const angleDeg = binding.source === 'telemetry.rudderDeg'
        ? (THREE.MathUtils.clamp(sim.rudderDeg, -scale.rudderLimitDeg, scale.rudderLimitDeg)
            / scale.rudderLimitDeg) * binding.maxAngleDeg
        : THREE.MathUtils.clamp(sim.speedMps / scale.designSpeedMps, 0, 1) * binding.maxAngleDeg;
      const angleRad = THREE.MathUtils.degToRad(angleDeg * (binding.sign ?? 1));
      for (const node of nodes) node.rotation[binding.axis] = angleRad;
    }

    // L1：首次达标后启动武器巡检循环（主舰 clip，零额外加载）。
    if (!patrolStartedRef.current && sim.attainedCount > 0 && descriptor.easterEgg) {
      patrolStartedRef.current = true;
      for (const patrol of descriptor.easterEgg.patrolClips) {
        const clip = animations.find((candidate) => candidate.name === patrol.clip);
        if (!clip) {
          console.warn(`[semantic-bindings] patrol clip missing, skipped: ${patrol.clip}`);
          continue;
        }
        const action = mixer.clipAction(clip);
        action.setLoop(patrol.loop === 'pingpong' ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity);
        action.play();
      }
    }

    // L2：每次达标随机选一条演示 clip，demo GLB 按需加载。
    if (sim.attainedCount > lastAttainedRef.current) {
      lastAttainedRef.current = sim.attainedCount;
      const demos = descriptor.interfaceContract.demoAnimations;
      if (demos.length > 0) {
        setDemoRequest({
          clip: demos[Math.floor(Math.random() * demos.length)],
          key: sim.attainedCount,
        });
      }
    }

    mixer.update(delta);
  });

  if (!demoRequest) return null;
  return (
    <Suspense fallback={null}>
      <WeaponDemoAction
        key={demoRequest.key}
        url={descriptor.roles.demo.url}
        clipName={demoRequest.clip}
        modelOffset={model.position}
        modelScale={modelScale}
        onDone={() => setDemoRequest(null)}
      />
    </Suspense>
  );
}

/** L2 演示层：播放一条 clip 后保持末帧短暂停留再卸载。 */
function WeaponDemoAction({
  url,
  clipName,
  modelOffset,
  modelScale,
  onDone,
}: {
  url: string;
  clipName: string;
  modelOffset: THREE.Vector3;
  modelScale: number;
  onDone: () => void;
}) {
  const { scene, animations } = useGLTF(url, true, true);

  const demoModel = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    cloned.position.copy(modelOffset);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) child.frustumCulled = false;
    });
    return cloned;
  }, [scene, modelOffset]);

  const mixer = useMemo(() => new THREE.AnimationMixer(demoModel), [demoModel]);

  useEffect(() => {
    const clip = animations.find((candidate) => candidate.name === clipName);
    if (!clip) {
      console.warn(`[semantic-bindings] demo clip missing: ${clipName}`);
      onDone();
      return;
    }
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    let holdTimer = 0;
    const onFinished = () => {
      holdTimer = window.setTimeout(onDone, 1200);
    };
    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
      window.clearTimeout(holdTimer);
      mixer.stopAllAction();
    };
  }, [mixer, animations, clipName, onDone]);

  useFrame((_, delta) => mixer.update(delta));

  return <primitive object={demoModel} scale={modelScale} />;
}

'use client';

/**
 * 声明式语义动画绑定装配（spec: simulation-scene-visual-pipeline / versioned-simulation-model-package-integration）。
 *
 * - L0 常开：clip-loop、程序化舵角、吊舱/推进器实时方位与转速；
 * - L1：达标后启动主舰内巡检循环（零额外加载）；
 * - L2：有独立 demo 角色时按需加载一条演示 clip；否则在主舰 mixer 上随机播放 1..n 条 attainmentClips。
 * 单条绑定解析失败 fail closed（告警并跳过），不影响模型与其余绑定。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { pickRandomSubset } from '../lib/heading-attainment';
import { cloneSkinnedScene } from '../model-packages/clone-skinned-scene';
import type {
  LiveRotationBinding,
  LiveSpinBinding,
  VersionedModelPackageDescriptor,
} from '../model-packages/types';

/** 绑定消费的最小遥测视图（结构类型，由仿真状态满足）。 */
export interface BindingTelemetrySource {
  readonly rudderDeg: number;
  readonly speedMps: number;
  readonly attainedCount: number;
  /**
   * 仿真时钟是否在推进：false 时速度类绑定（桨转速/天线倾角）的有效航速取 0。
   * 舵角、吊舱方位等位置类绑定保持最后值。缺省视为推进中。
   */
  readonly advancing?: boolean;
  readonly azipod?: {
    readonly P?: { readonly azimuthRad: number; readonly rpm: number };
    readonly S?: { readonly azimuthRad: number; readonly rpm: number };
  };
  readonly thrusters?: ReadonlyArray<{
    readonly id: number;
    readonly azimuthRad: number;
    readonly rpm: number;
  }>;
  /** 绞吸挖泥船绞刀转速；缺省不驱动绞刀节点。 */
  readonly cutterRpm?: number;
}

/** 有效航速：仿真不推进（暂停/未就绪/播完）时归零，速度类视觉绑定随之静止。 */
export function effectiveBindingSpeedMps(sim: BindingTelemetrySource): number {
  return sim.advancing === false ? 0 : sim.speedMps;
}

const DEFAULT_TELEMETRY_SCALE = { designSpeedMps: 15, rudderLimitDeg: 35 };

function resolveNodes(model: THREE.Object3D, names: readonly string[]): THREE.Object3D[] {
  const nodes: THREE.Object3D[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const node = model.getObjectByName(name);
    if (!node || seen.has(node.uuid)) continue;
    seen.add(node.uuid);
    nodes.push(node);
  }
  return nodes;
}

function readAzimuthRad(sim: BindingTelemetrySource, binding: LiveRotationBinding): number | null {
  if (binding.azipodSlot) {
    const value = sim.azipod?.[binding.azipodSlot]?.azimuthRad;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (binding.thrusterId !== undefined) {
    const value = sim.thrusters?.find((item) => item.id === binding.thrusterId)?.azimuthRad;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return null;
}

function readRpm(sim: BindingTelemetrySource, binding: LiveSpinBinding): number | null {
  if (binding.cutter) {
    const value = sim.cutterRpm;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  if (binding.azipodSlot) {
    const value = sim.azipod?.[binding.azipodSlot]?.rpm;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (binding.thrusterId !== undefined) {
    const value = sim.thrusters?.find((item) => item.id === binding.thrusterId)?.rpm;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return null;
}

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

  useEffect(() => {
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
    return () => { mixer.stopAllAction(); };
  }, [mixer, animations, descriptor]);

  const procedural = useMemo(() => (descriptor.semanticBindings ?? [])
    .filter((binding) => binding.drive === 'procedural')
    .map((binding) => {
      const nodes = resolveNodes(model, binding.nodes);
      if (nodes.length === 0) {
        console.warn(`[semantic-bindings] node missing, binding skipped: ${binding.id}`);
        return null;
      }
      return { binding, nodes };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null), [model, descriptor]);

  const liveRotation = useMemo(() => (descriptor.semanticBindings ?? [])
    .filter((binding) => binding.drive === 'live-rotation')
    .map((binding) => {
      const nodes = resolveNodes(model, binding.nodes);
      if (nodes.length === 0) {
        console.warn(`[semantic-bindings] node missing, binding skipped: ${binding.id}`);
        return null;
      }
      return { binding, nodes };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null), [model, descriptor]);

  const liveSpin = useMemo(() => (descriptor.semanticBindings ?? [])
    .filter((binding) => binding.drive === 'live-spin')
    .map((binding) => {
      const nodes = resolveNodes(model, binding.nodes);
      if (nodes.length === 0) {
        console.warn(`[semantic-bindings] node missing, binding skipped: ${binding.id}`);
        return null;
      }
      return { binding, nodes };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null), [model, descriptor]);

  useFrame((_, delta) => {
    const sim = simRef.current;
    const scale = descriptor.telemetryScale ?? DEFAULT_TELEMETRY_SCALE;
    const effectiveSpeedMps = effectiveBindingSpeedMps(sim);

    for (const { action, rate } of speedCoupledRef.current) {
      action.timeScale = rate * THREE.MathUtils.clamp(effectiveSpeedMps / scale.designSpeedMps, 0, 1.2);
    }
    for (const { binding, nodes } of procedural) {
      const angleDeg = binding.source === 'telemetry.rudderDeg'
        ? (THREE.MathUtils.clamp(sim.rudderDeg, -scale.rudderLimitDeg, scale.rudderLimitDeg)
            / scale.rudderLimitDeg) * binding.maxAngleDeg
        : THREE.MathUtils.clamp(effectiveSpeedMps / scale.designSpeedMps, 0, 1) * binding.maxAngleDeg;
      const angleRad = THREE.MathUtils.degToRad(angleDeg * (binding.sign ?? 1));
      for (const node of nodes) node.rotation[binding.axis] = angleRad;
    }
    for (const { binding, nodes } of liveRotation) {
      const azimuthRad = readAzimuthRad(sim, binding);
      if (azimuthRad === null) continue;
      const value = azimuthRad * (binding.sign ?? 1);
      for (const node of nodes) node.rotation[binding.axis] = value;
    }
    const spinDeltaScale = sim.advancing === false ? 0 : 1;
    for (const { binding, nodes } of liveSpin) {
      let rpm = readRpm(sim, binding);
      if (rpm === null && binding.rpmFromSpeed) {
        rpm = (binding.designRpm ?? 90)
          * THREE.MathUtils.clamp(effectiveSpeedMps / scale.designSpeedMps, 0, 1.2);
      }
      if (rpm === null) continue;
      const deltaRad = rpm * (Math.PI * 2 / 60) * delta * (binding.sign ?? 1) * spinDeltaScale;
      for (const node of nodes) node.rotation[binding.axis] += deltaRad;
    }

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

    if (sim.attainedCount > lastAttainedRef.current) {
      lastAttainedRef.current = sim.attainedCount;
      const demos = descriptor.interfaceContract.demoAnimations;
      if (descriptor.roles?.demo && demos.length > 0) {
        setDemoRequest({
          clip: demos[Math.floor(Math.random() * demos.length)],
          key: sim.attainedCount,
        });
      } else {
        const selected = pickRandomSubset(descriptor.easterEgg?.attainmentClips ?? []);
        for (const clipName of selected) {
          const clip = animations.find((candidate) => candidate.name === clipName);
          if (!clip) {
            console.warn(`[semantic-bindings] attainment clip missing, skipped: ${clipName}`);
            continue;
          }
          const action = mixer.clipAction(clip);
          action.reset();
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
        }
      }
    }

    mixer.update(delta);
  });

  const demoUrl = descriptor.roles?.demo?.url;
  if (!demoRequest || !demoUrl) return null;
  return (
    <Suspense fallback={null}>
      <WeaponDemoAction
        key={demoRequest.key}
        url={demoUrl}
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

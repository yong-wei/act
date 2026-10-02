'use client';

/**
 * 声明式语义动画绑定装配（spec: simulation-scene-visual-pipeline / versioned-simulation-model-package-integration）。
 *
 * - L0 常开：clip-loop、程序化舵角、吊舱/推进器实时方位与转速；
 * - L1：达标后启动主舰内巡检循环（零额外加载）；
 * - L2：有独立 demo 角色时按需加载一条演示 clip；否则在主舰 mixer 上随机播放 1..n 条 attainmentClips。
 * 单条绑定解析失败 fail closed（告警并跳过），不影响模型与其余绑定。
 */

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { pickRandomSubset } from '../lib/heading-attainment';
import { cloneSkinnedScene } from '../model-packages/clone-skinned-scene';
import { createMarinePropulsors } from '../model-packages/marine-propulsors';
import { captureSemanticAnimationState, restoreSemanticAnimationState } from '../model-packages/semantic-animation-state';
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

function createDemoPlayback() {
  return { elapsed: new Map<string, number>(), snapshot: null as ReturnType<typeof captureSemanticAnimationState> | null,
    holdUntil: 0 };
}
function createSemanticSession(resetToken = 0) {
  return {
    resetToken,
    elapsedRef: { current: new Map<string, number>() },
    animationStateRef: { current: null as ReturnType<typeof captureSemanticAnimationState> | null },
    spinStateRef: { current: new Map<string, number>() },
    patrolStartedRef: { current: false }, lastAttainedRef: { current: 0 },
    demoRequest: null as { clip: string; key: number } | null,
    demoPlayback: createDemoPlayback(),
  };
}
const SemanticSession = createContext<ReturnType<typeof createSemanticSession> | null>(null);

/** 状态归模型包所有；下载错误边界或LOD重建不能重置动画、实时桨相位和演示进度。 */
export function SemanticBindingsStateProvider({ resetToken, children }: { resetToken: number; children: ReactNode }) {
  const session = useMemo(() => createSemanticSession(resetToken), [resetToken]);
  return <SemanticSession.Provider value={session}>{children}</SemanticSession.Provider>;
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

/** 静态代理与正式LOD都能读取同版本推进器；不要求代理提供精细动画。 */
export function MarinePropulsorsRig({ model, animations, descriptor, simRef }: {
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
  descriptor: VersionedModelPackageDescriptor;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
}) {
  const scene = useThree(state => state.scene);
  useEffect(() => {
    const propulsors = createMarinePropulsors(model, animations, descriptor, () => simRef.current);
    scene.userData.marinePropulsors = propulsors;
    return () => { if (scene.userData.marinePropulsors === propulsors) delete scene.userData.marinePropulsors; };
  }, [model, animations, descriptor, simRef, scene]);
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
  const shared = useContext(SemanticSession);
  const session = useMemo(() => shared ?? createSemanticSession(), [shared]);
  const { elapsedRef, animationStateRef, spinStateRef, patrolStartedRef, lastAttainedRef } = session;
  const speedCoupledRef = useRef<{ action: THREE.AnimationAction; rate: number }[]>([]);
  const [demoRequest, setDemoRequestState] = useState(session.demoRequest);
  const setDemoRequest = useCallback((request: typeof session.demoRequest) => {
    if (request?.key !== session.demoRequest?.key) session.demoPlayback = createDemoPlayback();
    session.demoRequest = request; setDemoRequestState(request);
  }, [session]);
  const finishDemo = useCallback(() => setDemoRequest(null), [setDemoRequest]);

  useEffect(() => {
    const elapsed = elapsedRef.current, spinState = spinStateRef.current;
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
    if (animationStateRef.current) restoreSemanticAnimationState(mixer, animations, animationStateRef.current);
    for (const binding of descriptor.semanticBindings ?? []) {
      if (binding.drive !== 'live-spin') continue;
      for (const name of binding.nodes) {
        const angle = spinStateRef.current.get(name + ':' + binding.axis), node = model.getObjectByName(name);
        if (node && angle !== undefined) node.rotation[binding.axis] = angle;
      }
    }
    return () => {
      animationStateRef.current = captureSemanticAnimationState(mixer, animations, elapsed);
      for (const binding of descriptor.semanticBindings ?? []) {
        if (binding.drive !== 'live-spin') continue;
        for (const name of binding.nodes) {
          const node = model.getObjectByName(name);
          if (node) spinState.set(name + ':' + binding.axis, node.rotation[binding.axis]);
        }
      }
      mixer.stopAllAction();
    };
  }, [mixer, model, animations, descriptor, elapsedRef, animationStateRef, spinStateRef]);

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
        elapsedRef.current.set(clip.name, 0);
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
          elapsedRef.current.set(clip.name, 0);
          action.reset();
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
        }
      }
    }

    for (const clip of animations) {
      const action = mixer.existingAction(clip);
      if (action?.isRunning()) elapsedRef.current.set(clip.name, (elapsedRef.current.get(clip.name) ?? 0) + delta * action.timeScale);
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
        onDone={finishDemo}
        playback={session.demoPlayback}
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
  playback,
}: {
  url: string;
  clipName: string;
  modelOffset: THREE.Vector3;
  modelScale: number;
  onDone: () => void;
  playback: ReturnType<typeof createDemoPlayback>;
}) {
  const { scene, animations } = useGLTF(url, true, true);
  const { x: offsetX, y: offsetY, z: offsetZ } = modelOffset;

  const demoModel = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    cloned.position.set(offsetX, offsetY, offsetZ);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) child.frustumCulled = false;
    });
    return cloned;
  }, [scene, offsetX, offsetY, offsetZ]);

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
    if (playback.snapshot) restoreSemanticAnimationState(mixer, animations, playback.snapshot);
    let holdTimer = 0;
    const onFinished = () => {
      playback.holdUntil = performance.now() + 1200;
      holdTimer = window.setTimeout(onDone, 1200);
    };
    if (playback.holdUntil > 0) holdTimer = window.setTimeout(onDone, Math.max(0, playback.holdUntil - performance.now()));
    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
      window.clearTimeout(holdTimer);
      playback.snapshot = captureSemanticAnimationState(mixer, animations, playback.elapsed);
      mixer.stopAllAction();
    };
  }, [mixer, animations, clipName, onDone, playback]);

  useFrame((_, delta) => {
    const clip = animations.find(clip => clip.name === clipName);
    const action = clip ? mixer.existingAction(clip) : null;
    if (action?.isRunning()) playback.elapsed.set(clipName, (playback.elapsed.get(clipName) ?? 0) + delta * action.timeScale);
    mixer.update(delta);
  });

  return <primitive object={demoModel} scale={modelScale} />;
}

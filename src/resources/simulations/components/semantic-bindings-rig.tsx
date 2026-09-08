'use client';

/**
 * 声明式语义动画绑定装配（spec: simulation-scene-visual-pipeline / versioned-simulation-model-package-integration）。
 *
 * - L0 常开：clip-loop（螺旋桨/国旗/雷达）与程序化（舵角/吊舱方位/天线倾角）绑定，只读遥测；
 * - L1：达标后启动主舰内武器巡检循环（零额外加载）；
 * - L2：每次达标随机播放一条 weapon-demo clip（demo GLB 此时才按需加载）；
 * - 结束展示（endingShowcase）：仿真从推进转停止的边沿，随机组合循环播放
 *   主舰 clip；恢复推进即停止（Azipod 等无达标语义船型的收尾展示通道）。
 * 单条绑定解析失败 fail closed（告警并跳过），不影响模型与其余绑定。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { cloneSkinnedScene } from '../model-packages/clone-skinned-scene';
import type { ProceduralBinding, VersionedModelPackageDescriptor } from '../model-packages/model-interface';

/** 绑定消费的最小遥测视图（结构类型，由仿真状态满足）。 */
export interface BindingTelemetrySource {
  readonly rudderDeg: number;
  readonly speedMps: number;
  readonly attainedCount: number;
  /**
   * 仿真时钟是否在推进：false 时速度类绑定（桨转速/天线倾角）的有效航速取 0
   * （桨停转、天线回正、姿态保持），舵角等位置类绑定保持最后值。缺省视为推进中。
   */
  readonly advancing?: boolean;
  /** Azipod 船型吊舱方位角遥测（°，0=指艏、正=左舷）：[左舷, 右舷]。 */
  readonly podAzimuthDeg?: readonly [number, number];
}

/** 有效航速：仿真不推进（暂停/未就绪/播完）时归零，速度类视觉绑定随之静止。 */
export function effectiveBindingSpeedMps(sim: BindingTelemetrySource): number {
  return sim.advancing === false ? 0 : sim.speedMps;
}

const DEFAULT_TELEMETRY_SCALE = { designSpeedMps: 15, rudderLimitDeg: 35 };

/** 程序化绑定遥测原值（未归一化）：按声明源取数，方位角缺遥测时取 0。 */
function rawProceduralTelemetry(sim: BindingTelemetrySource, binding: ProceduralBinding): number {
  switch (binding.source) {
    case 'telemetry.rudderDeg':
      return sim.rudderDeg;
    case 'telemetry.speedMps':
      return effectiveBindingSpeedMps(sim);
    case 'telemetry.podAzimuthPortDeg':
      return sim.podAzimuthDeg?.[0] ?? 0;
    case 'telemetry.podAzimuthStarboardDeg':
      return sim.podAzimuthDeg?.[1] ?? 0;
  }
}

/** 位置类遥测的钳制限幅：舵角/吊舱方位按船型声明取值，缺省 35°（舵角口径）。 */
function positionalTelemetryLimit(scale: NonNullable<VersionedModelPackageDescriptor['telemetryScale']>, binding: ProceduralBinding): number {
  if (binding.source === 'telemetry.podAzimuthPortDeg' || binding.source === 'telemetry.podAzimuthStarboardDeg') {
    return scale.podAzimuthLimitDeg ?? 180;
  }
  return scale.rudderLimitDeg ?? DEFAULT_TELEMETRY_SCALE.rudderLimitDeg;
}

/** 从展示池等概率随机选 1..maxPicks 条（Fisher–Yates 局部 shuffle，不修改原数组）。 */
function pickShowcaseClips(clips: readonly string[], maxPicks: number): string[] {
  const pool = [...clips];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.min(pool.length, 1 + Math.floor(Math.random() * maxPicks));
  return pool.slice(0, count);
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
  const showcaseActionsRef = useRef<THREE.AnimationAction[]>([]);
  const prevAdvancingRef = useRef<boolean | null>(null);

  // L0 clip-loop 绑定：进 useEffect 装配并在 cleanup 停播。
  // 不得在 useMemo 里 play()：StrictMode 会执行 setup→cleanup→setup，
  // 挂在 useMemo 的副作用不会随第二轮 setup 重放，action 全部停在未激活态。
  useEffect(() => {
    speedCoupledRef.current = [];
    showcaseActionsRef.current = [];
    delete model.userData.showcaseActiveClips;
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
    return () => {
      mixer.stopAllAction();
      // LOD 切换/重挂载重建 mixer 时同步清展示状态，避免残留非空引用
      // 使同一暂停段内的新 rig 误判"已在播放"而不再开播。
      showcaseActionsRef.current = [];
      delete model.userData.showcaseActiveClips;
    };
  }, [mixer, animations, descriptor, model]);

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
    // 有效航速：仿真不推进（暂停/未就绪/播完）时归零，桨停转、天线回正。
    const effectiveSpeedMps = effectiveBindingSpeedMps(sim);

    for (const { action, rate } of speedCoupledRef.current) {
      action.timeScale = rate * THREE.MathUtils.clamp(effectiveSpeedMps / scale.designSpeedMps, 0, 1.2);
    }
    for (const { binding, nodes } of procedural) {
      const raw = rawProceduralTelemetry(sim, binding);
      const limit = positionalTelemetryLimit(scale, binding);
      const speedLike = binding.source === 'telemetry.speedMps';
      const angleDeg = speedLike
        ? THREE.MathUtils.clamp(raw / scale.designSpeedMps, 0, 1) * binding.maxAngleDeg
        : (THREE.MathUtils.clamp(raw, -limit, limit) / limit) * binding.maxAngleDeg;
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
      const demos = (descriptor.interfaceContract as { demoAnimations?: readonly string[] }).demoAnimations ?? [];
      if (demos.length > 0 && descriptor.roles.demo) {
        setDemoRequest({
          clip: demos[Math.floor(Math.random() * demos.length)],
          key: sim.attainedCount,
        });
      }
    }

    // 结束展示：推进→停止边沿随机组合开播；停止→推进边沿停播（回到航行视觉）。
    // 活动清单写入 model.userData（元数据通道，QA 观测面可读，不进 React 状态）。
    if (descriptor.endingShowcase) {
      const advancing = sim.advancing ?? true;
      if (prevAdvancingRef.current !== null) {
        if (prevAdvancingRef.current && !advancing && showcaseActionsRef.current.length === 0) {
          const picked: string[] = [];
          for (const clipName of pickShowcaseClips(descriptor.endingShowcase.clips, descriptor.endingShowcase.maxPicks)) {
            const clip = animations.find((candidate) => candidate.name === clipName);
            if (!clip) {
              console.warn(`[semantic-bindings] showcase clip missing, skipped: ${clipName}`);
              continue;
            }
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            showcaseActionsRef.current.push(action);
            picked.push(clipName);
          }
          model.userData.showcaseActiveClips = picked;
        } else if (!prevAdvancingRef.current && advancing && showcaseActionsRef.current.length > 0) {
          for (const action of showcaseActionsRef.current) action.stop();
          showcaseActionsRef.current = [];
          model.userData.showcaseActiveClips = [];
        }
      }
      prevAdvancingRef.current = advancing;
    }

    mixer.update(delta);
  });

  if (!demoRequest) return null;
  const demoUrl = descriptor.roles.demo?.url;
  if (!demoUrl) return null;
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

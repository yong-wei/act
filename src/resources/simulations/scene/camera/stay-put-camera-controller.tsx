'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { SCENE_CAMERA_SHOTS } from './camera-shots';
import {
  createViewOffsetStore,
  resolveStayPutGoal,
  translateWithShip,
  type ShotFrame,
} from './stay-put';

export interface StayPutCameraControllerProps {
  /** 当前视角：SCENE_CAMERA_SHOTS 的 id 或 'free'。 */
  readonly view: string;
  /** 逐帧采样船舶世界位置。 */
  readonly positionSampler: () => { readonly x: number; readonly z: number };
  /** 逐帧采样航向角（弧度）。 */
  readonly headingSampler: () => number;
  readonly shipLength: number;
  readonly controlsRef: React.RefObject<OrbitControlsImpl | null>;
  readonly enabled?: boolean;
  /** 视角切换过渡时长（秒）。 */
  readonly transitionSeconds?: number;
}

interface CameraTransition {
  active: boolean;
  elapsed: number;
  from: ShotFrame;
  to: ShotFrame;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);

/**
 * 停留语义相机控制器：
 * - 交互结束后不主动回拉；各视角偏移跨模式切换保留（store 无 reset）；
 * - 跟船平移保持用户相对取景（target 不强制锁船）；
 * - 预设镜头切换走 slerp/lerp 平滑过渡；自由视角开启 OrbitControls 阻尼。
 */
export function StayPutCameraController({
  view,
  positionSampler,
  headingSampler,
  shipLength,
  controlsRef,
  enabled = true,
  transitionSeconds = 0.7,
}: StayPutCameraControllerProps) {
  const { camera, gl } = useThree();
  const store = useMemo(() => createViewOffsetStore(), []);
  const transitionRef = useRef<CameraTransition>({ active: false, elapsed: 0, from: null as unknown as ShotFrame, to: null as unknown as ShotFrame });
  const prevViewRef = useRef(view);
  const prevBaseTargetRef = useRef<THREE.Vector3 | null>(null);
  const initializedRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const interactingRef = useRef(false);
  const wasInteractingRef = useRef(false);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPresetView = view in SCENE_CAMERA_SHOTS;

  // 自由视角阻尼手感（模块内自治，不要求父组件改 OrbitControls 挂载）。
  useEffect(() => {
    const controls = controlsRef.current;
    if (!enabled || !controls) return;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [controlsRef, enabled, view]);

  // 指针交互追踪：按下期间由 OrbitControls 驱动，结束后捕获偏移。
  useEffect(() => {
    if (!enabled) return;
    const domElement = gl.domElement;
    const handlePointerDown = () => {
      pointerActiveRef.current = true;
      interactingRef.current = true;
      wasInteractingRef.current = true;
    };
    const handlePointerUp = () => {
      pointerActiveRef.current = false;
      // 拖拽（含触摸拖动）在抬起时即结束交互，捕获门才能打开（P1：主交互路径）。
      interactingRef.current = false;
    };
    const handleWheel = () => {
      interactingRef.current = true;
      wasInteractingRef.current = true;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        interactingRef.current = false;
      }, 240);
    };
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('wheel', handleWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [enabled, gl]);

  // 视角切换：启动平滑过渡（free 不切，保持当前取景）。
  useEffect(() => {
    if (!enabled || prevViewRef.current === view) return;
    const previousView = prevViewRef.current;
    prevViewRef.current = view;
    if (!(view in SCENE_CAMERA_SHOTS)) return;

    const ship = positionSampler();
    const base = SCENE_CAMERA_SHOTS[view as keyof typeof SCENE_CAMERA_SHOTS].frame({
      shipX: ship.x,
      shipZ: ship.z,
      headingRad: headingSampler(),
      shipLength,
    });
    const controls = controlsRef.current;
    transitionRef.current = {
      active: true,
      elapsed: 0,
      from: {
        position: camera.position.clone(),
        target: controls ? controls.target.clone() : base.target.clone(),
      },
      to: resolveStayPutGoal(base, store.get(view)),
    };
    prevBaseTargetRef.current = null;
    void previousView;
  }, [view, enabled, camera, controlsRef, positionSampler, headingSampler, shipLength, store]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const controls = controlsRef.current;
    const ship = positionSampler();

    // 过渡动画
    const transition = transitionRef.current;
    if (transition.active) {
      transition.elapsed += delta;
      const t = easeOutCubic(transition.elapsed / transitionSeconds);
      camera.position.lerpVectors(transition.from.position, transition.to.position, t);
      if (controls) {
        controls.target.lerpVectors(transition.from.target, transition.to.target, t);
        controls.update();
      }
      if (transition.elapsed >= transitionSeconds) {
        transition.active = false;
        camera.lookAt(transition.to.target);
        if (isPresetView) {
          const base = SCENE_CAMERA_SHOTS[view as keyof typeof SCENE_CAMERA_SHOTS].frame({
            shipX: ship.x,
            shipZ: ship.z,
            headingRad: headingSampler(),
            shipLength,
          });
          prevBaseTargetRef.current = base.target.clone();
        }
      }
      return;
    }

    if (!isPresetView) return;

    const base = SCENE_CAMERA_SHOTS[view as keyof typeof SCENE_CAMERA_SHOTS].frame({
      shipX: ship.x,
      shipZ: ship.z,
      headingRad: headingSampler(),
      shipLength,
    });

    // 首次进入：直接落位到预设（含历史偏移），不做动画；朝向只依赖相机自身。
    if (!initializedRef.current) {
      const goal = resolveStayPutGoal(base, store.get(view));
      camera.position.copy(goal.position);
      camera.lookAt(goal.target);
      if (controls) {
        controls.target.copy(goal.target);
        controls.update();
      }
      prevBaseTargetRef.current = base.target.clone();
      initializedRef.current = true;
      return;
    }

    if (!controls) return;

    // 跟船平移：保持用户相对取景，target 不锁船。
    const previousTarget = prevBaseTargetRef.current;
    if (previousTarget) {
      const shipDelta = base.target.clone().sub(previousTarget);
      if (shipDelta.lengthSq() > 1e-8) {
        const moved = translateWithShip(
          { position: camera.position, target: controls.target },
          shipDelta
        );
        camera.position.copy(moved.position);
        controls.target.copy(moved.target);
      }
    }
    prevBaseTargetRef.current = base.target.clone();

    // 只在用户交互结束后捕获一次偏移；空闲/阻尼漂移绝不写回，避免自我强化漂移。
    if (!interactingRef.current && !pointerActiveRef.current && wasInteractingRef.current) {
      wasInteractingRef.current = false;
      store.capture(view, base, camera.position, controls.target);
    }
    controls.update();
  });

  return null;
}

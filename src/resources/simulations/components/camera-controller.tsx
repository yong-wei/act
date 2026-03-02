'use client';

/**
 * 统一相机控制器组件
 * 提供三种视角切换功能：主视角(chase)、俯瞰视角(overhead)、战术斜角(tactical)
 * 支持自由视角模式，用户拖动/缩放后不会自动回弹
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

// ============ 类型定义 ============

export type CameraView = 'chase' | 'overhead' | 'tactical';
export type CameraMode = CameraView | 'free';

export interface CameraConfig {
  /** 跟随距离 (默认240) */
  chaseDistance?: number;
  /** 跟随高度 (默认130) */
  chaseHeight?: number;
  /** 侧向偏移 (默认与跟随距离相同) */
  chaseSideOffset?: number;
  /** 前方观察距离 (默认200) */
  chaseLookAheadDistance?: number;
  /** 航向偏置（弧度） */
  headingOffsetRad?: number;
  /** 俯瞰高度 (默认1200) */
  overheadHeight?: number;
  /** 战术视角距离 (默认600) */
  tacticalDistance?: number;
  /** 战术视角高度 (默认450) */
  tacticalHeight?: number;
  /** 位置平滑因子 (默认0.05) */
  positionLerp?: number;
  /** 目标平滑因子 (默认0.05) */
  targetLerp?: number;
}

export interface UnifiedCameraControllerProps {
  /** 目标位置 */
  position: { x: number; z: number };
  /** 航向角 (弧度) */
  headingRad: number;
  /** 当前相机模式 */
  cameraMode: CameraMode;
  /** OrbitControls 引用 */
  controlsRef: React.RefObject<OrbitControlsImpl>;
  /** 相机配置参数 */
  config?: CameraConfig;
  /** 是否跟随目标 (默认true) */
  followTarget?: boolean;
  /** 是否启用 (默认true) */
  enabled?: boolean;
}

export interface RightClickFreeModeBridgeProps {
  /** 触发切换到自由视角 */
  onRequestFreeMode: () => void;
  /** 是否启用监听 */
  enabled?: boolean;
}

// ============ 预设视角配置 ============

export const cameraViews: Array<{ id: CameraView; label: string; icon?: string }> = [
  { id: 'chase', label: '主视角', icon: '🎥' },
  { id: 'overhead', label: '俯瞰视角', icon: '🔭' },
  { id: 'tactical', label: '战术斜角', icon: '📐' },
];

// ============ 默认配置 ============

const defaultConfig: Required<CameraConfig> = {
  chaseDistance: 240,
  chaseHeight: 130,
  // 默认与跟随距离一致，形成左舷后方约 45° 视角
  chaseSideOffset: 240,
  // 以船体中心为观察目标，确保初始构图居中
  chaseLookAheadDistance: 0,
  headingOffsetRad: 0,
  overheadHeight: 1200,
  tacticalDistance: 600,
  tacticalHeight: 450,
  positionLerp: 0.05,
  targetLerp: 0.05,
};

// ============ 工具函数 ============

/**
 * 计算预设视角的相机位置和目标
 */
function calculatePresetPosition(
  mode: CameraView,
  shipX: number,
  shipZ: number,
  rawHeading: number,
  cfg: Required<CameraConfig>
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const heading = rawHeading + cfg.headingOffsetRad;
  switch (mode) {
    case 'chase':
      // 主视角：从左舷后方跟随
      return {
        position: new THREE.Vector3(
          shipX - Math.cos(heading) * cfg.chaseDistance - Math.sin(heading) * cfg.chaseSideOffset,
          cfg.chaseHeight,
          shipZ - Math.sin(heading) * cfg.chaseDistance + Math.cos(heading) * cfg.chaseSideOffset
        ),
        target: new THREE.Vector3(
          shipX + Math.cos(heading) * cfg.chaseLookAheadDistance,
          30,
          shipZ + Math.sin(heading) * cfg.chaseLookAheadDistance
        ),
      };

    case 'overhead':
      // 俯瞰视角：从正上方俯视
      return {
        position: new THREE.Vector3(shipX, cfg.overheadHeight, shipZ + 200),
        target: new THREE.Vector3(shipX, 0, shipZ),
      };

    case 'tactical':
      // 战术斜角：45度斜视
      return {
        position: new THREE.Vector3(
          shipX - cfg.tacticalDistance,
          cfg.tacticalHeight,
          shipZ - cfg.tacticalDistance
        ),
        target: new THREE.Vector3(shipX, 0, shipZ),
      };
  }
}

// ============ 相机控制器组件 ============

interface TransitionState {
  active: boolean;
  progress: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
}

interface ViewOrbitOffset {
  radius: number;
  theta: number;
  phi: number;
}

const MIN_ORBIT_RADIUS = 20;
const MIN_POLAR_ANGLE = 0.05;
const MAX_POLAR_ANGLE = Math.PI - 0.05;

function createDefaultViewOffsets(): Record<CameraView, ViewOrbitOffset> {
  return {
    chase: { radius: 0, theta: 0, phi: 0 },
    overhead: { radius: 0, theta: 0, phi: 0 },
    tactical: { radius: 0, theta: 0, phi: 0 },
  };
}

function applyViewOffset(
  presetPosition: THREE.Vector3,
  presetTarget: THREE.Vector3,
  offset: ViewOrbitOffset
): THREE.Vector3 {
  const baseOffset = presetPosition.clone().sub(presetTarget);
  const spherical = new THREE.Spherical().setFromVector3(baseOffset);
  spherical.radius = Math.max(MIN_ORBIT_RADIUS, spherical.radius + offset.radius);
  spherical.theta += offset.theta;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi + offset.phi,
    MIN_POLAR_ANGLE,
    MAX_POLAR_ANGLE
  );
  return new THREE.Vector3().setFromSpherical(spherical).add(presetTarget);
}

function captureViewOffset(
  presetPosition: THREE.Vector3,
  presetTarget: THREE.Vector3,
  currentPosition: THREE.Vector3,
  currentTarget: THREE.Vector3
): ViewOrbitOffset {
  const presetOffset = presetPosition.clone().sub(presetTarget);
  const currentOffset = currentPosition.clone().sub(currentTarget);

  if (presetOffset.lengthSq() < 1e-6 || currentOffset.lengthSq() < 1e-6) {
    return { radius: 0, theta: 0, phi: 0 };
  }

  const presetSpherical = new THREE.Spherical().setFromVector3(presetOffset);
  const currentSpherical = new THREE.Spherical().setFromVector3(currentOffset);
  return {
    radius: currentSpherical.radius - presetSpherical.radius,
    theta: currentSpherical.theta - presetSpherical.theta,
    phi: currentSpherical.phi - presetSpherical.phi,
  };
}

/**
 * 统一相机控制器
 * 在Canvas内部使用，与 OrbitControls 配合工作
 *
 * 工作原理：
 * - 在预设视角模式下，仅更新 OrbitControls 的 target 来跟随船舶
 * - 切换视角时，平滑动画相机位置和目标
 * - 在 'free' 模式下，完全由 OrbitControls 接管，不干预相机
 */
export function UnifiedCameraController({
  position,
  headingRad,
  cameraMode,
  controlsRef,
  config = {},
  followTarget = true,
  enabled = true,
}: UnifiedCameraControllerProps) {
  const { camera, gl } = useThree();

  // 合并配置
  const cfg: Required<CameraConfig> = useMemo(
    () => {
      const merged = { ...defaultConfig, ...config };
      if (config.chaseSideOffset === undefined) {
        merged.chaseSideOffset = merged.chaseDistance;
      }
      return merged;
    },
    [config]
  );

  // 过渡状态
  const transitionRef = useRef<TransitionState>({
    active: false,
    progress: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  // 上一个模式（用于检测模式变化）
  const prevModeRef = useRef<CameraMode>(cameraMode);
  // 是否已完成首帧视角初始化
  const initializedRef = useRef(false);
  // 当前按下的鼠标键（用于识别左键拖动）
  const pointerButtonRef = useRef<number | null>(null);
  // 记录各预设视角的用户拖动偏移
  const viewOffsetsRef = useRef<Record<CameraView, ViewOrbitOffset>>(createDefaultViewOffsets());

  useEffect(() => {
    if (!enabled) return;

    const domElement = gl.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      pointerButtonRef.current = event.button;
    };
    const clearPointer = () => {
      pointerButtonRef.current = null;
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', clearPointer);
    window.addEventListener('pointercancel', clearPointer);
    window.addEventListener('blur', clearPointer);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', clearPointer);
      window.removeEventListener('pointercancel', clearPointer);
      window.removeEventListener('blur', clearPointer);
    };
  }, [enabled, gl]);

  // 监听模式变化，启动过渡动画
  useEffect(() => {
    if (!enabled) return;

    // 检测模式是否变化
    if (prevModeRef.current !== cameraMode && cameraMode !== 'free') {
      // 计算目标位置
      const presetBase = calculatePresetPosition(
        cameraMode,
        position.x,
        position.z,
        headingRad,
        cfg
      );
      const presetPosition = applyViewOffset(
        presetBase.position,
        presetBase.target,
        viewOffsetsRef.current[cameraMode]
      );

      // 获取当前 OrbitControls 的 target
      const currentTarget = controlsRef.current?.target.clone() || new THREE.Vector3(position.x, 0, position.z);

      // 启动过渡动画
      transitionRef.current = {
        active: true,
        progress: 0,
        startPos: camera.position.clone(),
        endPos: presetPosition,
        startTarget: currentTarget,
        endTarget: presetBase.target,
      };
    }

    prevModeRef.current = cameraMode;
  }, [cameraMode, enabled, position.x, position.z, headingRad, cfg, camera, controlsRef]);

  useFrame(() => {
    if (!enabled) return;

    const transition = transitionRef.current;

    // 首次进入预设视角时，直接将相机放到预设位置，避免首屏偏移
    if (!transition.active && !initializedRef.current && cameraMode !== 'free' && controlsRef.current) {
      const presetBase = calculatePresetPosition(
        cameraMode,
        position.x,
        position.z,
        headingRad,
        cfg
      );
      const presetPosition = applyViewOffset(
        presetBase.position,
        presetBase.target,
        viewOffsetsRef.current[cameraMode]
      );
      camera.position.copy(presetPosition);
      controlsRef.current.target.copy(presetBase.target);
      controlsRef.current.update();
      initializedRef.current = true;
      return;
    }

    // 处理过渡动画
    if (transition.active) {
      transition.progress += cfg.positionLerp;

      // 使用 easeOutCubic 缓动函数
      const t = 1 - Math.pow(1 - Math.min(transition.progress, 1), 3);

      // 插值相机位置
      camera.position.lerpVectors(transition.startPos, transition.endPos, t);

      // 插值 OrbitControls 目标
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(transition.startTarget, transition.endTarget, t);
        controlsRef.current.update();
      }

      // 过渡完成
      if (transition.progress >= 1) {
        transition.active = false;
      }

      return; // 过渡期间不执行其他逻辑
    }

    // 在非 free 模式下，平滑更新相机位置与 target 跟随船舶
    if (cameraMode !== 'free' && followTarget && controlsRef.current) {
      const presetBase = calculatePresetPosition(
        cameraMode,
        position.x,
        position.z,
        headingRad,
        cfg
      );
      const presetPosition = applyViewOffset(
        presetBase.position,
        presetBase.target,
        viewOffsetsRef.current[cameraMode]
      );

      // 左键拖动：保持船体为目标中心，并记录拖动后的视角偏移
      if (pointerButtonRef.current === 0) {
        const targetDelta = presetBase.target.clone().sub(controlsRef.current.target);
        camera.position.add(targetDelta);
        controlsRef.current.target.copy(presetBase.target);
        viewOffsetsRef.current[cameraMode] = captureViewOffset(
          presetBase.position,
          presetBase.target,
          camera.position,
          controlsRef.current.target
        );
        controlsRef.current.update();
        return;
      }

      camera.position.lerp(presetPosition, cfg.positionLerp);
      controlsRef.current.target.lerp(presetBase.target, cfg.targetLerp);
      controlsRef.current.update();
    }

    // free 模式：OrbitControls 完全接管，这里不做任何操作
  });

  return null;
}

/**
 * 右键按下时切换自由视角
 * 左键拖动保持当前预设视角跟随逻辑，不主动切换到 free
 */
export function RightClickFreeModeBridge({
  onRequestFreeMode,
  enabled = true,
}: RightClickFreeModeBridgeProps) {
  const { gl } = useThree();

  useEffect(() => {
    if (!enabled) return;

    const domElement = gl.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        onRequestFreeMode();
      }
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [enabled, gl, onRequestFreeMode]);

  return null;
}

// ============ 辅助函数 ============

/**
 * 获取下一个视角 (用于循环切换)
 */
export function getNextCameraView(current: CameraView): CameraView {
  const views: CameraView[] = ['chase', 'overhead', 'tactical'];
  const currentIndex = views.indexOf(current);
  return views[(currentIndex + 1) % views.length];
}

/**
 * 获取视角显示名称
 */
export function getCameraViewLabel(view: CameraView | CameraMode): string {
  if (view === 'free') return '自由视角';
  const found = cameraViews.find((v) => v.id === view);
  return found?.label ?? view;
}

/**
 * 判断是否为预设视角
 */
export function isPresetView(mode: CameraMode): mode is CameraView {
  return mode === 'chase' || mode === 'overhead' || mode === 'tactical';
}

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
  /** 跟随距离 (默认450) */
  chaseDistance?: number;
  /** 跟随高度 (默认180) */
  chaseHeight?: number;
  /** 侧向偏移 (默认100) */
  chaseSideOffset?: number;
  /** 前方观察距离 (默认200) */
  chaseLookAheadDistance?: number;
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

// ============ 预设视角配置 ============

export const cameraViews: Array<{ id: CameraView; label: string; icon?: string }> = [
  { id: 'chase', label: '主视角', icon: '🎥' },
  { id: 'overhead', label: '俯瞰视角', icon: '🔭' },
  { id: 'tactical', label: '战术斜角', icon: '📐' },
];

// ============ 默认配置 ============

const defaultConfig: Required<CameraConfig> = {
  chaseDistance: 450,
  chaseHeight: 180,
  chaseSideOffset: 100,
  chaseLookAheadDistance: 200,
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
  heading: number,
  cfg: Required<CameraConfig>
): { position: THREE.Vector3; target: THREE.Vector3 } {
  switch (mode) {
    case 'chase':
      // 主视角：从船尾后方跟随
      return {
        position: new THREE.Vector3(
          shipX - Math.cos(heading) * cfg.chaseDistance + Math.sin(heading) * cfg.chaseSideOffset,
          cfg.chaseHeight,
          shipZ - Math.sin(heading) * cfg.chaseDistance - Math.cos(heading) * cfg.chaseSideOffset
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
  const { camera } = useThree();

  // 合并配置
  const cfg: Required<CameraConfig> = useMemo(
    () => ({ ...defaultConfig, ...config }),
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

  // 监听模式变化，启动过渡动画
  useEffect(() => {
    if (!enabled) return;

    // 检测模式是否变化
    if (prevModeRef.current !== cameraMode && cameraMode !== 'free') {
      // 计算目标位置
      const preset = calculatePresetPosition(
        cameraMode,
        position.x,
        position.z,
        headingRad,
        cfg
      );

      // 获取当前 OrbitControls 的 target
      const currentTarget = controlsRef.current?.target.clone() || new THREE.Vector3(position.x, 0, position.z);

      // 启动过渡动画
      transitionRef.current = {
        active: true,
        progress: 0,
        startPos: camera.position.clone(),
        endPos: preset.position,
        startTarget: currentTarget,
        endTarget: preset.target,
      };
    }

    prevModeRef.current = cameraMode;
  }, [cameraMode, enabled, position.x, position.z, headingRad, cfg, camera, controlsRef]);

  useFrame(() => {
    if (!enabled) return;

    const transition = transitionRef.current;

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

    // 在非 free 模式下，平滑更新 OrbitControls 的 target 跟随船舶
    if (cameraMode !== 'free' && followTarget && controlsRef.current) {
      const preset = calculatePresetPosition(
        cameraMode,
        position.x,
        position.z,
        headingRad,
        cfg
      );

      // 仅更新 target，不覆盖相机位置
      // 这样用户仍可以通过 OrbitControls 调整视角
      controlsRef.current.target.lerp(preset.target, cfg.targetLerp);
      controlsRef.current.update();
    }

    // free 模式：OrbitControls 完全接管，这里不做任何操作
  });

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

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * 反射 pass 隐藏名单（#2118 复审扩展）：以 `marine-` 前缀约定标识一切水面
 * 自身与教学/辅助叠层——水面/尾迹（防递归）、教学标注、引导线、轨迹、网格。
 * 环境物与船体保持可见（倒影主体）。
 */
export const REFLECTION_HIDDEN_NAME_PREFIX = 'marine-';

export const MARINE_PLANAR_REFLECTION_SCENE_KEY = 'marinePlanarReflection';

export interface MarinePlanarReflectionBinding {
  readonly texture: THREE.Texture;
  /** 世界→反射 RT 采样的纹理矩阵（bias × projection × view）。 */
  readonly matrix: THREE.Matrix4;
  readonly strength: number;
  readonly planeY: number;
}

/** 裁剪偏置：NDC → 纹理 UV。 */
const BIAS_MATRIX = new THREE.Matrix4().set(
  0.5, 0, 0, 0.5,
  0, 0.5, 0, 0.5,
  0, 0, 0.5, 0.5,
  0, 0, 0, 1,
);

/**
 * 受控高档平面反射（#2118）：平均水面（y=planeY）镜像相机渲染场景（隐藏
 * `marine-` 前缀叠层防递归/防教学线泄漏），低分辨率 RT、相机/主体运动或
 * **主体转向**触发更新（静止零成本）；水面片元经纹理矩阵投影采样得到倒影。
 * 禁用（质量降档/显式关闭）时释放渲染目标并在重启用时按需重建。
 */
export function MarinePlanarReflection({
  planeY,
  enabled,
  subjectPositionSampler,
  subjectHeadingSampler,
  resolution = 512,
  strength = 0.85,
}: {
  readonly planeY: number;
  readonly enabled: boolean;
  readonly subjectPositionSampler?: () => { readonly x: number; readonly z: number } | undefined;
  /** 主体航向采样（#2118 复审）：原地转向使反射缓存失效。 */
  readonly subjectHeadingSampler?: () => number | undefined;
  readonly resolution?: number;
  readonly strength?: number;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const mirrorCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  // RT 按需创建/释放：禁用即 dispose（降档不滞留 GPU 资源），重启用重建。
  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const stateRef = useRef({
    lastCameraPosition: new THREE.Vector3(Infinity, 0, 0),
    lastCameraQuaternion: new THREE.Quaternion(),
    lastSubject: new THREE.Vector2(Infinity, 0),
    lastSubjectHeading: Number.NaN,
    textureMatrix: new THREE.Matrix4(),
    hasRendered: false,
  });

  useEffect(() => {
    return () => {
      renderTargetRef.current?.dispose();
      renderTargetRef.current = null;
      if (scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]) {
        delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY];
      }
    };
  }, [scene]);

  const releaseBinding = () => {
    if (scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]) {
      delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY];
    }
    renderTargetRef.current?.dispose();
    renderTargetRef.current = null;
    stateRef.current.hasRendered = false;
  };

  useFrame(() => {
    if (!enabled) {
      if (renderTargetRef.current) releaseBinding();
      return;
    }
    const state = stateRef.current;
    const subject = subjectPositionSampler?.();
    const subjectHeading = subjectHeadingSampler?.();
    const subjectMoved =
      subject === undefined ||
      Math.hypot(subject.x - state.lastSubject.x, subject.z - state.lastSubject.y) > 3;
    // 原地转向（位置/相机都不动）同样使旧倒影失效（复审修复）。
    const subjectTurned =
      subjectHeading === undefined
        ? false
        : Number.isNaN(state.lastSubjectHeading) ||
          Math.abs(subjectHeading - state.lastSubjectHeading) > 0.02;
    const cameraMoved =
      camera.position.distanceTo(state.lastCameraPosition) > 1.5 ||
      Math.abs(camera.quaternion.angleTo(state.lastCameraQuaternion)) > 0.004;
    if (state.hasRendered && !cameraMoved && !subjectMoved && !subjectTurned) {
      return; // 静止场景不重画（默认无每帧反射成本）。
    }
    state.lastCameraPosition.copy(camera.position);
    state.lastCameraQuaternion.copy(camera.quaternion);
    if (subject) state.lastSubject.set(subject.x, subject.z);
    if (subjectHeading !== undefined) state.lastSubjectHeading = subjectHeading;

    if (!renderTargetRef.current) {
      renderTargetRef.current = new THREE.WebGLRenderTarget(resolution, resolution, {
        depthBuffer: true,
      });
    }
    const renderTarget = renderTargetRef.current;

    // 镜像相机：位置/朝向/上向量按水平面 y=planeY 反射，投影复制主相机。
    const source = camera as THREE.PerspectiveCamera;
    mirrorCamera.fov = source.fov;
    mirrorCamera.aspect = source.aspect;
    mirrorCamera.near = source.near;
    mirrorCamera.far = source.far;
    mirrorCamera.position.set(source.position.x, 2 * planeY - source.position.y, source.position.z);
    const lookAt = new THREE.Vector3();
    source.getWorldDirection(lookAt).multiplyScalar(1000).add(source.position);
    mirrorCamera.up.set(source.up.x, -source.up.y, source.up.z);
    mirrorCamera.lookAt(lookAt.x, 2 * planeY - lookAt.y, lookAt.z);
    mirrorCamera.updateMatrixWorld();
    mirrorCamera.projectionMatrix.copy(source.projectionMatrix);

    state.textureMatrix
      .copy(BIAS_MATRIX)
      .multiply(mirrorCamera.projectionMatrix)
      .multiply(mirrorCamera.matrixWorldInverse);

    const hidden: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.visible && object.name.startsWith(REFLECTION_HIDDEN_NAME_PREFIX)) {
        hidden.push(object);
        object.visible = false;
      }
    });
    const previousTarget = gl.getRenderTarget();
    gl.setRenderTarget(renderTarget);
    gl.clear(true, true, true);
    gl.render(scene, mirrorCamera);
    gl.setRenderTarget(previousTarget);
    for (const object of hidden) object.visible = true;

    scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY] = {
      texture: renderTarget.texture,
      matrix: state.textureMatrix.clone(),
      strength,
      planeY,
    } satisfies MarinePlanarReflectionBinding;
    state.hasRendered = true;
  });

  return null;
}

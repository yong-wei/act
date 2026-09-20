'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/** 反射 pass 隐藏名单：水面自身（防递归）与贴水尾迹（已由水面呈现）。 */
const REFLECTION_HIDDEN_NAMES = new Set(['marine-water', 'marine-wake']);

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
 * 受控高档平面反射（#2118）：平均水面（y=planeY）镜像相机渲染白名单外的
 * 场景（隐藏水面自身防递归），低分辨率 RT、相机/主体运动触发更新（静止
 * 不重画）；水面片元经纹理矩阵投影采样得到船体倒影。
 * 禁用时释放 scene 绑定（水面 uPlanarStrength 归零，无渲染开销）。
 */
export function MarinePlanarReflection({
  planeY,
  enabled,
  subjectPositionSampler,
  resolution = 512,
  strength = 0.85,
}: {
  readonly planeY: number;
  readonly enabled: boolean;
  readonly subjectPositionSampler?: () => { readonly x: number; readonly z: number } | undefined;
  readonly resolution?: number;
  readonly strength?: number;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const [renderTarget] = useState(
    () => new THREE.WebGLRenderTarget(resolution, resolution, { depthBuffer: true }),
  );
  const mirrorCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const stateRef = useRef({
    lastCameraPosition: new THREE.Vector3(Infinity, 0, 0),
    lastCameraQuaternion: new THREE.Quaternion(),
    lastSubject: new THREE.Vector2(Infinity, 0),
    textureMatrix: new THREE.Matrix4(),
    hasRendered: false,
  });

  useEffect(() => {
    return () => {
      renderTarget.dispose();
      if (scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]?.texture === renderTarget.texture) {
        delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY];
      }
    };
  }, [renderTarget, scene]);

  useFrame(() => {
    if (!enabled) {
      if (scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]) {
        delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY];
        stateRef.current.hasRendered = false;
      }
      return;
    }
    const state = stateRef.current;
    const subject = subjectPositionSampler?.();
    const subjectMoved =
      subject === undefined ||
      Math.hypot(subject.x - state.lastSubject.x, subject.z - state.lastSubject.y) > 3;
    const cameraMoved =
      camera.position.distanceTo(state.lastCameraPosition) > 1.5 ||
      Math.abs(camera.quaternion.angleTo(state.lastCameraQuaternion)) > 0.004;
    if (state.hasRendered && !cameraMoved && !subjectMoved) {
      return; // 静止场景不重画（默认无每帧反射成本）。
    }
    state.lastCameraPosition.copy(camera.position);
    state.lastCameraQuaternion.copy(camera.quaternion);
    if (subject) state.lastSubject.set(subject.x, subject.z);

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
      if (object.visible && REFLECTION_HIDDEN_NAMES.has(object.name)) {
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

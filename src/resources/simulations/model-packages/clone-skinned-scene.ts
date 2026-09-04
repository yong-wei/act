/**
 * 骨骼感知克隆：含 skins 的场景必须走 SkeletonUtils，plain clone(true) 会把骨骼留在原树。
 */
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

export function cloneSkinnedScene<T extends THREE.Object3D>(scene: T): T {
  return SkeletonUtils.clone(scene) as T;
}

export function skinnedBindingsIntact(root: THREE.Object3D): boolean {
  const inTree = new Set<THREE.Object3D>();
  root.traverse((object) => inTree.add(object));
  let intact = true;
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || !object.skeleton) {
      if (object instanceof THREE.SkinnedMesh) intact = false;
      return;
    }
    for (const bone of object.skeleton.bones) {
      if (!inTree.has(bone)) intact = false;
    }
  });
  return intact;
}

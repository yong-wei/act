'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

import type { VersionedModelPackageDescriptor } from '../model-packages/types';

type HeroMatrix = NonNullable<VersionedModelPackageDescriptor['modelToSceneMatrix']>;

/** 整合包行主序矩阵：用 Matrix4.set 一次写入，不再叠 basis yaw。 */
export function HeroModelBasis({
  matrix,
  children,
}: {
  matrix?: HeroMatrix;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (matrix) {
      group.matrix.set(...matrix);
      group.matrixAutoUpdate = false;
      group.matrixWorldNeedsUpdate = true;
      return;
    }
    group.matrixAutoUpdate = true;
    group.rotation.set(0, 0, 0);
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.updateMatrix();
  }, [matrix]);

  return (
    <group ref={groupRef} matrixAutoUpdate={!matrix}>
      {children}
    </group>
  );
}

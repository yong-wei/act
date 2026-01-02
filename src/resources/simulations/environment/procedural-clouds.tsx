'use client';

/**
 * 程序化云层组件
 * 使用实例化网格渲染云层
 */

import { useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';

interface ProceduralCloudsProps {
  /** 云层数量 */
  count?: number;
  /** 最小距离 */
  minDistance?: number;
  /** 最大距离 */
  maxDistance?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 最大高度 */
  maxHeight?: number;
  /** 随机种子 */
  seed?: number;
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function ProceduralClouds({
  count = 50,
  minDistance = 3000,
  maxDistance = 7000,
  minHeight = 800,
  maxHeight = 1400,
  seed = 42,
}: ProceduralCloudsProps) {
  const cloudsRef = useRef<THREE.InstancedMesh>(null);

  const cloudInstances = useMemo(() => {
    const random = seededRandom(seed);
    const instances: Array<{
      position: THREE.Vector3;
      scale: THREE.Vector3;
      rotation: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const distance = minDistance + random() * (maxDistance - minDistance);
      const height = minHeight + random() * (maxHeight - minHeight);
      const size = 80 + random() * 150;

      instances.push({
        position: new THREE.Vector3(
          Math.cos(angle) * distance,
          height,
          Math.sin(angle) * distance
        ),
        scale: new THREE.Vector3(size, size * 0.4, size * 0.7),
        rotation: random() * Math.PI * 2,
      });
    }

    return instances;
  }, [count, minDistance, maxDistance, minHeight, maxHeight, seed]);

  useLayoutEffect(() => {
    if (!cloudsRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    cloudInstances.forEach((cloud, i) => {
      tempMatrix.makeRotationY(cloud.rotation);
      tempMatrix.setPosition(cloud.position);
      tempMatrix.scale(cloud.scale);
      cloudsRef.current!.setMatrixAt(i, tempMatrix);
    });

    cloudsRef.current.instanceMatrix.needsUpdate = true;
  }, [cloudInstances]);

  return (
    <instancedMesh ref={cloudsRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

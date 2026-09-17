'use client';

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';

import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { ANNOTATION_STYLE } from './annotation-logic';

const RIG_SAMPLE_INTERVAL_SECONDS = 1 / 15;

export interface TeachingAnnotationsProps {
  /** 逐帧采样船舶世界位置与航向（弧度，forward = (sin h, 0, cos h)）。 */
  readonly positionSampler: () => { readonly x: number; readonly y?: number; readonly z: number };
  readonly headingSampler: () => number;
  /** 目标航向采样（弧度）；返回 undefined 时隐藏目标航线与目标弧段。 */
  readonly targetHeadingSampler?: () => number | undefined;
  readonly shipLength: number;
  /** 世界标签文本（如船名/任务标记）；缺省时隐藏标签。 */
  readonly label?: string;
}

interface AnnotationSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly headingRad: number;
  readonly targetHeadingRad?: number;
}

function HeadingArc({ snapshot, shipLength }: { readonly snapshot: AnnotationSnapshot; readonly shipLength: number }) {
  const radius = shipLength * ANNOTATION_STYLE.headingArc.radiusFactor;
  const currentPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 24;
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * snapshot.headingRad;
      points.push(new THREE.Vector3(Math.sin(angle) * radius, 1.2, Math.cos(angle) * radius));
    }
    return points;
  }, [snapshot.headingRad, radius]);

  const targetPoints = useMemo(() => {
    if (snapshot.targetHeadingRad === undefined) return null;
    const points: THREE.Vector3[] = [];
    const segments = 24;
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * snapshot.targetHeadingRad;
      points.push(new THREE.Vector3(Math.sin(angle) * radius * 1.15, 1.2, Math.cos(angle) * radius * 1.15));
    }
    return points;
  }, [snapshot.targetHeadingRad, radius]);

  return (
    <>
      <Line
        points={currentPoints}
        color={ANNOTATION_STYLE.headingArc.color}
        lineWidth={ANNOTATION_STYLE.headingArc.lineWidth}
        transparent
        opacity={ANNOTATION_STYLE.headingArc.opacity}
      />
      {targetPoints ? (
        <Line
          points={targetPoints}
          color={ANNOTATION_STYLE.targetCourse.color}
          lineWidth={ANNOTATION_STYLE.headingArc.lineWidth}
          transparent
          opacity={ANNOTATION_STYLE.targetCourse.opacity}
          dashed
          dashSize={6}
          gapSize={4}
        />
      ) : null}
    </>
  );
}

function TargetCourseLine({ snapshot, shipLength }: { readonly snapshot: AnnotationSnapshot; readonly shipLength: number }) {
  const points = useMemo(() => {
    if (snapshot.targetHeadingRad === undefined) return null;
    const length = shipLength * 4;
    return [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(
        Math.sin(snapshot.targetHeadingRad) * length,
        1,
        Math.cos(snapshot.targetHeadingRad) * length
      ),
    ];
  }, [snapshot.targetHeadingRad, shipLength]);

  if (!points) return null;
  return (
    <Line
      points={points}
      color={ANNOTATION_STYLE.targetCourse.color}
      lineWidth={2}
      transparent
      opacity={ANNOTATION_STYLE.targetCourse.opacity}
      dashed
      dashSize={ANNOTATION_STYLE.targetCourse.dashSize}
      gapSize={ANNOTATION_STYLE.targetCourse.gapSize}
    />
  );
}

function DirectionArrow({ snapshot, shipLength }: { readonly snapshot: AnnotationSnapshot; readonly shipLength: number }) {
  const forward = useMemo(
    () => new THREE.Vector3(Math.sin(snapshot.headingRad), 0, Math.cos(snapshot.headingRad)),
    [snapshot.headingRad]
  );
  return (
    <arrowHelper
      args={[
        forward,
        new THREE.Vector3(0, 2, 0),
        shipLength * 0.8,
        ANNOTATION_STYLE.directionArrow.color,
        shipLength * 0.18,
        shipLength * 0.1,
      ]}
    />
  );
}

function WorldLabel({ label, shipLength }: { readonly label?: string; readonly shipLength: number }) {
  const texture = useMemo(() => {
    if (!label) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = ANNOTATION_STYLE.worldLabel.background;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 24);
    ctx.fill();
    ctx.fillStyle = ANNOTATION_STYLE.worldLabel.color;
    ctx.font = `600 ${ANNOTATION_STYLE.worldLabel.fontSizePx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [label]);

  if (!texture) return null;
  return (
    <sprite position={[0, shipLength * 0.5, 0]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

/** 教学标注组合件：内部按 15Hz 采样驱动子件，仅在开关打开时由父组件挂载。 */
export function TeachingAnnotations({
  positionSampler,
  headingSampler,
  targetHeadingSampler,
  shipLength,
  label,
}: TeachingAnnotationsProps) {
  const [snapshot, setSnapshot] = useState<AnnotationSnapshot | null>(null);
  const lastSampleRef = useRef(0);

  const marineVisualTime = useMarineVisualTime();

  useFrame((state, delta) => {
    const now = marineVisualTime(state, delta);
    if (now - lastSampleRef.current < RIG_SAMPLE_INTERVAL_SECONDS) return;
    lastSampleRef.current = now;
    const position = positionSampler();
    setSnapshot({
      x: position.x,
      y: position.y ?? 0,
      z: position.z,
      headingRad: headingSampler(),
      targetHeadingRad: targetHeadingSampler?.(),
    });
  });

  if (!snapshot) return null;

  return (
    <group position={[snapshot.x, snapshot.y, snapshot.z]}>
      <HeadingArc snapshot={snapshot} shipLength={shipLength} />
      <TargetCourseLine snapshot={snapshot} shipLength={shipLength} />
      <DirectionArrow snapshot={snapshot} shipLength={shipLength} />
      <WorldLabel label={label} shipLength={shipLength} />
    </group>
  );
}

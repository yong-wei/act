'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import type {
  StaticSurfaceDataset,
  StaticSurface3DPanelProps,
  StaticSurfaceCameraConfig,
  StaticSurfaceMarkerConfig,
  StaticSurfacePoint,
  StaticSurfaceTriangle,
} from './static-surface-3d-panel';

interface StaticSurface3DWebGLProps {
  dataUrl?: string;
  initialDataset?: StaticSurfaceDataset;
  axes: StaticSurface3DPanelProps['axes'];
  colorScale: StaticSurface3DPanelProps['colorScale'];
  defaultCamera: StaticSurfaceCameraConfig;
  markers: StaticSurfaceMarkerConfig[];
  resetSignal: number;
  onDataLoadFailed: () => void;
}

const SURFACE_CANVAS_BACKGROUND = 0xf8fafc;
const SURFACE_AXIS_COLOR = 0x475569;
const SURFACE_MARKER_COLOR = 0xdc2626;
const TEXT_SPRITE_FOREGROUND = [15, 23, 42] as const;
const TEXT_SPRITE_BACKGROUND = [255, 255, 255] as const;
const SURFACE_DATASET_CACHE = new Map<string, Promise<StaticSurfaceDataset>>();

export function StaticSurface3DWebGL({
  dataUrl,
  initialDataset,
  axes,
  colorScale,
  defaultCamera,
  markers,
  onDataLoadFailed,
}: StaticSurface3DWebGLProps) {
  const [dataset, setDataset] = useState<StaticSurfaceDataset | null>(() => (
    initialDataset && isRenderableSurfaceDataset(initialDataset) ? initialDataset : null
  ));
  const hasDataset = Boolean(dataset);

  useEffect(() => {
    if (dataUrl) return;
    if (!hasDataset) onDataLoadFailed();
  }, [dataUrl, hasDataset, onDataLoadFailed]);

  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    loadStaticSurfaceDataset(dataUrl)
      .then((nextDataset) => {
        if (!cancelled) setDataset(nextDataset);
      })
      .catch(() => {
        if (!cancelled) onDataLoadFailed();
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl, onDataLoadFailed]);

  if (!dataset) return null;

  const markerList = dataset.markers?.length ? dataset.markers : markers;

  return (
    <div className="h-[320px] w-full" data-static-surface-webgl="loaded">
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: defaultCamera.position,
          fov: 45,
          zoom: defaultCamera.zoom ?? 1,
        }}
      >
        <color attach="background" args={[SURFACE_CANVAS_BACKGROUND]} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[4, 6, 5]} intensity={0.9} />
        <SurfaceMesh dataset={dataset} colorScale={colorScale} />
        <AxesLabels axes={axes} />
        {markerList.map((marker) => (
          <PoleMarker key={`${marker.label}-${marker.position.join(',')}`} marker={marker} />
        ))}
        <OrbitControls
          makeDefault
          target={defaultCamera.target}
          enablePan={false}
          minDistance={2}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
}

function loadStaticSurfaceDataset(dataUrl: string): Promise<StaticSurfaceDataset> {
  const cached = SURFACE_DATASET_CACHE.get(dataUrl);
  if (cached) return cached;

  const request = fetch(dataUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${dataUrl}`);
      return response.json() as Promise<StaticSurfaceDataset>;
    })
    .then((nextDataset) => {
      if (!isRenderableSurfaceDataset(nextDataset)) throw new Error(`Invalid static surface data ${dataUrl}`);
      return nextDataset;
    })
    .catch((error) => {
      SURFACE_DATASET_CACHE.delete(dataUrl);
      throw error;
    });
  SURFACE_DATASET_CACHE.set(dataUrl, request);
  return request;
}

function SurfaceMesh({
  dataset,
  colorScale,
}: {
  dataset: StaticSurfaceDataset;
  colorScale: StaticSurface3DPanelProps['colorScale'];
}) {
  const geometry = useMemo(() => buildSurfaceGeometry(dataset, colorScale), [dataset, colorScale]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.62} metalness={0.08} />
    </mesh>
  );
}

function AxesLabels({ axes }: { axes: StaticSurface3DPanelProps['axes'] }) {
  return (
    <group>
      <AxisLine start={[-2.4, 0, 0]} end={[2.4, 0, 0]} />
      <AxisLine start={[0, -2.4, 0]} end={[0, 2.4, 0]} />
      <AxisLine start={[0, 0, 0]} end={[0, 0, 2.4]} />
      <TextSprite text={axes.x.label} position={[2.7, 0, 0]} />
      <TextSprite text={axes.y.label} position={[0, 2.7, 0]} />
      <TextSprite text={axes.z.label} position={[0, 0, 2.7]} />
    </group>
  );
}

function AxisLine({ start, end }: { start: StaticSurfacePoint; end: StaticSurfacePoint }) {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const line = useMemo(
    () => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: SURFACE_AXIS_COLOR })),
    [geometry],
  );
  return <primitive object={line} />;
}

function PoleMarker({ marker }: { marker: StaticSurfaceMarkerConfig }) {
  return (
    <group position={marker.position}>
      <mesh>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshStandardMaterial color={SURFACE_MARKER_COLOR} />
      </mesh>
      <TextSprite text={marker.label} position={[0.16, 0.16, 0.16]} />
    </group>
  );
}

function TextSprite({ text, position }: { text: string; position: StaticSurfacePoint }) {
  const texture = useMemo(() => createTextTexture(text), [text]);
  return (
    <sprite position={position} scale={[0.72, 0.22, 1]}>
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}

function buildSurfaceGeometry(
  dataset: StaticSurfaceDataset,
  colorScale: StaticSurface3DPanelProps['colorScale'],
) {
  const { vertices, indices, values } = normalizeDataset(dataset);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex(indices.flat());
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors(values, colorScale), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function normalizeDataset(dataset: StaticSurfaceDataset): {
  vertices: StaticSurfacePoint[];
  indices: StaticSurfaceTriangle[];
  values: number[];
} {
  if (dataset.vertices?.length) {
    const triangles = Array.isArray(dataset.indices?.[0])
      ? dataset.indices as StaticSurfaceTriangle[]
      : chunkTriangles((dataset.indices as number[] | undefined) ?? []);
    return { vertices: dataset.vertices, indices: triangles, values: dataset.vertices.map((vertex) => vertex[2]) };
  }

  const grid = dataset.regularGrid!;
  const vertices: StaticSurfacePoint[] = [];
  const values: number[] = [];
  for (let yIndex = 0; yIndex < grid.y.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < grid.x.length; xIndex += 1) {
      const value = grid.values[yIndex]?.[xIndex] ?? 0;
      vertices.push([grid.x[xIndex], grid.y[yIndex], value / 24]);
      values.push(value);
    }
  }

  const indices: StaticSurfaceTriangle[] = [];
  for (let yIndex = 0; yIndex < grid.y.length - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < grid.x.length - 1; xIndex += 1) {
      const topLeft = yIndex * grid.x.length + xIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + grid.x.length;
      const bottomRight = bottomLeft + 1;
      indices.push([topLeft, bottomLeft, topRight], [topRight, bottomLeft, bottomRight]);
    }
  }
  return { vertices, indices, values };
}

function chunkTriangles(values: number[]): StaticSurfaceTriangle[] {
  const result: StaticSurfaceTriangle[] = [];
  for (let index = 0; index < values.length; index += 3) {
    if (values[index + 2] !== undefined) result.push([values[index], values[index + 1], values[index + 2]]);
  }
  return result;
}

function vertexColors(values: number[], colorScale: StaticSurface3DPanelProps['colorScale']) {
  const min = colorScale.min ?? Math.min(...values);
  const max = colorScale.max ?? Math.max(...values);
  const span = Math.max(1e-6, max - min);
  return values.flatMap((value) => {
    const ratio = Math.max(0, Math.min(1, (value - min) / span));
    return [0.08 + ratio * 0.78, 0.32 + ratio * 0.42, 0.78 - ratio * 0.54];
  });
}

function isRenderableSurfaceDataset(dataset: StaticSurfaceDataset): boolean {
  return hasRenderableGrid(dataset.regularGrid) || hasRenderableMesh(dataset);
}

function hasRenderableGrid(grid: StaticSurfaceDataset['regularGrid']): boolean {
  return Boolean(
    grid
      && numericArray(grid.x)
      && numericArray(grid.y)
      && grid.x.length >= 2
      && grid.y.length >= 2
      && Array.isArray(grid.values)
      && grid.values.length === grid.y.length
      && grid.values.every((row) => numericArray(row) && row.length === grid.x.length),
  );
}

function hasRenderableMesh(dataset: StaticSurfaceDataset): boolean {
  if (!Array.isArray(dataset.vertices) || dataset.vertices.length < 3) return false;
  if (!dataset.vertices.every((vertex) => numericTuple3(vertex))) return false;
  if (!Array.isArray(dataset.indices) || !dataset.indices.length) return false;
  if (Array.isArray(dataset.indices[0])) {
    return (dataset.indices as StaticSurfaceTriangle[]).every((triangle) => numericTuple3(triangle));
  }
  return (dataset.indices as number[]).every((index) => Number.isInteger(index)) && dataset.indices.length % 3 === 0;
}

function numericArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function numericTuple3(value: unknown): value is StaticSurfacePoint {
  return Array.isArray(value)
    && value.length === 3
    && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function createTextTexture(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = `rgba(${TEXT_SPRITE_BACKGROUND.join(',')},0.88)`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = `rgb(${TEXT_SPRITE_FOREGROUND.join(',')})`;
    context.font = '28px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

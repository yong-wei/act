'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
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
  viewMode: 'default' | 'top';
  autoRotate: boolean;
  markers: StaticSurfaceMarkerConfig[];
  resetSignal: number;
  onDataLoadFailed: () => void;
}

type SurfaceBounds = {
  x: [number, number];
  y: [number, number];
  z: [number, number];
};

const SURFACE_CANVAS_BACKGROUND = 0xffffff;
const SURFACE_AXIS_COLOR = 0x475569;
const SURFACE_GRID_COLOR = 0xcbd5e1;
const SURFACE_WIREFRAME_COLOR = 0x1f2937;
const SURFACE_MARKER_COLOR = 0xdc2626;
const TEXT_SPRITE_FOREGROUND = [15, 23, 42] as const;
const TEXT_SPRITE_BACKGROUND = [255, 255, 255] as const;
const AXIS_TICK_LENGTH = 0.18;
const AXIS_LABEL_OUTSET = 0.94;
const AXIS_TICK_LABEL_OUTSET = 0.46;
const SURFACE_DATASET_CACHE = new Map<string, Promise<StaticSurfaceDataset>>();

export function StaticSurface3DWebGL({
  dataUrl,
  initialDataset,
  axes,
  colorScale,
  defaultCamera,
  viewMode,
  autoRotate,
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
  const bounds = surfaceBoundsFromDataset(dataset);
  const cameraConfig = viewMode === 'top'
    ? { position: [boundsCenter(bounds)[0], boundsCenter(bounds)[1], 8] as [number, number, number], target: [...boundsCenter(bounds), 0.6] as [number, number, number], zoom: 1.2 }
    : defaultCamera;

  return (
    <div
      className="h-full min-h-[420px] w-full md:min-h-[620px]"
      data-static-surface-webgl="loaded"
      data-static-surface-drag-behavior="z-up-orbit"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: cameraConfig.position,
          fov: 45,
          zoom: cameraConfig.zoom ?? 1,
        }}
      >
        <color attach="background" args={[SURFACE_CANVAS_BACKGROUND]} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[4, 6, 5]} intensity={0.9} />
        <ZUpCameraFrame />
        <SurfaceReferenceFrame bounds={bounds} />
        <SurfaceMesh dataset={dataset} colorScale={colorScale} />
        <AxesLabels axes={axes} bounds={bounds} />
        <AxisTicks bounds={bounds} />
        {markerList.map((marker) => (
          <PoleMarker key={`${marker.label}-${marker.position.join(',')}`} marker={marker} />
        ))}
        <OrbitControls
          makeDefault
          target={cameraConfig.target}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.75}
          autoRotate={autoRotate}
          autoRotateSpeed={0.65}
          minDistance={2}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
}

function ZUpCameraFrame() {
  const { camera } = useThree();

  useEffect(() => {
    camera.up.set(0, 0, 1);
  }, [camera]);

  return null;
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
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.48} metalness={0.02} />
      </mesh>
      <SurfaceWireframe geometry={geometry} />
    </group>
  );
}

function SurfaceWireframe({ geometry }: { geometry: THREE.BufferGeometry }) {
  const wireframeGeometry = useMemo(() => new THREE.WireframeGeometry(geometry), [geometry]);
  return (
    <lineSegments geometry={wireframeGeometry}>
      <lineBasicMaterial color={SURFACE_WIREFRAME_COLOR} transparent opacity={0.18} />
    </lineSegments>
  );
}

function SurfaceReferenceFrame({ bounds }: { bounds: SurfaceBounds }) {
  const points = useMemo(() => {
    const floor = bounds.z[0];
    const result: THREE.Vector3[] = [];
    const add = (start: StaticSurfacePoint, end: StaticSurfacePoint) => {
      result.push(new THREE.Vector3(...start), new THREE.Vector3(...end));
    };
    const xStart = Math.ceil(bounds.x[0]);
    const xEnd = Math.floor(bounds.x[1]);
    const yStart = Math.ceil(bounds.y[0]);
    const yEnd = Math.floor(bounds.y[1]);
    for (let x = xStart; x <= xEnd; x += 1) add([x, bounds.y[0], floor], [x, bounds.y[1], floor]);
    for (let y = yStart; y <= yEnd; y += 1) add([bounds.x[0], y, floor], [bounds.x[1], y, floor]);
    add([bounds.x[0], bounds.y[0], floor], [bounds.x[1], bounds.y[0], floor]);
    add([bounds.x[1], bounds.y[0], floor], [bounds.x[1], bounds.y[1], floor]);
    add([bounds.x[1], bounds.y[1], floor], [bounds.x[0], bounds.y[1], floor]);
    add([bounds.x[0], bounds.y[1], floor], [bounds.x[0], bounds.y[0], floor]);
    add([bounds.x[0], bounds.y[0], floor], [bounds.x[0], bounds.y[0], bounds.z[1]]);
    add([bounds.x[1], bounds.y[0], floor], [bounds.x[1], bounds.y[0], bounds.z[1]]);
    add([bounds.x[0], bounds.y[1], floor], [bounds.x[0], bounds.y[1], bounds.z[1]]);
    return result;
  }, [bounds]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={SURFACE_GRID_COLOR} transparent opacity={0.72} />
    </lineSegments>
  );
}

function AxesLabels({ axes, bounds }: { axes: StaticSurface3DPanelProps['axes']; bounds: SurfaceBounds }) {
  const floor = bounds.z[0];
  const [centerX, centerY] = boundsCenter(bounds);
  const zCenter = (bounds.z[0] + bounds.z[1]) / 2;
  const xLabelPosition: StaticSurfacePoint = [centerX, bounds.y[0] - AXIS_LABEL_OUTSET, floor + 0.2];
  const yLabelPosition: StaticSurfacePoint = [bounds.x[0] - 1.6, centerY, floor + 0.42];
  const zLabelPosition: StaticSurfacePoint = [bounds.x[0] + 3.6, bounds.y[0] - AXIS_LABEL_OUTSET, zCenter];
  return (
    <group>
      <AxisLine start={[bounds.x[0], bounds.y[0], floor]} end={[bounds.x[1], bounds.y[0], floor]} />
      <AxisLine start={[bounds.x[0], bounds.y[0], floor]} end={[bounds.x[0], bounds.y[1], floor]} />
      <AxisLine start={[bounds.x[0], bounds.y[0], floor]} end={[bounds.x[0], bounds.y[0], bounds.z[1]]} />
      <TextSprite text={axes.x.label} position={xLabelPosition} scale={[1.18, 0.38, 1]} variant="axis" />
      <TextSprite text={axes.y.label} position={yLabelPosition} scale={[1.18, 0.38, 1]} variant="axis" />
      <TextSprite text={axes.z.label} position={zLabelPosition} scale={[1.45, 0.42, 1]} variant="axis" />
    </group>
  );
}

function AxisTicks({ bounds }: { bounds: SurfaceBounds }) {
  const floor = bounds.z[0];
  const xTicks = useMemo(() => niceTickValues(bounds.x, 4), [bounds]);
  const yTicks = useMemo(() => niceTickValues(bounds.y, 4), [bounds]);
  const zTicks = useMemo(() => niceTickValues(bounds.z, 4), [bounds]);

  return (
    <group>
      {xTicks.map((value) => (
        <group key={`x-${value}`}>
          <AxisLine start={[value, bounds.y[0], floor]} end={[value, bounds.y[0] - AXIS_TICK_LENGTH, floor]} />
          <TextSprite
            text={formatTickLabel(value)}
            position={[value, bounds.y[0] - AXIS_TICK_LABEL_OUTSET, floor + 0.08]}
            scale={[0.48, 0.24, 1]}
            variant="tick"
          />
        </group>
      ))}
      {yTicks.map((value) => (
        <group key={`y-${value}`}>
          <AxisLine start={[bounds.x[0], value, floor]} end={[bounds.x[0] - AXIS_TICK_LENGTH, value, floor]} />
          <TextSprite
            text={formatTickLabel(value)}
            position={[bounds.x[0] - AXIS_TICK_LABEL_OUTSET, value, floor + 0.08]}
            scale={[0.48, 0.24, 1]}
            variant="tick"
          />
        </group>
      ))}
      {zTicks.map((value) => (
        <group key={`z-${value}`}>
          <AxisLine start={[bounds.x[0], bounds.y[0], value]} end={[bounds.x[0] - AXIS_TICK_LENGTH, bounds.y[0], value]} />
          <TextSprite
            text={formatTickLabel(value)}
            position={[bounds.x[0] - AXIS_TICK_LABEL_OUTSET, bounds.y[0] - 0.08, value]}
            scale={[0.52, 0.26, 1]}
            variant="tick"
          />
        </group>
      ))}
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
      <TextSprite text={marker.label} position={[0.16, 0.16, 0.16]} scale={[1.0, 0.31, 1]} variant="marker" />
    </group>
  );
}

function TextSprite({
  text,
  position,
  scale,
  variant,
}: {
  text: string;
  position: StaticSurfacePoint;
  scale: StaticSurfacePoint;
  variant: 'axis' | 'marker' | 'tick';
}) {
  const texture = useMemo(() => createTextTexture(text, variant), [text, variant]);
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} depthTest={false} depthWrite={false} />
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
  geometry.computeBoundingBox();
  return geometry;
}

function surfaceBoundsFromDataset(dataset: StaticSurfaceDataset): SurfaceBounds {
  const { vertices } = normalizeDataset(dataset);
  const xs = vertices.map((vertex) => vertex[0]);
  const ys = vertices.map((vertex) => vertex[1]);
  const zs = vertices.map((vertex) => vertex[2]);
  return {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
    z: [Math.min(...zs), Math.max(...zs)],
  };
}

function boundsCenter(bounds: SurfaceBounds): [number, number] {
  return [
    (bounds.x[0] + bounds.x[1]) / 2,
    (bounds.y[0] + bounds.y[1]) / 2,
  ];
}

function niceTickValues(range: [number, number], maxTicks: number): number[] {
  const [min, max] = range;
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [min];

  const step = niceTickStep(span / Math.max(1, maxTicks - 1));
  const start = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = start; value <= max + step * 0.25; value += step) {
    values.push(roundTickValue(value));
  }
  return values;
}

function niceTickStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep));
  const scale = 10 ** exponent;
  const fraction = rawStep / scale;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * scale;
}

function roundTickValue(value: number): number {
  return Number(value.toFixed(6));
}

function formatTickLabel(value: number): string {
  if (Math.abs(value) < 1e-6) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
    return matlabJetColor(ratio);
  });
}

function matlabJetColor(ratio: number) {
  const fourValue = 4 * ratio;
  return [
    Math.max(0, Math.min(1, Math.min(fourValue - 1.5, -fourValue + 4.5))),
    Math.max(0, Math.min(1, Math.min(fourValue - 0.5, -fourValue + 3.5))),
    Math.max(0, Math.min(1, Math.min(fourValue + 0.5, -fourValue + 2.5))),
  ];
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

function createTextTexture(text: string, variant: 'axis' | 'marker' | 'tick') {
  const canvas = document.createElement('canvas');
  canvas.width = variant === 'tick' ? 192 : 512;
  canvas.height = variant === 'tick' ? 96 : 160;
  const context = canvas.getContext('2d');
  if (context) {
    const fontSize = variant === 'axis' ? 58 : variant === 'marker' ? 46 : 64;
    context.font = `700 ${fontSize}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (variant === 'marker') {
      context.fillStyle = `rgba(${TEXT_SPRITE_BACKGROUND.join(',')},0.94)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      context.lineWidth = variant === 'axis' ? 7 : 5;
      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.strokeText(text, canvas.width / 2, canvas.height / 2);
    }
    context.fillStyle = `rgb(${TEXT_SPRITE_FOREGROUND.join(',')})`;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

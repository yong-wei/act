'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';

export interface StaticSurfaceAxisConfig {
  label: string;
}

export interface StaticSurfaceCameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  zoom?: number;
}

export interface StaticSurfaceMarkerConfig {
  label: string;
  position: [number, number, number];
}

export type StaticSurfacePoint = [number, number, number];
export type StaticSurfaceTriangle = [number, number, number];

export interface StaticSurfaceDataset {
  vertices?: StaticSurfacePoint[];
  indices?: StaticSurfaceTriangle[] | number[];
  regularGrid?: {
    x: number[];
    y: number[];
    values: number[][];
  };
  markers?: StaticSurfaceMarkerConfig[];
}

export interface StaticSurface3DPanelProps {
  moduleId: string;
  title: string;
  caption?: string;
  dataUrl?: string;
  dataset?: StaticSurfaceDataset;
  axes: {
    x: StaticSurfaceAxisConfig;
    y: StaticSurfaceAxisConfig;
    z: StaticSurfaceAxisConfig;
  };
  colorScale: {
    label: string;
    min?: number;
    max?: number;
  };
  defaultCamera: StaticSurfaceCameraConfig;
  fallback: {
    image: string;
    alt: string;
    note?: string;
  };
  markers?: StaticSurfaceMarkerConfig[];
}

type WebGLSurfaceComponent = ComponentType<{
  dataUrl?: string;
  initialDataset?: StaticSurfaceDataset;
  axes: StaticSurface3DPanelProps['axes'];
  colorScale: StaticSurface3DPanelProps['colorScale'];
  defaultCamera: StaticSurfaceCameraConfig;
  markers: StaticSurfaceMarkerConfig[];
  resetSignal: number;
  onDataLoadFailed: () => void;
}>;

type StaticSurfaceUnavailableReason = 'data' | 'webgl';

export function StaticSurface3DPanel({
  moduleId,
  title,
  caption,
  dataUrl,
  dataset,
  axes,
  colorScale,
  defaultCamera,
  fallback,
  markers = [],
}: StaticSurface3DPanelProps) {
  const [resetSignal, setResetSignal] = useState(0);
  const [WebGLSurface, setWebGLSurface] = useState<WebGLSurfaceComponent | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<StaticSurfaceUnavailableReason | null>(null);
  const axisLabels = useMemo(() => [axes.x.label, axes.y.label, axes.z.label].filter(Boolean), [axes]);
  const handleDataLoadFailed = useCallback(() => setUnavailableReason('data'), []);

  useEffect(() => {
    let cancelled = false;
    if (!canCreateWebGLContext()) {
      setUnavailableReason('webgl');
      return () => {
        cancelled = true;
      };
    }
    void import('./static-surface-3d-webgl').then((module) => {
      if (!cancelled) setWebGLSurface(() => module.StaticSurface3DWebGL);
    }).catch(() => {
      if (!cancelled) setUnavailableReason('webgl');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      data-static-surface-3d-panel={moduleId}
      className="space-y-4 rounded-lg border border-platform-border bg-platform-panel p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="premium-lesson-title text-lg font-semibold leading-7">{title}</h3>
          {caption ? <p className="premium-lesson-muted text-sm leading-6">{caption}</p> : null}
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-platform-border bg-platform-panel px-3 text-sm font-medium text-platform-strong transition hover:bg-platform-panel-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-focus"
          onClick={() => setResetSignal((value) => value + 1)}
        >
          重置视角
        </button>
      </div>

      <div className="grid gap-3 text-xs text-platform-muted sm:grid-cols-2 lg:grid-cols-4">
        {axisLabels.map((label) => (
          <div key={label} className="rounded-md border border-platform-border bg-platform-panel-muted px-3 py-2">
            {label}
          </div>
        ))}
        <div className="rounded-md border border-platform-border bg-platform-panel-muted px-3 py-2">
          {colorScale.label}
        </div>
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-platform-border bg-platform-canvas">
        {WebGLSurface && !unavailableReason ? (
          <WebGLSurface
            key={`surface-${resetSignal}`}
            dataUrl={dataUrl}
            initialDataset={dataset}
            axes={axes}
            colorScale={colorScale}
            defaultCamera={defaultCamera}
            markers={markers}
            resetSignal={resetSignal}
            onDataLoadFailed={handleDataLoadFailed}
          />
        ) : (
          <StaticSurfaceFallback fallback={fallback} reason={unavailableReason} />
        )}
      </div>
      <p className="premium-lesson-muted text-xs leading-5">
        {fallback.note ?? '如果浏览器无法启用 WebGL，本面板保留静态图作为同一教学对象的备用证据。'}
      </p>
    </section>
  );
}

function StaticSurfaceFallback({
  fallback,
  reason,
}: {
  fallback: StaticSurface3DPanelProps['fallback'];
  reason?: StaticSurfaceUnavailableReason | null;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-4 text-center">
      {reason ? (
        <p className="premium-lesson-title text-sm font-semibold leading-6">
          {reason === 'webgl' ? '当前浏览器无法启用 WebGL，已切换为静态证据。' : '曲面数据暂不可用，已切换为静态证据。'}
        </p>
      ) : null}
      <Image
        src={fallback.image}
        alt={fallback.alt}
        width={900}
        height={520}
        className="max-h-[280px] w-full max-w-[760px] rounded-md object-contain"
      />
      <p className="premium-lesson-muted text-sm leading-6">{fallback.alt}</p>
    </div>
  );
}

function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(
    canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl'),
  );
}

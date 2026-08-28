'use client';

import type { ReactNode } from 'react';

import { StaticSurface3DPanel, type StaticSurface3DPanelProps, type StaticSurfaceDataset } from '../static-surface-3d-panel';
import {
  asRecord,
  blockFor,
  numberField,
  numberTuple3,
  numericArray,
  runtimeMediaPath,
  stringField,
  titleFromModule,
} from '../manifest-payload-fields';
import type {
  ManifestModulePlugin,
  ManifestModuleRendererInput,
  ManifestPluginSet,
} from './plugin-contract';

/**
 * Owned plugin for the `compute.panel` capability `static-surface-3d`.
 * Migrated verbatim from the central `content-renderers.tsx` branch: the
 * schema, projection, render, and missing-renderer behavior below are the
 * single authority for this composite identity.
 */

const STATIC_SURFACE_3D_PLUGIN_KEY = {
  category: 'module',
  moduleKind: 'compute.panel',
  capabilityRef: 'static-surface-3d',
  contractVersion: 'static-surface-3d.v1',
} as const;

export const STATIC_SURFACE_3D_PLUGIN_OWNER = 'manifest-runtime/static-surface-3d-module';

export function staticSurface3DPanelProps(input: ManifestModuleRendererInput): StaticSurface3DPanelProps {
  const { manifest, step, module } = input;
  const payload = module.payload;
  const block = asRecord(blockFor(step, payload));
  const data = asRecord(payload.data ?? payload.dataSource ?? payload.surfaceData);
  const axes = asRecord(payload.axes);
  const colorScale = asRecord(payload.colorScale ?? payload.color_scale);
  const defaultCamera = asRecord(payload.defaultCamera ?? payload.default_camera);
  const fallback = asRecord(payload.fallback);
  const fallbackImage = stringField(fallback, ['image', 'src', 'path'])
    || stringField(payload, ['fallback_image', 'fallbackImage']);
  const dataUrl = stringField(data, ['url', 'src', 'path']);

  return {
    moduleId: module.id,
    title: titleFromModule(module, step),
    caption: stringField(payload, ['caption', 'description', 'text'])
      || stringField(block, ['description', 'body', 'text']),
    dataUrl: dataUrl ? runtimeMediaPath(manifest, dataUrl) : undefined,
    dataset: staticSurfaceDataset(data),
    axes: {
      x: { label: axisLabel(axes.x, '实部 σ') },
      y: { label: axisLabel(axes.y, '虚部 jω') },
      z: { label: axisLabel(axes.z, '幅值') },
    },
    colorScale: {
      label: stringField(colorScale, ['label', 'title']) || '幅值',
      min: numberField(colorScale, ['min']),
      max: numberField(colorScale, ['max']),
    },
    defaultCamera: {
      position: numberTuple3(defaultCamera.position, [3, 3, 2]),
      target: numberTuple3(defaultCamera.target, [0, 0, 0]),
      zoom: numberField(defaultCamera, ['zoom']) ?? 1,
    },
    fallback: {
      image: runtimeMediaPath(manifest, fallbackImage),
      alt: stringField(fallback, ['alt', 'description'])
        || stringField(block, ['description', 'body', 'text'])
        || `${titleFromModule(module, step)}静态图`,
      note: stringField(fallback, ['note']),
    },
    markers: markerConfigs(payload.markers ?? block.markers),
  };
}

function axisLabel(value: unknown, fallback: string) {
  const axis = asRecord(value);
  return stringField(axis, ['label', 'title', 'name']) || fallback;
}

function markerConfigs(value: unknown): StaticSurface3DPanelProps['markers'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const marker = asRecord(item);
      const label = stringField(marker, ['label', 'title']);
      if (!label) return null;
      return {
        label,
        position: numberTuple3(marker.position, [0, 0, 0]),
      };
    })
    .filter((item): item is NonNullable<StaticSurface3DPanelProps['markers']>[number] => Boolean(item));
}

function staticSurfaceDataset(data: Record<string, unknown>): StaticSurfaceDataset | undefined {
  const regularGrid = asRecord(data.regularGrid);
  if (regularGrid.x || regularGrid.y || regularGrid.values) {
    return {
      regularGrid: {
        x: numericArray(regularGrid.x),
        y: numericArray(regularGrid.y),
        values: numericRows(regularGrid.values),
      },
      markers: markerConfigs(data.markers),
    };
  }

  if (Array.isArray(data.vertices)) {
    return {
      vertices: pointRows(data.vertices),
      indices: triangleRows(data.indices) ?? numericArray(data.indices),
      markers: markerConfigs(data.markers),
    };
  }

  return undefined;
}

function numericRows(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value.map(numericArray);
}

function pointRows(value: unknown): Array<[number, number, number]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => numericArray(item).slice(0, 3))
    .filter((item): item is [number, number, number] => item.length === 3);
}

function triangleRows(value: unknown): Array<[number, number, number]> | undefined {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return undefined;
  return value
    .map((item) => numericArray(item).slice(0, 3))
    .filter((item): item is [number, number, number] => item.length === 3);
}

export const staticSurface3DModulePlugin: ManifestModulePlugin<StaticSurface3DPanelProps> = {
  key: STATIC_SURFACE_3D_PLUGIN_KEY,
  owner: STATIC_SURFACE_3D_PLUGIN_OWNER,
  schema: staticSurface3DPanelProps,
  // The pilot payload carries no reference answers or teacher-only controls;
  // both roles intentionally receive the identical projection.
  projectRole: (payload) => payload,
  render: ({ payload }): ReactNode => <StaticSurface3DPanel {...payload} />,
  evidence: { classification: 'view-interaction-log' },
  missingRenderer: {
    requirement: 'required',
    marker: 'manifest-plugin-missing:compute.panel:static-surface-3d',
    reason: '本课的三维幅值曲面能力没有已注册的渲染插件，为避免错版已停止渲染该模块。',
  },
};

export const staticSurface3DPluginSet: ManifestPluginSet = {
  owner: STATIC_SURFACE_3D_PLUGIN_OWNER,
  plugins: [staticSurface3DModulePlugin],
  declaredModuleCapabilities: [
    { moduleKind: 'compute.panel', capabilityRef: 'static-surface-3d' },
  ],
};

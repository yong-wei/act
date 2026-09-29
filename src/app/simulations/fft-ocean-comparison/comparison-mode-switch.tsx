import Link from 'next/link';

import {
  comparisonLabHref,
  type ComparisonBackend,
  type ComparisonFftResolution,
  type ComparisonGraphicsApi,
  type ComparisonLod,
  type ComparisonSceneId,
} from './comparison-lab';

interface ComparisonModeSwitchProps {
  readonly api: ComparisonGraphicsApi;
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly resolution?: ComparisonFftResolution;
  readonly lod?: ComparisonLod | null;
  readonly failAsset?: boolean;
}

function ModeGroup<T extends string>({
  axis,
  label,
  value,
  options,
  hrefFor,
}: {
  readonly axis: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly id: T; readonly label: string }[];
  readonly hrefFor: (id: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="text-slate-500">{label}</span>
      {options.map((option) => {
        const active = option.id === value;
        const className = active
          ? 'rounded bg-sky-600 px-2 py-0.5 text-white'
          : 'rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800';
        if (active) {
          return (
            <span
              key={option.id}
              aria-current="true"
              data-comparison-axis={axis}
              data-comparison-value={option.id}
              data-active="true"
              className={className}
            >
              {option.label}
            </span>
          );
        }
        return (
          <Link
            key={option.id}
            href={hrefFor(option.id)}
            scroll={false}
            data-comparison-axis={axis}
            data-comparison-value={option.id}
            data-active="false"
            className={className}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export function ComparisonModeSwitch({
  api,
  backend,
  scene,
  resolution = 256,
  lod = null,
  failAsset = false,
}: ComparisonModeSwitchProps) {
  const current = { api, backend, scene, resolution, lod, failAsset };
  return (
    <nav aria-label="对照模式" data-comparison-mode-switch="true" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ModeGroup
        axis="backend"
        label="算法"
        value={backend}
        options={[
          { id: 'fft', label: 'FFT' },
          { id: 'gerstner', label: 'Gerstner' },
        ]}
        hrefFor={(next) => comparisonLabHref({ ...current, backend: next })}
      />
      <ModeGroup
        axis="scene"
        label="场景"
        value={scene}
        options={[
          { id: 'wave-only', label: 'wave-only' },
          { id: 'feature-parity', label: 'feature-parity' },
        ]}
        hrefFor={(next) => comparisonLabHref({ ...current, scene: next })}
      />
      <ModeGroup
        axis="api"
        label="接口"
        value={api}
        options={[
          { id: 'webgl', label: 'WebGL' },
          { id: 'webgpu', label: 'WebGPU' },
        ]}
        hrefFor={(next) => comparisonLabHref({ ...current, api: next })}
      />
    </nav>
  );
}

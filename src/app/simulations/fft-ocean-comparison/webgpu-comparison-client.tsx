'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { color, float, Fn, mix, positionLocal, vec3, vertexIndex } from 'three/tsl';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';

import { GERSTNER_WAVE_SETS } from '@/resources/simulations/scene/water/gerstner-waves';
import { fftOceanStaticSpectrum } from '@/resources/simulations/scene/water/fft-ocean';
import { shallowPathAbsorption } from '@/resources/simulations/scene/water/shared-water-optics';
import {
  computeWebGpuOceanField,
  identifyMarineWebGpu,
  type MarineWebGpuIdentity,
  type WebGpuOceanField,
} from '@/resources/simulations/scene/water/webgpu-ocean';
import {
  COMPARISON_FEATURE_MATRIX,
  COMPARISON_SPECTRUM_INPUT,
  comparisonRouteKey,
  type ComparisonBackend,
  type ComparisonSceneId,
} from './comparison-lab';

const VALIDATION_SPECTRUM = {
  resolution: 32,
  domainMeters: 256,
  windSpeedMps: COMPARISON_SPECTRUM_INPUT.windSpeedMps,
  windDirectionRad: COMPARISON_SPECTRUM_INPUT.windDirectionRad,
  seaState: COMPARISON_SPECTRUM_INPUT.seaState,
  seed: COMPARISON_SPECTRUM_INPUT.seed,
} as const;

interface WebGpuProbe {
  ready: () => boolean;
  identity: () => MarineWebGpuIdentity | null;
  validation: () => {
    heightL2: number;
    slopeL2: number;
    displacementL2: number;
    nativeBackend: boolean;
    route: string;
  } | null;
  features: () => {
    optics: string;
    ibl: boolean;
    planar: boolean;
    foam: boolean;
    shallow: boolean;
    fallbackToWebGL: boolean;
  };
  dispose: () => void;
}

declare global {
  interface Window {
    __marineWebGpu?: WebGpuProbe;
    __marineWebGpuBackend?: string;
  }
}

function WaterMesh({
  field,
  scene,
}: {
  readonly field: WebGpuOceanField;
  readonly scene: ComparisonSceneId;
}) {
  const feature = COMPARISON_FEATURE_MATRIX[scene];
  const geometry = useMemo(() => {
    const n = field.resolution;
    const positions = new Float32Array(n * n * 3);
    const indices: number[] = [];
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const index = j * n + i;
        positions[index * 3] = (i / (n - 1) - 0.5) * VALIDATION_SPECTRUM.domainMeters;
        positions[index * 3 + 2] = (j / (n - 1) - 0.5) * VALIDATION_SPECTRUM.domainMeters;
      }
    }
    for (let j = 0; j < n - 1; j += 1) {
      for (let i = 0; i < n - 1; i += 1) {
        const a = j * n + i;
        indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setIndex(indices);
    buffer.computeVertexNormals();
    return buffer;
  }, [field.resolution]);
  const material = useMemo(() => {
    const nodeMaterial = new MeshStandardNodeMaterial();
    const sample = () => field.fieldNode.element(vertexIndex);
    nodeMaterial.positionNode = Fn(() => {
      const displaced = sample();
      const base = positionLocal as any;
      return vec3(base.x.add(displaced.y), displaced.x, base.z.add(displaced.z));
    })();
    if (feature.optics === 'neutral') {
      nodeMaterial.colorNode = color('#16384a');
      nodeMaterial.roughness = 1;
      nodeMaterial.metalness = 0;
    } else {
      const absorption = shallowPathAbsorption(feature.shallow ? 4 : 18);
      const foam = feature.foam ? sample().w : float(0);
      nodeMaterial.colorNode = mix(color('#072433'), color('#f4fbff'), foam).mul(absorption);
      nodeMaterial.roughness = 0.08;
      nodeMaterial.metalness = 0.2;
    }
    return nodeMaterial;
  }, [feature.foam, feature.optics, feature.shallow, field.fieldNode]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return <mesh geometry={geometry} material={material} />;
}

function WebGpuOcean({
  backend,
  scene,
  onField,
  onFieldError,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly onField: (field: WebGpuOceanField) => void;
  readonly onFieldError: (message: string) => void;
}) {
  const renderer = useThree((state) => state.gl) as unknown as WebGPURenderer;
  const threeScene = useThree((state) => state.scene);
  const feature = COMPARISON_FEATURE_MATRIX[scene];
  useEffect(() => {
    let disposed = false;
    let field: WebGpuOceanField | null = null;
    const run = async () => {
      field = await computeWebGpuOceanField(renderer, backend === 'fft'
        ? {
          algorithm: 'fft',
          spectrum: fftOceanStaticSpectrum(VALIDATION_SPECTRUM),
          domainMeters: VALIDATION_SPECTRUM.domainMeters,
          timeSeconds: 1.5,
        }
        : {
          algorithm: 'gerstner',
          waves: GERSTNER_WAVE_SETS.low,
          domainMeters: VALIDATION_SPECTRUM.domainMeters,
          timeSeconds: 1.5,
          amplitudeScale: 1,
        });
      if (disposed) {
        field.dispose();
        return;
      }
      onField(field);
    };
    void run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      if (!disposed) onFieldError(message);
    });
    return () => {
      disposed = true;
      field?.dispose();
      threeScene.environment = null;
    };
  }, [backend, feature.ibl, onField, onFieldError, renderer, threeScene]);
  return null;
}

export default function WebGpuComparisonClient({
  backend,
  scene,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
}) {
  const [identity, setIdentity] = useState<MarineWebGpuIdentity | null>(null);
  const [field, setField] = useState<WebGpuOceanField | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const feature = COMPARISON_FEATURE_MATRIX[scene];
  const route = comparisonRouteKey('webgpu', backend);

  useEffect(() => {
    let cancelled = false;
    void identifyMarineWebGpu().then((next) => {
      if (!cancelled) setIdentity(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const probe: WebGpuProbe = {
      ready: () => Boolean(field?.nativeBackend),
      identity: () => identity,
      validation: () => field ? {
        heightL2: field.heightL2,
        slopeL2: field.slopeL2,
        displacementL2: field.displacementL2,
        nativeBackend: field.nativeBackend,
        route,
        probeHeights: field.probeHeights,
        referenceHeights: field.referenceHeights,
      } : null,
      features: () => ({
        optics: feature.optics,
        ibl: false,
        planar: feature.planar,
        foam: feature.foam,
        shallow: feature.shallow,
        fallbackToWebGL: false,
      }),
      dispose: () => field?.dispose(),
    };
    window.__marineWebGpu = probe;
    return () => {
      if (window.__marineWebGpu === probe) delete window.__marineWebGpu;
    };
  }, [feature.foam, feature.ibl, feature.optics, feature.planar, feature.shallow, field, identity, route]);

  if (identity && identity.status !== 'ready') {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p data-webgpu-comparison-page="true" data-webgpu-status={identity.status} data-fallback="false">
          这台机器没有可用的 WebGPU 设备，实验不会改用 WebGL。
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-2 text-sm">
        <span
          data-webgpu-comparison-page="true"
          data-api="webgpu"
          data-backend={backend}
          data-scene={scene}
          data-route={route}
          data-fallback="false"
        >
          WebGPU {backend === 'fft' ? 'FFT' : 'Gerstner 控制组'} / {scene}
        </span>
        {computeError ? <span data-webgpu-error={computeError}>{computeError}</span> : null}
      </header>
      <div className="relative flex-1">
        <Canvas
          gl={async (props) => {
            const renderer = new WebGPURenderer({ ...props, antialias: true } as ConstructorParameters<typeof WebGPURenderer>[0]);
            await renderer.init();
            window.__marineWebGpuBackend = (renderer as unknown as { backend?: { constructor?: { name?: string } } }).backend?.constructor?.name ?? 'missing';
            return renderer;
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 40, 180]} fov={55} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[40, 80, 30]} intensity={1.5} />
          <WebGpuOcean backend={backend} scene={scene} onField={setField} onFieldError={setComputeError} />
          <PlanarPass enabled={feature.planar} />
          {field ? <WaterMesh field={field} scene={scene} /> : null}
          <OrbitControls />
        </Canvas>
      </div>
    </main>
  );
}

function PlanarPass({ enabled }: { readonly enabled: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const target = useMemo(() => new THREE.RenderTarget(256, 256), []);
  const rendering = useRef(false);
  useEffect(() => () => target.dispose(), [target]);
  useFrame(() => {
    if (!enabled || rendering.current) return;
    rendering.current = true;
    const mirrorY = camera.position.y;
    camera.position.y = -mirrorY;
    const gpu = gl as unknown as {
      setRenderTarget: (target: THREE.RenderTarget | null) => void;
      render: (scene: THREE.Scene, camera: THREE.Camera) => void;
    };
    gpu.setRenderTarget(target);
    gpu.render(scene, camera);
    gpu.setRenderTarget(null);
    camera.position.y = mirrorY;
    scene.userData.webgpuPlanarTexture = target.texture;
    rendering.current = false;
  });
  return null;
}

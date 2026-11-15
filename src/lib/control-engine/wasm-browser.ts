import { STATIC_HOSTNAME } from '@/lib/browser-delivery/types';
import manifest from './semisub-wave-manifest.json';
import initControlEngine, {
  compute_analysis,
  compute_nonlinear_analysis,
  compute_rl_training,
  compute_simulation_step,
  compute_virtual_simulation_step,
  VesselSimulationSession,
} from '@/resources/control-system/wasm/control_engine/index.js';

import { ControlEngineFailure } from './envelope';

let initPromise: Promise<void> | null = null;
let ready = false;

export function isBrowserControlEngineReady(): boolean {
  return ready;
}

export function preloadBrowserControlEngine(): Promise<void> {
  if (!initPromise) {
    initPromise = initControlEngine()
      .then(() => {
        ready = true;
      })
      .catch((error) => {
        ready = false;
        initPromise = null;
        throw new ControlEngineFailure({
          state: 'unavailable',
          category: 'wasm-init',
          message: error instanceof Error ? error.message : 'Control engine WASM could not initialize.',
          retryable: true,
        });
      });
  }
  return initPromise;
}

export async function ensureBrowserControlEngine(): Promise<void> {
  await preloadBrowserControlEngine();
  if (!ready) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: 'Control engine WASM is not ready.',
      retryable: true,
    });
  }
}

export interface VesselWaveAssets {
  firstOrderMetadata: string;
  firstOrderData: Uint8Array;
  fullDifferenceMetadata?: string;
  fullDifferenceData?: Uint8Array;
}

export interface VesselWaveAsset {
  path: string;
  sha256: string;
  bytes?: number;
}

const prefix = '/model-releases/semisub-981-hydrodynamics/v5.0.0';
const pending = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

export async function fetchVesselWaveAsset(asset: VesselWaveAsset): Promise<Uint8Array<ArrayBuffer>> {
  const urls = [`https://${STATIC_HOSTNAME}${asset.path}`, `/assets${asset.path}`];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      await validateVesselWaveAsset(asset, bytes);
      return bytes;
    } catch {
      // 同一不可变内容可以从应用镜像副本继续读取。
    }
  }
  throw new Error('本实验的波浪数据尚未加载完成，请重试。');
}

export async function validateVesselWaveAsset(asset: VesselWaveAsset, bytes: Uint8Array<ArrayBuffer>) {
  if (asset.bytes !== undefined && bytes.byteLength !== asset.bytes) throw new Error('波浪数据长度不一致。');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
  if (actual !== asset.sha256) throw new Error('波浪数据校验失败，请重新加载。');
}

export async function loadVesselWaveAssets(
  configuration: { vessel?: string; parameterVersion?: string; secondOrderEnabled?: boolean },
  readAsset = fetchVesselWaveAsset,
): Promise<VesselWaveAssets | undefined> {
  if (configuration.vessel !== manifest.vessel || !['research-nominal-v4', manifest.model_version].includes(configuration.parameterVersion ?? '')) return undefined;
  async function read(path: string, sha256: string, bytes?: number) {
    let promise = pending.get(sha256);
    if (!promise) {
      const asset = { path, sha256, bytes };
      promise = readAsset(asset).then(async (value) => {
        await validateVesselWaveAsset(asset, value);
        return value;
      });
      pending.set(sha256, promise);
      void promise.catch(() => pending.delete(sha256));
    }
    return promise;
  }
  const first = manifest.first_order;
  const firstPath = `${prefix}/${first.data_sha256}`;
  const [firstMetadata, firstBytes] = await Promise.all([
    read(`${firstPath}/${first.metadata_file}`, first.metadata_sha256),
    read(`${firstPath}/${first.data_file}`, first.data_sha256, first.data_bytes),
  ]);
  const assets: VesselWaveAssets = { firstOrderMetadata: new TextDecoder().decode(firstMetadata), firstOrderData: firstBytes };
  if (configuration.secondOrderEnabled) {
    const second = manifest.full_difference;
    const secondPath = `${prefix}/${second.data_sha256}`;
    const [metadata, data] = await Promise.all([
      read(`${secondPath}/${second.metadata_file}`, second.metadata_sha256),
      read(`${secondPath}/${second.data_file}`, second.data_sha256, second.data_bytes),
    ]);
    assets.fullDifferenceMetadata = new TextDecoder().decode(metadata);
    assets.fullDifferenceData = data;
  }
  return assets;
}

export function createBrowserVesselSessionBinding(configurationJson: string, assets?: VesselWaveAssets): VesselSimulationSession {
  if (!ready) {
    throw new ControlEngineFailure({
      state: 'unavailable', category: 'wasm-not-ready',
      message: '仿真尚未加载完成。', retryable: true,
    });
  }
  return assets ? VesselSimulationSession.withWaveTables(configurationJson,
    assets.firstOrderMetadata, assets.firstOrderData,
    assets.fullDifferenceMetadata ?? '', assets.fullDifferenceData ?? new Uint8Array())
    : new VesselSimulationSession(configurationJson);
}

export function invokeBrowserWasm(exportName: 'compute_analysis' | 'compute_nonlinear_analysis' | 'compute_rl_training' | 'compute_simulation_step' | 'compute_virtual_simulation_step', requestJson: string): string {
  if (!ready) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: 'Control engine WASM is not ready.',
      retryable: true,
    });
  }
  switch (exportName) {
    case 'compute_analysis':
      return compute_analysis(requestJson);
    case 'compute_nonlinear_analysis':
      return compute_nonlinear_analysis(requestJson);
    case 'compute_rl_training':
      return compute_rl_training(requestJson);
    case 'compute_simulation_step':
      return compute_simulation_step(requestJson);
    case 'compute_virtual_simulation_step':
      return compute_virtual_simulation_step(requestJson);
    default: {
      const exhaustive: never = exportName;
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'missing-export',
        message: `Control engine export is not available: ${String(exhaustive)}`,
        retryable: false,
      });
    }
  }
}

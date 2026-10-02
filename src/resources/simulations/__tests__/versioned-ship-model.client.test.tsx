// @vitest-environment jsdom
import { Suspense, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Group, PerspectiveCamera, Scene } from 'three';
import { useGLTF } from '@react-three/drei';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersionedShipModel } from '../components/versioned-ship-model';
import { initialShipArtifactUrls, type VersionedModelPackageDescriptor } from '../model-packages/types';

const state = vi.hoisted(() => ({
  resources: new Map<string, { value: unknown; promise?: Promise<void>; error?: Error }>(),
  warmups: new Map<string, Promise<void>>(), requested: [] as string[],
  canvas: {} as Record<string, unknown>,
}));
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign((url: string) => {
  state.requested.push(url);
  const resource = state.resources.get(url);
  if (!resource) throw new Error(`Unexpected asset: ${url}`);
  if (resource.error) throw resource.error;
  if (resource.promise) throw resource.promise;
  return resource.value;
}, { clear: vi.fn() }) }));
vi.mock('@react-three/fiber', () => ({ useThree: (select: (s: Record<string, unknown>) => unknown) => select(state.canvas) }));
vi.mock('../model-packages/lod-preparation', async importOriginal => {
  const actual = await importOriginal<typeof import('../model-packages/lod-preparation')>();
  return { ...actual,
    rememberShipLodUrl: vi.fn(),
    resolvePreparedShipLodUrls: vi.fn(async (descriptor: VersionedModelPackageDescriptor, tier: 'low' | 'medium' | 'high') =>
      [descriptor.roles[tier === 'high' ? 'ship-lod0' : tier === 'medium' ? 'ship-lod1' : 'ship-lod2'].url]),
    prepareShipLod: vi.fn(async (_renderer: unknown, model: Group, _camera: unknown, _scene: unknown, active: () => boolean) => {
      await state.warmups.get(model.name); return active();
    }),
  };
});

const descriptor: VersionedModelPackageDescriptor = {
  packageId: 'test-ship', shipId: 'ship', modelVersion: '1.0.0', releaseManifestSha256: 'release',
  sourceBlendSha256: 'source', baseUrl: '/assets/model-releases/test/v1.0.0',
  coordinateBasis: { forward: '+X', up: '+Y' }, basisYawRad: 0,
  interfaceContract: { shipAnimationCount: 0, shipInterfaceAnimations: [], demoAnimations: [],
    vlsLoadedCount: 0, hq10LoadedCount: 0, decalImages: [] },
  roles: Object.fromEntries([0, 1, 2].map(i => [`ship-lod${i}`, {
    role: `ship-lod${i}`, file: `lod${i}.glb`, url: `/assets/model-releases/test/v1.0.0/models/lod${i}.glb`, sha256: String(i), bytes: 10,
  }])) as VersionedModelPackageDescriptor['roles'],
};
const mounts: { root: Root; container: HTMLDivElement }[] = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve };
}
function resource(url: string, pending = false) {
  const scene = new Group(); scene.name = url;
  const gate = deferred();
  const entry = { value: { scene, parser: { json: { animations: [], nodes: [] } } },
    promise: pending ? gate.promise : undefined, error: undefined as Error | undefined };
  state.resources.set(url, entry);
  return { entry, ready: () => { entry.promise = undefined; gate.resolve(); } };
}
function view(tier: 'high' | 'medium' | 'low', modelDescriptor = descriptor) {
  return <Suspense fallback={<span data-scene-loading />}>
    <VersionedShipModel descriptor={modelDescriptor} tier={tier} legacyCandidates={[]}
      renderScene={url => <span data-visible-lod={url} />} />
  </Suspense>;
}
async function mount(tier: 'high' | 'medium' | 'low', modelDescriptor = descriptor) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); mounts.push({ root, container });
  await act(async () => root.render(view(tier, modelDescriptor))); return { root, container };
}
beforeEach(() => {
  vi.mocked(useGLTF.clear).mockReset();
  state.resources.clear(); state.warmups.clear(); state.requested.length = 0;
  state.canvas = { gl: {}, scene: new Scene(), camera: new PerspectiveCamera() };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resource('/assets/model-releases/test/v1.0.0/models/lod2.glb'); resource('/assets/model-releases/test/v1.0.0/models/lod1.glb', true); resource('/assets/model-releases/test/v1.0.0/models/lod0.glb', true);
});
afterEach(async () => {
  for (const { root, container } of mounts.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  vi.restoreAllMocks();
});

describe('progressive versioned ship loading', () => {
  const proxyUrl = descriptor.baseUrl + '/models/ship-proxy.glb';
  const withProxy = { ...descriptor, roles: { ...descriptor.roles, 'ship-proxy': {
    role: 'ship-proxy' as const, file: 'models/ship-proxy.glb', url: proxyUrl, sha256: 'proxy', bytes: 40000,
  } } };
  it('shows an independent proxy while the low LOD downloads, then prepares only the required target', async () => {
    resource(proxyUrl);
    const low = resource(descriptor.roles['ship-lod2'].url, true);
    const { container } = await mount('high', withProxy);
    expect(state.requested[0]).toBe(proxyUrl);
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(proxyUrl);
    expect(state.requested).not.toContain(descriptor.roles['ship-lod0'].url);
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
    await act(async () => low.ready());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(descriptor.roles['ship-lod2'].url);
    expect(state.requested).toContain(descriptor.roles['ship-lod0'].url);
    expect(state.requested).not.toContain(descriptor.roles['ship-lod1'].url);
  });
  it('can upgrade directly from the proxy when the lowest LOD is unavailable', async () => {
    resource(proxyUrl);
    resource(descriptor.roles['ship-lod2'].url).entry.error = new Error('low unavailable');
    const high = resource(descriptor.roles['ship-lod0'].url, true);
    const { container } = await mount('high', withProxy);
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(proxyUrl);
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
    await act(async () => high.ready());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(descriptor.roles['ship-lod0'].url);
  });
  it('falls back to the ordinary low LOD if the proxy is unavailable', async () => {
    resource(proxyUrl).entry.error = new Error('proxy unavailable');
    const { container } = await mount('high', withProxy);
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(descriptor.roles['ship-lod2'].url);
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
  });
  it('uses ESA first only for the configured production Origin', () => {
    const item = withProxy.roles['ship-proxy'];
    expect(initialShipArtifactUrls(item)).toEqual([proxyUrl]);
    vi.stubGlobal('window', { location: { origin: 'https://act.adapt-learn.online' } });
    expect(initialShipArtifactUrls(item)).toEqual(['https://static.adapt-learn.online/model-releases/test/v1.0.0/models/ship-proxy.glb', proxyUrl]);
    vi.unstubAllGlobals();
  });
  it('shows low LOD before requesting the selected high LOD', async () => {
    const { container } = await mount('high');
    expect(state.requested[0]).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
    expect(state.requested).not.toContain('/assets/model-releases/test/v1.0.0/models/lod1.glb');
  });
  it('retains the current ship until the next model and material preparation finish', async () => {
    const high = resource('/assets/model-releases/test/v1.0.0/models/lod0.glb', true), warm = deferred(); state.warmups.set('/assets/model-releases/test/v1.0.0/models/lod0.glb', warm.promise);
    const { container } = await mount('high');
    await act(async () => high.ready());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
    await act(async () => warm.resolve());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod0.glb');
  });
  it('retains the visible ship when the selected model fails', async () => {
    const medium = resource('/assets/model-releases/test/v1.0.0/models/lod1.glb'); medium.entry.error = new Error('network failed');
    const { container } = await mount('medium');
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
  });
  it('ignores an older completed preparation after the requested tier changes', async () => {
    resource('/assets/model-releases/test/v1.0.0/models/lod0.glb'); resource('/assets/model-releases/test/v1.0.0/models/lod1.glb');
    const highWarm = deferred(), mediumWarm = deferred();
    state.warmups.set('/assets/model-releases/test/v1.0.0/models/lod0.glb', highWarm.promise); state.warmups.set('/assets/model-releases/test/v1.0.0/models/lod1.glb', mediumWarm.promise);
    const { root, container } = await mount('high');
    await act(async () => root.render(view('medium')));
    await act(async () => highWarm.resolve());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    await act(async () => mediumWarm.resolve());
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod1.glb');
  });
  it('rejects a replacement with the wrong animation interface before swapping', async () => {
    const high = resource('/assets/model-releases/test/v1.0.0/models/lod0.glb'); high.entry.value.parser.json.animations.push({ name: 'unexpected' } as never);
    const { container } = await mount('high');
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod2.glb');
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
  });
  it('retries a failed initial low candidate on the first later request', async () => {
    const lowUrl = '/assets/model-releases/test/v1.0.0/models/lod2.glb';
    const low = resource(lowUrl); low.entry.error = new Error('initial low request failed');
    resource('/assets/model-releases/test/v1.0.0/models/lod1.glb'); resource('/assets/model-releases/test/v1.0.0/models/lod0.glb');
    vi.mocked(useGLTF.clear).mockImplementation(url => { if (url === lowUrl) low.entry.error = undefined; });
    const { root, container } = await mount('high');
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe('/assets/model-releases/test/v1.0.0/models/lod0.glb');
    await act(async () => root.render(view('low')));
    expect(useGLTF.clear).toHaveBeenCalledWith(lowUrl);
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(lowUrl);
  });
  it('keeps the parsed asset cache when material preparation fails and is retried', async () => {
    const highUrl = '/assets/model-releases/test/v1.0.0/models/lod0.glb'; resource(highUrl);
    let reject!: (error: Error) => void;
    state.warmups.set(highUrl, new Promise<void>((_, fail) => { reject = fail; }));
    const { root, container } = await mount('high');
    await act(async () => reject(new Error('material preparation failed')));
    expect(container.querySelector('[data-scene-loading]')).toBeNull();
    await act(async () => root.render(view('low')));
    state.warmups.delete(highUrl);
    await act(async () => root.render(view('high')));
    expect(useGLTF.clear).not.toHaveBeenCalledWith(highUrl);
    expect(container.querySelector('[data-visible-lod]')?.getAttribute('data-visible-lod')).toBe(highUrl);
  });
});

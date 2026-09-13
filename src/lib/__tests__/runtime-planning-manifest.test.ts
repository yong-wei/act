import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mounted = vi.hoisted(() => vi.fn());
vi.mock('../runtime-active-release', () => ({ readActiveRuntimeReleaseManifest: mounted }));
import { buildRuntimeBlobReleaseManifest } from '../runtime-release';

let root: string;
beforeEach(async () => {
  vi.resetModules();
  mounted.mockReset().mockResolvedValue(null);
  root = await mkdtemp(path.join(os.tmpdir(), 'planning-manifest-'));
  await mkdir(path.join(root, 'act-runtime-dev-gateway'));
  await writeFile(path.join(root, 'act-runtime-dev-gateway/credentials.json'), JSON.stringify({
    schemaVersion: 'act-runtime-dev-gateway-credential.v1', gatewayUrl: 'https://gateway.example', token: 'a'.repeat(32),
  }));
  vi.stubEnv('XDG_CONFIG_HOME', root);
});
afterEach(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

async function setup(tamper = false, drift = false) {
  const content = path.join(root, 'content');
  await mkdir(content);
  await writeFile(path.join(content, 'test.json'), '{}');
  const manifest = await buildRuntimeBlobReleaseManifest(content, { sourceRevision: 'b'.repeat(40) });
  const identity = { schemaVersion: manifest.schemaVersion, releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256, treeSha256: manifest.treeSha256 };
  const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const route = String(url);
    if (route.endsWith('/api/readyz')) return Response.json({ runtime: { identity: {
      ...identity, ...(drift ? { releaseId: 'runtime-other' } : {}),
    } } });
    if (route.endsWith('/v1/leases')) return Response.json({ leaseId: 'lease-a', releaseId: manifest.releaseId, transport: { token: 'transport' } });
    if (route.endsWith('/manifest')) return Response.json(tamper ? { ...manifest, totalBytes: manifest.totalBytes + 1 } : manifest);
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error('Unexpected network request');
  });
  vi.stubGlobal('fetch', fetcher);
  const { readPlanningRuntimeManifest } = await import('../runtime-planning-manifest');
  return { readPlanningRuntimeManifest, manifest, fetcher };
}

it('loads and caches a verified locked manifest without fetching Blob bodies', async () => {
  const { readPlanningRuntimeManifest, manifest, fetcher } = await setup();
  expect(await readPlanningRuntimeManifest(manifest.releaseId)).toEqual(manifest);
  expect(await readPlanningRuntimeManifest(manifest.releaseId)).toEqual(manifest);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('/blobs/'))).toBe(false);
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
});

it('refuses a changed public identity before issuing a lease', async () => {
  const { readPlanningRuntimeManifest, manifest, fetcher } = await setup(false, true);
  await expect(readPlanningRuntimeManifest(manifest.releaseId)).rejects.toThrow('differs from the planning lock');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects modified manifest bytes, releases the lease, and retries failed reads', async () => {
  const { readPlanningRuntimeManifest, manifest, fetcher } = await setup(true);
  await expect(readPlanningRuntimeManifest(manifest.releaseId)).rejects.toThrow();
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
  await expect(readPlanningRuntimeManifest(manifest.releaseId)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(8);
});

it('uses the mounted release when a write-time lock names a predecessor', async () => {
  const { readPlanningRuntimeManifest, manifest, fetcher } = await setup();
  mounted.mockResolvedValue(manifest);
  expect(await readPlanningRuntimeManifest('runtime-other')).toEqual(manifest);
  expect(fetcher).not.toHaveBeenCalled();
});

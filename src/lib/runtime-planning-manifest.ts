import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { readActiveRuntimeReleaseManifest } from './runtime-active-release';
import { parseAnyRuntimeReleaseManifest, type AnyActRuntimeReleaseManifest } from './runtime-release';

const manifests = new Map<string, Promise<AnyActRuntimeReleaseManifest>>();

/** Planning needs the locked inventory, not a local copy of every Blob. */
export async function readPlanningRuntimeManifest(expectedReleaseId?: string | null) {
  const mounted = await readActiveRuntimeReleaseManifest();
  if (mounted || !expectedReleaseId) {
    if (mounted && expectedReleaseId && mounted.releaseId !== expectedReleaseId) {
      throw new Error('Planning Runtime lock differs from the mounted release');
    }
    return mounted;
  }
  const existing = manifests.get(expectedReleaseId);
  if (existing) return existing;
  const promise = readGatewayManifest(expectedReleaseId);
  manifests.set(expectedReleaseId, promise);
  if (manifests.size > 4) manifests.delete(manifests.keys().next().value!);
  try { return await promise; }
  catch (error) {
    if (manifests.get(expectedReleaseId) === promise) manifests.delete(expectedReleaseId);
    throw error;
  }
}

async function readGatewayManifest(expectedReleaseId: string): Promise<AnyActRuntimeReleaseManifest> {
  const config = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'),
    'act-runtime-dev-gateway', 'credentials.json');
  let credential: { schemaVersion?: string; gatewayUrl?: string; token?: string };
  try { credential = JSON.parse(await readFile(config, 'utf8')); }
  catch { throw new Error('Developer Runtime gateway credential is unavailable'); }
  if (credential.schemaVersion !== 'act-runtime-dev-gateway-credential.v1'
    || typeof credential.gatewayUrl !== 'string' || typeof credential.token !== 'string'
    || credential.token.length < 32) throw new Error('Developer Runtime gateway credential is invalid');
  const base = new URL(credential.gatewayUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Developer Runtime gateway URL is invalid');
  }
  const ready = await fetch('https://act.adapt-learn.online/api/readyz', {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!ready.ok) throw new Error('Published Runtime identity is unavailable');
  const identity = (await ready.json()).runtime?.identity;
  if (identity?.schemaVersion !== 'act-runtime-release.v2' || identity.releaseId !== expectedReleaseId
    || !/^[a-f0-9]{64}$/u.test(identity.manifestSha256 ?? '')
    || !/^[a-f0-9]{64}$/u.test(identity.treeSha256 ?? '')) {
    throw new Error('Published Runtime identity differs from the planning lock');
  }
  const request = async (route: string, init: RequestInit = {}) => {
    const response = await fetch(new URL(route, base.href.replace(/\/$/u, '') + '/'), {
      ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${credential.token}`, ...init.headers },
    });
    if (!response.ok) throw new Error(`Developer Runtime manifest request failed (${response.status})`);
    return response;
  };
  const checkoutId = 'manifest-' + createHash('sha256').update(`${process.cwd()}:${process.pid}`).digest('hex').slice(0, 32);
  const lease = await (await request('v1/leases', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, checkoutId }),
  })).json();
  if (typeof lease.leaseId !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(lease.leaseId)) {
    throw new Error('Developer Runtime manifest lease is invalid');
  }
  try {
    if (lease.releaseId !== expectedReleaseId || typeof lease.transport?.token !== 'string') {
      throw new Error('Developer Runtime manifest lease differs from the planning lock');
    }
    const response = await request(`v1/leases/${lease.leaseId}/manifest`, {
      headers: { 'X-Act-Runtime-Lease': lease.leaseId, 'X-Act-Runtime-Transport': lease.transport.token },
    });
    const manifest = parseAnyRuntimeReleaseManifest(await response.json());
    if (manifest.releaseId !== expectedReleaseId || manifest.manifestSha256 !== identity.manifestSha256
      || manifest.treeSha256 !== identity.treeSha256) throw new Error('Developer Runtime manifest identity mismatch');
    return manifest;
  } finally {
    await request(`v1/leases/${lease.leaseId}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

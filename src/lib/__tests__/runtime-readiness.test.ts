import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readActiveRuntimeReleaseManifest } from '../runtime-active-release';
import { projectionDigest } from '../teaching-projection/hash';
import {
  isBlobViewRuntimeRequired,
  projectRuntimeIdentity,
  projectRuntimeReadiness,
} from '../runtime-readiness';
import {
  ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME,
  buildRuntimeBlobReleaseManifest,
  serializeRuntimeBlobReleaseManifest,
} from '../runtime-release';

const roots: string[] = [];

async function blobView(options?: { extraReceiptField?: boolean; mismatch?: boolean }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-readiness-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
  const manifest = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: 'c'.repeat(40) });
  await writeFile(
    path.join(root, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME),
    serializeRuntimeBlobReleaseManifest(manifest),
  );
  const selection = {
    schemaVersion: 'runtime-release-selection.v1',
    generation: 4,
    releaseId: options?.mismatch ? 'runtime-other' : manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
  };
  const receipt: Record<string, unknown> = {
    schemaVersion: 'runtime-release-active-receipt.v1',
    selection,
    healthCheck: 'readyz',
  };
  if (options?.extraReceiptField) receipt.desiredReleaseId = 'runtime-candidate';
  await writeFile(path.join(root, 'act-runtime-active-receipt.json'), JSON.stringify(receipt));
  return { root, manifest };
}

async function writeCoordinatedActiveReceipt(
  root: string,
  manifest: Awaited<ReturnType<typeof buildRuntimeBlobReleaseManifest>>,
  runtimeReleaseId = manifest.releaseId,
) {
  const payload = {
    transactionId: 'tx-runtime-readiness',
    journalHash: 'a'.repeat(64),
    candidateReceiptHash: 'b'.repeat(64),
    committedSelectors: [{ selectorId: 'authority:current', identity: 'snap-r4' }],
    mutationReceiptHashes: ['c'.repeat(64)],
    runtimeActiveReceiptHash: 'd'.repeat(64),
    runtimeActiveIdentity: {
      releaseId: runtimeReleaseId,
      manifestSha256: manifest.manifestSha256,
      treeSha256: manifest.treeSha256,
    },
  };
  const receiptHash = projectionDigest(payload);
  const receipt = {
    contract: 'coordinated-active-receipt/v1',
    receiptId: `act-${receiptHash.slice(0, 24)}`,
    sealedAt: '2030-01-01T00:00:00.000Z',
    ...payload,
    receiptHash,
  };
  const receiptPath = path.join(root, 'coordinated-active-receipt.json');
  await writeFile(receiptPath, JSON.stringify(receipt));
  return receiptPath;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

describe('runtime readiness projector', () => {
  it('keeps ordinary local mode compatible and does not fabricate an identity', async () => {
    expect(isBlobViewRuntimeRequired(undefined)).toBe(false);
    await expect(projectRuntimeReadiness()).resolves.toEqual({
      required: false,
      ready: true,
      identity: null,
    });
  });

  it('projects only the allowlisted active identity when blob-view binding is valid', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    const projection = await projectRuntimeReadiness(root);
    expect(projection).toEqual({
      required: true,
      ready: true,
      identity: {
        schemaVersion: 'act-runtime-release.v2',
        releaseId: manifest.releaseId,
        manifestSha256: manifest.manifestSha256,
        treeSha256: manifest.treeSha256,
      },
    });
    expect(Object.keys(projection.identity ?? {})).toEqual([
      'schemaVersion',
      'releaseId',
      'manifestSha256',
      'treeSha256',
    ]);
    expect(JSON.stringify(projection)).not.toContain('sourceRevision');
    expect(JSON.stringify(projection)).not.toContain('objectKey');
  });

  it('fails closed on receipt mismatch, unknown receipt fields and missing receipt', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const mismatched = await blobView({ mismatch: true });
    await expect(projectRuntimeReadiness(mismatched.root)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
    });

    const extra = await blobView({ extraReceiptField: true });
    await expect(projectRuntimeReadiness(extra.root)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
    });

    const missing = await blobView();
    await rm(path.join(missing.root, 'act-runtime-active-receipt.json'));
    await expect(projectRuntimeReadiness(missing.root)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
    });
  });

  it('does not treat a desired candidate as the active identity', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    await writeFile(path.join(root, 'act-runtime-desired.json'), JSON.stringify({
      releaseId: 'runtime-candidate-should-stay-hidden',
      manifestSha256: 'd'.repeat(64),
    }));
    const projection = await projectRuntimeReadiness(root);
    expect(projection.identity?.releaseId).toBe(manifest.releaseId);
    expect(JSON.stringify(projection)).not.toContain('runtime-candidate-should-stay-hidden');
    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toMatchObject({
      releaseId: manifest.releaseId,
    });
  });

  it('requires a matching sealed coordinated receipt only when coordinated cutover is enabled', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    vi.stubEnv('ACT_COORDINATED_CUTOVER_REQUIRED', 'true');
    const { root, manifest } = await blobView();
    await expect(projectRuntimeReadiness(root, undefined, path.join(root, 'missing.json'))).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
    });
    const matching = await writeCoordinatedActiveReceipt(root, manifest);
    await expect(projectRuntimeReadiness(root, undefined, matching)).resolves.toMatchObject({
      required: true,
      ready: true,
      identity: { releaseId: manifest.releaseId },
    });
    const mismatched = await writeCoordinatedActiveReceipt(root, manifest, 'runtime-foreign');
    await expect(projectRuntimeReadiness(root, undefined, mismatched)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
    });
  });

  it('copies only allowlisted identity fields from the mounted v2 manifest', async () => {
    const { manifest } = await blobView();
    expect(projectRuntimeIdentity(manifest)).toEqual({
      schemaVersion: 'act-runtime-release.v2',
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      treeSha256: manifest.treeSha256,
    });
  });
});

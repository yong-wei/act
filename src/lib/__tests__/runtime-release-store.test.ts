import { Readable } from 'node:stream';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildRuntimeReleaseManifest, computeRuntimeReleaseManifestWireSha256, deriveRuntimeReleaseId, runtimeReleaseManifestObjectKey } from '../runtime-release';
import {
  type RuntimeReleaseObjectStore,
  publishRuntimeRelease,
  RuntimeReleaseStoreError,
  verifyPublishedRuntimeRelease,
} from '../runtime-release-store';

const roots: string[] = [];
const revision = 'c'.repeat(40);

class MemoryStore implements RuntimeReleaseObjectStore {
  readonly objects = new Map<string, Buffer>();
  readonly putCalls: string[] = [];
  readonly putExpectations = new Map<string, { sizeBytes: number; sha256: string; wireSha256?: string }>();
  failAtKey: string | null = null;

  async listObjects(prefix: string) {
    return [...this.objects]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, bytes]) => ({ key, sizeBytes: bytes.byteLength }));
  }

  async putObject(key: string, content: Readable, expectation?: { sizeBytes: number; sha256: string; wireSha256?: string }) {
    this.putCalls.push(key);
    if (expectation) this.putExpectations.set(key, expectation);
    if (this.failAtKey === key) throw new Error('simulated upload failure');
    const chunks: Buffer[] = [];
    for await (const chunk of content) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    this.objects.set(key, Buffer.concat(chunks));
  }

  async getObject(key: string) {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('missing object');
    return Readable.from(bytes);
  }
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-store-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'lesson.json'), '{"id":"1-1"}\n');
  return root;
}

async function contentAddressedManifest(root: string) {
  const draft = await buildRuntimeReleaseManifest(root, { releaseId: 'runtime-plan', sourceRevision: revision });
  return buildRuntimeReleaseManifest(root, {
    releaseId: deriveRuntimeReleaseId(draft.sourceRevision, draft.treeSha256),
    sourceRevision: revision,
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('immutable runtime release publishing', () => {
  it('uploads a release only after local verification and revalidates all remote bytes', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest })).resolves.toMatchObject({
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      wireSha256: computeRuntimeReleaseManifestWireSha256(manifest),
      totalBytes: manifest.totalBytes,
    });
    expect(store.putExpectations.get(runtimeReleaseManifestObjectKey(manifest.releaseId))).toEqual({
      sizeBytes: expect.any(Number),
      sha256: computeRuntimeReleaseManifestWireSha256(manifest),
      wireSha256: computeRuntimeReleaseManifestWireSha256(manifest),
    });
    expect(computeRuntimeReleaseManifestWireSha256(manifest)).not.toBe(manifest.manifestSha256);
    await expect(verifyPublishedRuntimeRelease(store, manifest.releaseId)).resolves.toMatchObject({ treeSha256: manifest.treeSha256 });
  });

  it('never yields a verifiable release after an incomplete upload and rejects unexpected partial objects', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    store.failAtKey = manifest.files[0].objectKey;

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest }))
      .rejects.toMatchObject({ code: 'runtime-release-publish-incomplete' } satisfies Partial<RuntimeReleaseStoreError>);
    await expect(verifyPublishedRuntimeRelease(store, manifest.releaseId))
      .rejects.toMatchObject({ code: 'runtime-release-remote-manifest-missing' } satisfies Partial<RuntimeReleaseStoreError>);

    store.failAtKey = null;
    store.objects.set(`runtime/releases/${manifest.releaseId}/unexpected.txt`, Buffer.from('stale'));
    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest }))
      .rejects.toMatchObject({ code: 'runtime-release-remote-object-set-invalid' } satisfies Partial<RuntimeReleaseStoreError>);
  });

  it('resumes an uncompleted prefix only for exact existing manifest members', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    const firstFile = manifest.files[0];
    store.objects.set(firstFile.objectKey, Buffer.from('{"id":"1-1"}\n'));

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest })).resolves.toMatchObject({ releaseId: manifest.releaseId });
    expect(store.putCalls).toEqual([
      ...manifest.files.slice(1).map((file) => file.objectKey),
      `runtime/releases/${manifest.releaseId}/.act-runtime-release.v1.json`,
    ]);
    expect(store.objects.get(firstFile.objectKey)).toEqual(Buffer.from('{"id":"1-1"}\n'));
  });

  it('rejects a mismatched partial object before writing any missing member', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    const firstFile = manifest.files[0];
    const mismatched = Buffer.alloc(firstFile.sizeBytes, 0);
    store.objects.set(firstFile.objectKey, mismatched);

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest }))
      .rejects.toMatchObject({ code: 'runtime-release-remote-object-invalid' } satisfies Partial<RuntimeReleaseStoreError>);
    expect(store.putCalls).toEqual([]);
    expect(store.objects.has(`runtime/releases/${manifest.releaseId}/.act-runtime-release.v1.json`)).toBe(false);
  });

  it('treats an existing verified manifest as verification-only and performs no writes', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    await publishRuntimeRelease({ store, runtimeRoot: root, manifest });
    store.putCalls.length = 0;

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest })).resolves.toMatchObject({
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
    });
    expect(store.putCalls).toEqual([]);
  });

  it('recovers exactly after a crash while the manifest is still absent', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    const manifestKey = runtimeReleaseManifestObjectKey(manifest.releaseId);
    store.failAtKey = manifestKey;

    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest }))
      .rejects.toMatchObject({ code: 'runtime-release-publish-incomplete' } satisfies Partial<RuntimeReleaseStoreError>);
    expect(store.objects.has(manifestKey)).toBe(false);
    expect(store.putCalls).toEqual([...manifest.files.map((file) => file.objectKey), manifestKey]);

    store.failAtKey = null;
    store.putCalls.length = 0;
    await expect(publishRuntimeRelease({ store, runtimeRoot: root, manifest })).resolves.toMatchObject({ releaseId: manifest.releaseId });
    expect(store.putCalls).toEqual([manifestKey]);
  });

  it('fails closed for unexpected or hash-mismatched remote objects', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const store = new MemoryStore();
    await publishRuntimeRelease({ store, runtimeRoot: root, manifest });

    store.objects.set(`runtime/releases/${manifest.releaseId}/unexpected.txt`, Buffer.from('extra'));
    await expect(verifyPublishedRuntimeRelease(store, manifest.releaseId))
      .rejects.toMatchObject({ code: 'runtime-release-remote-object-set-invalid' } satisfies Partial<RuntimeReleaseStoreError>);
    store.objects.delete(`runtime/releases/${manifest.releaseId}/unexpected.txt`);
    const sameSizeDifferentBytes = Buffer.from(store.objects.get(manifest.files[0].objectKey)!);
    sameSizeDifferentBytes[0] ^= 0xff;
    store.objects.set(manifest.files[0].objectKey, sameSizeDifferentBytes);
    await expect(verifyPublishedRuntimeRelease(store, manifest.releaseId))
      .rejects.toMatchObject({ code: 'runtime-release-remote-object-invalid' } satisfies Partial<RuntimeReleaseStoreError>);
  });

  it('rejects a publisher-selected release id that is not bound to the submitted source identity', async () => {
    const root = await fixture();
    const manifest = await buildRuntimeReleaseManifest(root, { releaseId: 'runtime-manual', sourceRevision: revision });

    await expect(publishRuntimeRelease({ store: new MemoryStore(), runtimeRoot: root, manifest }))
      .rejects.toMatchObject({ code: 'runtime-release-id-not-content-addressed' } satisfies Partial<RuntimeReleaseStoreError>);
  });

  it('derives a distinct immutable prefix for a different source identity', async () => {
    const root = await fixture();
    const initial = await contentAddressedManifest(root);
    await writeFile(path.join(root, 'lessons', '1-1', 'lesson.json'), '{"id":"1-1","revision":2}\n');
    const changed = await contentAddressedManifest(root);

    expect(changed.treeSha256).not.toBe(initial.treeSha256);
    expect(changed.releaseId).not.toBe(initial.releaseId);
  });
});

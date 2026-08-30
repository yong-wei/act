import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readActiveRuntimeReleaseManifest } from '../runtime-active-release';
import { projectionDigest } from '../teaching-projection/hash';
import {
  RUNTIME_CONSUMER_VERIFICATION_FILENAME,
  RUNTIME_DEV_DELIVERY_FILENAME,
  RUNTIME_FILESYSTEM_PROBE_PATH,
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

async function writeConsumerVerification(
  root: string,
  manifest: Awaited<ReturnType<typeof buildRuntimeBlobReleaseManifest>>,
  overrides: Record<string, unknown> = {},
) {
  await mkdir(path.join(root, 'resource-governance'), { recursive: true });
  await writeFile(path.join(root, RUNTIME_FILESYSTEM_PROBE_PATH), JSON.stringify({ version: 'micro-tutoring-resource-projection.v2' }));
  await writeFile(path.join(root, RUNTIME_DEV_DELIVERY_FILENAME), JSON.stringify({
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
  }));
  const receiptPath = path.join(root, RUNTIME_CONSUMER_VERIFICATION_FILENAME);
  await writeFile(receiptPath, JSON.stringify({
    schemaVersion: 'act-runtime-consumer-verification.v1',
    verifierVersion: 'consumer-verification.v1',
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
    consumerUid: process.getuid?.() ?? 0,
    runtimeRoot: root,
    leafCount: 2,
    requiredArtifacts: [{ path: RUNTIME_FILESYSTEM_PROBE_PATH }],
    requiredArtifactSetDigest: 'e'.repeat(64),
    verifiedAt: '2026-08-30T00:00:00Z',
    ...overrides,
  }));
  return receiptPath;
}

async function writeCoordinatedActiveReceipt(
  root: string,
  manifest: Awaited<ReturnType<typeof buildRuntimeBlobReleaseManifest>>,
  authorityCurrentPath: string,
  runtimeReleaseId = manifest.releaseId,
) {
  const authorityIdentity = createHash('sha256').update(await readFile(authorityCurrentPath)).digest('hex');
  const payload = {
    transactionId: 'tx-runtime-readiness',
    journalHash: 'a'.repeat(64),
    candidateReceiptHash: 'b'.repeat(64),
    committedSelectors: [{ selectorId: 'authority:current', identity: authorityIdentity }],
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

async function writeAuthorityCurrent(root: string, snapshotId = 'snap-r4') {
  const authorityRoot = path.join(root, 'authority');
  await mkdir(authorityRoot, { recursive: true });
  const authorityCurrentPath = path.join(authorityRoot, 'current.json');
  await writeFile(authorityCurrentPath, JSON.stringify({
    contract: 'actkg-engineering-authority-current/v1',
    snapshotId,
  }));
  return authorityCurrentPath;
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
      filesystem: { ready: true },
    });
  });

  it('projects only the allowlisted active identity when blob-view binding is valid', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    const verificationReceiptPath = await writeConsumerVerification(root, manifest);
    const projection = await projectRuntimeReadiness(root, undefined, undefined, undefined, verificationReceiptPath);
    expect(projection).toEqual({
      required: true,
      ready: true,
      identity: {
        schemaVersion: 'act-runtime-release.v2',
        releaseId: manifest.releaseId,
        manifestSha256: manifest.manifestSha256,
        treeSha256: manifest.treeSha256,
      },
      filesystem: { ready: true },
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
      filesystem: { ready: false, failureClass: 'manifest-unavailable' },
    });

    const extra = await blobView({ extraReceiptField: true });
    await expect(projectRuntimeReadiness(extra.root)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
      filesystem: { ready: false, failureClass: 'manifest-unavailable' },
    });

    const missing = await blobView();
    await rm(path.join(missing.root, 'act-runtime-active-receipt.json'));
    await expect(projectRuntimeReadiness(missing.root)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
      filesystem: { ready: false, failureClass: 'manifest-unavailable' },
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

  it('requires matching Runtime and Authority identities when coordinated cutover is enabled', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    vi.stubEnv('ACT_COORDINATED_CUTOVER_REQUIRED', 'true');
    const { root, manifest } = await blobView();
    await expect(projectRuntimeReadiness(root, undefined, path.join(root, 'missing.json'))).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
      filesystem: { ready: false, failureClass: 'coordinated-receipt-missing' },
    });
    const authorityCurrentPath = await writeAuthorityCurrent(root);
    const matching = await writeCoordinatedActiveReceipt(root, manifest, authorityCurrentPath);
    const verificationReceiptPath = await writeConsumerVerification(root, manifest);
    await expect(projectRuntimeReadiness(root, undefined, matching, authorityCurrentPath, verificationReceiptPath)).resolves.toMatchObject({
      required: true,
      ready: true,
      identity: { releaseId: manifest.releaseId },
      filesystem: { ready: true },
    });
    await writeFile(authorityCurrentPath, JSON.stringify({
      contract: 'actkg-engineering-authority-current/v1',
      snapshotId: 'snap-foreign',
    }));
    await expect(projectRuntimeReadiness(root, undefined, matching, authorityCurrentPath, verificationReceiptPath)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
      filesystem: { ready: false, failureClass: 'coordinated-receipt-missing' },
    });
    const mismatched = await writeCoordinatedActiveReceipt(root, manifest, authorityCurrentPath, 'runtime-foreign');
    await expect(projectRuntimeReadiness(root, undefined, mismatched, authorityCurrentPath, verificationReceiptPath)).resolves.toEqual({
      required: true,
      ready: false,
      identity: null,
      filesystem: { ready: false, failureClass: 'coordinated-receipt-missing' },
    });
  });

  it('keeps pinned identity while failing closed when consumer filesystem verification degrades', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    const verificationReceiptPath = await writeConsumerVerification(root, manifest);
    const markerPath = path.join(root, RUNTIME_DEV_DELIVERY_FILENAME);
    const readyz = () => projectRuntimeReadiness(
      root, undefined, undefined, undefined, verificationReceiptPath, undefined, undefined, markerPath,
    );

    const healthy = await readyz();
    expect(healthy.ready).toBe(true);
    expect(healthy.filesystem).toEqual({ ready: true });
    expect(healthy.identity?.releaseId).toBe(manifest.releaseId);

    await writeConsumerVerification(root, manifest, { consumerUid: (process.getuid?.() ?? 0) + 137 });
    const drifted = await readyz();
    expect(drifted.ready).toBe(false);
    expect(drifted.filesystem).toEqual({ ready: false, failureClass: 'consumer-identity-mismatch' });
    expect(drifted.identity?.releaseId).toBe(manifest.releaseId);

    await writeConsumerVerification(root, manifest, { releaseId: 'runtime-foreign' });
    const foreign = await readyz();
    expect(foreign.filesystem).toEqual({ ready: false, failureClass: 'consumer-verification-identity-drift' });
    expect(foreign.identity?.releaseId).toBe(manifest.releaseId);

    await rm(path.join(root, RUNTIME_FILESYSTEM_PROBE_PATH));
    await writeFile(verificationReceiptPath, JSON.stringify({
      schemaVersion: 'act-runtime-consumer-verification.v1',
      verifierVersion: 'consumer-verification.v1',
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      treeSha256: manifest.treeSha256,
      consumerUid: process.getuid?.() ?? 0,
      runtimeRoot: root,
      leafCount: 2,
      requiredArtifactSetDigest: 'e'.repeat(64),
      verifiedAt: '2026-08-30T00:00:00Z',
    }));
    const unreadable = await readyz();
    expect(unreadable.filesystem).toEqual({ ready: false, failureClass: 'required-artifact-unreadable' });

    // 服务运行中回执被清理（复用门禁失败）：dev-delivery 标志仍在 → readyz 必须 fail-closed。
    await rm(verificationReceiptPath);
    const missing = await readyz();
    expect(missing.filesystem).toEqual({ ready: false, failureClass: 'consumer-verification-missing' });
    expect(missing.identity?.releaseId).toBe(manifest.releaseId);
    expect(missing.ready).toBe(false);

    // 无 Developer 标志 = 生产形态：回执缺失不参与判定，保持生产既有语义。
    await rm(markerPath);
    await writeConsumerVerification(root, manifest);
    const withoutMarker = await projectRuntimeReadiness(
      root, undefined, undefined, undefined, verificationReceiptPath, undefined, undefined, markerPath,
    );
    expect(withoutMarker.filesystem).toEqual({ ready: true });
    expect(withoutMarker.ready).toBe(true);
  });

  it('probes every required artifact registered in the receipt, not just the projection', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    const verificationReceiptPath = await writeConsumerVerification(root, manifest);
    const markerPath = path.join(root, RUNTIME_DEV_DELIVERY_FILENAME);
    const registry = JSON.stringify({
      schemaVersion: 'act-runtime-requirements.v1',
      capabilities: { 'micro-tutoring-v2': { artifacts: [
        { path: RUNTIME_FILESYSTEM_PROBE_PATH },
        { path: 'resource-governance/micro-tutoring-validation-registry-v2.json' },
      ] } },
    });
    await writeFile(verificationReceiptPath, JSON.stringify({
      schemaVersion: 'act-runtime-consumer-verification.v1',
      verifierVersion: 'consumer-verification.v1',
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      treeSha256: manifest.treeSha256,
      consumerUid: process.getuid?.() ?? 0,
      runtimeRoot: root,
      leafCount: 3,
      requiredArtifacts: [
        { path: RUNTIME_FILESYSTEM_PROBE_PATH },
        { path: 'resource-governance/micro-tutoring-validation-registry-v2.json' },
      ],
      requiredArtifactSetDigest: 'e'.repeat(64),
      verifiedAt: '2026-08-30T00:00:00Z',
    }));
    const projection = await projectRuntimeReadiness(
      root, undefined, undefined, undefined, verificationReceiptPath, undefined, undefined, markerPath,
    );
    expect(projection.filesystem).toEqual({ ready: false, failureClass: 'required-artifact-unreadable' });

    await mkdir(path.join(root, 'resource-governance'), { recursive: true });
    await writeFile(
      path.join(root, 'resource-governance', 'micro-tutoring-validation-registry-v2.json'),
      JSON.stringify({ version: 'micro-tutoring-validation-registry.v2' }),
    );
    const healthy = await projectRuntimeReadiness(
      root, undefined, undefined, undefined, verificationReceiptPath, undefined, undefined, markerPath,
    );
    expect(healthy.filesystem).toEqual({ ready: true });
  });

  it('rejects consumer receipts with invalid schema or fields', async () => {
    vi.stubEnv('RUNTIME_DELIVERY_MODE', 'ossfs-blob-view');
    const { root, manifest } = await blobView();
    const markerPath = path.join(root, RUNTIME_DEV_DELIVERY_FILENAME);
    const receiptPath = await writeConsumerVerification(root, manifest, { schemaVersion: 'unknown-schema' });
    const projection = await projectRuntimeReadiness(root, undefined, undefined, undefined, receiptPath, undefined, undefined, markerPath);
    expect(projection.filesystem).toEqual({ ready: false, failureClass: 'consumer-verification-invalid' });

    await writeConsumerVerification(root, manifest, { runtimeRoot: '/somewhere/else' });
    const misplaced = await projectRuntimeReadiness(root, undefined, undefined, undefined, receiptPath, undefined, undefined, markerPath);
    expect(misplaced.filesystem).toEqual({ ready: false, failureClass: 'consumer-verification-invalid' });
  });

  it('keeps the readyz probe path aligned with the python requirement registry', async () => {
    const { readFile: readFileSync } = await import('node:fs/promises');
    const registryPath = path.join(process.cwd(), 'scripts', 'runtime-release', 'developer-oss', 'runtime_requirements.json');
    const registry = JSON.parse(await readFileSync(registryPath, 'utf8')) as {
      capabilities: Record<string, { artifacts: { path: string }[] }>;
    };
    const registered = Object.values(registry.capabilities)
      .flatMap((capability) => capability.artifacts.map((artifact) => artifact.path));
    for (const required of [
      'resource-governance/micro-tutoring-assessment-baseline-v2.json',
      'resource-governance/micro-tutoring-option-attributions-v2.json',
      RUNTIME_FILESYSTEM_PROBE_PATH,
      'resource-governance/micro-tutoring-validation-registry-v2.json',
    ]) {
      expect(registered).toContain(required);
    }
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

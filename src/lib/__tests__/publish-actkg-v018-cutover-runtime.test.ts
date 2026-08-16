import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  prepareActKgV018RuntimeRelease,
  resolveActKgV018RuntimeReleaseArgs,
} from '../../../scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime';
import { projectionDigest, projectionSha256 } from '../teaching-projection/hash';
import {
  expectedHostPointerHashes,
  V018_FROZEN_IMAGE_TAG,
  V018_HOST_SHADOW_CONTRACT,
  V018_STAGED_AUTHORITY_RECEIPT_SHA256,
  V018_STAGED_QUALIFICATION_SHA256,
  type HostShadowObservation,
} from '../teaching-projection/publish/v018-host-shadow';
import {
  DOCKER_MIN_MEMORY_BYTES,
  V018_SEALED_QUALIFICATION_SHA256,
  publishActKgV018CutoverRuntime,
} from '../teaching-projection/publish/v018-runtime-release';
import {
  assertV018ProductionPointersUnchanged,
  snapshotCurrentPointers,
} from '../teaching-projection/qualify/v018-qualify';

const roots: string[] = [];
const REPO_ROOT = path.resolve(__dirname, '../../..');
const HOST_HASHES = expectedHostPointerHashes();
const SHARD_PATH = 'course-content/runtime/knowledge/authority-domain-shards/current.json';

function readyHostObservation(overrides: Partial<HostShadowObservation> = {}): HostShadowObservation {
  return {
    appImage: V018_FROZEN_IMAGE_TAG,
    workerImage: V018_FROZEN_IMAGE_TAG,
    workerHealth: 'healthy',
    readyz: { app: true, db: true, redis: true },
    publicReadyzStatus: 200,
    authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
    authoritySnapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    authoritySha256: '868c233461d89c6ae1267eca50e80383ef94e36cc769d91cf14532bf8d37af0d',
    projectionId: 'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d',
    projectionSha256: 'cf553630400a297d678a2927940e011e300e756aa59cd46bccac8489dd6ac703',
    prerequisitePublicationId: 'proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b',
    prerequisiteSha256: 'a040258e8efef848de45b7b933e0231519d416bd0d9b7c8a3ebb433abb1e6e0e',
    activationId: 'first-cutover-7f4cdd1084af-769b1a832622',
    activationSha256: 'e73ac1abd0d691c615308b215f1941ca5bea9b125cb98b844a0b5d969c6fbc0b',
    shardSha256: '9613304cbaee9c3e41908f1a73a0a76b886608638ec992c7ad074e656711783c',
    stagedAuthorityReceiptSha256: V018_STAGED_AUTHORITY_RECEIPT_SHA256,
    stagedAuthorityMountedSha256: V018_STAGED_AUTHORITY_RECEIPT_SHA256,
    stagedQualificationSha256: V018_STAGED_QUALIFICATION_SHA256,
    activeGraphReleaseId: 'ctr:release:control-theory-engineering-v0.9',
    activeGraphSnapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    pointersUnchangedAfterStage: true,
    consumerShadowSource: 'deployed-image-staged-candidate',
    consumerStatuses: [
      { consumerId: 'course-runtime', status: 'READY' },
      { consumerId: 'engineering-graph', status: 'READY' },
      { consumerId: 'engineering-rag', status: 'READY' },
      { consumerId: 'konling', status: 'READY' },
      { consumerId: 'learning-path', status: 'READY' },
      { consumerId: 'teaching-resource-rag', status: 'READY' },
    ],
    ...overrides,
  };
}

function writeHostReport(outputRoot: string, report: Record<string, unknown>): string {
  const filePath = path.join(outputRoot, 'host-shadow-verification.json');
  writeFileSync(filePath, `${JSON.stringify(report)}\n`);
  return filePath;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('v0.18 runtime publication', () => {
  it('keeps production selectors on v0.9 after a READY sealed qualification', async () => {
    const sealedBytes = readFileSync(path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
    ));
    expect(projectionSha256(sealedBytes)).toBe(V018_SEALED_QUALIFICATION_SHA256);
    const before = snapshotCurrentPointers(REPO_ROOT);
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-'));
    roots.push(outputRoot);
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.imageBuilt).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('provenance-missing');
    expect(result.blockers).toContain('host-shadow-verification-incomplete');
    expect(result.blockers).not.toContain('qualification-not-ready');
    expect(existsSync(path.join(outputRoot, 'runtime-release-receipt.json'))).toBe(true);
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'runtime-release-receipt.json'), 'utf8')) as {
      productionCutoverAuthorized: boolean;
      selectorConsumption: boolean;
      imageBuilt: boolean;
      applicationRevision: string;
      qualificationStatus: string;
    };
    expect(report.productionCutoverAuthorized).toBe(false);
    expect(report.selectorConsumption).toBe(false);
    expect(report.imageBuilt).toBe(false);
    expect(report.qualificationStatus).toBe('READY');
    expect(report.applicationRevision).toMatch(/^[0-9a-f]{40}$/);
    const after = snapshotCurrentPointers(REPO_ROOT);
    expect(() => assertV018ProductionPointersUnchanged(before, after)).not.toThrow();
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
  });

  it('rejects a frozen application revision that is not an ancestor of HEAD', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-frozen-'));
    roots.push(outputRoot);
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      frozenApplicationRevision: '0'.repeat(40),
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('frozen-application-revision-not-ancestor');
    expect(result.imageBuilt).toBe(false);
  });

  it('keeps the receipt BLOCKED until host shadow verification is READY', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-host-'));
    roots.push(outputRoot);
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:v018-94d585ae63a6',
        provenancePath: path.join(outputRoot, 'missing-provenance.json'),
        imageTarPath: path.join(outputRoot, 'missing-image.tar'),
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-shadow-verification-incomplete');
    expect(result.blockers).not.toContain('qualification-not-ready');
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'runtime-release-receipt.json'), 'utf8')) as {
      status: string;
      nextAction: string;
      hostVerification?: { status: string; blockers: string[] };
    };
    expect(report.status).toBe('BLOCKED');
    expect(report.nextAction).toBe('blocked');
    expect(report.hostVerification?.status).toBe('BLOCKED');
    expect(report.hostVerification?.blockers).toContain('host-shadow-verification-incomplete');
  });

  it('records concrete host-shadow blockers from the sealed report file', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-host-blockers-'));
    roots.push(outputRoot);
    const fourHashes = { ...HOST_HASHES };
    delete fourHashes[SHARD_PATH];
    writeHostReport(outputRoot, {
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'BLOCKED',
      blockers: ['host-v09-shard-selector-missing'],
      observation: readyHostObservation({
        shardSha256: undefined,
        pointersUnchangedAfterStage: false,
      }),
      pointerHashes: fourHashes,
    });
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-v09-shard-selector-missing');
    expect(result.blockers).toContain('host-pointer-hashes-incomplete');
    expect(result.blockers).not.toContain('host-shadow-verification-incomplete');
  });

  it('seals host-observed pointer hashes instead of the local worktree constants', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-host-hashes-'));
    roots.push(outputRoot);
    const fourHashes = { ...HOST_HASHES };
    delete fourHashes[SHARD_PATH];
    writeHostReport(outputRoot, {
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'BLOCKED',
      blockers: ['host-v09-shard-selector-missing'],
      observation: readyHostObservation({
        shardSha256: undefined,
        pointersUnchangedAfterStage: false,
      }),
      pointerHashes: fourHashes,
    });
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'runtime-release-receipt.json'), 'utf8')) as {
      pointerHashes: Record<string, string>;
    };
    expect(result.blockers).toContain('host-pointer-hashes-incomplete');
    expect(report.pointerHashes['course-content/authoring/knowledge/authority/current.json']).toBe(
      '868c233461d89c6ae1267eca50e80383ef94e36cc769d91cf14532bf8d37af0d',
    );
    expect(report.pointerHashes['course-content/authoring/knowledge/authority/current.json']).not.toBe(
      '086f14793fbf2aa3afc8fba471503042242645122425c3018b6526e8ab2835f2',
    );
  });

  it('does not treat an injectable READY object as host-shadow evidence', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-injected-ready-'));
    roots.push(outputRoot);
    const sneaky = {
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      hostVerification: {
        status: 'READY' as const,
        blockers: [] as string[],
        pointerHashes: HOST_HASHES,
      },
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    };
    const result = await publishActKgV018CutoverRuntime(
      sneaky as unknown as Parameters<typeof publishActKgV018CutoverRuntime>[0],
    );
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-shadow-verification-incomplete');
  });

  it('does not treat a forged READY host report with drifted hashes as complete', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-forged-ready-'));
    roots.push(outputRoot);
    const drifted = Object.fromEntries(Object.keys(HOST_HASHES).map((key) => [key, '0'.repeat(64)]));
    writeHostReport(outputRoot, {
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'READY',
      blockers: [],
      observation: readyHostObservation({
        authoritySha256: '0'.repeat(64),
        projectionSha256: '0'.repeat(64),
        prerequisiteSha256: '0'.repeat(64),
        activationSha256: '0'.repeat(64),
        shardSha256: '0'.repeat(64),
      }),
      pointerHashes: drifted,
    });
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-pointer-hash-mismatch');
    expect(result.blockers).not.toContain('host-shadow-verification-incomplete');
  });

  it('does not accept a READY report whose overlay hash drifted', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-overlay-'));
    roots.push(outputRoot);
    const driftedPath = path.join(outputRoot, 'qualification-readiness.json');
    const original = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
    ), 'utf8')) as Record<string, unknown>;
    const hashes = {
      ...(original.inputHashes as Record<string, unknown>),
      reviewedNeighborhoodOverlay: '0'.repeat(64),
    };
    const { receiptDigest: _ignored, ...rest } = original;
    const rewritten = { ...rest, inputHashes: hashes };
    writeFileSync(driftedPath, `${JSON.stringify({ ...rewritten, receiptDigest: projectionDigest(rewritten) })}\n`);
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      qualificationReport: driftedPath,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:test',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.imageBuilt).toBe(false);
    expect(result.blockers).toContain('qualification-overlay-hash-drift');
    expect(result.blockers).toContain('qualification-file-hash-drift');
  });

  it('does not treat a mutated READY report with a stale digest as qualified', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-digest-'));
    roots.push(outputRoot);
    const mutatedPath = path.join(outputRoot, 'qualification-readiness.json');
    const original = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
    ), 'utf8')) as Record<string, unknown>;
    original.status = 'READY';
    original.captureRevision = '0'.repeat(40);
    writeFileSync(mutatedPath, `${JSON.stringify(original)}\n`);
    let built = false;
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      qualificationReport: mutatedPath,
      runBuild: async () => {
        built = true;
        return { imageTag: 'should-not-build', provenancePath: null, imageTarPath: null };
      },
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
    });
    expect(built).toBe(false);
    expect(result.blockers).toContain('qualification-digest-drift');
    expect(result.blockers).toContain('qualification-file-hash-drift');
    expect(result.imageBuilt).toBe(false);
  });

  it('does not accept a rewritten READY qualification as a build input', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-rewrite-'));
    roots.push(outputRoot);
    const readyPath = path.join(outputRoot, 'qualification-readiness.json');
    const original = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
    ), 'utf8')) as Record<string, unknown>;
    original.status = 'READY';
    original.blockers = [];
    const { receiptDigest: _ignored, ...rest } = original;
    const rewritten = { ...rest, nextAction: 'rewritten-for-hash-drift' };
    writeFileSync(readyPath, `${JSON.stringify({ ...rewritten, receiptDigest: projectionDigest(rewritten) })}\n`);
    let built = false;
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      qualificationReport: readyPath,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => {
        built = true;
        return {
          imageTag: 'localhost/act-obe-platform:test',
          provenancePath: path.join(outputRoot, 'missing-provenance.json'),
          imageTarPath: path.join(outputRoot, 'missing-image.tar'),
        };
      },
    });
    expect(built).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('qualification-file-hash-drift');
    expect(result.imageBuilt).toBe(false);
  });

  it('fails closed when Docker VM memory is below 20 GiB', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-mem-'));
    roots.push(outputRoot);
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES - 1,
      runBuild: async () => {
        throw new Error('build must not run below the Docker memory gate');
      },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('docker-memory-below-20gib');
    expect(result.imageBuilt).toBe(false);
  });

  it('refuses to write a runtime release onto a selector path', async () => {
    await expect(prepareActKgV018RuntimeRelease([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      path.join(REPO_ROOT, 'course-content/runtime/knowledge/projection'),
    ])).rejects.toThrow('runtime selector');
  });

  it('official CLI binds host-shadow-verification.json by default', () => {
    const resolved = resolveActKgV018RuntimeReleaseArgs(['--repo-root', REPO_ROOT]);
    expect(resolved.hostVerificationReport.split(path.sep).join('/')).toMatch(
      /course-content\/authoring\/knowledge\/cutover\/runtime-releases\/control-theory-engineering-v0\.18\/host-shadow-verification\.json$/,
    );
    expect(resolved.imageTag).toBe(V018_FROZEN_IMAGE_TAG);
    expect(resolved.frozenApplicationRevision).toBe('94d585ae63a6f1839ce611c7f8a1271df945933f');
    const override = resolveActKgV018RuntimeReleaseArgs([
      '--repo-root',
      REPO_ROOT,
      '--host-verification-report',
      '/tmp/custom-host-shadow.json',
    ]);
    expect(override.hostVerificationReport).toBe('/tmp/custom-host-shadow.json');
  });

  it('fails closed when a host report is BLOCKED even if its blocker list is empty', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-empty-blocked-'));
    roots.push(outputRoot);
    writeHostReport(outputRoot, {
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'BLOCKED',
      blockers: [],
      observation: readyHostObservation(),
      pointerHashes: HOST_HASHES,
    });
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      imageTag: V018_FROZEN_IMAGE_TAG,
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: V018_FROZEN_IMAGE_TAG,
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-shadow-not-ready');
    const report = JSON.parse(readFileSync(path.join(outputRoot, 'runtime-release-receipt.json'), 'utf8')) as {
      status: string;
      nextAction: string;
      hostVerification?: { status: string };
    };
    expect(report.status).toBe('BLOCKED');
    expect(report.nextAction).toBe('blocked');
    expect(report.hostVerification?.status).toBe('BLOCKED');
  });

  it('fails closed when host observation is not this build image', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-publish-other-image-'));
    roots.push(outputRoot);
    writeHostReport(outputRoot, {
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'READY',
      blockers: [],
      observation: readyHostObservation(),
      pointerHashes: HOST_HASHES,
    });
    const result = await publishActKgV018CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      imageTag: 'localhost/act-obe-platform:v018-deadbeefdead',
      readDockerMemory: () => DOCKER_MIN_MEMORY_BYTES + 1,
      runBuild: async () => ({
        imageTag: 'localhost/act-obe-platform:v018-deadbeefdead',
        provenancePath: null,
        imageTarPath: null,
      }),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-app-image-not-this-build');
    expect(result.blockers).toContain('host-worker-image-not-this-build');
  });
});

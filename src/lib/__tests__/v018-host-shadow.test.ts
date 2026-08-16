import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateV018HostShadow,
  expectedHostPointerHashes,
  hostPointerHashesFromObservation,
  loadHostShadowVerificationReport,
  V018_FROZEN_IMAGE_TAG,
  V018_HOST_SHADOW_CONTRACT,
  V018_STAGED_AUTHORITY_RECEIPT_SHA256,
  V018_STAGED_QUALIFICATION_SHA256,
} from '../teaching-projection/publish/v018-host-shadow';

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length > 0) rmSync(tmpRoots.pop()!, { recursive: true, force: true });
});

const readyObservation = {
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
  consumerShadowSource: 'deployed-image-staged-candidate' as const,
  consumerStatuses: [
    { consumerId: 'course-runtime', status: 'READY' },
    { consumerId: 'engineering-graph', status: 'READY' },
    { consumerId: 'engineering-rag', status: 'READY' },
    { consumerId: 'konling', status: 'READY' },
    { consumerId: 'learning-path', status: 'READY' },
    { consumerId: 'teaching-resource-rag', status: 'READY' },
  ],
};

describe('v0.18 host shadow evaluation', () => {
  it('is READY only when production stays on v0.9 and the staged candidate matches', () => {
    expect(evaluateV018HostShadow(readyObservation)).toEqual({ status: 'READY', blockers: [] });
  });

  it('omits a missing shard hash from the sealed host pointer set', () => {
    const hashes = hostPointerHashesFromObservation({
      ...readyObservation,
      shardSha256: undefined,
    });
    expect(hashes['course-content/authoring/knowledge/authority/current.json']).toBe(
      '868c233461d89c6ae1267eca50e80383ef94e36cc769d91cf14532bf8d37af0d',
    );
    expect(hashes['course-content/runtime/knowledge/authority-domain-shards/current.json']).toBeUndefined();
  });

  it('fails closed when consumer results are copied from local qualification', () => {
    const result = evaluateV018HostShadow({
      ...readyObservation,
      consumerShadowSource: 'local-qualification',
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-v018-shadow-not-executed-on-deployed-image');
  });

  it('fails closed when the production shard selector is missing', () => {
    const result = evaluateV018HostShadow({
      ...readyObservation,
      shardSha256: undefined,
      pointersUnchangedAfterStage: false,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-v09-shard-selector-missing');
  });

  it('fails closed when staged Authority is not the tree the sidecar read', () => {
    const result = evaluateV018HostShadow({
      ...readyObservation,
      stagedAuthorityMountedSha256: '0'.repeat(64),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-v018-authority-not-mounted-in-sidecar');
  });

  it('fails closed when the active graph is not the frozen v0.9 snapshot', () => {
    const result = evaluateV018HostShadow({
      ...readyObservation,
      activeGraphReleaseId: 'ctr:release:control-theory-engineering-v0.18',
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-active-graph-not-v09');
  });

  it('loads a missing host-shadow report as incomplete', () => {
    const result = loadHostShadowVerificationReport(path.join(tmpdir(), 'missing-host-shadow.json'));
    expect(result).toEqual({
      digest: null,
      status: 'BLOCKED',
      blockers: ['host-shadow-verification-incomplete'],
      pointerHashes: {},
      observedAppImage: null,
      observedWorkerImage: null,
    });
  });

  it('requires observation and frozen predecessor hashes before READY', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-host-report-'));
    tmpRoots.push(outputRoot);
    const readyPath = path.join(outputRoot, 'ready.json');
    writeFileSync(readyPath, `${JSON.stringify({
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'READY',
      blockers: [],
      observation: readyObservation,
      pointerHashes: expectedHostPointerHashes(),
    })}\n`);
    expect(loadHostShadowVerificationReport(readyPath).status).toBe('READY');

    const missingObservation = path.join(outputRoot, 'no-observation.json');
    writeFileSync(missingObservation, `${JSON.stringify({
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'READY',
      blockers: [],
      pointerHashes: expectedHostPointerHashes(),
    })}\n`);
    const missing = loadHostShadowVerificationReport(missingObservation);
    expect(missing.status).toBe('BLOCKED');
    expect(missing.blockers).toContain('host-shadow-observation-missing');

    const driftedPath = path.join(outputRoot, 'drifted.json');
    writeFileSync(driftedPath, `${JSON.stringify({
      contract: V018_HOST_SHADOW_CONTRACT,
      status: 'READY',
      blockers: [],
      observation: readyObservation,
      pointerHashes: Object.fromEntries(
        Object.keys(expectedHostPointerHashes()).map((key) => [key, '0'.repeat(64)]),
      ),
    })}\n`);
    const drifted = loadHostShadowVerificationReport(driftedPath);
    expect(drifted.status).toBe('BLOCKED');
    expect(drifted.blockers).toContain('host-pointer-hash-mismatch');
  });
});

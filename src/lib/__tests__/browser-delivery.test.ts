import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_BUCKET,
  COHORT_ID,
  DELIVERY_BUCKET,
  SIMULATION_MODEL_IDS,
  buildManifest,
  createMemoryObjectStore,
  objectKeyFor,
  planPublication,
  publicationVerified,
  publishCohort,
  qualifyRouting,
  rejectForbiddenAsset,
  rejectPublicationTarget,
  resolveRegisteredSimulationModel,
  resolveSimulationModel,
} from '../browser-delivery';
import { optimizerConfigDigest } from '../browser-delivery/manifest';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const CONFIG = 'd'.repeat(64);
const OUTPUT_BYTES = new Uint8Array(8).fill(7);
const DIGEST = createHash('sha256').update(OUTPUT_BYTES).digest('hex');

function sources(output: boolean) {
  return Object.fromEntries(SIMULATION_MODEL_IDS.map((logicalId) => [logicalId, {
    sourceGitBlob: TREE,
    sourceSha256: DIGEST,
    sourceBytes: 12,
    outputSha256: output ? DIGEST : null,
    outputBytes: output ? 8 : null,
  }])) as Parameters<typeof buildManifest>[0]['sources'];
}

function manifest(output = true, dirty = false) {
  return buildManifest({
    sourceCommit: COMMIT,
    sourceTree: TREE,
    dirty,
    mixedWorktree: false,
    capturedAt: '2026-08-27T00:00:00.000Z',
    optimizer: { name: '@act/glb-model-optimizer', version: '1.0.0', configDigest: CONFIG },
    sources: sources(output),
  });
}

describe('content-addressed browser delivery', () => {
  it('closes the seven-model denominator and rejects Authority targets', () => {
    const built = manifest();
    expect(built.cohortId).toBe(COHORT_ID);
    expect(built.includedCount).toBe(7);
    expect(built.excludedCount).toBe(0);
    expect(built.entries).toHaveLength(7);
    expect(built.entries[0]?.objectKey).toBe(objectKeyFor(DIGEST, 'destroyer.glb'));
    expect(rejectPublicationTarget(AUTHORITY_BUCKET, 'assets/x/destroyer.glb', 'model/gltf-binary')).toBe('origin-authority-bucket');
    expect(rejectForbiddenAsset('lesson.mp4')).toBe('non-glb-type');
    expect(rejectForbiddenAsset('runtime/blobs/sha256/aa')).toBe('authority-prefix');
    expect(optimizerConfigDigest('script')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('publishes a complete cohort through an append-only store and refuses overwrite', () => {
    const built = manifest();
    const store = createMemoryObjectStore();
    const bodies = Object.fromEntries(SIMULATION_MODEL_IDS.map((id) => [id, OUTPUT_BYTES]));
    const first = publishCohort(built, bodies, store);
    expect(first.applied).toBe(true);
    expect(publicationVerified(first)).toBe(true);
    const mismatch = new Uint8Array(8).fill(9);
    const second = publishCohort(built, { ...bodies, destroyer: mismatch }, store);
    expect(second.applied).toBe(false);
    expect(second.blockingReasons.join(',')).toContain('body-mismatch:destroyer');
  });

  it('plans append-only Delivery objects without applying them', () => {
    const planned = planPublication(manifest());
    expect(planned.bucket).toBe(DELIVERY_BUCKET);
    expect(planned.applied).toBe(false);
    expect(planned.objects).toHaveLength(7);
    expect(publicationVerified(planned)).toBe(false);
    expect(planPublication(manifest(false)).missing.join(',')).toContain('excluded:destroyer');
  });

  it('keeps ESA-first URLs off until PoC, traffic, and publication all qualify', () => {
    const built = manifest();
    const incomplete = qualifyRouting({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      capturedAt: '2026-08-27T00:00:00.000Z',
      dirty: false,
      mixedWorktree: false,
      manifest: built,
      publication: planPublication(built),
    });
    expect(incomplete.status).toBe('incomplete');
    expect(incomplete.esaFirst).toBe(false);
    expect(resolveSimulationModel('destroyer', built, incomplete).esaUrl).toBeNull();
    expect(resolveSimulationModel('destroyer', built, incomplete).candidates[0]).toBe('/assets/models-opt/destroyer.glb');
    const bodies = Object.fromEntries(SIMULATION_MODEL_IDS.map((id) => [id, OUTPUT_BYTES]));
    const published = publishCohort(built, bodies, createMemoryObjectStore());
    expect(publicationVerified(published)).toBe(true);
    expect(qualifyRouting({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      capturedAt: '2026-08-27T00:00:00.000Z',
      dirty: false,
      mixedWorktree: false,
      manifest: built,
      publication: published,
      esaReceipt: { status: 'qualified' },
      trafficReceipt: { status: 'qualified' },
    }).blockingReasons).toEqual(expect.arrayContaining(['esa-receipt-invalid', 'traffic-receipt-invalid']));
    const qualified = qualifyRouting({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      capturedAt: '2026-08-27T00:00:00.000Z',
      dirty: false,
      mixedWorktree: false,
      manifest: built,
      publication: published,
      esaReceipt: {
        schemaVersion: 'act-esa-delivery-qualification/v1',
        status: 'qualified',
        hostname: 'static.adapt-learn.online',
        deliveryBucket: DELIVERY_BUCKET,
        dnsApplied: true,
        evidenceFingerprint: DIGEST,
        qualificationId: DIGEST,
        sourceCommit: COMMIT,
        sourceTree: TREE,
        dirty: false,
        mixedWorktree: false,
      },
      trafficReceipt: {
        schemaVersion: 'act-runtime-traffic-observation/v1',
        status: 'qualified',
        observationId: DIGEST,
        sourceCommit: COMMIT,
        sourceTree: TREE,
        dirty: false,
        mixedWorktree: false,
      },
    });
    expect(qualified.status).toBe('qualified');
    expect(resolveSimulationModel('destroyer', built, qualified).candidates[0]).toContain('static.adapt-learn.online');
    expect(resolveRegisteredSimulationModel('destroyer').esaUrl).toBeNull();
  });

  it('blocks dirty captures and does not treat local plans as published', () => {
    const dirty = manifest(true, true);
    expect(dirty.includedCount).toBe(0);
    expect(qualifyRouting({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      capturedAt: '2026-08-27T00:00:00.000Z',
      dirty: true,
      mixedWorktree: false,
      manifest: dirty,
      publication: planPublication(dirty),
    }).status).toBe('blocked');
  });
});

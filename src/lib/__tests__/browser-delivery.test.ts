import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_BUCKET,
  COHORT_ID,
  DELIVERY_BUCKET,
  SIMULATION_MODEL_IDS,
  buildManifest,
  objectKeyFor,
  planPublication,
  publicationVerified,
  qualifyRouting,
  rejectForbiddenAsset,
  rejectPublicationTarget,
  resolveRegisteredSimulationModel,
  resolveSimulationModel,
} from '../browser-delivery';
import { optimizerConfigDigest } from '../browser-delivery/manifest';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const DIGEST = 'c'.repeat(64);
const CONFIG = 'd'.repeat(64);

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
      esaQualified: false,
      trafficQualified: false,
    });
    expect(incomplete.status).toBe('incomplete');
    expect(incomplete.esaFirst).toBe(false);
    expect(resolveSimulationModel('destroyer', built, incomplete).esaUrl).toBeNull();
    expect(resolveSimulationModel('destroyer', built, incomplete).candidates[0]).toBe('/assets/models-opt/destroyer.glb');
    const published = { ...planPublication(built), applied: true, missing: [], blockingReasons: [] };
    const qualified = qualifyRouting({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      capturedAt: '2026-08-27T00:00:00.000Z',
      dirty: false,
      mixedWorktree: false,
      manifest: built,
      publication: published,
      esaQualified: true,
      trafficQualified: true,
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
      esaQualified: true,
      trafficQualified: true,
    }).status).toBe('blocked');
  });
});

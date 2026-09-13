import { describe, expect, it } from 'vitest';

import { combinationEqual, emptyCombination } from '@/lib/versioned-knowledge-activation/contracts';
import { evaluateConsumerReadiness } from '@/lib/versioned-knowledge-activation/readiness';

const HASH = 'd'.repeat(64);

function artifacts(bindingRelease?: {
  present: boolean;
  bindingReleaseId: string | null;
  bindingHash: string | null;
  gatePassed: boolean;
  mediaDriftReasons?: string[];
}) {
  return {
    captureRevision: 'a'.repeat(40),
    authority: {
      present: true,
      releaseId: 'ctr:release:eng-v1',
      snapshotId: 'snap-eng-1',
      snapshotHash: HASH,
      captureRevision: 'a'.repeat(40),
      artifactHashes: { 'manifest.json': HASH, 'engineering.json': HASH },
    },
    projection: {
      present: true,
      projectionId: 'proj-1',
      projectionHash: HASH,
      authorityReleaseId: 'ctr:release:eng-v1',
      captureRevision: 'a'.repeat(40),
      gatePassed: true,
      artifactHashes: {
        'projection-manifest.json': HASH,
        'resources.jsonl': HASH,
        'bindings.jsonl': HASH,
        'cards-index.json': HASH,
        'prerequisites.jsonl': HASH,
      },
      hasResources: true,
      hasCardsIndex: true,
      hasPrerequisites: true,
      hasImpactReport: false,
    },
    ...(bindingRelease ? {
      bindingRelease: {
        ...bindingRelease,
        authorityReleaseId: 'ctr:release:eng-v1',
        artifactHashes: bindingRelease.present
          ? { 'binding-manifest.json': HASH, 'bindings.jsonl': HASH }
          : {},
        mediaDriftReasons: bindingRelease.mediaDriftReasons ?? [],
      },
    } : {}),
  };
}

describe('binding release activation lock', () => {
  it('treats omitted binding identity as equal to null', () => {
    const left = { ...emptyCombination(), bindingReleaseId: undefined, bindingHash: undefined };
    const right = { ...emptyCombination(), bindingReleaseId: null, bindingHash: null };
    expect(combinationEqual(left, right)).toBe(true);
    expect(combinationEqual(
      { ...left, bindingReleaseId: 'control-theory-engineering-v0.37-r6-b2', bindingHash: HASH },
      right,
    )).toBe(false);
  });

  it('keeps legacy sealed sets ready when no binding release is declared', () => {
    const records = evaluateConsumerReadiness({
      artifacts: artifacts(),
      preferPinOnBlock: false,
    });
    expect(records.find((row) => row.consumerId === 'learning-path')?.status).toBe('READY');
    expect(records.find((row) => row.consumerId === 'konling')?.status).toBe('READY');
  });

  it('blocks teaching consumers when a new activation declares an incomplete binding lock', () => {
    const records = evaluateConsumerReadiness({
      artifacts: artifacts({
        present: false,
        bindingReleaseId: null,
        bindingHash: null,
        gatePassed: false,
      }),
      preferPinOnBlock: false,
    });
    const path = records.find((row) => row.consumerId === 'learning-path');
    expect(path?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(path?.reasons).toContain('binding-release-missing');
  });

  it('records the binding identity on a ready teaching combination', () => {
    const records = evaluateConsumerReadiness({
      artifacts: artifacts({
        present: true,
        bindingReleaseId: 'control-theory-engineering-v0.37-r6-b2',
        bindingHash: HASH,
        gatePassed: true,
      }),
      preferPinOnBlock: false,
    });
    const path = records.find((row) => row.consumerId === 'learning-path');
    expect(path?.status).toBe('READY');
    expect(path?.combination.bindingReleaseId).toBe('control-theory-engineering-v0.37-r6-b2');
    expect(path?.combination.bindingHash).toBe(HASH);
  });
});

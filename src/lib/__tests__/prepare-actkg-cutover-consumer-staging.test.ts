import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertNonDefaultStagingRoot,
  blockConsumersWithoutDefaultBaseline,
} from '../../../scripts/knowledge-cutover/prepare-actkg-cutover-consumer-staging';
import {
  evaluateConsumerReadiness,
  type StagedActivationArtifactSet,
} from '../versioned-knowledge-activation';

describe('ActKG → ACT consumer staging preparation', () => {
  it('rejects all default pointer roots and direct current paths', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-cutover-consumer-'));
    try {
      expect(() => assertNonDefaultStagingRoot(root, path.join(root, 'course-content/runtime/knowledge/consumer-activation')))
        .toThrow(/must not resolve inside/);
      expect(() => assertNonDefaultStagingRoot(root, path.join(root, 'candidate/current.json')))
        .toThrow(/cannot be a current\.json/);
      expect(() => assertNonDefaultStagingRoot(root, path.join(root, 'artifacts/candidate')))
        .not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks engineering consumers when no default baseline can support shadow or rollback evidence', () => {
    const artifacts: StagedActivationArtifactSet = {
      captureRevision: 'a'.repeat(40),
      authority: {
        present: true,
        releaseId: 'ctr:release:fixture',
        snapshotId: 'snap-fixture',
        snapshotHash: 'b'.repeat(64),
        captureRevision: 'a'.repeat(40),
        artifactHashes: {
          'manifest.json': 'c'.repeat(64),
          'engineering.json': 'd'.repeat(64),
        },
      },
      projection: null,
    };
    const consumers = evaluateConsumerReadiness({
      artifacts: blockConsumersWithoutDefaultBaseline(artifacts),
    });
    for (const consumerId of ['engineering-graph', 'engineering-rag']) {
      const consumer = consumers.find((item) => item.consumerId === consumerId);
      expect(consumer?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
      expect(consumer?.reasons).toEqual(expect.arrayContaining([
        'route-smoke-failed',
        'shadow-baseline-missing',
        'rollback-baseline-missing',
      ]));
    }
  });
});

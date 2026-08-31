/**
 * Stage successor domain Teaching runtime from the sealed v0.37 candidate.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_SUCCESSOR_CANDIDATE_RELATIVE,
  stageDomainTeachingRuntimeFromCandidate,
} from '@/lib/authority-domain-shards/stage-domain-teaching-runtime';
import { loadOptionalDomainTeachingProjection } from '@/lib/authority-domain-shards/teaching';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('stage domain teaching runtime', () => {
  it('reopens the sealed candidate and writes a loadable runtime pointer', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-domain-teaching-runtime-'));
    tempRoots.push(root);
    const staged = stageDomainTeachingRuntimeFromCandidate({
      repoRoot: root,
      candidateDir: path.join(process.cwd(), DEFAULT_SUCCESSOR_CANDIDATE_RELATIVE),
    });
    expect(staged.pointer.projectionHash).toBe(
      'eb4d2d63aca6f3cca74fa18d3d1b548c44a34047442680a259386499ebff14fe',
    );
    expect(staged.pointer.authorityReleaseId).toBe(
      'ctr:release:control-theory-engineering-v0.37',
    );
    expect(staged.artifacts.manifest.relationCount).toBeGreaterThan(0);

    const loaded = loadOptionalDomainTeachingProjection({ repoRoot: root });
    expect(loaded.pointer?.projectionHash).toBe(staged.pointer.projectionHash);
    expect(loaded.artifacts?.manifest.relationCount).toBe(staged.artifacts.manifest.relationCount);
    const pointer = JSON.parse(
      readFileSync(path.join(root, 'course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json'), 'utf8'),
    ) as { contract: string };
    expect(pointer.contract).toBe('act-domain-teaching-projection-current/v1');
  });
});

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareActKgV022TeachingProjection } from '../../../scripts/knowledge-cutover/prepare-actkg-v022-teaching-projection';
import { assertV022PointerBytesUnchanged } from '../../../tools/teaching-projection-publishing/rebase/v022-receipt';
import type { V022RebaseReceipt } from '../../../tools/teaching-projection-publishing/rebase/v022-contracts';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const V022_CANDIDATE_RECEIPT = path.join(
  REPO_ROOT,
  'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.22/candidate-receipt.json',
);
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'act-v022-real-smoke-'));
  roots.push(root);
  return root;
}

describe('v0.22 shipped prepare real smoke', () => {
  it('replays a sealed observation through the exported CLI without moving selectors', async () => {
    const outputRoot = path.join(tempRoot(), 'v022-candidate');
    const observation = path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.22/database-observation.json',
    );
    const result = await prepareActKgV022TeachingProjection([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      outputRoot,
      '--database-observation',
      observation,
    ]);
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    const receipt = JSON.parse(readFileSync(path.join(outputRoot, 'candidate-receipt.json'), 'utf8')) as V022RebaseReceipt;
    expect(receipt.unqualified).toBe(true);
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.selectorConsumption).toBe(false);
    expect(receipt.pointerBytesUnchanged).toBe(true);
    expect(receipt.dualBuild?.byteEquivalent).toBe(true);
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    const projection = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/projection/current.json'), 'utf8')) as { authorityReleaseId: string };
    const prerequisites = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/prerequisites/current.json'), 'utf8')) as { authorityReleaseId: string };
    const shards = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/authority-domain-shards/current.json'), 'utf8')) as { releaseId: string };
    const activation = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/consumer-activation/current.json'), 'utf8')) as { activationId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(projection.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(prerequisites.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(shards.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(activation.activationId).toBe('activation-0b72f577a3d58647e6b67246');
  }, 180_000);
});

describe('v0.22 captured candidate remains inactive after successor cutover', () => {
  it('proves the sealed receipt did not move selectors and live Git now records v0.37', () => {
    const receipt = JSON.parse(readFileSync(V022_CANDIDATE_RECEIPT, 'utf8')) as V022RebaseReceipt;
    assertV022PointerBytesUnchanged(receipt.pointersBefore, receipt.pointersAfter);
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.selectorConsumption).toBe(false);
    expect(receipt.mapping.reviewRequiredCount).toBe(0);
    expect(receipt.dualBuild?.byteEquivalent).toBe(true);
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    const projection = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/projection/current.json'), 'utf8')) as { authorityReleaseId: string };
    const prerequisites = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/prerequisites/current.json'), 'utf8')) as { authorityReleaseId: string };
    const shards = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/runtime/knowledge/authority-domain-shards/current.json'), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(projection.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(prerequisites.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(shards.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
  });
});

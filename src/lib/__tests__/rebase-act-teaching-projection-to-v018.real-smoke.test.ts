import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareActKgV018TeachingProjection } from '../../../scripts/knowledge-cutover/prepare-actkg-v018-teaching-projection';
import {
  assertV018PointerBytesUnchanged,
  readV018PointerSnapshots,
} from '../teaching-projection/rebase/v018-receipt';
import type { V018RebaseReceipt } from '../teaching-projection/rebase/v018-contracts';
import { V018_CURRENT_POINTER_PATHS } from '../teaching-projection/rebase/v018-contracts';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const outputRoots: string[] = [];

afterEach(() => {
  while (outputRoots.length > 0) rmSync(outputRoots.pop()!, { recursive: true, force: true });
});

describe('v0.18 shipped prepare entry', () => {
  it('replays a sealed observation through the exported CLI without moving selectors', async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v018-real-smoke-'));
    outputRoots.push(outputRoot);
    const observation = path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/database-observation.json',
    );
    const result = await prepareActKgV018TeachingProjection([
      '--repo-root',
      REPO_ROOT,
      '--output-root',
      outputRoot,
      '--database-observation',
      observation,
    ]);
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    const receipt = JSON.parse(readFileSync(path.join(outputRoot, 'candidate-receipt.json'), 'utf8')) as V018RebaseReceipt;
    expect(receipt.unqualified).toBe(true);
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.selectorConsumption).toBe(false);
    expect(receipt.pointerBytesUnchanged).toBe(true);
    expect(receipt.dualBuild?.byteEquivalent).toBe(true);
    const live = readV018PointerSnapshots(REPO_ROOT, V018_CURRENT_POINTER_PATHS);
    assertV018PointerBytesUnchanged(receipt.pointersAfter, live);
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[0]), 'utf8')) as { releaseId: string };
    const projection = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[1]), 'utf8')) as { authorityReleaseId: string };
    const prerequisites = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[2]), 'utf8')) as { authorityReleaseId: string };
    const shards = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[3]), 'utf8')) as { releaseId: string };
    const activation = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[4]), 'utf8')) as { activationId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(projection.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(prerequisites.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(shards.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(activation.activationId).toBe('first-cutover-7f4cdd1084af-769b1a832622');
  }, 180_000);
});

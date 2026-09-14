import { describe, expect, it } from 'vitest';

import { publicationLocksMatchLive } from '@/lib/published-resource-index';

const HASH = 'a'.repeat(64);

describe('publicationLocksMatchLive', () => {
  const live = {
    projectionId: `proj-${HASH}`,
    projectionHash: HASH,
    snapshotId: `snap-${HASH}`,
    snapshotHash: HASH,
    runtimeReleaseId: 'runtime-live',
  };

  it('matches the live publication even when the href still carries a predecessor runtime stamp', () => {
    expect(publicationLocksMatchLive(live, {
      projectionId: live.projectionId,
      projectionHash: live.projectionHash,
      snapshotId: live.snapshotId,
      snapshotHash: live.snapshotHash,
      runtimeReleaseId: 'runtime-predecessor',
    })).toBe(true);
  });

  it('treats a live resourceId as current even when the path still carries an old resourceVersion', () => {
    expect(publicationLocksMatchLive(live, {
      projectionId: live.projectionId,
      projectionHash: live.projectionHash,
      snapshotId: live.snapshotId,
      snapshotHash: live.snapshotHash,
    })).toBe(true);
  });

  it('rejects a different projection', () => {
    const other = 'b'.repeat(64);
    expect(publicationLocksMatchLive(live, {
      projectionId: `proj-${other}`,
      projectionHash: other,
      snapshotId: live.snapshotId,
      snapshotHash: live.snapshotHash,
      runtimeReleaseId: live.runtimeReleaseId,
    })).toBe(false);
  });
});

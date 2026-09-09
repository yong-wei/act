import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ switched: false, switchAt: '', projectionHash: 'a'.repeat(64) }));
const projectionHash = 'a'.repeat(64);
const snapshotHash = 'b'.repeat(64);
const envelope = (changed: boolean) => ({
  contract: 'authority-shard-envelope/v1',
  authority: { snapshotId: 'snap-' + (changed ? 'c'.repeat(64) : snapshotHash),
    snapshotHash: changed ? 'c'.repeat(64) : snapshotHash, activationId: changed ? 'activation-b' : 'activation-a' },
  catalog: { catalogId: 'catalog-a' }, teaching: { status: 'unavailable' }, match: { authority: true, catalog: true, teaching: null },
});

vi.mock('@/lib/teaching-projection/live-course-pointer', () => ({
  readAgreedLiveCourseProjection: () => ({ projectionId: 'proj-' + state.projectionHash, projectionHash: state.projectionHash }),
  resolveConfiguredTeachingProjectionRoot: () => process.cwd(),
}));
vi.mock('@/lib/teaching-projection/store', () => ({
  resolveTeachingProjectionStorePaths: () => ({}),
  loadStagedTeachingProjection: () => ({ projectionHash, artifacts: {
    gate: { passed: true },
    manifest: { gatePassed: true, projectionId: 'proj-' + projectionHash, projectionHash,
      authoritySnapshotId: 'snap-' + snapshotHash, authoritySnapshotHash: snapshotHash, authorityReleaseId: 'release-a' },
    resources: [], bindings: [],
  } }),
}));
vi.mock('@/lib/authoritative-knowledge/engineering-authority-consumers', () => ({
  resolveConfiguredAuthorityRoot: () => process.cwd(),
  resolveActiveEngineeringGraphAuthority: () => ({ status: 'ready', snapshotId: 'snap-' + snapshotHash,
    snapshotHash, engineering: { objects: [], relations: [] } }),
}));
vi.mock('@/lib/authority-domain-shards/identity', () => ({
  resolveActiveShardIdentity: () => {
    const captured = envelope(state.switched);
    if (state.switchAt === 'after-capture') state.switched = true;
    return { envelope: captured };
  },
}));
const infographic = vi.hoisted(() => vi.fn());
vi.mock('@/lib/authority-domain-shards/learning-content', () => ({
  readPublishedLearnerCardByToken: () => null,
  createPublishedInfographReferenceIndex: (...args: unknown[]) => infographic(...args),
}));
vi.mock('@/lib/runtime-active-release', () => ({
  readActiveRuntimeReleaseManifest: async () => {
    if (state.switchAt === 'after-engineering') state.switched = true;
    return null;
  },
  isRuntimeMediaPath: () => false,
}));

import { clearPublishedResourceFeatureMemoryCache, loadPublishedResourceFeatureIndex, loadPublishedResourceFeatureIndexCapture } from '@/lib/published-resource-index';

describe('published resource index capture', () => {
  let root: string;
  let cache: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resource-capture-'));
    cache = join(tmpdir(), 'act-resource-features', createHash('sha256').update(JSON.stringify(root)).digest('hex').slice(0, 20));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    state.switched = false; state.switchAt = ''; state.projectionHash = projectionHash;
    clearPublishedResourceFeatureMemoryCache();
    infographic.mockReset().mockImplementation(() => {
      if (state.switchAt === 'during-infographic') state.switched = true;
      return new Set();
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  });

  it.each(['after-engineering', 'during-infographic'])('rejects Authority drift %s before persisting any index', async (at) => {
    state.switchAt = at;
    await expect(loadPublishedResourceFeatureIndex()).rejects.toThrow('Resource publication changed while indexing');
    expect(infographic).toHaveBeenCalledWith(expect.objectContaining({ envelope: envelope(false) }));
    expect(existsSync(cache)).toBe(false);
  });

  it('writes a stable capture and reuses it without rebuilding resource eligibility', async () => {
    const first = await loadPublishedResourceFeatureIndex();
    const second = await loadPublishedResourceFeatureIndex();
    expect(second.indexId).toBe(first.indexId);
    expect(first.snapshotHash).toBe(snapshotHash);
    expect(infographic).toHaveBeenCalledTimes(1);
    expect(existsSync(cache)).toBe(true);
  });

  it.each(['memory', 'disk'])('rechecks the current selection before returning a %s cache hit', async (source) => {
    await loadPublishedResourceFeatureIndex();
    if (source === 'disk') clearPublishedResourceFeatureMemoryCache();
    state.switchAt = 'after-capture';
    await expect(loadPublishedResourceFeatureIndex()).rejects.toThrow('Resource publication changed while indexing');
    expect(infographic).toHaveBeenCalledTimes(1);
  });

  it('retains a guard for a course switch after the asynchronous index load has returned', async () => {
    const capture = await loadPublishedResourceFeatureIndexCapture();
    capture.assertCurrent();
    state.projectionHash = 'e'.repeat(64);
    expect(() => capture.assertCurrent()).toThrow('Resource publication changed');
  });

  it.each([
    'course-content/runtime/.act-runtime-release.v2.json',
    'course-content/runtime/act-runtime-active-receipt.json',
    'course-content/runtime/lessons/3-1/content.json',
    'releases/proj-' + projectionHash + '/bindings.jsonl',
  ])('rejects changed index source %s without an Authority or catalog change', async (relative) => {
    const capture = await loadPublishedResourceFeatureIndexCapture();
    const file = join(root, relative);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, '{}\n');
    expect(() => capture.assertCurrent()).toThrow('Resource publication changed');
  });
});

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as teachingProjectionStore from '@/lib/teaching-projection/store';

import {
  attachActiveAuthorityLearningContent,
  loadNodeDetailShard,
  publishedInfographSafeIdForToken,
  readActiveAuthorityInfograph,
  readPublishedAuthorityInfographBySafeId,
} from '@/lib/authority-domain-shards';

const REPO_ROOT = process.cwd();
const ACCEPTED_NODE = 'ctc:modeling-865eb1c8824e157c2f05a903';
const BLOCKED_CARD_NODE = 'ctkg:v3e-object-35942e1152c99bd94bdecd00';
const NO_CARD_NODE = 'ctkg:v3e-canonical-62bea9217008b56901615d9a';
const MANIFEST_RELATIVE = 'course-content/runtime/knowledge/authority-learning-content-manifest.json';
const CARD_RELATIVE = 'course-content/runtime/knowledge/cards/authority/nodes';
const INFOGRAPH_RELATIVE = 'course-content/runtime/knowledge/infographs/authority/nodes';

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function alignedDetail(nodeId: string) {
  const detail = loadNodeDetailShard(nodeId);
  const active = teachingProjectionStore.resolveActiveTeachingProjection(
    teachingProjectionStore.resolveTeachingProjectionStorePaths(
      join(REPO_ROOT, 'course-content/runtime/knowledge/projection'),
    ),
  );
  expect(active.status).toBe('available');
  expect(active.staged).not.toBeNull();
  const staged = active.staged!;
  return {
    ...detail,
    envelope: {
      ...detail.envelope,
      teaching: {
        status: 'available' as const,
        projectionId: staged.projectionId,
        projectionHash: staged.projectionHash,
        teachingCacheFamily: 'fixture-aligned-teaching',
      },
      match: { ...detail.envelope.match, teaching: true as const },
    },
  };
}

function sourceNode(canonicalId: string) {
  const safeId = 'ctc_modeling-865eb1c8824e157c2f05a903';
  const cardPath = join(REPO_ROOT, CARD_RELATIVE, `${safeId}.md`);
  const infographPath = join(REPO_ROOT, INFOGRAPH_RELATIVE, `${safeId}.png`);
  const raw = readFileSync(cardPath, 'utf8');
  const entity = raw.match(/^authority_entity_id:\s*["']?([^"'\r\n]+)/m)?.[1]?.trim();
  if (canonicalId === ACCEPTED_NODE && entity === canonicalId) {
    return {
      canonicalId,
      safeId,
      card: { state: 'available' as const, sha256: sha256(raw) },
      infograph: { state: 'available' as const, sha256: sha256(readFileSync(infographPath)) },
    };
  }
  if (canonicalId === BLOCKED_CARD_NODE) {
    return {
      canonicalId,
      safeId: 'blocked-fixture-node',
      card: { state: 'blocked' as const, sha256: null },
      infograph: { state: 'available' as const, sha256: sha256(readFileSync(infographPath)) },
    };
  }
  throw new Error(`missing test source node ${canonicalId}`);
}

function withAlignedRuntime(
  action: (details: {
    accepted: ReturnType<typeof alignedDetail>;
    blocked: ReturnType<typeof alignedDetail>;
    absent: ReturnType<typeof alignedDetail>;
  }) => void,
  mutateManifest?: (manifest: Record<string, unknown>) => void,
) {
  const root = mkdtempSync(join(tmpdir(), 'authority-learning-content-'));
  const originalCwd = process.cwd();
  const originalProjectionRoot = process.env.ACT_TEACHING_PROJECTION_STORE_ROOT;
  const details = {
    accepted: alignedDetail(ACCEPTED_NODE),
    blocked: alignedDetail(BLOCKED_CARD_NODE),
    absent: alignedDetail(NO_CARD_NODE),
  };
  const authority = details.accepted.envelope.authority;
  const accepted = sourceNode(ACCEPTED_NODE);
  const blocked = sourceNode(BLOCKED_CARD_NODE);
  const manifest: Record<string, unknown> = {
    contract: 'act-authority-learning-content-manifest/v2',
    authorityReleaseId: authority.releaseId,
    authorityReleaseSetId: authority.releaseSetId,
    authoritySnapshotId: authority.snapshotId,
    authoritySnapshotHash: authority.snapshotHash,
    nodes: [accepted, blocked],
  };
  mutateManifest?.(manifest);

  const cardRoot = join(root, CARD_RELATIVE);
  const infographRoot = join(root, INFOGRAPH_RELATIVE);
  mkdirSync(cardRoot, { recursive: true });
  mkdirSync(infographRoot, { recursive: true });
  const trackedCard = join(REPO_ROOT, CARD_RELATIVE, 'ctc_modeling-865eb1c8824e157c2f05a903.md');
  const trackedInfograph = join(REPO_ROOT, INFOGRAPH_RELATIVE, 'ctc_modeling-865eb1c8824e157c2f05a903.png');
  for (const node of [accepted, blocked]) {
    if (node.card.state === 'available') copyFileSync(trackedCard, join(cardRoot, `${node.safeId}.md`));
    if (node.infograph.state === 'available') copyFileSync(trackedInfograph, join(infographRoot, `${node.safeId}.png`));
  }
  const manifestPath = join(root, MANIFEST_RELATIVE);
  mkdirSync(join(root, 'course-content/runtime/knowledge'), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

  process.chdir(root);
  process.env.ACT_TEACHING_PROJECTION_STORE_ROOT = join(
    REPO_ROOT,
    'course-content/runtime/knowledge/projection',
  );
  try {
    action(details);
  } finally {
    process.chdir(originalCwd);
    if (originalProjectionRoot === undefined) delete process.env.ACT_TEACHING_PROJECTION_STORE_ROOT;
    else process.env.ACT_TEACHING_PROJECTION_STORE_ROOT = originalProjectionRoot;
    rmSync(root, { recursive: true, force: true });
  }
}

function expectUnavailable(detail: ReturnType<typeof alignedDetail>) {
  const resolved = attachActiveAuthorityLearningContent(detail);
  expect(resolved.node.learningContent).toEqual({
    card: { state: 'unavailable', message: '当前学习卡片暂时不可用。' },
    infograph: { state: 'unavailable', message: '当前信息图暂时不可用。' },
  });
  expect(readActiveAuthorityInfograph(detail)).toBeNull();
}

describe('Authority learning-content delivery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the git-tracked accepted card without matching the course pointer', () => {
    const live = loadNodeDetailShard(ACCEPTED_NODE);
    const resolved = attachActiveAuthorityLearningContent(live);
    expect(live.envelope.teaching.projectionId).not.toBe(
      teachingProjectionStore.readCurrentTeachingProjectionPointer(
        teachingProjectionStore.resolveTeachingProjectionStorePaths(
          join(REPO_ROOT, 'course-content/runtime/knowledge/projection'),
        ),
      )?.projectionId,
    );
    expect(resolved.node.learningContent?.card.state).toBe('available');
    expect(resolved.node.learningContent?.infograph.state).toBe('available');
    expect(readActiveAuthorityInfograph(live)?.byteLength).toBeGreaterThan(1000);
  });

  it('binds an aligned v2 export before reading accepted card and infograph bytes', () => {
    withAlignedRuntime(({ accepted }) => {
      const resolved = attachActiveAuthorityLearningContent(accepted);

      expect(resolved.node.learningContent?.card.state).toBe('available');
      expect(resolved.node.learningContent?.infograph.state).toBe('available');
      expect(resolved.node.learningContent?.card).not.toMatchObject({
        summary: expect.stringMatching(/(?:ctc:|ctkg:|[a-f0-9]{64}|course-content\/)/i),
      });
      expect(readActiveAuthorityInfograph(accepted)?.byteLength).toBeGreaterThan(1000);
    });
  });

  it('serves published infograph GET only from the active v2 inventory and matching hash', () => {
    withAlignedRuntime(() => {
      const acceptedSafeId = 'ctc_modeling-865eb1c8824e157c2f05a903';
      const accepted = readPublishedAuthorityInfographBySafeId(acceptedSafeId);
      expect(accepted?.byteLength).toBeGreaterThan(1000);
      expect(publishedInfographSafeIdForToken(acceptedSafeId)).toBe(acceptedSafeId);

      const leftoverId = 'leftover-infograph-token';
      const leftoverDir = join(process.cwd(), 'course-content/runtime/knowledge/infographs/nodes');
      mkdirSync(leftoverDir, { recursive: true });
      copyFileSync(
        join(process.cwd(), INFOGRAPH_RELATIVE, `${acceptedSafeId}.png`),
        join(leftoverDir, `${leftoverId}.png`),
      );
      expect(readPublishedAuthorityInfographBySafeId(leftoverId)).toBeNull();
      expect(publishedInfographSafeIdForToken(leftoverId)).toBeNull();

      writeFileSync(join(process.cwd(), INFOGRAPH_RELATIVE, `${acceptedSafeId}.png`), 'not-the-accepted-bytes');
      expect(readPublishedAuthorityInfographBySafeId(acceptedSafeId)).toBeNull();
      expect(publishedInfographSafeIdForToken(acceptedSafeId)).toBeNull();
    });
  });

  it('serves a binding infograph only when the live teaching inventory lists it', () => {
    withAlignedRuntime(() => {
      const token = 'lesson-infograph-token';
      const bytes = readFileSync(join(process.cwd(), INFOGRAPH_RELATIVE, 'ctc_modeling-865eb1c8824e157c2f05a903.png'));
      const lessonDir = join(process.cwd(), 'course-content/runtime/knowledge/infographs/nodes');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(join(lessonDir, `${token}.png`), bytes);
      expect(readPublishedAuthorityInfographBySafeId(token)).toBeNull();
      expect(readPublishedAuthorityInfographBySafeId(token, {
        liveInfographicTokens: new Map([[token, sha256(bytes)]]),
      })?.equals(bytes)).toBe(true);
      expect(readPublishedAuthorityInfographBySafeId(token, {
        liveInfographicTokens: new Map([[token, '0'.repeat(64)]]),
      })).toBeNull();
    });
  });

  it('keeps blocked and absent cards honest without suppressing semantic detail', () => {
    withAlignedRuntime(({ blocked: blockedDetail, absent: absentDetail }) => {
      const blocked = attachActiveAuthorityLearningContent(blockedDetail);
      const absent = attachActiveAuthorityLearningContent(absentDetail);

      expect(blocked.node.learningContent?.card).toEqual({
        state: 'blocked',
        message: '该学习卡片仍在完善中。',
      });
      expect(blocked.node.learningContent?.infograph.state).toBe('available');
      expect(absent.node.learningContent?.card).toEqual({
        state: 'missing',
        message: '当前节点暂无已发布学习卡片。',
      });
      expect(absent.node.description).toBeTruthy();
    });
  });

  it.each([
    'authorityReleaseId',
    'authorityReleaseSetId',
    'authoritySnapshotId',
    'authoritySnapshotHash',
  ])('fails closed before assets when %s differs from the shard envelope', (field) => {
    withAlignedRuntime(({ accepted }) => {
      expectUnavailable(accepted);
    }, (manifest) => {
      manifest[field] = field === 'authoritySnapshotHash' ? '0'.repeat(64) : 'mismatched-identity';
    });
  });

  it.each([
    ['legacy-v1', (manifest: Record<string, unknown>) => { manifest.contract = 'act-authority-learning-content-manifest/v1'; }],
    ['missing-authority-field', (manifest: Record<string, unknown>) => { delete manifest.authorityReleaseSetId; }],
    ['invalid-authority-hash', (manifest: Record<string, unknown>) => { manifest.authoritySnapshotHash = 'not-a-hash'; }],
    ['duplicate-canonical-id', (manifest: Record<string, unknown>) => {
      manifest.nodes = [...(manifest.nodes as unknown[]), (manifest.nodes as unknown[])[0]];
    }],
  ])('treats a %s manifest as entirely unavailable', (_name, mutate) => {
    withAlignedRuntime(({ accepted }) => {
      expectUnavailable(accepted);
    }, mutate);
  });

  it('uses the configured Teaching Projection mount rather than the worktree default', () => {
    withAlignedRuntime(({ accepted }) => {
      expect(attachActiveAuthorityLearningContent(accepted).node.learningContent?.card.state).toBe('available');
    });
  });

  it('renders typical inspector nodes from the v2 ledger', () => {
    const resolved = attachActiveAuthorityLearningContent(loadNodeDetailShard(ACCEPTED_NODE));
    expect(resolved.node.learningContent?.card.state).toBe('available');
    expect(resolved.node.label).toBeTruthy();
  });

  it('keeps the runtime card/infograph/resource linkage gate green', () => {
    const result = spawnSync(process.execPath, ['scripts/knowledge/check-authority-surface-linkage.mjs'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('sidecar=');
  });

  it('fails closed when the teaching seal differs from the active envelope (#2045)', () => {
    withAlignedRuntime(({ accepted }) => {
      expectUnavailable(accepted);
    }, (manifest) => {
      manifest.teachingProjectionId = 'proj-0000000000000000000000000000000000000000000000000000000000000000';
      manifest.teachingProjectionHash = '0'.repeat(64);
    });
  });

  it('serves a missing-state infograph as an honest gap while the card stays available (#2045)', () => {
    withAlignedRuntime(({ accepted }) => {
      const resolved = attachActiveAuthorityLearningContent(accepted);
      expect(resolved.node.learningContent?.card.state).toBe('available');
      expect(resolved.node.learningContent?.infograph).toEqual({
        state: 'missing',
        message: '当前节点暂无可用信息图。',
      });
      expect(readActiveAuthorityInfograph(accepted)).toBeNull();
    }, (manifest) => {
      const nodes = manifest.nodes as Array<Record<string, unknown>>;
      manifest.nodes = nodes.map((node) => (
        node.canonicalId === ACCEPTED_NODE
          ? { ...node, infograph: { state: 'missing', sha256: null } }
          : node
      ));
    });
  });

  it('classifies the shipped v2 manifest as available with a script-produced seal (#2045)', async () => {
    const { classifyLearningContentManifest } = await import('@/lib/knowledge-surface/learning-content');
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, MANIFEST_RELATIVE), 'utf8')) as Record<string, unknown>;
    const shardEnvelope = loadNodeDetailShard(ACCEPTED_NODE).envelope.authority;
    const classification = classifyLearningContentManifest(manifest, {
      releaseId: shardEnvelope.releaseId,
      releaseSetId: shardEnvelope.releaseSetId,
      snapshotId: shardEnvelope.snapshotId,
      snapshotHash: shardEnvelope.snapshotHash,
    });
    expect(classification.status).toBe('available');
    expect(manifest.nodes.length).toBeGreaterThanOrEqual(1236);
    const overlay = JSON.parse(
      readFileSync(join(REPO_ROOT, 'course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json'), 'utf8'),
    ) as { projectionId: string; projectionHash: string };
    expect(manifest.teachingProjectionId).toBe(overlay.projectionId);
    expect(manifest.teachingProjectionHash).toBe(overlay.projectionHash);
  });

  it('re-exports the v2 manifest byte-stably (#2045)', () => {
    const manifestPath = join(REPO_ROOT, MANIFEST_RELATIVE);
    const before = readFileSync(manifestPath);
    const result = spawnSync('python3', ['scripts/knowledge/export-authority-learning-content-v2.py'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(manifestPath).equals(before)).toBe(true);
  });

  it('does not read the course teaching pointer when shard teaching is unavailable', () => {
    const projectionResolver = vi.spyOn(teachingProjectionStore, 'resolveActiveTeachingProjection');
    const live = loadNodeDetailShard(ACCEPTED_NODE);
    const detail = attachActiveAuthorityLearningContent({
      ...live,
      envelope: {
        ...live.envelope,
        teaching: {
          status: 'unavailable',
          projectionId: null,
          projectionHash: null,
          teachingCacheFamily: null,
        },
        match: { ...live.envelope.match, teaching: false },
      },
    });

    expect(projectionResolver).not.toHaveBeenCalled();
    expect(detail.node.learningContent?.card).toEqual({
      state: 'unavailable',
      message: '当前学习卡片暂时不可用。',
    });
    expect(detail.node.learningContent?.infograph).toEqual({
      state: 'unavailable',
      message: '当前信息图暂时不可用。',
    });
  });
});

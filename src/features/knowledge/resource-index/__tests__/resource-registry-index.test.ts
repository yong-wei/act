import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

import { createPublishedArtifactAdapter } from '../adapters/published-artifact';
import { createRenderMetadataAdapter } from '../adapters/render-metadata';
import { createResourceNodeAdapter } from '../adapters/resource-node';
import { buildResourceRegistryIndex, serializeResourceRegistryIndex } from '../builder';
import { canonicalStringify } from '../canonical';
import { ResourceRegistryIndexError } from '../errors';
import { resolveIndexedResource } from '../resolve';
import { resolveLiveResourceIndexRevision } from '../revision';
import {
  captureLiveResourceRegistryIndex,
  getLiveResourceRegistryIndex,
  resetLiveResourceRegistryIndexCache,
} from '../sources';
import { projectStudentReadFromIndex } from '../student-read';
import {
  PUBLISHED_ARTIFACT_SOURCE_KIND,
  RENDER_METADATA_SOURCE_KIND,
  RESOURCE_NODE_SOURCE_KIND,
} from '../types';

const SHARED = 'rev-test-1';
const EMPTY_ENV = { APP_REVISION: '', GIT_SHA: '' };

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createTempGitRepo(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'resource-index-rev-'));
  git(cwd, ['-c', 'init.defaultBranch=main', 'init']);
  git(cwd, ['config', 'user.email', 'index-test@example.com']);
  git(cwd, ['config', 'user.name', 'index-test']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(path.join(cwd, 'tracked.txt'), 'base\n');
  git(cwd, ['add', 'tracked.txt']);
  git(cwd, ['commit', '-m', 'init']);
  return cwd;
}

function publishedArtifact(overrides: Partial<{
  title: string;
  type: string;
  runtimeResourceRef: string;
  canonicalIds: readonly string[];
}> = {}) {
  return {
    artifactRef: 'runtime-media:1-1/intro',
    title: overrides.title ?? '导入片',
    type: overrides.type ?? 'video',
    contentHash: 'abc123',
    sourceVersion: 'runtime-media.v1',
    scope: 'lesson-1-1',
    runtimeResourceRef: overrides.runtimeResourceRef ?? 'lessons/1-1/media/1-1-intro-video.mp4',
    canonicalIds: overrides.canonicalIds,
    launcherRef: 'runtime-media:1-1/intro',
  };
}

function metadata(overrides: {
  id: string;
  label?: string;
  type?: string;
  launchTarget?: string | null;
  planningOverride?: {
    teacherPolicy?: string;
    privacyLevel?: string;
    availability?: string;
  };
  defaultConfig?: Record<string, unknown>;
}) {
  return {
    id: overrides.id,
    label: overrides.label ?? overrides.id,
    type: overrides.type ?? 'INTERACTIVE_COMP',
    launchTarget: overrides.launchTarget,
    planningOverride: overrides.planningOverride,
    defaultConfig: overrides.defaultConfig,
  };
}

describe('resource registry index', () => {
  it('indexes a render-metadata resource with distinct foreign refs', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({
          id: 'lesson14-three-band-studio',
          label: '三频段调优工作台',
          defaultConfig: { mode: 'three-band', sourcePathOrUrl: 'src/lib/secret.ts' },
        })],
      }),
    ]);
    const entry = index.entries[0];
    expect(entry.descriptor.identity.sourceKind).toBe(RENDER_METADATA_SOURCE_KIND);
    expect(entry.descriptor.foreignRefs.registryId).toBe('lesson14-three-band-studio');
    expect(entry.descriptor.foreignRefs.resourceNodeId).toBe('registry:lesson14-three-band-studio');
    expect(entry.descriptor.foreignRefs.teachingResourceId).toBeUndefined();
    expect(entry.descriptor.foreignRefs.canonicalIds).toBeUndefined();
    expect(entry.descriptor.launcher).toEqual({
      contractClass: 'render-registry',
      contractVersion: 'resource-registry.v1',
      launcherRef: 'lesson14-three-band-studio',
    });
    expect(entry.descriptor.safeConfig).toEqual({ mode: 'three-band' });
    expect(JSON.stringify(entry.descriptor)).not.toMatch(/src\/lib|secret\.ts/);
  });

  it('keeps lookalike labels in distinct source kinds instead of merging', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'bode-lab', label: 'Bode 实验' })],
      }),
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'planning-bode-lab',
          title: 'Bode 实验',
          type: 'simulation',
          sourceKind: 'resource_registry',
          sourceRef: 'bode-lab',
          registryId: 'bode-lab',
        }],
      }),
    ]);
    expect(index.entries).toHaveLength(2);
    expect(new Set(index.entries.map((entry) => entry.descriptor.identity.sourceKind))).toEqual(
      new Set([RENDER_METADATA_SOURCE_KIND, RESOURCE_NODE_SOURCE_KIND]),
    );
    expect(index.entries[0].descriptor.identity.key).not.toBe(index.entries[1].descriptor.identity.key);
  });

  it('rejects an identity collision rather than merging', () => {
    const adapter = createRenderMetadataAdapter({
      sharedRevision: SHARED,
      records: [metadata({ id: 'dup' }), metadata({ id: 'dup', label: '其他' })],
    });
    expect(() => buildResourceRegistryIndex([adapter])).toThrow(ResourceRegistryIndexError);
    try {
      buildResourceRegistryIndex([adapter]);
    } catch (error) {
      expect((error as ResourceRegistryIndexError).code).toBe('DUPLICATE_SOURCE_REF');
    }
  });

  it('produces byte-identical output for unchanged inputs', () => {
    const adapters = [
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'stable', label: '稳定条目' })],
      }),
      createPublishedArtifactAdapter({
        owner: 'runtime-release',
        sharedRevision: SHARED,
        records: [publishedArtifact()],
      }),
    ];
    const first = buildResourceRegistryIndex(adapters);
    const second = buildResourceRegistryIndex(adapters);
    expect(first.identity).toBe(second.identity);
    expect(first.digest).toBe(second.digest);
    expect(serializeResourceRegistryIndex(first)).toBe(serializeResourceRegistryIndex(second));
  });

  it('issues a new index identity when source closure drifts', () => {
    const base = [metadata({ id: 'stable', label: '稳定条目' })];
    const first = buildResourceRegistryIndex([
      createRenderMetadataAdapter({ sharedRevision: SHARED, records: base }),
    ]);
    const second = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'stable', label: '稳定条目', defaultConfig: { mode: 'shifted' } })],
      }),
    ]);
    expect(second.identity).not.toBe(first.identity);
    expect(second.digest).not.toBe(first.digest);
    expect(second.entries[0].descriptor.identity.key).not.toBe(first.entries[0].descriptor.identity.key);
  });

  it('fails closed on mixed capture revisions', () => {
    expect(() => buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: 'rev-a',
        records: [metadata({ id: 'a' })],
      }),
      createPublishedArtifactAdapter({
        owner: 'runtime-release',
        sharedRevision: 'rev-b',
        records: [],
      }),
    ])).toThrowError(/different source revisions/);
  });

  it('fails closed when an adapter is unowned or omits capture identity', () => {
    expect(() => buildResourceRegistryIndex([
      () => ({
        owner: '',
        sourceKind: RENDER_METADATA_SOURCE_KIND,
        adapterVersion: 'render-metadata.v1',
        capture: {
          owner: '',
          sourceKind: RENDER_METADATA_SOURCE_KIND,
          adapterVersion: 'render-metadata.v1',
          inputDigest: 'x',
          recordCount: 0,
        },
        records: [],
      }),
    ])).toThrowError(/omitted its owner/);
  });

  it('keeps unrelated entries when an optional published artifact is missing', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'base-node', label: '基础知识节点' })],
      }),
      createPublishedArtifactAdapter({
        owner: 'runtime-release',
        sharedRevision: SHARED,
        records: [{
          artifactRef: 'optional-card',
          title: '知识卡',
          type: 'knowledge_card',
          contentHash: 'missing',
          sourceVersion: 'card.v1',
          scope: 'optional',
          present: false,
        }],
      }),
    ]);
    const base = index.entries.find((entry) => entry.descriptor.identity.sourceRef === 'base-node');
    const optional = index.entries.find((entry) => entry.descriptor.identity.sourceRef === 'optional-card');
    expect(base?.descriptor.availability).toBe('available');
    expect(optional?.descriptor.availability).toBe('unavailable');
    expect(optional?.descriptor.launcher).toBeNull();
  });

  it('fails closed when a required published artifact is absent', () => {
    expect(() => createPublishedArtifactAdapter({
      owner: 'runtime-release',
      records: [{
        artifactRef: 'required-media',
        title: '必选媒体',
        type: 'video',
        contentHash: 'missing',
        sourceVersion: 'media.v1',
        scope: 'required',
        required: true,
        present: false,
      }],
    })).toThrow(ResourceRegistryIndexError);
  });

  it('does not treat registryId as a TeachingResource or Canonical alias', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'sim-scene-cruise', type: 'SIMULATION_APP' })],
      }),
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'db-node-1',
          title: '数据库资源',
          type: 'lesson_step',
          sourceKind: 'teaching_resource',
          sourceRef: 'tr_123',
          teachingResourceId: 'tr_123',
          registryId: 'sim-scene-cruise',
        }],
      }),
    ]);
    const render = index.entries.find((entry) => entry.descriptor.identity.sourceKind === RENDER_METADATA_SOURCE_KIND);
    const node = index.entries.find((entry) => entry.descriptor.identity.sourceKind === RESOURCE_NODE_SOURCE_KIND);
    expect(render?.descriptor.foreignRefs.registryId).toBe('sim-scene-cruise');
    expect(render?.descriptor.foreignRefs.teachingResourceId).toBeUndefined();
    expect(node?.descriptor.foreignRefs.teachingResourceId).toBe('tr_123');
    expect(node?.descriptor.foreignRefs.registryId).toBe('sim-scene-cruise');
    expect(render?.descriptor.identity.sourceRef).not.toBe(node?.descriptor.identity.sourceRef);
  });

  it('hides teacher-only descriptors from the student role without dropping the base index entry', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [
          metadata({ id: 'public-node', label: '公开节点' }),
          metadata({
            id: 'teacher-only',
            label: '教师资源',
            planningOverride: { teacherPolicy: 'teacher-only', privacyLevel: 'teacher-scoped' },
          }),
        ],
      }),
    ]);
    const hidden = resolveIndexedResource({
      index,
      sourceKind: RENDER_METADATA_SOURCE_KIND,
      sourceRef: 'teacher-only',
      role: 'student',
    });
    const visible = resolveIndexedResource({
      index,
      sourceKind: RENDER_METADATA_SOURCE_KIND,
      sourceRef: 'public-node',
      role: 'student',
    });
    expect(hidden?.descriptor.availability).toBe('unavailable');
    expect(hidden?.descriptor.launcher).toBeNull();
    expect(visible?.descriptor.availability).toBe('available');
    expect(index.entries).toHaveLength(2);
  });

  it('rejects a filesystem launch target instead of inventing a route', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({
          id: 'unsafe-launch',
          launchTarget: 'src/resources/widgets/secret.tsx',
        })],
      }),
    ]);
    expect(index.entries[0].descriptor.availability).toBe('unavailable');
    expect(index.entries[0].descriptor.launcher).toBeNull();
  });

  it('projects a student read from the public index without copying unsafe config', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({
          id: 'lesson14-three-band-studio',
          label: '三频段调优工作台',
          defaultConfig: { mode: 'three-band', sourcePathOrUrl: 'src/lib/hidden.ts' },
        })],
      }),
    ]);
    expect(projectStudentReadFromIndex(index, 'lesson14-three-band-studio')).toMatchObject({
      id: 'lesson14-three-band-studio',
      registryId: 'lesson14-three-band-studio',
      title: '三频段调优工作台',
      config: { mode: 'three-band' },
    });
    expect(projectStudentReadFromIndex(index, 'missing')).toBeNull();
  });

  it('covers declared adapters in a live-shaped composition', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata({ id: 'live-shaped' })],
      }),
      createPublishedArtifactAdapter({
        owner: 'published-artifact-none-declared',
        sharedRevision: SHARED,
        records: [],
      }),
    ]);
    expect(index.captures.map((capture) => capture.sourceKind).sort()).toEqual([
      PUBLISHED_ARTIFACT_SOURCE_KIND,
      RENDER_METADATA_SOURCE_KIND,
    ]);
    expect(index.entries).toHaveLength(1);
  });

  it('reconciles live render-metadata entries one-for-one with the source-owned table', () => {
    const sourceIds = getAllRegisteredResourceMetadata().map((record) => record.id).sort();
    const index = captureLiveResourceRegistryIndex();
    const indexedIds = index.entries
      .filter((entry) => entry.descriptor.identity.sourceKind === RENDER_METADATA_SOURCE_KIND)
      .map((entry) => entry.descriptor.identity.sourceRef)
      .sort();
    expect(indexedIds).toEqual(sourceIds);
    expect(index.captures.some((capture) => (
      capture.owner === 'published-artifact-none-declared' && capture.recordCount === 0
    ))).toBe(true);
    expect(new Set(index.entries.map((entry) => entry.descriptor.identity.key)).size).toBe(index.entries.length);
    const serialized = serializeResourceRegistryIndex(index);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized).identity).toBe(index.identity);
    expect(index.captures.every((capture) => (
      capture.sharedRevision === resolveLiveResourceIndexRevision()
    ))).toBe(true);
  });

  it('issues a new index identity when published-artifact descriptors drift without a content-hash change', () => {
    const first = buildResourceRegistryIndex([
      createPublishedArtifactAdapter({
        owner: 'runtime-release',
        sharedRevision: SHARED,
        records: [publishedArtifact()],
      }),
    ]);
    const second = buildResourceRegistryIndex([
      createPublishedArtifactAdapter({
        owner: 'runtime-release',
        sharedRevision: SHARED,
        records: [publishedArtifact({
          title: '导入片（改标题）',
          runtimeResourceRef: 'lessons/1-1/media/1-1-intro-video-v2.mp4',
          canonicalIds: ['canonical.intro'],
        })],
      }),
    ]);
    expect(second.digest).not.toBe(first.digest);
    expect(second.captures[0].inputDigest).not.toBe(first.captures[0].inputDigest);
    expect(second.identity).not.toBe(first.identity);
  });

  it('fails closed when live capture has no Git or environment revision', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'resource-index-missing-'));
    try {
      expect(() => resolveLiveResourceIndexRevision(EMPTY_ENV, cwd)).toThrow(ResourceRegistryIndexError);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('cross-checks revision signals and marks a dirty worktree even when APP_REVISION is set', () => {
    const cwd = createTempGitRepo();
    try {
      const head = git(cwd, ['rev-parse', 'HEAD']).toLowerCase();
      expect(resolveLiveResourceIndexRevision(EMPTY_ENV, cwd)).toBe(head);
      expect(resolveLiveResourceIndexRevision({ APP_REVISION: head }, cwd)).toBe(head);

      writeFileSync(path.join(cwd, 'tracked.txt'), 'dirty\n');
      expect(resolveLiveResourceIndexRevision({ APP_REVISION: head }, cwd)).toBe(`${head}-dirty`);
      expect(resolveLiveResourceIndexRevision(EMPTY_ENV, cwd)).toBe(`${head}-dirty`);

      writeFileSync(path.join(cwd, '.app-revision'), `${'b'.repeat(40)}\n`);
      expect(() => resolveLiveResourceIndexRevision({ APP_REVISION: head }, cwd)).toThrow(/disagree/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('fails closed when APP_REVISION disagrees with the immutable revision file outside Git', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'resource-index-image-'));
    try {
      const imageSha = 'c'.repeat(40);
      writeFileSync(path.join(cwd, '.app-revision'), `${imageSha}\n`);
      expect(resolveLiveResourceIndexRevision({ APP_REVISION: imageSha }, cwd)).toBe(imageSha);
      expect(() => resolveLiveResourceIndexRevision({ APP_REVISION: 'd'.repeat(40) }, cwd)).toThrow(/disagree/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('omits undefined fields so canonical output is JSON-parseable', () => {
    expect(canonicalStringify({ teacherPolicy: undefined, privacyLevel: 'student-visible' })).toBe(
      '{"privacyLevel":"student-visible"}',
    );
    expect(JSON.parse(canonicalStringify({ teacherPolicy: undefined, privacyLevel: 'student-visible' }))).toEqual({
      privacyLevel: 'student-visible',
    });
  });

  it('returns the memoized live index without rebuilding', () => {
    resetLiveResourceRegistryIndexCache();
    const first = getLiveResourceRegistryIndex();
    const second = getLiveResourceRegistryIndex();
    expect(second).toBe(first);
  });
});

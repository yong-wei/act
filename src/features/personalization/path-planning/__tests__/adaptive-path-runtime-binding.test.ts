import { describe, expect, it } from 'vitest';

import {
  deriveAdaptivePathRuntimeBindingLimitationCodes,
  deriveTeachingProjectionResourceIdentity,
  resolveAdaptivePathNodeRuntimeBindings,
  resolveRuntimeSourceObjectKey,
  summarizeAdaptivePathRuntimeBindings,
  type RuntimeReleaseFileIndex,
  type TeachingProjectionResourceIndex,
} from '@/features/personalization/path-planning/adaptive-path-runtime-binding';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

function releaseFixture(files: Array<{ path: string; sha256: string }> = []): RuntimeReleaseFileIndex {
  return {
    releaseId: 'runtime-release-1',
    filesByPath: new Map(files.map((file) => [file.path, { sha256: file.sha256 }])),
    filesBySha256: new Map([...new Map(files.map((file) => [file.sha256, { path: file.path }])).entries()]),
  };
}

function projectionFixture(
  resources: Array<{ resourceId: string; resourceType: string; sourcePath: string | null }>,
): TeachingProjectionResourceIndex {
  return {
    projectionId: 'proj-fixture',
    resourcesByResourceId: new Map(resources.map((resource) => [resource.resourceId, {
      resourceType: resource.resourceType,
      sourcePath: resource.sourcePath,
    }])),
  };
}

describe('teaching projection resource identity reverse mapping (#2055)', () => {
  it('maps deterministic node identities onto projection resource ids', () => {
    expect(deriveTeachingProjectionResourceIdentity('runtime-handout:1-1'))
      .toEqual({ resourceId: 'act:handout:1-1', resourceType: 'handout' });
    expect(deriveTeachingProjectionResourceIdentity('runtime-media:1-1:1-1-intro-video'))
      .toEqual({ resourceId: 'act:video:1-1', resourceType: 'video' });
    expect(deriveTeachingProjectionResourceIdentity('runtime-media:1-1:1-1-audio'))
      .toEqual({ resourceId: 'act:audio:1-1', resourceType: 'audio' });
    expect(deriveTeachingProjectionResourceIdentity('knowledge-card:Bode图_1_1'))
      .toEqual({ resourceId: 'act:card:Bode图_1_1', resourceType: 'card' });
    expect(deriveTeachingProjectionResourceIdentity('arena-task:task-cruise-roll'))
      .toEqual({ resourceId: 'act:simulation:arena-task-cruise-roll', resourceType: 'simulation' });
  });

  it('refuses to guess identities for unmatched media and foreign node ids', () => {
    // 课次有多个视频时只认 B′′ 已身份化的导入视频，其余媒体不猜测归属。
    expect(deriveTeachingProjectionResourceIdentity('runtime-media:1-1:1-1-course')).toBeNull();
    expect(deriveTeachingProjectionResourceIdentity('teaching-resource:video-9')).toBeNull();
    expect(deriveTeachingProjectionResourceIdentity('lesson-step:1-1:step-01')).toBeNull();
  });
});

describe('runtime source object key resolution', () => {
  it('binds content keys through the release manifest by sha256', () => {
    const release = releaseFixture([{ path: 'knowledge/cards/nodes/card.md', sha256: SHA_A }]);
    expect(resolveRuntimeSourceObjectKey(`content:${SHA_A}`, release))
      .toEqual({ objectKey: `blob:${SHA_A}`, contentSha256: SHA_A });
    expect(resolveRuntimeSourceObjectKey(`content:${SHA_B}`, release))
      .toEqual({ reason: 'content-key-not-in-release' });
  });

  it('maps authoring lesson media paths onto release asset paths exactly', () => {
    const release = releaseFixture([{ path: 'lessons/1-1/media/1-1-audio.m4a', sha256: SHA_A }]);
    expect(resolveRuntimeSourceObjectKey('authoring:lessons/1-1/media/processed/1-1-audio.m4a', release))
      .toEqual({ objectKey: 'lessons/1-1/media/1-1-audio.m4a', contentSha256: SHA_A });
    expect(resolveRuntimeSourceObjectKey('authoring:lessons/9-9/media/processed/9-9-audio.m4a', release))
      .toEqual({ reason: 'asset-path-not-in-release' });
    expect(resolveRuntimeSourceObjectKey('authoring:other/place/file.md', release))
      .toEqual({ reason: 'authoring-path-unmapped' });
  });

  it('records null and non-asset source paths without guessing', () => {
    const release = releaseFixture();
    expect(resolveRuntimeSourceObjectKey(null, release)).toEqual({ reason: 'null-source-path' });
    expect(resolveRuntimeSourceObjectKey('db:TeachingResource:x', release))
      .toEqual({ reason: 'non-asset-source-path' });
  });
});

describe('adaptive path node runtime binding resolution (#2055)', () => {
  const nodes = [
    { nodeId: 'knowledge-card:Bode图_1_1', nodeType: 'knowledge_card' },
    { nodeId: 'runtime-media:1-1:1-1-intro-video', nodeType: 'video' },
    { nodeId: 'runtime-media:1-1:1-1-course', nodeType: 'video' },
    { nodeId: 'runtime-handout:1-1', nodeType: 'handout' },
    { nodeId: 'runtime-media:2-1:2-1-audio', nodeType: 'audio' },
    { nodeId: 'arena-task:task-cruise-roll', nodeType: 'arena_task' },
    { nodeId: 'quiz-node-1', nodeType: 'adaptive_quiz' },
  ];
  const projection = projectionFixture([
    { resourceId: 'act:card:Bode图_1_1', resourceType: 'card', sourcePath: `content:${SHA_A}` },
    { resourceId: 'act:video:1-1', resourceType: 'video', sourcePath: `content:${SHA_B}` },
    { resourceId: 'act:handout:1-1', resourceType: 'handout', sourcePath: null },
    { resourceId: 'act:audio:2-1', resourceType: 'audio', sourcePath: 'authoring:lessons/2-1/media/processed/2-1-audio.m4a' },
    { resourceId: 'act:simulation:arena-task-cruise-roll', resourceType: 'simulation', sourcePath: null },
  ]);
  const release = releaseFixture([
    { path: 'knowledge/cards/nodes/card.md', sha256: SHA_A },
    { path: 'lessons/2-1/media/2-1-audio.m4a', sha256: SHA_C },
  ]);

  it('binds identities through the active release and skips platform-native node types', () => {
    const bindings = resolveAdaptivePathNodeRuntimeBindings({ nodes, projection, release });
    const byNodeId = new Map(bindings.map((binding) => [binding.nodeId, binding]));
    expect(byNodeId.get('knowledge-card:Bode图_1_1')).toMatchObject({
      state: 'bound', objectKey: `blob:${SHA_A}`, resourceId: 'act:card:Bode图_1_1',
      runtimeReleaseId: 'runtime-release-1', projectionId: 'proj-fixture',
    });
    expect(byNodeId.get('runtime-media:2-1:2-1-audio')).toMatchObject({
      state: 'bound', objectKey: 'lessons/2-1/media/2-1-audio.m4a', contentSha256: SHA_C,
    });
    // 平台原生类型（quiz 等）不产生绑定记录。
    expect(byNodeId.has('quiz-node-1')).toBe(false);
  });

  it('records explicit failure states with reasons instead of silently dropping', () => {
    const bindings = resolveAdaptivePathNodeRuntimeBindings({ nodes, projection, release });
    const byNodeId = new Map(bindings.map((binding) => [binding.nodeId, binding]));
    // B′′ 内容键不在活动 release：not-in-active-release。
    expect(byNodeId.get('runtime-media:1-1:1-1-intro-video')).toMatchObject({
      state: 'not-in-active-release', reason: 'content-key-not-in-release', resourceId: 'act:video:1-1',
    });
    // 未身份化媒体：no-runtime-identity。
    expect(byNodeId.get('runtime-media:1-1:1-1-course')).toMatchObject({
      state: 'no-runtime-identity', reason: 'unmapped-node-id',
    });
    // sourcePath 为 null（身份型资源）：no-runtime-identity。
    expect(byNodeId.get('runtime-handout:1-1')).toMatchObject({
      state: 'no-runtime-identity', reason: 'null-source-path',
    });
    expect(byNodeId.get('arena-task:task-cruise-roll')).toMatchObject({
      state: 'no-runtime-identity', reason: 'null-source-path',
    });
  });

  it('marks all asset-bearing nodes no-active-release when the release is absent', () => {
    const bindings = resolveAdaptivePathNodeRuntimeBindings({ nodes, projection, release: null });
    expect(bindings).toHaveLength(6);
    expect(bindings.every((binding) => binding.state === 'no-active-release')).toBe(true);
    expect(deriveAdaptivePathRuntimeBindingLimitationCodes(bindings)).toEqual(['no-active-runtime-release']);
  });

  it('reports zero-bindable limitation when no node binds', () => {
    const bindings = resolveAdaptivePathNodeRuntimeBindings({
      nodes: nodes.filter((node) => node.nodeType !== 'adaptive_quiz'),
      projection,
      release: releaseFixture(),
    });
    expect(deriveAdaptivePathRuntimeBindingLimitationCodes(bindings))
      .toEqual(['no-bindable-runtime-resources']);
  });

  it('summarizes pool-level bindable counts by family', () => {
    const bindings = resolveAdaptivePathNodeRuntimeBindings({ nodes, projection, release });
    const summary = summarizeAdaptivePathRuntimeBindings(bindings, new Map([
      ['knowledge-card:Bode图_1_1', 'knowledge_graph'],
      ['runtime-media:2-1:2-1-audio', 'runtime_lesson_media'],
    ]));
    expect(summary.byState).toEqual({ bound: 2, 'no-runtime-identity': 3, 'not-in-active-release': 1 });
    expect(summary.boundByFamily).toEqual({ knowledge_graph: 1, runtime_lesson_media: 1 });
    expect(summary.activeRuntimeReleaseId).toBe('runtime-release-1');
  });
});

import { describe, expect, it } from 'vitest';

import { GOVERNED_MATH_PRESENTATION_BUNDLE } from '@/lib/governed-math/sidecar';
import {
  KnowledgeSurfaceCache,
  buildKnowledgeSurfaceCacheKey,
  classifyLearningContentManifest,
  closeResourceBlockWithRegistryIndex,
  knowledgeSurfaceFromCandidateProjection,
  knowledgeSurfaceFromLegacyGraph,
  knowledgeSurfaceFromLearnerShard,
  projectSourceOwnedLaunchDescriptor,
  readKnowledgeSurface,
} from '@/lib/knowledge-surface';
import type { AuthorityNodeDetailShard, AuthorityRootShard } from '@/lib/authority-domain-shards/contracts';

const authority = {
  snapshotId: 'snap-1',
  snapshotHash: 'a'.repeat(64),
  releaseId: 'rel-1',
  releaseSetId: 'set-1',
  activationId: 'act-1',
  activationHash: 'b'.repeat(64),
} as const;

const teaching = {
  projectionId: 'teach-1',
  projectionHash: 'c'.repeat(64),
  scopeId: 'scope-1',
  cacheFamily: 'family-1',
} as const;

const registryIndex = {
  contract: 'resource-registry-index/v1',
  identity: 'd'.repeat(64),
  digest: 'e'.repeat(64),
} as const;
const verifiedLatestCutover = {
  ready: true,
  combination: 'successor' as const,
  identities: {
    activeReceiptSha256: '1'.repeat(64),
    authorityCurrentSha256: '2'.repeat(64),
    runtime: {
      releaseId: 'runtime-1',
      manifestSha256: '3'.repeat(64),
      treeSha256: '4'.repeat(64),
      generation: 44,
    },
    extensionSha256: '5'.repeat(64),
    domainCatalogSha256: '6'.repeat(64),
    domainShardSetSha256: '7'.repeat(64),
    teachingProjectionSha256: '8'.repeat(64),
    teachingClosureSha256: '9'.repeat(64),
    composedDomainFragmentManifestSha256: 'a'.repeat(64),
    domainFragmentSetSha256: 'b'.repeat(64),
    prerequisitePublicationSha256: 'c'.repeat(64),
    consumerActivationSha256: 'd'.repeat(64),
    formalResourceEnvelopeSha256: 'e'.repeat(64),
  },
  reasons: [],
};

function envelope(matchTeaching: boolean | null = null): AuthorityRootShard['envelope'] {
  return {
    contract: 'act-authority-shard-envelope/v1',
    authority: {
      ...authority,
      projectionId: null,
      projectionHash: null,
    },
    catalog: { catalogId: 'cat-1', catalogHash: 'f'.repeat(64), catalogVersion: 'v1' },
    teaching: matchTeaching === true
      ? { status: 'available', projectionId: teaching.projectionId, projectionHash: teaching.projectionHash, teachingCacheFamily: teaching.cacheFamily }
      : { status: 'unavailable', projectionId: null, projectionHash: null, teachingCacheFamily: null },
    match: { authority: true, catalog: true, teaching: matchTeaching },
  };
}

describe('readKnowledgeSurface contract', () => {
  it('binds Authority only for engineering detail without inventing teaching identity', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'detail',
      role: 'STUDENT',
      surfaceKey: 'ctc:engineering',
      authority,
      includeTeachingContent: false,
      includeResourceContent: false,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.authority).toMatchObject(authority);
    expect(result.knowledgeSurface.teaching).toBeNull();
    expect(result.knowledgeSurface.registryIndex).toBeNull();
    expect(result.knowledgeSurface.blocks.engineering.status).toBe('available');
    expect(result.knowledgeSurface.blocks.teaching.status).toBe('not-applicable');
    expect(result.knowledgeSurface.mode).toBe('active');
    expect(result.knowledgeSurface.latestCutover).toMatchObject({
      ready: false,
      combination: 'unknown',
    });
  });

  it('requires matching Teaching Projection, scope, and RegistryIndex when teaching content is included', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'detail',
      role: 'TEACHER',
      surfaceKey: 'ctc:card',
      authority,
      teaching,
      teachingMatch: true,
      registryIndex,
      includeTeachingContent: true,
      includeResourceContent: true,
      learningContentStatus: 'available',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.teaching).toEqual(teaching);
    expect(result.knowledgeSurface.registryIndex).toEqual(registryIndex);
    expect(result.knowledgeSurface.blocks.teaching.status).toBe('available');
    expect(result.knowledgeSurface.blocks.resources.status).toBe('available');
  });

  it('attaches an injected read-only latest-cutover proof without selecting a release', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'domain',
      role: 'STUDENT',
      surfaceKey: 'system-modeling',
      authority,
      latestCutover: verifiedLatestCutover,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.latestCutover).toEqual(verifiedLatestCutover);
    expect(result.cacheKey).toContain('act-knowledge-surface/v1');
    expect(JSON.stringify(result.knowledgeSurface.latestCutover)).not.toMatch(
      /\/Users|credential|signedUrl|X-Amz/iu,
    );
  });

  it('omits mismatched teaching/resource blocks while keeping engineering readable', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'detail',
      role: 'STUDENT',
      surfaceKey: 'ctc:mismatch',
      authority,
      teaching: { ...teaching, projectionHash: '0'.repeat(64) },
      teachingMatch: false,
      registryIndex,
      includeTeachingContent: true,
      includeResourceContent: true,
      learningContentStatus: 'available',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.blocks.engineering.status).toBe('available');
    expect(result.knowledgeSurface.blocks.teaching.status).toBe('identity-mismatch');
    expect(result.knowledgeSurface.teaching).toBeNull();
    expect(result.knowledgeSurface.registryIndex).toBeNull();
    expect(result.knowledgeSurface.blocks.resources.status).toBe('omitted');
    expect(result.knowledgeSurface.blocks.learningContent.status).toBe('omitted');
  });

  it('rejects client identity selectors instead of resolving a supplied release', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'root',
      role: 'STUDENT',
      surfaceKey: 'root',
      authority,
      searchParams: { releaseId: 'attacker', snapshotId: 'other' },
    });
    expect(result).toEqual({ status: 'selector-rejected', parameter: 'releaseId' });
  });

  it('isolates cache keys across mode, role, Authority, and projection identities', () => {
    const cache = new KnowledgeSurfaceCache();
    const activeKey = buildKnowledgeSurfaceCacheKey({
      mode: 'active', role: 'STUDENT', locale: 'zh-CN', kind: 'detail', surfaceKey: 'n1', authority,
    });
    const legacyKey = buildKnowledgeSurfaceCacheKey({
      mode: 'legacy', role: 'STUDENT', locale: 'zh-CN', kind: 'detail', surfaceKey: 'n1', authority,
    });
    const candidateKey = buildKnowledgeSurfaceCacheKey({
      mode: 'candidate', role: 'ADMIN', locale: 'zh-CN', kind: 'candidate-diagnostic', surfaceKey: 'n1', authority,
    });
    const teachingKey = buildKnowledgeSurfaceCacheKey({
      mode: 'active', role: 'STUDENT', locale: 'zh-CN', kind: 'detail', surfaceKey: 'n1', authority, teaching,
    });
    const registryKey = buildKnowledgeSurfaceCacheKey({
      mode: 'active', role: 'STUDENT', locale: 'zh-CN', kind: 'detail', surfaceKey: 'n1', authority, teaching, registryIndex,
    });
    const cutoverKey = buildKnowledgeSurfaceCacheKey({
      mode: 'active', role: 'STUDENT', locale: 'zh-CN', kind: 'detail', surfaceKey: 'n1', authority, latestCutover: verifiedLatestCutover,
    });
    expect(new Set([activeKey, legacyKey, candidateKey, teachingKey, registryKey, cutoverKey]).size).toBe(6);
    cache.set(activeKey, { mode: 'active' });
    cache.set(legacyKey, { mode: 'legacy' });
    expect(cache.get(activeKey)).toEqual({ mode: 'active' });
    expect(cache.get(legacyKey)).toEqual({ mode: 'legacy' });
    expect(cache.get(candidateKey)).toBeUndefined();
  });

  it('classifies v1 learning-content manifests as version-drift without synthesizing teaching', () => {
    const drifted = classifyLearningContentManifest({
      contract: 'act-authority-learning-content-manifest/v1',
      authorityReleaseId: authority.releaseId,
      authorityReleaseSetId: authority.releaseSetId,
      authoritySnapshotId: authority.snapshotId,
      authoritySnapshotHash: authority.snapshotHash,
      nodes: [],
    }, authority);
    expect(drifted.status).toBe('version-drift');
    const alias = classifyLearningContentManifest({
      contract: 'authority-learning-content-manifest/v1',
      nodes: [{ canonicalId: 'n1', summary: '# raw markdown $x$' }],
    }, authority);
    expect(alias.status).toBe('version-drift');
    const matched = classifyLearningContentManifest({
      contract: 'act-authority-learning-content-manifest/v2',
      authorityReleaseId: authority.releaseId,
      authorityReleaseSetId: authority.releaseSetId,
      authoritySnapshotId: authority.snapshotId,
      authoritySnapshotHash: authority.snapshotHash,
      nodes: [{ canonicalId: 'n1' }],
    }, authority);
    expect(matched.status).toBe('available');
  });

  it('delegates math identity to the existing #1543 presentation bundle', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'detail',
      role: 'STUDENT',
      locale: 'en',
      surfaceKey: 'ctc:math',
      authority,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.math).toEqual({
      owner: 'governed-rich-text-math-presentation',
      releaseId: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId,
      releaseHash: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash,
      locale: 'en',
    });
    expect(JSON.stringify(result.knowledgeSurface)).not.toMatch(/\$\$|\\frac|parseMarkdown|raw latex/i);
  });

  it('keeps domain shards bounded and shares one composite envelope', () => {
    const result = readKnowledgeSurface({
      mode: 'active',
      kind: 'domain',
      role: 'STUDENT',
      surfaceKey: 'modeling',
      authority,
      teaching,
      teachingMatch: true,
      includeTeachingContent: true,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.surface).toEqual({ kind: 'domain', id: 'modeling' });
    expect(result.knowledgeSurface).not.toHaveProperty('remaining');
    expect(result.knowledgeSurface).not.toHaveProperty('fullGraph');
    expect(result.knowledgeSurface.authority.releaseId).toBe(authority.releaseId);
    expect(result.knowledgeSurface.teaching?.projectionId).toBe(teaching.projectionId);
  });

  it('omits constructed and hidden launch targets', () => {
    expect(projectSourceOwnedLaunchDescriptor({
      title: '秘密评审',
      type: 'lesson',
      href: 'file:///tmp/secret.md',
      canonicalId: 'ctc:node',
    }).status).toBe('omitted');
    expect(projectSourceOwnedLaunchDescriptor({
      title: '猜测路径',
      type: 'lesson',
      href: '/knowledge/ctc:node',
      canonicalId: 'ctc:node',
    }).status).toBe('omitted');
    expect(projectSourceOwnedLaunchDescriptor({
      title: '签名地址',
      type: 'media',
      href: 'https://cdn.example/a?X-Amz-Signature=abc',
    }).status).toBe('omitted');
    const owned = projectSourceOwnedLaunchDescriptor({
      title: '看见全貌',
      type: 'lesson',
      href: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
      launcher: { contractClass: 'resource-registry-launch/v1', contractVersion: 'v1' },
    });
    expect(owned.status).toBe('available');
    if (owned.status !== 'available') return;
    expect(owned.descriptor.launch.kind).toBe('source-owned');
    expect(owned.descriptor.launch.href).toBe('/interactive-learning/courses/unit-1-1-see-the-full-picture');
  });

  it('projects an engineering-only root shard without a teaching identity', () => {
    const shard: AuthorityRootShard = {
      shardClass: 'root',
      envelope: envelope(null),
      root: {
        kind: 'presentation-root-catalog',
        domains: [],
        aggregate: {
          kind: 'presentation-aggregate',
          order: 0,
          displayName: '聚合',
          summary: '',
          presentationRole: 'aggregate',
          visualRole: 'aggregate',
          domainCount: 0,
        },
      },
    };
    const result = knowledgeSurfaceFromLearnerShard({
      shard,
      role: 'STUDENT',
      locale: 'zh-CN',
      classifyLearningContent: false,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.mode).toBe('active');
    expect(result.knowledgeSurface.teaching).toBeNull();
    expect(result.knowledgeSurface.blocks.teaching.status).toBe('not-applicable');
    expect(result.knowledgeSurface.math).toBeNull();
  });

  it('does not join a mismatched teaching overlay onto a detail shard', () => {
    const shard: AuthorityNodeDetailShard = {
      shardClass: 'node-detail',
      envelope: envelope(false),
      node: {
        id: 'ctc:node',
        canonicalType: 'DomainConcept',
        label: '对象',
        description: '基础语义仍可读',
        teachingFields: {},
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
        sources: [],
        media: { cardAvailable: false, infographAvailable: false },
        semanticSupport: { supported: true, readOnly: true },
      },
    };
    const result = knowledgeSurfaceFromLearnerShard({
      shard,
      role: 'STUDENT',
      locale: 'zh-CN',
      classifyLearningContent: false,
      resourceBindings: { state: 'unavailable', message: '当前系统资源与所选对象身份不一致。' },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.blocks.engineering.status).toBe('available');
    expect(result.knowledgeSurface.blocks.teaching.status).toBe('identity-mismatch');
    expect(result.knowledgeSurface.teaching).toBeNull();
  });
});

describe('RegistryIndex resource closure', () => {
  const capture = 'a'.repeat(40);
  const href = '/interactive-learning/courses/unit-1-1-see-the-full-picture';

  function indexAt(revision: string, launcherRef = href) {
    return {
      contract: 'resource-registry-index/v1' as const,
      generatorVersion: 'resource-registry-index.v1',
      identity: '1'.repeat(64),
      digest: '2'.repeat(64),
      captures: [{
        owner: 'resource-registry-metadata',
        sourceKind: 'render-metadata' as const,
        adapterVersion: 'render-metadata.v1',
        inputDigest: '3'.repeat(64),
        recordCount: 1,
        sharedRevision: revision,
      }],
      entries: [{
        descriptor: {
          identity: {
            key: 'k1',
            sourceKind: 'render-metadata' as const,
            sourceRef: 'unit-1-1-see-the-full-picture',
            sourceVersion: 'render-metadata.v1',
            contentHash: '4'.repeat(64),
            scope: 'registry',
          },
          title: '看见全貌',
          type: 'INTERACTIVE_COMP',
          availability: 'available' as const,
          availabilityCode: 'available',
          status: '可用。',
          foreignRefs: { registryId: 'unit-1-1-see-the-full-picture' },
          launcher: {
            contractClass: 'owned-route',
            contractVersion: 'resource-launch-route.v1',
            launcherRef,
          },
        },
        access: {},
        required: true,
      }],
    };
  }

  const availableBindings = {
    state: 'available' as const,
    items: [{
      title: '看见全貌',
      bindingRole: '讲解' as const,
      resourceKind: '课程',
      availability: 'available' as const,
      launch: { kind: 'registry-resource' as const, href },
    }],
  };

  it('binds RegistryIndex identity only when capture revision and entries close', () => {
    const closed = closeResourceBlockWithRegistryIndex({
      bindings: availableBindings,
      index: indexAt(capture),
      expectedCaptureRevision: capture,
    });
    expect(closed.registryIndex?.identity).toBe('1'.repeat(64));
    expect(closed.registryIndex?.captureRevision).toBe(capture);
    expect(closed.bindings.state).toBe('available');
  });

  it('fails closed when live index capture differs from Teaching Projection revision', () => {
    const closed = closeResourceBlockWithRegistryIndex({
      bindings: availableBindings,
      index: indexAt('b'.repeat(40)),
      expectedCaptureRevision: capture,
    });
    expect(closed.registryIndex).toBeNull();
    expect(closed.bindings).toEqual({
      state: 'unavailable',
      message: '当前系统资源与所选对象身份不一致。',
    });
  });

  it('fails closed when returned launch items are not in the index', () => {
    const closed = closeResourceBlockWithRegistryIndex({
      bindings: availableBindings,
      index: indexAt(capture, '/interactive-learning/courses/other-course'),
      expectedCaptureRevision: capture,
    });
    expect(closed.registryIndex).toBeNull();
    expect(closed.bindings.state).toBe('unavailable');
  });

  it('keeps governed textbook reader hrefs without a RegistryIndex launcherRef match', () => {
    const textbookHref = '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-03/section-3.8';
    const closed = closeResourceBlockWithRegistryIndex({
      bindings: {
        state: 'available',
        items: [{
          title: 'Dorf 3.8',
          bindingRole: '讲解',
          resourceKind: '教材',
          availability: 'available',
          launch: { kind: 'direct-route', href: textbookHref },
        }],
      },
      index: indexAt(capture),
      expectedCaptureRevision: capture,
    });
    expect(closed.bindings.state).toBe('available');
    if (closed.bindings.state !== 'available') return;
    expect(closed.bindings.items[0]?.launch.href).toBe(textbookHref);
    expect(closed.registryIndex?.captureRevision).toBe(capture);
  });
});

describe('candidate knowledge-surface identity', () => {
  it('does not alias sourceDatasetHash or releaseHash as snapshot identity', () => {
    const dataset = 'c'.repeat(64);
    const releaseHash = 'd'.repeat(64);
    const result = knowledgeSurfaceFromCandidateProjection({
      source: {
        authorityState: 'candidate',
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
        productionAuthoritative: false,
        historical: false,
        sourceDatasetHash: dataset,
        releaseHash,
      },
      role: 'ADMIN',
      surfaceKey: 'canvas',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.authority.snapshotId).toBeNull();
    expect(result.knowledgeSurface.authority.snapshotHash).toBeNull();
    expect(result.knowledgeSurface.authority.sourceDatasetHash).toBe(dataset);
    expect(result.knowledgeSurface.authority.releaseHash).toBe(releaseHash);
    expect(result.knowledgeSurface.authority.snapshotId).not.toBe(dataset);
    expect(result.knowledgeSurface.authority.snapshotHash).not.toBe(releaseHash);
    expect(result.knowledgeSurface.mode).toBe('candidate');
    expect(result.knowledgeSurface.latestCutover).toMatchObject({
      ready: false,
      combination: 'unknown',
    });
  });

  it('never reports a legacy graph as a successful latest cutover', () => {
    const result = knowledgeSurfaceFromLegacyGraph({
      source: 'file',
      kind: 'root',
      surfaceKey: 'root',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.latestCutover).toMatchObject({
      ready: false,
      combination: 'unknown',
    });
  });

  it('fails closed when an incomplete Authority snapshot overlay is supplied', () => {
    const result = knowledgeSurfaceFromCandidateProjection({
      source: {
        authorityState: 'candidate',
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
        productionAuthoritative: false,
        historical: false,
      },
      role: 'ADMIN',
      surfaceKey: 'canvas',
      authoritySnapshot: { snapshotId: 'snap-1', snapshotHash: '' },
    });
    expect(result).toEqual({
      status: 'identity-unavailable',
      reason: 'candidate-snapshot-identity-incomplete',
    });
  });

  it('binds a real Authority snapshot overlay without rewriting candidate release fields', () => {
    const result = knowledgeSurfaceFromCandidateProjection({
      source: {
        authorityState: 'candidate',
        releaseSetId: 'set-1',
        releaseId: 'rel-1',
        productionAuthoritative: false,
        historical: false,
        sourceDatasetHash: 'c'.repeat(64),
      },
      role: 'ADMIN',
      surfaceKey: 'n1',
      authoritySnapshot: { snapshotId: 'snap-real', snapshotHash: 'e'.repeat(64) },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.knowledgeSurface.authority.snapshotId).toBe('snap-real');
    expect(result.knowledgeSurface.authority.snapshotHash).toBe('e'.repeat(64));
    expect(result.knowledgeSurface.authority.releaseId).toBe('rel-1');
    expect(result.knowledgeSurface.authority.sourceDatasetHash).toBe('c'.repeat(64));
  });
});

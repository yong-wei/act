import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildLocalPublishedMediaIndex, buildPublishedResourceFeatureIndex } from '@/lib/published-resource-index';
import { buildPublishedResourceHref, parsePublishedResourceHref } from '@/lib/published-resource-reference';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';
import type { AnyActRuntimeReleaseManifest } from '@/lib/runtime-release';
import type { TeachingProjectionArtifacts, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

function resource(resourceId: string, resourceType: TeachingResourceRuntime['resourceType'], sourcePath: string): TeachingResourceRuntime {
  return {
    resourceId, resourceType, projectionMode: 'REQUIRED', scopeId: 'fixture', title: resourceId,
    sourcePath, legacyCrosswalkRef: null, bindingCount: 1, bindingStatus: 'BOUND',
    projectionStatus: 'BOUND', bindingDigest: HASH_C,
  };
}

function fixtureArtifacts(resources: TeachingResourceRuntime[]): TeachingProjectionArtifacts {
  return {
    resources,
    bindings: resources.map((entry, index) => ({
      bindingId: `binding-${index}`, resourceId: entry.resourceId, canonicalId: `node.${index}`,
      role: 'EXPLAINS' as const, scopeId: 'fixture', sourcePath: null, primary: true, rationale: 'fixture',
    })),
    prerequisites: [], coreNodes: [],
    cardsIndex: { contract: 'act-teaching-projection-cards-index/v1', cards: [] },
    manifest: {
      contract: 'act-teaching-projection-manifest/v1', builderVersion: 'fixture', scopeId: 'fixture',
      authoringRevision: 'd'.repeat(40), authorityReleaseId: 'authority-fixture', authorityReleaseSetId: null,
      authoritySnapshotId: `snap-${HASH_B}`, authoritySnapshotHash: HASH_B,
      sourceHashes: { resources: HASH_A, bindings: HASH_B, prerequisites: HASH_C, coreNodes: HASH_A,
        cards: HASH_B, authorityNodes: HASH_C, authoringBody: HASH_A, gate: HASH_B },
      resourceCount: resources.length, bindingCount: resources.length, prerequisiteCount: 0, coreNodeCount: 0,
      cardCount: 0, gateStatus: 'PUBLISHED', gatePassed: true, projectionId: `proj-${HASH_A}`, projectionHash: HASH_A,
    },
    impactReport: {
      contract: 'act-teaching-projection-impact/v1', projectionId: `proj-${HASH_A}`, projectionHash: HASH_A,
      records: [], summary: { includedResourceCount: resources.length, includedBindingCount: resources.length,
        notProjectedAuthorityNodeCount: 0, gateErrorCount: 0 },
    },
    gate: { status: 'PUBLISHED', passed: true, findings: [], unboundRequiredResourceIds: [],
      notProjectedCanonicalIds: [], unboundOptionalResourceIds: [] },
  };
}

function fixtureEngineering(count: number): AuthorityEngineeringBody {
  return {
    objects: Array.from({ length: count }, (_, index) => ({
      canonicalId: `node.${index}`, ordinal: index, canonicalType: 'concept', semanticName: `概念${index}`,
      reviewStatus: 'reviewed', publicationStatus: 'published', lifecycleStatus: 'active', payload: {},
    })),
    relations: [], sourceMappings: [], sourceObjects: [], evidence: [], releaseEntries: [],
    upstreamRagReferences: [], releaseComponents: [], projectionIdentities: [], linkMetadata: [],
  };
}

function build(resources: TeachingResourceRuntime[], options: {
  runtimeRoot?: string;
  runtimeManifest?: AnyActRuntimeReleaseManifest | null;
  localContentMedia?: ReadonlyMap<string, string>;
} = {}) {
  return buildPublishedResourceFeatureIndex({
    artifacts: fixtureArtifacts(resources), engineering: fixtureEngineering(resources.length),
    runtimeReleaseId: options.runtimeManifest?.releaseId ?? null,
    runtimeManifest: options.runtimeManifest, runtimeRoot: options.runtimeRoot, localContentMedia: options.localContentMedia,
    cardReader: () => null, infographTokens: new Set(), now: new Date('2026-09-08T00:00:00.000Z'),
  });
}

describe('published resource media backends', () => {
  it('resolves content-addressed local media only after verifying the actual file bytes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'published-local-hash-'));
    try {
      mkdirSync(join(root, 'lessons/1-1/media'), { recursive: true });
      const file = join(root, 'lessons/1-1/media/video.mp4');
      const bytes = 'known media bytes';
      const hash = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(file, bytes);
      const resources = [resource('act:video:1-1', 'video', `content:${hash}`)];
      const localContentMedia = await buildLocalPublishedMediaIndex(resources, root);
      expect(localContentMedia.get(hash)).toBe('lessons/1-1/media/video.mp4');
      expect(build(resources, { runtimeRoot: root, localContentMedia }).resources[0].backend).toMatchObject({ kind: 'media' });
      writeFileSync(file, 'different media bytes');
      const changed = await buildLocalPublishedMediaIndex(resources, root);
      expect(changed.has(hash)).toBe(false);
      expect(build(resources, { runtimeRoot: root, localContentMedia: changed }).resources[0].recommendable).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('maps local authoring media to direct API asset URLs and keeps the content summary grounded', () => {
    const root = mkdtempSync(join(tmpdir(), 'published-resource-media-'));
    try {
      mkdirSync(join(root, 'lessons/1-1/media'), { recursive: true });
      writeFileSync(join(root, 'lessons/1-1/media/1-1-audio.m4a'), 'audio');
      writeFileSync(join(root, 'lessons/1-1/media/1-1-intro-video.mp4'), 'video');
      writeFileSync(join(root, 'lessons/1-1/media/1-1-podcast.mp3'), 'podcast');
      const index = build([
        resource('act:audio:1-1', 'audio', 'authoring:lessons/1-1/media/processed/1-1-audio.m4a'),
        resource('act:video:1-1', 'video', 'authoring:lessons/1-1/media/processed/1-1-intro-video.mp4'),
        resource('act:podcast:1-1', 'podcast', 'authoring:lessons/1-1/media/processed/1-1-podcast.mp3'),
      ], { runtimeRoot: root });
      const audio = index.resources.find((entry) => entry.type === 'audio')!;
      const video = index.resources.find((entry) => entry.type === 'video')!;
      const podcast = index.resources.find((entry) => entry.type === 'podcast')!;

      expect(audio.backend).toEqual({ kind: 'media', mediaType: 'audio', assetPath: 'lessons/1-1/media/1-1-audio.m4a',
        href: '/api/course-runtime/assets/lessons/1-1/media/1-1-audio.m4a' });
      expect(video.backend).toEqual({ kind: 'media', mediaType: 'video', assetPath: 'lessons/1-1/media/1-1-intro-video.mp4',
        href: '/api/course-runtime/assets/lessons/1-1/media/1-1-intro-video.mp4' });
      expect(podcast.backend).toEqual({ kind: 'media', mediaType: 'audio', assetPath: 'lessons/1-1/media/1-1-podcast.mp3',
        href: '/api/course-runtime/assets/lessons/1-1/media/1-1-podcast.mp3' });
      expect(audio.recommendable).toBe(true);
      expect(audio.summary).toContain('概念0');
      expect(audio.summary).toContain('讲解');
      expect(parsePublishedResourceHref(buildPublishedResourceHref(audio.identity))).toEqual(audio.identity);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a content hash that is absent from the selected runtime manifest', () => {
    const manifest = {
      schemaVersion: 'act-runtime-release.v1', releaseId: 'runtime-fixture-v1', sourceRevision: 'e'.repeat(40),
      fileCount: 1, totalBytes: 5, treeSha256: HASH_A, manifestSha256: HASH_B,
      files: [{ path: 'lessons/1-1/media/1-1-intro-video.mp4', objectKey: 'runtime/releases/runtime-fixture-v1/lessons/1-1/media/1-1-intro-video.mp4', sizeBytes: 5, sha256: HASH_C }],
    } satisfies AnyActRuntimeReleaseManifest;
    const feature = build([resource('act:video:1-1', 'video', `content:${HASH_A}`)], { runtimeManifest: manifest }).resources[0]!;

    expect(feature.backend.kind).toBe('reference-only');
    expect(feature.recommendable).toBe(false);
  });

  it('maps content hashes only through an exact media member in the release manifest', () => {
    const manifest = {
      schemaVersion: 'act-runtime-release.v1', releaseId: 'runtime-fixture-v1', sourceRevision: 'e'.repeat(40),
      fileCount: 1, totalBytes: 5, treeSha256: HASH_A, manifestSha256: HASH_B,
      files: [{ path: 'lessons/1-1/media/1-1-intro-video.mp4', objectKey: 'runtime/releases/runtime-fixture-v1/lessons/1-1/media/1-1-intro-video.mp4', sizeBytes: 5, sha256: HASH_C }],
    } satisfies AnyActRuntimeReleaseManifest;
    const index = build([resource('act:video:1-1', 'video', `content:${HASH_C}`)], { runtimeManifest: manifest });
    const feature = index.resources[0]!;

    expect(feature.backend).toEqual({ kind: 'media', mediaType: 'video', assetPath: 'lessons/1-1/media/1-1-intro-video.mp4',
      href: '/api/course-runtime/assets/lessons/1-1/media/1-1-intro-video.mp4?releaseId=runtime-fixture-v1' });
    expect(feature.backend).not.toMatchObject({ href: expect.stringContaining('blob-assets') });
    expect(feature.recommendable).toBe(true);
  });

  it('keeps a media resource version stable when the same bytes are repackaged', () => {
    const mediaResource = resource('act:video:1-1', 'video', `content:${HASH_C}`);
    const firstManifest = {
      schemaVersion: 'act-runtime-release.v1', releaseId: 'runtime-fixture-v1', sourceRevision: 'e'.repeat(40),
      fileCount: 1, totalBytes: 5, treeSha256: HASH_A, manifestSha256: HASH_B,
      files: [{ path: 'lessons/1-1/media/1-1-intro-video.mp4', objectKey: 'runtime/releases/runtime-fixture-v1/lessons/1-1/media/1-1-intro-video.mp4', sizeBytes: 5, sha256: HASH_C }],
    } satisfies AnyActRuntimeReleaseManifest;
    const secondManifest = {
      ...firstManifest,
      releaseId: 'runtime-fixture-v2',
      files: firstManifest.files.map((file) => ({
        ...file,
        objectKey: file.objectKey.replace('runtime-fixture-v1', 'runtime-fixture-v2'),
      })),
    } satisfies AnyActRuntimeReleaseManifest;

    const first = build([mediaResource], { runtimeManifest: firstManifest }).resources[0]!;
    const second = build([mediaResource], { runtimeManifest: secondManifest }).resources[0]!;
    expect(first.identity.runtimeReleaseId).toBe('runtime-fixture-v1');
    expect(second.identity.runtimeReleaseId).toBe('runtime-fixture-v2');
    expect(second.version).toBe(first.version);
  });

  it('does not use local media mtime as the resource version', () => {
    const root = mkdtempSync(join(tmpdir(), 'published-resource-media-version-'));
    try {
      mkdirSync(join(root, 'lessons/1-1/media'), { recursive: true });
      const file = join(root, 'lessons/1-1/media/1-1-intro-video.mp4');
      writeFileSync(file, 'stable media bytes');
      const mediaResource = resource('act:video:1-1', 'video', 'authoring:lessons/1-1/media/processed/1-1-intro-video.mp4');
      const first = build([mediaResource], { runtimeRoot: root }).resources[0]!;
      utimesSync(file, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
      const repackaged = build([mediaResource], { runtimeRoot: root }).resources[0]!;
      expect(repackaged.version).toBe(first.version);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['act:audio:missing', 'audio', 'authoring:lessons/1-1/media/processed/missing.m4a'],
    ['act:audio:wrong-suffix', 'audio', 'authoring:lessons/1-1/media/processed/figure.png'],
    ['act:audio:traversal', 'audio', 'authoring:lessons/../media/processed/secret.m4a'],
  ] as const)('keeps %s reference-only when its media mapping is invalid', (_id, type, sourcePath) => {
    const root = mkdtempSync(join(tmpdir(), 'published-resource-media-'));
    try {
      mkdirSync(join(root, 'lessons/1-1/media'), { recursive: true });
      const index = build([resource(_id, type, sourcePath)], { runtimeRoot: root });
      expect(index.resources[0]?.backend.kind).toBe('reference-only');
      expect(index.resources[0]?.recommendable).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

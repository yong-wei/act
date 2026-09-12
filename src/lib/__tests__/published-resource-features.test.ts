import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { resolveLegacyTextbookResource, LEGACY_TEXTBOOK_RESOURCE_RESOLUTIONS } from '@/lib/engineering-textbook-mapping/legacy-resource-resolutions';
import { loadStructuralUnitIndex, resolveStructuralUnit } from '@/lib/engineering-textbook-mapping/coordinates';

import {
  buildPublishedResourceFeatureIndex,
} from '@/lib/published-resource-index';
import {
  buildPublishedResourceHref,
  parsePublishedResourceHref,
  publishedResourcePathType,
  type PublishedResourceIdentity,
} from '@/lib/published-resource-reference';
import type { TeachingProjectionArtifacts, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';
import type { AnyActRuntimeReleaseManifest } from '@/lib/runtime-release';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

describe('reviewed legacy textbook references', () => {
  it('resolves all eight references to the documented book and structural unit', async () => {
    const evidence = JSON.parse(readFileSync(join(process.cwd(),
      'course-content/authoring/knowledge/teaching-projection/textbook-locators/legacy-reference-resolutions.json'), 'utf8')) as {
        entries: Array<{ resourceId: string; bookId: string; edition: string; structuralPath: string[]; structuralUnitId: string }>;
      };
    expect(Object.keys(LEGACY_TEXTBOOK_RESOURCE_RESOLUTIONS).sort()).toEqual(evidence.entries.map((entry) => entry.resourceId).sort());
    expect(evidence.entries).toHaveLength(8);
    const units = await loadStructuralUnitIndex({ bookIds: [...new Set(evidence.entries.map((entry) => entry.bookId))] });
    for (const entry of evidence.entries) {
      const target = resolveLegacyTextbookResource(entry.resourceId)!;
      expect(target).toMatchObject({ bookId: entry.bookId, edition: entry.edition, structuralPath: entry.structuralPath });
      expect(resolveStructuralUnit(units, { bookId: target.bookId, structuralPath: target.structuralPath }).unitId).toBe(entry.structuralUnitId);
    }
    expect(resolveLegacyTextbookResource('act:textbook-section:cts.section-unknown')).toBeNull();
  });

  it('requires the pinned edition and unit, and versions the mapped subtree', () => {
    const root = mkdtempSync(join(tmpdir(), 'legacy-textbook-reference-'));
    const book = join(root, 'resources/textbooks-v2/dorf-modern-control-systems');
    mkdirSync(book, { recursive: true });
    const resource = versionResource('act:textbook-chapter:dorf-modern-control-systems-14th:ch-root-locus-01', 'textbook-chapter');
    const units = [
      { structuralPath: ['chapter-chapter-07'], chapterId: 'chapter-07', markdown: '# Root locus' },
      { structuralPath: ['chapter-chapter-07', 'section-7.3'], chapterId: 'chapter-07', markdown: 'Departure angles' },
    ];
    try {
      expect(buildVersionIndex([resource], { runtimeRoot: root }).resources[0].backend).toEqual({
        kind: 'route',
        href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-07',
      });
      writeFileSync(join(book, 'manifest.json'), JSON.stringify({ bookId: 'dorf-modern-control-systems', edition: '14th Global Edition' }));
      writeFileSync(join(book, 'units.jsonl'), units.map((unit) => JSON.stringify(unit)).join('\n'));
      const first = buildVersionIndex([resource], { runtimeRoot: root }).resources[0];
      expect(first.backend).toEqual({ kind: 'route', href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-07' });
      units[1].markdown = 'Updated departure-angle explanation';
      writeFileSync(join(book, 'units.jsonl'), units.map((unit) => JSON.stringify(unit)).join('\n'));
      expect(buildVersionIndex([resource], { runtimeRoot: root }).resources[0].version).not.toBe(first.version);
      writeFileSync(join(book, 'manifest.json'), JSON.stringify({ bookId: 'dorf-modern-control-systems', edition: 'wrong edition' }));
      expect(buildVersionIndex([resource], { runtimeRoot: root }).resources[0].backend).toEqual({
        kind: 'route',
        href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-07',
      });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('accepts manifest-owned blob-view links and rejects different target bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'textbook-blob-view-'));
    const prefix = 'resources/textbooks-v2/dorf-modern-control-systems';
    const book = join(root, prefix);
    const blobs = join(root, '.act-runtime-blobs');
    mkdirSync(book, { recursive: true });
    mkdirSync(blobs);
    const resource = versionResource('act:textbook-chapter:dorf-modern-control-systems-14th:ch-root-locus-01', 'textbook-chapter');
    const bytes = {
      'manifest.json': JSON.stringify({ bookId: 'dorf-modern-control-systems', edition: '14th Global Edition' }),
      'units.jsonl': JSON.stringify({ structuralPath: ['chapter-chapter-07'], chapterId: 'chapter-07', markdown: '# Root locus' }),
    };
    const manifest = { schemaVersion: 'act-runtime-release.v2', releaseId: 'runtime-fixture',
      files: Object.entries(bytes).map(([name, content]) => ({ path: prefix + '/' + name,
        sha256: createHash('sha256').update(content).digest('hex') })) } as AnyActRuntimeReleaseManifest;
    try {
      for (const [name, content] of Object.entries(bytes)) {
        writeFileSync(join(blobs, name), content);
        symlinkSync(join(blobs, name), join(book, name));
      }
      expect(buildVersionIndex([resource], { runtimeRoot: root, runtimeManifest: manifest }).resources[0].backend.kind).toBe('route');
      expect(buildVersionIndex([resource], { runtimeRoot: root }).resources[0].backend).toEqual({
        kind: 'route',
        href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-07',
      });
      writeFileSync(join(blobs, 'units.jsonl'), bytes['units.jsonl'] + '\nchanged');
      expect(buildVersionIndex([resource], { runtimeRoot: root, runtimeManifest: manifest }).resources[0].backend.kind).toBe('route');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

function identity(resourceId: string): PublishedResourceIdentity {
  return {
    resourceId,
    projectionId: `proj-${HASH_A}`,
    projectionHash: HASH_A,
    snapshotId: `snap-${HASH_B}`,
    snapshotHash: HASH_B,
    runtimeReleaseId: 'runtime-fixture-v1',
  };
}

function fixtureArtifacts(): TeachingProjectionArtifacts {
  return {
    resources: [{
      resourceId: 'act:card:fixture-card',
      resourceType: 'card',
      projectionMode: 'REQUIRED',
      scopeId: 'fixture',
      title: '投影知识卡',
      sourcePath: null,
      legacyCrosswalkRef: null,
      bindingCount: 1,
      bindingStatus: 'BOUND',
      projectionStatus: 'BOUND',
      bindingDigest: HASH_C,
    }],
    bindings: [{
      bindingId: 'binding-fixture-card',
      resourceId: 'act:card:fixture-card',
      canonicalId: 'node.fixture',
      role: 'COVERS',
      scopeId: 'fixture',
      sourcePath: null,
      primary: true,
      rationale: 'fixture binding',
    }],
    prerequisites: [],
    coreNodes: [],
    cardsIndex: { contract: 'act-teaching-projection-cards-index/v1', cards: [] },
    manifest: {
      contract: 'act-teaching-projection-manifest/v1',
      builderVersion: 'act-teaching-projection-builder/v1',
      scopeId: 'fixture',
      authoringRevision: 'd'.repeat(40),
      authorityReleaseId: 'authority-fixture-v1',
      authorityReleaseSetId: null,
      authoritySnapshotId: `snap-${HASH_B}`,
      authoritySnapshotHash: HASH_B,
      sourceHashes: {
        resources: HASH_A, bindings: HASH_B, prerequisites: HASH_C,
        coreNodes: HASH_A, cards: HASH_B, authorityNodes: HASH_C,
        authoringBody: HASH_A, gate: HASH_B,
      },
      resourceCount: 1,
      bindingCount: 1,
      prerequisiteCount: 0,
      coreNodeCount: 0,
      cardCount: 0,
      gateStatus: 'PUBLISHED',
      gatePassed: true,
      projectionId: `proj-${HASH_A}`,
      projectionHash: HASH_A,
    },
    impactReport: {
      contract: 'act-teaching-projection-impact/v1',
      projectionId: `proj-${HASH_A}`,
      projectionHash: HASH_A,
      records: [],
      summary: { includedResourceCount: 1, includedBindingCount: 1, notProjectedAuthorityNodeCount: 0, gateErrorCount: 0 },
    },
    gate: {
      status: 'PUBLISHED',
      passed: true,
      findings: [],
      unboundRequiredResourceIds: [],
      notProjectedCanonicalIds: [],
      unboundOptionalResourceIds: [],
    },
  };
}

function fixtureEngineering(): AuthorityEngineeringBody {
  return {
    objects: [{
      canonicalId: 'node.fixture', ordinal: 1, canonicalType: 'concept', semanticName: 'Fixture',
      reviewStatus: 'reviewed', publicationStatus: 'published', lifecycleStatus: 'active', payload: {},
    }],
    relations: [], sourceMappings: [], sourceObjects: [], evidence: [], releaseEntries: [],
    upstreamRagReferences: [], releaseComponents: [], projectionIdentities: [], linkMetadata: [],
  };
}

function versionResource(
  resourceId: string,
  resourceType: TeachingResourceRuntime['resourceType'],
  sourcePath: string | null = null,
  bindingDigest: string | null = HASH_C,
): TeachingResourceRuntime {
  return {
    resourceId, resourceType, projectionMode: 'REQUIRED', scopeId: 'fixture', title: resourceId,
    sourcePath, legacyCrosswalkRef: null, bindingCount: 1, bindingStatus: 'BOUND',
    projectionStatus: 'BOUND', bindingDigest,
  };
}

function versionFixtureArtifacts(
  resources: TeachingResourceRuntime[],
  projectionHash: string,
): TeachingProjectionArtifacts {
  const base = fixtureArtifacts();
  const bindings = resources.map((resource, index) => ({
    bindingId: `binding-version-${index}`, resourceId: resource.resourceId,
    canonicalId: 'node.fixture', role: 'COVERS' as const, scopeId: 'fixture',
    sourcePath: null, primary: true, rationale: 'version fixture',
  }));
  return {
    ...base,
    resources,
    bindings,
    manifest: {
      ...base.manifest,
      projectionId: `proj-${projectionHash}`,
      projectionHash,
      resourceCount: resources.length,
      bindingCount: bindings.length,
    },
    impactReport: {
      ...base.impactReport,
      projectionId: `proj-${projectionHash}`,
      projectionHash,
      summary: {
        ...base.impactReport.summary,
        includedResourceCount: resources.length,
        includedBindingCount: bindings.length,
      },
    },
  };
}

function buildVersionIndex(
  resources: TeachingResourceRuntime[],
  options: {
    projectionHash?: string;
    runtimeReleaseId?: string | null;
    runtimeRoot?: string;
    runtimeManifest?: AnyActRuntimeReleaseManifest;
    infographTokens?: ReadonlySet<string>;
  } = {},
) {
  return buildPublishedResourceFeatureIndex({
    artifacts: versionFixtureArtifacts(resources, options.projectionHash ?? HASH_A),
    engineering: fixtureEngineering(),
    runtimeReleaseId: options.runtimeReleaseId ?? null,
    runtimeRoot: options.runtimeRoot,
    runtimeManifest: options.runtimeManifest,
    cardReader: () => null,
    infographTokens: options.infographTokens ?? new Set(),
    now: new Date('2026-09-08T00:00:00.000Z'),
  });
}

describe('published resource feature references', () => {
  it('round-trips opaque IDs, including textbook section-1 through section-5', () => {
    for (const section of ['section-1', 'section-2', 'section-3', 'section-4', 'section-5', 'section-1..5']) {
      const ref = identity(`act:textbook-section:fixture-book:${section}`);
      const href = buildPublishedResourceHref(ref);

      expect(href).toContain('/learning-resources/');
      expect(href).not.toContain('/textbooks/');
      expect(parsePublishedResourceHref(href)).toEqual(ref);
    }
  });

  it.each([
    '/learning-resources/act%3Acard%3Afixture-card',
    '/learning-resources/act%3Acard%3Afixture-card/child?projection=proj-' + HASH_A + '&projectionHash=' + HASH_A + '&snapshot=snap-' + HASH_B + '&snapshotHash=' + HASH_B,
    '/learning-resources/act%3Acard%3Afixture-card?projection=proj-' + HASH_B + '&projectionHash=' + HASH_A + '&snapshot=snap-' + HASH_B + '&snapshotHash=' + HASH_B,
    '/learning-resources/act%3Acard%3Afixture-card?projection=proj-' + HASH_A + '&projectionHash=' + HASH_A + '&snapshot=snap-' + HASH_B + '&snapshotHash=' + HASH_B + '&projection=proj-' + HASH_A,
    '/learning-resources/act%3Acard%3Afixture%2Fcard?projection=proj-' + HASH_A + '&projectionHash=' + HASH_A + '&snapshot=snap-' + HASH_B + '&snapshotHash=' + HASH_B,
    'https://evil.example/learning-resources/act%3Acard%3Afixture-card?projection=proj-' + HASH_A + '&projectionHash=' + HASH_A + '&snapshot=snap-' + HASH_B + '&snapshotHash=' + HASH_B,
  ])('rejects malformed or non-local href %s', (href) => {
    expect(parsePublishedResourceHref(href)).toBeNull();
  });

  it('builds the published feature index from a small fixture and binds card metadata', () => {
    const index = buildPublishedResourceFeatureIndex({
      artifacts: fixtureArtifacts(),
      engineering: fixtureEngineering(),
      runtimeReleaseId: 'runtime-fixture-v1',
      cardReader: () => ({
        title: '真实卡标题', summary: '卡片摘要', insight: null, explanation: '卡片解释',
      }),
      infographTokens: new Set(),
      now: new Date('2026-09-08T00:00:00.000Z'),
    });
    const feature = index.resources[0];

    expect(index.contract).toBe('published-resource-features/v1');
    expect(index.indexId).toMatch(/^[a-f0-9]{64}$/);
    expect(feature).toEqual(expect.objectContaining({
      title: '真实卡标题',
      canonicalIds: ['node.fixture'],
      bindingIds: ['binding-fixture-card'],
      bindingRoles: ['COVERS'],
      executable: true,
      recommendable: true,
    }));
    expect(parsePublishedResourceHref(buildPublishedResourceHref(feature.identity))).toEqual(feature.identity);
    expect(feature.version).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps no-content resource versions stable across unrelated projection and runtime releases', () => {
    const root = mkdtempSync(join(tmpdir(), 'published-resource-version-'));
    const infographToken = 'fixture-infographic';
    const stepPath = join(root, 'lessons/fixture/interactive-manifest.json');
    const textbookUnitsPath = join(root, 'resources/textbooks-v2/dorf-modern-control-systems/units.jsonl');
    try {
      mkdirSync(join(root, 'knowledge/infographs/nodes'), { recursive: true });
      mkdirSync(join(root, 'lessons/fixture'), { recursive: true });
      mkdirSync(join(root, 'resources/textbooks-v2/dorf-modern-control-systems'), { recursive: true });
      writeFileSync(join(root, 'knowledge/infographs/nodes', `${infographToken}.png`), 'infographic bytes');
      writeFileSync(stepPath, JSON.stringify({ steps: {
        'step-01': { title: 'Step one', content: ['stable'] },
        'step-02': { title: 'Step two', content: ['unrelated'] },
      } }));
      writeFileSync(textbookUnitsPath, JSON.stringify({
        structuralPath: ['chapter-chapter-01', 'section-1.1'],
        chapterId: 'chapter-01', markdown: 'Textbook section body',
      }) + '\n');

      const resources = [
        versionResource(`act:infographic:${infographToken}`, 'infographic'),
        versionResource('act:step:fixture:step-01', 'step', 'lessons/fixture/interactive-manifest.json#step-01'),
        versionResource('act:textbook-section:dorf-modern-control-systems.chapter-chapter-01.section-1..1', 'textbook-section'),
      ];
      const first = buildVersionIndex(resources, {
        projectionHash: HASH_A, runtimeReleaseId: 'runtime-a', runtimeRoot: root,
        infographTokens: new Set([infographToken]),
      });
      const repackaged = buildVersionIndex(resources, {
        projectionHash: HASH_B, runtimeReleaseId: 'runtime-b', runtimeRoot: root,
        infographTokens: new Set([infographToken]),
      });

      for (const resource of resources) {
        expect(repackaged.resources.find((entry) => entry.identity.resourceId === resource.resourceId)?.version)
          .toBe(first.resources.find((entry) => entry.identity.resourceId === resource.resourceId)?.version);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('changes a resource version when its own body or binding changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'published-resource-version-change-'));
    const infographToken = 'fixture-infographic';
    const stepPath = join(root, 'lessons/fixture/interactive-manifest.json');
    const textbookUnitsPath = join(root, 'resources/textbooks-v2/dorf-modern-control-systems/units.jsonl');
    try {
      mkdirSync(join(root, 'knowledge/infographs/nodes'), { recursive: true });
      mkdirSync(join(root, 'lessons/fixture'), { recursive: true });
      mkdirSync(join(root, 'resources/textbooks-v2/dorf-modern-control-systems'), { recursive: true });
      writeFileSync(join(root, 'knowledge/infographs/nodes', `${infographToken}.png`), 'infographic bytes');
      writeFileSync(stepPath, JSON.stringify({ steps: {
        'step-01': { title: 'Step one', content: ['stable'] },
        'step-02': { title: 'Step two', content: ['unrelated'] },
      } }));
      writeFileSync(textbookUnitsPath, JSON.stringify({
        structuralPath: ['chapter-chapter-01', 'section-1.1'],
        chapterId: 'chapter-01', markdown: 'Textbook section body',
      }) + '\n');
      const resources = [
        versionResource(`act:infographic:${infographToken}`, 'infographic'),
        versionResource('act:step:fixture:step-01', 'step', 'lessons/fixture/interactive-manifest.json#step-01'),
        versionResource('act:textbook-section:dorf-modern-control-systems.chapter-chapter-01.section-1..1', 'textbook-section'),
      ];
      const base = buildVersionIndex(resources, { runtimeRoot: root, infographTokens: new Set([infographToken]) });

      writeFileSync(stepPath, JSON.stringify({ steps: {
        'step-01': { title: 'Step one', content: ['stable'] },
        'step-02': { title: 'Step two changed', content: ['unrelated'] },
      } }));
      const unrelatedStep = buildVersionIndex(resources, { runtimeRoot: root, infographTokens: new Set([infographToken]) });
      expect(unrelatedStep.resources.find((entry) => entry.type === 'step')?.version)
        .toBe(base.resources.find((entry) => entry.type === 'step')?.version);

      writeFileSync(stepPath, JSON.stringify({ steps: {
        'step-01': { title: 'Step one changed', content: ['changed'] },
        'step-02': { title: 'Step two changed', content: ['unrelated'] },
      } }));
      const changedStep = buildVersionIndex(resources, { runtimeRoot: root, infographTokens: new Set([infographToken]) });
      expect(changedStep.resources.find((entry) => entry.type === 'step')?.version)
        .not.toBe(base.resources.find((entry) => entry.type === 'step')?.version);

      writeFileSync(join(root, 'knowledge/infographs/nodes', `${infographToken}.png`), 'changed infographic bytes');
      const changedInfograph = buildVersionIndex(resources, { runtimeRoot: root, infographTokens: new Set([infographToken]) });
      expect(changedInfograph.resources.find((entry) => entry.type === 'infographic')?.version)
        .not.toBe(base.resources.find((entry) => entry.type === 'infographic')?.version);

      writeFileSync(textbookUnitsPath, JSON.stringify({
        structuralPath: ['chapter-chapter-01', 'section-1.1'],
        chapterId: 'chapter-01', markdown: 'Changed textbook section body',
      }) + '\n');
      const changedTextbook = buildVersionIndex(resources, { runtimeRoot: root, infographTokens: new Set([infographToken]) });
      expect(changedTextbook.resources.find((entry) => entry.type === 'textbook-section')?.version)
        .not.toBe(base.resources.find((entry) => entry.type === 'textbook-section')?.version);

      const changedBinding = buildVersionIndex(resources.map((resource) => resource.resourceType === 'step'
        ? { ...resource, bindingDigest: HASH_A } : resource), { runtimeRoot: root, infographTokens: new Set([infographToken]) });
      expect(changedBinding.resources.find((entry) => entry.type === 'step')?.version)
        .not.toBe(base.resources.find((entry) => entry.type === 'step')?.version);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('changes the version when a registered simulation default configuration changes', () => {
    const metadata = getRegisteredResourceMetadata('sim-pid-v1')!;
    const config = metadata.defaultConfig!;
    const original = config.kp;
    const resource = versionResource('act:simulation:sim-pid-v1', 'simulation');
    try {
      const first = buildVersionIndex([resource]);
      expect(first.resources[0]!.backend.kind).toBe('route');
      config.kp = 42;
      expect(buildVersionIndex([resource]).resources[0]!.version).not.toBe(first.resources[0]!.version);
    } finally { config.kp = original; }
  });

  it('maps published resource kinds to governed path node kinds', () => {
    expect(publishedResourcePathType('card')).toBe('knowledge_card');
    expect(publishedResourcePathType('lesson')).toBe('lesson_step');
    expect(publishedResourcePathType('step')).toBe('lesson_step');
    expect(publishedResourcePathType('podcast')).toBe('audio');
    expect(publishedResourcePathType('textbook-chapter')).toBe('textbook');
    expect(publishedResourcePathType('textbook-section')).toBe('textbook_section');
  });
});

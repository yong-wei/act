import { describe, expect, it } from 'vitest';

import {
  buildPublishedResourceFeatureIndex,
} from '@/lib/published-resource-index';
import {
  buildPublishedResourceHref,
  parsePublishedResourceHref,
  publishedResourcePathType,
  type PublishedResourceIdentity,
} from '@/lib/published-resource-reference';
import type { TeachingProjectionArtifacts } from '@/lib/teaching-projection/contracts';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

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

  it('maps published resource kinds to governed path node kinds', () => {
    expect(publishedResourcePathType('card')).toBe('knowledge_card');
    expect(publishedResourcePathType('lesson')).toBe('lesson_step');
    expect(publishedResourcePathType('step')).toBe('lesson_step');
    expect(publishedResourcePathType('podcast')).toBe('audio');
    expect(publishedResourcePathType('textbook-chapter')).toBe('textbook');
    expect(publishedResourcePathType('textbook-section')).toBe('textbook_section');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
/**
 * Konling Teaching Projection context + dual-domain RAG composition (#1274).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertIndependentDomainPinning,
  composeEngineeringAndTeachingRag,
  engineeringCorpusFromLayeredPayload,
  runEngineeringRagQuery,
  runTeachingResourceRagQuery,
  teachingCorpusFromLayeredPayload,
  teachingTextbookLocatorCitation,
} from '@/lib/canonical-rag/domain-composition';
import {
  buildKonlingKaqGraphContext,
  projectKonlingGraphContextForRole,
} from '@/lib/konling-kaq-graph-context';
import {
  buildKonlingTeachingProjectionGroundingLines,
  projectKonlingTeachingProjectionAnswerProvenance,
  resolveKonlingTeachingProjectionContext,
} from '@/lib/konling-teaching-projection-context';
import { resolveKonlingTeachingProjectionBinding } from '@/lib/konling-teaching-projection-binding';
import { LAYERED_GRAPH_PAYLOAD_CONTRACT } from '@/lib/layered-graph/contracts';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';

const releaseId = 'ctr:release:control-theory-engineering-v0.12';
const projectionId = 'proj:teaching:course-package:1-1';
const projectionHash = 'e'.repeat(64);
const scopeId = 'course-package:1-1';

function basePayload(overrides: Partial<LayeredGraphPayload> = {}): LayeredGraphPayload {
  const payload: LayeredGraphPayload = {
    contract: LAYERED_GRAPH_PAYLOAD_CONTRACT,
    engineering: {
      identity: {
        layer: 'engineering',
        status: 'ready',
        authorityReleaseId: releaseId,
        authoritySnapshotId: 'snap-1',
        authoritySnapshotHash: 'a'.repeat(64),
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        reasons: ['engineering-authority-ready'],
      },
      nodes: [
        {
          canonicalId: 'node-a',
          ordinal: 0,
          canonicalType: 'DomainConcept',
          semanticName: '稳定性',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: {},
        },
        {
          canonicalId: 'node-b',
          ordinal: 1,
          canonicalType: 'DomainConcept',
          semanticName: '时域响应',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: {},
        },
      ],
      relations: [
        {
          relationId: 'rel-1',
          ordinal: 0,
          qualityTier: 'GOLD',
          sourceId: 'node-a',
          targetId: 'node-b',
          relationType: 'part_of',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          direct: true,
          payload: {},
        },
      ],
      predicates: ['part_of'],
    },
    teachingPrerequisites: {
      identity: {
        layer: 'teachingPrerequisites',
        status: 'ready',
        authorityReleaseId: releaseId,
        authoritySnapshotId: null,
        authoritySnapshotHash: null,
        projectionId,
        projectionHash,
        scopeId,
        reasons: ['teaching-projection-ready'],
      },
      edges: [
        {
          prerequisiteId: 'prereq:node-b->node-a',
          sourceCanonicalId: 'node-b',
          targetCanonicalId: 'node-a',
          strength: 'REQUIRED',
          scopeId,
          evidenceRef: 'evidence:prereq-1',
          rationale: '时域响应先于稳定性讨论',
        },
        {
          prerequisiteId: 'prereq:node-a->extra',
          sourceCanonicalId: 'node-a',
          targetCanonicalId: 'node-extra',
          strength: 'RECOMMENDED',
          scopeId,
          evidenceRef: 'evidence:prereq-2',
          rationale: null,
        },
      ],
    },
    teachingResources: {
      identity: {
        layer: 'teachingResources',
        status: 'ready',
        authorityReleaseId: releaseId,
        authoritySnapshotId: null,
        authoritySnapshotHash: null,
        projectionId,
        projectionHash,
        scopeId,
        reasons: ['teaching-projection-ready'],
      },
      resources: [
        {
          resourceId: 'act:handout:1-1',
          resourceType: 'handout',
          projectionMode: 'REQUIRED',
          scopeId,
          title: '稳定性讲义',
          sourcePath: 'course-content/runtime/lessons/1-1/handout.md',
          legacyCrosswalkRef: null,
          bindingCount: 1,
          bindingStatus: 'BOUND',
          projectionStatus: 'BOUND',
          bindingDigest: 'f'.repeat(64),
        },
        {
          resourceId: 'act:textbook-section:dorf:ch2',
          resourceType: 'textbook-section',
          projectionMode: 'OPTIONAL',
          scopeId,
          title: 'Dorf §2.1',
          sourcePath: null,
          legacyCrosswalkRef: null,
          bindingCount: 1,
          bindingStatus: 'BOUND',
          projectionStatus: 'BOUND',
          bindingDigest: '1'.repeat(64),
        },
        {
          resourceId: 'act:handout:other-course',
          resourceType: 'handout',
          projectionMode: 'REQUIRED',
          scopeId: 'course-package:other',
          title: '跨课讲义',
          sourcePath: null,
          legacyCrosswalkRef: null,
          bindingCount: 1,
          bindingStatus: 'BOUND',
          projectionStatus: 'BOUND',
          bindingDigest: '2'.repeat(64),
        },
      ],
      bindings: [
        {
          bindingId: 'bind:handout-a',
          resourceId: 'act:handout:1-1',
          canonicalId: 'node-a',
          role: 'EXPLAINS',
          scopeId,
          primary: true,
          resourceType: 'handout',
          resourceTitle: '稳定性讲义',
          projectionMode: 'REQUIRED',
          sourcePath: 'course-content/runtime/lessons/1-1/handout.md',
        },
        {
          bindingId: 'bind:textbook-a',
          resourceId: 'act:textbook-section:dorf:ch2',
          canonicalId: 'node-a',
          role: 'COVERS',
          scopeId,
          primary: false,
          resourceType: 'textbook-section',
          resourceTitle: 'Dorf §2.1',
          projectionMode: 'OPTIONAL',
          sourcePath: null,
        },
        {
          bindingId: 'bind:other',
          resourceId: 'act:handout:other-course',
          canonicalId: 'node-a',
          role: 'EXPLAINS',
          scopeId: 'course-package:other',
          primary: true,
          resourceType: 'handout',
          resourceTitle: '跨课讲义',
          projectionMode: 'REQUIRED',
          sourcePath: null,
        },
      ],
      coreNodes: [
        {
          canonicalId: 'node-a',
          pathEligible: true,
          cardPolicy: 'optional',
          moduleId: null,
          scopeId,
          rationale: null,
          projectionStatus: 'PROJECTED',
        },
      ],
      cards: [],
      notProjectedCanonicalIds: ['node-unrelated'],
    },
    fallback: null,
    requestedScope: {
      scopeId,
      lessonKey: '1-1',
      stepId: 'step-1',
      knowledgeRefs: ['node-a'],
    },
  };

  return {
    ...payload,
    ...overrides,
    engineering: overrides.engineering ?? payload.engineering,
    teachingPrerequisites:
      overrides.teachingPrerequisites ?? payload.teachingPrerequisites,
    teachingResources: overrides.teachingResources ?? payload.teachingResources,
    requestedScope: overrides.requestedScope ?? payload.requestedScope,
    fallback: overrides.fallback === undefined ? payload.fallback : overrides.fallback,
  };
}

describe('1. Konling teaching projection context contract', () => {
  it('1.1 carries Authority/Projection/canonical/resource/prerequisite/card fields', () => {
    const context = resolveKonlingTeachingProjectionContext({
      payload: basePayload({
        teachingResources: {
          ...basePayload().teachingResources,
          cards: [
            {
              cardId: 'card:node-a',
              resourceId: 'act:card:node-a',
              canonicalId: 'node-a',
              active: true,
              required: false,
              sourcePath: null,
              title: '稳定性卡片',
            },
          ],
        },
      }),
      focusCanonicalIds: ['node-a'],
      evidenceCutoff: '2026-08-04T00:00:00.000Z',
    });

    expect(context.source).toBe('server-owned');
    expect(context.status).toBe('ready');
    expect(context.authorityReleaseId).toBe(releaseId);
    expect(context.projectionId).toBe(projectionId);
    expect(context.projectionHash).toBe(projectionHash);
    expect(context.scope?.scopeId).toBe(scopeId);
    expect(context.canonicalIds).toContain('node-a');
    expect(context.linkedResources.map((r) => r.resourceId)).toEqual(
      expect.arrayContaining([
        'act:handout:1-1',
        'act:textbook-section:dorf:ch2',
      ]),
    );
    // Cross-course resource excluded by scope.
    expect(context.linkedResources.map((r) => r.resourceId)).not.toContain(
      'act:handout:other-course',
    );
    expect(context.prerequisiteAncestors[0]?.canonicalId).toBe('node-b');
    expect(context.prerequisiteAncestors[0]?.relationDomain).toBe(
      'teaching-prerequisite',
    );
    expect(context.prerequisiteSuccessors[0]?.canonicalId).toBe('node-extra');
    expect(context.activeCard?.cardId).toBe('card:node-a');
    expect(context.optionalCardStatus).toBe('active');
    expect(context.evidenceCutoff).toBe('2026-08-04T00:00:00.000Z');
    expect(context.engineeringOnlyAllowed).toBe(false);
  });

  it('1.2 revalidates client hints and rejects unauthorized/cross-course IDs', () => {
    const context = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      focusCanonicalIds: ['node-a'],
      authorized: true,
      permittedScopeIds: [scopeId],
      clientHints: {
        authorityReleaseId: releaseId,
        projectionId: projectionId,
        scopeId,
        canonicalIds: ['node-a', 'forged-node'],
        resourceIds: ['act:handout:1-1', 'act:handout:other-course'],
        cardId: 'missing-card',
        signedCanonicalIds: ['node-a', 'out-of-scope'],
      },
    });

    expect(context.clientHintsAccepted).toEqual(
      expect.arrayContaining([
        'authorityReleaseId',
        'projectionId',
        'scopeId',
        'canonicalIds',
        'signedCanonicalIds',
        'resourceIds',
      ]),
    );
    expect(context.clientHintsRejected).toEqual(
      expect.arrayContaining([
        'canonicalIds:forged-node',
        'signedCanonicalIds:out-of-scope',
        'resourceIds:act:handout:other-course',
        'cardId:missing-card',
      ]),
    );
    expect(context.canonicalIds).toContain('node-a');
    expect(context.canonicalIds).not.toContain('forged-node');

    const unauthorized = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      authorized: false,
      clientHints: { projectionId },
    });
    expect(unauthorized.status).toBe('unauthorized');
    expect(unauthorized.linkedResources).toEqual([]);
    expect(unauthorized.engineeringOnlyAllowed).toBe(true);

    const crossCourse = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      permittedScopeIds: ['course-package:other-only'],
    });
    expect(crossCourse.status).toBe('unauthorized');
    expect(crossCourse.reasons[0]).toMatch(/cross-course-scope-rejected/);
  });

  it('1.3 optional card absence, projection drift, and fallback are explicit', () => {
    const cardAbsent = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      focusCanonicalIds: ['node-a'],
    });
    expect(cardAbsent.optionalCardStatus).toBe('absent');
    expect(cardAbsent.activeCard).toBeNull();
    expect(cardAbsent.canonicalIds).toContain('node-a');
    expect(cardAbsent.linkedResources.length).toBeGreaterThan(0);

    const drift = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      requiredProjectionId: 'proj:other',
    });
    expect(drift.status).toBe('identity-drift');
    expect(drift.linkedResources).toEqual([]);
    expect(drift.engineeringOnlyAllowed).toBe(true);

    const unavailable = resolveKonlingTeachingProjectionContext({
      payload: basePayload({
        teachingResources: {
          ...basePayload().teachingResources,
          identity: {
            ...basePayload().teachingResources.identity,
            status: 'unavailable',
            projectionId: null,
            reasons: ['projection-store-missing'],
          },
          resources: [],
          bindings: [],
          cards: [],
        },
        teachingPrerequisites: {
          ...basePayload().teachingPrerequisites,
          identity: {
            ...basePayload().teachingPrerequisites.identity,
            status: 'unavailable',
            projectionId: null,
            reasons: ['projection-store-missing'],
          },
          edges: [],
        },
      }),
    });
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.engineeringOnlyAllowed).toBe(true);
    // Does not infer teaching resources from ActKG labels.
    expect(unavailable.linkedResources).toEqual([]);

    const fallback = resolveKonlingTeachingProjectionContext({
      payload: basePayload({
        teachingResources: {
          ...basePayload().teachingResources,
          identity: {
            ...basePayload().teachingResources.identity,
            status: 'fallback',
          },
        },
        teachingPrerequisites: {
          ...basePayload().teachingPrerequisites,
          identity: {
            ...basePayload().teachingPrerequisites.identity,
            status: 'fallback',
          },
        },
        fallback: {
          kind: 'pinned-previous',
          adapterId: 'pinned-previous-projection',
          authorityReleaseId: releaseId,
          projectionId: 'proj:pinned',
          projectionHash: null,
          scopeId,
          reasons: ['active-projection-unavailable'],
        },
      }),
    });
    expect(fallback.status).toBe('fallback');
    expect(fallback.fallback?.kind).toBe('pinned-previous');
  });
});

describe('2. RAG domain split', () => {
  const previousConsumerActivationRoot = process.env.ACT_CONSUMER_ACTIVATION_ROOT;
  const legacyActivationRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'act-rag-legacy-activation-'),
  );

  beforeAll(() => {
    // The repository fixture carries a staged first-cutover candidate. These
    // domain tests exercise the default Legacy path explicitly.
    process.env.ACT_CONSUMER_ACTIVATION_ROOT = legacyActivationRoot;
  });

  afterAll(() => {
    if (previousConsumerActivationRoot === undefined) {
      delete process.env.ACT_CONSUMER_ACTIVATION_ROOT;
    } else {
      process.env.ACT_CONSUMER_ACTIVATION_ROOT = previousConsumerActivationRoot;
    }
    fs.rmSync(legacyActivationRoot, { recursive: true, force: true });
  });

  it('2.1 engineering-only query does not require Teaching Projection', () => {
    const payload = basePayload();
    const result = runEngineeringRagQuery({
      query: {
        domain: 'engineering',
        query: '稳定性',
        authorityReleaseId: releaseId,
        mode: 'shadow',
      },
      corpus: engineeringCorpusFromLayeredPayload(payload),
    });

    expect(result.domain).toBe('engineering');
    expect(result.metadata.projectionId).toBeNull();
    expect(result.metadata.domainIsolated).toBe(true);
    expect(result.metadata.productionSelectorUnchanged).toBe(true);
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]?.citation.domain).toBe('engineering');
    expect(result.hits[0]?.citation.relationKind).toBe('engineering-predicate');
  });

  it('2.1 teaching-only query uses Teaching Projection and reports card absence', () => {
    const payload = basePayload();
    const result = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '讲义',
        projectionId,
        projectionHash,
        authorityReleaseId: releaseId,
        scopeId,
        canonicalIds: ['node-a'],
        mode: 'shadow',
        includeOptionalCards: true,
      },
      corpus: teachingCorpusFromLayeredPayload(payload),
    });

    expect(result.domain).toBe('teaching-resource');
    expect(result.metadata.projectionId).toBe(projectionId);
    expect(result.optionalCardStatus).toBe('absent');
    expect(result.metadata.reasons).toContain('optional-card-absent');
    expect(result.hits.some((hit) => hit.resourceId === 'act:handout:1-1')).toBe(
      true,
    );
    expect(result.hits.every((hit) => hit.citation.domain === 'teaching-resource')).toBe(
      true,
    );
  });

  it('2.2 composed query keeps dual provenance and never forges cross-domain edges', () => {
    const payload = basePayload();
    const composed = composeEngineeringAndTeachingRag({
      domain: 'composed',
      query: '稳定性',
      engineering: {
        domain: 'engineering',
        query: '稳定性',
        authorityReleaseId: releaseId,
        mode: 'shadow',
      },
      teaching: {
        domain: 'teaching-resource',
        query: '稳定性',
        projectionId,
        scopeId,
        canonicalIds: ['node-a'],
        mode: 'shadow',
      },
      engineeringCorpus: engineeringCorpusFromLayeredPayload(payload),
      teachingCorpus: teachingCorpusFromLayeredPayload(payload),
    });

    expect(composed.actkgWriteback).toBe(false);
    expect(composed.crossDomainEdgeForged).toBe(false);
    expect(composed.engineering.metadata.domainIsolated).toBe(true);
    expect(composed.teaching.metadata.domainIsolated).toBe(true);
    expect(composed.citations.some((c) => c.domain === 'engineering')).toBe(true);
    expect(composed.citations.some((c) => c.domain === 'teaching-resource')).toBe(
      true,
    );
    // Engineering citations never carry projection identity as authority mix.
    for (const citation of composed.citations.filter((c) => c.domain === 'engineering')) {
      expect(citation.projectionId).toBeNull();
    }
  });

  it('2.3 projection drift rejects mixed-version teaching context', () => {
    const payload = basePayload();
    const drifted = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '讲义',
        projectionId: 'proj:other-version',
        scopeId,
        mode: 'shadow',
      },
      corpus: teachingCorpusFromLayeredPayload(payload),
    });
    expect(drifted.metadata.availability).toBe('identity-drift');
    expect(drifted.hits).toEqual([]);

    const engDrift = runEngineeringRagQuery({
      query: {
        domain: 'engineering',
        query: '稳定性',
        authorityReleaseId: releaseId,
      },
      corpus: [
        {
          canonicalId: 'node-a',
          label: '稳定性',
          predicates: ['part_of'],
          relationIds: ['rel-1'],
          authorityReleaseId: 'ctr:release:other',
        },
      ],
    });
    expect(engDrift.metadata.availability).toBe('identity-drift');
  });

  it('2.4 rejects authority/scope identity drift before any teaching hits', () => {
    const corpus = teachingCorpusFromLayeredPayload(basePayload())!;
    const authorityDrift = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '卡片',
        projectionId,
        authorityReleaseId: 'ctr:release:other',
        scopeId,
        canonicalIds: ['node-a'],
        includeOptionalCards: true,
      },
      corpus: {
        ...corpus,
        cards: [
          {
            cardId: 'card:node-a',
            resourceId: 'act:handout:1-1',
            canonicalId: 'node-a',
            active: true,
            required: false,
            sourcePath: null,
            title: '稳定性卡片',
          },
        ],
      },
    });
    expect(authorityDrift.metadata.availability).toBe('identity-drift');
    expect(authorityDrift.hits).toEqual([]);
    expect(authorityDrift.metadata.reasons[0]).toMatch(/teaching-authority-drift/);

    const scopeDrift = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '卡片',
        projectionId,
        authorityReleaseId: releaseId,
        scopeId: 'course-package:other',
        canonicalIds: ['node-a'],
        includeOptionalCards: true,
      },
      corpus: {
        ...corpus,
        cards: [
          {
            cardId: 'card:node-a',
            resourceId: 'act:handout:1-1',
            canonicalId: 'node-a',
            active: true,
            required: false,
            sourcePath: null,
            title: '稳定性卡片',
          },
        ],
      },
    });
    expect(scopeDrift.metadata.availability).toBe('identity-drift');
    expect(scopeDrift.hits).toEqual([]);
    expect(scopeDrift.metadata.reasons[0]).toMatch(/teaching-scope-drift/);
  });

  it('2.5 filters out-of-scope cards and pairs predicates with relation IDs', () => {
    const corpus = teachingCorpusFromLayeredPayload(basePayload())!;
    const cardQuery = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '卡片',
        projectionId,
        authorityReleaseId: releaseId,
        scopeId,
        canonicalIds: ['node-a'],
        includeOptionalCards: true,
      },
      corpus: {
        ...corpus,
        cards: [
          {
            cardId: 'card:in-scope',
            resourceId: 'act:handout:1-1',
            canonicalId: 'node-a',
            active: true,
            required: false,
            sourcePath: null,
            title: '课内卡片',
          },
          {
            cardId: 'card:cross-course',
            resourceId: 'act:handout:other-course',
            canonicalId: 'node-a',
            active: true,
            required: false,
            sourcePath: null,
            title: '跨课卡片',
          },
        ],
      },
    });
    expect(cardQuery.optionalCardStatus).toBe('active');
    expect(cardQuery.hits.map((hit) => hit.cardId)).toEqual(['card:in-scope']);
    expect(cardQuery.hits.every((hit) => hit.citation.scopeId === scopeId)).toBe(true);
    expect(cardQuery.hits.every((hit) => hit.citation.authorityReleaseId === releaseId)).toBe(
      true,
    );

    const engineering = runEngineeringRagQuery({
      query: {
        domain: 'engineering',
        query: '稳定性',
        authorityReleaseId: releaseId,
        allowedPredicates: ['is_a'],
      },
      corpus: [
        {
          canonicalId: 'node-a',
          label: '稳定性',
          predicates: ['part_of', 'is_a'],
          relationIds: ['rel-part', 'rel-is-a'],
          authorityReleaseId: releaseId,
        },
      ],
    });
    expect(engineering.hits).toHaveLength(1);
    expect(engineering.hits[0]?.predicate).toBe('is_a');
    expect(engineering.hits[0]?.relationId).toBe('rel-is-a');
    expect(engineering.hits[0]?.citation.relationId).toBe('rel-is-a');
  });

  it('2.3 textbook locator and card-fallback citations stay teaching-domain', () => {
    const locator = teachingTextbookLocatorCitation({
      resourceId: 'act:textbook-section:dorf:ch2',
      canonicalId: 'node-a',
      projectionId,
      projectionHash,
      authorityReleaseId: releaseId,
      scopeId,
      locator: 'ch2.1',
      title: 'Dorf §2.1',
    });
    expect(locator.domain).toBe('teaching-resource');
    expect(locator.citationTargetId).toContain('teach-textbook:');
    expect(locator.relationKind).toBe('teaching-resource');

    const withCard = runTeachingResourceRagQuery({
      query: {
        domain: 'teaching-resource',
        query: '卡片',
        projectionId,
        authorityReleaseId: releaseId,
        scopeId,
        canonicalIds: ['node-a'],
        includeOptionalCards: true,
      },
      corpus: {
        ...teachingCorpusFromLayeredPayload(basePayload())!,
        cards: [
          {
            cardId: 'card:node-a',
            // Must resolve to an in-scope resource; unscoped card resources are excluded.
            resourceId: 'act:handout:1-1',
            canonicalId: 'node-a',
            active: true,
            required: false,
            sourcePath: null,
            title: '稳定性卡片',
          },
        ],
      },
    });
    expect(withCard.optionalCardStatus).toBe('active');
    expect(
      withCard.hits.some((hit) => hit.citation.relationKind === 'optional-card'),
    ).toBe(true);

    const pin = assertIndependentDomainPinning({
      engineeringAuthorityReleaseId: 'ctr:release:newer',
      teachingPinnedProjectionId: 'proj:pinned',
      teachingActiveProjectionId: projectionId,
      teachingActivationReady: false,
    });
    expect(pin.engineeringMayUseNewerAuthority).toBe(true);
    expect(pin.teachingRemainsPinned).toBe(true);
    expect(pin.productionSelectorUnchanged).toBe(true);
  });
});

describe('3. Konling grounding wiring', () => {
  it('3.1 bounded prerequisite neighborhood enters graph context and tool lines', () => {
    const graphContext = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      layeredGraphPayload: basePayload(),
      teachingProjectionClientHints: {
        canonicalIds: ['node-a'],
      },
      selectedGraphNodeIds: ['node-a'],
    });

    expect(graphContext.teachingProjectionContext?.status).toBe('ready');
    expect(
      graphContext.teachingProjectionContext?.prerequisiteAncestors[0]?.canonicalId,
    ).toBe('node-b');
    expect(
      graphContext.teachingProjectionContext?.prerequisiteAncestors[0]?.relationDomain,
    ).toBe('teaching-prerequisite');

    const lines = buildKonlingTeachingProjectionGroundingLines(
      graphContext.teachingProjectionContext,
    );
    expect(lines.some((line) => line.startsWith('authorityReleaseId='))).toBe(true);
    expect(lines.some((line) => line.startsWith('projectionId='))).toBe(true);
    expect(lines.some((line) => line.startsWith('prerequisiteAncestors='))).toBe(
      true,
    );
    expect(lines.some((line) => line.startsWith('linkedResources='))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/actkg-write|writer|store-path/i);
    // Optional card absence falls back to summary/resources, not node-missing.
    expect(lines.some((line) => line.includes('optionalCard=absent'))).toBe(true);
  });

  it('3.2 answer provenance retains domain metadata and forbids writeback', () => {
    const context = resolveKonlingTeachingProjectionContext({
      payload: basePayload(),
      focusCanonicalIds: ['node-a'],
    });
    const provenance = projectKonlingTeachingProjectionAnswerProvenance(context);
    expect(provenance.domain).toBe('teaching-resource');
    expect(provenance.authorityReleaseId).toBe(releaseId);
    expect(provenance.projectionId).toBe(projectionId);
    expect(provenance.relationWriteback).toBe(false);
    expect(provenance.resourceIds).toContain('act:handout:1-1');
    expect(provenance.optionalCardStatus).toBe('absent');

    // Student projection keeps teaching context (no class overlay leak path).
    const graphContext = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: 'class-1',
      },
      layeredGraphPayload: basePayload(),
      selectedGraphNodeIds: ['node-a'],
    });
    const projected = projectKonlingGraphContextForRole(graphContext, 'student');
    expect(projected.teachingProjectionContext?.projectionId).toBe(projectionId);
    expect(
      projectKonlingTeachingProjectionAnswerProvenance(
        projected.teachingProjectionContext,
      ).relationWriteback,
    ).toBe(false);
  });

  it('teaching layer absent still allows engineering-only continuation metadata', () => {
    const context = resolveKonlingTeachingProjectionContext({
      payload: null,
    });
    expect(context.status).toBe('absent');
    expect(context.engineeringOnlyAllowed).toBe(true);

    const graphContext = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'teacher',
        targetUserId: 'teacher-1',
        classId: null,
      },
    });
    expect(graphContext.teachingProjectionContext).toBeNull();
  });
});

describe('4. Production binding and prompt assembly', () => {
  it('4.1 resolves production binding from explicit payload and builds dual-domain metadata', async () => {
    const {
      resolveKonlingTeachingProjectionBinding,
      extractKonlingTeachingProjectionClientHints,
    } = await import('../konling-teaching-projection-binding');
    const {
      buildKonlingDualDomainProvenanceMetadataPayload,
      buildKonlingTeachingProjectionToolGrounding,
    } = await import('../konling-agent-runtime');
    const { buildKonlingSystemPrompt } = await import('../ai-prompt-builder');

    const binding = resolveKonlingTeachingProjectionBinding({
      courseId: '1-1',
      pageId: 'step-1',
      layeredGraphPayload: basePayload(),
      authorized: true,
    });
    expect(binding.source).toBe('explicit-payload');
    expect(binding.payload).not.toBeNull();
    expect(binding.permittedScopeIds).toContain(scopeId);

    const hints = extractKonlingTeachingProjectionClientHints({
      projectionId,
      authorityReleaseId: releaseId,
      canonicalIds: ['node-a'],
    });
    expect(hints?.projectionId).toBe(projectionId);

    const teaching = resolveKonlingTeachingProjectionContext({
      payload: binding.payload,
      focusCanonicalIds: ['node-a'],
      clientHints: hints,
      authorized: true,
      permittedScopeIds: binding.permittedScopeIds,
    });
    const runtime = {
      teachingProjectionContext: teaching,
      graphContext: {
        teachingProjectionContext: teaching,
      },
    } as Parameters<typeof buildKonlingDualDomainProvenanceMetadataPayload>[0];

    const provenance = buildKonlingDualDomainProvenanceMetadataPayload(runtime);
    expect(provenance?.source).toBe('teaching-projection-dual-domain');
    expect(provenance?.relationWriteback).toBe(false);
    expect(provenance?.teaching.projectionId).toBe(projectionId);
    expect(buildKonlingTeachingProjectionToolGrounding(runtime as never).length).toBeGreaterThan(
      0,
    );

    const prompt = buildKonlingSystemPrompt({
      page: {
        courseId: '1-1',
        courseTitle: 'unit-1-1',
        pageType: 'lesson',
        stepId: 'step-1',
        topic: '稳定性',
      } as never,
      user: {
        userId: 'student-1',
        name: '同学',
      } as never,
      adaptiveRuntime: {
        teachingProjectionContext: teaching,
        graphContext: {
          status: 'complete',
          confidence: 'high',
          teachingProjectionContext: teaching,
        },
      },
    });
    expect(prompt).toContain('Teaching Projection grounding');
    expect(prompt).toContain(`projectionId=${projectionId}`);
    expect(prompt).toContain('不得写成 ActKG 工程谓词');
  });

  it('4.2 production routes reference dual-domain provenance assembly', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = process.cwd();
    const chat = readFileSync(join(root, 'src/app/api/ai/chat/route.ts'), 'utf8');
    const messages = readFileSync(
      join(root, 'src/app/api/ai/sessions/[id]/messages/route.ts'),
      'utf8',
    );
    const context = readFileSync(join(root, 'src/app/api/ai/konling-context/route.ts'), 'utf8');
    const pathAdvisor = readFileSync(
      join(root, 'src/app/api/adaptive/path-advisor-tool/route.ts'),
      'utf8',
    );
    const runtime = readFileSync(join(root, 'src/lib/konling-agent-runtime.ts'), 'utf8');

    expect(runtime).toContain('resolveKonlingTeachingProjectionBinding');
    expect(chat).toContain('buildKonlingDualDomainProvenanceMetadataPayload');
    expect(chat).toContain('konlingDualDomainProvenance');
    expect(messages).toContain('buildKonlingDualDomainProvenanceMetadataPayload');
    expect(messages).toContain('konlingDualDomainProvenance');
    expect(context).toContain('teaching_projection_context');
    expect(context).toContain('dual_domain_provenance');
    expect(pathAdvisor).toContain('teachingProjectionContext: graphRuntimeContext.teachingProjectionContext');
  });
});


describe('production Authority/Projection packaging (#1274 P1)', () => {
  it('uses production-default store roots and reports missing activation artifacts explicitly', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'konling-prod-paths-'));
    try {
      const authorityRoot = path.join(repoRoot, 'course-content/authoring/knowledge/authority');
      const projectionRoot = path.join(repoRoot, 'course-content/runtime/knowledge/projection');
      fs.mkdirSync(authorityRoot, { recursive: true });
      fs.mkdirSync(projectionRoot, { recursive: true });

      const missing = resolveKonlingTeachingProjectionBinding({
        courseId: 'unit-1-1',
        pageId: 'overview',
        repoRoot,
        authorized: true,
      });
      expect(missing.source).toBe('production-artifacts-missing');
      expect(missing.payload).toBeNull();
      expect(missing.authorityRoot).toBe(authorityRoot);
      expect(missing.projectionRoot).toBe(projectionRoot);
      expect(missing.reasons.some((r) => r.startsWith('authority-store-missing:'))).toBe(true);
      expect(missing.reasons.some((r) => r.startsWith('teaching-projection-store-missing:'))).toBe(true);

      fs.writeFileSync(path.join(authorityRoot, 'current.json'), '{"contract":"act-authority-current/v1"}');
      fs.writeFileSync(path.join(projectionRoot, 'current.json'), '{"contract":"act-teaching-projection-current/v1"}');

      // With pointers present, binding proceeds past packaging gate (may still
      // fail closed later if releases are incomplete — not packaging miss).
      const withPointers = resolveKonlingTeachingProjectionBinding({
        courseId: 'unit-1-1',
        pageId: 'overview',
        repoRoot,
        authorized: true,
      });
      expect(withPointers.source).not.toBe('production-artifacts-missing');
      expect(withPointers.authorityRoot).toBe(authorityRoot);
      expect(withPointers.projectionRoot).toBe(projectionRoot);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('Dockerfile, dockerignore, and deploy path wire Authority/Projection stores', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
    const deploy = fs.readFileSync(
      path.join(root, 'deploy/podman/deploy.sh'),
      'utf8',
    );
    expect(dockerfile).toContain('course-content/authoring/knowledge/authority');
    expect(dockerfile).toContain('course-content/runtime/knowledge/projection');
    expect(dockerignore).toContain('!course-content/runtime/knowledge/projection');
    expect(deploy).toContain('ACT_AUTHORITY_STORE_ROOT');
    expect(deploy).toContain('ACT_TEACHING_PROJECTION_STORE_ROOT');
    expect(deploy).toContain('ACT_KNOWLEDGE_DEPLOYMENT_MODE="$ACT_KNOWLEDGE_DEPLOYMENT_MODE"');
    // BusyBox awk treats `index` as a built-in function; the env merge must
    // use a portable loop variable while preserving the managed-key filter.
    expect(deploy).not.toContain('for (index in keys)');
    expect(deploy).toContain(
      'for (key_index in keys) managed[keys[key_index]] = 1;',
    );
    expect(deploy).toContain('require_actkg_activation_store_pointers');
    expect(deploy).toContain(
      'ACT_KNOWLEDGE_DEPLOYMENT_MODE="${ACT_KNOWLEDGE_DEPLOYMENT_MODE:-legacy}"',
    );
    expect(deploy).toMatch(
      /case "\$ACT_KNOWLEDGE_DEPLOYMENT_MODE"[\s\S]*legacy\)[\s\S]*cutover\)[\s\S]*\*\)/,
    );
    // Legacy is fail-closed on all four host current pointers; cutover only
    // opts into the corresponding presence gate.
    expect(deploy).toMatch(
      /legacy\)[\s\S]*\[ -e "\$pointer" \] \|\| \[ -L "\$pointer" \][\s\S]*cutover\)[\s\S]*\[ ! -f "\$pointer" \]/,
    );
    for (const pointer of [
      '${AUTHORITY_STORE_DIR}/current.json',
      '${TEACHING_PROJECTION_STORE_DIR}/current.json',
      '${RUNTIME_CONTENT_DIR}/knowledge/consumer-activation/current.json',
      '${RUNTIME_CONTENT_DIR}/knowledge/prerequisites/current.json',
    ]) {
      expect(deploy).toContain(`"${pointer}"`);
    }
    expect(deploy).toMatch(
      /ACT_KNOWLEDGE_DEPLOYMENT_MODE.*必须为 legacy 或 cutover/,
    );
    expect(deploy).toContain(
      'AUTHORITY_STORE_DIR}:${ACT_AUTHORITY_STORE_ROOT}',
    );
    expect(deploy).toContain(
      'TEACHING_PROJECTION_STORE_DIR}:${ACT_TEACHING_PROJECTION_STORE_ROOT}',
    );
    // Application artifact precheck must not run in --db-only mode.
    expect(deploy).toMatch(
      /MODE" != "--db-only"[\s\S]*require_actkg_activation_store_pointers/,
    );
  });
});

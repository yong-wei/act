/**
 * Incremental domain Teaching Projection (#1370).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  activateDomainTeachingProjection,
  activateDomainTeachingProjectionFailClosed,
  assertCompleteAuthorityBinding,
  canonicalAuthorityNodeIndexDigest,
  authorityActivationBlockedByTeachingCoverage,
  buildDomainTeachingFragment,
  composeDomainTeachingProjection,
  composeDomainTeachingProjectionFailClosed,
  createDomainTeachingAuthorityEnvelope,
  DomainCompositionError,
  DomainFragmentBuildError,
  DomainTeachingActivationError,
  engineeringBrowsingAllowed,
  expectedAuthorityFromEnvelope,
  layeredDomainTeachingStatus,
  listRegisteredTeachingRelationTypes,
  LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
  LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
  liveAuthorityBindingForFirstFragment,
  liveAuthorityEnvelopeForFirstFragment,
  relationsForDomain,
  resolveTeachingRelationPresentation,
  selectPresentableTeachingRelations,
  shouldInvalidateTeachingLayerCache,
  teachingActivationRequiresAuthorityReactivation,
  teachingCacheFamilyFor,
  toDomainTeachingCurrentPointer,
  translateAndBuildFirstDomainFragment,
  translatePublishedRecordsToFirstFragmentAuthoring,
  verifyDomainTeachingFragment,
  type DomainFragmentAuthorityBindingComplete,
  type DomainTeachingActivationExpectedIdentity,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingFragmentAuthoring,
} from '../teaching-projection';

const COMMIT = 'a'.repeat(40);
const FIXTURE_HASH = 'b'.repeat(64);
const FIXTURE_SOURCE_DATASET_HASH = 'd'.repeat(64);
const FIXTURE_BINDING: DomainFragmentAuthorityBindingComplete = {
  releaseId: 'ctr:release:eng-domain-teaching-fixture-v1',
  releaseSetId: 'set-fixture-domain-teaching-v1',
  snapshotId: `snap-${FIXTURE_HASH}`,
  snapshotHash: FIXTURE_HASH,
};

const DOMAIN_FRAGMENTS_DIR = path.resolve(
  process.cwd(),
  'course-content/authoring/knowledge/teaching-projection/domain-fragments',
);

function authorityNodes() {
  return [
    { canonicalId: 'node.laplace', lifecycleStatus: 'active' },
    { canonicalId: 'node.transfer', lifecycleStatus: 'active' },
    { canonicalId: 'node.block', lifecycleStatus: 'active' },
    { canonicalId: 'node.stability', lifecycleStatus: 'active' },
    { canonicalId: 'node.unrelated', lifecycleStatus: 'active' },
    {
      canonicalId: 'node.retired',
      lifecycleStatus: 'retired',
      successorCanonicalId: 'node.laplace',
    },
  ];
}

function fixtureEnvelope(
  nodes = authorityNodes(),
  binding: DomainFragmentAuthorityBindingComplete = FIXTURE_BINDING,
) {
  return createDomainTeachingAuthorityEnvelope({
    binding,
    sourceDatasetHash: FIXTURE_SOURCE_DATASET_HASH,
    captureRevision: COMMIT,
    authoringRevision: COMMIT,
    nodes,
  });
}

function composeProjection(
  input: Parameters<typeof composeDomainTeachingProjection>[0],
) {
  return composeDomainTeachingProjection({
    ...input,
    authoringRevision:
      input.authoringRevision
      ?? input.authority?.authoringRevision
      ?? COMMIT,
  });
}

function independentExpectedIdentity(
  envelope: DomainTeachingAuthorityEnvelope,
  composed: Pick<DomainTeachingComposedArtifacts, 'manifest'>,
): DomainTeachingActivationExpectedIdentity {
  return {
    authority: expectedAuthorityFromEnvelope(envelope),
    projectionId: composed.manifest.projectionId,
    projectionHash: composed.manifest.projectionHash,
    sourceInventoryDigest: composed.manifest.sourceInventoryDigest,
  };
}

function publishedInventoryAuthorityNodes() {
  return [
    {
      canonicalId: 'ctkg:v3e-object-8c4354096b719a1d5e090da4',
      lifecycleStatus: 'active',
    },
    {
      canonicalId: 'ctc:modeling-865eb1c8824e157c2f05a903',
      lifecycleStatus: 'active',
    },
    {
      canonicalId: 'ctc:modeling-2088bbde171b2e9ef66070d5',
      lifecycleStatus: 'active',
    },
    {
      canonicalId: 'ctkg:v3e-canonical-ec8dceb901656a3a0a32d12b',
      lifecycleStatus: 'active',
    },
    {
      canonicalId: 'ctc:modeling-e442dacbfef4a0d7ea3c4c15',
      lifecycleStatus: 'active',
    },
  ];
}

function baseAuthoring(
  overrides: Partial<DomainTeachingFragmentAuthoring> = {},
): DomainTeachingFragmentAuthoring {
  return {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: 'system-modeling-core',
    fragmentVersion: '1',
    domainKeys: ['system-modeling'],
    authorityBinding: { ...FIXTURE_BINDING },
    authoritySelection: {
      authorityBinding: { ...FIXTURE_BINDING },
      sourceDatasetHash: 'd'.repeat(64),
      captureRevision: COMMIT,
      nodeIndexDigest: canonicalAuthorityNodeIndexDigest(authorityNodes()),
    },
    authoringRevision: COMMIT,
    evidenceRefs: ['authoring/evidence/system-modeling.md'],
    coreNodes: [
      {
        canonicalId: 'node.laplace',
        domainKeys: ['system-modeling'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1-modeling',
        rationale: 'Formal modeling objective',
        sourceKind: 'OBJECTIVE',
        sourceEvidence: ['authoring/objectives/laplace.md'],
      },
      {
        canonicalId: 'node.transfer',
        domainKeys: ['system-modeling'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1-modeling',
        rationale: 'Primary COVERS transfer function',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: ['authoring/steps/tf.md'],
      },
      {
        canonicalId: 'node.block',
        domainKeys: ['system-modeling'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1-modeling',
        rationale: 'Block diagram simplification',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: ['authoring/steps/block.md'],
      },
    ],
    relations: [
      {
        sourceNodeId: 'node.laplace',
        targetNodeId: 'node.transfer',
        relationType: 'PREREQUISITE',
        strength: 'REQUIRED',
        domainKeys: ['system-modeling'],
        evidenceRefs: ['authoring/handouts/laplace-to-tf.md'],
        curatorId: 'teacher.core-path',
        curatorRationale: 'Hard teaching dependency',
        authorDecisionId: 'decision-laplace-tf',
      },
      {
        sourceNodeId: 'node.transfer',
        targetNodeId: 'node.block',
        relationType: 'PREREQUISITE',
        strength: 'REQUIRED',
        domainKeys: ['system-modeling'],
        evidenceRefs: ['authoring/handouts/tf-to-block.md'],
        curatorId: 'teacher.core-path',
        curatorRationale: 'Hard teaching dependency',
        authorDecisionId: 'decision-tf-block',
      },
    ],
    ...overrides,
  };
}

describe('enable-incremental-domain-teaching-projection', () => {
  describe('immutable fragment + deterministic composition', () => {
    it('builds a fragment bound to complete Authority, evidence and digest', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      expect(fragment.contract).toBe('act-domain-teaching-fragment/v1');
      expect(fragment.fragmentId).toMatch(/^dtf-[a-f0-9]{64}$/);
      expect(fragment.fragmentDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(fragment.authorityBinding).toEqual(FIXTURE_BINDING);
      expect(fragment.coreNodeCount).toBe(fragment.coreNodes.length);
      expect(fragment.relationCount).toBe(fragment.relations.length);
      expect(fragment.relationCount).toBe(2);
      expect(fragment.relations.every((r) => r.layer === 'ACT_TEACHING')).toBe(
        true,
      );
      verifyDomainTeachingFragment(fragment);
    });

    it('produces byte-identical composition for the same ordered fragments', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const a = composeProjection({ fragments: [fragment] });
      const b = composeProjection({ fragments: [fragment] });
      expect(a.manifest.projectionHash).toBe(b.manifest.projectionHash);
      expect(a.manifest.projectionId).toBe(b.manifest.projectionId);
      expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
      expect(a.manifest.coreNodeCount).toBe(a.coreNodes.length);
      expect(a.manifest.relationCount).toBe(a.relations.length);
    });

    it('creates a new projection identity when a fragment is added', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'stability-seed',
          domainKeys: ['stability-analysis'],
          coreNodes: [
            {
              canonicalId: 'node.stability',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'OPTIONAL',
              moduleId: 'module-2-stability',
              rationale: 'Stability concept',
              sourceKind: 'PREREQUISITE_ENDPOINT',
              sourceEvidence: ['authoring/lessons/3-1/boppps.md'],
            },
            {
              canonicalId: 'node.transfer',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'REQUIRED',
              moduleId: 'module-1-modeling',
              rationale: 'Stability depends on transfer language',
              sourceKind: 'PRIMARY_COVERS',
              sourceEvidence: ['authoring/steps/tf.md'],
            },
          ],
          relations: [
            {
              sourceNodeId: 'node.transfer',
              targetNodeId: 'node.stability',
              relationType: 'PREREQUISITE',
              strength: 'RECOMMENDED',
              domainKeys: ['stability-analysis'],
              evidenceRefs: ['authoring/handouts/tf-to-stability.md'],
              curatorId: 'teacher.core-path',
              curatorRationale: 'Advisory teaching order',
              authorDecisionId: 'decision-tf-stability',
            },
          ],
        }),
        fixtureEnvelope(),
      );

      const prior = composeProjection({ fragments: [first] });
      const next = composeProjection({
        fragments: [first, second],
      });
      expect(next.manifest.projectionHash).not.toBe(prior.manifest.projectionHash);
      expect(next.manifest.fragments).toHaveLength(2);
      expect(next.manifest.fragments[0]!.fragmentDigest).toBe(first.fragmentDigest);
    });
  });

  describe('complete coherent Authority binding', () => {
    it('rejects incomplete authority binding on build', () => {
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            authorityBinding: {
              releaseId: FIXTURE_BINDING.releaseId,
              releaseSetId: null,
              snapshotId: null,
              snapshotHash: null,
            },
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(/authority-binding-incomplete|fragment-rejected/);
    });

    it('rejects incoherent snapshotId/snapshotHash pairing', () => {
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            authorityBinding: {
              releaseId: FIXTURE_BINDING.releaseId,
              releaseSetId: FIXTURE_BINDING.releaseSetId,
              snapshotId: 'snap-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
              snapshotHash: FIXTURE_HASH,
            },
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(/authority-binding-incoherent|fragment-rejected/);
    });

    it('rejects fabricated unbound identity', () => {
      expect(() =>
        assertCompleteAuthorityBinding({
          releaseId: 'unbound',
          releaseSetId: 'set-1',
          snapshotId: `snap-${FIXTURE_HASH}`,
          snapshotHash: FIXTURE_HASH,
        }),
      ).toThrow(/unbound|authority-binding-incomplete/);
    });

    it('rejects composition when any binding field mismatches across fragments', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const otherHash = 'c'.repeat(64);
      const otherBinding: DomainFragmentAuthorityBindingComplete = {
        releaseId: FIXTURE_BINDING.releaseId,
        releaseSetId: FIXTURE_BINDING.releaseSetId,
        snapshotId: `snap-${otherHash}`,
        snapshotHash: otherHash,
      };
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'other-binding',
          authorityBinding: otherBinding,
          authoritySelection: undefined,
          relations: [
            {
              sourceNodeId: 'node.laplace',
              targetNodeId: 'node.transfer',
              relationType: 'PREREQUISITE',
              strength: 'RECOMMENDED',
              domainKeys: ['system-modeling'],
              evidenceRefs: ['e.md'],
            },
          ],
        }),
        fixtureEnvelope(authorityNodes(), otherBinding),
      );
      const result = composeDomainTeachingProjectionFailClosed({
        fragments: [first, second],
      });
      expect(result.ok).toBe(false);
      expect(
        result.findings.some((f) => f.code === 'authority-binding-mismatch'),
      ).toBe(true);
    });

    it('empty coverage composition requires full binding and never emits unbound', () => {
      expect(() =>
        composeProjection({ fragments: [] }),
      ).toThrow(DomainCompositionError);

      const empty = composeProjection({
        fragments: [],
        authority: fixtureEnvelope(),
        authoringRevision: COMMIT,
      });
      expect(empty.manifest.authorityBinding).toEqual(FIXTURE_BINDING);
      expect(empty.manifest.authorityBinding.releaseId).not.toBe('unbound');
      expect(empty.manifest.coreNodeCount).toBe(0);
      expect(empty.manifest.relationCount).toBe(0);
      expect(
        empty.coverage.every((c) => c.coverage === 'empty'),
      ).toBe(true);

      // Prior complete binding may be reused without re-supplying binding.
      const fromPrior = composeProjection({
        fragments: [],
        priorArtifacts: empty,
      });
      expect(fromPrior.manifest.authorityBinding).toEqual(FIXTURE_BINDING);
    });

    it('verifyDomainTeachingFragment rejects count drift', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const drifted = {
        ...fragment,
        coreNodeCount: fragment.coreNodes.length + 1,
      };
      try {
        verifyDomainTeachingFragment(drifted);
        expect.unreachable('expected count mismatch');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainFragmentBuildError);
        expect((error as DomainFragmentBuildError).code).toBe('count-mismatch');
      }
    });
  });

  describe('endpoint, duplicate and REQUIRED-edge DAG validation', () => {
    it('rejects dangling endpoints', () => {
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            relations: [
              {
                sourceNodeId: 'node.laplace',
                targetNodeId: 'node.missing',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e.md'],
              },
            ],
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(DomainFragmentBuildError);
    });

    it('rejects duplicate relation identities', () => {
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            relations: [
              {
                sourceNodeId: 'node.laplace',
                targetNodeId: 'node.transfer',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e1.md'],
              },
              {
                sourceNodeId: 'node.laplace',
                targetNodeId: 'node.transfer',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e2.md'],
              },
            ],
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(/duplicate-edge|fragment-rejected/);
    });

    it('rejects REQUIRED-edge cycles', () => {
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            relations: [
              {
                sourceNodeId: 'node.laplace',
                targetNodeId: 'node.transfer',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e1.md'],
              },
              {
                sourceNodeId: 'node.transfer',
                targetNodeId: 'node.block',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e2.md'],
              },
              {
                sourceNodeId: 'node.block',
                targetNodeId: 'node.laplace',
                relationType: 'PREREQUISITE',
                strength: 'REQUIRED',
                domainKeys: ['system-modeling'],
                evidenceRefs: ['e3.md'],
              },
            ],
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(/required-cycle|fragment-rejected/);
    });

    it('preserves prior composition on fail-closed rejection', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const prior = composeProjection({ fragments: [first] });
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'cycle-fragment',
          relations: [
            {
              sourceNodeId: 'node.block',
              targetNodeId: 'node.laplace',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['system-modeling'],
              evidenceRefs: ['cycle.md'],
            },
          ],
        }),
        fixtureEnvelope(),
      );
      const result = composeDomainTeachingProjectionFailClosed({
        fragments: [first, second],
        priorArtifacts: prior,
      });
      expect(result.ok).toBe(false);
      expect(result.priorPreserved).toBe(true);
      expect(result.artifacts?.manifest.projectionHash).toBe(
        prior.manifest.projectionHash,
      );
      expect(result.findings.some((f) => f.code === 'required-cycle')).toBe(true);
    });
  });

  describe('coverage independent of Engineering Authority', () => {
    it('reports empty coverage without blocking engineering browsing', () => {
      const emptyFragment = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'empty-domain',
          domainKeys: ['root-locus'],
          coreNodes: [
            {
              canonicalId: 'node.laplace',
              domainKeys: ['root-locus'],
              pathEligible: true,
              cardPolicy: 'OPTIONAL',
              rationale: 'Seed membership only',
              sourceKind: 'TEACHER_CURATION',
              sourceEvidence: ['curator:seed'],
            },
          ],
          relations: [],
        }),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [emptyFragment],
      });
      const rootLocus = composed.coverage.find((c) => c.domainId === 'root-locus');
      expect(rootLocus?.coverage).toBe('empty');
      expect(engineeringBrowsingAllowed(rootLocus?.coverage)).toBe(true);
      expect(
        authorityActivationBlockedByTeachingCoverage(rootLocus?.coverage),
      ).toBe(false);
    });

    it('reports partial coverage while engineering remains usable', () => {
      const partial = buildDomainTeachingFragment(
        baseAuthoring({
          relations: [
            {
              sourceNodeId: 'node.laplace',
              targetNodeId: 'node.transfer',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['system-modeling'],
              evidenceRefs: ['e.md'],
            },
          ],
        }),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [partial],
      });
      const modeling = composed.coverage.find(
        (c) => c.domainId === 'system-modeling',
      );
      expect(modeling?.coverage).toBe('partial');
      expect(modeling?.uncoveredCoreNodeCount).toBeGreaterThan(0);
      expect(engineeringBrowsingAllowed('partial')).toBe(true);
    });

    it('distinguishes unavailable service from empty published relation', () => {
      const empty = composeProjection({
        fragments: [],
        authority: fixtureEnvelope(),
      });
      const emptyDomain = empty.coverage.find(
        (c) => c.domainId === 'system-modeling',
      );
      expect(emptyDomain?.coverage).toBe('empty');

      const unavailable = layeredDomainTeachingStatus({
        teachingCoverage: 'unavailable',
        engineeringReady: true,
      });
      expect(unavailable.teachingCoverage).toBe('unavailable');
      expect(unavailable.engineeringBrowsingAllowed).toBe(true);
      expect(unavailable.teachingLayerPresent).toBe(false);
    });
  });

  describe('independent teaching activation and cache invalidation', () => {
    it('activates teaching without requiring Authority reactivation', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [fragment],
      });
      const envelope = fixtureEnvelope();
      const activation = activateDomainTeachingProjection({
        artifacts: composed,
        expectedIdentity: independentExpectedIdentity(envelope, composed),
        activatedAt: '2026-08-13T00:00:00.000Z',
      });
      expect(activation.authoritySelectionUnchanged).toBe(true);
      expect(teachingActivationRequiresAuthorityReactivation()).toBe(false);
      expect(activation.teachingCacheFamily).toBe(
        teachingCacheFamilyFor(composed.manifest),
      );

      const pointer = toDomainTeachingCurrentPointer(activation);
      expect(pointer.contract).toBe('act-domain-teaching-projection-current/v1');
      expect(pointer.projectionId).toBe(composed.manifest.projectionId);

      const nextFragment = buildDomainTeachingFragment(
        baseAuthoring({ fragmentVersion: '2' }),
        fixtureEnvelope(),
      );
      const next = composeProjection({
        fragments: [nextFragment],
      });
      const nextActivation = activateDomainTeachingProjection({
        artifacts: next,
        expectedIdentity: independentExpectedIdentity(envelope, next),
        activatedAt: '2026-08-13T01:00:00.000Z',
      });
      expect(
        shouldInvalidateTeachingLayerCache({
          previous: {
            teachingCacheFamily: activation.teachingCacheFamily,
            projectionId: activation.projectionId,
            projectionHash: activation.projectionHash,
          },
          next: {
            teachingCacheFamily: nextActivation.teachingCacheFamily,
            projectionId: nextActivation.projectionId,
            projectionHash: nextActivation.projectionHash,
          },
        }),
      ).toBe(true);
    });
  });

  describe('registry-driven relation presentation', () => {
    it('resolves presentation from the registered runtime contract', () => {
      expect(listRegisteredTeachingRelationTypes()).toContain('PREREQUISITE');
      const resolved = resolveTeachingRelationPresentation('PREREQUISITE');
      expect(resolved.supported).toBe(true);
      expect(resolved.presentation?.labelZh).toBe('先修');
      expect(resolved.presentation?.presentationFamily).toBe(
        'teaching-prerequisite',
      );
    });

    it('loads future domain-matched relations without a frontend allowlist', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const prior = composeProjection({ fragments: [first] });

      const futureAuthoring = baseAuthoring({
        fragmentVersion: 'future-1',
        relations: [
          ...baseAuthoring().relations!,
          {
            sourceNodeId: 'node.laplace',
            targetNodeId: 'node.block',
            relationType: 'PREREQUISITE',
            strength: 'RECOMMENDED',
            domainKeys: ['system-modeling'],
            evidenceRefs: ['authoring/handouts/future-edge.md'],
            curatorId: 'teacher.core-path',
            curatorRationale: 'Future advisory edge',
            authorDecisionId: 'decision-future-advisory',
          },
        ],
      });
      const futureFragment = buildDomainTeachingFragment(
        futureAuthoring,
        fixtureEnvelope(),
      );
      const next = composeProjection({
        fragments: [futureFragment],
      });
      expect(next.manifest.projectionHash).not.toBe(prior.manifest.projectionHash);

      const domainRelations = relationsForDomain(
        next.relations,
        'system-modeling',
      );
      expect(domainRelations.length).toBe(3);
      const { presentable, omitted } = selectPresentableTeachingRelations(
        domainRelations,
      );
      expect(omitted).toHaveLength(0);
      expect(presentable.map((r) => r.strength).sort()).toEqual([
        'RECOMMENDED',
        'REQUIRED',
        'REQUIRED',
      ]);
    });

    it('omits unregistered relation types with a bounded notice', () => {
      const resolved = resolveTeachingRelationPresentation('FUTURE_UNKNOWN');
      expect(resolved.supported).toBe(false);
      expect(resolved.notice).toBe('关系暂不可解释');
    });
  });

  describe('live first fragment translation and persistence', () => {
    it('binds the first fragment to the live Authority selection exactly', () => {
      const live = liveAuthorityBindingForFirstFragment();
      expect(live.authorityBinding).toEqual(LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING);
      expect(live.authoringRevision).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
      );

      const { authoring, fragment } = translateAndBuildFirstDomainFragment({
        authority: liveAuthorityEnvelopeForFirstFragment(
          publishedInventoryAuthorityNodes(),
        ),
      });

      expect(authoring.authorityBinding).toEqual(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
      );
      expect(authoring.authoringRevision).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
      );
      expect(fragment.authorityBinding).toEqual(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
      );
      expect(fragment.authoringRevision).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
      );
      expect(fragment.coreNodeCount).toBe(fragment.coreNodes.length);
      expect(fragment.relationCount).toBe(fragment.relations.length);
      expect(fragment.relationCount).toBeGreaterThan(0);

      const composed = composeProjection({
        fragments: [fragment],
        authoringRevision: authoring.authoringRevision,
      });
      expect(composed.manifest.authorityBinding).toEqual(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
      );
      expect(composed.manifest.coreNodeCount).toBe(composed.coreNodes.length);
      expect(composed.manifest.relationCount).toBe(composed.relations.length);
      expect(composed.manifest.gatePassed).toBe(true);
    });

    it('persisted first fragment artifacts are byte-equivalent to live translation', () => {
      const live = liveAuthorityBindingForFirstFragment();
      const { authoring, fragment } = translateAndBuildFirstDomainFragment({
        authority: liveAuthorityEnvelopeForFirstFragment(
          publishedInventoryAuthorityNodes(),
        ),
      });
      const composed = composeProjection({
        fragments: [fragment],
        authoringRevision: live.authoringRevision,
      });

      const authoringPath = path.join(
        DOMAIN_FRAGMENTS_DIR,
        'first-fragment.authoring.json',
      );
      const fragmentPath = path.join(DOMAIN_FRAGMENTS_DIR, 'first-fragment.json');
      const manifestPath = path.join(
        DOMAIN_FRAGMENTS_DIR,
        'composed-manifest.json',
      );

      const persistedAuthoring = JSON.parse(readFileSync(authoringPath, 'utf8'));
      const persistedFragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
      const persistedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

      expect(JSON.stringify(persistedAuthoring)).toBe(JSON.stringify(authoring));
      expect(JSON.stringify(persistedFragment)).toBe(JSON.stringify(fragment));
      expect(JSON.stringify(persistedManifest)).toBe(
        JSON.stringify(composed.manifest),
      );

      // No fabricated identity in the real published source.
      expect(persistedFragment.authorityBinding.releaseId).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING.releaseId,
      );
      expect(persistedFragment.authorityBinding.releaseSetId).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING.releaseSetId,
      );
      expect(persistedFragment.authorityBinding.snapshotId).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING.snapshotId,
      );
      expect(persistedFragment.authorityBinding.snapshotHash).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING.snapshotHash,
      );
      expect(persistedFragment.authoringRevision).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
      );
      expect(persistedManifest.authorityBinding).toEqual(
        LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
      );

      verifyDomainTeachingFragment(persistedFragment);
    });

    it('rejects a missing or malformed Authority envelope', () => {
      expect(() =>
        translatePublishedRecordsToFirstFragmentAuthoring({
          authority: undefined as never,
        }),
      ).toThrow(/authority-envelope-malformed|envelope is required/);
    });
  });

  describe('empty domain does not force re-review of unrelated fragments', () => {
    it('publishes with explicit empty coverage for undeclared domains', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [fragment],
      });
      const frequency = composed.coverage.find(
        (c) => c.domainId === 'frequency-domain-analysis',
      );
      expect(frequency?.coverage).toBe('empty');
      expect(composed.manifest.gatePassed).toBe(true);
    });
  });

  describe('composition error path', () => {
    it('throws DomainCompositionError with prior when forced', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const prior = composeProjection({ fragments: [first] });
      try {
        composeProjection({
          fragments: [first, first],
          priorArtifacts: prior,
        });
        expect.unreachable('expected duplicate fragment key rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainCompositionError);
        expect((error as DomainCompositionError).priorArtifacts).toBe(prior);
      }
    });
  });

  describe('DECIDE B authority envelope and fail-closed activation', () => {
    it('rejects stale source digest, stale revision, or malformed envelope', () => {
      const envelope = fixtureEnvelope();
      expect(() =>
        createDomainTeachingAuthorityEnvelope({
          ...envelope,
          nodeIndexDigest: 'e'.repeat(64),
        }),
      ).toThrow(/authority-node-index-drift|does not match the normalized/);

      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            sourceInventoryDigest: 'f'.repeat(64),
            authoritySelection: undefined,
          }),
          envelope,
        ),
      ).toThrow(/source-digest-mismatch|fragment-rejected|does not match the recomputed/);

      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            authoringRevision: '1'.repeat(40),
            authoritySelection: undefined,
          }),
          envelope,
        ),
      ).toThrow(/source-revision-mismatch|fragment-rejected/);

      expect(() =>
        createDomainTeachingAuthorityEnvelope({
          binding: FIXTURE_BINDING,
          sourceDatasetHash: 'not-a-hash',
          captureRevision: COMMIT,
          authoringRevision: COMMIT,
          nodes: authorityNodes(),
        }),
      ).toThrow(/authority-envelope-malformed|must be 64 lowercase hex/);

      const otherHash = 'c'.repeat(64);
      expect(() =>
        buildDomainTeachingFragment(
          baseAuthoring({
            authorityBinding: {
              ...FIXTURE_BINDING,
              snapshotId: `snap-${otherHash}`,
              snapshotHash: otherHash,
            },
            authoritySelection: undefined,
          }),
          fixtureEnvelope(),
        ),
      ).toThrow(/authority-binding-mismatch|fragment-rejected/);
    });

    it('rejects tampered persisted fragment content', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const tampered = {
        ...fragment,
        coreNodes: fragment.coreNodes.map((node, index) =>
          index === 0 ? { ...node, rationale: 'tampered rationale' } : node,
        ),
      };
      expect(() => verifyDomainTeachingFragment(tampered)).toThrow(
        /fragment-identity-drift|source-inventory-drift|digest drift/,
      );
    });

    it('rejects forged projection, hash, release, binding or count while leaving the pointer untouched', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [fragment],
      });
      const envelope = fixtureEnvelope();
      const expected = independentExpectedIdentity(envelope, composed);
      const honest = activateDomainTeachingProjection({
        artifacts: composed,
        expectedIdentity: expected,
        activatedAt: '2026-08-13T02:00:00.000Z',
      });
      const priorPointer = toDomainTeachingCurrentPointer(honest);

      const forgedCases: Array<{
        label: string;
        artifacts: typeof composed;
      }> = [
        {
          label: 'projection',
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              projectionId: 'proj-' + '0'.repeat(64),
            },
          },
        },
        {
          label: 'hash',
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              projectionHash: '1'.repeat(64),
            },
          },
        },
        {
          label: 'release',
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              authorityBinding: {
                ...composed.manifest.authorityBinding,
                releaseId: 'ctr:release:forged',
              },
            },
          },
        },
        {
          label: 'binding',
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              authoritySelection: {
                ...composed.manifest.authoritySelection,
                sourceDatasetHash: '2'.repeat(64),
              },
            },
          },
        },
        {
          label: 'count',
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              coreNodeCount: composed.manifest.coreNodeCount + 3,
            },
          },
        },
      ];

      for (const forged of forgedCases) {
        const result = activateDomainTeachingProjectionFailClosed({
          artifacts: forged.artifacts,
          expectedIdentity: expected,
          priorPointer,
        });
        expect(result.ok, forged.label).toBe(false);
        expect(result.pointerUnchanged, forged.label).toBe(true);
        expect(result.pointer, forged.label).toEqual(priorPointer);
        expect(result.activation, forged.label).toBeNull();
      }

      expect(() =>
        activateDomainTeachingProjection({
          artifacts: {
            ...composed,
            manifest: {
              ...composed.manifest,
              gatePassed: true,
              projectionHash: '3'.repeat(64),
            },
          },
          expectedIdentity: expected,
          priorPointer,
        }),
      ).toThrow(DomainTeachingActivationError);
    });

    it('unions the same semantic edge across domain fragments under reordered input', () => {
      const modeling = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'modeling-edge',
          domainKeys: ['system-modeling'],
          coreNodes: [
            {
              canonicalId: 'node.laplace',
              domainKeys: ['system-modeling'],
              pathEligible: true,
              cardPolicy: 'REQUIRED',
              rationale: 'Laplace',
              sourceKind: 'OBJECTIVE',
              sourceEvidence: ['a.md'],
            },
            {
              canonicalId: 'node.transfer',
              domainKeys: ['system-modeling'],
              pathEligible: true,
              cardPolicy: 'REQUIRED',
              rationale: 'Transfer',
              sourceKind: 'PRIMARY_COVERS',
              sourceEvidence: ['b.md'],
            },
          ],
          relations: [
            {
              sourceNodeId: 'node.laplace',
              targetNodeId: 'node.transfer',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['system-modeling'],
              evidenceRefs: ['model.md'],
              curatorId: 'teacher.core-path',
              curatorRationale: 'Shared teaching order',
              authorDecisionId: 'decision-shared',
            },
          ],
          authoritySelection: undefined,
        }),
        fixtureEnvelope(),
      );
      const stability = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'stability-edge',
          domainKeys: ['stability-analysis'],
          coreNodes: [
            {
              canonicalId: 'node.laplace',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'REQUIRED',
              rationale: 'Laplace',
              sourceKind: 'OBJECTIVE',
              sourceEvidence: ['a.md'],
            },
            {
              canonicalId: 'node.transfer',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'REQUIRED',
              rationale: 'Transfer',
              sourceKind: 'PRIMARY_COVERS',
              sourceEvidence: ['b.md'],
            },
          ],
          relations: [
            {
              sourceNodeId: 'node.laplace',
              targetNodeId: 'node.transfer',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['stability-analysis'],
              evidenceRefs: ['stability.md'],
              curatorId: 'teacher.core-path',
              curatorRationale: 'Shared teaching order',
              authorDecisionId: 'decision-shared',
            },
          ],
          authoritySelection: undefined,
        }),
        fixtureEnvelope(),
      );

      const forward = composeProjection({
        fragments: [modeling, stability],
      });
      const reverse = composeProjection({
        fragments: [stability, modeling],
      });
      expect(forward.relations).toHaveLength(1);
      expect(reverse.relations).toHaveLength(1);
      expect(forward.relations[0]!.domainKeys).toEqual([
        'stability-analysis',
        'system-modeling',
      ]);
      expect(forward.relations[0]!.evidenceRefs).toEqual([
        'model.md',
        'stability.md',
      ]);
      expect(forward.relations[0]!.edgeDigest).toBe(reverse.relations[0]!.edgeDigest);
      expect(forward.relations[0]!.domainKeys).toEqual(
        reverse.relations[0]!.domainKeys,
      );
      expect(forward.relations[0]!.evidenceRefs).toEqual(
        reverse.relations[0]!.evidenceRefs,
      );
    });

    it('rejects a true semantic conflict on endpoints or relation type', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const laplaceToTransfer = first.relations.find(
        (relation) =>
          relation.sourceNodeId === 'node.laplace'
          && relation.targetNodeId === 'node.transfer',
      );
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'conflict-edge',
          relations: [
            {
              edgeId: laplaceToTransfer!.edgeId,
              sourceNodeId: 'node.transfer',
              targetNodeId: 'node.block',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['system-modeling'],
              evidenceRefs: ['conflict.md'],
            },
          ],
          authoritySelection: undefined,
        }),
        fixtureEnvelope(),
      );
      const result = composeDomainTeachingProjectionFailClosed({
        fragments: [first, second],
      });
      expect(result.ok).toBe(false);
      expect(result.findings.some((f) => f.code === 'semantic-conflict')).toBe(
        true,
      );
    });

    it('rejects a raw Authority node list in place of a complete envelope', () => {
      expect(() =>
        buildDomainTeachingFragment(baseAuthoring(), authorityNodes() as never),
      ).toThrow(/authority-envelope-malformed|fragment-rejected|envelope contract is invalid/);
    });

    it('P1: copied self-asserted identity cannot activate a tampered artifact', () => {
      const envelope = fixtureEnvelope();
      const fragment = buildDomainTeachingFragment(baseAuthoring(), envelope);
      const composed = composeProjection({
        fragments: [fragment],
      });
      const tampered = {
        ...composed,
        manifest: {
          ...composed.manifest,
          projectionHash: 'f'.repeat(64),
          projectionId: `proj-${'f'.repeat(64)}`,
        },
      };
      const copiedFromTampered: DomainTeachingActivationExpectedIdentity = {
        authority: {
          binding: tampered.manifest.authorityBinding,
          sourceDatasetHash: tampered.manifest.authoritySelection.sourceDatasetHash,
          captureRevision: tampered.manifest.authoritySelection.captureRevision,
          authoringRevision: tampered.manifest.authoringRevision,
          nodeIndexDigest: tampered.manifest.authoritySelection.nodeIndexDigest,
          authorityDigest: tampered.manifest.authorityDigest,
        },
        projectionId: tampered.manifest.projectionId,
        projectionHash: tampered.manifest.projectionHash,
        sourceInventoryDigest: tampered.manifest.sourceInventoryDigest,
      };
      const result = activateDomainTeachingProjectionFailClosed({
        artifacts: tampered,
        expectedIdentity: copiedFromTampered,
      });
      expect(result.ok).toBe(false);
      expect(result.activation).toBeNull();
      expect(result.errorCode).toMatch(
        /artifact-identity-drift|activation-expectation-mismatch/,
      );
    });

    it('P1: activation rejects a missing expected identity instead of self-approving', () => {
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const composed = composeProjection({
        fragments: [fragment],
      });
      const result = activateDomainTeachingProjectionFailClosed({
        artifacts: composed,
        expectedIdentity: undefined as never,
      });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('activation-expectation-missing');
    });

    it('does not export a production helper that derives expected identity from artifacts', async () => {
      const exported = await import('../teaching-projection') as Record<string, unknown>;
      expect(exported.domainTeachingActivationExpectationFor).toBeUndefined();
    });

    it('rebuilds and activates the first fragment from fixed live inputs', () => {
      const live = liveAuthorityBindingForFirstFragment();
      expect(live.captureRevision).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
      );
      expect(live.sourceDatasetHash).toBe(
        LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
      );
      const authority = liveAuthorityEnvelopeForFirstFragment(
        publishedInventoryAuthorityNodes(),
      );
      const { fragment } = translateAndBuildFirstDomainFragment({ authority });
      const composed = composeProjection({
        fragments: [fragment],
        authoringRevision: live.authoringRevision,
      });
      const activation = activateDomainTeachingProjection({
        artifacts: composed,
        expectedIdentity: independentExpectedIdentity(authority, composed),
        activatedAt: '2026-08-13T03:00:00.000Z',
      });
      expect(activation.projectionId).toBe(composed.manifest.projectionId);
      expect(activation.authorityDigest).toBe(composed.manifest.authorityDigest);
      expect(composed.manifest.gatePassed).toBe(true);
    });
  });

  describe('P1 composition authority envelope and authoring revision', () => {
    it('fails closed when a supplied Authority envelope sourceDatasetHash has drifted', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const prior = composeProjection({ fragments: [first] });
      const drifted = createDomainTeachingAuthorityEnvelope({
        binding: FIXTURE_BINDING,
        sourceDatasetHash: 'e'.repeat(64),
        captureRevision: COMMIT,
        authoringRevision: COMMIT,
        nodes: authorityNodes(),
      });
      const result = composeDomainTeachingProjectionFailClosed({
        fragments: [first],
        authority: drifted,
        authoringRevision: COMMIT,
        priorArtifacts: prior,
      });
      expect(result.ok).toBe(false);
      expect(result.priorPreserved).toBe(true);
      expect(result.artifacts).toBe(prior);
      expect(result.artifacts?.manifest.projectionHash).toBe(
        prior.manifest.projectionHash,
      );
      expect(result.errorCode).toBe('authority-selection-mismatch');
      expect(
        result.findings.some(
          (finding) =>
            finding.code === 'authority-selection-mismatch'
            && finding.message.includes('sourceDatasetHash'),
        ),
      ).toBe(true);
    });

    it('uses the canonical Authority envelope revision when no explicit revision is supplied', () => {
      const authority = fixtureEnvelope();
      const fragment = buildDomainTeachingFragment(
        baseAuthoring(),
        authority,
      );
      const composed = composeDomainTeachingProjection({
        fragments: [fragment],
        authority,
      });
      expect(composed.manifest.authoringRevision).toBe(
        authority.authoringRevision,
      );
    });

    it('retains an explicit composition authoringRevision instead of lexicographic SHA order', () => {
      const lexicallyLast = 'f'.repeat(40);
      const lexicallyFirst = '0'.repeat(40);
      const explicitRevision = 'b'.repeat(40);
      const first = buildDomainTeachingFragment(
        baseAuthoring({
          authoringRevision: lexicallyLast,
          authoritySelection: undefined,
        }),
        createDomainTeachingAuthorityEnvelope({
          binding: FIXTURE_BINDING,
          sourceDatasetHash: FIXTURE_SOURCE_DATASET_HASH,
          captureRevision: COMMIT,
          authoringRevision: lexicallyLast,
          nodes: authorityNodes(),
        }),
      );
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'stability-seed',
          domainKeys: ['stability-analysis'],
          authoringRevision: lexicallyFirst,
          authoritySelection: undefined,
          coreNodes: [
            {
              canonicalId: 'node.stability',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'OPTIONAL',
              moduleId: 'module-2-stability',
              rationale: 'Stability concept',
              sourceKind: 'PREREQUISITE_ENDPOINT',
              sourceEvidence: ['authoring/lessons/3-1/boppps.md'],
            },
          ],
          relations: [],
        }),
        createDomainTeachingAuthorityEnvelope({
          binding: FIXTURE_BINDING,
          sourceDatasetHash: FIXTURE_SOURCE_DATASET_HASH,
          captureRevision: COMMIT,
          authoringRevision: lexicallyFirst,
          nodes: authorityNodes(),
        }),
      );

      const composed = composeDomainTeachingProjection({
        fragments: [first, second],
        authoringRevision: explicitRevision,
      });
      expect(composed.manifest.authoringRevision).toBe(explicitRevision);
      expect(composed.manifest.authoringRevision).not.toBe(lexicallyLast);
      expect(composed.manifest.authoringRevision).not.toBe(lexicallyFirst);
      expect(lexicallyLast > lexicallyFirst).toBe(true);

      const reversed = composeDomainTeachingProjection({
        fragments: [second, first],
        authoringRevision: lexicallyFirst,
      });
      expect(reversed.manifest.authoringRevision).toBe(lexicallyFirst);
      expect(reversed.manifest.authoringRevision).not.toBe(lexicallyLast);
    });

    it('fails closed when a non-empty composition has no explicit revision or Authority envelope', () => {
      const first = buildDomainTeachingFragment(
        baseAuthoring(),
        fixtureEnvelope(),
      );
      const prior = composeProjection({ fragments: [first] });
      const second = buildDomainTeachingFragment(
        baseAuthoring({
          fragmentKey: 'stability-seed',
          domainKeys: ['stability-analysis'],
          coreNodes: [
            {
              canonicalId: 'node.stability',
              domainKeys: ['stability-analysis'],
              pathEligible: true,
              cardPolicy: 'OPTIONAL',
              rationale: 'Stability concept',
              sourceKind: 'PREREQUISITE_ENDPOINT',
              sourceEvidence: ['authoring/lessons/3-1/boppps.md'],
            },
          ],
          relations: [],
        }),
        fixtureEnvelope(),
      );
      try {
        composeDomainTeachingProjection({
          fragments: [first, second],
          priorArtifacts: prior,
        });
        expect.unreachable('expected missing composition revision rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainCompositionError);
        expect((error as DomainCompositionError).code).toBe(
          'authoring-revision-unspecified',
        );
        expect((error as DomainCompositionError).priorArtifacts).toBe(prior);
      }
    });
  });
});

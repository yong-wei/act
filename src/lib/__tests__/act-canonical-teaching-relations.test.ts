import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACT_TEACHING_COURSE_ID,
  COURSE_ROOT_PIPELINE_VERSION,
  LEGACY_FOUR_PREREQUISITE_PROJECTION_ID,
  MIN_AUTO_ADMIT_CONFIDENCE,
  admitQualifiedCandidates,
  buildActTeachingProjection,
  buildReviewPack,
  deriveActTeachingScope,
  detectKaqConflicts,
  emptyDispositions,
  fixtureCatalog,
  FIXTURE_AUTHORITY,
  FIXTURE_CONTAINMENT_EVIDENCE,
  generateCourseRootCandidates,
  itemAdmissionFailures,
  markdownFromReviewPack,
  planningRelationAllowed,
  pipelineConfigDigest,
  projectPublishedTeachingRelations,
  publicTeachingCoverage,
  publishActTeachingProjection,
  qualifyPipeline,
  representativeGold,
  representativeHoldout,
  resolveKaqConflict,
  runtimeResponseLeaksGovernance,
  teachingProjectionMatchesEnvelope,
  wouldIntroduceCycle,
} from '@/lib/act-canonical-teaching-relations';
import type { ActTeachingCandidate, ActTeachingDecision } from '@/lib/act-canonical-teaching-relations';

const V022_CATALOG = path.join(
  process.cwd(),
  'course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22/runtime.json',
);

function threeMemberScope() {
  return deriveActTeachingScope({
    catalog: fixtureCatalog({
      members: [
        { canonicalId: 'ctc:a', domainId: 'system-modeling' },
        { canonicalId: 'ctc:b', domainId: 'system-modeling' },
        { canonicalId: 'ctc:c', domainId: 'stability-analysis' },
      ],
    }),
    authority: FIXTURE_AUTHORITY,
  });
}

function qualifiedArtifacts() {
  const scope = threeMemberScope();
  return buildActTeachingProjection({
    scope,
    evidence: FIXTURE_CONTAINMENT_EVIDENCE,
    gold: representativeGold(),
    holdout: representativeHoldout(),
    threshold: 0.99,
  });
}

describe('act-canonical-teaching-relations', () => {
  it('derives the denominator from catalog memberships and ignores navigation', () => {
    const scope = deriveActTeachingScope({
      catalog: fixtureCatalog({
        members: [
          { canonicalId: 'ctc:a', domainId: 'system-modeling' },
          { canonicalId: 'ctc:resource-less', domainId: 'system-modeling' },
        ],
        extraDomains: [{ domainId: 'control-theory-integration', displayName: '综合' }],
      }),
      authority: FIXTURE_AUTHORITY,
      excludedIds: ['resource:handout-1'],
    });
    expect(scope.memberIds).toEqual(['ctc:a', 'ctc:resource-less']);
    expect(scope.memberIds).not.toContain('control-theory-integration');
    expect(scope.courseId).toBe(ACT_TEACHING_COURSE_ID);
  });

  it('fails closed on mixed Authority identity and does not reuse counts', () => {
    expect(() => deriveActTeachingScope({
      catalog: fixtureCatalog({
        members: [{ canonicalId: 'ctc:a', domainId: 'system-modeling' }],
      }),
      authority: { ...FIXTURE_AUTHORITY, snapshotHash: 'b'.repeat(64) },
    })).toThrow(/does not match the governance envelope/);

    const first = deriveActTeachingScope({
      catalog: fixtureCatalog({
        members: [{ canonicalId: 'ctc:a', domainId: 'system-modeling' }],
      }),
      authority: FIXTURE_AUTHORITY,
    });
    const second = deriveActTeachingScope({
      catalog: fixtureCatalog({
        catalogHash: 'c'.repeat(64),
        members: [{ canonicalId: 'ctc:a', domainId: 'system-modeling' }],
      }),
      authority: FIXTURE_AUTHORITY,
    });
    expect(second.scopeHash).not.toBe(first.scopeHash);
  });

  it('rejects self-loops and cycles for containment/prerequisite but not association', () => {
    const scope = threeMemberScope();
    const selfLoop: ActTeachingCandidate = {
      ...generateCourseRootCandidates(scope, FIXTURE_CONTAINMENT_EVIDENCE)[0],
      family: 'prerequisite',
      relationType: 'PREREQUISITE',
      targetCanonicalId: generateCourseRootCandidates(scope, FIXTURE_CONTAINMENT_EVIDENCE)[0].sourceCanonicalId,
      evidenceRefs: ['evidence:a'],
      confidence: MIN_AUTO_ADMIT_CONFIDENCE,
      exceptionReasons: [],
    };
    expect(itemAdmissionFailures({ scope, candidate: selfLoop })).toContain('self-loop');
    expect(wouldIntroduceCycle('prerequisite', [{
      edgeId: 'e1',
      family: 'prerequisite',
      relationType: 'PREREQUISITE',
      sourceCanonicalId: 'ctc:b',
      targetCanonicalId: 'ctc:a',
      direction: 'source_to_target',
      domainKeys: ['system-modeling'],
      layer: 'ACT_TEACHING',
    }], 'ctc:a', 'ctc:b')).toBe(true);
    expect(wouldIntroduceCycle('association', [{
      edgeId: 'e1',
      family: 'association',
      relationType: 'PEDAGOGICAL_ASSOCIATION',
      sourceCanonicalId: 'ctc:b',
      targetCanonicalId: 'ctc:a',
      direction: 'symmetric',
      domainKeys: ['system-modeling'],
      layer: 'ACT_TEACHING',
    }], 'ctc:a', 'ctc:b')).toBe(false);
  });

  it('does not auto-publish an unqualified pipeline or invalid item', () => {
    const gold = representativeGold();
    const holdout = representativeHoldout();
    const failed = qualifyPipeline({
      pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
      pipelineConfigDigest: pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, {
        courseRoots: [],
        parents: [],
      }),
      gold,
      holdout,
      admittedGoldIds: [],
      admittedHoldoutIds: [],
      threshold: 0.99,
    });
    expect(failed.passed).toBe(false);
  });

  it('publishes PARTIAL after containment COURSE_ROOT closure and keeps pending families', () => {
    const artifacts = qualifiedArtifacts();
    expect(artifacts.receipt.publicationState).toBe('PARTIAL');
    expect(artifacts.receipt.familyCounts.find((row) => row.family === 'containment')?.courseRootCount)
      .toBe(1);
    expect(artifacts.receipt.familyCounts.find((row) => row.family === 'containment')?.publishedEdgeCount)
      .toBe(2);
    expect(artifacts.receipt.familyCounts.find((row) => row.family === 'prerequisite')?.pendingCount)
      .toBe(3);
    expect(artifacts.reviewPack.pendingCount).toBeGreaterThan(0);
    expect(artifacts.edges).toHaveLength(2);
    const rebuilt = qualifiedArtifacts();
    expect(rebuilt.receipt.projectionHash).toBe(artifacts.receipt.projectionHash);
  });

  it('keeps a valid disposition while an extra suspicious candidate stays pending', () => {
    const artifacts = qualifiedArtifacts();
    const containment = artifacts.dispositions.find((row) => (
      row.canonicalId === 'ctc:a' && row.family === 'containment'
    ));
    expect(containment?.kind).toBe('COURSE_ROOT');
    const extra: ActTeachingCandidate = {
      ...generateCourseRootCandidates(artifacts.scope, FIXTURE_CONTAINMENT_EVIDENCE)[0],
      candidateId: 'cand-extra-low',
      confidence: 0.1,
      evidenceRefs: [],
      exceptionReasons: ['low-confidence'],
    };
    const again = admitQualifiedCandidates({
      scope: artifacts.scope,
      candidates: [extra],
      dispositions: artifacts.dispositions,
      edges: artifacts.edges,
      qualification: artifacts.qualification,
      pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
      pipelineConfigDigest: pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, FIXTURE_CONTAINMENT_EVIDENCE),
    });
    expect(again.dispositions.find((row) => (
      row.canonicalId === 'ctc:a' && row.family === 'containment'
    ))?.kind).toBe('COURSE_ROOT');
    expect(again.pending[0]?.exceptionReasons).toContain('low-confidence');
  });

  it('refuses an incomplete containment skeleton for a non-empty scope', () => {
    const scope = threeMemberScope();
    expect(() => publishActTeachingProjection({
      scope,
      dispositions: emptyDispositions(scope),
      edges: [],
      reviewPack: buildReviewPack({ scope, candidates: [], decisions: [] }),
      qualification: qualifyPipeline({
        pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
        pipelineConfigDigest: pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, FIXTURE_CONTAINMENT_EVIDENCE),
        gold: representativeGold(),
        holdout: representativeHoldout(),
        admittedGoldIds: ['gold-root-a', 'gold-parent-b'],
        admittedHoldoutIds: ['holdout-parent-c'],
        threshold: 0.99,
      }),
      candidates: [],
      decisions: [],
    })).toThrow(/lacks an admitted containment parent or COURSE_ROOT/);
  });

  it('allows an empty deterministic projection only for an empty scope', () => {
    const empty = deriveActTeachingScope({
      catalog: fixtureCatalog({ members: [] }),
      authority: FIXTURE_AUTHORITY,
    });
    const artifacts = publishActTeachingProjection({
      scope: empty,
      dispositions: [],
      edges: [],
      reviewPack: buildReviewPack({ scope: empty, candidates: [], decisions: [] }),
      qualification: qualifyPipeline({
        pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
        pipelineConfigDigest: pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, FIXTURE_CONTAINMENT_EVIDENCE),
        gold: representativeGold(),
        holdout: representativeHoldout(),
        admittedGoldIds: ['gold-root-a', 'gold-parent-b'],
        admittedHoldoutIds: ['holdout-parent-c'],
        threshold: 0.99,
      }),
      candidates: [],
      decisions: [],
    });
    expect(artifacts.receipt.publicationState).toBe('EMPTY');
    expect(artifacts.receipt.memberCount).toBe(0);
  });

  it('treats Markdown as a derived report, not authority', () => {
    const artifacts = qualifiedArtifacts();
    const markdown = markdownFromReviewPack(artifacts.reviewPack);
    expect(markdown).toContain(artifacts.reviewPack.packId);
    expect(markdown).toContain('not an authority source');
    const edited = `${markdown}\n# reviewer scribble`;
    expect(buildReviewPack({
      scope: artifacts.scope,
      candidates: artifacts.candidates,
      decisions: artifacts.decisions,
    }).packHash).toBe(artifacts.reviewPack.packHash);
    expect(edited).not.toBe(markdown);
  });

  it('keeps unresolved KAQ conflicts out of planning and retires KAQ after ACT approval', () => {
    const artifacts = qualifiedArtifacts();
    const candidate: ActTeachingCandidate = {
      ...generateCourseRootCandidates(artifacts.scope, FIXTURE_CONTAINMENT_EVIDENCE)[0],
      family: 'prerequisite',
      relationType: 'PREREQUISITE',
      targetCanonicalId: 'ctc:b',
      evidenceRefs: ['evidence:lesson'],
      confidence: MIN_AUTO_ADMIT_CONFIDENCE,
      exceptionReasons: [],
    };
    const [conflicted] = detectKaqConflicts({
      candidates: [candidate],
      kaqFallbacks: [{
        id: 'kaq-1',
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: 'ctc:b',
        scopeId: 'scoped',
      }],
    });
    expect(planningRelationAllowed({ candidate: conflicted, retirement: null })).toBe(false);
    const decision: ActTeachingDecision = {
      contract: 'act-canonical-teaching-relation-decision/v1',
      decisionId: 'dec-1',
      candidateId: conflicted.candidateId,
      scopeHash: conflicted.scopeHash,
      kind: 'approve',
      reviewerId: 'course-owner',
      decidedAt: '2026-08-22T00:00:00.000Z',
      rationale: 'ACT teaching order wins',
      originalCandidateDigest: 'd'.repeat(64),
      modifiedCandidate: null,
    };
    const retirement = resolveKaqConflict({
      candidate: conflicted,
      fallback: {
        id: 'kaq-1',
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: 'ctc:b',
        scopeId: 'scoped',
      },
      decision,
      retiredAt: '2026-08-22T00:00:00.000Z',
    });
    expect(planningRelationAllowed({ candidate: conflicted, retirement })).toBe(true);
  });

  it('omits teaching relations when the projection identity does not match', () => {
    const artifacts = qualifiedArtifacts();
    const mismatched = projectPublishedTeachingRelations({
      artifacts: {
        ...artifacts,
        receipt: {
          ...artifacts.receipt,
          projectionId: LEGACY_FOUR_PREREQUISITE_PROJECTION_ID,
        },
      },
      authority: FIXTURE_AUTHORITY,
      scopeHash: artifacts.scope.scopeHash,
      domainId: 'system-modeling',
    });
    expect(mismatched).toEqual([]);
    expect(teachingProjectionMatchesEnvelope({
      artifacts,
      authority: { ...FIXTURE_AUTHORITY, snapshotHash: '0'.repeat(64) },
      scopeHash: artifacts.scope.scopeHash,
    })).toBe(false);
    const coverage = publicTeachingCoverage({
      artifacts,
      authority: FIXTURE_AUTHORITY,
      scopeHash: artifacts.scope.scopeHash,
      domainId: 'system-modeling',
    });
    expect(coverage.status === 'partial' || coverage.status === 'empty').toBe(true);
    expect(runtimeResponseLeaksGovernance(coverage)).toBe(false);
    expect(runtimeResponseLeaksGovernance(artifacts.receipt)).toBe(true);
  });

  it('derives the real v0.22 active-domain denominator instead of the 408 snapshot', () => {
    const catalog = JSON.parse(readFileSync(V022_CATALOG, 'utf8'));
    const scope = deriveActTeachingScope({
      catalog,
      authority: FIXTURE_AUTHORITY,
    });
    expect(scope.memberIds).not.toHaveLength(408);
    expect(scope.memberIds.length).toBeGreaterThan(1000);
    expect(scope.memberIds).not.toContain('control-theory-integration');
    const rebuilt = deriveActTeachingScope({ catalog, authority: FIXTURE_AUTHORITY });
    expect(rebuilt.scopeHash).toBe(scope.scopeHash);
    const assessment = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/authoring/knowledge/teaching-projection/act-relations',
      'ctr-release-control-theory-engineering-v0.22',
      'incomplete.json',
    ), 'utf8'));
    expect(assessment.scopeHash).toBe(scope.scopeHash);
    expect(assessment.publicationState).toBe('INCOMPLETE');
    expect(assessment.memberCount).toBe(scope.memberIds.length);
    expect(assessment.reason).toBe('containment-incomplete');
  });

  it('does not mutate production selectors or import the unmatched four-prerequisite projection', () => {
    const current = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/runtime/knowledge/authority-domain-shards/current.json',
    ), 'utf8'));
    expect(current.teachingProjectionId).toBeNull();
    expect(current.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    const artifacts = qualifiedArtifacts();
    expect(artifacts.receipt.projectionId).not.toBe(LEGACY_FOUR_PREREQUISITE_PROJECTION_ID);
    expect(artifacts.edges.every((edge) => edge.layer === 'ACT_TEACHING')).toBe(true);
  });

  it('fails closed when an ordinary member has no parent or COURSE_ROOT evidence', () => {
    const scope = threeMemberScope();
    expect(() => buildActTeachingProjection({
      scope,
      evidence: {
        courseRoots: [{ canonicalId: 'ctc:a', evidenceRefs: ['evidence:handout-course-root-a'] }],
        parents: [],
      },
      gold: {
        name: 'gold',
        items: representativeGold().items.filter((item) => (
          item.id === 'gold-root-a' || item.id === 'gold-cycle' || item.id === 'gold-low-conf'
        )),
      },
      holdout: {
        name: 'holdout',
        items: representativeHoldout().items.filter((item) => item.id === 'holdout-weak'),
      },
      threshold: 0.99,
    })).toThrow(/lacks an admitted containment parent or COURSE_ROOT/);
  });

  it('rejects dispositions copied from another scope hash', () => {
    const artifacts = qualifiedArtifacts();
    const drifted = {
      ...artifacts.scope,
      catalog: { ...artifacts.scope.catalog, catalogHash: 'd'.repeat(64) },
      scopeHash: 'e'.repeat(64),
    };
    expect(() => publishActTeachingProjection({
      scope: drifted,
      dispositions: artifacts.dispositions,
      edges: artifacts.edges,
      reviewPack: artifacts.reviewPack,
      qualification: artifacts.qualification,
      candidates: artifacts.candidates,
      decisions: artifacts.decisions,
    })).toThrow(/another scope/);
  });

  it('changes review-pack hash when candidate evidence changes', () => {
    const artifacts = qualifiedArtifacts();
    const mutated = artifacts.candidates.map((row, index) => (
      index === 0 ? { ...row, confidence: 0.01 } : row
    ));
    const next = buildReviewPack({
      scope: artifacts.scope,
      candidates: mutated,
      decisions: artifacts.decisions,
    });
    expect(next.packHash).not.toBe(artifacts.reviewPack.packHash);
  });

  it('rejects COURSE_ROOT ids that are not gold/holdout admitted items', () => {
    const scope = threeMemberScope();
    expect(() => buildActTeachingProjection({
      scope,
      evidence: {
        courseRoots: [
          { canonicalId: 'ctc:a', evidenceRefs: ['evidence:handout-course-root-a'] },
          { canonicalId: 'real:x', evidenceRefs: ['evidence:unrelated'] },
        ],
        parents: FIXTURE_CONTAINMENT_EVIDENCE.parents,
      },
      gold: representativeGold(),
      holdout: representativeHoldout(),
      threshold: 0.99,
    })).toThrow(/not a gold\/holdout admitted item/);
  });

  it('rejects published containment without the matching edge set', () => {
    const artifacts = qualifiedArtifacts();
    expect(() => publishActTeachingProjection({
      ...artifacts,
      edges: [],
    })).toThrow(/exactly one matching containment parent edge|containment edge/);
  });
});

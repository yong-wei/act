import { describe, expect, it } from 'vitest';

import {
  buildCurrentCourseCoverageBatchReceipt,
  currentCourseCoverageStageInputDigest,
  sealCurrentCourseCoverageStageReview,
  type CourseCoverageReviewStage,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageStageReview,
} from '../aggregate-governance/current-course-coverage-batch-review';
import {
  buildCurrentCourseCoverageWorklist,
  buildCurrentReviewBatchManifest,
  type CurrentCourseCoverageAuthority,
  type CurrentCourseCoverageEvidenceRef,
  type CurrentCourseCoverageWorklist,
  type CurrentReviewBatchManifest,
} from '../aggregate-governance/current-course-coverage-review';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const COMMIT = 'd'.repeat(40);

function authority(): CurrentCourseCoverageAuthority {
  return {
    releaseSetId: 'release-set',
    releaseId: 'ctr:release:fixture-v1',
    releaseVersion: 'fixture-v1',
    releaseHash: SHA_A,
    sourceDatasetHash: SHA_B,
    bundleId: 'ctb:fixture-v1:r1',
    bundleRevision: 1,
    bundleDigest: SHA_B,
    projectionId: 'ctr:projection:fixture-v1:act-v2',
    projectionDigest: SHA_A,
    bindingPath: 'binding.json',
    bindingDigest: SHA_A,
    resolutionDigest: SHA_B,
    admissionReceiptPath: 'admission.json',
    admissionReceiptDigest: SHA_A,
    chainReceiptPath: 'chain.json',
    chainReceiptDigest: SHA_B,
    captureRevision: COMMIT,
    terminalDeltaReceiptId: 'delta:fixture',
    terminalDeltaInputDigest: SHA_A,
    terminalDeltaOutputDigest: SHA_B,
    terminalDeltaCaptureRevision: COMMIT,
    terminalDeltaClassification: 'SEMANTIC_CONTENT_UPDATE',
    terminalDeltaAcceptedAt: '2026-08-01T00:00:00.000Z',
    predecessor: {
      releaseId: 'ctr:release:fixture-v0',
      releaseVersion: 'fixture-v0',
      bundleId: 'ctb:fixture-v0:r1',
      projectionId: 'ctr:projection:fixture-v0:act-v2',
      projectionDigest: SHA_B,
      membershipCount: 1,
    },
  };
}

function node(id: string) {
  return {
    entity_id: id,
    entity_type: 'DomainConcept',
    semantic_name: id,
    display_name: `Label ${id}`,
    description: `Description ${id}`,
    concept_kind: 'theoretical_construct',
    release_tier: 'gold',
    publication_status: 'published',
    review_status: 'approved',
    source_coverage_count: 1,
    evidence_refs: [`aggregate:${id}`],
  };
}

function courseEvidence(id: string): CurrentCourseCoverageEvidenceRef {
  return {
    evidenceId: `course:${id}`,
    sourcePath: 'course-content/authoring/lessons/fixture.md',
    selector: `heading:${id}`,
    sourceDigest: SHA_C,
    boundary: 'independent-course',
    kind: 'lesson',
    digestSemantics: 'raw-bytes',
  };
}

function fixture(options: { independent?: boolean; members?: string[] } = {}) {
  const ids = options.members ?? ['a', 'b'];
  const independentEvidence = options.independent
    ? new Map(ids.map((id) => [id, [courseEvidence(id)]]))
    : undefined;
  const worklist = buildCurrentCourseCoverageWorklist({
    courseId: 'automatic-control',
    authority: authority(),
    authoringRevision: COMMIT,
    projectionNodes: ids.map(node),
    releaseEntries: ids.map((entity) => ({ entity, entity_role: 'knowledge_object' })),
    predecessorProjectionNodes: [],
    independentEvidence,
  });
  const manifest = buildCurrentReviewBatchManifest(worklist);
  const batch = manifest.batches[0]!;
  const binding: CurrentCourseCoverageBatchBinding = {
    batchId: batch.batchId,
    manifestBatchIndex: 0,
    sequence: batch.sequence,
    semanticGroupKey: batch.semanticGroupKey,
    memberCount: batch.members.length,
    memberDigest: batch.memberDigest,
    worklistInputDigest: worklist.worklistInputDigest,
    worklistDigest: worklist.worklistDigest,
    manifestDigest: manifest.manifestDigest,
    manifestArtifactSha256: SHA_C,
  };
  return { worklist, manifest, binding };
}

function stageReview(input: {
  worklist: CurrentCourseCoverageWorklist;
  manifest: CurrentReviewBatchManifest;
  binding: CurrentCourseCoverageBatchBinding;
  stage: CourseCoverageReviewStage;
  identity: string;
  sessionId: string;
  conclusion?: 'INCLUDE' | 'EXCLUDE' | 'DEFER';
  role?: 'formal_objective' | 'excluded_with_rationale';
  ids?: string[];
  citeIndependent?: boolean;
}): CurrentCourseCoverageStageReview {
  const promptVersion = `${input.stage.toLowerCase()}-fixture/v1`;
  const reviewInputDigest = currentCourseCoverageStageInputDigest({
    worklist: input.worklist,
    manifest: input.manifest,
    binding: input.binding,
    stage: input.stage,
    promptVersion,
  });
  const byId = new Map(input.worklist.items.map((item) => [item.canonicalId, item]));
  const ids = input.ids ?? input.manifest.batches[0]!.members.map((member) => member.canonicalId);
  const conclusion = input.conclusion ?? 'DEFER';
  return sealCurrentCourseCoverageStageReview({
    schemaVersion: 'current-course-coverage-stage-review/v1',
    batchBinding: input.binding,
    stage: input.stage,
    reviewer: {
      identity: input.identity,
      provider: 'fixture-provider',
      sessionId: input.sessionId,
      promptVersion,
    },
    reviewInputDigest,
    decisions: ids.map((canonicalId) => {
      const item = byId.get(canonicalId)!;
      const selectedEvidence = conclusion !== 'DEFER' && input.citeIndependent !== false
        ? item.evidenceRefs.find((ref) => ref.boundary === 'independent-course') ?? item.evidenceRefs[0]!
        : item.evidenceRefs[0]!;
      return {
        canonicalId,
        canonicalRevision: item.canonicalRevision,
        conclusion,
        ...(input.role ? { role: input.role } : {}),
        evidenceSufficiency: conclusion === 'DEFER' ? 'INSUFFICIENT' as const : 'SUFFICIENT' as const,
        evidenceSelectors: [selectedEvidence.selector],
        rationale: conclusion === 'DEFER'
          ? 'The frozen evidence packet has no independent current-course evidence.'
          : 'The cited independent course evidence supports this bounded conclusion.',
      };
    }),
  });
}

function documents(input = fixture()) {
  return {
    ...input,
    primary: stageReview({ ...input, stage: 'PRIMARY', identity: 'primary', sessionId: 'primary-session' }),
    challenger: stageReview({ ...input, stage: 'CHALLENGER', identity: 'challenger', sessionId: 'challenger-session' }),
  };
}

function receipt(input = documents()) {
  return buildCurrentCourseCoverageBatchReceipt({
    worklist: input.worklist,
    manifest: input.manifest,
    expectedBinding: input.binding,
    observedManifestArtifactSha256: SHA_C,
    primary: input.primary,
    challenger: input.challenger,
  });
}

describe('current CourseCoverage batch review receipt', () => {
  it('assembles deterministic blocking receipt without production authority writes', () => {
    const input = documents();
    const first = receipt(input);
    const second = receipt(input);
    expect(first).toEqual(second);
    expect(first.status).toBe('DEFERRED_EVIDENCE_BLOCKED');
    expect(first.counts).toMatchObject({ members: 2, deferredEvidenceBlocked: 2, conflicts: 0 });
    expect(first.orderedMembers.map((member) => member.canonicalId)).toEqual(['a', 'b']);
    expect(first.productionBoundaries).toEqual({
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
    });
    expect(first.aggregateCoverageGate).toBe('BLOCKED_UNRESOLVED_EVIDENCE');
  });

  it.each([
    ['batchId', 'wrong'],
    ['sequence', 9],
    ['semanticGroupKey', 'wrong'],
    ['memberCount', 99],
    ['memberDigest', SHA_A],
    ['worklistInputDigest', SHA_A],
    ['worklistDigest', SHA_A],
    ['manifestDigest', SHA_A],
  ] as const)('rejects %s binding drift', (field, value) => {
    const input = documents();
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: { ...input.binding, [field]: value },
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
    })).toThrow(/binding drift/iu);
  });

  it('rejects raw manifest digest drift and canonical revision drift', () => {
    const input = documents();
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_A,
      primary: input.primary,
      challenger: input.challenger,
    })).toThrow(/artifact digest mismatch/iu);
    const tampered = structuredClone(input.primary);
    tampered.decisions[0]!.canonicalRevision = SHA_A;
    expect(() => receipt({ ...input, primary: tampered })).toThrow(/revision drift|digest mismatch/iu);
  });

  it('rejects missing, duplicate, reordered, and out-of-slice stage members', () => {
    const input = documents();
    const missing = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: input.primary.decisions.slice(0, 1).map(({ decisionDigest: _, ...decision }) => decision),
    });
    expect(() => receipt({ ...input, primary: missing })).toThrow(/order differs|omits/iu);
    const reordered = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: [...input.primary.decisions].reverse().map(({ decisionDigest: _, ...decision }) => decision),
    });
    expect(() => receipt({ ...input, primary: reordered })).toThrow(/order differs/iu);
    const duplicate = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: [input.primary.decisions[0]!, input.primary.decisions[0]!]
        .map(({ decisionDigest: _, ...decision }) => decision),
    });
    expect(() => receipt({ ...input, primary: duplicate })).toThrow(/duplicate/iu);
    const foreign = structuredClone(input.primary);
    foreign.decisions[0]!.canonicalId = 'foreign';
    expect(() => receipt({ ...input, primary: foreign })).toThrow(/out-of-slice/iu);
  });

  it('requires Challenger for risk members and independent reviewer/session identities', () => {
    const input = documents();
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
    })).toThrow(/Challenger is required/iu);
    const sameIdentity = stageReview({
      ...input,
      stage: 'CHALLENGER',
      identity: 'primary',
      sessionId: 'other-session',
    });
    expect(() => receipt({ ...input, challenger: sameIdentity })).toThrow(/not independent/iu);
  });

  it('routes semantic disagreement to an independent terminal Third review', () => {
    const base = fixture({ independent: true, members: ['a'] });
    const primary = stageReview({
      ...base,
      stage: 'PRIMARY',
      identity: 'primary',
      sessionId: 'primary-session',
      conclusion: 'INCLUDE',
      role: 'formal_objective',
    });
    const challenger = stageReview({
      ...base,
      stage: 'CHALLENGER',
      identity: 'challenger',
      sessionId: 'challenger-session',
      conclusion: 'EXCLUDE',
      role: 'excluded_with_rationale',
    });
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: base.worklist,
      manifest: base.manifest,
      expectedBinding: base.binding,
      observedManifestArtifactSha256: SHA_C,
      primary,
      challenger,
    })).toThrow(/Third is required/iu);
    const third = stageReview({
      ...base,
      stage: 'THIRD',
      identity: 'third',
      sessionId: 'third-session',
      conclusion: 'DEFER',
    });
    const result = buildCurrentCourseCoverageBatchReceipt({
      worklist: base.worklist,
      manifest: base.manifest,
      expectedBinding: base.binding,
      observedManifestArtifactSha256: SHA_C,
      primary,
      challenger,
      third,
    });
    expect(result.terminalMembers[0]).toMatchObject({
      terminalSource: 'THIRD',
      conclusion: 'DEFER',
      coverageAuthorityState: 'UNRESOLVED_BLOCKING',
    });
    expect(result.counts).toMatchObject({ conflicts: 1, thirdReviewed: 1 });
  });

  it('forbids Third when independent stages agree', () => {
    const input = documents();
    const third = stageReview({ ...input, stage: 'THIRD', identity: 'third', sessionId: 'third-session', ids: [] });
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
      third,
    })).toThrow(/Third is forbidden/iu);
  });

  it('enforces INCLUDE, EXCLUDE, and DEFER role/evidence semantics', () => {
    const input = documents();
    const invalidDefer = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: input.primary.decisions.map(({ decisionDigest: _, ...decision }) => ({
        ...decision,
        role: 'formal_objective' as const,
      })),
    });
    expect(() => receipt({ ...input, primary: invalidDefer })).toThrow(/DEFER must remain role-free/iu);
    const includeWithoutCourseEvidence = stageReview({
      ...input,
      stage: 'PRIMARY',
      identity: 'primary',
      sessionId: 'primary-session',
      conclusion: 'INCLUDE',
      role: 'formal_objective',
      citeIndependent: false,
    });
    expect(() => receipt({ ...input, primary: includeWithoutCourseEvidence })).toThrow(/independent course evidence/iu);
  });

  it('recomputes worklist digests and requires role decisions to cite independent evidence', () => {
    const input = documents();
    const injectedWorklist = structuredClone(input.worklist);
    injectedWorklist.items[0]!.evidenceRefs.push(courseEvidence('a'));
    const injectedPrimary = structuredClone(input.primary);
    const injectedChallenger = structuredClone(input.challenger);
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: injectedWorklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: injectedPrimary,
      challenger: injectedChallenger,
    })).toThrow(/worklist input digest mismatch|worklist digest mismatch/iu);

    const roleFixture = fixture({ independent: true, members: ['a'] });
    const primary = stageReview({
      ...roleFixture,
      stage: 'PRIMARY',
      identity: 'primary',
      sessionId: 'primary-session',
      conclusion: 'INCLUDE',
      role: 'formal_objective',
    });
    const challenger = stageReview({
      ...roleFixture,
      stage: 'CHALLENGER',
      identity: 'challenger',
      sessionId: 'challenger-session',
      conclusion: 'INCLUDE',
      role: 'formal_objective',
      citeIndependent: false,
    });
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: roleFixture.worklist,
      manifest: roleFixture.manifest,
      expectedBinding: roleFixture.binding,
      observedManifestArtifactSha256: SHA_C,
      primary,
      challenger,
    })).toThrow(/must cite independent course evidence/iu);
  });

  it('rejects empty rationale, unknown evidence, and decision/document digest tamper', () => {
    const input = documents();
    const empty = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: input.primary.decisions.map(({ decisionDigest: _, ...decision }) => ({ ...decision, rationale: '' })),
    });
    expect(() => receipt({ ...input, primary: empty })).toThrow(/rationale is required/iu);
    const unknown = sealCurrentCourseCoverageStageReview({
      ...input.primary,
      decisions: input.primary.decisions.map(({ decisionDigest: _, ...decision }) => ({
        ...decision,
        evidenceSelectors: ['unknown'],
      })),
    });
    expect(() => receipt({ ...input, primary: unknown })).toThrow(/unknown evidence/iu);
    const decisionTamper = structuredClone(input.primary);
    decisionTamper.decisions[0]!.decisionDigest = SHA_A;
    expect(() => receipt({ ...input, primary: decisionTamper })).toThrow(/decisionDigest mismatch/iu);
    const documentTamper = { ...input.primary, documentDigest: SHA_A };
    expect(() => receipt({ ...input, primary: documentTamper })).toThrow(/document digest mismatch/iu);
  });
});

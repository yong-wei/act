import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import {
  assertCurrentCourseCoverageProductionBoundaryBundle,
  buildCurrentCourseCoverageBatchReceipt,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
  currentCourseCoverageStageInputDigest,
  sealCurrentCourseCoverageProductionBoundaryAttestation,
  sealCurrentCourseCoverageStageReview,
  type CourseCoverageReviewStage,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageProductionBoundaryAttestation,
  type CurrentCourseCoverageProductionBoundaryProof,
  type CurrentCourseCoverageStageReview,
} from '../aggregate-governance/current-course-coverage-batch-review';
import { publishCurrentCourseCoverageBatchBundle } from '../../../scripts/course-coverage/review-current-course-coverage-batch';
import {
  validateCurrentCourseCoverageStageSource,
  validateStageProvenanceBinding,
} from '../../../scripts/course-coverage/review-current-course-coverage-batch';
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

function productionBoundaryProof(
  overrides: Partial<CurrentCourseCoverageProductionBoundaryProof> = {},
): CurrentCourseCoverageProductionBoundaryProof {
  return {
    verificationProtocol: 'git-head-and-production-authority-pre-publication-snapshot/v2',
    receiptPath: 'course-content/authoring/knowledge/issue-1190-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1190-course-coverage-review/batch-boundary-attestation.json',
    headBefore: COMMIT,
    protectedPaths: ['src/lib/canonical-rag/authority.ts'],
    statusBefore: [],
    authoritySnapshotBeforeDigest: SHA_A,
    gitDiffCheck: 'PASS',
    mutationFlags: {
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
    },
    ...overrides,
  };
}

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
    sourceArtifactBinding: {
      artifactPath: `fixtures/${input.stage.toLowerCase()}-source.json`,
      artifactSha256: SHA_C,
      schemaVersion: 'fixture-course-coverage-source/v1',
      stage: input.stage,
      writerSessionId: input.sessionId,
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
    productionBoundaryProof: productionBoundaryProof(),
  });
}

function sourceFor(document: CurrentCourseCoverageStageReview): { document: CurrentCourseCoverageStageReview; bytes: string } {
  const bytes = JSON.stringify({
    schemaVersion: 'fixture-course-coverage-source/v1',
    stage: document.stage,
    batchBinding: {
      batchId: document.batchBinding.batchId,
      manifestBatchIndex: document.batchBinding.manifestBatchIndex,
      sequence: document.batchBinding.sequence,
      group: document.batchBinding.semanticGroupKey,
      memberCount: document.batchBinding.memberCount,
      memberDigest: document.batchBinding.memberDigest,
      manifestDigest: document.batchBinding.manifestDigest,
    },
    members: document.decisions.map((decision, ordinal) => ({
      ordinal,
      canonicalId: decision.canonicalId,
      canonicalRevision: decision.canonicalRevision,
      stageConclusion: decision.conclusion,
      rationale: decision.rationale,
      evidenceRefs: decision.evidenceSelectors.map((selector) => `fixture|aggregate|${selector}|evidence`),
    })),
  });
  return {
    document: {
      ...document,
      sourceArtifactBinding: {
        ...document.sourceArtifactBinding,
        artifactSha256: createHash('sha256').update(bytes).digest('hex'),
      },
    },
    bytes,
  };
}

function attestationFor(inputReceipt = receipt()): CurrentCourseCoverageProductionBoundaryAttestation {
  const proof = inputReceipt.productionBoundaryProof;
  return sealCurrentCourseCoverageProductionBoundaryAttestation({
    schemaVersion: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
    protocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
    receiptPath: proof.receiptPath,
    attestationPath: proof.attestationPath,
    receiptDigest: inputReceipt.receiptDigest,
    batchId: inputReceipt.batchBinding.batchId,
    headBefore: proof.headBefore,
    headAfter: proof.headBefore,
    protectedPaths: [...proof.protectedPaths],
    statusBefore: [...proof.statusBefore],
    statusAfter: [],
    authoritySnapshotBeforeDigest: proof.authoritySnapshotBeforeDigest,
    authoritySnapshotAfterDigest: proof.authoritySnapshotBeforeDigest,
    gitDiffCheck: 'PASS',
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
    expect(first.stageRecords.primary.decisions[0]).toMatchObject({
      canonicalId: 'a',
      conclusion: 'DEFER',
      rationale: expect.any(String),
    });
    expect(first.stageRecords.primary.documentDigest).toBe(first.stageDocuments.primaryDigest);
    expect(first.stageRecords.challenger?.decisions[0]?.rationale).toEqual(expect.any(String));
    expect(first.productionBoundaries).toEqual({
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
    });
    expect(first.aggregateCoverageGate).toBe('BLOCKED_UNRESOLVED_EVIDENCE');
  });

  it('rejects dirty production authority paths and invalid pre-publication snapshots', () => {
    const input = documents();
    const build = (proof: CurrentCourseCoverageProductionBoundaryProof) => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
      productionBoundaryProof: proof,
    });
    expect(() => build(productionBoundaryProof({ statusBefore: [' M src/lib/canonical-rag/authority.ts'] })))
      .toThrow(/production authority paths are dirty/iu);
    expect(() => build(productionBoundaryProof({
      authoritySnapshotBeforeDigest: 'not-a-digest',
    }))).toThrow(/authoritySnapshotBeforeDigest must be|digest/iu);
  });

  it('binds a detached post-publication attestation to the receipt and snapshots', () => {
    const inputReceipt = receipt();
    const attestation = attestationFor(inputReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation,
      receiptPath: inputReceipt.productionBoundaryProof.receiptPath,
      attestationPath: inputReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation: { ...attestation, attestationDigest: SHA_B },
      receiptPath: inputReceipt.productionBoundaryProof.receiptPath,
      attestationPath: inputReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/attestation digest mismatch/iu);
  });

  it('captures the post-receipt snapshot before publishing the attestation', async () => {
    const inputReceipt = receipt();
    const proof = inputReceipt.productionBoundaryProof;
    const receiptOutput = 'receipt-output';
    const attestationOutput = 'attestation-output';
    const receiptBytes = `${JSON.stringify(inputReceipt, null, 2)}\n`;
    const beforeSnapshot = {
      head: proof.headBefore,
      status: [...proof.statusBefore],
      snapshotDigest: proof.authoritySnapshotBeforeDigest,
    };
    const files = new Map<string, string>();
    const events: string[] = [];
    let captures = 0;
    const result = await publishCurrentCourseCoverageBatchBundle({
      receiptOutput,
      attestationOutput,
      receiptPath: proof.receiptPath,
      attestationPath: proof.attestationPath,
      receipt: inputReceipt,
      receiptBytes,
      beforeSnapshot,
      captureSnapshot: async () => {
        captures += 1;
        if (captures === 1) {
          expect(files.has(receiptOutput)).toBe(true);
          events.push('after-receipt-captured');
        } else {
          events.push('after-attestation-captured');
        }
        return beforeSnapshot;
      },
      publishArtifact: async (output, bytes, kind) => {
        files.set(output, bytes);
        events.push(`${kind}-published`);
        return 'published';
      },
      readArtifact: async (output) => files.get(output) ?? (() => { throw new Error(`missing ${output}`); })(),
      existsArtifact: async (output) => files.has(output),
      unlinkArtifact: async (output) => { files.delete(output); },
    });
    expect(events).toEqual([
      'receipt-published',
      'after-receipt-captured',
      'attestation-published',
      'after-attestation-captured',
    ]);
    expect(result.attestation.receiptDigest).toBe(inputReceipt.receiptDigest);
    expect(result.attestation.authoritySnapshotAfterDigest).toBe(beforeSnapshot.snapshotDigest);
  });

  it('fails closed when HEAD or protected authority drifts after receipt publication', async () => {
    const inputReceipt = receipt();
    const proof = inputReceipt.productionBoundaryProof;
    const beforeSnapshot = {
      head: proof.headBefore,
      status: [...proof.statusBefore],
      snapshotDigest: proof.authoritySnapshotBeforeDigest,
    };
    const files = new Map<string, string>();
    await expect(publishCurrentCourseCoverageBatchBundle({
      receiptOutput: 'receipt-output',
      attestationOutput: 'attestation-output',
      receiptPath: proof.receiptPath,
      attestationPath: proof.attestationPath,
      receipt: inputReceipt,
      receiptBytes: `${JSON.stringify(inputReceipt, null, 2)}\n`,
      beforeSnapshot,
      captureSnapshot: async () => ({ ...beforeSnapshot, head: 'e'.repeat(40) }),
      publishArtifact: async (output, bytes) => {
        files.set(output, bytes);
        return 'published';
      },
      readArtifact: async (output) => files.get(output) ?? '',
      existsArtifact: async (output) => files.has(output),
      unlinkArtifact: async (output) => { files.delete(output); },
    })).rejects.toThrow(/HEAD or production authority snapshot drifted/iu);
    expect(files.size).toBe(0);

    const { attestationDigest: _, ...attestationWithoutDigest } = attestationFor(inputReceipt);
    const driftedAttestation = sealCurrentCourseCoverageProductionBoundaryAttestation({
      ...attestationWithoutDigest,
      headAfter: 'e'.repeat(40),
    });
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation: driftedAttestation,
      receiptPath: proof.receiptPath,
      attestationPath: proof.attestationPath,
    })).toThrow(/drifted across receipt publication/iu);
  });

  it('reports cleanup failure after a post-receipt publication error', async () => {
    const inputReceipt = receipt();
    const proof = inputReceipt.productionBoundaryProof;
    const receiptOutput = 'receipt-output';
    const attestationOutput = 'attestation-output';
    const files = new Map<string, string>();
    const beforeSnapshot = {
      head: proof.headBefore,
      status: [...proof.statusBefore],
      snapshotDigest: proof.authoritySnapshotBeforeDigest,
    };
    await expect(publishCurrentCourseCoverageBatchBundle({
      receiptOutput,
      attestationOutput,
      receiptPath: proof.receiptPath,
      attestationPath: proof.attestationPath,
      receipt: inputReceipt,
      receiptBytes: `${JSON.stringify(inputReceipt, null, 2)}\n`,
      beforeSnapshot,
      captureSnapshot: async () => beforeSnapshot,
      publishArtifact: async (output, bytes, kind) => {
        if (kind === 'attestation') throw new Error('attestation write failed');
        files.set(output, bytes);
        return 'published';
      },
      readArtifact: async (output) => files.get(output) ?? '',
      existsArtifact: async (output) => files.has(output),
      unlinkArtifact: async (output) => { throw new Error(`cannot remove ${output}`); },
    })).rejects.toThrow(/attestation write failed.*cleanup failed.*cannot remove receipt-output/iu);
    expect(files.has(receiptOutput)).toBe(true);
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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
      productionBoundaryProof: productionBoundaryProof(),
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

  it('fails closed when an independent source is changed or its binding is swapped', () => {
    const bound = sourceFor(documents().primary);
    expect(() => validateCurrentCourseCoverageStageSource({ document: bound.document, sourceBytes: bound.bytes })).not.toThrow();
    expect(() => validateCurrentCourseCoverageStageSource({
      document: bound.document,
      sourceBytes: `${bound.bytes} `,
    })).toThrow(/SHA-256 mismatch/iu);
    expect(() => validateCurrentCourseCoverageStageSource({
      document: {
        ...bound.document,
        sourceArtifactBinding: { ...bound.document.sourceArtifactBinding, artifactSha256: SHA_A },
      },
      sourceBytes: bound.bytes,
    })).toThrow(/SHA-256 mismatch/iu);
    expect(() => validateStageProvenanceBinding(bound.document, {
      primary: {
        sourceArtifact: 'primary-source.json',
        sourceArtifactSha256: bound.document.sourceArtifactBinding.artifactSha256,
        sourceArtifactBinding: bound.document.sourceArtifactBinding,
        normalizedDocumentDigest: bound.document.documentDigest,
      },
    })).not.toThrow();
    expect(() => validateStageProvenanceBinding(bound.document, {
      primary: {
        sourceArtifact: 'primary-source.json',
        sourceArtifactSha256: SHA_A,
        sourceArtifactBinding: { ...bound.document.sourceArtifactBinding, artifactSha256: SHA_A },
        normalizedDocumentDigest: bound.document.documentDigest,
      },
    })).toThrow(/provenance\/source binding drift|identity drift/iu);
  });
});

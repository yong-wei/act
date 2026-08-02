import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  assertCurrentCourseCoverageProductionBoundaryBundle,
  assertCurrentCourseCoverageReviewProvenanceBinding,
  buildCurrentCourseCoverageBatchReceipt,
  classifyCurrentCourseCoverageReceiptCompatibility,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL,
  CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2,
  CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS,
  isCurrentCourseCoverageHistoricalNoBindingPair,
  currentCourseCoverageStageInputDigest,
  type CurrentCourseCoverageReviewProvenanceBinding,
  sealCurrentCourseCoverageProductionBoundaryAttestation,
  sealCurrentCourseCoverageStageReview,
  type CourseCoverageReviewStage,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageProtectedPathSnapshot,
  type CurrentCourseCoverageProductionBoundaryAttestation,
  type CurrentCourseCoverageProductionBoundaryProof,
  type CurrentCourseCoverageProductionBoundaryProofV3,
  type CurrentCourseCoverageProductionBoundaryProofV2,
  type CurrentCourseCoverageStageReview,
} from '../aggregate-governance/current-course-coverage-batch-review';
import { publishCurrentCourseCoverageBatchBundle } from '../../../scripts/course-coverage/review-current-course-coverage-batch';
import {
  assertGitAncestor,
  assertPublishedReplaySnapshot,
  assertCurrentCourseCoverageReviewProvenanceBytes,
  validateCurrentCourseCoverageStageSource,
  buildCurrentCourseCoverageReviewProvenanceBinding,
  validateStageProvenanceBinding,
  classifyPublishedReplayMode,
} from '../../../scripts/course-coverage/review-current-course-coverage-batch';
import {
  buildCurrentCourseCoverageWorklist,
  buildCurrentReviewBatchManifest,
  type CurrentCourseCoverageAuthority,
  type CurrentCourseCoverageEvidenceRef,
  type CurrentCourseCoverageWorklist,
  type CurrentReviewBatchManifest,
} from '../aggregate-governance/current-course-coverage-review';
import { sha256Canonical } from '../aggregate-governance/hash';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const COMMIT = 'd'.repeat(40);

function productionBoundaryProof(
  overrides: Partial<CurrentCourseCoverageProductionBoundaryProofV2> = {},
): CurrentCourseCoverageProductionBoundaryProofV2 {
  return {
    verificationProtocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2,
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

const V3_PROTECTED_PATH = 'src/lib/canonical-rag/authority.ts';
const V3_PROTECTED_ROWS: CurrentCourseCoverageProtectedPathSnapshot[] = [{
  relativePath: V3_PROTECTED_PATH,
  workingTreeDigest: SHA_A,
  headDigest: SHA_A,
}];

function productionBoundaryProofV3(
  overrides: Partial<CurrentCourseCoverageProductionBoundaryProofV3> = {},
): CurrentCourseCoverageProductionBoundaryProofV3 {
  return {
    verificationProtocol: 'git-head-and-production-authority-pre-publication-snapshot/v3',
    receiptPath: 'course-content/authoring/knowledge/issue-1192-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1192-course-coverage-review/batch-boundary-attestation.json',
    headBefore: COMMIT,
    protectedPaths: [V3_PROTECTED_PATH],
    protectedPathSnapshots: structuredClone(V3_PROTECTED_ROWS),
    statusBefore: [],
    authoritySnapshotBeforeDigest: sha256Canonical({ head: COMMIT, rows: V3_PROTECTED_ROWS }),
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

function protectedRowsFor(
  proof: CurrentCourseCoverageProductionBoundaryProof,
): CurrentCourseCoverageProtectedPathSnapshot[] {
  if (proof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
    throw new Error('fixture requires v3 proof');
  }
  return structuredClone(proof.protectedPathSnapshots);
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
    third: null as CurrentCourseCoverageStageReview | null,
  };
}

function receipt(
  input = documents(),
  productionBoundary: CurrentCourseCoverageProductionBoundaryProof = productionBoundaryProofV3(),
  allowLegacySourceArtifactBinding = false,
  reviewProvenanceBinding?: CurrentCourseCoverageReviewProvenanceBinding,
) {
  const effectiveReviewProvenanceBinding = reviewProvenanceBinding
    ?? (Boolean(input.primary.sourceArtifactBinding)
      && (!input.challenger || Boolean(input.challenger.sourceArtifactBinding))
      && (!input.third || Boolean(input.third.sourceArtifactBinding))
      ? provenanceFor(input).binding
      : undefined);
  return buildCurrentCourseCoverageBatchReceipt({
    worklist: input.worklist,
    manifest: input.manifest,
    expectedBinding: input.binding,
    observedManifestArtifactSha256: SHA_C,
    primary: input.primary,
    challenger: input.challenger,
    third: input.third,
    productionBoundaryProof: productionBoundary,
    reviewProvenanceBinding: effectiveReviewProvenanceBinding,
    allowLegacySourceArtifactBinding,
  });
}

function sourceFor(
  document: CurrentCourseCoverageStageReview,
  evidenceRefMode: 'string' | 'object' = 'string',
): { document: CurrentCourseCoverageStageReview; bytes: string } {
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
      evidenceRefs: decision.evidenceSelectors.map((selector) => evidenceRefMode === 'string'
        ? `fixture|aggregate|${selector}|evidence`
        : {
          evidenceId: 'fixture-evidence',
          sourcePath: 'fixture',
          selector,
          sourceDigest: SHA_A,
          boundary: 'aggregate',
          kind: 'fixture-evidence',
          digestSemantics: 'selector-evidence',
        }),
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

function provenanceFor(input: ReturnType<typeof documents>): {
  binding: CurrentCourseCoverageReviewProvenanceBinding;
  bytes: string;
  provenance: Record<string, unknown>;
} {
  const stageRecord = (document: CurrentCourseCoverageStageReview, stage: CourseCoverageReviewStage) => {
    const sourceBinding = document.sourceArtifactBinding!;
    const scope = `act:fixture:${stage.toLowerCase()}`;
    return {
      provider: document.reviewer.provider,
      sessionId: `${stage.toLowerCase()}-orchestrator-session`,
      reviewSessionId: `${stage.toLowerCase()}-orchestrator-session`,
      reviewSessionScope: scope,
      sourceWriterSessionId: sourceBinding.writerSessionId,
      sourceWriterScope: scope,
      sourceArtifact: sourceBinding.artifactPath.split('/').at(-1),
      sourceArtifactPath: sourceBinding.artifactPath,
      sourceArtifactSha256: sourceBinding.artifactSha256,
      normalizedStageArtifact: `${stage.toLowerCase()}-review.json`,
      normalizedStageArtifactPath: `fixtures/${stage.toLowerCase()}-review.json`,
      normalizedDocumentDigest: document.documentDigest,
      sourceArtifactBinding: sourceBinding,
      ...(stage === 'CHALLENGER' || stage === 'THIRD'
        ? { didNotReadPrimaryArtifact: true, sessionAuditPrimaryPathMentions: 0 }
        : {}),
      ...(stage === 'THIRD'
        ? { didNotReadChallengerArtifact: true, sessionAuditChallengerPathMentions: 0 }
        : {}),
    };
  };
  const provenance = {
    schemaVersion: 'current-course-coverage-review-provenance/v1',
    batchId: input.binding.batchId,
    independenceProtocol: {
      primaryCouldReadChallengerArtifact: false,
      challengerCouldReadPrimaryArtifact: false,
      normalizedStageArtifactsExistedDuringReviews: false,
      sourceArtifactsCreatedByIndependentWriters: true,
      sourceArtifactsBoundToNormalizedReviews: true,
      semanticConclusionsGeneratedByAssembler: false,
    },
    primary: stageRecord(input.primary, 'PRIMARY'),
    challenger: input.challenger ? stageRecord(input.challenger, 'CHALLENGER') : null,
    third: input.third ? stageRecord(input.third, 'THIRD') : null,
  };
  const bytes = JSON.stringify(provenance);
  const binding = buildCurrentCourseCoverageReviewProvenanceBinding({
    provenancePath: 'course-content/authoring/knowledge/issue-1200-course-coverage-review/review-provenance.json',
    provenanceBytes: bytes,
    batchId: input.binding.batchId,
    primary: input.primary,
    challenger: input.challenger,
    third: input.third,
  });
  return { binding, bytes, provenance };
}

function attestationFor(inputReceipt = receipt()): CurrentCourseCoverageProductionBoundaryAttestation {
  if (inputReceipt.productionBoundaryProof.verificationProtocol
    === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
    return attestationV2For(inputReceipt);
  }
  return attestationV1For(inputReceipt);
}

function attestationV1For(inputReceipt: ReturnType<typeof receipt>): CurrentCourseCoverageProductionBoundaryAttestation {
  const proof = inputReceipt.productionBoundaryProof;
  return sealCurrentCourseCoverageProductionBoundaryAttestation({
    schemaVersion: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1,
    protocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1,
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

function attestationV2For(inputReceipt: ReturnType<typeof receipt>): CurrentCourseCoverageProductionBoundaryAttestation {
  const proof = inputReceipt.productionBoundaryProof;
  if (proof.verificationProtocol !== 'git-head-and-production-authority-pre-publication-snapshot/v3') {
    throw new Error('fixture requires v3 proof');
  }
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
    protectedPathSnapshotsBefore: structuredClone(proof.protectedPathSnapshots),
    protectedPathSnapshotsAfter: structuredClone(proof.protectedPathSnapshots),
    gitDiffCheck: 'PASS',
  });
}

function resealReceipt(inputReceipt: ReturnType<typeof receipt>): ReturnType<typeof receipt> {
  const { receiptDigest: _receiptDigest, ...withoutReceiptDigest } = inputReceipt;
  return {
    ...inputReceipt,
    receiptDigest: sha256Canonical(withoutReceiptDigest),
  };
}

describe('current CourseCoverage batch review receipt', () => {
  it('derives a stable provenance binding into the receipt digest', () => {
    const input = documents();
    const { binding } = provenanceFor(input);
    const first = receipt(input, productionBoundaryProofV3(), false, binding);
    const second = receipt(input, productionBoundaryProofV3(), false, binding);
    expect(first.reviewProvenanceBinding).toEqual(binding);
    expect(first.receiptDigest).toBe(second.receiptDigest);
    expect(() => assertCurrentCourseCoverageReviewProvenanceBinding(binding)).not.toThrow();
    expect(receipt(input).reviewProvenanceBinding).toEqual(provenanceFor(input).binding);
  });

  it.each([
    ['didNotReadPrimaryArtifact=false', (challenger: Record<string, any>) => {
      challenger.didNotReadPrimaryArtifact = false;
    }],
    ['sessionAuditPrimaryPathMentions=1', (challenger: Record<string, any>) => {
      challenger.sessionAuditPrimaryPathMentions = 1;
    }],
    ['didNotReadPrimaryArtifact missing', (challenger: Record<string, any>) => {
      delete challenger.didNotReadPrimaryArtifact;
    }],
  ] as const)('rejects a resealed bound receipt when Challenger primary-read audit is tampered: %s', (_label, mutate) => {
    const input = documents();
    const boundReceipt = receipt(input, productionBoundaryProofV3());
    const binding = boundReceipt.reviewProvenanceBinding;
    if (!binding) throw new Error('fixture requires review provenance binding');
    const baselineAttestation = attestationV2For(boundReceipt);
    expect(() => assertCurrentCourseCoverageReviewProvenanceBinding(binding)).not.toThrow();
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: boundReceipt,
      attestation: baselineAttestation,
      receiptPath: boundReceipt.productionBoundaryProof.receiptPath,
      attestationPath: boundReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();

    const tamperedBinding = structuredClone(binding);
    const challenger = tamperedBinding.independenceAudit.challenger;
    if (!challenger) throw new Error('fixture requires Challenger provenance audit');
    mutate(challenger as Record<string, any>);
    const tamperedReceipt = {
      ...boundReceipt,
      reviewProvenanceBinding: tamperedBinding,
    } as ReturnType<typeof receipt>;
    const { receiptDigest: _receiptDigest, ...withoutReceiptDigest } = tamperedReceipt;
    tamperedReceipt.receiptDigest = sha256Canonical(withoutReceiptDigest);
    const tamperedAttestation = attestationV2For(tamperedReceipt);
    expect(() => assertCurrentCourseCoverageReviewProvenanceBinding(tamperedBinding))
      .toThrow(/primary artifact audit/iu);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: tamperedReceipt,
      attestation: tamperedAttestation,
      receiptPath: tamperedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: tamperedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/primary artifact audit/iu);
  });

  it.each([
    ['audit challenger missing', (tamperedReceipt: ReturnType<typeof receipt>) => {
      tamperedReceipt.reviewProvenanceBinding!.independenceAudit.challenger = null;
    }],
    ['stage record challenger missing', (tamperedReceipt: ReturnType<typeof receipt>) => {
      const stageRecords = tamperedReceipt.stageRecords as Partial<typeof tamperedReceipt.stageRecords>;
      delete stageRecords.challenger;
    }],
  ] as const)('rejects a resealed bound #1200 bundle when Challenger closure is inconsistent: %s', (_label, mutate) => {
    const boundReceipt = receipt();
    const baselineAttestation = attestationV2For(boundReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: boundReceipt,
      attestation: baselineAttestation,
      receiptPath: boundReceipt.productionBoundaryProof.receiptPath,
      attestationPath: boundReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    const tamperedReceipt = structuredClone(boundReceipt);
    mutate(tamperedReceipt);
    const resealedReceipt = resealReceipt(tamperedReceipt);
    const tamperedAttestation = attestationV2For(resealedReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: resealedReceipt,
      attestation: tamperedAttestation,
      receiptPath: resealedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: resealedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/challenger stage\/provenance closure mismatch/iu);
  });

  it.each([
    ['didNotReadPrimaryArtifact=false', (provenance: Record<string, any>) => {
      provenance.challenger.didNotReadPrimaryArtifact = false;
      return provenance;
    }, /primary artifact audit/iu],
    ['sessionAuditPrimaryPathMentions>0', (provenance: Record<string, any>) => {
      provenance.challenger.sessionAuditPrimaryPathMentions = 1;
      return provenance;
    }, /primary artifact audit/iu],
    ['same challenger session and scope', (provenance: Record<string, any>) => {
      provenance.challenger.sessionId = provenance.primary.sessionId;
      provenance.challenger.reviewSessionId = provenance.primary.reviewSessionId;
      provenance.challenger.reviewSessionScope = provenance.primary.reviewSessionScope;
      provenance.challenger.sourceWriterSessionId = provenance.primary.sourceWriterSessionId;
      provenance.challenger.sourceWriterScope = provenance.primary.sourceWriterScope;
      return provenance;
    }, /source writer\/session closure|sessions\/scopes are not independent/iu],
    ['source artifact SHA drift', (provenance: Record<string, any>) => {
      provenance.primary.sourceArtifactSha256 = SHA_A;
      return provenance;
    }, /source artifact SHA drift/iu],
    ['normalized document digest drift', (provenance: Record<string, any>) => {
      provenance.primary.normalizedDocumentDigest = SHA_A;
      return provenance;
    }, /normalized document digest drift/iu],
  ] as const)('rejects %s in a new provenance binding', (_label, mutate, expected) => {
    const input = documents();
    const { provenance } = provenanceFor(input);
    const tampered = structuredClone(provenance) as Record<string, any>;
    mutate(tampered);
    const bytes = JSON.stringify(tampered);
    expect(() => buildCurrentCourseCoverageReviewProvenanceBinding({
      provenancePath: 'course-content/authoring/knowledge/issue-1200-course-coverage-review/review-provenance.json',
      provenanceBytes: bytes,
      batchId: input.binding.batchId,
      primary: input.primary,
      challenger: input.challenger,
      third: input.third,
    })).toThrow(expected);
  });

  it('requires provenance JSON and closes a new-style replay binding', () => {
    const input = documents();
    expect(() => buildCurrentCourseCoverageReviewProvenanceBinding({
      provenancePath: 'course-content/authoring/knowledge/issue-1200-course-coverage-review/review-provenance.json',
      provenanceBytes: '{}',
      batchId: input.binding.batchId,
      primary: input.primary,
      challenger: input.challenger,
    })).toThrow(/provenance\.batchId|independenceProtocol/iu);
    const { binding, bytes } = provenanceFor(input);
    expect(() => assertCurrentCourseCoverageReviewProvenanceBytes({
      binding,
      provenanceBytes: `${bytes} `,
    })).toThrow(/SHA-256 drift/iu);
    const inputReceipt = receipt(input, productionBoundaryProofV3(), false, binding);
    const attestation = attestationFor(inputReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation,
      receiptPath: inputReceipt.productionBoundaryProof.receiptPath,
      attestationPath: inputReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
  });

  it('closes an independent Third provenance record when present', () => {
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
    const third = stageReview({
      ...base,
      stage: 'THIRD',
      identity: 'third',
      sessionId: 'third-session',
      conclusion: 'DEFER',
    });
    const input = { ...base, primary, challenger, third };
    const { provenance } = provenanceFor(input);
    const readableThird = structuredClone(provenance) as Record<string, any>;
    readableThird.third.didNotReadPrimaryArtifact = false;
    readableThird.third.sessionAuditPrimaryPathMentions = 2;
    readableThird.third.didNotReadChallengerArtifact = false;
    readableThird.third.sessionAuditChallengerPathMentions = 1;
    readableThird.independenceProtocol.thirdCouldReadPrimaryArtifact = true;
    readableThird.independenceProtocol.thirdCouldReadChallengerArtifact = true;
    const readableBinding = buildCurrentCourseCoverageReviewProvenanceBinding({
      provenancePath: 'course-content/authoring/knowledge/issue-1200-course-coverage-review/review-provenance.json',
      provenanceBytes: JSON.stringify(readableThird),
      batchId: input.binding.batchId,
      primary,
      challenger,
      third,
    });
    const readableReceipt = receipt(input, productionBoundaryProofV3(), false, readableBinding);
    const readableAttestation = attestationV2For(readableReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: readableReceipt,
      attestation: readableAttestation,
      receiptPath: readableReceipt.productionBoundaryProof.receiptPath,
      attestationPath: readableReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    for (const stage of ['primary', 'challenger', 'third'] as const) {
      const tamperedReceipt = structuredClone(readableReceipt);
      const stageAudit = tamperedReceipt.reviewProvenanceBinding!.independenceAudit[stage];
      if (!stageAudit) throw new Error(`fixture requires ${stage} provenance audit`);
      stageAudit.normalizedDocumentDigest = stageAudit.normalizedDocumentDigest === SHA_A ? SHA_B : SHA_A;
      const resealedReceipt = resealReceipt(tamperedReceipt);
      const tamperedAttestation = attestationV2For(resealedReceipt);
      expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
        receipt: resealedReceipt,
        attestation: tamperedAttestation,
        receiptPath: resealedReceipt.productionBoundaryProof.receiptPath,
        attestationPath: resealedReceipt.productionBoundaryProof.attestationPath,
      })).toThrow(/normalized document closure drift/iu);
    }
    const tampered = structuredClone(readableThird) as Record<string, any>;
    tampered.third.normalizedDocumentDigest = SHA_A;
    expect(() => buildCurrentCourseCoverageReviewProvenanceBinding({
      provenancePath: 'course-content/authoring/knowledge/issue-1200-course-coverage-review/review-provenance.json',
      provenanceBytes: JSON.stringify(tampered),
      batchId: input.binding.batchId,
      primary,
      challenger,
      third,
    })).toThrow(/normalized document digest drift/iu);
  });

  it.each([
    ['audit Third missing', (tamperedReceipt: ReturnType<typeof receipt>) => {
      tamperedReceipt.reviewProvenanceBinding!.independenceAudit.third = null;
    }],
    ['stage record Third missing', (tamperedReceipt: ReturnType<typeof receipt>) => {
      const stageRecords = tamperedReceipt.stageRecords as Partial<typeof tamperedReceipt.stageRecords>;
      delete stageRecords.third;
    }],
  ] as const)('rejects a resealed bound bundle when Third closure is inconsistent: %s', (_label, mutate) => {
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
    const third = stageReview({
      ...base,
      stage: 'THIRD',
      identity: 'third',
      sessionId: 'third-session',
      conclusion: 'DEFER',
    });
    const input = { ...base, primary, challenger, third };
    const boundReceipt = receipt(
      input,
      productionBoundaryProofV3(),
      false,
      provenanceFor(input).binding,
    );
    const baselineAttestation = attestationV2For(boundReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: boundReceipt,
      attestation: baselineAttestation,
      receiptPath: boundReceipt.productionBoundaryProof.receiptPath,
      attestationPath: boundReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    const tamperedReceipt = structuredClone(boundReceipt);
    mutate(tamperedReceipt);
    const resealedReceipt = resealReceipt(tamperedReceipt);
    const tamperedAttestation = attestationV2For(resealedReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: resealedReceipt,
      attestation: tamperedAttestation,
      receiptPath: resealedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: resealedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/third stage\/provenance closure mismatch/iu);
  });

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
      rows: protectedRowsFor(proof),
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

  it('publishes v3 protected path rows and binds the detached attestation', async () => {
    const inputReceipt = receipt(documents(), productionBoundaryProofV3());
    const proof = inputReceipt.productionBoundaryProof;
    if (proof.verificationProtocol !== 'git-head-and-production-authority-pre-publication-snapshot/v3') {
      throw new Error('fixture requires v3 proof');
    }
    const beforeSnapshot = {
      head: proof.headBefore,
      status: [...proof.statusBefore],
      rows: protectedRowsFor(proof),
      snapshotDigest: proof.authoritySnapshotBeforeDigest,
    };
    const files = new Map<string, string>();
    const result = await publishCurrentCourseCoverageBatchBundle({
      receiptOutput: proof.receiptPath,
      attestationOutput: proof.attestationPath,
      receiptPath: proof.receiptPath,
      attestationPath: proof.attestationPath,
      receipt: inputReceipt,
      receiptBytes: `${JSON.stringify(inputReceipt, null, 2)}\n`,
      beforeSnapshot,
      captureSnapshot: async () => beforeSnapshot,
      publishArtifact: async (output, bytes) => {
        files.set(output, bytes);
        return 'published';
      },
      readArtifact: async (output) => files.get(output) ?? '',
      existsArtifact: async (output) => files.has(output),
      unlinkArtifact: async (output) => { files.delete(output); },
    });
    expect(result.attestation.schemaVersion).toBe(CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION);
    expect('protectedPathSnapshotsBefore' in result.attestation).toBe(true);
    if ('protectedPathSnapshotsBefore' in result.attestation) {
      expect(result.attestation.protectedPathSnapshotsBefore).toEqual(proof.protectedPathSnapshots);
      expect(result.attestation.protectedPathSnapshotsAfter).toEqual(proof.protectedPathSnapshots);
    }
  });

  it('fails closed when HEAD or protected authority drifts after receipt publication', async () => {
    const inputReceipt = receipt();
    const proof = inputReceipt.productionBoundaryProof;
    const beforeSnapshot = {
      head: proof.headBefore,
      status: [...proof.statusBefore],
      rows: protectedRowsFor(proof),
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
      rows: protectedRowsFor(proof),
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
      productionBoundaryProof: productionBoundaryProofV3(),
      reviewProvenanceBinding: provenanceFor({ ...base, primary, challenger, third }).binding,
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

  it('accepts string and structured source evidenceRefs but rejects malformed selectors', () => {
    const input = documents();
    const structured = sourceFor(input.primary, 'object');
    expect(() => validateCurrentCourseCoverageStageSource({
      document: structured.document,
      sourceBytes: structured.bytes,
    })).not.toThrow();

    const malformed = JSON.parse(structured.bytes) as { members: Array<{ evidenceRefs: unknown[] }> };
    malformed.members[0]!.evidenceRefs = [{ evidenceId: 'missing-selector' }];
    expect(() => validateCurrentCourseCoverageStageSource({
      document: structured.document,
      sourceBytes: JSON.stringify(malformed),
    })).toThrow(/SHA-256 mismatch/iu);

    const rebound = {
      ...structured.document,
      sourceArtifactBinding: {
        ...structured.document.sourceArtifactBinding,
        artifactSha256: createHash('sha256').update(JSON.stringify(malformed)).digest('hex'),
      },
    };
    expect(() => validateCurrentCourseCoverageStageSource({
      document: rebound,
      sourceBytes: JSON.stringify(malformed),
    })).toThrow(/source evidenceRefs\[0\] is malformed/iu);
  });

  it('keeps source binding strict for new receipts while allowing legacy replay records', () => {
    const input = documents();
    const legacyPrimary = structuredClone(input.primary);
    const legacyChallenger = structuredClone(input.challenger);
    delete (legacyPrimary as { sourceArtifactBinding?: unknown }).sourceArtifactBinding;
    delete (legacyChallenger as { sourceArtifactBinding?: unknown }).sourceArtifactBinding;
    legacyPrimary.documentDigest = sha256Canonical((({ documentDigest: _, ...withoutDigest }) => withoutDigest)(legacyPrimary));
    legacyChallenger.documentDigest = sha256Canonical((({ documentDigest: _, ...withoutDigest }) => withoutDigest)(legacyChallenger));
    const legacyInput = { ...input, primary: legacyPrimary, challenger: legacyChallenger };
    expect(() => receipt(legacyInput)).toThrow(/source artifact binding is required/iu);
    expect(() => receipt(legacyInput, productionBoundaryProof(), true))
      .toThrow(/receipt without provenance binding is not an allowlisted historical artifact/iu);
    expect(() => validateCurrentCourseCoverageStageSource({
      document: legacyPrimary,
      sourceBytes: '{}',
    })).toThrow(/source artifact binding is required/iu);
  });

  it('rejects missing source binding for v3 proof and v2 attestation replay', () => {
    const input = documents();
    const legacyPrimary = structuredClone(input.primary);
    const legacyChallenger = structuredClone(input.challenger);
    delete (legacyPrimary as { sourceArtifactBinding?: unknown }).sourceArtifactBinding;
    delete (legacyChallenger as { sourceArtifactBinding?: unknown }).sourceArtifactBinding;
    legacyPrimary.documentDigest = sha256Canonical((({ documentDigest: _, ...withoutDigest }) => withoutDigest)(legacyPrimary));
    legacyChallenger.documentDigest = sha256Canonical((({ documentDigest: _, ...withoutDigest }) => withoutDigest)(legacyChallenger));
    expect(() => receipt(
      { ...input, primary: legacyPrimary, challenger: legacyChallenger },
      productionBoundaryProofV3(),
      true,
    )).toThrow(/source artifact binding is required/iu);
  });

  it('binds v3 boundary rows and rejects a v3/v1 protocol mismatch', () => {
    const inputReceipt = receipt(documents(), productionBoundaryProofV3());
    const attestation = attestationV2For(inputReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation,
      receiptPath: inputReceipt.productionBoundaryProof.receiptPath,
      attestationPath: inputReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: inputReceipt,
      attestation: attestationV1For(inputReceipt),
      receiptPath: inputReceipt.productionBoundaryProof.receiptPath,
      attestationPath: inputReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/proof\/attestation version mismatch/iu);
  });

  it('accepts only the fifteen tracked historical receipts without provenance binding', () => {
    expect(CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS).toHaveLength(15);
    for (const pair of CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS) {
      const historicalReceipt = JSON.parse(readFileSync(pair.receiptPath, 'utf8')) as ReturnType<typeof receipt>;
      const historicalAttestation = JSON.parse(
        readFileSync(pair.attestationPath, 'utf8'),
      ) as CurrentCourseCoverageProductionBoundaryAttestation;
      expect(historicalReceipt.reviewProvenanceBinding).toBeUndefined();
      expect(isCurrentCourseCoverageHistoricalNoBindingPair({
        ...pair,
        receiptDigest: historicalReceipt.receiptDigest,
        attestationDigest: historicalAttestation.attestationDigest,
      })).toBe(true);
      expect(classifyCurrentCourseCoverageReceiptCompatibility({
        receipt: historicalReceipt,
        attestation: historicalAttestation,
        receiptPath: pair.receiptPath,
        attestationPath: pair.attestationPath,
      })).toBe(historicalReceipt.productionBoundaryProof.verificationProtocol
        === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2
        ? 'LEGACY_V2_V1'
        : 'HISTORICAL_V3_NO_BINDING');
      expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
        receipt: historicalReceipt,
        attestation: historicalAttestation,
        receiptPath: pair.receiptPath,
        attestationPath: pair.attestationPath,
      })).not.toThrow();
    }
  });

  it.each([
    ['v2/v1', productionBoundaryProof()],
    ['v3/v2', productionBoundaryProofV3()],
  ] as const)('rejects a %s receipt without binding unless its digest is an allowlisted historical result', (_label, proof) => {
    const input = documents();
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
      productionBoundaryProof: proof,
    })).toThrow(/receipt without provenance binding is not an allowlisted historical artifact/iu);
  });

  it('rejects stripping a binding and resealing both v3/v2 digests', () => {
    const input = documents();
    const boundReceipt = receipt(input, productionBoundaryProofV3());
    const { reviewProvenanceBinding: _binding, receiptDigest: _digest, ...withoutBinding } = boundReceipt;
    const strippedReceipt = {
      ...withoutBinding,
      receiptDigest: sha256Canonical(withoutBinding),
    } as ReturnType<typeof receipt>;
    const strippedAttestation = attestationV2For(strippedReceipt);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: strippedReceipt,
      attestation: strippedAttestation,
      receiptPath: strippedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: strippedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/allowlisted historical artifact/iu);
  });

  it('rejects stripping v3 binding, downgrading to v2/v1, removing snapshots, and resealing both digests', () => {
    const input = documents();
    const boundReceipt = receipt(input, productionBoundaryProofV3());
    const boundProof = boundReceipt.productionBoundaryProof;
    if (boundProof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
      throw new Error('fixture requires v3 proof');
    }
    const { reviewProvenanceBinding: _binding, receiptDigest: _digest, ...withoutBinding } = boundReceipt;
    const { protectedPathSnapshots: _snapshots, ...v2Proof } = boundProof;
    const strippedReceipt = {
      ...withoutBinding,
      productionBoundaryProof: {
        ...v2Proof,
        verificationProtocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2,
      },
    } as ReturnType<typeof receipt>;
    strippedReceipt.receiptDigest = sha256Canonical(strippedReceipt);
    const strippedAttestation = attestationFor(strippedReceipt);
    expect(() => classifyCurrentCourseCoverageReceiptCompatibility({
      receipt: strippedReceipt,
      attestation: strippedAttestation,
      receiptPath: strippedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: strippedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/receipt without provenance binding is not an allowlisted historical artifact/iu);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: strippedReceipt,
      attestation: strippedAttestation,
      receiptPath: strippedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: strippedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/receipt without provenance binding is not an allowlisted historical artifact/iu);
  });

  it('rejects a retained binding after downgrading the boundary pair and resealing both digests', () => {
    const input = documents();
    const boundReceipt = receipt(input, productionBoundaryProofV3());
    const boundBinding = boundReceipt.reviewProvenanceBinding;
    if (!boundBinding) throw new Error('fixture requires review provenance binding');
    const boundAttestation = attestationV2For(boundReceipt);
    expect(classifyCurrentCourseCoverageReceiptCompatibility({
      receipt: boundReceipt,
      attestation: boundAttestation,
      receiptPath: boundReceipt.productionBoundaryProof.receiptPath,
      attestationPath: boundReceipt.productionBoundaryProof.attestationPath,
    })).toBe('BOUND_PROVENANCE');
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: boundReceipt,
      attestation: boundAttestation,
      receiptPath: boundReceipt.productionBoundaryProof.receiptPath,
      attestationPath: boundReceipt.productionBoundaryProof.attestationPath,
    })).not.toThrow();
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
      productionBoundaryProof: productionBoundaryProofV3(),
      reviewProvenanceBinding: boundBinding,
    })).not.toThrow();

    const boundProof = boundReceipt.productionBoundaryProof;
    if (boundProof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
      throw new Error('fixture requires v3 proof');
    }
    const { protectedPathSnapshots: _snapshots, ...v2Proof } = boundProof;
    const downgradedReceipt = {
      ...boundReceipt,
      productionBoundaryProof: {
        ...v2Proof,
        verificationProtocol: CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2,
      },
    } as ReturnType<typeof receipt>;
    const { receiptDigest: _downgradedDigest, ...withoutDowngradedDigest } = downgradedReceipt;
    downgradedReceipt.receiptDigest = sha256Canonical(withoutDowngradedDigest);
    const downgradedAttestation = attestationFor(downgradedReceipt);
    expect(() => classifyCurrentCourseCoverageReceiptCompatibility({
      receipt: downgradedReceipt,
      attestation: downgradedAttestation,
      receiptPath: downgradedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: downgradedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/review provenance binding requires the current v3\/v2 boundary pair/iu);
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: downgradedReceipt,
      attestation: downgradedAttestation,
      receiptPath: downgradedReceipt.productionBoundaryProof.receiptPath,
      attestationPath: downgradedReceipt.productionBoundaryProof.attestationPath,
    })).toThrow(/review provenance binding requires the current v3\/v2 boundary pair/iu);
    expect(() => buildCurrentCourseCoverageBatchReceipt({
      worklist: input.worklist,
      manifest: input.manifest,
      expectedBinding: input.binding,
      observedManifestArtifactSha256: SHA_C,
      primary: input.primary,
      challenger: input.challenger,
      productionBoundaryProof: downgradedReceipt.productionBoundaryProof,
      reviewProvenanceBinding: boundBinding,
    })).toThrow(/review provenance binding requires the current v3 boundary proof/iu);
  });

  it('keeps the v2/v1 legacy protocol matrix compatible', () => {
    const legacyPair = CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS[0]!;
    const legacyReceipt = JSON.parse(readFileSync(legacyPair.receiptPath, 'utf8')) as ReturnType<typeof receipt>;
    const legacyAttestation = JSON.parse(
      readFileSync(legacyPair.attestationPath, 'utf8'),
    ) as CurrentCourseCoverageProductionBoundaryAttestation;
    expect(classifyCurrentCourseCoverageReceiptCompatibility({
      receipt: legacyReceipt,
      attestation: legacyAttestation,
      receiptPath: legacyPair.receiptPath,
      attestationPath: legacyPair.attestationPath,
    })).toBe('LEGACY_V2_V1');
    expect(() => assertCurrentCourseCoverageProductionBoundaryBundle({
      receipt: legacyReceipt,
      attestation: legacyAttestation,
      receiptPath: legacyPair.receiptPath,
      attestationPath: legacyPair.attestationPath,
    })).not.toThrow();
  });

  it('accepts descendant and content-equivalent replay rows but rejects protected drift', () => {
    expect(classifyPublishedReplayMode({
      captureHeadIsAncestor: true,
      currentRows: V3_PROTECTED_ROWS,
      expectedRows: V3_PROTECTED_ROWS,
    })).toBe('descendant');
    expect(classifyPublishedReplayMode({
      captureHeadIsAncestor: false,
      currentRows: V3_PROTECTED_ROWS,
      expectedRows: V3_PROTECTED_ROWS,
    })).toBe('content-equivalent');
    expect(() => classifyPublishedReplayMode({
      captureHeadIsAncestor: false,
      currentRows: [{ ...V3_PROTECTED_ROWS[0]!, workingTreeDigest: SHA_B }],
      expectedRows: V3_PROTECTED_ROWS,
    })).toThrow(/protected authority bytes drifted/iu);
  });

  it('accepts descendant replay and rejects non-ancestor or protected-path drift', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const parent = execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
    expect(() => assertGitAncestor(parent, head)).not.toThrow();
    expect(() => assertGitAncestor(head, parent)).toThrow(/not an ancestor/iu);

    const protectedPaths = [
      'course-content/authoring/knowledge/course-coverage/active/automatic-control.json',
      'course-content/authoring/knowledge/course-coverage/aggregate/active/automatic-control.json',
      'src/lib/canonical-rag/authority.ts',
      'src/lib/canonical-learning-fact-identity/authority.ts',
      'src/lib/canonical-learning-fact-identity/capability.ts',
      'src/lib/canonical-learning-fact-identity/writer.ts',
    ];
    const protectedRows = protectedPaths.map((relativePath) => ({
      relativePath,
      workingTreeDigest: SHA_A,
      headDigest: SHA_A,
    }));
    const replayReceipt = receipt(documents(), productionBoundaryProofV3({
      protectedPaths,
      protectedPathSnapshots: protectedRows,
      authoritySnapshotBeforeDigest: sha256Canonical({ head: COMMIT, rows: protectedRows }),
    }));
    const replayAttestation = attestationFor(replayReceipt);
    const snapshot = {
      currentHead: head,
      status: [],
      rows: protectedRows,
      snapshotDigest: replayAttestation.authoritySnapshotBeforeDigest,
    };
    expect(() => assertPublishedReplaySnapshot(replayReceipt, replayAttestation, snapshot)).not.toThrow();
    expect(() => assertPublishedReplaySnapshot(replayReceipt, replayAttestation, {
      ...snapshot,
      snapshotDigest: SHA_B,
    })).toThrow(/snapshot drifted/iu);
    replayReceipt.productionBoundaryProof.protectedPaths = ['src/lib/canonical-learning-fact-identity/writer.ts'];
    expect(() => assertPublishedReplaySnapshot(replayReceipt, replayAttestation, snapshot))
      .toThrow(/protected authority path set drifted/iu);
  });
});

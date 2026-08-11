import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCurrentDeltaReceiptIdentity,
  assertCurrentReviewProtectedPathsClean,
  assertBatchManifestClosure,
  assertNoCurrentCoverageDecisions,
  assertNoCurrentReviewInputDrift,
  buildCurrentCourseCoverageWorklist,
  buildCurrentReviewAssemblyReceipt,
  buildCurrentReviewBatchManifest,
  canonicalRevisionForNode,
  compareCurrentReviewInputs,
  currentReviewInputFingerprint,
  classifyCurrentCourseEvidenceSource,
  deriveCurrentReviewReleasePaths,
  type CurrentCourseCoverageAuthority,
  type CurrentCourseCoverageEvidenceRef,
  type CurrentProjectionNodeLike,
} from '../aggregate-governance/current-course-coverage-review';
import { publishImmutableJsonSet } from '../aggregate-governance/current-course-coverage-review-io';

const SHA = 'a'.repeat(64);
const SHA2 = 'b'.repeat(64);
const COMMIT = 'c'.repeat(40);

function authority(): CurrentCourseCoverageAuthority {
  return {
    releaseSetId: 'candidate-release-set',
    releaseId: 'ctr:release:fixture',
    releaseVersion: 'fixture-v1',
    releaseHash: SHA,
    sourceDatasetHash: SHA2,
    bundleId: 'ctb:fixture:r1',
    bundleRevision: 1,
    bundleDigest: SHA2,
    projectionId: 'ctr:projection:fixture:act-v2',
    projectionDigest: SHA,
    bindingPath: 'course-content/authoring/knowledge/issue-1179-latest-stable-admission-v2/latest-stable-binding.json',
    bindingDigest: SHA,
    resolutionDigest: SHA2,
    admissionReceiptPath: 'admission/admission-receipt.json',
    admissionReceiptDigest: SHA,
    chainReceiptPath: 'chain/chain-intake-receipt.json',
    chainReceiptDigest: SHA2,
    captureRevision: COMMIT,
    terminalDeltaReceiptId: 'delta-receipt:fixture',
    terminalDeltaInputDigest: SHA,
    terminalDeltaOutputDigest: SHA2,
    terminalDeltaCaptureRevision: COMMIT,
    terminalDeltaClassification: 'SEMANTIC_CONTENT_UPDATE',
    terminalDeltaAcceptedAt: '2026-08-01T00:00:00.000Z',
    predecessor: {
      releaseId: 'ctr:release:fixture-prev',
      releaseVersion: 'fixture-v0',
      bundleId: 'ctb:fixture:r0',
      projectionId: 'ctr:projection:fixture-prev:domain-v2',
      projectionDigest: SHA2,
      membershipCount: 1,
    },
  };
}

function node(id: string, description = `Description ${id}`): CurrentProjectionNodeLike {
  return {
    entity_id: id,
    entity_type: 'DomainConcept',
    semantic_name: `semantic-${id}`,
    display_name: `Label ${id}`,
    description,
    concept_kind: 'theoretical_construct',
    release_tier: 'gold',
    publication_status: 'published',
    review_status: 'approved',
    source_coverage_count: 1,
    evidence_refs: [`evidence:${id}`],
  };
}

function courseEvidence(id: string): CurrentCourseCoverageEvidenceRef {
  return {
    evidenceId: `course-${id}`,
    sourcePath: 'course-content/authoring/lessons/fixture.md',
    selector: `heading:${id}`,
    sourceDigest: SHA,
    boundary: 'independent-course',
    kind: 'lesson',
    digestSemantics: 'raw-bytes',
  };
}

function releaseIdentityFixture() {
  return {
    admissionRoot: 'course-content/authoring/knowledge/issue-1179-latest-stable-admission-v2',
    binding: {
      releaseId: 'ctr:release:control-theory-engineering-v0.9',
      releaseVersion: 'control-theory-engineering-v0.9',
      bundleId: 'ctb:control-theory-engineering-v0.9:r2',
      bundleDigest: SHA,
      releaseHash: SHA,
      predecessorBundleId: 'ctb:control-theory-engineering-v0.8:r3',
    },
    terminal: {
      base: {
        releaseId: 'ctr:release:control-theory-engineering-v0.8',
        releaseVersion: 'control-theory-engineering-v0.8',
        bundleId: 'ctb:control-theory-engineering-v0.8:r3',
        runtimeProjectionId: 'ctr:projection:control-theory-engineering-v0.8:act-v2',
      },
      candidate: {
        releaseId: 'ctr:release:control-theory-engineering-v0.9',
        releaseVersion: 'control-theory-engineering-v0.9',
        bundleId: 'ctb:control-theory-engineering-v0.9:r2',
        bundleDigest: SHA,
        runtimeProjectionId: 'ctr:projection:control-theory-engineering-v0.9:act-v2',
      },
    },
  };
}

function worklist(overrides: Partial<Parameters<typeof buildCurrentCourseCoverageWorklist>[0]> = {}) {
  return buildCurrentCourseCoverageWorklist({
    courseId: 'automatic-control',
    authority: authority(),
    authoringRevision: COMMIT,
    projectionNodes: [node('a'), node('b')],
    releaseEntries: [
      { entity: 'a', entity_role: 'knowledge_object' },
      { entity: 'b', entity_role: 'knowledge_object' },
    ],
    predecessorProjectionNodes: [node('a')],
    moduleMembership: new Map([['a', ['module-a']], ['b', ['module-b']]]),
    independentEvidence: new Map([['a', [courseEvidence('a')]]]),
    ...overrides,
  });
}

describe('current CourseCoverage review-input contract', () => {
  it('regenerates byte-identical worklist and batches without a fixed denominator', () => {
    const first = worklist();
    const second = worklist();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const firstManifest = buildCurrentReviewBatchManifest(first, { maxMembersPerBatch: 1 });
    const secondManifest = buildCurrentReviewBatchManifest(second, { maxMembersPerBatch: 1 });
    expect(JSON.stringify(firstManifest)).toBe(JSON.stringify(secondManifest));
    expect(first.membership.N_current).toBe(2);
    expect(first.membership.N_current).not.toBe(3609);
  });

  it('fails closed on duplicate, missing, or unbound Canonical membership', () => {
    expect(() => worklist({
      projectionNodes: [node('a'), node('a')],
    })).toThrow(/duplicate Canonical ID/iu);
    expect(() => worklist({
      releaseEntries: [{ entity: 'a', entity_role: 'knowledge_object' }],
    })).toThrow(/membership ambiguity|disagrees/iu);
    expect(() => worklist({
      releaseEntries: [
        { entity: 'a', entity_role: 'knowledge_object' },
        { entity: 'b', entity_role: 'relation' },
      ],
    })).toThrow(/membership ambiguity|disagrees/iu);
  });

  it('keeps profile-only objects in the denominator and separates independent evidence', () => {
    const result = worklist();
    const withEvidence = result.items.find((item) => item.canonicalId === 'a')!;
    const profileOnly = result.items.find((item) => item.canonicalId === 'b')!;
    expect(withEvidence.profileOnly).toBe(false);
    expect(withEvidence.evidenceRefs.some((ref) => ref.boundary === 'independent-course')).toBe(true);
    expect(profileOnly.profileOnly).toBe(true);
    expect(profileOnly.evidenceRefs.some((ref) => ref.boundary === 'independent-course')).toBe(false);
    expect(result.items).toHaveLength(result.membership.N_current);
  });

  it('preserves prior decisions only as provenance references', () => {
    const result = worklist({
      priorDecisionRefs: new Map([['a', [{
        sourcePath: 'old/automatic-control.json',
        selector: 'entries[0]',
        artifactDigest: SHA,
        releaseId: 'old-release',
        worklistDigest: SHA2,
        authoringRevision: COMMIT,
      }]]]),
    });
    const ref = result.items.find((item) => item.canonicalId === 'a')!.priorDecisionRefs[0]!;
    expect(ref).not.toHaveProperty('role');
    expect(ref).not.toHaveProperty('verdict');
    expect(ref).not.toHaveProperty('approval');
    expect(result.items.find((item) => item.canonicalId === 'a')).not.toHaveProperty('role');
    expect(() => assertNoCurrentCoverageDecisions(result, 'fixture')).not.toThrow();
  });

  it('rejects batch overlap/omission and accepts exact disjoint union', () => {
    const result = worklist();
    const manifest = buildCurrentReviewBatchManifest(result, { maxMembersPerBatch: 1 });
    expect(manifest.batches).toHaveLength(2);
    expect(manifest.closure.disjoint).toBe(true);
    expect(manifest.closure.unionEqualsCurrent).toBe(true);
    const overlap = structuredClone(manifest);
    overlap.batches[1]!.members[0] = overlap.batches[0]!.members[0]!;
    expect(() => assertBatchManifestClosure(result, overlap)).toThrow(/manifest digest|overlapping member|memberDigest/iu);
    const omitted = structuredClone(manifest);
    omitted.batches.pop();
    expect(() => assertBatchManifestClosure(result, omitted)).toThrow(/union omits|closure/iu);
  });

  it('rejects tampered worklist and detects pre-publication input drift', () => {
    const result = worklist();
    const tampered = { ...result, worklistDigest: SHA };
    expect(() => buildCurrentReviewBatchManifest(tampered, { maxMembersPerBatch: 1 })).toThrow(/tamper|digest/iu);
    const expected = {
      bindingResolutionDigest: SHA,
      aggregateBundleDigest: SHA,
      terminalDeltaReceiptId: 'delta-receipt:fixture',
      terminalDeltaInputDigest: SHA,
      terminalDeltaOutputDigest: SHA2,
      terminalDeltaCaptureRevision: COMMIT,
      authoringRevision: COMMIT,
      captureRevision: COMMIT,
      worklistInputDigest: result.worklistInputDigest,
    };
    expect(compareCurrentReviewInputs({ expected, observed: expected })).toEqual({ stable: true, driftFields: [] });
    expect(() => assertNoCurrentReviewInputDrift({
      expected,
      observed: { ...expected, aggregateBundleDigest: SHA2 },
    })).toThrow(/input drift/iu);
  });

  it('leaves decision, selector, and writer-fence outputs untouched', () => {
    const result = worklist();
    const manifest = buildCurrentReviewBatchManifest(result);
    const receipt = buildCurrentReviewAssemblyReceipt({
      worklist: result,
      manifest,
      generatedAt: authority().terminalDeltaAcceptedAt,
    });
    expect(receipt.productionBoundaries).toEqual({
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
      evidence: null,
    });
    expect(() => assertNoCurrentCoverageDecisions(manifest, 'batch')).not.toThrow();
    expect(canonicalRevisionForNode(node('a'))).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('derives release paths from admitted identities and rejects identity mismatch', () => {
    const fixture = releaseIdentityFixture();
    const paths = deriveCurrentReviewReleasePaths(fixture);
    expect(paths.currentReleaseRoot).toContain('/control-theory-engineering-v0.9');
    expect(paths.predecessorReleaseRoot).toContain('/control-theory-engineering-v0.8');
    expect(paths.currentProjectionPath).toMatch(/\/act-projection\.json$/u);
    expect(() => deriveCurrentReviewReleasePaths({
      ...fixture,
      terminal: {
        ...fixture.terminal,
        candidate: { ...fixture.terminal.candidate, bundleId: 'ctb:control-theory-engineering-v1.0:r1' },
      },
    })).toThrow(/identity mismatch|releaseVersion/iu);
  });

  it('includes ACTIVE_COVERAGE and module source digests in the input fingerprint', () => {
    const baseline = currentReviewInputFingerprint({
      activeCoverage: SHA,
      moduleMembership: SHA2,
      'moduleSource:module.json': SHA,
    });
    expect(currentReviewInputFingerprint({
      activeCoverage: SHA2,
      moduleMembership: SHA2,
      'moduleSource:module.json': SHA,
    })).not.toBe(baseline);
    expect(currentReviewInputFingerprint({
      activeCoverage: SHA,
      moduleMembership: SHA2,
      'moduleSource:module.json': SHA2,
    })).not.toBe(baseline);
  });

  it('classifies only explicit course sources as independent evidence', () => {
    expect(classifyCurrentCourseEvidenceSource('course-content/authoring/lessons/1-2/design/handout.md')).toMatchObject({
      boundary: 'independent-course',
      digestSemantics: 'raw-bytes',
    });
    expect(classifyCurrentCourseEvidenceSource('course-content/authoring/knowledge/canonical-nodes.json')).toMatchObject({
      boundary: 'aggregate',
    });
    expect(classifyCurrentCourseEvidenceSource('topic-lexicon')).toMatchObject({
      boundary: 'aggregate',
      digestSemantics: 'selector-evidence',
    });
    expect(classifyCurrentCourseEvidenceSource('course-content/authoring/unknown.md')).toBeNull();
  });

  it('rejects a staged Delta receipt whose order or identity differs from admission', () => {
    const admitted = [{ order: 1, persisted: { receiptId: 'delta-1', inputDigest: SHA } }];
    expect(() => assertCurrentDeltaReceiptIdentity(admitted, structuredClone(admitted))).not.toThrow();
    expect(() => assertCurrentDeltaReceiptIdentity(admitted, [{ ...admitted[0], order: 2 }])).toThrow(/identity differs/iu);
    expect(() => assertCurrentDeltaReceiptIdentity(admitted, [])).toThrow(/counts disagree/iu);
  });

  it('fails closed when a protected selector or writer path is dirty before generation', () => {
    expect(() => assertCurrentReviewProtectedPathsClean(' M src/lib/canonical-rag/authority.ts')).toThrow(/protected/iu);
    expect(() => assertCurrentReviewProtectedPathsClean('')).not.toThrow();
  });

  it('publishes a complete immutable set atomically and rejects partial or differing sets without writes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'current-review-io-'));
    const outputs = [
      { relativePath: 'worklist.json', value: { digest: SHA } },
      { relativePath: 'batch-manifest.json', value: { digest: SHA2 } },
      { relativePath: 'assembly-receipt.json', value: { status: 'PASS' } },
      { relativePath: 'gate-summary.json', value: { status: 'PASS' } },
    ];
    try {
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).resolves.toBe('published');
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).resolves.toBe('identical');
      const target = path.join(root, 'evidence');
      const before = await readFile(path.join(target, 'worklist.json'));
      await rm(path.join(target, 'gate-summary.json'));
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).rejects.toThrow(/partial output/iu);
      expect(await readFile(path.join(target, 'worklist.json'))).toEqual(before);
      await writeFile(path.join(target, 'gate-summary.json'), '{"status":"CHANGED"}\n');
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).rejects.toThrow(/immutable output differs/iu);
      expect(await readFile(path.join(target, 'gate-summary.json'))).toEqual(Buffer.from('{"status":"CHANGED"}\n'));
      await writeFile(path.join(target, 'extra.json'), '{}\n');
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).rejects.toThrow(/entry set/iu);
      await rm(path.join(target, 'extra.json'));
      await mkdir(path.join(target, 'extra-directory'));
      await expect(publishImmutableJsonSet({ root, outputRoot: 'evidence', outputs })).rejects.toThrow(/entry set/iu);
      expect(await readdir(target)).toContain('worklist.json');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

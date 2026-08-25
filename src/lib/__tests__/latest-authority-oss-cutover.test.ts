import { describe, expect, it } from 'vitest';

import type {
  ActTeachingCandidate,
  ActTeachingDispositionKind,
} from '@/lib/act-canonical-teaching-relations/contracts';

import {
  LatestAuthorityCutoverError,
  type AuthorityComponentIdentity,
  type CapturedPublicContract,
  type ResourceBindingCacheIdentityInput,
  type SupportedPublicContract,
  type TeachingDecisionCacheIdentityInput,
} from '@/lib/latest-authority-oss-cutover/contracts';
import {
  assertCaptureCompatible,
  assertCaptureStable,
  reopenAuthorityCaptureReceipt,
  sealAuthorityCaptureReceipt,
  validateCapturedPublicContract,
  type AuthorityCaptureInput,
} from '@/lib/latest-authority-oss-cutover/capture';
import {
  assertBaselineMatchesActiveReceipt,
  assertNoDiscoveredObjectsEnterDenominator,
  assertReleaseNotHistorical,
  buildActiveBaseline,
  buildCombinedDenominator,
  buildExplicitDelta,
} from '@/lib/latest-authority-oss-cutover/denominator';
import {
  assertNotUnconditionalFullRebuild,
  computeDerivationDelta,
  resourceBindingCacheIdentity,
  teachingDecisionCacheIdentity,
} from '@/lib/latest-authority-oss-cutover/incremental';
import { captureActiveLogicalInventory } from '@/lib/latest-authority-oss-cutover/inventory-capture';
import {
  adapterSupportsPublicBundle3,
  capturedPublicContractFromBundle,
  resolveSealedActkgMainCommit,
} from '@/lib/latest-authority-oss-cutover/latest-complete-capture';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertContinuityQualified,
  assertDevelopmentOnlyExcludedFromManifest,
  evaluateContinuityGate,
} from '@/lib/latest-authority-oss-cutover/continuity-gate';
import {
  assertProjectionEligibleForCoordinatedSelection,
  assertTeachingClosureComplete,
  evaluateTeachingClosure,
} from '@/lib/latest-authority-oss-cutover/teaching-closure';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function componentClosure(): AuthorityComponentIdentity[] {
  return [
    { kind: 'module', componentId: 'mod-1', version: 'v1', sha256: HASH_A },
    { kind: 'terminology', componentId: 'term-1', version: 'v1', sha256: HASH_B },
    { kind: 'integration', componentId: 'integ-1', version: 'v1', sha256: HASH_C },
    { kind: 'coverage', componentId: 'cov-1', version: 'v1', sha256: HASH_D },
    { kind: 'overlay', componentId: 'ovl-1', version: 'v1', sha256: HASH_A },
    { kind: 'registry', componentId: 'reg-1', version: 'v1', sha256: HASH_B },
  ];
}

function capturedContract(): CapturedPublicContract {
  return {
    schemaVersion: '0.3.0',
    schemaSha256: HASH_A,
    contractVersion: 'actkg-public-bundle/2',
    requiredMembers: ['release', 'ctkg_schema'],
    profiles: ['runtime', 'domain'],
    representativeParse: 'COMPLETE',
  };
}

function supportedContract(): SupportedPublicContract {
  return {
    schemaIdentities: { '0.3.0': HASH_A },
    contractVersions: ['actkg-public-bundle/2'],
    requiredMembers: ['release', 'ctkg_schema'],
    profiles: ['runtime', 'domain'],
  };
}

function captureInput(overrides: Partial<AuthorityCaptureInput> = {}): AuthorityCaptureInput {
  return {
    capturedAt: '2026-08-23T00:00:00.000Z',
    actkgMainCommit: 'maincommit0001',
    sourceCommit: 'sourcecommit01',
    sourceTag: 'v0.37.0',
    packagingCommit: 'packaging0001',
    stableTag: 'aggregate-v0.37.0',
    releaseId: 'rel-1',
    releaseVersion: '0.37.0',
    bundleId: 'bundle-1',
    bundleDigest: HASH_C,
    manifestSha256: HASH_D,
    sha256sumsSha256: HASH_A,
    validationReportSha256: HASH_B,
    actkgWorktreeDirty: false,
    componentIdentities: componentClosure(),
    predecessorBundleId: null,
    candidateChain: [],
    capturedPublicContract: capturedContract(),
    adapterContractVersion: 'actkg-public-bundle/2',
    supportedPublicContract: supportedContract(),
    ...overrides,
  };
}

describe('execution-time Authority capture', () => {
  it('requires the clean checkout to equal the sealed formal main ref', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'actkg-capture-ref-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
    }).trim();
    try {
      git('init', '--quiet');
      git('config', 'user.email', 'test@example.invalid');
      git('config', 'user.name', 'ACT test');
      git('checkout', '--quiet', '-b', 'main');
      writeFileSync(path.join(root, 'release.txt'), 'main\n');
      git('add', 'release.txt');
      git('commit', '--quiet', '-m', 'main release');
      const main = git('rev-parse', 'main');
      expect(resolveSealedActkgMainCommit(root, 'main')).toBe(main);

      git('checkout', '--quiet', '-b', 'other');
      writeFileSync(path.join(root, 'release.txt'), 'other\n');
      git('commit', '--quiet', '-am', 'other release');
      expect(() => resolveSealedActkgMainCommit(root, 'main'))
        .toThrow(/does not equal sealed formal ref/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('seals a compatible capture and keeps it stable after newer upstream releases', () => {
    const receipt = sealAuthorityCaptureReceipt(captureInput());
    expect(receipt.compatibility.classification).toBe('COMPATIBLE');
    expect(receipt.captureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertCaptureCompatible(receipt)).not.toThrow();
    const observed = sealAuthorityCaptureReceipt(captureInput());
    expect(() => assertCaptureStable(receipt, observed)).not.toThrow();
  });

  it('reopens a legitimately sealed receipt by reusing its capture id', () => {
    const receipt = sealAuthorityCaptureReceipt(captureInput());
    expect(() => reopenAuthorityCaptureReceipt(receipt)).not.toThrow();
    const tampered = { ...receipt, sourceCommit: 'tamperedcommit' };
    expect(() => reopenAuthorityCaptureReceipt(tampered)).toThrow(/does not match its sealed hash/);
    // A capture sealed ADAPTATION_REQUIRED cannot be relabeled compatible
    // without breaking its own hash.
    const incompatible = sealAuthorityCaptureReceipt(captureInput({
      capturedPublicContract: { ...capturedContract(), schemaSha256: HASH_B },
    }));
    expect(incompatible.compatibility.classification).toBe('ADAPTATION_REQUIRED');
    const relabeled = {
      ...incompatible,
      compatibility: {
        ...incompatible.compatibility,
        classification: 'COMPATIBLE' as const,
        incompatibleReasons: [],
      },
    };
    expect(() => reopenAuthorityCaptureReceipt(relabeled)).toThrow(/does not match its sealed hash/);
  });

  it('rejects a dirty worktree and an incomplete component closure', () => {
    expect(() => sealAuthorityCaptureReceipt(captureInput({ actkgWorktreeDirty: true })))
      .toThrow(LatestAuthorityCutoverError);
    expect(() => sealAuthorityCaptureReceipt({
      ...captureInput(),
      componentIdentities: componentClosure().filter((component) => component.kind !== 'overlay'),
    })).toThrow(/missing the declared overlay component/);
  });

  it('classifies incompatible public contracts as ADAPTATION_REQUIRED and fails closed', () => {
    const drifted = captureInput({
      capturedPublicContract: { ...capturedContract(), schemaSha256: HASH_B },
    });
    const receipt = sealAuthorityCaptureReceipt(drifted);
    expect(receipt.compatibility.classification).toBe('ADAPTATION_REQUIRED');
    expect(receipt.compatibility.incompatibleReasons.length).toBeGreaterThan(0);
    expect(() => assertCaptureCompatible(receipt)).toThrow(/adaptation/i);
    const verdict = validateCapturedPublicContract(
      { ...capturedContract(), representativeParse: 'FAILED' },
      supportedContract(),
    );
    expect(verdict.classification).toBe('ADAPTATION_REQUIRED');
  });
});

function activeRelease() {
  return {
    releaseId: 'runtime-89fef308a',
    manifestSha256: HASH_A,
    treeSha256: HASH_B,
    activeReceiptHash: HASH_C,
    lifecycleGeneration: 7,
  };
}

function baselineEntries() {
  return [
    { entryId: 'e1', resourceId: 'res-video-1', classification: 'resource' as const, subtype: 'video' },
    { entryId: 'e2', resourceId: 'res-card-1', classification: 'resource' as const, subtype: 'card' },
    { entryId: 'e3', resourceId: null, classification: 'non-resource' as const, subtype: null },
  ];
}

describe('active-baseline-plus-explicit-delta denominator', () => {
  it('freezes the active baseline and combines a declared delta', () => {
    const baseline = buildActiveBaseline({ activeRelease: activeRelease(), entries: baselineEntries() });
    expect(baseline.logicalResourceCount).toBe(2);
    expect(baseline.nonResourceCount).toBe(1);
    const delta = buildExplicitDelta([
      { resourceId: 'res-new-1', subtype: 'handout', change: 'NEW', sourceIdentity: 'git:abc' },
      { resourceId: 'res-video-1', subtype: 'video', change: 'CHANGED', sourceIdentity: 'git:def' },
    ]);
    const denominator = buildCombinedDenominator(baseline, delta);
    expect(denominator.entries.map((entry) => entry.resourceId).sort()).toEqual(
      ['res-card-1', 'res-new-1', 'res-video-1'],
    );
    expect(denominator.entries.find((entry) => entry.resourceId === 'res-new-1')?.origin).toBe('DELTA');
  });

  it('rejects duplicate delta inputs and NEW entries over baseline resources', () => {
    expect(() => buildExplicitDelta([
      { resourceId: 'x', subtype: 'card', change: 'NEW', sourceIdentity: 'git:1' },
      { resourceId: 'x', subtype: 'card', change: 'NEW', sourceIdentity: 'git:2' },
    ])).toThrow(LatestAuthorityCutoverError);
    const baseline = buildActiveBaseline({ activeRelease: activeRelease(), entries: baselineEntries() });
    const delta = buildExplicitDelta([
      { resourceId: 'res-video-1', subtype: 'video', change: 'NEW', sourceIdentity: 'git:def' },
    ]);
    expect(() => buildCombinedDenominator(baseline, delta)).toThrow(/must be declared CHANGED/);
  });

  it('keeps historical OSS objects and workspace discovery out of the denominator', () => {
    const baseline = buildActiveBaseline({ activeRelease: activeRelease(), entries: baselineEntries() });
    const denominator = buildCombinedDenominator(baseline, buildExplicitDelta([]));
    expect(() => assertNoDiscoveredObjectsEnterDenominator(['res-video-1'], denominator)).not.toThrow();
    expect(() => assertNoDiscoveredObjectsEnterDenominator(['res-orphan-9'], denominator))
      .toThrow(/Undeclared resources cannot enter the successor denominator/);
    expect(() => assertReleaseNotHistorical({ releaseId: 'runtime-old', state: 'rollback' }))
      .toThrow(/cannot determine the denominator/);
  });

  it('fails on active-receipt drift', () => {
    const baseline = buildActiveBaseline({ activeRelease: activeRelease(), entries: baselineEntries() });
    expect(() => assertBaselineMatchesActiveReceipt(baseline, {
      ...activeRelease(),
      manifestSha256: HASH_D,
    })).toThrow(/drifted from the sealed baseline/);
  });
});

function bindingIdentityInput(overrides: Partial<ResourceBindingCacheIdentityInput> = {}): ResourceBindingCacheIdentityInput {
  return {
    resourceId: 'res-1',
    atomId: 'atom-1',
    resourceContentSha256: HASH_A,
    atomContentSha256: HASH_B,
    canonicalId: 'canon-1',
    canonicalSemanticRevision: 'rev-1',
    role: 'EXPLAINS',
    courseScopeId: 'act-control-theory',
    sourceIdentity: 'git:blob-1',
    qualifiedPipelineIdentity: 'pipeline-v1',
    anchorContract: 'media-paragraph/v1',
    launcherContract: 'source-owned-launch/v1',
    ...overrides,
  };
}

function decisionIdentityInput(overrides: Partial<TeachingDecisionCacheIdentityInput> = {}): TeachingDecisionCacheIdentityInput {
  return {
    canonicalId: 'canon-1',
    canonicalSemanticRevision: 'rev-1',
    family: 'prerequisite',
    scopeHash: HASH_A,
    evidenceDigest: HASH_B,
    candidateOrDecisionHash: HASH_C,
    qualifiedPipelineIdentity: 'pipeline-v1',
    ...overrides,
  };
}

describe('dependency-complete incremental derivation', () => {
  it('invalidates the cache identity whenever any component changes', () => {
    const base = resourceBindingCacheIdentity(bindingIdentityInput());
    for (const override of [
      { atomContentSha256: HASH_C },
      { canonicalSemanticRevision: 'rev-2' },
      { role: 'COVERS' },
      { courseScopeId: 'other-course' },
      { sourceIdentity: 'git:blob-2' },
      { qualifiedPipelineIdentity: 'pipeline-v2' },
      { anchorContract: 'anchor/v2' },
      { launcherContract: 'launch/v2' },
    ] as const) {
      expect(resourceBindingCacheIdentity(bindingIdentityInput(override))).not.toBe(base);
    }
    expect(teachingDecisionCacheIdentity(decisionIdentityInput()))
      .not.toBe(teachingDecisionCacheIdentity(decisionIdentityInput({ evidenceDigest: HASH_D })));
  });

  it('reuses unchanged records and recomputes only affected ones', () => {
    const predecessor = {
      'frb-keep': resourceBindingCacheIdentity(bindingIdentityInput()),
      'frb-change': resourceBindingCacheIdentity(bindingIdentityInput({ resourceId: 'res-1' })),
      'dec-keep': teachingDecisionCacheIdentity(decisionIdentityInput()),
    };
    const successor = {
      'frb-keep': resourceBindingCacheIdentity(bindingIdentityInput()),
      'frb-change': resourceBindingCacheIdentity(bindingIdentityInput({ resourceId: 'res-2' })),
      'dec-keep': teachingDecisionCacheIdentity(decisionIdentityInput()),
      'dec-new': teachingDecisionCacheIdentity(decisionIdentityInput({ canonicalId: 'canon-2' })),
    };
    const delta = computeDerivationDelta({ predecessor, successor });
    expect([...delta.reused].sort()).toEqual(['dec-keep', 'frb-keep']);
    expect([...delta.invalidated].sort()).toEqual(['dec-new', 'frb-change']);
    expect(delta.receipt.reusedCount).toBe(2);
    expect(() => assertNotUnconditionalFullRebuild(delta, { predecessorRecordCount: 3 })).not.toThrow();
  });

  it('an Authority version change alone does not rebuild the library', () => {
    // The cache identity has no release-label field: same Canonical
    // semantics, same inputs, same identity regardless of graph version.
    const identity = resourceBindingCacheIdentity(bindingIdentityInput());
    const afterGraphUpgrade = resourceBindingCacheIdentity(bindingIdentityInput());
    expect(identity).toBe(afterGraphUpgrade);
  });

  it('guards against unconditional full rebuilds', () => {
    const predecessor = {
      a: HASH_A,
      b: HASH_B,
      c: HASH_C,
    };
    const successor = {
      a: HASH_D,
      b: 'e'.repeat(64),
      c: 'f'.repeat(64),
    };
    const delta = computeDerivationDelta({ predecessor, successor });
    expect(() => assertNotUnconditionalFullRebuild(delta, { predecessorRecordCount: 3 }))
      .toThrow(/rebuilds the full library/);
  });
});

function healthyDisposition(resourceId: string) {
  return {
    resourceId,
    atomicDispositionsComplete: true,
    canonicalBindingCount: 1,
    launchContractQualified: true,
    failureKinds: [],
  };
}

describe('production teaching-resource continuity gate', () => {
  function denominatorWith(entries: { resourceId: string; origin: 'BASELINE' | 'DELTA' }[]) {
    const baseline = buildActiveBaseline({ activeRelease: activeRelease(), entries: baselineEntries() });
    const delta = buildExplicitDelta(
      entries
        .filter((entry) => entry.origin === 'DELTA')
        .map((entry) => ({ resourceId: entry.resourceId, subtype: 'card', change: 'NEW' as const, sourceIdentity: 'git:1' })),
    );
    return buildCombinedDenominator(baseline, delta);
  }

  it('blocks LessonItem-referenced STATIC_MEDIA without an atomic binding', () => {
    const baseline = buildActiveBaseline({
      activeRelease: activeRelease(),
      entries: [
        ...baselineEntries(),
        {
          entryId: 'e-media',
          resourceId: 'res-static-1',
          classification: 'resource',
          subtype: 'STATIC_MEDIA',
        },
      ],
    });
    const denominator = buildCombinedDenominator(baseline, buildExplicitDelta([]));
    const receipt = evaluateContinuityGate({
      denominator,
      baselineReleaseId: activeRelease().releaseId,
      dispositions: [healthyDisposition('res-video-1'), healthyDisposition('res-card-1')],
      retirements: [],
    });
    expect(receipt.status).not.toBe('QUALIFIED');
    expect(receipt.blocked.some((row) => row.resourceId === 'res-static-1')).toBe(true);
  });

  it('blocks qualification when a baseline resource has a technical failure', () => {
    const denominator = denominatorWith([{ resourceId: 'res-video-1', origin: 'BASELINE' }]);
    const receipt = evaluateContinuityGate({
      denominator,
      baselineReleaseId: activeRelease().releaseId,
      dispositions: [
        healthyDisposition('res-video-1'),
        {
          resourceId: 'res-card-1',
          atomicDispositionsComplete: false,
          canonicalBindingCount: 0,
          launchContractQualified: false,
          failureKinds: ['unsafe-anchor'],
        },
      ],
      retirements: [],
    });
    expect(receipt.status).toBe('BLOCKED');
    expect(receipt.blocked[0]?.resourceId).toBe('res-card-1');
    // The failed resource stays in the denominator instead of disappearing.
    expect(denominator.entries.map((entry) => entry.resourceId)).toContain('res-card-1');
    expect(() => assertContinuityQualified(receipt)).toThrow(/Coordinated qualification is blocked/);
  });

  it('honors an explicit course-owner retirement', () => {
    const denominator = denominatorWith([{ resourceId: 'res-card-1', origin: 'BASELINE' }]);
    const receipt = evaluateContinuityGate({
      denominator,
      baselineReleaseId: activeRelease().releaseId,
      dispositions: [healthyDisposition('res-video-1')],
      retirements: [{
        contract: 'resource-owner-retirement-decision/v1',
        retirementId: 'ret-1',
        resourceId: 'res-card-1',
        activeReleaseId: activeRelease().releaseId,
        reason: 'superseded by newer edition',
        evidenceRefs: ['evidence-1'],
        decidedBy: 'course-owner',
        decidedAt: '2026-08-23T00:00:00.000Z',
        invalidationRules: ['release-change'],
      }],
    });
    expect(receipt.status).toBe('QUALIFIED');
    expect(receipt.retired).toEqual(['res-card-1']);
  });

  it('keeps failed new resources development-only and out of the successor manifest', () => {
    const denominator = denominatorWith([
      { resourceId: 'res-video-1', origin: 'BASELINE' },
      { resourceId: 'res-new-1', origin: 'DELTA' },
    ]);
    const receipt = evaluateContinuityGate({
      denominator,
      baselineReleaseId: activeRelease().releaseId,
      dispositions: [
        healthyDisposition('res-video-1'),
        healthyDisposition('res-card-1'),
        {
          resourceId: 'res-new-1',
          atomicDispositionsComplete: false,
          canonicalBindingCount: 0,
          launchContractQualified: false,
          failureKinds: ['failed-recognition'],
        },
      ],
      retirements: [],
    });
    expect(receipt.status).toBe('QUALIFIED');
    expect(receipt.developmentOnly).toEqual(['res-new-1']);
    expect(() => assertDevelopmentOnlyExcludedFromManifest(['res-new-1'], receipt))
      .toThrow(/must not enter the successor formal manifest/);
    expect(() => assertDevelopmentOnlyExcludedFromManifest(['res-video-1'], receipt)).not.toThrow();
  });

  it('rejects retirement decisions that do not bind the exact active release', () => {
    const denominator = denominatorWith([{ resourceId: 'res-card-1', origin: 'BASELINE' }]);
    expect(() => evaluateContinuityGate({
      denominator,
      baselineReleaseId: activeRelease().releaseId,
      dispositions: [],
      retirements: [{
        contract: 'resource-owner-retirement-decision/v1',
        retirementId: 'ret-1',
        resourceId: 'res-card-1',
        activeReleaseId: 'runtime-something-else',
        reason: 'x',
        evidenceRefs: ['e'],
        decidedBy: 'owner',
        decidedAt: '2026-08-23T00:00:00.000Z',
        invalidationRules: ['r'],
      }],
    })).toThrow(/must bind the exact active Release/);
  });
});

const SCOPE_HASH = 'f'.repeat(64);

function familyDisposition(
  canonicalId: string,
  family: 'containment' | 'prerequisite' | 'association',
  kind: ActTeachingDispositionKind,
  evidenceRefs: string[] = ['ev-1'],
) {
  return {
    scopeHash: SCOPE_HASH,
    canonicalId,
    family,
    kind,
    edgeId: kind === 'PUBLISHED_EDGE' ? 'edge-1' : null,
    evidenceRefs,
    rationale: 'reviewed',
  };
}

function closureMembers() {
  return [{ canonicalId: 'node-1' }, { canonicalId: 'node-2' }];
}

function pendingCandidate(): ActTeachingCandidate {
  return {
    contract: 'act-canonical-teaching-relation-candidate/v1',
    candidateId: 'cand-1',
    scopeHash: SCOPE_HASH,
    family: 'prerequisite',
    relationType: 'PREREQUISITE',
    sourceCanonicalId: 'node-2',
    targetCanonicalId: 'node-1',
    direction: 'source_to_target',
    origin: 'QUALIFIED_PIPELINE',
    pipelineVersion: 'p1',
    pipelineConfigDigest: 'd1',
    confidence: 0.9,
    strength: null,
    evidenceRefs: ['ev'],
    evidenceDigest: HASH_B,
    authority: {
      releaseId: 'rel-1',
      snapshotId: 'snap-1',
      snapshotHash: HASH_C,
      releaseSetId: 'set-1',
    },
    conflicts: [],
    exceptionReasons: ['pending review'],
  };
}

function completeTeachingInputs() {
  return {
    scopeHash: SCOPE_HASH,
    authorityCaptureHash: HASH_A,
    members: closureMembers(),
    dispositions: [
      familyDisposition('node-1', 'containment', 'COURSE_ROOT'),
      familyDisposition('node-1', 'prerequisite', 'NO_RELATION'),
      familyDisposition('node-1', 'association', 'PUBLISHED_EDGE'),
      familyDisposition('node-2', 'containment', 'PUBLISHED_EDGE'),
      familyDisposition('node-2', 'prerequisite', 'PUBLISHED_EDGE'),
      familyDisposition('node-2', 'association', 'NO_RELATION'),
    ],
    candidates: [],
    decisions: [],
  };
}

describe('complete Teaching Projection governance', () => {
  it('qualifies a three-family complete closure without edge quotas', () => {
    const receipt = evaluateTeachingClosure(completeTeachingInputs());
    expect(receipt.status).toBe('COMPLETE');
    expect(receipt.zeroUnresolved).toBe(true);
    expect(() => assertTeachingClosureComplete(receipt)).not.toThrow();
    const counts = Object.fromEntries(receipt.familyCounts.map((family) => [family.family, family.closedCount]));
    expect(counts).toEqual({ containment: 2, prerequisite: 2, association: 2 });
  });

  it('rejects closures with unresolved candidates and wrong-scope dispositions', () => {
    const inputs = completeTeachingInputs();
    const withPending = {
      ...inputs,
      dispositions: inputs.dispositions.filter(
        (disposition) => !(disposition.canonicalId === 'node-2' && disposition.family === 'prerequisite'),
      ),
      candidates: [pendingCandidate()],
      decisions: [],
    };
    const receipt = evaluateTeachingClosure(withPending);
    expect(receipt.status).toBe('INCOMPLETE');
    expect(() => assertTeachingClosureComplete(receipt)).toThrow(/teaching closure is INCOMPLETE/);

    const foreignScope = completeTeachingInputs();
    foreignScope.dispositions = [
      ...foreignScope.dispositions.slice(0, 5),
      { ...familyDisposition('node-2', 'association', 'NO_RELATION'), scopeHash: 'e'.repeat(64) },
    ];
    const foreignReceipt = evaluateTeachingClosure(foreignScope);
    expect(foreignReceipt.status).toBe('INCOMPLETE');
  });

  it('rejects fabricated edges and unevidenced no-relation decisions', () => {
    const fabricated = completeTeachingInputs();
    fabricated.dispositions = [
      ...fabricated.dispositions,
      familyDisposition('node-1', 'association', 'PUBLISHED_EDGE', []),
    ];
    expect(() => evaluateTeachingClosure(fabricated)).toThrow(/carries no evidence/);
    const unevidenced = completeTeachingInputs();
    unevidenced.dispositions = [
      ...unevidenced.dispositions.filter(
        (disposition) => !(disposition.canonicalId === 'node-1' && disposition.family === 'prerequisite'),
      ),
      familyDisposition('node-1', 'prerequisite', 'NO_RELATION', []),
    ];
    expect(() => evaluateTeachingClosure(unevidenced)).toThrow(/NO_RELATION for node-1 carries no evidence/);
  });

  it('rejects PARTIAL and mismatched projections at the coordinated gate', () => {
    const expected = {
      scopeHash: SCOPE_HASH,
      authorityReleaseId: 'rel-1',
      authoritySnapshotHash: HASH_C,
      allocationHash: HASH_A,
      formalResourceEnvelopeHash: HASH_B,
    };
    const complete = {
      publicationState: 'COMPLETE',
      projectionHash: HASH_D,
      ...expected,
    };
    expect(() => assertProjectionEligibleForCoordinatedSelection(complete, expected)).not.toThrow();
    expect(() => assertProjectionEligibleForCoordinatedSelection(
      { ...complete, publicationState: 'PARTIAL' },
      expected,
    )).toThrow(/cannot satisfy the coordinated production gate/);
    expect(() => assertProjectionEligibleForCoordinatedSelection(
      { ...complete, scopeHash: 'e'.repeat(64) },
      expected,
    )).toThrow(/different scope/);
  });
});

describe('active logical inventory capture', () => {
  const release = {
    releaseId: 'runtime-bb309e6a',
    manifestSha256: HASH_A,
    treeSha256: HASH_B,
    activeReceiptHash: HASH_C,
    lifecycleGeneration: 34,
  };

  it('fails closed when a registry TeachingResource or manifest file is omitted', () => {
    expect(() => captureActiveLogicalInventory({
      activeRelease: release,
      manifestFiles: [{ path: 'lessons/card.json', sha256: HASH_D }],
      teachingResources: [
        { id: 'db-1', type: 'INTERACTIVE_COMP', registryId: 'reg-1' },
      ],
      lessonItemResourceIds: [],
      classified: [{
        entryId: 'res-card-1',
        resourceId: 'res-card-1',
        classification: 'resource',
        subtype: 'knowledge-card',
        runtimePath: 'lessons/card.json',
        sourceKind: 'runtime-manifest',
      }],
    })).toThrow(/TeachingResource db-1/);

    expect(() => captureActiveLogicalInventory({
      activeRelease: release,
      manifestFiles: [
        { path: 'lessons/card.json', sha256: HASH_D },
        { path: 'lessons/orphan.json', sha256: HASH_A },
      ],
      teachingResources: [],
      lessonItemResourceIds: [],
      classified: [{
        entryId: 'res-card-1',
        resourceId: 'res-card-1',
        classification: 'resource',
        subtype: 'knowledge-card',
        runtimePath: 'lessons/card.json',
        sourceKind: 'runtime-manifest',
      }],
    })).toThrow(/orphan.json/);
  });

  it('blocks in-course STATIC_MEDIA without an explicit in-course binding', () => {
    expect(() => captureActiveLogicalInventory({
      activeRelease: release,
      manifestFiles: [],
      teachingResources: [
        { id: 'media-1', type: 'STATIC_MEDIA', registryId: 'static-1' },
      ],
      lessonItemResourceIds: ['media-1'],
      classified: [{
        entryId: 'media-1',
        resourceId: 'res-media-1',
        classification: 'resource',
        subtype: 'STATIC_MEDIA',
        sourceKind: 'db-teaching-resource',
        dbResourceId: 'media-1',
        registryId: 'static-1',
        courseScope: 'out-of-course',
      }],
    })).toThrow(/must be classified in-course/);
  });

  it('accepts one Runtime file carrying two logical resources and a blobless launcher', () => {
    const baseline = captureActiveLogicalInventory({
      activeRelease: release,
      manifestFiles: [{ path: 'lessons/interactive.json', sha256: HASH_D }],
      teachingResources: [
        { id: 'db-launch', type: 'INTERACTIVE_COMP', registryId: 'launch-1' },
      ],
      lessonItemResourceIds: [],
      classified: [
        {
          entryId: 'exercise-1',
          resourceId: 'res-ex-1',
          classification: 'resource',
          subtype: 'handout-exercise',
          sourceKind: 'runtime-manifest',
          runtimePath: 'lessons/interactive.json',
          carrierEntryId: 'interactive-1',
        },
        {
          entryId: 'interactive-1',
          resourceId: 'res-int-1',
          classification: 'resource',
          subtype: 'interactive',
          sourceKind: 'runtime-manifest',
          runtimePath: 'lessons/interactive.json',
        },
        {
          entryId: 'launcher-1',
          resourceId: 'res-launch-1',
          classification: 'resource',
          subtype: 'INTERACTIVE_COMP',
          sourceKind: 'db-teaching-resource',
          dbResourceId: 'db-launch',
          registryId: 'launch-1',
          runtimePath: null,
        },
      ],
    });
    expect(baseline.logicalResourceCount).toBe(3);
  });
});

describe('latest-complete public-contract capture', () => {
  it('classifies public-bundle/3 as compatible only after the adapter surface includes it', () => {
    const captured = {
      schemaVersion: '0.3.0',
      schemaSha256: HASH_A,
      contractVersion: 'actkg-public-bundle/3',
      requiredMembers: ['release', 'ctkg_schema'],
      profiles: ['runtime'],
      representativeParse: 'COMPLETE' as const,
    };
    const v2Only = supportedContract();
    expect(validateCapturedPublicContract(captured, v2Only).classification).toBe('ADAPTATION_REQUIRED');
    const adapted = adapterSupportsPublicBundle3(v2Only, '0.3.0', HASH_A);
    expect(validateCapturedPublicContract(captured, adapted).classification).toBe('COMPATIBLE');
  });

  it('reads contract members from the bundle and maps projection kinds onto adapter profiles', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'actkg-capture-'));
    writeFileSync(path.join(dir, 'bundle-manifest.json'), `${JSON.stringify({
      bundle_contract_version: 'actkg-public-bundle/3',
      schema: { version: '0.3.0', sha256: HASH_A },
      artifacts: [
        { role: 'release', required: true },
        { role: 'ctkg_schema', required: true },
        { role: 'locale_manifest', required: true },
      ],
    })}\n`);
    writeFileSync(path.join(dir, 'projection-profiles.json'), `${JSON.stringify({
      profiles: [
        { projection_kind: 'act_runtime_graph' },
        { projection_kind: 'domain_graph' },
        { projection_kind: 'review_graph' },
      ],
    })}\n`);
    const captured = capturedPublicContractFromBundle(dir, 'COMPLETE');
    expect(captured.contractVersion).toBe('actkg-public-bundle/3');
    expect(captured.requiredMembers).toEqual(['release', 'ctkg_schema', 'locale_manifest']);
    expect([...captured.profiles].sort()).toEqual(['domain', 'review', 'runtime']);
    const adapted = adapterSupportsPublicBundle3({
      ...supportedContract(),
      profiles: ['runtime', 'domain', 'review'],
    }, '0.3.0', HASH_A);
    expect(validateCapturedPublicContract(captured, adapted).classification).toBe('COMPATIBLE');
  });
});

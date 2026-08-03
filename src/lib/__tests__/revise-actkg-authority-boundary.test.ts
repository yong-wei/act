import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ENGINEERING_AUTHORITY_STATES,
  TEACHING_PROJECTION_STATES,
  CONSUMER_READINESS_STATES,
  LEGACY_AUDIT_STATES,
  UnknownAuthorityBoundaryStateError,
  parseEngineeringAuthorityState,
  parseTeachingProjectionState,
  parseConsumerReadinessState,
  parseLegacyAuditState,
  evaluateEngineeringAuthorityActivation,
  evaluateIntegrityDrift,
  evaluateConsumerPackageGate,
  resolveActTeachingDenominator,
  evaluateHistoricalDeferImpact,
  buildDeclaredSnapshotAuthorityDiagnostics,
  selectActTeachingScopeMembership,
  buildActTeachingScopeWorklistItems,
  buildDownstreamReadinessDiagnostics,
  evaluateDeclaredSnapshotAuthorityActivation,
  validateDeclaredAuthoritativeSnapshotReceipt,
  LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH,
  LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
  LEGACY_AUDIT_EXPECTED_COUNTS,
  LegacyAuditTamperError,
  computeLegacyAuditManifestDigest,
  readLegacyCourseCoverageAudit,
  loadLegacyCourseCoverageAudit,
  legacyAuditWriteCapabilities,
  type CaptureIdentity,
} from '../aggregate-governance';
import {
  buildCourseCoverageAdmissionProjection,
  type CourseCoverageResult,
} from '../authoritative-knowledge';
import {
  buildResourceBindingInventory,
  evaluateCanonicalResourceCutoverReadiness,
  evaluateEngineeringOnlyResourceConsumer,
  sha256,
  type ResourceInventoryObservation,
} from '../canonical-resource-binding';
import { evaluateKaqConsumerBoundary } from '../canonical-kaq-binding';

const CAPTURE: CaptureIdentity = {
  captureRevision: 'a'.repeat(40),
  importCaptureRevision: 'a'.repeat(40),
  deltaCaptureRevision: 'a'.repeat(40),
  dbWatermark: '0/1',
  releaseSetId: 'actkg-release-set-test',
  releaseId: 'ctr:release:test',
  releaseHash: 'b'.repeat(64),
  sourceDatasetHash: 'c'.repeat(64),
  deltaReceiptId: 'delta-receipt:test',
  deltaOutputDigest: 'e'.repeat(64),
  deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
  runtimeProjectionId: null,
  runtimeProjectionDigest: null,
  inventoryRunId: null,
  structuralUnitIndexVersion: null,
  authoringRevision: 'a'.repeat(40),
  coverageSourceHash: 'd'.repeat(64),
};

function unresolvedObservation(id: string): ResourceInventoryObservation {
  return {
    sourceObservationId: `source:${id}`,
    sourceKind: 'TeachingResource',
    sourceAvailable: true,
    captureRevision: CAPTURE.captureRevision,
    capturedAt: '2026-08-03T00:00:00.000Z',
    dbWatermark: CAPTURE.dbWatermark,
    atomicResourceId: `TeachingResource:${id}`,
    resourceId: id,
    structuralUnitId: `resource:${id}`,
    segmentId: `resource:${id}:base`,
    resourceSegmentHash: sha256('segment'),
    positiveSignals: {},
    exclusionSignals: {},
    dispositionDeclared: false,
  };
}

describe('authority boundary states (#1265)', () => {
  it('parses stable identities and fails closed on unknown values', () => {
    expect(ENGINEERING_AUTHORITY_STATES).toEqual(['VALIDATED', 'ACTIVE', 'REJECTED_INTEGRITY']);
    expect(TEACHING_PROJECTION_STATES).toEqual(['PUBLISHED', 'REVIEW_REQUIRED', 'NOT_PROJECTED']);
    expect(CONSUMER_READINESS_STATES).toEqual([
      'READY',
      'PINNED_PREVIOUS',
      'BLOCKED_LOCAL_DEPENDENCY',
    ]);
    expect(LEGACY_AUDIT_STATES).toEqual(['IMMUTABLE_VALID', 'TAMPER_FAIL_CLOSED']);

    expect(parseEngineeringAuthorityState('ACTIVE')).toBe('ACTIVE');
    expect(parseTeachingProjectionState('NOT_PROJECTED')).toBe('NOT_PROJECTED');
    expect(parseConsumerReadinessState('PINNED_PREVIOUS')).toBe('PINNED_PREVIOUS');
    expect(parseLegacyAuditState('IMMUTABLE_VALID')).toBe('IMMUTABLE_VALID');

    expect(() => parseEngineeringAuthorityState('CANDIDATE_ONLY')).toThrow(
      UnknownAuthorityBoundaryStateError,
    );
    expect(() => parseTeachingProjectionState('MISSING')).toThrow(UnknownAuthorityBoundaryStateError);
    expect(() => parseConsumerReadinessState('GLOBAL_BLOCK')).toThrow(
      UnknownAuthorityBoundaryStateError,
    );
  });
});

describe('authority activation decision table (#1265)', () => {
  it('allows Authority ACTIVE with empty teaching projection after explicit activation', () => {
    const decision = evaluateEngineeringAuthorityActivation({
      bundleIntegrity: 'VALID',
      explicitActivationRequested: true,
      teachingScope: 'EMPTY',
      historicalDeferPresent: true,
    });
    expect(decision.authority).toBe('ACTIVE');
    expect(decision.authorityActiveEligible).toBe(true);
    expect(decision.teachingProjection).toBe('NOT_PROJECTED');
    expect(decision.historicalDeferEffect).toBe('NONE');
    expect(decision.selectorsChangedBySnapshotCreation).toBe(0);
    expect(decision.reasons).toContain('teaching-scope-empty-does-not-block-authority');
    expect(decision.reasons).toContain('historical-defer-audit-only');
  });

  it('keeps snapshot creation selector-neutral while Authority remains VALIDATED-eligible', () => {
    const decision = evaluateEngineeringAuthorityActivation({
      bundleIntegrity: 'VALID',
      explicitActivationRequested: false,
      teachingScope: 'EMPTY',
    });
    expect(decision.authority).toBe('VALIDATED');
    expect(decision.authorityActiveEligible).toBe(true);
    expect(decision.teachingProjection).toBe('NOT_PROJECTED');
    expect(decision.reasons).toContain('snapshot-selector-neutral');
  });

  it('rejects integrity failures and blocks dependent consumers', () => {
    const decision = evaluateEngineeringAuthorityActivation({
      bundleIntegrity: 'INVALID',
      explicitActivationRequested: true,
      teachingScope: 'PUBLISHED',
    });
    expect(decision.authority).toBe('REJECTED_INTEGRITY');
    expect(decision.authorityActiveEligible).toBe(false);

    const drift = evaluateIntegrityDrift({
      driftedFields: ['bundleDigest', 'captureRevision'],
    });
    expect(drift.authority).toBe('REJECTED_INTEGRITY');
    expect(drift.consumersBlocked).toBe(true);
    expect(drift.selectorsAdvanced).toBe(0);
  });

  it('treats historical DEFER as non-blocking audit only', () => {
    const impact = evaluateHistoricalDeferImpact({
      deferCount: 4880,
      includeCount: 11,
    });
    expect(impact).toEqual({
      authorityBlock: false,
      selectorBlock: false,
      worklistRowsCreated: 0,
      auditOnly: true,
      deferCount: 4880,
      includeCount: 11,
    });
  });

  it('blocks only the affected consumer package on unresolved local binding', () => {
    const blocked = evaluateConsumerPackageGate({
      packageId: 'teaching-resource-rag-package-a',
      authority: 'ACTIVE',
      teachingProjection: 'PUBLISHED',
      localDependencyResolved: false,
    });
    expect(blocked.consumer).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(blocked.blocksAuthority).toBe(false);
    expect(blocked.blocksUnrelatedConsumers).toBe(false);

    const other = evaluateConsumerPackageGate({
      packageId: 'engineering-rag',
      authority: 'ACTIVE',
      teachingProjection: 'NOT_PROJECTED',
      localDependencyResolved: true,
      engineeringOnly: true,
    });
    expect(other.consumer).toBe('READY');
    expect(other.blocksAuthority).toBe(false);
  });

  it('keeps unprojected upstream objects outside the ACT teaching denominator', () => {
    const resolved = resolveActTeachingDenominator({
      actBoundCanonicalIds: ['ctc:core-a'],
      upstreamCanonicalIds: ['ctc:core-a', 'ctc:upstream-only', 'ctc:profile-only'],
    });
    expect(resolved.denominator).toEqual(['ctc:core-a']);
    expect(resolved.unprojectedUpstream).toEqual(['ctc:profile-only', 'ctc:upstream-only']);
    expect(resolved.empty).toBe(false);

    const empty = resolveActTeachingDenominator({
      actBoundCanonicalIds: [],
      upstreamCanonicalIds: ['ctc:upstream-only'],
    });
    expect(empty.empty).toBe(true);
    expect(empty.denominator).toEqual([]);
    expect(empty.unprojectedUpstream).toEqual(['ctc:upstream-only']);

    const membership = selectActTeachingScopeMembership({
      actBoundCanonicalIds: [],
      upstreamCanonicalIds: ['ctc:upstream-only'],
    });
    expect(membership.empty).toBe(true);
    expect(membership.source).toBe('act-teaching-scope');

    const worklist = buildActTeachingScopeWorklistItems({
      actBoundCanonicalIds: [],
      upstreamCanonicalIds: ['ctc:upstream-only'],
    });
    expect(worklist.items).toEqual([]);
    expect(worklist.teachingProjection).toBe('NOT_PROJECTED');
    expect(worklist.blocksEngineeringAuthority).toBe(false);
  });
});

describe('declared snapshot Authority diagnostics (#1265)', () => {
  it('exposes independent Authority eligibility without CourseCoverage', () => {
    const diagnostics = evaluateDeclaredSnapshotAuthorityActivation({
      integrityValid: true,
      explicitActivationRequested: true,
      teachingProjection: 'EMPTY',
      historicalDeferPresent: true,
    });
    expect(diagnostics.candidateOnlyProdBlock).toBe(false);
    expect(diagnostics.courseCoverageRequiredForAuthority).toBe(false);
    expect(diagnostics.snapshotSelectorNeutral).toBe(true);
    expect(diagnostics.engineeringAuthority).toBe('ACTIVE');
    expect(diagnostics.teachingProjection).toBe('NOT_PROJECTED');
    expect(diagnostics.selectorsChanged).toBe(0);

    const built = buildDeclaredSnapshotAuthorityDiagnostics({
      bundleIntegrity: 'VALID',
      explicitActivationRequested: false,
      teachingScope: 'EMPTY',
    });
    expect(built.authority.authority).toBe('VALIDATED');
    expect(built.authority.authorityActiveEligible).toBe(true);

    // Frozen #1117 receipt validation remains available and selector-neutral.
    const receiptPath = path.join(
      process.cwd(),
      'course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json',
    );
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as unknown;
    expect(validateDeclaredAuthoritativeSnapshotReceipt(receipt).valid).toBe(true);
  });

  it('fails closed on integrity drift for Authority activation', () => {
    const diagnostics = evaluateDeclaredSnapshotAuthorityActivation({
      integrityValid: false,
      explicitActivationRequested: true,
      teachingProjection: 'PUBLISHED',
    });
    expect(diagnostics.engineeringAuthority).toBe('REJECTED_INTEGRITY');
    expect(diagnostics.authorityActiveEligible).toBe(false);
  });
});

describe('downstream readiness and consumer gates (#1265)', () => {
  it('reports independent Engineering Authority with empty teaching', () => {
    const readiness = buildDownstreamReadinessDiagnostics({
      capture: CAPTURE,
      coverageEntries: [],
      crosswalks: [],
      unresolvedUpstreamCount: 100,
      shadowPublishedBindingCount: 0,
      teachingScope: 'EMPTY',
      explicitAuthorityActivation: true,
    });
    expect(readiness.engineeringAuthority?.state).toBe('ACTIVE');
    expect(readiness.engineeringAuthority?.activeEligible).toBe(true);
    expect(readiness.engineeringAuthority?.independentOfCourseCoverage).toBe(true);
    expect(readiness.teachingProjection).toMatchObject({
      ready: false,
      blocked: true,
      reason: 'formal-teaching-projection-not-available',
    });
    expect(readiness.kaq.ready).toBe(false);
  });

  it('scopes resource binding blockers to the consumer package only', () => {
    const inventory = buildResourceBindingInventory([unresolvedObservation('res-a')]);
    const readiness = evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [],
      consumerPackageId: 'package-a',
      pinnedPrevious: true,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.scope).toEqual({
      packageId: 'package-a',
      blocksEngineeringAuthority: false,
      blocksUnrelatedConsumers: false,
      consumerState: 'PINNED_PREVIOUS',
    });
    expect(readiness.blockers.some((row) => row.code === 'inventory-unresolved')).toBe(true);

    const engineering = evaluateEngineeringOnlyResourceConsumer({
      engineeringAuthorityActive: true,
      packageId: 'engineering-rag',
    });
    expect(engineering.ready).toBe(true);
    expect(engineering.requiresCanonicalResourceBindings).toBe(false);
  });

  it('keeps KAQ on prior combination when Engineering Authority activates first', () => {
    const boundary = evaluateKaqConsumerBoundary({
      engineeringAuthority: 'ACTIVE',
      teachingProjection: { available: false },
      localBindingsReady: false,
      pinnedPrevious: true,
    });
    expect(boundary.engineeringAuthoritySwitchesKaq).toBe(false);
    expect(boundary.globalSelectorAdvanced).toBe(false);
    expect(boundary.authority).toBe('LEGACY');
    expect(boundary.consumerState).toBe('PINNED_PREVIOUS');
  });

  it('never lets CourseCoverage admission block Engineering Authority', () => {
    const unavailable: CourseCoverageResult = {
      status: 'unavailable',
      selector: null,
      reason: 'coverage-not-found',
      diagnostics: [],
      productionAuthoritative: false,
    };
    const projection = buildCourseCoverageAdmissionProjection(unavailable, 'kaq');
    expect(projection.productionAuthoritative).toBe(false);
    expect(projection.blocksEngineeringAuthority).toBe(false);
    expect(projection.historicalDeferBlocksAuthority).toBe(false);
  });
});

describe('legacy CourseCoverage audit manifest (#1265)', () => {
  it('loads the frozen 34-batch / 4891-member manifest with exact counts and digest', () => {
    const audit = loadLegacyCourseCoverageAudit();
    expect(audit.counts).toEqual(LEGACY_AUDIT_EXPECTED_COUNTS);
    expect(audit.batches).toHaveLength(34);
    expect(audit.manifestDigest).toBe(LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST);
    expect(audit.state).toBe('IMMUTABLE_VALID');
    expect(audit.selectorAuthority).toBe(false);
    expect(audit.writesAuthorityState).toBe(false);
    expect(audit.writesRepositoryState).toBe(false);
    expect(audit.writesCourseCoverageState).toBe(false);
    expect(audit.writesConsumerSelectorState).toBe(false);
    expect(audit.historicalDeferImpact.authorityBlock).toBe(false);
    expect(audit.historicalDeferImpact.selectorBlock).toBe(false);
    expect(audit.historicalDeferImpact.deferCount).toBe(4880);
    expect(audit.historicalDeferImpact.includeCount).toBe(11);
    expect(audit.sourceIssueRange.firstIssue).toBe(1190);
    expect(audit.sourceIssueRange.lastIssue).toBe(1223);

    const onDisk = JSON.parse(
      readFileSync(path.join(process.cwd(), LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH), 'utf8'),
    ) as Record<string, unknown>;
    expect(computeLegacyAuditManifestDigest(onDisk)).toBe(LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST);
  });

  it('fails closed when manifest bytes are tampered', () => {
    const onDisk = JSON.parse(
      readFileSync(path.join(process.cwd(), LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH), 'utf8'),
    ) as Record<string, unknown>;
    const tampered = structuredClone(onDisk);
    (tampered.counts as Record<string, number>).deferred = 4879;
    expect(() => readLegacyCourseCoverageAudit(tampered)).toThrow(LegacyAuditTamperError);

    const digestTampered = structuredClone(onDisk);
    digestTampered.manifestDigest = '0'.repeat(64);
    expect(() => readLegacyCourseCoverageAudit(digestTampered)).toThrow(/manifestDigest mismatch/u);
  });

  it('exposes a non-writer API that cannot mutate selector state', () => {
    const capabilities = legacyAuditWriteCapabilities();
    expect(capabilities).toEqual({
      writesAuthorityState: false,
      writesRepositoryState: false,
      writesCourseCoverageState: false,
      writesConsumerSelectorState: false,
    });
    // Reader return type is frozen write-capability false; no mutator is exported.
    const audit = loadLegacyCourseCoverageAudit();
    expect(Object.isFrozen(capabilities)).toBe(false);
    expect(audit.writesConsumerSelectorState).toBe(false);
    expect(audit.authority).toBe('AUDIT_ONLY');
  });
});

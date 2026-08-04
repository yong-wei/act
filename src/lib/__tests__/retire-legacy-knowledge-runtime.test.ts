/**
 * Legacy knowledge runtime retirement (#1277).
 *
 * Preflight evidence, retirement manifest gate, narrow removal, historical
 * retention, and no dual authority after retire.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
  LEGACY_AUDIT_EXPECTED_COUNTS,
} from '@/lib/aggregate-governance/legacy-course-coverage-audit';
import { CONSUMER_ACTIVATION_IDS } from '@/lib/versioned-knowledge-activation/contracts';
import { resolveCardForStep } from '@/lib/teaching-projection/cards/resolve';
import type { CanonicalCardActiveIndex } from '@/lib/teaching-projection/cards/contracts';

import {
  RETAINED_HISTORICAL_ARTIFACTS,
  RETIREABLE_RUNTIME_DEPENDENCIES,
  LegacyRetirementGateError,
  applyRetirementGate,
  assertHistoricalArtifactRetained,
  assertInventoryCoversRetireableDependencies,
  assertLegacyRuntimeAccess,
  assertNoActivationCoupling,
  assertNoProductionDualAuthority,
  assertZeroFallbackHits,
  assertZeroOldIdViolations,
  buildActivationIdentityEvidence,
  buildIncrementalUpgradeReceipt,
  buildRetirementArchive,
  buildRetirementConsumerInventory,
  buildRetirementManifest,
  cardHitsToFallbackInputs,
  clearRetirementGate,
  deriveRetirementGateState,
  ensureRetirementGateLoaded,
  exportFallbackTelemetry,
  extractLegacyIdCandidates,
  getRetirementGateState,
  historicalAuditSelectorAuthority,
  isGlobalCourseCoverageRuntimeSelectorPermitted,
  isLegacyCardDirectReaderPermitted,
  isLegacyGraphOverlayReaderPermitted,
  isProductionLegacyFallbackPermitted,
  isRuntimeDependencyRetired,
  issueRemovalReceipt,
  listRetainedHistoricalArtifacts,
  readHistoricalLearningFactContext,
  resolveRetirementStorePaths,
  runOldIdScan,
  verifyActivationIdentities,
  verifyIncrementalUpgradeReceipt,
  writeRetirementStore,
  type ActivationIdentityEvidence,
  type ArchiveArtifactInput,
  type RetirementChangeSurface,
} from '../legacy-knowledge-runtime-retirement';

const fixedHash = 'a'.repeat(64);
const fixedHashB = 'b'.repeat(64);

afterEach(() => {
  clearRetirementGate();
});

function readyIdentities(): ActivationIdentityEvidence[] {
  return CONSUMER_ACTIVATION_IDS.map((consumerId) =>
    buildActivationIdentityEvidence({
      consumerId,
      status: 'READY',
      authorityReleaseId: 'ctr:release:eng-v1',
      authoritySnapshotId: 'snap-1',
      projectionId:
        consumerId === 'engineering-graph' || consumerId === 'engineering-rag'
          ? null
          : 'proj-1',
      projectionHash:
        consumerId === 'engineering-graph' || consumerId === 'engineering-rag'
          ? null
          : fixedHash,
    }),
  );
}

function completeUpgradeReceipt() {
  return buildIncrementalUpgradeReceipt({
    receiptId: 'upgrade-1',
    deltaIdentity: 'delta:actkg-v0.12->v0.13',
    deltaOutputDigest: fixedHash,
    impactCompleted: true,
    projectionRebuildCompleted: true,
    consumerActivationCompleted: true,
    rollbackEvidenceCompleted: true,
    rollbackArchiveDigest: fixedHashB,
    completedAt: '2026-08-04T00:00:00.000Z',
  });
}

function completeArchiveArtifacts(): ArchiveArtifactInput[] {
  return RETAINED_HISTORICAL_ARTIFACTS.map((artifactId) => ({
    artifactId,
    path: `archive/${artifactId}.json`,
    content: JSON.stringify({ artifactId, retained: true }),
  }));
}

function completeArchive() {
  return buildRetirementArchive({
    captureRevision: 'c'.repeat(40),
    legacyAuditManifestDigest: LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
    artifacts: completeArchiveArtifacts(),
  });
}

function cleanScan() {
  return runOldIdScan({
    files: [
      {
        path: 'course-content/authoring/lessons/1-1/interactive-contract.yaml',
        content: 'knowledgeRefs:\n  - ctr:object:transfer-function\n',
      },
      {
        path: 'course-content/runtime/knowledge/teaching-projection/resources.jsonl',
        content: '{"resourceId":"r1","canonicalId":"ctr:object:feedback"}\n',
      },
    ],
    scannedRoots: [
      'course-content/authoring',
      'course-content/runtime',
    ],
    captureRevision: 'c'.repeat(40),
  });
}

function zeroFallback() {
  return exportFallbackTelemetry({
    hits: [],
    evidenceWindow: {
      startAt: '2026-08-01T00:00:00.000Z',
      endAt: '2026-08-04T00:00:00.000Z',
    },
  });
}

function readyManifest(markRemoved = false) {
  const rev = 'c'.repeat(40);
  const inventory = buildRetirementConsumerInventory({
    captureRevision: rev,
  });
  const artifacts = completeArchiveArtifacts();
  return buildRetirementManifest({
    retirementId: 'retire-1',
    captureRevision: rev,
    headRevision: rev,
    reviewedAt: '2026-08-04T12:00:00.000Z',
    inventory,
    oldIdScan: cleanScan(),
    fallbackExport: zeroFallback(),
    archive: completeArchive(),
    archiveArtifacts: artifacts,
    upgradeReceipt: completeUpgradeReceipt(),
    activationIdentities: readyIdentities(),
    markRemoved,
    changeSurface: {
      modifiesActivationPointers: false,
      removesLegacyReaders: true,
      touchesRemoteDeployment: false,
      includesPrismaMigration: false,
      includesUpstreamSemanticReview: false,
      paths: ['src/lib/legacy-knowledge-runtime-retirement'],
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Preflight evidence
// ---------------------------------------------------------------------------

describe('Retirement inventory and old-ID scan (#1277)', () => {
  it('inventories active consumers, readers, selectors, adapters, rollback', () => {
    const inventory = buildRetirementConsumerInventory({
      captureRevision: '1'.repeat(40),
    });
    expect(inventory.contract).toContain('inventory');
    expect(inventory.inventoryDigest).toMatch(/^[a-f0-9]{64}$/);
    assertInventoryCoversRetireableDependencies(inventory);

    const kinds = new Set(inventory.entries.map((e) => e.kind));
    expect(kinds.has('active-consumer')).toBe(true);
    expect(kinds.has('legacy-reader')).toBe(true);
    expect(kinds.has('selector')).toBe(true);
    expect(kinds.has('fallback-counter')).toBe(true);
    expect(kinds.has('historical-adapter')).toBe(true);
    expect(kinds.has('rollback-artifact')).toBe(true);
    expect(kinds.has('authoring-path')).toBe(true);
    expect(kinds.has('runtime-path')).toBe(true);

    for (const consumerId of CONSUMER_ACTIVATION_IDS) {
      expect(
        inventory.entries.some((e) => e.consumerId === consumerId),
      ).toBe(true);
    }
  });

  it('extracts legacy local graph IDs and fails closed on new-content hits', () => {
    expect(extractLegacyIdCandidates('id: "反馈_1_1"')).toEqual(['反馈_1_1']);
    expect(
      extractLegacyIdCandidates('canonicalId: "ctr:object:feedback"'),
    ).toEqual([]);

    const dirty = runOldIdScan({
      files: [
        {
          path: 'course-content/authoring/lessons/1-1/notes/new.md',
          content: 'legacy ref 反馈_1_1 must not appear in new content\n',
        },
      ],
    });
    expect(dirty.zeroViolations).toBe(false);
    expect(dirty.hitCount).toBeGreaterThan(0);
    expect(dirty.hits[0]?.path).toContain('new.md');
    expect(dirty.hits[0]?.match).toBe('反馈_1_1');
    expect(dirty.scanDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertZeroOldIdViolations(dirty)).toThrow(/old-ID scan/);

    // Historical / crosswalk paths are excluded from new-content violations.
    const historical = runOldIdScan({
      files: [
        {
          path: 'course-content/authoring/knowledge/teaching-projection/legacy-crosswalk.json',
          content: '{"legacyId":"反馈_1_1","canonicalId":"ctr:object:feedback"}',
        },
        {
          path: 'course-content/runtime/lessons/legacy/1-1/graph-overlay.json',
          content: '{"nodes":[{"id":"反馈_1_1"}]}',
        },
      ],
    });
    expect(historical.zeroViolations).toBe(true);
    assertZeroOldIdViolations(historical);

    const clean = cleanScan();
    expect(clean.zeroViolations).toBe(true);
    assertZeroOldIdViolations(clean);
  });

  it('exports fallback telemetry and blocks nonzero hits', () => {
    const zero = zeroFallback();
    expect(zero.zeroHits).toBe(true);
    expect(zero.totalHits).toBe(0);
    expect(zero.consumers).toHaveLength(CONSUMER_ACTIVATION_IDS.length);
    assertZeroFallbackHits(zero);

    const nonzero = exportFallbackTelemetry({
      hits: [
        {
          consumerId: 'course-runtime',
          hitId: 'hit-1',
          legacyId: '反馈_1_1',
          recordedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      evidenceWindow: {
        startAt: '2026-08-01T00:00:00.000Z',
        endAt: '2026-08-04T00:00:00.000Z',
      },
    });
    expect(nonzero.zeroHits).toBe(false);
    expect(nonzero.totalHits).toBe(1);
    expect(() => assertZeroFallbackHits(nonzero)).toThrow(LegacyRetirementGateError);

    // Outside window ignored.
    const outside = exportFallbackTelemetry({
      hits: [
        {
          consumerId: 'course-runtime',
          hitId: 'hit-old',
          recordedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      evidenceWindow: {
        startAt: '2026-08-01T00:00:00.000Z',
        endAt: '2026-08-04T00:00:00.000Z',
      },
    });
    expect(outside.zeroHits).toBe(true);

    // cardHitsToFallbackInputs preserves consumer identity.
    const mapped = cardHitsToFallbackInputs([
      {
        contract: 'act-knowledge-card-fallback-telemetry/v1',
        hitId: 'card-fallback:abc',
        cardId: 'card-1',
        legacyId: '反馈_1_1',
        canonicalId: 'ctr:object:feedback',
        crosswalkOutcome: 'mapped',
        consumer: 'konling',
        projectionId: 'proj-1',
        projectionHash: fixedHash,
        scopeId: 'course-package:1-1',
        recordedAt: '2026-08-02T00:00:00.000Z',
      },
    ]);
    expect(mapped[0]?.consumerId).toBe('konling');
  });

  it('verifies activation identities and complete incremental upgrade', () => {
    const identities = readyIdentities();
    expect(verifyActivationIdentities(identities).ok).toBe(true);
    expect(
      identities.every((row) => row.readyUnderVersionedCombination),
    ).toBe(true);

    const incomplete = verifyActivationIdentities([
      buildActivationIdentityEvidence({
        consumerId: 'konling',
        status: 'PINNED_PREVIOUS',
        authorityReleaseId: 'ctr:release:eng-v1',
        projectionId: 'proj-old',
        projectionHash: fixedHash,
      }),
    ]);
    expect(incomplete.ok).toBe(false);
    expect(incomplete.reasons.some((r) => r.includes('konling'))).toBe(true);

    const complete = completeUpgradeReceipt();
    expect(verifyIncrementalUpgradeReceipt(complete).ok).toBe(true);

    const incompleteUpgrade = buildIncrementalUpgradeReceipt({
      receiptId: 'upgrade-partial',
      deltaIdentity: 'delta:partial',
      deltaOutputDigest: fixedHash,
      impactCompleted: true,
      projectionRebuildCompleted: true,
      consumerActivationCompleted: false,
      rollbackEvidenceCompleted: false,
      completedAt: '2026-08-04T00:00:00.000Z',
    });
    const partial = verifyIncrementalUpgradeReceipt(incompleteUpgrade);
    expect(partial.ok).toBe(false);
    expect(partial.reasons).toEqual(
      expect.arrayContaining([
        'upgrade-consumer-activation-incomplete',
        'upgrade-rollback-evidence-incomplete',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Retirement manifest and review gate
// ---------------------------------------------------------------------------

describe('Retirement archive and manifest gate (#1277)', () => {
  it('archives retained historical artifacts with digests', () => {
    expect(LEGACY_AUDIT_EXPECTED_COUNTS.batches).toBe(34);
    expect(LEGACY_AUDIT_EXPECTED_COUNTS.members).toBe(4891);
    expect(LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST).toMatch(
      /^[a-f0-9]{64}$/,
    );

    const archive = completeArchive();
    expect(archive.archiveDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(archive.entries).toHaveLength(RETAINED_HISTORICAL_ARTIFACTS.length);
    expect(archive.legacyAuditManifestDigest).toBe(
      LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
    );

    expect(() =>
      buildRetirementArchive({
        legacyAuditManifestDigest: fixedHash,
        artifacts: completeArchiveArtifacts(),
      }),
    ).toThrow(/frozen published digest/);

    expect(() =>
      buildRetirementArchive({
        legacyAuditManifestDigest: LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
        artifacts: completeArchiveArtifacts().slice(0, 2),
      }),
    ).toThrow(/missing retained artifacts/);
  });

  it('blocks retirement when preconditions are missing', () => {
    const rev = 'c'.repeat(40);
    const inventory = buildRetirementConsumerInventory({ captureRevision: rev });
    const blocked = buildRetirementManifest({
      retirementId: 'retire-blocked',
      captureRevision: rev,
      headRevision: rev,
      inventory,
      oldIdScan: runOldIdScan({
        files: [
          {
            path: 'course-content/authoring/lessons/1-1/notes/bad.md',
            content: 'uses 反馈_1_1\n',
          },
        ],
        captureRevision: rev,
      }),
      fallbackExport: exportFallbackTelemetry({
        hits: [
          {
            consumerId: 'course-runtime',
            hitId: 'h1',
            recordedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
        evidenceWindow: {
          startAt: '2026-08-01T00:00:00.000Z',
          endAt: '2026-08-04T00:00:00.000Z',
        },
      }),
      archive: completeArchive(),
      archiveArtifacts: completeArchiveArtifacts(),
      upgradeReceipt: buildIncrementalUpgradeReceipt({
        receiptId: 'upgrade-partial',
        deltaIdentity: 'delta:x',
        deltaOutputDigest: fixedHash,
        impactCompleted: false,
        projectionRebuildCompleted: false,
        consumerActivationCompleted: false,
        rollbackEvidenceCompleted: false,
        completedAt: '2026-08-04T00:00:00.000Z',
      }),
      activationIdentities: [],
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.reasons.length).toBeGreaterThan(0);
    expect(blocked.invariants.doesNotModifyActivationPointers).toBe(true);

    const receipt = issueRemovalReceipt({
      receiptId: 'removal-blocked',
      manifest: blocked,
      removedAt: '2026-08-04T13:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.removedDependencies).toEqual([]);
  });

  it('rejects activation and retirement coupling', () => {
    const surface: RetirementChangeSurface = {
      modifiesActivationPointers: true,
      removesLegacyReaders: true,
      touchesRemoteDeployment: false,
      includesPrismaMigration: false,
      includesUpstreamSemanticReview: false,
      paths: ['src/lib/versioned-knowledge-activation', 'src/lib/layered-graph'],
    };
    expect(() => assertNoActivationCoupling(surface)).toThrow(
      /out of contract/,
    );

    expect(() =>
      assertNoActivationCoupling({
        modifiesActivationPointers: false,
        removesLegacyReaders: true,
        touchesRemoteDeployment: true,
        includesPrismaMigration: false,
        includesUpstreamSemanticReview: false,
        paths: [],
      }),
    ).toThrow(/remote-deployment/);
  });

  it('builds ready-for-removal manifest when all preconditions pass', () => {
    const manifest = readyManifest(false);
    expect(manifest.status).toBe('ready-for-removal');
    expect(manifest.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.removedDependencies.every((d) => !d.removed)).toBe(true);
    expect(manifest.invariants.failClosedOnMissingEvidence).toBe(true);

    const removed = readyManifest(true);
    expect(removed.status).toBe('removed');
    expect(removed.removedDependencies.every((d) => d.removed)).toBe(true);

    const receipt = issueRemovalReceipt({
      receiptId: 'removal-ok',
      manifest: removed,
      removedAt: '2026-08-04T14:00:00.000Z',
    });
    expect(receipt.status).toBe('removed');
    expect(receipt.removedDependencies).toEqual(
      [...RETIREABLE_RUNTIME_DEPENDENCIES].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Narrow removal + historical retention
// ---------------------------------------------------------------------------

describe('Narrow removal and historical retention (#1277)', () => {
  it('disables production dual authority after retirement gate', () => {
    expect(isProductionLegacyFallbackPermitted()).toBe(true);
    expect(isLegacyGraphOverlayReaderPermitted()).toBe(true);
    expect(isLegacyCardDirectReaderPermitted()).toBe(true);
    expect(isGlobalCourseCoverageRuntimeSelectorPermitted()).toBe(true);

    const manifest = readyManifest(true);
    const state = deriveRetirementGateState({
      manifest,
      removalReceipt: issueRemovalReceipt({
        receiptId: 'removal-ok',
        manifest,
        removedAt: '2026-08-04T14:00:00.000Z',
      }),
    });
    expect(state.retired).toBe(true);
    applyRetirementGate(state);

    expect(isProductionLegacyFallbackPermitted()).toBe(false);
    expect(isLegacyGraphOverlayReaderPermitted()).toBe(false);
    expect(isLegacyCardDirectReaderPermitted()).toBe(false);
    expect(isGlobalCourseCoverageRuntimeSelectorPermitted()).toBe(false);
    expect(
      isRuntimeDependencyRetired('production-legacy-fallback-path'),
    ).toBe(true);

    expect(() =>
      assertLegacyRuntimeAccess({
        dependencyId: 'legacy-runtime-graph-overlay-reader',
        mode: 'production',
      }),
    ).toThrow(LegacyRetirementGateError);

    // Historical / audit modes remain allowed.
    expect(() =>
      assertLegacyRuntimeAccess({
        dependencyId: 'legacy-card-direct-reader',
        mode: 'historical',
      }),
    ).not.toThrow();
    expect(() =>
      assertLegacyRuntimeAccess({
        dependencyId: 'global-course-coverage-runtime-selector',
        mode: 'audit',
      }),
    ).not.toThrow();

    expect(() =>
      assertNoProductionDualAuthority({
        usingLegacyFallback: true,
        usingGlobalCourseCoverageSelector: false,
        usingLegacyGraphReader: false,
        usingLegacyCardReader: false,
      }),
    ).toThrow(/dual authority/);

    expect(() =>
      assertNoProductionDualAuthority({
        usingLegacyFallback: false,
        usingGlobalCourseCoverageSelector: false,
        usingLegacyGraphReader: false,
        usingLegacyCardReader: false,
      }),
    ).not.toThrow();

    clearRetirementGate();
    expect(getRetirementGateState().retired).toBe(false);
    expect(isProductionLegacyFallbackPermitted()).toBe(true);
  });

  it('retains historical adapters and LearningFact crosswalk reads', () => {
    const retained = listRetainedHistoricalArtifacts();
    expect(retained).toEqual(
      expect.arrayContaining([
        'legacy-course-coverage-audit-manifest',
        'old-to-canonical-crosswalk',
        'historical-learning-fact-crosswalk-adapter',
      ]),
    );
    for (const id of retained) {
      assertHistoricalArtifactRetained(id);
    }

    const audit = historicalAuditSelectorAuthority();
    expect(audit.authority).toBe('AUDIT_ONLY');
    expect(audit.selectorAuthority).toBe(false);
    expect(audit.productionSelector).toBe(false);

    // Apply retirement then still read historical facts.
    const manifest = readyManifest(true);
    applyRetirementGate(deriveRetirementGateState({ manifest }));

    const result = readHistoricalLearningFactContext({
      fact: {
        id: 'fact-legacy-1',
        knowledgeIdentityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'legacy-rev-1',
        contextJson: {
          knowledgeNodeIds: ['反馈_1_1'],
        },
      },
      crosswalk: [
        {
          legacyId: '反馈_1_1',
          canonicalId: 'ctr:object:feedback',
          role: 'EXPLAINS',
          sourceEvidence: 'audit',
          stale: false,
        },
      ],
    });

    expect(result.readable).toBe(true);
    expect(result.createdActiveSelector).toBe(false);
    expect(result.mutatedFact).toBe(false);
    expect(result.detail.displayCanonicalIds).toEqual([
      'ctr:object:feedback',
    ]);
    expect(result.detail.originalFactUnchanged).toBe(true);
  });

  it('ready-for-removal (pre-delete) already blocks production dual authority', () => {
    const manifest = readyManifest(false);
    expect(manifest.status).toBe('ready-for-removal');
    const state = deriveRetirementGateState({ manifest });
    expect(state.retired).toBe(true);
    applyRetirementGate(state);
    expect(isProductionLegacyFallbackPermitted()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Change surface / non-goals
// ---------------------------------------------------------------------------

describe('Retirement non-goals (#1277)', () => {
  it('encodes no activation switch, deployment, migration, or semantic review', () => {
    const manifest = readyManifest(true);
    expect(manifest.invariants).toEqual({
      doesNotModifyActivationPointers: true,
      doesNotDeleteHistoricalEvidence: true,
      doesNotDeployRemotely: true,
      doesNotIncludePrismaMigration: true,
      doesNotIncludeUpstreamSemanticReview: true,
      failClosedOnMissingEvidence: true,
    });

    // Removal receipt does not claim activation pointer changes.
    const receipt = issueRemovalReceipt({
      receiptId: 'removal-nongoals',
      manifest,
      removedAt: '2026-08-04T15:00:00.000Z',
    });
    expect(receipt.status).toBe('removed');
    expect(JSON.stringify(receipt)).not.toContain('activationPointer');
  });
});

// ---------------------------------------------------------------------------
// P1 remediations: store load, digest re-verify, canonical legacy card
// ---------------------------------------------------------------------------

describe('Production store load and evidence integrity (#1277 P1)', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) rmSync(root, { recursive: true, force: true });
    }
    clearRetirementGate();
  });

  it('loads reviewed retirement store on production permission check', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-retirement-store-'));
    tempRoots.push(root);
    const paths = resolveRetirementStorePaths(root);
    const manifest = readyManifest(true);
    const receipt = issueRemovalReceipt({
      receiptId: 'removal-store',
      manifest,
      removedAt: '2026-08-04T16:00:00.000Z',
    });
    writeRetirementStore({ paths, manifest, removalReceipt: receipt });

    clearRetirementGate();
    // Lazy production load via permission API.
    const loaded = ensureRetirementGateLoaded({ paths, forceReload: true });
    expect(loaded.retired).toBe(true);
    expect(isProductionLegacyFallbackPermitted()).toBe(false);
    expect(isLegacyCardDirectReaderPermitted()).toBe(false);
    expect(isGlobalCourseCoverageRuntimeSelectorPermitted()).toBe(false);
  });

  it('absent store keeps legacy available; invalid store fails closed', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-retirement-absent-'));
    tempRoots.push(root);
    const paths = resolveRetirementStorePaths(root);

    clearRetirementGate();
    const absent = ensureRetirementGateLoaded({ paths, forceReload: true });
    expect(absent.retired).toBe(false);
    expect(isProductionLegacyFallbackPermitted()).toBe(true);

    // Write a pointer without a manifest file → invalid → fail closed.
    const { writeFileSync, mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(paths.root, { recursive: true });
    writeFileSync(
      paths.currentPointer,
      JSON.stringify({
        contract: 'act-legacy-knowledge-runtime-retirement-current/v1',
        retirementId: 'missing-release',
        manifestDigest: fixedHash,
        removalReceiptId: null,
        appliedAt: '2026-08-04T00:00:00.000Z',
      }),
      'utf8',
    );
    clearRetirementGate();
    const invalid = ensureRetirementGateLoaded({ paths, forceReload: true });
    expect(invalid.retired).toBe(true);
    expect(isProductionLegacyFallbackPermitted()).toBe(false);
  });

  it('blocks ready-for-removal when evidence digests are tampered', () => {
    const rev = 'c'.repeat(40);
    const inventory = buildRetirementConsumerInventory({
      captureRevision: rev,
    });
    // Start from a scan that actually has hits so clearing them changes the body.
    const dirty = runOldIdScan({
      files: [
        {
          path: 'course-content/authoring/lessons/1-1/notes/bad.md',
          content: 'legacy 反馈_1_1\n',
        },
      ],
      scannedRoots: ['course-content/authoring'],
      captureRevision: rev,
    });
    expect(dirty.hitCount).toBeGreaterThan(0);

    // Tamper: clear hits / claim zero violations but keep original digest.
    const forged = {
      ...dirty,
      zeroViolations: true,
      hits: [],
      hitCount: 0,
      scanDigest: dirty.scanDigest,
    };

    const blocked = buildRetirementManifest({
      retirementId: 'retire-tamper',
      captureRevision: rev,
      headRevision: rev,
      inventory,
      oldIdScan: forged,
      fallbackExport: zeroFallback(),
      archive: completeArchive(),
      archiveArtifacts: completeArchiveArtifacts(),
      upgradeReceipt: completeUpgradeReceipt(),
      activationIdentities: readyIdentities(),
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.reasons).toEqual(
      expect.arrayContaining(['old-id-scan-digest-tamper']),
    );

    // Forged readyUnderVersionedCombination must not pass.
    const forgedIdentity = readyIdentities().map((row) =>
      row.consumerId === 'konling'
        ? {
            ...row,
            status: 'PINNED_PREVIOUS',
            readyUnderVersionedCombination: true,
          }
        : row,
    );
    const blockedIdentity = buildRetirementManifest({
      retirementId: 'retire-forged-ready',
      captureRevision: rev,
      headRevision: rev,
      inventory,
      oldIdScan: cleanScan(),
      fallbackExport: zeroFallback(),
      archive: completeArchive(),
      archiveArtifacts: completeArchiveArtifacts(),
      upgradeReceipt: completeUpgradeReceipt(),
      activationIdentities: forgedIdentity,
    });
    expect(blockedIdentity.status).toBe('blocked');
    expect(
      blockedIdentity.reasons.some((r) => r.includes('konling')),
    ).toBe(true);
  });

  it('requires captureRevision === headRevision and archive byte verification', () => {
    const rev = 'c'.repeat(40);
    const inventory = buildRetirementConsumerInventory({ captureRevision: rev });
    const artifacts = completeArchiveArtifacts();

    // Stale evidence revision vs current head.
    const stale = buildRetirementManifest({
      retirementId: 'retire-stale',
      captureRevision: rev,
      headRevision: 'd'.repeat(40),
      inventory,
      oldIdScan: cleanScan(),
      fallbackExport: zeroFallback(),
      archive: completeArchive(),
      archiveArtifacts: artifacts,
      upgradeReceipt: completeUpgradeReceipt(),
      activationIdentities: readyIdentities(),
    });
    expect(stale.status).toBe('blocked');
    expect(stale.reasons).toEqual(
      expect.arrayContaining(['capture-head-revision-mismatch']),
    );

    // Missing archive bytes.
    const noBytes = buildRetirementManifest({
      retirementId: 'retire-no-bytes',
      captureRevision: rev,
      headRevision: rev,
      inventory,
      oldIdScan: cleanScan(),
      fallbackExport: zeroFallback(),
      archive: completeArchive(),
      upgradeReceipt: completeUpgradeReceipt(),
      activationIdentities: readyIdentities(),
    });
    expect(noBytes.status).toBe('blocked');
    expect(noBytes.reasons).toEqual(
      expect.arrayContaining(['archive-artifacts-required']),
    );

    // Tampered archive bytes.
    const tamperedBytes = artifacts.map((a, i) =>
      i === 0 ? { ...a, content: 'tampered-bytes' } : a,
    );
    const badBytes = buildRetirementManifest({
      retirementId: 'retire-bad-bytes',
      captureRevision: rev,
      headRevision: rev,
      inventory,
      oldIdScan: cleanScan(),
      fallbackExport: zeroFallback(),
      archive: completeArchive(),
      archiveArtifacts: tamperedBytes,
      upgradeReceipt: completeUpgradeReceipt(),
      activationIdentities: readyIdentities(),
    });
    expect(badBytes.status).toBe('blocked');
    expect(
      badBytes.reasons.some((r) => r.startsWith('archive-bytes:')),
    ).toBe(true);
  });

  it('blocks production Canonical-path legacyFallback cards after retirement', () => {
    const index: CanonicalCardActiveIndex = {
      contract: 'act-knowledge-card-active-index/v1',
      builderVersion: 'act-knowledge-card-migration-builder/v1',
      projectionScope: null,
      entries: [
        {
          cardId: 'card-legacy-only',
          resourceId: 'res-1',
          canonicalId: 'ctr:object:feedback',
          status: 'ACTIVE',
          active: false,
          required: false,
          sourceHash: fixedHash,
          sourcePath: null,
          title: 'legacy only',
          cardVersion: 1,
          projectionScope: null,
          legacyAliases: ['反馈_1_1'],
          legacyFallback: true,
        },
      ],
      activeByCanonical: [],
      indexDigest: fixedHash,
    };

    // Before retirement: legacy-fallback path is usable.
    clearRetirementGate();
    const before = resolveCardForStep({
      canonicalIds: ['ctr:object:feedback'],
      index,
      consumer: 'course-runtime',
    });
    expect(before?.outcome).toBe('legacy-fallback');
    expect(before?.legacyFallback).toBe(true);

    // After retirement: Canonical path must not return legacy dual authority.
    const manifest = readyManifest(true);
    applyRetirementGate(deriveRetirementGateState({ manifest }));
    const after = resolveCardForStep({
      canonicalIds: ['ctr:object:feedback'],
      index,
      consumer: 'course-runtime',
    });
    expect(after?.outcome).not.toBe('legacy-fallback');
    expect(after?.legacyFallback).toBe(false);
    expect(after?.card).toBeNull();
  });
});

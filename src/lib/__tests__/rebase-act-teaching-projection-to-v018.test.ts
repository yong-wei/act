import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertV018AdmittedAuthorityCandidate,
} from '../../../scripts/knowledge-cutover/prepare-actkg-v018-teaching-projection';
import { buildTeachingProjection } from '../teaching-projection/builder';
import type { TeachingProjectionAuthoringInput } from '../teaching-projection/contracts';
import { projectionDigest } from '../teaching-projection/hash';
import { createPrerequisiteAuthorDecision } from '../teaching-projection/prerequisites/publication';
import {
  assertV018CaptureBound,
  assertV018DisposableDatabaseUrl,
  buildV018DatabaseObservation,
  buildV018CaptureManifest,
  buildV018ReferenceDenominator,
  collectOverlayInfographReferences,
  environmentIdentityFromObservationParameters,
  expectedV018AdmissionSchemaIdentity,
  validateV018DatabaseObservation,
  V018_DATABASE_QUERY_CONTRACT_HASH,
} from '../../../tools/teaching-projection-publishing/rebase/v018-capture';
import {
  assertV018IdentityOnlyEvidence,
  buildV018ImpactEvidence,
  classifyV018IdentityMappings,
  resolveV018CanonicalId,
} from '../../../tools/teaching-projection-publishing/rebase/v018-mapping';
import {
  buildV018IdentityRebase,
} from '../../../tools/teaching-projection-publishing/rebase/v018-rebuild';
import {
  assertV018CandidateSelectorSafety,
  assertV018PointerBytesUnchanged,
  buildV018DualBuildIdentity,
  buildV018RebaseReceipt,
  readV018PointerSnapshots,
} from '../../../tools/teaching-projection-publishing/rebase/v018-receipt';
import type {
  V018AuthorityBinding,
  V018AuthorityNodeRecord,
  V018CaptureManifest,
  V018RebaseReceipt,
} from '../../../tools/teaching-projection-publishing/rebase/v018-contracts';
import {
  ACT_V018_AUTHORITY_RELEASE_ID,
  V018_CURRENT_POINTER_PATHS,
} from '../../../tools/teaching-projection-publishing/rebase/v018-contracts';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'act-v018-rebase-'));
  roots.push(root);
  return root;
}

function node(canonicalId: string, canonicalType = 'DomainConcept', lifecycleStatus = 'active'): V018AuthorityNodeRecord {
  return { canonicalId, canonicalType, lifecycleStatus, publicationStatus: 'published' };
}

function commitFixture(): { root: string; revision: string } {
  const root = tempRoot();
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'ACT test'], { cwd: root });
  writeFileSync(path.join(root, 'input.txt'), 'captured\n');
  writeFileSync(path.join(root, 'lessons.txt'), 'lesson-a\nlesson-b\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'capture'], { cwd: root });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, revision };
}

describe('v0.18 identity-only mapping', () => {
  it('carries only identical canonical ID + type and ignores translated names', () => {
    const records = classifyV018IdentityMappings({
      sourceNodes: [{ ...node('ctc:a'), semanticName: 'Laplace transform' }],
      targetNodes: [{ ...node('ctc:a'), semanticName: '拉普拉斯变换' }],
      referencedCanonicalIds: new Set(['ctc:a']),
    });
    expect(records).toEqual([expect.objectContaining({
      disposition: 'CARRY_FORWARD',
      reason: 'IDENTICAL_CANONICAL_ID_AND_TYPE',
    })]);
  });

  it.each([
    ['missing', [], 'REVIEW_REQUIRED', 'MISSING_TARGET'],
    ['type drift', [node('ctc:a', 'Formula')], 'REVIEW_REQUIRED', 'TYPE_DRIFT'],
  ])('marks %s as REVIEW_REQUIRED', (_label, targets, disposition, reason) => {
    const records = classifyV018IdentityMappings({
      sourceNodes: [node('ctc:a')],
      targetNodes: targets,
      referencedCanonicalIds: new Set(['ctc:a']),
    });
    expect(records[0]).toMatchObject({ disposition, reason });
  });

  it('does not infer a mapping from names, aliases, similarity, embeddings, or graph proximity', () => {
    expect(() => assertV018IdentityOnlyEvidence(['semanticName exact label match'])).toThrow('cannot use name inference');
    const records = classifyV018IdentityMappings({
      sourceNodes: [{ ...node('ctc:old'), semanticName: 'Laplace transform' }],
      targetNodes: [{ ...node('ctc:new'), semanticName: '拉普拉斯变换' }],
      referencedCanonicalIds: new Set(['ctc:old']),
    });
    expect(records.find((record) => record.sourceCanonicalId === 'ctc:old')?.disposition).toBe('REVIEW_REQUIRED');
  });

  it('does not block on an unreferenced v0.18 addition', () => {
    const records = classifyV018IdentityMappings({
      sourceNodes: [node('ctc:a')],
      targetNodes: [node('ctc:a'), node('ctc:new')],
      referencedCanonicalIds: new Set(['ctc:a']),
    });
    const impact = buildV018ImpactEvidence({ records, historicalExcludedCount: 4880 });
    expect(impact.reviewRequiredCount).toBe(0);
    expect(impact.unreferencedNewNodeCount).toBe(1);
    expect(impact.excludedHistoricalCount).toBe(4880);
  });
});

describe('v0.18 capture-bound input', () => {
  it('rejects file, membership, and execution drift', () => {
    const { root, revision } = commitFixture();
    const base = buildV018CaptureManifest({
      repoRoot: root,
      captureRevision: revision,
      files: ['input.txt'],
      collections: [{ collectionId: 'lessons', root: '.', prefixes: ['lessons.txt'] }],
    });
    assertV018CaptureBound(root, base);
    writeFileSync(path.join(root, 'input.txt'), 'changed\n');
    expect(() => assertV018CaptureBound(root, base)).toThrow('captured file bytes drifted');
    writeFileSync(path.join(root, 'input.txt'), 'captured\n');
    const membershipDrift = {
      ...base,
      collections: [{ ...base.collections[0], membershipDigest: '0'.repeat(64) }],
    };
    membershipDrift.inputDigest = projectionDigest({
      contract: membershipDrift.contract,
      captureRevision: membershipDrift.captureRevision,
      policy: membershipDrift.policy,
      files: membershipDrift.files,
      collections: membershipDrift.collections,
    });
    expect(() => assertV018CaptureBound(root, membershipDrift)).toThrow('capture membership drifted');
    const executionDrift: V018CaptureManifest = {
      ...base,
      collections: [{ ...base.collections[0], executionDigest: '1'.repeat(64) }],
    };
    executionDrift.inputDigest = projectionDigest({
      contract: executionDrift.contract,
      captureRevision: executionDrift.captureRevision,
      policy: executionDrift.policy,
      files: executionDrift.files,
      collections: executionDrift.collections,
    });
    expect(() => assertV018CaptureBound(root, executionDrift)).toThrow('capture execution set drifted');
  });

  it('captures overlay infograph associations as reviewed non-semantic references', () => {
    const root = tempRoot();
    const overlayRel = 'course-content/runtime/lessons/4-2/graph-overlay.json';
    mkdirSync(path.join(root, path.dirname(overlayRel)), { recursive: true });
    writeFileSync(path.join(root, overlayRel), `${JSON.stringify({
      nodes: [{
        id: '三频段闭环性能回读_3_38003',
        infograph: {
          type: 'infograph',
          path: 'course-content/runtime/knowledge/infographs/nodes/demo.png',
          nodeId: '三频段闭环性能回读_3_38003',
          sourceNodeId: '三频段闭环性能回读_3_38003',
        },
        resources: [{
          type: 'infograph',
          path: 'course-content/runtime/knowledge/infographs/nodes/demo.png',
          sourceNodeId: '三频段闭环性能回读_3_38003',
        }],
      }],
    })}\n`);
    const inventory = {
      contract: 'act-active-course-inventory/v1' as const,
      authoringRevision: 'a'.repeat(40),
      capturedAt: null,
      packageCount: 1,
      resourceCount: 0,
      inventoryDigest: '0'.repeat(64),
      packages: [{
        packageId: '4-2',
        scopeId: 'fixture-v018-rebase',
        routeSegment: null,
        runtimeLessonDir: '4-2',
        lessonKey: '4-2',
        title: 'fixture',
        sourcePaths: [overlayRel],
        resources: [],
      }],
    };
    const refs = collectOverlayInfographReferences({
      repoRoot: root,
      inventory,
      captureRevision: 'a'.repeat(40),
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      kind: 'infograph',
      reviewedNonSemanticDisposition: 'overlay-infograph-media',
      canonicalIds: [],
    });
    const prior = buildTeachingProjection(fixtureProjectionAuthoring());
    const denominator = buildV018ReferenceDenominator({
      inventory,
      priorArtifacts: prior,
      captureRevision: 'a'.repeat(40),
      repoRoot: root,
    });
    expect(denominator.filter((row) => row.kind === 'infograph')).toHaveLength(1);
  });

  it('rejects an admitted Authority candidate whose sealed outputs drifted', () => {
    const root = tempRoot();
    const receiptRel = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json';
    const replay1 = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/engineering.json';
    const replay2 = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/engineering.json';
    mkdirSync(path.join(root, path.dirname(replay1)), { recursive: true });
    mkdirSync(path.join(root, path.dirname(replay2)), { recursive: true });
    writeFileSync(path.join(root, replay1), '{"objects":[]}\n');
    writeFileSync(path.join(root, replay2), '{"objects":[]}\n');
    writeFileSync(path.join(root, receiptRel), '{}\n');
    const receipt = {
      status: 'staged',
      replays: [
        { name: 'replay-1', manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json', engineeringPath: replay1, stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json' },
        { name: 'replay-2', manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/manifest.json', engineeringPath: replay2, stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/stage-receipt.json' },
      ],
      outputs: [
        { path: receiptRel, sha256: '0'.repeat(64), digestScope: 'receipt-body-without-outputs' },
        { path: replay1, sha256: '0'.repeat(64), digestScope: 'bytes' },
        { path: replay2, sha256: '0'.repeat(64), digestScope: 'bytes' },
        { path: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json', sha256: '0'.repeat(64), digestScope: 'bytes' },
        { path: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/manifest.json', sha256: '0'.repeat(64), digestScope: 'bytes' },
        { path: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json', sha256: '0'.repeat(64), digestScope: 'bytes' },
        { path: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/stage-receipt.json', sha256: '0'.repeat(64), digestScope: 'bytes' },
      ],
    };
    expect(() => assertV018AdmittedAuthorityCandidate({
      repoRoot: root,
      receipt,
      receiptPath: path.join(root, receiptRel),
    })).toThrow(/sealed output (drifted|is missing)/);
  });

  it('rejects an admitted Authority candidate whose sealed output list dropped replay artifacts', () => {
    const root = tempRoot();
    const receiptRel = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json';
    mkdirSync(path.join(root, path.dirname(receiptRel)), { recursive: true });
    const receipt = {
      status: 'staged',
      replays: [{
        name: 'replay-1',
        manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json',
        engineeringPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/engineering.json',
        stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json',
      }, {
        name: 'replay-2',
        manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/manifest.json',
        engineeringPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/engineering.json',
        stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/stage-receipt.json',
      }],
      outputs: [{
        path: receiptRel,
        sha256: '0'.repeat(64),
        digestScope: 'receipt-body-without-outputs',
      }],
    };
    writeFileSync(path.join(root, receiptRel), `${JSON.stringify(receipt)}\n`);
    expect(() => assertV018AdmittedAuthorityCandidate({
      repoRoot: root,
      receipt,
      receiptPath: path.join(root, receiptRel),
    })).toThrow(/sealed output (drifted|list is missing)/);
  });

  it('rejects a cloned first replay counted as the second admission', () => {
    const root = tempRoot();
    const receiptRel = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json';
    const clone = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/engineering.json';
    mkdirSync(path.join(root, path.dirname(clone)), { recursive: true });
    writeFileSync(path.join(root, clone), '{"ok":true}\n');
    writeFileSync(path.join(root, receiptRel), '{}\n');
    const receipt = {
      status: 'staged',
      replays: [
        {
          name: 'replay-1',
          manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json',
          engineeringPath: clone,
          stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json',
        },
        {
          name: 'replay-2',
          manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json',
          engineeringPath: clone,
          stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json',
        },
      ],
      outputs: [{
        path: receiptRel,
        sha256: '0'.repeat(64),
        digestScope: 'receipt-body-without-outputs',
      }, {
        path: clone,
        sha256: '0'.repeat(64),
        digestScope: 'bytes',
      }],
    };
    expect(() => assertV018AdmittedAuthorityCandidate({
      repoRoot: root,
      receipt,
      receiptPath: path.join(root, receiptRel),
    })).toThrow('not under its own sealed replay root');
  });

  it('rejects a replay-2 path that traverses back into replay-1', () => {
    const root = tempRoot();
    const receiptRel = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json';
    mkdirSync(path.join(root, path.dirname(receiptRel)), { recursive: true });
    writeFileSync(path.join(root, receiptRel), '{}\n');
    const traversal = 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/../replay-1/engineering.json';
    const receipt = {
      status: 'staged',
      replays: [
        {
          name: 'replay-1',
          manifestPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/manifest.json',
          engineeringPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/engineering.json',
          stageReceiptPath: 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/stage-receipt.json',
        },
        {
          name: 'replay-2',
          manifestPath: traversal.replace('engineering.json', 'manifest.json'),
          engineeringPath: traversal,
          stageReceiptPath: traversal.replace('engineering.json', 'stage-receipt.json'),
        },
      ],
      outputs: [{ path: receiptRel, sha256: '0'.repeat(64), digestScope: 'receipt-body-without-outputs' }],
    };
    expect(() => assertV018AdmittedAuthorityCandidate({
      repoRoot: root,
      receipt,
      receiptPath: path.join(root, receiptRel),
    })).toThrow('sealed path is unsafe');
  });
});

describe('v0.18 candidate safety and deterministic evidence', () => {
  it('accepts only loopback database targets for disposable observation', () => {
    expect(assertV018DisposableDatabaseUrl(
      'postgresql://candidate:secret@localhost:5432/act_obe?schema=public',
    )).toMatchObject({
      accepted: true,
      hostname: 'localhost',
      isolation: 'schema-only-disposable',
    });
    expect(() => assertV018DisposableDatabaseUrl(
      'postgresql://candidate:secret@db.example.invalid:5432/act_obe',
    )).toThrow('local loopback');
    expect(() => assertV018DisposableDatabaseUrl(
      'mysql://candidate:secret@localhost:3306/act_obe',
    )).toThrow('PostgreSQL URL');
  });

  it('builds sorted, content-addressed observation rows deterministically', () => {
    const observation = buildV018DatabaseObservation({
      schemaIdentity: 'actkg_admission_test',
      environmentIdentity: 'local-loopback:test',
      authoritySnapshotId: 'snap-a',
      parameters: { releaseId: 'release-a' },
      objectRows: [
        { canonicalId: 'ctc:b', canonicalType: 'DomainConcept', snapshotId: 'snap-a' },
        { canonicalId: 'ctc:a', canonicalType: 'DomainConcept', snapshotId: 'snap-a' },
      ],
      prerequisiteRows: [{
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: 'ctc:b',
        relationType: 'PREREQUISITE',
        snapshotId: 'snap-a',
      }],
    });
    expect(observation.objectRows.map((row) => row.canonicalId)).toEqual(['ctc:a', 'ctc:b']);
    expect(observation.resultDigest).toBe(projectionDigest({
      objectRows: observation.objectRows,
      prerequisiteRows: observation.prerequisiteRows,
    }));
    const check = validateV018DatabaseObservation({
      observation,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept', 'ctc:b\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(['ctc:a\u001fctc:b\u001fPREREQUISITE']),
      expectedObjectRowCount: 2,
      expectedPrerequisiteRowCount: 1,
      expectedParameters: { releaseId: 'release-a', snapshotId: 'snap-a' },
      expectedSchemaIdentity: 'actkg_admission_test',
      expectedEnvironmentIdentity: 'local-loopback:test',
    });
    expect(check).toMatchObject({ available: true, accepted: true });
    const drifted = validateV018DatabaseObservation({
      observation: {
        ...observation,
        schemaIdentity: 'other-schema',
        environmentIdentity: 'other-env',
        parameters: { ...observation.parameters, releaseId: 'other-release' },
      },
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept', 'ctc:b\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(['ctc:a\u001fctc:b\u001fPREREQUISITE']),
      expectedObjectRowCount: 2,
      expectedPrerequisiteRowCount: 1,
      expectedParameters: { releaseId: 'release-a', snapshotId: 'snap-a' },
      expectedSchemaIdentity: 'actkg_admission_test',
      expectedEnvironmentIdentity: 'local-loopback:test',
      requireLoopbackEnvironment: true,
    });
    expect(drifted.accepted).toBe(false);
    expect(drifted.findingCodes).toEqual(expect.arrayContaining([
      'database-parameters-drift',
      'database-schema-identity-drift',
      'database-environment-identity-drift',
    ]));
    expect(expectedV018AdmissionSchemaIdentity({
      snapshotId: 'snap-a',
      releaseId: 'release-a',
      bundleDigest: 'b'.repeat(64),
      prerequisiteInputDigest: 'c'.repeat(64),
    })).toMatch(/^actkg_admission_v018_[a-f0-9]{32}$/u);

    const envParameters = {
      releaseId: 'release-a',
      snapshotId: 'snap-a',
      databaseProtocol: 'postgresql:',
      databaseHost: 'localhost',
      databasePort: '5432',
      databaseName: 'act_obe',
      isolation: 'schema-only-disposable',
    };
    const boundObservation = {
      ...observation,
      parameters: envParameters,
      environmentIdentity: environmentIdentityFromObservationParameters(envParameters),
    };
    expect(validateV018DatabaseObservation({
      observation: boundObservation,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept', 'ctc:b\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(['ctc:a\u001fctc:b\u001fPREREQUISITE']),
      expectedObjectRowCount: 2,
      expectedPrerequisiteRowCount: 1,
      requireLoopbackEnvironment: true,
    }).accepted).toBe(true);
    const stripped = {
      ...boundObservation,
      parameters: { releaseId: 'release-a', snapshotId: 'snap-a' },
      environmentIdentity: `local-loopback:${'f'.repeat(64)}`,
    };
    const strippedCheck = validateV018DatabaseObservation({
      observation: stripped,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept', 'ctc:b\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(['ctc:a\u001fctc:b\u001fPREREQUISITE']),
      expectedObjectRowCount: 2,
      expectedPrerequisiteRowCount: 1,
      requireLoopbackEnvironment: true,
    });
    expect(strippedCheck.accepted).toBe(false);
    expect(strippedCheck.findingCodes).toEqual(expect.arrayContaining([
      'database-environment-parameters-missing',
      'database-environment-identity-drift',
    ]));
  });

  it('rejects candidate output that can be consumed by selectors', () => {
    expect(() => assertV018CandidateSelectorSafety({
      mode: 'local-disposable-non-activation',
      unqualified: true,
      nonActivation: true,
      selectorConsumption: true,
      outputRoot: 'candidate/v018',
    })).toThrow('must be explicitly unqualified');
    expect(() => assertV018CandidateSelectorSafety({
      mode: 'local-disposable-non-activation',
      unqualified: true,
      nonActivation: true,
      selectorConsumption: false,
      outputRoot: 'course-content/runtime/knowledge/projection/candidate',
    })).toThrow('cannot be a runtime/current selector path');
  });

  it('requires byte-identical pointers and dual deterministic build identity', () => {
    const root = tempRoot();
    writeFileSync(path.join(root, 'current.json'), '{"v":0}\n');
    const before = readV018PointerSnapshots(root, ['current.json']);
    const after = readV018PointerSnapshots(root, ['current.json']);
    expect(() => assertV018PointerBytesUnchanged(before, after)).not.toThrow();
    expect(buildV018DualBuildIdentity({
      firstProjectionId: 'proj-a', firstProjectionHash: 'a'.repeat(64),
      secondProjectionId: 'proj-a', secondProjectionHash: 'a'.repeat(64),
      firstPrerequisitePublicationId: 'pre-a', firstPrerequisitePublicationHash: 'b'.repeat(64),
      secondPrerequisitePublicationId: 'pre-a', secondPrerequisitePublicationHash: 'b'.repeat(64),
    }).byteEquivalent).toBe(true);
    expect(() => buildV018DualBuildIdentity({
      firstProjectionId: 'proj-a', firstProjectionHash: 'a'.repeat(64),
      secondProjectionId: 'proj-b', secondProjectionHash: 'b'.repeat(64),
      firstPrerequisitePublicationId: 'pre-a', firstPrerequisitePublicationHash: 'b'.repeat(64),
      secondPrerequisitePublicationId: 'pre-a', secondPrerequisitePublicationHash: 'b'.repeat(64),
    })).toThrow('dual build identities differ');
  });

  it('fails closed for unavailable or drifted disposable database observations', () => {
    const unavailable = validateV018DatabaseObservation({
      observation: null,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(),
      expectedPrerequisiteKeys: new Set(),
    });
    expect(unavailable).toMatchObject({ available: false, accepted: false, findingCodes: ['database-observation-unavailable'] });
    const observation = {
      contract: 'actkg-v018-candidate-admission-db-observation/v1' as const,
      mode: 'disposable-read-only-candidate-admission' as const,
      schemaIdentity: 'schema-a',
      environmentIdentity: 'env-a',
      queryContractHash: '0'.repeat(64),
      parameters: { snapshotId: 'snap-a' },
      objectRows: [{ canonicalId: 'ctc:a', canonicalType: 'DomainConcept', snapshotId: 'snap-a' }],
      prerequisiteRows: [],
      resultDigest: '0'.repeat(64),
      objectRowCount: 1,
      prerequisiteRowCount: 0,
      readOnly: true as const,
      disposable: true as const,
    };
    const drifted = validateV018DatabaseObservation({
      observation,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(),
      expectedObjectRowCount: 1,
      expectedPrerequisiteRowCount: 0,
    });
    expect(drifted.accepted).toBe(false);
    expect(drifted.findingCodes).toContain('database-query-contract-drift');
    const duplicate = {
      ...observation,
      queryContractHash: V018_DATABASE_QUERY_CONTRACT_HASH,
      objectRows: [observation.objectRows[0]!, observation.objectRows[0]!],
      objectRowCount: 2,
      resultDigest: projectionDigest({
        objectRows: [observation.objectRows[0]!, observation.objectRows[0]!],
        prerequisiteRows: [],
      }),
    };
    const duplicateCheck = validateV018DatabaseObservation({
      observation: duplicate,
      authoritySnapshotId: 'snap-a',
      expectedCanonicalIds: new Set(['ctc:a\u001fDomainConcept']),
      expectedPrerequisiteKeys: new Set(),
      expectedObjectRowCount: 2,
      expectedPrerequisiteRowCount: 0,
    });
    expect(duplicateCheck.findingCodes).toContain('database-object-duplicate');
    expect(V018_DATABASE_QUERY_CONTRACT_HASH).toMatch(/^[a-f0-9]{64}$/u);
  });
});

const REPO_ROOT = path.resolve(__dirname, '../../..');
const V018_CANDIDATE_RECEIPT = path.join(
  REPO_ROOT,
  'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/candidate-receipt.json',
);
const COMMIT = 'a'.repeat(40);
const SNAPSHOT_HASH = '1'.repeat(64);
const SCOPE = 'fixture-v018-rebase';

function authorityBinding(): V018AuthorityBinding {
  return {
    releaseId: ACT_V018_AUTHORITY_RELEASE_ID,
    releaseSetId: 'set-v018-fixture',
    releaseHash: '2'.repeat(64),
    snapshotId: 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
    snapshotHash: SNAPSHOT_HASH,
    captureRevision: COMMIT,
    bundleDigest: '3'.repeat(64),
    admissionReceiptId: 'admission-fixture',
    admissionReceiptDigest: '4'.repeat(64),
    candidateReceiptDigest: '5'.repeat(64),
  };
}

function fixtureNode(canonicalId: string, canonicalType = 'DomainConcept'): V018AuthorityNodeRecord {
  return {
    canonicalId,
    canonicalType,
    lifecycleStatus: 'active',
    publicationStatus: 'published',
  };
}

function fixtureProjectionAuthoring(): TeachingProjectionAuthoringInput {
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: SCOPE,
    authoringRevision: COMMIT,
    authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
    authorityReleaseSetId: 'set-v09-fixture',
    authoritySnapshotHash: SNAPSHOT_HASH,
    resources: [
      {
        resourceType: 'step',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        projectionMode: 'REQUIRED',
        scopeId: SCOPE,
        title: 'Practice step',
      },
    ],
    bindings: [
      {
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'PRACTICES',
        scopeId: SCOPE,
        primary: true,
      },
    ],
    prerequisites: [],
    coreNodes: [
      {
        canonicalId: 'node-a',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: SCOPE,
      },
    ],
    cards: [
      {
        cardId: 'card-a',
        canonicalId: 'node-a',
        active: true,
        required: true,
      },
      {
        cardId: 'card-b',
        canonicalId: 'node-b',
        active: true,
        required: true,
      },
    ],
    authorityNodes: [
      { canonicalId: 'node-a', lifecycleStatus: 'active', successorCanonicalId: null },
      { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
    ],
  };
}

function fixturePrerequisiteInput(sourceId = 'node-a', targetId = 'node-b') {
  const evidenceRefs = ['authoring/handouts/fixture.md'];
  const decision = createPrerequisiteAuthorDecision({
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    strength: 'REQUIRED',
    scopeId: SCOPE,
    evidenceRefs,
    curatorRationale: 'Hard teaching dependency',
    curatorId: 'teacher.core-path',
    rationale: 'Author decision for publication',
    authorityReleaseId: ACT_V018_AUTHORITY_RELEASE_ID,
    projectionCaptureId: 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
    authoringRevision: COMMIT,
  });
  return {
    coreNodes: [
      {
        canonicalId: sourceId,
        scopeId: SCOPE,
        pathEligible: true,
        cardPolicy: 'REQUIRED' as const,
        moduleId: 'module-1',
        rationale: 'Formal objective',
        sourceKind: 'OBJECTIVE' as const,
        sourceEvidence: ['authoring/objectives/fixture.md'],
      },
      {
        canonicalId: targetId,
        scopeId: SCOPE,
        pathEligible: true,
        cardPolicy: 'REQUIRED' as const,
        moduleId: 'module-1',
        rationale: 'Primary COVERS',
        sourceKind: 'PRIMARY_COVERS' as const,
        sourceEvidence: ['act:step:lesson-02:practice-1'],
      },
    ],
    edges: [{
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      strength: 'REQUIRED' as const,
      scopeId: SCOPE,
      evidenceRefs,
      curatorId: 'teacher.core-path',
      curatorRationale: 'Hard teaching dependency',
      status: 'PUBLISHED' as const,
      authorDecisionId: decision.decisionId,
    }],
    decisions: [decision],
    candidates: [],
  };
}

describe('v0.18 shipped identity rebase', () => {
  it('rebuilds twice from identity-only mapping and leaves new v0.18 nodes uncovered', () => {
    const prior = buildTeachingProjection(fixtureProjectionAuthoring());
    const input = {
      authority: authorityBinding(),
      sourceNodes: [fixtureNode('node-a'), fixtureNode('node-b')],
      targetNodes: [
        { ...fixtureNode('node-a'), semanticName: '拉普拉斯变换' },
        { ...fixtureNode('node-b'), semanticName: '传递函数' },
        fixtureNode('node-new'),
      ],
      priorArtifacts: prior,
      prerequisiteInput: fixturePrerequisiteInput(),
      references: [{
        referenceId: 'act:step:lesson-02:practice-1',
        kind: 'resource' as const,
        sourcePath: 'course-content/runtime/lessons/lesson-02/practice.json',
        sourceDigest: '6'.repeat(64),
        scopeId: SCOPE,
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalIds: ['node-a'],
        active: true as const,
        captureRevision: COMMIT,
        captureEvidence: ['course-content/runtime/lessons/lesson-02/practice.json'],
      }],
    };
    const first = buildV018IdentityRebase(input);
    const second = buildV018IdentityRebase(input);
    expect(first.mapping.reviewRequiredCount).toBe(0);
    expect(first.mapping.unreferencedNewNodeCount).toBe(1);
    expect(first.projection.gate.passed).toBe(true);
    expect(first.prerequisite.gate.passed).toBe(true);
    expect(first.projection.manifest.projectionId).toBe(second.projection.manifest.projectionId);
    expect(first.prerequisite.manifest.publicationId).toBe(second.prerequisite.manifest.publicationId);
    expect(resolveV018CanonicalId('node-a', first.mapping)).toBe('node-a');
    expect(first.projection.bindings.every((binding) => binding.canonicalId !== 'node-new')).toBe(true);
    expect(() => assertV018IdentityOnlyEvidence(first.mapping.records.flatMap((record) => record.evidence))).not.toThrow();
  });

  it('blocks the shipped rebuild when a captured reference has no identity successor', () => {
    const prior = buildTeachingProjection(fixtureProjectionAuthoring());
    expect(() => buildV018IdentityRebase({
      authority: authorityBinding(),
      sourceNodes: [fixtureNode('node-a'), fixtureNode('node-b')],
      targetNodes: [fixtureNode('node-b'), fixtureNode('node-new')],
      priorArtifacts: prior,
      prerequisiteInput: fixturePrerequisiteInput(),
      references: [{
        referenceId: 'act:step:lesson-02:practice-1',
        kind: 'resource',
        sourcePath: 'course-content/runtime/lessons/lesson-02/practice.json',
        sourceDigest: '6'.repeat(64),
        scopeId: SCOPE,
        canonicalIds: ['node-a'],
        active: true,
        captureRevision: COMMIT,
        captureEvidence: ['identity-only'],
      }],
    })).toThrow('REVIEW_REQUIRED');
  });

  it('applies an explicit reviewed mapping and rejects name-based review evidence', () => {
    const prior = buildTeachingProjection(fixtureProjectionAuthoring());
    expect(() => buildV018IdentityRebase({
      authority: authorityBinding(),
      sourceNodes: [fixtureNode('node-a'), fixtureNode('node-b')],
      targetNodes: [fixtureNode('node-successor'), fixtureNode('node-b')],
      priorArtifacts: prior,
      prerequisiteInput: fixturePrerequisiteInput(),
      references: [{
        referenceId: 'act:step:lesson-02:practice-1',
        kind: 'resource',
        sourcePath: 'course-content/runtime/lessons/lesson-02/practice.json',
        sourceDigest: '6'.repeat(64),
        scopeId: SCOPE,
        canonicalIds: ['node-a'],
        active: true,
        captureRevision: COMMIT,
        captureEvidence: ['identity-only'],
      }],
      reviewedMappings: [{
        sourceCanonicalId: 'node-a',
        sourceCanonicalType: 'DomainConcept',
        targetCanonicalId: 'node-successor',
        targetCanonicalType: 'DomainConcept',
        reviewId: 'review-successor',
        evidence: ['exact label alias match'],
      }],
    })).toThrow('cannot use');

    const rebuilt = buildV018IdentityRebase({
      authority: authorityBinding(),
      sourceNodes: [fixtureNode('node-a'), fixtureNode('node-b')],
      targetNodes: [fixtureNode('node-successor'), fixtureNode('node-b')],
      priorArtifacts: prior,
      prerequisiteInput: fixturePrerequisiteInput(),
      references: [{
        referenceId: 'act:step:lesson-02:practice-1',
        kind: 'resource',
        sourcePath: 'course-content/runtime/lessons/lesson-02/practice.json',
        sourceDigest: '6'.repeat(64),
        scopeId: SCOPE,
        canonicalIds: ['node-a'],
        active: true,
        captureRevision: COMMIT,
        captureEvidence: ['identity-only'],
      }],
      reviewedMappings: [{
        sourceCanonicalId: 'node-a',
        sourceCanonicalType: 'DomainConcept',
        targetCanonicalId: 'node-successor',
        targetCanonicalType: 'DomainConcept',
        reviewId: 'review-successor',
        evidence: ['explicit-reviewed-canonical-successor'],
      }],
    });
    expect(resolveV018CanonicalId('node-a', rebuilt.mapping)).toBe('node-successor');
    expect(rebuilt.projection.bindings[0]?.canonicalId).toBe('node-successor');
  });

  it('keeps current v0.9 pointer bytes unchanged while staging an inactive receipt', () => {
    const root = tempRoot();
    const pointerRel = 'course-content/runtime/knowledge/projection/current.json';
    mkdirSync(path.dirname(path.join(root, pointerRel)), { recursive: true });
    writeFileSync(path.join(root, pointerRel), `${JSON.stringify({
      contract: 'act-teaching-projection-pointer/v1',
      releaseId: 'ctr:release:control-theory-engineering-v0.9',
    })}\n`);
    const before = readV018PointerSnapshots(root, [pointerRel]);
    const after = readV018PointerSnapshots(root, [pointerRel]);
    assertV018PointerBytesUnchanged(before, after);
    const receipt = buildV018RebaseReceipt({
      authority: authorityBinding(),
      capture: {
        contract: 'act-teaching-projection-capture-receipt/v1',
        captureRevision: COMMIT,
        manifestDigest: '6'.repeat(64),
        inventoryDigest: '7'.repeat(64),
        denominatorDigest: '8'.repeat(64),
        referenceCount: 1,
        excludedHistoricalCount: 4880,
        excludedUnreferencedCount: 1,
        fileMembershipExecutionBound: true,
      },
      databaseObservation: {
        available: true,
        accepted: true,
        findingCodes: [],
        observationDigest: '9'.repeat(64),
      },
      mapping: buildV018ImpactEvidence({
        records: classifyV018IdentityMappings({
          sourceNodes: [fixtureNode('node-a')],
          targetNodes: [fixtureNode('node-a'), fixtureNode('node-new')],
          referencedCanonicalIds: new Set(['node-a']),
        }),
      }),
      denominator: {
        referenceCount: 1,
        resourceCount: 1,
        bindingCount: 1,
        prerequisiteCount: 0,
        coreNodeCount: 1,
        cardCount: 1,
        digest: 'a'.repeat(64),
        referenceKindCounts: {
          course: 0, package: 0, resource: 1, card: 0, infograph: 0, textbook: 0,
          'textbook-chapter': 0, 'textbook-section': 0, prerequisite: 0, path: 0,
          konling: 0, rag: 0, 'domain-fragment': 0,
        },
      },
      projection: {
        projectionId: 'proj-fixture',
        projectionHash: 'b'.repeat(64),
        gateStatus: 'PUBLISHED',
        gatePassed: true,
      },
      prerequisite: {
        publicationId: 'pre-fixture',
        publicationHash: 'c'.repeat(64),
        gateStatus: 'PUBLISHED',
        gatePassed: true,
      },
      pointersBefore: before,
      pointersAfter: after,
      dualBuild: buildV018DualBuildIdentity({
        firstProjectionId: 'proj-fixture',
        firstProjectionHash: 'b'.repeat(64),
        secondProjectionId: 'proj-fixture',
        secondProjectionHash: 'b'.repeat(64),
        firstPrerequisitePublicationId: 'pre-fixture',
        firstPrerequisitePublicationHash: 'c'.repeat(64),
        secondPrerequisitePublicationId: 'pre-fixture',
        secondPrerequisitePublicationHash: 'c'.repeat(64),
      }),
    });
    expect(receipt.status).toBe('READY');
    expect(receipt.unqualified).toBe(true);
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.selectorConsumption).toBe(false);
    expect(JSON.parse(after[0]!.content).releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
  });
});

describe('v0.18 captured candidate remains inactive after successor cutover', () => {
  it('proves the sealed receipt did not move selectors and live Git now records v0.37', () => {
    expect(existsSync(V018_CANDIDATE_RECEIPT)).toBe(true);
    const receipt = JSON.parse(readFileSync(V018_CANDIDATE_RECEIPT, 'utf8')) as V018RebaseReceipt;
    assertV018PointerBytesUnchanged(receipt.pointersBefore, receipt.pointersAfter);
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.selectorConsumption).toBe(false);
    expect(receipt.mapping.reviewRequiredCount).toBe(0);
    expect(receipt.dualBuild?.byteEquivalent).toBe(true);
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[0]), 'utf8')) as { releaseId: string };
    const projection = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[1]), 'utf8')) as { authorityReleaseId: string };
    const prerequisites = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[2]), 'utf8')) as { authorityReleaseId: string };
    const shards = JSON.parse(readFileSync(path.join(REPO_ROOT, V018_CURRENT_POINTER_PATHS[3]), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(projection.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(prerequisites.authorityReleaseId).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(shards.releaseId).toBe('ctr:release:control-theory-engineering-v0.37');
  });
});

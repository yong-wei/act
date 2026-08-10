import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCandidateOutputRoot,
  buildTeachingProjectionCandidate,
  omitUndefinedObjectFields,
  persistedPackageCandidateReference,
  type StagedAuthorityInput,
} from '../../../scripts/knowledge-cutover/prepare-actkg-cutover-teaching-projection';
import type { ActiveCourseInventory } from '../teaching-projection/migration-contracts';

const revision = 'a'.repeat(40);
const snapshotHash = 'b'.repeat(64);

function authority(): StagedAuthorityInput {
  return {
    manifestPath: '/tmp/staged-authority/manifest.json',
    manifest: {
      contract: 'actkg-engineering-authority-snapshot/v1',
      releaseSetId: 'set-cutover-fixture',
      releaseId: 'release-cutover-fixture',
      releaseHash: 'c'.repeat(64),
      releaseVersion: 'fixture',
      protocol: 'actkg-public-bundle/1',
      schemaVersion: '0.2.0',
      bundleDigest: 'd'.repeat(64),
      sourceDatasetHash: 'e'.repeat(64),
      projectionDigest: 'f'.repeat(64),
      projectionId: 'projection-fixture',
      predecessorReleaseId: null,
      importReceiptId: 'receipt-fixture',
      bundleReceiptId: 'bundle-receipt-fixture',
      deltaReceiptIds: [],
      captureRevision: revision,
      objectCount: 1,
      relationCount: 0,
      provenance: {
        sourceMappingCount: 0,
        sourceObjectCount: 0,
        evidenceSegmentCount: 0,
        releaseEntryCount: 0,
        upstreamRagReferenceCount: 0,
        releaseComponentCount: 0,
        projectionIdentityCount: 0,
        linkMetadataCount: 0,
        importReceiptId: 'receipt-fixture',
        bundleReceiptId: 'bundle-receipt-fixture',
        bundleId: 'bundle-fixture',
        captureRevision: revision,
        lockRawHash: null,
      },
      engineeringDigest: '0'.repeat(64),
      snapshotId: 'snap-fixture',
      snapshotHash,
      lifecycle: 'staged',
    },
    engineering: {
      objects: [{
        canonicalId: 'node-fixture',
        ordinal: 0,
        canonicalType: 'DomainConcept',
        semanticName: 'Fixture Label',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: {},
      }],
      relations: [],
      sourceMappings: [],
      sourceObjects: [],
      evidence: [],
      releaseEntries: [],
      upstreamRagReferences: [],
      releaseComponents: [],
      projectionIdentities: [],
      linkMetadata: [],
    },
  };
}

function inventory(): ActiveCourseInventory {
  const resources = [
    {
      resourceId: 'act:step:fixture:required',
      resourceType: 'step' as const,
      lessonKey: 'fixture',
      stepId: 'required',
      scopeId: 'course-package:fixture',
      packageId: 'fixture',
      projectionMode: 'REQUIRED' as const,
      title: 'Required',
      sourcePath: 'course-content/runtime/fixture/required.json',
      sourceDigest: '1'.repeat(64),
      legacyIds: [],
      labels: [],
      cardIds: [],
      knowledgeRefs: [],
      manifestKnowledge: null,
    },
    {
      resourceId: 'act:step:fixture:optional',
      resourceType: 'step' as const,
      lessonKey: 'fixture',
      stepId: 'optional',
      scopeId: 'course-package:fixture',
      packageId: 'fixture',
      projectionMode: 'OPTIONAL' as const,
      title: 'Optional',
      sourcePath: 'course-content/runtime/fixture/optional.json',
      sourceDigest: '2'.repeat(64),
      legacyIds: [],
      labels: [],
      cardIds: [],
      knowledgeRefs: [],
      manifestKnowledge: null,
    },
    {
      resourceId: 'act:handout:fixture',
      resourceType: 'handout' as const,
      lessonKey: 'fixture',
      scopeId: 'course-package:fixture',
      packageId: 'fixture',
      projectionMode: 'NONE' as const,
      title: 'None',
      sourcePath: 'course-content/runtime/fixture/handout.json',
      sourceDigest: '3'.repeat(64),
      legacyIds: [],
      labels: [],
      cardIds: [],
      knowledgeRefs: [],
      manifestKnowledge: null,
    },
  ];
  return {
    contract: 'act-active-course-inventory/v1',
    authoringRevision: revision,
    capturedAt: null,
    packageCount: 1,
    resourceCount: resources.length,
    packages: [{
      packageId: 'fixture',
      scopeId: 'course-package:fixture',
      routeSegment: 'fixture',
      runtimeLessonDir: 'fixture',
      lessonKey: 'fixture',
      title: 'Fixture',
      sourcePaths: resources.map((resource) => resource.sourcePath),
      resources,
    }],
    inventoryDigest: '4'.repeat(64),
  };
}

describe('ActKG → ACT Teaching Projection candidate preparation', () => {
  it('rejects the default projection root and current pointer', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-cutover-projection-'));
    try {
      expect(() => assertCandidateOutputRoot(root, path.join(root, 'course-content/runtime/knowledge/projection')))
        .toThrow(/default Teaching Projection/);
      expect(() => assertCandidateOutputRoot(root, path.join(root, 'candidate/current.json')))
        .toThrow(/current\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reconciles every REVIEW_REQUIRED resource exactly once and never imports historical DEFER', () => {
    const result = buildTeachingProjectionCandidate({
      repoRoot: process.cwd(),
      authoringRevision: revision,
      authority: authority(),
      inventory: inventory(),
    });
    const reviewIds = result.migration.records
      .filter((record) => record.status === 'REVIEW_REQUIRED')
      .map((record) => record.resourceId)
      .sort();
    expect(result.worklist.items.map((item) => item.resourceId)).toEqual(reviewIds);
    expect(new Set(result.worklist.items.map((item) => item.resourceId)).size).toBe(reviewIds.length);
    expect(result.worklist.historicalCourseCoverageExcluded).toEqual({
      batchCount: 34,
      deferCount: 4880,
      includedInDenominator: false,
    });
    expect(result.worklist.items.some((item) => item.missingEvidence.includes('4880'))).toBe(false);
  });

  it('does not infer EXPLICIT_NONE for an unbound OPTIONAL resource', () => {
    const result = buildTeachingProjectionCandidate({
      repoRoot: process.cwd(),
      authoringRevision: revision,
      authority: authority(),
      inventory: inventory(),
    });
    const optional = result.migration.records.find((record) => record.resourceId.endsWith(':optional'));
    const explicitNone = result.migration.records.find((record) => record.resourceId.endsWith(':fixture'));
    expect(optional?.status).toBe('REVIEW_REQUIRED');
    expect(explicitNone?.status).toBe('EXPLICIT_NONE');
  });

  it('omits undefined optional object fields without accepting undefined array entries', () => {
    expect(omitUndefinedObjectFields({ title: 'fixture', stepId: undefined })).toEqual({ title: 'fixture' });
    expect(() => omitUndefinedObjectFields(['fixture', undefined]))
      .toThrow(/undefined array item/);
  });

  it('keeps execution reuse state out of the persisted candidate reference', () => {
    expect(persistedPackageCandidateReference({
      packageId: 'fixture',
      projectionId: 'proj-fixture',
      projectionHash: 'f'.repeat(64),
      releaseDir: 'packages/fixture/releases/proj-fixture',
      reused: true,
    })).toEqual({
      packageId: 'fixture',
      projectionId: 'proj-fixture',
      projectionHash: 'f'.repeat(64),
      releaseDir: 'packages/fixture/releases/proj-fixture',
    });
  });
});

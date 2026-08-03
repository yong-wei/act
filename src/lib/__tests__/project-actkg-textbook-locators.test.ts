/**
 * ActKG textbook locator projection (#1269 / project-actkg-textbook-locators).
 *
 * Exercises shipped inventory, crosswalk, builder, and consumer functions.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildTeachingProjection,
  buildTextbookLocatorProjection,
  deriveTextbookChapterResourceId,
  deriveTextbookExplainsBindingId,
  deriveTextbookResourceId,
  deriveTextbookSectionResourceId,
  loadActkgSourceLocatorInventory,
  loadSourceResourceCrosswalk,
  loadV012BundleIdentity,
  parseActkgSourceLocatorStubs,
  parseSourceResourceCrosswalkText,
  projectTextbookLocatorConsumers,
  textbookLocatorToRagProvenance,
  textbookProjectionToTeachingAuthoring,
  type ActkgSourceLocatorInventory,
  type SourceResourceCrosswalkRow,
  type TextbookLocatorAuthorityBinding,
} from '../teaching-projection';

const REPO_ROOT = process.cwd();

const THREE_BOOKS = [
  'dorf-modern-control-systems-14th',
  'franklin-feedback-control-7th',
  'hu-shousong-auto-control-8th',
] as const;

function loadShippedInventory(): ActkgSourceLocatorInventory {
  return loadActkgSourceLocatorInventory({ repoRoot: REPO_ROOT });
}

function loadShippedCrosswalk(): SourceResourceCrosswalkRow[] {
  return loadSourceResourceCrosswalk({ repoRoot: REPO_ROOT });
}

function authorityCanonicalIdsFromProjection(
  inventory: ActkgSourceLocatorInventory,
  rows: readonly SourceResourceCrosswalkRow[],
): Set<string> {
  // Use Canonical IDs present on shipped rows (all are in v0.12 Authority).
  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of row.canonicalIds) ids.add(id);
  }
  // Also allow a couple of known inventory-only anchors for failure fixtures.
  void inventory;
  return ids;
}

function cloneAuthority(
  authority: TextbookLocatorAuthorityBinding,
  overrides: Partial<TextbookLocatorAuthorityBinding> = {},
): TextbookLocatorAuthorityBinding {
  return {
    ...authority,
    ...overrides,
    sourceInventory: {
      ...authority.sourceInventory,
      ...(overrides.sourceInventory ?? {}),
    },
  };
}

function baseRow(
  inventory: ActkgSourceLocatorInventory,
  overrides: Partial<SourceResourceCrosswalkRow> = {},
): SourceResourceCrosswalkRow {
  const anchor = inventory.sourceAnchors[0]!;
  const auth = inventory.authority;
  return {
    sourceDocumentId: anchor.sourceDocumentId,
    sourceAnchorId: anchor.sourceAnchorId,
    chapterKey: 'ch-fixture-01',
    sectionKey: 'sec-fixture-01',
    pageStart: 10,
    pageEnd: 12,
    canonicalIds: ['ctc:fixture-canonical-a'],
    accessMode: 'REFERENCE_ONLY',
    authorityReleaseId: auth.authorityReleaseId,
    authorityReleaseHash: auth.authorityReleaseHash,
    bundleDigest: auth.bundleDigest,
    captureRevision: auth.captureRevision,
    authorizedContentRef: null,
    rowNumber: 1,
    ...overrides,
  };
}

describe('ActKG textbook locator inventory (#1269)', () => {
  it('loads three SourceDocument sets and SourceAnchor locators without body text', () => {
    const inventory = loadShippedInventory();
    const docs = inventory.sourceDocuments.map((d) => d.sourceDocumentId).sort();
    expect(docs).toEqual([...THREE_BOOKS]);
    expect(inventory.sourceAnchors.length).toBeGreaterThan(0);

    for (const book of THREE_BOOKS) {
      const anchors = inventory.sourceAnchors.filter((a) => a.sourceDocumentId === book);
      expect(anchors.length).toBeGreaterThan(0);
    }

    // Public stubs retain content hashes only — no exact/raw text fields on inventory.
    const serialized = JSON.stringify(inventory);
    expect(serialized).not.toMatch(/exact_text|raw_text|textbookBody/i);

    const v012 = loadV012BundleIdentity({ repoRoot: REPO_ROOT });
    expect(inventory.authority.authorityReleaseId).toBe(v012.authorityReleaseId);
    expect(inventory.authority.authorityReleaseHash).toBe(v012.authorityReleaseHash);
    expect(inventory.authority.bundleDigest).toBe(v012.bundleDigest);
    expect(inventory.authority.captureRevision).toBe(v012.captureRevision);
  });

  it('loads and validates the minimal source-resource-crosswalk sidecar', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const docs = new Set(rows.map((r) => r.sourceDocumentId));
    for (const book of THREE_BOOKS) {
      expect(docs.has(book)).toBe(true);
    }

    for (const row of rows) {
      expect(row.chapterKey.length).toBeGreaterThan(0);
      expect(row.sectionKey.length).toBeGreaterThan(0);
      expect(row.canonicalIds.length).toBeGreaterThan(0);
      expect(row.accessMode).toBe('REFERENCE_ONLY');
      expect(row.authorityReleaseHash).toBe(inventory.authority.authorityReleaseHash);
      expect(row.captureRevision).toBe(inventory.authority.captureRevision);
      // No body fields on shipped sidecar lines.
      expect(JSON.stringify(row)).not.toMatch(/"body"|"raw_text"|"exact_text"/i);
    }
  });

  it('rejects crosswalk rows that embed textbook body fields', () => {
    expect(() =>
      parseSourceResourceCrosswalkText(
        JSON.stringify({
          sourceDocumentId: 'dorf-modern-control-systems-14th',
          sourceAnchorId: 'cts:section-x',
          chapterKey: 'ch1',
          sectionKey: '1.1',
          pageStart: null,
          pageEnd: null,
          canonicalIds: ['ctc:a'],
          accessMode: 'REFERENCE_ONLY',
          authorityReleaseId: 'x',
          authorityReleaseHash: 'y',
          bundleDigest: 'z',
          captureRevision: 'c',
          raw_text: 'forbidden textbook body',
        }),
      ),
    ).toThrow(/raw-text-forbidden|forbidden/i);
  });
});

describe('Textbook resource identities and EXPLAINS bindings (#1269)', () => {
  it('derives deterministic TEXTBOOK → CHAPTER → SECTION resource IDs', () => {
    expect(deriveTextbookResourceId('dorf-modern-control-systems-14th')).toBe(
      'act:textbook:dorf-modern-control-systems-14th',
    );
    expect(
      deriveTextbookChapterResourceId('dorf-modern-control-systems-14th', 'ch07'),
    ).toBe('act:textbook-chapter:dorf-modern-control-systems-14th:ch07');
    expect(deriveTextbookSectionResourceId('cts:section-014c3e3883bffdf7704d49ae')).toBe(
      'act:textbook-section:cts.section-014c3e3883bffdf7704d49ae',
    );
  });

  it('emits one EXPLAINS binding per Canonical ID for one-to-many sections', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    const multi = rows.find((r) => r.canonicalIds.length > 1);
    expect(multi).toBeTruthy();

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-one-to-many',
      inventory,
      crosswalkRows: [multi!],
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, [multi!]),
      projectionBuildId: 'build-one-to-many',
    });

    expect(projection.sliceStatus).toBe('PUBLISHED');
    expect(projection.bindings.length).toBe(multi!.canonicalIds.length);

    const sectionId = deriveTextbookSectionResourceId(multi!.sourceAnchorId);
    for (const binding of projection.bindings) {
      expect(binding.resourceId).toBe(sectionId);
      expect(binding.role).toBe('EXPLAINS');
      expect(binding.sourceAnchorId).toBe(multi!.sourceAnchorId);
      expect(binding.locator.sectionKey).toBe(multi!.sectionKey);
      expect(binding.provenance.authorityReleaseHash).toBe(
        inventory.authority.authorityReleaseHash,
      );
    }

    const bindingIds = projection.bindings.map((b) => b.bindingId).sort();
    const expectedIds = multi!.canonicalIds
      .map((canonicalId) =>
        deriveTextbookExplainsBindingId({
          resourceId: sectionId,
          canonicalId,
          scopeId: 'fixture-one-to-many',
        }),
      )
      .sort();
    expect(bindingIds).toEqual(expectedIds);
  });

  it('allows many sections across books to explain the same Canonical ID', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    // Force two rows from different books onto one shared Canonical.
    const a = { ...rows[0]!, canonicalIds: ['ctc:shared-canonical'], rowNumber: 1 };
    const b = {
      ...rows.find((r) => r.sourceDocumentId !== a.sourceDocumentId)!,
      canonicalIds: ['ctc:shared-canonical'],
      rowNumber: 2,
    };

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-many-to-one',
      inventory,
      crosswalkRows: [a, b],
      authorityCanonicalIds: new Set(['ctc:shared-canonical']),
      projectionBuildId: 'build-many-to-one',
    });

    expect(projection.sliceStatus).toBe('PUBLISHED');
    expect(projection.bindings.length).toBe(2);
    expect(new Set(projection.bindings.map((x) => x.canonicalId))).toEqual(
      new Set(['ctc:shared-canonical']),
    );
    expect(new Set(projection.bindings.map((x) => x.sourceDocumentId)).size).toBe(2);
  });

  it('projects shipped crosswalk into hierarchy with access mode and provenance', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-shipped',
      inventory,
      crosswalkRows: rows,
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, rows),
      projectionBuildId: 'build-shipped',
    });

    expect(projection.sliceStatus).toBe('PUBLISHED');
    expect(projection.blocksTextbookSliceOnly).toBe(true);
    expect(projection.resources.some((r) => r.grain === 'TEXTBOOK')).toBe(true);
    expect(projection.resources.some((r) => r.grain === 'CHAPTER')).toBe(true);
    expect(projection.resources.some((r) => r.grain === 'SECTION')).toBe(true);

    for (const resource of projection.resources) {
      expect(resource.pathEligible).toBe(false);
      expect(resource.provenance.authorityReleaseId).toBe(
        inventory.authority.authorityReleaseId,
      );
      expect(resource.provenance.captureRevision).toBe(
        inventory.authority.captureRevision,
      );
      expect(resource.provenance.projectionBuildId).toBe('build-shipped');
    }

    for (const section of projection.resources.filter((r) => r.grain === 'SECTION')) {
      expect(section.accessMode).toBe('REFERENCE_ONLY');
      expect(section.locator.sourceAnchorId).toBeTruthy();
      expect(section.locator.sectionKey).toBeTruthy();
    }

    // Determinism: identical inputs → identical projectionBuildId digest path.
    const again = buildTextbookLocatorProjection({
      scopeId: 'fixture-shipped',
      inventory,
      crosswalkRows: rows,
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, rows),
    });
    const third = buildTextbookLocatorProjection({
      scopeId: 'fixture-shipped',
      inventory,
      crosswalkRows: rows,
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, rows),
    });
    expect(again.projectionBuildId).toBe(third.projectionBuildId);
    expect(again.bindings.map((b) => b.bindingId)).toEqual(
      third.bindings.map((b) => b.bindingId),
    );
  });
});

describe('Textbook locator failure fixtures (#1269)', () => {
  it('marks missing sidecar as textbook-slice REVIEW_REQUIRED only', () => {
    const inventory = loadShippedInventory();
    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-missing-sidecar',
      inventory,
      crosswalkRows: [],
      authorityCanonicalIds: new Set(['ctc:a']),
      projectionBuildId: 'build-missing',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(projection.failures.some((f) => f.code === 'missing-crosswalk')).toBe(true);
    expect(projection.resources).toEqual([]);
    expect(projection.blocksTextbookSliceOnly).toBe(true);

    const consumers = projectTextbookLocatorConsumers(projection);
    expect(consumers.textbookSliceSelectable).toBe(false);
    expect(consumers.authoritySelectable).toBe(true);
    expect(consumers.otherTeachingResourcesSelectable).toBe(true);
    expect(consumers.registryRows).toEqual([]);
  });

  it('fails duplicate anchor rows', () => {
    const inventory = loadShippedInventory();
    const row = baseRow(inventory, {
      canonicalIds: ['ctc:fixture-canonical-a'],
      rowNumber: 1,
    });
    const dup = { ...row, rowNumber: 2, sectionKey: 'sec-other' };

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-dup-anchor',
      inventory,
      crosswalkRows: [row, dup],
      authorityCanonicalIds: new Set(['ctc:fixture-canonical-a']),
      projectionBuildId: 'build-dup',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(projection.failures.some((f) => f.code === 'duplicate-anchor')).toBe(true);
    // First row still projects; duplicate is reported.
    expect(projection.bindings.length).toBe(1);
  });

  it('fails unknown Canonical IDs', () => {
    const inventory = loadShippedInventory();
    const row = baseRow(inventory, {
      canonicalIds: ['ctc:not-in-authority'],
      rowNumber: 1,
    });

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-unknown-canonical',
      inventory,
      crosswalkRows: [row],
      authorityCanonicalIds: new Set(['ctc:other']),
      projectionBuildId: 'build-unknown',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(projection.failures.some((f) => f.code === 'unknown-canonical')).toBe(true);
    expect(projection.bindings).toEqual([]);
  });

  it('fails capture-drift rows', () => {
    const inventory = loadShippedInventory();
    const row = baseRow(inventory, {
      captureRevision: '0'.repeat(40),
      canonicalIds: ['ctc:fixture-canonical-a'],
      rowNumber: 1,
    });

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-capture-drift',
      inventory,
      crosswalkRows: [row],
      authorityCanonicalIds: new Set(['ctc:fixture-canonical-a']),
      projectionBuildId: 'build-drift',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(projection.failures.some((f) => f.code === 'capture-drift')).toBe(true);
    expect(projection.bindings).toEqual([]);
  });

  it('fails missing source anchor / document', () => {
    const inventory = loadShippedInventory();
    const missingAnchor = baseRow(inventory, {
      sourceAnchorId: 'cts:section-does-not-exist',
      canonicalIds: ['ctc:fixture-canonical-a'],
      rowNumber: 1,
    });
    const missingDoc = baseRow(inventory, {
      sourceDocumentId: 'not-a-real-book',
      canonicalIds: ['ctc:fixture-canonical-a'],
      rowNumber: 2,
    });

    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-missing-ids',
      inventory,
      crosswalkRows: [missingAnchor, missingDoc],
      authorityCanonicalIds: new Set(['ctc:fixture-canonical-a']),
      projectionBuildId: 'build-missing-ids',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    const codes = new Set(projection.failures.map((f) => f.code));
    expect(codes.has('missing-source-anchor')).toBe(true);
    expect(codes.has('missing-source-document')).toBe(true);
  });
});

describe('Consumer boundaries (#1269)', () => {
  it('exposes registry/segment/RAG rows without path eligibility or raw text', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-consumers',
      inventory,
      crosswalkRows: rows,
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, rows),
      projectionBuildId: 'build-consumers',
    });

    const consumers = projectTextbookLocatorConsumers(projection);
    expect(consumers.textbookSliceSelectable).toBe(true);
    expect(consumers.registryRows.length).toBeGreaterThan(0);
    expect(consumers.segmentBindings.length).toBeGreaterThan(0);
    expect(consumers.ragCandidates.length).toBeGreaterThan(0);

    for (const row of consumers.registryRows) {
      expect(row.pathEligible).toBe(false);
      expect(row.rawTextIncluded).toBe(false);
      expect(row.reviewDisposition).toBe('reference-governed');
    }

    for (const seg of consumers.segmentBindings) {
      expect(seg.role).toBe('EXPLAINS');
      expect(seg.sceneAvailability.path.allowed).toBe(false);
      expect(seg.citationReadiness.limitations).toContain('no-raw-textbook-body');
      expect(seg.sourceAnchorId.startsWith('cts:section-')).toBe(true);
    }

    for (const candidate of consumers.ragCandidates) {
      const provenance = textbookLocatorToRagProvenance(candidate);
      expect(provenance.rawContentAvailable).toBe(false);
      expect(provenance.citationSafe).toBe(true);
      expect(provenance.sourceDocumentId).toBeTruthy();
      expect(provenance.sourceAnchorId).toBeTruthy();
      expect(provenance.authorityReleaseHash).toBe(
        inventory.authority.authorityReleaseHash,
      );
      expect(provenance.authorizedBody).toBe(false);
    }
  });

  it('sidecar failure blocks only textbook projection; other teaching resources remain selectable', () => {
    const inventory = loadShippedInventory();
    const failedTextbook = buildTextbookLocatorProjection({
      scopeId: 'fixture-isolation',
      inventory,
      crosswalkRows: [],
      authorityCanonicalIds: new Set(),
      projectionBuildId: 'build-isolation',
    });
    expect(failedTextbook.sliceStatus).toBe('REVIEW_REQUIRED');

    const textbookAuthoring = textbookProjectionToTeachingAuthoring({
      projection: failedTextbook,
      requirePublishedSlice: true,
    });
    expect(textbookAuthoring.included).toBe(false);
    expect(textbookAuthoring.resources).toEqual([]);
    expect(textbookAuthoring.bindings).toEqual([]);

    // Non-textbook Teaching Projection still builds successfully.
    const teaching = buildTeachingProjection({
      contract: 'act-teaching-projection-authoring/v1',
      scopeId: 'fixture-isolation',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: inventory.authority.authorityReleaseId,
      authorityReleaseSetId: 'set-v012',
      authoritySnapshotHash: 'b'.repeat(64),
      resources: [
        {
          resourceType: 'step',
          lessonKey: 'lesson-iso',
          stepId: 'practice-1',
          projectionMode: 'REQUIRED',
          scopeId: 'fixture-isolation',
          title: 'Isolation practice',
        },
      ],
      bindings: [
        {
          resourceId: 'act:step:lesson-iso:practice-1',
          canonicalId: 'node-iso',
          role: 'PRACTICES',
          scopeId: 'fixture-isolation',
        },
      ],
      prerequisites: [],
      coreNodes: [
        {
          canonicalId: 'node-iso',
          pathEligible: true,
          cardPolicy: 'optional',
          scopeId: 'fixture-isolation',
        },
      ],
      cards: [],
      authorityNodes: [
        { canonicalId: 'node-iso', lifecycleStatus: 'active', successorCanonicalId: null },
        { canonicalId: 'node-unrelated', lifecycleStatus: 'active', successorCanonicalId: null },
      ],
    });

    expect(teaching.gate.passed).toBe(true);
    expect(teaching.resources.some((r) => r.resourceId === 'act:step:lesson-iso:practice-1')).toBe(
      true,
    );
    expect(teaching.bindings).toHaveLength(1);

    const consumers = projectTextbookLocatorConsumers(failedTextbook);
    expect(consumers.authoritySelectable).toBe(true);
    expect(consumers.otherTeachingResourcesSelectable).toBe(true);
    expect(consumers.textbookSliceSelectable).toBe(false);
  });

  it('merges published textbook slice into Teaching Projection authoring shape', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk().slice(0, 1);
    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-merge',
      inventory,
      crosswalkRows: rows,
      authorityCanonicalIds: authorityCanonicalIdsFromProjection(inventory, rows),
      projectionBuildId: 'build-merge',
    });
    const authoring = textbookProjectionToTeachingAuthoring({
      projection,
      requirePublishedSlice: true,
    });
    expect(authoring.included).toBe(true);
    expect(authoring.resources.some((r) => r.resourceType === 'textbook')).toBe(true);
    expect(authoring.resources.some((r) => r.resourceType === 'textbook-section')).toBe(true);
    expect(authoring.bindings.every((b) => b.role === 'EXPLAINS')).toBe(true);

    const teaching = buildTeachingProjection({
      contract: 'act-teaching-projection-authoring/v1',
      scopeId: 'fixture-merge',
      authoringRevision: 'c'.repeat(40),
      authorityReleaseId: inventory.authority.authorityReleaseId,
      authoritySnapshotHash: 'd'.repeat(64),
      resources: authoring.resources.map((r) => ({
        ...r,
        projectionMode: 'OPTIONAL' as const,
      })),
      bindings: authoring.bindings,
      prerequisites: [],
      coreNodes: authoring.bindings.map((b) => ({
        canonicalId: b.canonicalId,
        pathEligible: false,
        cardPolicy: 'none' as const,
        scopeId: 'fixture-merge',
      })),
      cards: [],
      authorityNodes: authoring.bindings.map((b) => ({
        canonicalId: b.canonicalId,
        lifecycleStatus: 'active',
        successorCanonicalId: null,
      })),
    });

    expect(teaching.gate.passed).toBe(true);
    expect(teaching.bindings.every((b) => b.role === 'EXPLAINS')).toBe(true);
    expect(
      teaching.resources
        .filter((r) => r.resourceType === 'textbook' || r.resourceType === 'textbook-section')
        .every((r) => r.projectionMode === 'OPTIONAL'),
    ).toBe(true);
  });
});

describe('Inventory parse guards (#1269)', () => {
  it('parses stubs through the shipped public component without inventing books', () => {
    const inventory = loadShippedInventory();
    const stubsPath = path.join(
      REPO_ROOT,
      inventory.authority.sourceInventory.componentPath,
    );
    const stubsPayload = JSON.parse(readFileSync(stubsPath, 'utf8')) as unknown;
    const reparsed = parseActkgSourceLocatorStubs({
      stubsPayload,
      authority: cloneAuthority(inventory.authority),
    });
    expect(reparsed.sourceDocuments.map((d) => d.sourceDocumentId)).toEqual(
      inventory.sourceDocuments.map((d) => d.sourceDocumentId),
    );
    expect(reparsed.sourceAnchors.length).toBe(inventory.sourceAnchors.length);
  });
});

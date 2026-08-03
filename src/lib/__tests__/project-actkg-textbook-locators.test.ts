/**
 * ActKG textbook locator projection (#1269 / project-actkg-textbook-locators).
 *
 * Exercises shipped inventory, crosswalk, builder, and consumer functions.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertSourceInventoryFileIdentity,
  buildTeachingProjection,
  buildTextbookLocatorProjection,
  deriveTextbookChapterResourceId,
  deriveTextbookExplainsBindingId,
  deriveTextbookResourceId,
  deriveTextbookSectionResourceId,
  loadActkgSourceLocatorInventory,
  loadAndBuildTextbookLocatorProjection,
  loadAuthorityCanonicalIdsFromSnapshot,
  loadSourceResourceCrosswalk,
  loadV012BundleIdentity,
  parseActkgSourceLocatorStubs,
  parseSourceResourceCrosswalkText,
  projectTextbookLocatorConsumers,
  recomputeBundleDigest,
  textbookLocatorToRagProvenance,
  textbookProjectionToTeachingAuthoring,
  type ActkgSourceLocatorInventory,
  type SourceResourceCrosswalkRow,
  type TextbookLocatorAuthorityBinding,
  TextbookLocatorInventoryError,
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

  it('load→project boundary converts missing/unreadable/invalid sidecar into REVIEW_REQUIRED', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'tbloc-sidecar-'));
    const missingPath = path.join(tempDir, 'does-not-exist.jsonl');
    const emptyPath = path.join(tempDir, 'empty.jsonl');
    const invalidPath = path.join(tempDir, 'invalid.jsonl');
    writeFileSync(emptyPath, '   \n', 'utf8');
    writeFileSync(invalidPath, '{not-valid-json\n', 'utf8');

    for (const [label, crosswalkPath, expectedCode] of [
      ['missing', missingPath, 'missing-crosswalk'],
      ['empty', emptyPath, 'missing-crosswalk'],
      ['invalid-json', invalidPath, 'schema-invalid'],
    ] as const) {
      const projection = loadAndBuildTextbookLocatorProjection({
        scopeId: `fixture-boundary-${label}`,
        repoRoot: REPO_ROOT,
        crosswalkPath,
        projectionBuildId: `build-boundary-${label}`,
      });
      expect(projection.sliceStatus, label).toBe('REVIEW_REQUIRED');
      expect(projection.blocksTextbookSliceOnly, label).toBe(true);
      expect(projection.resources, label).toEqual([]);
      expect(projection.bindings, label).toEqual([]);
      expect(
        projection.failures.some((f) => f.code === expectedCode),
        `${label} expected ${expectedCode}`,
      ).toBe(true);

      const consumers = projectTextbookLocatorConsumers(projection);
      expect(consumers.textbookSliceSelectable, label).toBe(false);
      expect(consumers.authoritySelectable, label).toBe(true);
      expect(consumers.otherTeachingResourcesSelectable, label).toBe(true);
    }
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

  it('defaults to refusing merge of unpublished / partial textbook slices', () => {
    const inventory = loadShippedInventory();
    // One valid row + one unknown-Canonical row → REVIEW_REQUIRED with partial resources.
    const good = baseRow(inventory, {
      canonicalIds: ['ctc:fixture-canonical-a'],
      rowNumber: 1,
    });
    const bad = baseRow(inventory, {
      sourceAnchorId: inventory.sourceAnchors[1]!.sourceAnchorId,
      sourceDocumentId: inventory.sourceAnchors[1]!.sourceDocumentId,
      canonicalIds: ['ctc:not-in-authority'],
      rowNumber: 2,
    });
    const projection = buildTextbookLocatorProjection({
      scopeId: 'fixture-partial-refuse',
      inventory,
      crosswalkRows: [good, bad],
      authorityCanonicalIds: new Set(['ctc:fixture-canonical-a']),
      projectionBuildId: 'build-partial-refuse',
    });
    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(projection.resources.length).toBeGreaterThan(0);
    expect(projection.failures.some((f) => f.code === 'unknown-canonical')).toBe(true);

    // Safe default: omit requirePublishedSlice → fail closed, no partial merge.
    const defaultMerge = textbookProjectionToTeachingAuthoring({ projection });
    expect(defaultMerge.included).toBe(false);
    expect(defaultMerge.resources).toEqual([]);
    expect(defaultMerge.bindings).toEqual([]);
    expect(defaultMerge.reason).toMatch(/REVIEW_REQUIRED|blocked/i);

    // Explicit force still allowed for review/debug only.
    const forced = textbookProjectionToTeachingAuthoring({
      projection,
      requirePublishedSlice: false,
    });
    expect(forced.included).toBe(true);
    expect(forced.resources.length).toBeGreaterThan(0);
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

    // Default fail-closed (no requirePublishedSlice flag required).
    const textbookAuthoring = textbookProjectionToTeachingAuthoring({
      projection: failedTextbook,
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

  it('validates inventory file identity against authority binding before labeling Authority', () => {
    const inventory = loadShippedInventory();
    const boundPath = inventory.authority.sourceInventory.componentPath;
    // Happy path already exercised by loadShippedInventory; assert path pin.
    expect(boundPath.length).toBeGreaterThan(0);
    expect(inventory.authority.sourceInventory.componentReleaseHash).toMatch(/^[a-f0-9]{64}$/u);

    // Wrong path (different file) fail closed — never label as current Authority.
    const wrongPath = path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/teaching-projection/textbook-locators/authority-binding.json',
    );
    expect(() =>
      loadActkgSourceLocatorInventory({
        repoRoot: REPO_ROOT,
        stubsPath: wrongPath,
      }),
    ).toThrow(TextbookLocatorInventoryError);

    try {
      loadActkgSourceLocatorInventory({
        repoRoot: REPO_ROOT,
        stubsPath: wrongPath,
      });
      expect.unreachable('expected inventory identity mismatch');
    } catch (error) {
      expect(error).toBeInstanceOf(TextbookLocatorInventoryError);
      expect((error as TextbookLocatorInventoryError).code).toBe(
        'inventory-identity-mismatch',
      );
    }

    // Synthetic binding + stubs whose componentReleaseHash is not in the v0.12
    // bundle pin → fail closed (do not label as current Authority inventory).
    const tempDir = mkdtempSync(path.join(tmpdir(), 'tbloc-inv-'));
    const fakeRelative = 'fake-stubs/root-locus.json';
    const fakeAbs = path.join(tempDir, fakeRelative);
    mkdirSync(path.dirname(fakeAbs), { recursive: true });
    writeFileSync(
      fakeAbs,
      JSON.stringify({
        release_hash: '0'.repeat(64),
        evidence_segment_stubs: [],
        source_object_stubs: [],
      }),
      'utf8',
    );
    const fakeBindingPath = path.join(tempDir, 'authority-binding.json');
    writeFileSync(
      fakeBindingPath,
      JSON.stringify({
        ...inventory.authority,
        sourceInventory: {
          ...inventory.authority.sourceInventory,
          componentPath: fakeRelative,
          componentReleaseHash: '0'.repeat(64),
        },
      }),
      'utf8',
    );

    // Binding pin itself drifts from the real v0.12 bundle → fail closed.
    expect(() =>
      loadActkgSourceLocatorInventory({
        repoRoot: tempDir,
        authorityBindingPath: fakeBindingPath,
        stubsPath: fakeAbs,
        bundleManifestPath: path.join(
          REPO_ROOT,
          'course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/bundle-manifest.json',
        ),
      }),
    ).toThrow(/inventory-identity-mismatch|Authority pin|component/i);

    // Boundary maps inventory identity failure to textbook-slice REVIEW_REQUIRED.
    const failed = loadAndBuildTextbookLocatorProjection({
      scopeId: 'fixture-inv-identity',
      repoRoot: tempDir,
      authorityBindingPath: fakeBindingPath,
      stubsPath: fakeAbs,
      bundleManifestPath: path.join(
        REPO_ROOT,
        'course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/bundle-manifest.json',
      ),
      crosswalkPath: path.join(
        REPO_ROOT,
        'course-content/authoring/knowledge/teaching-projection/textbook-locators/source-resource-crosswalk.jsonl',
      ),
      projectionBuildId: 'build-inv-identity',
    });
    expect(failed.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(failed.resources).toEqual([]);
    expect(
      failed.failures.some(
        (f) => f.code === 'inventory-identity-mismatch' || f.code === 'schema-invalid',
      ),
    ).toBe(true);
    expect(failed.blocksTextbookSliceOnly).toBe(true);
  });

  it('rejects forged bundle manifests whose self-reported bundle_digest is not recomputable', () => {
    const inventory = loadShippedInventory();
    const stubsRelative = inventory.authority.sourceInventory.componentPath;
    const stubsSrc = path.join(REPO_ROOT, stubsRelative);
    const manifestSrc = path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/bundle-manifest.json',
    );

    const tempDir = mkdtempSync(path.join(tmpdir(), 'tbloc-digest-'));
    const stubsAbs = path.join(tempDir, stubsRelative);
    mkdirSync(path.dirname(stubsAbs), { recursive: true });

    // Inject a synthetic anchor into stubs; recompute only the component raw sha.
    const stubsPayload = JSON.parse(readFileSync(stubsSrc, 'utf8')) as Record<string, unknown>;
    const segments = Array.isArray(stubsPayload.evidence_segment_stubs)
      ? [...(stubsPayload.evidence_segment_stubs as unknown[])]
      : [];
    segments.push({
      id: 'cts:section-forged-anchor-p1',
      source_edition_id: 'dorf-modern-control-systems-14th-root-locus',
      content_hash: 'a'.repeat(64),
      segment_type: 'section',
    });
    stubsPayload.evidence_segment_stubs = segments;
    const stubsBytes = Buffer.from(`${JSON.stringify(stubsPayload)}\n`, 'utf8');
    writeFileSync(stubsAbs, stubsBytes);

    const forgedRawSha = createHash('sha256').update(stubsBytes).digest('hex');
    const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8')) as Record<string, unknown>;
    const originalDigest = String(manifest.bundle_digest);
    const components = Array.isArray(manifest.components)
      ? (manifest.components as Array<Record<string, unknown>>)
      : [];
    const component = components.find(
      (entry) => entry.release_id === inventory.authority.sourceInventory.componentReleaseId,
    );
    expect(component).toBeTruthy();
    component!.release_raw_sha256 = forgedRawSha;
    // Keep the original self-reported digest (the P1 bypass).
    manifest.bundle_digest = originalDigest;
    expect(recomputeBundleDigest(manifest)).not.toBe(originalDigest);

    const forgedManifestPath = path.join(tempDir, 'forged-bundle-manifest.json');
    writeFileSync(forgedManifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');

    const bindingPath = path.join(tempDir, 'authority-binding.json');
    writeFileSync(
      bindingPath,
      JSON.stringify({
        ...inventory.authority,
        sourceInventory: {
          ...inventory.authority.sourceInventory,
          componentPath: stubsRelative,
        },
      }),
      'utf8',
    );

    expect(() =>
      assertSourceInventoryFileIdentity({
        repoRoot: tempDir,
        authority: {
          ...inventory.authority,
          sourceInventory: {
            ...inventory.authority.sourceInventory,
            componentPath: stubsRelative,
          },
        },
        stubsPath: stubsAbs,
        stubsBytes,
        stubsPayload,
        bundleManifestPath: forgedManifestPath,
      }),
    ).toThrow(/bundle_digest mismatch|inventory-identity-mismatch/i);

    expect(() =>
      loadActkgSourceLocatorInventory({
        repoRoot: tempDir,
        authorityBindingPath: bindingPath,
        stubsPath: stubsAbs,
        bundleManifestPath: forgedManifestPath,
      }),
    ).toThrow(TextbookLocatorInventoryError);

    // Shipped happy path still recomputes cleanly.
    const shippedManifest = JSON.parse(readFileSync(manifestSrc, 'utf8')) as Record<string, unknown>;
    expect(recomputeBundleDigest(shippedManifest)).toBe(String(shippedManifest.bundle_digest));
  });
});

describe('Authority Canonical membership (#1281 P1)', () => {
  it('does not treat crosswalk-declared IDs as Authority when authorityCanonicalIds is omitted', () => {
    const inventory = loadShippedInventory();
    const rows = loadShippedCrosswalk();
    const base = rows[0]!;
    const unknownId = 'ctc:not-in-authority-p1-unknown';

    const tempDir = mkdtempSync(path.join(tmpdir(), 'tbloc-canon-'));
    const crosswalkPath = path.join(tempDir, 'source-resource-crosswalk.jsonl');
    // First Canonical is unknown; remaining stay from shipped row so the file is otherwise valid.
    const forgedRow = {
      ...base,
      canonicalIds: [unknownId, ...base.canonicalIds],
    };
    writeFileSync(crosswalkPath, `${JSON.stringify(forgedRow)}\n`, 'utf8');

    // Omitted authorityCanonicalIds must load the fixed Authority snapshot — not the crosswalk.
    const projection = loadAndBuildTextbookLocatorProjection({
      scopeId: 'fixture-unknown-canonical-boundary',
      repoRoot: REPO_ROOT,
      crosswalkPath,
      projectionBuildId: 'build-unknown-boundary',
    });

    expect(projection.sliceStatus).toBe('REVIEW_REQUIRED');
    expect(
      projection.failures.some(
        (f) => f.code === 'unknown-canonical' && f.canonicalId === unknownId,
      ),
    ).toBe(true);
    // Unknown ID must never produce a binding that would merge into Teaching Projection.
    expect(projection.bindings.every((b) => b.canonicalId !== unknownId)).toBe(true);
    expect(projection.blocksTextbookSliceOnly).toBe(true);

    const merged = textbookProjectionToTeachingAuthoring({ projection });
    expect(merged.included).toBe(false);
    expect(merged.bindings).toEqual([]);
  });

  it('loads Canonical IDs from the fixed Authority release snapshot', () => {
    const inventory = loadShippedInventory();
    const ids = loadAuthorityCanonicalIdsFromSnapshot({
      repoRoot: REPO_ROOT,
      authority: inventory.authority,
    });
    expect(ids.size).toBeGreaterThan(1000);
    // Shipped crosswalk endpoints must be present in the pinned Authority snapshot.
    for (const row of loadShippedCrosswalk()) {
      for (const id of row.canonicalIds) {
        expect(ids.has(id)).toBe(true);
      }
    }
    expect(ids.has('ctc:not-in-authority-p1-unknown')).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  EXTRACTION_SOURCE_BOOKS,
  planRuntimeFullBinding,
} from '@/lib/teaching-projection/runtime-full-binding';
import {
  loadSourceResourceCrosswalkMixed,
  parseSourceResourceCrosswalkLine,
  parseSourceResourceCrosswalkLineV2,
} from '@/lib/teaching-projection/textbook-locators/crosswalk';
import {
  TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2,
} from '@/lib/teaching-projection/textbook-locators/contracts';

const RELEASE_V037 = 'ctr:release:control-theory-engineering-v0.37';

function planWith(locatorsV2: Parameters<typeof planRuntimeFullBinding>[0]['textbookLocatorsV2']) {
  return planRuntimeFullBinding({
    scopeId: 'act-control-theory',
    authoringRevision: 'a'.repeat(40),
    authorityReleaseId: RELEASE_V037,
    overlayCores: ['ctc:core-a'],
    nodeUnits: new Map(),
    resources: [],
    bindings: [],
    prerequisites: [],
    cards: [],
    authorityCardCanonicalIds: [],
    authorityCanonicalIds: ['ctc:core-a', 'ctc:authority-only'],
    authorityIdentityPin: {
      authorityReleaseId: RELEASE_V037,
      authorityReleaseHash: 'h'.repeat(64),
      bundleDigest: 'b'.repeat(64),
      captureRevision: 'c'.repeat(40),
    },
    textbookLocators: [],
    textbookLocatorsV2: locatorsV2,
    taskSims: [],
  });
}

const V2_ROW = {
  sourceDocumentId: EXTRACTION_SOURCE_BOOKS[0],
  bookId: 'dorf-modern-control-systems',
  edition: '14th Global Edition',
  structuralUnitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-04',
  structuralPath: ['chapter-chapter-04'],
  canonicalIds: ['ctc:core-a'],
  authorityReleaseId: RELEASE_V037,
  authorityReleaseHash: 'h'.repeat(64),
  bundleDigest: 'b'.repeat(64),
  captureRevision: 'c'.repeat(40),
  accessMode: 'REFERENCE_ONLY',
};

describe('v2 structural-unit crosswalk parsing', () => {
  it('parses a v2 row with sorted canonical ids', () => {
    const row = parseSourceResourceCrosswalkLineV2(JSON.stringify({
      contract: TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2,
      ...V2_ROW,
      canonicalIds: ['ctc:b', 'ctc:a', 'ctc:a'],
    }), 1);
    expect(row.canonicalIds).toEqual(['ctc:a', 'ctc:b']);
    expect(row.structuralPath).toEqual(['chapter-chapter-04']);
  });

  it('rejects v2 rows missing v2 coordinates or carrying body text', () => {
    const base = { contract: TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2, ...V2_ROW };
    expect(() =>
      parseSourceResourceCrosswalkLineV2(JSON.stringify({ ...base, structuralUnitId: '' }), 1),
    ).toThrow(/structuralUnitId/);
    expect(() =>
      parseSourceResourceCrosswalkLineV2(JSON.stringify({ ...base, quote: '正文' }), 1),
    ).toThrow(/forbidden/);
    expect(() =>
      parseSourceResourceCrosswalkLineV2(JSON.stringify({ ...V2_ROW }), 1),
    ).toThrow(/contract/);
  });

  it('mixed text split keeps v1 rows parseable and separates v2 rows', () => {
    const v1Line = JSON.stringify({
      sourceDocumentId: EXTRACTION_SOURCE_BOOKS[0],
      sourceAnchorId: 'cts:section-abc',
      chapterKey: 'ch-root-locus-01',
      sectionKey: 'sec-abc',
      pageStart: null,
      pageEnd: null,
      canonicalIds: ['ctc:core-a'],
      accessMode: 'REFERENCE_ONLY',
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.12',
      authorityReleaseHash: 'h'.repeat(64),
      bundleDigest: 'b'.repeat(64),
      captureRevision: 'c'.repeat(40),
    });
    const v2Line = JSON.stringify({
      contract: TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2,
      ...V2_ROW,
      accessMode: 'REFERENCE_ONLY',
    });
    const parsed = parseMixedText(`${v1Line}\n${v2Line}`);
    expect(parsed.v1).toHaveLength(1);
    expect(parsed.v2).toHaveLength(1);
    expect(parsed.v2[0]).toMatchObject({ bookId: 'dorf-modern-control-systems' });
  });

  it('loads the real sidecar without error (6 v1 rows today)', () => {
    const mixed = loadSourceResourceCrosswalkMixed();
    expect(mixed.v1.length).toBeGreaterThan(0);
    for (const row of mixed.v2) {
      expect(row.contract).toBe(TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2);
    }
  });
});

// Local mirror of the mixed loader's text split to exercise both parsers.
function parseMixedText(text: string) {
  const lines = text.split('\n');
  const v1Lines: string[] = [];
  const v2: ReturnType<typeof parseSourceResourceCrosswalkLineV2>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line) continue;
    const isV2 = line.includes(`"contract":"${TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2}"`);
    if (isV2) v2.push(parseSourceResourceCrosswalkLineV2(line, index + 1));
    else v1Lines.push(line);
  }
  return {
    v1: v1Lines.map((line, index) => parseSourceResourceCrosswalkLine(line, index + 1)),
    v2,
  };
}

describe('runtime full binding v2 textbook channel', () => {
  it('projects governed v2 rows into textbook resources and EXPLAINS bindings', () => {
    const plan = planWith([V2_ROW]);
    const sectionId = 'act:textbook-section:dorf-modern-control-systems.chapter-chapter-04';
    expect(plan.authoring.resources.some((row) => row.resourceId === sectionId)).toBe(true);
    expect(plan.authoring.resources.some((row) =>
      row.resourceId === `act:textbook:${EXTRACTION_SOURCE_BOOKS[0]}`)).toBe(true);
    expect(plan.authoring.bindings).toContainEqual(expect.objectContaining({
      resourceId: sectionId,
      canonicalId: 'ctc:core-a',
      role: 'EXPLAINS',
    }));
    expect(plan.ledger).toHaveLength(0);
  });

  it('fails v2 rows whose identity hash diverges from the pinned bundle', () => {
    const plan = planWith([{ ...V2_ROW, authorityReleaseHash: '1'.repeat(64) }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'stale-authority-binding',
    }));
    expect(plan.authoring.bindings.filter((row) => row.canonicalId === 'ctc:core-a')).toHaveLength(0);
  });

  it('ledgers each unknown canonical on a mixed v2 row and still binds authority-known endpoints', () => {
    const plan = planWith([{ ...V2_ROW, canonicalIds: ['ctc:core-a', 'ctc:not-in-release'] }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'unknown-canonical',
      detail: 'ctc:not-in-release',
    }));
    expect(plan.authoring.bindings).toContainEqual(expect.objectContaining({
      canonicalId: 'ctc:core-a',
      role: 'EXPLAINS',
    }));
  });

  it('fails v2 rows bound to a superseded release into the exception ledger', () => {
    const plan = planWith([{ ...V2_ROW, authorityReleaseId: 'ctr:release:control-theory-engineering-v0.12' }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'stale-authority-binding',
    }));
    expect(plan.authoring.bindings.filter((row) => row.canonicalId === 'ctc:core-a')).toHaveLength(0);
  });

  it('ledgers v2 rows whose canonical endpoints are unknown in the pinned release', () => {
    const plan = planWith([{ ...V2_ROW, canonicalIds: ['ctc:not-in-release'] }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'unknown-canonical',
    }));
  });

  it('binds authority-known endpoints even when they sit outside overlay cores', () => {
    const plan = planWith([{ ...V2_ROW, canonicalIds: ['ctc:authority-only'] }]);
    expect(plan.ledger).toHaveLength(0);
    expect(plan.authoring.bindings).toContainEqual(expect.objectContaining({
      canonicalId: 'ctc:authority-only',
      role: 'EXPLAINS',
    }));
  });

  it('ledgers v2 rows whose book identity diverges from the alias table', () => {
    const plan = planWith([{ ...V2_ROW, bookId: 'not-the-aliased-book' }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'out-of-round-textbook',
      detail: 'book-id-mismatch:not-the-aliased-book',
    }));
    expect(plan.authoring.bindings).toHaveLength(0);
  });

  it('ledgers v2 rows whose structural unit fails the restage coordinate check', () => {
    const plan = planRuntimeFullBinding({
      scopeId: 'act-control-theory',
      authoringRevision: 'a'.repeat(40),
      authorityReleaseId: RELEASE_V037,
      overlayCores: ['ctc:core-a'],
      nodeUnits: new Map(),
      resources: [],
      bindings: [],
      prerequisites: [],
      cards: [],
      authorityCardCanonicalIds: [],
      authorityCanonicalIds: ['ctc:core-a', 'ctc:authority-only'],
      authorityIdentityPin: {
        authorityReleaseId: RELEASE_V037,
        authorityReleaseHash: 'h'.repeat(64),
        bundleDigest: 'b'.repeat(64),
        captureRevision: 'c'.repeat(40),
      },
      textbookLocators: [],
      textbookLocatorsV2: [V2_ROW],
      textbookCoordinateCheck: () => 'coordinate-unresolved:missing-unit',
      taskSims: [],
    });
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'stale-authority-binding',
      detail: 'coordinate-unresolved:missing-unit',
    }));
    expect(plan.authoring.bindings).toHaveLength(0);
  });

  it('ledgers v2 rows for books outside the three extraction sources', () => {
    const plan = planWith([{ ...V2_ROW, sourceDocumentId: 'control-encyclopedia', bookId: 'control-encyclopedia' }]);
    expect(plan.ledger).toContainEqual(expect.objectContaining({
      reason: 'out-of-round-textbook',
    }));
  });
});

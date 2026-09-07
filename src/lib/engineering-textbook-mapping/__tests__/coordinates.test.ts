import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  EngineeringTextbookMappingError,
  loadStructuralUnitIndex,
  resolveStructuralUnit,
} from '@/lib/engineering-textbook-mapping';
import { buildTextbookReaderHref } from '@/lib/textbook-reader';

/**
 * Self-contained structural-unit fixtures (#2043 review finding): the real
 * textbooks-v2 runtime is untracked external state, so tests must not read
 * it — coordinates resolve against a temp units.jsonl instead.
 */
const DORF_UNIT = {
  id: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-01',
  bookId: 'dorf-modern-control-systems',
  edition: '14th Global Edition',
  chapterId: 'chapter-01',
  structuralPath: ['chapter-chapter-01'],
  parentId: null,
  ancestorIds: [],
  level: 1,
  kind: 'chapter',
  naturalNumber: 'chapter-01',
  title: 'chapter-chapter-01',
  markdown: '',
  sourceSpan: { startLine: 1, endLine: 2 },
  fragmentAnchorIds: [],
};
const DORF_SECTION = {
  ...DORF_UNIT,
  id: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-01/section-1.1',
  structuralPath: ['chapter-chapter-01', 'section-1.1'],
  kind: 'section',
  naturalNumber: '1.1',
  title: 'INTRODUCTION',
};
const HU_UNIT = {
  ...DORF_UNIT,
  id: 'textbook-unit:hu-shousong-auto-control-8th@di-ba-ban/chapter-chapter-01',
  bookId: 'hu-shousong-auto-control-8th',
  edition: '第八版',
  structuralPath: ['chapter-chapter-01'],
};

async function fixtureIndex() {
  const dir = mkdtempSync(path.join(tmpdir(), 'structural-units-'));
  for (const [bookId, units] of [
    ['dorf-modern-control-systems', [DORF_UNIT, DORF_SECTION]],
    ['hu-shousong-auto-control-8th', [HU_UNIT]],
  ] as const) {
    const bookDir = path.join(dir, bookId);
    mkdirSync(bookDir, { recursive: true });
    writeFileSync(
      path.join(bookDir, 'units.jsonl'),
      units.map((unit) => JSON.stringify(unit)).join('\n') + '\n',
    );
  }
  try {
    return await loadStructuralUnitIndex({
      runtimeRoot: dir,
      bookIds: ['dorf-modern-control-systems', 'hu-shousong-auto-control-8th'],
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('structural-unit coordinate resolution', () => {
  it('resolves v2 units and builds reader hrefs on the same URL system', async () => {
    const index = await fixtureIndex();
    expect(index.unitCount).toBe(3);
    const unit = resolveStructuralUnit(index, {
      bookId: 'dorf-modern-control-systems',
      structuralUnitId: DORF_UNIT.id,
    });
    expect(unit.structuralPath).toEqual(['chapter-chapter-01']);
    // Coordinates feed the unified reader href — the same URL system the
    // hybrid retrieval index and the in-app reader resolve (#2043 task 3.3).
    expect(buildTextbookReaderHref({
      bookId: unit.bookId,
      edition: unit.edition,
      unitPath: unit.structuralPath,
    })).toBe('/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-01');
  });

  it('resolves by structural path when the unit id is absent', async () => {
    const index = await fixtureIndex();
    const unit = resolveStructuralUnit(index, {
      bookId: 'hu-shousong-auto-control-8th',
      structuralPath: ['chapter-chapter-01'],
    });
    expect(unit.bookId).toBe('hu-shousong-auto-control-8th');
  });

  it('fails closed for coordinates that do not resolve', async () => {
    const index = await fixtureIndex();
    expect(() =>
      resolveStructuralUnit(index, {
        bookId: 'dorf-modern-control-systems',
        structuralUnitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-does-not-exist',
      }),
    ).toThrow(EngineeringTextbookMappingError);
    expect(() =>
      resolveStructuralUnit(index, {
        bookId: 'dorf-modern-control-systems',
        structuralUnitId: HU_UNIT.id,
      }),
    ).toThrow(EngineeringTextbookMappingError);
  });
});

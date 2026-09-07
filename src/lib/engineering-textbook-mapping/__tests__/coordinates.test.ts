import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  EngineeringTextbookMappingError,
  loadStructuralUnitIndex,
  resolveStructuralUnit,
} from '@/lib/engineering-textbook-mapping';
import { buildTextbookReaderHref } from '@/lib/textbook-reader';

const RUNTIME_ROOT = 'course-content/runtime/resources/textbooks-v2';
const SOURCE_BOOKS = [
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-8th',
] as const;

describe('structural-unit coordinate resolution', () => {
  it('resolves real v2 units and builds reader hrefs on the same URL system', async () => {
    const index = await loadStructuralUnitIndex({
      runtimeRoot: RUNTIME_ROOT,
      bookIds: SOURCE_BOOKS,
    });
    expect(index.unitCount).toBeGreaterThan(3000);
    const unit = resolveStructuralUnit(index, {
      bookId: 'dorf-modern-control-systems',
      structuralUnitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-01',
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
    const index = await loadStructuralUnitIndex({
      runtimeRoot: RUNTIME_ROOT,
      bookIds: SOURCE_BOOKS,
    });
    const unit = resolveStructuralUnit(index, {
      bookId: 'hu-shousong-auto-control-8th',
      structuralPath: ['chapter-chapter-01'],
    });
    expect(unit.bookId).toBe('hu-shousong-auto-control-8th');
  });

  it('fails closed for coordinates that do not resolve', async () => {
    const index = await loadStructuralUnitIndex({
      runtimeRoot: RUNTIME_ROOT,
      bookIds: SOURCE_BOOKS,
    });
    expect(() =>
      resolveStructuralUnit(index, {
        bookId: 'dorf-modern-control-systems',
        structuralUnitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-does-not-exist',
      }),
    ).toThrow(EngineeringTextbookMappingError);
    expect(() =>
      resolveStructuralUnit(index, {
        bookId: 'dorf-modern-control-systems',
        structuralUnitId: 'textbook-unit:hu-shousong-auto-control-8th@di-ba-ban/chapter-chapter-01',
      }),
    ).toThrow(EngineeringTextbookMappingError);
  });
});

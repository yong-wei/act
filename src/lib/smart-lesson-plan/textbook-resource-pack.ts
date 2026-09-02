import { z } from 'zod';

import {
  loadAllStructuredTextbookBooks,
  STRUCTURED_TEXTBOOK_TITLES,
  type StructuredTextbookBook,
  type StructuredTextbookUnit,
} from '@/lib/course-bundle';
import {
  retrieveTextbookSourcePackV2,
  type TextbookV2ToolCandidate,
} from '@/lib/source-pack/textbook-v2-adapter';
import type { TextbookRetrievalScope } from '@/lib/textbook-retrieval';

import { contentHash, type SmartLessonSourceBinding } from './domain';
import {
  confirmedTextbookRangeSchema,
  type ConfirmedTextbookRange,
} from './textbook-range';

export { confirmedTextbookRangeSchema };
export type { ConfirmedTextbookRange };

export type SmartPreparationTextbookCatalog = Array<{
  bookId: string;
  title: string;
  edition: string;
  ranges: Array<{
    level: 'CHAPTER' | 'SECTION';
    unitId: string;
    title: string;
    naturalNumber: string | null;
    structuralPath: string[];
  }>;
}>;

export async function loadSmartPreparationTextbookCatalog() {
  return buildSmartPreparationTextbookCatalog(await loadAllStructuredTextbookBooks());
}

export function buildSmartPreparationTextbookCatalog(
  books: StructuredTextbookBook[],
): SmartPreparationTextbookCatalog {
  return books.map((book) => ({
    bookId: book.manifest.bookId,
    title: STRUCTURED_TEXTBOOK_TITLES[book.manifest.bookId] ?? book.manifest.bookId,
    edition: book.manifest.edition,
    ranges: book.units
      .filter((unit) => unit.kind === 'chapter' || unit.kind === 'section')
      .map((unit) => ({
        level: unit.kind === 'chapter' ? 'CHAPTER' as const : 'SECTION' as const,
        unitId: unit.id,
        title: unit.title,
        naturalNumber: unit.naturalNumber,
        structuralPath: [...unit.structuralPath],
      })),
  }));
}

export async function validateConfirmedTextbookRanges(
  ranges: ConfirmedTextbookRange[],
): Promise<ConfirmedTextbookRange[]> {
  const parsed = z.array(confirmedTextbookRangeSchema).max(20).parse(ranges);
  if (parsed.length === 0) return [];
  const books = await loadAllStructuredTextbookBooks();
  const byId = new Map(books.map((book) => [book.manifest.bookId, book]));
  return parsed.map((range) => {
    const book = byId.get(range.bookId);
    if (!book) throw new TypeError('textbook-range-book-not-found');
    if (range.level === 'BOOK') return range;
    const unit = book.units.find((candidate) => candidate.id === range.unitId);
    if (!unit || !rangeMatchesUnit(range, unit)) throw new TypeError('textbook-range-unit-not-found');
    return range;
  });
}

export async function retrieveConfirmedTextbookBindings(
  query: string,
  ranges: ConfirmedTextbookRange[],
): Promise<SmartLessonSourceBinding[]> {
  if (ranges.length === 0) return [];
  const scope = await buildConfirmedTextbookRetrievalScope(ranges);
  const result = await retrieveTextbookSourcePackV2({
    query,
    topK: 8,
    maxTextChars: 340,
    scope,
  });
  return result.candidates
    .filter((candidate) => ranges.some((range) => rangeMatchesCandidate(range, candidate)))
    .slice(0, 8)
    .map(textbookCandidateBinding);
}

export async function buildConfirmedTextbookRetrievalScope(
  ranges: ConfirmedTextbookRange[],
): Promise<TextbookRetrievalScope[]> {
  const books = await loadAllStructuredTextbookBooks();
  const booksById = new Map(books.map((book) => [book.manifest.bookId, book]));
  const scopedUnitIds = new Map<string, Set<string> | null>();
  for (const range of ranges) {
    if (range.level === 'BOOK') {
      scopedUnitIds.set(range.bookId, null);
      continue;
    }
    if (scopedUnitIds.get(range.bookId) === null) continue;
    const unitIds = scopedUnitIds.get(range.bookId) ?? new Set<string>();
    const book = booksById.get(range.bookId);
    for (const unit of book?.units ?? []) {
      if (range.structuralPath.every((segment, index) => unit.structuralPath[index] === segment)) {
        unitIds.add(unit.id);
      }
    }
    scopedUnitIds.set(range.bookId, unitIds);
  }
  return [...scopedUnitIds].map(([bookId, unitIds]) => ({
    bookId,
    ...(unitIds === null ? {} : { unitIds: [...unitIds] }),
  }));
}

export function isTextbookSourceBinding(binding: Pick<SmartLessonSourceBinding, 'sourceVersionId'>) {
  return binding.sourceVersionId.startsWith('textbook-v2:');
}

export function textbookCandidateBinding(
  candidate: TextbookV2ToolCandidate,
): SmartLessonSourceBinding {
  const { identity } = candidate;
  return {
    sourceKind: 'textbook',
    sourceVersionId: [
      'textbook-v2',
      identity.bookId,
      identity.edition,
      identity.sourceRevision,
    ].join(':'),
    citationId: `textbook-v2:${identity.kind}:${identity.fragmentId ?? identity.unitId}`,
    anchor: identity.fragmentId ?? identity.unitId,
    contentHash: contentHash(candidate.text),
    title: candidate.title,
    structuralPath: [...identity.structuralPath],
    snippet: candidate.text,
    href: candidate.href,
  };
}

export function rangeMatchesCandidate(
  range: ConfirmedTextbookRange,
  candidate: TextbookV2ToolCandidate,
) {
  if (candidate.identity.bookId !== range.bookId) return false;
  if (range.level === 'BOOK') return true;
  return range.structuralPath.every((segment, index) => (
    candidate.identity.structuralPath[index] === segment
  ));
}

function rangeMatchesUnit(range: ConfirmedTextbookRange, unit: StructuredTextbookUnit) {
  if (unit.bookId !== range.bookId || unit.id !== range.unitId) return false;
  if (range.level === 'CHAPTER' && unit.kind !== 'chapter') return false;
  if (range.level === 'SECTION' && unit.kind !== 'section') return false;
  return range.structuralPath.length === unit.structuralPath.length
    && range.structuralPath.every((segment, index) => segment === unit.structuralPath[index]);
}

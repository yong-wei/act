import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { TEXTBOOK_READER_MARKDOWN_ANCHOR_PREFIX } from '@/lib/textbook-reader-markdown';
import {
  loadStructuredTextbookBook,
  STRUCTURED_TEXTBOOK_TITLES,
  type StructuredTextbookFragment,
  type StructuredTextbookManifest,
  type StructuredTextbookNavigation,
  type StructuredTextbookUnit,
} from '@/lib/course-bundle';
import {
  TEXTBOOK_COURSE_ID,
  type TextbookCatalogEntry,
  type TextbookCitationUnit,
  type TextbookFragment,
  type TextbookNavigationNode,
  type TextbookReaderLocation,
  type TextbookReaderProjection,
} from './textbook-reader-contracts';

export { TEXTBOOK_COURSE_ID } from './textbook-reader-contracts';
export type {
  TextbookCatalogEntry,
  TextbookCitationUnit,
  TextbookFragment,
  TextbookNavigationNode,
  TextbookReaderLocation,
  TextbookReaderProjection,
} from './textbook-reader-contracts';

export const TEXTBOOK_TITLES = STRUCTURED_TEXTBOOK_TITLES;

const DEFAULT_RUNTIME_ROOT = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbooks-v2',
);
const SAFE_BOOK_ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
const SAFE_UNIT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_FRAGMENT = /^(?:formula|figure|table)-[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

interface UnitMetadata {
  id: string;
  chapterId: string;
  structuralPath: string[];
  parentId: string | null;
  kind: string;
  naturalNumber: string | null;
  title: string;
}

interface BookIndex {
  manifest: StructuredTextbookManifest;
  navigation: StructuredTextbookNavigation;
  unitMetadata: Map<string, UnitMetadata>;
  unitIdByStructuralPath: Map<string, string>;
  anchorsByUnitId: Map<string, StructuredTextbookFragment[]>;
  unitsById: Map<string, StructuredTextbookUnit>;
}

export class TextbookReaderError extends Error {
  constructor(public readonly code: 'unauthorized' | 'not-found') {
    super(code === 'unauthorized' ? 'Textbook access denied' : 'Textbook location not found');
  }
}

const indexCache = new Map<string, Promise<BookIndex>>();

function isSafeRouteText(value: string): boolean {
  return Boolean(value)
    && value.length <= 128
    && !value.includes('/')
    && !value.includes('\\')
    && !/[\p{Cc}]/u.test(value)
    && value !== '.'
    && value !== '..';
}

export function parseTextbookRoute(input: {
  bookId: string;
  edition: string;
  unitPath: readonly string[];
}): { bookId: string; edition: string; unitPath: string[] } | null {
  if (!SAFE_BOOK_ID.test(input.bookId) || !(input.bookId in TEXTBOOK_TITLES)) return null;
  if (!isSafeRouteText(input.edition)) return null;
  if (input.unitPath.length === 0 || input.unitPath.some((segment) => !SAFE_UNIT_SEGMENT.test(segment))) {
    return null;
  }
  return {
    bookId: input.bookId,
    edition: input.edition,
    unitPath: [...input.unitPath],
  };
}

export function buildTextbookReaderHref(input: {
  bookId: string;
  edition: string;
  unitPath: readonly string[];
  fragment?: string | null;
}): string {
  const parsed = parseTextbookRoute(input);
  if (!parsed) throw new TextbookReaderError('not-found');
  const pathname = [
    'textbooks',
    parsed.bookId,
    encodeURIComponent(parsed.edition),
    ...parsed.unitPath.map(encodeURIComponent),
  ].join('/');
  const fragment = input.fragment && SAFE_FRAGMENT.test(input.fragment)
    ? `#${encodeURIComponent(input.fragment)}`
    : '';
  return `/${pathname}${fragment}`;
}

export function authorizeTextbookAccess(input: {
  userId: string | null | undefined;
  courseId?: string;
}): void {
  if (!input.userId || (input.courseId ?? TEXTBOOK_COURSE_ID) !== TEXTBOOK_COURSE_ID) {
    throw new TextbookReaderError('unauthorized');
  }
}

async function buildBookIndex(runtimeRoot: string, bookId: string): Promise<BookIndex> {
  try {
    const book = await loadStructuredTextbookBook(bookId, runtimeRoot);
    const unitMetadata = new Map<string, UnitMetadata>();
    const unitIdByStructuralPath = new Map<string, string>();
    const unitsById = new Map<string, StructuredTextbookUnit>();
    for (const unit of book.units) {
      unitMetadata.set(unit.id, {
        id: unit.id,
        chapterId: unit.chapterId,
        structuralPath: unit.structuralPath,
        parentId: unit.parentId,
        kind: unit.kind,
        naturalNumber: unit.naturalNumber,
        title: unit.title,
      });
      unitIdByStructuralPath.set(unit.structuralPath.join('/'), unit.id);
      unitsById.set(unit.id, unit);
    }
    const anchorsByUnitId = new Map<string, StructuredTextbookFragment[]>();
    for (const anchor of book.fragments) {
      const anchors = anchorsByUnitId.get(anchor.owningUnitId) ?? [];
      anchors.push(anchor);
      anchorsByUnitId.set(anchor.owningUnitId, anchors);
    }
    return {
      manifest: book.manifest,
      navigation: book.navigation,
      unitMetadata,
      unitIdByStructuralPath,
      anchorsByUnitId,
      unitsById,
    };
  } catch (error) {
    if (error instanceof TextbookReaderError) throw error;
    throw new TextbookReaderError('not-found');
  }
}

function getBookIndex(runtimeRoot: string, bookId: string): Promise<BookIndex> {
  const cacheKey = `${runtimeRoot}\0${bookId}`;
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;
  const loading = buildBookIndex(runtimeRoot, bookId).catch((error) => {
    indexCache.delete(cacheKey);
    throw error;
  });
  indexCache.set(cacheKey, loading);
  return loading;
}

export function clearTextbookReaderCache(): void {
  indexCache.clear();
}

function catalogEntry(manifest: StructuredTextbookManifest): TextbookCatalogEntry {
  return {
    bookId: manifest.bookId,
    edition: manifest.edition,
    title: TEXTBOOK_TITLES[manifest.bookId] ?? manifest.bookId,
    sourceRevision: manifest.sourceRevision,
    structureUnitCount: manifest.counts.structureUnits,
    fragmentAnchorCount: manifest.counts.fragmentAnchors,
  };
}

export async function loadTextbookCatalog(input: {
  userId: string | null | undefined;
  runtimeRoot?: string;
}): Promise<TextbookCatalogEntry[]> {
  authorizeTextbookAccess(input);
  const runtimeRoot = input.runtimeRoot ?? DEFAULT_RUNTIME_ROOT;
  try {
    const bookIds = (await readdir(/*turbopackIgnore: true*/ runtimeRoot, { withFileTypes: true }))
      .filter((entry) => (
        entry.isDirectory()
        && SAFE_BOOK_ID.test(entry.name)
        && entry.name in TEXTBOOK_TITLES
      ))
      .map((entry) => entry.name)
      .sort();
    return await Promise.all(bookIds.map(async (bookId) =>
      catalogEntry((await loadStructuredTextbookBook(bookId, runtimeRoot)).manifest)
    ));
  } catch (error) {
    if (error instanceof TextbookReaderError) throw error;
    throw new TextbookReaderError('not-found');
  }
}

async function loadUnit(
  runtimeRoot: string,
  bookId: string,
  unitId: string,
): Promise<StructuredTextbookUnit> {
  const found = (await getBookIndex(runtimeRoot, bookId)).unitsById.get(unitId);
  if (!found) throw new TextbookReaderError('not-found');
  return found;
}

export async function loadTextbookCitationUnits(input: {
  requests: readonly { bookId: string; unitIds: readonly string[] }[];
  runtimeRoot?: string;
}): Promise<TextbookCitationUnit[]> {
  const runtimeRoot = input.runtimeRoot ?? DEFAULT_RUNTIME_ROOT;
  const units: TextbookCitationUnit[] = [];
  for (const request of input.requests) {
    if (!SAFE_BOOK_ID.test(request.bookId) || !(request.bookId in TEXTBOOK_TITLES)) {
      throw new TextbookReaderError('not-found');
    }
    const requestedIds = new Set(request.unitIds);
    if (requestedIds.size === 0) continue;
    const index = await getBookIndex(runtimeRoot, request.bookId);
    for (const unit of index.unitsById.values()) {
      if (!requestedIds.has(unit.id)) continue;
      const metadata = index.unitMetadata.get(unit.id);
      if (!metadata) throw new TextbookReaderError('not-found');
      const fragments = (index.anchorsByUnitId.get(unit.id) ?? [])
        .map((anchor) => {
          const id = fragmentId(anchor);
          return id ? {
            id,
            kind: anchor.kind,
            naturalNumber: anchor.naturalNumber,
            ordinal: anchor.ordinal,
          } : null;
        })
        .filter((fragment): fragment is TextbookFragment => Boolean(fragment));
      units.push({
        id: unit.id,
        bookId: unit.bookId,
        edition: unit.edition,
        sourceRevision: index.manifest.sourceRevision,
        title: unit.title,
        kind: unit.kind,
        naturalNumber: unit.naturalNumber,
        structuralPath: [...unit.structuralPath],
        markdown: unit.markdown,
        fragments,
      });
      requestedIds.delete(unit.id);
      if (requestedIds.size === 0) break;
    }
    if (requestedIds.size > 0) throw new TextbookReaderError('not-found');
  }
  return units;
}

function fragmentId(anchor: StructuredTextbookFragment): string | null {
  const value = anchor.id.slice(anchor.id.lastIndexOf('#') + 1);
  return SAFE_FRAGMENT.test(value) ? value : null;
}

export function insertTextbookFragmentMarkers(
  markdown: string,
  unitStartLine: number,
  anchors: readonly Pick<StructuredTextbookFragment, 'id' | 'sourceSpan'>[],
): string {
  const markersByLine = new Map<number, string[]>();
  for (const anchor of anchors) {
    const id = anchor.id.slice(anchor.id.lastIndexOf('#') + 1);
    if (!SAFE_FRAGMENT.test(id)) continue;
    const lineIndex = Math.max(0, anchor.sourceSpan.startLine - unitStartLine);
    const markers = markersByLine.get(lineIndex) ?? [];
    markers.push(`[[${TEXTBOOK_READER_MARKDOWN_ANCHOR_PREFIX}${id}]]`);
    markersByLine.set(lineIndex, markers);
  }
  const lines = markdown.split(/\r?\n/);
  const hasTableSeparator = (line: string) => /(^|[^\\])\|/.test(line);
  const isTableDelimiter = (line: string) => (
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
  );
  const tableLineIndexes = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableDelimiter(lines[index])) continue;
    if (index > 0 && hasTableSeparator(lines[index - 1])) {
      tableLineIndexes.add(index - 1);
    }
    tableLineIndexes.add(index);
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      if (!lines[rowIndex].trim() || !hasTableSeparator(lines[rowIndex])) break;
      tableLineIndexes.add(rowIndex);
    }
  }
  const insertIntoFirstTableCell = (line: string, markers: readonly string[]) => {
    const markerText = markers.join(' ');
    const leadingPipe = line.indexOf('|');
    if (leadingPipe >= 0) {
      return `${line.slice(0, leadingPipe + 1)} ${markerText} ${line.slice(leadingPipe + 1)}`;
    }
    return `${markerText} ${line}`;
  };
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const markers = markersByLine.get(index);
    if (!markers?.length) {
      output.push(lines[index]);
      continue;
    }

    if (tableLineIndexes.has(index)) {
      if (isTableDelimiter(lines[index])) {
        const nextContentRow = index + 1;
        if (
          nextContentRow < lines.length
          && tableLineIndexes.has(nextContentRow)
          && !isTableDelimiter(lines[nextContentRow])
        ) {
          const pending = markersByLine.get(nextContentRow) ?? [];
          markersByLine.set(nextContentRow, [...markers, ...pending]);
          output.push(lines[index]);
          continue;
        }
        const previousOutputIndex = output.length - 1;
        if (index > 0 && previousOutputIndex >= 0 && tableLineIndexes.has(index - 1)) {
          output[previousOutputIndex] = insertIntoFirstTableCell(
            output[previousOutputIndex],
            markers,
          );
          output.push(lines[index]);
          continue;
        }
      }
      output.push(insertIntoFirstTableCell(lines[index], markers));
      continue;
    }

    const formulaMarkers = markers.filter((marker) => marker.includes(':formula-'));
    const inlineMarkers = markers.filter((marker) => !marker.includes(':formula-'));
    if (formulaMarkers.length) output.push(...formulaMarkers, '');
    output.push(inlineMarkers.length ? `${lines[index]} ${inlineMarkers.join(' ')}` : lines[index]);
  }
  return output.join('\n');
}

export function resolveTextbookUnitAssetHref(input: {
  href: string;
  bookId: string;
  chapterId: string;
}): string {
  const trimmed = input.href.trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/course-runtime/resources/textbooks/')) return trimmed;
  if (trimmed.startsWith('/') || trimmed.includes('\\')) return '';
  const relative = path.posix.normalize(trimmed);
  if (relative.startsWith('../') || relative === '..') return '';
  const assetRelative = relative.startsWith('assets/')
    ? relative.slice('assets/'.length)
    : relative;
  if (!assetRelative || assetRelative.startsWith('../')) return '';
  return `/course-runtime/resources/textbooks/${encodeURIComponent(input.bookId)}/assets/${encodeURIComponent(input.chapterId)}/${assetRelative
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function locationFor(
  metadata: UnitMetadata | undefined,
  bookId: string,
  edition: string,
): TextbookReaderLocation | null {
  if (!metadata) return null;
  return {
    id: metadata.id,
    title: metadata.title,
    href: buildTextbookReaderHref({
      bookId,
      edition,
      unitPath: metadata.structuralPath,
    }),
  };
}

function buildHierarchy(
  index: BookIndex,
  bookId: string,
  edition: string,
): TextbookNavigationNode[] {
  const navigationById = new Map(index.navigation.entries.map((entry) => [entry.unitId, entry]));
  const visit = (unitId: string): TextbookNavigationNode | null => {
    const metadata = index.unitMetadata.get(unitId);
    const navigation = navigationById.get(unitId);
    if (!metadata || !navigation) return null;
    return {
      id: metadata.id,
      title: metadata.title,
      kind: metadata.kind,
      naturalNumber: metadata.naturalNumber,
      structuralPath: metadata.structuralPath,
      href: buildTextbookReaderHref({ bookId, edition, unitPath: metadata.structuralPath }),
      children: navigation.childIds
        .map(visit)
        .filter((child): child is TextbookNavigationNode => Boolean(child)),
    };
  };
  return index.navigation.entries
    .filter((entry) => entry.parentId === null)
    .map((entry) => visit(entry.unitId))
    .filter((node): node is TextbookNavigationNode => Boolean(node));
}

export async function loadTextbookReaderProjection(input: {
  userId: string | null | undefined;
  bookId: string;
  edition: string;
  unitPath: readonly string[];
  runtimeRoot?: string;
}): Promise<TextbookReaderProjection> {
  authorizeTextbookAccess(input);
  const route = parseTextbookRoute(input);
  if (!route) throw new TextbookReaderError('not-found');
  const runtimeRoot = input.runtimeRoot ?? DEFAULT_RUNTIME_ROOT;
  const index = await getBookIndex(runtimeRoot, route.bookId);
  if (index.manifest.edition !== route.edition) throw new TextbookReaderError('not-found');

  const unitId = index.unitIdByStructuralPath.get(route.unitPath.join('/'));
  if (!unitId) throw new TextbookReaderError('not-found');
  const metadata = index.unitMetadata.get(unitId);
  if (!metadata || metadata.structuralPath.join('/') !== route.unitPath.join('/')) {
    throw new TextbookReaderError('not-found');
  }
  const navigationEntry = index.navigation.entries.find((entry) => entry.unitId === unitId);
  if (!navigationEntry) throw new TextbookReaderError('not-found');

  const unit = await loadUnit(runtimeRoot, route.bookId, unitId);
  const runtimeAnchors = index.anchorsByUnitId.get(unitId) ?? [];
  const anchors = runtimeAnchors
    .map((anchor) => {
      const id = fragmentId(anchor);
      return id ? {
        id,
        kind: anchor.kind,
        naturalNumber: anchor.naturalNumber,
        ordinal: anchor.ordinal,
      } : null;
    })
    .filter((anchor): anchor is TextbookFragment => Boolean(anchor));

  const breadcrumbs = route.unitPath.map((_, indexInPath) => {
    const parentPath = route.unitPath.slice(0, indexInPath + 1);
    const parentUnitId = index.unitIdByStructuralPath.get(parentPath.join('/'));
    return locationFor(
      parentUnitId ? index.unitMetadata.get(parentUnitId) : undefined,
      route.bookId,
      route.edition,
    );
  }).filter((location): location is TextbookReaderLocation => Boolean(location));

  return {
    book: catalogEntry(index.manifest),
    unit: {
      id: unit.id,
      chapterId: unit.chapterId,
      title: unit.title,
      kind: unit.kind,
      naturalNumber: unit.naturalNumber,
      structuralPath: unit.structuralPath,
      markdown: insertTextbookFragmentMarkers(unit.markdown, unit.sourceSpan.startLine, runtimeAnchors),
      contentHash: `sha256:${createHash('sha256').update(unit.markdown, 'utf8').digest('hex')}`,
    },
    hierarchy: buildHierarchy(index, route.bookId, route.edition),
    breadcrumbs,
    previous: locationFor(
      navigationEntry.previousUnitId
        ? index.unitMetadata.get(navigationEntry.previousUnitId)
        : undefined,
      route.bookId,
      route.edition,
    ),
    next: locationFor(
      navigationEntry.nextUnitId
        ? index.unitMetadata.get(navigationEntry.nextUnitId)
        : undefined,
      route.bookId,
      route.edition,
    ),
    fragments: anchors,
  };
}

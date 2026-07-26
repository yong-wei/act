import { createReadStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX } from '@/lib/textbook-citation-targets';

export const TEXTBOOK_COURSE_ID = 'automatic-control';

export const TEXTBOOK_TITLES: Readonly<Record<string, string>> = {
  'control-encyclopedia': '控制工程百科全书',
  'dorf-modern-control-systems': 'Modern Control Systems',
  'feedback-control-of-dynamic-systems': 'Feedback Control of Dynamic Systems',
  'hu-shousong-auto-control-7th': '自动控制原理（第七版）',
  'hu-shousong-auto-control-8th': '自动控制原理（第八版）',
  'hu-shousong-exercise-analysis-3rd': '自动控制原理题海与考研指导',
  'liu-sheng-auto-control-2015': '自动控制原理',
};

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

interface RuntimeManifest {
  recordType: 'export-manifest';
  schemaVersion: 'structured-textbook-runtime.v2';
  bookId: string;
  edition: string;
  counts: {
    structureUnits: number;
    fragmentAnchors: number;
  };
}

interface RuntimeUnit {
  id: string;
  bookId: string;
  edition: string;
  chapterId: string;
  structuralPath: string[];
  parentId: string | null;
  level: number;
  kind: string;
  naturalNumber: string | null;
  title: string;
  markdown: string;
  sourceSpan: SourceSpan;
  fragmentAnchorIds: string[];
  recordType: 'structure-unit';
  schemaVersion: 'structured-textbook-runtime.v2';
}

interface SourceSpan {
  sourcePath: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
}

interface RuntimeAnchor {
  id: string;
  owningUnitId: string;
  kind: 'formula' | 'figure' | 'table';
  naturalNumber: string | null;
  ordinal: number;
  sourceSpan: SourceSpan;
  recordType: 'fragment-anchor';
  schemaVersion: 'structured-textbook-runtime.v2';
}

interface RuntimeNavigation {
  recordType: 'navigation-index';
  schemaVersion: 'structured-textbook-runtime.v2';
  bookId: string;
  entries: RuntimeNavigationEntry[];
}

interface RuntimeNavigationEntry {
  unitId: string;
  parentId: string | null;
  childIds: string[];
  previousUnitId: string | null;
  nextUnitId: string | null;
}

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
  manifest: RuntimeManifest;
  navigation: RuntimeNavigation;
  unitMetadata: Map<string, UnitMetadata>;
  unitIdByStructuralPath: Map<string, string>;
  anchorsByUnitId: Map<string, RuntimeAnchor[]>;
}

export interface TextbookCatalogEntry {
  bookId: string;
  edition: string;
  title: string;
  structureUnitCount: number;
  fragmentAnchorCount: number;
}

export interface TextbookNavigationNode {
  id: string;
  title: string;
  kind: string;
  naturalNumber: string | null;
  structuralPath: string[];
  href: string;
  children: TextbookNavigationNode[];
}

export interface TextbookReaderLocation {
  id: string;
  title: string;
  href: string;
}

export interface TextbookFragment {
  id: string;
  kind: RuntimeAnchor['kind'];
  naturalNumber: string | null;
  ordinal: number;
}

export interface TextbookReaderProjection {
  book: TextbookCatalogEntry;
  unit: {
    id: string;
    chapterId: string;
    title: string;
    kind: string;
    naturalNumber: string | null;
    structuralPath: string[];
    markdown: string;
  };
  hierarchy: TextbookNavigationNode[];
  breadcrumbs: TextbookReaderLocation[];
  previous: TextbookReaderLocation | null;
  next: TextbookReaderLocation | null;
  fragments: TextbookFragment[];
}

export class TextbookReaderError extends Error {
  constructor(public readonly code: 'unauthorized' | 'not-found') {
    super(code === 'unauthorized' ? 'Textbook access denied' : 'Textbook location not found');
  }
}

const indexCache = new Map<string, Promise<BookIndex>>();

function runtimeBookRoot(runtimeRoot: string, bookId: string): string {
  return path.join(runtimeRoot, bookId);
}

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

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function forEachJsonl<T>(
  filePath: string,
  visit: (row: T) => void | boolean,
): Promise<void> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (visit(JSON.parse(line) as T) === false) {
      lines.close();
      break;
    }
  }
}

function assertManifest(manifest: RuntimeManifest, bookId: string): void {
  if (
    manifest.recordType !== 'export-manifest'
    || manifest.schemaVersion !== 'structured-textbook-runtime.v2'
    || manifest.bookId !== bookId
  ) {
    throw new TextbookReaderError('not-found');
  }
}

async function buildBookIndex(runtimeRoot: string, bookId: string): Promise<BookIndex> {
  try {
    const bookRoot = runtimeBookRoot(runtimeRoot, bookId);
    const [manifest, navigation] = await Promise.all([
      readJson<RuntimeManifest>(path.join(bookRoot, 'manifest.json')),
      readJson<RuntimeNavigation>(path.join(bookRoot, 'navigation.json')),
    ]);
    assertManifest(manifest, bookId);
    if (
      navigation.recordType !== 'navigation-index'
      || navigation.schemaVersion !== 'structured-textbook-runtime.v2'
      || navigation.bookId !== bookId
    ) {
      throw new TextbookReaderError('not-found');
    }

    const unitMetadata = new Map<string, UnitMetadata>();
    const unitIdByStructuralPath = new Map<string, string>();
    await forEachJsonl<RuntimeUnit>(path.join(bookRoot, 'units.jsonl'), (unit) => {
      if (
        unit.recordType !== 'structure-unit'
        || unit.schemaVersion !== 'structured-textbook-runtime.v2'
        || unit.bookId !== bookId
      ) {
        throw new TextbookReaderError('not-found');
      }
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
    });
    if (unitMetadata.size !== navigation.entries.length) {
      throw new TextbookReaderError('not-found');
    }
    const anchorsByUnitId = new Map<string, RuntimeAnchor[]>();
    await forEachJsonl<RuntimeAnchor>(path.join(bookRoot, 'anchors.jsonl'), (anchor) => {
      if (
        anchor.recordType !== 'fragment-anchor'
        || anchor.schemaVersion !== 'structured-textbook-runtime.v2'
        || !unitMetadata.has(anchor.owningUnitId)
      ) {
        throw new TextbookReaderError('not-found');
      }
      const anchors = anchorsByUnitId.get(anchor.owningUnitId) ?? [];
      anchors.push(anchor);
      anchorsByUnitId.set(anchor.owningUnitId, anchors);
    });
    return {
      manifest,
      navigation,
      unitMetadata,
      unitIdByStructuralPath,
      anchorsByUnitId,
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

function catalogEntry(manifest: RuntimeManifest): TextbookCatalogEntry {
  return {
    bookId: manifest.bookId,
    edition: manifest.edition,
    title: TEXTBOOK_TITLES[manifest.bookId] ?? manifest.bookId,
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
    const bookIds = (await readdir(runtimeRoot, { withFileTypes: true }))
      .filter((entry) => (
        entry.isDirectory()
        && SAFE_BOOK_ID.test(entry.name)
        && entry.name in TEXTBOOK_TITLES
      ))
      .map((entry) => entry.name)
      .sort();
    return await Promise.all(bookIds.map(async (bookId) => {
      const manifest = await readJson<RuntimeManifest>(
        path.join(runtimeBookRoot(runtimeRoot, bookId), 'manifest.json'),
      );
      assertManifest(manifest, bookId);
      return catalogEntry(manifest);
    }));
  } catch (error) {
    if (error instanceof TextbookReaderError) throw error;
    throw new TextbookReaderError('not-found');
  }
}

async function loadUnit(
  runtimeRoot: string,
  bookId: string,
  unitId: string,
): Promise<RuntimeUnit> {
  let found: RuntimeUnit | null = null;
  await forEachJsonl<RuntimeUnit>(
    path.join(runtimeBookRoot(runtimeRoot, bookId), 'units.jsonl'),
    (unit) => {
      if (unit.id !== unitId) return;
      found = unit;
      return false;
    },
  );
  if (!found) throw new TextbookReaderError('not-found');
  return found;
}

function fragmentId(anchor: RuntimeAnchor): string | null {
  const value = anchor.id.slice(anchor.id.lastIndexOf('#') + 1);
  return SAFE_FRAGMENT.test(value) ? value : null;
}

export function insertTextbookFragmentMarkers(
  markdown: string,
  unitStartLine: number,
  anchors: readonly Pick<RuntimeAnchor, 'id' | 'sourceSpan'>[],
): string {
  const markersByLine = new Map<number, string[]>();
  for (const anchor of anchors) {
    const id = anchor.id.slice(anchor.id.lastIndexOf('#') + 1);
    if (!SAFE_FRAGMENT.test(id)) continue;
    const lineIndex = Math.max(0, anchor.sourceSpan.startLine - unitStartLine);
    const markers = markersByLine.get(lineIndex) ?? [];
    markers.push(`[[${TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX}${id}]]`);
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

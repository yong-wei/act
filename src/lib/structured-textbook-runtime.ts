import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildKaqArtifactVersionRefs,
  type KaqArtifactVersionRefs,
} from './kaq-artifact-versioning';
import type {
  TextbookResourceNodeInput,
} from './resource-node-registry';

export const STRUCTURED_TEXTBOOK_RUNTIME_VERSION = 'structured-textbook-runtime.v2';
export const STRUCTURED_TEXTBOOK_TITLES: Readonly<Record<string, string>> = {
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

export interface StructuredTextbookSourceSpan {
  sourcePath: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
}

export interface StructuredTextbookManifest {
  recordType: 'export-manifest';
  schemaVersion: typeof STRUCTURED_TEXTBOOK_RUNTIME_VERSION;
  bookId: string;
  edition: string;
  sourceRevision: string;
  sourceHashes: Record<string, string>;
  counts: {
    structureUnits: number;
    fragmentAnchors: number;
    retrievalWindows: number;
    navigationEntries: number;
  };
}

export interface StructuredTextbookUnit {
  id: string;
  bookId: string;
  edition: string;
  chapterId: string;
  structuralPath: string[];
  parentId: string | null;
  ancestorIds: string[];
  level: number;
  kind: string;
  naturalNumber: string | null;
  title: string;
  markdown: string;
  sourceSpan: StructuredTextbookSourceSpan;
  fragmentAnchorIds: string[];
  recordType: 'structure-unit';
  schemaVersion: typeof STRUCTURED_TEXTBOOK_RUNTIME_VERSION;
}

export interface StructuredTextbookFragment {
  id: string;
  owningUnitId: string;
  kind: 'formula' | 'figure' | 'table';
  naturalNumber: string | null;
  ordinal: number;
  sourceSpan: StructuredTextbookSourceSpan;
  recordType: 'fragment-anchor';
  schemaVersion: typeof STRUCTURED_TEXTBOOK_RUNTIME_VERSION;
}

export interface StructuredTextbookRetrievalWindow {
  id: string;
  primaryUnitId: string;
  segments: Array<{
    owningUnitId: string;
    markdown: string;
    sourceSpan: StructuredTextbookSourceSpan;
  }>;
  citationTarget: false;
  recordType: 'retrieval-window';
  schemaVersion: typeof STRUCTURED_TEXTBOOK_RUNTIME_VERSION;
}

export interface StructuredTextbookNavigationEntry {
  unitId: string;
  parentId: string | null;
  childIds: string[];
  previousUnitId: string | null;
  nextUnitId: string | null;
}

export interface StructuredTextbookNavigation {
  recordType: 'navigation-index';
  schemaVersion: typeof STRUCTURED_TEXTBOOK_RUNTIME_VERSION;
  bookId: string;
  entries: StructuredTextbookNavigationEntry[];
}

export interface StructuredTextbookBook {
  manifest: StructuredTextbookManifest;
  units: StructuredTextbookUnit[];
  fragments: StructuredTextbookFragment[];
  retrievalWindows: StructuredTextbookRetrievalWindow[];
  navigation: StructuredTextbookNavigation;
}

export interface TextbookStructureUnitProjection {
  id: string;
  kind: string;
  title: string;
  href: string;
  text: string;
  contentHash: string;
  identity: {
    bookId: string;
    edition: string;
    sourceRevision: string;
    unitId: string;
    fragmentId: null;
  };
  fragments: StructuredTextbookFragment[];
  resourceProjection: {
    resourceId: string;
    segmentRef: string;
    citationTargetRef: string;
    knowledgeNodeRefs: string[];
    capabilityTargetRefs: string[];
    contentHash: string;
    versionRefs: KaqArtifactVersionRefs;
  };
  citationAddress: {
    kind: 'text';
    sourceRefId: string;
    href: string;
    locator: string | null;
    contentHash: string;
  };
  metadata: {
    bookId: string;
    edition: string;
    sourceRevision: string;
    unitId: string;
    chapterId: string;
    naturalNumber: string | null;
    structuralPath: string[];
  };
}

export interface TextbookStructureRuntimeCatalogEntry {
  textbook: TextbookResourceNodeInput;
  units: TextbookStructureRuntimeCatalogUnit[];
}

export interface TextbookStructureRuntimeCatalogUnit {
  unitId: string;
  title: string;
  citationHref: string;
  sourceHash: string;
  sourceVersionRef: string;
  knowledgeNodeIds: string[];
  capabilityTargetIds: string[];
  estimatedTimeMinutes: number | null;
}

interface TextbookUnitSemanticOverride {
  knowledgeNodeIds: string[];
  capabilityTargetIds: string[];
}

const DORF_UNIT_SEMANTICS = new Map<string, TextbookUnitSemanticOverride>([
  ...semanticRows(
    ['ch01-sec01', 'ch01-sec02', 'ch01-sec11'],
    controlIntro(['selfDirectedLearning']),
  ),
  ...semanticRows(
    ['ch01-sec03', 'ch01-example-0101', 'ch01-example-0103', 'ch01-example-0104', 'ch01-example-0105', 'ch01-example-0106', 'ch01-example-0107', 'ch01-example-0108', 'ch01-example-0109', 'ch01-example-0110', 'ch01-example-0111', 'ch01-example-0112', 'ch01-example-0114'],
    controlExamples(['engineeringDecision']),
  ),
  ...semanticRows(['ch01-example-0113'], controlExamples(['controlModeling'])),
  ...semanticRows(['ch01-sec04', 'ch01-sec09'], controlDesign(['engineeringDecision'])),
  ...semanticRows(['ch01-sec05'], controlDesign(['engineeringDecision', 'parameterDesign'])),
  ...semanticRows(['ch01-sec06'], controlDesign(['controlModeling', 'engineeringDecision'])),
  ...semanticRows(['ch01-sec07'], controlDesign(['engineeringDecision', 'inquiryReflection'])),
  ...semanticRows(['ch01-sec08'], controlDesign(['selfDirectedLearning', 'engineeringDecision'])),
  ...semanticRows(['ch01-sec10'], controlDesign(['controlModeling', 'parameterDesign'])),
  ...semanticRows(['ch02-sec01', 'ch02-sec02', 'ch02-example-0201'], modelingBasics(['controlModeling'])),
  ...semanticRows(['ch02-sec03'], modelingBasics(['controlModeling', 'engineeringDecision'])),
  ...semanticRows(['ch02-sec04', 'ch02-sec05', 'ch02-example-0202', 'ch02-example-0203', 'ch02-example-0204', 'ch02-example-0205', 'ch02-example-0215'], transferFunction(['controlModeling'])),
  ...semanticRows(['ch02-sec06', 'ch02-example-0206', 'ch02-example-0216', 'ch02-example-0217', 'ch02-example-0218'], blockDiagram(['controlModeling'])),
  ...semanticRows(['ch02-sec07', 'ch02-example-0207', 'ch02-example-0208', 'ch02-example-0209', 'ch02-example-0210', 'ch02-example-0219'], signalFlow(['controlModeling'])),
  ...semanticRows(['ch02-sec08', 'ch02-example-0211', 'ch02-example-0213', 'ch02-example-0220'], modelingDesign(['engineeringDecision'])),
  ...semanticRows(['ch02-example-0212'], modelingDesign(['controlModeling'])),
  ...semanticRows(['ch02-example-0214'], modelingDesign(['parameterDesign'])),
  ...semanticRows(['ch02-sec09'], modelingDesign(['selfDirectedLearning'])),
  ...semanticRows(['ch02-sec10'], modelingDesign(['controlModeling', 'parameterDesign'])),
  ...semanticRows(['ch02-sec11'], modelingBasics(['selfDirectedLearning'])),
  ...semanticRows(['ch03-sec01', 'ch03-sec02', 'ch03-sec03', 'ch03-example-0301', 'ch03-example-0302'], stateSpace(['controlModeling'])),
  ...semanticRows(['ch03-sec04', 'ch03-sec05'], stateSpaceGraph(['controlModeling'])),
  ...semanticRows(['ch03-example-0303'], stateSpace(['engineeringDecision', 'controlModeling'])),
  ...semanticRows(['ch03-sec06', 'ch03-example-0304'], stateTransfer(['controlModeling'])),
  ...semanticRows(['ch03-sec07', 'ch03-example-0305'], stateTransition(['controlModeling'])),
  ...semanticRows(['ch03-sec08', 'ch03-example-0306'], stateDesign(['engineeringDecision'])),
  ...semanticRows(['ch03-example-0307'], stateDesign(['controlModeling'])),
  ...semanticRows(['ch03-sec09'], stateDesign(['selfDirectedLearning'])),
  ...semanticRows(['ch03-sec10'], stateDesign(['controlModeling', 'parameterDesign'])),
  ...semanticRows(['ch03-sec11'], stateSpace(['selfDirectedLearning'])),
]);

export function resolveStructuredTextbookRuntimeRoot(): string {
  return process.env.ACT_TEXTBOOK_V2_RUNTIME_ROOT || DEFAULT_RUNTIME_ROOT;
}

export async function loadStructuredTextbookBook(
  bookId: string,
  runtimeRoot = resolveStructuredTextbookRuntimeRoot(),
): Promise<StructuredTextbookBook> {
  const bookRoot = path.join(runtimeRoot, bookId);
  const [manifest, units, fragments, retrievalWindows, navigation] = await Promise.all([
    readJson<StructuredTextbookManifest>(path.join(bookRoot, 'manifest.json')),
    readJsonl<StructuredTextbookUnit>(path.join(bookRoot, 'units.jsonl')),
    readJsonl<StructuredTextbookFragment>(path.join(bookRoot, 'anchors.jsonl')),
    readJsonl<StructuredTextbookRetrievalWindow>(path.join(bookRoot, 'windows.jsonl')),
    readJson<StructuredTextbookNavigation>(path.join(bookRoot, 'navigation.json')),
  ]);
  assertStructuredBook({ manifest, units, fragments, retrievalWindows, navigation }, bookId);
  return { manifest, units, fragments, retrievalWindows, navigation };
}

export async function loadAllStructuredTextbookBooks(
  runtimeRoot = resolveStructuredTextbookRuntimeRoot(),
): Promise<StructuredTextbookBook[]> {
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(runtimeRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingRuntimeDirectory(error)) return [];
    throw error;
  }
  const bookIds = entries
    .filter((entry) => entry.isDirectory() && entry.name in STRUCTURED_TEXTBOOK_TITLES)
    .map((entry) => entry.name)
    .sort();
  return Promise.all(bookIds.map((bookId) => loadStructuredTextbookBook(bookId, runtimeRoot)));
}

function isMissingRuntimeDirectory(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function loadAllTextbookStructureUnitProjections(
  runtimeRoot = resolveStructuredTextbookRuntimeRoot(),
): Promise<TextbookStructureUnitProjection[]> {
  const books = await loadAllStructuredTextbookBooks(runtimeRoot);
  return books.flatMap(projectBookUnits);
}

export async function loadAllTextbookStructureRuntimeCatalogEntries(
  runtimeRoot = resolveStructuredTextbookRuntimeRoot(),
): Promise<TextbookStructureRuntimeCatalogEntry[]> {
  const books = await loadAllStructuredTextbookBooks(runtimeRoot);
  return books.map(projectBookCatalog);
}

function projectBookUnits(book: StructuredTextbookBook): TextbookStructureUnitProjection[] {
  const fragmentsByUnitId = new Map<string, StructuredTextbookFragment[]>();
  for (const fragment of book.fragments) {
    const current = fragmentsByUnitId.get(fragment.owningUnitId) ?? [];
    current.push(fragment);
    fragmentsByUnitId.set(fragment.owningUnitId, current);
  }
  return book.units.map((unit) => {
    const contentHash = sha256Text(unit.markdown);
    const href = buildStructuredTextbookReaderHref(
      book.manifest.bookId,
      book.manifest.edition,
      unit.structuralPath,
    );
    const semantic = semanticOverrideForUnit(unit);
    return {
      id: unit.id,
      kind: unit.kind,
      title: unit.title,
      href,
      text: unit.markdown,
      contentHash,
      identity: {
        bookId: book.manifest.bookId,
        edition: book.manifest.edition,
        sourceRevision: book.manifest.sourceRevision,
        unitId: unit.id,
        fragmentId: null,
      },
      fragments: [...(fragmentsByUnitId.get(unit.id) ?? [])],
      resourceProjection: {
        resourceId: unit.id,
        segmentRef: unit.id,
        citationTargetRef: unit.id,
        knowledgeNodeRefs: semantic?.knowledgeNodeIds ?? [],
        capabilityTargetRefs: semantic?.capabilityTargetIds ?? [],
        contentHash,
        versionRefs: buildKaqArtifactVersionRefs({
          resourceProjectionVersion: STRUCTURED_TEXTBOOK_RUNTIME_VERSION,
          resourceRegistryVersion: book.manifest.sourceRevision,
          citationVersion: STRUCTURED_TEXTBOOK_RUNTIME_VERSION,
        }),
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: unit.id,
        href,
        locator: unit.id,
        contentHash,
      },
      metadata: {
        bookId: book.manifest.bookId,
        edition: book.manifest.edition,
        sourceRevision: book.manifest.sourceRevision,
        unitId: unit.id,
        chapterId: unit.chapterId,
        naturalNumber: unit.naturalNumber,
        structuralPath: [...unit.structuralPath],
      },
    };
  });
}

function projectBookCatalog(book: StructuredTextbookBook): TextbookStructureRuntimeCatalogEntry {
  const projectedUnits = projectBookUnits(book);
  return {
    textbook: {
      bookId: book.manifest.bookId,
      title: STRUCTURED_TEXTBOOK_TITLES[book.manifest.bookId] ?? book.manifest.bookId,
      sourceHref: `/textbooks/${encodeURIComponent(book.manifest.bookId)}/${encodeURIComponent(book.manifest.edition)}`,
      sourceHash: sha256Text(JSON.stringify(book.manifest)),
      sourceVersionRef: `${STRUCTURED_TEXTBOOK_RUNTIME_VERSION}:${book.manifest.sourceRevision}`,
      knowledgeNodeIds: uniqueSorted(projectedUnits.flatMap((unit) => unit.resourceProjection.knowledgeNodeRefs)),
      planningOverride: {
        evidenceInstrumentation: ['textbook_catalog_view'],
      },
    },
    units: projectedUnits.map((unit) => ({
      unitId: unit.id,
      title: unit.title,
      citationHref: unit.href,
      sourceHash: unit.contentHash,
      sourceVersionRef: `${STRUCTURED_TEXTBOOK_RUNTIME_VERSION}:${book.manifest.sourceRevision}`,
      knowledgeNodeIds: unit.resourceProjection.knowledgeNodeRefs,
      capabilityTargetIds: unit.resourceProjection.capabilityTargetRefs,
      estimatedTimeMinutes: null,
    })),
  };
}

function assertStructuredBook(book: StructuredTextbookBook, bookId: string): void {
  if (
    book.manifest.recordType !== 'export-manifest'
    || book.manifest.schemaVersion !== STRUCTURED_TEXTBOOK_RUNTIME_VERSION
    || book.manifest.bookId !== bookId
    || !book.manifest.edition
    || !book.manifest.sourceRevision
    || book.navigation.recordType !== 'navigation-index'
    || book.navigation.schemaVersion !== STRUCTURED_TEXTBOOK_RUNTIME_VERSION
    || book.navigation.bookId !== bookId
  ) {
    throw new Error(`Invalid structured textbook runtime for ${bookId}`);
  }
  const unitIds = new Set<string>();
  for (const unit of book.units) {
    if (
      unit.recordType !== 'structure-unit'
      || unit.schemaVersion !== STRUCTURED_TEXTBOOK_RUNTIME_VERSION
      || unit.bookId !== bookId
      || unit.edition !== book.manifest.edition
      || unitIds.has(unit.id)
    ) {
      throw new Error(`Invalid structured textbook unit for ${bookId}`);
    }
    unitIds.add(unit.id);
  }
  if (
    unitIds.size !== book.manifest.counts.structureUnits
    || book.navigation.entries.length !== book.manifest.counts.navigationEntries
    || book.fragments.length !== book.manifest.counts.fragmentAnchors
    || book.retrievalWindows.length !== book.manifest.counts.retrievalWindows
  ) {
    throw new Error(`Structured textbook runtime count mismatch for ${bookId}`);
  }
  for (const fragment of book.fragments) {
    if (
      fragment.recordType !== 'fragment-anchor'
      || fragment.schemaVersion !== STRUCTURED_TEXTBOOK_RUNTIME_VERSION
      || !unitIds.has(fragment.owningUnitId)
    ) {
      throw new Error(`Invalid structured textbook fragment for ${bookId}`);
    }
  }
  for (const window of book.retrievalWindows) {
    if (
      window.recordType !== 'retrieval-window'
      || window.schemaVersion !== STRUCTURED_TEXTBOOK_RUNTIME_VERSION
      || !unitIds.has(window.primaryUnitId)
      || window.citationTarget !== false
      || window.segments.some((segment) => !unitIds.has(segment.owningUnitId))
    ) {
      throw new Error(`Invalid structured textbook retrieval window for ${bookId}`);
    }
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const content = await fs.readFile(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildStructuredTextbookReaderHref(
  bookId: string,
  edition: string,
  unitPath: readonly string[],
): string {
  return `/${[
    'textbooks',
    encodeURIComponent(bookId),
    encodeURIComponent(edition),
    ...unitPath.map(encodeURIComponent),
  ].join('/')}`;
}

function semanticOverrideForUnit(unit: StructuredTextbookUnit): TextbookUnitSemanticOverride | undefined {
  if (unit.bookId !== 'dorf-modern-control-systems' || !unit.naturalNumber) return undefined;
  const [chapter, ordinal] = unit.naturalNumber.split('.');
  if (!chapter || !ordinal) return undefined;
  const chapterPrefix = chapter.padStart(2, '0');
  if (unit.kind === 'section') {
    return DORF_UNIT_SEMANTICS.get(`ch${chapterPrefix}-sec${ordinal.padStart(2, '0')}`);
  }
  if (unit.kind === 'example') {
    return DORF_UNIT_SEMANTICS.get(
      `ch${chapterPrefix}-example-${chapterPrefix}${ordinal.padStart(2, '0')}`,
    );
  }
  return undefined;
}

function semanticRows(
  unitKeys: readonly string[],
  semantic: TextbookUnitSemanticOverride,
): Array<[string, TextbookUnitSemanticOverride]> {
  return unitKeys.map((key) => [key, semantic]);
}

function controlIntro(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['自动控制系统_1_9678f418', '反馈控制系统_1_98dc667a', '课程总图_1_1'],
    capabilityTargetIds,
  );
}

function controlExamples(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['自动控制系统_1_9678f418', '被控对象_1_d156fc34', '反馈控制系统_1_98dc667a'],
    capabilityTargetIds,
  );
}

function controlDesign(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['性能指标_1_1', '控制器_1_1', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  );
}

function modelingBasics(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['动态数学模型_2_b7f98344', '微分方程_2_775c96a3', '机理建模_1_2'],
    capabilityTargetIds,
  );
}

function transferFunction(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['传递函数_2_2c5e2589', '零初值传递函数_2_21001', '拉氏变换_2_243496d4'],
    capabilityTargetIds,
  );
}

function blockDiagram(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['结构图_2_3f312ccc', '结构图等效变换_2_12001', '闭环传递函数_2_5399c369'],
    capabilityTargetIds,
  );
}

function signalFlow(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['信号流图_2_372d4084', '梅森增益公式_2_419eab0c', '余子式接触判定_2_21003'],
    capabilityTargetIds,
  );
}

function modelingDesign(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['动态数学模型_2_b7f98344', '传递函数_2_2c5e2589', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  );
}

function stateSpace(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['状态空间表达式_1_6a8a62c1', '状态变量_9_2dedb9d8', '状态空间_9_98b2feda'],
    capabilityTargetIds,
  );
}

function stateSpaceGraph(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['状态空间表达式_1_6a8a62c1', '信号流图_2_372d4084', '结构图_2_3f312ccc'],
    capabilityTargetIds,
  );
}

function stateTransfer(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['状态空间表达式_9_477dfe0d', '传递函数矩阵_9_a5fa7369', '传递函数_2_2c5e2589'],
    capabilityTargetIds,
  );
}

function stateTransition(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['状态转移矩阵_9_dca84f8f', '状态轨迹_9_f787a0a5', '状态空间_9_98b2feda'],
    capabilityTargetIds,
  );
}

function stateDesign(capabilityTargetIds: string[]): TextbookUnitSemanticOverride {
  return semantic(
    ['状态空间表达式_9_477dfe0d', '动态数学模型_2_b7f98344', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  );
}

function semantic(
  knowledgeNodeIds: string[],
  capabilityTargetIds: string[],
): TextbookUnitSemanticOverride {
  return { knowledgeNodeIds, capabilityTargetIds };
}

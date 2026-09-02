vi.mock('server-only', () => ({}));
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearTextbookReaderCache } from '@/lib/textbook-reader';
import { smokeCandidateTextbookCorpus } from '@/lib/runtime-release-textbook-candidate-smoke';
import { textbookCorpusIdentityDigest } from '@/lib/runtime-external-input-bundle';

const EDITIONS: Record<string, string> = {
  'control-encyclopedia': '2015',
  'hu-shousong-exercise-analysis-3rd': '第三版',
  'dorf-modern-control-systems': '14th Global Edition',
};
const AUTHORING = 'a'.repeat(40);
const INDEX_FILES = [
  'manifest.json',
  'windows.jsonl',
  'bodies.utf8',
  'vectors.f32',
  'lexical-terms.jsonl',
  'lexical-postings.bin',
  'build-report.json',
];
const roots: string[] = [];

afterEach(async () => {
  clearTextbookReaderCache();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeBook(runtimeRoot: string, bookId: string, options: { broken?: boolean } = {}) {
  const bookRoot = path.join(runtimeRoot, bookId);
  await mkdir(bookRoot, { recursive: true });
  const edition = EDITIONS[bookId] ?? '1';
  const unitId = `textbook-unit:${bookId}@edition/chapter-chapter-01`;
  const units = options.broken
    ? []
    : [{
      id: unitId,
      bookId,
      edition,
      chapterId: 'chapter-01',
      structuralPath: ['chapter-chapter-01'],
      parentId: null,
      ancestorIds: [],
      level: 1,
      kind: 'chapter',
      naturalNumber: '1',
      title: '第一章',
      markdown: '# 第一章\n正文',
      sourceSpan: {
        sourcePath: `textbooks/${bookId}/chapter-01/textbook.md`,
        startLine: 1,
        endLine: 1,
        startByte: 0,
        endByte: 8,
      },
      fragmentAnchorIds: [],
      recordType: 'structure-unit',
      schemaVersion: 'structured-textbook-runtime.v2',
    }];
  await writeFile(path.join(bookRoot, 'manifest.json'), JSON.stringify({
    recordType: 'export-manifest',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    edition,
    sourceRevision: AUTHORING,
    sourceHashes: {},
    counts: {
      structureUnits: units.length,
      fragmentAnchors: 0,
      retrievalWindows: units.length,
      navigationEntries: units.length,
    },
  }));
  await writeFile(path.join(bookRoot, 'navigation.json'), JSON.stringify({
    recordType: 'navigation-index',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    entries: units.map((unit) => ({
      unitId: unit.id,
      parentId: null,
      childIds: [],
      previousUnitId: null,
      nextUnitId: null,
    })),
  }));
  await writeFile(path.join(bookRoot, 'units.jsonl'), units.map((unit) => JSON.stringify(unit)).join('\n') + (units.length ? '\n' : ''));
  await writeFile(path.join(bookRoot, 'anchors.jsonl'), '');
  await writeFile(path.join(bookRoot, 'windows.jsonl'), units.map((unit) => JSON.stringify({
    id: unit.id.replace('textbook-unit:', 'textbook-window:'),
    primaryUnitId: unit.id,
    segments: [{ owningUnitId: unit.id, markdown: unit.markdown, sourceSpan: unit.sourceSpan }],
    citationTarget: false,
    recordType: 'retrieval-window',
    schemaVersion: 'structured-textbook-runtime.v2',
  })).join('\n') + (units.length ? '\n' : ''));
}

async function writeIndex(indexRoot: string, bookIds: string[], resourceSetId?: string) {
  await mkdir(indexRoot, { recursive: true });
  for (const fileName of INDEX_FILES) {
    if (fileName !== 'manifest.json') {
      await writeFile(path.join(indexRoot, fileName), '');
      continue;
    }
    await writeFile(path.join(indexRoot, fileName), JSON.stringify({
      recordType: 'index-manifest',
      formatVersion: 'textbook-hybrid-retrieval.v1',
      sourceRevision: AUTHORING,
      resourceSetId: resourceSetId ?? 'current-authoring-bundle-v1',
      books: bookIds.map((bookId) => ({
        bookId,
        edition: EDITIONS[bookId] ?? '1',
        manifestHash: `sha256:${'0'.repeat(64)}`,
        sourceHashes: { 'manifest.json': `sha256:${'1'.repeat(64)}` },
      })),
    }));
  }
}

describe('candidate textbook corpus smoke', () => {
  it('smokes every v1 book from the candidate runtime and does not union another set', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'textbook-candidate-smoke-v1-'));
    roots.push(root);
    const textbookRoot = path.join(root, 'resources', 'textbooks-v2');
    const seven = [
      'control-encyclopedia',
      'dorf-modern-control-systems',
      'hu-shousong-exercise-analysis-3rd',
    ];
    for (const bookId of seven) await writeBook(textbookRoot, bookId);
    await writeFile(path.join(textbookRoot, 'input-provenance.json'), JSON.stringify({
      schemaVersion: 'act.textbook-runtime-input-provenance.v1',
      sourceRevision: AUTHORING,
      inputDigest: 'b'.repeat(64),
      inputFileCount: 3,
    }));
    await writeIndex(path.join(root, 'resources', 'textbook-hybrid-retrieval', 'bge-m3'), seven);
    const result = await smokeCandidateTextbookCorpus({ runtimeRoot: root });
    expect(result.provenanceGeneration).toBe('legacy');
    expect(result.bookIds.sort()).toEqual([...seven].sort());
    expect(result.bookIds).not.toEqual(['control-encyclopedia', 'hu-shousong-exercise-analysis-3rd']);
  });

  it('fails closed when a non-first v2 book is unreadable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'textbook-candidate-smoke-v2-'));
    roots.push(root);
    const textbookRoot = path.join(root, 'resources', 'textbooks-v2');
    const bookIds = ['control-encyclopedia', 'hu-shousong-exercise-analysis-3rd'];
    await writeBook(textbookRoot, bookIds[0]!);
    await writeBook(textbookRoot, bookIds[1]!, { broken: true });
    const resourceSetId = 'current-authoring-bundle-v1';
    await writeFile(path.join(textbookRoot, 'input-provenance.json'), JSON.stringify({
      schemaVersion: 'act.textbook-runtime-input-provenance.v2',
      authoringSourceRevision: AUTHORING,
      resourceSetId,
      bookIds,
      resourceSetDigest: textbookCorpusIdentityDigest(resourceSetId, bookIds),
      inputDigest: 'b'.repeat(64),
      inputFileCount: 4,
      generator: { id: 'act-textbook-runtime-v2-generator', version: 'v2' },
    }));
    await writeIndex(path.join(root, 'resources', 'textbook-hybrid-retrieval', 'bge-m3'), bookIds, resourceSetId);
    await expect(smokeCandidateTextbookCorpus({ runtimeRoot: root })).rejects.toThrow(
      /no readable structural unit:hu-shousong-exercise-analysis-3rd/,
    );
  });

  it('fails closed on same-count index book drift', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'textbook-candidate-smoke-index-'));
    roots.push(root);
    const textbookRoot = path.join(root, 'resources', 'textbooks-v2');
    const bookIds = ['control-encyclopedia', 'hu-shousong-exercise-analysis-3rd'];
    for (const bookId of bookIds) await writeBook(textbookRoot, bookId);
    await writeFile(path.join(textbookRoot, 'input-provenance.json'), JSON.stringify({
      schemaVersion: 'act.textbook-runtime-input-provenance.v1',
      sourceRevision: AUTHORING,
      inputDigest: 'b'.repeat(64),
      inputFileCount: 2,
    }));
    await writeIndex(
      path.join(root, 'resources', 'textbook-hybrid-retrieval', 'bge-m3'),
      ['control-encyclopedia', 'dorf-modern-control-systems'],
    );
    await expect(smokeCandidateTextbookCorpus({ runtimeRoot: root })).rejects.toThrow(
      /index book set mismatch/,
    );
  });
});

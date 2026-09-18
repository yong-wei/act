vi.mock('server-only', () => ({}));
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import {
  authorizeTextbookAccess,
  buildTextbookReaderHref,
  clearTextbookReaderCache,
  insertTextbookFragmentMarkers,
  loadTextbookCatalog,
  loadTextbookReaderProjection,
  parseTextbookReaderHref,
  parseTextbookRoute,
  resolveTextbookUnitAssetHref,
  TEXTBOOK_TITLES,
  TextbookReaderError,
} from '@/lib/textbook-reader';

const EDITIONS: Record<string, string> = {
  'control-encyclopedia': '2015',
  'dorf-modern-control-systems': '14th Global Edition',
  'feedback-control-of-dynamic-systems': '7th edition',
  'hu-shousong-auto-control-7th': '第七版',
  'hu-shousong-auto-control-8th': '第八版',
  'hu-shousong-exercise-analysis-3rd': '第三版',
  'liu-sheng-auto-control-2015': '2015版',
};

let runtimeRoot = '';

function normalizedEdition(edition: string) {
  return edition.toLowerCase().replace(/\s+/g, '-');
}

async function writeFixtureBook(bookId: string, edition: string) {
  const bookRoot = path.join(runtimeRoot, bookId);
  await mkdir(bookRoot, { recursive: true });
  const prefix = `textbook-unit:${bookId}@${normalizedEdition(edition)}`;
  const firstId = `${prefix}/chapter-chapter-01`;
  const lastId = `${firstId}/section-final`;
  const units = [
    {
      id: firstId,
      bookId,
      edition,
      chapterId: 'chapter-01',
      structuralPath: ['chapter-chapter-01'],
      parentId: null,
      ancestorIds: [],
      level: 1,
      kind: 'chapter',
      naturalNumber: '1',
      title: `${TEXTBOOK_TITLES[bookId]} 第一章`,
      markdown: '# 第一章\n',
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
    },
    {
      id: lastId,
      bookId,
      edition,
      chapterId: 'chapter-01',
      structuralPath: ['chapter-chapter-01', 'section-final'],
      parentId: firstId,
      ancestorIds: [firstId],
      level: 2,
      kind: 'section',
      naturalNumber: '1.1',
      title: '末单元',
      markdown: [
        '## 末单元',
        '![结构图](assets/plant.png)',
        '$$G(s)=1/(s+1)$$',
        '| 参数 | 数值 |',
        '| --- | --- |',
        '| K | 1 |',
      ].join('\n'),
      sourceSpan: {
        sourcePath: `textbooks/${bookId}/chapter-01/textbook.md`,
        startLine: 10,
        endLine: 15,
        startByte: 9,
        endByte: 120,
      },
      fragmentAnchorIds: [
        `${lastId}#figure-001`,
        `${lastId}#formula-001`,
        `${lastId}#table-001`,
      ],
      recordType: 'structure-unit',
      schemaVersion: 'structured-textbook-runtime.v2',
    },
  ];
  const anchors = [
    ['figure', 11],
    ['formula', 12],
    ['table', 13],
  ].map(([kind, startLine], index) => ({
    id: `${lastId}#${kind}-001`,
    owningUnitId: lastId,
    kind,
    naturalNumber: index === 0 ? '1.1' : null,
    ordinal: 1,
    sourceSpan: {
      sourcePath: `textbooks/${bookId}/chapter-01/textbook.md`,
      startLine,
      endLine: startLine,
      startByte: 20 + index,
      endByte: 21 + index,
    },
    recordType: 'fragment-anchor',
    schemaVersion: 'structured-textbook-runtime.v2',
  }));
  const navigation = {
    recordType: 'navigation-index',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    entries: [
      {
        unitId: firstId,
        parentId: null,
        childIds: [lastId],
        previousUnitId: null,
        nextUnitId: lastId,
      },
      {
        unitId: lastId,
        parentId: firstId,
        childIds: [],
        previousUnitId: firstId,
        nextUnitId: null,
      },
    ],
  };
  const windows = units.map((unit) => ({
    id: unit.id.replace('textbook-unit:', 'textbook-window:'),
    primaryUnitId: unit.id,
    segments: [{
      owningUnitId: unit.id,
      markdown: unit.markdown,
      sourceSpan: unit.sourceSpan,
    }],
    citationTarget: false,
    recordType: 'retrieval-window',
    schemaVersion: 'structured-textbook-runtime.v2',
  }));
  const manifest = {
    recordType: 'export-manifest',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    edition,
    sourceRevision: `fixture-revision-${bookId}`,
    sourceHashes: {},
    counts: {
      structureUnits: 2,
      fragmentAnchors: 3,
      retrievalWindows: 2,
      navigationEntries: 2,
    },
  };
  await Promise.all([
    writeFile(path.join(bookRoot, 'manifest.json'), JSON.stringify(manifest)),
    writeFile(path.join(bookRoot, 'navigation.json'), JSON.stringify(navigation)),
    writeFile(path.join(bookRoot, 'units.jsonl'), `${units.map((unit) => JSON.stringify(unit)).join('\n')}\n`),
    writeFile(path.join(bookRoot, 'anchors.jsonl'), `${anchors.map((anchor) => JSON.stringify(anchor)).join('\n')}\n`),
    writeFile(path.join(bookRoot, 'windows.jsonl'), `${windows.map((window) => JSON.stringify(window)).join('\n')}\n`),
  ]);
}

beforeAll(async () => {
  runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'act-textbook-reader-'));
  await Promise.all(Object.entries(EDITIONS).map(([bookId, edition]) => writeFixtureBook(bookId, edition)));
});

afterAll(async () => {
  clearTextbookReaderCache();
  await rm(runtimeRoot, { recursive: true, force: true });
});

describe('textbook reader route contract', () => {
  it('accepts safe structural routes and rejects traversal or unknown books', () => {
    expect(parseTextbookRoute({
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      unitPath: ['chapter-chapter-01', 'section-1.1'],
    })).toEqual({
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      unitPath: ['chapter-chapter-01', 'section-1.1'],
    });
    expect(parseTextbookRoute({
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      unitPath: ['..'],
    })).toBeNull();
    expect(parseTextbookRoute({
      bookId: 'unknown-book',
      edition: '1',
      unitPath: ['chapter-1'],
    })).toBeNull();
  });

  it('builds a stable encoded URL with an authored fragment', () => {
    expect(buildTextbookReaderHref({
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      unitPath: ['chapter-chapter-01', 'section-1.1'],
      fragment: 'formula-001',
    })).toBe('/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-01/section-1.1#formula-001');
  });

  it('parses a published textbook reader href', () => {
    expect(parseTextbookReaderHref(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-10/section-10.1',
    )).toEqual({
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      unitPath: ['chapter-chapter-10', 'section-10.1'],
    });
    expect(parseTextbookReaderHref('/learning-resources/act:textbook-section:demo')).toBeNull();
  });
});

describe('textbook reader authorization and loaders', () => {
  it('rejects anonymous and cross-course access before loading content', async () => {
    expect(() => authorizeTextbookAccess({ userId: null })).toThrowError(TextbookReaderError);
    expect(() => authorizeTextbookAccess({
      userId: 'member-1',
      courseId: 'another-course',
    })).toThrowError(TextbookReaderError);
    await expect(loadTextbookReaderProjection({
      userId: null,
      runtimeRoot,
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      unitPath: ['chapter-chapter-01'],
    })).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('loads the authorized catalog without reading textbook bodies', async () => {
    const catalog = await loadTextbookCatalog({ userId: 'member-1', runtimeRoot });
    expect(catalog).toHaveLength(7);
    expect(catalog.map((book) => book.bookId).sort()).toEqual(Object.keys(EDITIONS).sort());
  });

  for (const [bookId, edition] of Object.entries(EDITIONS)) {
    it(`loads the first and last units with previous/next for ${bookId}`, async () => {
      const first = await loadTextbookReaderProjection({
        userId: 'member-1',
        runtimeRoot,
        bookId,
        edition,
        unitPath: ['chapter-chapter-01'],
      });
      expect(first.previous).toBeNull();
      expect(first.next?.title).toBe('末单元');
      expect(first.hierarchy[0]?.children[0]?.title).toBe('末单元');

      const last = await loadTextbookReaderProjection({
        userId: 'member-1',
        runtimeRoot,
        bookId,
        edition,
        unitPath: ['chapter-chapter-01', 'section-final'],
      });
      expect(last.previous?.id).toBe(first.unit.id);
      expect(last.next).toBeNull();
      expect(last.fragments.map((fragment) => fragment.id)).toEqual([
        'figure-001',
        'formula-001',
        'table-001',
      ]);
      expect(last.unit.markdown).toContain('textbook-citation-anchor:figure-001');
      expect(last.unit.markdown).not.toContain('retrieval-window');
    });
  }

  it('fails closed for edition and structural-path mismatches', async () => {
    await expect(loadTextbookReaderProjection({
      userId: 'member-1',
      runtimeRoot,
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第七版',
      unitPath: ['chapter-chapter-01'],
    })).rejects.toMatchObject({ code: 'not-found' });
    await expect(loadTextbookReaderProjection({
      userId: 'member-1',
      runtimeRoot,
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      unitPath: ['chapter-chapter-01', 'missing'],
    })).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('textbook authored content helpers', () => {
  it('inserts fragment markers at source-relative lines', () => {
    const markdown = insertTextbookFragmentMarkers('one\ntwo\nthree', 20, [{
      id: 'unit#table-001',
      sourceSpan: {
        sourcePath: 'textbook.md',
        startLine: 21,
        endLine: 21,
        startByte: 4,
        endByte: 7,
      },
    }]);
    expect(markdown).toContain('two [[textbook-citation-anchor:table-001]]');
  });

  it('preserves a GFM table when fragment anchors fall on table lines', () => {
    const source = [
      '| 参数 | 数值 |',
      '| --- | --- |',
      ...Array.from({ length: 20 }, (_, index) => `| K${index + 1} | ${index + 1} |`),
    ].join('\n');
    const marked = insertTextbookFragmentMarkers(source, 1, [
      {
        id: 'unit#table-001',
        sourceSpan: {
          sourcePath: 'textbook.md',
          startLine: 2,
          endLine: 2,
          startByte: 12,
          endByte: 23,
        },
      },
      {
        id: 'unit#formula-001',
        sourceSpan: {
          sourcePath: 'textbook.md',
          startLine: 10,
          endLine: 10,
          startByte: 70,
          endByte: 78,
        },
      },
    ]);
    const render = (markdown: string) => renderToStaticMarkup(createElement(RuntimeMarkdownContent, {
      markdown,
      resolveAssetHref: (href: string) => href,
      mode: 'textbook-citation',
    }));
    const sourceHtml = render(source);
    const markedHtml = render(marked);

    expect(markedHtml.match(/<tr/g)).toHaveLength(sourceHtml.match(/<tr/g)?.length ?? 0);
    expect(markedHtml.match(/<tr/g)).toHaveLength(21);
    expect(markedHtml).toContain('data-textbook-citation-anchor="table-001"');
    expect(markedHtml).toContain('data-textbook-citation-anchor="formula-001"');

    const compactSource = [
      '参数 | 数值',
      '--- | ---',
      'K1 | 1',
      'K2 | 2',
    ].join('\n');
    const compactMarked = insertTextbookFragmentMarkers(compactSource, 1, [{
      id: 'unit#formula-002',
      sourceSpan: {
        sourcePath: 'textbook.md',
        startLine: 3,
        endLine: 3,
        startByte: 18,
        endByte: 24,
      },
    }]);
    const compactHtml = render(compactMarked);
    expect(compactHtml.match(/<tr/g)).toHaveLength(3);
    expect(compactHtml).toContain('data-textbook-citation-anchor="formula-002"');
  });

  it('maps unit-local assets to the governed legacy asset route', () => {
    expect(resolveTextbookUnitAssetHref({
      href: 'assets/figure 1.png',
      bookId: 'hu-shousong-auto-control-8th',
      chapterId: 'chapter-03',
    })).toBe('/course-runtime/resources/textbooks/hu-shousong-auto-control-8th/assets/chapter-03/figure%201.png');
    expect(resolveTextbookUnitAssetHref({
      href: '../../private.json',
      bookId: 'hu-shousong-auto-control-8th',
      chapterId: 'chapter-03',
    })).toBe('');
  });
});

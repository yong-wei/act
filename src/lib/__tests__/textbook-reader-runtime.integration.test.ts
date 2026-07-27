import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import {
  clearTextbookReaderCache,
  loadTextbookReaderProjection,
  TEXTBOOK_TITLES,
} from '@/lib/textbook-reader';

const RUNTIME_ROOT = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbooks-v2',
);

interface RuntimeUnitSample {
  id: string;
  structuralPath: string[];
}

async function firstJsonlRow<T>(filePath: string): Promise<T> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    lines.close();
    return JSON.parse(line) as T;
  }
  throw new Error(`empty-jsonl:${path.basename(filePath)}`);
}

async function sampleUnits(filePath: string, anchorOwnerId: string): Promise<{
  first: RuntimeUnitSample;
  last: RuntimeUnitSample;
  anchorOwner: RuntimeUnitSample;
}> {
  let first: RuntimeUnitSample | null = null;
  let last: RuntimeUnitSample | null = null;
  let anchorOwner: RuntimeUnitSample | null = null;
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const unit = JSON.parse(line) as RuntimeUnitSample;
    first ??= unit;
    last = unit;
    if (unit.id === anchorOwnerId) anchorOwner = unit;
  }
  if (!first || !last || !anchorOwner) throw new Error(`invalid-unit-sample:${path.basename(filePath)}`);
  return { first, last, anchorOwner };
}

async function findUnit(filePath: string, structuralPath: readonly string[]): Promise<RuntimeUnitSample & {
  markdown: string;
}> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const unit = JSON.parse(line) as RuntimeUnitSample & { markdown: string };
    if (unit.structuralPath.join('/') === structuralPath.join('/')) {
      lines.close();
      return unit;
    }
  }
  throw new Error(`missing-unit:${structuralPath.join('/')}`);
}

describe.runIf(existsSync(RUNTIME_ROOT))('generated textbook v2 reader integration', () => {
  it('resolves first, last, and anchored units across all seven runtime books', async () => {
    for (const bookId of Object.keys(TEXTBOOK_TITLES).sort()) {
      const bookRoot = path.join(RUNTIME_ROOT, bookId);
      const manifest = JSON.parse(await readFile(path.join(bookRoot, 'manifest.json'), 'utf8')) as {
        edition: string;
      };
      const firstAnchor = await firstJsonlRow<{ owningUnitId: string; id: string }>(
        path.join(bookRoot, 'anchors.jsonl'),
      );
      const units = await sampleUnits(path.join(bookRoot, 'units.jsonl'), firstAnchor.owningUnitId);

      const first = await loadTextbookReaderProjection({
        userId: 'runtime-verifier',
        runtimeRoot: RUNTIME_ROOT,
        bookId,
        edition: manifest.edition,
        unitPath: units.first.structuralPath,
      });
      const last = await loadTextbookReaderProjection({
        userId: 'runtime-verifier',
        runtimeRoot: RUNTIME_ROOT,
        bookId,
        edition: manifest.edition,
        unitPath: units.last.structuralPath,
      });
      const anchored = await loadTextbookReaderProjection({
        userId: 'runtime-verifier',
        runtimeRoot: RUNTIME_ROOT,
        bookId,
        edition: manifest.edition,
        unitPath: units.anchorOwner.structuralPath,
      });

      expect(first.previous, `${bookId}:first.previous`).toBeNull();
      expect(last.next, `${bookId}:last.next`).toBeNull();
      expect(anchored.fragments.length, `${bookId}:anchor count`).toBeGreaterThan(0);
      expect(
        anchored.unit.markdown,
        `${bookId}:fragment marker`,
      ).toContain(firstAnchor.id.slice(firstAnchor.id.lastIndexOf('#') + 1));
    }
    clearTextbookReaderCache();
  }, 60_000);

  it('keeps the Dorf section 2.2 GFM table intact after marker injection', async () => {
    const bookId = 'dorf-modern-control-systems';
    const bookRoot = path.join(RUNTIME_ROOT, bookId);
    const manifest = JSON.parse(await readFile(path.join(bookRoot, 'manifest.json'), 'utf8')) as {
      edition: string;
    };
    const structuralPath = ['chapter-chapter-02', 'section-2.2'];
    const sourceUnit = await findUnit(path.join(bookRoot, 'units.jsonl'), structuralPath);
    const projection = await loadTextbookReaderProjection({
      userId: 'runtime-verifier',
      runtimeRoot: RUNTIME_ROOT,
      bookId,
      edition: manifest.edition,
      unitPath: structuralPath,
    });
    const render = (markdown: string) => renderToStaticMarkup(createElement(RuntimeMarkdownContent, {
      markdown,
      resolveAssetHref: (href: string) => href,
      mode: 'textbook-citation',
    }));
    const sourceRows = render(sourceUnit.markdown).match(/<tr/g)?.length ?? 0;
    const projectedHtml = render(projection.unit.markdown);

    expect(sourceRows).toBe(22);
    expect(projectedHtml.match(/<tr/g)).toHaveLength(sourceRows);
    for (const fragment of projection.fragments) {
      expect(projectedHtml).toContain(`data-textbook-citation-anchor="${fragment.id}"`);
    }
  }, 30_000);
});

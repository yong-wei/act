import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  MAX_COURSE_BASIS_EXTRACTED_CHARS,
  MAX_COURSE_BASIS_PDF_PAGES,
  MAX_COURSE_BASIS_SEGMENTS,
  extractCourseBasisSource,
} from '../extraction';

describe('course-basis extraction', () => {
  it('creates stable heading and paragraph anchors for repeated Markdown extraction', async () => {
    const source = {
      sourceType: 'MARKDOWN' as const,
      sourceName: 'standard.md',
      mimeType: 'text/markdown',
      content: '# Root Locus\n\nFirst paragraph.\n\n## Rules\n\nSecond paragraph.\n\n## Rules\n\nThird paragraph.',
    };

    const first = await extractCourseBasisSource(source);
    const second = await extractCourseBasisSource(source);

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.segments).toEqual(second.segments);
    expect(first.segments.map((segment) => segment.stableAnchor)).toEqual([
      'h1:root-locus/paragraph:1',
      'h1:root-locus/h2:rules/paragraph:1',
      'h1:root-locus/h2:rules-2/paragraph:1',
    ]);
    expect(new Set(first.segments.map((segment) => segment.contentHash)).size).toBe(3);
  });

  it('keeps skipped Markdown heading levels dense and accepts MIME charset parameters', async () => {
    const result = await extractCourseBasisSource({
      sourceType: 'MARKDOWN',
      sourceName: 'outline.md',
      mimeType: 'text/markdown; charset=utf-8',
      content: '# Course\n\nIntro.\n\n### Topic\n\nDetail.',
    });

    expect(result.segments.map((segment) => segment.headingPath)).toEqual([
      ['Course'],
      ['Course', 'Topic'],
    ]);
    expect(result.segments[1].stableAnchor).toBe('h1:course/h3:topic/paragraph:1');
  });

  it('disambiguates distinct headings that normalize to the same anchor slug', async () => {
    const result = await extractCourseBasisSource({
      sourceType: 'MARKDOWN',
      sourceName: 'colliding-headings.md',
      mimeType: 'text/markdown',
      content: '# A B\n\nFirst.\n\n# A-B\n\nSecond.',
    });

    expect(result.segments.map((segment) => segment.stableAnchor)).toEqual([
      'h1:a-b/paragraph:1',
      'h1:a-b-2/paragraph:1',
    ]);
  });

  it('extracts searchable PDF text into stable page and paragraph anchors', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const first = pdf.addPage();
    first.drawText('Root locus definition', { x: 40, y: 700, font });
    const second = pdf.addPage();
    second.drawText('Angle criterion', { x: 40, y: 700, font });
    const content = await pdf.save();

    const result = await extractCourseBasisSource({
      sourceType: 'SEARCHABLE_PDF',
      sourceName: 'textbook.pdf',
      mimeType: 'application/pdf',
      content,
    });

    expect(result.extractionState).toBe('EXTRACTED');
    expect(result.segments.map((segment) => [segment.stableAnchor, segment.text])).toEqual([
      ['page:1/paragraph:1', 'Root locus definition'],
      ['page:2/paragraph:1', 'Angle criterion'],
    ]);
  });

  it('marks an empty or scan-only PDF unsupported without OCR', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();

    const result = await extractCourseBasisSource({
      sourceType: 'SEARCHABLE_PDF',
      sourceName: 'scan.pdf',
      mimeType: 'application/pdf',
      content: await pdf.save(),
    });

    expect(result).toMatchObject({
      extractionState: 'UNSUPPORTED',
      failureReason: 'scan-or-empty-text-layer',
      normalizedText: null,
      segments: [],
    });
  });

  it('rejects malformed PDF data with an explicit extraction error', async () => {
    await expect(extractCourseBasisSource({
      sourceType: 'SEARCHABLE_PDF',
      sourceName: 'broken.pdf',
      mimeType: 'application/pdf',
      content: new TextEncoder().encode('%PDF-not-a-document'),
    })).rejects.toMatchObject({ code: 'pdf-extraction-failed' });
  });

  it('rejects PDFs over the page limit before extracting page text', async () => {
    const pdf = await PDFDocument.create();
    for (let index = 0; index <= MAX_COURSE_BASIS_PDF_PAGES; index += 1) pdf.addPage();

    await expect(extractCourseBasisSource({
      sourceType: 'SEARCHABLE_PDF',
      sourceName: 'too-many-pages.pdf',
      mimeType: 'application/pdf',
      content: await pdf.save(),
    })).rejects.toMatchObject({
      code: 'pdf-page-limit-exceeded',
      details: [String(MAX_COURSE_BASIS_PDF_PAGES)],
    });
  });

  it('rejects excessive segment counts and aggregate extracted text', async () => {
    await expect(extractCourseBasisSource({
      sourceType: 'PLAIN_TEXT',
      sourceName: 'too-many-segments.txt',
      mimeType: 'text/plain',
      content: Array.from({ length: MAX_COURSE_BASIS_SEGMENTS + 1 }, () => 'x').join('\n\n'),
    })).rejects.toMatchObject({ code: 'segment-limit-exceeded' });

    const paragraph = 'x'.repeat(50_000);
    const paragraphCount = Math.floor(MAX_COURSE_BASIS_EXTRACTED_CHARS / paragraph.length) + 1;
    await expect(extractCourseBasisSource({
      sourceType: 'PLAIN_TEXT',
      sourceName: 'too-much-text.txt',
      mimeType: 'text/plain',
      content: Array.from({ length: paragraphCount }, () => paragraph).join('\n\n'),
    })).rejects.toMatchObject({ code: 'extracted-text-limit-exceeded' });
  });

  it('rejects unsupported declarations and detected binary mismatches', async () => {
    await expect(extractCourseBasisSource({
      sourceType: 'DOCX' as 'PLAIN_TEXT',
      sourceName: 'source.docx',
      mimeType: 'application/octet-stream',
      content: 'not supported',
    })).rejects.toMatchObject({ code: 'unsupported-source-type' });

    await expect(extractCourseBasisSource({
      sourceType: 'PLAIN_TEXT',
      sourceName: 'source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: 'not supported',
    })).rejects.toMatchObject({ code: 'unsupported-source-type' });

    await expect(extractCourseBasisSource({
      sourceType: 'PLAIN_TEXT',
      sourceName: 'fake.txt',
      mimeType: 'text/plain',
      content: new Uint8Array([0, 1, 2]),
    })).rejects.toMatchObject({ code: 'mime-content-mismatch' });
  });
});

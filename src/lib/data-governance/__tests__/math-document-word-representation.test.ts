import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { createLocalDocumentConverter } from '../math-document-conversion';
import {
  createWordDualRepresentation,
  detectSubmissionDocumentFormat,
  type PdfPageRepresentation,
} from '../math-document-word-representation';

const fakePdf = Buffer.from('%PDF-1.7\nsynthetic');

describe('Word submission format detection', () => {
  it('detects a valid DOCX package independently of MIME claims', async () => {
    const bytes = await buildDocx();
    await expect(detectSubmissionDocumentFormat({
      bytes,
      fileName: 'answer.docx',
      mimeType: 'application/octet-stream',
    })).resolves.toMatchObject({ claimedFormat: 'docx', detectedFormat: 'docx', supported: true });
  });

  it.each([
    ['answer.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('%PDF-1.7'), 'word-format-mismatch'],
    ['answer.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', legacyDocBytes(), 'word-format-mismatch'],
    ['answer.doc', 'application/msword', legacyWpsBytes(), 'word-format-mismatch'],
    ['answer.wps', 'application/vnd.ms-works', Buffer.from('WPS Office'), 'word-format-wps-unsupported'],
  ])('rejects disguised or unsupported input %s', async (fileName, mimeType, bytes, code) => {
    await expect(createWordDualRepresentation({
      sourceBytes: bytes,
      fileName,
      mimeType,
      expectedQuestionIds: ['T1-1'],
      adapter: adapter(),
    })).rejects.toMatchObject({ code });
  });
});

describe('Word dual representation', () => {
  it('is exposed through the existing local document converter', async () => {
    const docx = await buildDocx({ paragraphs: ['<w:p><w:r><w:t>T1-1 已作答。</w:t></w:r></w:p>'] });
    let renderArgs: readonly string[] = [];
    const converter = createLocalDocumentConverter({
      exec: (async (_command: string, args: readonly string[]) => {
        if (args[0] === '--version') return { stdout: 'LibreOffice 24.2.0.3', stderr: '' };
        renderArgs = args;
        const outdir = args[args.indexOf('--outdir') + 1];
        await writeFile(join(outdir, 'answer.pdf'), fakePdf);
        return { stdout: '', stderr: '' };
      }) as never,
      wordPdfPageExtractor: async () => [{ pageNumber: 1, text: 'T1-1 已作答。', imageCount: 0 }],
    });
    const result = await converter.convert({
      bytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
    });

    expect(result).toMatchObject({
      state: 'succeeded',
      renderedMimeType: 'application/pdf',
      wordRepresentation: {
        sourceFormat: 'docx',
        normalizerVersion: null,
        rendererVersion: 'LibreOffice 24.2.0.3',
        integrity: { verdict: 'scorable' },
      },
    });
    expect(renderArgs[0]).toMatch(/^-env:UserInstallation=file:/);
    expect(renderArgs[1]).toBe('--headless');
  });

  it('normalizes legacy DOC and preserves source-to-normalized-to-PDF lineage', async () => {
    const normalizedDocx = await buildDocx({
      paragraphs: ['<w:p><w:r><w:t>T1-1 答案稳定。</w:t></w:r></w:p>'],
    });
    const sourceBytes = legacyDocBytes();
    const result = await createWordDualRepresentation({
      sourceBytes,
      fileName: 'answer.doc',
      mimeType: 'application/msword',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ normalizedDocx, pages: [{ pageNumber: 1, text: 'T1-1 答案稳定。', imageCount: 0 }] }),
    });

    expect(result).toMatchObject({
      sourceFormat: 'doc',
      normalizedFormat: 'docx',
      sourceChecksum: sha256(sourceBytes),
      normalizedChecksum: sha256(normalizedDocx),
      renderedPdfChecksum: sha256(fakePdf),
      normalizerVersion: 'LibreOffice test.1',
      rendererVersion: 'LibreOffice test.1',
      integrity: { verdict: 'scorable' },
    });
    expect(result.normalizedDocxBytes).toEqual(normalizedDocx);
    expect(result.blocks[0]).toMatchObject({ pageNumber: 1, precision: 'page' });
  });

  it('preserves OMML and image bytes with question context and verified PDF page anchors', async () => {
    const imageBytes = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
    const docx = await buildDocx({
      paragraphs: [
        '<w:p><w:r><w:t>T1-1 计算：</w:t></w:r><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></w:p>',
        '<w:p><w:r><w:t>MATLAB 曲线如下。</w:t></w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:p>',
      ],
      relationships: [{ id: 'rId5', target: 'media/image1.png' }],
      files: { 'word/media/image1.png': imageBytes },
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1 计算： x=1 MATLAB 曲线如下。', imageCount: 1 }] }),
    });

    expect(result.formulas).toHaveLength(1);
    expect(result.formulas[0]).toMatchObject({ questionId: 'T1-1', text: 'x=1' });
    expect(result.formulas[0].omml).toContain('m:oMath');
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({ questionId: 'T1-1', path: 'word/media/image1.png', checksum: sha256(imageBytes) });
    expect(result.images[0].bytes).toEqual(imageBytes);
    expect(result.imageAnchors).toEqual([expect.objectContaining({ imageId: result.images[0].id, pdfPageNumber: 1, verified: true, mappingMethod: 'rendered-image-order' })]);
    expect(result.anchors.every((anchor) => anchor.pdfPageNumber === 1 && anchor.verified)).toBe(true);
    expect(result.integrity.verdict).toBe('scorable');
  });

  it('maps a formula-only continuation into Markdown and a physical PDF region', async () => {
    const docx = await buildDocx({
      paragraphs: [
        '<w:p><w:r><w:t>T1-1 计算：</w:t></w:r></w:p>',
        '<w:p><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></w:p>',
      ],
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'formula-only.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [page(1, 'T1-1 计算： x=1', [
        { text: 'T1-1 计算：', bbox: [20, 700, 130, 716] },
        { text: 'x=1', bbox: [20, 670, 52, 686] },
      ])] }),
    });

    expect(result.markdown).toContain('x=1');
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'x=1', questionId: 'T1-1', pageNumber: 1, bbox: [20, 670, 52, 686] }),
    ]));
  });

  it('maps an unambiguous numbered question label and does not carry a prior question across an ambiguous label', async () => {
    const docx = await buildDocx({ paragraphs: [
      '<w:p><w:r><w:t>T1-1 第一问作答。</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>2. 第二问作答。</w:t></w:r></w:p>',
    ] });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'numbered.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2'],
      adapter: adapter({ pages: [page(1, 'T1-1 第一问作答。 2. 第二问作答。', [
        { text: 'T1-1 第一问作答。', bbox: [20, 700, 170, 716] },
        { text: '2. 第二问作答。', bbox: [20, 660, 150, 676] },
      ])] }),
    });

    expect(result.blocks.map((block) => block.questionId)).toEqual(['T1-1', 'T1-2']);
    expect(result.questionStates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'T1-2', selectedBlockIds: ['word-block-2'] }),
    ]));

    const ambiguous = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'ambiguous-numbered.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2', 'O2-2'],
      adapter: adapter({ pages: [page(1, 'T1-1 第一问作答。 2. 第二问作答。', [
        { text: 'T1-1 第一问作答。', bbox: [20, 700, 170, 716] },
        { text: '2. 第二问作答。', bbox: [20, 660, 150, 676] },
      ])] }),
    });
    expect(ambiguous.blocks.map((block) => block.questionId)).toEqual(['T1-1', null]);
  });

  it('selects a paragraph-order fallback region for a low-confidence question', async () => {
    const docx = await buildDocx({ paragraphs: ['<w:p><w:r><w:t>T1-1 答案未能逐字匹配。</w:t></w:r></w:p>'] });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'fallback.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [page(1, '版面文本已损坏', [])] }),
    });

    expect(result.questionStates).toContainEqual(expect.objectContaining({
      questionId: 'T1-1', selectedBlockIds: ['word-block-1'], mappingDecision: 'paragraph-order-fallback', mappingConfidence: 0.68,
    }));
  });

  it('preserves conflicting text and image signals and routes the affected question to review', async () => {
    const docx = await buildDocx({
      paragraphs: ['<w:p><w:r><w:t>T1-1 文本结论稳定。</w:t></w:r></w:p>'],
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      crossModalSignals: [{ questionId: 'T1-1', consistent: false }],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1 文本结论稳定。', imageCount: 0 }] }),
    });

    expect(result.integrity).toMatchObject({ verdict: 'review' });
    expect(result.integrity.issues).toContainEqual(expect.objectContaining({ code: 'text-image-conflict', questionId: 'T1-1' }));
    expect(result.questionStates).toContainEqual(expect.objectContaining({ questionId: 'T1-1', state: 'review-required' }));
  });

  it('keeps reliable questions scorable while missing or unmapped questions require confirmation', async () => {
    const docx = await buildDocx({
      paragraphs: [
        '<w:p><w:r><w:t>T1-1 已作答。</w:t></w:r></w:p>',
        '<w:p><w:r><w:t>补充说明。</w:t></w:r></w:p>',
      ],
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1 已作答。补充说明。', imageCount: 0 }] }),
    });

    expect(result.questionStates).toContainEqual(expect.objectContaining({ questionId: 'T1-1', state: 'scorable' }));
    expect(result.questionStates).toContainEqual(expect.objectContaining({ questionId: 'T1-2', state: 'review-required', reasons: ['answer-not-found'] }));
    expect(result.integrity.verdict).toBe('review');
  });

  it('assigns an answers-only document only when exactly one expected question exists', async () => {
    const docx = await buildDocx({ paragraphs: ['<w:p><w:r><w:t>系统最终稳定。</w:t></w:r></w:p>'] });
    const single = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: '系统最终稳定。', imageCount: 0 }] }),
    });
    const multiple = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: '系统最终稳定。', imageCount: 0 }] }),
    });

    expect(single.paragraphs[0].questionId).toBe('T1-1');
    expect(single.integrity.verdict).toBe('scorable');
    expect(multiple.paragraphs[0].questionId).toBeNull();
    expect(multiple.integrity.issues).toContainEqual(expect.objectContaining({ code: 'question-mapping-unresolved' }));
  });

  it('keeps a single-question document assigned when its answer mentions another question identifier', async () => {
    const docx = await buildDocx({ paragraphs: ['<w:p><w:r><w:t>比较 T1-2 的结果后，本题结论保持稳定。</w:t></w:r></w:p>'] });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: '比较 T1-2 的结果后，本题结论保持稳定。', imageCount: 0 }] }),
    });

    expect(result.paragraphs[0]?.questionId).toBe('T1-1');
    expect(result.questionStates).toContainEqual(expect.objectContaining({ questionId: 'T1-1', state: 'scorable' }));
  });

  it('persists deterministic PDF regions for cross-page answer areas without crossing major questions', async () => {
    const docx = await buildDocx({
      paragraphs: [
        '<w:p><w:r><w:t>T1-1 第一问作答。</w:t></w:r></w:p>',
        '<w:p><w:r><w:t>比较 T1-2 的结果后，第一问结论不变。</w:t></w:r></w:p>',
        '<w:p><w:r><w:t>T1-2 第二问作答。</w:t></w:r></w:p>',
      ],
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2'],
      adapter: adapter({ pages: [
        page(1, 'T1-1 第一问作答。', [{ text: 'T1-1 第一问作答。', bbox: [20, 700, 160, 716] }]),
        page(2, '比较 T1-2 的结果后，第一问结论不变。 T1-2 第二问作答。', [
          { text: '比较 T1-2 的结果后，第一问结论不变。', bbox: [20, 680, 260, 696] },
          { text: 'T1-2 第二问作答。', bbox: [20, 620, 160, 636] },
        ]),
      ] }),
    });

    expect(result.renderedPdfPageCount).toBe(2);
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'T1-1', pageNumber: 1, bbox: [20, 700, 160, 716], confidence: 0.96 }),
      expect.objectContaining({ questionId: 'T1-1', pageNumber: 2, bbox: [20, 680, 260, 696], confidence: 0.96 }),
      expect.objectContaining({ questionId: 'T1-2', pageNumber: 2, bbox: [20, 620, 160, 636], confidence: 0.96 }),
    ]));
    expect(result.questionStates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'T1-1', candidateBlockIds: ['word-block-1', 'word-block-2'], selectedBlockIds: ['word-block-1'], mappingDecision: 'pdf-text-region-match' }),
      expect.objectContaining({ questionId: 'T1-2', candidateBlockIds: ['word-block-3'], selectedBlockIds: ['word-block-3'], mappingDecision: 'pdf-text-region-match' }),
    ]));
  });

  it('routes overlapping regions from different questions to review without changing their authoritative IDs', async () => {
    const docx = await buildDocx({ paragraphs: [
      '<w:p><w:r><w:t>T1-1 第一问作答。</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>T1-2 第二问作答。</w:t></w:r></w:p>',
    ] });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1', 'T1-2'],
      adapter: adapter({ pages: [page(1, 'T1-1 第一问作答。 T1-2 第二问作答。', [
        { text: 'T1-1 第一问作答。', bbox: [20, 680, 180, 710] },
        { text: 'T1-2 第二问作答。', bbox: [100, 660, 260, 690] },
      ])] }),
    });

    expect(result.blocks.map((block) => block.questionId)).toEqual(['T1-1', 'T1-2']);
    expect(result.integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'question-region-overlap', questionId: 'T1-1' }),
      expect.objectContaining({ code: 'question-region-overlap', questionId: 'T1-2' }),
    ]));
    expect(result.questionStates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'T1-1', state: 'review-required' }),
      expect.objectContaining({ questionId: 'T1-2', state: 'review-required' }),
    ]));
  });

  it('leaves image page anchors unresolved when rendered image cardinality differs', async () => {
    const docx = await buildDocx({
      paragraphs: ['<w:p><w:r><w:t>T1-1 图像证据。</w:t></w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:p>'],
      relationships: [{ id: 'rId5', target: 'media/image1.png' }],
      files: { 'word/media/image1.png': Buffer.from([137, 80, 78, 71]) },
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1 图像证据。', imageCount: 0 }] }),
    });

    expect(result.imageAnchors).toEqual([expect.objectContaining({ pdfPageNumber: null, verified: false, mappingMethod: 'unresolved' })]);
    expect(result.integrity.issues).toContainEqual(expect.objectContaining({ code: 'rendered-image-missing', severity: 'review' }));
  });

  it('blocks image-only scanned documents and reviews missing rendered text anchors', async () => {
    const scanned = await buildDocx({
      paragraphs: ['<w:p><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:p>'],
      relationships: [{ id: 'rId5', target: 'media/scan.png' }],
      files: { 'word/media/scan.png': Buffer.from([137, 80, 78, 71]) },
    });
    const scannedResult = await createWordDualRepresentation({
      sourceBytes: scanned,
      fileName: 'scan.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: '', imageCount: 1 }] }),
    });
    expect(scannedResult.integrity).toMatchObject({ verdict: 'blocked' });
    expect(scannedResult.integrity.issues).toContainEqual(expect.objectContaining({ code: 'scanned-document-unsupported' }));

    const labeledScan = await buildDocx({
      paragraphs: ['<w:p><w:r><w:t>T1-1</w:t></w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:p>'],
      relationships: [{ id: 'rId5', target: 'media/scan.png' }],
      files: { 'word/media/scan.png': Buffer.from([137, 80, 78, 71]) },
    });
    const labeledScanResult = await createWordDualRepresentation({
      sourceBytes: labeledScan,
      fileName: 'scan.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1', imageCount: 1 }] }),
    });
    expect(labeledScanResult.integrity).toMatchObject({ verdict: 'blocked' });
    expect(labeledScanResult.integrity.issues).toContainEqual(expect.objectContaining({ code: 'scanned-document-unsupported' }));

    const truncated = await buildDocx({ paragraphs: ['<w:p><w:r><w:t>T1-1 完整长答案。</w:t></w:r></w:p>'] });
    const truncatedResult = await createWordDualRepresentation({
      sourceBytes: truncated,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1', imageCount: 0 }] }),
    });
    expect(truncatedResult.integrity).toMatchObject({ verdict: 'review' });
    expect(truncatedResult.integrity.issues).toContainEqual(expect.objectContaining({ code: 'pdf-text-anchor-unresolved' }));
  });

  it('reviews corrupt formulas and missing image targets without inventing precise anchors', async () => {
    const docx = await buildDocx({
      paragraphs: [
        '<w:p><w:r><w:t>T1-1</w:t></w:r><m:oMath><m:r><m:t>�</m:t></m:r></m:oMath></w:p>',
        '<w:p><w:r><w:t>曲线</w:t></w:r><w:drawing><a:blip r:embed="rId404"/></w:drawing></w:p>',
      ],
    });
    const result = await createWordDualRepresentation({
      sourceBytes: docx,
      fileName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedQuestionIds: ['T1-1'],
      adapter: adapter({ pages: [{ pageNumber: 1, text: 'T1-1 曲线', imageCount: 0 }] }),
    });

    expect(result.integrity.verdict).toBe('review');
    expect(result.integrity.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'formula-content-invalid',
      'image-relationship-missing',
    ]));
    expect(result.anchors.some((anchor) => !anchor.verified && anchor.precision === 'block')).toBe(true);
  });
});

function adapter(options: {
  normalizedDocx?: Buffer;
  pages?: PdfPageRepresentation[];
} = {}) {
  return {
    wordProcessorVersion: 'LibreOffice test.1',
    normalizeLegacyDoc: async () => {
      if (!options.normalizedDocx) throw new Error('normalizer-not-configured');
      return options.normalizedDocx;
    },
    renderPdf: async () => fakePdf,
    extractPdfPages: async () => options.pages ?? [{ pageNumber: 1, text: '', imageCount: 0 }],
  };
}

function page(pageNumber: number, text: string, textItems: Array<{ text: string; bbox: [number, number, number, number] }>): PdfPageRepresentation {
  return {
    pageNumber,
    text,
    imageCount: 0,
    pageWidth: 612,
    pageHeight: 792,
    rotation: 0,
    textItems,
  };
}

async function buildDocx(options: {
  paragraphs?: string[];
  relationships?: Array<{ id: string; target: string }>;
  files?: Record<string, Buffer>;
} = {}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Default Extension="png" ContentType="image/png"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '</Types>',
  ].join(''));
  zip.file('_rels/.rels', [
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '</Relationships>',
  ].join(''));
  zip.file('word/document.xml', [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:body>',
    ...(options.paragraphs ?? ['<w:p><w:r><w:t>T1-1 合成答案。</w:t></w:r></w:p>']),
    '</w:body></w:document>',
  ].join(''));
  if (options.relationships) {
    zip.file('word/_rels/document.xml.rels', [
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      ...options.relationships.map((relationship) => (
        `<Relationship Id="${relationship.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${relationship.target}"/>`
      )),
      '</Relationships>',
    ].join(''));
  }
  for (const [path, bytes] of Object.entries(options.files ?? {})) zip.file(path, bytes);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function legacyDocBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(64),
    Buffer.from('WordDocument', 'utf16le'),
  ]);
}

function legacyWpsBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(64),
    Buffer.from('WPS Document', 'utf16le'),
  ]);
}

function sha256(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

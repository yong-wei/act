import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import { degrees, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import { buildReviewedDerivativePlan } from '../teacher-assignment-review-derivative';
import { renderFrozenPdfDerivative, S3AnnotatedMarkdownDerivativeRenderer } from '../teacher-assignment-review-derivative-storage';
import { createMathpixClient, mathpixToConversionResult, toAnswerEvidence } from '../math-document-conversion';
import { buildPersistedAnswerEvidenceBlocks } from '../math-document-grading-persistence';

const options = { generatorId: 'native-s3', generatorVersion: '1', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'] as const };

describe('reviewed derivative native storage', () => {
  it('uses the converted canonical PDF for a Word submission and appends its feedback summary', async () => {
    const word = await makeDocx('x = -1, then verify');
    const canonical = await PDFDocument.create(); canonical.addPage([300, 400]);
    const canonicalPdf = new Uint8Array(await canonical.save());
    const snapshot: any = makeSnapshot(word, 'private/source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      precision: 'SPAN', spanStart: 4, spanEnd: 6,
    });
    snapshot.answerEvidence.conversion = canonicalConversion(canonicalPdf);
    const { renderer, put, send } = rendererFor({ 'grading-rendered/conversion-1.pdf': canonicalPdf });

    const result = await renderer.render(buildReviewedDerivativePlan(snapshot, options));

    expect(result).toMatchObject({ outputKind: 'REVIEWED_PDF', outputMimeType: 'application/pdf', nativeCapable: false });
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toMatchObject({ Bucket: 'private-submissions', Key: 'grading-rendered/conversion-1.pdf' });
    const output = await PDFDocument.load(putBody(put));
    expect(output.getPageCount()).toBe(2);
    expect((put.mock.calls[0][0] as PutObjectCommand).input.ContentType).toBe('application/pdf');
  });

  it('adds a same-page sidebar for a reliable block anchor from a Word conversion', async () => {
    const word = await makeDocx('x = -1, then verify');
    const canonical = await PDFDocument.create(); canonical.addPage([300, 400]);
    const canonicalPdf = new Uint8Array(await canonical.save());
    const snapshot: any = makeSnapshot(word, 'private/source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      precision: 'BLOCK', blockId: 'block-1', pageNumber: 1,
    });
    snapshot.answerEvidence.precision = 'BLOCK';
    snapshot.answerEvidence.blocks = [{ id: 'block-1', pageNumber: 1 }];
    snapshot.answerEvidence.conversion = canonicalConversion(canonicalPdf);
    const { renderer, put } = rendererFor({ 'grading-rendered/conversion-1.pdf': canonicalPdf });

    await renderer.render(buildReviewedDerivativePlan(snapshot, options));

    const output = await PDFDocument.load(putBody(put));
    expect(output.getPage(0).getWidth()).toBeGreaterThan(300);
    const annotations = output.getPage(0).node.lookup(PDFName.of('Annots')) as any;
    expect(annotations?.size() ?? 0).toBe(0);
  });

  it('renders deduction feedback visually without native PDF comment icons', async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const provenance = { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 300, pageHeight: 400, rotation: 0 };
    const snapshot: any = makeSnapshot(source, 'private/source.pdf', 'application/pdf', {
      precision: 'BLOCK', blockId: 'page-1', pageNumber: 1, bbox: [10, 20, 100, 50], coordinateProvenance: provenance,
    });
    snapshot.answerEvidence.precision = 'BLOCK';
    snapshot.answerEvidence.blocks = [{ id: 'page-1', pageNumber: 1, bbox: [10, 20, 100, 50], precision: 'BLOCK', coordinateProvenance: provenance }];
    const { renderer, put } = rendererFor(source);

    await renderer.render(buildReviewedDerivativePlan(snapshot, options));

    const output = putBody(put);
    const parsed = await PDFDocument.load(output);
    const annots = parsed.getPage(0).node.lookup(PDFName.of('Annots')) as any;
    expect(annots?.size() ?? 0).toBe(0);
  });

  it('preserves Chinese text on the generated summary page', async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const rendered = await renderFrozenPdfDerivative({
      source,
      annotations: [],
      summaryLines: ['总体评价：过程清晰，结论正确。'],
      identity: 'summary-cjk-test',
    });

    const text = (await pdfText(rendered.bytes, rendered.summaryPageNumber ?? 2)).replace(/\s+/g, '');
    expect(text).toContain('过程清晰');
    expect(text).toContain('结论正确');
  });

  it('wraps long overall feedback inside the generated summary page', async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const rendered = await renderFrozenPdfDerivative({
      source,
      annotations: [],
      summaryLines: ['总体评价：学生在参数计算和理论解释方面表现良好，能够准确推导自然频率和阻尼比，并清晰阐述时域与频域的对应关系。'],
      identity: 'summary-wrap-test',
    });

    const text = (await pdfText(rendered.bytes, rendered.summaryPageNumber ?? 2)).replace(/\s+/g, '');
    expect(text).toContain('对应关系。');
  });

  it('uses overall-evaluation pages and continues long feedback without truncation', async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const tail = 'SUMMARY-TAIL-MUST-BE-VISIBLE';
    const rendered = await renderFrozenPdfDerivative({
      source,
      annotations: [],
      summaryLines: [`总体评价：${'All feedback remains visible. '.repeat(180)}${tail}`],
      identity: 'summary-continuation-test',
    });

    const output = await PDFDocument.load(rendered.bytes);
    expect(rendered.summaryPageNumber).toBe(2);
    expect(output.getPageCount()).toBeGreaterThan(2);
    const summaryText = (await Promise.all(output.getPages().slice(1).map((_, index) => pdfText(rendered.bytes, index + 2)))).join('').replace(/\s+/g, '');
    expect(summaryText).toContain('总体评价');
    expect(summaryText).toContain(tail);
    expect(summaryText).not.toContain('复核校验值');
  });

  it('keeps internal checksums and inline annotations out of the student summary page', async () => {
    const sourcePdf = await PDFDocument.create(); sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const snapshot: any = makeSnapshot(source, 'private/summary.pdf', 'application/pdf', { precision: 'GENERAL' });
    const { renderer, put } = rendererFor(source);

    const plan = buildReviewedDerivativePlan(snapshot, options);
    await renderer.render(plan);

    const rendered = await pdfText(putBody(put), 2);
    expect(rendered).toContain('总体完成情况良好');
    expect(rendered).not.toContain('复核校验值');
    expect(rendered).not.toContain('检查符号');
  });

  it('carries official Mathpix PDF geometry through normalization, persistence, planning, and isolated rendering', async () => {
    const sourcePdf = await PDFDocument.create(); sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const sourceChecksum = `sha256:${createHash('sha256').update(source).digest('hex')}`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ pdf_id: 'official-pdf-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'completed', num_pages: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ pages: [{ page: 1, page_width: 600, page_height: 800, lines: [
        { text: 'x', cnt: [[20, 40], [200, 40], [200, 100], [20, 100]] },
        { text: 'region', region: { top_left_x: 30, top_left_y: 120, width: 90, height: 40 } },
      ] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('x', { status: 200 }));
    const client = createMathpixClient({ fetchImpl, endpoint: 'https://api.mathpix.com/v3/pdf', credentialRef: 'env:MATHPIX_APP_KEY', appId: 'app', appKey: 'key', pdfPollIntervalMs: 0 });
    const provider = await client.convert({ bytes: source, fileName: 'answer.pdf', mimeType: 'application/pdf', classId: 'class-1', policy: mathpixPolicy('https://api.mathpix.com/v3/pdf') });
    expect(provider.lines?.[0]).toMatchObject({ bbox: [20, 40, 200, 100], coordinateProvenance: { origin: 'TOP_LEFT', unit: 'PIXEL', pageWidth: 600, pageHeight: 800, rotation: 0 } });
    expect(provider.lines?.[1]).toMatchObject({ bbox: [30, 120, 120, 160], coordinateProvenance: { origin: 'TOP_LEFT', unit: 'PIXEL' } });
    expect(provider.requestId).toBe('official-pdf-1');
    const conversion = mathpixToConversionResult(provider, sourceChecksum);
    const normalized = toAnswerEvidence(conversion);
    const persisted = buildPersistedAnswerEvidenceBlocks({ normalized, conversionId: 'conversion-real', evidenceId: 'evidence-real', sourceHash: sourceChecksum, now: new Date('2026-07-17T00:00:00Z') });
    expect(persisted[0].coordinateProvenance).toEqual({ origin: 'TOP_LEFT', unit: 'PIXEL', pageWidth: 600, pageHeight: 800, rotation: 0 });
    const snapshot: any = {
      id: 'snapshot-real', reviewId: 'review-real', reviewVersion: 1, machineSnapshotHash: 'sha256:machine', criterionSnapshot: [{ criterionId: 'criterion-1', score: 0 }], overallComment: null,
      gradingRun: { question: { rubricSnapshot: { criteria: [{ id: 'criterion-1', maxPoints: 1 }] } } },
      annotationSnapshot: [{ id: 'annotation-real', criterionId: 'criterion-1', status: 'ACTIVE', comment: '证据明确', anchor: { precision: 'BLOCK', blockId: persisted[0].id, pageNumber: 1, bbox: [20, 40, 200, 100] } }],
      answerEvidence: { sourceHash: sourceChecksum, anchorVersion: normalized.anchorVersion, precision: 'BLOCK', canonicalMarkdown: normalized.canonicalMarkdown, blocks: persisted, sourceAsset: { id: 'asset-real', objectKey: 'private/real.pdf', checksum: sourceChecksum, mimeType: 'application/pdf', sizeBytes: source.byteLength } },
    };
    const plan = buildReviewedDerivativePlan(snapshot, { generatorId: 'native', generatorVersion: '1', nativeFormats: ['PDF'], anchorCapabilities: [{ anchorVersion: normalized.anchorVersion, nativeFormats: ['PDF'] }] });
    expect(plan).toMatchObject({ nativeCapable: true, outputKind: 'REVIEWED_PDF' });
    const rendered = await renderFrozenPdfDerivative({
      source,
      annotations: [{ id: 'annotation-real', pageNumber: 1, bbox: [20, 40, 200, 100], coordinateProvenance: { origin: 'TOP_LEFT', unit: 'PIXEL', pageWidth: 600, pageHeight: 800, rotation: 0 }, marker: '', contents: '证据明确', allowPageFallback: true }],
      identity: 'mathpix-geometry-test',
    });
    expect(rendered.placements[0]?.rect).toEqual([10, 350, 100, 380]);

  });

  it('blocks before writing when downloaded source bytes do not match the frozen checksum', async () => {
    const expectedDocument = await PDFDocument.create(); expectedDocument.addPage([100, 100]);
    const actualDocument = await PDFDocument.create(); actualDocument.addPage([200, 100]);
    const expected = new Uint8Array(await expectedDocument.save());
    const actual = new Uint8Array(await actualDocument.save());
    const snapshot: any = makeSnapshot(expected, 'private/source.pdf', 'application/pdf', { precision: 'GENERAL' });
    snapshot.answerEvidence.precision = 'GENERAL';
    snapshot.answerEvidence.sourceAsset.sizeBytes = actual.byteLength;
    const { renderer, put } = rendererFor(actual);
    await expect(renderer.render(buildReviewedDerivativePlan(snapshot, options))).rejects.toMatchObject({
      code: 'reviewed-derivative-source-integrity-mismatch', blocked: true,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'top-left normalized', rotation: 0, bbox: [0.1, 0.2, 0.4, 0.3], provenance: { origin: 'TOP_LEFT', unit: 'NORMALIZED', pageWidth: 300, pageHeight: 400, rotation: 0 }, expected: [30, 280, 120, 320] },
    { name: 'scaled pixels', rotation: 0, bbox: [20, 40, 200, 100], provenance: { origin: 'BOTTOM_LEFT', unit: 'PIXEL', pageWidth: 600, pageHeight: 800, rotation: 0 }, expected: [10, 20, 100, 50] },
    { name: '90 degree rotation', rotation: 90, bbox: [10, 20, 100, 50], provenance: { origin: 'TOP_LEFT', unit: 'PDF_POINT', pageWidth: 400, pageHeight: 300, rotation: 90 }, expected: [20, 10, 50, 100] },
  ])('transforms $name provenance into PDF user space', async ({ rotation, bbox, provenance, expected }) => {
    const sourcePdf = await PDFDocument.create();
    const page = sourcePdf.addPage([300, 400]);
    if (rotation) page.setRotation(degrees(rotation));
    const source = new Uint8Array(await sourcePdf.save());
    const rendered = await renderFrozenPdfDerivative({
      source,
      annotations: [{ id: 'coordinate-test', pageNumber: 1, bbox: bbox as [number, number, number, number], coordinateProvenance: provenance as any, marker: '', contents: '扣分说明', allowPageFallback: true }],
      identity: `coordinate-${rotation}`,
    });
    expect(rendered.placements[0]?.rect).toEqual(expected);
  });

  it('falls back honestly when frozen PDF coordinate provenance is absent', async () => {
    const sourcePdf = await PDFDocument.create(); sourcePdf.addPage([300, 400]);
    const source = new Uint8Array(await sourcePdf.save());
    const snapshot: any = makeSnapshot(source, 'private/no-provenance.pdf', 'application/pdf', { precision: 'BLOCK', blockId: 'block-1', pageNumber: 1, bbox: [10, 20, 100, 50] });
    snapshot.answerEvidence.precision = 'BLOCK'; snapshot.answerEvidence.blocks = [{ id: 'block-1', pageNumber: 1, bbox: [10, 20, 100, 50], precision: 'BLOCK' }];
    const plan = buildReviewedDerivativePlan(snapshot, options);
    expect(plan).toMatchObject({ nativeCapable: false });
    expect(plan.limitations).toContain('pdf-coordinate-provenance-missing');
  });

  it('keeps the final PDF when PDF geometry is uncertain by moving the note to the summary page', async () => {
    const sourcePdf = await PDFDocument.create(); sourcePdf.addPage([100, 100]); const pdf = new Uint8Array(await sourcePdf.save());
    const provenance = { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 100, pageHeight: 100, rotation: 0 };
    const pdfSnapshot: any = makeSnapshot(pdf, 'private/geometry.pdf', 'application/pdf', { precision: 'BLOCK', blockId: 'block-1', pageNumber: 1, bbox: [10, 10, 200, 50], coordinateProvenance: provenance });
    pdfSnapshot.answerEvidence.precision = 'BLOCK'; pdfSnapshot.answerEvidence.blocks = [{ id: 'block-1', pageNumber: 1, bbox: [10, 10, 200, 50], precision: 'BLOCK', coordinateProvenance: provenance }];
    const pdfIo = rendererFor(pdf); const pdfResult = await pdfIo.renderer.render(buildReviewedDerivativePlan(pdfSnapshot, options));
    expect(pdfResult).toMatchObject({ outputKind: 'REVIEWED_PDF', nativeCapable: false });
    expect((await PDFDocument.load(putBody(pdfIo.put))).getPageCount()).toBe(2);
  });

  it('blocks frozen size mismatch, excessive ZIP entries, XML entities, and excessive PDF pages', async () => {
    const hugePdf = await PDFDocument.create(); for (let index = 0; index < 501; index += 1) hugePdf.addPage([100, 100]);
    const pdfBytes = new Uint8Array(await hugePdf.save());
    const pdfSnapshot: any = makeSnapshot(pdfBytes, 'private/pages.pdf', 'application/pdf', { precision: 'GENERAL' });
    pdfSnapshot.answerEvidence.precision = 'GENERAL'; pdfSnapshot.answerEvidence.blocks = [];
    const pdfPlan = buildReviewedDerivativePlan(pdfSnapshot, options);
    pdfPlan.outputKind = 'REVIEWED_PDF'; pdfPlan.outputMimeType = 'application/pdf';
    await expect(rendererFor(pdfBytes).renderer.render(pdfPlan)).rejects.toMatchObject({ code: 'reviewed-derivative-pdf-page-limit', blocked: true });

    await expect(rendererFor(pdfBytes, { maxPdfObjects: 1 }).renderer.render(pdfPlan)).rejects.toMatchObject({ code: 'reviewed-derivative-pdf-object-limit', blocked: true });
    await expect(rendererFor(pdfBytes, { pdfTimeoutMs: 1 }).renderer.render(pdfPlan)).rejects.toMatchObject({ code: 'reviewed-derivative-pdf-timeout', blocked: true });
  });

  it('stops an async S3 body as soon as the source byte limit is crossed', async () => {
    const source = new TextEncoder().encode('%PDF-1.7 12345678');
    const snapshot: any = makeSnapshot(source, 'private/stream.pdf', 'application/pdf', { precision: 'GENERAL' });
    snapshot.answerEvidence.precision = 'GENERAL';
    const put = vi.fn();
    const send = vi.fn(async (command: unknown) => command instanceof GetObjectCommand
      ? { Body: { async *[Symbol.asyncIterator]() { yield source.slice(0, 3); yield source.slice(3, 6); yield source.slice(6); } } }
      : (put(command), {}));
    const renderer = new S3AnnotatedMarkdownDerivativeRenderer({ bucket: 'private-reviews', limits: { maxSourceBytes: 4 } }, { send } as any);
    await expect(renderer.render(buildReviewedDerivativePlan(snapshot, options))).rejects.toMatchObject({ code: 'reviewed-derivative-source-size-limit', blocked: true });
    expect(put).not.toHaveBeenCalled();
  });
});

function rendererFor(source: Uint8Array | Record<string, Uint8Array>, limits?: Record<string, number>) {
  const put = vi.fn();
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof GetObjectCommand) {
      const key = String(command.input.Key ?? '');
      const bytes = source instanceof Uint8Array ? source : source[key];
      if (!bytes) throw new Error(`missing source ${key}`);
      return { Body: { transformToByteArray: async () => bytes } };
    }
    if (command instanceof PutObjectCommand) { put(command); return {}; }
    throw new Error('unexpected command');
  });
  return { renderer: new S3AnnotatedMarkdownDerivativeRenderer({ bucket: 'private-reviews', sourceBucket: 'private-submissions', prefix: 'reviewed', limits }, { send } as any), put, send };
}

function putBody(put: ReturnType<typeof vi.fn>) {
  expect(put).toHaveBeenCalledTimes(1);
  return put.mock.calls[0][0].input.Body as Uint8Array;
}

function makeSnapshot(source: Uint8Array, objectKey: string, mimeType: string, anchor: Record<string, unknown>) {
  const sourceChecksum = `sha256:${createHash('sha256').update(source).digest('hex')}`;
  return {
    id: 'snapshot-native', reviewId: 'review-1', reviewVersion: 1, machineSnapshotHash: 'sha256:machine',
    annotationSnapshot: [{ id: 'annotation-1', criterionId: 'criterion-1', status: 'ACTIVE', comment: '检查符号', anchor }],
    criterionSnapshot: [{ criterionId: 'criterion-1', score: 0, comment: '需要修正' }],
    gradingRun: { question: { rubricSnapshot: { criteria: [{ id: 'criterion-1', maxPoints: 1 }] } } },
    overallComment: '总体完成情况良好。',
    answerEvidence: {
      sourceHash: sourceChecksum, anchorVersion: 'anchors-v2', precision: 'SPAN', canonicalMarkdown: 'x = -1, then verify', blocks: [],
      sourceAsset: { id: 'asset-1', objectKey, checksum: sourceChecksum, mimeType, sizeBytes: source.byteLength },
    },
  };
}

function canonicalConversion(bytes: Uint8Array) {
  return {
    state: 'SUCCEEDED',
    renderedObjectKey: 'grading-rendered/conversion-1.pdf',
    renderedChecksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    renderedSizeBytes: bytes.byteLength,
  };
}

function mathpixPolicy(endpoint = 'https://api.mathpix.com/v3/text'): any {
  return { provider: 'mathpix', version: 'policy.v1', endpoint, purpose: 'answer-conversion', dataCategories: ['student-answer'], minimizedScope: ['selected-question', 'answer-evidence'], institutionScope: null, classScope: ['class-1'], processingRegion: 'CN', agreementVersion: 'agreement.v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 30, enabled: true, disabledAt: null, credentialRef: 'env:MATHPIX_APP_KEY' };
}

async function makeDocx(text: string) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

async function pdfText(bytes: Uint8Array, pageNumber: number) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
  } finally {
    await document.destroy();
  }
}

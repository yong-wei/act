import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { degrees, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import { buildReviewedDerivativePlan } from '../teacher-assignment-review-derivative';
import { S3AnnotatedMarkdownDerivativeRenderer } from '../teacher-assignment-review-derivative-storage';
import { createMathpixClient, mathpixToConversionResult, toAnswerEvidence } from '../math-document-conversion';
import { buildPersistedAnswerEvidenceBlocks } from '../math-document-grading-persistence';

const options = { generatorId: 'native-s3', generatorVersion: '1', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'] as const };

describe('reviewed derivative native storage', () => {
  it('reads and verifies the source DOCX, preserves its content, and writes native Word comments to a new key', async () => {
    const source = await makeDocx('x = -1, then verify');
    const snapshot = makeSnapshot(source, 'private/source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      precision: 'SPAN', spanStart: 4, spanEnd: 6,
    });
    const { renderer, put, send } = rendererFor(source);

    const result = await renderer.render(buildReviewedDerivativePlan(snapshot, options));

    expect(result.objectKey).not.toBe('private/source.docx');
    expect(result.objectKey).toMatch(/\.docx$/);
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toMatchObject({ Bucket: 'private-submissions', Key: 'private/source.docx' });
    const output = putBody(put);
    const zip = await JSZip.loadAsync(output);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const commentsXml = await zip.file('word/comments.xml')!.async('string');
    const document = new DOMParser().parseFromString(documentXml, 'application/xml');
    expect(Array.from(document.getElementsByTagName('w:t')).map((node) => node.textContent).join('')).toBe('x = -1, then verify');
    expect(documentXml).toContain('w:commentRangeStart');
    expect(documentXml).toContain('w:commentReference');
    const comments = new DOMParser().parseFromString(commentsXml, 'application/xml');
    expect(comments.getElementsByTagName('w:comment')).toHaveLength(1);
    expect(commentsXml).toContain('Check sign');
  });

  it('maps normalized multi-paragraph canonical offsets back to preserved DOCX runs', async () => {
    const source = await makeDocxParagraphs(['  First   line  ', 'Second line']);
    const snapshot = makeSnapshot(source, 'private/multi.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      precision: 'SPAN', spanStart: 12, spanEnd: 18,
    });
    snapshot.answerEvidence.canonicalMarkdown = 'First line\n\nSecond line';
    const { renderer, put } = rendererFor(source);
    await renderer.render(buildReviewedDerivativePlan(snapshot, options));
    const zip = await JSZip.loadAsync(putBody(put));
    const xml = await zip.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    expect(Array.from(document.getElementsByTagName('w:t')).map((node) => node.textContent).join('')).toBe('  First   line  Second line');
    expect(xml).toContain('w:commentRangeStart');
  });

  it('reads and verifies a source PDF and emits a real page annotation with the reliable bbox', async () => {
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
    expect(annots?.size()).toBe(1);
    const annotation = parsed.context.lookup(annots.get(0)) as any;
    expect(annotation.get(PDFName.of('Subtype')).toString()).toBe('/Text');
    expect(annotation.get(PDFName.of('Contents')).decodeText()).toBe('Check sign');
    expect(annotation.get(PDFName.of('Rect')).asArray().map((value: any) => value.asNumber())).toEqual([10, 20, 100, 50]);
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
      id: 'snapshot-real', reviewId: 'review-real', reviewVersion: 1, machineSnapshotHash: 'sha256:machine', criterionSnapshot: [], overallComment: null,
      annotationSnapshot: [{ id: 'annotation-real', status: 'ACTIVE', comment: 'Provider grounded', anchor: { precision: 'BLOCK', blockId: persisted[0].id, pageNumber: 1, bbox: [20, 40, 200, 100] } }],
      answerEvidence: { sourceHash: sourceChecksum, anchorVersion: normalized.anchorVersion, precision: 'BLOCK', canonicalMarkdown: normalized.canonicalMarkdown, blocks: persisted, sourceAsset: { id: 'asset-real', objectKey: 'private/real.pdf', checksum: sourceChecksum, mimeType: 'application/pdf', sizeBytes: source.byteLength } },
    };
    const plan = buildReviewedDerivativePlan(snapshot, { generatorId: 'native', generatorVersion: '1', nativeFormats: ['PDF'], anchorCapabilities: [{ anchorVersion: normalized.anchorVersion, nativeFormats: ['PDF'] }] });
    expect(plan).toMatchObject({ nativeCapable: true, outputKind: 'REVIEWED_PDF' });
    const { renderer, put } = rendererFor(source); const rendered = await renderer.render(plan);
    expect(rendered).toMatchObject({ outputKind: 'REVIEWED_PDF', nativeCapable: true });
    expect(await firstPdfAnnotationRect(putBody(put))).toEqual([10, 350, 100, 380]);

  });

  it('blocks before writing when downloaded source bytes do not match the frozen checksum', async () => {
    const actual = await makeDocx('tampered');
    const expected = await makeDocx('x = -1, then verify');
    const snapshot = makeSnapshot(expected, 'private/source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      precision: 'SPAN', spanStart: 4, spanEnd: 6,
    });
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
    const snapshot: any = makeSnapshot(source, 'private/coordinates.pdf', 'application/pdf', { precision: 'BLOCK', blockId: 'block-1', pageNumber: 1, bbox, coordinateProvenance: provenance });
    snapshot.answerEvidence.precision = 'BLOCK';
    snapshot.answerEvidence.blocks = [{ id: 'block-1', pageNumber: 1, bbox, precision: 'BLOCK', coordinateProvenance: provenance }];
    const { renderer, put } = rendererFor(source);
    await renderer.render(buildReviewedDerivativePlan(snapshot, options));
    expect(await firstPdfAnnotationRect(putBody(put))).toEqual(expected);
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

  it('preserves existing Word comments and allocates non-conflicting IDs', async () => {
    const source = await makeDocxWithExistingComment('x = -1, then verify', 7);
    const snapshot = makeSnapshot(source, 'private/commented.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 4, spanEnd: 6 });
    const { renderer, put } = rendererFor(source);
    await renderer.render(buildReviewedDerivativePlan(snapshot, options));
    const zip = await JSZip.loadAsync(putBody(put));
    const commentsXml = await zip.file('word/comments.xml')!.async('string');
    expect(commentsXml).toContain('Existing comment');
    expect(commentsXml).toContain('w:id="7"');
    expect(commentsXml).toContain('w:id="8"');
  });

  it('uses Markdown fallback for an unsafe existing comments relationship', async () => {
    const source = await makeDocxWithExistingComment('x = -1, then verify', 7, true);
    const snapshot = makeSnapshot(source, 'private/external-comment.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 4, spanEnd: 6 });
    const { renderer, put } = rendererFor(source);
    const result = await renderer.render(buildReviewedDerivativePlan(snapshot, options));
    expect(result).toMatchObject({ outputKind: 'ANNOTATED_MARKDOWN', nativeCapable: false });
    expect(result.limitations).toContain('docx-comments-relationship-unsupported');
    expect((put.mock.calls[0][0] as PutObjectCommand).input.ContentType).toBe('text/markdown');
  });

  it('falls back with explicit content for DOCX anchor-map and PDF geometry uncertainty', async () => {
    const docx = await makeDocx('actual text');
    const docxSnapshot = makeSnapshot(docx, 'private/mismatch.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 0, spanEnd: 6 });
    docxSnapshot.answerEvidence.canonicalMarkdown = 'different text';
    const docxIo = rendererFor(docx); const docxResult = await docxIo.renderer.render(buildReviewedDerivativePlan(docxSnapshot, options));
    expect(docxResult).toMatchObject({ outputKind: 'ANNOTATED_MARKDOWN', nativeCapable: false, anchorPrecision: 'GENERAL' });
    expect(docxResult.limitations).toContain('reviewed-derivative-docx-anchor-map-mismatch');
    expect(new TextDecoder().decode(putBody(docxIo.put))).toContain('reviewed-derivative-docx-anchor-map-mismatch');

    const complexZip = await JSZip.loadAsync(await makeDocx('ignored'));
    complexZip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>actual</w:t><w:t> text</w:t></w:r></w:p></w:body></w:document>');
    const complex = await complexZip.generateAsync({ type: 'uint8array' });
    const complexSnapshot = makeSnapshot(complex, 'private/complex.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 1, spanEnd: 4 });
    complexSnapshot.answerEvidence.canonicalMarkdown = 'actual text';
    const complexIo = rendererFor(complex); const complexResult = await complexIo.renderer.render(buildReviewedDerivativePlan(complexSnapshot, options));
    expect(complexResult.limitations).toContain('reviewed-derivative-docx-run-unsupported');

    const sourcePdf = await PDFDocument.create(); sourcePdf.addPage([100, 100]); const pdf = new Uint8Array(await sourcePdf.save());
    const provenance = { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 100, pageHeight: 100, rotation: 0 };
    const pdfSnapshot: any = makeSnapshot(pdf, 'private/geometry.pdf', 'application/pdf', { precision: 'BLOCK', blockId: 'block-1', pageNumber: 1, bbox: [10, 10, 200, 50], coordinateProvenance: provenance });
    pdfSnapshot.answerEvidence.precision = 'BLOCK'; pdfSnapshot.answerEvidence.blocks = [{ id: 'block-1', pageNumber: 1, bbox: [10, 10, 200, 50], precision: 'BLOCK', coordinateProvenance: provenance }];
    const pdfIo = rendererFor(pdf); const pdfResult = await pdfIo.renderer.render(buildReviewedDerivativePlan(pdfSnapshot, options));
    expect(pdfResult).toMatchObject({ outputKind: 'ANNOTATED_MARKDOWN', nativeCapable: false });
    expect(pdfResult.limitations).toContain('reviewed-derivative-pdf-geometry-mismatch');
  });

  it('blocks frozen size mismatch, excessive ZIP entries, XML entities, and excessive PDF pages', async () => {
    const ordinary = await makeDocx('x = -1, then verify');
    const sizeMismatch = makeSnapshot(ordinary, 'private/size.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 4, spanEnd: 6 });
    sizeMismatch.answerEvidence.sourceAsset.sizeBytes += 1;
    await expect(rendererFor(ordinary).renderer.render(buildReviewedDerivativePlan(sizeMismatch, options))).rejects.toMatchObject({ code: 'reviewed-derivative-source-size-mismatch', blocked: true });

    const zip = await JSZip.loadAsync(ordinary);
    for (let index = 0; index < 2_049; index += 1) zip.file(`extra/${index}.txt`, 'x');
    const tooManyEntries = await zip.generateAsync({ type: 'uint8array' });
    await expect(rendererFor(tooManyEntries).renderer.render(buildReviewedDerivativePlan(makeSnapshot(tooManyEntries, 'private/entries.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 4, spanEnd: 6 }), options))).rejects.toMatchObject({ code: 'reviewed-derivative-docx-entry-limit', blocked: true });

    await expect(rendererFor(ordinary, { maxZipExpandedBytes: 100 }).renderer.render(buildReviewedDerivativePlan(makeSnapshot(ordinary, 'private/expanded.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 4, spanEnd: 6 }), options))).rejects.toMatchObject({ code: 'reviewed-derivative-docx-expanded-size-limit', blocked: true });

    const entityZip = await JSZip.loadAsync(ordinary);
    entityZip.file('word/document.xml', '<!DOCTYPE x [<!ENTITY y "boom">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>');
    const entityDocx = await entityZip.generateAsync({ type: 'uint8array' });
    await expect(rendererFor(entityDocx).renderer.render(buildReviewedDerivativePlan(makeSnapshot(entityDocx, 'private/entity.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 0, spanEnd: 1 }), options))).rejects.toMatchObject({ code: 'reviewed-derivative-xml-complexity-limit', blocked: true });

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
    const source = new TextEncoder().encode('12345678');
    const snapshot = makeSnapshot(source, 'private/stream.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { precision: 'SPAN', spanStart: 0, spanEnd: 1 });
    const put = vi.fn();
    const send = vi.fn(async (command: unknown) => command instanceof GetObjectCommand
      ? { Body: { async *[Symbol.asyncIterator]() { yield source.slice(0, 3); yield source.slice(3, 6); yield source.slice(6); } } }
      : (put(command), {}));
    const renderer = new S3AnnotatedMarkdownDerivativeRenderer({ bucket: 'private-reviews', limits: { maxSourceBytes: 4 } }, { send } as any);
    await expect(renderer.render(buildReviewedDerivativePlan(snapshot, options))).rejects.toMatchObject({ code: 'reviewed-derivative-source-size-limit', blocked: true });
    expect(put).not.toHaveBeenCalled();
  });
});

function rendererFor(source: Uint8Array, limits?: Record<string, number>) {
  const put = vi.fn();
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => source } };
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
    annotationSnapshot: [{ id: 'annotation-1', status: 'ACTIVE', comment: 'Check sign', anchor }],
    criterionSnapshot: [], overallComment: 'Review complete.',
    answerEvidence: {
      sourceHash: sourceChecksum, anchorVersion: 'anchors-v2', precision: 'SPAN', canonicalMarkdown: 'x = -1, then verify', blocks: [],
      sourceAsset: { id: 'asset-1', objectKey, checksum: sourceChecksum, mimeType, sizeBytes: source.byteLength },
    },
  };
}

async function firstPdfAnnotationRect(bytes: Uint8Array) {
  const parsed = await PDFDocument.load(bytes);
  const annots = parsed.getPage(0).node.lookup(PDFName.of('Annots')) as any;
  const annotation = parsed.context.lookup(annots.get(0)) as any;
  return annotation.get(PDFName.of('Rect')).asArray().map((value: any) => value.asNumber());
}

async function makeDocxWithExistingComment(text: string, id: number, external = false) {
  const bytes = await makeDocx(text); const zip = await JSZip.loadAsync(bytes);
  zip.file('word/comments.xml', `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="${id}"><w:p><w:r><w:t>Existing comment</w:t></w:r></w:p></w:comment></w:comments>`);
  zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="${external ? 'https://example.invalid/comments.xml' : 'comments.xml'}"${external ? ' TargetMode="External"' : ''}/></Relationships>`);
  return zip.generateAsync({ type: 'uint8array' });
}

function mathpixPolicy(endpoint = 'https://api.mathpix.com/v3/text'): any {
  return { provider: 'mathpix', version: 'policy.v1', endpoint, purpose: 'answer-conversion', dataCategories: ['student-answer'], minimizedScope: ['selected-question', 'answer-evidence'], institutionScope: null, classScope: ['class-1'], processingRegion: 'CN', agreementVersion: 'agreement.v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 30, enabled: true, disabledAt: null, credentialRef: 'env:MATHPIX_APP_KEY' };
}

async function makeDocx(text: string) {
  return makeDocxParagraphs([text]);
}

async function makeDocxParagraphs(paragraphs: string[]) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

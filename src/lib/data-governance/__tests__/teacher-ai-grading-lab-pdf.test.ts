import { createHash } from 'node:crypto';

import {
  degrees,
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  StandardFonts,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  buildTeacherAiGradingLabPdfPlan,
  createAndPersistTeacherAiGradingLabPdf,
  createTeacherAiGradingLabPdf,
  hashTeacherAiGradingLabStructuredResult,
  type TeacherAiGradingLabStructuredResultBody,
} from '../teacher-ai-grading-lab-pdf';

describe('teacher AI grading lab PDF', () => {
  it('adds visible sidebar feedback, ASCII markers, and one summary page without changing source-page semantics', async () => {
    const source = await syntheticPdf();
    const sourceCopy = source.slice();
    const before = await sourcePageSemantics(source);
    const body = structuredBody();
    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));

    expect(source).toEqual(sourceCopy);
    expect(result.metadata).toMatchObject({
      sourcePageCount: 4,
      outputPageCount: 5,
      summaryPageNumber: 5,
      selectedStructuredVersion: { id: 'structured-v1', checksum: hashTeacherAiGradingLabStructuredResult(body) },
      source: { conversionId: 'conversion-1', objectKey: 'rendered/conversion-1.pdf', sizeBytes: source.byteLength },
    });
    expect(result.metadata.annotations.map((annotation) => annotation.rect)).toEqual([
      [10, 20, 100, 50],
      [250, 10, 280, 100],
      [200, 350, 290, 380],
      [20, 300, 50, 390],
    ]);
    expect(result.metadata.annotations.every((annotation) => annotation.precision === 'EXACT')).toBe(true);

    const output = await PDFDocument.load(result.bytes);
    const expandedSemantics = await sourcePageSemantics(result.bytes, 4);
    expect(expandedSemantics.map((page) => page.rotation)).toEqual(before.map((page) => page.rotation));
    expect(expandedSemantics.map((page) => page.mediaBox)).toEqual([
      '[ 0 0 473 400 ]',
      '[ 0 0 300 573 ]',
      '[ -175 0 300 400 ]',
      '[ 0 -173 300 400 ]',
    ]);
    expect(expandedSemantics.map((page) => page.cropBox)).toEqual([
      '[ 5 7 473 393 ]',
      '[ 5 7 293 573 ]',
      '[ -175 7 293 393 ]',
      '[ 5 -173 293 393 ]',
    ]);
    expect(await pageText(result.bytes, 1)).toEqual(expect.stringContaining('ORIGINAL PAGE 1'));
    expect((await pageText(result.bytes, 1)).replace(/\s+/g, '')).toContain('批注');
    expect(output.getPageCount()).toBe(5);
    const pageOneAnnotations = annotationsOn(output, 0);
    expect(pageOneAnnotations.map((annotation) => annotation.get(PDFName.of('Subtype')).toString())).toEqual([
      '/Text',
      '/FreeText',
    ]);
    const marker = pageOneAnnotations[1];
    expect(marker.get(PDFName.of('Contents')).decodeText()).toBe('T1-1 8/10 SIGN');
    expect(marker.has(PDFName.of('AP'))).toBe(true);
    expect(annotationRect(marker)).toEqual([104, 36, 194, 50]);
    expect(annotationRect(marker)).not.toEqual(result.metadata.annotations[0].rect);
    expect(marker.lookup(PDFName.of('ACTAnchorRect'), PDFArray).toString()).toBe('[ 10 20 100 50 ]');
    expect(rectanglesOverlap(annotationRect(marker), result.metadata.annotations[0].rect)).toBe(false);
    expect(marker.get(PDFName.of('Subtype')).toString()).toBe('/FreeText');
    expect(marker.get(PDFName.of('ACTPrecision')).toString()).toBe('/EXACT');
    expect((await pageText(result.bytes, 1)).replace(/\s+/g, '')).toContain('扣分依据:Signisincorrect.');
    expect((await pageText(result.bytes, 5)).replace(/\s+/g, '')).toContain('总体评价');
    expect(await pageText(result.bytes, 5)).toEqual(expect.stringContaining('TOTAL 30/40'));
    expect(await pageText(result.bytes, 5)).toEqual(expect.stringContaining('T1-4 6/10'));
  });

  it('uses a declared question-level margin placement when a known page lacks frozen geometry', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = [{
      id: 'feedback-page',
      questionId: 'T1-2',
      criterionId: 't1-2-criterion-1',
      errorCode: 'NO_BBOX',
      reason: 'The page is known.',
      correction: 'Review the question block.',
      anchor: { pageNumber: 2, precision: 'QUESTION' },
    }];
    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));

    expect(result.metadata.annotations).toEqual([expect.objectContaining({
      id: 'feedback-page',
      pageNumber: 2,
      precision: 'QUESTION',
      degradationReason: 'frozen-bbox-or-coordinate-provenance-missing',
    })]);
    const output = await PDFDocument.load(result.bytes);
    const marker = annotationsOn(output, 1).find((annotation) => annotation.get(PDFName.of('Subtype')).toString() === '/FreeText');
    expect(marker?.get(PDFName.of('ACTPrecision')).toString()).toBe('/QUESTION');
  });

  it.each([
    ['region', 'REGION', undefined],
    ['block', 'BLOCK', 'answer-block-2'],
    ['page', 'PAGE', undefined],
  ] as const)('preserves a declared %s fallback instead of claiming a more precise anchor', async (_name, precision, blockId) => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = [{
      id: `feedback-${precision.toLowerCase()}`,
      questionId: 'T1-2',
      criterionId: 't1-2-criterion-1',
      errorCode: 'NO_EXACT_ANCHOR',
      reason: 'Exact geometry is unavailable.',
      correction: 'Use the declared fallback location.',
      anchor: { pageNumber: 2, precision, blockId },
    }];

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect(result.metadata.annotations[0]).toMatchObject({
      pageNumber: 2,
      precision,
      degradationReason: 'frozen-bbox-or-coordinate-provenance-missing',
    });

    const output = await PDFDocument.load(result.bytes);
    const marker = annotationsOn(output, 1).find((annotation) => annotation.get(PDFName.of('Subtype')).toString() === '/FreeText');
    expect(marker?.get(PDFName.of('ACTPrecision')).toString()).toBe(`/${precision}`);
  });

  it('degrades an out-of-bounds frozen bbox instead of presenting it as exact', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = [{
      id: 'feedback-outside',
      questionId: 'T1-1',
      criterionId: 't1-1-criterion-1',
      errorCode: 'OUTSIDE',
      reason: 'Invalid geometry.',
      correction: 'Use the page marker.',
      anchor: {
        pageNumber: 1,
        precision: 'EXACT',
        bbox: [10, 20, 900, 950],
        coordinateProvenance: provenance(0),
      },
    }];
    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect(result.metadata.annotations[0]).toMatchObject({
      precision: 'QUESTION',
      degradationReason: 'bbox-or-coordinate-provenance-invalid',
    });
    expect(result.metadata.annotations[0].rect[2]).toBeLessThanOrEqual(300);
  });

  it('blocks feedback without an effective page and page numbers outside the PDF', async () => {
    const source = await syntheticPdf();
    const missing = structuredBody();
    missing.feedback[0].anchor.pageNumber = null;
    await expect(createTeacherAiGradingLabPdf(inputFor(source, missing))).rejects.toMatchObject({
      code: 'teacher-ai-grading-lab-pdf-feedback-page-missing',
      blocked: true,
    });

    const outside = structuredBody();
    outside.feedback[0].anchor.pageNumber = 9;
    await expect(createTeacherAiGradingLabPdf(inputFor(source, outside))).rejects.toMatchObject({
      code: 'reviewed-derivative-pdf-page-invalid',
      blocked: true,
    });
  });

  it('keeps multiple feedback entries visible in the extended right sidebar without moving their source anchors', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = Array.from({ length: 4 }, (_, index) => ({
      id: `feedback-sidebar-${index + 1}`,
      questionId: 'T1-1',
      criterionId: `t1-1-criterion-${index + 1}`,
      reason: `Independent reason ${index + 1}`,
      correction: `Independent correction ${index + 1}`,
      anchor: {
        pageNumber: 1,
        precision: 'EXACT' as const,
        bbox: [10, 40 + index * 50, 100, 70 + index * 50] as [number, number, number, number],
        coordinateProvenance: provenance(0),
      },
    }));

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect(result.metadata.annotations.map((annotation) => annotation.rect)).toEqual([
      [10, 40, 100, 70],
      [10, 90, 100, 120],
      [10, 140, 100, 170],
      [10, 190, 100, 220],
    ]);
    const visible = await pageText(result.bytes, 1);
    expect(visible).toContain('Independent reason 1');
    expect(visible).toContain('Independent reason 4');
  });

  it('embeds a CJK font for visible Chinese sidebar feedback', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = [{
      id: 'feedback-chinese',
      questionId: 'T1-1',
      criterionId: 't1-1-criterion-1',
      reason: '符号方向错误',
      correction: '请检查符号',
      anchor: {
        pageNumber: 1,
        precision: 'EXACT',
        bbox: [10, 20, 100, 50],
        coordinateProvenance: provenance(0),
      },
    }];

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect((await pageText(result.bytes, 1)).replace(/\s+/g, '')).toContain('符号方向错误');
  });

  it('embeds a math-capable fallback for Greek and mathematical-alphabet feedback', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = [{
      id: 'feedback-math-unicode',
      questionId: 'T1-1',
      criterionId: 't1-1-criterion-1',
      reason: 'α + 𝑥 = 0',
      correction: 'Keep the coefficient and variable visible.',
      anchor: { pageNumber: 1, precision: 'QUESTION' as const },
    }];

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect((await pageText(result.bytes, 1)).replace(/\s+/g, '')).toContain('α+x=0');
  });

  it('continues an overcrowded sidebar on a separate page before the summary', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    body.feedback = Array.from({ length: 8 }, (_, index) => ({
      id: `feedback-overflow-${index + 1}`,
      questionId: 'T1-1',
      criterionId: `t1-1-criterion-overflow-${index + 1}`,
      reason: `Overflow reason ${index + 1}`,
      correction: `Overflow correction ${index + 1}`,
      anchor: { pageNumber: 1, precision: 'QUESTION' as const },
    }));

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect(result.metadata).toMatchObject({ sourcePageCount: 4, outputPageCount: 6, summaryPageNumber: 6 });
    expect((await pageText(result.bytes, 5)).replace(/\s+/g, '')).toContain('批注（续）');
    expect(await pageText(result.bytes, 5)).toContain('Overflow reason 8');
  });

  it('keeps exact anchors inside non-zero media boxes and appends sidebars on each visual right edge', async () => {
    const source = await translatedRotatedPdf();
    const body = structuredBody();
    body.feedback = [0, 90, 180, 270].map((rotation, index) => ({
      id: `feedback-translated-${rotation}`,
      questionId: `T1-${index + 1}`,
      criterionId: `t1-${index + 1}-criterion-1`,
      reason: `Translated page ${rotation}.`,
      correction: 'Verify the physical PDF coordinates.',
      anchor: {
        pageNumber: index + 1,
        precision: 'EXACT' as const,
        bbox: [10, 20, 100, 50] as [number, number, number, number],
        coordinateProvenance: provenance(rotation as 0 | 90 | 180 | 270),
      },
    }));

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    expect(result.metadata.annotations.map((annotation) => annotation.rect)).toEqual([
      [60, 90, 150, 120],
      [300, 80, 330, 170],
      [250, 420, 340, 450],
      [70, 370, 100, 460],
    ]);

    const output = await PDFDocument.load(result.bytes);
    for (const [index, page] of output.getPages().slice(0, 4).entries()) {
      const media = page.getMediaBox();
      const crop = page.getCropBox();
      const [x1, y1, x2, y2] = result.metadata.annotations[index].rect;
      expect(x1).toBeGreaterThanOrEqual(media.x);
      expect(y1).toBeGreaterThanOrEqual(media.y);
      expect(x2).toBeLessThanOrEqual(media.x + media.width);
      expect(y2).toBeLessThanOrEqual(media.y + media.height);
      expect(page.getRotation().angle).toBe([0, 90, 180, 270][index]);
      if (index === 0) expect(crop.x + crop.width).toBeGreaterThan(330);
      if (index === 1) expect(crop.y + crop.height).toBeGreaterThan(440);
      if (index === 2) expect(crop.x).toBeLessThan(60);
      if (index === 3) expect(crop.y).toBeLessThan(80);
    }
  });

  it('uses the original rotated page geometry for overflow sidebar continuation pages', async () => {
    const source = await translatedRotatedPdf([90]);
    const body = structuredBody();
    body.feedback = Array.from({ length: 8 }, (_, index) => ({
      id: `feedback-rotated-overflow-${index + 1}`,
      questionId: 'T1-1',
      criterionId: `t1-1-criterion-overflow-${index + 1}`,
      reason: `Rotated overflow reason ${index + 1}`,
      correction: `Rotated overflow correction ${index + 1}`,
      anchor: { pageNumber: 1, precision: 'QUESTION' as const },
    }));

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    const output = await PDFDocument.load(result.bytes);
    const continuationPages = output.getPages().slice(1, -1);
    expect(continuationPages).not.toHaveLength(0);
    for (const page of continuationPages) {
      expect(page.getRotation().angle).toBe(90);
      expect(page.getMediaBox()).toEqual(output.getPage(0).getMediaBox());
      expect(page.getCropBox()).toEqual(output.getPage(0).getCropBox());
    }
    expect((await Promise.all(continuationPages.map((_, index) => pageText(result.bytes, index + 2)))).join(' ')).toContain('Rotated overflow reason 8');
  });

  it('does not reveal original annotations that were outside the source crop box', async () => {
    const source = await cropHiddenAnnotationPdf();
    const body = structuredBody();
    body.feedback = [body.feedback[0]];
    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    const output = await PDFDocument.load(result.bytes);
    const originalAnnotations = annotationsOn(output, 0).filter((annotation) => annotation.get(PDFName.of('NM'))?.decodeText() === 'hidden-original');
    expect(originalAnnotations).toHaveLength(0);
    expect(output.getPage(0).getCropBox().x + output.getPage(0).getCropBox().width).toBeGreaterThan(280);
  });

  it('splits one long rotated sidebar entry across continuation pages without losing text', async () => {
    const source = await smallRotatedPdf();
    const body = structuredBody();
    const longReason = `${'Z'.repeat(600)}TAIL-MUST-BE-VISIBLE`;
    body.feedback = [{
      id: 'feedback-long-rotated',
      questionId: 'T1-1',
      criterionId: 't1-1-criterion-1',
      reason: longReason,
      correction: 'Keep every character visible.',
      anchor: { pageNumber: 1, precision: 'QUESTION' as const },
    }];

    const result = await createTeacherAiGradingLabPdf(inputFor(source, body));
    const output = await PDFDocument.load(result.bytes);
    expect(output.getPageCount()).toBeGreaterThan(2);
    expect(output.getPages().slice(1, -1).every((page) => page.getRotation().angle === 90)).toBe(true);
    const commentText = (await Promise.all(output.getPages().slice(0, -1).map((_, index) => pageText(result.bytes, index + 1)))).join('').replace(/\s+/g, '');
    expect([...commentText].filter((character) => character === 'Z')).toHaveLength(600);
    expect(commentText).toContain('TAIL-MUST-BE-VISIBLE');
  });

  it('rejects total aggregation drift and feedback without a stable rubric-item identity', async () => {
    const source = await syntheticPdf();
    const totalMismatch = structuredBody();
    totalMismatch.totalScore = 31;
    expect(() => buildTeacherAiGradingLabPdfPlan(inputFor(source, totalMismatch))).toThrowError(expect.objectContaining({
      code: 'teacher-ai-grading-lab-pdf-total-score-mismatch',
    }));

    const missingCriterion = structuredBody();
    missingCriterion.feedback[0].criterionId = '';
    expect(() => buildTeacherAiGradingLabPdfPlan(inputFor(source, missingCriterion))).toThrowError(expect.objectContaining({
      code: 'teacher-ai-grading-lab-pdf-feedback-criterion-missing',
    }));
  });

  it.each([
    ['object key', { objectKey: 'rendered/other.pdf' }, 'teacher-ai-grading-lab-pdf-source-object-key-mismatch'],
    ['declared checksum', { checksum: `sha256:${'f'.repeat(64)}` }, 'teacher-ai-grading-lab-pdf-source-checksum-mismatch'],
    ['declared size', { sizeBytes: 1 }, 'teacher-ai-grading-lab-pdf-source-size-mismatch'],
  ])('blocks a mismatched rendered source binding: %s', async (_name, patch, code) => {
    const source = await syntheticPdf();
    const input = inputFor(source, structuredBody());
    Object.assign(input.renderedPdf, patch);
    await expect(createTeacherAiGradingLabPdf(input)).rejects.toMatchObject({ code, blocked: true });
  });

  it('blocks bytes whose hash differs from the frozen DocumentConversion checksum', async () => {
    const source = await syntheticPdf();
    const input = inputFor(source, structuredBody());
    const tampered = source.slice();
    tampered[tampered.length - 10] ^= 1;
    input.renderedPdf.bytes = tampered;
    await expect(createTeacherAiGradingLabPdf(input)).rejects.toMatchObject({
      code: 'teacher-ai-grading-lab-pdf-source-integrity-mismatch',
      blocked: true,
    });
  });

  it('defines determinism by semantic plan identity rather than byte equality', async () => {
    const source = await syntheticPdf();
    const body = structuredBody();
    const first = buildTeacherAiGradingLabPdfPlan(inputFor(source, body));
    const replay = buildTeacherAiGradingLabPdfPlan(inputFor(source, structuredClone(body)));
    expect(replay).toEqual(first);

    const nextGenerator = buildTeacherAiGradingLabPdfPlan({ ...inputFor(source, body), generatorVersion: 'teacher-ai-grading-lab-pdf.v3' });
    expect(nextGenerator.semanticIdentity).not.toBe(first.semanticIdentity);
    const nextBody = structuredBody();
    nextBody.versionId = 'structured-v2';
    const nextVersion = buildTeacherAiGradingLabPdfPlan(inputFor(source, nextBody));
    expect(nextVersion.semanticIdentity).not.toBe(first.semanticIdentity);

    expect(() => buildTeacherAiGradingLabPdfPlan({ ...inputFor(source, body), generatorVersion: 'teacher-ai-grading-lab-pdf.v1' })).toThrowError(expect.objectContaining({
      code: 'teacher-ai-grading-lab-pdf-generator-version-retired',
    }));

    const renderedFirst = await createTeacherAiGradingLabPdf(inputFor(source, body));
    const renderedReplay = await createTeacherAiGradingLabPdf(inputFor(source, structuredClone(body)));
    expect(renderedReplay.metadata.semanticIdentity).toBe(renderedFirst.metadata.semanticIdentity);
    expect(renderedReplay.metadata.annotations).toEqual(renderedFirst.metadata.annotations);
    expect(await annotationSemantics(renderedReplay.bytes)).toEqual(await annotationSemantics(renderedFirst.bytes));
  });

  it('generates and persists a derivative only from the database-materialized review chain', async () => {
    const source = await syntheticPdf();
    const db = trustedGenerationDb(source);
    const result = await createAndPersistTeacherAiGradingLabPdf({
      db,
      derivativeId: 'derivative-a',
      splitId: 'split-a',
      sampleId: 'sample-a',
      sourceConversionId: 'conversion-1',
      renderedPdf: {
        objectKey: 'rendered/conversion-1.pdf',
        checksum: sha256(source),
        sizeBytes: source.byteLength,
        bytes: source,
      },
      selectedReviewVersionIds: ['review-a'],
      generatorVersion: 'teacher-ai-grading-lab-pdf.v2',
      anchorVersion: 'math-document-word-anchor.v1',
    });

    expect(result.derivative).toMatchObject({
      id: 'derivative-a',
      sourceConversionId: 'conversion-1',
      sourcePdfChecksum: sha256(source),
      conversionVersion: 2,
      generatorVersion: 'teacher-ai-grading-lab-pdf.v2',
      anchorVersion: 'math-document-word-anchor.v1',
      structuredResultHash: result.metadata.selectedStructuredVersion.checksum,
      semanticIdentity: result.metadata.semanticIdentity,
      contentChecksum: result.metadata.outputChecksum,
    });
    expect(db.links).toEqual([{ derivativeId: 'derivative-a', reviewVersionId: 'review-a', ordinal: 0 }]);
  });
});

function inputFor(source: Uint8Array, body: TeacherAiGradingLabStructuredResultBody) {
  const checksum = sha256(source);
  return {
    conversion: {
      id: 'conversion-1',
      version: 2,
      adapterVersion: 'LibreOffice 24.2.0.3',
      state: 'SUCCEEDED' as const,
      renderedObjectKey: 'rendered/conversion-1.pdf',
      renderedChecksum: checksum,
      renderedSizeBytes: source.byteLength,
    },
    renderedPdf: {
      objectKey: 'rendered/conversion-1.pdf',
      checksum,
      sizeBytes: source.byteLength,
      bytes: source,
    },
    structuredResult: { ...body, checksum: hashTeacherAiGradingLabStructuredResult(body) },
    generatorVersion: 'teacher-ai-grading-lab-pdf.v2',
    anchorVersion: 'math-document-word-anchor.v1',
  };
}

function structuredBody(): TeacherAiGradingLabStructuredResultBody {
  const questions = [
    { questionId: 'T1-1', score: 8, maxScore: 10 },
    { questionId: 'T1-2', score: 9, maxScore: 10 },
    { questionId: 'T1-3', score: 7, maxScore: 10 },
    { questionId: 'T1-4', score: 6, maxScore: 10 },
  ];
  return {
    versionId: 'structured-v1',
    totalScore: 30,
    maxScore: 40,
    questions,
    feedback: questions.map((question, index) => ({
      id: `feedback-${index + 1}`,
      questionId: question.questionId,
      criterionId: `${question.questionId.toLowerCase()}-criterion-1`,
      errorCode: index === 0 ? 'SIGN' : `E${index + 1}`,
      reason: index === 0 ? 'Sign is incorrect.' : `Reason ${index + 1}`,
      correction: `Correction ${index + 1}`,
      anchor: {
        pageNumber: index + 1,
        precision: 'EXACT' as const,
        bbox: [10, 20, 100, 50] as [number, number, number, number],
        coordinateProvenance: provenance((index * 90) as 0 | 90 | 180 | 270),
      },
    })),
  };
}

function provenance(rotation: 0 | 90 | 180 | 270) {
  return {
    origin: 'BOTTOM_LEFT' as const,
    unit: 'PDF_POINT' as const,
    pageWidth: rotation === 90 || rotation === 270 ? 400 : 300,
    pageHeight: rotation === 90 || rotation === 270 ? 300 : 400,
    rotation,
  };
}

async function syntheticPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const rotation of [0, 90, 180, 270] as const) {
    const page = pdf.addPage([300, 400]);
    page.setCropBox(5, 7, 288, 386);
    page.setRotation(degrees(rotation));
    page.drawText(`ORIGINAL PAGE ${pdf.getPageCount()}`, { x: 30, y: 200, size: 12, font });
  }
  const page = pdf.getPage(0);
  const existing = pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [20, 300, 40, 320],
    Contents: PDFHexString.fromText('Existing annotation'),
    NM: PDFHexString.fromText('existing'),
  });
  const annots = pdf.context.obj([pdf.context.register(existing)]);
  page.node.set(PDFName.of('Annots'), annots);
  return new Uint8Array(await pdf.save());
}

async function translatedRotatedPdf(rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const rotation of rotations) {
    const page = pdf.addPage([300, 400]);
    page.setMediaBox(50, 70, 300, 400);
    page.setCropBox(60, 80, 270, 360);
    page.setRotation(degrees(rotation));
    page.drawText(`TRANSLATED ${rotation}`, { x: 80, y: 200, size: 12, font });
  }
  return new Uint8Array(await pdf.save());
}

async function cropHiddenAnnotationPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 400]);
  page.setCropBox(0, 0, 280, 400);
  const hidden = pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [285, 100, 295, 110],
    Contents: PDFHexString.fromText('Hidden source annotation'),
    NM: PDFHexString.fromText('hidden-original'),
  });
  page.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(hidden)]));
  return new Uint8Array(await pdf.save());
}

async function smallRotatedPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([100, 100]);
  page.setRotation(degrees(90));
  return new Uint8Array(await pdf.save());
}

function annotationsOn(pdf: PDFDocument, pageIndex: number): any[] {
  const annots = pdf.getPage(pageIndex).node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  return annots ? annots.asArray().map((ref) => pdf.context.lookup(ref)) : [];
}

function annotationRect(annotation: any): [number, number, number, number] {
  return annotation.lookup(PDFName.of('Rect'), PDFArray).asArray().map((value: any) => value.asNumber()) as [number, number, number, number];
}

function rectanglesOverlap(left: [number, number, number, number], right: [number, number, number, number]): boolean {
  return left[0] < right[2] && left[2] > right[0] && left[1] < right[3] && left[3] > right[1];
}

async function sourcePageSemantics(bytes: Uint8Array, count = 4) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().slice(0, count).map((page) => ({
    mediaBox: page.node.get(PDFName.of('MediaBox'))?.toString(),
    cropBox: page.node.get(PDFName.of('CropBox'))?.toString(),
    rotation: page.node.get(PDFName.of('Rotate'))?.toString() ?? '0',
    contents: page.node.get(PDFName.of('Contents'))?.toString(),
  }));
}

async function annotationSemantics(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().slice(0, 4).flatMap((_, pageIndex) => annotationsOn(pdf, pageIndex).map((annotation) => ({
    subtype: annotation.get(PDFName.of('Subtype')).toString(),
    contents: annotation.get(PDFName.of('Contents'))?.decodeText(),
    precision: annotation.get(PDFName.of('ACTPrecision'))?.toString() ?? null,
  })));
}

async function pageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
  } finally {
    await document.destroy();
  }
}

function sha256(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function trustedGenerationDb(source: Uint8Array) {
  const createdAt = new Date('2026-07-28T00:00:00.000Z');
  const reviewContent = {
    executionId: 'execution-a',
    version: 1,
    parentVersionId: null,
    decision: 'CORRECTED',
    scoreCorrections: [{ criterionId: 'criterion-a', score: 8 }],
    annotationCorrections: [{ action: 'revise-text', sourceAnnotationId: 'annotation-a', comment: '教师修订后的批注' }],
    operatorUserId: 'teacher-a',
    createdAt: createdAt.toISOString(),
  };
  const review = { id: 'review-a', ...reviewContent, createdAt, contentHash: hashCanonical(reviewContent) };
  const execution = {
    id: 'execution-a', splitId: 'split-a', sampleId: 'sample-a', questionId: 'T1-1', repetitionOrdinal: 1, state: 'SUCCEEDED',
    gradingRun: {
      id: 'run-a',
      rubricSnapshot: { criteria: [{ id: 'criterion-a', maxPoints: 10 }] },
      assessments: [{ id: 'assessment-a', criterionId: 'criterion-a', score: 7, rationale: 'AI rationale' }],
      annotations: [{
        id: 'annotation-a', criterionId: 'criterion-a', pageNumber: 1, blockId: 'block-a',
         bbox: [10, 20, 100, 50], precision: 'EXACT', comment: '人工智能批注',
        block: { coordinateProvenance: provenance(0) },
      }],
    },
  };
  const derivatives: any[] = [];
  const links: any[] = [];
  const db: any = {
    derivatives,
    links,
    $transaction: async (operation: (tx: any) => Promise<any>) => operation(db),
    documentConversion: {
      findUnique: async () => ({
        id: 'conversion-1', version: 2, adapterVersion: 'LibreOffice 24.2.0.3', state: 'SUCCEEDED',
        renderedObjectKey: 'rendered/conversion-1.pdf', renderedChecksum: sha256(source),
      }),
    },
    teacherAiGradingStructuredReviewVersion: {
      findMany: async ({ where }: any) => where.id
        ? [{ id: review.id, executionId: review.executionId, execution: structuredClone(execution) }]
        : [structuredClone(review)],
    },
    teacherAiGradingEvaluationDerivative: {
      create: async ({ data }: any) => { derivatives.push(structuredClone(data)); return structuredClone(data); },
    },
    teacherAiGradingDerivativeReviewVersion: {
      createMany: async ({ data }: any) => { links.push(...structuredClone(data)); return { count: data.length }; },
    },
  };
  return db;
}

function hashCanonical(value: unknown): string {
  const stable = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(stable);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stable(entry)]));
    return item;
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

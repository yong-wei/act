import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

import {
  GENERATED_ACTIVITY_PAYLOAD_SCHEMAS,
  GENERATED_CONTENT_PAYLOAD_SCHEMAS,
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  GENERATED_SLIDE_SIZE_REGISTRY,
  resolveGeneratedSlideTypographyFit,
  validateGeneratedSlideManifest,
  type GeneratedSlideManifest,
  type GeneratedSlideModule,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';

import { SmartCoursewareError } from './domain';

export const SMART_COURSEWARE_PDF_RENDERER_VERSION = 'smart-courseware-pdf-export-v1' as const;
export const SMART_COURSEWARE_PDF_PAGE = Object.freeze({ width: 960, height: 540, aspectRatio: '16:9' as const });

const PDF_PAGE_PADDING = 24;
const PDF_HEADER_HEIGHT = 76;
const PDF_FOOTER_HEIGHT = 22;
const PDF_CONTENT_HEIGHT = SMART_COURSEWARE_PDF_PAGE.height - PDF_HEADER_HEIGHT - PDF_FOOTER_HEIGHT - PDF_PAGE_PADDING * 2;
const PDF_CONTENT_WIDTH = SMART_COURSEWARE_PDF_PAGE.width - PDF_PAGE_PADDING * 2;
const require = createRequire(import.meta.url);
const NOTO_SANS_SC_FONT_PACKAGE_ROOT = dirname(require.resolve('@fontsource-variable/noto-sans-sc/package.json'));
const NOTO_SANS_MATH_FONT_PATH = require.resolve('@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff2');

type PdfTextModule = {
  id: string;
  slotId: string;
  kind: 'content' | 'activity';
  fontSizePx: number;
  lines: string[];
};

export type StudentPdfSlideProjection = {
  stepId: string;
  order: number;
  layoutId: string;
  title: string;
  coursewareLabel: string;
  notice: 'AI 辅助生成，教师已审核';
  modules: PdfTextModule[];
};

export type StudentPdfProjection = {
  publicationRevisionId: string;
  manifestHash: string;
  contentHash: string;
  rendererVersion: typeof SMART_COURSEWARE_PDF_RENDERER_VERSION;
  page: typeof SMART_COURSEWARE_PDF_PAGE;
  slides: StudentPdfSlideProjection[];
};

export type SmartCoursewarePdfArtifact = {
  bytes: Uint8Array;
  artifactHash: string;
  pageCount: number;
  projectionHash: string;
  rendererVersion: typeof SMART_COURSEWARE_PDF_RENDERER_VERSION;
};

export function projectPublishedCoursewareForPdf(input: {
  publicationRevisionId: string;
  revisionNumber: number;
  planRevisionNumber: number;
  manifestHash: string;
  contentHash: string;
  manifest: unknown;
}): StudentPdfProjection {
  const manifest = assertPublishedManifest(input.manifest, input.manifestHash);
  const coursewareLabel = `互动课件第${positive(input.revisionNumber, 'pdf-export-revision-invalid')}版（基于教案第${positive(input.planRevisionNumber, 'pdf-export-plan-revision-invalid')}版）`;
  const slides = manifest.stages.flatMap((stage) => stage.steps).map((step, order) => ({
    stepId: step.id,
    order: order + 1,
    layoutId: step.layoutId,
    title: step.title,
    coursewareLabel,
    notice: 'AI 辅助生成，教师已审核' as const,
    modules: step.modules
      .filter((module) => module.roleMetadata.studentVisible)
      .map((module) => projectStudentPdfModule(module, `${input.manifestHash}:${step.id}`)),
  }));
  const projection = {
    publicationRevisionId: requiredText(input.publicationRevisionId, 'pdf-export-publication-id-invalid'),
    manifestHash: requiredText(input.manifestHash, 'pdf-export-manifest-hash-invalid'),
    contentHash: requiredText(input.contentHash, 'pdf-export-content-hash-invalid'),
    rendererVersion: SMART_COURSEWARE_PDF_RENDERER_VERSION,
    page: SMART_COURSEWARE_PDF_PAGE,
    slides,
  } satisfies StudentPdfProjection;
  assertStudentPdfProjection(projection, manifest);
  return projection;
}

export function projectStudentPdfModule(module: GeneratedSlideModule, orderingSeed = module.id): PdfTextModule {
  const fit = resolveGeneratedSlideTypographyFit(module);
  if (fit.state === 'unfit') throw new SmartCoursewareError(`pdf-export-overflow:unknown:${module.id}`, 409);
  if (module.canonicalClass === 'activity.panel') return projectActivity(module, orderingSeed);
  if (module.canonicalClass === 'content.rich') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.rich'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, [payload.data.text, ...(payload.data.bullets ?? []).map((item) => `• ${item}`)]);
  }
  if (module.canonicalClass === 'content.cardSet') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.cardSet'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, payload.data.items.flatMap((item) => [item.title, item.body]));
  }
  if (module.canonicalClass === 'content.formula') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.formula'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, [...payload.data.formulas, ...(payload.data.notes ?? [])]);
  }
  if (module.canonicalClass === 'content.table') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.table'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, [payload.data.columns.join('  |  '), ...payload.data.rows.map((row) => row.map(tableCellText).join('  |  '))]);
  }
  if (module.canonicalClass === 'content.code') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.code'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, [payload.data.language, payload.data.code, ...(payload.data.note ? [payload.data.note] : [])]);
  }
  if (module.canonicalClass === 'content.reveal') {
    const payload = GENERATED_CONTENT_PAYLOAD_SCHEMAS['content.reveal'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-module-payload-invalid:${module.id}`, 409);
    return studentTextModule(module, fit.fontSizePx, payload.data.items.flatMap((item) => [
      ...(item.title ? [item.title] : []), item.body, ...(item.formula ? [item.formula] : []),
    ]));
  }
  throw new SmartCoursewareError(`pdf-export-module-unsupported:${module.id}`, 409);
}

export async function renderStudentPdfArtifact(projection: StudentPdfProjection): Promise<SmartCoursewarePdfArtifact> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fonts = new PdfFontResolver(document);
  for (const slide of projection.slides) {
    const page = document.addPage([SMART_COURSEWARE_PDF_PAGE.width, SMART_COURSEWARE_PDF_PAGE.height]);
    await drawStudentPdfSlide(page, slide, fonts);
  }
  const bytes = await document.save({ useObjectStreams: false });
  await assertPdfArtifact(bytes, projection.slides.length);
  return {
    bytes,
    artifactHash: sha256(bytes),
    pageCount: projection.slides.length,
    projectionHash: sha256(JSON.stringify(projection)),
    rendererVersion: SMART_COURSEWARE_PDF_RENDERER_VERSION,
  };
}

export async function createPublishedCoursewarePdf(input: Parameters<typeof projectPublishedCoursewareForPdf>[0]) {
  const projection = projectPublishedCoursewareForPdf(input);
  return { projection, artifact: await renderStudentPdfArtifact(projection) };
}

function projectActivity(module: GeneratedSlideModule, orderingSeed: string): PdfTextModule {
  const fit = resolveGeneratedSlideTypographyFit(module);
  if (fit.state === 'unfit') throw new SmartCoursewareError(`pdf-export-overflow:unknown:${module.id}`, 409);
  const responseKind = typeof module.responseKind === 'string' ? module.responseKind : '';
  const online = '请在课堂中在线完成此活动。';
  if (responseKind === 'choice.single' || responseKind === 'choice.multi') {
    const payload = GENERATED_ACTIVITY_PAYLOAD_SCHEMAS[responseKind].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-activity-payload-invalid:${module.id}`, 409);
    return studentActivityModule(module, fit.fontSizePx, [payload.data.prompt, ...payload.data.options.map((option) => `• ${option.label}`), online]);
  }
  if (responseKind === 'ordering.sequence') {
    const payload = GENERATED_ACTIVITY_PAYLOAD_SCHEMAS['ordering.sequence'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-activity-payload-invalid:${module.id}`, 409);
    return studentActivityModule(module, fit.fontSizePx, [payload.data.prompt, ...studentOrder(payload.data.items, `${orderingSeed}:${module.id}:ordering`), online]);
  }
  if (responseKind === 'matching.pairs') {
    const payload = GENERATED_ACTIVITY_PAYLOAD_SCHEMAS['matching.pairs'].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-activity-payload-invalid:${module.id}`, 409);
    return studentActivityModule(module, fit.fontSizePx, [payload.data.prompt, '左侧项目：', ...payload.data.left.map((item) => `• ${item.label}`), '右侧项目：', ...studentOrder(payload.data.right, `${orderingSeed}:${module.id}:right`).map((item) => `• ${item.label}`), online]);
  }
  if (responseKind === 'text.short' || responseKind === 'text.long') {
    const payload = GENERATED_ACTIVITY_PAYLOAD_SCHEMAS[responseKind].safeParse(module.payload);
    if (!payload.success) throw new SmartCoursewareError(`pdf-export-activity-payload-invalid:${module.id}`, 409);
    return studentActivityModule(module, fit.fontSizePx, [payload.data.prompt, `回答形式：${payload.data.placeholder ?? (responseKind === 'text.short' ? '简短文字' : '完整说明')}`, online]);
  }
  throw new SmartCoursewareError(`pdf-export-activity-kind-invalid:${module.id}`, 409);
}

function studentTextModule(module: GeneratedSlideModule, fontSizePx: number, lines: string[]): PdfTextModule {
  return { id: module.id, slotId: module.slotId, kind: 'content', fontSizePx, lines: compactLines(lines) };
}

function studentActivityModule(module: GeneratedSlideModule, fontSizePx: number, lines: string[]): PdfTextModule {
  return { id: module.id, slotId: module.slotId, kind: 'activity', fontSizePx, lines: compactLines(lines) };
}

function assertPublishedManifest(value: unknown, manifestHash: string): GeneratedSlideManifest {
  const validation = validateGeneratedSlideManifest(value);
  if (!validation.valid) throw new SmartCoursewareError(`pdf-export-manifest-invalid:${validation.issues[0]?.code ?? 'unknown'}`, 409);
  if (validation.contentHash !== manifestHash) throw new SmartCoursewareError('pdf-export-manifest-hash-mismatch', 409);
  return value as GeneratedSlideManifest;
}

function assertStudentPdfProjection(projection: StudentPdfProjection, manifest: GeneratedSlideManifest) {
  const expectedSteps = manifest.stages.flatMap((stage) => stage.steps);
  if (projection.page.width * 9 !== projection.page.height * 16 || projection.slides.length !== expectedSteps.length) {
    throw new SmartCoursewareError('pdf-export-page-contract-invalid', 409);
  }
  projection.slides.forEach((slide, index) => {
    const expected = expectedSteps[index];
    const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[slide.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY];
    const expectedStudentModules = expected.modules.filter((module) => module.roleMetadata.studentVisible);
    if (!layout || slide.stepId !== expected.id || slide.order !== index + 1 || slide.modules.length !== expectedStudentModules.length) {
      throw new SmartCoursewareError(`pdf-export-step-contract-invalid:${slide.stepId}`, 409);
    }
    if (slide.modules.some((module) => !expectedStudentModules.some((expectedModule) => expectedModule.id === module.id))) {
      throw new SmartCoursewareError(`pdf-export-student-visibility-invalid:${slide.stepId}`, 409);
    }
    for (const module of slide.modules) {
      if (!layout.slots.some((slot) => slot.id === module.slotId) || module.lines.length === 0) {
        throw new SmartCoursewareError(`pdf-export-module-contract-invalid:${module.id}`, 409);
      }
    }
  });
  const serialized = JSON.stringify(projection);
  for (const prohibited of ['referenceAnswer', 'referenceMatches', 'reviewPoints', 'generationAudit', 'provenanceSnapshot', 'sourceBinding']) {
    if (serialized.includes(prohibited)) throw new SmartCoursewareError(`pdf-export-teacher-content-leak:${prohibited}`, 409);
  }
}

async function drawStudentPdfSlide(page: PDFPage, slide: StudentPdfSlideProjection, fonts: PdfFontResolver) {
  page.drawRectangle({ x: 0, y: 0, width: SMART_COURSEWARE_PDF_PAGE.width, height: SMART_COURSEWARE_PDF_PAGE.height, color: rgb(0.975, 0.98, 0.99) });
  await drawWrappedText(page, slide.title, PDF_PAGE_PADDING, SMART_COURSEWARE_PDF_PAGE.height - PDF_PAGE_PADDING - 18, PDF_CONTENT_WIDTH * 0.65, 18, 22, rgb(0.08, 0.12, 0.2), fonts, 2);
  await drawWrappedText(page, slide.coursewareLabel, PDF_PAGE_PADDING, SMART_COURSEWARE_PDF_PAGE.height - PDF_PAGE_PADDING - 61, PDF_CONTENT_WIDTH, 10, 13, rgb(0.24, 0.32, 0.45), fonts, 1);
  await drawWrappedText(page, slide.notice, PDF_PAGE_PADDING, PDF_PAGE_PADDING + 5, PDF_CONTENT_WIDTH, 9, 12, rgb(0.24, 0.32, 0.45), fonts, 1);

  const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[slide.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY];
  for (const module of slide.modules) {
    const slot = layout.slots.find((candidate) => candidate.id === module.slotId);
    if (!slot) throw new SmartCoursewareError(`pdf-export-slot-missing:${module.id}`, 409);
    const box = slotBox(slot.cells);
    page.drawRectangle({ x: box.x, y: box.y, width: box.width, height: box.height, color: module.kind === 'activity' ? rgb(0.93, 0.96, 1) : rgb(1, 1, 1), borderColor: rgb(0.8, 0.85, 0.92), borderWidth: 0.8 });
    const fontSize = Math.max(9, Math.min(14, Math.floor(module.fontSizePx * 0.42)));
    const lineHeight = Math.ceil(fontSize * 1.45);
    const renderedLines = await wrapLines(module.lines, box.width - 20, fontSize, fonts);
    const capacity = Math.floor((box.height - 20) / lineHeight);
    if (renderedLines.length > capacity) throw new SmartCoursewareError(`pdf-export-overflow:${slide.stepId}:${module.id}`, 409);
    let y = box.y + box.height - 14 - fontSize;
    for (const line of renderedLines) {
      await drawFontRuns(page, line, box.x + 10, y, fontSize, rgb(0.12, 0.17, 0.24), fonts);
      y -= lineHeight;
    }
  }
}

function slotBox(cells: readonly string[]) {
  const coordinates = cells.map((cell) => cell.split(':').map(Number));
  const columns = coordinates.map(([column]) => column);
  const rows = coordinates.map(([, row]) => row);
  const startColumn = Math.min(...columns);
  const endColumn = Math.max(...columns) + 1;
  const startRow = Math.min(...rows);
  const endRow = Math.max(...rows) + 1;
  const x = PDF_PAGE_PADDING + PDF_CONTENT_WIDTH * startColumn / 12 + 4;
  const width = PDF_CONTENT_WIDTH * (endColumn - startColumn) / 12 - 8;
  const y = PDF_PAGE_PADDING + PDF_FOOTER_HEIGHT + PDF_CONTENT_HEIGHT * (9 - endRow) / 9 + 4;
  const height = PDF_CONTENT_HEIGHT * (endRow - startRow) / 9 - 8;
  return { x, y, width, height };
}

async function drawWrappedText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  lineHeight: number,
  color: ReturnType<typeof rgb>,
  fonts: PdfFontResolver,
  maxLines: number,
) {
  const lines = await wrapLines([value], width, fontSize, fonts);
  if (lines.length > maxLines) throw new SmartCoursewareError('pdf-export-label-overflow', 409);
  for (const [index, line] of lines.entries()) {
    await drawFontRuns(page, line, x, y - index * lineHeight, fontSize, color, fonts);
  }
}

async function wrapLines(values: readonly string[], width: number, fontSize: number, fonts: PdfFontResolver) {
  const lines: string[] = [];
  for (const rawValue of values) {
    for (const value of rawValue.split(/\r?\n/)) {
      let current = '';
      for (const character of value) {
        const candidate = current + character;
        if (current && await textWidth(candidate, fontSize, fonts) > width) {
          lines.push(current.trimEnd());
          current = character === ' ' ? '' : character;
        } else {
          current = candidate;
        }
      }
      if (current.trim()) lines.push(current.trimEnd());
    }
  }
  return lines;
}

async function textWidth(value: string, fontSize: number, fonts: PdfFontResolver) {
  let width = 0;
  for (const character of value) width += (await fonts.fontFor(character)).widthOfTextAtSize(character, fontSize);
  return width;
}

async function drawFontRuns(page: PDFPage, value: string, x: number, y: number, fontSize: number, color: ReturnType<typeof rgb>, fonts: PdfFontResolver) {
  let currentFont: PDFFont | null = null;
  let current = '';
  let cursor = x;
  const flush = () => {
    if (!currentFont || !current) return;
    page.drawText(current, { x: cursor, y, font: currentFont, size: fontSize, color });
    cursor += currentFont.widthOfTextAtSize(current, fontSize);
    current = '';
  };
  for (const character of value) {
    const font = await fonts.fontFor(character);
    if (currentFont && font !== currentFont) flush();
    currentFont = font;
    current += character;
  }
  flush();
}

async function assertPdfArtifact(bytes: Uint8Array, expectedPageCount: number) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  if (document.getPageCount() !== expectedPageCount) throw new SmartCoursewareError('pdf-export-page-count-mismatch', 409);
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    if (width !== SMART_COURSEWARE_PDF_PAGE.width || height !== SMART_COURSEWARE_PDF_PAGE.height || width * 9 !== height * 16) {
      throw new SmartCoursewareError('pdf-export-geometry-invalid', 409);
    }
  }
}

type PdfFontSource = { bytes: Uint8Array; characters: Set<number> };
let notoFontSources: Promise<PdfFontSource[]> | null = null;

class PdfFontResolver {
  private readonly fonts = new Map<PdfFontSource, PDFFont>();
  private readonly helvetica: Promise<PDFFont>;

  constructor(private readonly document: PDFDocument) {
    this.helvetica = document.embedFont(StandardFonts.Helvetica);
  }

  async fontFor(character: string) {
    const codePoint = character.codePointAt(0);
    if (!codePoint) throw new SmartCoursewareError('pdf-export-text-invalid', 409);
    if (codePoint <= 0x7f) return this.helvetica;
    const source = (await loadNotoFontSources()).find((candidate) => candidate.characters.has(codePoint));
    if (!source) throw new SmartCoursewareError(`pdf-export-font-glyph-missing:${codePoint}`, 409);
    let font = this.fonts.get(source);
    if (!font) {
      font = await this.document.embedFont(source.bytes, { subset: true });
      this.fonts.set(source, font);
    }
    return font;
  }
}

async function loadNotoFontSources() {
  notoFontSources ??= (async () => {
    const directory = join(NOTO_SANS_SC_FONT_PACKAGE_ROOT, 'files');
    const files = (await readdir(directory)).filter((file) => /^noto-sans-sc-\d+-wght-normal\.woff2$/.test(file)).sort();
    const chineseSources = await Promise.all(files.map(async (file) => {
      const bytes = await readFile(join(directory, file));
      const font = fontkit.create(bytes);
      return { bytes, characters: new Set(font.characterSet) };
    }));
    const mathBytes = await readFile(NOTO_SANS_MATH_FONT_PATH);
    const mathFont = fontkit.create(mathBytes);
    return [...chineseSources, { bytes: mathBytes, characters: new Set(mathFont.characterSet) }];
  })();
  return notoFontSources;
}

function compactLines(values: readonly string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function studentOrder<T>(values: readonly T[], seed: string) {
  if (values.length < 2) return [...values];
  const offset = 1 + (Number.parseInt(sha256(`${seed}\u0000student-ordering-options`).slice(0, 8), 16) % (values.length - 1));
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function tableCellText(value: string | { kind: 'math'; value: string }) {
  return typeof value === 'string' ? value : value.value;
}

function requiredText(value: string, code: string) {
  if (!value.trim()) throw new SmartCoursewareError(code, 409);
  return value;
}

function positive(value: number, code: string) {
  if (!Number.isInteger(value) || value < 1) throw new SmartCoursewareError(code, 409);
  return value;
}

function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}

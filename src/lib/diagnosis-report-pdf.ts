import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import {
  canonicalJson,
  type DiagnosisDeliveryProjection,
} from '@/lib/diagnosis-report-delivery-projection';

export const DIAGNOSIS_PDF_RENDERER_VERSION = 'diagnosis-report-pdf.v1';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const BODY_SIZE = 10.5;
const BODY_LINE_HEIGHT = 17;

export type DiagnosisPdfArtifact = {
  bytes: Uint8Array;
  artifactHash: string;
  contentHash: string;
  pageCount: number;
  rendererVersion: typeof DIAGNOSIS_PDF_RENDERER_VERSION;
};

export async function renderDiagnosisReportPdf(
  projection: DiagnosisDeliveryProjection,
): Promise<DiagnosisPdfArtifact> {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const stableDate = new Date(projection.generatedAt);
  document.setTitle(projection.title);
  document.setAuthor('ACT 学情诊断');
  document.setSubject(`${projection.reportId}:${projection.roleVersion}`);
  document.setCreator(DIAGNOSIS_PDF_RENDERER_VERSION);
  document.setProducer(DIAGNOSIS_PDF_RENDERER_VERSION);
  document.setCreationDate(stableDate);
  document.setModificationDate(stableDate);

  const fonts = new DiagnosisPdfFontResolver(document);
  const blocks = projectionBlocks(projection);
  let page = document.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const drawBlock = async (block: { text: string; size: number; gapBefore?: number; color?: [number, number, number] }) => {
    y -= block.gapBefore ?? 0;
    const lineHeight = Math.max(BODY_LINE_HEIGHT, Math.ceil(block.size * 1.55));
    for (const line of wrapForPage(block.text, block.size)) {
      if (y - lineHeight < MARGIN + 24) {
        page = document.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      await drawTextWithFallback(page, line, MARGIN, y, block.size, fonts, block.color);
      y -= lineHeight;
    }
  };

  for (const block of blocks) await drawBlock(block);
  const pages = document.getPages();
  for (const [index, current] of pages.entries()) {
    const footer = `报告 ${projection.reportId} · ${projection.roleVersion} · 第 ${index + 1}/${pages.length} 页`;
    await drawTextWithFallback(current, footer, MARGIN, 25, 8, fonts, [0.38, 0.43, 0.5]);
  }

  const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
  const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
  if (loaded.getPageCount() !== pages.length || pages.length < 1 || pages.length > 100) {
    throw new Error('diagnosis-pdf-page-count-invalid');
  }
  return {
    bytes,
    artifactHash: sha256(bytes),
    contentHash: sha256(canonicalJson(projection)),
    pageCount: pages.length,
    rendererVersion: DIAGNOSIS_PDF_RENDERER_VERSION,
  };
}

function projectionBlocks(projection: DiagnosisDeliveryProjection) {
  const blocks: Array<{ text: string; size: number; gapBefore?: number; color?: [number, number, number] }> = [
    { text: projection.title, size: 20 },
    { text: projection.privacyNotice, size: 9, gapBefore: 5, color: [0.45, 0.28, 0.05] },
    { text: `证据截止：${formatDate(projection.evidenceCutoff)}　生成时间：${formatDate(projection.generatedAt)}`, size: 9, gapBefore: 7 },
    { text: `生成器：${projection.generatorVersion}　规则版本：${projection.ruleVersion ?? '未记录'}`, size: 9 },
    { text: '诊断摘要', size: 14, gapBefore: 14 },
    { text: projection.summary, size: BODY_SIZE, gapBefore: 4 },
  ];
  projection.findings.forEach((finding, index) => {
    blocks.push({ text: `${index + 1}. ${finding.title}`, size: 12, gapBefore: 12 });
    if (finding.summary) blocks.push({ text: finding.summary, size: BODY_SIZE, gapBefore: 3 });
    blocks.push({
      text: finding.evidence.state === 'available'
        ? `证据摘要：${finding.evidence.sources.map((source) => `${source.label} ${source.count} 项`).join('；')}`
        : `证据摘要：${finding.evidence.limitation}`,
      size: 9,
      gapBefore: 3,
      color: [0.25, 0.32, 0.4],
    });
  });
  blocks.push({ text: '学习建议', size: 14, gapBefore: 14 });
  projection.suggestions.forEach((suggestion) => blocks.push({ text: `• ${suggestion.text}`, size: BODY_SIZE, gapBefore: 3 }));
  blocks.push({ text: '限制与说明', size: 14, gapBefore: 14 });
  if (projection.limitations.length === 0) {
    blocks.push({ text: '当前报告未声明额外限制。', size: BODY_SIZE, gapBefore: 4 });
  } else {
    projection.limitations.forEach((limitation) => blocks.push({ text: `• ${limitation}`, size: BODY_SIZE, gapBefore: 3 }));
  }
  blocks.push({ text: '本导出不会自动发送，也不会创建补练、备课包或教学干预。', size: 9, gapBefore: 12 });
  return blocks;
}

function wrapForPage(text: string, size: number) {
  const maxUnits = Math.max(20, Math.floor(CONTENT_WIDTH / (size * 0.55)));
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = '';
    let units = 0;
    for (const character of paragraph) {
      const nextUnits = character.codePointAt(0)! > 0x7f ? 2 : 1;
      if (current && units + nextUnits > maxUnits) {
        lines.push(current);
        current = '';
        units = 0;
      }
      current += character;
      units += nextUnits;
    }
    lines.push(current || ' ');
  }
  return lines;
}

async function drawTextWithFallback(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: DiagnosisPdfFontResolver,
  color: [number, number, number] = [0.08, 0.12, 0.2],
) {
  let cursor = x;
  let current = '';
  let currentFont: PDFFont | null = null;
  const flush = () => {
    if (!current || !currentFont) return;
    page.drawText(current, { x: cursor, y, size, font: currentFont, color: rgb(...color) });
    cursor += currentFont.widthOfTextAtSize(current, size);
    current = '';
  };
  for (const character of text) {
    const font = await fonts.fontFor(character);
    if (currentFont && font !== currentFont) flush();
    currentFont = font;
    current += character;
  }
  flush();
}

type FontSource = { bytes: Uint8Array; characters: Set<number> };
let fontSourcesPromise: Promise<FontSource[]> | null = null;

class DiagnosisPdfFontResolver {
  private readonly embedded = new Map<FontSource, PDFFont>();
  private readonly latin: Promise<PDFFont>;

  constructor(private readonly document: PDFDocument) {
    this.latin = document.embedFont(StandardFonts.Helvetica);
  }

  async fontFor(character: string) {
    const codePoint = character.codePointAt(0);
    if (!codePoint) throw new Error('diagnosis-pdf-text-invalid');
    if (codePoint <= 0x7f) return this.latin;
    const source = (await loadFontSources()).find((candidate) => candidate.characters.has(codePoint));
    if (!source) throw new Error(`diagnosis-pdf-font-glyph-missing:${codePoint}`);
    let embedded = this.embedded.get(source);
    if (!embedded) {
      embedded = await this.document.embedFont(source.bytes, { subset: true });
      this.embedded.set(source, embedded);
    }
    return embedded;
  }
}

async function loadFontSources() {
  fontSourcesPromise ??= (async () => {
    const directory = join(process.cwd(), 'node_modules', '@fontsource-variable', 'noto-sans-sc', 'files');
    const files = (await readdir(directory)).filter((file) => /^noto-sans-sc-\d+-wght-normal\.woff2$/.test(file)).sort();
    if (files.length === 0) throw new Error('diagnosis-pdf-font-unavailable');
    return Promise.all(files.map(async (file) => {
      const bytes = await readFile(join(directory, file));
      return { bytes, characters: new Set(fontkit.create(bytes).characterSet) };
    }));
  })();
  return fontSourcesPromise;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}

function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}

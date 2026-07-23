import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { computeGeneratedSlideContentHash } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { SmartCoursewareError } from '@/lib/smart-courseware/domain';
import {
  SMART_COURSEWARE_PDF_PAGE,
  createPublishedCoursewarePdf,
  projectPublishedCoursewareForPdf,
} from '@/lib/smart-courseware/pdf-export';

import { validCoursewareManifest } from './fixtures';

function input(manifest = validCoursewareManifest()) {
  return {
    publicationRevisionId: 'publication-1',
    revisionNumber: 3,
    planRevisionNumber: 2,
    manifestHash: computeGeneratedSlideContentHash(manifest),
    contentHash: 'a'.repeat(64),
    manifest,
  };
}

describe('smart courseware PDF export', () => {
  it('projects one student-safe static page per step with immutable revision labels', () => {
    const projection = projectPublishedCoursewareForPdf(input());

    expect(projection.slides).toHaveLength(6);
    expect(projection.slides.map((slide) => slide.stepId)).toEqual(['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6']);
    expect(projection.slides.every((slide) => slide.coursewareLabel === '互动课件第3版（基于教案第2版）')).toBe(true);
    expect(projection.slides.every((slide) => slide.notice === 'AI 辅助生成，教师已审核')).toBe(true);
    const activity = projection.slides[2].modules[0];
    expect(activity.lines).toEqual(expect.arrayContaining(['Prompt module-3', '• A', '• B', '请在课堂中在线完成此活动。']));
    expect(JSON.stringify(projection)).not.toContain('referenceAnswer');
    expect(JSON.stringify(projection)).not.toContain('reviewPoints');
  });

  it('creates a fixed 16:9 PDF with exactly one page per step and bound evidence hashes', async () => {
    const generated = await createPublishedCoursewarePdf(input());
    const pdf = await PDFDocument.load(generated.artifact.bytes, { updateMetadata: false });

    expect(generated.artifact.pageCount).toBe(generated.projection.slides.length);
    expect(generated.artifact.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.artifact.projectionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pdf.getPageCount()).toBe(6);
    for (const page of pdf.getPages()) {
      expect(page.getSize()).toEqual({ width: SMART_COURSEWARE_PDF_PAGE.width, height: SMART_COURSEWARE_PDF_PAGE.height });
    }
  });

  it('embeds a math-font fallback for valid Greek and mathematical notation', async () => {
    const manifest = validCoursewareManifest();
    manifest.stages[0].steps[0].modules[0] = {
      ...manifest.stages[0].steps[0].modules[0],
      canonicalClass: 'content.formula',
      payload: { formulas: ['ω_n = √(1 - ζ²)', 'σ ≤ ∑ω'] },
    };

    await expect(createPublishedCoursewarePdf(input(manifest))).resolves.toMatchObject({
      artifact: { pageCount: 6 },
    });
  });

  it('reserves a distinct label area when a valid step title spans two lines', async () => {
    const manifest = validCoursewareManifest();
    manifest.stages[0].steps[0].title = '二阶控制系统阻尼比自然频率与动态响应特性的综合分析和工程应用'.repeat(2);

    await expect(createPublishedCoursewarePdf(input(manifest))).resolves.toMatchObject({
      artifact: { pageCount: 6 },
    });
  });

  it('normalizes tab-indented code before routing ASCII text to the standard font', async () => {
    const manifest = validCoursewareManifest();
    manifest.stages[0].steps[0].modules[0] = {
      ...manifest.stages[0].steps[0].modules[0],
      canonicalClass: 'content.code',
      payload: { language: 'typescript', code: 'function stable() {\r\n\treturn 1;\f}' },
    };

    await expect(createPublishedCoursewarePdf(input(manifest))).resolves.toMatchObject({
      artifact: { pageCount: 6 },
    });
  });

  it('permits student-visible text that names teacher-only fields', async () => {
    const manifest = validCoursewareManifest();
    manifest.stages[0].steps[0].modules[0] = {
      ...manifest.stages[0].steps[0].modules[0],
      payload: { text: '讲解 JSON 契约中的 referenceAnswer 与 reviewPoints 字段。' },
    };

    await expect(createPublishedCoursewarePdf(input(manifest))).resolves.toMatchObject({
      artifact: { pageCount: 6 },
    });
  });

  it('fails closed when a slide no longer fits the fixed student projection', () => {
    const manifest = validCoursewareManifest();
    manifest.stages[0].steps[0].modules[0] = {
      ...manifest.stages[0].steps[0].modules[0],
      payload: { text: 'x'.repeat(20_000) },
    };

    expect(() => projectPublishedCoursewareForPdf(input(manifest))).toThrow(expect.objectContaining<Partial<SmartCoursewareError>>({ code: 'pdf-export-overflow:unknown:module-1' }));
  });

  it('rejects a snapshot whose immutable manifest identity has changed', () => {
    const manifest = validCoursewareManifest();
    expect(() => projectPublishedCoursewareForPdf({ ...input(manifest), manifestHash: 'b'.repeat(64) })).toThrow(expect.objectContaining<Partial<SmartCoursewareError>>({ code: 'pdf-export-manifest-hash-mismatch' }));
  });

  it('omits teacher-only modules and does not serialize a correct ordering sequence', () => {
    const manifest = validCoursewareManifest();
    const step = manifest.stages[0].steps[0];
    step.layoutId = 'two-column';
    step.modules = [{
      ...step.modules[0], slotId: 'left', sizeId: 'half', payload: { text: '教师专用答案：K=42' },
      roleMetadata: { studentVisible: false, teacherVisible: true, referenceAnswerVisibility: 'none' },
    }, {
      id: 'ordering-1', canonicalClass: 'activity.panel', slotId: 'right', sizeId: 'half',
      responseKind: 'ordering.sequence', evidencePath: 'responses.ordering-1',
      payload: { prompt: '请排序', items: ['第一步', '第二步'] },
      roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
    }];

    const projection = projectPublishedCoursewareForPdf(input(manifest));
    const firstSlide = projection.slides[0];
    expect(firstSlide.modules).toHaveLength(1);
    expect(JSON.stringify(firstSlide)).not.toContain('教师专用答案');
    const projectedItems = firstSlide.modules[0].lines.filter((line) => line.includes('步'));
    expect(projectedItems).not.toEqual(['第一步', '第二步']);
    expect(projectedItems.every((line) => !/^\d+\./.test(line))).toBe(true);
  });

  it('keeps matching prompts but permutes only the answer side', () => {
    const manifest = validCoursewareManifest();
    const step = manifest.stages[0].steps[0];
    step.modules = [{
      id: 'matching-1', canonicalClass: 'activity.panel', slotId: 'main', sizeId: 'full',
      responseKind: 'matching.pairs', evidencePath: 'responses.matching-1',
      payload: {
        prompt: '请配对',
        left: [{ value: 'l1', label: '甲' }, { value: 'l2', label: '乙' }],
        right: [{ value: 'r1', label: '一' }, { value: 'r2', label: '二' }],
      },
      roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
    }];

    const lines = projectPublishedCoursewareForPdf(input(manifest)).slides[0].modules[0].lines;
    expect(lines.slice(lines.indexOf('左侧项目：') + 1, lines.indexOf('右侧项目：'))).toEqual(['• 甲', '• 乙']);
    expect(lines.slice(lines.indexOf('右侧项目：') + 1, -1)).not.toEqual(['• 一', '• 二']);
  });
});

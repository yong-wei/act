import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  deriveGeneratedSlideStepRenderContract,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-render-markers';
import type { GeneratedSlideManifestStep } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import {
  createGeneratedSlideMarkedContentRegistry,
  GeneratedSlideMarkedActivityPanel,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-marked-renderers';

const visible = {
  studentVisible: true,
  teacherVisible: true as const,
  referenceAnswerVisibility: 'none' as const,
};

function stepWith(module: GeneratedSlideManifestStep['modules'][number]): GeneratedSlideManifestStep {
  return { id: 'marker-step', title: 'Marker contract', durationSeconds: 60, layoutId: 'single', modules: [module] };
}

function contentModule(canonicalClass: string, payload: Record<string, unknown>) {
  return { id: 'module-a', canonicalClass, slotId: 'main', sizeId: 'full', payload, roleMetadata: visible };
}

describe('generated slide render marker contract', () => {
  it.each([
    ['content.rich', { text: 'English conclusion $G(s)$', bullets: ['稳定'] },
      ['module-a:payload.text:text', 'module-a:payload.bullets.0:text'],
      ['module-a:payload.text:formula.0']],
    ['content.cardSet', { items: [{ title: '标题', body: '正文' }] },
      ['module-a:payload.items.0.title:text', 'module-a:payload.items.0.body:text'], []],
    ['content.formula', { formulas: ['G(s)=1'], notes: ['说明 $K$'] },
      ['module-a:payload.notes.0:text'],
      ['module-a:payload.formulas.0:formula.0', 'module-a:payload.notes.0:formula.0']],
    ['content.table', { columns: ['对象 $s$'], rows: [['极点', { kind: 'math', value: 'Re(s)<0' }]] },
      ['module-a:payload.columns.0:text', 'module-a:payload.rows.0.0:text'],
      ['module-a:payload.columns.0:formula.0', 'module-a:payload.rows.0.1:formula.0']],
    ['content.code', { language: 'ts', code: 'const x = 1;', note: '示例' },
      ['module-a:payload.language:text', 'module-a:payload.code:text', 'module-a:payload.note:text'], []],
    ['content.reveal', { items: [{ title: '第一步', body: '先看 $G$', formula: '$H$' }] },
      ['module-a:payload.items.0.title:text', 'module-a:payload.items.0.body:text'],
      ['module-a:payload.items.0.body:formula.0', 'module-a:payload.items.0.formula:formula.0']],
  ])('derives immutable payload-path markers for %s', (canonicalClass, payload, textIds, formulaIds) => {
    expect(deriveGeneratedSlideStepRenderContract({
      step: stepWith(contentModule(canonicalClass, payload)),
      projection: 'student',
    })).toEqual({ moduleIds: ['module-a'], textIds, formulaIds });
  });

  it.each([
    ['choice.single', { prompt: '选择', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }, ['options.0.label', 'options.1.label']],
    ['choice.multi', { prompt: '多选', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }, ['options.0.label', 'options.1.label']],
    ['text.short', { prompt: '简答', placeholder: '请输入' }, ['placeholder']],
    ['text.long', { prompt: '长答', placeholder: '请输入说明' }, ['placeholder']],
    ['ordering.sequence', { prompt: '排序', items: ['甲', '乙'] }, ['items.0', 'items.1']],
    ['matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }],
      right: [{ value: '1', label: '一' }, { value: '2', label: '二' }],
    }, ['left.0.label', 'left.1.label', 'right.0.label', 'right.1.label']],
  ])('derives every visible activity option for %s', (responseKind, payload, paths) => {
    const activityModule = {
      ...contentModule('activity.panel', payload),
      responseKind,
      evidencePath: 'responses.marker-step.module-a',
    };
    expect(deriveGeneratedSlideStepRenderContract({ step: stepWith(activityModule), projection: 'student' }).textIds)
      .toEqual(['module-a:payload.prompt:text', ...paths.map((path) => `module-a:payload.${path}:text`)]);
  });

  it.each([
    ['choice.single', { prompt: '选择', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }, ['options.0.label', 'options.1.label']],
    ['choice.multi', { prompt: '多选', options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }, ['options.0.label', 'options.1.label']],
    ['text.short', { prompt: '简答', placeholder: '请输入' }, ['placeholder']],
    ['text.long', { prompt: '长答', placeholder: '请输入说明' }, ['placeholder']],
    ['ordering.sequence', { prompt: '排序', items: ['甲', '乙'] }, ['items.0', 'items.1']],
    ['matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }],
      right: [{ value: '1', label: '一' }, { value: '2', label: '二' }],
    }, ['left.0.label', 'left.1.label', 'right.0.label', 'right.1.label']],
  ])('renders every activity semantic option with its explicit marker for %s', (responseKind, payload, paths) => {
    const html = renderToStaticMarkup(createElement(GeneratedSlideMarkedActivityPanel, {
      moduleId: 'module-a', responseKind, payload, projection: 'student',
    }));
    expect(html).toContain('data-generated-slide-text-marker="module-a:payload.prompt:text"');
    for (const path of paths) {
      expect(html).toContain(`data-generated-slide-text-marker="module-a:payload.${path}:text"`);
    }
  });

  it('fails closed for unsupported module and response kinds', () => {
    expect(() => deriveGeneratedSlideStepRenderContract({
      step: stepWith(contentModule('content.unknown', { text: 'x' })), projection: 'student',
    })).toThrow('unsupported-generated-slide-module-kind:content.unknown');
    expect(() => deriveGeneratedSlideStepRenderContract({
      step: stepWith({
        ...contentModule('activity.panel', { prompt: 'x' }), responseKind: 'choice.unknown',
        evidencePath: 'responses.marker-step.module-a',
      }), projection: 'student',
    })).toThrow('unsupported-generated-slide-response-kind:module-a:choice.unknown');
  });

  it('expects and renders only the first reveal item at revealProgress zero', () => {
    const revealModule = contentModule('content.reveal', { items: [
      { title: '第一步', body: '先看 $G$', formula: '$H$' },
      { title: '第二步', body: '再看 $K$', formula: '$T$' },
    ] });
    const step = stepWith(revealModule);
    const contract = deriveGeneratedSlideStepRenderContract({ step, projection: 'student', revealProgress: 0 });
    expect(contract.textIds).toEqual([
      'module-a:payload.items.0.title:text',
      'module-a:payload.items.0.body:text',
    ]);
    expect(contract.formulaIds).toEqual([
      'module-a:payload.items.0.body:formula.0',
      'module-a:payload.items.0.formula:formula.0',
    ]);

    const sourceManifest = { stages: [{ steps: [step] }] } as never;
    const registry = createGeneratedSlideMarkedContentRegistry(sourceManifest);
    const node = registry['content.reveal']({
      manifest: {} as never,
      step: {} as never,
      module: { id: 'module-a' } as never,
      extra: { revealProgress: 0, allowInlineReveal: false },
    });
    const html = renderToStaticMarkup(node);
    expect(html).toContain('module-a:payload.items.0.body:text');
    expect(html).not.toContain('module-a:payload.items.1.body:text');
  });

  it('excludes teacher-only modules from the student expectation without reading the DOM', () => {
    const teacherOnlyModule = contentModule('content.rich', { text: '仅教师可见' });
    teacherOnlyModule.roleMetadata = { ...visible, studentVisible: false };
    expect(deriveGeneratedSlideStepRenderContract({ step: stepWith(teacherOnlyModule), projection: 'student' }))
      .toEqual({ moduleIds: [], textIds: [], formulaIds: [] });
  });
});

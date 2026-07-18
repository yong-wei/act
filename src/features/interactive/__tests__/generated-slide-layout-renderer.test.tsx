import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import {
  renderGeneratedSlideManifestStep,
  renderInteractiveLessonLayout,
  type GeneratedSlideActivityRendererProps,
  type GeneratedSlideStep,
  type InteractiveModuleRegistry,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  adaptGeneratedSlideManifestToInteractiveRuntime,
  BOPPPS_STAGES,
  GENERATED_SLIDE_SCHEMA_VERSION,
  type GeneratedSlideManifest,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';

function makeGeneratedStep(): GeneratedSlideStep {
  return {
    id: 'generated-step-01',
    title: '固定画布测试页',
    durationSeconds: 60,
    layoutId: 'two-column',
    modules: [
      {
        id: 'primary-card',
        canonicalClass: 'content.rich',
        slotId: 'left',
        sizeId: 'half',
        payload: { text: '主要内容' },
        roleMetadata: {
          studentVisible: true,
          teacherVisible: true,
          referenceAnswerVisibility: 'none',
        },
      },
    ],
  };
}

function makeLegacyStep(): InteractiveRuntimeStepManifest {
  return {
    id: 'legacy-step-01',
    title: '旧版页面',
    layout: {
      template: 'legacy-custom',
      regions: [{ id: 'primary', width: 'full', order: 1 }],
    },
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: { interactionKind: 'display', activityCards: [] },
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: [] },
    telemetrySpec: { summaryFields: [], misconceptionTags: [] },
    aiContextSpec: {
      pageGoal: '验证画布、slot 与角色 metadata。',
      deliveryMode: 'hidden_context',
    },
    interactiveFigureSpec: {},
    previewContract: { demoPath: '' },
    acceptanceChecks: [],
  };
}

function makeGeneratedManifest(): GeneratedSlideManifest {
  return {
    schemaVersion: GENERATED_SLIDE_SCHEMA_VERSION,
    lessonId: 'renderer-projection-fixture',
    title: '共享 renderer 投影测试',
    durationSeconds: 360,
    stages: BOPPPS_STAGES.map((stage, index) => ({
      stage,
      durationSeconds: 60,
      steps: index === 0
        ? [{
          id: 'projection-step',
          title: '角色隔离页',
          durationSeconds: 60,
          layoutId: 'three-column',
          modules: [
            {
              id: 'visible-content',
              canonicalClass: 'content.rich',
              slotId: 'left',
              sizeId: 'third',
              payload: { text: '学生可见内容' },
              roleMetadata: {
                studentVisible: true,
                teacherVisible: true,
                referenceAnswerVisibility: 'none',
              },
            },
            {
              id: 'teacher-secret',
              canonicalClass: 'content.code',
              slotId: 'center',
              sizeId: 'third',
              payload: { language: 'text', code: 'TEACHER_SECRET_REFERENCE' },
              roleMetadata: {
                studentVisible: false,
                teacherVisible: true,
                referenceAnswerVisibility: 'none',
              },
            },
            {
              id: 'student-activity',
              canonicalClass: 'activity.panel',
              slotId: 'right',
              sizeId: 'third',
              responseKind: 'choice.single',
              evidencePath: 'responses.projection-step.student-activity',
              payload: {
                prompt: '请选择学生答案',
                options: [
                  { value: 'a', label: 'A' },
                  { value: 'b', label: 'B' },
                ],
              },
              roleMetadata: {
                studentVisible: true,
                teacherVisible: true,
                referenceAnswerVisibility: 'teacher-only',
              },
            },
          ],
        }]
        : [{
          id: `projection-step-${index + 1}`,
          title: `占位页 ${index + 1}`,
          durationSeconds: 60,
          layoutId: 'single',
          modules: [{
            id: `projection-module-${index + 1}`,
            canonicalClass: 'content.rich',
            slotId: 'main',
            sizeId: 'full',
            payload: { text: `占位内容 ${index + 1}` },
            roleMetadata: {
              studentVisible: true,
              teacherVisible: true,
              referenceAnswerVisibility: 'none',
            },
          }],
        }],
    })),
  };
}

function makeActivityModule(
  id: string,
  slotId: string,
  prompt: string,
): GeneratedSlideStep['modules'][number] {
  return {
    id,
    canonicalClass: 'activity.panel',
    slotId,
    sizeId: 'third',
    responseKind: 'choice.single',
    evidencePath: `responses.projection-step.${id}`,
    payload: {
      prompt,
      options: [
        { value: `${id}-yes`, label: `${prompt} A` },
        { value: `${id}-no`, label: `${prompt} B` },
      ],
    },
    roleMetadata: {
      studentVisible: true,
      teacherVisible: true,
      referenceAnswerVisibility: 'teacher-only',
    },
  };
}

describe('generated slide layout renderer', () => {
  it('scales one fixed 16:9 canvas and exposes every named slot without hiding overflow', () => {
    const step = makeGeneratedStep();
    const html = renderToStaticMarkup(renderInteractiveLessonLayout({
      step,
      titleNode: createElement('h1', null, '画布内标题'),
      regionNodes: [
        {
          moduleId: 'primary-card',
          regionId: 'left',
          node: createElement('div', null, '主要内容'),
        },
      ],
    }));

    expect(html).toContain(`data-generated-slide-contract="${GENERATED_SLIDE_SCHEMA_VERSION}"`);
    expect(html).toContain('data-generated-slide-aspect-ratio="16:9"');
    expect(html).toContain('data-generated-slide-scaling="whole-canvas"');
    expect(html).toContain('data-canvas-width="1600"');
    expect(html).toContain('data-canvas-height="900"');
    expect(html).toContain('aspect-ratio:16 / 9');
    expect(html).toContain('transform:scale(calc(100cqw / 1600px))');
    expect(html).toContain('data-generated-slide-slot="left"');
    expect(html).toContain('data-generated-slide-slot="right"');
    expect(html).toContain('grid-column:1 / 7;grid-row:1 / 10');
    expect(html).toContain('grid-column:7 / 13;grid-row:1 / 10');
    expect(html).toContain('data-generated-slide-role-states="student teacher"');
    expect(html).toContain('data-generated-slide-student-visible="true"');
    expect(html).toContain('data-generated-slide-teacher-visible="true"');
    expect(html).toContain('data-generated-slide-reference-answer="none"');
    expect(html).toContain('data-generated-slide-module="primary-card"');
    expect(html).toContain('data-generated-slide-module-class="content.rich"');
    expect(html).toContain('data-generated-slide-normal-font-px="32"');
    expect(html).toContain('data-generated-slide-minimum-font-px="24"');
    expect(html).toContain('font-size:32px');
    expect(html).toContain('--generated-slide-normal-font-px:32px');
    expect(html).toContain('--generated-slide-minimum-font-px:24px');
    expect(html).toContain('data-generated-slide-internal-scroll="false"');
    expect(html).toContain('data-generated-slide-truncation="false"');
    expect(html).toContain('data-generated-slide-font-fit="normal"');
    expect(html).not.toMatch(/overflow:(?:hidden|auto|scroll)/);
    expect(html).not.toContain('text-overflow:ellipsis');
  });

  it('renders bounded adapted typography and a visible machine-readable unfit state', () => {
    const adaptedStep = makeGeneratedStep();
    adaptedStep.modules[0].payload = { text: 'A'.repeat(500) };
    const adaptedHtml = renderToStaticMarkup(renderInteractiveLessonLayout({
      step: adaptedStep,
      regionNodes: [],
    }));
    expect(adaptedHtml).toContain('data-generated-slide-font-fit="adapted"');
    expect(adaptedHtml).toContain('font-size:28px');

    const unfitStep = makeGeneratedStep();
    unfitStep.modules[0].payload = { text: 'A'.repeat(601) };
    const unfitHtml = renderToStaticMarkup(renderInteractiveLessonLayout({
      step: unfitStep,
      regionNodes: [],
    }));
    expect(unfitHtml).toContain('data-generated-slide-font-fit="unfit"');
    expect(unfitHtml).toContain('data-generated-slide-unfit="primary-card"');
    expect(unfitHtml).toContain('data-generated-slide-unfit-warning="primary-card"');
    expect(unfitHtml).toContain('内容超过该版式的最小可读字号容量。');
  });

  it('keeps following content at the scaled canvas bottom instead of the unscaled 900px height', async () => {
    const slideHtml = renderToStaticMarkup(renderInteractiveLessonLayout({
      step: makeGeneratedStep(),
      regionNodes: [],
    }));
    const html = `<main style="width:800px">${slideHtml}<div data-after-generated-slide>后续内容</div></main>`;

    const viewportIndex = html.indexOf('data-generated-slide-step');
    const canvasIndex = html.indexOf('data-generated-slide-canvas');
    const siblingIndex = html.indexOf('data-after-generated-slide');

    expect(html.slice(viewportIndex, canvasIndex)).toContain('aspect-ratio:16 / 9');
    expect(html.slice(viewportIndex, canvasIndex)).toContain('position:relative');
    expect(html.slice(canvasIndex, siblingIndex)).toContain('position:absolute');
    expect(html.slice(canvasIndex, siblingIndex)).toContain('inset:0');
    expect(siblingIndex).toBeGreaterThan(canvasIndex);
    expect(html).not.toContain('height:900px;position:relative');

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
      await page.setContent(`<style>html,body{margin:0}</style>${html}`);
      const geometry = await page.evaluate(() => {
        const viewport = document.querySelector('[data-generated-slide-step]')!.getBoundingClientRect();
        const canvas = document.querySelector('[data-generated-slide-canvas]')!.getBoundingClientRect();
        const sibling = document.querySelector('[data-after-generated-slide]')!.getBoundingClientRect();
        return {
          viewportHeight: viewport.height,
          viewportBottom: viewport.bottom,
          canvasBottom: canvas.bottom,
          siblingTop: sibling.top,
        };
      });

      expect(geometry.viewportHeight).toBeCloseTo(450, 1);
      expect(geometry.canvasBottom).toBeCloseTo(geometry.viewportBottom, 1);
      expect(geometry.siblingTop).toBeCloseTo(geometry.canvasBottom, 1);
      expect(geometry.siblingTop).not.toBeCloseTo(900, 1);
    } finally {
      await browser.close();
    }
  });

  it('renders generated content and activity through adapted runtime objects', () => {
    const generatedManifest = makeGeneratedManifest();
    const generatedStep = generatedManifest.stages[0].steps[0];
    const contentRenderer = vi.fn(({ manifest, step, module }) => createElement(
      'div',
      { 'data-runtime-content': module.id },
      `${manifest.lessonId}:${step.id}:${String(module.payload.text)}`,
    ));
    const secretRenderer = vi.fn(({ module }) => createElement(
      'pre',
      { 'data-runtime-secret': module.id },
      String(module.payload.code),
    ));
    const moduleRegistry: InteractiveModuleRegistry = {
      'content.rich': contentRenderer,
      'content.code': secretRenderer,
    };
    const activityRenderer = vi.fn(({ manifest, step, module, projection }) => {
      expect(JSON.stringify({ manifest, step, module })).not.toContain('TEACHER_SECRET_REFERENCE');
      return createElement(
        'div',
        { 'data-runtime-activity': projection },
        String(module.payload.prompt),
      );
    });

    const html = renderToStaticMarkup(renderGeneratedSlideManifestStep({
      generatedManifest,
      generatedStep,
      projection: 'student',
      moduleRegistry,
      activityRenderer,
      extra: undefined,
    }));

    expect(html).toContain('renderer-projection-fixture:projection-step:学生可见内容');
    expect(html).toContain('data-runtime-activity="student"');
    expect(html).toContain('请选择学生答案');
    expect(contentRenderer).toHaveBeenCalledOnce();
    expect(activityRenderer).toHaveBeenCalledOnce();
    expect(secretRenderer).not.toHaveBeenCalled();
  });

  it('isolates each activity renderer callback to its own card and evidence path', () => {
    const generatedManifest = makeGeneratedManifest();
    const generatedStep = generatedManifest.stages[0].steps[0];
    generatedStep.modules = [
      makeActivityModule('left-activity', 'left', '左侧活动'),
      makeActivityModule('center-activity', 'center', '中间活动'),
      makeActivityModule('right-activity', 'right', '右侧活动'),
    ];
    const adaptedStep = adaptGeneratedSlideManifestToInteractiveRuntime(generatedManifest)
      .runtimeManifest.steps.find((step) => step.id === generatedStep.id);
    expect(adaptedStep?.interactionSpec.activityCards).toHaveLength(3);
    expect(adaptedStep?.interactionSpec.submitFields).toHaveLength(3);
    const activityRenderer = vi.fn(({
      manifest,
      step,
    }: GeneratedSlideActivityRendererProps) => {
      expect(manifest.steps.find((candidate) => candidate.id === step.id)).toBe(step);
      return createElement(
        'div',
        null,
        step.interactionSpec.activityCards?.map((card) => createElement(
          'span',
          { key: card.id, 'data-rendered-card': card.id },
          card.prompt,
        )),
      );
    });

    const html = renderToStaticMarkup(renderGeneratedSlideManifestStep({
      generatedManifest,
      generatedStep,
      projection: 'student',
      moduleRegistry: {},
      activityRenderer,
      extra: undefined,
    }));

    expect(activityRenderer).toHaveBeenCalledTimes(3);
    for (const generatedModule of generatedStep.modules) {
      const call = activityRenderer.mock.calls.find(([props]) => props.module.id === generatedModule.id);
      expect(call?.[0].step.interactionSpec.activityCards?.map((card) => card.id)).toEqual([generatedModule.id]);
      expect(call?.[0].step.evidenceSequence).toEqual([generatedModule.evidencePath]);
      expect(call?.[0].step.interactionSpec.submitFields).toEqual([generatedModule.evidencePath]);
      expect(call?.[0].step.telemetrySpec.summaryFields).toEqual([generatedModule.evidencePath]);
      expect(html.match(new RegExp(`data-rendered-card="${generatedModule.id}"`, 'g'))).toHaveLength(1);
    }
  });

  it('keeps student-invisible modules and their teacher reference data out of the student DOM', () => {
    const generatedManifest = makeGeneratedManifest();
    const generatedStep = generatedManifest.stages[0].steps[0];
    const secretRenderer = vi.fn(({ module }) => createElement('pre', null, String(module.payload.code)));
    const moduleRegistry: InteractiveModuleRegistry = {
      'content.rich': ({ module }) => createElement('div', null, String(module.payload.text)),
      'content.code': secretRenderer,
    };
    const activityRenderer = ({ module }: { module: { payload: Record<string, unknown> } }) =>
      createElement('div', null, String(module.payload.prompt));

    const studentHtml = renderToStaticMarkup(renderGeneratedSlideManifestStep({
      generatedManifest,
      generatedStep,
      projection: 'student',
      moduleRegistry,
      activityRenderer,
      extra: undefined,
    }));
    const teacherHtml = renderToStaticMarkup(renderGeneratedSlideManifestStep({
      generatedManifest,
      generatedStep,
      projection: 'teacher',
      moduleRegistry,
      activityRenderer,
      extra: undefined,
    }));

    expect(studentHtml).not.toContain('teacher-secret');
    expect(studentHtml).not.toContain('TEACHER_SECRET_REFERENCE');
    expect(studentHtml).not.toContain('data-generated-slide-reference-answer="teacher-only"');
    expect(teacherHtml).toContain('data-generated-slide-module="teacher-secret"');
    expect(teacherHtml).toContain('TEACHER_SECRET_REFERENCE');
    expect(secretRenderer).toHaveBeenCalledOnce();
  });

  it('keeps the title and rendered modules inside the generated slide canvas', () => {
    const step = makeGeneratedStep();
    const html = renderToStaticMarkup(renderInteractiveLessonLayout({
      step,
      titleNode: createElement('h1', { 'data-generated-test-title': true }, step.title),
      regionNodes: [{
        moduleId: 'primary-card',
        regionId: 'left',
        node: createElement('div', null, '画布内模块'),
      }],
    }));

    const canvasIndex = html.indexOf('data-generated-slide-canvas');
    const titleIndex = html.indexOf('data-generated-test-title');
    const moduleIndex = html.indexOf('画布内模块');

    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThan(canvasIndex);
    expect(moduleIndex).toBeGreaterThan(titleIndex);
    expect(html.match(/data-generated-test-title/g)).toHaveLength(1);
  });

  it('fails a generated step closed when its layout is not registered', () => {
    const step = { ...makeGeneratedStep(), layoutId: 'unregistered-layout' };
    const legacyRenderer = vi.fn(() => createElement('div', null, 'legacy renderer'));
    const html = renderToStaticMarkup(renderInteractiveLessonLayout({
      step,
      regionNodes: [],
      templateRegistry: { 'unregistered-layout': legacyRenderer },
    }));

    expect(html).toContain('data-generated-slide-render-error="generated-step-01"');
    expect(html).toContain('role="alert"');
    expect(legacyRenderer).not.toHaveBeenCalled();
  });

  it('preserves the legacy registry and fallback path for steps without explicit opt-in', () => {
    const step = makeLegacyStep();
    const customRenderer = vi.fn(() => createElement('div', { 'data-legacy-renderer': 'custom' }));
    const html = renderToStaticMarkup(renderInteractiveLessonLayout({
      step,
      regionNodes: [],
      templateRegistry: { [step.layout.template]: customRenderer },
    }));

    expect(customRenderer).toHaveBeenCalledOnce();
    expect(html).toContain('data-legacy-renderer="custom"');
    expect(html).not.toContain('data-generated-slide-canvas');

    const fallbackHtml = renderToStaticMarkup(renderInteractiveLessonLayout({
      step: { ...step, layout: { ...step.layout, template: 'unknown-legacy-template' } },
      regionNodes: [{
        moduleId: 'legacy-module',
        regionId: 'primary',
        node: createElement('div', null, 'legacy fallback'),
      }],
      templateRegistry: {},
    }));

    expect(fallbackHtml).toContain('interactive-courseware-stack');
    expect(fallbackHtml).toContain('legacy fallback');
    expect(fallbackHtml).not.toContain('data-generated-slide-canvas');
  });
});

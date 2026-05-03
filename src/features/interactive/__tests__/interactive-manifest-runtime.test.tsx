import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  renderInteractiveLessonLayout,
  renderInteractiveManifestStep,
  type InteractiveLayoutRegionNode,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();

describe('interactive runtime manifest', () => {
  it('ships the reviewed 4-3 runtime with an interactive manifest path and loads the manifest into the runtime bundle', async () => {
    const lessonJson = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/4-3/lesson.json'), 'utf8'),
    ) as {
      interactive_manifest_path?: string;
    };

    expect(lessonJson.interactive_manifest_path).toBe('/course-runtime/lessons/4-3/interactive-manifest.json');

    const runtime = await loadLessonRuntimeEntry('4-3');

    expect(runtime.interactiveManifest).toBeDefined();
    expect(runtime.interactiveManifest?.lessonId).toBe('4-3');
    expect(runtime.interactiveManifest?.steps).toHaveLength(14);
    expect(runtime.interactiveManifest?.steps[0]?.modules.map((module) => module.kind)).toEqual([
      'stage-map',
      'goal-card-row',
    ]);
  });

  it('renders template regions through the shared layout registry in region order instead of course-local step switches', () => {
    const step = {
      id: 'step-01',
      title: '共享模板测试页',
      layout: {
        template: 'stacked_regions',
        regions: [
          { id: 'region-b', width: 'full', order: 2 },
          { id: 'region-a', width: 'full', order: 1 },
        ],
      },
    } as InteractiveRuntimeStepManifest;

    const regionNodes: InteractiveLayoutRegionNode[] = [
      { moduleId: 'module-b', regionId: 'region-b', node: createElement('div', null, 'module-b') },
      { moduleId: 'module-a', regionId: 'region-a', node: createElement('div', null, 'module-a') },
    ];

    const html = renderToStaticMarkup(renderInteractiveLessonLayout({ step, regionNodes }));

    expect(html.indexOf('module-a')).toBeLessThan(html.indexOf('module-b'));
    expect(html).toContain('data-template="stacked_regions"');
  });

  it('keeps extended Rust figure and structured submission fields in the normalized manifest', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-11': {
          title: 'Rust 面板字段测试',
          layout: { template: 'stacked_regions', regions: [] },
          modules: [],
          content_blocks: {},
          interactive_figure_spec: {
            kind: 'rust_turning_radius_panel',
            required: true,
            fallback_allowed: false,
            displayed_cases_policy: 'single_current_radius_only',
            controls: [{ id: 'R_m', min: 35, max: 160, default: 140, step: 5 }],
            dynamic_outputs: ['d_start_m', 'max_delta_deg'],
          },
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'turning-radius-submit',
                prompt: '提交规划半径和最大舵角。',
                response_kind: 'fill_text',
                structured_fields: ['R_m', 'max_delta_deg', 'safety_constraint_satisfied'],
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    expect(step!.interactiveFigureSpec.kind).toBe('rust_turning_radius_panel');
    expect(step!.interactiveFigureSpec.fallback_allowed).toBe(false);
    expect(step!.interactiveFigureSpec.displayed_cases_policy).toBe('single_current_radius_only');
    expect(step!.interactiveFigureSpec.controls).toEqual([
      { id: 'R_m', min: 35, max: 160, default: 140, step: 5 },
    ]);
    expect(step!.interactionSpec.activityCards?.[0]?.structuredFields).toEqual([
      'R_m',
      'max_delta_deg',
      'safety_constraint_satisfied',
    ]);
  });

  it('loads the reviewed 4-6 runtime manifest including teacher_reveal_only steps', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');

    expect(runtime.interactiveManifest?.lessonId).toBe('4-6');
    expect(runtime.interactiveManifest?.steps).toHaveLength(11);
    expect(runtime.interactiveManifest?.steps.map((step) => step.interactionSpec.interactionKind)).toContain(
      'teacher_reveal_only',
    );
  });

  it('renders the revised 4-6 content payload from the manifest', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const manifest = runtime.interactiveManifest!;
    const moduleRegistry = {
      'formula-card': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'summary-card': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'native-table': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'image-panel': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'step-reveal': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
    };

    const renderStep = (stepId: string) => {
      const step = manifest.steps.find((item) => item.id === stepId);
      expect(step).toBeDefined();
      return renderToStaticMarkup(
        renderInteractiveManifestStep({
          manifest,
          step: step!,
          moduleRegistry,
          extra: undefined,
        }),
      );
    };

    expect(renderStep('step-01')).toContain('多段快速机动');
    expect(renderStep('step-04')).toContain('legacy-symbol-table');
    expect(renderStep('step-05')).toContain('船是否真正走到位');
    expect(renderStep('step-06')).toContain('解码例');
    expect(renderStep('step-11')).toContain('4-6-info.png');
  });

  it('renders visible errors for required modules without a renderer instead of silently dropping them', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const step = runtime.interactiveManifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: runtime.interactiveManifest!,
        step: step!,
        moduleRegistry: {},
        extra: undefined,
      }),
    );

    expect(html).toContain('data-manifest-render-error="step-01:plant-card"');
    expect(html).toContain('缺少模块 renderer');
  });

  it('renders a separate manifest page title module before page content', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-title': {
          title: '页面标题测试',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'body',
              region: 'main',
              kind: 'summary-card',
              must_be_visible: true,
              payload: { text: '正文证据' },
            },
          ],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'display',
            student_task: '本页说明主要任务。',
            activity_cards: [],
          },
          ai_context_spec: {
            page_goal: '本页描述主内容。',
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step: step!,
        moduleRegistry: {
          'summary-card': () => createElement('div', null, '正文证据'),
        },
        extra: undefined,
      }),
    );

    expect(html).toContain('data-manifest-step-title="step-title"');
    expect(html.indexOf('第 01 页')).toBeLessThan(html.indexOf('正文证据'));
    expect(html).toContain('页面标题测试');
    expect(html).toContain('本页描述主内容。');
  });

  it('keeps activity runtime modules out of the static content layout even when a content registry contains a matching renderer', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-activity': {
          title: '作答模块分层测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'summary-a',
              title: '静态总结',
              region: 'main',
              kind: 'summary-card',
              must_be_visible: true,
              payload: { text: '正文只保留静态内容。' },
            },
            {
              id: 'activity-a',
              title: '作答卡',
              region: 'main',
              kind: 'activity-card',
              must_be_visible: true,
              payload: {},
            },
          ],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'activity-a',
                prompt: '这个题面只能出现在活动作答区。',
                response_kind: 'fill_text',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step: step!,
        moduleRegistry: {
          'summary-card': ({ module }) => createElement('div', null, String(module.payload.text ?? '')),
          'activity-card': () => createElement('div', null, '本页作答', '这个题面只能出现在活动作答区。'),
        },
        extra: undefined,
      }),
    );

    expect(html).toContain('正文只保留静态内容。');
    expect(html).not.toContain('本页作答');
    expect(html).not.toContain('这个题面只能出现在活动作答区。');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders reveal blocks that store progressive content in a layers field', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-reveal-layers': {
          title: '显影层测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'formula-reveal',
              title: '公式显影链',
              region: 'main',
              kind: 'step-reveal',
              must_be_visible: true,
              payload: { block_key: 'reveal_layers' },
            },
          ],
          content_blocks: {
            reveal_layers: {
              type: 'reveal',
              layers: ['第一层推导', '第二层结论'],
            },
          },
          interaction_spec: {
            interaction_kind: 'display',
            activity_cards: [],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step: step!,
        moduleRegistry: createManifestContentModuleRegistry({
          revealProgress: 1,
          allowInlineReveal: true,
        }),
        extra: {
          revealProgress: 1,
          allowInlineReveal: true,
        },
      }),
    );

    expect(html).toContain('公式显影链');
    expect(html).toContain('第一层推导');
    expect(html).toContain('第二层结论');
    expect(html).not.toContain('第 1 层');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders objective lists from content block items', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-objectives': {
          title: '目标页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'objective-list',
              title: '完成本次课程后，学习者能够',
              region: 'main',
              kind: 'objective-list',
              must_be_visible: true,
              payload: { block_key: 'objectives' },
            },
          ],
          content_blocks: {
            objectives: {
              type: 'bullet_list',
              items: ['识别边界条件。', '解释预测失真。'],
            },
          },
          interaction_spec: {
            interaction_kind: 'display',
            activity_cards: [],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step: step!,
        moduleRegistry: createManifestContentModuleRegistry({
          revealProgress: 0,
          allowInlineReveal: true,
        }),
        extra: {
          revealProgress: 0,
          allowInlineReveal: true,
        },
      }),
    );

    expect(html).toContain('完成本次课程后，学习者能够');
    expect(html).toContain('识别边界条件。');
    expect(html).toContain('解释预测失真。');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders drag-match activity cards as three-column matching slots', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-match': {
          title: '配对页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'match-a',
                title: '边界配对',
                prompt: '完成现象与边界类型配对。',
                response_kind: 'drag_match',
                options: [
                  { value: 'sat', label: '输出被压平 -> 饱和' },
                  { value: 'dead', label: '小信号无动作 -> 死区' },
                ],
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          savedResponse: undefined,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: () => undefined,
        }),
      ),
    );

    expect(html).toContain('待配对项');
    expect(html).toContain('配对空槽');
    expect(html).toContain('备选项');
    expect(html).toContain('输出被压平');
    expect(html).toContain('饱和');
  });

  it('keeps student activity renderer references stable across registry factory calls', () => {
    const first = createManifestStudentActivityRegistry<{ id: string }>();
    const second = createManifestStudentActivityRegistry<{ id: string }>();

    expect(second.drag_match).toBe(first.drag_match);
    expect(second.activity_card_set).toBe(first.activity_card_set);
    expect(second.teacher_reveal_only).toBe(first.teacher_reveal_only);
    expect(first.drag_match).toBe(first.activity_cards);
  });

  it('keeps partial drag-match assignments instead of resetting empty slots', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-match-partial': {
          title: '配对页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'match-a',
                title: '边界配对',
                prompt: '完成现象与边界类型配对。',
                response_kind: 'drag_match',
                options: [
                  { value: 'sat', label: '输出被压平 -> 饱和' },
                  { value: 'dead', label: '小信号无动作 -> 死区' },
                ],
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          savedResponse: {
            stepId: step!.id,
            submittedAt: Date.now(),
            answers: { 'match-a': 'sat|' },
          },
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: () => undefined,
        }),
      ),
    );

    expect(html).toContain('border-cyan-300/60');
    expect(html).toContain('饱和');
    expect(html).toContain('拖入对应备选项');
    expect(html).toContain('border-border/60');
    expect(html).not.toContain('bg-slate-50');
  });

  it('shuffles drag-match candidate options away from the correct manifest order', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-match-shuffle': {
          title: '配对页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'match-a',
                title: '边界配对',
                prompt: '完成现象与边界类型配对。',
                response_kind: 'drag_match',
                options: [
                  { value: 'alpha', label: '甲源 -> 甲目标' },
                  { value: 'bravo', label: '乙源 -> 乙目标' },
                  { value: 'charlie', label: '丙源 -> 丙目标' },
                ],
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          savedResponse: undefined,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: () => undefined,
        }),
      ),
    );
    const candidateHtml = html.slice(html.indexOf('备选项'));

    expect(candidateHtml.indexOf('甲目标')).not.toBeLessThan(candidateHtml.indexOf('乙目标'));
  });

  it('renders drag-match teacher view as blank slots until reference answers are revealed', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-match-teacher': {
          title: '配对页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'match-a',
                title: '边界配对',
                prompt: '完成现象与边界类型配对。',
                response_kind: 'drag_match',
                options: [
                  { value: 'sat', label: '输出被压平 -> 饱和' },
                  { value: 'dead', label: '小信号无动作 -> 死区' },
                ],
                reference_answer: '输出被压平对应饱和，小信号无动作对应死区。',
              },
            ],
          },
          teacher_controls: {
            release_activity: 'teacher_toggle',
            open_browse: 'page_load_open',
            teacher_step_reveal: 'not_applicable',
            reveal_reference_answer: 'teacher_toggle',
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          responses: [],
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onToggleRelease: () => undefined,
          onToggleBrowse: () => undefined,
          onToggleAnswerVisible: () => undefined,
          onAdvanceReveal: () => undefined,
          onResetReveal: () => undefined,
        }),
      ),
    );

    expect(html).toContain('待配对项');
    expect(html).toContain('配对空槽');
    expect(html).toContain('备选项');
    expect(html).toContain('待学生拖入');
    expect(html).not.toContain('输出被压平 -&gt; 饱和');
    expect(html).not.toContain('参考解释');
  });

  it('maps 4-7 task and identification manifest content without title-only shells or duplicate activity prompts', async () => {
    const runtime = await loadLessonRuntimeEntry('4-7');
    const manifest = runtime.interactiveManifest!;
    const step = manifest.steps.find((item) => item.id === 'step-03');
    expect(step).toBeDefined();
    const formulaModules = step!.modules.filter((module) => module.kind === 'formula-card');
    const formulaAt = (moduleId: string) => {
      const index = formulaModules.findIndex((module) => module.id === moduleId);
      const formulas = step!.contentBlocks.key_formulas;
      return Array.isArray(formulas) ? String(formulas[index] ?? '') : '';
    };

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: step!,
        moduleRegistry: {
          'native-table': ({ step: currentStep }) => createElement('div', null, JSON.stringify(currentStep.contentBlocks.route_task_table)),
          'formula-card': ({ module }) => createElement('div', null, module.id, formulaAt(module.id)),
          'summary-card': ({ step: currentStep }) => createElement('div', null, String(currentStep.contentBlocks.conclusion ?? '')),
          'image-panel': ({ step: currentStep }) => createElement('div', null, JSON.stringify(currentStep.contentBlocks.media), String(currentStep.contentBlocks.figure_explanation ?? '')),
          'step-reveal': ({ step: currentStep }) => createElement('div', null, JSON.stringify(currentStep.contentBlocks.reveal_layers)),
        },
        extra: undefined,
      }),
    );

    expect(html).not.toContain('data-manifest-render-error');
    expect(html).toContain('15.0');
    expect(html).toContain('29.2');
    expect(html).toContain('结构图把舵令');
    expect(html).not.toContain('本页作答');
    expect(html).not.toContain('为什么方波航向图必须同时显示给定航向和实际航向？');
    expect(html).not.toContain('扰动为什么要放在舵机之后、船体之前');
  });

  it('renders 4-7 formula text in table headers, formula cards, and activity prompts through the shared rich text helpers', async () => {
    const runtime = await loadLessonRuntimeEntry('4-7');
    const manifest = runtime.interactiveManifest!;
    const step06 = manifest.steps.find((item) => item.id === 'step-06');
    const step07 = manifest.steps.find((item) => item.id === 'step-07');
    const step10 = manifest.steps.find((item) => item.id === 'step-10');
    expect(step06?.contentBlocks.key_formulas).toEqual(
      expect.arrayContaining([
        expect.stringContaining('C_{trad}(s)'),
      ]),
    );
    const step07ModuleIds = step07?.modules.map((module) => module.id) ?? [];
    const step10ModuleIds = step10?.modules.map((module) => module.id) ?? [];
    expect(step07ModuleIds.indexOf('optimization-controller-symbols')).toBeGreaterThan(-1);
    expect(step07ModuleIds.indexOf('optimization-controller-symbols')).toBeLessThan(
      step07ModuleIds.indexOf('controller-table'),
    );
    expect(step10ModuleIds.indexOf('noise-controller-symbols')).toBeGreaterThan(-1);
    expect(step10ModuleIds.indexOf('noise-controller-symbols')).toBeLessThan(
      step10ModuleIds.indexOf('noise-controller-table'),
    );
    expect(step07?.contentBlocks.controller_symbol_notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('$C_4$'),
        expect.stringContaining('$k_p,k_i,k_d$'),
      ]),
    );
    expect(step10?.contentBlocks.controller_symbol_notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('$C_4$'),
        expect.stringContaining('$\\tau_m$'),
      ]),
    );
    expect(step07?.contentBlocks.controller_table).toMatchObject({
      columns: expect.arrayContaining([
        '$k_p$',
        expect.stringMatching(/beta/),
      ]),
    });
    expect(step07?.interactionSpec.activityCards?.[0]?.prompt).toContain('$C_3$');

    const contentSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    const activitySource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(contentSource).toContain('<th key={column} className="px-3 py-2 font-semibold">{renderInlineContent(column)}</th>');
    expect(contentSource).toContain('renderFormulaContent');
    expect(activitySource).toContain('renderActivityInlineContent(card.prompt)');
    expect(activitySource).toContain('renderActivityInlineContent(option.label)');
    expect(activitySource).toContain('renderActivityInlineContent(card.referenceAnswer)');
  });

  it('renders 4-7 summary limitation objects as concrete text instead of object strings', async () => {
    const runtime = await loadLessonRuntimeEntry('4-7');
    const manifest = runtime.interactiveManifest!;
    const step = manifest.steps.find((item) => item.id === 'step-12');
    expect(step).toBeDefined();

    expect(step?.contentBlocks.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '固定低阶传递函数',
          explanation: expect.stringContaining('不能完整表达横荡'),
        }),
      ]),
    );

    const contentSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    expect(contentSource).toContain('record.name');
    expect(contentSource).toContain('record.explanation');
    expect(contentSource).not.toContain('asStringArray(rawBlock)');
  });

  it('keeps multiple modules in the same manifest region in module order', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const step = runtime.interactiveManifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: runtime.interactiveManifest!,
        step: step!,
        moduleRegistry: {
          'formula-card': ({ module }) => createElement('div', null, module.id),
          'summary-card': ({ module }) => createElement('div', null, module.id),
          'image-panel': ({ module }) => createElement('div', null, module.id),
        },
        extra: undefined,
      }),
    );

    expect(html.indexOf('plant-card')).toBeLessThan(html.indexOf('recovered-solution-card'));
    expect(html.indexOf('recovered-solution-card')).toBeLessThan(html.indexOf('problem-focus'));
  });

  it('normalizes module payload titles and activity card reference answers from manifest payload', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'module-a',
              title: 'manifest 模块标题',
              region: 'main',
              kind: 'summary-card',
              must_be_visible: true,
              payload: { block_key: 'summary_a' },
            },
          ],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'card-a',
                title: 'manifest 卡片标题',
                prompt: '写出判断依据。',
                reference_answer: 'manifest 参考答案',
                response_kind: 'fill_text',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
        },
      },
    });

    expect(manifest?.steps[0]?.modules[0]).toMatchObject({
      title: 'manifest 模块标题',
      payload: { block_key: 'summary_a' },
    });
    expect(manifest?.steps[0]?.interactionSpec.activityCards?.[0]).toMatchObject({
      title: 'manifest 卡片标题',
      referenceAnswer: 'manifest 参考答案',
    });
  });

  it('normalizes manifest choice options and keeps shared activity renderers option-driven', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-quiz': {
          title: '选择题测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'quiz_group',
            activity_cards: [
              {
                id: 'choice-a',
                title: '判断主导矛盾',
                prompt: '哪一项最能解释当前失配？',
                response_kind: 'single_choice',
                options: [
                  { value: 'plant_mismatch', label: '对象模型变化' },
                  '执行器限幅',
                ],
                reference_answer: '对象模型变化。',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
        },
      },
    });

    const step = manifest?.steps[0];
    const card = step?.interactionSpec.activityCards?.[0];

    expect(card?.options).toEqual([
      { value: 'plant_mismatch', label: '对象模型变化' },
      { value: '执行器限幅', label: '执行器限幅' },
    ]);

    const activitySource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(activitySource).toContain('card.options');
    expect(activitySource).toContain('type="radio"');
  });

  it('renders teacher activity aggregation by default and hides submitter names until details are opened', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-teacher-summary': {
          title: '教师汇总题面测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'quiz_group',
            activity_cards: [
              {
                id: 'choice-a',
                title: '判断主导矛盾',
                prompt: '哪一项最能解释当前失配？',
                response_kind: 'single_choice',
                options: [
                  { value: 'plant_mismatch', label: '对象模型变化' },
                  { value: 'actuator_limit', label: '执行器限幅' },
                ],
                reference_answer: '对象模型变化。',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
          teacher_controls: {
            release_activity: 'teacher_toggle',
            open_browse: 'page_load_open',
            teacher_step_reveal: 'not_applicable',
            reveal_reference_answer: 'teacher_toggle',
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          responses: [
            {
              studentName: '学生甲',
              response: {
                stepId: step!.id,
                submittedAt: 1,
                answers: { 'choice-a': 'plant_mismatch' },
              } satisfies ManifestStepResponse,
            },
          ],
          released: true,
          browseEnabled: true,
          answerVisible: true,
          revealProgress: 0,
          onToggleRelease: () => undefined,
          onToggleBrowse: () => undefined,
          onToggleAnswerVisible: () => undefined,
          onAdvanceReveal: () => undefined,
          onResetReveal: () => undefined,
        }),
      ),
    );

    expect(html).toContain('哪一项最能解释当前失配？');
    expect(html).toContain('对象模型变化');
    expect(html).toContain('执行器限幅');
    expect(html.indexOf('哪一项最能解释当前失配？')).toBeLessThan(html.indexOf('已提交 1 人'));
    expect(html).toContain('查看细节');
    expect(html).toContain('1 人 · 100%');
    expect(html).not.toContain('学生甲');
    expect(html).toContain('参考解释');
  });

  it('renders teacher-direct reveal controls through the shared teacher activity registry', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-reveal': {
          title: '教师显影测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'worked_example_reveal',
            activity_cards: [],
          },
          teacher_controls: {
            release_activity: 'not_applicable',
            open_browse: 'not_applicable',
            teacher_step_reveal: 'teacher_direct',
            reveal_reference_answer: 'not_applicable',
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          responses: [],
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 1,
          onToggleRelease: () => undefined,
          onToggleBrowse: () => undefined,
          onToggleAnswerVisible: () => undefined,
          onAdvanceReveal: () => undefined,
          onResetReveal: () => undefined,
        }),
      ),
    );

    expect(html).toContain('推进显影');
    expect(html).toContain('重置显影');
    expect(html).toContain('当前教师显影层级：2');
  });

  it('allows shared step-reveal content to use a controlled teacher advance callback', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    expect(source).toContain('onInlineReveal');
    expect(source).toContain('onInlineReveal?.()');
    expect(source).toContain('const visibleCount = onInlineReveal');
    expect(source).toMatch(/onInlineReveal\s*\?\s*teacherVisibleCount/);
    expect(source).toContain('setLocalVisibleCount(teacherVisibleCount)');
  });

  it('keeps drag-match draft answers controlled by parent runtime state', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(source).toContain('normalizeDragMatchAssignments(value, optionValues)');
    expect(source).toContain("onChange(next.join('|'))");
    expect(source).not.toContain('setLocalAssignments(normalizedAssignments)');
    expect(source).not.toContain('bg-slate-50');
    expect(source).toContain('items-center');
  });

  it('does not commit drag-match assignments before the dragged option is released', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/onDragEnter=\{[\s\S]{0,220}assignToSlot/);
    expect(source).not.toMatch(/onMouseEnter=\{[\s\S]{0,120}assignToSlot/);
    expect(source).toMatch(/onDrop=\{[\s\S]{0,220}assignToSlot/);
    expect(source).toMatch(/onMouseUp=\{[\s\S]{0,180}assignToSlot/);
  });

  it('caps teacher reveal controls at the number of manifest layers', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-reveal-cap': {
          title: '教师显影上限测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {
            reveal_layers: {
              type: 'reveal',
              layers: ['第一层', '第二层'],
            },
          },
          interaction_spec: {
            interaction_kind: 'worked_example_reveal',
            activity_cards: [],
          },
          teacher_controls: {
            release_activity: 'not_applicable',
            open_browse: 'not_applicable',
            teacher_step_reveal: 'teacher_direct',
            reveal_reference_answer: 'not_applicable',
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          responses: [],
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 3,
          onToggleRelease: () => undefined,
          onToggleBrowse: () => undefined,
          onToggleAnswerVisible: () => undefined,
          onAdvanceReveal: () => undefined,
          onResetReveal: () => undefined,
        }),
      ),
    );

    expect(html).toContain('当前教师显影层级：2 / 2');
    expect(html).toContain('disabled=""');
  });

  it('keeps parameter slider and table builder teacher controls in the shared activity registry', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-slider': {
          title: '参数调节页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'parameter_slider',
            activity_cards: [{ id: 'design', prompt: '提交当前参数判断。', response_kind: 'text' }],
          },
          teacher_controls: {
            release_activity: 'teacher_toggle',
            open_browse: 'not_applicable',
            teacher_step_reveal: 'not_applicable',
            reveal_reference_answer: 'not_applicable',
          },
        },
        'step-table': {
          title: '表格填写页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'table_builder',
            activity_cards: [{ id: 'mapping', prompt: '填写综合映射表。', response_kind: 'table_builder' }],
          },
          teacher_controls: {
            release_activity: 'teacher_toggle',
            open_browse: 'not_applicable',
            teacher_step_reveal: 'not_applicable',
            reveal_reference_answer: 'not_applicable',
          },
        },
      },
    });
    const registry = createManifestTeacherActivityRegistry();

    for (const step of manifest!.steps) {
      const html = renderToStaticMarkup(
        createElement(
          'div',
          null,
          renderTeacherInteractiveActivity({
            registry,
            step: { id: step.id },
            stepManifest: step,
            responses: [],
            released: false,
            browseEnabled: true,
            answerVisible: false,
            revealProgress: 0,
            onToggleRelease: () => undefined,
            onToggleBrowse: () => undefined,
            onToggleAnswerVisible: () => undefined,
            onAdvanceReveal: () => undefined,
            onResetReveal: () => undefined,
          }),
        ),
      );

      expect(html).toContain('发放作答');
      expect(html).toContain(step.interactionSpec.activityCards?.[0]?.prompt);
    }
  });

  it('keeps manifest activity registries for the three shared activity kinds without course-id answer maps', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(source).toContain('activity_card_set:');
    expect(source).toContain('parameter_slider:');
    expect(source).toContain('task_card_workspace:');
    expect(source).toContain('table_builder:');
    expect(source).toContain('quiz_group:');
    expect(source).toContain('teacher_reveal_only:');
    expect(source).toContain('worked_example_reveal:');
    expect(source).toContain('card.referenceAnswer');
    expect(source).toContain('data-manifest-missing-field');
    expect(source).not.toContain('REFERENCE_ANSWERS');
    expect(source).not.toContain('task-change-card');
  });

  it('drives 4-6 shared content modules through manifest payload instead of course-specific module ids', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const manifest = runtime.interactiveManifest!;
    const contentKinds = new Set(['formula-card', 'summary-card', 'native-table', 'image-panel', 'step-reveal']);

    const contentModules = manifest.steps.flatMap((step) =>
      step.modules
        .filter((module) => contentKinds.has(module.kind))
        .map((module) => ({ stepId: step.id, module })),
    );

    expect(contentModules.length).toBeGreaterThan(0);
    for (const { stepId, module } of contentModules) {
      expect(module.payload, `${stepId}:${module.id}`).not.toEqual({});
    }

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    expect(source).not.toContain("moduleId === 'plant-card'");
    expect(source).not.toContain("'mismatch-reveal':");
    expect(source).not.toContain("'scenario-compare-table'");
    expect(source).not.toContain("'lesson-info-figure'");
  });

  it('drives 4-3 choice and quiz activity options from manifest instead of course-local constants', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const manifest = runtime.interactiveManifest!;
    const branchChoice = manifest.steps
      .find((step) => step.id === 'step-03')
      ?.interactionSpec.activityCards?.[0];
    const postQuizCards = manifest.steps
      .find((step) => step.id === 'step-14')
      ?.interactionSpec.activityCards ?? [];

    expect(branchChoice?.responseKind).toBe('single_choice');
    expect(branchChoice?.options.map((option) => option.label)).toEqual([
      '继续单结构',
      '进入复合结构',
      '反馈 + 前馈组合',
    ]);
    expect(branchChoice?.referenceAnswer).toContain('表 1');

    expect(postQuizCards).toHaveLength(3);
    expect(postQuizCards.every((card) => card.responseKind === 'single_choice')).toBe(true);
    expect(postQuizCards.every((card) => card.options.length === 3)).toBe(true);
    expect(postQuizCards.map((card) => card.referenceAnswer)).toEqual([
      '因为当前主矛盾未必在低频保持能力',
      '先改什么、希望换来什么、可能先透支什么',
      '因为第一版方案的价值在于形成下一轮入口',
    ]);

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );

    expect(source).not.toContain('QUIZ_OPTIONS');
    expect(source).not.toContain('SINGLE_CHOICE_OPTIONS');
  });

  it('covers reusable 4-3 static and path module kinds while leaving activity kinds to the activity registry', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const moduleKinds = new Set(runtime.interactiveManifest!.steps.flatMap((step) => step.modules.map((module) => module.kind)));
    const sharedKinds = [
      'stage-map',
      'goal-card-row',
      'goal-card-set',
      'question-card-set',
      'native-formula-table',
      'table-card',
      'problem-statement',
      'title-card',
      'route-card',
      'template-card',
      'figure-note',
      'rust-analysis-panel',
      'rust-time-compare-panel',
      'rust-bode-compare-panel',
    ];
    const activityModuleKinds = ['activity-card', 'activity-card-set', 'single-choice-card', 'quiz-group'];

    for (const kind of sharedKinds) {
      expect(moduleKinds.has(kind), kind).toBe(true);
    }
    for (const kind of activityModuleKinds) {
      expect(moduleKinds.has(kind), kind).toBe(true);
    }

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    for (const kind of sharedKinds) {
      expect(source, kind).toContain(`'${kind}':`);
    }
    for (const kind of activityModuleKinds) {
      expect(source, kind).not.toContain(`'${kind}':`);
    }
    expect(source).not.toContain('unit-4-3');
  });

  it('ships the reviewed 4-4 runtime manifest and covers its reusable module kinds in the shared content registry', async () => {
    const runtime = await loadLessonRuntimeEntry('4-4');
    const manifest = runtime.interactiveManifest!;
    const moduleKinds = new Set(manifest.steps.flatMap((step) => step.modules.map((module) => module.kind)));
    const sharedKinds = [
      'bullet-list-card',
      'equation-card-row',
      'formula-card',
      'goal-card-row',
      'image-panel',
      'native-figure',
      'native-table',
      'problem-statement',
      'stage-map',
      'stat-panel',
      'step-reveal',
      'summary-card',
    ];
    const activityModuleKinds = ['quiz-group', 'single-choice-card', 'activity-card', 'activity-card-set'];

    expect(runtime.lesson.interactive_manifest_path).toBe('/course-runtime/lessons/4-4/interactive-manifest.json');
    for (const kind of sharedKinds) {
      expect(moduleKinds.has(kind), kind).toBe(true);
    }
    for (const kind of activityModuleKinds) {
      expect(moduleKinds.has(kind), kind).toBe(true);
    }

    const moduleRegistry = Object.fromEntries(
      sharedKinds.map((kind) => [
        kind,
        ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string; kind: string } }) =>
          createElement('div', null, module.kind, module.id, JSON.stringify(step.contentBlocks)),
      ]),
    );
    const html = manifest.steps
      .map((step) =>
        renderToStaticMarkup(
          renderInteractiveManifestStep({
            manifest,
            step,
            moduleRegistry,
            extra: undefined,
          }),
        ),
      )
      .join('\n');

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    for (const kind of sharedKinds) {
      expect(source, kind).toContain(`'${kind}':`);
    }
    for (const kind of activityModuleKinds) {
      expect(source, kind).not.toContain(`'${kind}':`);
    }
    expect(html).not.toContain('data-manifest-render-error');
    expect(html).toContain('当前已经同时出现的四类愿望');
    expect(html).toContain('主案例的 Pareto front');
  });

  it('ships the reviewed 4-5 runtime manifest with complete content payload for constrained optimization steps', async () => {
    const runtime = await loadLessonRuntimeEntry('4-5');
    const manifest = runtime.interactiveManifest!;
    const requiredSteps = ['step-04', 'step-05', 'step-06', 'step-07', 'step-11', 'step-12'];
    const sharedKinds = [
      'formula-card',
      'formula-card-row',
      'image-panel',
      'native-table',
      'step-reveal',
      'summary-card',
    ];
    const activityModuleKinds = ['activity-card', 'quiz-card'];

    expect(runtime.lesson.interactive_manifest_path).toBe('/course-runtime/lessons/4-5/interactive-manifest.json');

    for (const stepId of requiredSteps) {
      const step = manifest.steps.find((item) => item.id === stepId);
      expect(step, stepId).toBeDefined();
      expect(Object.keys(step?.contentBlocks ?? {}).length, stepId).toBeGreaterThan(0);
    }

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    for (const kind of sharedKinds) {
      expect(source, kind).toContain(`'${kind}':`);
    }
    for (const kind of activityModuleKinds) {
      expect(source, kind).not.toContain(`'${kind}':`);
    }

    expect(manifest.steps.find((step) => step.id === 'step-04')?.contentBlocks.constraint_formula).toBeDefined();
    expect(manifest.steps.find((step) => step.id === 'step-07')?.contentBlocks.solver_input_table).toBeDefined();
    const posttestStep = manifest.steps.find((step) => step.id === 'step-12');
    expect(posttestStep?.contentBlocks.posttest_note).toBeDefined();
    expect(posttestStep?.contentBlocks.posttest_q3).toBeUndefined();
    expect(posttestStep?.interactionSpec.activityCards?.find((card) => card.id === 'posttest-q3')).toBeDefined();
  });
});

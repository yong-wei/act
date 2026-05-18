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
  getInteractiveRevealLayerCount,
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
    expect(runtime.interactiveManifest?.steps).toHaveLength(19);
    expect(runtime.interactiveManifest?.steps[0]?.modules.map((module) => module.kind)).toEqual([
      'image-panel',
      'summary-card',
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

  it('renders formula-card and native-table payload descriptions from the shared content registry', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-content': {
          title: '公式表格说明测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'constraint-formula',
              region: 'main',
              kind: 'formula-card',
              must_be_visible: true,
              payload: {
                title: '执行器约束',
                formulas: ['\\left|u(t)\\right|\\le u_{\\max}'],
                text: '幅值边界限制控制量大小。',
              },
            },
            {
              id: 'diagnostic-table',
              region: 'main',
              kind: 'native-table',
              must_be_visible: true,
              payload: {
                title: '诊断分层表',
                note: '先看信息是否可信，再看参考是否可执行。',
                columns: ['层级', '证据'],
                rows: [['感知层', '丢帧']],
              },
            },
          ],
          content_blocks: {},
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

    expect(html).toContain('执行器约束');
    expect(html).toContain('幅值边界限制控制量大小。');
    expect(html).toContain('诊断分层表');
    expect(html).toContain('先看信息是否可信，再看参考是否可执行。');
    expect(html).toContain('感知层');
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

  it('renders inline LaTeX in manifest step titles and title descriptions', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-title-math': {
          title: '对象 $G(s)=K/(Ts+1)$ 参数页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'summary-a',
              region: 'main',
              kind: 'summary-card',
              must_be_visible: true,
              payload: { text: '正文证据' },
            },
          ],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'display',
            student_task: '阅读对象参数。',
            activity_cards: [],
          },
          ai_context_spec: {
            page_goal: '考察 $e(t)=r(t)-y(t)$ 与 $|\\delta|\\le 12^\\circ$。',
          },
        },
      },
    });
    const step = manifest!.steps[0]!;

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step,
        moduleRegistry: {
          'summary-card': () => createElement('div', null, '正文证据'),
        },
        extra: undefined,
      }),
    );

    expect(html).toContain('data-manifest-step-title="step-title-math"');
    expect(html).toContain('katex');
    expect(html).not.toContain('$G(s)=K/(Ts+1)$');
    expect(html).not.toContain('$e(t)=r(t)-y(t)$');
    expect(html).not.toContain('$|\\delta|\\le 12^\\circ$');
  });

  it('renders inline LaTeX in manifest content module titles', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-content-title-math': {
          title: '正文模块标题公式测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'summary-a',
              title: '参数 $K_m/T_m$ 说明',
              region: 'main',
              kind: 'summary-card',
              must_be_visible: true,
              payload: { text: '正文证据' },
            },
          ],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'display',
            activity_cards: [],
          },
        },
      },
    });
    const step = manifest!.steps[0]!;

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step,
        moduleRegistry: createManifestContentModuleRegistry({
          revealProgress: 0,
          allowInlineReveal: false,
        }),
        extra: {
          revealProgress: 0,
          allowInlineReveal: false,
        },
      }),
    );

    expect(html).toContain('katex');
    expect(html).not.toContain('$K_m/T_m$');
    expect(html).toContain('正文证据');
  });

  it('renders formula-card content from a keyed formulas array with its explanation', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-keyed-formulas': {
          title: '公式数组测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'model-formula',
              title: '离散对象关系',
              region: 'main',
              kind: 'formula-card',
              must_be_visible: true,
              payload: { block_key: 'formula_block' },
            },
          ],
          content_blocks: {
            formula_block: {
              type: 'formula_group',
              formulas: ['x_{k+1}=f(x_k,u_k,p_k)', 'y_k=h(x_k,u_k)'],
              symbols: [
                { symbol: 'x_k', meaning: '状态变量' },
                { symbol: 'u_k', meaning: '控制输入' },
              ],
              explanation: '若 $f(\\cdot)$ 和 $h(\\cdot)$ 的结构可信，就能追踪对象关系。',
            },
          },
          interaction_spec: {
            interaction_kind: 'display',
            activity_cards: [],
          },
        },
      },
    });
    const step = manifest!.steps[0]!;
    const formulaModule = step.modules[0]!;
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        registry['formula-card']?.({
          manifest: manifest!,
          step,
          module: formulaModule,
          extra: {
            revealProgress: 0,
            allowInlineReveal: false,
          },
        }),
      ),
    );

    expect(html).toContain('离散对象关系');
    expect(html).toContain('katex-display');
    expect(html).toContain('追踪对象关系');
    expect(html).toContain('符号说明');
    expect(html).toContain('状态变量');
    expect(html).toContain('控制输入');
    expect(html).not.toContain('$f(\\cdot)$');
  });

  it('renders formula_set items and body text from runtime content blocks', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-formula-set': {
          title: '公式集合测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'formula-set-card',
              title: '扰动前馈表达',
              region: 'main',
              kind: 'formula-card',
              must_be_visible: true,
              payload: { block_key: 'formula' },
            },
          ],
          content_blocks: {
            formula: {
              type: 'formula_set',
              items: ['$F_d^\\ast(s)=-(s+2.14375)/0.01715$', '$F_d(s)=\\lambda_dk_z(s+z_d)/(s+p_d)$'],
              body: '扰动前馈零点来自执行器逆近似。',
            },
          },
          interaction_spec: {
            interaction_kind: 'display',
            activity_cards: [],
          },
        },
      },
    });
    const step = manifest!.steps[0]!;
    const formulaModule = step.modules[0]!;
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        registry['formula-card']?.({
          manifest: manifest!,
          step,
          module: formulaModule,
          extra: {
            revealProgress: 0,
            allowInlineReveal: false,
          },
        }),
      ),
    );

    expect(html).toContain('扰动前馈表达');
    expect(html).toContain('katex-display');
    expect(html).toContain('扰动前馈零点来自执行器逆近似');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders 5-4 step-08 case text inline formulas through KaTeX', async () => {
    const runtime = await loadLessonRuntimeEntry('5-4');
    const manifest = runtime.interactiveManifest!;
    const step = manifest.steps.find((item) => item.id === 'step-08');
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: step!,
        moduleRegistry: createManifestContentModuleRegistry({
          revealProgress: 0,
          allowInlineReveal: false,
        }),
        extra: {
          revealProgress: 0,
          allowInlineReveal: false,
        },
      }),
    );

    expect(html).toContain('katex');
    expect(html).toContain('名义模型响应偏快');
    expect(html).not.toContain('$20\\ \\mathrm{s}$');
    expect(html).not.toContain('$18^\\circ$');
    expect(html).not.toContain('$|\\delta|\\le 12^\\circ$');
  });

  it('renders required activity runtime module slots without duplicating activity prompts in static content', () => {
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
    expect(html).toContain('data-manifest-activity-module="activity-a"');
    expect(html).toContain('data-manifest-activity-kind="activity-card"');
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

  it('renders summary-card-grid and learning-stat-panel content modules', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-summary-grid': {
          title: '总结页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'boundary-cases',
              title: '边界情况',
              region: 'main',
              kind: 'summary-card-grid',
              must_be_visible: true,
              payload: { block_key: 'boundary_cases' },
            },
            {
              id: 'learning-stats',
              title: '课堂表现统计',
              region: 'main',
              kind: 'learning-stat-panel',
              must_be_visible: true,
              payload: { block_key: 'stats' },
            },
          ],
          content_blocks: {
            boundary_cases: {
              type: 'card_grid',
              items: ['数据量大但覆盖不足。', '模型很粗但责任仍要保留。'],
            },
            stats: {
              type: 'stat_panel',
              student_fields: ['已浏览页面', '已提交互动'],
              teacher_fields: ['班级提交率', '曲线观察分布'],
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

    expect(html).toContain('数据量大但覆盖不足。');
    expect(html).toContain('学生端：已浏览页面、已提交互动');
    expect(html).toContain('教师端：班级提交率、曲线观察分布');
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

  it('renders explicit drag-match items and options without relying on split labels', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-match-explicit': {
          title: '显式配对页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'drag_match',
            activity_cards: [
              {
                id: 'match-explicit',
                title: '压力来源匹配',
                prompt: '完成完整现象与完整类别配对。',
                response_kind: 'drag_match',
                match_items: [
                  { value: 'load-change', label: '满载后航向变化明显变慢。' },
                  { value: 'rudder-boundary', label: '舵角多次超过上限。' },
                ],
                match_options: [
                  { value: 'parameter-drift', label: '参数难以固定。' },
                  { value: 'active-constraints', label: '约束不断进入闭环。' },
                ],
                reference_matches: [
                  { item: 'load-change', option: 'parameter-drift' },
                  { item: 'rudder-boundary', option: 'active-constraints' },
                ],
              },
            ],
          },
        },
      },
    });
    const step = manifest?.steps[0];
    expect(step).toBeDefined();
    expect(step?.interactionSpec.activityCards?.[0]?.matchItems?.[0]?.label).toBe('满载后航向变化明显变慢。');
    expect(step?.interactionSpec.activityCards?.[0]?.matchOptions?.[0]?.label).toBe('参数难以固定。');
    expect(step?.interactionSpec.activityCards?.[0]?.referenceMatches?.[0]).toEqual({
      item: 'load-change',
      option: 'parameter-drift',
    });

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

    expect(html).toContain('满载后航向变化明显变慢。');
    expect(html).toContain('参数难以固定。');
    expect(html).not.toContain(' -&gt; ');
  });

  it('keeps student activity renderer references stable across registry factory calls', () => {
    const first = createManifestStudentActivityRegistry<{ id: string }>();
    const second = createManifestStudentActivityRegistry<{ id: string }>();

    expect(second.drag_match).toBe(first.drag_match);
    expect(second.activity_card_set).toBe(first.activity_card_set);
    expect(second.multi_select).toBe(first.multi_select);
    expect(second.interactive_figure_submit).toBe(first.interactive_figure_submit);
    expect(second.teacher_reveal_only).toBe(first.teacher_reveal_only);
    expect(first.drag_match).toBe(first.activity_cards);
    expect(first.multi_select).toBe(first.activity_cards);
    expect(first.interactive_figure_submit).toBe(first.activity_cards);
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

  it('places activity prompts in the answer card title instead of duplicating them as card body copy', () => {
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
                title: '作答1',
                prompt: '哪一项最能解释当前失配？',
                response_kind: 'single_choice',
                options: ['对象模型变化', '执行器限幅'],
                reference_answer: '对象模型变化。',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
        },
      },
    });
    const step = manifest!.steps[0]!;

    const studentHtml = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step.id },
          stepManifest: step,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: () => undefined,
        }),
      ),
    );
    const teacherHtml = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: { id: step.id },
          stepManifest: step,
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

    expect(studentHtml).toContain('作答1：哪一项最能解释当前失配？');
    expect(teacherHtml).toContain('作答1：哪一项最能解释当前失配？');
    expect(studentHtml.match(/哪一项最能解释当前失配？/g)).toHaveLength(1);
    expect(teacherHtml.match(/哪一项最能解释当前失配？/g)).toHaveLength(1);
  });

  it('adds answer-card prefixes and renders LaTeX in activity titles without duplicating prompts in the card body', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-quiz-math-title': {
          title: '活动标题公式测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interaction_spec: {
            interaction_kind: 'quiz_group',
            activity_cards: [
              {
                id: 'choice-a',
                title: '模型 $G(s)$ 判断',
                prompt: '闭环误差 $e(t)=r(t)-y(t)$ 是什么？',
                response_kind: 'single_choice',
                options: ['参考输入与实际输出之间的误差', '执行限幅'],
                reference_answer: '参考输入与实际输出之间的误差。',
                submit_scope: 'per_card',
                layout_span: 'full',
              },
            ],
          },
        },
      },
    });
    const step = manifest!.steps[0]!;

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step.id },
          stepManifest: step,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: () => undefined,
        }),
      ),
    );

    expect(html).toContain('作答1：');
    expect(html).toContain('katex');
    expect(html).not.toContain('$G(s)$');
    expect(html).not.toContain('$e(t)=r(t)-y(t)$');
    expect(html.match(/闭环误差/g)).toHaveLength(1);
    expect(html.match(/是什么？/g)).toHaveLength(1);
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

  it('renders parameter_set cards with structured parameter fields and teacher-readable labels', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-parameter-submit': {
          title: '参数提交测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [],
          content_blocks: {},
          interactive_figure_spec: {
            parameter_controls: [
              { id: 'feedforward_zero', label: '扰动前馈零点', range: [0.02, 4.0], unit: 'rad/s' },
              { id: 'lowpass_cutoff', label: '一阶低通截止频率', range: [0.02, 1.0], unit: 'rad/s' },
              { id: 'feedforward_strength', label: '前馈强度', range: [0, 200], unit: '%' },
            ],
            parameter_submit_spec: {
              submit_fields: ['feedforward_zero', 'lowpass_cutoff', 'feedforward_strength'],
            },
          },
          interaction_spec: {
            interaction_kind: 'interactive_figure_submit',
            activity_cards: [
              {
                id: 'disturbance-params',
                title: '扰动前馈参数记录',
                prompt: '提交当前扰动前馈零点、低通截止频率和前馈强度。',
                response_kind: 'parameter_set',
                reference_answer: '关注扰动偏移是否下降。',
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

    const studentHtml = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: { id: step!.id },
          stepManifest: step!,
          savedResponse: {
            stepId: step!.id,
            submittedAt: 1,
            answers: {
              'disturbance-params': JSON.stringify({
                feedforward_zero: 0.6,
                lowpass_cutoff: 0.2,
                feedforward_strength: 10,
              }),
            },
          } satisfies ManifestStepResponse,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          workspaceParameters: {
            feedforward_zero: 2.14375,
            lowpass_cutoff: 0.125,
            feedforward_strength: 75,
          },
          onSubmit: () => undefined,
        }),
      ),
    );

    expect(studentHtml).toContain('提交当前扰动前馈零点、低通截止频率和前馈强度');
    expect(studentHtml).toContain('扰动前馈零点');
    expect(studentHtml).toContain('一阶低通截止频率');
    expect(studentHtml).toContain('前馈强度');
    expect(studentHtml).toContain('2.14375');
    expect(studentHtml).not.toContain('0.6');
    expect(studentHtml).not.toContain('manifest 未提供');

    const teacherHtml = renderToStaticMarkup(
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
                answers: {
                  'disturbance-params': JSON.stringify({
                    feedforward_zero: 2.14375,
                    lowpass_cutoff: 0.125,
                    feedforward_strength: 75,
                  }),
                },
              } satisfies ManifestStepResponse,
            },
          ],
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

    expect(teacherHtml).toContain('扰动前馈零点：2.14375 rad/s');
    expect(teacherHtml).toContain('一阶低通截止频率：0.125 rad/s');
    expect(teacherHtml).toContain('前馈强度：75 %');
    expect(teacherHtml.indexOf('提交当前扰动前馈零点')).toBeLessThan(teacherHtml.indexOf('已提交 1 人'));
    expect(teacherHtml).not.toContain('feedforward_zero');
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

  it('counts reveal layers declared behind a step-reveal-chain block key', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-block-key-reveal': {
          title: '显影 block key 测试页',
          layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
          modules: [
            {
              id: 'diagnostic-reveal',
              region: 'main',
              kind: 'step-reveal-chain',
              must_be_visible: true,
              payload: { block_key: 'diagnostic_reveal' },
            },
          ],
          content_blocks: {
            diagnostic_reveal: {
              layers: ['第一层', '第二层', '第三层', '第四层'],
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

    expect(getInteractiveRevealLayerCount(manifest!.steps[0]!)).toBe(4);
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
    const gapChoice = manifest.steps
      .find((step) => step.id === 'step-04')
      ?.interactionSpec.activityCards?.[0];
    const postQuizCards = manifest.steps
      .find((step) => step.id === 'step-18')
      ?.interactionSpec.activityCards ?? [];

    expect(gapChoice?.responseKind).toBe('single_choice');
    expect(gapChoice?.options.map((option) => option.label)).toEqual([
      '滞后',
      '超前或超前-滞后',
      '单独前馈',
    ]);
    expect(gapChoice?.referenceAnswer).toContain('超前或超前-滞后');

    expect(postQuizCards).toHaveLength(3);
    expect(postQuizCards.map((card) => card.responseKind)).toEqual(['single_choice', 'multi_choice', 'fill_text']);
    expect(postQuizCards.map((card) => card.referenceAnswer)).toEqual([
      '提前补偿可测扰动。',
      '四项都可能被漏掉。',
      '示例：调节时间已接近目标，但舵角贴边时间偏长，下一轮优先调整前馈强度或抗饱和时间常数。',
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
      'formula-card',
      'goal-card-row',
      'image-panel',
      'interactive-figure-panel',
      'native-table',
      'step-reveal-chain',
      'summary-card',
    ];
    const activityModuleKinds = ['activity-card', 'card-sort', 'quiz-group'];

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

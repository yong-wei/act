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

  it('keeps manifest activity registries for the three shared activity kinds without course-id answer maps', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(source).toContain('activity_card_set:');
    expect(source).toContain('quiz_group:');
    expect(source).toContain('teacher_reveal_only:');
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

  it('covers reusable 4-3 static, path, and activity-anchor module kinds in the shared content registry', async () => {
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
      'quiz-stack',
      'route-card',
      'activity-card',
      'activity-card-set',
      'single-choice-card',
    ];

    for (const kind of sharedKinds) {
      expect(moduleKinds.has(kind), kind).toBe(true);
    }

    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    for (const kind of sharedKinds) {
      expect(source, kind).toContain(`'${kind}':`);
    }
    expect(source).not.toContain('unit-4-3');
  });
});

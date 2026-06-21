import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  evaluateInteractiveCoursePrivateControlPanelSourceGate,
  evaluateInteractiveModuleRegistryGate,
  scanRuntimeInteractiveModuleRegistry,
  STANDARD_MODULE_ENFORCED_LESSON_IDS,
  STANDARD_MODULE_MIGRATED_LESSON_IDS,
} from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import {
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_DEFINITIONS,
  INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS,
} from '@/features/interactive/shared/manifest-runtime/module-taxonomy';
import {
  INTERACTIVE_COURSEWARE_STYLE_MODULE_INVENTORY,
  INTERACTIVE_MODULE_VISUAL_STANDARDS,
  resolveInteractiveModuleVisualStandard,
} from '@/features/interactive/shared/manifest-runtime/module-visual-standards';
import { normalizeInteractiveRuntimeManifest, type InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

describe('interactive module registry gate', () => {
  it('defines every canonical module class with validation metadata', () => {
    expect(INTERACTIVE_MODULE_DEFINITIONS['activity.panel']).toMatchObject({
      canonicalClass: 'activity.panel',
      renderBehavior: 'activity-slot',
      configShape: 'activity payload with response contract',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['compute.panel']).toMatchObject({
      canonicalClass: 'compute.panel',
      renderBehavior: 'renderer',
      requiresCapabilityRef: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['visual.stage']).toMatchObject({
      canonicalClass: 'visual.stage',
      renderBehavior: 'renderer',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['visual.derivationStage']).toMatchObject({
      canonicalClass: 'visual.derivationStage',
      renderBehavior: 'renderer',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['visual.blockDiagram']).toMatchObject({
      canonicalClass: 'visual.blockDiagram',
      renderBehavior: 'renderer',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['visual.signalFlowGraph']).toMatchObject({
      canonicalClass: 'visual.signalFlowGraph',
      renderBehavior: 'renderer',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['legacy.adapter']).toMatchObject({
      canonicalClass: 'legacy.adapter',
      migrationOnly: true,
      allowedInNewAuthoring: false,
    });
  });

  it('defines projection-safe visual standards for every canonical module class', () => {
    expect(Object.keys(INTERACTIVE_MODULE_VISUAL_STANDARDS).sort()).toEqual([...INTERACTIVE_MODULE_CANONICAL_CLASSES].sort());

    for (const canonicalClass of INTERACTIVE_MODULE_CANONICAL_CLASSES) {
      const standard = resolveInteractiveModuleVisualStandard(canonicalClass);
      expect(standard, canonicalClass).toBeDefined();
      expect(standard?.roleStates).toEqual(expect.arrayContaining(['student', 'guest', 'teacher']));
      expect(standard?.themeStates).toEqual(expect.arrayContaining(['light', 'dark']));
      expect(standard?.viewportStates).toEqual(expect.arrayContaining(['desktop', 'mobile', 'projection']));
      expect(standard?.projectionSafe).toBe(true);
      expect(standard?.projectionTypography).toBe('projection-readable');
      expect(standard?.geometry).toBe('stable-panel');
      expect(standard?.chromeClassName).toMatch(/^commercial-module-chrome--/);
    }
  });

  it('keeps a manifest-first courseware style inventory for every canonical module class', () => {
    expect(Object.keys(INTERACTIVE_COURSEWARE_STYLE_MODULE_INVENTORY).sort()).toEqual([...INTERACTIVE_MODULE_CANONICAL_CLASSES].sort());

    for (const canonicalClass of INTERACTIVE_MODULE_CANONICAL_CLASSES) {
      expect(INTERACTIVE_COURSEWARE_STYLE_MODULE_INVENTORY[canonicalClass]).toMatchObject({
        canonicalClass,
        panelExterior: 'title-panel',
        chromeRole: 'metadata-only',
        spacingOwner: 'manifest-runtime-layout',
        titleLevel: 'module-level-2',
        bodyToken: 'interactive-courseware-body',
      });
    }
  });

  it('registers response kinds with scoring support metadata', () => {
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS['choice.single']).toMatchObject({
      responseKind: 'choice.single',
      scoring: 'objective',
    });
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS['text.structured']).toMatchObject({
      responseKind: 'text.structured',
      scoring: 'unsupported',
    });
  });

  it('registers shared renderers for canonical standard content module classes', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });

    expect(registry['content.rich']).toBeTypeOf('function');
    expect(registry['content.cardSet']).toBeTypeOf('function');
    expect(registry['content.formula']).toBeTypeOf('function');
    expect(registry['content.code']).toBeTypeOf('function');
    expect(registry['content.table']).toBeTypeOf('function');
    expect(registry['content.figure']).toBeTypeOf('function');
    expect(registry['content.reveal']).toBeTypeOf('function');
    expect(registry['content.stageMap']).toBeTypeOf('function');
    expect(registry['compute.panel']).toBeTypeOf('function');
    expect(registry['visual.stage']).toBeTypeOf('function');
    expect(registry['visual.derivationStage']).toBeTypeOf('function');
    expect(registry['visual.blockDiagram']).toBeTypeOf('function');
    expect(registry['visual.signalFlowGraph']).toBeTypeOf('function');
    expect(registry['analytics.summary']).toBeTypeOf('function');
    expect(registry['layout.support']).toBeTypeOf('function');
  });

  it('renders manifest-first courseware with semantic heading and shared typography primitives', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'courseware-reveal',
        kind: 'content.reveal',
        title: '模块标题',
        mustBeVisible: true,
        payload: { block_key: 'courseware_reveal' },
      },
    });
    manifest.steps[0].contentBlocks.courseware_reveal = {
      items: [
        {
          title: '子模块标题',
          body: '正文说明使用统一字号。',
          formula: '$G(s)=Y(s)/R(s)$',
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        renderInteractiveManifestStep({
          manifest,
          step: manifest.steps[0],
          moduleRegistry: registry,
          extra: { revealProgress: 1, allowInlineReveal: true },
        }),
      ),
    );

    expect(html).toContain('<h1 class="interactive-courseware-title-level-1">Step 01</h1>');
    expect(html).toContain('<h2 class="interactive-courseware-title-level-2">模块标题</h2>');
    expect(html).toContain('<h3 class="interactive-courseware-title-level-3">子模块标题</h3>');
    expect(html).toContain('class="interactive-courseware-body"');
    expect(html).toContain('data-interactive-module-chrome-role="metadata-only"');
    expect(html).toContain('premium-lesson-panel interactive-courseware-panel');
    expect(html).not.toContain('class="space-y-4"');
    expect(html).not.toContain('premium-lesson-title text-base');
  });

  it('renders activity panels with shared courseware headings, body and controls', () => {
    const manifest = manifestFixture({
      interactionKind: 'single_choice',
      activityCards: [
        {
          id: 'activity-card',
          title: '选择模型证据',
          prompt: '哪一项最能作为模型结构证据？',
          responseKind: 'choice.single',
          responseCategory: 'objective',
          responseScoringMode: 'objective',
          submitScope: 'per_card',
          layoutSpan: 'full',
          options: [
            { id: 'structure', label: '结构关系' },
            { id: 'color', label: '颜色偏好' },
          ],
          referenceAnswer: '结构关系能支撑建模判断。',
        },
      ],
    });
    const step = manifest.steps[0];
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        renderStudentInteractiveActivity({
          registry: createManifestStudentActivityRegistry(),
          step: {},
          stepManifest: step,
          savedResponse: undefined,
          released: true,
          browseEnabled: true,
          answerVisible: true,
          revealProgress: 0,
          readOnly: false,
          onSubmit: () => undefined,
        }),
      ),
    );

    expect(html).toContain('premium-lesson-panel interactive-courseware-panel');
    expect(html).toContain('<h2 class="interactive-courseware-title-level-2">');
    expect(html).toContain('interactive-courseware-body');
    expect(html).toContain('premium-lesson-action-primary interactive-courseware-control');
    expect(html).not.toContain('premium-lesson-title text-base');
  });

  it('renders teacher activity controls with shared courseware controls', () => {
    const manifest = manifestFixture({
      interactionKind: 'single_choice',
      activityCards: [
        {
          id: 'activity-card',
          title: '选择模型证据',
          prompt: '哪一项最能作为模型结构证据？',
          responseKind: 'choice.single',
          responseCategory: 'objective',
          responseScoringMode: 'objective',
          submitScope: 'per_card',
          layoutSpan: 'full',
          options: [{ id: 'structure', label: '结构关系' }],
          referenceAnswer: '结构关系能支撑建模判断。',
        },
      ],
    });
    const step = {
      ...manifest.steps[0],
      teacherControls: {
        releaseActivity: 'manual',
        openBrowse: 'manual',
        teacherStepReveal: 'manual',
        revealReferenceAnswer: 'manual',
      },
    };
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: {},
          stepManifest: step,
          responses: [],
          released: false,
          browseEnabled: false,
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

    expect(html).toContain('premium-lesson-panel interactive-courseware-panel');
    expect(html).toContain('<h2 class="interactive-courseware-title-level-2">教师控制</h2>');
    expect(html).toContain('premium-lesson-action-tone interactive-courseware-control');
    expect(html).toContain('interactive-courseware-body');
  });

  it('renders compute.panel fallback with the shared shell and typography contract', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'compute-summary',
        kind: 'compute.panel',
        title: '计算面板',
        mustBeVisible: true,
        payload: { text: '计算结果说明。', bullets: ['保持统一外壳。'] },
      },
    });
    const step = manifest.steps[0];
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        renderInteractiveManifestStep({
          manifest,
          step,
          moduleRegistry: registry,
          extra: { revealProgress: 0, allowInlineReveal: false },
        }),
      ),
    );

    expect(html).toContain('data-commercial-module-chrome="compute.panel"');
    expect(html).toContain('data-interactive-module-chrome-role="metadata-only"');
    expect(html).toContain('premium-lesson-panel interactive-courseware-panel');
    expect(html).toContain('<h2 class="interactive-courseware-title-level-2">计算面板</h2>');
    expect(html).toContain('interactive-courseware-body');
  });

  it('renders visual.stage as a normalized freeform stage instead of a vertical card list', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'root-locus-stage',
        kind: 'visual.stage',
        mustBeVisible: true,
        payload: visualStagePayloadFixture(),
      },
    });
    const step = manifest.steps[0];
    const node = registry['visual.stage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(html).toContain('data-visual-stage-id="root-locus-reading-stage"');
    expect(html).toContain('data-visual-stage-canvas="normalized"');
    expect(html).toContain('data-visual-stage-layout="freeform"');
    expect(html).toContain('data-visual-stage-layer-id="plant-diagram"');
    expect(html).toContain('data-visual-stage-layer-id="activity-anchor-layer"');
    expect(html).toContain('data-visual-stage-activity-anchor="stability-observation"');
    expect(html).toContain('data-visual-stage-panel-chrome="title-panel"');
    expect(html).toContain('data-visual-stage-canvas-chrome="none"');
    expect(html).toContain('data-visual-stage-layer-kind-labels="hidden"');
    expect(html).toContain('data-visual-stage-layer-selected="false"');
    expect(html).toContain('data-visual-stage-connection-id="plant-to-anchor"');
    expect(html).toContain('data-visual-stage-connection-from="plant-diagram"');
    expect(html).toContain('data-visual-stage-connection-to="activity-anchor-layer"');
    expect(html).toContain('role="button"');
    expect(html).not.toContain('data-visual-stage-layer-summary');
    expect(html).not.toContain('>关系图<');
    expect(html).not.toContain('>标注<');
    expect(html).not.toContain('rounded-2xl border border-[var(--platform-border)]');
    expect(html).not.toContain('space-y-4');
  });

  it('does not hide all visual.stage layers when activeRevealState is omitted', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'root-locus-stage',
        kind: 'visual.stage',
        mustBeVisible: true,
        payload: {
          ...visualStagePayloadFixture(),
          activeRevealState: undefined,
        },
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.stage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-visual-stage-active-reveal-state="all"');
    expect(html).toContain('data-visual-stage-layer-id="plant-diagram"');
    expect(html).toContain('data-visual-stage-layer-id="activity-anchor-layer"');
  });

  it('does not hide all visual.stage layers when activeRevealState is blank', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'root-locus-stage',
        kind: 'visual.stage',
        mustBeVisible: true,
        payload: {
          ...visualStagePayloadFixture(),
          activeRevealState: '   ',
        },
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.stage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-visual-stage-active-reveal-state="all"');
    expect(html).toContain('data-visual-stage-layer-id="plant-diagram"');
    expect(html).toContain('data-visual-stage-layer-id="activity-anchor-layer"');
  });

  it('normalizes visual.stage layer revealState before rendering', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'root-locus-stage',
        kind: 'visual.stage',
        mustBeVisible: true,
        payload: {
          ...visualStagePayloadFixture(),
          activeRevealState: 'intro',
          connections: [],
          layers: [
            {
              id: 'trimmed-layer',
              kind: 'diagram',
              title: 'Trimmed reveal',
              body: 'trimmed reveal state layer',
              region: { x: 0, y: 0, width: 0.45, height: 0.45 },
              zIndex: 1,
              revealState: ' intro ',
            },
            {
              id: 'always-layer',
              kind: 'annotation',
              title: 'Blank reveal',
              body: 'blank reveal state layer',
              region: { x: 0.5, y: 0, width: 0.45, height: 0.45 },
              zIndex: 2,
              revealState: '   ',
            },
          ],
        },
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.stage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-visual-stage-layer-id="trimmed-layer"');
    expect(html).toContain('data-visual-stage-layer-reveal-state="intro"');
    expect(html).toContain('data-visual-stage-layer-id="always-layer"');
    expect(html).toContain('data-visual-stage-layer-reveal-state="always"');
  });

  it('renders visual.derivationStage as a freeform LaTeX derivation with non-linear reveal targets', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'derivation-stage',
        kind: 'visual.derivationStage',
        mustBeVisible: true,
        payload: derivationStagePayloadFixture(),
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.derivationStage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-derivation-stage-id="nonlinear-derivation-stage"');
    expect(html).toContain('data-derivation-stage-canvas="normalized"');
    expect(html).toContain('data-derivation-stage-canvas-chrome="none"');
    expect(html).toContain('data-derivation-stage-layout="freeform"');
    expect(html).toContain('data-derivation-stage-panel-chrome="title-panel"');
    expect(html).toContain('data-katex-rendered="true"');
    expect(html).toContain('data-derivation-stage-formula-id="definition-formula"');
    expect(html).toContain('data-derivation-stage-formula-frame="freeform"');
    expect(html).not.toContain('data-derivation-stage-formula-frame="card"');
    expect(html).not.toContain('<h3 class="premium-lesson-caption mb-1">');
    expect(html).toContain('data-derivation-stage-formula-block-id="cancel-term"');
    expect(html).toContain('data-derivation-stage-formula-block-frame="freeform"');
    expect(html).toContain('data-derivation-stage-color-role="cancel"');
    expect(html).toContain('data-derivation-stage-formula-block-id="result-block"');
    expect(html).toContain('data-derivation-stage-color-role="result"');
    expect(html).toContain('data-derivation-stage-connector-id="definition-to-target"');
    expect(html).toContain('data-derivation-stage-connector-from="known-g"');
    expect(html).toContain('data-derivation-stage-connector-to="result-block"');
    expect(html).toContain('data-derivation-stage-connector-from-anchor="E"');
    expect(html).toContain('data-derivation-stage-connector-to-anchor="W"');
    expect(html).toContain('data-derivation-stage-connector-renderer="fixed-css-arrow"');
    expect(html).toContain('data-derivation-stage-connector-fixed-shape="true"');
    expect(html).toContain('data-derivation-stage-connector-gradient="tail-to-head"');
    expect(html).toContain('data-derivation-stage-connector-arrowhead="css-clip"');
    expect(html).toContain('data-derivation-stage-connector-arrow-style="fixed-gradient-wide"');
    expect(html).toContain('data-derivation-stage-connector-arrow-width="1.5em"');
    expect(html).toContain('data-derivation-stage-connector-shape-stability="rotation-only"');
    expect(html).not.toContain('marker-end=');
    expect(html).not.toContain('stroke-width="1.5em"');
    expect(html).toContain('interactive-courseware-body');
    expect(html).not.toContain('text-2xl');
    expect(html).toContain('data-derivation-stage-reveal-step-id="step-lower-left"');
    expect(html).toContain('data-derivation-stage-reveal-step-id="step-upper-right"');
    expect(html).toContain('data-derivation-stage-control-button="previous"');
    expect(html).toContain('data-derivation-stage-control-button="next"');
    expect(html).toContain('目标表达 · 3/3');
    expect(html).toContain('data-derivation-stage-reveal-steps="metadata"');
    expect(html).not.toContain('data-derivation-stage-reveal-steps="visible"');
    expect(html).not.toContain('LaTeX 公式');
    expect(html).not.toContain('公式块');
    expect(html).not.toContain('<p class="premium-lesson-caption">step-lower-left</p>');
    expect(html).not.toContain('<div class="premium-lesson-card" data-derivation-stage-reveal-step-id=');
    expect(html).not.toContain('space-y-4');
  });

  it('renders visual.derivationStage text reveal as freeform content instead of a card', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const payload = derivationStagePayloadFixture();
    payload.activeRevealStepId = 'step-upper-right';
    const manifest = manifestFixture({
      module: {
        id: 'derivation-stage',
        kind: 'visual.derivationStage',
        mustBeVisible: true,
        payload,
      },
    });
    const step = manifest.steps[0];
    const node = registry['visual.derivationStage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(html).toContain('data-derivation-stage-text-block-id="upper-right-note"');
    expect(html).toContain('data-derivation-stage-text-frame="freeform"');
    expect(html).not.toContain('说明块');
    expect(html).not.toContain('data-derivation-stage-text-frame="card"');
  });

  it('renders only supported visual.derivationStage controls from the controls alias', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const payload = derivationStagePayloadFixture();
    payload.teacherControls = { controls: ['next', 'previous', 'jump', 'highlight', 'answerReveal', 'reset'] };
    const manifest = manifestFixture({
      module: {
        id: 'derivation-stage',
        kind: 'visual.derivationStage',
        mustBeVisible: true,
        payload,
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.derivationStage']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-derivation-stage-teacher-control="previous"');
    expect(html).toContain('data-derivation-stage-teacher-control="next"');
    expect(html).not.toContain('data-derivation-stage-teacher-control="jump"');
    expect(html).not.toContain('data-derivation-stage-teacher-control="answerReveal"');
    expect(html).not.toContain('跳转');
    expect(html).not.toContain('答案');
  });

  it('renders visual.blockDiagram with normalized graph nodes, arrows, and reveal highlights', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'block-diagram',
        kind: 'visual.blockDiagram',
        mustBeVisible: true,
        payload: blockDiagramPayloadFixture(),
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.blockDiagram']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-structure-diagram-kind="visual.blockDiagram"');
    expect(html).toContain('data-structure-diagram-id="closed-loop-block-diagram"');
    expect(html).toContain('data-structure-diagram-layout-mode="relative"');
    expect(html).toContain('data-structure-diagram-layout-spacing-x="0.12"');
    expect(html).toContain('data-structure-diagram-canvas-vertical-fit="content-trimmed"');
    expect(html).toContain('data-structure-diagram-y-target-span="0.66"');
    expect(html).toContain('min-h-[300px]');
    expect(html).toContain('md:h-[340px]');
    expect(html).toContain('data-structure-diagram-node-id="plant"');
    expect(html).toContain('data-structure-diagram-node-type="block"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="block"');
    expect(html).toContain('data-structure-diagram-node-rendered-height="0.12352941176470589"');
    expect(html).toContain('data-structure-diagram-node-anchors="N E S W"');
    expect(html).toContain('data-structure-diagram-node-id="reference"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="input"');
    expect(html).toContain('data-structure-diagram-node-id="output"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="output"');
    expect(html).toContain('data-structure-diagram-text-scale="uniform"');
    expect(html).toContain('border border-transparent bg-transparent');
    expect(html).toContain('data-structure-diagram-node-label-rendering="latex"');
    expect(html).toContain('data-structure-diagram-node-symbol-size="takeoff-dot"');
    expect(html).toContain('data-structure-diagram-output-label-position="above-line"');
    expect(html).toContain('data-structure-diagram-node-selected="false"');
    expect(html).toContain('data-structure-diagram-edge-from-port="right"');
    expect(html).toContain('data-structure-diagram-edge-to-port="bottom"');
    expect(html).toContain('data-structure-diagram-edge-route="-|"');
    expect(html).toContain('data-structure-diagram-edge-waypoint-count="1"');
    expect(html).not.toContain('data-structure-diagram-node-symbol-size="small-dot"');
    expect(html).toContain('data-structure-diagram-summing-junction="cross"');
    expect(html).toContain('katex');
    expect(html).toContain('data-structure-diagram-label-chrome="plain"');
    expect(html).toContain('data-structure-diagram-edge-id="feedback-signal"');
    expect(html).toContain('data-structure-diagram-edge-id="feedback-return"');
    expect(html).toContain('data-structure-diagram-terminal-sign-id="feedback-return"');
    expect(html).toContain('data-structure-diagram-terminal-sign="−"');
    const terminalSignFragment = html.match(/<button[^>]*data-structure-diagram-terminal-sign-id="feedback-return"[^>]*>/)?.[0] ?? '';
    expect(terminalSignFragment).toContain('text-[19.5px]');
    expect(terminalSignFragment).toContain('bg-[var(--platform-surface)]/80');
    expect(terminalSignFragment).not.toContain('platform-brand-evidence');
    expect(html).toContain('data-structure-diagram-edge-main-line="true"');
    expect(html).toContain('data-structure-diagram-arrowhead-id="feedback-return"');
    expect(html).toContain('data-structure-diagram-arrow-style="fixed-pixel"');
    expect(html).toContain('width="13.5"');
    expect(html).toContain('height="9"');
    expect(html).toContain('data-structure-diagram-edge-hit-target="feedback-return"');
    expect(html).toContain('data-structure-diagram-edge-keyboard-selectable="true"');
    expect(html).toContain('aria-label="选择信号线 H(s)y"');
    expect(html).toContain('data-structure-diagram-edge-halo="highlighted"');
    expect(html).toContain('data-structure-diagram-edge-highlighted="true"');
    expect(html).toContain('data-structure-diagram-edge-selected="false"');
    expect(html).toContain('data-structure-diagram-reveal-id="feedback-loop"');
    expect(html).toContain('data-structure-diagram-reveal-plan="metadata"');
    expect(html).not.toContain('data-structure-diagram-reveal-plan="visible"');
    expect(html).not.toContain('高亮项');
    expect(html).not.toContain('data-structure-diagram-mode-label="visual"');
    expect(html).not.toContain('data-structure-diagram-submit="closed-loop-block-diagram"');
    expect(html).not.toContain('data-structure-diagram-edge-select-id=');
    expect(html).not.toContain('<span class="premium-lesson-badge">highlight</span>');
    expect(html).not.toContain('space-y-4');
    expect(html).toContain('x1="4" y1="4" x2="36" y2="36"');
    expect(html).toContain('x1="36" y1="4" x2="4" y2="36"');
    expect(html).toContain('stroke-width="3"');
  });

  it('applies the standard visual defaults for structure diagrams', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      modules: [
        {
          id: 'default-block-diagram',
          kind: 'visual.blockDiagram',
          mustBeVisible: true,
          payload: {
            graphId: 'default-block-style',
            layout: { mode: 'relative' },
            nodes: [
              { id: 'sum', type: 'sum', label: 'Σ', grid: { column: 0, row: 0 } },
              { id: 'plant', type: 'block', labelLatex: 'G(s)', relativeTo: 'sum', placement: 'right' },
              { id: 'tap', type: 'branch', display: 'takeoff', label: '输出引出点', relativeTo: 'plant', placement: 'right' },
              { id: 'sensor', type: 'sensor', labelLatex: 'H(s)', relativeTo: 'plant', placement: 'below' },
            ],
            edges: [
              { id: 'forward', from: 'sum.E', to: 'plant.W', route: '--', labelLatex: 'E(s)' },
              { id: 'feedback', from: 'sensor.W', to: 'sum.S', route: '-|', labelLatex: 'Y_m(s)', terminalSign: '-' },
            ],
          },
        },
        {
          id: 'default-signal-flow',
          kind: 'visual.signalFlowGraph',
          mustBeVisible: true,
          payload: {
            graphId: 'default-signal-flow-style',
            layout: { mode: 'relative' },
            nodes: [
              { id: 'r', labelLatex: 'R(s)', grid: { column: 0, row: 0 } },
              { id: 'y', labelLatex: 'Y(s)', relativeTo: 'r', placement: 'right' },
            ],
            branches: [
              { id: 'r-y', from: 'r', to: 'y', route: 'straight', gainLatex: 'G(s)' },
            ],
            pathSets: { forwardPaths: [['r-y']], loops: [], nonTouchingLoopGroups: [] },
          },
        },
      ],
    });
    const step = manifest.steps[0];
    const blockNode = registry['visual.blockDiagram']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const signalNode = registry['visual.signalFlowGraph']({
      manifest,
      step,
      module: step.modules[1],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const blockHtml = renderToStaticMarkup(createElement(ThemeProvider, null, blockNode));
    const signalHtml = renderToStaticMarkup(createElement(ThemeProvider, null, signalNode));

    expect(blockHtml).toContain('data-structure-diagram-layout-spacing-x="0.24"');
    expect(blockHtml).toContain('data-structure-diagram-layout-spacing-y="0.14"');
    expect(blockHtml).toContain('width:12%');
    expect(blockHtml).toContain('height:12.352941176470589%');
    expect(blockHtml).toContain('data-structure-diagram-node-rendered-height="0.12352941176470589"');
    expect(blockHtml).toContain('border-[3px] bg-platform-panel');
    expect(blockHtml).toContain('rounded-full border-[3px] bg-platform-panel');
    expect(blockHtml).toContain('border-[hsl(var(--platform-action-primary))]');
    expect(blockHtml).toContain('text-[hsl(var(--platform-action-primary))]');
    expect(blockHtml).toContain('data-structure-diagram-node-id="tap"');
    expect(blockHtml).toContain('data-structure-diagram-node-visual-kind="takeoff"');
    expect(blockHtml).toContain('left:46%');
    expect(blockHtml).toContain('stroke-width="1.6"');
    expect(blockHtml).toContain('data-structure-diagram-arrowhead-id="forward"');
    expect(blockHtml).toContain('data-structure-diagram-arrow-state="default"');
    expect(blockHtml).toContain('text-[19.5px]');
    expect(blockHtml).toContain('data-structure-diagram-terminal-sign="−"');
    expect(signalHtml).toContain('data-structure-diagram-layout-spacing-x="0.24"');
    expect(signalHtml).toContain('premium-lesson-panel interactive-courseware-panel grid gap-4');
    expect(signalHtml).toContain('data-structure-diagram-path-sets-enabled="true"');
    expect(signalHtml).toContain('data-structure-diagram-mason-map-enabled="true"');
    expect(signalHtml).toContain('data-structure-diagram-layout-spacing-y="0.14"');
    expect(signalHtml).toContain('stroke-width="1.6"');
    expect(signalHtml).toContain('data-structure-diagram-node-visual-kind="signal-node"');
    expect(signalHtml).toContain('data-structure-diagram-node-label-position="below"');
    expect(signalHtml).toContain('data-structure-diagram-node-dot="r"');
    expect(signalHtml).toContain('data-structure-diagram-node-anchors="N NE E SE S SW W NW C"');
    expect(signalHtml).toContain('data-structure-diagram-branch-from-port="right"');
    expect(signalHtml).toContain('data-structure-diagram-branch-to-port="left"');
    expect(signalHtml).toContain('data-structure-diagram-arrowhead-id="r-y"');
    expect(signalHtml).toContain('vector-effect="non-scaling-stroke"');
    expect(signalHtml).toContain('data-structure-diagram-arrow-style="fixed-pixel"');
    expect(signalHtml).toContain('text-[19.5px]');
  });

  it('renders block diagram default anchors and summing junction connectors as standard geometry', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'block-diagram-anchor-geometry',
        kind: 'visual.blockDiagram',
        mustBeVisible: true,
        payload: {
          graphId: 'anchor-geometry',
          layout: { mode: 'relative', origin: { x: 0.2, y: 0.5 }, spacing: { x: 0.2, y: 0.2 } },
          mode: 'diagnose',
          nodes: [
            { id: 'a', type: 'block', labelLatex: 'A', grid: { column: 0, row: 0 }, size: { width: 0.1, height: 0.1 } },
            { id: 'b', type: 'block', labelLatex: 'B', relativeTo: 'a', placement: 'right', size: { width: 0.1, height: 0.1 } },
            { id: 'sum', type: 'sum', label: 'Σ', relativeTo: 'b', placement: 'right', size: { width: 0.08, height: 0.08 } },
          ],
          edges: [
            { id: 'auto-ab', from: 'a', to: 'b', route: '--', label: 'u' },
            { id: 'sum-diagonal', from: 'sum.NE', to: 'b.SW', route: '--', label: 'd' },
          ],
          revealPlan: [{ id: 'all', label: '全部', targetIds: ['auto-ab', 'sum-diagonal'] }],
          activeRevealState: 'all',
        },
      },
    });
    const step = manifest.steps[0];
    const node = registry['visual.blockDiagram']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(html).toContain('data-structure-diagram-edge-id="auto-ab"');
    expect(html).toContain('data-structure-diagram-edge-from-port="right"');
    expect(html).toContain('data-structure-diagram-edge-to-port="left"');
    expect(html).toContain('data-structure-diagram-edge-id="sum-diagonal"');
    expect(html).toContain('data-structure-diagram-edge-from-port="top-right"');
    expect(html).toContain('data-structure-diagram-edge-to-port="bottom-left"');
    expect(html).toContain('data-structure-diagram-edge-hit-target="sum-diagonal"');
    expect(html).toContain('data-structure-diagram-edge-main-line="true"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain('d="M 62.828 47.172 L 35 56.176"');
  });

  it('renders visual.signalFlowGraph with branch labels, path sets, and Mason formula traceability', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
    });
    const manifest = manifestFixture({
      module: {
        id: 'signal-flow-graph',
        kind: 'visual.signalFlowGraph',
        mustBeVisible: true,
        payload: signalFlowGraphPayloadFixture(),
      },
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const node = registry['visual.signalFlowGraph']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 1, allowInlineReveal: true },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-structure-diagram-kind="visual.signalFlowGraph"');
    expect(html).toContain('data-structure-diagram-id="closed-loop-signal-flow"');
    expect(html).toContain('premium-lesson-panel interactive-courseware-panel grid gap-4');
    expect(html).toContain('data-structure-diagram-layout-mode="relative"');
    expect(html).toContain('data-structure-diagram-path-sets-enabled="true"');
    expect(html).toContain('data-structure-diagram-mason-map-enabled="true"');
    expect(html).toContain('data-structure-diagram-canvas-vertical-fit="content-trimmed"');
    expect(html).toContain('data-structure-diagram-y-target-span="0.7"');
    expect(html).toContain('min-h-[300px]');
    expect(html).toContain('md:h-[340px]');
    expect(html).toContain('data-structure-diagram-node-id="theta"');
    expect(html).toContain('data-structure-diagram-node-anchors="N NE E SE S SW W NW C"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="signal-node"');
    expect(html).toContain('data-structure-diagram-node-label-position="below"');
    expect(html).toContain('data-structure-diagram-node-label-position="above"');
    expect(html).toContain('data-structure-diagram-node-dot="theta"');
    expect(html).toContain('data-structure-diagram-text-scale="uniform"');
    expect(html).toContain('data-structure-diagram-branch-id="g-forward"');
    expect(html).toContain('data-structure-diagram-branch-route-kind="straight"');
    expect(html).toContain('data-structure-diagram-branch-route-kind="auto-bezier"');
    expect(html).toContain('data-structure-diagram-branch-from-port="right"');
    expect(html).toContain('data-structure-diagram-branch-to-port="left"');
    expect(html).toContain('data-structure-diagram-branch-from-port="bottom-left"');
    expect(html).toContain('data-structure-diagram-branch-to-port="bottom-right"');
    expect(html).toContain('data-structure-diagram-branch-selected="false"');
    expect(html).toContain('data-structure-diagram-branch-hit-target="h-feedback"');
    expect(html).toContain('data-structure-diagram-branch-keyboard-selectable="true"');
    expect(html).toContain('data-structure-diagram-branch-main-line="true"');
    expect(html).toContain('data-structure-diagram-branch-halo="highlighted"');
    expect(html).toContain('data-structure-diagram-keyword-toolbar="visible"');
    expect(html).toContain('data-structure-diagram-keyword-id="path-reveal"');
    expect(html).toContain('data-structure-diagram-keyword-targets="g-forward unity-forward"');
    expect(html).toContain('data-structure-diagram-keyword-selected="false"');
    expect(html).toContain('rounded-full border px-3 py-1.5 text-sm font-semibold');
    expect(html).toContain(' C ');
    expect(html).toContain('data-structure-diagram-branch-label-id="g-forward"');
    expect(html).toContain('data-structure-diagram-label-chrome="plain"');
    expect(html).toContain('data-structure-diagram-forward-path="g-forward unity-forward"');
    expect(html).toContain('data-structure-diagram-loop="unity-forward h-feedback"');
    expect(html).toContain('data-structure-diagram-path-id="forward-path-1"');
    expect(html).toContain('data-structure-diagram-loop-id="feedback-loop-1"');
    expect(html).toContain('data-structure-diagram-mason-term-id="delta-term"');
    expect(html).toContain('data-structure-diagram-related-ids="forward-path-1 feedback-loop-1"');
    expect(html).not.toContain('data-structure-diagram-submit="closed-loop-signal-flow"');
    expect(html).not.toContain('data-structure-diagram-mode-label="visual"');
    expect(html).not.toContain('<span class="premium-lesson-badge">diagnose</span>');
  });

  it('renders annotated media and embedded visual activity with shared submission hooks', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
      onPanelSubmit: () => undefined,
    });
    const manifest = manifestFixture({
      modules: [
        {
          id: 'annotated-media',
          kind: 'visual.annotatedMedia',
          mustBeVisible: true,
          payload: annotatedMediaPayloadFixture(),
        },
        {
          id: 'embedded-activity',
          kind: 'visual.embedded-activity',
          mustBeVisible: true,
          payload: embeddedActivityPayloadFixture(),
        },
      ],
    });
    const step = manifest.steps[0];
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: 'fixture-lesson', manifest }],
    });
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, createElement('div', null,
      registry['visual.annotatedMedia']({
        manifest,
        step,
        module: step.modules[0],
        extra: { revealProgress: 1, allowInlineReveal: true, onPanelSubmit: () => undefined },
      }) as ReactElement,
      registry['visual.embedded-activity']({
        manifest,
        step,
        module: step.modules[1],
        extra: { revealProgress: 1, allowInlineReveal: true, onPanelSubmit: () => undefined },
      }) as ReactElement,
    )));

    expect(result.passed).toBe(true);
    expect(html).toContain('data-annotated-media-kind="visual.annotatedMedia"');
    expect(html).toContain('data-annotated-media-annotation-id="input-hotspot"');
    expect(html).toContain('data-annotated-media-evidence-role="input"');
    expect(html).toContain('data-annotated-media-submit="closed-loop-media"');
    expect(html).toContain('data-annotated-media-activity-anchor="media-choice-anchor"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-embedded-activity-kind="visual.embedded-activity"');
    expect(html).toContain('data-embedded-activity-response-contract="choice.single"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('data-embedded-activity-submit="media-choice"');
  });

  it('rejects annotated media without recorded hotspots and visible internal naming leaks', () => {
    const missingHotspotResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'broken-annotated-media',
              kind: 'visual.annotatedMedia',
              mustBeVisible: true,
              payload: {
                ...annotatedMediaPayloadFixture(),
                interactions: { requireEvidenceSelection: true, selectableAnnotations: [] },
              },
            },
          }),
        },
      ],
    });
    const leakResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'leaky-embedded-activity',
              kind: 'visual.embedded-activity',
              mustBeVisible: true,
              payload: {
                ...embeddedActivityPayloadFixture(),
                prompt: 'visual.embedded-activity payload renderer name',
              },
            },
          }),
        },
      ],
    });
    const titleLeakResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'leaky-annotated-media-title',
              kind: 'visual.annotatedMedia',
              title: 'visual.annotatedMedia renderer payload title',
              mustBeVisible: true,
              payload: annotatedMediaPayloadFixture(),
            },
          }),
        },
      ],
    });
    const fallbackLeakResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'leaky-annotated-media-fallback',
              kind: 'visual.annotatedMedia',
              mustBeVisible: true,
              payload: {
                ...annotatedMediaPayloadFixture(),
                fallback: 'visual.annotatedMedia renderer fallback',
              },
            },
          }),
        },
      ],
    });

    expect(missingHotspotResult.passed).toBe(false);
    expect(missingHotspotResult.violations[0]?.message).toContain('interactions.selectableAnnotations');
    expect(leakResult.passed).toBe(false);
    expect(leakResult.violations[0]?.message).toContain('prompt:internal-leak');
    expect(titleLeakResult.passed).toBe(false);
    expect(titleLeakResult.violations[0]?.message).toContain('module.title:internal-leak');
    expect(fallbackLeakResult.passed).toBe(false);
    expect(fallbackLeakResult.violations[0]?.message).toContain('payload.fallback:internal-leak');
  });

  it('routes shared control workbench compute capabilities through the shared renderer', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'control-workbench-module',
        kind: 'compute.panel',
        mustBeVisible: true,
        payload: {
          capabilityRef: 'control-workbench',
          visiblePanelIds: ['time-domain', 'root-locus'],
          responseContractId: 'parameter.set',
          releaseState: 'released',
          request: controlAnalysisRequestFixture(),
          fallbackResult: controlAnalysisResultFixture(),
        },
      },
    });
    const step = manifest.steps[0];
    const node = registry['compute.panel']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(html).toContain('data-control-workbench-capability="control-workbench"');
    expect(html).toContain('data-control-workbench-module-id="control-workbench-module"');
    expect(html).toContain('data-control-workbench-panel="time-domain"');
    expect(html).toContain('data-control-workbench-panel="root-locus"');
    expect(html).not.toContain('data-control-workbench-panel="nyquist"');
    expect(html).toContain('提交会保存当前参数、图形状态和判断');
  });

  it('renders MATLAB code with the canonical content.code module renderer', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'matlab-code',
        kind: 'content.code',
        mustBeVisible: true,
        payload: { block_key: 'code_block' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.code_block = {
      language: 'matlab',
      code: 'G = tf(1, [1 2 0]);   % G(s)=1/(s(s+2))\nstep(G);',
      explanation: '同一对象先看开环阶跃，再进入根轨迹和频域诊断。',
    };
    const node = registry['content.code']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ code?: string; language?: string }>;

    expect(node.props.code).toContain('tf(1, [1 2 0])');
    expect(node.props.language).toBe('matlab');

    const html = renderToStaticMarkup(node);
    expect(html).toContain('data-module-kind="content.code"');
    expect(html).toContain('premium-code-token-function');
    expect(html).toContain('premium-code-token-comment');
  });

  it('renders inline payload items for canonical card set modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'inline-card-set',
        kind: 'content.cardSet',
        mustBeVisible: true,
        payload: { items: ['第一条', '第二条'] },
      },
    });
    const step = manifest.steps[0];
    const node = registry['content.cardSet']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ items?: string[] }>;

    expect(node.props.items).toEqual(['第一条', '第二条']);
  });

  it('renders formula group values for canonical formula modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'formula-group',
        kind: 'content.formula',
        mustBeVisible: true,
        payload: { block_key: 'formula_group' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.formula_group = {
      type: 'formula_group',
      values: ['G(s)=K', 'T(s)=\\frac{G(s)}{1+G(s)H(s)}'],
    };
    const node = registry['content.formula']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ formulas?: string[] }>;

    expect(node.props.formulas).toEqual(['G(s)=K', 'T(s)=\\frac{G(s)}{1+G(s)H(s)}']);
  });

  it('renders asset media blocks for canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'media-block',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { block_key: 'media_block' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.media_block = {
      type: 'media',
      asset: 'diagram.png',
    };
    const node = registry['content.figure']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/fixture-lesson/media/diagram.png');
  });

  it('renders single image payload assets for canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'single-payload-asset',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { assets: ['single.png'] },
      },
    });
    const step = manifest.steps[0];
    const node = registry['content.figure']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/fixture-lesson/media/single.png');
  });

  it('keeps media fallback order for multiple canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'segmented-block',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { block_key: 'route_task_table' },
      },
    });
    const step = manifest.steps[0];
    step.modules = [
      'segmented-block',
      'rudder-identification-figure',
      'hull-figure',
      'disturbance-figure',
    ].map((id) => ({
      id,
      kind: 'content.figure',
      region: 'main',
      mustBeVisible: true,
      payload: { block_key: 'route_task_table', legacyKind: 'image-panel' },
    }));
    step.contentBlocks.route_task_table = {
      columns: ['航线任务'],
      rows: [['zig-zag 航线']],
    };
    step.contentBlocks.media = [
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/segmented.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/rudder.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/hull.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/disturbance.png' },
    ];

    const sources = step.modules.map((module) => {
      const node = registry['content.figure']({
        manifest,
        step,
        module,
        extra: { revealProgress: 0, allowInlineReveal: false },
      }) as ReactElement<{ src?: string }>;
      return node.props.src;
    });

    expect(sources).toEqual([
      '/course-runtime/lessons/fixture-lesson/media/segmented.png',
      '/course-runtime/lessons/fixture-lesson/media/rudder.png',
      '/course-runtime/lessons/fixture-lesson/media/hull.png',
      '/course-runtime/lessons/fixture-lesson/media/disturbance.png',
    ]);
  });

  it('renders the migrated 2-1 step 13 loop diagram from its media group', () => {
    const rawManifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as unknown;
    const manifest = normalizeInteractiveRuntimeManifest(rawManifest);
    expect(manifest).not.toBeNull();
    if (!manifest) throw new Error('2-1 manifest should normalize');
    const step = manifest.steps.find((item) => item.id === 'step-13');
    expect(step).toBeDefined();
    if (!step) throw new Error('2-1 step-13 should exist');
    const runtimeModule = step.modules.find((item) => item.id === 'loop-diagram');
    expect(runtimeModule).toBeDefined();
    if (!runtimeModule) throw new Error('2-1 step-13 loop-diagram should exist');

    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const node = registry['content.figure']({
      manifest,
      step,
      module: runtimeModule,
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/2-1/media/2-1-md-07-example-ship-loop.png');
  });

  it('renders the migrated 2-1 step 14 SFG stage as a figure', () => {
    const rawManifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as unknown;
    const manifest = normalizeInteractiveRuntimeManifest(rawManifest);
    expect(manifest).not.toBeNull();
    if (!manifest) throw new Error('2-1 manifest should normalize');
    const step = manifest.steps.find((item) => item.id === 'step-14');
    expect(step).toBeDefined();
    if (!step) throw new Error('2-1 step-14 should exist');
    const runtimeModule = step.modules.find((item) => item.id === 'sfg-stage');
    expect(runtimeModule).toBeDefined();
    if (!runtimeModule) throw new Error('2-1 step-14 sfg-stage should exist');
    expect(runtimeModule.kind).toBe('content.figure');

    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const node = registry['content.figure']({
      manifest,
      step,
      module: runtimeModule,
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/2-1/media/2-1-md-14-example2-sfg.png');
  });

  it('uses formula renderers for migrated 2-1 formula-only visible content blocks', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, {
        modules?: Array<{
          id?: string;
          kind?: string;
          must_be_visible?: boolean;
          payload?: { block_key?: string };
        }>;
        content_blocks?: Record<string, { type?: string; value?: unknown; values?: unknown; formula?: unknown; latex?: unknown; math?: unknown }>;
      }>;
    };
    const offenders: string[] = [];

    for (const [stepId, step] of Object.entries(manifest.steps)) {
      for (const runtimeModule of step.modules ?? []) {
        const blockKey = runtimeModule.payload?.block_key;
        const block = blockKey ? step.content_blocks?.[blockKey] : undefined;
        const formulaOnlyBlock = block && (
          block.type === 'formula'
          || block.type === 'formula_group'
          || Boolean(block.value)
          || Boolean(block.values)
          || Boolean(block.formula)
          || Boolean(block.latex)
          || Boolean(block.math)
        );
        if (
          runtimeModule.must_be_visible
          && formulaOnlyBlock
          && ['content.rich', 'content.cardSet'].includes(runtimeModule.kind ?? '')
        ) {
          offenders.push(`${stepId}/${runtimeModule.id}:${runtimeModule.kind}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('reports unknown module kinds with lesson, step, and module identifiers', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'unknown-module',
              kind: 'custom-surprise-widget',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'unknown-module',
        kind: 'custom-surprise-widget',
        code: 'unregistered-module-kind',
      }),
    ]);
  });

  it('rejects course-local chrome overrides for standard module kinds', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'local-chrome-module',
              kind: 'content.rich',
              mustBeVisible: true,
              payload: { className: 'premium-lesson-card custom-local-shell' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'local-chrome-module',
        kind: 'content.rich',
        code: 'course-local-module-chrome',
        canonicalClass: 'content.rich',
      }),
    ]);
  });

  it('rejects object-shaped course-local chrome overrides for standard module kinds', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'object-local-chrome-module',
              kind: 'content.rich',
              mustBeVisible: true,
              payload: { moduleChrome: { variant: 'custom-local-shell' } },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'object-local-chrome-module',
        kind: 'content.rich',
        code: 'course-local-module-chrome',
        canonicalClass: 'content.rich',
      }),
    ]);
  });

  it('rejects legacy aliases in lessons marked migrated to canonical modules', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      migratedLessonIds: ['fixture-lesson'],
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-formula',
              kind: 'formula-strip',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-formula',
        kind: 'formula-strip',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'content.formula',
      }),
    ]);
  });

  it('rejects legacy aliases in new manifests even before a lesson is marked migrated', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'new-legacy-formula',
              kind: 'formula-strip',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'new-legacy-formula',
        kind: 'formula-strip',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'content.formula',
      }),
    ]);
  });

  it('rejects migration-only canonical module classes in migrated lessons', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      migratedLessonIds: ['fixture-lesson'],
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-adapter-module',
              kind: 'legacy.adapter',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-adapter-module',
        kind: 'legacy.adapter',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'legacy.adapter',
      }),
    ]);
  });

  it('rejects activity modules without a registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-without-contract',
              kind: 'activity.panel',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'activity-without-contract',
        kind: 'activity.panel',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects legacy activity aliases without a registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-activity-without-contract',
              kind: 'submit-feedback-bar',
              mustBeVisible: true,
            },
            interactionKind: 'display',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-activity-without-contract',
        kind: 'submit-feedback-bar',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('rejects generic activity card container aliases before response contract inference', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'generic-activity-container',
              kind: 'activity-card-set',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'generic-activity-container',
        kind: 'activity-card-set',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('allows canonical activity panels when the step kind defines the response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'figure-submit-container',
              kind: 'activity.panel',
              mustBeVisible: true,
            },
            interactionKind: 'interactive_figure_submit',
            activityCards: [],
            submitFields: ['gain', 'observation'],
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('reports unregistered activity card response kinds without filtering them out', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-with-mixed-contracts',
              kind: 'activity.panel',
              mustBeVisible: true,
              payload: { responseKind: 'choice.single' },
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'valid-card', responseKind: 'choice.single' }),
              activityCardFixture({ id: 'invalid-card', responseKind: 'not_registered' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'invalid-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'not_registered',
      }),
    ]);
  });

  it('rejects legacy response aliases even when their canonical replacement is known', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-with-legacy-response',
              kind: 'activity.panel',
              mustBeVisible: true,
              payload: { responseKind: 'choice.single' },
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'legacy-response-card', responseKind: 'single_choice' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-response-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'single_choice',
      }),
    ]);
  });

  it('rejects individual activity cards without response kinds even when sibling cards are valid', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'valid-card', responseKind: 'choice.single' }),
              activityCardFixture({ id: 'missing-card', responseKind: '' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'missing-card',
        kind: 'quiz_group',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('validates response-producing steps even when the visible module is content-only', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'step-card', responseKind: 'not_registered' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'step-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'not_registered',
      }),
    ]);
  });

  it('rejects response-producing steps without any response contract cards', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'quiz_group',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects display steps with submit fields but no registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'display',
            activityCards: [],
            submitFields: ['observation', 'reason'],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'display',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects suffixed response-producing steps without any response contract cards', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group+exit_reflection' as never,
            activityCards: [],
          }),
        },
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'short_response' as never,
            activityCards: [],
          }),
        },
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'curve_compare_panel' as never,
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'quiz_group+exit_reflection',
        code: 'activity-missing-response-contract',
      }),
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'short_response',
        code: 'activity-missing-response-contract',
      }),
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'curve_compare_panel',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects compute modules without a registered capability reference', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'compute-without-capability',
              kind: 'compute.panel',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'compute-without-capability',
        kind: 'compute.panel',
        code: 'compute-missing-capability-ref',
      }),
    ]);
  });

  it('rejects compute modules with unregistered capability references', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'compute-with-unknown-capability',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: { capabilityRef: 'unknown-compute-capability' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'compute-with-unknown-capability',
        kind: 'compute.panel',
        code: 'compute-unregistered-capability-ref',
        capabilityRef: 'unknown-compute-capability',
      }),
    ]);
  });

  it('accepts registered shared control workbench capabilities with response and panel contracts', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'control-workbench',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'control-linked-comparison',
                visiblePanelIds: ['time-domain', 'bode'],
                responseContractId: 'parameter.set',
                request: controlAnalysisRequestFixture(),
              },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('validates visual.stage payload contracts before runtime rendering', () => {
    const validResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'root-locus-stage',
              kind: 'visual.stage',
              mustBeVisible: true,
              payload: visualStagePayloadFixture(),
            },
          }),
        },
      ],
    });

    expect(validResult.passed).toBe(true);
    expect(validResult.violations).toEqual([]);

    const invalidResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'broken-stage',
              kind: 'visual.stage',
              mustBeVisible: true,
              payload: {
                stageId: '',
                aspectRatio: 'square',
                releaseState: 'floating',
                revealStates: ['intro'],
                activeRevealState: 'missing',
                layers: [
                  {
                    id: 'duplicate-layer',
                    kind: 'diagram',
                    region: { x: 0, y: 0, width: 0.6, height: 0.6 },
                    zIndex: 0,
                    revealState: 'intro',
                  },
                  {
                    id: 'duplicate-layer',
                    kind: 'private-widget',
                    region: { x: 0.7, y: 0.5, width: 0.5, height: 0.8 },
                    zIndex: -1,
                    revealState: 'missing',
                  },
                  {
                    kind: 'activity',
                    region: { x: -0.1, y: 0, width: 0, height: 1.2 },
                  },
                ],
              },
            },
          }),
        },
      ],
    });

    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'broken-stage',
        kind: 'visual.stage',
        code: 'visual-stage-payload-invalid',
        canonicalClass: 'visual.stage',
      }),
    ]);
    expect(invalidResult.violations[0]?.message).toContain('stageId');
    expect(invalidResult.violations[0]?.message).toContain('stage=(missing)');
    expect(invalidResult.violations[0]?.message).toContain('aspectRatio');
    expect(invalidResult.violations[0]?.message).toContain('releaseState');
    expect(invalidResult.violations[0]?.message).toContain('activeRevealState');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].id:duplicate');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].kind');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].revealState');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].region.right');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].region.bottom');
    expect(invalidResult.violations[0]?.message).toContain('layers[1:duplicate-layer].zIndex');
    expect(invalidResult.violations[0]?.message).toContain('layers[2:(missing)].id');
    expect(invalidResult.violations[0]?.message).toContain('layers[2:(missing)].region.x');
    expect(invalidResult.violations[0]?.message).toContain('layers[2:(missing)].region.width');
    expect(invalidResult.violations[0]?.message).toContain('layers[2:(missing)].region.height');
  });

  it('validates visual.derivationStage payload contracts before runtime rendering', () => {
    const validResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'derivation-stage',
              kind: 'visual.derivationStage',
              mustBeVisible: true,
              payload: derivationStagePayloadFixture(),
            },
          }),
        },
      ],
    });

    expect(validResult.passed).toBe(true);
    expect(validResult.violations).toEqual([]);

    const invalidResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'broken-derivation-stage',
              kind: 'visual.derivationStage',
              mustBeVisible: true,
              payload: {
                stageId: '',
                aspectRatio: 'square',
                releaseState: 'floating',
                formulas: [
                  {
                    id: 'formula-a',
                    latex: 'plain words only',
                    region: { x: 0, y: 0, width: 0.5, height: 0.5 },
                    blocks: [
                      { id: 'duplicate-block', latex: '\\\\alpha', colorRole: 'known' },
                      { id: 'duplicate-block', latex: 'plain', colorRole: 'purple' },
                    ],
                  },
                ],
                textBlocks: [
                  { id: 'note-a', body: 'note', region: { x: 0.8, y: 0.8, width: 0.4, height: 0.4 } },
                ],
                connectors: [
                  { id: 'bad-connector', kind: 'curve', from: 'missing-source', to: 'missing-target', revealStepIds: ['missing-step'] },
                ],
                revealSteps: [
                  { id: 'reveal-a', targetIds: ['missing-target'] },
                  { id: 'reveal-a', targetIds: ['duplicate-block', 'missing-target'] },
                ],
                cognitiveLoad: {},
                activeRevealStepId: 'missing-active-step',
                teacherControls: { enabled: ['next'] },
              },
            },
          }),
        },
      ],
    });

    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'broken-derivation-stage',
        kind: 'visual.derivationStage',
        code: 'derivation-stage-payload-invalid',
        canonicalClass: 'visual.derivationStage',
      }),
    ]);
    expect(invalidResult.violations[0]?.message).toContain('stageId');
    expect(invalidResult.violations[0]?.message).toContain('aspectRatio');
    expect(invalidResult.violations[0]?.message).toContain('releaseState');
    expect(invalidResult.violations[0]?.message).toContain('formulas[0:formula-a].latex');
    expect(invalidResult.violations[0]?.message).toContain('blocks[1:duplicate-block].id:duplicate');
    expect(invalidResult.violations[0]?.message).toContain('blocks[1:duplicate-block].colorRole');
    expect(invalidResult.violations[0]?.message).toContain('textBlocks[0:note-a].region.right');
    expect(invalidResult.violations[0]?.message).toContain('connectors[0:bad-connector].kind');
    expect(invalidResult.violations[0]?.message).toContain('connectors[0:bad-connector].from');
    expect(invalidResult.violations[0]?.message).toContain('connectors[0:bad-connector].revealStepIds:missing-step');
    expect(invalidResult.violations[0]?.message).toContain('revealSteps[1:reveal-a].id:duplicate');
    expect(invalidResult.violations[0]?.message).toContain('activeRevealStepId');
    expect(invalidResult.violations[0]?.message).toContain('cognitiveLoad.longFormulaSplitStrategy');
    expect(invalidResult.violations[0]?.message).toContain('teacherControls.previous');
    expect(invalidResult.violations[0]?.message).toContain('teacherControls.answerReveal');
  });

  it('validates structure diagram payload contracts before runtime rendering', () => {
    const validBlockResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'block-diagram',
              kind: 'visual.blockDiagram',
              mustBeVisible: true,
              payload: blockDiagramPayloadFixture(),
            },
          }),
        },
      ],
    });
    const validSignalFlowResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'signal-flow-graph',
              kind: 'visual.signalFlowGraph',
              mustBeVisible: true,
              payload: signalFlowGraphPayloadFixture(),
            },
          }),
        },
      ],
    });

    expect(validBlockResult.passed).toBe(true);
    expect(validSignalFlowResult.passed).toBe(true);

    const invalidBlockResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'broken-block-diagram',
              kind: 'visual.blockDiagram',
              mustBeVisible: true,
              payload: {
                graphId: '',
                mode: 'diagnose',
                image: '/static/fallback.png',
                staticImageOnly: true,
                layout: { mode: 'relative', textScale: 'tiny' },
                nodes: [
                  { id: 'plant', type: 'block', label: 'G(s)', position: { x: 0.5, y: 0.5 } },
                  { id: 'plant', type: 'private-widget', position: { x: 1.4, y: 0.5 } },
                  { id: 'late', type: 'block', label: 'Late', relativeTo: 'future', placement: 'sideways' },
                  { id: 'future', type: 'block', label: 'Future', relativeTo: 'late', placement: 'right' },
                  { id: 'self', type: 'block', label: 'Self', relativeTo: 'self', placement: 'right' },
                ],
                edges: [
                  { id: 'edge-a', from: 'plant', to: 'missing-node' },
                  { id: 'edge-a', from: 'missing-node', to: 'plant' },
                  { id: 'edge-ne', from: 'plant.NE', to: 'future.SW', route: 'diagonal', label: 'x', terminalSign: 'negative' },
                ],
                revealPlan: [],
                activeRevealState: 'missing-reveal',
              },
            },
          }),
        },
      ],
    });
    const invalidSignalResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'broken-signal-flow',
              kind: 'visual.signalFlowGraph',
              mustBeVisible: true,
              payload: {
                graphId: 'broken-signal-flow',
                mode: 'highlight',
                layout: { mode: 'relative' },
                nodes: [
                  { id: 'input', labelLatex: 'R', position: { x: 0.1, y: 0.5 } },
                  { id: 'late', labelLatex: 'L', relativeTo: 'missing-node', placement: 'sideways' },
                ],
                branches: [
                  { id: 'g-forward', from: 'input', to: 'missing-output', gainLatex: 'G' },
                  { id: 'bad-route', from: 'input', to: 'late', route: '-|', gainLatex: 'B' },
                ],
                pathSets: {
                  forwardPaths: [{ id: 'forward-path-1', label: '前向路径 P1', branchIds: ['missing-branch'] }],
                  loops: [],
                },
                revealPlan: [
                  { id: 'loop-reveal', emphasis: 'loop', targetIds: ['missing-target'] },
                ],
                masonTerms: [
                  { id: 'delta-term', latex: '\\\\Delta', relatedIds: ['missing-branch'] },
                ],
                activeRevealState: 'missing-reveal',
              },
            },
          }),
        },
      ],
    });

    expect(invalidBlockResult.passed).toBe(false);
    expect(invalidBlockResult.violations[0]?.message).toContain('graph=(missing).graphId');
    expect(invalidBlockResult.violations[0]?.message).toContain('staticImageOnly');
    expect(invalidBlockResult.violations[0]?.message).toContain('layout.textScale');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[1:plant].id:duplicate');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[1:plant].type');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[1:plant].label');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[1:plant].position.x');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[2:late].relativeTo');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[2:late].placement');
    expect(invalidBlockResult.violations[0]?.message).toContain('nodes[4:self].relativeTo');
    expect(invalidBlockResult.violations[0]?.message).toContain('edges[0:edge-a].to');
    expect(invalidBlockResult.violations[0]?.message).toContain('edges[0:edge-a].label');
    expect(invalidBlockResult.violations[0]?.message).toContain('edges[1:edge-a].id:duplicate');
    expect(invalidBlockResult.violations[0]?.message).toContain('edges[2:edge-ne].route');
    expect(invalidBlockResult.violations[0]?.message).toContain('edges[2:edge-ne].terminalSign');
    expect(invalidBlockResult.violations[0]?.message).toContain('revealPlan');
    expect(invalidBlockResult.violations[0]?.message).toContain('activeRevealState');

    expect(invalidSignalResult.passed).toBe(false);
    expect(invalidSignalResult.violations[0]?.message).toContain('branches[0:g-forward].to');
    expect(invalidSignalResult.violations[0]?.message).toContain('branches[1:bad-route].route');
    expect(invalidSignalResult.violations[0]?.message).toContain('nodes[1:late].relativeTo');
    expect(invalidSignalResult.violations[0]?.message).toContain('nodes[1:late].placement');
    expect(invalidSignalResult.violations[0]?.message).toContain('pathSets.forwardPaths[0]:missing-branch');
    expect(invalidSignalResult.violations[0]?.message).toContain('pathSets.loops');
    expect(invalidSignalResult.violations[0]?.message).toContain('revealPlan[0:loop-reveal].targetIds:missing-target');
    expect(invalidSignalResult.violations[0]?.message).toContain('masonTerms[0:delta-term].relatedIds:missing-branch');
    expect(invalidSignalResult.violations[0]?.message).toContain('activeRevealState');

    const tableOnlyResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'table-only-graph',
              kind: 'visual.signalFlowGraph',
              mustBeVisible: true,
              payload: {
                graphId: 'table-only-graph',
                mode: 'highlight',
                tableRows: [{ path: 'P1', gain: 'G(s)' }],
              },
            },
          }),
        },
      ],
    });

    expect(tableOnlyResult.passed).toBe(false);
    expect(tableOnlyResult.violations[0]?.message).toContain('tableOnly');
  });

  it('rejects shared control workbench capabilities without visible panel and response contracts', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'control-workbench-missing-contract',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: { capabilityRef: 'control-workbench' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        moduleId: 'control-workbench-missing-contract',
        code: 'compute-control-migration-exception-invalid',
        capabilityRef: 'control-workbench',
      }),
    ]);
  });

  it('rejects interactive-figure as a generic control-analysis carrier without a complete migration exception', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'private-bode-panel',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'interactive-figure',
                panel_id: 'rust_bode_private_panel',
                migrationException: {
                  issueId: '560',
                  owner: 'interactive-course-visual-components',
                },
              },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        moduleId: 'private-bode-panel',
        code: 'compute-control-migration-exception-invalid',
        capabilityRef: 'interactive-figure',
      }),
    ]);
  });

  it('validates static 3D surface compute panel payloads', () => {
    const validResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: staticSurfacePayloadFixture(),
            },
          }),
        },
      ],
    });

    expect(validResult.passed).toBe(true);
    expect(validResult.violations).toEqual([]);

    const inlineDataResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-inline-data',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                ...staticSurfacePayloadFixture(),
                data: {
                  regularGrid: {
                    x: [-2, 0, 2],
                    y: [-1, 1],
                    values: [
                      [8, 18, 8],
                      [6, 12, 6],
                    ],
                  },
                },
              },
            },
          }),
        },
      ],
    });

    expect(inlineDataResult.passed).toBe(true);
    expect(inlineDataResult.violations).toEqual([]);

    const invalidResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-missing-contract',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'static-surface-3d',
                data: { url: '/course-runtime/lessons/1-2/media/generated-data/pole-magnitude-surface.json' },
              },
            },
          }),
        },
      ],
    });

    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'static-surface-missing-contract',
        kind: 'compute.panel',
        code: 'compute-static-surface-payload-invalid',
        capabilityRef: 'static-surface-3d',
      }),
    ]);

    const unsupportedInlineDataResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-values-only',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                ...staticSurfacePayloadFixture(),
                data: { values: [[1, 2], [3, 4]] },
              },
            },
          }),
        },
      ],
    });

    expect(unsupportedInlineDataResult.passed).toBe(false);
    expect(unsupportedInlineDataResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'static-surface-values-only',
        kind: 'compute.panel',
        code: 'compute-static-surface-payload-invalid',
        capabilityRef: 'static-surface-3d',
      }),
    ]);
  });

  it('rejects content.code modules without code text', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'empty-code',
              kind: 'content.code',
              mustBeVisible: true,
              payload: { language: 'python' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'empty-code',
        kind: 'content.code',
        code: 'code-module-missing-source',
      }),
    ]);
  });

  it('allows non-MATLAB code modules while reserving MATLAB highlighting for MATLAB code', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'python-code',
              kind: 'content.code',
              mustBeVisible: true,
              payload: { language: 'python', code: 'print(\"control example\")' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects code-like examples hidden inside non-code content modules', () => {
    const manifest = manifestFixture({
      module: {
        id: 'hidden-code-reveal',
        kind: 'content.reveal',
        mustBeVisible: true,
        payload: { block_key: 'hidden_code' },
      },
    });
    manifest.steps[0].contentBlocks.hidden_code = {
      items: [
        { text: 'G = tf(1, [1 2 0]);   % G(s)=1/(s(s+2))' },
      ],
    };

    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'hidden-code-reveal',
        kind: 'content.reveal',
        code: 'code-like-content-outside-code-module',
      }),
    ]);
  });

  it('rejects generic interaction status modules on non-interactive pages', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'status-panel',
              kind: 'layout.support',
              mustBeVisible: true,
              payload: { title: '本页互动状态', text: '无需作答' },
            },
            interactionKind: 'none',
            activityCards: [],
            submitFields: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'status-panel',
        kind: 'layout.support',
        code: 'non-interactive-status-module',
      }),
    ]);
  });

  it('reports invalid manifest JSON as a structured gate violation', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/broken-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(join(lessonDir, 'interactive-manifest.json'), '{ invalid json', 'utf8');

      const result = scanRuntimeInteractiveModuleRegistry({ rootDir });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'broken-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/broken-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('reports structurally malformed manifest objects as structured gate violations', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const emptyLessonDir = join(rootDir, 'course-content/runtime/lessons/empty-lesson');
      const malformedLessonDir = join(rootDir, 'course-content/runtime/lessons/malformed-lesson');
      mkdirSync(emptyLessonDir, { recursive: true });
      mkdirSync(malformedLessonDir, { recursive: true });
      writeFileSync(join(emptyLessonDir, 'interactive-manifest.json'), '{}', 'utf8');
      writeFileSync(join(malformedLessonDir, 'interactive-manifest.json'), '{"steps":[]}', 'utf8');

      const result = scanRuntimeInteractiveModuleRegistry({ rootDir });

      expect(result.passed).toBe(false);
      expect(result.scannedModules).toBe(0);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'empty-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/empty-lesson/interactive-manifest.json',
        }),
        expect.objectContaining({
          lessonId: 'malformed-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/malformed-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when a runtime-first manifest is missing from the standard module lesson inventory', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/unlisted-runtime-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'unlisted-runtime-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: [],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'unlisted-runtime-lesson',
          code: 'lesson-missing-from-standard-module-inventory',
          manifestPath: 'course-content/runtime/lessons/unlisted-runtime-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects top-level course-local chrome before runtime manifest normalization strips it', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/local-chrome-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'local-chrome-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  className: 'course-local-shell',
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['local-chrome-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'local-chrome-lesson',
          stepId: 'step-01',
          moduleId: 'intro',
          kind: 'content.rich',
          code: 'course-local-module-chrome',
          canonicalClass: 'content.rich',
          manifestPath: 'course-content/runtime/lessons/local-chrome-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects top-level object or array course-local chrome before normalization strips it', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/local-chrome-object-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'local-chrome-object-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  localChrome: [{ variant: 'course-local-shell' }],
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['local-chrome-object-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'local-chrome-object-lesson',
          stepId: 'step-01',
          moduleId: 'intro',
          kind: 'content.rich',
          code: 'course-local-module-chrome',
          canonicalClass: 'content.rich',
          manifestPath: 'course-content/runtime/lessons/local-chrome-object-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('passes for the current runtime manifest inventory with standard module lesson enforcement', () => {
    const result = scanRuntimeInteractiveModuleRegistry();

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.scannedModules).toBeGreaterThan(0);
  });

  it('does not hard-code generic interaction status or runtime media implementation copy in step panel source', () => {
    const files = collectSourceFiles(join(process.cwd(), 'src/features/interactive'))
      .filter((filePath) => filePath.endsWith('/step-panels.tsx'));
    const forbiddenCopy = /本页互动状态|互动状态模块|课程 runtime 配套图示|当前交互实现直接消费|Python 函数|Python 代码|```python|import control/;
    const offenders = files.filter((filePath) => forbiddenCopy.test(readFileSync(filePath, 'utf8')));

    expect(offenders.map((filePath) => filePath.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });

  it('rejects course-private duplicate control panel source unless a complete migration exception is documented', () => {
    const invalidSource = evaluateInteractiveCoursePrivateControlPanelSourceGate([
      {
        path: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        source: 'import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels"; export function LocalBodePanel() { return null; }',
      },
    ]);
    expect(invalidSource).toEqual([
      expect.objectContaining({
        lessonId: 'unit-9-9-demo',
        code: 'course-private-control-panel-duplicate',
      }),
    ]);

    const validSource = evaluateInteractiveCoursePrivateControlPanelSourceGate([
      {
        path: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        source: `
          const controlWorkbenchMigrationException = {
            issueId: '#560',
            owner: 'interactive-course-visual-components',
            removalCondition: 'replace with shared control workbench capability',
            expiresOn: '2026-12-31',
          };
          import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels";
        `,
      },
    ]);
    expect(validSource).toEqual([]);
  });

  it('scans course-private duplicate control panel source by default', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/source-gate-lesson');
      const sourceDir = join(rootDir, 'src/features/interactive/unit-9-9-demo');
      mkdirSync(lessonDir, { recursive: true });
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'source-gate-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );
      writeFileSync(
        join(sourceDir, 'step-panels.tsx'),
        'import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels"; export function LocalBodePanel() { return null; }',
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['source-gate-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'unit-9-9-demo',
          code: 'course-private-control-panel-duplicate',
          manifestPath: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('passes the standard module lesson group with canonical modules on every step', () => {
    const standardModuleLessonIds = [...STANDARD_MODULE_ENFORCED_LESSON_IDS];
    const result = scanRuntimeInteractiveModuleRegistry({ standardModuleLessonIds });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    expect(standardModuleLessonIds).toContain('1-1');

    for (const lessonId of standardModuleLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });

  it('passes the migrated variant-heavy lesson group with canonical modules on every step', () => {
    const migratedLessonIds = ['3-5', '3-6', '3-7', '3-8', '3-9'];
    const result = scanRuntimeInteractiveModuleRegistry({
      migratedLessonIds: STANDARD_MODULE_MIGRATED_LESSON_IDS,
    });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    for (const lessonId of migratedLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });

  it('passes the migrated stable lesson group with canonical modules on every step', () => {
    const migratedLessonIds = [
      '4-1',
      '4-2',
      '4-3',
      '4-4',
      '4-5',
      '4-6',
      '4-7',
      '5-1',
      '5-2',
      '5-3',
      '5-4',
      '5-5',
      '5-6',
      'cruise-comfort-boppps',
    ];
    const result = scanRuntimeInteractiveModuleRegistry({
      migratedLessonIds: STANDARD_MODULE_MIGRATED_LESSON_IDS,
    });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    for (const lessonId of migratedLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });
});

function manifestFixture({
  module,
  modules,
  interactionKind = 'display',
  activityCards,
  submitFields,
}: {
  module?: { id: string; kind: string; title?: string; mustBeVisible: boolean; payload?: Record<string, unknown> };
  modules?: Array<{ id: string; kind: string; title?: string; mustBeVisible: boolean; payload?: Record<string, unknown> }>;
  interactionKind?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['interactionKind'];
  activityCards?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['activityCards'];
  submitFields?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['submitFields'];
}): InteractiveRuntimeManifest {
  const runtimeModules = modules ?? (module ? [module] : []);
  return {
    lessonId: 'fixture-lesson',
    courseTitle: 'Fixture Lesson',
    courseRouteSegment: 'fixture-lesson',
    previewMode: {},
    mediaPolicy: {},
    telemetryStrategy: 'fixture',
    teacherInsightStrategy: 'fixture',
    requiredStepFields: [],
    stepOrder: ['step-01'],
    steps: [
      {
        id: 'step-01',
        title: 'Step 01',
        layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
        modules: runtimeModules.map((runtimeModule) => ({
          id: runtimeModule.id,
          kind: runtimeModule.kind,
          title: runtimeModule.title,
          region: 'main',
          mustBeVisible: runtimeModule.mustBeVisible,
          payload: runtimeModule.payload ?? {},
        })),
        contentBlocks: {},
        evidenceSequence: [],
        interactionSpec: {
          interactionKind,
          activityCards,
          submitFields,
        },
        teacherControls: {
          releaseActivity: 'not_applicable',
          openBrowse: 'not_applicable',
          teacherStepReveal: 'not_applicable',
          revealReferenceAnswer: 'not_applicable',
        },
        studentAccess: {},
        teacherInsightSpec: { widgets: [] },
        telemetrySpec: { summaryFields: [], misconceptionTags: [] },
        aiContextSpec: { pageGoal: '', deliveryMode: '' },
        interactiveFigureSpec: {},
        previewContract: { demoPath: '' },
        acceptanceChecks: [],
      },
    ],
  };
}

function staticSurfacePayloadFixture(): Record<string, unknown> {
  return {
    capabilityRef: 'static-surface-3d',
    data: { url: '/course-runtime/lessons/1-2/media/generated-data/pole-magnitude-surface.json' },
    axes: {
      x: { label: '实部 σ' },
      y: { label: '虚部 jω' },
      z: { label: '20log10|G(s)|' },
    },
    colorScale: { label: '幅值 dB', min: -20, max: 60 },
    defaultCamera: { position: [3, 3, 2], target: [0, 0, 0], zoom: 1 },
    fallback: {
      image: '/course-runtime/lessons/1-2/media/1-2-fig-08-magnitude-surface.png',
      alt: '船舶传递函数极点幅值曲面的静态图',
    },
  };
}

function visualStagePayloadFixture(): Record<string, unknown> {
  return {
    stageId: 'root-locus-reading-stage',
    aspectRatio: '16:9',
    releaseState: 'released',
    activeRevealState: 'intro',
    revealStates: ['intro', 'answer'],
    layers: [
      {
        id: 'plant-diagram',
        kind: 'diagram',
        appearance: 'flowNode',
        title: '对象关系',
        body: '把开环对象、闭环反馈和观察量放在同一坐标中。',
        region: { x: 0.04, y: 0.08, width: 0.58, height: 0.5 },
        zIndex: 1,
        revealState: 'intro',
      },
      {
        id: 'formula-callout',
        kind: 'formula',
        appearance: 'note',
        title: '闭环式',
        body: '$T(s)=\\frac{G(s)}{1+G(s)H(s)}$',
        region: { x: 0.64, y: 0.1, width: 0.3, height: 0.22 },
        zIndex: 2,
        revealState: 'intro',
      },
      {
        id: 'activity-anchor-layer',
        kind: 'activity',
        appearance: 'card',
        title: '判断锚点',
        body: '记录稳定性观察。',
        region: { x: 0.58, y: 0.62, width: 0.36, height: 0.24 },
        zIndex: 3,
        revealState: 'intro',
        activityAnchor: 'stability-observation',
      },
    ],
    connections: [
      {
        id: 'plant-to-anchor',
        from: 'plant-diagram',
        to: 'activity-anchor-layer',
        fromAnchor: 'SE',
        toAnchor: 'NW',
        revealState: 'intro',
      },
    ],
  };
}

function derivationStagePayloadFixture(): Record<string, unknown> {
  return {
    stageId: 'nonlinear-derivation-stage',
    aspectRatio: '16:9',
    releaseState: 'revealed',
    activeRevealStepId: 'step-middle-block',
    formulas: [
      {
        id: 'definition-formula',
        title: '闭环定义',
        latex: 'T(s)=\\\\frac{G(s)}{1+G(s)H(s)}',
        region: { x: 0.05, y: 0.08, width: 0.42, height: 0.32 },
        blocks: [
          { id: 'known-g', title: '对象', latex: 'G(s)', colorRole: 'known' },
          { id: 'cancel-term', title: '抵消项', latex: '1+G(s)H(s)', colorRole: 'cancel' },
        ],
      },
      {
        id: 'result-formula',
        title: '目标式',
        latex: '\\\\Phi(s)=\\\\frac{C(s)}{R(s)}',
        region: { x: 0.52, y: 0.48, width: 0.38, height: 0.28 },
        blocks: [
          { id: 'result-block', title: '结论', latex: '\\\\Phi(s)', colorRole: 'result' },
        ],
      },
    ],
    textBlocks: [
      {
        id: 'upper-right-note',
        title: '观察',
        body: '先保留定义，再移动到右侧目标表达。',
        region: { x: 0.56, y: 0.08, width: 0.35, height: 0.18 },
      },
    ],
    connectors: [
      {
        id: 'definition-to-target',
        kind: 'arrow',
        from: 'known-g',
        to: 'result-block',
        fromAnchor: 'E',
        toAnchor: 'W',
        revealStepIds: ['step-middle-block'],
      },
    ],
    revealSteps: [
      {
        id: 'step-lower-left',
        title: '下方定义',
        targetIds: ['definition-formula', 'known-g'],
        reasoning: '先定位对象关系。',
      },
      {
        id: 'step-upper-right',
        title: '右上说明',
        targetIds: ['upper-right-note'],
        reasoning: '再解释推导意图。',
      },
      {
        id: 'step-middle-block',
        title: '目标表达',
        targetIds: ['cancel-term', 'result-formula', 'result-block'],
        reasoning: '最后显影变形和结论。',
      },
    ],
    cognitiveLoad: {
      maxNewFormulaBlocksPerStep: 2,
      maxSimultaneousColorRoles: 2,
      longFormulaSplitStrategy: 'block-by-term',
      defaultTeacherReleasePace: 'teacher-paced',
      studentSelfStudyVisibleRange: 'released-through-active',
    },
    teacherControls: {
      enabled: ['next', 'previous', 'jump', 'highlight', 'answerReveal', 'reset'],
    },
    answerVisible: true,
  };
}

function blockDiagramPayloadFixture(): Record<string, unknown> {
  return {
    graphId: 'closed-loop-block-diagram',
    layout: {
      mode: 'relative',
      origin: { x: 0.1, y: 0.45 },
      spacing: { x: 0.12, y: 0.31 },
    },
    mode: 'highlight',
    activeRevealState: 'feedback-loop',
    nodes: [
      { id: 'reference', type: 'input', label: 'R(s)', grid: { column: 0, row: 0 }, size: { width: 0.08, height: 0.08 } },
      { id: 'sum', type: 'sum', label: '+/-', relativeTo: 'reference', placement: 'right', size: { width: 0.08, height: 0.08 } },
      { id: 'controller', type: 'block', labelLatex: 'C(s)', relativeTo: 'sum', placement: 'right', distance: 1.5, size: { width: 0.14, height: 0.1 } },
      { id: 'plant', type: 'block', labelLatex: 'G(s)', relativeTo: 'controller', placement: 'right', distance: 1.6, size: { width: 0.14, height: 0.1 } },
      { id: 'disturbance', type: 'disturbance', labelLatex: 'D(s)', relativeTo: 'plant', placement: 'above', distance: 0.8, size: { width: 0.1, height: 0.08 } },
      { id: 'output-branch', type: 'branch', display: 'takeoff', label: 'y', relativeTo: 'plant', placement: 'right', distance: 1.2, size: { width: 0.04, height: 0.04 } },
      { id: 'output', type: 'output', label: 'Y(s)', relativeTo: 'output-branch', placement: 'right', distance: 1, size: { width: 0.08, height: 0.08 } },
      { id: 'sensor', type: 'sensor', labelLatex: 'H(s)', relativeTo: 'plant', placement: 'below', distance: 1, size: { width: 0.14, height: 0.1 } },
    ],
    edges: [
      { id: 'reference-signal', from: 'reference.E', to: 'sum.W', route: '--', label: 'r' },
      { id: 'error-signal', from: 'sum.E', to: 'controller.W', route: '--', labelLatex: 'e' },
      { id: 'control-signal', from: 'controller.E', to: 'plant.W', route: '--', labelLatex: 'u' },
      { id: 'disturbance-input', from: 'disturbance', to: 'plant', labelLatex: 'd' },
      { id: 'plant-output', from: 'plant.E', to: 'output-branch.C', route: '--', labelLatex: 'y' },
      { id: 'output-signal', from: 'output-branch.C', to: 'output.W', route: '--', display: 'terminal', label: '' },
      { id: 'feedback-signal', from: 'output-branch.C', to: 'sensor.E', route: '|-', labelLatex: 'y' },
      { id: 'feedback-return', from: 'sensor.W', to: 'sum.S', route: '-|', labelLatex: 'H(s)y', terminalSign: '-' },
    ],
    revealPlan: [
      { id: 'forward-path', label: '前向通道', targetIds: ['reference-signal', 'error-signal', 'control-signal', 'plant-output', 'output-signal'] },
      { id: 'feedback-loop', label: '反馈回路', targetIds: ['feedback-signal', 'feedback-return', 'sensor', 'sum'] },
    ],
  };
}

function signalFlowGraphPayloadFixture(): Record<string, unknown> {
  return {
    graphId: 'closed-loop-signal-flow',
    layout: {
      mode: 'relative',
      origin: { x: 0.16, y: 0.5 },
      spacing: { x: 0.28, y: 0.24 },
    },
    mode: 'diagnose',
    activeRevealState: 'loop-reveal',
    nodes: [
      { id: 'input', labelLatex: 'R', grid: { column: 0, row: 0 } },
      { id: 'theta', labelLatex: '\\\\Theta', relativeTo: 'input', placement: 'right' },
      { id: 'output', labelLatex: 'Y', labelPosition: 'above', relativeTo: 'theta', placement: 'right' },
    ],
    branches: [
      { id: 'g-forward', from: 'input', to: 'theta', gainLatex: 'G(s)' },
      { id: 'unity-forward', from: 'theta', to: 'output', gainLatex: '1' },
      { id: 'h-feedback', from: 'output', to: 'theta', gainLatex: '-H(s)' },
    ],
    pathSets: {
      forwardPaths: [
        { id: 'forward-path-1', label: '前向路径 P1', branchIds: ['g-forward', 'unity-forward'] },
      ],
      loops: [
        { id: 'feedback-loop-1', label: '反馈环路 L1', branchIds: ['unity-forward', 'h-feedback'] },
      ],
      nonTouchingLoopGroups: [
        { id: 'non-touching-loop-group-1', label: '不接触回路组', loopIds: ['feedback-loop-1'] },
      ],
    },
    revealPlan: [
      { id: 'path-reveal', label: '前向路径', emphasis: 'path', targetIds: ['g-forward', 'unity-forward'] },
      { id: 'loop-reveal', label: '反馈环路', emphasis: 'loop', targetIds: ['h-feedback', 'unity-forward'] },
      { id: 'formula-reveal', label: 'Mason 公式', emphasis: 'formula', targetIds: ['g-forward', 'h-feedback'] },
    ],
    masonTerms: [
      { id: 'delta-term', latex: '\\\\Delta=1+G(s)H(s)', relatedIds: ['forward-path-1', 'feedback-loop-1'] },
    ],
  };
}

function annotatedMediaPayloadFixture(): Record<string, unknown> {
  return {
    mediaId: 'closed-loop-media',
    activeRevealState: 'evidence-reveal',
    media: {
      src: '/assets/lesson-05/structure-intro.svg',
      alt: '闭环控制结构证据图',
    },
    annotations: [
      {
        id: 'input-hotspot',
        region: { x: 0.08, y: 0.36, width: 0.18, height: 0.16 },
        label: '输入信号',
        body: '系统外部给定量。',
        evidenceRole: 'input',
        revealStepIds: ['evidence-reveal'],
        required: true,
      },
      {
        id: 'output-hotspot',
        region: { x: 0.72, y: 0.36, width: 0.18, height: 0.16 },
        label: '输出响应',
        body: '系统被控结果。',
        evidenceRole: 'output',
        revealStepIds: ['evidence-reveal'],
        required: true,
      },
      {
        id: 'risk-hotspot',
        region: { x: 0.48, y: 0.62, width: 0.2, height: 0.18 },
        label: '反馈风险',
        body: '反馈符号或测量环节可能引入误判。',
        evidenceRole: 'risk',
        revealStepIds: ['diagnostic-reveal'],
        required: true,
      },
    ],
    interactions: {
      selectableAnnotations: ['input-hotspot', 'output-hotspot', 'risk-hotspot'],
      requireEvidenceSelection: true,
    },
    revealPlan: [
      { id: 'evidence-reveal', label: '证据热点', annotationIds: ['input-hotspot', 'output-hotspot'] },
      { id: 'diagnostic-reveal', label: '风险热点', annotationIds: ['risk-hotspot'] },
    ],
  };
}

function embeddedActivityPayloadFixture(): Record<string, unknown> {
  return {
    activityId: 'media-choice',
    anchorId: 'media-choice-anchor',
    visualModuleId: 'annotated-media',
    responseContractId: 'choice.single',
    prompt: '哪一个热点最能说明输出证据？',
    position: { x: 0.62, y: 0.32 },
    answerOptions: [
      { id: 'input-hotspot', label: '输入信号' },
      { id: 'output-hotspot', label: '输出响应' },
      { id: 'risk-hotspot', label: '反馈风险' },
    ],
  };
}

function activityCardFixture({
  id,
  responseKind,
}: {
  id: string;
  responseKind: string;
}): NonNullable<InteractiveRuntimeManifest['steps'][number]['interactionSpec']['activityCards']>[number] {
  return {
    id,
    prompt: 'Fixture prompt',
    responseKind,
    submitScope: 'step',
    layoutSpan: 'full',
    options: [],
  };
}

function controlAnalysisRequestFixture(): Record<string, unknown> {
  return {
    runtimeMode: 'analysis',
    caseId: 'fixture-control-workbench',
    plant: {
      numerator: [1],
      denominator: [1, 2, 1],
      coefficientOrder: 'descending',
      label: 'G(s)',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: 1 },
        label: 'K',
      },
    ],
    outputs: ['step_response', 'bode', 'root_locus', 'nyquist'],
    responseType: 'step',
    timeRange: { start: 0, end: 10, samples: 64 },
    frequencyRange: { min: 0.1, max: 10, samples: 64 },
    rootLocus: { minGain: 0, maxGain: 10, samples: 64, currentGain: 1 },
  };
}

function controlAnalysisResultFixture(): Record<string, unknown> {
  const line = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  return {
    metrics: {
      overshootPct: 0,
      riseTimeSec: 1,
      settlingTimeSec: 2,
      peakTimeSec: 1,
      finalValue: 1,
      phaseMarginDeg: 45,
      gainMarginDb: 12,
      gainCrossoverRadPerSec: 1,
      phaseCrossoverRadPerSec: 2,
      bandwidthRadPerSec: 3,
    },
    stepResponse: { points: line },
    magnitude: { points: line },
    phase: { points: line },
    nyquist: { points: [{ re: 0, im: 0 }, { re: 1, im: -1 }] },
    rootLocus: {
      branches: [[{ re: -1, im: 0 }, { re: -2, im: 0 }]],
      currentPoles: [{ re: -1, im: 0 }],
      openLoopPoles: [{ re: -1, im: 0 }],
      openLoopZeros: [],
    },
    isFallback: true,
  };
}

function collectSourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result.sort();
}

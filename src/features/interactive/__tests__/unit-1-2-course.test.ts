import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY } from '@/features/interactive/course-submission-gate-inventory';
import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { buildSharedControlWorkbenchEvidenceDraft } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { buildManifestSubmissionTelemetry } from '@/features/interactive/shared/manifest-runtime/submission-telemetry';
import { UNIT_1_2StepContentPanel } from '@/features/interactive/unit-1-2-modeling-from-object-to-system/step-panels';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveCourseEvidenceSpec } from '@/lib/data-governance/course-evidence-specs';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  UNIT_1_2_COURSE_TITLE,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_PRESET_KEY,
  UNIT_1_2_RESOURCE_KEY,
  UNIT_1_2_ROUTE_SEGMENT,
  buildUNIT_1_2ParameterSnapshots,
} from '@/lib/unit-1-2-course';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/1-2/interactive-manifest.json');

function readManifest() {
  const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!manifest) throw new Error('1-2 interactive manifest is invalid');
  return manifest;
}

function readAuthoringContract() {
  return JSON.parse(
    readFileSync(join(repoRoot, 'course-content/authoring/lessons/1-2/design/1-2-interactive-contract.yaml'), 'utf8'),
  ) as {
    steps: Record<string, {
      telemetry_spec?: { result_policy?: string };
      visual_state_contract?: unknown;
      release_contract?: unknown;
      interaction_spec?: { submit_fields?: string[] };
    }>;
  };
}

function responseProducingStepIds() {
  const manifest = readManifest();
  return manifest.steps
    .filter((step) =>
      (step.interactionSpec.activityCards ?? []).length > 0
      || (step.interactionSpec.submitFields ?? []).length > 0
      || step.interactionSpec.interactionKind === 'interactive_figure_submit'
    )
    .map((step) => step.id);
}

function renderUnit12StepHtml(stepIndex: number) {
  const manifest = readManifest();
  return renderToStaticMarkup(
    createElement(ThemeProvider, null,
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[stepIndex],
        manifest,
      }),
    ),
  );
}

function renderedHtmlWithoutEngineeringTerms() {
  return [3, 4, 5, 6, 7, 8, 9, 10, 11, 13]
    .map(renderUnit12StepHtml)
    .join('\n');
}

describe('unit 1-2 modeling from object to system course', () => {
  it('defines the public route, preset, resource key and 14-step flow', () => {
    expect(UNIT_1_2_ROUTE_SEGMENT).toBe('unit-1-2-modeling-from-object-to-system');
    expect(UNIT_1_2_PRESET_KEY).toBe('unit-1-2-modeling-from-object-to-system-v1');
    expect(UNIT_1_2_RESOURCE_KEY).toBe('unit-1-2-modeling-from-object-to-system');
    expect(UNIT_1_2_COURSE_TITLE).toBe('1-2：建模——从真实对象到可分析的系统');
    expect(UNIT_1_2_LESSON_STEPS).toHaveLength(14);
    expect(UNIT_1_2_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_1_2_LESSON_STEPS.at(-1)?.id).toBe('step-14');
  });

  it('normalizes the current runtime manifest to the new mainline route and response contract', () => {
    const manifest = readManifest();
    const authoringContract = readAuthoringContract();

    expect(manifest.lessonId).toBe('1-2');
    expect(manifest.courseRouteSegment).toBe(UNIT_1_2_ROUTE_SEGMENT);
    expect(manifest.steps.map((step) => step.id)).toEqual(UNIT_1_2_LESSON_STEPS.map((step) => step.id));
    expect(responseProducingStepIds()).toEqual([
      'step-03',
      'step-06',
      'step-07',
      'step-08',
      'step-10',
      'step-11',
      'step-12',
      'step-13',
    ]);
    for (const stepId of responseProducingStepIds()) {
      expect(authoringContract.steps[stepId]?.telemetry_spec?.result_policy).not.toBe('no_submission');
    }
    expect(authoringContract.steps['step-05']?.telemetry_spec?.result_policy).toBe('no_submission');
    expect(authoringContract.steps['step-07']?.release_contract).toBeDefined();
  });

  it('registers the new 1-2 course across catalog, presets, AI context and route identity', () => {
    const premiumIds = PREMIUM_LESSONS.map((lesson) => lesson.id);
    const featuredIds = FEATURED_LESSONS.map((lesson) => lesson.id);
    const module1 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-1');

    expect(premiumIds).toContain(UNIT_1_2_RESOURCE_KEY);
    expect(featuredIds).toContain(UNIT_1_2_RESOURCE_KEY);
    expect(module1?.lessons.map((lesson) => lesson.id)).toContain(UNIT_1_2_RESOURCE_KEY);
    expect(ALL_PRESETS.some((preset) => preset.key === UNIT_1_2_PRESET_KEY)).toBe(true);
    expect(COURSE_AI_CONTEXT_REGISTRY[UNIT_1_2_PRESET_KEY]).toBeDefined();
    expect(getStepQuickQuestions(UNIT_1_2_PRESET_KEY, 'step-10')).toHaveLength(2);
    expect(resolveSessionRouteFromPlanTitle(UNIT_1_2_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_1_2_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(existsSync(join(repoRoot, `src/app/interactive-learning/courses/${UNIT_1_2_ROUTE_SEGMENT}/page.tsx`))).toBe(true);
    expect(existsSync(join(repoRoot, `src/app/interactive-learning/courses/${UNIT_1_2_ROUTE_SEGMENT}/student/[sessionId]/page.tsx`))).toBe(true);
    expect(existsSync(join(repoRoot, `src/app/interactive-learning/courses/${UNIT_1_2_ROUTE_SEGMENT}/teacher/[sessionId]/page.tsx`))).toBe(true);
  });

  it('keeps the retired block-diagram 1-2 course unresolved', () => {
    expect(resolveSessionRouteFromPlanTitle('1-2：系统结构图与化简——从积木块到系统蓝图')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-2-block-diagram-simplification-v1')).toBe(false);
    expect(PREMIUM_LESSONS.map((lesson) => lesson.id)).not.toContain('unit-1-2-block-diagram-simplification');
  });

  it('renders step 09 through the shared static-surface-3d compute capability with fallback media', () => {
    const manifest = readManifest();
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        createElement(UNIT_1_2StepContentPanel, {
          step: UNIT_1_2_LESSON_STEPS[8],
          manifest,
        }),
      ),
    );

    expect(html).toContain('data-static-surface-3d-panel="magnitude-surface"');
    expect(html).toContain('俯视极点');
    expect(html).toContain('1-2-fig-08-magnitude-surface.png');
    expect(html).toContain('船舶传递函数极点幅值曲面的静态图');
  });

  it('keeps step 09 surface data dense enough for MATLAB-like visual reading', () => {
    const surfaceData = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/1-2/media/generated-data/pole-magnitude-surface.json'),
        'utf8',
      ),
    ) as {
      regularGrid: { x: number[]; y: number[]; values: number[][] };
      markers: Array<{ label: string; position: number[] }>;
    };

    expect(surfaceData.regularGrid.x).toHaveLength(49);
    expect(surfaceData.regularGrid.y).toHaveLength(49);
    expect(surfaceData.regularGrid.x[0]).toBe(-4);
    expect(surfaceData.regularGrid.x.at(-1)).toBe(2);
    expect(surfaceData.regularGrid.y[0]).toBe(-3);
    expect(surfaceData.regularGrid.y.at(-1)).toBe(3);
    expect(surfaceData.regularGrid.x[1] - surfaceData.regularGrid.x[0]).toBeCloseTo(0.125, 6);
    expect(surfaceData.regularGrid.y[1] - surfaceData.regularGrid.y[0]).toBeCloseTo(0.125, 6);
    expect(surfaceData.regularGrid.values).toHaveLength(surfaceData.regularGrid.y.length);
    expect(surfaceData.regularGrid.values[0]).toHaveLength(surfaceData.regularGrid.x.length);
    const originMarker = surfaceData.markers.find((marker) => marker.label === 's=0');
    const dampingMarker = surfaceData.markers.find((marker) => marker.label === 's=-B/J');
    expect(originMarker?.position).toEqual([0, 0, 2.15]);
    expect(dampingMarker?.position.slice(0, 2)).toEqual([-2, 0]);
    expect(dampingMarker?.position[2]).toBe(2.15);
  });

  it('renders the modeling-path comparison through the shared visual stage contract', () => {
    const manifest = readManifest();
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    if (!step04) throw new Error('step-04 missing');
    const html = renderUnit12StepHtml(3);
    const stagePayload = step04.modules.find((module) => module.id === 'modeling-path-stage')?.payload as {
      layers?: Array<{ id: string; title: string; body: string; appearance?: string }>;
      connections?: Array<{ id: string; from: string; to: string }>;
    };

    expect(step04.modules.map((module) => module.id)).not.toContain('course-positioning');
    expect(step04.modules.map((module) => module.kind)).toContain('visual.stage');
    expect(stagePayload.layers?.map((layer) => layer.id)).toEqual([
      'real-object',
      'physical-law',
      'differential-equation',
      'transfer-function',
      'input-output-data',
      'algorithm-learning',
      'prediction-model',
      'mechanism-boundary',
      'data-boundary',
      'modeling-goal',
    ]);
    expect(stagePayload.layers?.filter((layer) => layer.appearance === 'flowNode').map((layer) => layer.title)).toEqual([
      '真实对象',
      '物理定律',
      '微分方程',
      '传递函数',
      '输入输出数据',
      '算法学习',
      '预测模型',
    ]);
    expect(stagePayload.connections?.map((connection) => connection.id)).toEqual([
      'object-to-law',
      'law-to-equation',
      'equation-to-transfer-function',
      'object-to-data',
      'data-to-learning',
      'learning-to-prediction',
    ]);
    expect(JSON.stringify(stagePayload)).toContain('机理建模');
    expect(JSON.stringify(stagePayload)).toContain('数据驱动建模');
    expect(JSON.stringify(stagePayload)).not.toContain('本课以机理建模为主线');
    expect(html).toContain('data-visual-stage-id="modeling-paths"');
    expect(html).toContain('data-visual-stage-panel-chrome="title-panel"');
    expect(html).toContain('data-visual-stage-canvas-chrome="none"');
    expect(html).toContain('data-visual-stage-layer-kind-labels="hidden"');
    expect(html).toContain('data-visual-stage-layer-selected="false"');
    expect(html).toContain('data-visual-stage-layer-id="physical-law"');
    expect(html).toContain('data-visual-stage-layer-id="input-output-data"');
    expect(html).toContain('data-visual-stage-connection-id="object-to-law"');
    expect(html).toContain('data-visual-stage-connection-id="object-to-data"');
    expect(html).not.toContain('data-visual-stage-layer-summary');
    expect(html).not.toContain('data-visual-stage-layer-id="course-position"');
    expect(html).not.toContain('>关系图<');
    expect(html).not.toContain('>标注<');
    expect(html).not.toContain('rounded-2xl border border-[var(--platform-border)]');
    expect(html).not.toContain('course-positioning');
    expect(html).not.toContain('svg-comparison');
  });

  it('keeps the new visual component contracts complete for steps 05, 07, 08, 12 and 14', () => {
    const manifest = readManifest();
    const contract = readAuthoringContract();
    for (const stepId of ['step-04', 'step-05', 'step-07', 'step-08', 'step-11', 'step-12', 'step-14']) {
      expect(contract.steps[stepId]?.visual_state_contract).toBeDefined();
    }

    const step05 = manifest.steps.find((step) => step.id === 'step-05');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');
    const step08 = manifest.steps.find((step) => step.id === 'step-08');
    const step12 = manifest.steps.find((step) => step.id === 'step-12');
    const step14 = manifest.steps.find((step) => step.id === 'step-14');
    if (!step05 || !step07 || !step08 || !step12 || !step14) throw new Error('missing visual contract step');

    const step05Stage = step05.modules.find((module) => module.id === 'ship-equation-stage')?.payload as {
      revealSteps?: unknown[];
      formulas?: unknown[];
      connectors?: Array<{
        id?: string;
        from?: string;
        to?: string;
        fromAnchor?: string;
        toAnchor?: string;
        revealStepIds?: string[];
      }>;
    };
    expect(step05Stage.revealSteps).toHaveLength(5);
    expect(step05Stage.connectors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'object-to-equation',
        from: 'physical-object',
        to: 'inertia-term',
        fromAnchor: 'E',
        toAnchor: 'W',
      }),
      expect.objectContaining({
        id: 'equation-to-homogeneous',
        from: 'damping-term',
        to: 'characteristic-equation',
        fromAnchor: 'S',
        toAnchor: 'N',
      }),
      expect.objectContaining({
        id: 'homogeneous-to-complete',
        from: 'theta-h',
        to: 'theta-complete',
        fromAnchor: 'S',
        toAnchor: 'NW',
        revealStepIds: ['complete-response'],
      }),
      expect.objectContaining({
        id: 'particular-to-complete',
        from: 'theta-p',
        to: 'theta-complete',
        fromAnchor: 'S',
        toAnchor: 'N',
        revealStepIds: ['complete-response'],
      }),
    ]));
    expect(step05.modules.map((module) => module.id)).toEqual(expect.arrayContaining([
      'ship-physics-img',
      'direct-response-img',
      'four-inconveniences',
    ]));

    const step07Diagram = step07.modules.find((module) => module.id === 'closed-loop-structure')?.payload as {
      nodes?: unknown[];
      edges?: unknown[];
    };
    expect(step07.interactionSpec.interactionKind).toBe('structured_compare');
    expect(step07.interactionSpec.activityCards?.[0]?.structuredFields).toEqual([
      'selected_feedback_branch',
      'error_node',
      'reason',
    ]);
    expect(step07Diagram.nodes?.length).toBeGreaterThanOrEqual(7);
    expect(step07Diagram.edges?.length).toBeGreaterThanOrEqual(7);
    expect(step07.modules.map((module) => module.id)).toEqual(expect.arrayContaining(['five-elements', 'three-connections']));

    const step08Graph = step08.modules.find((module) => module.id === 'signal-flow-graph')?.payload as {
      branches?: unknown[];
      pathSets?: unknown[];
      masonTerms?: unknown[];
      revealPlan?: Array<{ id: string }>;
      nodes?: Array<{ id: string; labelPosition?: string }>;
      showPathSets?: boolean;
      showMasonMap?: boolean;
    };
    expect(step08Graph.branches?.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(step08Graph.pathSets)).toContain('forward');
    expect(step08Graph.masonTerms ?? []).toEqual([]);
    expect(step08Graph.showPathSets).toBe(false);
    expect(step08Graph.showMasonMap).toBe(false);
    expect(step08Graph.revealPlan?.map((item) => item.id)).toEqual(['nodes', 'branches']);
    expect(step08Graph.nodes?.filter((node) => node.labelPosition === 'above').map((node) => node.id)).toEqual(['E', 'Y']);
    expect(step08.contentBlocks['sfg-concepts']).toBeDefined();

    const step12Stage = step12.modules.find((module) => module.id === 'example-derivation-stage')?.payload as {
      revealSteps?: Array<{ id: string }>;
      formulas?: unknown[];
    };
    expect(step12Stage.revealSteps?.map((item) => item.id)).toEqual(expect.arrayContaining([
      'problem',
      'characteristic',
      'solve-roots',
      's-plane',
      'behavior',
    ]));
    expect(JSON.stringify(step12Stage.formulas)).toContain('s^2+2s+5=0');

    const step14Stage = step14.modules.find((module) => module.id === 'modeling-summary-stage')?.payload as {
      layers?: Array<{ id: string }>;
    };
    expect(step14.modules.map((module) => module.id)).toEqual(expect.arrayContaining([
      'info-graphic',
      'modeling-summary-stage',
      'limitations-text',
      'extend-think-text',
      'lesson-stat-summary',
    ]));
    expect(step14Stage.layers?.map((layer) => layer.id)).toEqual(expect.arrayContaining([
      'object',
      'differential-equation',
      'transfer-function',
      'structure-expression',
      'poles-plane',
      'behavior',
    ]));
  });

  it('renders step 05 derivation, figures and cards with teaching semantics and title-panel chrome', () => {
    const html = renderUnit12StepHtml(4);

    expect(html).toContain('微分方程如何给出一次具体响应');
    expect(html).toContain('从舵角产生力矩，到航向角响应，逐步看直接求解的成本。');
    expect(html).toContain('data-derivation-stage-panel-chrome="title-panel"');
    expect(html).toContain('data-derivation-stage-canvas-chrome="none"');
    expect(html).toContain('data-derivation-stage-connector-from-anchor="E"');
    expect(html).toContain('data-derivation-stage-connector-to-anchor="W"');
    expect(html).toContain('data-image-panel-frame="none"');
    expect(html).toContain('katex');
    expect(html).not.toContain('船舶航向微分方程推导舞台');
    expect(html).not.toContain('按显影步骤观察公式、说明和关联线');
    expect(html).not.toContain('rounded-2xl border border-[var(--platform-border)]');
  });

  it('does not render activity manifest modules as duplicate content title blocks', () => {
    for (const stepIndex of [2, 5, 7, 10, 11, 12]) {
      const html = renderUnit12StepHtml(stepIndex);
      expect(html).not.toContain('data-manifest-activity-module');
      expect(html).not.toContain('互动任务');
    }
  });

  it('blocks internal image-frame names from leaking into rendered 1-2 pages', () => {
    const manifest = readManifest();
    const forbiddenVisibleNames = [
      'svg-comparison',
      'ship-physics-img',
      'transform-chain-img',
      'closed-loop-fig',
      'connections-fig',
      'sfg-block-compare',
      's-plane-static',
      'info-graphic',
    ];

    for (const step of manifest.steps) {
      for (const runtimeModule of step.modules.filter((item) => item.kind === 'content.figure')) {
        const title = runtimeModule.payload.title;
        expect(typeof title === 'string' ? forbiddenVisibleNames.includes(title) : false).toBe(false);
      }
    }

    const renderedHtml = [3, 4, 5, 6, 7, 9, 13].map(renderUnit12StepHtml).join('\n');
    for (const name of forbiddenVisibleNames) {
      expect(renderedHtml).not.toContain(`>${name}<`);
      expect(renderedHtml).not.toContain(`alt="${name}"`);
    }
  });

  it('renders the step 06 transform table formulas with LaTeX and keeps the step 08 image compact', () => {
    const manifest = readManifest();
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step08 = manifest.steps.find((step) => step.id === 'step-08');
    if (!step06 || !step08) throw new Error('step-06 or step-08 missing');
    const laplaceRows = step06.contentBlocks['laplace-rules'] as { rows: string[][] };
    const signalFlowModule = step08.modules.find((module) => module.id === 'signal-flow-graph');

    for (const row of laplaceRows.rows) {
      expect(row[0]).toContain('$');
      expect(row[1]).toContain('$');
    }
    expect(signalFlowModule?.kind).toBe('visual.signalFlowGraph');
    const signalFlowHtml = renderUnit12StepHtml(7);
    expect(signalFlowHtml).toContain('data-structure-diagram-id="closed-loop-signal-flow"');
    expect(signalFlowHtml).toContain('premium-lesson-panel interactive-courseware-panel grid gap-4');
    expect(signalFlowHtml).toContain('data-structure-diagram-layout-mode="relative"');
    expect(signalFlowHtml).toContain('data-structure-diagram-text-scale="uniform"');
    expect(signalFlowHtml).toContain('data-structure-diagram-path-sets-enabled="false"');
    expect(signalFlowHtml).toContain('data-structure-diagram-mason-map-enabled="false"');
    expect(signalFlowHtml).toContain('data-structure-diagram-canvas-vertical-fit="content-trimmed"');
    expect(signalFlowHtml).toContain('data-structure-diagram-y-target-span="0.7"');
    expect(signalFlowHtml).toContain('min-h-[300px]');
    expect(signalFlowHtml).toContain('md:h-[340px]');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-route-kind="straight"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-route-kind="auto-bezier"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-mode-label="visual"');
    expect(signalFlowHtml).not.toContain('梅森公式');
    expect(signalFlowHtml).not.toContain('Mason');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-mason-map="visible"');
    expect(signalFlowHtml).toContain('data-structure-diagram-keyword-toolbar="visible"');
    expect(signalFlowHtml).toContain('data-structure-diagram-keyword-id="nodes"');
    expect(signalFlowHtml).toContain('data-structure-diagram-keyword-id="branches"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-keyword-id="forward-path"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-keyword-id="feedback-loop"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-path-sets="visible"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-path-id="P1"');
    expect(signalFlowHtml).not.toContain('data-structure-diagram-loop-id="L1"');
    expect(signalFlowHtml).toContain('rounded-full border px-3 py-1.5 text-sm font-semibold');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-visual-kind="signal-node"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-label-position="below"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-id="E"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-id="Y"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-label-position="above"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-anchors="N NE E SE S SW W NW C"');
    expect(signalFlowHtml).toContain('data-structure-diagram-node-dot="R"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-id="b-r-e"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-from-port="right"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-to-port="left"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-id="b-ym-e"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-from-port="top-left"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-to-port="bottom-right"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-hit-target="b-ym-e"');
    expect(signalFlowHtml).toContain('data-structure-diagram-branch-keyboard-selectable="true"');
  });

  it('renders step 12 as a nonlinear derivation stage instead of a blank reveal module', () => {
    const html = renderUnit12StepHtml(11);

    expect(html).toContain('data-derivation-stage-id="characteristic-equation-worked-example"');
    expect(html).toContain('特征方程');
    expect(html).toContain('data-derivation-stage-reveal-step-id="characteristic"');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders step 07 with standard control block-diagram symbols', () => {
    const manifest = readManifest();
    const blockModule = manifest.steps[6].modules.find((module) => module.kind === 'visual.blockDiagram');
    const blockNodes = (blockModule?.payload?.nodes ?? []) as Array<Record<string, unknown>>;
    const controllerNode = blockNodes.find((node) => node.id === 'controller');
    const takeoffNode = blockNodes.find((node) => node.id === 'output-takeoff');
    const outputNode = blockNodes.find((node) => node.id === 'output');
    const html = renderUnit12StepHtml(6);

    expect(controllerNode?.distance).toBe(0.9);
    expect(takeoffNode?.display).toBe('takeoff');
    expect(takeoffNode).not.toHaveProperty('distance');
    expect(outputNode?.display).toBe('anchor');
    expect(html).toContain('data-structure-diagram-id="closed-loop-block-diagram"');
    expect(html).toContain('data-structure-diagram-layout-mode="relative"');
    expect(html).toContain('data-structure-diagram-layout-spacing-x="0.15"');
    expect(html).toContain('data-structure-diagram-layout-spacing-y="0.15"');
    expect(html).toContain('data-structure-diagram-canvas-vertical-fit="content-trimmed"');
    expect(html).toContain('data-structure-diagram-y-target-span="0.66"');
    expect(html).toContain('min-h-[300px]');
    expect(html).toContain('md:h-[340px]');
    expect(html).toContain('data-structure-diagram-text-scale="uniform"');
    expect(html).toContain('data-structure-diagram-node-anchors="N E S W"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="input"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="output"');
    expect(html).toContain('data-structure-diagram-node-id="output-takeoff"');
    expect(html).toContain('data-structure-diagram-node-visual-kind="takeoff"');
    expect(html).toContain('data-structure-diagram-node-selected="false"');
    expect(html).toContain('data-structure-diagram-node-symbol-size="takeoff-dot"');
    expect(html).toContain('data-structure-diagram-node-rendered-height="0.12352941176470589"');
    expect(html).toContain('data-structure-diagram-edge-id="sensor-to-sum"');
    expect(html).toContain('data-structure-diagram-edge-label-id="sensor-to-sum"');
    expect(html).toContain('data-structure-diagram-edge-label-placement="source-left"');
    expect(html).toContain('data-structure-diagram-edge-hit-target="sensor-to-sum"');
    expect(html).toContain('data-structure-diagram-edge-main-line="true"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain('data-structure-diagram-terminal-sign-id="sensor-to-sum"');
    expect(html).toContain('data-structure-diagram-terminal-sign="−"');
    expect(html).not.toContain('data-structure-diagram-edge-id="sensor-to-measure"');
    expect(html).not.toContain('data-structure-diagram-edge-id="measure-to-sum"');
    expect(html).toContain('data-structure-diagram-edge-id="sum-to-controller"');
    expect(html).toContain('data-structure-diagram-edge-id="plant-to-output"');
    expect(html).toContain('data-structure-diagram-edge-label-id="r-to-sum"');
    expect(html).toContain('data-structure-diagram-edge-label-id="plant-to-output"');
    expect(html).not.toContain('data-structure-diagram-edge-label-id="output-to-sensor"');
    expect(html).not.toContain('data-structure-diagram-edge-id="sum-to-error"');
    expect(html).not.toContain('data-structure-diagram-edge-id="error-to-controller"');
    expect(html).not.toContain('data-structure-diagram-edge-id="takeoff-to-output"');
    expect(html).not.toContain('data-structure-diagram-submit="closed-loop-block-diagram"');
    expect(html).toContain('data-structure-diagram-edge-from-port="right"');
    expect(html).toContain('data-structure-diagram-edge-to-port="bottom"');
    expect(html).toContain('data-structure-diagram-edge-route="-|"');
    expect(html).toContain('data-structure-diagram-edge-waypoint-count="1"');
    expect(html).toContain('data-structure-diagram-edge-keyboard-selectable="true"');
    expect(html).not.toContain('data-structure-diagram-node-symbol-size="small-dot"');
    expect(html).toContain('data-structure-diagram-summing-junction="cross"');
    expect(html).toContain('data-structure-diagram-node-label-rendering="latex"');
    expect(html).toContain('G_c');
    expect(html).toContain('G_a');
    expect(html).toContain('G_p');
    expect(html).toContain('H');
    expect(html).toContain('E(s)');
    expect(html).toContain('R(s)-Y_m(s)=E(s)');
    expect(html).toContain('U_c(s)');
    expect(html).toContain('Y_m(s)');

    const edgeLabelFragments = html.match(/data-structure-diagram-edge-label-id="[^"]+"[\s\S]*?(?=<\/div>)/g) ?? [];
    expect(edgeLabelFragments.some((fragment) => fragment.includes('R(s)'))).toBe(true);
    expect(edgeLabelFragments.some((fragment) => fragment.includes('Y(s)'))).toBe(true);
    const outputNodeFragment = html.match(/data-structure-diagram-node-id="output"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(outputNodeFragment).toContain('Y(s)');
    expect(outputNodeFragment).toContain('sr-only');
    expect(outputNodeFragment).not.toContain('data-structure-diagram-output-label-position="above-line"');
    const takeoffNodeFragment = html.match(/data-structure-diagram-node-id="output-takeoff"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(takeoffNodeFragment).not.toContain('Y(s)');
  });

  it('keeps visual component chrome instructional and hides contract identifiers on steps 05, 07, 08, and 12', () => {
    const rendered = [4, 6, 7, 11].map(renderUnit12StepHtml).join('\n');
    const step08Html = renderUnit12StepHtml(7);

    expect(rendered).toContain('data-derivation-stage-control-button="next"');
    expect(rendered).toContain('data-derivation-stage-control-button="previous"');
    expect(step08Html).not.toContain('data-structure-diagram-mode-label="visual"');
    expect(step08Html).toContain('data-structure-diagram-keyword-toolbar="visible"');
    for (const forbidden of [
      'LaTeX 公式',
      '公式块',
      '高亮项',
      '>diagnose<',
      '>forward-path<',
      '>feedback-loop<',
      '>error-node<',
      '>output-node<',
      '>none<',
      '>problem<',
      '>solve-roots<',
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it('renders steps 10 and 11 through shared control workbench capabilities instead of static screenshots', () => {
    const manifest = readManifest();
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    if (!step10 || !step11) throw new Error('step-10 or step-11 missing');
    const lockedStep10Html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        createElement(UNIT_1_2StepContentPanel, {
          step: UNIT_1_2_LESSON_STEPS[9],
          manifest,
        }),
      ),
    );
    const releasedStep10Html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        createElement(UNIT_1_2StepContentPanel, {
          step: UNIT_1_2_LESSON_STEPS[9],
          manifest,
          onPanelSubmit: () => undefined,
        }),
      ),
    );
    const lockedStep11Html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        createElement(UNIT_1_2StepContentPanel, {
          step: UNIT_1_2_LESSON_STEPS[10],
          manifest,
        }),
      ),
    );
    const releasedStep11Html = renderToStaticMarkup(
      createElement(ThemeProvider, null,
        createElement(UNIT_1_2StepContentPanel, {
          step: UNIT_1_2_LESSON_STEPS[10],
          manifest,
          onPanelSubmit: () => undefined,
        }),
      ),
    );

    expect(lockedStep10Html).toContain('data-control-workbench-capability="control-root-locus-design-map"');
    expect(lockedStep10Html).toContain('data-control-workbench-module-id="drag-pole-panel"');
    expect(lockedStep10Html).toContain('data-control-workbench-panel="root-locus"');
    expect(lockedStep10Html).toContain('复平面五区地名');
    expect(lockedStep10Html).toContain('读图规则');
    expect(lockedStep10Html).toContain('σ（实部）');
    expect(lockedStep10Html).toContain('ω（虚部）');
    expect(step10.modules.find((module) => module.id === 's-plane-static')?.kind).toBe('content.figure');
    expect(step10.modules.find((module) => module.id === 'response-static')?.kind).toBe('content.figure');
    expect(releasedStep10Html).toContain('提交当前观察');
    expect(lockedStep11Html).toContain('data-control-workbench-capability="control-linked-comparison"');
    expect(lockedStep11Html).toContain('data-control-workbench-module-id="ship-simulation"');
    expect(lockedStep11Html).toContain('data-annotated-media-id="three-ships-response-evidence"');
    expect(lockedStep11Html).toContain('三艘船极点对比');
    expect(lockedStep11Html).toContain('对比对象');
    expect(lockedStep11Html).toContain('B 的近虚轴极点');
    const annotations = (step11.modules.find((module) => module.id === 'ship-response-hotspots')?.payload as {
      annotations?: unknown[];
    }).annotations;
    expect(annotations).toHaveLength(4);
    expect(`${lockedStep10Html}\n${lockedStep11Html}`).not.toContain('data-interactive-figure-panel');
    expect(releasedStep11Html).toContain('提交当前观察');
  });

  it('builds real shared control workbench submission payloads for step 10 and 11', () => {
    const manifest = readManifest();
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    const step10Module = step10?.modules.find((module) => module.id === 'drag-pole-panel');
    const step11Module = step11?.modules.find((module) => module.id === 'ship-simulation');
    if (!step10 || !step11 || !step10Module || !step11Module) throw new Error('missing shared workbench module');

    const step10Draft = buildSharedControlWorkbenchEvidenceDraft({
      manifest,
      step: step10,
      module: step10Module,
      submittedAt: 1778550644900,
      submissionValues: {
        sigma: -1.2,
        omega: 2.4,
        pole_mode: '共轭极点',
        observation_text: '左半平面收敛，虚部越大摆动越密。',
      },
    });
    expect(step10Draft?.payload.parameterSnapshot).toMatchObject({
      sigma: -1.2,
      omega: 2.4,
      pole_mode: '共轭极点',
      observation_text: '[redacted]',
    });
    expect(step10Draft?.payload.parameterSnapshot).not.toHaveProperty('gain.k');

    const step10Snapshots = buildUNIT_1_2ParameterSnapshots({
      answers: { 'drag-pole-submit': JSON.stringify(step10Draft) },
      submitFields: step10.interactionSpec.submitFields ?? [],
    });
    expect(step10Snapshots).toEqual({
      sigma: -1.2,
      omega: 2.4,
      pole_mode: '共轭极点',
      observation_text: '[redacted]',
    });

    const step11Draft = buildSharedControlWorkbenchEvidenceDraft({
      manifest,
      step: step11,
      module: step11Module,
      submittedAt: 1778550644901,
      submissionValues: {
        selected_ship: 'B',
        time_scale: 3,
        simulation_interaction_count: 4,
      },
    });
    expect(step11Draft?.payload.parameterSnapshot).toEqual({
      selected_ship: 'B',
      time_scale: 3,
      simulation_interaction_count: 4,
    });
    expect(step11Draft?.payload.parameterSnapshot).not.toHaveProperty('gain.k');
  });

  it('records step 10 pole parameters as data-governance parameter snapshots', () => {
    const manifest = readManifest();
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    if (!step10) throw new Error('step-10 missing');
    const answers = {
      'drag-pole-submit': JSON.stringify({
        sigma: '-1.20',
        omega: '2.40',
        observation_text: '左半平面收敛，虚部越大摆动越密。',
      }),
    };
    const parameterSnapshots = buildUNIT_1_2ParameterSnapshots({
      answers,
      submitFields: step10.interactionSpec.submitFields ?? [],
    });

    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-10',
        submittedAt: 1778550644900,
        answers,
      },
      step10,
      { extraEvidence: parameterSnapshots ? { parameterSnapshots } : undefined },
    );

    expect(parameterSnapshots).toEqual({
      sigma: '-1.20',
      omega: '2.40',
      observation_text: '左半平面收敛，虚部越大摆动越密。',
    });
    expect(telemetry).toMatchObject({
      interactionKind: 'interactive_figure_submit',
      parameterSnapshots,
    });
  });

  it('keeps the new 1-2 runtime mainline and removes engineering-language leakage from the course contract', () => {
    const lessonMap = JSON.parse(readFileSync(join(repoRoot, 'course-content/authoring/shared/lesson-id-map.json'), 'utf8')) as {
      entries: Array<{ canonical_id: string; status: string }>;
    };
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-1-2-modeling-from-object-to-system/student-page.tsx'),
      'utf8',
    );

    expect(lessonMap.entries.find((entry) => entry.canonical_id === '1-2')?.status).toBe('mainline');
    const renderedHtml = renderedHtmlWithoutEngineeringTerms();
    expect(renderedHtml).not.toContain('Rust');
    expect(renderedHtml).not.toContain('WASM');
    expect(renderedHtml).not.toContain('capabilityRef');
    expect(studentPageSource).toContain('onPanelSubmit={released ? handleSubmitResponse : undefined}');
    expect(studentPageSource).toContain("step.pageType === 'interactive_figure_submit' ? null");
  });

  it('records 1-2 in submission gates and data-governance evidence specs', () => {
    const gate = COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY.find((item) => item.lessonId === '1-2');
    const evidenceSpec = resolveCourseEvidenceSpec({ manifest: readManifest() });

    expect(gate).toMatchObject({
      lessonId: '1-2',
      routeSegment: UNIT_1_2_ROUTE_SEGMENT,
      minimumResponseSteps: 8,
    });
    expect(evidenceSpec).toMatchObject({
      status: 'supported',
      spec: {
        lessonId: '1-2',
        lessonKey: UNIT_1_2_PRESET_KEY,
        routeSegment: UNIT_1_2_ROUTE_SEGMENT,
        studentStateKind: 'unit12_student_state',
        teacherSyncKind: 'teacher_sync_unit12',
        preAssessmentStepId: 'step-03',
        postAssessmentStepId: 'step-13',
        summaryStepId: 'step-14',
      },
    });
  });
});

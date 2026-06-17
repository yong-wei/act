import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY } from '@/features/interactive/course-submission-gate-inventory';
import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
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
    createElement(UNIT_1_2StepContentPanel, {
      step: UNIT_1_2_LESSON_STEPS[stepIndex],
      manifest,
    }),
  );
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

    expect(manifest.lessonId).toBe('1-2');
    expect(manifest.courseRouteSegment).toBe(UNIT_1_2_ROUTE_SEGMENT);
    expect(manifest.steps.map((step) => step.id)).toEqual(UNIT_1_2_LESSON_STEPS.map((step) => step.id));
    expect(responseProducingStepIds()).toEqual([
      'step-03',
      'step-05',
      'step-06',
      'step-08',
      'step-10',
      'step-11',
      'step-12',
      'step-13',
    ]);
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
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[8],
        manifest,
      }),
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

  it('renders the modeling-path comparison as local page art and removes the course-positioning block', () => {
    const manifest = readManifest();
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    if (!step04) throw new Error('step-04 missing');
    const html = renderUnit12StepHtml(3);

    expect(step04.modules.map((module) => module.id)).not.toContain('course-positioning');
    expect(html).toContain('data-local-modeling-paths-figure="true"');
    expect(html).toContain('建模路径对照图');
    expect(html).not.toContain('course-positioning');
    expect(html).not.toContain('svg-comparison');
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
    const compareModule = step08.modules.find((module) => module.id === 'sfg-block-compare');

    for (const row of laplaceRows.rows) {
      expect(row[0]).toContain('$');
      expect(row[1]).toContain('$');
    }
    expect(compareModule?.payload.display_width).toBe('medium');
    expect(renderUnit12StepHtml(7)).toContain('max-w-[900px]');
  });

  it('renders step 12 reveal layers from content fields instead of leaving an empty required module', () => {
    const html = renderUnit12StepHtml(11);

    expect(html).toContain('求解过程');
    expect(html).toContain('特征方程');
    expect(html).toContain('s^2+2s+5=0');
    expect(html).not.toContain('data-manifest-render-error');
  });

  it('renders steps 10 and 11 as shared interactive figures instead of static screenshots', () => {
    const manifest = readManifest();
    const lockedStep10Html = renderToStaticMarkup(
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[9],
        manifest,
      }),
    );
    const releasedStep10Html = renderToStaticMarkup(
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[9],
        manifest,
        onPanelSubmit: () => undefined,
      }),
    );
    const lockedStep11Html = renderToStaticMarkup(
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[10],
        manifest,
      }),
    );
    const releasedStep11Html = renderToStaticMarkup(
      createElement(UNIT_1_2StepContentPanel, {
        step: UNIT_1_2_LESSON_STEPS[10],
        manifest,
        onPanelSubmit: () => undefined,
      }),
    );

    expect(lockedStep10Html).toContain('data-interactive-figure-panel="drag_pole_s_plane"');
    expect(lockedStep10Html).toContain('data-module-id="drag-pole-panel"');
    expect(lockedStep10Html).toContain('等待教师发放');
    expect(releasedStep10Html).toContain('提交当前参数');
    expect(lockedStep11Html).toContain('data-interactive-figure-panel="three_ships_case"');
    expect(lockedStep11Html).toContain('data-module-id="ship-simulation"');
    expect(lockedStep11Html).toContain('三艘船响应仿真');
    expect(lockedStep11Html).toContain('等待教师发放');
    expect(releasedStep11Html).toContain('记录比较');
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
    const authoringPage = readFileSync(join(repoRoot, 'course-content/authoring/lessons/1-2/design/1-2-interactive-page.md'), 'utf8');
    const authoringContract = readFileSync(join(repoRoot, 'course-content/authoring/lessons/1-2/design/1-2-interactive-contract.yaml'), 'utf8');
    const runtimeManifest = readFileSync(manifestPath, 'utf8');
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-1-2-modeling-from-object-to-system/student-page.tsx'),
      'utf8',
    );

    expect(lessonMap.entries.find((entry) => entry.canonical_id === '1-2')?.status).toBe('mainline');
    expect(`${authoringPage}\n${authoringContract}\n${runtimeManifest}`).not.toContain('Rust');
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

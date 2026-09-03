import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { UNIT_1_3StepContentPanel } from '@/features/interactive/unit-1-3-parameter-pole-migration/step-panels';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  UNIT_1_3_COURSE_TITLE,
  UNIT_1_3_LESSON_STEPS,
  UNIT_1_3_PRESET_KEY,
  UNIT_1_3_RESOURCE_KEY,
  UNIT_1_3_ROUTE_SEGMENT,
} from '@/lib/unit-1-3-course';

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/1-3/interactive-manifest.json');
const graphOverlayPath = join(repoRoot, 'course-content/runtime/lessons/1-3/graph-overlay.json');

function readManifest() {
  const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!manifest) throw new Error('1-3 interactive manifest is invalid');
  return manifest;
}

function renderStep(stepId: string) {
  const manifest = readManifest();
  const step = UNIT_1_3_LESSON_STEPS.find((item) => item.id === stepId);
  if (!step) throw new Error(`Unknown 1-3 step: ${stepId}`);
  return renderToStaticMarkup(
    createElement(ThemeProvider, null,
      createElement(UNIT_1_3StepContentPanel, { step, manifest }),
    ),
  );
}

describe('unit 1-3 parameter pole migration course', () => {
  it('exports the canonical route and complete 11-step runtime manifest', () => {
    const manifest = readManifest();

    expect(manifest.lessonId).toBe('1-3');
    expect(manifest.courseRouteSegment).toBe('unit-1-3-parameter-pole-migration');
    expect(manifest.steps.map((step) => step.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => `step-${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('uses shared native visual capabilities for the three technical evidence steps', () => {
    const manifest = readManifest();
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');

    expect(step04?.modules.map((module) => module.kind)).toContain('visual.blockDiagram');
    expect(step06?.modules.map((module) => module.kind)).toContain('compute.panel');
    expect(step07?.modules.map((module) => module.kind)).toContain('compute.panel');
    expect(step06?.modules.find((module) => module.kind === 'compute.panel')?.payload).toMatchObject({
      capabilityRef: 'control-linked-comparison',
    });
    expect(step07?.modules.find((module) => module.kind === 'compute.panel')?.payload).toMatchObject({
      capabilityRef: 'control-root-locus-design-map',
    });
  });

  it('binds every knowledge-card group to valid interactive steps', () => {
    const overlay = JSON.parse(readFileSync(graphOverlayPath, 'utf8')) as {
      groups: Array<{ step_ids?: string[]; node_ids: string[] }>;
    };
    const validStepIds = new Set(UNIT_1_3_LESSON_STEPS.map((step) => step.id));

    expect(overlay.groups.length).toBeGreaterThan(0);
    for (const group of overlay.groups) {
      expect(group.step_ids?.length).toBeGreaterThan(0);
      expect(group.step_ids?.every((stepId) => validStepIds.has(stepId))).toBe(true);
      expect(group.node_ids.length).toBeGreaterThan(0);
    }
  });

  it('registers the new course identity across catalog, presets, AI context and session routing', () => {
    const module1 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-1');

    expect(UNIT_1_3_ROUTE_SEGMENT).toBe('unit-1-3-parameter-pole-migration');
    expect(UNIT_1_3_PRESET_KEY).toBe('unit-1-3-parameter-pole-migration-v1');
    expect(UNIT_1_3_RESOURCE_KEY).toBe(UNIT_1_3_ROUTE_SEGMENT);
    expect(UNIT_1_3_COURSE_TITLE).toBe('1-3：参数变化与极点迁移');
    expect(UNIT_1_3_LESSON_STEPS).toHaveLength(11);
    expect(FEATURED_LESSONS.map((lesson) => lesson.id)).toContain(UNIT_1_3_RESOURCE_KEY);
    expect(PREMIUM_LESSONS.map((lesson) => lesson.id)).toContain(UNIT_1_3_RESOURCE_KEY);
    expect(module1?.lessons.map((lesson) => lesson.id)).toContain(UNIT_1_3_RESOURCE_KEY);
    expect(ALL_PRESETS.some((preset) => preset.key === UNIT_1_3_PRESET_KEY)).toBe(true);
    expect(COURSE_AI_CONTEXT_REGISTRY[UNIT_1_3_PRESET_KEY]).toBeDefined();
    expect(getStepQuickQuestions(UNIT_1_3_PRESET_KEY, 'step-07')).toHaveLength(2);
    expect(resolveSessionRouteFromPlanTitle(UNIT_1_3_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_1_3_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('does not keep the retired time-domain identity for lesson 1-3', () => {
    expect(FEATURED_LESSONS.map((lesson) => lesson.id)).not.toContain('unit-1-3-time-domain-response');
    expect(resolveSessionRouteFromPlanTitle('1-3：时域响应分析——从响应曲线到动态性能指标')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });
  });

  it('provides entry, teacher and student routes for the canonical identity', () => {
    const routeRoot = join(repoRoot, 'src/features/interactive/course-app-routes', UNIT_1_3_ROUTE_SEGMENT);

    expect(existsSync(join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'))).toBe(true);
    expect(existsSync(join(routeRoot, 'entry.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'teacher.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'waiting.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'student.tsx'))).toBe(false);
  });

  it('renders the block diagram and both shared control workbenches from the runtime manifest', () => {
    expect(renderStep('step-04')).toContain('data-structure-diagram-kind="visual.blockDiagram"');
    expect(renderStep('step-06')).toContain('data-control-workbench-capability="control-linked-comparison"');
    expect(renderStep('step-07')).toContain('data-control-workbench-capability="control-root-locus-design-map"');
  });
});

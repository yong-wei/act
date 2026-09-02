import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY } from '@/features/interactive/course-submission-gate-inventory';
import { STANDARD_MODULE_ENFORCED_LESSON_IDS } from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY } from '@/lib/course-ai-contexts';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import {
  appendUNIT_1_5ResponseHistory,
  buildUNIT_1_5StudentAnalyticsItems,
  buildUNIT_1_5SubmissionDataOverrides,
  buildUNIT_1_5TeacherAnalyticsItems,
  createEmptyUNIT_1_5StudentState,
  UNIT_1_5_COURSE_TITLE,
  UNIT_1_5_LESSON_STEPS,
  UNIT_1_5_PRESET_KEY,
  UNIT_1_5_ROUTE_SEGMENT,
} from '@/lib/unit-1-5-course';

const root = process.cwd();
const manifestPath = join(root, 'course-content/runtime/lessons/1-5/interactive-manifest.json');
const courseDir = join(root, 'src/features/interactive/unit-1-5-three-domain-gain-sweep');
const routeDir = join(root, 'src/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep');
const dispatcherDir = join(root, 'src/app/interactive-learning/courses/[routeSegment]');

function manifest() {
  const parsed = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!parsed) throw new Error('1-5 manifest invalid');
  return parsed;
}

describe('unit 1-5 three-domain gain sweep course', () => {
  it('ships the manifest-first course shell and all required routes', () => {
    for (const path of [
      'entry-page.tsx',
      'step-panels.tsx',
      'student-page.tsx',
      'teacher-page.tsx',
    ]) expect(existsSync(join(courseDir, path)), path).toBe(true);
    expect(existsSync(join(courseDir, 'course-header.tsx'))).toBe(false);

    expect(existsSync(join(root, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'))).toBe(true);
    expect(existsSync(join(routeDir, 'student.tsx'))).toBe(false);

    for (const path of [
      'page.tsx',
      'demo/page.tsx',
      'student/[sessionId]/page.tsx',
      'teacher/[sessionId]/page.tsx',
      'teacher/[sessionId]/waiting/page.tsx',
    ]) expect(existsSync(join(dispatcherDir, path)), path).toBe(true);
  });

  it('loads the reviewed 14-step runtime manifest without course-private content maps', () => {
    const runtime = manifest();
    expect(runtime.lessonId).toBe('1-5');
    expect(runtime.courseTitle).toBe(UNIT_1_5_COURSE_TITLE);
    expect(runtime.courseRouteSegment).toBe(UNIT_1_5_ROUTE_SEGMENT);
    expect(runtime.steps.map((step) => step.id)).toEqual(
      Array.from({ length: 14 }, (_, index) => `step-${String(index + 1).padStart(2, '0')}`),
    );
    expect(UNIT_1_5_LESSON_STEPS).toHaveLength(14);
    expect(readFileSync(join(courseDir, 'step-panels.tsx'), 'utf8')).not.toMatch(/CONTENT_MAP|contentMap/);
  });

  it('keeps the preset classroom duration aligned to 90 minutes', () => {
    const preset = ALL_PRESETS.find((item) => item.key === UNIT_1_5_PRESET_KEY)!;
    expect(preset.items.reduce((sum, item) => sum + item.duration, 0)).toBe(preset.totalDuration);
    expect(preset.items.find((item) => item.order === 4)?.duration).toBe(0);
    expect(preset.items.find((item) => item.order === 12)?.duration).toBe(0);
  });

  it('keeps steps 5-8 owned by the compute panel and preserves shared comparison requests', () => {
    const runtime = manifest();
    for (const stepId of ['step-05', 'step-06', 'step-07', 'step-08']) {
      const step = runtime.steps.find((item) => item.id === stepId)!;
      expect(step.interactionSpec.activityCards ?? [], stepId).toEqual([]);
      expect(step.modules.filter((module) => module.kind === 'compute.panel'), stepId).toHaveLength(1);
    }

    const comparisonPayload = (stepId: string) => runtime.steps
      .find((step) => step.id === stepId)!
      .modules.find((module) => module.kind === 'compute.panel')!.payload;
    expect(comparisonPayload('step-06').comparisonRequests).toMatchObject([
      { id: 'k3-baseline', fixedKOverride: { field: 'k', value: 3 } },
      { id: 'dynamic-k', request: { gainField: 'k' } },
    ]);
    expect(comparisonPayload('step-07').comparisonRequests).toMatchObject([
      { id: 'k24-baseline', fixedKOverride: { field: 'k', value: 24 } },
      { id: 'dynamic-k', request: { gainField: 'k' } },
    ]);
    expect(comparisonPayload('step-09').comparisonRequests).toHaveLength(6);
  });

  it('preserves response-prefill selectors, table shape, and hidden AI context', () => {
    const runtime = manifest();
    const step9 = runtime.steps.find((step) => step.id === 'step-09')!;
    const workspace = step9.modules.find((module) => module.kind === 'activity.workspace')!;
    const sources = (workspace.payload.responsePrefill as { sources: Array<Record<string, unknown>> }).sources;
    expect(sources).toHaveLength(5);
    expect(sources.find((source) => source.targetRow === 'k24')).toMatchObject({
      snapshotSelector: { comparisonRequestId: 'k24-baseline', retain: 'latest_validated', mismatch: 'keep_empty' },
    });
    expect(step9.interactionSpec.activityCards?.[0]).toMatchObject({
      responseKind: 'table.builder',
      tableRowKeys: ['k3', 'k12', 'k24', 'k36', 'k42'],
    });
    const rawSteps = (JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      steps: Record<string, { ai_context_spec: { page_ai_entry?: string } }>;
    }).steps;
    for (const step of runtime.steps) {
      expect(step.aiContextSpec.deliveryMode, step.id).toBe('hidden_page_context');
      expect(rawSteps[step.id].ai_context_spec.page_ai_entry, step.id).toBe('forbidden');
    }
  });

  it('registers catalog, preset, AI, identity, session route, and inventories', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === UNIT_1_5_ROUTE_SEGMENT)).toBe(true);
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === UNIT_1_5_ROUTE_SEGMENT)).toBe(true);
    expect(INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-1')?.lessons)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: UNIT_1_5_ROUTE_SEGMENT, unitLabel: '1-5' })]));
    expect(ALL_PRESETS.some((preset) => preset.key === UNIT_1_5_PRESET_KEY)).toBe(true);
    expect(COURSE_AI_CONTEXT_REGISTRY[UNIT_1_5_PRESET_KEY]).toBeDefined();
    expect(STANDARD_MODULE_ENFORCED_LESSON_IDS).toContain('1-5');
    expect(COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY.some((item) => item.lessonId === '1-5')).toBe(true);

    const identity = resolveInteractiveLessonIdentity({ kind: 'routeSegment', value: UNIT_1_5_ROUTE_SEGMENT });
    expect(identity).toMatchObject({ status: 'resolved', record: { canonicalId: '1-5' } });
    expect(resolveSessionRouteFromPlanTitle(UNIT_1_5_COURSE_TITLE)).toMatchObject({
      routeSegment: UNIT_1_5_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('keeps objective 5 outside the 90-minute classroom attainment denominator', () => {
    const runtime = manifest();
    expect(runtime.steps.find((step) => step.id === 'step-02')?.modules[1]?.payload.objectivePolicy).toMatchObject({
      classroomRequired: ['objective-1', 'objective-2', 'objective-3', 'objective-4'],
      afterClassExtension: ['objective-5'],
      classroomAttainmentDenominator: 'classroomRequired_only',
    });
    expect(UNIT_1_5_LESSON_STEPS.find((step) => step.id === 'step-12')?.duration).toBe('课后选做');
  });

  it('retains repeated attempts and defers LearningFact materialization for steps 5-9', () => {
    const state = createEmptyUNIT_1_5StudentState('测试学生');
    const first = { stepId: 'step-05', submittedAt: 100, answers: { k: '3' } };
    const second = { stepId: 'step-05', submittedAt: 200, answers: { k: '4' } };
    const history = appendUNIT_1_5ResponseHistory(appendUNIT_1_5ResponseHistory(state.responseHistory, first), second);
    expect(history['step-05']).toEqual([first, second]);

    const runtime = manifest();
    for (const stepId of ['step-05', 'step-06', 'step-07', 'step-08', 'step-09']) {
      expect(buildUNIT_1_5SubmissionDataOverrides({
        stepManifest: runtime.steps.find((step) => step.id === stepId)!,
        structuredAnswer: null,
      }), stepId).toMatchObject({
        skipLearningFact: true,
        learningFactPolicyStatus: 'deferred_server_validation',
        validationScope: 'engine_result_only',
      });
    }
  });

  it('reports real evidence completion while keeping objective 5 separate', () => {
    const state = createEmptyUNIT_1_5StudentState('测试学生');
    state.viewedStepIds = ['step-01', 'step-02'];
    state.responses = {
      'step-03': { stepId: 'step-03', submittedAt: 1, answers: {} },
      'step-12': { stepId: 'step-12', submittedAt: 2, answers: {} },
    };
    const runtime = manifest();
    state.responses['step-03'].answers = {
      'pole-natural-response': '衰减振荡',
      'feedback-characteristic': '正确',
    };
    expect(buildUNIT_1_5StudentAnalyticsItems(state, runtime)).toEqual(expect.arrayContaining([
      expect.stringContaining('个人浏览：2/14'),
      expect.stringContaining('前测结果：已作答 2/3 题'),
      expect.stringContaining('目标5课后分层/迁移进度：部分提交'),
    ]));
    expect(buildUNIT_1_5TeacherAnalyticsItems([state], runtime)).toEqual(expect.arrayContaining([
      expect.stringContaining('前测班级作答分布'),
      expect.stringContaining('误判标签聚合'),
      expect.stringContaining('目标5课后分层/迁移完整提交率 0%'),
    ]));
    expect(buildUNIT_1_5TeacherAnalyticsItems([], runtime)[0]).toContain('班级暂无学生记录');
  });

  it('normalizes the step 12 supplemental migration fields', () => {
    const runtime = manifest();
    const card = runtime.steps.find((step) => step.id === 'step-12')!
      .interactionSpec.activityCards?.find((item) => item.id === 'new-plant-scan');
    expect(card?.tableSupplementalFields).toEqual([
      { key: 'stable_interval', label: '稳定区间' },
      { key: 'critical_gain', label: '临界增益' },
      { key: 'comparison', label: '跨对象比较' },
    ]);
  });
});

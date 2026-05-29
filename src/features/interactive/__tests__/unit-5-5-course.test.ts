import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { UNIT_5_5_LESSON_STEPS } from '@/lib/unit-5-5-course';
import { UNIT_5_5TeacherActivitySummary } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/step-panels';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-5-policy-learning-entry-risk';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-5/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-5 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-17' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-5 interactive course', () => {
  it('defines the 17-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-5-course');

    expect(courseModule.UNIT_5_5_LESSON_STEPS).toHaveLength(17);
    expect(courseModule.UNIT_5_5_ROUTE_SEGMENT).toBe(routeSegment);
    expect(courseModule.UNIT_5_5_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_5_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_5_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-5-course');

    for (const manifestStep of manifest.steps) {
      const localContract = courseModule.getUNIT_5_5PageContractFromManifest(manifest, manifestStep.id);

      expect(localContract?.layout).toEqual(manifestStep.layout);
      expect(localContract?.interactionKind).toBe(manifestStep.interactionSpec.interactionKind);
      expect(localContract?.teacherControls).toEqual(manifestStep.teacherControls);
      expect(localContract?.teacherInsightWidgets).toEqual(manifestStep.teacherInsightSpec.widgets);
      expect(localContract?.previewDemoPath).toBe(manifestStep.previewContract.demoPath);
      expect(localContract?.aiPageGoal).toBe(manifestStep.aiContextSpec.pageGoal);
    }
  });

  it('exposes route files and keeps step-panels as a thin manifest runtime adapter', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-5-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-5/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('computeUnit55RlTraining');
    expect(stepPanelsSource).toContain('data-testid="unit-5-5-toy-rl-training-panel"');
    expect(stepPanelsSource).toContain('data-testid="unit-5-5-heading-rl-training-panel"');
    expect(stepPanelsSource).toContain('5-5 runtime manifest is required for page rendering.');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-5/');
    expect(teacherPageSource).toContain('currentItemId: nextStep.id');
    expect(teacherPageSource).toContain('currentStage: UNIT_5_5_STAGE_MAP[nextStep.stage]');
  });

  it('keeps step-08 and step-15 as Rust/WASM training panels without ordinary text-card fallback', async () => {
    const manifest = readManifest();
    const step08 = manifest.steps.find((step) => step.id === 'step-08');
    const step15 = manifest.steps.find((step) => step.id === 'step-15');
    const runtimeSource = readFileSync(join(featureBase, 'rl-training-runtime.ts'), 'utf8');
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(step08?.interactionSpec.interactionKind).toBe('rust_toy_training_panel');
    expect(step15?.interactionSpec.interactionKind).toBe('rust_heading_rl_training_panel');
    expect(step08?.interactionSpec.activityCards).toEqual([]);
    expect(step15?.interactionSpec.activityCards).toEqual([]);
    expect(step08?.modules.find((module) => module.id === 'toy-training-panel')?.payload.panel_id).toBe('rust_toy_rl_training_panel');
    expect(step15?.modules.find((module) => module.id === 'heading-rl-training-panel')?.payload.panel_id).toBe('rust_heading_rl_training_panel');
    expect(step15?.modules.find((module) => module.id === 'heading-summary')).toMatchObject({
      region: 'summary',
      kind: 'content.cardSet',
      payload: { legacyKind: 'summary-card' },
    });
    expect(runtimeSource).toContain('compute_rl_training');
    expect(stepPanelsSource).toContain('rl_result:${activeTab}');
    expect(stepPanelsSource).toContain('collectTrainingResults');
    expect(stepPanelsSource).toContain('pendingResults');
    expect(stepPanelsSource).toContain('训练中，第 ${episodeCount} 轮');
    expect(stepPanelsSource).toContain('RMS 合并排名');
    expect(stepPanelsSource).toContain('safetyFallbackCount');

    const { UNIT_5_5StepContentPanel } = await import('@/features/interactive/unit-5-5-policy-learning-entry-risk/step-panels');
    const step08Html = renderToStaticMarkup(
      createElement(UNIT_5_5StepContentPanel, {
        step: UNIT_5_5_LESSON_STEPS[7],
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        mode: 'student',
      }),
    );
    const step15Html = renderToStaticMarkup(
      createElement(UNIT_5_5StepContentPanel, {
        step: UNIT_5_5_LESSON_STEPS[14],
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        mode: 'student',
      }),
    );
    expect(step08Html).toContain('data-testid="unit-5-5-toy-rl-training-panel"');
    expect(step15Html).toContain('data-testid="unit-5-5-heading-rl-training-panel"');
    expect(`${step08Html}\n${step15Html}`).not.toContain('互动页模块渲染缺失');
  });

  it('keeps unit 5-5 fixes aligned with the reviewed runtime manifest and panel source', () => {
    const manifest = readManifest();
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step13 = manifest.steps.find((step) => step.id === 'step-13');
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const runtimeSource = readFileSync(join(featureBase, 'rl-training-runtime.ts'), 'utf8');

    expect(step10?.modules.find((module) => module.id === 'risk-matrix-figure')).toBeUndefined();
    expect(step10?.modules.find((module) => module.id === 'risk-matrix-table')).toMatchObject({
      kind: 'content.table',
      payload: { legacyKind: 'native-table' },
      mustBeVisible: true,
    });
    const step10ActivityCards = step10?.interactionSpec.activityCards;
    expect(step10ActivityCards).toBeDefined();
    if (!step10ActivityCards) throw new Error('Expected step-10 activity cards');
    const firstStep10Card = step10ActivityCards[0];
    expect(firstStep10Card).toBeDefined();
    if (!firstStep10Card) throw new Error('Expected step-10 first activity card');
    expect(firstStep10Card.matchItems).toBeDefined();
    if (!firstStep10Card.matchItems) throw new Error('Expected step-10 match items');
    expect(firstStep10Card.matchOptions).toHaveLength(firstStep10Card.matchItems.length);
    expect(step10?.acceptanceChecks.join('')).toContain('原生表格');

    const revealItems = step13?.contentBlocks.reveal_layers as { items?: Array<Record<string, unknown>> } | undefined;
    expect(revealItems?.items?.[3]).toMatchObject({
      title: 'Q-learning 更新式',
    });
    expect(String(revealItems?.items?.[3]?.formula)).toContain('Q(s_k,a_k)');
    expect(String(revealItems?.items?.[3]?.formula)).toContain('leftarrow');

    expect(runtimeSource).toContain('episodeChunk');
    expect(runtimeSource).toContain('trainingState');
    expect(runtimeSource).toContain('rewardChunk');
    expect(stepPanelsSource).toContain('evaluate: false');
    expect(stepPanelsSource).toContain('episodeChunk: 0');
    expect(runtimeSource).toContain('disturbance');
    expect(stepPanelsSource).toContain('useEffect');
    expect(stepPanelsSource).toContain('setTimeout');
    expect(stepPanelsSource).toContain('renderOverlays');
    expect(stepPanelsSource).toContain('grid gap-4 xl:grid-cols-2');
    expect(stepPanelsSource).not.toContain('训练轮数档位');
  });

  it('renders all three submitted heading training tags in the teacher RMS ranking', () => {
    const manifest = readManifest();
    const makeResult = (trainingType: string, rms: number) => JSON.stringify({
      panelKind: 'rust_heading_rl_training_panel',
      trainingType,
      seed: 5515,
      selectedParameters: { parameter: trainingType },
      trainingEpisodes: 140,
      rewardCurve: [],
      comparisonTrace: [],
      metrics: {
        rmsHeadingError: rms,
        maxOvershoot: 2,
        settlingTime: 80,
        averageRudder: 6,
        averageRudderRate: 0.4,
        finalError: rms,
        cumulativeReward: -18,
      },
      safetyFallbackCount: trainingType === 'safe_shell_rl' ? 3 : 0,
    });

    const html = renderToStaticMarkup(
      createElement(UNIT_5_5TeacherActivitySummary, {
        step: UNIT_5_5_LESSON_STEPS[14],
        manifest,
        responses: [{
          studentName: '学生甲',
          response: {
            stepId: 'step-15',
            submittedAt: 1,
            answers: {
              'rl_result:direct_rl': makeResult('direct_rl', 4.05),
              'rl_result:safe_shell_rl': makeResult('safe_shell_rl', 3.72),
              'rl_result:rl_pid_schedule': makeResult('rl_pid_schedule', 3.35),
            },
          },
        }],
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
    );

    expect(html).toContain('RMS 合并排名');
    expect(html).toContain('RL直接');
    expect(html).toContain('RL安全外壳');
    expect(html).toContain('RL调度PID');
    expect(html.indexOf('RL调度PID')).toBeLessThan(html.indexOf('RL安全外壳'));
    expect(html.indexOf('RL安全外壳')).toBeLessThan(html.indexOf('RL直接'));
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-5-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_5_LESSON_STEPS[15]).toMatchObject({
      id: 'step-16',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_5_LESSON_STEPS[16]).toMatchObject({
      id: 'step-17',
      pageType: 'summary',
    });
    expect(featureSource).toContain('个人课堂表现');
    expect(featureSource).toContain('班级课堂表现');
    expect(featureSource).toContain('训练结果提交');
    expect(featureSource).toContain('训练覆盖');
  });
});

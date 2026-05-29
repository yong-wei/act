import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;
let loadLessonRuntimeEntry: typeof import('@/lib/course-runtime').loadLessonRuntimeEntry;

beforeAll(async () => {
  ({ loadLessonRuntimeEntry, parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-8 interactive course', () => {
  it('registers the 3-8 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-8-frequency-domain-translation-judgment-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('频域判别与跨域综合语言');
  });

  it('defines the full 22-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.UNIT_3_8_LESSON_STEPS).toHaveLength(22);
    expect(courseModule.UNIT_3_8_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[21]?.id).toBe('step-22');
    expect(courseModule.UNIT_3_8_LESSON_STEPS.slice(4, 8).map((step: { pageType: string }) => step.pageType)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(courseModule.UNIT_3_8_LESSON_STEPS[9]?.pageType).toBe('teacher_reveal_only');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[21]?.pageType).toBe('reflection_card');
  });

  it('keeps hidden AI context available without exposing a visible AI step', async () => {
    const quickQuestions = getStepQuickQuestions('unit-3-8-frequency-domain-translation-judgment-v1', 'step-16');
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('例题 5');
    expect(courseModule.isUNIT_3_8AiPageType('goal_cards')).toBe(false);
    expect(courseModule.isUNIT_3_8AiPageType('teacher_reveal_only')).toBe(false);
    expect(courseModule.isUNIT_3_8AiPageType('structured_compare')).toBe(false);
  });

  it('maps runtime media to the actual 3-8 design steps', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.getUNIT_3_8MediaSrc('step-01')).toContain('3-8-cover-comic');
    expect(courseModule.getUNIT_3_8MediaSrc('step-11')).toContain('3-8-nyquist-quickcheck');
    expect(courseModule.getUNIT_3_8MediaSrc('step-12')).toContain('3-8-nyquist-example');
    expect(courseModule.getUNIT_3_8MediaSrc('step-13')).toContain('3-8-bode-example');
    expect(courseModule.getUNIT_3_8MediaSrc('step-15')).toContain('3-8-three-band-overview');
    expect(courseModule.getUNIT_3_8MediaSrc('step-17')).toContain('3-8-heading-baseline');
    expect(courseModule.getUNIT_3_8MediaSrc('step-18')).toContain('3-8-heading-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-19')).toContain('3-8-platform-block-diagram');
    expect(courseModule.getUNIT_3_8MediaSrc('step-20')).toContain('3-8-platform-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-22')).toContain('3-8-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 22 steps', async () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-8/design/3-8-interactive-contract.yaml'), 'utf8'),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: {
            template: string;
            regions: Array<{ id: string; width: string; order: number }>;
            reading_order?: string[];
          };
          interaction_spec: { interaction_kind: string };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          ai_context_spec: { delivery_mode?: string };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-8-course');
    const runtime = await loadLessonRuntimeEntry('3-8');
    const manifest = runtime.interactiveManifest;
    expect(manifest).toBeTruthy();
    const interactiveSteps = new Map(courseModule.buildUNIT_3_8RuntimeSteps(manifest).map((step) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.getUNIT_3_8PageContractFromManifest(manifest, stepId);

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('stores browse visibility and step reveal progress in the teacher sync payload', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    const payload = courseModule.UNIT_3_8_SESSION_ADAPTER.buildTeacherSyncPayload({
      activeStepId: 'step-07',
      revealedAnswers: { 'step-07': false },
      releasedActivities: { 'step-06': true, 'step-07': true },
      browseEnabled: { 'step-07': true },
      teacherRevealProgress: { 'step-07': 2 },
      updatedAt: 123,
    });

    expect(payload).toMatchObject({
      kind: 'teacher_sync_unit38',
      activeStepId: 'step-07',
      releasedActivities: { 'step-06': true, 'step-07': true },
      browseEnabled: { 'step-07': true },
      teacherRevealProgress: { 'step-07': 2 },
      updatedAt: 123,
    });
  });

  it('keeps the revised 3-8 front-half requirements in the runtime manifest', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, {
        modules?: Array<{ kind: string; payload?: Record<string, unknown> }>;
        interaction_spec?: { interaction_kind?: string; activity_cards?: unknown[] };
      }>;
    };

    expect(JSON.stringify(manifest.steps['step-01']?.modules ?? [])).toContain('3-8-cover-comic.png');
    expect(JSON.stringify(manifest.steps['step-02']?.modules ?? [])).toContain('完成本单元后，学习者能够');
    expect(JSON.stringify(manifest.steps['step-04']?.modules ?? [])).toContain('L(s)=G(s)H(s)');
    expect(JSON.stringify(manifest.steps['step-04']?.modules ?? [])).toContain('L(j\\\\omega)=G(j\\\\omega)H(j\\\\omega)');
    expect(manifest.steps['step-04']?.interaction_spec?.activity_cards ?? []).toHaveLength(0);

    for (const stepId of ['step-05', 'step-06', 'step-07', 'step-08']) {
      expect(
        manifest.steps[stepId]?.modules?.some((module) =>
          module.kind === 'compute.panel'
          && module.payload?.legacyKind === 'rust-analysis-panel'
          && module.payload?.capabilityRef === 'rust-analysis',
        ),
      ).toBe(true);
      expect(manifest.steps[stepId]?.interaction_spec?.activity_cards ?? []).toHaveLength(0);
    }

    const step11Modules = manifest.steps['step-11']?.modules ?? [];
    expect(step11Modules[0]).toMatchObject({ kind: 'content.cardSet', payload: { legacyKind: 'worked-example-card' } });
    expect(step11Modules[1]).toMatchObject({ kind: 'content.figure', payload: { legacyKind: 'comparison-graphic' } });
    expect(JSON.stringify(manifest.steps['step-12']?.modules ?? [])).toContain('L(s)=K/[(s+1)(s+2)(s+4)]');
    expect(JSON.stringify(manifest.steps['step-13']?.modules ?? [])).toContain('G_m');
  });

  it('renders migrated 3-8 compute.panel modules through the Rust analysis panel', async () => {
    const runtime = await loadLessonRuntimeEntry('3-8');
    const courseModule = await import('@/lib/unit-3-8-course');
    const { UNIT_3_8StepContentPanel } = await import(
      '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels'
    );
    const step = courseModule.UNIT_3_8_LESSON_STEPS.find((item) => item.id === 'step-05');

    if (!step || !runtime.interactiveManifest) throw new Error('3-8 step-05 runtime manifest missing');

    const html = renderToStaticMarkup(
      createElement(UNIT_3_8StepContentPanel, {
        step,
        manifest: runtime.interactiveManifest,
        revealProgress: 0,
        allowInlineReveal: false,
      }),
    );

    expect(html).toContain('控制分析图暂时不可用');
    expect(html).not.toContain('Rust 驱动四联互动面板');
  });

  it('renders migrated 3-8 interactive-figure compute.panel modules through the image panel', async () => {
    const runtime = await loadLessonRuntimeEntry('3-8');
    const courseModule = await import('@/lib/unit-3-8-course');
    const { UNIT_3_8StepContentPanel } = await import(
      '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels'
    );
    const step = courseModule.UNIT_3_8_LESSON_STEPS.find((item) => item.id === 'step-17');

    if (!step || !runtime.interactiveManifest) throw new Error('3-8 step-17 runtime manifest missing');

    const html = renderToStaticMarkup(
      createElement(UNIT_3_8StepContentPanel, {
        step,
        manifest: runtime.interactiveManifest,
        revealProgress: 0,
        allowInlineReveal: false,
      }),
    );

    expect(html).toContain('3-8-heading-baseline.png');
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-8-frequency-domain-translation-judgment')).toBe(true);

    expect(resolveSessionRouteFromPlanTitle('3-8：频域判别与跨域综合语言')).toEqual({
      routeSegment: 'unit-3-8-frequency-domain-translation-judgment',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('parses the 3-8 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/media/3-8-media.md'), 'utf8');
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-8-intro-video.mp4',
      '3-8-audio.m4a',
      '3-8-slides.pdf',
      '3-8-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('频域不是新章节');
  });

  it('keeps handout summary outside mediaResources when parsing 3-8 runtime media document', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/media/3-8-media.md'), 'utf8');
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('Nyquist');
    expect(parsed.handoutSummary).toContain('航向控制系统');
  });

  it('keeps the classroom panels focused on unified frequency-domain judgment', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('Bode 图：幅频 / 相频合并');
    expect(stepPanelsSource).toContain('根轨迹：变参数影响闭环极点');
    expect(stepPanelsSource).toContain('目标切换时，先改哪一段频带');
    expect(stepPanelsSource).toContain('把完整判断链独立走一遍');
    expect(stepPanelsSource).not.toContain('PI 与滞后都站在低频补偿线上');
    expect(stepPanelsSource).not.toContain('劳斯判据');

    expect(workspaceSource).toContain('ROW_FOCUS_TOGGLE_ROWS');
    expect(workspaceSource).toContain('CURVE_COMPARE_CONTROLS');
    expect(workspaceSource).toContain('GOAL_SWITCH_FIELDS');
    expect(workspaceSource).toContain('SCHEME_VOTE_OPTIONS');
    expect(workspaceSource).toContain('REFLECTION_PROMPTS');
  });

  it('renders classroom content and activities through the shared manifest runtime', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('renderStudentInteractiveActivity');
    expect(stepPanelsSource).toContain('renderTeacherInteractiveActivity');
    expect(stepPanelsSource).not.toContain('placeholder=\"写出判断依据。\"');
  });

  it('keeps 3-8 runtime activity cards objective and option-backed', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { interaction_spec?: { activity_cards?: Array<{ response_kind: string; options?: unknown[] }> } }>;
    };

    const cards = Object.values(manifest.steps).flatMap((step) => step.interaction_spec?.activity_cards ?? []);

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((card) => card.response_kind !== 'text').every((card) => card.options?.length)).toBe(true);
    expect(cards.some((card) => card.response_kind === 'drag_sort')).toBe(true);
    expect(cards.map((card) => card.response_kind)).not.toContain('fill_text');
  });

  it('keeps 3-8 pretest focused on prerequisite knowledge instead of Nyquist theorem content', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { interaction_spec?: { activity_cards?: Array<{ prompt: string; options?: Array<{ label?: string }> }> } }>;
    };

    const pretestText = JSON.stringify(manifest.steps['step-03']?.interaction_spec?.activity_cards ?? []);

    expect(pretestText).not.toContain('Nyquist');
    expect(pretestText).not.toContain('包围');
    expect(pretestText).not.toContain('临界点');
    expect(pretestText).toContain('频率响应');
    expect(pretestText).toContain('Bode');
  });

  it('limits non-assessment 3-8 activity pages to at most two answer cards', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { title: string; interaction_spec?: { interaction_kind?: string; activity_cards?: unknown[] } }>;
    };

    const nonAssessmentOverloads = Object.entries(manifest.steps).filter(([stepId, step]) => {
      if (stepId === 'step-03' || stepId === 'step-21') return false;
      return (step.interaction_spec?.activity_cards ?? []).length > 2;
    });

    expect(nonAssessmentOverloads).toEqual([]);
  });

  it('does not repeat worked-example problem statements across content modules', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { modules?: Array<{ payload?: { text?: string; title?: string } }> }>;
    };

    for (const stepId of ['step-09', 'step-12', 'step-14', 'step-16']) {
      const textCounts = new Map<string, number>();
      for (const manifestModule of manifest.steps[stepId]?.modules ?? []) {
        const text = manifestModule.payload?.text?.trim();
        if (text) textCounts.set(text, (textCounts.get(text) ?? 0) + 1);
      }
      expect(Array.from(textCounts.entries()).filter(([, count]) => count > 1)).toEqual([]);
    }
  });

  it('binds every 3-8 image-bearing page to concrete runtime media paths', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { modules?: Array<{ kind: string; payload?: Record<string, unknown> }> }>;
    };

    for (const stepId of ['step-01', 'step-11', 'step-12', 'step-13', 'step-15', 'step-17', 'step-18', 'step-19', 'step-20', 'step-22']) {
      const modules = manifest.steps[stepId]?.modules ?? [];
      const imageModules = modules.filter((manifestModule) =>
        ['content.figure', 'compute.panel'].includes(manifestModule.kind)
        && ['comparison-graphic', 'interactive-figure-panel', 'media-card'].includes(String(manifestModule.payload?.legacyKind ?? '')),
      );
      expect(imageModules.length, `${stepId} should contain image modules`).toBeGreaterThan(0);
      expect(
        imageModules.some((manifestModule) => JSON.stringify(manifestModule.payload ?? {}).includes('.png')),
        `${stepId} should bind a concrete runtime image path`,
      ).toBe(true);
    }
  });

  it('keeps visible AI out of the 3-8 lesson page shell', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(stepPanelsSource).not.toContain('useInteractiveAI');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');
  });

  it('uses substantial 3-8 posttest prompts that exercise the full judgment chain', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, { interaction_spec?: { activity_cards?: Array<{ prompt: string }> } }>;
    };

    const posttestPrompts = manifest.steps['step-21']?.interaction_spec?.activity_cards?.map((card) => card.prompt) ?? [];

    expect(posttestPrompts).toHaveLength(4);
    expect(posttestPrompts.every((prompt) => prompt.length >= 24)).toBe(true);
    expect(posttestPrompts.join('\n')).toContain('频带');
    expect(posttestPrompts.join('\n')).toContain('边界');
    expect(posttestPrompts.join('\n')).toContain('闭环');
  });

  it('uses the 3-8 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit38StepAIContext');
    expect(studentPageSource).not.toContain('getUnit37StepAIContext');
  });
});

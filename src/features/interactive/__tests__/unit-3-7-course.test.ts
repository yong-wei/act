import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-7 interactive course', () => {
  it('registers the 3-7 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-7-steady-error-low-frequency-compensation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('型别、积分环节与稳态改善');
  });

  it('defines the full 17-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');

    expect(courseModule.UNIT_3_7_LESSON_STEPS).toHaveLength(17);
    expect(courseModule.UNIT_3_7_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_7_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('keeps page AI hidden and only exposes activity-first layout on the contract-required steps', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');

    expect(courseModule.isUNIT_3_7AiPageType('display')).toBe(false);
    expect(courseModule.isUNIT_3_7AiPageType('quiz_group')).toBe(false);
    expect(courseModule.isUNIT_3_7ActivityFirstStep('step-03')).toBe(false);
    expect(courseModule.isUNIT_3_7ActivityFirstStep('step-16')).toBe(false);
    expect(courseModule.isUNIT_3_7ActivityFirstStep('step-04')).toBe(false);
  });

  it('keeps step-04 and the worked-example pages on per-card submissions with at most two questions per page and uses题面作为卡片标题', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');
    const workspaceModule = await import('@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace');

    expect(courseModule.UNIT_3_7_PAGE_CONTRACTS['step-04']?.interactionKind).toBe('activity_card_set');
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-04']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-05']).toHaveLength(2);
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-06']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-07']).toHaveLength(2);
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-09']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-10']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-11']).toHaveLength(2);
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-12']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-13']).toHaveLength(2);
    expect(workspaceModule.WORKED_EXAMPLE_FIELDS['step-14']).toHaveLength(2);
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-15']).toHaveLength(2);

    const allFieldGroups = [
      ...Object.values(workspaceModule.WORKED_EXAMPLE_FIELDS),
      ...Object.values(workspaceModule.ACTIVITY_CARD_FIELDS),
    ].flat();

    for (const field of allFieldGroups) {
      expect(field.label).not.toMatch(/^卡片\s*\d+$/);
    }
  });

  it('implements progressive reveal controls, the unified step-09 Rust/WASM workspace, and removes the redundant no-submit block on display pages', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('显示下一步');
    expect(stepPanelsSource).toContain('重置步骤');
    expect(stepPanelsSource).toContain('点击当前步骤可继续显影下一层');
    expect(stepPanelsSource).not.toContain('第 1 步：');
    expect(stepPanelsSource).toContain('<ProgressiveRevealPanelContent key={stepId} stepId={stepId} title={title} />');
    expect(stepPanelsSource).toContain('const [revealedCount, setRevealedCount] = useState(0);');
    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('BodePanel');
    expect(stepPanelsSource).not.toContain('LOW_FREQUENCY_CURVES');
    expect(stepPanelsSource).toContain('提交答案');
    expect(stepPanelsSource).not.toContain('提交本卡');
    expect(stepPanelsSource).not.toContain('shouldRenderCardPrompt(field)');
    expect(stepPanelsSource).not.toContain('{field.prompt}');
    expect(stepPanelsSource).toContain('{renderInlineMarkdown(option.label)}');
    expect(stepPanelsSource).toContain('mt-4 grid gap-4 md:grid-cols-2');
    expect(stepPanelsSource).not.toContain('mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4');
    expect(studentPageSource).not.toContain('本页无需提交');
    expect(teacherPageSource).not.toContain('当前收到 {responses.length} 份本页作答');
  });

  it('renders step-04 answer options as inline LaTeX labels', async () => {
    const workspaceModule = await import('@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace');

    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-04'][0]?.options?.[0]?.label).toContain('$\\dfrac{C(s)}{R(s)}');
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-04'][0]?.options?.[1]?.label).toContain('$\\dfrac{C(s)}{D(s)}');
    expect(workspaceModule.ACTIVITY_CARD_FIELDS['step-04'][0]?.options?.[2]?.label).toContain('$\\dfrac{E_d(s)}{D(s)}');
  });

  it('keeps the authoring contract on two-card pages and puts the post-assessment title card above the questions', () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-7/design/3-7-interactive-contract.yaml'), 'utf8'),
    ) as {
      steps: Record<
        string,
        {
          evidence_sequence?: string[];
          interaction_spec?: { activity_cards?: Array<{ id: string }> };
        }
      >;
    };

    expect(contract.steps['step-05']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-06']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-07']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-09']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-10']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-11']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-12']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-13']?.interaction_spec?.activity_cards).toHaveLength(2);
    expect(contract.steps['step-16']?.evidence_sequence?.[0]).toContain('名称卡');
  });

  it('keeps canonical matching cards backed by concrete pairing structures', () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-7/design/3-7-interactive-contract.yaml'), 'utf8'),
    ) as {
      steps: Record<
        string,
        {
          interaction_spec?: {
            activity_cards?: Array<{
              id: string;
              response_kind?: string;
              match_items?: unknown[];
              match_options?: unknown[];
              reference_matches?: unknown[];
            }>;
          };
        }
      >;
    };
    const runtimeManifest = normalizeInteractiveRuntimeManifest(JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-7/interactive-manifest.json'), 'utf8'),
    ));
    const authoringCards = new Map(
      Object.values(contract.steps).flatMap((step) => step.interaction_spec?.activity_cards ?? []).map((card) => [card.id, card]),
    );
    const runtimeCards = new Map(
      runtimeManifest?.steps.flatMap((step) => step.interactionSpec.activityCards ?? []).map((card) => [card.id, card]) ?? [],
    );

    for (const cardId of ['freq-pd-card-2', 'freq-compare-card-2']) {
      const authoringCard = authoringCards.get(cardId);
      expect(authoringCard?.response_kind).toBe('matching.pairs');
      expect(authoringCard?.match_items).toHaveLength(3);
      expect(authoringCard?.match_options).toHaveLength(3);
      expect(authoringCard?.reference_matches).toHaveLength(3);

      const runtimeCard = runtimeCards.get(cardId);
      expect(runtimeCard?.responseKind).toBe('matching.pairs');
      expect(runtimeCard?.legacyResponseKind).toBeUndefined();
      expect(runtimeCard?.matchItems).toHaveLength(3);
      expect(runtimeCard?.matchOptions).toHaveLength(3);
      expect(runtimeCard?.referenceMatches).toHaveLength(3);
    }
  });

  it('exposes AI quick questions for the frequency comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-7-steady-error-low-frequency-compensation-v1', 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('低频精度');
  });

  it('maps runtime media using the real 3-7 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');

    expect(courseModule.getUNIT_3_7MediaSrc('step-01')).toContain('3-7-cover-comic');
    expect(courseModule.getUNIT_3_7MediaSrc('step-04')).toContain('3-7-error-dual-channel');
    expect(courseModule.getUNIT_3_7MediaSrc('step-07')).toContain('3-7-example2-structure');
    expect(courseModule.getUNIT_3_7MediaSrc('step-09')).toContain('3-7-low-frequency-compensators');
    expect(courseModule.getUNIT_3_7MediaSrc('step-10')).toContain('3-7-pi-time-domain-design');
    expect(courseModule.getUNIT_3_7MediaSrc('step-11')).toContain('3-7-lag-time-domain-design');
    expect(courseModule.getUNIT_3_7MediaSrc('step-13')).toContain('3-7-pi-frequency-design');
    expect(courseModule.getUNIT_3_7MediaSrc('step-14')).toContain('3-7-pi-pd-comparison');
    expect(courseModule.getUNIT_3_7MediaSrc('step-17')).toContain('3-7-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-7/design/3-7-interactive-contract.yaml'), 'utf8'),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: { template: string; regions: Array<{ id: string; width: string; order: number }> };
          interaction_spec: { interaction_kind: string };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-7-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_7_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = [
      'step-03',
      'step-04',
      'step-05',
      'step-06',
      'step-08',
      'step-09',
      'step-10',
      'step-11',
      'step-12',
      'step-13',
      'step-14',
      'step-15',
      'step-16',
      'step-17',
    ] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_7_PAGE_CONTRACTS[stepId];

      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-7-steady-error-low-frequency-compensation')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理'),
    ).toEqual({
      routeSegment: 'unit-3-7-steady-error-low-frequency-compensation',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('CourseEntryShell');
    expect(entrySource).toContain('<CourseEntryShell');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('parses the 3-7 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-7/media/3-7-media.md'), 'utf8');
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-7-intro-video.mp4',
      '3-7-audio.m4a',
      '3-7-slides.pdf',
      '3-7-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('稳态误差为什么能减小');
  });

  it('keeps handout summary outside mediaResources when parsing 3-7 runtime media document', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-7/media/3-7-media.md'), 'utf8');
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('稳态误差分析');
    expect(parsed.handoutSummary).toContain('PI控制');
  });

  it('keeps the classroom panels focused on dual-channel error and low-frequency compensation', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('分母相同反映结构');
    expect(stepPanelsSource).toContain('C(s)=\\Phi_r(s)R(s)+\\Phi_d(s)D(s)');
    expect(stepPanelsSource).not.toContain('expression="\\\\Phi_r(s)');
    expect(stepPanelsSource).not.toContain('expression="\\\\frac{E_r(s)}{R(s)}');
    expect(stepPanelsSource).toContain('E(s)=E_r(s)+E_d(s)');
    expect(stepPanelsSource).toContain('R(s)=\\dfrac{3}{s}+\\dfrac{2}{s^2}+\\dfrac{1}{s^3}');
    expect(stepPanelsSource).toContain('G(s)H(s)=\\frac{K_0}{s^v}G_0(s),\\quad G_0(0)\\neq 0');
    expect(stepPanelsSource).toContain('K_v=\\lim_{s\\to 0}sG(s)H(s)');
    expect(stepPanelsSource).toContain('R(s)=\\dfrac{1}{s},\\quad D(s)=\\dfrac{0.2}{s}');
    expect(stepPanelsSource).toContain('G_{PI}(s)=K\\left(1+\\frac{1}{T_i s}\\right)=K\\frac{T_i s+1}{T_i s}');
    expect(stepPanelsSource).toContain('G_{lag}(s)=K\\frac{Ts+1}{\\beta Ts+1},\\ \\beta>1');
    expect(stepPanelsSource).toContain('本题最终稳态误差为 1/K');
    expect(stepPanelsSource).toContain('型别与误差系数关系');
    expect(stepPanelsSource).toContain('型别与典型输入误差关系');
    expect(stepPanelsSource).toContain('G_1(s)');
    expect(stepPanelsSource).toContain('PI 与滞后都在低频补偿线上，但抓手不同');
    expect(stepPanelsSource).toContain('e_ss = 0.4');
    expect(stepPanelsSource).toContain('纯增益不能把斜坡误差变为 0');
    expect(stepPanelsSource).toContain('型别不变时，尽量把低频增益和中频动态分开安排');
    expect(stepPanelsSource).toContain('先判断纯增益不可能兼顾低频精度和相位裕度');
    expect(stepPanelsSource).toContain('纯增益若要满足 $K_v\\\\ge 10$，会先跌出阻尼边界。');
    expect(stepPanelsSource).toContain('动态速度优先');
    expect(stepPanelsSource).toContain('低频精度');
    expect(stepPanelsSource).toContain('3-8 将把低频收益和中频代价翻译成统一频域判断');
    expect(stepPanelsSource).not.toContain('劳斯判据');
    expect(stepPanelsSource).not.toContain('根轨迹增益');
    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');

    expect(workspaceSource).toContain('HOTSPOT_FIELDS');
    expect(workspaceSource).toContain('WORKED_EXAMPLE_FIELDS');
    expect(workspaceSource).toContain('ACTIVITY_CARD_FIELDS');
    expect(workspaceSource).toContain('ASSESSMENT_CARD_FIELDS');
  });

  it('uses the 3-7 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit37StepAIContext');
    expect(studentPageSource).not.toContain('getUnit36StepAIContext');
    expect(studentPageSource).not.toContain('UNIT_3_7StepAiAssistant');
    expect(teacherPageSource).not.toContain('UNIT_3_7StepAiAssistant');
    expect(studentPageSource).toContain("isUNIT_3_7ActivityFirstStep(step.id)");
    expect(teacherPageSource).toContain("isUNIT_3_7ActivityFirstStep(step.id)");
  });
});

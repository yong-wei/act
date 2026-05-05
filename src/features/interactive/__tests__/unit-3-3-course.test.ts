import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-3 interactive course', () => {
  it('registers the 3-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-3-root-locus-rules-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('根轨迹机制');
  });

  it('defines the full 15-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-3-course');

    expect(courseModule.UNIT_3_3_LESSON_STEPS).toHaveLength(15);
    expect(courseModule.UNIT_3_3_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[4]?.id).toBe('step-05');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[12]?.title).toContain('三类开环极点');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[13]?.title).toContain('后测');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[14]?.title).toContain('总结');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[14]?.id).toBe('step-15');
    expect(courseModule.UNIT_3_3_LESSON_STEPS.map((step: { title: string }) => step.title).join(' | ')).not.toContain('广义根轨迹');
    expect(courseModule.UNIT_3_3_LESSON_STEPS.map((step: { title: string }) => step.title).join(' | ')).not.toContain('时间常数例子');
    expect(courseModule.UNIT_3_3_LESSON_STEPS.map((step: { title: string }) => step.title).join(' | ')).not.toContain('动态翻译');
  });

  it('exposes AI quick questions for the example-three step instead of the deleted generalized-root-locus step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-3-root-locus-rules-v1', 'step-11');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('出射角');
  });

  it('maps runtime media using the real 3-3 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-3-course');

    expect(courseModule.getUNIT_3_3MediaSrc('step-02')).toContain('3-3-pp-04-complete-rules-example');
    expect(courseModule.getUNIT_3_3MediaSrc('step-05')).toContain('3-3-pp-03-angle-and-magnitude-geometry');
    expect(courseModule.getUNIT_3_3MediaSrc('step-11')).toContain('3-3-example-03-departure-sum');
    expect(courseModule.getUNIT_3_3MediaSrc('step-15')).toContain('3-3-info');
    expect(courseModule.getUNIT_3_3MediaSrc('step-13')).toBeNull();
    expect(courseModule.getUNIT_3_3MediaSrc('step-14')).toBeNull();
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 15 steps', async () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-3/design/3-3-interactive-contract.yaml'), 'utf8'),
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

    const courseModule = await import('@/lib/unit-3-3-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_3_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_3_PAGE_CONTRACTS[stepId];
      const expectedPageType = authoringStep.interaction_spec.interaction_kind === 'none' ? 'display' : authoringStep.interaction_spec.interaction_kind;

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
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-3-root-locus-rules')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移'),
    ).toEqual({
      routeSegment: 'unit-3-3-root-locus-rules',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('removes generalized-root-locus residue from entry and authoring lesson sources', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/entry-page.tsx'),
      'utf8',
    );
    const bopppsSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-3/design/3-3-boppps.md'),
      'utf8',
    );
    const multimediaSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-3/design/3-3-multimedia.md'),
      'utf8',
    );
    const manifestSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-3/manifest.json'),
      'utf8',
    );
    const sequenceSource = readFileSync(
      join(repoRoot, 'course-content/authoring/knowledge/cards/lessons/3-3/sequence.json'),
      'utf8',
    );

    expect(entrySource).not.toContain('广义根轨迹');
    expect(entrySource).not.toContain('动态翻译');
    expect(bopppsSource).not.toContain('广义根轨迹');
    expect(bopppsSource).not.toContain('动态翻译');
    expect(bopppsSource).not.toContain('等效开环');
    expect(multimediaSource).not.toContain('广义根轨迹');
    expect(multimediaSource).not.toContain('动态翻译');
    expect(multimediaSource).not.toContain('3-3-pp-02-generalized-root-locus-map.svg');
    expect(multimediaSource).not.toContain('3-3-pp-07-generalized-time-constant-example.svg');
    expect(manifestSource).not.toContain('广义根轨迹_4_30f5ea13');
    expect(manifestSource).not.toContain('零度与一百八十度根轨迹_3_c1bb7dbe');
    expect(sequenceSource).not.toContain('广义视角与参数扩展');
    expect(sequenceSource).not.toContain('广义根轨迹_4_30f5ea13');
    expect(sequenceSource).not.toContain('零度与一百八十度根轨迹_3_c1bb7dbe');
  });

  it('parses the 3-3 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-3/media/3-3-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-3-intro-video.mp4',
      '3-3-audio.m4a',
      '3-3-slides.pdf',
      '3-3-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('物流舱随着旋钮 K 调大沿规律轨道迁移');
  });

  it('keeps handout summary outside mediaResources when parsing 3-3 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-3/media/3-3-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('根轨迹分析法');
    expect(parsed.handoutSummary).not.toContain('广义根轨迹');
    expect(parsed.handoutSummary).not.toContain('动态翻译');
  });

  it('keeps the classroom panels focused on root locus content instead of 3-2 residues', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('参数变化下的闭环根集合');
    expect(stepPanelsSource).toContain('先资格、后参数');
    expect(stepPanelsSource).toContain('G(s)H(s)=K/[s(s+1)(s+2)]');
    expect(stepPanelsSource).toContain('0<K<6');
    expect(stepPanelsSource).toContain('七步读图法');
    expect(stepPanelsSource).toContain('原点极点');
    expect(stepPanelsSource).toContain('九项法则共同构成普通根轨迹');
    expect(stepPanelsSource).not.toContain('0° 根轨迹');
    expect(stepPanelsSource).not.toContain('等效开环');
    expect(stepPanelsSource).not.toContain('时间常数例子');
    expect(stepPanelsSource).not.toContain('稳定区间：`-2 < k < 18`');

    expect(workspaceSource).toContain('STEP07_CARDS');
    expect(workspaceSource).toContain('STEP09_CARDS');
    expect(workspaceSource).toContain('STEP11_CARDS');
    expect(workspaceSource).toContain('WORKFLOW_SEQUENCE');
    expect(workspaceSource).toContain('CLASSIFICATION_CARDS');
    expect(workspaceSource).toContain('POSTTEST_QUESTIONS');
    expect(stepPanelsSource).not.toContain("case 'step-17'");
    expect(workspaceSource).not.toContain('RULE_HIGHLIGHT_OPTIONS');
    expect(workspaceSource).not.toContain('WORKED_EXAMPLE_SECTIONS');
    expect(workspaceSource).not.toContain('FORMULA_ORDERING_SEQUENCE');
    expect(workspaceSource).not.toContain('DYNAMIC_MAPPING_OPTIONS');
    expect(workspaceSource).not.toContain('BOUNDARY_MATCH_OPTIONS');
    expect(workspaceSource).not.toContain('CASE_BUCKETS');
  });

  it('routes step-05 and step-06 through the shared rust-driven control analysis workspace instead of handwritten panels', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const requestBuilderSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/unit-3-3-request-builder.ts'),
      'utf8',
    );
    const fixtureSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/unit-3-3-fixtures.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('RootLocusPanel');
    expect(stepPanelsSource).toContain('buildUnit33AnalysisRequest');
    expect(stepPanelsSource).toContain('getUnit33FallbackResult');
    expect(stepPanelsSource).not.toContain('function ConditionDragPanel');
    expect(stepPanelsSource).not.toContain('function SvgRuleProgression');

    expect(requestBuilderSource).toContain("case 'step-05'");
    expect(requestBuilderSource).toContain("case 'step-06'");
    expect(requestBuilderSource).toContain('currentGain');
    expect(requestBuilderSource).toContain('numerator: [1, 3.5]');
    expect(requestBuilderSource).toContain('denominator: [1, 2.9, 0.78]');
    expect(requestBuilderSource).toContain('G(s)H(s)=K/[s(s+2)(s+4)]');

    expect(fixtureSource).toContain('gain:');
    expect(fixtureSource).toContain('openLoopPoles: [pole(-2.6), pole(-0.3)]');
    expect(fixtureSource).toContain('openLoopZeros: [pole(-3.5)]');
    expect(fixtureSource).toContain('3-3 讲义基线结果');
  });

  it('keeps step-05 top formulas fixed and uses a left-root-locus right-parameter layout', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const axisPresetSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-bode-options.ts'),
      'utf8',
    );
    const fixtureSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/unit-3-3-fixtures.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('angle G_0(s_0)H(s_0)=(2\\\\ell+1)\\\\pi');
    expect(stepPanelsSource).toContain('K=1/|G_0(s_0)H(s_0)|');
    expect(stepPanelsSource).toContain('左图右参数');
    expect(stepPanelsSource).toContain('沿根轨迹吸附');
    expect(stepPanelsSource).toContain('selectedSample.gain');
    expect(stepPanelsSource).toContain('theta_{z1}');
    expect(stepPanelsSource).toContain('theta_{p1}');
    expect(stepPanelsSource).toContain('theta_{p2}');
    expect(stepPanelsSource).toContain('开环极点 p1');
    expect(stepPanelsSource).toContain('开环极点 p2');
    expect(axisPresetSource).toContain('unit-3-3-step-05-condition-workspace');
    expect(axisPresetSource).toContain('x: [-8, 1]');
    expect(fixtureSource).toContain('point(-1.42, 1.12, 3.1)');
    expect(fixtureSource).toContain('point(-1.42, -1.12, 3.1)');
    expect(fixtureSource).toContain('point(-1.26, 0.18, 1.95)');
    expect(fixtureSource).toContain('point(-1.26, -0.18, 1.95)');
  });

  it('keeps step-06 on one fixed workspace and shows poles plus complex asymptotes progressively', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const axisPresetSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-bode-options.ts'),
      'utf8',
    );
    const chartPanelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );
    const sharedMarkerSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/interactive-svg-markers.tsx'),
      'utf8',
    );

    expect(axisPresetSource).toContain('unit-3-3-step-06-skeleton-workspace');
    expect(axisPresetSource).toContain('x: [-8, 1]');
    expect(stepPanelsSource).toContain('开环极点：红色叉号，决定起点。');
    expect(stepPanelsSource).toContain('phase >= 1');
    expect(stepPanelsSource).toContain('asymptoteTargets');
    expect(stepPanelsSource).toContain('{ re: 0.75, im: 4.85 }');
    expect(stepPanelsSource).toContain('{ re: 0.75, im: -4.85 }');
    expect(chartPanelSource).toContain("getInteractiveSvgEChartsPointMarker('pole-cross'");
    expect(sharedMarkerSource).toContain('ECHARTS_POLE_CROSS_SYMBOL');
    expect(chartPanelSource).toContain('show: true');
    expect(chartPanelSource).toContain("data: ['根轨迹', '当前闭环极点', '开环极点', '开环零点']");
  });

  it('deduplicates step-08 and restores the full breakaway plus imaginary-axis derivation chain', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('候选点来自 dK/ds=0');
    expect(stepPanelsSource).toContain('先筛实轴区段');
    expect(stepPanelsSource).toContain('再筛 K>0');
    expect(stepPanelsSource).toContain('把 s=jω 代入闭环特征方程');
    expect(stepPanelsSource).toContain('由劳斯表首列临界条件求 K');
    expect(stepPanelsSource).toContain('再由辅助方程求虚轴交点频率');
    expect(stepPanelsSource).not.toContain('虚轴交点法则模块');
    expect(stepPanelsSource).not.toContain('breakaway');
    expect(stepPanelsSource).not.toContain('break-in');
    expect(stepPanelsSource).not.toContain('显示下一步');
  });

  it('restores complete worked-example reveal chains for step-09 and step-11', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('s^3+3s^2+2s+K=0');
    expect(stepPanelsSource).toContain('s=-1+\\\\sqrt{3}/3');
    expect(stepPanelsSource).toContain('K\\\\approx 0.3849');
    expect(stepPanelsSource).toContain('K=6');
    expect(stepPanelsSource).toContain('\\\\pm j\\\\sqrt{2}');
    expect(stepPanelsSource).toContain('26.565');
    expect(stepPanelsSource).toContain('\\phi_d');
    expect(stepPanelsSource).toContain('根之和 = -4');
    expect(stepPanelsSource).toContain('共轭对称');
    expect(stepPanelsSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(stepPanelsSource).not.toContain("{ title: '闭环特征方程', tone: 'emerald', formula: 's^3+3s^2+2s+K=0' }");
    expect(stepPanelsSource).not.toContain("{ title: '稳定范围', tone: 'amber', formula: '0<K<6' }");
    expect(stepPanelsSource).not.toContain('显示下一步');

    expect(workspaceSource).toContain('K=6 对应 s=±j√2');
    expect(workspaceSource).toContain('上半平面复极点的出射角');
  });

  it('syncs progressive reveal through teacher browse and reveal progress state instead of local-only counters', async () => {
    const courseSource = readFileSync(
      join(repoRoot, 'src/lib/unit-3-3-course.ts'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/teacher-page.tsx'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );

    expect(courseSource).toContain('browseEnabled: Record<string, boolean>;');
    expect(courseSource).toContain('teacherRevealProgress: Record<string, number>;');
    expect(courseSource).toContain('browseEnabled: input.browseEnabled');
    expect(courseSource).toContain('teacherRevealProgress: input.teacherRevealProgress');
    expect(studentPageSource).toContain('browseEnabled');
    expect(studentPageSource).toContain('revealProgress');
    expect(studentPageSource).toContain("(pageContract.teacherControls?.teacherStepReveal ?? 'not_applicable') === 'not_applicable'");
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');
    expect(teacherPageSource).toContain('localBrowseEnabled');
    expect(teacherPageSource).toContain('localTeacherRevealProgress');
    expect(teacherPageSource).toContain('revealProgress={teacherRevealProgress[step.id] ?? 0}');
    expect(stepPanelsSource).not.toContain('const [revealedCount, setRevealedCount]');
  });

  it('maps step-15 back to the generated closing infographic image', () => {
    const courseSource = readFileSync(
      join(repoRoot, 'src/lib/unit-3-3-course.ts'),
      'utf8',
    );

    expect(courseSource).toContain("'step-15': '/course-runtime/lessons/3-3/media/3-3-info.png'");
    expect(courseSource).not.toContain("'step-15': '/course-runtime/lessons/3-3/media/3-3-pp-08-dynamics-translation.svg'");
  });

  it('uses the global 3-3 AI context inside the student page without rendering a page-local AI assistant', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/teacher-page.tsx'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit33StepAIContext');
    expect(studentPageSource).not.toContain('getUnit32StepAIContext');
    expect(studentPageSource).not.toContain('UNIT_3_3StepAiAssistant');
    expect(teacherPageSource).not.toContain('UNIT_3_3StepAiAssistant');
    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(stepPanelsSource).not.toContain('useInteractiveAI');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');
  });

  it('does not render a placeholder submission shell for static reading pages', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('本页无需提交');
    expect(stepPanelsSource).not.toContain('本页以静态阅读和教师推进为主，不需要学生提交作答。');
  });

  it('uses semantic activity card titles instead of generic card numbering', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('卡片 1：');
    expect(stepPanelsSource).not.toContain('卡片 2：');
    expect(workspaceSource).toContain('实轴区段判断');
    expect(workspaceSource).toContain('渐近线重心与角度');
    expect(workspaceSource).toContain('真实分离点筛选');
    expect(workspaceSource).toContain('临界增益与虚轴交点');
    expect(workspaceSource).toContain('复极点出射角');
    expect(workspaceSource).toContain('根之和约束');
  });

  it('records the 3-3 implementation acceptance contract source', () => {
    const acceptance = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-3/notes/interactive-implementation-acceptance.json'),
        'utf8',
      ),
    ) as {
      lesson_id: string;
      review_mode: string;
      implementation_contract_source: string;
      reviewed_runtime_artifacts: string[];
    };

    expect(acceptance.lesson_id).toBe('3-3');
    expect(acceptance.review_mode).toBe('main_agent_fallback');
    expect(acceptance.implementation_contract_source).toBe('src/lib/unit-3-3-course.ts');
    expect(acceptance.reviewed_runtime_artifacts).toContain(
      'course-content/runtime/lessons/3-3/review/interactive-page-check.json',
    );
  });

  it('stabilizes activity spec dependencies to avoid browser-side render loops', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );

    const useMemoMatches = stepPanelsSource.match(/useMemo\(\(\) => getActivitySpec\(step\), \[step\]\)/g) ?? [];

    expect(useMemoMatches).toHaveLength(1);
    expect(stepPanelsSource).toContain("const activity = useMemo(() => getActivitySpec(step), [step]);");
    expect(stepPanelsSource).not.toContain('tab_switch');
    expect(stepPanelsSource).not.toContain('TAB_SWITCH_OPTIONS');
    expect(stepPanelsSource).not.toContain('}, [activity, savedResponse]);');
    expect(stepPanelsSource).toContain(
      "setSequence(savedResponse?.answers.order ? savedResponse.answers.order.split('||') : WORKFLOW_SEQUENCE.map((item) => item.id));",
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-bundle').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-bundle').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-bundle'));
});

describe('unit 3-5 interactive course', () => {
  it('registers the 3-5 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-5-zero-dynamic-improvement-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('零点引入与动态改善');
  });

  it('defines the full 16-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-5-course');

    expect(courseModule.UNIT_3_5_LESSON_STEPS).toHaveLength(15);
    expect(courseModule.UNIT_3_5_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_5_LESSON_STEPS[14]?.id).toBe('step-15');
  });

  it('exposes AI quick questions for the nonminimum-phase bandwidth-boundary step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-5-zero-dynamic-improvement-v1', 'step-14');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('带宽');
  });

  it('maps runtime media using the real 3-5 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-5-course');

    expect(courseModule.getUNIT_3_5MediaSrc('step-01')).toContain('3-5-cover-comic');
    expect(courseModule.getUNIT_3_5MediaSrc('step-04')).toContain('3-5-rl-01-low-order-zero-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-05')).toContain('3-5-rl-02-high-order-zero-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-07')).toContain('3-5-md-01-pd-rate-structure');
    expect(courseModule.getUNIT_3_5MediaSrc('step-09')).toContain('3-5-rl-03-pd-rate-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-13')).toContain('3-5-rl-05-nmp-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-15')).toContain('3-5-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-5/design/3-5-interactive-contract.yaml'),
        'utf8',
      ),
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

    const courseModule = await import('@/lib/unit-3-5-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_5_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = ['step-03', 'step-04', 'step-08', 'step-09', 'step-10', 'step-12', 'step-14', 'step-15'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_5_PAGE_CONTRACTS[stepId];

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

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-5-zero-dynamic-improvement')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变'),
    ).toEqual({
      routeSegment: 'unit-3-5-zero-dynamic-improvement',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('CourseEntryShell');
    expect(entrySource).toContain('<CourseEntryShell');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('parses the 3-5 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-5/media/3-5-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-5-intro-video.mp4',
      '3-5-audio.m4a',
      '3-5-slides.pdf',
      '3-5-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('零点');
  });

  it('keeps handout summary outside mediaResources when parsing 3-5 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-5/media/3-5-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('PD控制');
    expect(parsed.handoutSummary).toContain('非最小相位系统');
  });

  it('keeps the classroom panels focused on zero reallocation, PD/rate comparison, lead design and nonminimum-phase boundaries', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('测速反馈不显式增加前向零点');
    expect(stepPanelsSource).toContain('提高阻尼不等于结构相同');
    expect(stepPanelsSource).toContain('高频代价不能被省略');
    expect(stepPanelsSource).toContain('为什么非最小相对象往往要先保守带宽');
    expect(stepPanelsSource).not.toContain('劳斯判据');
    expect(stepPanelsSource).not.toContain('关键节点读图');

    expect(workspaceSource).toContain('PRETEST_QUESTIONS');
    expect(workspaceSource).toContain('RISK_TAG_OPTIONS');
    expect(workspaceSource).toContain('SCENARIO_SORT_COLUMNS');
    expect(workspaceSource).toContain('PHASE_PEAK_OPTIONS');
    expect(workspaceSource).toContain('RULE_CHECK_OPTIONS');
    expect(workspaceSource).not.toContain('WINDOW_TAG_OPTIONS');
  });

  it('renders step-08, step-11 and step-12 formulas through KaTeX instead of raw LaTeX text', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain("import 'katex/dist/katex.min.css';");
    expect(stepPanelsSource).toContain("import { BlockMath } from 'react-katex';");
    expect(stepPanelsSource).toContain('<BlockMath math={section.formula} />');
    expect(stepPanelsSource).not.toContain(
      "{section.formula ? <div className=\"mt-3 rounded-2xl bg-background/70 px-3 py-3 font-mono text-sm\">{section.formula}</div> : null}",
    );
    expect(stepPanelsSource).toContain("case 'step-08':");
    expect(stepPanelsSource).toContain("case 'step-11':");
    expect(stepPanelsSource).toContain("case 'step-12':");
  });

  it('uses the 3-5 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit35StepAIContext');
    expect(studentPageSource).not.toContain('getUnit34StepAIContext');
  });

  it('keeps AI hidden inside the global Konling context instead of rendering a page-level assistant', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).toContain('quickQuestions: stepContext.quickQuestions');
    expect(studentPageSource).not.toContain('UNIT_3_5StepAiAssistant');
    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(stepPanelsSource).not.toContain('useInteractiveAI');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');
    expect(stepPanelsSource).not.toContain('打开页内 AI');
  });

  it('keeps step-04 and step-05 on a single engine-driven root-locus workspace with only baseline and add-zero modes', () => {
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-5/design/3-5-interactive-page.md'),
      'utf8',
    );
    const rootWorkspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/root-locus-workspace.tsx'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(authoringPageSource).toContain('统一仿真引擎');
    expect(authoringPageSource).toContain('单根轨迹工作区');
    expect(authoringPageSource).toContain('基线');
    expect(authoringPageSource).toContain('添加零点');
    expect(authoringPageSource).not.toContain('示例A');
    expect(authoringPageSource).not.toContain('示例B');
    expect(authoringPageSource).not.toContain('添加极点');

    expect(stepPanelsSource).toContain('L_0(s)');
    expect(stepPanelsSource).toContain('L_3(s)');
    expect(stepPanelsSource).toContain('L_z(s)');
    expect(rootWorkspaceSource).toContain('基线');
    expect(rootWorkspaceSource).toContain('添加零点');
    expect(rootWorkspaceSource).not.toContain('示例A');
    expect(rootWorkspaceSource).not.toContain('示例B');
    expect(rootWorkspaceSource).not.toContain('添加极点');
    expect(rootWorkspaceSource).not.toContain('删除');
    expect(rootWorkspaceSource).toContain('samples: 240');
    expect(rootWorkspaceSource).not.toContain('InlineMath math={getPointMath');
    expect(rootWorkspaceSource).toContain('开环零点可直接拖动');
  });

  it('defines root-locus modes with locked baseline poles and one draggable add-zero mode', async () => {
    const workspaceModule = await import('@/features/interactive/unit-3-5-zero-dynamic-improvement/workspace');

    const step04Config = workspaceModule.UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG['step-04'];
    const step05Config = workspaceModule.UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG['step-05'];

    expect(step04Config.modes.map((mode) => mode.label)).toEqual(['基线', '添加零点']);
    expect(step05Config.modes.map((mode) => mode.label)).toEqual(['基线', '添加零点']);
    expect(step04Config.modes).toHaveLength(2);
    expect(step05Config.modes).toHaveLength(2);
    expect(step04Config.modes[0]?.points.every((point) => point.draggable === false)).toBe(true);
    expect(step05Config.modes[0]?.points.every((point) => point.draggable === false)).toBe(true);
    expect(
      step04Config.modes[1]?.points.filter((point) => point.kind === 'zero').every((point) => point.draggable === true),
    ).toBe(true);
    expect(
      step05Config.modes[1]?.points.filter((point) => point.kind === 'zero').every((point) => point.draggable === true),
    ).toBe(true);
    expect(
      step04Config.modes[1]?.points.filter((point) => point.kind === 'pole').every((point) => point.draggable === false),
    ).toBe(true);
  });

  it('uses named evidence modules instead of generic formula cards in later steps', async () => {
    const courseModule = await import('@/lib/unit-3-5-course');
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-5/design/3-5-interactive-page.md'),
      'utf8',
    );
    const contractSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-5/design/3-5-interactive-contract.yaml'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(courseModule.UNIT_3_5_LESSON_STEPS.find((step) => step.id === 'step-06')?.title).toBe(
      '第一收束：左半平面零点常改善动态，右半平面零点需另看边界',
    );
    expect(authoringPageSource).not.toContain('左半平面零点改善趋势与右半平面问号');
    expect(contractSource).not.toContain('左半平面零点改善趋势与右半平面问号');
    expect(stepPanelsSource).not.toContain('固定公式');
    expect(stepPanelsSource).toContain('被控对象');
    expect(stepPanelsSource).toContain('相应的闭环传递函数');
    expect(stepPanelsSource).toContain('PD 等效特征方程');
    expect(stepPanelsSource).toContain('测速反馈等效特征方程');
    expect(stepPanelsSource).not.toContain("G_p(s)=\\frac{4}{s(s+0.8)},\\qquad T_0(s)=\\frac{4}{s^2+0.8s+4}");
    expect(stepPanelsSource).toContain('三域指标速记');
    expect(stepPanelsSource).toContain('课堂判断锚点');
  });

  it('keeps the missing step-07 to step-13 handout evidence explicit and ordered in the runtime page source', () => {
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-5/design/3-5-interactive-page.md'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(authoringPageSource).toContain('闭环传递函数');
    expect(authoringPageSource).toContain('等效阻尼推导链');
    expect(authoringPageSource).toContain('沿用上一步对象');
    expect(authoringPageSource).toContain('理想 PD 控制器');
    expect(authoringPageSource).toContain('幅频特性');
    expect(authoringPageSource).toContain('相频特性');
    expect(authoringPageSource).toContain('超前网络标准形式');
    expect(authoringPageSource).toContain('最小相开环对象');
    expect(authoringPageSource).toContain('非最小相开环对象');
    expect(authoringPageSource).toContain('图 6');
    expect(authoringPageSource).toContain('5.4');
    expect(authoringPageSource).toContain('保守带宽实例表');

    expect(stepPanelsSource).toContain('G_p(s)=');
    expect(stepPanelsSource).toContain('T_0(s)=');
    expect(stepPanelsSource).toContain('等效阻尼推导链');
    expect(stepPanelsSource).toContain('K_d=K_t=');
    expect(stepPanelsSource).toContain('问题：测速反馈是否在前向通道显式增加零点？');
    expect(stepPanelsSource).toContain('沿用上一步对象');
    expect(stepPanelsSource).toContain('理想 PD 控制器');
    expect(stepPanelsSource).toContain('频率特性');
    expect(stepPanelsSource).toContain('幅频特性');
    expect(stepPanelsSource).toContain('相频特性');
    expect(stepPanelsSource).toContain('G_{PD}(s)=1+T_d s');
    expect(stepPanelsSource).toContain('超前网络标准形式');
    expect(stepPanelsSource).toContain('最大超前角出现频率');
    expect(stepPanelsSource).toContain('最大超前角');
    expect(stepPanelsSource).toContain('超前不是持续抬整个中高频');
    expect(stepPanelsSource).toContain('最小相开环对象');
    expect(stepPanelsSource).toContain('非最小相开环对象');
    expect(stepPanelsSource).toContain('现象与分析');
    expect(stepPanelsSource).toContain('图 6');
    expect(stepPanelsSource).toContain('| 结构 | 交叉频率 | 相角裕度 | 频域解释 |');
    expect(stepPanelsSource).toContain('| 结构 | 更适合的场景 | 不适合的场景 | 一句话概括 |');
    expect(stepPanelsSource).toContain('| 增益 | 最深逆响应 | 最大峰值 | 解读 |');
    expect(stepPanelsSource.indexOf('沿用上一步对象')).toBeLessThan(stepPanelsSource.indexOf('理想 PD 控制器'));
    expect(stepPanelsSource.indexOf('理想 PD 控制器')).toBeLessThan(stepPanelsSource.indexOf('频率特性'));
    expect(stepPanelsSource.indexOf('频率特性')).toBeLessThan(stepPanelsSource.indexOf('幅频特性'));
    expect(stepPanelsSource.indexOf('幅频特性')).toBeLessThan(stepPanelsSource.indexOf('相频特性'));
    expect(stepPanelsSource.indexOf('最小相开环对象')).toBeLessThan(stepPanelsSource.indexOf('现象与分析'));
    expect(stepPanelsSource.indexOf('现象与分析')).toBeLessThan(stepPanelsSource.indexOf('| 增益 | 最深逆响应 | 最大峰值 | 解读 |'));
  });

  it('renders step-15 observation modules as a compact four-card summary', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('根轨迹观察量');
    expect(stepPanelsSource).toContain('时域观察量');
    expect(stepPanelsSource).toContain('频域观察量');
    expect(stepPanelsSource).toContain('结构判断观察量');
    expect(stepPanelsSource).toContain('sm:grid-cols-2');
  });

  it('reveals step-10 and step-11 formulas progressively from the bottom card', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('点击本卡揭示下一层');
    expect(stepPanelsSource).toContain('revealedCount');
    expect(stepPanelsSource).toContain('setRevealedCount');
  });
});

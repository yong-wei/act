import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStepQuickQuestions } from '@/lib/course-ai-contexts';
import * as unit21Course from '@/lib/unit-2-1-course';
import {
  getUNIT_2_1MediaSrc,
  UNIT_2_1_LESSON_STEPS,
  UNIT_2_1_PAGE_CONTRACTS,
} from '@/lib/unit-2-1-course';

const repoRoot = process.cwd();

describe('unit 2-1 interactive course', () => {
  it('defines the full 16-step lesson flow', () => {
    expect(UNIT_2_1_LESSON_STEPS).toHaveLength(16);
    expect(UNIT_2_1_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_2_1_LESSON_STEPS[15]?.id).toBe('step-16');
  });

  it('exposes AI quick questions for the initial-state comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-2-1-modeling-language-v1', 'step-07');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('初值');
  });

  it('maps runtime media for representative modeling-language steps', () => {
    expect(getUNIT_2_1MediaSrc('step-02')).toContain('2-1-cover-comic.png');
    expect(getUNIT_2_1MediaSrc('step-10')).toContain('2-1-md-05-ship-heading-physical-blocks.png');
    expect(getUNIT_2_1MediaSrc('step-16')).toContain('2-1-info.png');
  });

  it('keeps key handout formulas and tables as explicit page coverage metadata', () => {
    const step02 = UNIT_2_1_LESSON_STEPS.find((step) => step.id === 'step-02');
    const step06 = UNIT_2_1_LESSON_STEPS.find((step) => step.id === 'step-06');
    const step08 = UNIT_2_1_LESSON_STEPS.find((step) => step.id === 'step-08');
    const step12 = UNIT_2_1_LESSON_STEPS.find((step) => step.id === 'step-12');

    expect(step02?.coverage.requiredFormulas).toContain('J\\ddot{\\theta}(t)+B\\dot{\\theta}(t)=Ku(t)');
    expect(step06?.coverage.requiredFormulas).toContain('G(s)=\\frac{Y(s)}{U(s)}\\bigg|_{\\text{零初值}}');
    expect(step08?.coverage.requiredTables?.[0]?.headers).toEqual([
      '典型环节',
      '传递函数形式',
      '你应先抓住的物理或工程含义',
      '第一眼判断',
    ]);
    expect(step12?.coverage.requiredFormulas).toContain('\\frac{Y(s)}{R(s)}=\\frac{\\sum_{k=1}^{N} P_k \\Delta_k}{\\Delta}');
  });

  it('defines handout coverage contracts for core formulas, tables and conclusions', () => {
    expect('UNIT_2_1_STEP_CONTENT_CONTRACTS' in unit21Course).toBe(true);

    const contracts = (unit21Course as Record<string, unknown>).UNIT_2_1_STEP_CONTENT_CONTRACTS as
      | Record<string, {
          requiredFormulas?: string[];
          requiredTableTitles?: string[];
          requiredConclusions?: string[];
        }>
      | undefined;

    expect(contracts?.['step-02']?.requiredFormulas).toContain('J\\ddot{\\theta}(t)+B\\dot{\\theta}(t)=Ku(t)');
    expect(contracts?.['step-06']?.requiredFormulas).toContain('G(s)=\\frac{Y(s)}{U(s)}\\bigg|_{\\text{零初值}}');
    expect(contracts?.['step-08']?.requiredTableTitles).toContain('五类典型环节及其第一判断');
    expect(contracts?.['step-12']?.requiredFormulas).toContain('\\frac{Y(s)}{R(s)}=\\frac{\\sum P_k\\Delta_k}{\\Delta}');
    expect(contracts?.['step-16']?.requiredConclusions).toContain('对象建立 -> 对象识别 -> 结构表达 -> 总体对象');
  });

  it('extends coverage contracts to the revised static anchors in step-05, step-07, step-13 and step-14', () => {
    const contracts = (unit21Course as Record<string, unknown>).UNIT_2_1_STEP_CONTENT_CONTRACTS as
      | Record<string, {
          requiredFormulas?: string[];
          requiredTableTitles?: string[];
          requiredConclusions?: string[];
        }>
      | undefined;

    expect(contracts?.['step-05']?.requiredFormulas).toEqual(
      expect.arrayContaining([
        'F(s)=\\mathcal{L}\\{f(t)\\}',
        '\\mathcal{L}\\{\\dot f(t)\\}=sF(s)',
        '\\mathcal{L}\\{\\ddot f(t)\\}=s^2F(s)',
      ]),
    );
    expect(contracts?.['step-05']?.requiredTableTitles).toContain('本课最少要记住的拉氏对应关系');
    expect(contracts?.['step-07']?.requiredFormulas).toEqual(
      expect.arrayContaining([
        'Y(s)=G(s)U(s)',
        'Y(s)=G(s)U(s)+\\text{初值项}',
      ]),
    );
    expect(contracts?.['step-13']?.requiredFormulas).toEqual(
      expect.arrayContaining([
        '\\displaystyle G(s)=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)}',
        '\\displaystyle \\Phi(s)=\\frac{Y(s)}{R(s)}=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)+K_cK_pK_h}',
      ]),
    );
    expect(contracts?.['step-14']?.requiredFormulas).toEqual(
      expect.arrayContaining([
        'P_1=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)}',
        'L_1=-\\frac{K_cK_pK_h}{s(T_as+1)(T_ps+1)}',
        '\\Delta=1-L_1',
        '\\Delta_1=1',
      ]),
    );
    expect(contracts?.['step-14']?.requiredConclusions).toContain('附录补充情形下，只有存在不接触该前向通路的局部回路时，才会出现 \\Delta_k=1-L_1。');
  });

  it('renders core formulas and static coverage instead of only summaries', () => {
    const source = readFileSync(join(repoRoot, 'src/features/interactive/unit-2-1-modeling-language/step-panels.tsx'), 'utf8');

    expect(source).toContain('G(s)=\\frac{Y(s)}{U(s)}\\bigg|_{\\text{零初值}}');
    expect(source).toContain('五类典型环节及其第一判断');
    expect(source).toContain('\\frac{Y(s)}{R(s)}=\\frac{\\sum P_k\\Delta_k}{\\Delta}');
  });

  it('renders the revised static formulas for step-05, step-07, step-13 and step-14', () => {
    const source = readFileSync(join(repoRoot, 'src/features/interactive/unit-2-1-modeling-language/step-panels.tsx'), 'utf8');

    expect(source).toContain('F(s)=\\mathcal{L}\\{f(t)\\}');
    expect(source).toContain('\\mathcal{L}\\{\\dot f(t)\\}=sF(s)');
    expect(source).toContain('对象项 / 初值项双列对照');
    expect(source).toContain('Y(s)=G(s)U(s)+\\text{初值项}');
    expect(source).toContain('\\displaystyle G(s)=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)}');
    expect(source).toContain('\\Delta_1=1');
    expect(source).toContain('\\Delta_k=1-L_1');
  });

  it('keeps the authoring interactive design aligned with the revised static formula requirements', () => {
    const designSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/2-1/design/interactive-page.md'),
      'utf8',
    );

    expect(designSource).toContain('F(s)=\\mathcal{L}\\{f(t)\\}');
    expect(designSource).toContain('\\mathcal{L}\\{\\dot f(t)\\}=sF(s)');
    expect(designSource).toContain('对象项 / 初值项');
    expect(designSource).toContain('\\Delta_1=1');
    expect(designSource).toContain('附录补充情形');
    expect(designSource).toContain('\\Delta_k=1-L_1');
  });

  it('adds the new 2-1 public course routes and removes retired module 1 public routes', () => {
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/page.tsx'))).toBe(true);

    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/page.tsx'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-1-2-block-diagram-simplification/page.tsx'))).toBe(false);
  });

  it('ships a machine-readable interactive contract for 2-1 with the revised step-08 drag-match design', () => {
    const contractPath = join(
      repoRoot,
      'course-content/authoring/lessons/2-1/design/interactive-contract.yaml',
    );

    expect(existsSync(contractPath)).toBe(true);

    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
      preview_mode: { default_entry: string; student_demo_base_path: string };
      required_step_fields: string[];
      steps: Record<string, {
        interaction_spec: { interaction_kind: string; distractors?: string[] };
        preview_contract: { route_kind: string; demo_path: string };
        telemetry_spec: { summary_fields: string[] };
        ai_context_spec: { allowed_scope: string[]; forbidden_scope: string[] };
      }>;
    };

    expect(contract.preview_mode.default_entry).toBe('student_demo');
    expect(contract.preview_mode.student_demo_base_path).toBe(
      '/interactive-learning/courses/unit-2-1-modeling-language/student/demo',
    );
    expect(contract.required_step_fields).toEqual(
      expect.arrayContaining([
        'layout',
        'modules',
        'content_blocks',
        'interaction_spec',
        'teacher_controls',
        'telemetry_spec',
        'teacher_insight_spec',
        'ai_context_spec',
        'preview_contract',
        'acceptance_checks',
      ]),
    );

    expect(contract.steps['step-08']?.interaction_spec.interaction_kind).toBe('drag_match');
    expect(contract.steps['step-08']?.interaction_spec.distractors?.length).toBeGreaterThan(0);
    expect(contract.steps['step-08']?.preview_contract.route_kind).toBe('student_demo');
    expect(contract.steps['step-08']?.preview_contract.demo_path).toContain('/student/demo?step=step-08');
    expect(contract.steps['step-08']?.telemetry_spec.summary_fields).toEqual(
      expect.arrayContaining(['attemptCount', 'resultState', 'misconceptionTags']),
    );
    expect(contract.steps['step-08']?.ai_context_spec.allowed_scope).toContain('典型环节第一眼识别');
    expect(contract.steps['step-08']?.ai_context_spec.forbidden_scope).toContain('提前展开2-2时域响应分析');
  });

  it('makes the teacher-side preset preview point to the real student demo page as the default preview surface', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/teacher/preset-lessons/preset-lesson-preview.tsx'),
      'utf8',
    );

    expect(source).toContain('学生页预览');
    expect(source).toContain('/student/demo');
    expect(source).toContain('所见即所得');
  });

  it('keeps local page contracts aligned with the key layout order from the authoring contract', () => {
    expect(UNIT_2_1_PAGE_CONTRACTS['step-02']).toMatchObject({
      layout: {
        template: 'cover_top_formula_then_judge',
        regions: [
          { id: 'comic', order: 1 },
          { id: 'equation', order: 2 },
          { id: 'interaction', order: 3 },
        ],
      },
      interactionKind: 'binary_choice',
    });

    expect(UNIT_2_1_PAGE_CONTRACTS['step-13']).toMatchObject({
      layout: {
        template: 'prompt_image_then_worked_example',
        regions: [
          { id: 'diagram-zone', order: 1 },
          { id: 'step-cards', order: 2 },
          { id: 'check-zone', order: 3 },
        ],
      },
      interactionKind: 'choice_check',
    });

    expect(UNIT_2_1_PAGE_CONTRACTS['step-14']).toMatchObject({
      layout: {
        template: 'prompt_image_then_path_reasoning',
        regions: [
          { id: 'highlight-stage', order: 1 },
          { id: 'formula-chain', order: 2 },
          { id: 'explain-box', order: 3 },
        ],
      },
      interactionKind: 'path_highlight',
    });
  });

  it('promotes the redesigned participatory steps to their real interaction page types instead of form fallbacks', () => {
    const pageTypes = new Map(UNIT_2_1_LESSON_STEPS.map((step) => [step.id, step.pageType]));

    expect(pageTypes.get('step-08')).toBe('drag_match');
    expect(pageTypes.get('step-10')).toBe('hotspot_labeling');
    expect(pageTypes.get('step-11')).toBe('bucket_sort');
    expect(pageTypes.get('step-12')).toBe('drag_match');
    expect(pageTypes.get('step-13')).toBe('choice_check');
    expect(pageTypes.get('step-14')).toBe('path_highlight');
  });
});

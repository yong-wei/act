import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStepQuickQuestions } from '@/lib/course-ai-contexts';

const repoRoot = process.cwd();

describe('unit 3-2 remediation guards', () => {
  it('uses the generalized characteristic equation for the introduction object instead of the later parametric family', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );
    const step02Block = panelSource.match(/case 'step-02':[\s\S]*?case 'step-03':/)?.[0] ?? '';

    expect(step02Block).toContain("formula: 'D(s)=a_ns^n+a_{n-1}s^{n-1}+\\\\cdots+a_1s+a_0=0'");
    expect(step02Block).not.toContain('D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)');
  });

  it('removes page-level AI entry and keeps 3-2 questions in global assistant context only', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/student-page.tsx'),
      'utf8',
    );
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );

    expect(studentPageSource).not.toContain('UNIT_3_2StepAiAssistant');
    expect(panelSource).not.toContain('页内 AI 助手');
    expect(panelSource).not.toContain('打开页内 AI');
    expect(panelSource).not.toContain('InteractiveAIPanel');
  });

  it('replaces regression-prone static figures with process pages or live workspaces', async () => {
    const courseModule = await import('@/lib/unit-3-2-course');

    expect(courseModule.getUNIT_3_2MediaSrc('step-02')).toBeNull();
    expect(courseModule.getUNIT_3_2MediaSrc('step-08')).toBeNull();
    expect(courseModule.getUNIT_3_2MediaSrc('step-09')).toBeNull();
    expect(courseModule.getUNIT_3_2MediaSrc('step-10')).toBeNull();
    expect(courseModule.getUNIT_3_2MediaSrc('step-11')).toBeNull();
  });

  it('makes quick questions explicit about the current formula object and task', () => {
    const introQuestions = getStepQuickQuestions('unit-3-2-routh-stability-boundary-v1', 'step-02');
    const ordinaryRouthQuestions = getStepQuickQuestions('unit-3-2-routh-stability-boundary-v1', 'step-04');
    const fullZeroRowQuestions = getStepQuickQuestions('unit-3-2-routh-stability-boundary-v1', 'step-08');
    const shiftedConstraintQuestions = getStepQuickQuestions('unit-3-2-routh-stability-boundary-v1', 'step-11');

    expect(introQuestions[0]?.question).toContain('闭环特征方程');
    expect(ordinaryRouthQuestions[0]?.question).toContain('k=4');
    expect(fullZeroRowQuestions[0]?.question).toContain('全零行');
    expect(shiftedConstraintQuestions[0]?.question).toContain('Re(s)<-0.5');
  });

  it('mounts a dedicated 3-2 analysis workspace for root-locus, time-domain and bode remediation steps', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/analysis-workspace.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('UNIT_3_2DynamicAnalysisPanel');
    expect(workspaceSource).toContain('典型值');
    expect(workspaceSource).toContain('根轨迹');
  });

  it('uses click-to-advance progressive reveal instead of rendering placeholder cards for all hidden steps', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('点击当前最下方已显影步骤可继续展开下一层。');
    expect(panelSource).toContain('items.slice(0, visibleCount)');
    expect(panelSource).not.toContain('等待教师显影后显示本步骤的公式与解释。');
  });

  it('renders formula-bearing titles and reveal labels through inline KaTeX-safe text instead of plain strings', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/analysis-workspace.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('function renderInlineMathText(text: string)');
    expect(panelSource).toContain('function getRenderedStepTitle(step: UNIT_3_2StepDefinition)');
    expect(panelSource).toContain('{renderInlineMathText(getRenderedStepTitle(step))}');
    expect(panelSource).toContain('{renderInlineMathText(section.title)}');
    expect(panelSource).toContain('{renderInlineMathText(item.label)}');
    expect(panelSource).toContain("label: '列 $s^4$、$s^3$ 行'");
    expect(panelSource).toContain("label: '求 $s^1$ 行'");
    expect(panelSource).toContain("'$\\\\frac{38-k}{5}>0\\\\Rightarrow k<38$'");
    expect(panelSource).toContain("'$\\\\frac{k^2-13k-90}{k-38}>0\\\\Rightarrow -2<k<18\\\\ \\\\text{或}\\\\ k>38$'");
    expect(panelSource).toContain("'$s^0$ 行条件负责托住左端点。'");
    expect(panelSource).toContain("'合并条件后，$k>38$ 被前一行符号条件排除。'");
    expect(panelSource).toContain("label: '写出首位为 0 的 $s^2$ 行'");
    expect(panelSource).toContain("'当 $\\\\varepsilon\\\\to0^+$ 时，$6-\\\\frac{10}{\\\\varepsilon}<0$。'");
    expect(panelSource).toContain("label: '确认 $s^1$ 行整行为 0'");
    expect(panelSource).toContain("label: '写变量平移 $s=z-\\\\frac12$'");
    expect(panelSource).toContain("'$\\\\frac{31-4k}{12}>0\\\\Rightarrow k<\\\\frac{31}{4}$'");
    expect(panelSource).toContain("return '变量平移——把 $\\\\operatorname{Re}(s)<-0.5$ 转成普通劳斯判定';");
    expect(workspaceSource).toContain("import { BlockMath, InlineMath } from 'react-katex';");
    expect(workspaceSource).toContain("<InlineMath math={'P(s)=s^4+5s^3+9s^2+7s+2'} />");
  });

  it('removes implementation-language leaks from the 3-2 content and workspace copy', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/analysis-workspace.tsx'),
      'utf8',
    );

    expect(panelSource).not.toContain('教师逐步显影');
    expect(workspaceSource).not.toContain('text-base font-semibold">UNIT_3_2AnalysisWorkspace');
    expect(workspaceSource).not.toContain('Rust/WASM');
    expect(workspaceSource).not.toContain('左侧固定使用 Rust/WASM 驱动的根轨迹');
  });
});

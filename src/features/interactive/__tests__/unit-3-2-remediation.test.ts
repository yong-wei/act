import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStepQuickQuestions } from '@/lib/course-ai-contexts';

const repoRoot = process.cwd();

describe('unit 3-2 remediation guards', () => {
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

    expect(panelSource).toContain('UNIT_3_2AnalysisWorkspace');
    expect(panelSource).toContain('典型值');
    expect(panelSource).toContain('根轨迹');
  });
});

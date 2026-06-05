import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';
import { ControlWorkbenchShell } from '../shell/control-workbench-shell';
import type { ControlWorkbenchRouteParams } from '../types';

function resolveSession(params: ControlWorkbenchRouteParams) {
  const result = resolveControlWorkbenchSession(params);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

describe('control workbench design flow derivation', () => {
  it('derives an ordered white-box challenge flow from task, preset, object, and methods', () => {
    const session = resolveSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    expect(session.designFlow.modeLabel).toBe('挑战模式');
    expect(session.designFlow.taskLabel).toBe('二阶对象快速稳定挑战');
    expect(session.designFlow.objectLabel).toBe('二阶欠阻尼对象');
    expect(session.designFlow.methodBoundary).toContain('串联校正');
    expect(session.designFlow.methodBoundary).toContain('PID');
    expect(session.designFlow.currentStep.id).toBe('object-analysis');
    expect(session.designFlow.nextAction).toContain('确认对象');
    expect(session.designFlow.steps.map((step) => step.id)).toEqual([
      'object-analysis',
      'controller-design',
      'performance-comparison',
      'constraint-check',
      'official-submission',
      'review',
    ]);
  });

  it('keeps assignment flow tied to the assignment context without changing task semantics', () => {
    const session = resolveSession({
      arenaTask: 'task-second-order-lead-pid',
      publicationId: 'publication-1',
      classId: 'class-a',
    });

    expect(session.designFlow.modeLabel).toBe('作业模式');
    expect(session.designFlow.contextLabel).toContain('班级作业');
    expect(session.designFlow.currentStep.id).toBe('object-analysis');
    expect(session.designFlow.steps.find((step) => step.id === 'official-submission')?.status).toBe('available');
  });

  it('derives an explore flow with official submission locked out', () => {
    const session = resolveSession({
      mode: 'explore',
      preset: 'classic-four-view',
      objectId: 'plant-first-order-lag',
    });

    expect(session.designFlow.modeLabel).toBe('自由探索模式');
    expect(session.designFlow.taskLabel).toBe('综合仿真工作台');
    expect(session.designFlow.objectLabel).toBe('一阶惯性对象');
    expect(session.designFlow.currentStep.id).toBe('object-analysis');
    expect(session.designFlow.steps.find((step) => step.id === 'official-submission')?.status).toBe('locked');
  });

  it('starts black-box challenge flow from experiment planning and nominal-model construction', () => {
    const session = resolveSession({
      arenaTask: 'task-cruise-roll-blackbox-identification',
    });

    expect(session.designFlow.modeLabel).toBe('挑战模式');
    expect(session.designFlow.contextLabel).toContain('黑箱对象');
    expect(session.designFlow.methodBoundary).toContain('黑箱控制');
    expect(session.designFlow.currentStep.id).toBe('experiment-planning');
    expect(session.designFlow.nextAction).toContain('实验数据');
    expect(session.designFlow.steps.map((step) => step.id)).toEqual([
      'experiment-planning',
      'nominal-model',
      'controller-design',
      'performance-comparison',
      'constraint-check',
      'official-submission',
      'review',
    ]);
  });

  it('maps odyssey sessions to review context in the design flow', () => {
    const session = resolveSession({
      arenaTask: 'task-odyssey-level-one-growth',
    });

    expect(session.mode).toBe('odyssey');
    expect(session.designFlow.modeLabel).toBe('复盘模式');
    expect(session.designFlow.contextLabel).toContain('闯关复盘');
    expect(session.designFlow.currentStep.id).toBe('review');
    expect(session.designFlow.steps.find((step) => step.id === 'review')?.title).toBe('结果复盘');
    expect(session.designFlow.steps.find((step) => step.id === 'review')?.status).toBe('active');
  });
});

describe('control workbench design flow shell', () => {
  it('renders the current design context while preserving panel controls', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    const html = renderToStaticMarkup(createElement(ControlWorkbenchShell, { result }));

    expect(html).toContain('设计流程');
    expect(html).toContain('当前步骤');
    expect(html).toContain('对象边界');
    expect(html).toContain('方法边界');
    expect(html).toContain('下一行动');
    expect(html).toContain('对象分析');
    expect(html).toContain('添加时域响应');
    expect(html).toContain('重置默认');
  });

  it('renders panel evidence explanations inside the workbench shell', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    const html = renderToStaticMarkup(createElement(ControlWorkbenchShell, { result }));

    expect(html).toContain('设计证据说明');
    expect(html).toContain('时域响应证据');
    expect(html).toContain('官方评价以提交后的 Arena 评测为准');
  });

  it('keeps the primary instrument before secondary setup sheets in the mission workspace', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    const html = renderToStaticMarkup(createElement(ControlWorkbenchShell, { result }));

    const contextIndex = html.indexOf('data-commercial-workspace-zone="context-strip"');
    const instrumentIndex = html.indexOf('data-commercial-workspace-zone="instrument-area"');
    const sheetIndex = html.indexOf('data-workspace-mobile-sheets="secondary-controls"');
    const commandIndex = html.indexOf('data-commercial-workspace-zone="command-bar"');
    const evidenceIndex = html.indexOf('data-commercial-workspace-zone="evidence-rail"');

    expect(contextIndex).toBeGreaterThanOrEqual(0);
    expect(instrumentIndex).toBeGreaterThan(contextIndex);
    expect(sheetIndex).toBeGreaterThan(instrumentIndex);
    expect(commandIndex).toBeGreaterThan(sheetIndex);
    expect(evidenceIndex).toBeGreaterThan(sheetIndex);
    expect(html).toContain('data-primary-instrument-entry="control-workbench"');
    expect(html).toContain('data-current-workspace-step="object-analysis"');
    expect(html).toContain('data-primary-view-entry="control-workbench-instrument"');
    expect(html).toContain('data-workspace-mobile-sheet="design-flow"');
    expect(html).toContain('data-workspace-mobile-sheet="panel-setup"');
    expect(html).toContain('data-workspace-mobile-sheet="evidence-rail"');
    expect(html).toContain('data-evidence-flow-target="/profile/evidence"');
    expect(html).toContain('data-task-workspace-zone="floating-dock-safe-area"');
  });

  it('moves explore object selection into a secondary workspace sheet', () => {
    const result = resolveControlWorkbenchSession({
      mode: 'explore',
      preset: 'classic-four-view',
      objectId: 'plant-first-order-lag',
    });

    const html = renderToStaticMarkup(createElement(ControlWorkbenchShell, { result }));

    expect(html).toContain('data-workspace-mobile-sheet="object-selection"');
    expect(html.indexOf('data-commercial-workspace-zone="instrument-area"')).toBeLessThan(
      html.indexOf('data-workspace-mobile-sheet="object-selection"'),
    );
  });
});

import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';
import {
  buildDefaultWorkbenchPanelInstances,
  getWorkbenchViewPlugin,
  WORKBENCH_VIEW_PLUGINS,
} from '../views';

function getSessionForTask(taskId: string) {
  const result = resolveControlWorkbenchSession({ arenaTask: taskId });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

function explanationText(explanations: unknown[]) {
  return JSON.stringify(explanations);
}

describe('workbench evidence explanations', () => {
  it('declares explanation providers for every supported workbench view plugin', () => {
    for (const plugin of WORKBENCH_VIEW_PLUGINS) {
      expect(typeof (plugin as { getExplanations?: unknown }).getExplanations).toBe('function');
    }
  });

  it('explains white-box time-domain evidence without presenting preview data as official scoring', () => {
    const session = getSessionForTask('task-second-order-lead-pid');
    const panel = buildDefaultWorkbenchPanelInstances(session).find((item) => item.viewId === 'time-domain');
    expect(panel).toBeDefined();

    const plugin = getWorkbenchViewPlugin('time-domain') as {
      getExplanations?: (inputSession: typeof session, inputPanel: NonNullable<typeof panel>) => unknown[];
    };
    const explanations = plugin.getExplanations?.(session, panel!);
    const text = explanationText(explanations ?? []);

    expect(explanations?.length).toBeGreaterThan(0);
    expect(text).toContain('参考输入');
    expect(text).toContain('未校正输出');
    expect(text).toContain('校正后输出');
    expect(text).toContain('官方评价以提交后的 Arena 评测为准');
    expect(text).not.toContain('官方榜单结果已确定');
  });

  it('keeps black-box evidence explanations aggregate and private', () => {
    const session = getSessionForTask('task-cruise-roll-blackbox-identification');
    const panels = buildDefaultWorkbenchPanelInstances(session);
    const explanations = panels.flatMap((panel) => {
      const plugin = getWorkbenchViewPlugin(panel.viewId) as {
        getExplanations?: (inputSession: typeof session, inputPanel: typeof panel) => unknown[];
      } | undefined;
      return plugin?.getExplanations?.(session, panel) ?? [];
    });
    const text = explanationText(explanations);

    expect(explanations.length).toBeGreaterThan(0);
    expect(text).toContain('实验预算');
    expect(text).toContain('学生名义模型');
    expect(text).toContain('不展示官方隐藏对象');
    expect(text).toContain('官方评价以提交后的 Arena 评测为准');
    expect(text).not.toMatch(/transferFunction|numerator|denominator|hiddenScenario|target trajectory|scenario order/);
    expect(text).not.toMatch(/隐藏对象参数|目标轨迹|场景顺序|官方隐藏对象结构/);
  });
});

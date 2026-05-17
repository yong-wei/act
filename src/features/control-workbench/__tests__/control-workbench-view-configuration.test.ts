import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';
import {
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
  WORKBENCH_VIEW_PLUGINS,
} from '../views';

function getSessionForTask(taskId: string) {
  const result = resolveControlWorkbenchSession({ arenaTask: taskId });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

describe('control workbench view configuration', () => {
  it('declares classic view plugins for the four canonical workbench views', () => {
    expect(WORKBENCH_VIEW_PLUGINS.map((plugin) => plugin.id)).toEqual([
      'time-domain',
      'bode',
      'root-locus',
      'nyquist',
      'experiment-dataset',
      'identification',
      'response-comparison',
      'control-effort',
      'metric-summary',
    ]);
  });

  it('uses classic white-box defaults for four-view signal and curve selection', () => {
    const configs = getPresetDefaultViewConfigs('classic-whitebox');

    expect(configs.map((config) => config.id)).toEqual(['time-domain', 'bode', 'root-locus', 'nyquist']);
    expect(configs.find((config) => config.id === 'time-domain')?.selectedOptions).toEqual([
      'reference',
      'uncorrected-output',
      'corrected-output',
    ]);
    expect(configs.find((config) => config.id === 'root-locus')?.selectedOptions).toEqual([
      'corrected-root-locus',
    ]);
  });

  it('marks root locus unavailable for black-box sessions without a nominal model', () => {
    const session = getSessionForTask('task-cruise-roll-blackbox-identification');
    const rootLocus = getWorkbenchViewPlugin('root-locus');

    expect(rootLocus?.getAvailability(session)).toMatchObject({
      available: false,
      reason: expect.stringContaining('暂无公开传递函数或名义模型'),
    });
  });

  it('disables unsupported time-domain signals without synthesizing placeholder data', () => {
    const session = getSessionForTask('task-second-order-lead-pid');
    const timeDomain = getWorkbenchViewPlugin('time-domain');
    const options = timeDomain?.getOptions(session) ?? [];

    expect(options.find((option) => option.id === 'reference')).toMatchObject({ enabled: true });
    expect(options.find((option) => option.id === 'uncorrected-output')).toMatchObject({ enabled: true });
    expect(options.find((option) => option.id === 'corrected-output')).toMatchObject({ enabled: true });
    expect(options.find((option) => option.id === 'blackbox-output')).toMatchObject({
      enabled: false,
      disabledReason: expect.stringContaining('没有黑箱实验数据'),
    });
  });

  it('declares composite-control defaults for block-diagram workbenches', () => {
    const session = getSessionForTask('task-third-order-block-diagram');
    const configs = getPresetDefaultViewConfigs('composite-control');
    const controlEffort = getWorkbenchViewPlugin('control-effort');

    expect(session.defaultPreset).toBe('composite-control');
    expect(session.allowedViews).toEqual(['time-domain', 'response-comparison', 'control-effort', 'metric-summary']);
    expect(configs.map((config) => config.id)).toEqual(['time-domain', 'response-comparison', 'control-effort', 'metric-summary']);
    expect(configs.find((config) => config.id === 'control-effort')?.selectedOptions).toEqual([
      'control-effort-estimate',
    ]);
    expect(controlEffort?.title).toBe('控制量');
  });
});

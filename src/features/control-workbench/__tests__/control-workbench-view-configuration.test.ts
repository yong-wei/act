import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { resolvePanelSelectedOptions } from '../../interactive/multi-representation-linkage/model';
import { resolveControlWorkbenchSession } from '../session-resolver';
import {
  buildDefaultWorkbenchPanelInstances,
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
  keyedViewConfigsFromPanels,
  toggleWorkbenchPanelOption,
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
      'uncorrected-root-locus',
      'corrected-root-locus',
    ]);
    expect(configs.find((config) => config.id === 'nyquist')?.selectedOptions).toEqual([
      'uncorrected-open-loop',
      'corrected-open-loop',
    ]);
  });

  it('builds independent panel instances from preset defaults', () => {
    const session = getSessionForTask('task-second-order-lead-pid');
    const panels = buildDefaultWorkbenchPanelInstances(session);

    expect(panels.map((panel) => panel.viewId)).toEqual(['time-domain', 'bode', 'root-locus', 'nyquist']);
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(panels.length);
    expect(panels[0]).toMatchObject({
      viewId: 'time-domain',
      title: '时域响应',
      enabled: true,
    });
    expect(panels.find((panel) => panel.viewId === 'nyquist')?.selectedOptions).toEqual([
      'uncorrected-open-loop',
      'corrected-open-loop',
    ]);
  });

  it('initializes direct exploration and Arena entries with complete default panel regions', () => {
    const directResult = resolveControlWorkbenchSession({
      mode: 'explore',
      objectId: 'plant-second-order-underdamped',
      preset: 'classic-four-view',
    });
    const arenaResult = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    expect(directResult.ok).toBe(true);
    expect(arenaResult.ok).toBe(true);
    if (!directResult.ok || !arenaResult.ok) throw new Error('workbench sessions should resolve');

    const directPanels = buildDefaultWorkbenchPanelInstances(directResult.session);
    const arenaPanels = buildDefaultWorkbenchPanelInstances(arenaResult.session);

    expect(directPanels.map((panel) => panel.viewId)).toEqual(['time-domain', 'bode', 'root-locus', 'nyquist']);
    expect(arenaPanels.map((panel) => panel.viewId)).toEqual(directPanels.map((panel) => panel.viewId));
    expect(directPanels.every((panel) => panel.enabled)).toBe(true);
    expect(arenaPanels.every((panel) => panel.enabled)).toBe(true);
  });

  it('keeps unavailable default panels as branded layout regions', () => {
    const source = readFileSync(
      new URL('../../interactive/multi-representation-linkage/page-client.tsx', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('panel.enabled !== false');
    expect(source).toContain('panel.enabled === false');
    expect(source).toContain('data-workbench-panel-unavailable');
  });

  it('keeps same-type panel instances independent when toggling options', () => {
    const session = getSessionForTask('task-second-order-lead-pid');
    const [firstBode] = buildDefaultWorkbenchPanelInstances(session).filter((panel) => panel.viewId === 'bode');
    const duplicateBode = {
      ...firstBode,
      id: 'panel-custom-bode',
      selectedOptions: ['corrected-open-loop'],
    };
    const panels = [firstBode, duplicateBode];

    const next = toggleWorkbenchPanelOption(panels, duplicateBode.id, 'correction-device');

    expect(next.find((panel) => panel.id === firstBode.id)?.selectedOptions).toEqual(firstBode.selectedOptions);
    expect(next.find((panel) => panel.id === duplicateBode.id)?.selectedOptions).toEqual([
      'corrected-open-loop',
      'correction-device',
    ]);
  });

  it('keeps an explicitly cleared panel empty instead of falling back to defaults', () => {
    const fallbackOptions = new Set(['corrected-output']);

    expect(Array.from(resolvePanelSelectedOptions({}, fallbackOptions))).toEqual(['corrected-output']);
    expect(Array.from(resolvePanelSelectedOptions({ selectedOptions: [] }, fallbackOptions))).toEqual([]);
  });

  it('encodes removed default views as disabled configs for non-classic presets', () => {
    const session = getSessionForTask('task-cruise-roll-blackbox-identification');
    const defaults = getPresetDefaultViewConfigs(session.defaultPreset);
    const panels = buildDefaultWorkbenchPanelInstances(session)
      .filter((panel) => panel.viewId !== 'identification');

    const configs = keyedViewConfigsFromPanels(panels, defaults);

    expect(configs.identification?.enabled).toBe(false);
    expect(configs.identification?.selectedOptions).toEqual([]);
  });

  it('uses single-selection behavior for root-locus and nyquist panels', () => {
    const session = getSessionForTask('task-second-order-lead-pid');
    const rootLocus = buildDefaultWorkbenchPanelInstances(session).find((panel) => panel.viewId === 'root-locus')!;
    const nyquist = buildDefaultWorkbenchPanelInstances(session).find((panel) => panel.viewId === 'nyquist')!;

    const nextRoot = toggleWorkbenchPanelOption([rootLocus], rootLocus.id, 'uncorrected-root-locus');
    const nextNyquist = toggleWorkbenchPanelOption([nyquist], nyquist.id, 'uncorrected-open-loop');

    expect(nextRoot[0].selectedOptions).toEqual(['uncorrected-root-locus']);
    expect(nextNyquist[0].selectedOptions).toEqual(['uncorrected-open-loop']);
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

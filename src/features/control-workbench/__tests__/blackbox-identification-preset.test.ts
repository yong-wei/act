import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';
import {
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
} from '../views';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('black-box identification control workbench preset', () => {
  it('resolves the cruise-roll black-box task to a hidden-target preset with persisted experiments', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-cruise-roll-blackbox-identification',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.defaultPreset).toBe('blackbox-identification');
    if (result.session.mode !== 'challenge') throw new Error('Expected challenge session');
    expect(result.session.officialTarget.hiddenTarget).toBe(true);
    expect('transferFunction' in result.session.officialTarget).toBe(false);
    expect(result.session.workingModel).toBeNull();
    expect(result.session.experimentPolicy.requiresPersistedDataset).toBe(true);
    expect(result.session.allowedViews).toEqual([
      'experiment-dataset',
      'identification',
      'response-comparison',
      'metric-summary',
    ]);
  });

  it('mounts the black-box preset from the unified control workbench shell', () => {
    expect(existsSync(join(repoRoot, 'src/features/control-workbench/presets/blackbox-identification-preset.tsx'))).toBe(true);

    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const presetSource = readRepoFile('src/features/control-workbench/presets/blackbox-identification-preset.tsx');
    const legacyPanelSource = readRepoFile('src/features/arena/submissions/arena-blackbox-submission-panel.tsx');

    expect(shellSource).toContain('BlackBoxIdentificationPreset');
    expect(shellSource).toContain("session.defaultPreset === 'blackbox-identification'");
    expect(shellSource).toContain('panelInstances={panels}');
    expect(shellSource).toContain("session.defaultPreset !== 'blackbox-identification'");
    expect(presetSource).toContain('/api/arena/blackbox-experiments');
    expect(presetSource).toContain('/api/arena/virtual-simulation-runs');
    expect(presetSource).toContain('/api/arena/evaluate');
    expect(presetSource).toContain('buildBlackBoxControlArtifactFromParams');
    expect(legacyPanelSource).toContain('BlackBoxIdentificationPanel');
  });

  it('records nominal model state from owned datasets without labeling it as the official target', () => {
    const presetSource = readRepoFile('src/features/control-workbench/presets/blackbox-identification-preset.tsx');

    expect(presetSource).toContain('buildClientNominalModelFromDataset');
    expect(presetSource).toContain('sourceDatasetHash: dataset.datasetHash');
    expect(presetSource).toContain('sourceExperimentId: dataset.id');
    expect(presetSource).toContain('const identificationModelId = dataset.registeredModel.id');
    expect(presetSource).toContain("sourceVisibility: 'black-box'");
    expect(presetSource).toContain("modelType: 'data-driven'");
    expect(presetSource).toContain('学生名义模型');
    expect(presetSource).toContain('不代表官方隐藏对象');
    expect(presetSource).not.toContain("dataset.datasetHash.replace('arena-blackbox-dataset-'");
    expect(presetSource).not.toContain('官方目标模型');
  });

  it('labels black-box response and identification views as nominal model views', () => {
    const configs = getPresetDefaultViewConfigs('blackbox-identification');
    const responseComparison = getWorkbenchViewPlugin('response-comparison');
    const identification = getWorkbenchViewPlugin('identification');
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-cruise-roll-blackbox-identification',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(configs.map((config) => config.id)).toEqual([
      'experiment-dataset',
      'identification',
      'response-comparison',
      'metric-summary',
    ]);
    expect(identification?.title).toBe('学生名义模型');
    expect(responseComparison?.title).toBe('名义模型响应对照');
    expect(responseComparison?.getOptions(result.session)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'nominal-model-response',
        label: expect.stringContaining('学生名义模型'),
      }),
      expect.objectContaining({
        id: 'virtual-preview-response',
        label: expect.stringContaining('预演'),
      }),
    ]));
  });

  it('uses panel instance options to gate black-box preset sections', () => {
    const configs = getPresetDefaultViewConfigs('blackbox-identification');
    const experimentConfig = configs.find((config) => config.id === 'experiment-dataset');
    const responseConfig = configs.find((config) => config.id === 'response-comparison');
    const metricConfig = configs.find((config) => config.id === 'metric-summary');
    const presetSource = readRepoFile('src/features/control-workbench/presets/blackbox-identification-preset.tsx');

    expect(experimentConfig?.selectedOptions).toContain('persisted-experiment-dataset');
    expect(responseConfig?.selectedOptions).toEqual(['nominal-model-response', 'virtual-preview-response']);
    expect(metricConfig?.selectedOptions).toContain('leaderboard-official-metrics');
    expect(presetSource).toContain('isBlackBoxWorkbenchOptionSelected');
    expect(presetSource).toContain('panelInstances?.filter((panel) => panel.enabled && panel.viewId === viewId)');
    expect(presetSource).toContain('showExperimentDataset');
    expect(presetSource).toContain('showIdentificationModel');
    expect(presetSource).toContain('showPreviewResponse');
    expect(presetSource).toContain('showMetricSummary');
    expect(presetSource).toContain('{showExperimentDataset ? (');
    expect(presetSource).toContain('{showMetricSummary ? (');
  });

  it('surfaces engineering evidence for budget, coverage, confidence, and official preview boundaries', () => {
    const presetSource = readRepoFile('src/features/control-workbench/presets/blackbox-identification-preset.tsx');

    expect(presetSource).toContain('BlackBoxExperimentEvidence');
    expect(presetSource).toContain('BlackBoxNominalEvidence');
    expect(presetSource).toContain('buildBlackBoxExperimentBudgetCoverageEvidence');
    expect(presetSource).toContain('buildBlackBoxNominalModelConfidenceEvidence');
    expect(presetSource).toContain('实验预算');
    expect(presetSource).toContain('覆盖证据');
    expect(presetSource).toContain('虚拟仿真预演不是官方隐藏评测');
    expect(presetSource).toContain("const BLACKBOX_PREVIEW_VISIBLE_METRIC_IDS = new Set(['trackingError', 'controlEnergy'])");
    expect(presetSource).toContain('function getBlackBoxOfficialOnlyMetricIds(task: ChallengeTask)');
    expect(presetSource).toContain('!BLACKBOX_PREVIEW_VISIBLE_METRIC_IDS.has(metricId)');
    expect(presetSource).toContain('const blackBoxOfficialOnlyMetricIds = getBlackBoxOfficialOnlyMetricIds(task);');
    expect(presetSource).toContain('officialOnlyMetricIds={blackBoxOfficialOnlyMetricIds}');
    expect(presetSource).not.toContain('const blackBoxOfficialOnlyMetricIds = task.primaryMetrics;');
  });
});

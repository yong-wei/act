import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getArenaChallengeTask } from '@/features/arena/data/seed-challenges';
import { getPreviewMetricIds } from '@/features/arena/submissions/arena-submission-panel';
import { resolveWorkbenchOfficialOnlyMetricIds } from '@/features/arena/workbench/official-only-metrics';
import { resolveControlWorkbenchSession } from '../session-resolver';
import { getPresetDefaultViewConfigs, getWorkbenchViewPlugin } from '../views';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function getSessionForTask(taskId: string) {
  const result = resolveControlWorkbenchSession({ arenaTask: taskId });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

describe('predictive control workbench preset', () => {
  it('resolves predictive Arena tasks to the predictive-control preset', () => {
    const mpcResult = resolveControlWorkbenchSession({
      arenaTask: 'task-ship-roll-mpc-hidden-scenarios',
    });
    const optimizedPidResult = resolveControlWorkbenchSession({
      arenaTask: 'task-ship-roll-optimized-pid-robust',
    });

    expect(mpcResult.ok).toBe(true);
    expect(optimizedPidResult.ok).toBe(true);
    if (!mpcResult.ok || !optimizedPidResult.ok) return;

    expect(mpcResult.session.defaultPreset).toBe('predictive-control');
    expect(mpcResult.session.recommendedWorkspaceMode).toBe('predictive-control');
    expect(mpcResult.session.allowedMethods).toEqual(['mpc']);
    expect(mpcResult.session.allowedViews).toEqual([
      'time-domain',
      'control-effort',
      'metric-summary',
    ]);

    expect(optimizedPidResult.session.defaultPreset).toBe('predictive-control');
    expect(optimizedPidResult.session.allowedMethods).toEqual(['optimized-pid']);
  });

  it('declares predictive defaults for template preview, control effort, and official metrics', () => {
    const mpcSession = getSessionForTask('task-ship-roll-mpc-hidden-scenarios');
    const optimizedPidSession = getSessionForTask('task-ship-roll-optimized-pid-robust');
    const configs = getPresetDefaultViewConfigs('predictive-control');
    const timeDomain = getWorkbenchViewPlugin('time-domain');
    const controlEffort = getWorkbenchViewPlugin('control-effort');
    const mpcTimeDomainOptions = timeDomain?.getOptions(mpcSession) ?? [];
    const optimizedPidTimeDomainOptions = timeDomain?.getOptions(optimizedPidSession) ?? [];
    const mpcControlOptions = controlEffort?.getOptions(mpcSession) ?? [];
    const optimizedPidControlOptions = controlEffort?.getOptions(optimizedPidSession) ?? [];

    expect(configs.map((config) => config.id)).toEqual([
      'time-domain',
      'control-effort',
      'metric-summary',
    ]);
    expect(configs[0]?.title).toContain('模板预览');
    expect(configs[2]?.title).toContain('官方指标');
    expect(mpcTimeDomainOptions.find((option) => option.id === 'corrected-output')).toMatchObject({ enabled: true });
    expect(optimizedPidTimeDomainOptions.find((option) => option.id === 'corrected-output')).toMatchObject({ enabled: true });
    expect(mpcControlOptions.find((option) => option.id === 'control-effort-estimate')).toMatchObject({ enabled: true });
    expect(optimizedPidControlOptions.find((option) => option.id === 'control-effort-estimate')).toMatchObject({ enabled: true });
  });

  it('mounts a dedicated predictive preset and keeps submission on the unified panel', () => {
    expect(existsSync(join(repoRoot, 'src/features/control-workbench/presets/predictive-control-preset.tsx'))).toBe(true);

    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const presetSource = readRepoFile('src/features/control-workbench/presets/predictive-control-preset.tsx');
    const submissionMountSource = readRepoFile('src/features/arena/workbench/arena-workbench-submission-mount.tsx');
    const submissionPanelSource = readRepoFile('src/features/arena/submissions/arena-submission-panel.tsx');

    expect(shellSource).toContain('PredictiveControlPreset');
    expect(shellSource).toContain("session.defaultPreset === 'predictive-control'");
    expect(shellSource).toContain("session.defaultPreset !== 'predictive-control'");
    expect(presetSource).toContain('predictionHorizon');
    expect(presetSource).toContain('controlHorizon');
    expect(presetSource).toContain('outputWeight');
    expect(presetSource).toContain('controlWeight');
    expect(presetSource).toContain('terminalWeight');
    expect(presetSource).toContain('inputLimit');
    expect(presetSource).toContain('sampleTime');
    expect(presetSource).toContain('speedWeight');
    expect(presetSource).toContain('energyWeight');
    expect(presetSource).toContain('robustnessWeight');
    expect(presetSource).toContain('overshootWeight');
    expect(presetSource).toContain('searchBudget');
    expect(presetSource).toContain('ArenaWorkbenchSubmissionMount');
    expect(presetSource).toContain('preferredControllerMethod={activeMethod}');
    expect(presetSource).toContain('officialOnlyMetricIds');
    expect(submissionMountSource).toContain('predictiveDraft');
    expect(submissionMountSource).toContain('officialOnlyMetricIds');
    expect(submissionMountSource).toContain('resolveWorkbenchOfficialOnlyMetricIds');
    expect(submissionPanelSource).toContain('onPredictiveDraftChange');
    expect(submissionPanelSource).toContain('本地预览不计算官方总分');
    expect(submissionPanelSource).toContain('隐藏场景指标仅官方评测后参与总分');
  });

  it('builds MPC and optimized PID artifacts from the current predictive draft', async () => {
    const mpcTask = getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios');
    const optimizedPidTask = getArenaChallengeTask('task-ship-roll-optimized-pid-robust');
    expect(mpcTask).toBeDefined();
    expect(optimizedPidTask).toBeDefined();
    if (!mpcTask || !optimizedPidTask) return;

    const { buildPredictiveControlArtifactFromDraft } = await import('../presets/predictive-control-draft');
    const draft = {
      predictionHorizon: '18',
      controlHorizon: '5',
      outputWeight: '1.4',
      controlWeight: '0.32',
      terminalWeight: '2',
      inputLimit: '4.5',
      sampleTime: '0.1',
      speedWeight: '1.2',
      energyWeight: '0.7',
      robustnessWeight: '1.4',
      overshootWeight: '0.9',
      searchBudget: '80',
    };

    expect(buildPredictiveControlArtifactFromDraft({
      task: mpcTask,
      method: 'mpc',
      draft,
      now: '2026-05-17T05:00:00.000Z',
    })).toMatchObject({
      taskId: 'task-ship-roll-mpc-hidden-scenarios',
      method: 'mpc',
      params: {
        template: 'bounded-linear-mpc',
        predictionHorizon: 18,
        controlHorizon: 5,
        outputWeight: 1.4,
        controlWeight: 0.32,
        terminalWeight: 2,
        inputLimit: 4.5,
        sampleTime: 0.1,
      },
    });

    expect(buildPredictiveControlArtifactFromDraft({
      task: optimizedPidTask,
      method: 'optimized-pid',
      draft,
      now: '2026-05-17T05:00:00.000Z',
    })).toMatchObject({
      taskId: 'task-ship-roll-optimized-pid-robust',
      method: 'optimized-pid',
      params: {
        template: 'bounded-optimized-pid',
        speedWeight: 1.2,
        energyWeight: 0.7,
        robustnessWeight: 1.4,
        overshootWeight: 0.9,
        searchBudget: 80,
      },
    });
  });

  it('labels hidden-scenario metrics as official-only without local preview values', async () => {
    const { PREDICTIVE_OFFICIAL_ONLY_METRICS } = await import('../presets/predictive-control-draft');
    const mpcTask = getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios');
    expect(mpcTask).toBeDefined();
    if (!mpcTask) return;

    expect(PREDICTIVE_OFFICIAL_ONLY_METRICS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hiddenScenarioWorst',
        label: expect.stringContaining('官方'),
        localValue: null,
      }),
    ]));
    expect(getPreviewMetricIds(
      mpcTask,
      PREDICTIVE_OFFICIAL_ONLY_METRICS.map((metric) => metric.id),
    )).not.toContain('hiddenScenarioWorst');
  });

  it('derives predictive official-only metrics for direct workbench mounts', () => {
    const mpcTask = getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios');
    const robustTask = getArenaChallengeTask('task-ship-roll-robust-disturbance');
    expect(mpcTask).toBeDefined();
    expect(robustTask).toBeDefined();
    if (!mpcTask || !robustTask) return;

    expect(resolveWorkbenchOfficialOnlyMetricIds({
      workspaceMode: 'predictive-control',
      task: mpcTask,
    })).toEqual(['hiddenScenarioWorst']);
    expect(resolveWorkbenchOfficialOnlyMetricIds({
      workspaceMode: 'multi-representation-linkage',
      task: robustTask,
    })).toBeUndefined();
    expect(resolveWorkbenchOfficialOnlyMetricIds({
      workspaceMode: 'predictive-control',
      task: mpcTask,
      explicitMetricIds: [],
    })).toEqual([]);
  });
});

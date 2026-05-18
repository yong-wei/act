import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getArenaChallengeObject, getArenaChallengeTask } from '@/features/arena/data/seed-challenges';
import { resolveControlWorkbenchSession } from '../session-resolver';
import { getPresetDefaultViewConfigs, getWorkbenchViewPlugin } from '../views';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('composite control workbench preset', () => {
  it('resolves the third-order block-diagram task to the composite-control preset', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-third-order-block-diagram',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.defaultPreset).toBe('composite-control');
    if (result.session.mode !== 'challenge') throw new Error('Expected challenge session');
    expect(result.session.recommendedWorkspaceMode).toBe('block-diagram-workbench');
    expect(result.session.allowedMethods).toContain('composite-compensation');
    expect(result.session.allowedViews).toEqual([
      'time-domain',
      'response-comparison',
      'control-effort',
      'metric-summary',
    ]);
  });

  it('declares composite defaults for response, effort, disturbance, and summary views', () => {
    const configs = getPresetDefaultViewConfigs('composite-control');
    const controlEffort = getWorkbenchViewPlugin('control-effort');
    const responseComparison = getWorkbenchViewPlugin('response-comparison');
    const object = getArenaChallengeObject('plant-second-order-underdamped');
    expect(object).toBeDefined();
    if (!object) return;

    expect(configs.map((config) => config.id)).toEqual([
      'time-domain',
      'response-comparison',
      'control-effort',
      'metric-summary',
    ]);
    expect(responseComparison?.getOptions({
      mode: 'explore',
      title: '复合校正',
      object,
      selectedObjectId: object.id,
      officialTarget: null,
      workingModel: null,
      allowedMethods: ['composite-compensation'],
      allowedViews: ['time-domain', 'response-comparison', 'control-effort', 'metric-summary'],
      defaultPreset: 'composite-control',
      experimentPolicy: { enabled: false, signalTypes: [], requiresPersistedDataset: false },
      submissionPolicy: {
        officialEvaluationEnabled: false,
        leaderboardEnabled: false,
        requiresArtifactBridge: true,
        leaderboardTypes: [],
        disabledReason: 'test',
      },
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: expect.stringContaining('扰动') }),
    ]));
    expect(controlEffort?.title).toBe('控制量');
  });

  it('mounts a dedicated composite preset and keeps official evaluation on the unified submission panel', () => {
    expect(existsSync(join(repoRoot, 'src/features/control-workbench/presets/composite-control-preset.tsx'))).toBe(true);

    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const presetSource = readRepoFile('src/features/control-workbench/presets/composite-control-preset.tsx');
    const submissionMountSource = readRepoFile('src/features/arena/workbench/arena-workbench-submission-mount.tsx');
    const submissionPanelSource = readRepoFile('src/features/arena/submissions/arena-submission-panel.tsx');

    expect(shellSource).toContain('CompositeControlPreset');
    expect(shellSource).toContain("session.defaultPreset === 'composite-control'");
    expect(shellSource).toContain("session.defaultPreset !== 'composite-control'");
    expect(shellSource).toContain('panelInstances={panels}');
    expect(presetSource).toContain('panelInstances?: WorkbenchPanelInstance[]');
    expect(presetSource).toContain('selectedPanelLabels(panelInstances)');
    expect(presetSource).toContain('prefilterGain');
    expect(presetSource).toContain('forwardGain');
    expect(presetSource).toContain('localFeedbackGain');
    expect(presetSource).toContain('disturbanceCompensation');
    expect(presetSource).toContain('controlLimit');
    expect(presetSource).toContain('参数化模板评测');
    expect(presetSource).toContain('ArenaWorkbenchSubmissionMount');
    expect(presetSource).toContain('preferredControllerMethod="composite-compensation"');
    expect(submissionMountSource).toContain('compositeDraft');
    expect(submissionMountSource).toContain('preferredControllerMethod');
    expect(submissionPanelSource).toContain('/api/arena/evaluate');
    expect(submissionPanelSource).toContain('preferredControllerMethod && evaluableMethods.includes(preferredControllerMethod)');
  });

  it('builds a composite-compensation artifact from the current composite draft', async () => {
    const modulePath = join(repoRoot, 'src/features/control-workbench/presets/composite-control-draft.ts');
    expect(existsSync(modulePath)).toBe(true);

    const task = getArenaChallengeTask('task-third-order-block-diagram');
    expect(task).toBeDefined();
    if (!task) return;

    const { buildCompositeCompensationArtifactFromDraft } = await import('../presets/composite-control-draft');
    const artifact = buildCompositeCompensationArtifactFromDraft({
      task,
      draft: {
        prefilterGain: '0.85',
        forwardGain: '2.4',
        localFeedbackGain: '0.6',
        disturbanceCompensation: '0.35',
        controlLimit: '4.5',
      },
      now: '2026-05-17T03:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: 'task-third-order-block-diagram',
      method: 'composite-compensation',
      params: {
        structure: 'prefilter-forward-local-feedback-disturbance',
        prefilterGain: 0.85,
        forwardGain: 2.4,
        localFeedbackGain: 0.6,
        disturbanceCompensation: 0.35,
        controlLimit: 4.5,
      },
      createdAt: '2026-05-17T03:00:00.000Z',
    });
  });
});

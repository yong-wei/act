import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ArenaPlantAdapterSelectionError,
  getArenaPlantAdapterForPublicExperimentTaskId,
  getArenaPlantAdapterForObject,
  getArenaPlantAdapterForOfficialEvaluationTaskId,
  getArenaPlantAdapterForTaskId,
  getArenaPlantAdapterForVirtualPreviewTaskId,
} from '../adapters/registry';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
} from '../data/seed-challenges';

describe('Arena PlantAdapter registry', () => {
  it('selects the production cruise-roll black-box adapter for virtual simulation objects', () => {
    const task = getArenaChallengeTask('task-cruise-roll-blackbox-identification');
    const object = getArenaChallengeObject('plant-cruise-roll-blackbox');

    expect(task).toBeTruthy();
    expect(object).toBeTruthy();

    const adapter = getArenaPlantAdapterForObject(object!, task!);

    expect(adapter.id).toBe('cruise-roll-blackbox-production');
    expect(adapter.canRunPublicExperiment(task!, object!)).toBe(true);
    expect(adapter.canRunVirtualPreview(task!, object!)).toBe(true);
    expect(adapter.canRunOfficialEvaluation(task!, object!)).toBe(true);
    expect(adapter.describeSupport(task!, object!)).toEqual({
      publicExperiment: { supported: true },
      virtualPreview: { supported: true },
      officialEvaluation: { supported: true },
    });
  });

  it('selects a white-box transfer-function adapter placeholder for inspectable objects', () => {
    const task = getArenaChallengeTask('task-second-order-lead-pid');
    const object = getArenaChallengeObject('plant-second-order-underdamped');

    expect(task).toBeTruthy();
    expect(object).toBeTruthy();

    const adapter = getArenaPlantAdapterForObject(object!, task!);

    expect(adapter.id).toBe('whitebox-transfer-function');
    expect(adapter.canRunPublicExperiment(task!, object!)).toBe(false);
    expect(adapter.canRunVirtualPreview(task!, object!)).toBe(false);
    expect(adapter.canRunOfficialEvaluation(task!, object!)).toBe(true);
    expect(adapter.describeSupport(task!, object!)).toEqual({
      publicExperiment: {
        supported: false,
        reason: 'White-box transfer-function objects do not expose black-box public experiment datasets.',
      },
      virtualPreview: {
        supported: false,
        reason: 'White-box transfer-function objects use direct analytical previews instead of Arena virtual simulation preview runs.',
      },
      officialEvaluation: { supported: true },
    });
  });

  it('selects official evaluation support for white-box virtual simulation tasks', () => {
    const adapter = getArenaPlantAdapterForOfficialEvaluationTaskId('task-ship-roll-mpc-hidden-scenarios');

    expect(adapter.id).toBe('whitebox-transfer-function');
    expect(adapter.canRunOfficialEvaluation(
      getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios')!,
      getArenaChallengeObject('plant-ship-roll-whitebox')!,
    )).toBe(true);
  });

  it('rejects unsupported task ids before falling back to mock data', () => {
    expect(() => getArenaPlantAdapterForTaskId('missing-task')).toThrow(ArenaPlantAdapterSelectionError);
  });

  it('rejects white-box tasks for black-box public experiment and preview operations', () => {
    expect(() => getArenaPlantAdapterForPublicExperimentTaskId('task-second-order-lead-pid'))
      .toThrow('do not expose black-box public experiment datasets');
    expect(() => getArenaPlantAdapterForVirtualPreviewTaskId('task-second-order-lead-pid'))
      .toThrow('use direct analytical previews');
  });

  it('keeps production API routes away from the test-only mock adapter', () => {
    const blackboxRoute = readFileSync(
      join(process.cwd(), 'src/app/api/arena/blackbox-experiments/route.ts'),
      'utf8',
    );
    const previewRoute = readFileSync(
      join(process.cwd(), 'src/app/api/arena/virtual-simulation-runs/route.ts'),
      'utf8',
    );
    const serverSource = readFileSync(join(process.cwd(), 'src/features/arena/server.ts'), 'utf8');

    expect(blackboxRoute).toContain("from '@/features/arena/adapters/registry'");
    expect(previewRoute).toContain("from '@/features/arena/adapters/registry'");
    expect(previewRoute).toContain('rejectVirtualPreviewRequestBody');
    expect(blackboxRoute).not.toContain('createMockCruiseRollBlackBoxAdapterForTests');
    expect(previewRoute).not.toContain('createMockCruiseRollBlackBoxAdapterForTests');
    expect(serverSource).not.toContain("export * from './adapters/plant-adapter'");
  });
});

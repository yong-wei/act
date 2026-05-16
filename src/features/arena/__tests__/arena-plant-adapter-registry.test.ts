import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ArenaPlantAdapterSelectionError,
  getArenaPlantAdapterForObject,
  getArenaPlantAdapterForTaskId,
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
  });

  it('rejects unsupported task ids before falling back to mock data', () => {
    expect(() => getArenaPlantAdapterForTaskId('missing-task')).toThrow(ArenaPlantAdapterSelectionError);
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
    const indexSource = readFileSync(join(process.cwd(), 'src/features/arena/index.ts'), 'utf8');

    expect(blackboxRoute).toContain("from '@/features/arena/adapters/registry'");
    expect(previewRoute).toContain("from '@/features/arena/adapters/registry'");
    expect(blackboxRoute).not.toContain('createMockCruiseRollBlackBoxAdapterForTests');
    expect(previewRoute).not.toContain('createMockCruiseRollBlackBoxAdapterForTests');
    expect(serverSource).not.toContain("export * from './adapters/plant-adapter'");
    expect(indexSource).not.toContain("export * from './adapters/plant-adapter'");
  });
});

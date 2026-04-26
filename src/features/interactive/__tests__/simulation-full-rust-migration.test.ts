import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoPath = (...segments: string[]) => path.join(process.cwd(), ...segments);

const read = (file: string) => readFileSync(repoPath(file), 'utf8');

describe('full Rust simulation migration guard', () => {
  it('keeps interactive simulation widgets off the TypeScript plant runtime', () => {
    const pidSimulator = read('src/resources/interactive-learning/pid-simulator/pid-simulator-component.tsx');
    const judgeBench = read('src/resources/interactive-learning/lesson-06/judge-bench-sim/index.tsx');
    const poleManipulator = read('src/resources/interactive-learning/lesson-07/pole-manipulator/index.tsx');
    const responseExplorer = read('src/resources/interactive-learning/lesson-07/response-explorer/index.tsx');
    const cruiseTyphoon = read('src/resources/interactive-learning/lesson-13/cruise-typhoon-sim/index.tsx');
    const champagneTower = read(
      'src/resources/interactive-learning/lesson-13/cruise-typhoon-sim/hooks/useChampagneTower.ts',
    );

    expect(pidSimulator).toContain('runPidBatchSimulation');
    expect(pidSimulator).not.toMatch(/createLinearPlant|createNonlinearPlant/);
    expect(judgeBench).toContain('runSecondOrderStepResponse');
    expect(judgeBench).not.toMatch(/createLinearPlant|createNonlinearPlant/);
    expect(poleManipulator).toContain('runTransferFunctionResponse');
    expect(poleManipulator).not.toMatch(/discretizeTransferFunctionTustin|stepDiscreteStateSpace/);
    expect(responseExplorer).toContain('runSecondOrderAnalyticResponse');
    expect(cruiseTyphoon).toContain('stepCruiseTyphoonScenario');
    expect(champagneTower).toContain('stepChampagneTower');
  });

  it('removes obsolete TypeScript simulation engines from production resources', () => {
    for (const file of [
      'src/resources/simulations/lib/simulation-engine.ts',
      'src/resources/simulations/hooks/useShipSimulation.ts',
      'src/resources/interactive-learning/hooks/useControlSystem.ts',
    ]) {
      expect(existsSync(repoPath(file)), file).toBe(false);
    }
  });

  it('removes ship physics model files after their state helpers move behind the Rust facade', () => {
    for (const file of [
      'src/resources/simulations/physics/models/nomoto-1st-order.ts',
      'src/resources/simulations/physics/models/nomoto-2nd-order-delay.ts',
      'src/resources/simulations/physics/models/nomoto-variable-mass.ts',
      'src/resources/simulations/physics/models/nomoto-roll-coupled.ts',
      'src/resources/simulations/physics/models/mmg-3dof.ts',
      'src/resources/simulations/physics/models/semisubmersible-3dof.ts',
      'src/resources/simulations/physics/models/azipod-3dof.ts',
    ]) {
      expect(existsSync(repoPath(file)), file).toBe(false);
    }
  });

  it('prevents production imports from the removed ship physics model directory', () => {
    const productionFiles = [
      'src/resources/simulations/physics/simulation-engine-facade.ts',
      'src/resources/simulations/physics/engine-factory.ts',
      'src/resources/simulations/profiles/dredger-tianjing.ts',
      'src/resources/simulations/physics/controllers/dp-decoupling-controller.ts',
    ];

    for (const file of productionFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/from ['"].*\/physics\/models\/|from ['"]\.\.?\/models\//);
    }
  });
});

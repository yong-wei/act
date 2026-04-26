import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const directPhysicsImportPattern =
  /from ['"]\.\.\/physics\/(?:models|controllers|disturbances)\//;

const simulationPages = [
  'src/resources/simulations/simulations/dredger-simulation.tsx',
  'src/resources/simulations/simulations/drilling-simulation.tsx',
  'src/resources/simulations/simulations/icebreaker-simulation.tsx',
];

describe('simulation engine facade adoption', () => {
  it('keeps second-batch simulation pages off direct physics module imports', () => {
    for (const file of simulationPages) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');

      expect(source, file).toContain('../physics/simulation-engine-facade');
      expect(source, file).not.toMatch(directPhysicsImportPattern);
    }
  });

  it('routes second-batch physical steppers through the virtual simulation runtime', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/physics/simulation-engine-facade.ts'),
      'utf8',
    );

    expect(source).toContain('computeVirtualSimulationStep');
    expect(source).toContain("modelId: 'mmg3dof'");
    expect(source).toContain("modelId: 'semisub3dof'");
    expect(source).toContain("modelId: 'azipod3dof'");
  });
});

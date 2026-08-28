import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const directPhysicsImportPattern =
  /from ['"]\.\.\/physics\/(?:models|controllers|disturbances)\//;

const simulationPages = [
  'src/resources/simulations/simulations/container-simulation.tsx',
  'src/resources/simulations/simulations/cruise-simulation.tsx',
  'src/resources/simulations/simulations/dredger-simulation.tsx',
  'src/resources/simulations/simulations/drilling-simulation.tsx',
  'src/resources/simulations/simulations/icebreaker-simulation.tsx',
  'src/resources/simulations/simulations/lng-simulation.tsx',
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

  it('routes remaining real-time simulation steppers through the virtual simulation runtime', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/physics/simulation-engine-facade.ts'),
      'utf8',
    );
    const engineFactory = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/physics/engine-factory.ts'),
      'utf8',
    );

    for (const modelId of [
      "modelId: 'nomoto1st'",
      "modelId: 'nomoto2nd_delay'",
      "modelId: 'nomoto_variable_mass'",
      "modelId: 'container_roll'",
      "modelId: 'roll_coupled_nomoto'",
    ]) {
      expect(source).toContain(modelId);
    }

    expect(engineFactory).not.toMatch(/from ['"]\.\/models\/nomoto-1st-order['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/models\/nomoto-2nd-order-delay['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/models\/nomoto-variable-mass['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/models\/nomoto-roll-coupled['"]/);
    expect(source).toContain("modelId: 'practice_cruise_live_step'");
    expect(source).toContain("modelId: 'practice_pid_control'");
    expect(source).toContain("modelId: 'practice_dp_control'");
    expect(source).toContain("modelId: 'practice_smith_predictor'");
    expect(source).toContain("modelId: 'practice_sloshing_step'");
    expect(source).toContain("modelId: 'practice_gain_schedule_step'");
    expect(source).toContain("modelId: 'practice_wind_load_step'");
    expect(source).toContain('DEFAULT_WIND_PARAMS');
    expect(source).toContain("modelId: 'practice_dredging_disturbance'");
    expect(source).toContain("modelId: 'practice_dp_decoupled_control'");
    expect(source).toContain("modelId: 'practice_allocate_thrust'");
    expect(source).toContain("modelId: 'practice_ice_breaking_step'");
    expect(source).toContain("modelId: 'practice_azipod_course_keeper'");
    expect(source).toContain("modelId: 'practice_cruise_comfort_realtime'");
    expect(source).toContain("modelId: 'practice_drilling_environment'");
    expect(engineFactory).toContain('computePracticeCruiseLiveStep');
    expect(engineFactory).toContain('computePracticePidControl');
    expect(engineFactory).toContain('computePracticeGainScheduleStep');
    expect(engineFactory).toContain('computePracticeCruiseComfortRealtime');
    expect(engineFactory).not.toContain('notchFilterStep(');
    expect(engineFactory).not.toContain('rollCoupledNomotoStep(');
    expect(engineFactory).not.toContain('new PIDController');
    expect(engineFactory).not.toContain('new GainScheduler');
    expect(engineFactory).not.toContain('updateComfortMetricsRealtime(');
    expect(engineFactory).not.toMatch(/from ['"]\.\/controllers\/dp-controller['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/disturbances\/dredging-impact['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/disturbances\/ice-breaking-model['"]/);
    expect(engineFactory).not.toMatch(/from ['"]\.\/controllers\/azipod-course-keeper['"]/);
    expect(engineFactory).not.toContain('finStabilizerStep(');
    expect(engineFactory).not.toContain('pidControl(');
    expect(engineFactory).not.toContain('notchFilterStep(');
  });
});

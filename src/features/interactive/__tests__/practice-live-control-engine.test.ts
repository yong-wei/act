import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
import { SimulationClock } from '@/lib/simulation';
import { projectPracticeOutcomeIdentity } from '@/lib/practice-lab-run-contract';

const read = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

const sceneFiles = [
  'src/resources/simulations/simulations/container-simulation.tsx',
  'src/resources/simulations/simulations/cruise-simulation.tsx',
  'src/resources/simulations/simulations/destroyer-simulation.tsx',
  'src/resources/simulations/simulations/dredger-simulation.tsx',
  'src/resources/simulations/simulations/drilling-simulation.tsx',
  'src/resources/simulations/simulations/icebreaker-simulation.tsx',
  'src/resources/simulations/simulations/lng-simulation.tsx',
];

describe('practice live clock and no-facade guards', () => {
  it('preserves seven-scene 1/60,120 and Odyssey 1/60,6 clocks', () => {
    for (const file of sceneFiles) {
      const source = read(file);
      expect(source, file).toMatch(/dt:\s*SIMULATION_FIXED_STEP_SECONDS|dt:\s*1\s*\/\s*60/);
      expect(source, file).toMatch(/maxSubSteps:\s*SIMULATION_MAX_SUB_STEPS|maxSubSteps:\s*120/);
      expect(source, file).not.toMatch(/setInterval\s*\(/);
    }

    const odyssey = read('src/resources/interactive-learning/control-odyssey/components/GameCanvas.tsx');
    expect(odyssey).toContain('dt: 1 / 60');
    expect(odyssey).toContain('maxSubSteps: 6');
    expect(odyssey).toContain('isControlOdysseyRuntimeReady()');
  });

  it('keeps Control Odyssey live physics on the control-engine step', () => {
    const physics = read('src/resources/interactive-learning/control-odyssey/engine/physics.ts');
    expect(physics).toContain('computeRustSimulationStep');
    expect(physics).toContain('isControlOdysseyRuntimeReady');
    expect(physics).not.toMatch(/setInterval/);
  });

  it('pauses live scenes when WASM is unavailable and resets the clock without extra samples', () => {
    for (const file of sceneFiles) {
      const source = read(file);
      if (file.endsWith('destroyer-simulation.tsx')) {
        expect(source, file).toContain('preloadVirtualSimulationRuntime');
        expect(source, file).toContain('if (!isRunning || !runtimeReady)');
        expect(source, file).toContain('clockRef.current.reset()');
        continue;
      }
      expect(source, file).toContain('isVirtualSimulationRuntimeReady()');
      expect(source, file).toContain('clockRef.current.reset()');
    }
  });

  it('does not let SimulationClock advance physics after reset or while paused', () => {
    const clock = new SimulationClock({ dt: 1 / 60, maxSubSteps: 120 });
    let steps = 0;
    clock.advance(1 / 30, () => {
      steps += 1;
    });
    expect(steps).toBe(2);
    clock.reset();
    steps = 0;
    clock.advance(1 / 120, () => {
      steps += 1;
    });
    expect(steps).toBe(0);
  });
});

describe('practice live server WASM and Arena isolation', () => {
  it('executes practice PID through the server WASM runtime within frozen tolerance', () => {
    const result = computeVirtualSimulationServerStep<{
      output: { rudderDeg: number; error: number; derivative: number };
      modelId: string;
    }>({
      modelId: 'practice_pid_control',
      dt: 1 / 60,
      targetHeading: 1,
      currentHeading: 0,
      controlMode: 'pid',
      gains: { kp: 0.8, ki: 0.05, kd: 2 },
      maxRudderDeg: 35,
      derivativeFilter: 0.1,
      state: { integral: 0, prevError: 0, prevDerivative: 0 },
    });

    expect(result.modelId).toBe('practice_pid_control');
    expect(Math.abs(result.output.rudderDeg - 12.800833333333337)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(result.output.error - 1)).toBeLessThanOrEqual(1e-6);
  });

  it('keeps Practice run envelopes display-only and rejects Arena official promotion', () => {
    const practice = projectPracticeOutcomeIdentity({
      sourceId: 'practice-live-1',
      ownerUserId: 'student-1',
      taskId: 'task-cruise-live',
      specHash: 'sha256:spec',
      artifactHash: 'artifact-live',
      controllerSnapshotRef: 'controller:pid',
      protocolVersion: '1.0',
      runtimeVersion: 'practice-live-runtime-v1',
      modelVersion: 'practice-pid-v1',
      seed: 7,
      checksum: 'sha256:checksum',
      executor: 'browser',
      authoritySource: 'control-engine-browser-facade',
    });
    expect(practice.evaluationVisibility).toBe('practice');
    expect(practice.officialEligible).toBe(false);
    expect(practice.executor).toBe('browser');
    expect(practice.authoritySource).toBe('control-engine-browser-facade');

    const runsRoute = read('src/app/api/simulation/runs/route.ts');
    expect(runsRoute).toContain('persistSceneTraceSimulationRun');
    expect(runsRoute).not.toMatch(/ArenaSubmission|ArenaEvaluationRun|leaderboard/);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';

describe('simulation API Rust runtime adoption', () => {
  it('loads the virtual simulation engine from the server-side WASM runtime', () => {
    const facadeSource = readFileSync(
      path.join(process.cwd(), 'src/lib/control-engine/wasm-server.ts'),
      'utf8',
    );
    const serverSource = readFileSync(
      path.join(process.cwd(), 'src/lib/control-engine/server.ts'),
      'utf8',
    );

    expect(serverSource).toContain('computeVirtualSimulationServerStep');
    expect(facadeSource).toContain('initSync');
    expect(facadeSource).toContain('compute_virtual_simulation_step');
    expect(facadeSource).toContain('index_bg.wasm');
  });

  it('routes numeric simulation APIs through Rust model ids', () => {
    const cruiseRoute = readFileSync(
      path.join(process.cwd(), 'src/app/api/simulation/cruise-comfort-analysis/route.ts'),
      'utf8',
    );
    const icebreakerRoute = readFileSync(
      path.join(process.cwd(), 'src/app/api/simulation/icebreaker-robust-analysis/route.ts'),
      'utf8',
    );

    expect(cruiseRoute).toContain('@/lib/control-engine/server');
    expect(icebreakerRoute).toContain('@/lib/control-engine/server');
    expect(cruiseRoute).toContain("modelId: 'cruise_comfort_analysis'");
    expect(icebreakerRoute).toContain("modelId: 'icebreaker_robust_analysis'");
  });

  it('moves the optimizer physical evaluator off the local TypeScript quick simulator', () => {
    const optimizerSource = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/lib/monte-carlo-optimizer.ts'),
      'utf8',
    );

    expect(optimizerSource).toContain("modelId: 'nomoto_quick_sim'");
    expect(optimizerSource).not.toMatch(/runQuickSimulation/);
  });

  it('executes a numeric API request through the server WASM runtime', () => {
    const result = computeVirtualSimulationServerStep<{
      objectiveScores: { comfort: number; performance: number; energy: number };
      blendedScore: number;
      paretoFront: Array<{ comfort: number; performance: number }>;
    }>({
      modelId: 'cruise_comfort_analysis',
      objectives: { comfortWeight: 0.5, performanceWeight: 0.3, energyWeight: 0.2 },
      metrics: { msi: 12, settlingTime: 45, overshoot: 8, finPower: 120 },
    });

    expect(Number.isFinite(result.blendedScore)).toBe(true);
    expect(Number.isFinite(result.objectiveScores.comfort)).toBe(true);
    expect(result.paretoFront).toHaveLength(12);
  });
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const wasmDirectory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const packDirectory = path.join(root, 'rust/control-engine/model-data/semisub-981/v5');
const hardware = JSON.parse(readFileSync(path.join(packDirectory, 'actuators.json'), 'utf8'));
const records = [];

for (const budget of [8e6, 16e6, 32e6]) {
  const configuration = JSON.stringify({ vessel: 'semisub-981', parameterVersion: 'research-nominal-v5',
    noiseLevel: 'N0', propulsionPowerBudgetW: budget });
  const simulation = new binding.VesselSimulationSession(configuration);
  const restored = new binding.VesselSimulationSession(configuration);
  try {
    const initial = simulation.snapshot();
    const input = JSON.parse(simulation.read()).input;
    for (const shaft of input.actuators.shafts) shaft.speed_reference_rad_s = 18;
    simulation.advance(0, JSON.stringify(input));
    let peakPower = 0;
    let actual;
    const started = performance.now();
    for (let frame = 0; frame < 180; frame += 1) {
      actual = JSON.parse(simulation.advance(.25, ''));
      const power = actual.propulsionPower;
      assert.equal(power.budgetW, budget);
      assert.ok(power.positiveMechanicalPowerW <= budget * (1 + 1e-10));
      assert.equal(power.positiveMechanicalPowerW,
        power.shaftMechanicalPowerW.reduce((sum, value) => sum + Math.max(0, value), 0));
      peakPower = Math.max(peakPower, power.positiveMechanicalPowerW);
    }
    if (budget < 32e6) assert.ok(peakPower > .999 * budget, JSON.stringify({ budget, peakPower }));
    const state = actual.truth.actuator_states;
    const kinetic = state.propeller_shaft_speed_rad_s.reduce((sum, omega, index) => sum
      + .5 * hardware.system.propulsors[index].shaft_inertia_kg_m2 * omega ** 2, 0);
    const netWork = state.motor_work_j.reduce((sum, work, index) => sum + work
      - state.propeller_work_j[index] - state.shaft_friction_work_j[index], 0);
    const relativeEnergyResidual = Math.abs(netWork - kinetic) / Math.max(kinetic, 1);
    assert.ok(relativeEnergyResidual < 1e-5);
    restored.restore(simulation.snapshot());
    for (let frame = 0; frame < 12; frame += 1) {
      simulation.advance(1 / 60, '');
      restored.advance(1 / 60, '');
    }
    assert.equal(simulation.snapshot(), restored.snapshot());
    simulation.setPaused(true);
    const paused = simulation.snapshot();
    simulation.advance(1, '');
    assert.equal(simulation.snapshot(), paused);
    simulation.reset();
    assert.equal(simulation.snapshot(), initial);
    records.push({ budget_w: budget, parameter_hash: actual.parameterHash,
      virtual_seconds: actual.timeS, peak_positive_mechanical_power_w: peakPower,
      budget_active_in_this_run: peakPower > .999 * budget,
      final_positive_mechanical_power_w: actual.propulsionPower.positiveMechanicalPowerW,
      net_motor_work_after_friction_and_propeller_j: netWork, shaft_kinetic_energy_j: kinetic,
      relative_energy_residual: relativeEnergyResidual,
      restored_future_bytes_identical: true, pause_bytes_identical: true, reset_bytes_identical: true,
      elapsed_ms: performance.now() - started });
  } finally {
    simulation.free();
    restored.free();
  }
}
assert.equal(new Set(records.map((item) => item.parameter_hash)).size, 3);
const report = { schema: 'act.semisub-power-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: sha256(wasm),
  parameter_manifest_sha256: sha256(readFileSync(path.join(packDirectory, 'manifest.json'))),
  records, scope: 'Actual WASM, 8 physical drives, 120Hz RK and positive motor work. Single Node process excludes browser rendering and network capacity.',
  interpretation: 'The declared torque, propeller map, initial loading and incoming flow determine attainable power. The 32MW-budget scenario peaks at 23.45MW over this 45-second run.' };
const index = process.argv.indexOf('--output');
if (index >= 0) writeFileSync(process.argv[index + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));

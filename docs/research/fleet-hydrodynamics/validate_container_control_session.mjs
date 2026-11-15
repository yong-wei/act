import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const directory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(directory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(directory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const pack = path.join(root, 'rust/control-engine/model-data/container-msc/v2');
const hardware = JSON.parse(readFileSync(path.join(pack, 'actuators.json')));
const models = [[.2, .04, 120, 40], [.6, .05, 160, 55], [.9, .06, 200, 65]]
  .map(([loadingRatio, k, t_s, shaftReferenceRpm]) => ({ loadingRatio,
    operatingModel: { structure: { kind: 'fopdt', k, t_s, delay_s: 2 }, speedMps: 8, shaftReferenceRpm } }));

const records = [];
for (const stoppedEngine of [false, true]) {
  const configuration = { vessel: 'container-msc', parameterVersion: 'research-nominal-v2',
    loadingRatio: .6, noiseLevel: 'N0', containerVoyage: { segmentSpeedsMps: [8, 8, 8, 8] } };
  const simulation = new binding.VesselSimulationSession(JSON.stringify(configuration));
  const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
  try {
    const initial = simulation.snapshot();
    const first = JSON.parse(simulation.read());
    const initialOmega = first.truth.actuator_states.propeller_shaft_speed_rad_s[0];
    const command = first.input;
    command.containerSpeed = { models, referenceMps: 8, fixedModelIndex: 1, schedulingEnabled: false,
      bumpless: true, kpMultiplier: 1, tiMultiplier: 1, antiWindup: true,
      filterTauS: .2, feedback: 'water', losLookaheadM: 400 };
    if (stoppedEngine) command.actuators.shafts[0].engine_running = false;
    let actual;
    let maximumMotorPowerW = 0;
    for (let second = 0; second < 1200; second += 1) {
      actual = JSON.parse(simulation.advance(1, second === 0 ? JSON.stringify(command) : ''));
      const actuator = actual.truth.actuator_states;
      maximumMotorPowerW = Math.max(maximumMotorPowerW,
        actuator.motor_torques_nm[0] * actuator.propeller_shaft_speed_rad_s[0]);
      if (actual.paused) break;
    }
    assert.ok(actual.paused);
    assert.equal(actual.containerVoyage.progress.termination.reason, stoppedEngine ? 'time_limit' : 'arrived');
    assert.equal(actual.containerVoyage.eligibleForFuelComparison, !stoppedEngine);
    assert.ok(maximumMotorPowerW <= 65e6 * (1 + 1e-10));
    if (stoppedEngine) {
      assert.equal(actual.timeS, 1200);
      assert.equal(actual.teachingFuel.state.fuel_kg, 0);
      assert.ok(actual.truth.position_ned[0] < 6000);
    } else {
      assert.ok(actual.timeS <= 900);
      assert.ok(Math.abs(actual.containerVoyage.progress.termination.finalWaterSpeedMps - 8) <= .3);
      assert.ok(actual.teachingFuel.state.fuel_kg > 0);
    }
    const state = actual.truth.actuator_states;
    const kineticChange = .5 * hardware.system.propulsors[0].shaft_inertia_kg_m2
      * (state.propeller_shaft_speed_rad_s[0] ** 2 - initialOmega ** 2);
    const netWork = state.motor_work_j[0] - state.propeller_work_j[0] - state.shaft_friction_work_j[0];
    const energyResidual = Math.abs(netWork - kineticChange)
      / Math.max(1, Math.abs(state.motor_work_j[0]), Math.abs(state.propeller_work_j[0]), Math.abs(kineticChange));
    assert.ok(energyResidual < .01);
    const terminal = simulation.snapshot();
    restored.restore(terminal);
    simulation.setPaused(false);
    restored.setPaused(false);
    simulation.advance(1, '');
    restored.advance(1, '');
    assert.equal(simulation.snapshot(), terminal);
    assert.equal(restored.snapshot(), terminal);
    simulation.reset();
    assert.equal(simulation.snapshot(), initial);
    records.push({ engine_stopped: stoppedEngine, parameter_hash: actual.parameterHash,
      time_s: actual.timeS, actual_north_m: actual.truth.position_ned[0],
      actual_final_water_speed_mps: actual.containerVoyage.progress.termination.finalWaterSpeedMps,
      termination: actual.containerVoyage.progress.termination.reason,
      eligible_for_fuel_comparison: actual.containerVoyage.eligibleForFuelComparison,
      fuel_kg: actual.teachingFuel.state.fuel_kg, maximum_motor_power_w: maximumMotorPowerW,
      shaft_energy_relative_residual: energyResidual,
      terminal_restored_future_bytes_identical: true, terminal_resume_keeps_physics_frozen: true,
      reset_bytes_identical: true });
  } finally {
    simulation.free();
    restored.free();
  }
}
const report = { schema: 'act.container-control-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: sha256(wasm),
  parameter_manifest_sha256: sha256(readFileSync(path.join(pack, 'manifest.json'))),
  local_models: models, local_model_status: 'Controller interface fixtures. Formal student identification uses independent experiment artifacts.',
  records, scope: 'Actual 6000m arrival and 1200s timeout, constrained physical shaft, RK fuel and terminal restoration. Teaching-response acceptance.' };
const index = process.argv.indexOf('--output');
if (index >= 0) writeFileSync(process.argv[index + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, records, wasm_sha256: report.wasm_sha256 }));

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
const nodes = [.1, .25, .5, .75, 1];
const curve = [230, 195, 180, 175, 185];

function independentFuelRate(shaftPowerW, running) {
  if (!running) return 0;
  const load = Math.max(.1, Math.min(1, Math.max(0, shaftPowerW) / 65e6));
  const upper = Math.max(1, nodes.findIndex((value) => value >= load));
  const fraction = (load - nodes[upper - 1]) / (nodes[upper] - nodes[upper - 1]);
  const sfoc = curve[upper - 1] + fraction * (curve[upper] - curve[upper - 1]);
  const engineKw = (Math.max(6.5e6, shaftPowerW) + 2e6) / .95 / 1000;
  return engineKw * sfoc / 3.6e6;
}

const records = [];
for (const loadingRatio of [.2, .35, .6, .8, .9]) {
  const configuration = { vessel: 'container-msc', parameterVersion: 'research-nominal-v2',
    loadingRatio, waterDepthM: 200, environment: 'W1', noiseLevel: 'N1' };
  const simulation = new binding.VesselSimulationSession(JSON.stringify(configuration));
  const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
  try {
    const initial = simulation.snapshot();
    let frame = JSON.parse(simulation.read());
    const input = structuredClone(frame.input);
    let independentFuelKg = 0;
    let shutdownFuelKg;
    for (let tick = 0; tick < 1440; tick += 1) {
      const running = tick < 960 || tick >= 1080;
      if (tick === 960 || tick === 1080) {
        input.actuators.shafts[0].engine_running = running;
        simulation.advance(0, JSON.stringify(input));
      }
      if (tick === 960) shutdownFuelKg = frame.teachingFuel.state.fuel_kg;
      const previousRate = independentFuelRate(frame.teachingFuel.rates.signed_shaft_power_w, running);
      frame = JSON.parse(simulation.advance(1 / 120, ''));
      const rates = frame.teachingFuel.rates;
      independentFuelKg += (previousRate + independentFuelRate(rates.signed_shaft_power_w, running)) / 240;
      assert.equal(rates.running, running);
      if (!running) {
        assert.equal(frame.teachingFuel.state.fuel_kg, shutdownFuelKg);
        assert.equal(frame.truth.actuator_states.motor_torques_nm[0], 0);
      }
    }
    const fuel = frame.teachingFuel.state;
    const relativeFuelError = Math.abs(fuel.fuel_kg / independentFuelKg - 1);
    assert.ok(relativeFuelError < 1e-4, JSON.stringify({ loadingRatio, relativeFuelError }));
    const netPropellerWork = frame.truth.actuator_states.propeller_work_j[0];
    const workResidual = Math.abs(fuel.positive_propeller_work_j - fuel.negative_propeller_work_j - netPropellerWork)
      / Math.max(1, fuel.positive_propeller_work_j);
    assert.ok(workResidual < 1e-12);
    assert.ok(frame.truth.radiation_states.length >= 80);
    assert.ok(frame.dynamics.external_components.tau_wind.some((value) => Math.abs(value) > 1));
    assert.equal(frame.hydrodynamicDepthM, 200);
    restored.restore(simulation.snapshot());
    for (let tick = 0; tick < 24; tick += 1) {
      simulation.advance(1 / 120, '');
      restored.advance(1 / 120, '');
    }
    assert.equal(simulation.snapshot(), restored.snapshot());
    simulation.setPaused(true);
    const paused = simulation.snapshot();
    simulation.advance(1, '');
    assert.equal(simulation.snapshot(), paused);
    simulation.reset();
    assert.equal(simulation.snapshot(), initial);
    records.push({ loading_ratio: loadingRatio, parameter_hash: frame.parameterHash,
      virtual_seconds: frame.timeS, physics_ticks: frame.physicsTicks, control_ticks: frame.controllerTicks,
      radiation_states: frame.truth.radiation_states.length, fuel_kg: fuel.fuel_kg,
      independent_trapezoidal_fuel_kg: independentFuelKg, relative_fuel_quadrature_error: relativeFuelError,
      positive_propeller_work_j: fuel.positive_propeller_work_j,
      negative_propeller_work_j: fuel.negative_propeller_work_j,
      signed_propeller_work_relative_residual: workResidual,
      motor_braking_work_j: frame.teachingFuel.motorBrakingWorkJ,
      shutdown_actual_motor_torque_and_fuel_zero: true, restored_future_bytes_identical: true,
      pause_bytes_identical: true, reset_bytes_identical: true });
  } finally {
    simulation.free();
    restored.free();
  }
}
assert.equal(new Set(records.map((record) => record.parameter_hash)).size, 5);
const report = { schema: 'act.container-fuel-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: sha256(wasm),
  parameter_manifest_sha256: sha256(readFileSync(path.join(root, 'rust/control-engine/model-data/container-msc/v2/manifest.json'))),
  records, scope: 'Actual WASM, five frozen loads, same-source fitted radiation and wind, RK fuel integration, explicit shutdown/restart. T-grade fuel estimate. Normal-page consumption and voyage control remain pending.' };
const index = process.argv.indexOf('--output');
if (index >= 0) writeFileSync(process.argv[index + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, loadings: records.length,
  maximum_relative_fuel_error: Math.max(...records.map((record) => record.relative_fuel_quadrature_error)),
  wasm_sha256: report.wasm_sha256 }));

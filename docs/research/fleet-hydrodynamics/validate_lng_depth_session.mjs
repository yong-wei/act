import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const wasmDirectory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const records = [];

for (const loadingRatio of [.3, .7, .85, .95]) {
  for (const waterDepthM of [40, 200]) {
    const configuration = { vessel: 'lng-changheng', parameterVersion: 'research-nominal-v2',
      loadingRatio, waterDepthM, noiseLevel: 'N1', environment: 'W1' };
    const original = new binding.VesselSimulationSession(JSON.stringify(configuration));
    const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
    try {
      const initial = original.snapshot();
      const input = JSON.parse(original.read()).input;
      for (const surface of input.actuators.surfaces) surface.angle_rad = .05;
      original.advance(0, JSON.stringify(input));
      for (let frame = 0; frame < 120; frame += 1) original.advance(1 / 60, '');
      restored.restore(original.snapshot());
      for (let frame = 0; frame < 60; frame += 1) {
        original.advance(1 / 60, '');
        restored.advance(1 / 60, '');
      }
      assert.equal(original.snapshot(), restored.snapshot());
      const actual = JSON.parse(original.read());
      assert.equal(actual.hydrodynamicDepthM, waterDepthM);
      assert.equal(actual.physicsTicks, 360);
      assert.equal(actual.controllerTicks, 60);
      assert.ok(actual.truth.radiation_states.length >= 80);
      assert.ok(actual.liquidCargo.within_small_amplitude);
      assert.ok(actual.liquidCargo.wall_heights_m.some((value) => Math.abs(value) > 1e-6));
      assert.ok(actual.dynamics.external_components.tau_wind.some((value) => Math.abs(value) > 1));
      const saved = original.snapshot();
      const mismatched = JSON.parse(saved);
      mismatched.configuration.waterDepthM = waterDepthM === 40 ? 200 : 40;
      assert.throws(() => original.restore(JSON.stringify(mismatched)));
      assert.equal(original.snapshot(), saved);
      original.setPaused(true);
      const paused = original.snapshot();
      original.advance(1, '');
      assert.equal(original.snapshot(), paused);
      original.reset();
      assert.equal(original.snapshot(), initial);
      records.push({ loading_ratio: loadingRatio, water_depth_m: waterDepthM,
        parameter_hash: actual.parameterHash, radiation_states: actual.truth.radiation_states.length,
        restored_future_bytes_identical: true, pause_bytes_identical: true, reset_bytes_identical: true,
        conflicting_depth_restore_rejected_without_mutation: true,
        actual_wind_loads_si: actual.dynamics.external_components.tau_wind,
        actual_liquid_wall_heights_m: actual.liquidCargo.wall_heights_m,
        physics_ticks: actual.physicsTicks, controller_ticks: actual.controllerTicks });
    } finally {
      original.free();
      restored.free();
    }
  }
}
assert.equal(new Set(records.map((record) => record.parameter_hash)).size, 8);
const berthConfiguration = { vessel: 'lng-changheng', parameterVersion: 'research-nominal-v2',
  berth: { stopLineNorthM: 0, initialBowDistanceM: 1500 } };
const berth = new binding.VesselSimulationSession(JSON.stringify(berthConfiguration));
try {
  const actual = JSON.parse(berth.read());
  assert.equal(actual.hydrodynamicDepthM, 40);
  assert.ok(Math.abs(actual.berth.bowClearanceM - 1500) < 1e-8);
  assert.throws(() => new binding.VesselSimulationSession(JSON.stringify({ ...berthConfiguration, waterDepthM: 200 })));
} finally {
  berth.free();
}
const report = { schema: 'act.lng-depth-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: sha256(wasm),
  parameter_manifest_sha256: sha256(readFileSync(path.join(root, 'rust/control-engine/model-data/lng-changheng/v2/manifest.json'))),
  records, berth_automatically_selects_forty_meters: true,
  scope: 'Actual WASM with 8 loading/depth combinations, fitted radiation, source wind, coupled liquid cargo, 120Hz RK and 20Hz control. Forward-speed wave calibration and normal-page consumption remain pending.' };
const index = process.argv.indexOf('--output');
if (index >= 0) writeFileSync(process.argv[index + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, combinations: records.length,
  radiation_states: records.map((record) => record.radiation_states), wasm_sha256: report.wasm_sha256 }));

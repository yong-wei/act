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
const configuration = { vessel: 'lng-changheng', parameterVersion: 'research-nominal-v1', noiseLevel: 'N0' };
const read = (session) => JSON.parse(session.read());
const records = [];

for (const delay of [0, 5]) {
  const session = new binding.VesselSimulationSession(JSON.stringify(configuration));
  const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
  try {
    const initial = read(session);
    const rpm = initial.heldCommands.shafts[0].speed_reference_rad_s * 30 / Math.PI;
    const input = JSON.stringify({ ...initial.input, longitudinal: {
      localModel: { structure: { kind: 'fopdt', k: .05, t_s: 100, delay_s: 2 },
        speedMps: 4, shaftReferenceRpm: rpm },
      referenceMps: 3, kpMultiplier: 1, tiMultiplier: 1, antiWindup: true,
      smithEnabled: true, filterTauS: 1, additionalCommandDelayS: delay,
    } });
    session.advance(0, input);
    let requestedTick;
    let appliedTick;
    for (let tick = 0; tick < 160; tick += 1) {
      const actual = JSON.parse(session.advance(.05, ''));
      if (tick === 11) restored.restore(session.snapshot());
      if (tick >= 12) restored.advance(.05, '');
      if (Math.abs(actual.longitudinalController.requestedRpm - rpm) > .1) requestedTick ??= tick;
      if (Math.abs(actual.longitudinalController.appliedRpm - rpm) > .1) appliedTick ??= tick;
    }
    assert.equal(appliedTick - requestedTick, delay * 20);
    assert.equal(session.snapshot(), restored.snapshot());
    const actual = read(session);
    assert.equal(actual.longitudinalController.ticks, 160);
    assert.ok(actual.longitudinalController.feedbackAvailable);
    assert.ok(actual.truth.body_velocity[0] > 3.8);
    assert.notEqual(actual.truth.body_velocity[0], 3);
    const requestRadS = actual.heldCommands.shafts[0].speed_reference_rad_s;
    assert.equal(requestRadS, actual.longitudinalController.appliedRpm * Math.PI / 30);
    assert.notEqual(requestRadS, actual.truth.actuator_states.propeller_shaft_speed_rad_s[0]);
    session.setPaused(true);
    const paused = session.snapshot();
    session.advance(1, '');
    assert.equal(session.snapshot(), paused);
    records.push({ added_delay_s: delay, restored_future_bytes_identical: true,
      pause_bytes_identical: true, first_request_tick: requestedTick,
      first_applied_tick: appliedTick, command_transport_delay_ticks: appliedTick - requestedTick,
      final_body_speed_mps: actual.truth.body_velocity[0],
      shaft_command_rad_s: requestRadS,
      shaft_speed_rad_s: actual.truth.actuator_states.propeller_shaft_speed_rad_s[0],
      controller: actual.longitudinalController });
  } finally {
    session.free();
    restored.free();
  }
}

const berthRecords = [];
for (const initialBowDistanceM of [.05, 10000]) {
  const berthConfiguration = JSON.stringify({ ...configuration,
    berth: { stopLineNorthM: 0, initialBowDistanceM } });
  const session = new binding.VesselSimulationSession(berthConfiguration);
  const restored = new binding.VesselSimulationSession(berthConfiguration);
  const started = performance.now();
  try {
    const initial = read(session);
    assert.ok(Math.abs(initial.berth.bowClearanceM - initialBowDistanceM) < 1e-9);
    let actual = initial;
    for (let second = 0; second < 1201 && !actual.berth.termination; second += 1) {
      actual = JSON.parse(session.advance(1, ''));
    }
    assert.equal(actual.paused, true);
    if (initialBowDistanceM < 1) {
      assert.equal(actual.physicsTicks, 2);
      assert.equal(actual.berth.termination.reason, 'stop_line_crossed');
      assert.ok(actual.berth.bowClearanceM < 0);
    } else {
      assert.equal(actual.physicsTicks, 144000);
      assert.equal(actual.timeS, 1200);
      assert.equal(actual.berth.termination.reason, 'time_limit');
      assert.ok(actual.berth.bowClearanceM > 0);
    }
    const saved = session.snapshot();
    restored.restore(saved);
    restored.setPaused(false);
    restored.advance(1, '');
    assert.equal(saved, restored.snapshot());
    berthRecords.push({ initial_bow_distance_m: initialBowDistanceM,
      actual_time_s: actual.timeS, actual_physics_ticks: actual.physicsTicks,
      termination: actual.berth.termination, restored_terminal_bytes_identical: true,
      elapsed_ms: performance.now() - started });
  } finally {
    session.free();
    restored.free();
  }
}

const report = { schema: 'act.lng-speed-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
  wasm_sha256: sha256(wasm), configuration, control: records, berth: berthRecords,
  scope: 'Actual WASM session and 120Hz physical integration. The local FOPDT is a test controller fixture.' };
const output = `${JSON.stringify(report, null, 2)}\n`;
const outputIndex = process.argv.indexOf('--output');
if (outputIndex !== -1) writeFileSync(process.argv[outputIndex + 1], output);
console.log(output);

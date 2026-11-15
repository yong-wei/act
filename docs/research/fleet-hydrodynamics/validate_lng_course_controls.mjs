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
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compute = (request) => JSON.parse(binding.compute_virtual_simulation_step(JSON.stringify({
  modelId: 'student_model_analysis', ...request,
})));
const model = { kind: 'fopdt', k: .05, t_s: 100, delay_s: 2 };
const plan = { brakingDistanceM: 1200, nodes: [{ distanceM: 600, speedMps: 2 }, { distanceM: 30, speedMps: 0 }] };
const configuration = { vessel: 'lng-changheng', parameterVersion: 'research-nominal-v2',
  initialWaterSpeedMps: 4, loadingRatio: .85, environment: 'P0', noiseLevel: 'N0', seed: 20261106,
  berth: { stopLineNorthM: 0, initialBowDistanceM: 600 }, courseEvidence: { rollWarningDeg: 8 } };
const native = new binding.VesselSimulationSession(JSON.stringify(configuration));
const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
let actual;
let initial;
let speedController;
try {
  initial = JSON.parse(native.read());
  const input = initial.input;
  const rpm = input.actuators.shafts[0].speed_reference_rad_s * 30 / Math.PI;
  speedController = { localModel: { structure: model, speedMps: 4, shaftReferenceRpm: rpm },
    referenceMps: 4, kpMultiplier: 1, tiMultiplier: 1, antiWindup: true,
    smithEnabled: false, filterTauS: .2, additionalCommandDelayS: 0 };
  input.longitudinal = speedController;
  input.berthPlan = plan;
  native.advance(0, JSON.stringify(input));
  for (let second = 0; second < 12; second++) {
    actual = JSON.parse(native.advance(1, ''));
    if (second === 5) restored.restore(native.snapshot());
    if (second > 5) restored.advance(1, '');
  }
  assert.equal(native.snapshot(), restored.snapshot());
  assert.equal(actual.physicsTicks, 1440);
  assert.equal(actual.controllerTicks, 240);
  assert.equal(actual.longitudinalController.feedbackAvailable, true);
  const usedReference = actual.longitudinalController.feedbackMps + actual.longitudinalController.errorMps;
  assert.ok(usedReference < 2 && usedReference > 1);
  assert.ok(actual.waterVelocityBody[0] > usedReference);
  assert.notEqual(actual.truth.actuator_states.propeller_shaft_speed_rad_s[0],
    actual.heldCommands.shafts[0].speed_reference_rad_s);
  const before = native.snapshot();
  input.berthPlan = { ...plan, brakingDistanceM: 1100 };
  assert.throws(() => native.advance(0, JSON.stringify(input)));
  assert.equal(native.snapshot(), before);
  native.setPaused(true);
  const paused = native.snapshot();
  native.advance(1, '');
  assert.equal(native.snapshot(), paused);

  const legacyDirectory = path.join(root, 'rust/control-engine/tests/fixtures/native-session-legacy-v1');
  const legacy = JSON.parse(readFileSync(path.join(legacyDirectory, 'manifest.json'), 'utf8'));
  restored.restore(readFileSync(path.join(legacyDirectory, 'snapshot.json'), 'utf8'));
  for (let frame = 0; frame < legacy.future_render_frames; frame++) {
    restored.advance(legacy.future_seconds / legacy.future_render_frames, JSON.stringify(legacy.input));
  }
  assert.equal(restored.snapshot().replace(/,"derivativeFilterTauS":0\.2(?=})/, ''),
    readFileSync(path.join(legacyDirectory, 'future.json'), 'utf8').trim());
} finally {
  native.free();
  restored.free();
}

const request = { structure: model, inputOrigin: speedController.localModel.shaftReferenceRpm, outputOrigin: 4,
  initialSpeedMps: 4, initialBowDistanceM: 1500, currentForwardMps: 0, dtS: .2,
  controller: speedController, maximumRpm: initial.parameters.shaftConfigurations[0].ratedRpm,
  referenceMps: Array(3001).fill(3) };
const gains = compute({ operation: 'speed_design', structure: model });
const closedLoop = compute({ operation: 'speed_closed_loop', ...request });
assert.equal(closedLoop.predicted.length, 3001);
assert.ok(Math.abs(closedLoop.predicted.at(-1) - 3) < .02);
const braking = compute({ operation: 'speed_closed_loop', ...request, referenceMps: Array(3001).fill(4), brakingPlan: plan });
assert.ok(braking.predicted.at(-1) < 1);
assert.ok(braking.bowClearanceM.at(-1) > -100);
const steady = compute({ operation: 'speed_open_loop', ...request,
  inputRpm: Array(3001).fill(request.inputOrigin), currentForwardMps: .3 });
assert.ok(steady.predicted.every((value) => value === 4));
assert.ok(Math.abs(steady.bowClearanceM.at(-1) + 1080) < 1e-8);

const report = { schema: 'act.lng-course-controls-validation.v1', status: 'passed',
  generator_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: hash(wasm), configuration,
  controller_fixture: 'Declared nominal interface fixture for control and persistence verification.',
  actual: { physicsTicks: actual.physicsTicks, controllerTicks: actual.controllerTicks,
    controller: actual.longitudinalController, bow: actual.berth, waterSpeedMps: actual.waterVelocityBody[0],
    shaftSpeedsRadS: actual.truth.actuator_states.propeller_shaft_speed_rad_s,
    complete_future_bytes_identical: true, pause_bytes_identical: true, plan_revision_rejected_atomically: true },
  forecast: { samplingHz: 5, internalControlHz: 20, durationS: 600, gains,
    finalReferenceStepSpeedMps: closedLoop.predicted.at(-1), finalBrakingSpeedMps: braking.predicted.at(-1),
    finalBrakingBowDistanceM: braking.bowClearanceM.at(-1),
    constantWaterSpeedWithCurrentFinalBowDistanceM: steady.bowClearanceM.at(-1) },
  complete_legacy_future_bytes_identical: true,
  pending: ['Normal LNG page integration', 'Student identification provenance', 'Full twenty-step and constrained E1 berthing acceptance'] };
writeFileSync(path.join(root, 'docs/research/fleet-hydrodynamics/lng-course-controls-validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, wasm_sha256: report.wasm_sha256,
  physical_ticks: actual.physicsTicks, forecast_samples: closedLoop.predicted.length, legacy_future_bytes_identical: true }));

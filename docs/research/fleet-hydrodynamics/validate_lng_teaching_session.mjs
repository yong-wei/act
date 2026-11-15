import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '../../..');
const evidenceDirectory = path.join(root, 'docs/research/fleet-hydrodynamics');
const referencePath = path.join(evidenceDirectory, 'lng-course-reference-model.json');
const outputPath = path.join(evidenceDirectory, 'lng-teaching-session-validation.json');
const referenceBytes = readFileSync(referencePath);
const sourceModel = JSON.parse(referenceBytes);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const generatorHash = sha256(readFileSync(scriptPath));
const referenceHash = sha256(referenceBytes);
const wasmDirectory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const wasmHash = sha256(wasm);
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
assert.equal(sourceModel.durationS, 600);
assert.equal(sourceModel.controlSamples, 12000);
assert.equal(sourceModel.structure.kind, 'fopdt');

const base = { ...sourceModel.configuration, waterDepthM: 40,
  berth: { stopLineNorthM: 0, initialBowDistanceM: 1500 } };
const controller = { localModel: { structure: sourceModel.structure, speedMps: 4,
  shaftReferenceRpm: sourceModel.operatingPoint.inputOrigin }, referenceMps: 4,
  kpMultiplier: 1, tiMultiplier: 1, antiWindup: true, smithEnabled: false,
  filterTauS: .2, additionalCommandDelayS: 0 };
const speedPlan = { brakingDistanceM: 1200,
  nodes: [{ distanceM: 600, speedMps: 2 }, { distanceM: 30, speedMps: 0 }] };
const cases = [
  { name: 'calm-default', configuration: base },
  { name: 'combined-default', configuration: { ...base, environment: 'E1', noiseLevel: 'N1' } },
];

// 在长运行前建立全部初态，避免后续条件构造失败丢失先前结果。
for (const item of cases) {
  const native = new binding.VesselSimulationSession(JSON.stringify(item.configuration));
  try { assert.equal(JSON.parse(native.read()).timeS, 0); }
  finally { native.free(); }
}
const identity = { wasmSha256: wasmHash, generatorSha256: generatorHash, referenceModelSha256: referenceHash };
let report = { schema: 'act.lng-teaching-session-validation.v2', status: 'running', ...identity,
  authorship: 'Automated acceptance fixture reusing the frozen model identified through the original LNG page.',
  controller, speedPlan, cases: {},
  cadence: { physicsHz: 120, controlHz: 20, diagnosticSloshingHz: 1 },
  pending: ['Full-rate liquid-surface constraints', 'Reference refinement for demonstrated below-target conditions',
    'Remaining normal-page workflow and teaching acceptance'] };
if (existsSync(outputPath)) {
  const previous = JSON.parse(readFileSync(outputPath));
  assert.equal(previous.schema, report.schema, 'Keep earlier evidence under its original schema before continuing.');
  for (const [key, value] of Object.entries(identity)) assert.equal(previous[key], value, `Evidence source changed: ${key}`);
  report = previous;
}
function persist() {
  assert.equal(sha256(readFileSync(scriptPath)), generatorHash, 'Generator changed during the run.');
  assert.equal(sha256(readFileSync(referencePath)), referenceHash, 'Frozen model changed during the run.');
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
persist();

function runCase(item) {
  const native = new binding.VesselSimulationSession(JSON.stringify(item.configuration));
  const controls = [];
  const liquid = [];
  try {
    let frame = JSON.parse(native.read());
    const input = structuredClone(frame.input);
    input.controlMode = 'pd'; input.pid = { kp: 1.5, ki: 0, kd: 20 }; input.feedback = 'measurement';
    input.longitudinal = controller; input.berthPlan = speedPlan;
    native.advance(0, JSON.stringify(input));
    for (let second = 0; second < 1200; second++) {
      frame = JSON.parse(native.advance(1, ''));
      for (const point of frame.controlSamples) {
        assert.ok(Number.isFinite(point.bowClearanceM));
        controls.push({ timeS: point.timeS, northM: point.truth.position_ned[0], eastM: point.truth.position_ned[1],
          headingDeg: point.attitudeDeg.heading, bowClearanceM: point.bowClearanceM,
          waterSpeedMps: point.waterVelocityBody[0], groundBodySpeedMps: point.truth.body_velocity[0] });
      }
      if (frame.liquidCargo) {
        const amplitudes = frame.liquidCargo.wall_heights_m;
        const cornerHeightM = Math.max(...Array.from({ length: amplitudes.length / 2 }, (_, index) =>
          Math.abs(amplitudes[2 * index]) + Math.abs(amplitudes[2 * index + 1])));
        liquid.push({ timeS: frame.timeS, cornerHeightM, withinSmallAmplitude: frame.liquidCargo.within_small_amplitude });
      }
      if (frame.berth.termination) break;
    }
    const finalWindow = controls.filter((point) => point.timeS >= frame.timeS - 60);
    const lateralMaximumM = Math.max(...finalWindow.map((point) => Math.abs(point.eastM)));
    const headingMaximumDeg = Math.max(...finalWindow.map((point) => Math.abs(point.headingDeg)));
    const sampledSloshingMaximumM = Math.max(...liquid.map((point) => point.cornerHeightM));
    const conditions = { bowDistance: frame.berth.bowClearanceM >= 10 && frame.berth.bowClearanceM <= 60,
      longitudinalGroundSpeed: Math.abs(frame.berth.northGroundSpeedMps) <= .2,
      final60sLateral: lateralMaximumM <= 20, final60sHeading: headingMaximumDeg <= 3 };
    return { status: Object.values(conditions).every(Boolean) ? 'requires-full-rate-liquid-check' : 'below-target',
      conditions, configuration: item.configuration, finalTimeS: frame.timeS,
      bowClearanceM: frame.berth.bowClearanceM, northGroundSpeedMps: frame.berth.northGroundSpeedMps,
      final60sLateralMaximumM: lateralMaximumM, final60sHeadingMaximumDeg: headingMaximumDeg,
      sampledSloshingMaximumM, sampledLiquidWithinDomain: liquid.every((point) => point.withinSmallAmplitude),
      fineStepMetrics: frame.fineStepMetrics, actualTermination: frame.berth.termination,
      checkpointSha256: sha256(native.snapshot()), controlSamples: controls, sampledLiquid: liquid };
  } finally { native.free(); }
}

for (const item of cases) {
  if (report.cases[item.name]?.status && report.cases[item.name].status !== 'failed') continue;
  try {
    report.cases[item.name] = runCase(item);
    persist();
    const result = report.cases[item.name];
    console.log(JSON.stringify({ case: item.name, status: result.status, timeS: result.finalTimeS,
      bowClearanceM: result.bowClearanceM, groundSpeedMps: result.northGroundSpeedMps,
      lateralMaximumM: result.final60sLateralMaximumM, headingMaximumDeg: result.final60sHeadingMaximumDeg,
      sampledSloshingMaximumM: result.sampledSloshingMaximumM }));
  } catch (error) {
    report.cases[item.name] = { status: 'failed', message: String(error) };
    report.status = 'partial'; persist(); throw error;
  }
}
report.status = 'partial';
persist();
console.log(JSON.stringify({status:report.status, wasmSha256:wasmHash, completedCases:Object.keys(report.cases)}));

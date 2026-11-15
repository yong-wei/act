import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '../../..');
const directory = path.dirname(scriptPath);
const modelPath = path.join(directory, 'lng-course-reference-model.json');
const model = JSON.parse(readFileSync(modelPath));
const wasmDirectory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const identity = { generatorSha256: sha(readFileSync(scriptPath)), wasmSha256: sha(wasm),
  referenceModelSha256: sha(readFileSync(modelPath)) };
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const controller = { localModel: { structure: model.structure, speedMps: 4,
  shaftReferenceRpm: model.operatingPoint.inputOrigin }, referenceMps: 4, kpMultiplier: 1, tiMultiplier: 1,
  antiWindup: true, smithEnabled: false, filterTauS: .2, additionalCommandDelayS: 0 };
const speedPlan = { brakingDistanceM: 1200,
  nodes: [{ distanceM: 600, speedMps: 2 }, { distanceM: 30, speedMps: 0 }] };
const defaultCases = [
  { name: 'calm-student-finish', environment: 'P0', noiseLevel: 'N0' },
  { name: 'combined-timed-heading', environment: 'E1', noiseLevel: 'N1', headingNodes: [
    { timeS: 0, headingDeg: -9 }, { timeS: 200, headingDeg: -9 }, { timeS: 400, headingDeg: 0 }] },
];
const cases = process.argv[2] ? [{name:'combined-timed-heading',environment:'E1',noiseLevel:'N1',
  headingNodes:JSON.parse(process.argv[2])}] : defaultCases;
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(directory, 'lng-berth-reference-validation.json');
let report = { schema: 'act.lng-berth-reference.v1', ...identity,
  authorship: 'Automated acceptance fixture using the model identified through the original LNG page.',
  maximumDurationS: 1200, liquidMetricCadenceHz: 120, controller, speedPlan, caseDefinitions:cases, cases: {} };
if (existsSync(outputPath)) {
  report = JSON.parse(readFileSync(outputPath));
  for (const [key, value] of Object.entries(identity)) assert.equal(report[key], value, `Changed source ${key}`);
  assert.deepEqual(report.caseDefinitions,cases,'Keep previous case definitions before changing a reference.');
}
function save() {
  assert.equal(sha(readFileSync(scriptPath)), identity.generatorSha256);
  assert.equal(sha(readFileSync(modelPath)), identity.referenceModelSha256);
  const lines = `${JSON.stringify(report, null, 2)}\n`.split('\n');
  writeFileSync(outputPath, '');
  for (let index = 0; index < lines.length; index += 500) {
    writeFileSync(outputPath, lines.slice(index, index + 500).join('\n') + (index + 500 < lines.length ? '\n' : ''), { flag: 'a' });
  }
}
for (const item of cases) {
  if (report.cases[item.name]) continue;
  const configuration = { ...model.configuration, environment: item.environment, noiseLevel: item.noiseLevel,
    waterDepthM: 40, berth: { stopLineNorthM: 0, initialBowDistanceM: 1500 } };
  const native = new binding.VesselSimulationSession(JSON.stringify(configuration));
  const milestones = [];
  try {
    let frame = JSON.parse(native.read());
    const input = structuredClone(frame.input);
    input.controlMode = 'pd'; input.pid = { kp: 1.5, ki: 0, kd: 20 }; input.feedback = 'measurement';
    input.longitudinal = controller;
    input.berthPlan = { ...speedPlan, ...(item.headingNodes ? { headingNodes: item.headingNodes } : {}) };
    native.advance(0, JSON.stringify(input));
    const preflight = native.snapshot();
    native.restore(preflight);
    assert.equal(native.snapshot(), preflight, 'Initial persistent state must round trip before the long run.');
    let conditions;
    for (let second = 1; second <= 1200; second++) {
      frame = JSON.parse(native.advance(1, ''));
      const metrics = frame.fineStepMetrics.values.lng;
      assert.equal(metrics.physicsSamples, frame.physicsTicks);
      conditions = { bowDistance: frame.berth.bowClearanceM >= 10 && frame.berth.bowClearanceM <= 60,
        longitudinalGroundSpeed: Math.abs(metrics.finalNorthGroundSpeedMps) <= .2,
        final60sLateral: metrics.lateralWindowDurationS === 60 && metrics.final60sLateralMaximumM <= 20,
        finalHeading: Math.abs(metrics.finalHeadingDeg) <= 3,
        liquidDomain: metrics.outsideLiquidDomainDurationS === 0 };
      if (second % 30 === 0 || Object.values(conditions).every(Boolean) || frame.berth.termination) {
        milestones.push({ timeS: frame.timeS, bowClearanceM: frame.berth.bowClearanceM,
          headingDeg: frame.attitudeDeg.heading, eastM: frame.truth.position_ned[1],
          northGroundSpeedMps: metrics.finalNorthGroundSpeedMps, lateralMaximumM: metrics.final60sLateralMaximumM });
      }
      if (Object.values(conditions).every(Boolean) || frame.berth.termination) break;
    }
    native.setPaused(true);
    const snapshot = native.snapshot();
    const restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
    try { restored.restore(snapshot); assert.equal(restored.snapshot(), snapshot, 'Persistent state must round trip.'); }
    finally { restored.free(); }
    report.cases[item.name] = { status: Object.values(conditions).every(Boolean) ? 'passed' : 'below-target',
      configuration, input: frame.input, timeS: frame.timeS, conditions,
      fineStepMetrics: frame.fineStepMetrics.values, checkpointSha256: sha(snapshot), milestones };
    save();
    console.log(JSON.stringify({ case: item.name, ...report.cases[item.name], input: undefined, milestones: undefined }));
  } finally { native.free(); }
}
report.status = Object.values(report.cases).every((item) => item.status === 'passed') ? 'passed' : 'partial';
save();

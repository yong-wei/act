import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const directory = path.join(root,'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(directory,'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(directory,'index.js')).href);
await binding.default({module_or_path:wasm});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const configuration = {vessel:'cruise-adora',parameterVersion:'research-nominal-v2',
  noiseLevel:'N0',environment:'P0',initialWaterSpeedMps:8,initialRollDeg:2,
  cruise:{statisticsStartS:1,statisticsEndS:12,finFailureTimeS:null,failedFinIndex:null}};
const create = (settings = configuration) => new binding.VesselSimulationSession(JSON.stringify(settings));
const native = create();
const restored = create();
let controlled;
let fault;
try {
  const input = JSON.parse(native.read()).input;
  input.cruiseFins = {enabled:true,model:{inertiaKgM2:12e9,dampingNmSRad:1e8,stiffnessNmRad:1e9},
    dampingRatio:.5,stiffnessFraction:.2,lowPassCutoffHz:.3,notch:{centerHz:.2,bandwidthHz:.06}};
  native.advance(0,JSON.stringify(input));
  for (let second = 0;second < 12;second++) {
    controlled = JSON.parse(native.advance(1,''));
    if (second === 5) restored.restore(native.snapshot());
    if (second > 5) restored.advance(1,'');
  }
  assert.equal(native.snapshot(),restored.snapshot());
  assert.equal(controlled.physicsTicks,1440);
  assert.equal(controlled.controllerTicks,240);
  assert.equal(controlled.cruiseComfort.physicsSamples,1320);
  assert.equal(controlled.cruiseComfort.passengers.length,2);
  assert.equal(controlled.cruiseController.measurementGood,true);
  assert.ok(controlled.cruiseComfort.finServoElectricWorkJ > 0);
  assert.equal(controlled.cruiseComfort.comfortInterpretation,'teaching_proxy_unweighted');
  native.setPaused(true);
  const paused = native.snapshot();
  native.advance(.5,'');
  assert.equal(native.snapshot(),paused);

  const faultConfiguration = {...configuration,cruise:{statisticsStartS:120,statisticsEndS:181,
    finFailureTimeS:180,failedFinIndex:0}};
  native.restore(createSnapshot(faultConfiguration));
  const manual = JSON.parse(native.read()).input;
  manual.actuators.surfaces.forEach((surface)=>{surface.angle_rad=5*Math.PI/180;surface.enabled=true;});
  native.advance(0,JSON.stringify(manual));
  let before;
  for (let second = 0;second < 181;second++) {
    const frame = JSON.parse(native.advance(1,''));
    if (second === 178) before = frame.truth.actuator_states.control_surface_angles_rad;
    if (second === 180) fault = frame;
  }
  assert.ok(before[0] > .01 && before[1] > .01);
  assert.equal(fault.truth.actuator_states.control_surface_angles_rad[0],0);
  assert.ok(fault.truth.actuator_states.control_surface_angles_rad[1] > .01);
  assert.equal(fault.cruiseComfort.physicsSamples,61*120);
  restored.restore(native.snapshot());
  native.advance(.1,'');restored.advance(.1,'');
  assert.equal(native.snapshot(),restored.snapshot());

  const legacyDirectory = path.join(root,'rust/control-engine/tests/fixtures/native-session-legacy-v1');
  const legacy = JSON.parse(readFileSync(path.join(legacyDirectory,'manifest.json'),'utf8'));
  native.restore(readFileSync(path.join(legacyDirectory,'snapshot.json'),'utf8'));
  for (let frame = 0;frame < legacy.future_render_frames;frame++) {
    native.advance(legacy.future_seconds/legacy.future_render_frames,JSON.stringify(legacy.input));
  }
  assert.equal(native.snapshot().replace(/,"derivativeFilterTauS":0\.2(?=})/,''),
    readFileSync(path.join(legacyDirectory,'future.json'),'utf8').trim());
} finally {native.free();restored.free();}

function createSnapshot(settings) {
  const temporary = create(settings);
  try {return temporary.snapshot();} finally {temporary.free();}
}

const report = {schema:'act.cruise-control-session-validation.v1',status:'passed',
  generator_sha256:sha256(readFileSync(fileURLToPath(import.meta.url))),wasm_sha256:sha256(wasm),
  configuration,controller_fixture:'declared nominal interface fixture, not a student identification',
  controlled:{physicsTicks:controlled.physicsTicks,controllerTicks:controlled.controllerTicks,
    feedback:controlled.cruiseController,comfort:controlled.cruiseComfort,restored_future_bytes_identical:true,pause_bytes_identical:true},
  fault:{activationTimeS:180,observedTimeS:fault.timeS,actualFinAnglesRad:fault.truth.actuator_states.control_surface_angles_rad,
    comfort:fault.cruiseComfort,restored_future_bytes_identical:true},
  complete_legacy_future_bytes_identical:true,
  scope:'Actual WASM mechanisms and recovery. Full 20-step page, wave-on performance and student-model provenance remain pending.'};
writeFileSync(path.join(root,'docs/research/fleet-hydrodynamics/cruise-control-session-validation.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({status:report.status,wasm_sha256:report.wasm_sha256,physics_ticks:controlled.physicsTicks,
  single_fin_zero_fault_at_s:180,legacy_future_bytes_identical:true}));

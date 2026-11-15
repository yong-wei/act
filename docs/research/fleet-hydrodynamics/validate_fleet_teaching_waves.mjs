import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const generatorPath = fileURLToPath(import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const generatorHash = hash(readFileSync(generatorPath));
const directory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const wasm = readFileSync(path.join(directory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(directory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const conditions = [
  ...[.3, .7, .85, .95].flatMap((loadingRatio) => [40, 200].map((waterDepthM) => ({
    vessel: 'lng-changheng', loadingRatio, waterDepthM,
  }))),
  ...[.2, .35, .6, .8, .9].map((loadingRatio) => ({
    vessel: 'container-msc', loadingRatio, waterDepthM: 200,
  })),
  ...['cruise-adora', 'icebreaker-xuelong2', 'dredger-tianjing'].map((vessel) => ({ vessel })),
];
const records = [];
for (const condition of conditions) {
  const pack = path.join(root, 'rust/control-engine/model-data', condition.vessel, 'v3');
  const assets = JSON.parse(readFileSync(path.join(pack, 'wave-assets.json'), 'utf8'));
  const descriptor = assets.conditions?.find((item) => item.loading_ratio === condition.loadingRatio
    && item.water_depth_m === condition.waterDepthM)?.first_order ?? assets.first_order;
  assert.equal(hash(readFileSync(path.join(pack, descriptor.metadata_file))), descriptor.metadata_sha256);
  assert.equal(hash(readFileSync(path.join(pack, descriptor.data_file))), descriptor.data_sha256);
  for (const environment of ['P0', 'V1', 'E1']) {
    const configuration = { ...condition, parameterVersion: 'research-nominal-v3', environment, noiseLevel: 'N1' };
    const session = new binding.VesselSimulationSession(JSON.stringify(configuration));
    const other = new binding.VesselSimulationSession(JSON.stringify({ ...configuration,
      ...(condition.vessel === 'lng-changheng' ? { loadingRatio: .95 }
        : condition.vessel === 'container-msc' ? { loadingRatio: .9 } : {}),
    }));
    try {
      const initial = session.snapshot();
      for (let frame = 0; frame < 12; frame++) session.advance(1 / 60, '');
      other.restore(session.snapshot());
      for (let frame = 0; frame < 6; frame++) {
        session.advance(1 / 60, ''); other.advance(1 / 60, '');
      }
      assert.equal(session.snapshot(), other.snapshot());
      const frame = JSON.parse(session.read());
      assert.equal(frame.physicsTicks, 36); assert.equal(frame.controllerTicks, 6);
      assert.equal(frame.waveModel.firstOrderLoaded, true);
      assert.equal(frame.waveModel.firstOrderEnabled, environment !== 'P0');
      assert.equal(frame.waveModel.firstOrderMetadataHash, descriptor.metadata_fnv1a64);
      const external = frame.dynamics.external_components;
      if (environment === 'P0') assert.deepEqual(external.tau_wave_1, [0, 0, 0, 0, 0, 0]);
      else assert(external.tau_wave_1.some((value) => Math.abs(value) > 1));
      assert.deepEqual(external.tau_wave_2, [0, 0, 0, 0, 0, 0]);
      for (let axis = 0; axis < 6; axis++) assert.equal(frame.dynamics.breakdown.external[axis],
        external.tau_hull_viscous[axis] + external.tau_actuator[axis] + external.tau_wind[axis]
          + external.tau_wave_1[axis] + external.tau_wave_2[axis] + external.tau_special[axis]);
      session.setPaused(true);
      const paused = session.snapshot(); session.advance(.2, ''); assert.equal(session.snapshot(), paused);
      const corrupted = paused.replace(/"parameter_hash":"[^"]+"/, '"parameter_hash":"fnv1a-0000000000000000"');
      assert.notEqual(corrupted, paused); assert.throws(() => session.restore(corrupted));
      assert.equal(session.snapshot(), paused);
      session.reset(); assert.equal(session.snapshot(), initial);
      records.push({ configuration, parameter_hash: frame.parameterHash, wave_model: frame.waveModel,
        actual_wave_loads_si: external.tau_wave_1, cross_loading_future_identical: true,
        pause_reset_and_failed_restore_identical: true });
    } finally { session.free(); other.free(); }
  }
}
const legacyDirectory = path.join(root, 'rust/control-engine/tests/fixtures/native-session-legacy-v1');
const legacy = JSON.parse(readFileSync(path.join(legacyDirectory, 'manifest.json'), 'utf8'));
const restored = new binding.VesselSimulationSession(JSON.stringify({
  vessel: 'lng-changheng', parameterVersion: 'research-nominal-v3', loadingRatio: .3, waterDepthM: 40,
}));
try {
  restored.restore(readFileSync(path.join(legacyDirectory, 'snapshot.json'), 'utf8'));
  for (let frame = 0; frame < legacy.future_render_frames; frame++) {
    restored.advance(legacy.future_seconds / legacy.future_render_frames, JSON.stringify(legacy.input));
  }
  assert.equal(restored.snapshot().replace(/,"derivativeFilterTauS":0\.2(?=})/, ''),
    readFileSync(path.join(legacyDirectory, 'future.json'), 'utf8').trim());
} finally { restored.free(); }
assert.equal(hash(readFileSync(generatorPath)), generatorHash);
const report = { schema: 'act.fleet-teaching-wave-session-validation.v1', status: 'passed',
  generator_sha256: generatorHash, wasm_sha256: hash(wasm),
  conditions: records, complete_legacy_future_identical: true,
  scope: 'Actual WASM with frozen first-order arrays, 120Hz physical and 20Hz control clocks. Source solver residuals remain in each pack.',
  approximation: 'Zero-speed diffraction coefficients with actual world-position encounter phase.',
  pending: ['Vessel wave calibration', 'Forward-speed diffraction correction', 'Normal page and teaching reference acceptance'] };
writeFileSync(path.join(root, 'docs/research/fleet-hydrodynamics/fleet-teaching-wave-session-validation.json'),
  `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, wasm_sha256: report.wasm_sha256,
  loading_depth_conditions: conditions.length, actual_sessions: records.length }));

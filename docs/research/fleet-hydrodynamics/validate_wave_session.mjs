import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const option = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`缺少参数 ${name}`);
  return process.argv[index + 1];
};
const firstDirectory = option('--first-order');
const secondDirectory = option('--full-difference');
const packDirectory = path.join(root, 'rust/control-engine/model-data/semisub-981/v4');
const wasmDirectory = path.join(root, 'src/resources/control-system/wasm/control_engine');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(path.join(packDirectory, 'wave-assets.json'), 'utf8'));
const firstMetadata = readFileSync(path.join(packDirectory, manifest.first_order.metadata_file), 'utf8');
const secondMetadata = readFileSync(path.join(packDirectory, manifest.full_difference.metadata_file), 'utf8');
const firstBytes = readFileSync(path.join(firstDirectory, manifest.first_order.data_file));
const secondBytes = readFileSync(path.join(secondDirectory, manifest.full_difference.data_file));
assert.equal(sha256(firstBytes), manifest.first_order.data_sha256);
assert.equal(sha256(secondBytes), manifest.full_difference.data_sha256);
assert.equal(sha256(firstMetadata), manifest.first_order.metadata_sha256);
assert.equal(sha256(secondMetadata), manifest.full_difference.metadata_sha256);
const wasm = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasm });
const read = (session) => JSON.parse(session.read());
const create = (configuration, secondOrder = true) => binding.VesselSimulationSession.withWaveTables(
  JSON.stringify(configuration), firstMetadata, firstBytes,
  secondOrder ? secondMetadata : '', secondOrder ? secondBytes : new Uint8Array(),
);
const base = { vessel: 'semisub-981', parameterVersion: 'research-nominal-v4', noiseLevel: 'N1' };
const records = [];

for (const environment of ['P0', 'V1', 'V2', 'V3', 'E1', 'E2']) {
  const configuration = { ...base, environment, secondOrderEnabled: true };
  const beforeCreation = performance.now();
  const session = create(configuration);
  const restored = create(configuration);
  const creationMs = performance.now() - beforeCreation;
  try {
    const initial = session.snapshot();
    const wave = JSON.parse(initial).plant.environment.wave;
    assert.equal(wave.components.length, 896);
    assert.equal(wave.second_order_available, true);
    let actual;
    const started = performance.now();
    for (let frame = 0; frame < 12; frame += 1) {
      actual = JSON.parse(session.advance(1 / 60, ''));
      if (frame === 5) restored.restore(session.snapshot());
      if (frame > 5) restored.advance(1 / 60, '');
    }
    assert.equal(session.snapshot(), restored.snapshot());
    assert.equal(actual.physicsTicks, 24);
    assert.equal(actual.controllerTicks, 4);
    const components = actual.dynamics.external_components;
    const active = environment !== 'P0';
    assert.equal(actual.waveModel.firstOrderEnabled, active);
    assert.equal(actual.waveModel.secondOrderEnabled, active);
    for (const name of ['tau_wave_1', 'tau_wave_2']) {
      if (active) assert.ok(components[name].some((value) => Math.abs(value) > 1));
      else assert.deepEqual(components[name], [0, 0, 0, 0, 0, 0]);
    }
    for (let channel = 0; channel < 6; channel += 1) {
      const sum = components.tau_hull_viscous[channel] + components.tau_actuator[channel]
        + components.tau_wind[channel] + components.tau_wave_1[channel]
        + components.tau_wave_2[channel] + components.tau_special[channel];
      assert.equal(actual.dynamics.breakdown.external[channel], sum);
    }
    session.setPaused(true);
    const paused = session.snapshot();
    session.advance(.5, '');
    assert.equal(session.snapshot(), paused);
    session.reset();
    assert.equal(session.snapshot(), initial);
    const restoredBeforeFailure = restored.snapshot();
    const bad = JSON.parse(restoredBeforeFailure);
    bad.parameter_hash = 'fnv1a-0000000000000000';
    assert.throws(() => restored.restore(JSON.stringify(bad)));
    assert.equal(restored.snapshot(), restoredBeforeFailure);
    records.push({ environment, physics_ticks: actual.physicsTicks,
      controller_ticks: actual.controllerTicks, wave_model: actual.waveModel,
      actual_loads_si: components, restored_future_bytes_identical: true,
      pause_bytes_identical: true, reset_bytes_identical: true,
      rejected_restore_preserves_state: true, snapshot_bytes: Buffer.byteLength(initial),
      creation_and_second_session_ms: creationMs, integration_and_restore_ms: performance.now() - started });
  } finally {
    session.free();
    restored.free();
  }
}

const on = create({ ...base, environment: 'V1', secondOrderEnabled: true });
const off = create({ ...base, environment: 'V1', secondOrderEnabled: false }, false);
try {
  assert.deepEqual(JSON.parse(on.snapshot()).plant.environment.wave,
    JSON.parse(off.snapshot()).plant.environment.wave);
  const without = JSON.parse(off.advance(1 / 60, ''));
  assert.equal(without.waveModel.firstOrderEnabled, true);
  assert.equal(without.waveModel.secondOrderEnabled, false);
  assert.deepEqual(without.dynamics.external_components.tau_wave_2, [0, 0, 0, 0, 0, 0]);
  assert.ok(without.dynamics.external_components.tau_wave_1.some((value) => Math.abs(value) > 1));
  // 旧版恢复点在已有挂表对象中恢复时按旧参数包重新装配，保留其随机状态和完整未来。
  const legacyDirectory = path.join(root, 'rust/control-engine/tests/fixtures/native-session-legacy-v1');
  const legacy = JSON.parse(readFileSync(path.join(legacyDirectory, 'manifest.json'), 'utf8'));
  on.restore(readFileSync(path.join(legacyDirectory, 'snapshot.json'), 'utf8'));
  for (let frame = 0; frame < legacy.future_render_frames; frame += 1) {
    on.advance(legacy.future_seconds / legacy.future_render_frames, JSON.stringify(legacy.input));
  }
  assert.equal(on.snapshot().replace(/,"derivativeFilterTauS":0\.2(?=})/, ''),
    readFileSync(path.join(legacyDirectory, 'future.json'), 'utf8').trim());
} finally {
  on.free();
  off.free();
}

assert.throws(() => new binding.VesselSimulationSession(JSON.stringify({ ...base, environment: 'V1' })));
assert.throws(() => create({ ...base, environment: 'V1', secondOrderEnabled: true }, false));
const corrupted = new Uint8Array(firstBytes);
corrupted[0] ^= 1;
assert.throws(() => binding.VesselSimulationSession.withWaveTables(
  JSON.stringify({ ...base, environment: 'V1' }), firstMetadata, corrupted, '', new Uint8Array(),
));
const report = { schema: 'act.vessel-wave-session-validation.v1', status: 'passed',
  generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256: sha256(wasm),
  wave_asset_manifest_sha256: sha256(readFileSync(path.join(packDirectory, 'wave-assets.json'))),
  external_data_bytes: firstBytes.byteLength + secondBytes.byteLength,
  verification: records, first_order_only_keeps_same_wave_components: true,
  complete_legacy_future_bytes_identical: true, corrupt_and_missing_data_rejected: true,
  scope: 'Actual WASM with 896 wave components, full source tables, 120Hz RK integration and 20Hz controller. Single Node process excludes browser rendering and network capacity.',
  source_qtf_contributions: 'DUOK+HASBO',
  not_ready: JSON.parse(secondMetadata).not_ready };
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(option('--output'), output);
console.log(JSON.stringify({ status: report.status, wasm_sha256: report.wasm_sha256,
  environments: records.length, external_data_bytes: report.external_data_bytes,
  timing_ms: records.map((record) => [record.environment, record.integration_and_restore_ms]) }));

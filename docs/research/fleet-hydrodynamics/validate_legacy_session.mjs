import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf('--output');
const output = outputIndex === -1 ? null : argumentsList[outputIndex + 1];
const fixtureDirectory = path.join(repository, 'rust/control-engine/tests/fixtures/native-session-legacy-v1');
const wasmDirectory = path.join(repository, 'src/resources/control-system/wasm/control_engine');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const snapshot = readFileSync(path.join(fixtureDirectory, 'snapshot.json'), 'utf8');
const future = readFileSync(path.join(fixtureDirectory, 'future.json'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(fixtureDirectory, 'manifest.json'), 'utf8'));
assert.equal(sha256(snapshot), manifest.snapshot_sha256);
assert.equal(sha256(future), manifest.future_sha256);
const bytes = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: bytes });
const simulation = new binding.VesselSimulationSession(JSON.stringify(manifest.configuration));
try {
  simulation.restore(snapshot);
  assert.equal(JSON.parse(simulation.read()).modelVersion, 'sixdof-session-v1');
  const input = JSON.stringify(manifest.input);
  for (let frame = 0; frame < manifest.future_render_frames; frame += 1) {
    simulation.advance(manifest.future_seconds / manifest.future_render_frames, input);
  }
  const actual = simulation.snapshot();
  // 唯一新增缺省输入字段由反序列化补齐。其余原始字节含u64状态完整对账。
  assert.equal(actual.replace(/,"derivativeFilterTauS":0\.2(?=})/, ''), future.trim());
  const report = {
    schema: 'act.native-session.legacy-restore-validation.v1', status: 'passed',
    generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    fixture_manifest_sha256: sha256(readFileSync(path.join(fixtureDirectory, 'manifest.json'))),
    source_fixture_revision: manifest.source_revision,
    source_fixture_wasm_sha256: manifest.wasm_sha256, restored_wasm_sha256: sha256(bytes),
    restored_model_version: 'sixdof-session-v1', future_seconds: manifest.future_seconds,
    future_render_frames: manifest.future_render_frames,
    complete_future_byte_identical_after_default_input_field: true,
    runtime: { node: process.version, architecture: process.arch, platform: process.platform },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) writeFileSync(output, serialized);
  console.log(serialized);
} finally {
  simulation.free();
}

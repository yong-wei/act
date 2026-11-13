import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argumentsList = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? fallback : argumentsList[index + 1];
};
const wasmDirectory = option('--wasm-directory', path.join(repository, 'src/resources/control-system/wasm/control_engine'));
const output = option('--output', path.join(repository, 'rust/control-engine/tests/fixtures/native-session-legacy-v1'));
const revision = option('--source-revision', null);
if (!revision) throw new Error('必须记录生成旧恢复点的源码修订');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const bytes = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: bytes });
const configuration = { vessel: 'destroyer-055', parameterVersion: 'research-nominal-v4',
  environment: 'W1', noiseLevel: 'N1', seed: 20261106 };
const simulation = new binding.VesselSimulationSession(JSON.stringify(configuration));
try {
  const initial = JSON.parse(simulation.read());
  if (initial.modelVersion !== 'sixdof-session-v1' || initial.headingController) {
    throw new Error('该工具仅用于采集改动前的原生v1控制器');
  }
  const input = JSON.stringify({ controlMode: 'pid', pid: { kp: 1, ki: .01, kd: 2 },
    targetHeadingDeg: 10, feedback: 'estimate', actuators: initial.heldCommands });
  for (let frame = 0; frame < 255; frame += 1) simulation.advance(1 / 60, input);
  const snapshot = simulation.snapshot();
  for (let frame = 0; frame < 60; frame += 1) simulation.advance(1 / 60, input);
  const future = simulation.snapshot();
  mkdirSync(output, { recursive: true });
  // 原始字符串保留u64随机状态，避免JS JSON数值往返截断。
  writeFileSync(path.join(output, 'snapshot.json'), `${snapshot}\n`);
  writeFileSync(path.join(output, 'future.json'), `${future}\n`);
  const manifest = {
    schema: 'act.native-session.legacy-fixture.v1', source_revision: revision,
    generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    wasm_sha256: sha256(bytes), configuration, input: JSON.parse(input),
    snapshot_sha256: sha256(`${snapshot}\n`), future_sha256: sha256(`${future}\n`),
    captured_seconds: 4.25, future_seconds: 1, future_render_frames: 60,
    runtime: { node: process.version, architecture: process.arch, platform: process.platform },
  };
  writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, snapshot_bytes: Buffer.byteLength(snapshot), future_bytes: Buffer.byteLength(future),
    source_revision: revision, wasm_sha256: manifest.wasm_sha256 }));
} finally {
  simulation.free();
}

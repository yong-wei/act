import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argumentsList = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? fallback : argumentsList[index + 1];
};
const version = option('--version', 'research-nominal-v4');
const vessel = option('--vessel', 'destroyer-055');
const outputPath = option('--output', null);
const wasmDirectory = path.join(repository, 'src/resources/control-system/wasm/control_engine');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wasmBytes = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasmBytes });

const configuration = JSON.stringify({ vessel, parameterVersion: version, noiseLevel: 'N0' });
const original = new binding.VesselSimulationSession(configuration);
const restored = new binding.VesselSimulationSession(configuration);
try {
  const initial = JSON.parse(original.read());
  const command = JSON.stringify({
    controlMode: 'manual',
    pid: { kp: 0, ki: 0, kd: 0 },
    targetHeadingDeg: 0,
    feedback: 'estimate',
    actuators: initial.heldCommands,
  });
  const started = performance.now();
  for (let frame = 0; frame < 300; frame += 1) original.advance(1 / 60, command);
  const elapsed = performance.now() - started;
  const snapshot = original.snapshot();
  restored.restore(snapshot);
  for (let frame = 0; frame < 60; frame += 1) {
    original.advance(1 / 60, command);
    restored.advance(1 / 60, command);
  }
  if (original.snapshot() !== restored.snapshot()) throw new Error('WASM恢复后的完整未来状态不同');
  original.setPaused(true);
  const paused = original.snapshot();
  original.advance(1, command);
  if (paused !== original.snapshot()) throw new Error('暂停期间状态发生变化');
  const final = JSON.parse(original.read());
  if (final.physicsTicks !== 720 || final.controllerTicks !== 120) {
    throw new Error('物理或控制时钟未按120Hz/20Hz推进');
  }
  original.setPaused(false);
  const feedbackCommand = JSON.stringify({ controlMode: 'pid', pid: { kp: .7, ki: .01, kd: .2 },
    targetHeadingDeg: 10, feedback: 'measurement', actuators: initial.heldCommands });
  for (let frame = 0; frame < 300; frame += 1) original.advance(1 / 60, feedbackCommand);
  restored.restore(original.snapshot());
  for (let frame = 0; frame < 60; frame += 1) {
    original.advance(1 / 60, feedbackCommand);
    restored.advance(1 / 60, feedbackCommand);
  }
  if (original.snapshot() !== restored.snapshot()) throw new Error('测量反馈控制恢复后的完整未来状态不同');
  const feedback = JSON.parse(original.read());
  if (feedback.modelVersion !== 'sixdof-session-v2' || !feedback.headingController.feedbackAvailable
      || feedback.headingController.integralFrozen || feedback.headingController.integralOutputDeg === 0) {
    throw new Error('新测量微分控制器未实际接入');
  }
  const report = {
    schema: 'act.native-session-validation.v1',
    status: 'passed',
    vessel,
    parameter_version: version,
    generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    wasm_sha256: sha256(wasmBytes),
    build_identity: JSON.parse(readFileSync(path.join(wasmDirectory, 'identity.json'), 'utf8')),
    runtime: { node: process.version, architecture: process.arch, platform: process.platform },
    verification: {
      restored_future_bitwise_identical: true,
      pause_state_identical: true,
      physics_ticks: final.physicsTicks,
      controller_ticks: final.controllerTicks,
      snapshot_bytes: Buffer.byteLength(snapshot),
      feedback_future_bitwise_identical: true,
      heading_controller_model_version: feedback.modelVersion,
      derivative_filter_tau_s: feedback.input.derivativeFilterTauS,
      heading_controller: feedback.headingController,
    },
    timing: {
      virtual_seconds: 5,
      render_frames: 300,
      elapsed_ms: elapsed,
      mean_frame_ms: elapsed / 300,
      scope: 'single Node WASM session, excludes browser rendering and network capacity',
    },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) writeFileSync(outputPath, serialized);
  console.log(serialized);
} finally {
  original.free();
  restored.free();
}

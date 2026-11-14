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
const loadingOption = option('--loading-ratio', null);
const loadingRatio = loadingOption === null ? null : Number(loadingOption);
if (loadingRatio !== null && !Number.isFinite(loadingRatio)) throw new Error('加载比例无效');
const outputPath = option('--output', null);
const wasmDirectory = path.join(repository, 'src/resources/control-system/wasm/control_engine');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wasmBytes = readFileSync(path.join(wasmDirectory, 'index_bg.wasm'));
const binding = await import(pathToFileURL(path.join(wasmDirectory, 'index.js')).href);
await binding.default({ module_or_path: wasmBytes });

const configuration = JSON.stringify({ vessel, parameterVersion: version, noiseLevel: 'N0',
  ...(loadingRatio === null ? {} : { loadingRatio }) });
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
  if (final.dynamics?.nu_dot?.length !== 6 || final.dynamics?.position_dot_ned?.length !== 3) {
    throw new Error('当前原生帧缺少实际加速度或位置变化率');
  }
  if (final.physicsTicks !== 720 || final.controllerTicks !== 120) {
    throw new Error('物理或控制时钟未按120Hz/20Hz推进');
  }
  original.setPaused(false);
  let controlVerification;
  if (vessel === 'semisub-981') {
    const saved = original.snapshot();
    let rejected = false;
    try {
      original.advance(.1, JSON.stringify({ ...JSON.parse(command), controlMode: 'pid' }));
    } catch (error) {
      rejected = String(error).includes('定位控制模板');
    }
    if (!rejected || original.snapshot() !== saved) throw new Error('待接线的平台控制器状态没有正确报告');
    const pulse = JSON.parse(command);
    pulse.actuators.shafts[0].speed_reference_rad_s = 3;
    const pulseCommand = JSON.stringify(pulse);
    for (let frame = 0; frame < 300; frame += 1) original.advance(1 / 60, pulseCommand);
    restored.restore(original.snapshot());
    for (let frame = 0; frame < 60; frame += 1) {
      original.advance(1 / 60, pulseCommand);
      restored.advance(1 / 60, pulseCommand);
    }
    const response = JSON.parse(original.read());
    if (original.snapshot() !== restored.snapshot() || response.truth.body_velocity[5] <= 1e-7) {
      throw new Error('八推进器单台实际艏摇或恢复失败');
    }
    controlVerification = { manual_future_bitwise_identical: true,
      unready_dp_controller_explicit: true, single_pod_positive_yaw_rate_rad_s: response.truth.body_velocity[5],
      physical_propulsor_count: response.truth.actuator_states.propeller_shaft_speed_rad_s.length };
  } else {
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
    controlVerification = { feedback_future_bitwise_identical: true,
      heading_controller_model_version: feedback.modelVersion,
      derivative_filter_tau_s: feedback.input.derivativeFilterTauS,
      heading_controller: feedback.headingController };
    if (vessel === 'lng-changheng') {
      const liquid = feedback.liquidCargo;
      const fill = loadingRatio ?? .85;
      if (!liquid || liquid.wall_heights_m.length !== 8 || !liquid.within_small_amplitude
          || Math.abs(liquid.mass_partition.liquid_mass_kg/(4*44*38*26*450*fill)-1) > 1e-12
          || !liquid.wall_heights_m.some((value) => Math.abs(value) > 1e-6)) {
        throw new Error('液货质量、实际模态响应或适用域失败');
      }
      controlVerification.liquid_cargo = liquid;
    }
  }
  const report = {
    schema: 'act.native-session-validation.v1',
    status: 'passed',
    vessel,
    parameter_version: version,
    loading_ratio: loadingRatio,
    generator_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    wasm_sha256: sha256(wasmBytes),
    build_identity: JSON.parse(readFileSync(path.join(wasmDirectory, 'identity.json'), 'utf8')),
    runtime: { node: process.version, architecture: process.arch, platform: process.platform },
    verification: {
      dynamics_exposed: true,
      restored_future_bitwise_identical: true,
      pause_state_identical: true,
      physics_ticks: final.physicsTicks,
      controller_ticks: final.controllerTicks,
      snapshot_bytes: Buffer.byteLength(snapshot),
      ...controlVerification,
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

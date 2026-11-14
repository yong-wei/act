import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DESTROYER_COURSE_STEPS, destroyerCourseCommands, destroyerCourseVariants } from '@/resources/simulations/experiments/destroyer-course';
import { collectVesselTracePoint, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import { measuredWindow } from '@/resources/simulations/experiments/student-analysis';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const argumentsList = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? fallback : argumentsList[index+1];
};
const output = option('--output','docs/research/fleet-hydrodynamics/destroyer-course-session-validation.json');
const selectedSteps = option('--steps','1,2,3,5,6,7,9,10,11,12,13,14,15,16,17,18,19').split(',').map(Number);
const bindingDirectory = path.join(root,'src/resources/control-system/wasm/control_engine');
const binding = await import(pathToFileURL(path.join(bindingDirectory,'index.js')).href);
const wasm = readFileSync(path.join(bindingDirectory,'index_bg.wasm'));
await binding.default({ module_or_path: wasm });
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const pack = JSON.parse(readFileSync(path.join(root,'rust/control-engine/model-data/destroyer-055/v6/actuators.json'),'utf8'));
const results: Record<string, unknown>[] = [];
const numericalRuns = new Map<number,VesselRunEvidence>();
const started = performance.now();

for (const step of DESTROYER_COURSE_STEPS.filter((item) => selectedSteps.includes(item.sequence) && item.stepKind === 'run')) {
  const variants = destroyerCourseVariants(step.sequence);
  const conditions = variants.length ? variants : [{ value: 'base', label: '基准', configuration: {} }];
  const alternatives = step.sequence === 12 ? [false,true] : step.sequence === 15 ? [0,.2,1,3] : [true];
  for (const condition of conditions) for (const alternative of alternatives) {
    const configuration = { ...step.configuration, ...condition.configuration };
    const native = new binding.VesselSimulationSession(JSON.stringify(configuration));
    let restored: InstanceType<typeof binding.VesselSimulationSession> | null = null;
    const label = `${step.sequence}/${condition.value}/${alternative}`;
    try {
      const initial = JSON.parse(native.read()) as VesselSessionFrame;
      const input: VesselSessionInput = { ...initial.input, controlMode: step.controlMode,
        feedback: 'measurement', pid: { kp: .7, ki: .005, kd: 6 },
        derivativeFilterTauS: step.sequence === 15 ? Number(alternative) : .2,
        headingIntegralTracking: { enabled: step.sequence === 12 ? Boolean(alternative) : true, timeS: 1 } };
      const run: VesselRunEvidence = { id: label, scopeKey: 'validation', courseKey: 'destroyer', courseVersion: step.experimentVersion,
        stepSequence: step.sequence, prediction: '直接验证操纵方向、量测、时钟、约束与能量收支', durationS: step.runDurationS!,
        createdAtMs: 1, lastTimeS: 0, stoppedAtMs: null, configuration, initialInput: input, parameterHash: initial.parameterHash,
        initialCheckpoint: native.snapshot(), checkpoint: '', trace: [], nativeSensorSamples: [], changes: [], stopReason: null, failure: null };
      let peakRollDeg = 0, peakRudderDeg = 0, peakPowerW = 0;
      let restoredFuture = false;
      let final = initial;
      const limit = step.runDurationS!;
      const caseStarted = performance.now();
      for (let time = 0; time < limit; time++) {
        const command = destroyerCourseCommands(step,time);
        input.targetHeadingDeg = command.headingDeg;
        input.actuators = { ...input.actuators, surfaces: input.actuators.surfaces.map((surface) => ({ ...surface,angle_rad:command.rudderDeg*Math.PI/180 })) };
        const encodedInput = JSON.stringify(input);
        final = JSON.parse(native.advance(1,encodedInput)) as VesselSessionFrame;
        if (restored) {
          restored.advance(1,encodedInput);
          if (restored.snapshot() !== native.snapshot()) throw new Error('恢复后的物理、传感器和控制器未来不同');
          restored.free(); restored = null; restoredFuture = true;
        }
        if (time === Math.floor(limit/2)) {
          const saved = native.snapshot();
          restored = new binding.VesselSimulationSession(JSON.stringify(configuration));
          restored.restore(saved);
        }
        for (const packet of final.controlSamples) {
          const point = collectVesselTracePoint(packet,run.trace.at(-1)?.measurements ?? {});
          run.trace.push(point);
          peakRollDeg = Math.max(peakRollDeg,Math.abs(point.truth.rollDeg));
          peakRudderDeg = Math.max(peakRudderDeg,...point.truth.surfaceDeg.map(Math.abs));
          peakPowerW = Math.max(peakPowerW,...point.truth.motorPowerW);
        }
        run.nativeSensorSamples.push(...final.samples.filter((sample) => typeof sample.signal !== 'string' || !sample.signal.startsWith('SpecificForce')));
        run.lastTimeS = final.timeS;
      }
      run.checkpoint = native.snapshot(); run.stopReason = 'duration'; run.stoppedAtMs = 2;
      if (final.physicsTicks !== limit*120 || final.controllerTicks !== limit*20 || run.trace.length !== limit*20) throw new Error('120Hz物理或20Hz采样时钟错误');
      if (peakRudderDeg > 35+1e-6 || peakPowerW > 15e6*(1+1e-8)) throw new Error('真实舵角或单轴功率超出硬约束');
      const sum = (values: number[]) => values.reduce((total,value) => total+value,0);
      const finalActuators = final.truth.actuator_states;
      const motorWorkJ = sum(finalActuators.motor_work_j);
      const propellerWorkJ = sum(finalActuators.propeller_work_j);
      const frictionWorkJ = sum(finalActuators.shaft_friction_work_j);
      const shaftEnergyChangeJ = pack.system.propulsors.reduce((total: number,propeller: { shaft_inertia_kg_m2: number },index: number) =>
        total+.5*propeller.shaft_inertia_kg_m2*(finalActuators.propeller_shaft_speed_rad_s[index]**2-initial.truth.actuator_states.propeller_shaft_speed_rad_s[index]**2),0);
      const residual = Math.abs(motorWorkJ-propellerWorkJ-frictionWorkJ-shaftEnergyChangeJ)/Math.max(1,Math.abs(motorWorkJ),Math.abs(propellerWorkJ));
      if (residual > .01) throw new Error('轴系功与储能收支超过1%教学上限');
      results.push({ case: label, status: 'passed', configuration, controller: { mode: input.controlMode,pid:input.pid,
        derivative_filter_tau_s:input.derivativeFilterTauS,integral_tracking:input.headingIntegralTracking },
        parameter_hash: initial.parameterHash, virtual_seconds: final.timeS, control_samples: run.trace.length,
        native_sensor_samples: run.nativeSensorSamples.length, restored_future_bitwise_identical: restoredFuture,
        final_heading_deg: final.attitudeDeg.heading, final_yaw_rate_deg_s: final.truth.body_velocity[5]*180/Math.PI,
        final_north_m: final.truth.position_ned[0], final_east_m: final.truth.position_ned[1],
        peak_roll_deg: peakRollDeg, peak_rudder_deg:peakRudderDeg, peak_single_shaft_power_w:peakPowerW,
        shaft_energy_relative_residual:residual, elapsed_ms:performance.now()-caseStarted });
      if ([2,3,5].includes(step.sequence)) numericalRuns.set(step.sequence,run);
      process.stdout.write(`${label} passed ${final.timeS}s\n`);
    } catch (error) {
      results.push({ case:label,status:'failed',message:error instanceof Error ? error.message : String(error) });
      process.stdout.write(`${label} failed\n`);
    } finally { restored?.free(); native.free(); }
  }
}

const identification: Record<string,unknown>[] = [];
for (const [sequence,channel,kind] of [[2,'rudder-servo','fopdt'],[3,'rudder-to-yaw','nomoto1']] as const) {
  const run = numericalRuns.get(sequence);
  if (!run) continue;
  const window = measuredWindow(run,channel,10,run.lastTimeS);
  const result = JSON.parse(binding.compute_virtual_simulation_step(JSON.stringify({ modelId:'student_model_analysis',operation:'identify',structureKind:kind,
    input:window.input,output:window.output,dtS:window.dtS,inputOrigin:window.input[0],outputOrigin:window.output[0] })));
  identification.push({ step:sequence,channel,sample_dt_s:window.dtS,source:'native_sensor_measurements',result:{ ...result,predicted:undefined } });
  if (!result.identifiedOk) results.push({ case:`identification-${sequence}`,status:'failed',message:result.failureReason });
}
const report = { schema:'act.destroyer-course-session-validation.v1',status:results.every((item) => item.status === 'passed') ? 'passed' : 'failed',
  generator_sha256:sha256(readFileSync(fileURLToPath(import.meta.url))), wasm_sha256:sha256(wasm),
  course_sha256:sha256(readFileSync(path.join(root,'src/resources/simulations/experiments/destroyer-course.ts'))),
  scope:'本机实际WASM教学工况、原生量测、时钟、恢复和轴系能量验收，网络容量另测',
  first_order_applicability:'冻结零平均航速的一阶系数用于4至12m/s教学工况，实际位置相位进入相遇波。源矩阵与拟合残差随参数包保留。',
  elapsed_ms:performance.now()-started,cases:results,identification };
const reportPath = path.resolve(root,output);
const lines = `${JSON.stringify(report,null,2)}\n`.split('\n');
writeFileSync(reportPath,'');
for (let start = 0; start < lines.length; start += 400) appendFileSync(reportPath,lines.slice(start,start+400).join('\n')+(start+400 < lines.length ? '\n' : ''));
if (report.status !== 'passed') process.exitCode = 1;

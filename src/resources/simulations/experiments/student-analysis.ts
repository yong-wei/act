import type { ModelStructureValue, StudentModelSaveInput, ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import { sensorKey, vesselRunMetricsRequest, vesselDpMetricsRequest, type VesselRunEvidence, type VesselRunMetrics } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { destroyerCourseCommands, type DestroyerCourseStep } from './destroyer-course';
import { vesselComparisonFactors,type VesselComparisonFactors } from './comparison-factors';

export type IdentificationChannel = 'rudder-to-yaw' | 'rudder-servo' | 'shaft-to-speed' | 'shaft-reference-to-speed' | 'fin-to-roll';
export interface StudentHeadingDesign {
  kp: number; ki: number; kd: number;
  dampingRatio: number; naturalFrequencyRadS: number;
  kpMinimum: number; kpMaximum: number; kdMaximum: number;
}

export function evaluateVesselHeadingRun(run:VesselRunEvidence) {
  if (run.stoppedAtMs === null) throw new Error('请在运行结束后查看完整评价。');
  const metrics = computeVirtualSimulationStep<VesselRunMetrics>(vesselRunMetricsRequest(run.trace,run.lastTimeS,
    run.configuration.initialHeadingDeg ?? 0));
  if (run.courseKey === 'drilling' && run.trace.some((point) => point.dp)) {
    Object.assign(metrics,computeVirtualSimulationStep<Record<string,number>>(vesselDpMetricsRequest(run.trace,run.lastTimeS)));
  }
  const checkpoint = JSON.parse(run.checkpoint) as {
    course_evidence?:{metrics:NonNullable<VesselSessionFrame['fineStepMetrics']>['values']};
    plant?:{state?:{actuator_states?:{positive_motor_work_j?:number[];fuel?:{fuel_kg:number}}}};
    voyage_progress?: NonNullable<VesselSessionFrame['containerVoyage']>['progress'];
  };
  const values = checkpoint.course_evidence?.metrics;
  const fineStepMetrics:VesselSessionFrame['fineStepMetrics'] = values ? {sampleCadenceS:1/120,
    algorithm:'post_physics_step_v1',rollWarningDeg:run.configuration.courseEvidence?.rollWarningDeg ?? 8,
    eventWindowBeforeS:1,eventWindowAfterS:1,values} : undefined;
  const storedWork = checkpoint.plant?.state?.actuator_states?.positive_motor_work_j;
  if (storedWork) metrics.positiveMotorWorkJ = storedWork.reduce((total,work)=>total+work,0);
  if (values) metrics.positiveMotorWorkJ = values.positiveMotorWorkJ;
  return {metrics,fineStepMetrics,parameters:run.parameters,cruiseComfort:run.cruiseComfort,
    voyage:checkpoint.voyage_progress, fuelKg:checkpoint.plant?.state?.actuator_states?.fuel?.fuel_kg};
}

export function designStudentHeadingController(model: Pick<FrozenVesselStudentModel, 'payload'>): StudentHeadingDesign {
  return computeVirtualSimulationStep<StudentHeadingDesign>({ modelId:'student_model_analysis',operation:'heading_design',structure:model.payload.structure });
}
export interface FrozenVesselStudentModel {
  id: string;
  scopeKey: string;
  label: string;
  channel: IdentificationChannel | 'dp-low-frequency';
  createdAtMs: number;
  payload: StudentModelSaveInput;
  serverId: string | null;
  contentHash: string | null;
}

export interface VesselModelComparison {
  id: string;
  scopeKey: string;
  modelId: string;
  actuatorModelId: string | null;
  runId: string;
  mode: ComparisonModeValue;
  startS: number;
  endS: number;
  timeS: number[];
  actual: number[];
  predicted: number[];
  measuredInput: number[];
  predictedInput: number[] | null;
  metrics: Record<string, number | null>;
  createdAtMs: number;
  serverId: string | null;
  purpose?: 'forecast' | 'validation';
  controllerInput?: VesselSessionInput;
  outputUnit?:string;
  outputChannel?:string;
  actualHeadingDeg?:Array<number|null>;
  predictedHeadingDeg?:number[];
  actualEastM?:number[];
  predictedEastM?:number[];
  actualBowClearanceM?:number[];
  predictedBowClearanceM?:number[];
  factorFlags?:VesselComparisonFactors;
}

interface AnalysisResult {
  idealArrivalS?: number | null;
  idealFuelKg?: number | null;
  identifiedOk?: boolean;
  structure?: ModelStructureValue | null;
  failureReason?: string | null;
  predicted: number[];
  headingDeg?: number[];
  commandsDeg?: number[];
  commandsRpm?: number[];
  bowClearanceM?: number[];
  outsideLocalSpeedDomain?: boolean;
  actualSurfaceDeg?: number[];
  metrics: Record<string, number | null> | null;
}

function channelSignals(channel: IdentificationChannel) {
  if (channel === 'fin-to-roll') return {input:'FinDifferential',output:'EstimatedRoll',inputUnit:'°',outputUnit:'°'};
  if (channel === 'rudder-servo') return { input: 'command', output: 'SurfaceEncoder0', inputUnit: '°', outputUnit: '°' };
  if (channel === 'shaft-to-speed') return { input: 'ShaftSpeed0', output: 'SpeedLog', inputUnit: 'r/min', outputUnit: 'm/s' };
  if (channel === 'shaft-reference-to-speed') return { input: 'ShaftReference0', output: 'SpeedLog', inputUnit: 'r/min', outputUnit: 'm/s' };
  return { input: 'SurfaceEncoder0', output: 'YawRate', inputUnit: '°', outputUnit: '°/s' };
}

/** 离线窗口按仪器采样时间对齐，辨识输入仅取仪器或已记录指令。 */
export function measuredWindow(run: VesselRunEvidence, channel: IdentificationChannel, startS: number, endS: number,
  commandInput = false) {
  if (!Number.isFinite(startS) || !Number.isFinite(endS) || startS < 0 || endS <= startS || endS > run.lastTimeS+1e-8) {
    throw new Error('请选择这次运行范围内的分析窗口。');
  }
  const signals = channelSignals(channel);
  const inputs = new Map<number, number | null>();
  const outputs = new Map<number, number | null>();
  const headings = new Map<number, number | null>();
  const finEncoders = [new Map<number,number|null>(),new Map<number,number|null>()];
  if (run.nativeSensorSamples.length) {
    for (const sample of run.nativeSensorSamples) {
      const name = sensorKey(sample.signal);
      if (channel === 'fin-to-roll' && ['SurfaceEncoder0','SurfaceEncoder1'].includes(name)) {
        finEncoders[name === 'SurfaceEncoder0' ? 0 : 1].set(Math.round(sample.measurement.t_sample_s*1e6),
          sample.measurement.quality === 'Good' ? sample.measurement.value : null);
      }
      const target = name === signals.input ? inputs : name === signals.output ? outputs : name === 'Heading' ? headings : null;
      if (target) target.set(Math.round(sample.measurement.t_sample_s*1e6), sample.measurement.quality === 'Good' ? sample.measurement.value : null);
    }
  } else {
    for (const point of run.trace) {
      for (const [name, target] of [[signals.input, inputs], [signals.output, outputs], ['Heading', headings]] as const) {
        const reading = point.measurements[name];
        if (reading) target.set(Math.round(reading.sampledAtS*1e6), reading.quality === 'Good' ? reading.value : null);
      }
    }
  }
  if (channel === 'fin-to-roll') {
    for (const [time,port] of finEncoders[0]) {
      const starboard = finEncoders[1].get(time);
      inputs.set(time,port == null || starboard == null ? null : (port-starboard)/2);
    }
    for (const point of run.trace) {
      outputs.set(Math.round(point.timeS*1e6),point.cruise?.measurementGood ? point.cruise.estimatedRollRad*180/Math.PI : null);
      if (!run.nativeSensorSamples.length) {
        const port = point.measurements.SurfaceEncoder0, starboard = point.measurements.SurfaceEncoder1;
        inputs.set(Math.round(point.timeS*1e6),port?.quality === 'Good' && starboard?.quality === 'Good'
          && port.value != null && starboard.value != null ? (port.value-starboard.value)/2 : null);
      }
    }
  }
  const times = [...outputs.keys()].filter((time) => time/1e6 >= startS && time/1e6 <= endS).sort((a,b) => a-b);
  const timeS: number[] = [], input: number[] = [], output: number[] = [], reference: number[] = [];
  const inputSamples = [...inputs.entries()].sort((a,b) => a[0]-b[0]);
  const headingSamples = [...headings.entries()].sort((a,b)=>a[0]-b[0]);
  const headingDeg:Array<number|null> = [];
  let pointIndex = 0;
  let inputIndex = 0;
  let headingIndex = 0;
  let firstMeasuredInput: number | undefined;
  for (const time of times) {
    while (pointIndex+1 < run.trace.length && run.trace[pointIndex+1].timeS <= time/1e6+1e-8) pointIndex++;
    const point = run.trace[pointIndex];
    if (!point || point.timeS > time/1e6+1e-8) continue;
    while (inputIndex+1 < inputSamples.length && inputSamples[inputIndex+1][0] <= time) inputIndex++;
    const measuredInput = inputSamples[inputIndex];
    const heldInput = measuredInput && measuredInput[0] <= time && time-measuredInput[0] <= 100001 ? measuredInput[1] : null;
    const value = signals.input === 'ShaftReference0' || (commandInput && channel === 'shaft-to-speed')
      ? point.command.shaftRpm[0]
      : channel === 'fin-to-roll' ? heldInput : commandInput || signals.input === 'command' ? point.command.surfaceDeg[0] : heldInput;
    const measuredOutput = outputs.get(time);
    if (value == null || measuredOutput == null || !Number.isFinite(value)) continue;
    if (!timeS.length && heldInput !== null) firstMeasuredInput = heldInput;
    while (headingIndex+1 < headingSamples.length && headingSamples[headingIndex+1][0] <= time) headingIndex++;
    const heading = headingSamples[headingIndex];
    headingDeg.push(heading && heading[0] <= time && time-heading[0] <= 200001 ? heading[1] : null);
    timeS.push(time/1e6); input.push(value); output.push(measuredOutput); reference.push(point.command.headingDeg);
  }
  if (timeS.length < 20) throw new Error('所选窗口有效量测不足，请延长运行或调整窗口。');
  const dtS = (timeS.at(-1)!-timeS[0])/(timeS.length-1);
  if (timeS.some((time,index) => index > 0 && Math.abs(time-timeS[index-1]-dtS) > 1e-5)) {
    throw new Error('所选窗口存在缺测或不连续采样，请选择连续的有效量测。');
  }
  const heading = [...headings.entries()].filter(([time]) => time/1e6 <= timeS[0]+1e-8).sort((a,b) => b[0]-a[0])[0]?.[1];
  return { timeS, input, output, reference, headingDeg, initialHeadingDeg: heading ?? undefined, dtS, signals, initialMeasuredInput: firstMeasuredInput };
}

export function identifyVesselStudentModel(run: VesselRunEvidence, channel: IdentificationChannel,
  kind: 'nomoto1' | 'nomoto2' | 'fopdt' | 'roll_oscillator', startS: number, endS: number,
  freeDecay?:{run:VesselRunEvidence;startS:number;endS:number}): FrozenVesselStudentModel {
  const window = measuredWindow(run, channel, startS, endS);
  if (channel === 'fin-to-roll' && (!Number.isFinite(run.parameters?.rollInertiaKgM2)
    || Number(run.parameters?.rollInertiaKgM2) <= 0)) throw new Error('本次记录缺少已声明的教学横摇惯量，请使用含完整参数的本人运行。');
  const decay = freeDecay ? measuredWindow(freeDecay.run,'fin-to-roll',freeDecay.startS,freeDecay.endS) : undefined;
  if (freeDecay && (freeDecay.run.scopeKey !== run.scopeKey || freeDecay.run.courseKey !== 'cruise'
    || Math.abs(decay!.dtS-window.dtS) > 1e-8)) throw new Error('请选择同一实验轮次、相同采样时钟的本人自由衰减记录。');
  const inputOrigin = channel === 'fin-to-roll' ? 0 : window.input[0], outputOrigin = channel === 'fin-to-roll' ? 0 : window.output[0];
  const result = computeVirtualSimulationStep<AnalysisResult>({ modelId: 'student_model_analysis', operation: 'identify',
    structureKind: kind, input: window.input, output: window.output, dtS: window.dtS, inputOrigin, outputOrigin,
    ...(decay ? {freeDecayOutput:decay.output} : {}) });
  if (!result.identifiedOk || !result.structure) throw new Error(result.failureReason ?? '这次辨识未成功，请保留记录并调整激励或窗口。');
  const labels = { 'rudder-to-yaw': '舵角—转艏速率', 'rudder-servo': '舵机',
    'shaft-to-speed': '实际轴速—航速', 'shaft-reference-to-speed': '轴速参考—航速', 'fin-to-roll':'差动鳍角—横摇' };
  return { id: crypto.randomUUID(), scopeKey: run.scopeKey, label: `${labels[channel]} · 第${run.stepSequence}步`, channel,
    createdAtMs: Date.now(), serverId: null, contentHash: null,
    payload: { experimentKey: run.courseKey, lineageKey: `${channel}@${run.configuration.initialWaterSpeedMps ?? 0}`,
      structure: result.structure, ioContract: { inputChannel: window.signals.input, outputChannel: window.signals.output,
        inputUnit: window.signals.inputUnit, outputUnit: window.signals.outputUnit },
      operatingPoint: { inputOrigin, outputOrigin, speedMps: run.configuration.initialWaterSpeedMps ?? 0,
        loadingRatio: run.configuration.loadingRatio ?? 0, courseVersion: run.courseVersion,
        ...(channel === 'fin-to-roll' ? {rollInertiaKgM2:Number(run.parameters?.rollInertiaKgM2)} : {}) },
      identification: { algorithm: `student-model-${kind}`, settings: { startS, endS,
        ...(result.metrics?.fit_percent != null ? {trainingFitPercent:result.metrics.fit_percent} : {}) }, identifiedOk: true,
        residualRms: result.metrics?.rmse ?? undefined, failureReason: null },
      trainingRuns: [{ runRef: run.id, startS, endS }, ...(freeDecay ? [{runRef:freeDecay.run.id,startS:freeDecay.startS,endS:freeDecay.endS}] : [])],
      validationRuns: [], sampleDt: window.dtS } };
}

export function compareVesselStudentModel(run: VesselRunEvidence, model: FrozenVesselStudentModel,
  mode: ComparisonModeValue, startS: number, endS: number, actuator?: FrozenVesselStudentModel): VesselModelComparison {
  if (model.channel === 'dp-low-frequency') throw new Error('请在三通道模型工作台保存独立对照。');
  if (model.scopeKey !== run.scopeKey || (actuator && actuator.scopeKey !== run.scopeKey)) throw new Error('请选择本次实验的模型。');
  if (model.channel === 'rudder-servo') throw new Error('请选择船体或航速模型执行对照，舵机模型用于执行器级联。');
  const speedReference = model.channel === 'shaft-reference-to-speed';
  const finModel = model.channel === 'fin-to-roll';
  if (finModel && mode !== 'hull_model') throw new Error('横摇局部模型请选择A模式，以实际差动鳍角独立验证。闭环设计初值在控制页签显示。');
  if (speedReference && mode === 'hull_model') throw new Error('轴速参考模型请选择B指令对照，实际轴速船体对照需要对应量测模型。');
  if (!speedReference && mode !== 'hull_model' && (!actuator || actuator.channel !== 'rudder-servo')) throw new Error('请先选择本人辨识并冻结的舵机模型。');
  if (!speedReference && mode !== 'hull_model' && model.channel !== 'rudder-to-yaw') throw new Error('舵机级联和独立航向闭环需要舵角—转艏速率模型。');
  const window = measuredWindow(run, model.channel, startS, endS, mode !== 'hull_model');
  const trainingOverlap = model.payload.trainingRuns.some((training) => training.runRef === run.id
    && training.startS < endS && startS < training.endS);
  if (trainingOverlap) throw new Error('独立验证窗口需要与该模型的训练窗口分开。');
  if (!speedReference && mode !== 'hull_model' && window.initialMeasuredInput === undefined) throw new Error('比较窗口缺少初始实际舵角量测。');
  const actuatorPrediction = !speedReference && actuator ? { structure: actuator.payload.structure,
    inputOrigin: Number(actuator.payload.operatingPoint.inputOrigin), outputOrigin: Number(actuator.payload.operatingPoint.outputOrigin),
    initialOutput: window.initialMeasuredInput } : undefined;
  const request = { modelId: 'student_model_analysis', structure: model.payload.structure, dtS: window.dtS,
    inputOrigin: Number(model.payload.operatingPoint.inputOrigin), outputOrigin: Number(model.payload.operatingPoint.outputOrigin),
    ...(mode === 'hull_model' || speedReference ? {} : { actuator: actuatorPrediction }) };
  let result: AnalysisResult;
  if (mode === 'independent_closed_loop' && speedReference && run.initialInput.containerSpeed) {
    const controller = run.initialInput.containerSpeed;
    if (startS > 1e-7) throw new Error('集装箱船独立闭环需要从已记录的0s初态开始。');
    if (run.changes.some((change) => JSON.stringify({...change.input.containerSpeed, referenceMps: 0})
      !== JSON.stringify({...controller, referenceMps: 0}))) throw new Error('请选择三点模型及控制参数固定的独立运行。');
    const maximumRpm = run.parameters?.shaftConfigurations[0]?.ratedRpm;
    if (!maximumRpm) throw new Error('本次记录缺少主轴额定转速。');
    const offset = Math.round(window.timeS[0] / window.dtS);
    if (Math.abs(offset * window.dtS - window.timeS[0]) > 1e-7) throw new Error('首个计程仪量测与采样时钟不一致。');
    let changeIndex = 0;
    let active = run.initialInput;
    const times = Array.from({length: window.timeS.length + offset}, (_, index) => index * window.dtS);
    const referenceMps = times.map((time) => {
      while (changeIndex < run.changes.length && run.changes[changeIndex].timeS <= time) active = run.changes[changeIndex++].input;
      return active.containerSpeed?.referenceMps ?? controller.referenceMps;
    });
    result = run.configuration.containerVoyage
      ? containerClosedLoopComparison(run, model, controller, times, window.output, offset, maximumRpm, window.dtS)
      : computeVirtualSimulationStep<AnalysisResult>({...request, operation: 'container_closed_loop', controller,
        initialSpeedMps: run.configuration.initialWaterSpeedMps, initialBowDistanceM: 0, currentForwardMps: 0,
        loadingRatio: run.configuration.loadingRatio, maximumRpm, referenceMps,
        output: window.output, outputOffsetSamples: offset});
    result.predicted = result.predicted.slice(offset);
    result.commandsRpm = result.commandsRpm?.slice(offset);
  } else if (mode === 'independent_closed_loop' && speedReference) {
    const controller = run.initialInput.longitudinal;
    const maximumRpm = run.parameters?.shaftConfigurations.reduce((minimum,shaft)=>Math.min(minimum,shaft.ratedRpm),Infinity);
    if (!controller || !maximumRpm || !Number.isFinite(maximumRpm)) throw new Error('这次运行缺少冻结航速控制器或主轴参数。');
    if (run.changes.some((change)=>JSON.stringify({...change.input.longitudinal,referenceMps:0})
      !== JSON.stringify({...controller,referenceMps:0}))) {
      throw new Error('这次运行包含航速控制参数修改，请为独立闭环选择参数固定的运行。');
    }
    if (run.initialInput.berthPlan && startS > 1e-7) throw new Error('靠泊计划的独立闭环请从0s完整初态开始。');
    const outputOffsetSamples = run.initialInput.berthPlan ? Math.round(window.timeS[0] / window.dtS) : 0;
    if (run.initialInput.berthPlan && Math.abs(window.timeS[0] - outputOffsetSamples * window.dtS) > 1e-7) {
      throw new Error('计程仪首个有效量测与采样时钟不一致。');
    }
    const predictionTimes = run.initialInput.berthPlan
      ? Array.from({length:window.timeS.length + outputOffsetSamples},(_,index) => index * window.dtS) : window.timeS;
    const initialSpeedMps = run.initialInput.berthPlan ? run.configuration.initialWaterSpeedMps : window.output[0];
    if (initialSpeedMps === undefined || !Number.isFinite(initialSpeedMps)) throw new Error('这次运行缺少已记录的初始航速条件。');
    let changeIndex = 0;
    let active = run.initialInput;
    const referenceMps = predictionTimes.map((time)=>{
      while (changeIndex < run.changes.length && run.changes[changeIndex].timeS <= time) active=run.changes[changeIndex++].input;
      return active.longitudinal?.referenceMps ?? controller.referenceMps;
    });
    result = computeVirtualSimulationStep<AnalysisResult>({...request,operation:'speed_closed_loop',
      initialSpeedMps,initialBowDistanceM:run.configuration.berth?.initialBowDistanceM ?? 0,
      currentForwardMps:0,referenceMps,controller,maximumRpm,brakingPlan:run.initialInput.berthPlan,
      output:window.output,outputOffsetSamples});
    result.predicted = result.predicted.slice(outputOffsetSamples);
    result.commandsRpm = result.commandsRpm?.slice(outputOffsetSamples);
    result.bowClearanceM = result.bowClearanceM?.slice(outputOffsetSamples);
  } else if (mode === 'independent_closed_loop') {
    if (window.initialHeadingDeg === undefined) throw new Error('独立闭环的初始航向量测缺失。');
    let changeIndex = 0;
    let activeController = run.initialInput;
    const controllers = window.timeS.map((time) => {
      while (changeIndex < run.changes.length && run.changes[changeIndex].timeS <= time) {
        activeController = run.changes[changeIndex++].input;
      }
      return activeController;
    });
    result = computeVirtualSimulationStep<AnalysisResult>({ ...request, operation: 'heading_closed_loop',
      reference: window.reference, initialHeadingDeg: window.initialHeadingDeg, initialYawRateDegS: window.output[0],
      controller: run.initialInput, output: window.output,
      controllers });
  } else {
    result = computeVirtualSimulationStep<AnalysisResult>({ ...request, operation: 'predict', input: window.input, output: window.output });
  }
  let actualBowClearanceM: number[] | undefined;
  if (result.bowClearanceM && run.trace.length && run.trace.every((point) => Number.isFinite(point.truth.bowClearanceM))) {
    let traceIndex = 0;
    actualBowClearanceM = window.timeS.map((time) => {
      while (traceIndex + 1 < run.trace.length && run.trace[traceIndex + 1].timeS <= time + 1e-8) traceIndex++;
      return run.trace[traceIndex].truth.bowClearanceM!;
    });
  }
  return { id: crypto.randomUUID(), scopeKey: run.scopeKey, modelId: model.id, actuatorModelId: speedReference ? null : actuator?.id ?? null,
    runId: run.id, mode, startS, endS, timeS: window.timeS, actual: window.output, predicted: result.predicted,
    measuredInput: window.input, predictedInput: result.commandsRpm ?? result.commandsDeg ?? null,
    metrics: { ...result.metrics, ...(result.outsideLocalSpeedDomain === undefined ? {}
      : { outside_local_speed_domain:result.outsideLocalSpeedDomain ? 1 : 0 }) }, createdAtMs: Date.now(), serverId: null,
    outputUnit:window.signals.outputUnit,outputChannel:window.signals.output,
    actualHeadingDeg:window.headingDeg,predictedHeadingDeg:result.headingDeg,
    actualBowClearanceM,
    predictedBowClearanceM:result.bowClearanceM,
    factorFlags:vesselComparisonFactors(run.configuration,mode),
    purpose: 'validation', controllerInput: run.initialInput };
}

function containerClosedLoopComparison(run: VesselRunEvidence, model: FrozenVesselStudentModel,
  controller: NonNullable<VesselSessionInput['containerSpeed']>, times: number[], output: number[], offset: number,
  maximumRpm: number, dtS: number): AnalysisResult {
  const initial = JSON.parse(run.initialCheckpoint).plant?.state?.actuator_states as {
    motor_torques_nm?: number[]; propeller_shaft_speed_rad_s?: number[];
  } | undefined;
  const initialPower = initial?.motor_torques_nm?.reduce((sum, torque, index) =>
    sum + Math.max(0, torque * (initial.propeller_shaft_speed_rad_s?.[index] ?? 0)), 0);
  if (initialPower === undefined) throw new Error('航次预测需要已记录的初始轴功率。');
  return computeVirtualSimulationStep<AnalysisResult>({modelId: 'student_model_analysis', operation: 'container_closed_loop',
    structure: model.payload.structure, dtS, inputOrigin: Number(model.payload.operatingPoint.inputOrigin),
    outputOrigin: Number(model.payload.operatingPoint.outputOrigin), initialSpeedMps: run.configuration.initialWaterSpeedMps,
    initialBowDistanceM: 0, currentForwardMps: 0, loadingRatio: run.configuration.loadingRatio, maximumRpm, controller,
    referenceMps: times.map(() => controller.referenceMps), voyage: run.configuration.containerVoyage,
    fuelModel: CONTAINER_TEACHING_FUEL, initialShaftPowerW: initialPower, output, outputOffsetSamples: offset});
}

const CONTAINER_TEACHING_FUEL = {rated_shaft_power_w: 65e6, auxiliary_power_w: 2e6, efficiency: .95,
  load_fractions: [.1, .25, .5, .75, 1], sfoc_g_per_kwh: [230, 195, 180, 175, 185]};

export function forecastContainerSpeed(scopeKey: string, runId: string, sequence: number,
  configuration: VesselSessionConfiguration, durationS: number, controllerInput: VesselSessionInput,
  frame: VesselSessionFrame, model: FrozenVesselStudentModel): VesselModelComparison {
  if (model.scopeKey !== scopeKey || model.channel !== 'shaft-reference-to-speed' || !controllerInput.containerSpeed) {
    throw new Error('请选择本人冻结的三点航速模型和PI方案。');
  }
  const timeS = Array.from({length: Math.round(durationS / .2) + 1}, (_, index) => index * .2);
  const actual = frame.truth.actuator_states;
  const result = computeVirtualSimulationStep<AnalysisResult>({modelId: 'student_model_analysis', operation: 'container_closed_loop',
    structure: model.payload.structure, dtS: .2, inputOrigin: Number(model.payload.operatingPoint.inputOrigin),
    outputOrigin: Number(model.payload.operatingPoint.outputOrigin), initialSpeedMps: configuration.initialWaterSpeedMps,
    initialBowDistanceM: 0, currentForwardMps: 0, loadingRatio: configuration.loadingRatio,
    maximumRpm: frame.parameters.shaftConfigurations[0]?.ratedRpm, controller: controllerInput.containerSpeed,
    referenceMps: timeS.map((time) => sequence === 10 ? time < 30 || time >= 450 ? 8 : 10
      : sequence >= 7 && sequence <= 9 && time >= 30 ? 9 : 8),
    voyage: configuration.containerVoyage, fuelModel: frame.teachingFuel?.model ?? CONTAINER_TEACHING_FUEL,
    initialShaftPowerW: actual.motor_torques_nm.reduce((sum, torque, index) =>
      sum + Math.max(0, torque * actual.propeller_shaft_speed_rad_s[index]), 0)});
  return {id: crypto.randomUUID(), scopeKey, modelId: model.id, actuatorModelId: null, runId,
    mode: 'independent_closed_loop', purpose: 'forecast', startS: 0, endS: durationS, timeS, actual: [],
    predicted: result.predicted, measuredInput: [], predictedInput: result.commandsRpm ?? null,
    metrics: {ideal_arrival_s: result.idealArrivalS ?? null, ideal_fuel_kg: result.idealFuelKg ?? null},
    createdAtMs: Date.now(), serverId: null, outputUnit: 'm/s', outputChannel: 'SpeedLog',
    controllerInput: structuredClone(controllerInput), factorFlags: vesselComparisonFactors(configuration, 'independent_closed_loop')};
}

export function forecastVesselSpeed(scopeKey: string, runId: string, configuration: VesselSessionConfiguration,
  durationS: number, controllerInput: VesselSessionInput, parameters: VesselSessionFrame['parameters'],
  model: FrozenVesselStudentModel): VesselModelComparison {
  if (model.scopeKey !== scopeKey || model.channel !== 'shaft-reference-to-speed' || !controllerInput.longitudinal) {
    throw new Error('请选择本人冻结的轴速参考—航速模型及对应PI方案。');
  }
  const timeS = Array.from({length: Math.round(durationS / .2) + 1}, (_, index) => index * .2);
  const result = computeVirtualSimulationStep<AnalysisResult>({modelId: 'student_model_analysis', operation: 'speed_closed_loop',
    structure: model.payload.structure, dtS: .2, inputOrigin: Number(model.payload.operatingPoint.inputOrigin),
    outputOrigin: Number(model.payload.operatingPoint.outputOrigin), initialSpeedMps: configuration.initialWaterSpeedMps ?? 4,
    initialBowDistanceM: configuration.berth?.initialBowDistanceM ?? 0, currentForwardMps: 0,
    maximumRpm: Math.min(...parameters.shaftConfigurations.map((shaft) => shaft.ratedRpm)),
    controller: controllerInput.longitudinal, brakingPlan: controllerInput.berthPlan,
    referenceMps: timeS.map((time) => !configuration.berth && time >= 20 ? 3 : controllerInput.longitudinal!.referenceMps)});
  return {id: crypto.randomUUID(), scopeKey, modelId: model.id, actuatorModelId: null, runId,
    mode: 'independent_closed_loop', startS: 0, endS: durationS, timeS, actual: [], predicted: result.predicted,
    measuredInput: [], predictedInput: result.commandsRpm ?? null, predictedBowClearanceM: result.bowClearanceM,
    metrics: {outside_local_speed_domain: result.outsideLocalSpeedDomain ? 1 : 0},
    outputUnit: 'm/s', outputChannel: 'SpeedLog', createdAtMs: Date.now(), serverId: null, purpose: 'forecast',
    controllerInput: structuredClone(controllerInput), factorFlags: vesselComparisonFactors(configuration, 'independent_closed_loop')};
}

export function forecastDestroyerClosedLoop(scopeKey: string, runId: string, step: DestroyerCourseStep,
  controllerInput: VesselSessionInput, model: FrozenVesselStudentModel, actuator: FrozenVesselStudentModel): VesselModelComparison {
  if (model.scopeKey !== scopeKey || actuator.scopeKey !== scopeKey || model.channel !== 'rudder-to-yaw' || actuator.channel !== 'rudder-servo') {
    throw new Error('请选择本人冻结的船体与舵机模型。');
  }
  const duration = step.runDurationS;
  if (duration === undefined) throw new Error('该分析步骤无需运行航向闭环。');
  const timeS = Array.from({ length: Math.round(duration/.05)+1 }, (_,index) => index*.05);
  const result = computeVirtualSimulationStep<AnalysisResult>({ modelId: 'student_model_analysis', operation: 'heading_closed_loop',
    structure: model.payload.structure, inputOrigin: Number(model.payload.operatingPoint.inputOrigin),
    outputOrigin: Number(model.payload.operatingPoint.outputOrigin), dtS: .05,
    initialHeadingDeg: step.configuration.initialHeadingDeg ?? 0, initialYawRateDegS: 0,
    reference: timeS.map((time) => destroyerCourseCommands(step,time).headingDeg), controller: controllerInput,
    actuator: { structure: actuator.payload.structure, inputOrigin: Number(actuator.payload.operatingPoint.inputOrigin),
      outputOrigin: Number(actuator.payload.operatingPoint.outputOrigin), initialOutput: 0 } });
  return { id: crypto.randomUUID(), scopeKey, modelId: model.id, actuatorModelId: actuator.id, runId,
    mode: 'independent_closed_loop', startS: 0, endS: duration, timeS, actual: [], predicted: result.predicted,
    measuredInput: [], predictedInput: result.commandsDeg ?? null, metrics: {}, createdAtMs: Date.now(), serverId: null,
    outputUnit:'°/s',outputChannel:'YawRate',actualHeadingDeg:[],predictedHeadingDeg:result.headingDeg,
    factorFlags:vesselComparisonFactors(step.configuration,'independent_closed_loop'),
    purpose: 'forecast', controllerInput: structuredClone(controllerInput) };
}


/**
 * Evaluate the open-loop linear response of a frozen student model via the WASM runtime.
 * Returns null safely if the model uses a 3-DOF DP matrix or the browser runtime is not ready.
 */
export function evaluateLinearReferenceSeries(
  model: FrozenVesselStudentModel | null | undefined,
  timeS: number[],
  inputSeries: number[],
  outputOrigin = 0,
): number[] | null {
  if (!model || model.payload.structure.kind === 'dp_low_freq3') return null;
  if (timeS.length < 2 || inputSeries.length !== timeS.length) return null;
  const dtS = Math.max(0.01, timeS[1] - timeS[0]);
  const inputOrigin = inputSeries[0] ?? 0;
  try {
    const result = computeVirtualSimulationStep<{ predicted?: number[] }>({
      modelId: 'student_model_analysis',
      operation: 'predict',
      structure: model.payload.structure,
      input: inputSeries,
      output: new Array<number>(inputSeries.length).fill(outputOrigin),
      dtS,
      inputOrigin,
      outputOrigin,
    });
    if (!Array.isArray(result.predicted) || result.predicted.length !== inputSeries.length) {
      return null;
    }
    return result.predicted;
  } catch {
    return null;
  }
}

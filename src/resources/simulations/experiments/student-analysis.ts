import type { ModelStructureValue, StudentModelSaveInput, ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import { sensorKey, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import type { VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { destroyerCourseCommands, type DestroyerCourseStep } from './destroyer-course';
import { vesselComparisonFactors,type VesselComparisonFactors } from './comparison-factors';

export type IdentificationChannel = 'rudder-to-yaw' | 'rudder-servo' | 'shaft-to-speed';
export interface StudentHeadingDesign {
  kp: number; ki: number; kd: number;
  dampingRatio: number; naturalFrequencyRadS: number;
  kpMinimum: number; kpMaximum: number; kdMaximum: number;
}

export function designStudentHeadingController(model: Pick<FrozenVesselStudentModel, 'payload'>): StudentHeadingDesign {
  return computeVirtualSimulationStep<StudentHeadingDesign>({ modelId:'student_model_analysis',operation:'heading_design',structure:model.payload.structure });
}
export interface FrozenVesselStudentModel {
  id: string;
  scopeKey: string;
  label: string;
  channel: IdentificationChannel;
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
  actualHeadingDeg?:Array<number|null>;
  predictedHeadingDeg?:number[];
  factorFlags?:VesselComparisonFactors;
}

interface AnalysisResult {
  identifiedOk?: boolean;
  structure?: ModelStructureValue | null;
  failureReason?: string | null;
  predicted: number[];
  headingDeg?: number[];
  commandsDeg?: number[];
  actualSurfaceDeg?: number[];
  metrics: Record<string, number | null> | null;
}

function channelSignals(channel: IdentificationChannel) {
  if (channel === 'rudder-servo') return { input: 'command', output: 'SurfaceEncoder0', inputUnit: '°', outputUnit: '°' };
  if (channel === 'shaft-to-speed') return { input: 'ShaftSpeed0', output: 'SpeedLog', inputUnit: 'r/min', outputUnit: 'm/s' };
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
  if (run.nativeSensorSamples.length) {
    for (const sample of run.nativeSensorSamples) {
      const name = sensorKey(sample.signal);
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
    const value = commandInput || signals.input === 'command' ? point.command.surfaceDeg[0] : heldInput;
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
  kind: 'nomoto1' | 'nomoto2' | 'fopdt', startS: number, endS: number): FrozenVesselStudentModel {
  const window = measuredWindow(run, channel, startS, endS);
  const inputOrigin = window.input[0], outputOrigin = window.output[0];
  const result = computeVirtualSimulationStep<AnalysisResult>({ modelId: 'student_model_analysis', operation: 'identify',
    structureKind: kind, input: window.input, output: window.output, dtS: window.dtS, inputOrigin, outputOrigin });
  if (!result.identifiedOk || !result.structure) throw new Error(result.failureReason ?? '这次辨识未成功，请保留记录并调整激励或窗口。');
  const labels = { 'rudder-to-yaw': '舵角—转艏速率', 'rudder-servo': '舵机', 'shaft-to-speed': '轴速—航速' };
  return { id: crypto.randomUUID(), scopeKey: run.scopeKey, label: `${labels[channel]} · 第${run.stepSequence}步`, channel,
    createdAtMs: Date.now(), serverId: null, contentHash: null,
    payload: { experimentKey: run.courseKey, lineageKey: `${channel}@${run.configuration.initialWaterSpeedMps ?? 0}`,
      structure: result.structure, ioContract: { inputChannel: window.signals.input, outputChannel: window.signals.output,
        inputUnit: window.signals.inputUnit, outputUnit: window.signals.outputUnit },
      operatingPoint: { inputOrigin, outputOrigin, speedMps: run.configuration.initialWaterSpeedMps ?? 0,
        loadingRatio: run.configuration.loadingRatio ?? 0, courseVersion: run.courseVersion },
      identification: { algorithm: `student-model-${kind}`, settings: { startS, endS,
        ...(result.metrics?.fit_percent != null ? {trainingFitPercent:result.metrics.fit_percent} : {}) }, identifiedOk: true,
        residualRms: result.metrics?.rmse ?? undefined, failureReason: null },
      trainingRuns: [{ runRef: run.id, startS, endS }], validationRuns: [], sampleDt: window.dtS } };
}

export function compareVesselStudentModel(run: VesselRunEvidence, model: FrozenVesselStudentModel,
  mode: ComparisonModeValue, startS: number, endS: number, actuator?: FrozenVesselStudentModel): VesselModelComparison {
  if (model.scopeKey !== run.scopeKey || (actuator && actuator.scopeKey !== run.scopeKey)) throw new Error('请选择本次实验的模型。');
  if (model.channel === 'rudder-servo') throw new Error('请选择船体或航速模型执行对照，舵机模型用于执行器级联。');
  if (mode !== 'hull_model' && (!actuator || actuator.channel !== 'rudder-servo')) throw new Error('请先选择本人辨识并冻结的舵机模型。');
  if (mode !== 'hull_model' && model.channel !== 'rudder-to-yaw') throw new Error('舵机级联和独立航向闭环需要舵角—转艏速率模型。');
  const window = measuredWindow(run, model.channel, startS, endS, mode !== 'hull_model');
  const trainingOverlap = model.payload.trainingRuns.some((training) => training.runRef === run.id
    && training.startS < endS && startS < training.endS);
  if (trainingOverlap) throw new Error('独立验证窗口需要与该模型的训练窗口分开。');
  if (mode !== 'hull_model' && window.initialMeasuredInput === undefined) throw new Error('比较窗口缺少初始实际舵角量测。');
  const actuatorPrediction = actuator ? { structure: actuator.payload.structure,
    inputOrigin: Number(actuator.payload.operatingPoint.inputOrigin), outputOrigin: Number(actuator.payload.operatingPoint.outputOrigin),
    initialOutput: window.initialMeasuredInput } : undefined;
  const request = { modelId: 'student_model_analysis', structure: model.payload.structure, dtS: window.dtS,
    inputOrigin: Number(model.payload.operatingPoint.inputOrigin), outputOrigin: Number(model.payload.operatingPoint.outputOrigin),
    ...(mode === 'hull_model' ? {} : { actuator: actuatorPrediction }) };
  let result: AnalysisResult;
  if (mode === 'independent_closed_loop') {
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
  return { id: crypto.randomUUID(), scopeKey: run.scopeKey, modelId: model.id, actuatorModelId: actuator?.id ?? null,
    runId: run.id, mode, startS, endS, timeS: window.timeS, actual: window.output, predicted: result.predicted,
    measuredInput: window.input, predictedInput: result.commandsDeg ?? null, metrics: result.metrics ?? {}, createdAtMs: Date.now(), serverId: null,
    outputUnit:window.signals.outputUnit,actualHeadingDeg:window.headingDeg,predictedHeadingDeg:result.headingDeg,
    factorFlags:vesselComparisonFactors(run.configuration,mode),
    purpose: 'validation', controllerInput: run.initialInput };
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
    outputUnit:'°/s',actualHeadingDeg:[],predictedHeadingDeg:result.headingDeg,
    factorFlags:vesselComparisonFactors(step.configuration,'independent_closed_loop'),
    purpose: 'forecast', controllerInput: structuredClone(controllerInput) };
}

import type { ModelStructureValue } from '@/lib/student-model-artifact-contract';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';
import { vesselComparisonFactors } from './comparison-factors';

export function dpMeasurementWindow(run: VesselRunEvidence, startS: number, endS: number) {
  if (run.courseKey !== 'drilling' || !Number.isFinite(startS) || !Number.isFinite(endS)
    || startS < 0 || endS <= startS || endS > run.lastTimeS + 1e-7) {
    throw new Error('请选择本人平台运行中的有效分析窗口。');
  }
  const points = run.trace.filter((point) => point.timeS >= startS - 1e-7 && point.timeS <= endS + 1e-7
    && Math.abs(point.timeS * 10 - Math.round(point.timeS * 10)) < 1e-6);
  if (points.length < 20 || points.some((point, index) =>
    (index > 0 && Math.abs(point.timeS - points[index - 1].timeS - 0.1) > 1e-6)
    || !point.estimatedControlLoadBody
    || ['North', 'East', 'Heading'].some((name) => point.measurements[name]?.quality !== 'Good')
    || [...point.estimatedControlLoadBody, point.estimate.northM, point.estimate.eastM, point.estimate.headingDeg]
      .some((value) => !Number.isFinite(value)))) {
    throw new Error('窗口需要连续有效的定位量测和仪器估计出力，请避开缺测区间。');
  }
  return {
    timeS: points.map((point) => point.timeS),
    inputBody: points.map((point) => point.estimatedControlLoadBody!),
    output: points.map((point) => [point.estimate.northM, point.estimate.eastM, point.estimate.headingDeg * Math.PI / 180] as [number, number, number]),
    dtS: 0.1,
  };
}

export function identifyDpStudentModel(runs: VesselRunEvidence[], startS: number, endS: number): FrozenVesselStudentModel {
  const first = runs[0];
  if (runs.length !== 3 || new Set(runs.map((run) => run.id)).size !== 3 || !first
    || runs.some((run) => run.scopeKey !== first.scopeKey || run.stepSequence !== 3 || run.stoppedAtMs === null)
    || new Set(runs.map((run) => run.courseSettings?.excitationAxis)).size !== 3) {
    throw new Error('请分别选择本人第3步纯纵向、横向和艏摇的三次完整运行。');
  }
  const windows = runs.map((run) => dpMeasurementWindow(run, startS, endS));
  const result = computeVirtualSimulationStep<{
    identifiedOk: boolean; structure: ModelStructureValue | null; residualRms: number; failureReason: string | null;
  }>({ modelId: 'student_model_analysis', operation: 'dp_identify', runs: windows, dtS: 0.1 });
  if (!result.identifiedOk || result.structure?.kind !== 'dp_low_freq3') {
    throw new Error(result.failureReason ?? '三通道辨识未成功，请保留记录并检查激励或窗口。');
  }
  return {
    id: crypto.randomUUID(), scopeKey: first.scopeKey, label: '本人三通道低频模型', channel: 'dp-low-frequency',
    createdAtMs: Date.now(), serverId: null, contentHash: null,
    payload: {
      experimentKey: 'drilling', lineageKey: 'dp-low-frequency', structure: result.structure,
      ioContract: { inputChannel: 'EstimatedTauBody3', outputChannel: 'LowFrequencyNorth', inputUnit: 'N,N,N·m', outputUnit: 'm' },
      operatingPoint: { courseVersion: first.courseVersion, speedMps: 0, inputOrigin: 0, outputOrigin: 0,
        coupledOutputs: 'LowFrequencyEast,LowFrequencyHeading', coupledUnits: 'm,rad', positionSource: 'low_frequency_observer' },
      identification: { algorithm: 'dp-discrete-multirun', settings: { startS, endS, independentRuns: 3, crossRunTransitionsExcluded: true },
        identifiedOk: true, residualRms: result.residualRms, failureReason: null },
      trainingRuns: runs.map((run) => ({ runRef: run.id, startS, endS })), validationRuns: [], sampleDt: 0.1,
    },
  };
}

export function compareDpStudentModel(run: VesselRunEvidence, model: FrozenVesselStudentModel,
  startS: number, endS: number): VesselModelComparison {
  if (model.scopeKey !== run.scopeKey || model.payload.structure.kind !== 'dp_low_freq3') {
    throw new Error('请选择本次实验已冻结的本人三通道模型。');
  }
  if (model.payload.trainingRuns.some((window) => window.runRef === run.id && window.startS < endS && startS < window.endS)) {
    throw new Error('独立验证窗口需要与模型训练窗口分开。');
  }
  const window = dpMeasurementWindow(run, startS, endS);
  const result = computeVirtualSimulationStep<{
    predicted: Array<[number, number, number]>; metrics: Array<Record<string, number | null>>;
  }>({ modelId: 'student_model_analysis', operation: 'dp_predict', structure: model.payload.structure, signals: window, dtS: window.dtS });
  const metrics = { ...result.metrics[0] };
  for (const [index, prefix] of [[1, 'east'], [2, 'heading']] as const) {
    for (const [key, value] of Object.entries(result.metrics[index])) metrics[`${prefix}_${key}`] = value;
  }
  return {
    id: crypto.randomUUID(), scopeKey: run.scopeKey, modelId: model.id, actuatorModelId: null, runId: run.id,
    mode: 'hull_model', startS, endS, timeS: window.timeS,
    actual: window.output.map((point) => point[0]), predicted: result.predicted.map((point) => point[0]),
    measuredInput: window.inputBody.map((point) => point[0]), predictedInput: null,
    actualEastM: window.output.map((point) => point[1]), predictedEastM: result.predicted.map((point) => point[1]),
    actualHeadingDeg: window.output.map((point) => point[2] * 180 / Math.PI),
    predictedHeadingDeg: result.predicted.map((point) => point[2] * 180 / Math.PI),
    metrics, createdAtMs: Date.now(), serverId: null, outputUnit: 'm', outputChannel: 'LowFrequencyNorth',
    factorFlags: vesselComparisonFactors(run.configuration, 'hull_model'), purpose: 'validation', controllerInput: run.initialInput,
  };
}

import type { VesselControlSample, VesselFineStepPoint, VesselObservedSample, VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';

export interface VesselTracePoint {
  dredger?: Omit<NonNullable<VesselControlSample['dredger']>, 'samples'>;
  ice?: VesselSessionFrame['iceContact'];
  dp?: VesselSessionFrame['dpController'];
  estimatedControlLoadBody?: [number, number, number];
  propulsorThrustN?: number[];
  cruise?: VesselSessionFrame['cruiseController'];
  container?: VesselSessionFrame['containerController'];
  liquid?: {modeHeightsM:number[];cornerHeightsM:number[];withinSmallAmplitude:boolean};
  longitudinal?: {referenceMps:number|null;filteredMeasurementMps:number|null;feedbackMps:number|null;
    integralRpm:number;unsaturatedRpm:number;requestedRpm:number;appliedRpm:number;integralFrozen:boolean};
  timeS: number;
  command: { headingDeg: number; shaftRpm: number[]; surfaceDeg: number[]; azimuthDeg?:number[] };
  measurements: Record<string, { value: number | null; sampledAtS: number; arrivedAtS: number; quality: string }>;
  estimate: { headingDeg: number; yawRateDegS: number; groundBodySpeedMps: number;
    groundBodyLateralSpeedMps?:number; northM: number; eastM: number };
  dynamics?: VesselControlSample['dynamics'];
  truth: {
    headingDeg: number; yawRateDegS: number; rollDeg: number; pitchDeg: number; rollRateDegS: number; pitchRateDegS: number;
    waterSpeedMps: number; groundBodySpeedMps: number; northM: number; eastM: number;
    waterLateralSpeedMps?:number;
    shaftRpm: number[]; surfaceDeg: number[]; azimuthDeg: number[];
    windLoad: number[] | null; waveFirstLoad: number[] | null; waveSecondLoad: number[] | null;
    propellerWorkJ: number[];
    motorPowerW: number[]; positiveMotorWorkJ: number; fuelKg: number | null;
    positionNedM?: [number,number,number];
    bowClearanceM?: number;
    quaternionWxyz?: [number,number,number,number];
    bodyVelocitySi?: [number,number,number,number,number,number];
  };
}

export type VesselRunMetrics = {
  dredgerSwayRmsMps?: number | null;
  dredgerDepthRmsM?: number | null;
  dredgerCutDurationS?: number;
  dredgerOverloadedCutDurationS?: number;
  dredgerProductionM3?: number;
  dredgerMechanicalWorkJ?: number;
  dredgerSpecificEnergyJPerM3?: number | null;
  dredgerModeChangeCount?: number;
  dredgerChatterEventCount?: number;
  dredgerReversalCount?: number;
  dredgerStopCommandAfterFaultS?: number | null;
  dredgerLiftAfterFaultS?: number | null;
  dredgerHardViolationDurationS?: number;
  dredgerSoilDomainViolationDurationS?: number;
  dredgerMaximumLadderRateDegS?: number;
  dredgerMaximumCutterRpm?: number;
  dredgerMaximumCutterPowerW?: number;
  dredgerMaximumWinchPowerW?: number;
  dredgerMaximumCableTensionN?: number;
  dredgerMaximumSpudReactionN?: number;
  sampleCadenceS:number;
  validHeadingSamples:number;
  missingHeadingSamples:number;
  headingRmseDeg:number | null;
  final120sHeadingMaeDeg:number | null;
  headingOvershootPercent:number | null;
  settlingTimeS:number | null;
  settlingBandDeg:number;
  rudderTotalVariationDeg:number;
  maximumRollDeg:number;
  maximumShaftPowerW:number;
  positiveMotorWorkJ:number;
  positionRmsM?:number;
  headingRmsDeg?:number;
  maximumPositionErrorM?:number;
  normalizedAllocationResidualRms?:number;
  actualDistanceM?: number;
  finalNorthM?: number;
  maximumCrossTrackM?: number;
  corridorViolationDurationS?: number;
  stallDurationS?: number;
  stalled?: number;
  iceTaskCompleted?: number;
  eligibleForEnergyComparison?: number;
  energyPerDistanceJPerM?: number | null;
};

export interface VesselRunEvidence {
  dredgerModeEvents?: VesselSessionFrame['dredgerEvents'];
  cruiseComfort?: VesselSessionFrame['cruiseComfort'];
  id: string;
  scopeKey: string;
  courseKey: VesselCourseKey;
  courseVersion: string;
  stepSequence: number;
  prediction: string;
  durationS: number;
  createdAtMs: number;
  lastTimeS: number;
  stoppedAtMs: number | null;
  configuration: VesselSessionConfiguration;
  initialInput: VesselSessionInput;
  controllerSourceRunId?: string;
  designStudentModelId?: string;
  courseSettings?: Record<string, unknown>;
  parameterHash: string;
  runtimeVersion?:string;
  parameters?: VesselSessionFrame['parameters'];
  initialCheckpoint: string;
  checkpoint: string;
  trace: VesselTracePoint[];
  nativeSensorSamples: VesselObservedSample[];
  fineStepSamples?: VesselFineStepPoint[];
  changes: Array<{ timeS: number; input: VesselSessionInput }>;
  stopReason: 'student' | 'duration' | 'arrival' | 'time_limit' | 'failure' | null;
  failure: string | null;
  checkpointPreview?: VesselCheckpointPreview;
}

export interface VesselEvidenceProgress {
  runRef: string;
  reportId: string;
  experimentKey: string;
  status: string;
  chunkCount: number;
  controlCount: number;
  nativeCount: number;
  fineCount?: number;
  lastTimeS: number;
  parameterHash: string;
  checkpointReference?: string;
  openingReference?: string;
  openingHash?: string;
  transport?: 'oss' | 'legacy';
  saveStatus?: 'saved';
  evidenceStatus?: 'pending' | 'verifying' | 'failed' | 'verified';
}


export interface CourseRecoveredRun extends VesselRunEvidence {
  uploadReceipt?: VesselEvidenceProgress & { reportClientRef: string };
  resumable?: boolean;
  traceManifest?: Pick<VesselEvidenceProgress, 'chunkCount' | 'controlCount' | 'nativeCount' | 'fineCount'> & { references?: string[] };
}

export type CourseRunRecoveryHeader = Omit<CourseRecoveredRun, 'initialCheckpoint' | 'checkpoint'> & {
  stateObjects: { openingReference: string; checkpointReference: string };
};
export type CourseRunRecovery = CourseRecoveredRun | CourseRunRecoveryHeader;


export interface VesselCheckpointPreview {
  schema: 'act.vessel-checkpoint-preview.v1';
  recoverable: true;
  runtimeVersion?: string;
  parameterHash: string;
  timeS: number;
  controllerTicks: number;
  fineCount: number;
  appliedFinalInput: VesselSessionInput;
  metrics: VesselRunMetrics;
  parameters?: VesselSessionFrame['parameters'];
  fineStepMetrics?: VesselSessionFrame['fineStepMetrics'];
  cruiseComfort?: VesselSessionFrame['cruiseComfort'];
  voyage?: NonNullable<VesselSessionFrame['containerVoyage']>['progress'];
  fuelKg?: number;
}

export interface VesselLocalStepAttempt {
  id: string;
  scopeKey: string;
  stepSequence: number;
  runIds: string[];
  studentModelIds: string[];
  comparisonIds: string[];
  answers: Record<string, string>;
  createdAtMs: number;
  status: 'pending-review' | 'invalid_run' | 'model_mismatch' | 'below_target';
  validationFeedback?: string | null;
  serverId: string | null;
}

export function vesselDpMetricsRequest(points: VesselTracePoint[], endTimeS: number) {
  return { modelId: 'student_model_analysis', operation: 'dp_metrics', endTimeS,
    points: points.map((point) => ({ timeS: point.timeS,
      positionErrorM: [point.truth.northM - (point.dp?.targetPositionM[0] ?? 0), point.truth.eastM - (point.dp?.targetPositionM[1] ?? 0)],
      headingErrorDeg: point.truth.headingDeg - (point.dp?.targetHeadingDeg ?? point.command.headingDeg),
      normalizedAllocationResidual: point.dp?.allocation?.normalizedResidual ?? 0 })) };
}

export function vesselDredgerMetricPoint(timeS: number, point: NonNullable<VesselTracePoint['dredger']>,
  propulsionWorkJ: number) {
  const observed = point.observation;
  return {timeS, mode: point.mode, swayMps: observed.cutterSwaySpeedMps, referenceMps: point.referenceMps,
    depthM: observed.depthM, depthReferenceM: point.commands.depthReferenceM, productionM3: observed.productionM3,
    mechanicalWorkJ: observed.positiveCutterWorkJ + observed.positiveWinchWorkJ + propulsionWorkJ,
    cutPowerW: observed.cuttingPowerW, cableTensionN: observed.cableTensionN, spudReactionN: observed.spudReactionN,
    cutterRpm: observed.cutterRpm, cutterReferenceRpm: point.commands.cutterRpm, cableBroken: point.cableBroken,
    modeEventCount: point.modeEventCount, chatterEventCount: point.chatterEventCount, reversalCount: point.reversalCount};
}

export function vesselDredgerModeEvents(frame: Pick<VesselSessionFrame, 'dredgerEvents' | 'dredgerController'>) {
  return [...(frame.dredgerEvents ?? []), ...(frame.dredgerController?.events ?? [])]
    .sort((first, second) => first.timeS - second.timeS);
}
export type VesselDredgerMetricPoint = ReturnType<typeof vesselDredgerMetricPoint>;

export function vesselDredgerMetricsRequest(points: VesselTracePoint[], endTimeS: number, terminalPoint?: VesselDredgerMetricPoint) {
  return {modelId: 'student_model_analysis', operation: 'dredger_metrics', endTimeS, terminalPoint,
    points: points.map((point) => {
      if (!point.dredger) throw new Error('本次作业记录缺少连续的机构采样。');
      return vesselDredgerMetricPoint(point.timeS, point.dredger, point.truth.positiveMotorWorkJ);
    })};
}

export function vesselDredgerFineMetrics(fine: NonNullable<VesselSessionFrame['dredgerFineMetrics']>) {
  return {dredgerHardViolationDurationS: fine.hardViolationDurationS,
    dredgerSoilDomainViolationDurationS: fine.soilDomainViolationDurationS,
    dredgerMaximumLadderRateDegS: fine.maximumLadderRateDegS, dredgerMaximumCutterRpm: fine.maximumCutterRpm,
    dredgerMaximumCutterPowerW: fine.maximumCutterPowerW, dredgerMaximumWinchPowerW: fine.maximumWinchPowerW,
    dredgerMaximumCableTensionN: fine.maximumCableTensionN, dredgerMaximumSpudReactionN: fine.maximumSpudReactionN};
}

export interface VesselIceMetricPoint {
  timeS: number;
  northM: number;
  eastM: number;
  positiveMotorWorkJ: number;
  forwardRequested: boolean;
}

export function vesselIceMetricsRequest(points: VesselTracePoint[], terminalPoint?: VesselIceMetricPoint) {
  return { modelId: 'student_model_analysis', operation: 'ice_metrics', terminalPoint,
    points: points.map((point) => ({ timeS: point.timeS, northM: point.truth.northM, eastM: point.truth.eastM,
      positiveMotorWorkJ: point.truth.positiveMotorWorkJ,
      forwardRequested: point.command.shaftRpm.some((rpm) => rpm > 0) })) };
}

export function sensorKey(signal: VesselObservedSample['signal']): string {
  if (typeof signal === 'string') return signal;
  const [name, index] = Object.entries(signal)[0];
  return `${name}${index}`;
}

export interface VesselTraceChunkData {
  schema: 'act.vessel-trace-chunk.v1'; runRef: string; parameterHash: string;
  chunkIndex: number; controlStart: number; nativeStart: number; endTimeS: number;
  points: VesselTracePoint[]; nativeSamples: VesselObservedSample[];
  fineStart?: number; fineSamples?: VesselFineStepPoint[];
  changes: Array<{ timeS: number; input: VesselSessionInput }>;
}

export interface VesselTraceChunkMetadata {
  schema: 'act.vessel-trace-metadata.v1'; runRef: string; parameterHash: string;
  chunkIndex: number; controlStart: number; controlCount: number; nativeStart: number; nativeCount: number;
  fineStart: number; fineCount: number; hasFineSamples: boolean; endTimeS: number;
  fineFirstTimeS?: number; fineLastTimeS?: number; earliestChangeTimeS?: number; firstSampleReceipt?: string;
  nativeFirstWatermarks: Record<string, number>; nativeLastWatermarks: Record<string, number>;
}

/** 浏览器与服务端共用同一分块边界表示，完整正文检查由各自调用入口负责。 */
export function vesselTraceMetadata(chunk: VesselTraceChunkData, firstSampleReceipt?: string): VesselTraceChunkMetadata {
  const nativeFirstWatermarks: Record<string, number> = {};
  const nativeLastWatermarks: Record<string, number> = {};
  for (const sample of chunk.nativeSamples) {
    const key = sensorKey(sample.signal);
    nativeFirstWatermarks[key] ??= sample.measurement.t_sample_s;
    nativeFirstWatermarks[`${key}:arrival`] ??= sample.measurement.t_arrive_s;
    nativeLastWatermarks[key] = sample.measurement.t_sample_s;
    nativeLastWatermarks[`${key}:arrival`] = sample.measurement.t_arrive_s;
  }
  return { schema: 'act.vessel-trace-metadata.v1', runRef: chunk.runRef, parameterHash: chunk.parameterHash,
    chunkIndex: chunk.chunkIndex, controlStart: chunk.controlStart, controlCount: chunk.points.length,
    nativeStart: chunk.nativeStart, nativeCount: chunk.nativeSamples.length,
    fineStart: chunk.fineStart ?? 0, fineCount: chunk.fineSamples?.length ?? 0,
    hasFineSamples: chunk.fineSamples !== undefined, endTimeS: chunk.endTimeS,
    fineFirstTimeS: chunk.fineSamples?.[0]?.timeS, fineLastTimeS: chunk.fineSamples?.at(-1)?.timeS,
    nativeFirstWatermarks, nativeLastWatermarks, firstSampleReceipt,
    earliestChangeTimeS: chunk.changes.length ? Math.min(...chunk.changes.map(change => change.timeS)) : undefined };
}

/** 实际双编码器的同步量测投影，原始记录保持独立。 */
export function vesselEquivalentAzimuthSamples(run: Pick<VesselRunEvidence, 'nativeSensorSamples' | 'trace'>) {
  if (!run.nativeSensorSamples.length) {
    return run.trace.flatMap((point) => {
      const reading = point.measurements.EquivalentAzimuth;
      return reading ? [{ timeS: reading.sampledAtS, value: reading.quality === 'Good' ? reading.value : null }] : [];
    });
  }
  const encoders = [new Map<number, number | null>(), new Map<number, number | null>()];
  for (const sample of run.nativeSensorSamples) {
    if (typeof sample.signal === 'string' || !('AzimuthEncoder' in sample.signal) || sample.signal.AzimuthEncoder > 1) continue;
    encoders[sample.signal.AzimuthEncoder].set(Math.round(sample.measurement.t_sample_s * 1e6),
      sample.measurement.quality === 'Good' ? sample.measurement.value : null);
  }
  return [...encoders[0]].sort(([first], [second]) => first - second).map(([time, port]) => {
    const starboard = encoders[1].get(time);
    return { timeS: time / 1e6, value: port == null || starboard == null ? null : -(port + starboard) / 2 };
  });
}

export function collectVesselTracePoint(frame: VesselControlSample,
  previousMeasurements: VesselTracePoint['measurements']): VesselTracePoint {
  const measurements = { ...previousMeasurements };
  for (const sample of frame.samples) {
    const reading = sample.measurement;
    measurements[sensorKey(sample.signal)] = { value: reading.value,
      sampledAtS: reading.t_sample_s, arrivedAtS: reading.t_arrive_s, quality: reading.quality };
  }
  for (const sample of frame.dredger?.samples ?? []) {
    const reading = sample.measurement;
    const signal = typeof sample.signal === 'string' ? sample.signal
      : Object.entries(sample.signal).map(([name, index]) => `${name}${index}`)[0];
    measurements[`Dredger${signal}`] = {value: reading.value, sampledAtS: reading.t_sample_s,
      arrivedAtS: reading.t_arrive_s, quality: reading.quality};
  }
  const mechanical = frame.dredger;
  const dredger: VesselTracePoint['dredger'] = mechanical ? {
    observation: mechanical.observation, commands: mechanical.commands, mode: mechanical.mode,
    referenceMps: mechanical.referenceMps, integralMps: mechanical.integralMps,
    integralFrozen: mechanical.integralFrozen, feedbackAvailable: mechanical.feedbackAvailable,
    cableBroken: mechanical.cableBroken, modeEventCount: mechanical.modeEventCount,
    chatterEventCount: mechanical.chatterEventCount, reversalCount: mechanical.reversalCount,
  } : undefined;
  const actual = frame.truth.actuator_states;
  const power = actual.motor_torques_nm.map((torque, index) => torque * actual.propeller_shaft_speed_rad_s[index]);
  const loads = frame.dynamics?.external_components;
  const speed = frame.longitudinal;
  const port=measurements.AzimuthEncoder0,starboard=measurements.AzimuthEncoder1;
  if (actual.azimuth_angles_rad.length===2 && port && starboard) {
    const good=port.quality==='Good' && starboard.quality==='Good' && port.value!==null && starboard.value!==null
      && Math.abs(port.sampledAtS-starboard.sampledAtS)<1e-8;
    measurements.EquivalentAzimuth={value:good ? -(port.value!+starboard.value!)/2 : null,
      quality:good ? 'Good' : 'Missing',sampledAtS:Math.max(port.sampledAtS,starboard.sampledAtS),
      arrivedAtS:Math.max(port.arrivedAtS,starboard.arrivedAtS)};
  }
  return { timeS: frame.timeS,
    ...(dredger ? {dredger} : {}),
    ...(frame.ice ? {ice:frame.ice} : {}),
    ...(frame.dp ? {dp: frame.dp} : {}),
    ...(frame.estimatedControlLoadBody ? {estimatedControlLoadBody: frame.estimatedControlLoadBody} : {}),
    ...(frame.propulsorThrustN ? {propulsorThrustN: frame.propulsorThrustN} : {}),
    ...(frame.cruise ? {cruise: frame.cruise} : {}),
    ...(frame.container ? {container: frame.container} : {}),
    ...(frame.liquid ? {liquid:{modeHeightsM:frame.liquid.modeHeightsM,cornerHeightsM:frame.liquid.cornerHeightsM,
      withinSmallAmplitude:frame.liquid.withinSmallAmplitude}} : {}),
    ...(speed ? {longitudinal:{referenceMps:speed.referenceMps ?? null,filteredMeasurementMps:speed.filteredMeasurementMps,
      feedbackMps:speed.feedbackMps,integralRpm:speed.integralRpm,unsaturatedRpm:speed.unsaturatedRpm,
      requestedRpm:speed.requestedRpm,appliedRpm:speed.appliedRpm,integralFrozen:speed.integralFrozen}} : {}),
    command: { headingDeg: frame.targetHeadingDeg,
      shaftRpm: frame.heldCommands.shafts.map((shaft) => shaft.speed_reference_rad_s * 30 / Math.PI),
      ...(actual.azimuth_angles_rad.length===2 ? {azimuthDeg:frame.heldCommands.shafts.map((shaft)=>shaft.azimuth_rad*180/Math.PI)} : {}),
      surfaceDeg: frame.heldCommands.surfaces.map((surface) => surface.angle_rad * 180 / Math.PI) },
    measurements, dynamics:frame.dynamics,
    estimate: { headingDeg: frame.observer.position_heading[2] * 180 / Math.PI,
      yawRateDegS: frame.observer.body_velocity[2] * 180 / Math.PI,
      groundBodySpeedMps: frame.observer.body_velocity[0], northM: frame.observer.position_heading[0],
      groundBodyLateralSpeedMps:frame.observer.body_velocity[1],
      eastM: frame.observer.position_heading[1] },
    truth: { headingDeg: frame.attitudeDeg.heading, yawRateDegS: frame.truth.body_velocity[5] * 180 / Math.PI,
      rollDeg: frame.attitudeDeg.roll, pitchDeg: frame.attitudeDeg.pitch,
      rollRateDegS: frame.truth.body_velocity[3]*180/Math.PI, pitchRateDegS: frame.truth.body_velocity[4]*180/Math.PI,
      positionNedM:frame.truth.position_ned,quaternionWxyz:frame.truth.quaternion,bodyVelocitySi:frame.truth.body_velocity,
      bowClearanceM:frame.bowClearanceM,
      waterSpeedMps: frame.waterVelocityBody[0], groundBodySpeedMps: frame.truth.body_velocity[0],
      waterLateralSpeedMps:frame.waterVelocityBody[1],
      northM: frame.truth.position_ned[0], eastM: frame.truth.position_ned[1],
      shaftRpm: actual.propeller_shaft_speed_rad_s.map((value) => value * 30 / Math.PI),
      surfaceDeg: actual.control_surface_angles_rad.map((value) => value * 180 / Math.PI),
      azimuthDeg: actual.azimuth_angles_rad.map((value) => value * 180 / Math.PI),
      windLoad: loads?.tau_wind ?? null,
      waveFirstLoad: loads?.tau_wave_1 ?? null,
      waveSecondLoad: loads?.tau_wave_2 ?? null,
      propellerWorkJ: actual.propeller_work_j,
      motorPowerW: power, positiveMotorWorkJ: actual.positive_motor_work_j.reduce((sum, value) => sum + value, 0),
      fuelKg: actual.fuel?.fuel_kg ?? null } };
}

export function vesselRunMetricsRequest(points:VesselTracePoint[],endTimeS:number,initialHeadingDeg = 0) {
  return {modelId:'student_model_analysis',operation:'run_metrics',endTimeS,initialHeadingDeg,
    points:points.map((point)=>({timeS:point.timeS,referenceHeadingDeg:point.command.headingDeg,
      headingDeg:point.measurements.Heading?.value ?? null,headingArrivedAtS:point.measurements.Heading?.arrivedAtS ?? null,
      headingQuality:point.measurements.Heading?.quality ?? 'Missing',
      rudderDeg:point.truth.surfaceDeg[0] ?? (point.truth.azimuthDeg.length===2 ? -(point.truth.azimuthDeg[0]+point.truth.azimuthDeg[1])/2 : null),
      rollDeg:point.truth.rollDeg,motorPowerW:point.truth.motorPowerW,positiveMotorWorkJ:point.truth.positiveMotorWorkJ}))};
}

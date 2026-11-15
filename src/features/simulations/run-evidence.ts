import type { VesselControlSample, VesselFineStepPoint, VesselObservedSample, VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';

export interface VesselTracePoint {
  dp?: VesselSessionFrame['dpController'];
  estimatedControlLoadBody?: [number, number, number];
  propulsorThrustN?: number[];
  cruise?: VesselSessionFrame['cruiseController'];
  container?: VesselSessionFrame['containerController'];
  liquid?: {modeHeightsM:number[];cornerHeightsM:number[];withinSmallAmplitude:boolean};
  longitudinal?: {referenceMps:number|null;filteredMeasurementMps:number|null;feedbackMps:number|null;
    integralRpm:number;unsaturatedRpm:number;requestedRpm:number;appliedRpm:number;integralFrozen:boolean};
  timeS: number;
  command: { headingDeg: number; shaftRpm: number[]; surfaceDeg: number[] };
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
};

export interface VesselRunEvidence {
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

export function sensorKey(signal: VesselObservedSample['signal']): string {
  if (typeof signal === 'string') return signal;
  const [name, index] = Object.entries(signal)[0];
  return `${name}${index}`;
}

export function collectVesselTracePoint(frame: VesselControlSample,
  previousMeasurements: VesselTracePoint['measurements']): VesselTracePoint {
  const measurements = { ...previousMeasurements };
  for (const sample of frame.samples) {
    const reading = sample.measurement;
    measurements[sensorKey(sample.signal)] = { value: reading.value,
      sampledAtS: reading.t_sample_s, arrivedAtS: reading.t_arrive_s, quality: reading.quality };
  }
  const actual = frame.truth.actuator_states;
  const power = actual.motor_torques_nm.map((torque, index) => torque * actual.propeller_shaft_speed_rad_s[index]);
  const loads = frame.dynamics?.external_components;
  const speed = frame.longitudinal;
  return { timeS: frame.timeS,
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
      headingQuality:point.measurements.Heading?.quality ?? 'Missing',rudderDeg:point.truth.surfaceDeg[0] ?? null,
      rollDeg:point.truth.rollDeg,motorPowerW:point.truth.motorPowerW,positiveMotorWorkJ:point.truth.positiveMotorWorkJ}))};
}

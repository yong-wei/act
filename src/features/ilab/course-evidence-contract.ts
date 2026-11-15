import { z } from 'zod';
import type { VesselSessionConfiguration, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselObservedSample } from '@/lib/control-engine/vessel-session';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const finite = z.number().finite();
const object = z.record(z.unknown());
const vector = z.array(finite).max(16);
const sixVector = z.tuple([finite,finite,finite,finite,finite,finite]);
const measurement = z.object({ value:finite.nullable(),sampledAtS:finite.min(0),arrivedAtS:finite.min(0),
  quality:z.enum(['Good','Missing','Undefined']) });
const sensorSignal = z.union([
  z.enum(['Heading','YawRate','North','East','SpeedLog','RollRate','PitchRate','SpecificForceX','SpecificForceY','SpecificForceZ','WindSpeed','WindDirection']),
  z.object({ SurfaceEncoder:z.number().int().min(0).max(15) }),
  z.object({ AzimuthEncoder:z.number().int().min(0).max(15) }),
  z.object({ ShaftSpeed:z.number().int().min(0).max(15) }),
]);
const tracePoint = z.object({
  ice:z.object({brokenAreaM2:finite,floeCount:finite,loadBody:sixVector,contactCount:finite,
    crushingWorkJ:finite,frictionWorkJ:finite,fractureWorkJ:finite,waterDissipationJ:finite,
    contactBodyWorkJ:finite,contactFloeWorkJ:finite,characteristicLengthM:finite}).optional(),
  estimatedControlLoadBody:z.tuple([finite,finite,finite]).optional(),
  propulsorThrustN:vector.optional(),
  dp:z.object({ticks:finite,integralEarth:z.tuple([finite,finite,finite]),
    requestedBody:z.tuple([finite,finite,finite]),actualEstimatedBody:z.tuple([finite,finite,finite]),
    positionErrorBody:z.tuple([finite,finite,finite]),feedbackPositionHeading:z.tuple([finite,finite,finite]),
    feedbackBodyVelocity:z.tuple([finite,finite,finite]),measuredWindFeedforwardBody:z.tuple([finite,finite,finite]),
    targetPositionM:z.tuple([finite,finite]),targetHeadingDeg:finite,
    kp:z.tuple([finite,finite,finite]),kd:z.tuple([finite,finite,finite]),ki:z.tuple([finite,finite,finite]),
    navigationGood:z.boolean(),missingNavigationS:finite,integralFrozen:z.boolean(),safeExit:z.boolean(),
    estimatedRollRad:finite,estimatedPitchRad:finite,
    allocation:z.object({requestedBody:z.tuple([finite,finite,finite]),allocatedBody:z.tuple([finite,finite,finite]),
      residualBody:z.tuple([finite,finite,finite]),normalizedResidual:finite,forcesBodyN:z.array(z.tuple([finite,finite])).length(8),
      predictedPowerW:finite,iterations:finite,feasible:z.boolean(),turningWithoutThrust:z.array(z.boolean()).length(8),commands:object}).nullable(),
  }).optional(),
  cruise:z.object({estimatedRollRad:finite,estimatedPitchRad:finite,filteredRollRad:finite,filteredRollRateRadS:finite,
    requestedMomentNm:finite,availableMomentNm:finite,allocatedMomentNm:finite,anglesRad:z.tuple([finite,finite]),
    measurementGood:z.boolean(),lowSpeedAuthority:z.boolean(),samples:finite}).optional(),
  container:z.object({ticks:finite,requestedReferenceMps:finite,slewedReferenceMps:finite,
    filteredWaterSpeedMps:finite.nullable(),filteredFeedbackMps:finite.nullable(),errorMps:finite,
    modelWeights:z.tuple([finite,finite,finite]),outsideIdentifiedDomain:z.boolean(),
    gains:z.object({kpRpmPerMps:finite,tiS:finite,lambdaS:finite,trackingTimeS:finite}),operatingReferenceRpm:finite,
    integralRpm:finite,integralRateRpmPerS:finite,unsaturatedRpm:finite,commandRpm:finite,integralFrozen:z.boolean()}).optional(),
  liquid:z.object({modeHeightsM:vector,cornerHeightsM:vector,withinSmallAmplitude:z.boolean()}).optional(),
  longitudinal:z.object({referenceMps:finite.nullable(),filteredMeasurementMps:finite.nullable(),feedbackMps:finite.nullable(),
    integralRpm:finite,unsaturatedRpm:finite,requestedRpm:finite,appliedRpm:finite,integralFrozen:z.boolean()}).optional(),
  timeS:finite.min(0),command:z.object({ headingDeg:finite,shaftRpm:vector,surfaceDeg:vector,azimuthDeg:vector.optional() }),
  measurements:z.record(measurement),
  estimate:z.object({ headingDeg:finite,yawRateDegS:finite,groundBodySpeedMps:finite,
    groundBodyLateralSpeedMps:finite.optional(),northM:finite,eastM:finite }),
  dynamics:object.nullable().optional(),
  truth:z.object({ headingDeg:finite,yawRateDegS:finite,rollDeg:finite,pitchDeg:finite,
    rollRateDegS:finite.optional(),pitchRateDegS:finite.optional(),
    waterSpeedMps:finite,groundBodySpeedMps:finite,northM:finite,eastM:finite,
    waterLateralSpeedMps:finite.optional(),
    shaftRpm:vector,surfaceDeg:vector,azimuthDeg:vector,windLoad:sixVector.nullable(),
    waveFirstLoad:sixVector.nullable(),waveSecondLoad:sixVector.nullable(),propellerWorkJ:vector,
    motorPowerW:vector,positiveMotorWorkJ:finite,fuelKg:finite.nullable(),
    positionNedM:z.tuple([finite,finite,finite]).optional(),quaternionWxyz:z.tuple([finite,finite,finite,finite]).optional(),
    bowClearanceM:finite.optional(),
    bodyVelocitySi:sixVector.optional(),
  }),
});
const nativeSample = z.object({ signal:sensorSignal,measurement:z.object({
  value:finite.nullable(),t_sample_s:finite.min(0),t_arrive_s:finite.min(0),quality:z.enum(['Good','Missing','Undefined']),
}) });
const fineStepPoint = z.object({timeS:finite.min(0),positionNedM:z.tuple([finite,finite,finite]),
  attitudeDeg:z.tuple([finite,finite,finite]),bodyVelocitySi:sixVector,
  surfaceDeg:vector,shaftRpm:vector,azimuthDeg:vector,motorPowerW:vector});
export const vesselEvidenceOpeningSchema = z.object({
  reportClientRef:z.string().uuid(),runRef:z.string().uuid(),
  courseKey:z.enum(['destroyer','lng','container','cruise','drilling','icebreaker','dredger']),
  courseVersion:z.string().min(1).max(80),stepSequence:z.number().int().min(1).max(20),
  configuration:object,input:object,parameterHash:z.string().min(1).max(128),
  runtimeVersion:z.string().regex(/^[0-9a-f]{64}$/).optional(),
  initialCheckpoint:z.string().min(1).max(3_000_000),
  prediction:z.string().trim().min(1).max(8000),startedAtMs:z.number().int().min(0).max(8_640_000_000_000_000),
  designStudentModelId:z.string().max(80).optional(),controllerSourceRunId:z.string().max(80).optional(),
  courseSettings:object.optional(),
});

export type VesselEvidenceOpening = Omit<z.infer<typeof vesselEvidenceOpeningSchema>,'configuration' | 'input'> & {
  configuration:VesselSessionConfiguration;input:VesselSessionInput;
};

export const vesselTraceChunkSchema = z.object({
  schema:z.literal('act.vessel-trace-chunk.v1'),runRef:z.string().uuid(),
  chunkIndex:z.number().int().min(0).max(4096),
  controlStart:z.number().int().nonnegative(),nativeStart:z.number().int().nonnegative(),
  fineStart:z.number().int().nonnegative().optional(),fineSamples:z.array(fineStepPoint).max(800).optional(),
  parameterHash:z.string().min(1).max(128),endTimeS:finite.min(0).max(3600),
  points:z.array(tracePoint).max(120),nativeSamples:z.array(nativeSample).max(6000),
  changes:z.array(z.object({ timeS:finite.min(0),input:object })).max(512),
});
export type VesselTraceChunk = Omit<z.infer<typeof vesselTraceChunkSchema>,'points' | 'nativeSamples' | 'changes'> & {
  points:VesselTracePoint[];nativeSamples:VesselObservedSample[];
  changes:Array<{ timeS:number;input:VesselSessionInput }>;
};

export const vesselEvidenceCloseSchema = z.object({
  checkpoint:z.string().min(1).max(3_000_000),
  endTimeS:finite.min(0).max(3600),
  controlCount:z.number().int().nonnegative(),
  nativeCount:z.number().int().nonnegative(),
  fineCount:z.number().int().nonnegative().optional(),
  durationS:finite.min(0).max(3600).optional(),
  pendingChunks:z.array(z.string().regex(/^simulation-cas:(file|s3):sha256:[0-9a-f]{64}$/)).max(4096).optional(),
  reason:z.enum(['checkpoint','student','duration','arrival','time_limit','failure']),
  failure:z.string().max(8000).nullable(),
});
export type VesselEvidenceClose = z.infer<typeof vesselEvidenceCloseSchema>;

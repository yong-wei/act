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
  timeS:finite.min(0),command:z.object({ headingDeg:finite,shaftRpm:vector,surfaceDeg:vector }),
  measurements:z.record(measurement),
  estimate:z.object({ headingDeg:finite,yawRateDegS:finite,groundBodySpeedMps:finite,northM:finite,eastM:finite }),
  dynamics:object.nullable().optional(),
  truth:z.object({ headingDeg:finite,yawRateDegS:finite,rollDeg:finite,pitchDeg:finite,
    rollRateDegS:finite.optional(),pitchRateDegS:finite.optional(),
    waterSpeedMps:finite,groundBodySpeedMps:finite,northM:finite,eastM:finite,
    shaftRpm:vector,surfaceDeg:vector,azimuthDeg:vector,windLoad:sixVector.nullable(),
    waveFirstLoad:sixVector.nullable(),waveSecondLoad:sixVector.nullable(),propellerWorkJ:vector,
    motorPowerW:vector,positiveMotorWorkJ:finite,fuelKg:finite.nullable(),
    positionNedM:z.tuple([finite,finite,finite]).optional(),quaternionWxyz:z.tuple([finite,finite,finite,finite]).optional(),
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
  reason:z.enum(['student','duration','arrival','time_limit','failure']),
  failure:z.string().max(8000).nullable(),
});
export type VesselEvidenceClose = z.infer<typeof vesselEvidenceCloseSchema>;

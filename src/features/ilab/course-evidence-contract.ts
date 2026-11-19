import { z } from 'zod/v4';
import { simulationTraceReferencePattern } from '@/features/simulations/public-api';
import type { VesselSessionConfiguration, VesselSessionInput, VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import type { VesselObservedSample } from '@/lib/control-engine/vessel-session';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const finite = z.number().finite();
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const object = z.record(z.string(), z.unknown());
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
  dredger:z.object({
    observation:z.object({depthM:finite,depthRateMps:finite,cutterEastM:finite,cutterSwaySpeedMps:finite,
      ladderAngleDeg:finite,ladderRateDegS:finite,cutterRpm:finite,cutterTorqueNm:finite,cutterPowerW:finite,cuttingPowerW:finite,
      cableTensionN:z.tuple([finite,finite]),cableLengthM:z.tuple([finite,finite]),winchSpeedMps:z.tuple([finite,finite]),
      winchPowerW:z.tuple([finite,finite]),spudContactFraction:finite,spudReactionN:finite,spudVerticalTravelM:finite,
      carriageM:finite,hydraulicForceN:finite,productionM3:finite,productionRateM3S:finite,cuttingWorkJ:finite,
      positiveWinchWorkJ:finite,positiveCutterWorkJ:finite,soilDomainExceeded:z.boolean()}),
    commands:z.object({spudDown:z.boolean(),cablesAttached:z.boolean(),winchSpeedMps:z.tuple([finite,finite]),
      depthReferenceM:finite,ladderAngleReferenceDeg:finite.nullable().optional(),cutterRpm:finite,carriageSpeedMps:finite}),
    mode:z.enum(['transit','prepare','spud_hold','cut_swing','pause_cut','recover','exit']),
    referenceMps:finite,integralMps:finite,integralFrozen:z.boolean(),feedbackAvailable:z.boolean(),
    cableBroken:z.tuple([z.boolean(),z.boolean()]),modeEventCount:finite,chatterEventCount:finite,reversalCount:finite,
  }).optional(),
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
  measurements:z.record(z.string(), measurement),
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
  reportClientRef:uuid,runRef:uuid,
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
  schema:z.literal('act.vessel-trace-chunk.v1'),runRef:uuid,
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

export type { VesselTraceChunkMetadata } from '@/features/simulations/public-api';

export const vesselEvidenceCloseSchema = z.object({
  checkpoint:z.string().min(1).max(3_000_000),
  endTimeS:finite.min(0).max(3600),
  controlCount:z.number().int().nonnegative(),
  nativeCount:z.number().int().nonnegative(),
  fineCount:z.number().int().nonnegative().optional(),
  durationS:finite.min(0).max(3600).optional(),
  pendingChunks:z.array(z.string().regex(simulationTraceReferencePattern)).max(4096).optional(),
  openingReference: z.string().startsWith('simulation-cas:oss:').regex(simulationTraceReferencePattern).optional(),
  baseCheckpointReference: z.string().regex(simulationTraceReferencePattern).optional(),
  reason:z.enum(['checkpoint','student','duration','arrival','time_limit','failure']),
  failure:z.string().max(8000).nullable(),
  checkpointPreview: z.object({
    schema: z.literal('act.vessel-checkpoint-preview.v1'), recoverable: z.literal(true),
    runtimeVersion: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    parameterHash: z.string().min(1).max(128), timeS: finite.min(0).max(3600),
    controllerTicks: z.number().int().nonnegative(), fineCount: z.number().int().nonnegative(),
    appliedFinalInput: object, metrics: z.record(z.string(), finite.nullable()),
    parameters: object.optional(), fineStepMetrics: object.optional(),
    cruiseComfort: object.nullish().transform(value => value ?? undefined).optional(),
    voyage: object.optional(), fuelKg: finite.optional(),
  }).optional(),
});
export type VesselEvidenceClose = z.infer<typeof vesselEvidenceCloseSchema>;
export type VesselEvidenceSave = Omit<VesselEvidenceClose, 'checkpoint'> & { checkpoint?: string };

export const vesselEvidenceCloseMetadataSchema = vesselEvidenceCloseSchema.omit({ checkpoint: true })
  .required({ checkpointPreview: true, baseCheckpointReference: true });
export const vesselEvidenceDirectCloseSchema = vesselEvidenceCloseMetadataSchema.extend({
  checkpointReference: z.string().regex(simulationTraceReferencePattern),
});

const watermarks = z.record(z.string(), finite.min(0)).refine(value => Object.keys(value).length <= 256);
export const vesselTraceChunkMetadataSchema = z.object({
  schema: z.literal('act.vessel-trace-metadata.v1'), runRef: uuid,
  parameterHash: z.string().min(1).max(128), chunkIndex: z.number().int().min(0).max(4096),
  controlStart: z.number().int().nonnegative(), controlCount: z.number().int().min(0).max(120),
  nativeStart: z.number().int().nonnegative(), nativeCount: z.number().int().min(0).max(6000),
  fineStart: z.number().int().nonnegative(), fineCount: z.number().int().min(0).max(800),
  hasFineSamples: z.boolean(), fineFirstTimeS: finite.min(0).optional(), fineLastTimeS: finite.min(0).optional(),
  endTimeS: finite.min(0).max(3600), nativeFirstWatermarks: watermarks, nativeLastWatermarks: watermarks,
  earliestChangeTimeS: finite.min(0).optional(), firstSampleReceipt: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).refine(value => value.controlCount + value.nativeCount + value.fineCount > 0
  && (value.controlCount === 0 || Boolean(value.firstSampleReceipt))
  && (value.hasFineSamples || value.fineCount === 0));

const ossObject = z.object({
  reference: z.string().startsWith('simulation-cas:oss:').regex(simulationTraceReferencePattern),
  uncompressedBytes: z.number().int().min(1).max(4 * 1024 * 1024),
  storedBytes: z.number().int().min(1).max(4 * 1024 * 1024),
});
export const vesselEvidenceOssObjectSchema = z.discriminatedUnion('purpose', [
  ossObject.extend({ purpose: z.literal('opening'), openingHash: z.string().regex(/^[0-9a-f]{64}$/) }),
  ossObject.extend({ purpose: z.literal('chunk'), chunk: vesselTraceChunkMetadataSchema }),
  ossObject.extend({ purpose: z.literal('checkpoint'), close: vesselEvidenceCloseMetadataSchema }),
]);
export type VesselEvidenceOssObject = z.infer<typeof vesselEvidenceOssObjectSchema>;
export const vesselEvidenceOssGrantSchema = z.object({ objects: z.array(vesselEvidenceOssObjectSchema).min(1).max(32) });

export interface VesselEvidenceRunMetadata {
  id: string;
  runtimeVersion: string;
  modelVersion: string;
  seed: bigint | null;
}

export interface VesselRunStorageSummary {
  schema:'act.vessel-run-storage.v1';
  reportId:string;
  experimentKey:string;
  openingHash:string;
  openingReference:string;
  recoveryHeader?: Omit<VesselEvidenceOpening, 'initialCheckpoint'>;
  recoveryCheckpoint?: Partial<Pick<VesselEvidenceClose, 'reason' | 'failure' | 'durationS' | 'endTimeS'
    | 'controlCount' | 'nativeCount' | 'fineCount'>> & { appliedFinalInput?: VesselSessionInput } | null;
  stopReason?: Exclude<VesselEvidenceClose['reason'], 'checkpoint'> | null;
  configurationHash:string;
  parameterHash:string;
  courseKey:string;
  courseVersion:string;
  stepSequence:number;
  chunkCount:number;
  controlCount:number;
  nativeCount:number;
  fineCount?:number;
  fineLastTimeS?:number;
  lastTimeS:number;
  lastCheckpointReference:string;
  nativeWatermarks:Record<string,number>;
  validationRuntimeVersion?:string;
  appliedFactors?:string[];
  dredgerModeEvents?:VesselSessionFrame['dredgerEvents'];
  evidenceVerification?: {
    status: 'pending' | 'verifying' | 'failed' | 'verified';
    checkpointHash: string;
    runtimeVersion: string;
    evidenceHash?: string;
    verifiedAt?: string;
  };
}

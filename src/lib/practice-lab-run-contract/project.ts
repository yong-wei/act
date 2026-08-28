import { ARENA_PREVIEW_TEACHING_SEMANTICS } from '@/lib/control-engine';

import { sealIdentity } from './canonicalize';
import { rejectHiddenPublicPayload } from './privacy';
import { assertPreviewOrPracticeNotOfficial, assertSurrogateTruth } from './validate';
import {
  CONTRACT_SCHEMA,
  DEFAULT_TOLERANCE_PROFILE,
  type ArtifactRunIdentity,
  type PublicRunProjection,
} from './types';

export function projectArenaPreviewIdentity(input: {
  sourceId: string | null;
  ownerUserId: string;
  taskId: string;
  specHash: string;
  artifactHash: string;
  controllerSnapshotRef: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  seed: number | null;
  checksum: string | null;
  summary?: Record<string, number> | null;
  traceRef?: string | null;
}): { identity: ArtifactRunIdentity; publicProjection: PublicRunProjection } {
  const identity = sealIdentity({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: 'arena-preview',
    sourceId: input.sourceId,
    ownerRef: { kind: 'student', id: input.ownerUserId },
    authority: 'simulation-run',
    taskId: input.taskId,
    specHash: input.specHash,
    artifactHash: input.artifactHash,
    controllerSnapshotRef: input.controllerSnapshotRef,
    protocolVersion: input.protocolVersion,
    runtimeVersion: input.runtimeVersion,
    modelVersion: input.modelVersion,
    controllerSchemaVersion: 'arena-controller-artifact-v1',
    executor: 'server',
    authoritySource: 'control-engine-server-facade',
    modelRelation: 'surrogate',
    teachingSemantics: ARENA_PREVIEW_TEACHING_SEMANTICS,
    prohibitsMixedClaims: true,
    parameterVisibility: 'public',
    resultVisibility: 'public',
    evaluationVisibility: 'preview',
    officialEligible: false,
    seed: input.seed,
    checksum: input.checksum,
    toleranceProfile: DEFAULT_TOLERANCE_PROFILE,
  });
  assertPreviewOrPracticeNotOfficial(identity);
  assertSurrogateTruth(identity);
  const publicProjection: PublicRunProjection = {
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: identity.sourceKind,
    taskId: identity.taskId,
    specHash: identity.specHash,
    artifactHash: identity.artifactHash,
    evaluationVisibility: identity.evaluationVisibility,
    officialEligible: identity.officialEligible,
    modelRelation: identity.modelRelation,
    teachingSemantics: identity.teachingSemantics,
    prohibitsMixedClaims: true,
    executor: identity.executor,
    authoritySource: identity.authoritySource,
    checksum: identity.checksum,
    summary: input.summary ?? null,
    traceRef: input.traceRef ?? null,
  };
  rejectHiddenPublicPayload(publicProjection);
  return { identity, publicProjection };
}

export function projectArenaOfficialEvaluationIdentity(input: {
  sourceId: string | null;
  taskId: string;
  specHash: string;
  artifactHash: string;
  controllerSnapshotRef: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  seed: number | null;
  checksum: string | null;
}): ArtifactRunIdentity {
  return sealIdentity({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: 'arena-official-evaluation',
    sourceId: input.sourceId,
    ownerRef: { kind: 'system', id: 'arena-evaluator' },
    authority: 'arena-evaluator',
    taskId: input.taskId,
    specHash: input.specHash,
    artifactHash: input.artifactHash,
    controllerSnapshotRef: input.controllerSnapshotRef,
    protocolVersion: input.protocolVersion,
    runtimeVersion: input.runtimeVersion,
    modelVersion: input.modelVersion,
    controllerSchemaVersion: 'arena-controller-artifact-v1',
    executor: 'server',
    authoritySource: 'arena-official-evaluator',
    modelRelation: 'identified',
    teachingSemantics: 'arena-official-identified-model',
    prohibitsMixedClaims: true,
    parameterVisibility: 'private',
    resultVisibility: 'public',
    evaluationVisibility: 'official',
    officialEligible: true,
    seed: input.seed,
    checksum: input.checksum,
    toleranceProfile: DEFAULT_TOLERANCE_PROFILE,
  });
}

export function projectArenaSubmissionIdentity(input: {
  sourceId: string | null;
  ownerUserId: string;
  taskId: string;
  specHash: string;
  artifactHash: string;
  controllerSnapshotRef: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  seed: number | null;
  checksum: string | null;
}): ArtifactRunIdentity {
  return sealIdentity({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: 'arena-submission',
    sourceId: input.sourceId,
    ownerRef: { kind: 'student', id: input.ownerUserId },
    authority: 'arena-submission',
    taskId: input.taskId,
    specHash: input.specHash,
    artifactHash: input.artifactHash,
    controllerSnapshotRef: input.controllerSnapshotRef,
    protocolVersion: input.protocolVersion,
    runtimeVersion: input.runtimeVersion,
    modelVersion: input.modelVersion,
    controllerSchemaVersion: 'arena-controller-artifact-v1',
    executor: 'server',
    authoritySource: 'arena-official-evaluator',
    modelRelation: 'identified',
    teachingSemantics: 'arena-official-identified-model',
    prohibitsMixedClaims: true,
    parameterVisibility: 'private',
    resultVisibility: 'public',
    evaluationVisibility: 'official',
    officialEligible: true,
    seed: input.seed,
    checksum: input.checksum,
    toleranceProfile: DEFAULT_TOLERANCE_PROFILE,
  });
}

export function projectSimulationRunIdentity(input: {
  sourceId: string | null;
  ownerUserId: string;
  taskId: string;
  specHash: string;
  artifactHash: string;
  controllerSnapshotRef: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  executor: ArtifactRunIdentity['executor'];
  authoritySource: string;
  seed: number | null;
  checksum: string | null;
}): ArtifactRunIdentity {
  return sealIdentity({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: 'simulation-run',
    sourceId: input.sourceId,
    ownerRef: { kind: 'student', id: input.ownerUserId },
    authority: 'simulation-run',
    taskId: input.taskId,
    specHash: input.specHash,
    artifactHash: input.artifactHash,
    controllerSnapshotRef: input.controllerSnapshotRef,
    protocolVersion: input.protocolVersion,
    runtimeVersion: input.runtimeVersion,
    modelVersion: input.modelVersion,
    controllerSchemaVersion: 'simulation-controller-v1',
    executor: input.executor,
    authoritySource: input.authoritySource,
    modelRelation: 'surrogate',
    teachingSemantics: 'standalone-simulation-surrogate',
    prohibitsMixedClaims: true,
    parameterVisibility: 'public',
    resultVisibility: 'public',
    evaluationVisibility: 'practice',
    officialEligible: false,
    seed: input.seed,
    checksum: input.checksum,
    toleranceProfile: DEFAULT_TOLERANCE_PROFILE,
  });
}

export function projectPracticeOutcomeIdentity(input: {
  sourceId: string | null;
  ownerUserId: string;
  taskId: string;
  specHash: string;
  artifactHash: string;
  controllerSnapshotRef: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  executor: ArtifactRunIdentity['executor'];
  authoritySource: string;
  seed: number | null;
  checksum: string | null;
}): ArtifactRunIdentity {
  const identity = sealIdentity({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: 'practice-outcome',
    sourceId: input.sourceId,
    ownerRef: { kind: 'student', id: input.ownerUserId },
    authority: 'practice',
    taskId: input.taskId,
    specHash: input.specHash,
    artifactHash: input.artifactHash,
    controllerSnapshotRef: input.controllerSnapshotRef,
    protocolVersion: input.protocolVersion,
    runtimeVersion: input.runtimeVersion,
    modelVersion: input.modelVersion,
    controllerSchemaVersion: 'practice-controller-v1',
    executor: input.executor,
    authoritySource: input.authoritySource,
    modelRelation: 'surrogate',
    teachingSemantics: 'practice-lab-surrogate',
    prohibitsMixedClaims: true,
    parameterVisibility: 'public',
    resultVisibility: 'public',
    evaluationVisibility: 'practice',
    officialEligible: false,
    seed: input.seed,
    checksum: input.checksum,
    toleranceProfile: DEFAULT_TOLERANCE_PROFILE,
  });
  assertPreviewOrPracticeNotOfficial(identity);
  return identity;
}
